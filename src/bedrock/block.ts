import { BLOCK_FORMAT_VERSION } from './versions';
import { clampInt, toIdentifierSegment } from './ids';
import { GLOW, HARDNESS, blockLookSpec, blockToolSpec, hitsToSeconds } from './blockPresets';
import { isKnownVanillaId } from './vanillaItems';
import type { ModBlock } from './types';

export interface BlockJson {
  format_version: string;
  'minecraft:block': {
    description: {
      identifier: string;
      menu_category: { category: string };
    };
    components: Record<string, unknown>;
  };
}

/** Short name used for filenames and texture keys. */
export function blockShortName(block: ModBlock): string {
  return toIdentifierSegment(block.name, 'my_block');
}

export function blockIdentifier(namespace: string, block: ModBlock): string {
  return `${toIdentifierSegment(namespace, 'mymod')}:${blockShortName(block)}`;
}

/** Texture keys registered in terrain_texture.json for this block. */
export function blockTextureKeys(namespace: string, block: ModBlock) {
  const base = blockIdentifier(namespace, block);
  return { side: base, top: `${base}_top`, bottom: `${base}_bottom` };
}

/**
 * Build `blocks/<name>.json`.
 *
 * Two constraints from the reference that are easy to miss and both fatal:
 *
 *  - From 1.21.80, `minecraft:geometry` and `minecraft:material_instances`
 *    must BOTH be present if either is. We always emit both.
 *  - At format_version 1.26.20+, `minecraft:light_emission` is strictly
 *    validated as an integer 0-15 and out-of-range values are rejected at
 *    load time, so the clamp is load-bearing rather than cosmetic.
 */
export function buildBlockJson(namespace: string, block: ModBlock): BlockJson {
  const ns = toIdentifierSegment(namespace, 'mymod');
  const shortName = blockShortName(block);
  const identifier = `${ns}:${shortName}`;
  const keys = blockTextureKeys(ns, block);
  const look = blockLookSpec(block.look);

  // "*" is the fallback face; up/down override it. This is the same shape
  // vanilla uses for blocks with a distinct top and bottom.
  const materials: Record<string, unknown> = {
    '*': { texture: keys.side, render_method: look.renderMethod },
  };
  if (block.faceMode === 'topSideBottom') {
    materials['up'] = { texture: keys.top, render_method: look.renderMethod };
    materials['down'] = { texture: keys.bottom, render_method: look.renderMethod };
  }

  const components: Record<string, unknown> = {
    'minecraft:geometry': 'minecraft:geometry.full_block',
    'minecraft:material_instances': materials,
    'minecraft:destructible_by_mining': {
      seconds_to_destroy: hitsToSeconds(clampInt(block.hardness, HARDNESS.min, HARDNESS.max)),
    },
    'minecraft:destructible_by_explosion': {
      explosion_resistance: clampInt(block.hardness, HARDNESS.min, HARDNESS.max),
    },
    'minecraft:loot': `loot_tables/blocks/${shortName}.json`,
  };

  const glow = clampInt(block.glow, GLOW.min, GLOW.max);
  if (glow > 0) components['minecraft:light_emission'] = glow;

  return {
    format_version: BLOCK_FORMAT_VERSION,
    'minecraft:block': {
      description: {
        identifier,
        menu_category: { category: 'construction' },
      },
      components,
    },
  };
}

export interface LootTableJson {
  pools: {
    rolls: number;
    conditions?: Record<string, unknown>[];
    entries: { type: string; name: string }[];
  }[];
}

/**
 * Build `loot_tables/blocks/<name>.json`.
 *
 * This is also where the "what tool do you need" answer lives. Bedrock has no
 * way for a custom block to declare a required tool directly, so the drop is
 * gated with a match_tool condition — the wrong tool still breaks the block,
 * it just yields nothing, exactly like vanilla stone mined by hand.
 *
 * Returns null for a block that drops nothing, which Minecraft represents as
 * an absent loot table rather than an empty one.
 */
export function buildBlockLootTable(
  namespace: string,
  block: ModBlock,
  resolveMyItem: (itemId: string) => string | null,
): LootTableJson | null {
  const ns = toIdentifierSegment(namespace, 'mymod');
  const identifier = `${ns}:${blockShortName(block)}`;

  let dropName: string | null;
  switch (block.drop?.kind) {
    case 'nothing':
      dropName = null;
      break;
    case 'vanilla':
      dropName = isKnownVanillaId(block.drop.id) ? block.drop.id : identifier;
      break;
    case 'myItem':
      dropName = resolveMyItem(block.drop.itemId);
      break;
    default:
      dropName = identifier;
  }
  if (!dropName) return null;

  const tool = blockToolSpec(block.tool);
  const pool: LootTableJson['pools'][number] = {
    // One roll yields one item, so N rolls of a single entry yields N items.
    rolls: clampInt(block.dropCount ?? 1, 1, 16),
    entries: [{ type: 'item', name: dropName }],
  };

  if (tool.tags.length > 0) {
    pool.conditions = [
      {
        condition: 'match_tool',
        'minecraft:match_tool_filter_all': tool.tags,
      },
    ];
  }

  return { pools: [pool] };
}
