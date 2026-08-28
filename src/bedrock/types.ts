/**
 * The project state. This is what gets autosaved to IndexedDB and what the
 * generator layer turns into a .mcaddon. It is plain serialisable data — no
 * classes, no functions, no Blobs — so it round-trips through structured
 * clone without surprises.
 */

/** A texture authored in the pixel editor: raw RGBA pixels, row-major. */
export interface Texture {
  /** Edge length in pixels (16, 32 or 64 — always square). */
  size: number;
  /**
   * `size * size` entries, row-major, each an `#rrggbb` string or null for a
   * fully transparent pixel.
   */
  pixels: (string | null)[];
}

export type ItemKind = 'sword' | 'pickaxe' | 'axe' | 'shovel' | 'armor' | 'food' | 'plain';

export type ArmorSlot = 'head' | 'chest' | 'legs' | 'feet';

/** One crafting-grid slot: a vanilla item id like `minecraft:diamond`, or null. */
export type RecipeSlot = string | null;

export interface Recipe {
  enabled: boolean;
  /** Exactly 9 entries, row-major 3x3. */
  grid: RecipeSlot[];
  /** How many of the new item one craft produces. */
  count: number;
}

export interface ModItem {
  id: string;
  /** Kid-typed display name, e.g. "Ruby Sword". */
  name: string;
  kind: ItemKind;
  texture: Texture;
  /** Extra attack damage. Sword/axe/pickaxe/shovel. */
  power: number;
  /** max_durability — "how many hits before it breaks". Tools + armor. */
  durability: number;
  /** Mining speed multiplier for pickaxe/axe/shovel. */
  digSpeed: number;
  /** Armor only. */
  armorSlot: ArmorSlot;
  /** Armor points. Armor only. */
  protection: number;
  /** Food only: half-drumsticks restored. */
  nutrition: number;
  /** Food only: can be eaten at full hunger. */
  canAlwaysEat: boolean;
  /** Plain items only: how many stack in one inventory slot. */
  stackSize: number;
  recipe: Recipe;
}

export interface ModProject {
  id: string;
  name: string;
  description: string;
  /** Derived from name at creation, then frozen so identifiers stay stable. */
  namespace: string;
  icon: Texture;
  /** Stable UUIDs — regenerating these on every export would make Minecraft
   *  treat each download as a brand-new pack instead of an update. */
  uuids: {
    bpHeader: string;
    bpModule: string;
    rpHeader: string;
    rpModule: string;
  };
  /** Bumped on each export so re-imports replace the old copy. */
  version: [number, number, number];
  items: ModItem[];
  createdAt: number;
  updatedAt: number;
}

/** A file destined for the zip. Text files are strings; PNGs are bytes. */
export type PackFile =
  | { path: string; kind: 'text'; content: string }
  | { path: string; kind: 'binary'; content: Uint8Array };

export interface BuiltAddon {
  fileName: string;
  files: PackFile[];
}
