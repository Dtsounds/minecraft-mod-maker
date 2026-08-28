/**
 * A small curated palette of vanilla items for the crafting-grid builder.
 *
 * We deliberately do NOT ship Mojang's texture PNGs. Each entry carries a
 * colour and a glyph so the UI can draw a recognisable, kid-legible chip
 * with no copyrighted assets and no network fetch.
 *
 * Every `id` here is a real vanilla item identifier usable in a recipe `key`.
 */

export interface VanillaItem {
  id: string;
  label: string;
  glyph: string;
  color: string;
  group: 'basics' | 'ores' | 'nature' | 'mob' | 'food';
}

export const VANILLA_ITEMS: VanillaItem[] = [
  // Basics
  { id: 'minecraft:stick', label: 'Stick', glyph: '🥢', color: '#a1702f', group: 'basics' },
  { id: 'minecraft:oak_planks', label: 'Oak Planks', glyph: '🟫', color: '#b98a54', group: 'basics' },
  { id: 'minecraft:oak_log', label: 'Oak Log', glyph: '🪵', color: '#8a6134', group: 'basics' },
  { id: 'minecraft:cobblestone', label: 'Cobblestone', glyph: '🪨', color: '#8f8f8f', group: 'basics' },
  { id: 'minecraft:stone', label: 'Stone', glyph: '⬜', color: '#7d7d7d', group: 'basics' },
  { id: 'minecraft:string', label: 'String', glyph: '🧵', color: '#e8e8e8', group: 'basics' },
  { id: 'minecraft:flint', label: 'Flint', glyph: '🔻', color: '#4a4a4a', group: 'basics' },
  { id: 'minecraft:paper', label: 'Paper', glyph: '📄', color: '#f2f2ea', group: 'basics' },
  { id: 'minecraft:book', label: 'Book', glyph: '📕', color: '#9c5b3b', group: 'basics' },

  // Ores & metals
  { id: 'minecraft:coal', label: 'Coal', glyph: '⚫', color: '#26262a', group: 'ores' },
  { id: 'minecraft:charcoal', label: 'Charcoal', glyph: '🌑', color: '#38343a', group: 'ores' },
  { id: 'minecraft:iron_ingot', label: 'Iron', glyph: '⬜', color: '#d8d8d8', group: 'ores' },
  { id: 'minecraft:gold_ingot', label: 'Gold', glyph: '🟨', color: '#f5d33a', group: 'ores' },
  { id: 'minecraft:copper_ingot', label: 'Copper', glyph: '🟧', color: '#e0764a', group: 'ores' },
  { id: 'minecraft:diamond', label: 'Diamond', glyph: '💎', color: '#4fe3d8', group: 'ores' },
  { id: 'minecraft:emerald', label: 'Emerald', glyph: '🟩', color: '#38d16a', group: 'ores' },
  { id: 'minecraft:lapis_lazuli', label: 'Lapis', glyph: '🔷', color: '#2a56c6', group: 'ores' },
  { id: 'minecraft:redstone', label: 'Redstone', glyph: '🔴', color: '#e02b2b', group: 'ores' },
  { id: 'minecraft:quartz', label: 'Quartz', glyph: '🤍', color: '#eee6dc', group: 'ores' },
  { id: 'minecraft:netherite_ingot', label: 'Netherite', glyph: '🟪', color: '#4a3f46', group: 'ores' },
  { id: 'minecraft:amethyst_shard', label: 'Amethyst', glyph: '🟣', color: '#a069df', group: 'ores' },

  // Nature
  { id: 'minecraft:dirt', label: 'Dirt', glyph: '🟤', color: '#8a5f3c', group: 'nature' },
  { id: 'minecraft:sand', label: 'Sand', glyph: '🟡', color: '#e6dcae', group: 'nature' },
  { id: 'minecraft:glass', label: 'Glass', glyph: '🔲', color: '#c6e6ee', group: 'nature' },
  { id: 'minecraft:obsidian', label: 'Obsidian', glyph: '⬛', color: '#241d33', group: 'nature' },
  { id: 'minecraft:ice', label: 'Ice', glyph: '🧊', color: '#9ec6f5', group: 'nature' },
  { id: 'minecraft:snowball', label: 'Snowball', glyph: '⚪', color: '#f4fbff', group: 'nature' },
  { id: 'minecraft:clay_ball', label: 'Clay', glyph: '🩶', color: '#a4aabb', group: 'nature' },
  { id: 'minecraft:glowstone_dust', label: 'Glowstone', glyph: '✨', color: '#f3d98b', group: 'nature' },

  // Mob drops
  { id: 'minecraft:leather', label: 'Leather', glyph: '🟫', color: '#a06a3f', group: 'mob' },
  { id: 'minecraft:feather', label: 'Feather', glyph: '🪶', color: '#f0f0f0', group: 'mob' },
  { id: 'minecraft:bone', label: 'Bone', glyph: '🦴', color: '#e8e4d0', group: 'mob' },
  { id: 'minecraft:gunpowder', label: 'Gunpowder', glyph: '💥', color: '#6b6b6b', group: 'mob' },
  { id: 'minecraft:slime_ball', label: 'Slime', glyph: '🟢', color: '#7ede6e', group: 'mob' },
  { id: 'minecraft:ender_pearl', label: 'Ender Pearl', glyph: '🔮', color: '#2fa08a', group: 'mob' },
  { id: 'minecraft:blaze_rod', label: 'Blaze Rod', glyph: '🔥', color: '#f2b233', group: 'mob' },
  { id: 'minecraft:spider_eye', label: 'Spider Eye', glyph: '👁️', color: '#a13a3a', group: 'mob' },

  // Food
  { id: 'minecraft:apple', label: 'Apple', glyph: '🍎', color: '#d63b3b', group: 'food' },
  { id: 'minecraft:wheat', label: 'Wheat', glyph: '🌾', color: '#d9bb52', group: 'food' },
  { id: 'minecraft:sugar', label: 'Sugar', glyph: '🍬', color: '#f5f5f5', group: 'food' },
  { id: 'minecraft:egg', label: 'Egg', glyph: '🥚', color: '#e6dcc0', group: 'food' },
  { id: 'minecraft:carrot', label: 'Carrot', glyph: '🥕', color: '#e0821e', group: 'food' },
  { id: 'minecraft:potato', label: 'Potato', glyph: '🥔', color: '#d1a353', group: 'food' },
  { id: 'minecraft:sweet_berries', label: 'Berries', glyph: '🫐', color: '#b3243a', group: 'food' },
  { id: 'minecraft:cocoa_beans', label: 'Cocoa', glyph: '🟤', color: '#7b4a24', group: 'food' },
];

export const VANILLA_GROUPS: { key: VanillaItem['group']; label: string }[] = [
  { key: 'basics', label: 'Basics' },
  { key: 'ores', label: 'Ores & Metals' },
  { key: 'nature', label: 'Nature' },
  { key: 'mob', label: 'Mob Drops' },
  { key: 'food', label: 'Food' },
];

const BY_ID = new Map(VANILLA_ITEMS.map((v) => [v.id, v]));

export function lookupVanilla(id: string | null | undefined): VanillaItem | undefined {
  return id ? BY_ID.get(id) : undefined;
}

/** Guard used by the generator: only ids from our own palette reach a recipe. */
export function isKnownVanillaId(id: unknown): id is string {
  return typeof id === 'string' && BY_ID.has(id);
}
