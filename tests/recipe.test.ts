import { describe, expect, it } from 'vitest';
import { buildRecipeJson, normalizeGrid, recipeHasIngredients } from '../src/bedrock/recipe';
import { createItem } from '../src/bedrock/project';
import { RECIPE_FORMAT_VERSION } from '../src/bedrock/versions';
import type { ModItem, RecipeSlot } from '../src/bedrock/types';

const D = 'minecraft:diamond';
const S = 'minecraft:stick';
const I = 'minecraft:iron_ingot';

function withGrid(grid: RecipeSlot[], count = 1): ModItem {
  return {
    ...createItem('sword'),
    name: 'Ruby Sword',
    recipe: { enabled: true, grid, count },
  };
}

const EMPTY: RecipeSlot[] = new Array(9).fill(null);

describe('grid normalisation', () => {
  it('always returns exactly nine slots', () => {
    expect(normalizeGrid(undefined)).toHaveLength(9);
    expect(normalizeGrid([D])).toHaveLength(9);
    expect(normalizeGrid(new Array(50).fill(D))).toHaveLength(9);
  });

  it('drops ids that are not in the built-in vanilla palette', () => {
    // A recipe referencing an item that does not exist is exactly the kind of
    // thing that makes Minecraft reject the pack.
    const grid = normalizeGrid(['minecraft:not_a_real_item', D, 42, null, {}, 'nonsense']);
    expect(grid[0]).toBeNull();
    expect(grid[1]).toBe(D);
    expect(grid[2]).toBeNull();
    expect(grid[5]).toBeNull();
  });

  it('reports whether anything has been placed', () => {
    expect(recipeHasIngredients(EMPTY)).toBe(false);
    expect(recipeHasIngredients([...EMPTY.slice(0, 4), D, ...EMPTY.slice(5)])).toBe(true);
  });
});

