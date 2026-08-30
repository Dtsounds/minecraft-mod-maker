import { describe, expect, it } from 'vitest';
import { buildBlockJson, buildBlockLootTable, blockIdentifier } from '../src/bedrock/block';
import { buildBlockRecipeJson, buildSmeltingRecipeJson } from '../src/bedrock/recipe';
import { createBlock } from '../src/bedrock/project';
import { BLOCK_FORMAT_VERSION, RECIPE_FORMAT_VERSION } from '../src/bedrock/versions';
import { BLOCK_LOOKS, hitsToSeconds } from '../src/bedrock/blockPresets';
import type { ModBlock, RecipeSlot } from '../src/bedrock/types';

function make(overrides: Partial<ModBlock> = {}): ModBlock {
  return { ...createBlock(), name: 'Ruby Ore', ...overrides };
}

const components = (b: ModBlock) => buildBlockJson('rubymod', b)['minecraft:block'].components;

describe('block JSON shape', () => {
  it('uses the pinned block format_version', () => {
    expect(buildBlockJson('rubymod', make()).format_version).toBe(BLOCK_FORMAT_VERSION);
  });

  it('emits a namespaced, sanitised identifier', () => {
    expect(blockIdentifier('Ruby Mod', make({ name: 'Ruby Ore!!' }))).toBe('ruby_mod:ruby_ore');
  });

  it('ALWAYS emits geometry and material_instances together', () => {
    // From 1.21.80 the reference requires both if either is present; shipping
    // one alone is a load failure.
    const c = components(make());
    expect(c['minecraft:geometry']).toBe('minecraft:geometry.full_block');
    expect(c['minecraft:material_instances']).toBeDefined();
  });

  it('textures all faces from one key in all-faces mode', () => {
    const m = components(make({ faceMode: 'all' })) as Record<string, Record<string, unknown>>;
    const materials = m['minecraft:material_instances'] as Record<string, { texture: string }>;
    expect(Object.keys(materials)).toEqual(['*']);
    expect(materials['*']?.texture).toBe('rubymod:ruby_ore');
  });

  it('overrides up and down over the "*" fallback in top/side/bottom mode', () => {
    const materials = components(make({ faceMode: 'topSideBottom' }))[
      'minecraft:material_instances'
    ] as Record<string, { texture: string }>;
    expect(materials['*']?.texture).toBe('rubymod:ruby_ore');
    expect(materials['up']?.texture).toBe('rubymod:ruby_ore_top');
    expect(materials['down']?.texture).toBe('rubymod:ruby_ore_bottom');
  });

  it('maps each look to a documented render_method', () => {
    const valid = [
      'opaque',
      'double_sided',
      'blend',
      'alpha_test',
      'alpha_test_single_sided',
      'blend_to_opaque',
      'alpha_test_to_opaque',
      'alpha_test_single_sided_to_opaque',
    ];
    for (const spec of BLOCK_LOOKS) {
      const materials = components(make({ look: spec.look }))['minecraft:material_instances'] as Record<
        string,
        { render_method: string }
      >;
      expect(valid).toContain(materials['*']?.render_method);
    }
    // The three the UI actually offers.
    const method = (look: ModBlock['look']) =>
      (components(make({ look }))['minecraft:material_instances'] as Record<string, { render_method: string }>)['*']
        ?.render_method;
    expect(method('solid')).toBe('opaque');
    expect(method('seeThrough')).toBe('blend');
    expect(method('cutout')).toBe('alpha_test');
  });

  it('converts kid-facing hits into seconds_to_destroy', () => {
    const hard = components(make({ hardness: 10 }))['minecraft:destructible_by_mining'] as {
      seconds_to_destroy: number;
    };
    const soft = components(make({ hardness: 1 }))['minecraft:destructible_by_mining'] as {
      seconds_to_destroy: number;
    };
    expect(hard.seconds_to_destroy).toBeGreaterThan(soft.seconds_to_destroy);
    expect(soft.seconds_to_destroy).toBeGreaterThan(0);
    expect(hitsToSeconds(1)).toBeCloseTo(0.4, 1);
  });

  it('omits light_emission entirely when the block does not glow', () => {
    expect(components(make({ glow: 0 }))['minecraft:light_emission']).toBeUndefined();
    expect(components(make({ glow: 12 }))['minecraft:light_emission']).toBe(12);
  });

  it('clamps light_emission into 0-15, which 1.26.20+ rejects out of range', () => {
    expect(components(make({ glow: 99 }))['minecraft:light_emission']).toBe(15);
    // Negative clamps to 0, which means the component is dropped entirely.
    expect(components(make({ glow: -5 }))['minecraft:light_emission']).toBeUndefined();
  });

  it('always emits an integer light_emission, never a float', () => {
    const value = components(make({ glow: 7.6 }))['minecraft:light_emission'];
    expect(Number.isInteger(value)).toBe(true);
  });

  it('clamps absurd hardness rather than emitting it', () => {
    for (const hardness of [-100, 0, 1e9, NaN]) {
      const c = components(make({ hardness })) as Record<string, { seconds_to_destroy: number }>;
      const seconds = c['minecraft:destructible_by_mining']?.seconds_to_destroy as number;
      expect(seconds).toBeGreaterThan(0);
      expect(seconds).toBeLessThan(60);
    }
  });

  it('uses a valid menu_category', () => {
    expect(buildBlockJson('rubymod', make())['minecraft:block'].description.menu_category.category).toBe(
      'construction',
    );
  });
});

