import type { BlockLook, BlockTool } from './types';

/**
 * Kid-facing block options.
 *
 * As with items, these specs are the single source of truth: the UI draws
 * controls from them and the generator clamps against them, so the two cannot
 * drift apart.
 */

export interface BlockSliderSpec {
  key: 'hardness' | 'glow' | 'dropCount';
  label: string;
  hint: string;
  min: number;
  max: number;
  step: number;
}

/**
 * "How many hits to break" is really seconds_to_destroy. Kids think in hits,
 * so the slider is 1-10 and the generator converts. Reference points from
 * vanilla: wool 0.8s, concrete slab 1.8s, sand 7.5s.
 */
export const HARDNESS: BlockSliderSpec = {
  key: 'hardness',
  label: 'How many hits to break',
  hint: 'Higher means it takes longer to mine.',
  min: 1,
  max: 10,
  step: 1,
};

/**
 * minecraft:light_emission. Validation at format_version 1.26.20+ strictly
 * rejects anything outside 0-15 at load time, so the clamp is not optional.
 * Reference: torch 14, glowstone 15, redstone torch 7.
 */
export const GLOW: BlockSliderSpec = {
  key: 'glow',
  label: 'How much it glows',
  hint: '0 is dark, 15 is as bright as glowstone.',
  min: 0,
  max: 15,
  step: 1,
};

export const DROP_COUNT: BlockSliderSpec = {
  key: 'dropCount',
  label: 'How many you get',
  hint: 'How many drop when you break it.',
  min: 1,
  max: 16,
  step: 1,
};

export interface BlockLookSpec {
  look: BlockLook;
  label: string;
  emoji: string;
  blurb: string;
  /** Verified render_method values from the material_instances reference. */
  renderMethod: string;
}

export const BLOCK_LOOKS: BlockLookSpec[] = [
  {
    look: 'solid',
    label: 'Solid',
    emoji: '🧱',
    blurb: 'A normal block you can’t see through.',
    renderMethod: 'opaque',
  },
  {
    look: 'seeThrough',
    label: 'See-through',
    emoji: '🪟',
    blurb: 'Like stained glass.',
    renderMethod: 'blend',
  },
  {
    look: 'cutout',
    label: 'Cut-out',
    emoji: '🍃',
    blurb: 'Holes are fully see-through, like leaves.',
    renderMethod: 'alpha_test',
  },
];

export function blockLookSpec(look: BlockLook): BlockLookSpec {
  return BLOCK_LOOKS.find((l) => l.look === look) ?? (BLOCK_LOOKS[0] as BlockLookSpec);
}

export interface BlockToolSpec {
  tool: BlockTool;
  label: string;
  emoji: string;
  /**
   * Item tags required by the loot table's match_tool condition.
   *
   * NOTE: this gates the DROP, not the mining speed. Bedrock's proper
   * mechanism for tool-specific mining speed is
   * `minecraft:destructible_by_mining.item_specific_speeds`, which the
   * reference states "currently requires UpcomingFeatures experiment to be
   * enabled" — unusable here, because a kid's add-on has to work in a normal
   * world. So the wrong tool still breaks the block at normal speed; it just
   * yields nothing, which is the same thing vanilla stone does.
   */
  tags: string[];
}

export const BLOCK_TOOLS: BlockToolSpec[] = [
  { tool: 'any', label: 'Anything', emoji: '✋', tags: [] },
  { tool: 'pickaxe', label: 'Pickaxe', emoji: '⛏️', tags: ['minecraft:is_tool', 'minecraft:is_pickaxe'] },
  { tool: 'axe', label: 'Axe', emoji: '🪓', tags: ['minecraft:is_tool', 'minecraft:is_axe'] },
  { tool: 'shovel', label: 'Shovel', emoji: '🥄', tags: ['minecraft:is_tool', 'minecraft:is_shovel'] },
];

export function blockToolSpec(tool: BlockTool): BlockToolSpec {
  return BLOCK_TOOLS.find((t) => t.tool === tool) ?? (BLOCK_TOOLS[0] as BlockToolSpec);
}

/**
 * Convert the kid-facing 1-10 "hits" scale to seconds_to_destroy.
 * 1 hit -> 0.4s (about a wool block), 10 -> 7.5s (about sand/obsidian-ish).
 */
export function hitsToSeconds(hits: number): number {
  const clamped = Math.max(HARDNESS.min, Math.min(HARDNESS.max, Math.round(hits)));
  return Math.round((0.4 + (clamped - 1) * 0.79) * 10) / 10;
}