describe('shaped recipe generation', () => {
  it('returns null when the recipe step is switched off', () => {
    const item = withGrid([D, ...EMPTY.slice(1)]);
    item.recipe.enabled = false;
    expect(buildRecipeJson('mymod', item)).toBeNull();
  });

  it('returns null for an empty grid rather than emitting a broken recipe', () => {
    expect(buildRecipeJson('mymod', withGrid(EMPTY))).toBeNull();
  });

  it('uses the pinned recipe format_version and the crafting_table tag', () => {
    const json = buildRecipeJson('mymod', withGrid([D, ...EMPTY.slice(1)]))!;
    expect(json.format_version).toBe(RECIPE_FORMAT_VERSION);
    expect(json['minecraft:recipe_shaped'].tags).toEqual(['crafting_table']);
  });

  it('crops the pattern to its bounding box', () => {
    // One diamond in the centre cell must become the 1x1 pattern ["A"].
    // Emitting the uncropped ["   ", " A ", "   "] would make the recipe only
    // craftable from that exact centre square.
    const grid: RecipeSlot[] = [...EMPTY];
    grid[4] = D;
    const recipe = buildRecipeJson('mymod', withGrid(grid))!['minecraft:recipe_shaped'];
    expect(recipe.pattern).toEqual(['A']);
    expect(recipe.key).toEqual({ A: { item: D } });
  });

  it('builds the classic sword pattern as a single column', () => {
    const grid: RecipeSlot[] = [null, D, null, null, D, null, null, S, null];
    const recipe = buildRecipeJson('mymod', withGrid(grid))!['minecraft:recipe_shaped'];
    expect(recipe.pattern).toEqual(['A', 'A', 'B']);
    expect(recipe.key).toEqual({ A: { item: D }, B: { item: S } });
  });

  it('builds a pickaxe pattern with internal gaps preserved', () => {
    const grid: RecipeSlot[] = [I, I, I, null, S, null, null, S, null];
    const recipe = buildRecipeJson('mymod', withGrid(grid))!['minecraft:recipe_shaped'];
    expect(recipe.pattern).toEqual(['AAA', ' B ', ' B ']);
    expect(recipe.key).toEqual({ A: { item: I }, B: { item: S } });
  });

  it('crops trailing empty columns as well as rows', () => {
    const grid: RecipeSlot[] = [D, D, null, D, D, null, null, null, null];
    const recipe = buildRecipeJson('mymod', withGrid(grid))!['minecraft:recipe_shaped'];
    expect(recipe.pattern).toEqual(['AA', 'AA']);
  });

  it('gives each distinct ingredient its own key character', () => {
    const grid: RecipeSlot[] = [D, S, I, null, null, null, null, null, null];
    const recipe = buildRecipeJson('mymod', withGrid(grid))!['minecraft:recipe_shaped'];
    expect(recipe.pattern).toEqual(['ABC']);
    expect(Object.keys(recipe.key).sort()).toEqual(['A', 'B', 'C']);
  });

  it('reuses one key character for a repeated ingredient', () => {
    const grid: RecipeSlot[] = new Array(9).fill(D);
    const recipe = buildRecipeJson('mymod', withGrid(grid))!['minecraft:recipe_shaped'];
    expect(recipe.pattern).toEqual(['AAA', 'AAA', 'AAA']);
    expect(Object.keys(recipe.key)).toEqual(['A']);
  });

  it('never uses a space as a key character', () => {
    const grid: RecipeSlot[] = [D, null, S, null, I, null, D, null, S];
    const recipe = buildRecipeJson('mymod', withGrid(grid))!['minecraft:recipe_shaped'];
    expect(Object.keys(recipe.key)).not.toContain(' ');
  });

  it('points the result at the new item and namespaces the recipe id', () => {
    const recipe = buildRecipeJson('ruby_mod', withGrid([D, ...EMPTY.slice(1)]))!['minecraft:recipe_shaped'];
    expect(recipe.result.item).toBe('ruby_mod:ruby_sword');
    expect(recipe.description.identifier).toBe('ruby_mod:craft_ruby_sword');
  });

  it('clamps an out-of-range output count', () => {
    const tooMany = buildRecipeJson('mymod', withGrid([D, ...EMPTY.slice(1)], 9999))!;
    expect(tooMany['minecraft:recipe_shaped'].result.count).toBe(64);

    const tooFew = buildRecipeJson('mymod', withGrid([D, ...EMPTY.slice(1)], -3))!;
    expect(tooFew['minecraft:recipe_shaped'].result.count).toBe(1);
  });

  it('ignores unknown ids left in stored state', () => {
    const grid = ['minecraft:fake_thing', D, ...EMPTY.slice(2)] as RecipeSlot[];
    const recipe = buildRecipeJson('mymod', withGrid(grid))!['minecraft:recipe_shaped'];
    expect(JSON.stringify(recipe)).not.toContain('fake_thing');
    expect(recipe.pattern).toEqual(['A']);
  });

  it('emits a pattern no wider or taller than three', () => {
    const recipe = buildRecipeJson('mymod', withGrid(new Array(9).fill(D)))!['minecraft:recipe_shaped'];
    expect(recipe.pattern.length).toBeLessThanOrEqual(3);
    for (const row of recipe.pattern) expect(row.length).toBeLessThanOrEqual(3);
  });
});

describe('recipe unlock data (regression: silently dead recipes)', () => {
  // Caught only by reading Minecraft's own content log:
  //   "1.20+ Recipes require unlock data"
  // Every recipe this generator emitted before 2026-08-30 was rejected at load
  // and never registered. Nothing in the pack looked wrong and the item still
  // answered /give, so a green suite and a working-looking mod hid it.
  it('always emits unlock data, or the recipe never registers', () => {
    const grid = [...EMPTY];
    grid[1] = D;
    grid[4] = D;
    grid[7] = S;

    const json = buildRecipeJson('rubymod', withGrid(grid));
    const recipe = json?.['minecraft:recipe_shaped'];

    expect(recipe?.unlock).toBeDefined();
    expect(recipe?.unlock.length).toBeGreaterThan(0);
  });

  it('unlocks on the ingredients, the way vanilla diamond_sword does', () => {
    const grid = [...EMPTY];
    grid[1] = D;
    grid[4] = D;
    grid[7] = S;

    const recipe = buildRecipeJson('rubymod', withGrid(grid))?.['minecraft:recipe_shaped'];

    // One entry per DISTINCT ingredient — two diamonds do not mean two entries.
    expect(recipe?.unlock).toEqual([{ item: D }, { item: S }]);
  });

  it('orders unlock between key and result, matching Mojang’s own file', () => {
    const grid = [...EMPTY];
    grid[4] = D;
    const recipe = buildRecipeJson('rubymod', withGrid(grid))?.['minecraft:recipe_shaped'];
    expect(Object.keys(recipe ?? {})).toEqual([
      'description',
      'tags',
      'pattern',
      'key',
      'unlock',
      'result',
    ]);
  });
});