describe('block loot tables', () => {
  const resolve = (id: string) => (id === 'item-1' ? 'rubymod:ruby' : null);

  it('drops itself by default', () => {
    const loot = buildBlockLootTable('rubymod', make(), resolve)!;
    expect(loot.pools[0]?.entries[0]).toEqual({ type: 'item', name: 'rubymod:ruby_ore' });
  });

  it('returns null when the block drops nothing', () => {
    expect(buildBlockLootTable('rubymod', make({ drop: { kind: 'nothing' } }), resolve)).toBeNull();
  });

  it('can drop a vanilla item', () => {
    const loot = buildBlockLootTable('rubymod', make({ drop: { kind: 'vanilla', id: 'minecraft:diamond' } }), resolve)!;
    expect(loot.pools[0]?.entries[0]?.name).toBe('minecraft:diamond');
  });

  it('rejects a vanilla id that is not in the built-in palette', () => {
    const loot = buildBlockLootTable('rubymod', make({ drop: { kind: 'vanilla', id: 'minecraft:not_real' } }), resolve)!;
    // Falls back to dropping itself rather than referencing a missing item.
    expect(loot.pools[0]?.entries[0]?.name).toBe('rubymod:ruby_ore');
  });

  it('can drop one of the kid’s own items', () => {
    const loot = buildBlockLootTable('rubymod', make({ drop: { kind: 'myItem', itemId: 'item-1' } }), resolve)!;
    expect(loot.pools[0]?.entries[0]?.name).toBe('rubymod:ruby');
  });

  it('returns null if the referenced item was deleted', () => {
    expect(buildBlockLootTable('rubymod', make({ drop: { kind: 'myItem', itemId: 'gone' } }), resolve)).toBeNull();
  });

  it('adds no tool condition when anything can mine it', () => {
    const loot = buildBlockLootTable('rubymod', make({ tool: 'any' }), resolve)!;
    expect(loot.pools[0]?.conditions).toBeUndefined();
  });

  it('gates the drop behind match_tool for a required tool', () => {
    const loot = buildBlockLootTable('rubymod', make({ tool: 'pickaxe' }), resolve)!;
    const condition = loot.pools[0]?.conditions?.[0] as Record<string, unknown>;
    expect(condition['condition']).toBe('match_tool');
    expect(condition['minecraft:match_tool_filter_all']).toEqual([
      'minecraft:is_tool',
      'minecraft:is_pickaxe',
    ]);
  });

  it('clamps the drop count', () => {
    expect(buildBlockLootTable('rubymod', make({ dropCount: 999 }), resolve)!.pools[0]?.rolls).toBe(16);
    expect(buildBlockLootTable('rubymod', make({ dropCount: -4 }), resolve)!.pools[0]?.rolls).toBe(1);
  });
});

describe('block recipes', () => {
  const D = 'minecraft:diamond';
  const EMPTY: RecipeSlot[] = new Array(9).fill(null);

  it('builds a shaped recipe that outputs the block', () => {
    const grid = [...EMPTY];
    grid[0] = D;
    grid[1] = D;
    const recipe = buildBlockRecipeJson('rubymod', make({ recipe: { enabled: true, grid, count: 1 } }))!;
    expect(recipe.format_version).toBe(RECIPE_FORMAT_VERSION);
    expect(recipe['minecraft:recipe_shaped'].result.item).toBe('rubymod:ruby_ore');
    expect(recipe['minecraft:recipe_shaped'].pattern).toEqual(['AA']);
  });

  it('returns null when the block recipe is off or empty', () => {
    expect(buildBlockRecipeJson('rubymod', make())).toBeNull();
    expect(buildBlockRecipeJson('rubymod', make({ recipe: { enabled: true, grid: EMPTY, count: 1 } }))).toBeNull();
  });

  it('builds a furnace recipe from a vanilla input', () => {
    const smelt = buildSmeltingRecipeJson(
      'rubymod',
      make({ smelting: { enabled: true, input: 'minecraft:cobblestone' } }),
    )!;
    const body = smelt['minecraft:recipe_furnace'];
    expect(body.input).toBe('minecraft:cobblestone');
    expect(body.output).toBe('rubymod:ruby_ore');
    expect(body.tags).toContain('furnace');
    expect(body.description.identifier).toBe('rubymod:smelt_ruby_ore');
  });

  it('returns null for smelting that is off or has no input', () => {
    expect(buildSmeltingRecipeJson('rubymod', make())).toBeNull();
    expect(
      buildSmeltingRecipeJson('rubymod', make({ smelting: { enabled: true, input: null } })),
    ).toBeNull();
  });

  it('rejects a smelting input that is not a known vanilla item', () => {
    expect(
      buildSmeltingRecipeJson('rubymod', make({ smelting: { enabled: true, input: 'minecraft:fake' } })),
    ).toBeNull();
  });
});
