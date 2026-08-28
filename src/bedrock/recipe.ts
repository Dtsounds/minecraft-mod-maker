import { RECIPE_FORMAT_VERSION } from './versions';
import { clampInt, toIdentifierSegment } from './ids';
import { isKnownVanillaId } from './vanillaItems';
import type { ModItem, RecipeSlot } from './types';
import { itemShortName } from './item';

export interface ShapedRecipeJson {
  format_version: string;
  'minecraft:recipe_shaped': {
    description: { identifier: string };
    tags: string[];
    pattern: string[];
    key: Record<string, { item: string }>;
    result: { item: string; count?: number };
  };
}

/** Pattern characters, in the order they get handed out. Space is reserved. */
const KEY_CHARS = 'ABCDEFGHI';

interface Bounds {
  minRow: number;
  maxRow: number;
  minCol: number;
  maxCol: number;
}

/** Tightest box containing every filled slot, or null if the grid is empty. */
function boundingBox(grid: RecipeSlot[]): Bounds | null {
  let minRow = 3;
  let maxRow = -1;
  let minCol = 3;
  let maxCol = -1;
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      if (!isKnownVanillaId(grid[row * 3 + col])) continue;
      minRow = Math.min(minRow, row);
      maxRow = Math.max(maxRow, row);
      minCol = Math.min(minCol, col);
      maxCol = Math.max(maxCol, col);
    }
  }
  return maxRow === -1 ? null : { minRow, maxRow, minCol, maxCol };
}

/** Normalise a stored grid to exactly 9 slots holding only known vanilla ids. */
export function normalizeGrid(grid: unknown): RecipeSlot[] {
  const source = Array.isArray(grid) ? grid : [];
  return Array.from({ length: 9 }, (_, i) => (isKnownVanillaId(source[i]) ? (source[i] as string) : null));
}

/** True if the kid has placed at least one ingredient. */
export function recipeHasIngredients(grid: unknown): boolean {
  return normalizeGrid(grid).some((slot) => slot !== null);
}

/**
 * Build `recipes/<name>.json` for a shaped crafting-table recipe.
 *
 * The kid's 3x3 grid is cropped to its bounding box before becoming the
 * pattern. Minecraft matches a shaped pattern anywhere in the grid, so a
 * single diamond dropped in the middle cell must become the 1x1 pattern
 * ["A"] — emitting the uncropped ["   ", " A ", "   "] would make the recipe
 * only craftable from that exact centre cell.
 *
 * Returns null when the grid is empty, which is a legitimate state (the
 * recipe step is optional), not an error.
 */
export function buildRecipeJson(namespace: string, item: ModItem): ShapedRecipeJson | null {
  if (!item.recipe?.enabled) return null;

  const grid = normalizeGrid(item.recipe.grid);
  const box = boundingBox(grid);
  if (!box) return null;

  const ns = toIdentifierSegment(namespace, 'mymod');
  const shortName = itemShortName(item);
  const identifier = `${ns}:${shortName}`;

  // Assign one pattern character per distinct ingredient.
  const charForItem = new Map<string, string>();
  const key: Record<string, { item: string }> = {};
  const pattern: string[] = [];

  for (let row = box.minRow; row <= box.maxRow; row++) {
    let line = '';
    for (let col = box.minCol; col <= box.maxCol; col++) {
      const slot = grid[row * 3 + col];
      if (!slot) {
        line += ' ';
        continue;
      }
      let ch = charForItem.get(slot);
      if (!ch) {
        ch = KEY_CHARS[charForItem.size] as string;
        charForItem.set(slot, ch);
        key[ch] = { item: slot };
      }
      line += ch;
    }
    pattern.push(line);
  }

  return {
    format_version: RECIPE_FORMAT_VERSION,
    'minecraft:recipe_shaped': {
      description: { identifier: `${ns}:craft_${shortName}` },
      tags: ['crafting_table'],
      pattern,
      key,
      result: {
        item: identifier,
        count: clampInt(item.recipe.count ?? 1, 1, 64),
      },
    },
  };
}
