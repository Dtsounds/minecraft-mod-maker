import type { ArmorSlot, ItemKind, ProjectileKind } from './types';

/**
 * Item type presets.
 *
 * Each preset decides two things: which kid-facing sliders appear, and what
 * the safe range for each of them is. The ranges are the single source of
 * truth — the UI reads them to draw the sliders and the generator reads them
 * to clamp, so a kid cannot produce an out-of-range value even by editing
 * autosaved state by hand.
 */

export type SliderKey =
  | 'power'
  | 'durability'
  | 'digSpeed'
  | 'protection'
  | 'nutrition'
  | 'stackSize'
  | 'drawTime'
  | 'throwPower';

export interface SliderSpec {
  key: SliderKey;
  /** Plain-language label — no Minecraft jargon. */
  label: string;
  hint: string;
  min: number;
  max: number;
  step: number;
  /** Rendered next to the value, e.g. "3 hearts". */
  unit?: string;
}

export interface ItemPreset {
  kind: ItemKind;
  label: string;
  emoji: string;
  blurb: string;
  sliders: SliderSpec[];
  /** Toggles this preset exposes. */
  hasArmorSlotPicker?: boolean;
  hasAlwaysEatToggle?: boolean;
  hasProjectilePicker?: boolean;
}

const POWER: SliderSpec = {
  key: 'power',
  label: 'Power',
  hint: 'How much damage it does when you hit something.',
  min: 1,
  max: 15,
  step: 1,
};

const DURABILITY: SliderSpec = {
  key: 'durability',
  label: 'How many hits before it breaks',
  hint: 'Higher means it lasts longer.',
  min: 10,
  max: 3000,
  step: 10,
};

const STACK_SIZE: SliderSpec = {
  key: 'stackSize',
  label: 'How many fit in one slot',
  hint: 'Like how 64 dirt fit in one slot.',
  min: 1,
  max: 64,
  step: 1,
};

const DIG_SPEED: SliderSpec = {
  key: 'digSpeed',
  label: 'Digging speed',
  hint: 'How fast it breaks blocks.',
  min: 1,
  max: 20,
  step: 1,
};

const DRAW_TIME: SliderSpec = {
  key: 'drawTime',
  label: 'How long you pull it back',
  hint: 'Longer means a slower shot, but it flies further.',
  min: 1,
  max: 10,
  step: 1,
};

const THROW_POWER: SliderSpec = {
  key: 'throwPower',
  label: 'How hard it flies',
  hint: 'Higher means it goes further and faster.',
  min: 1,
  max: 10,
  step: 1,
};

/**
 * What a throwing weapon turns into once it leaves your hand.
 *
 * These are vanilla projectile ENTITIES, not items — the throwable component
 * names an entity to spawn. Only arrows deal real damage; the other two are
 * for fun, which is worth saying plainly in the UI rather than letting a kid
 * wonder why their ninja star tickles.
 */
export const PROJECTILE_KINDS: {
  kind: ProjectileKind;
  label: string;
  emoji: string;
  blurb: string;
  entity: string;
}[] = [
  {
    kind: 'arrow',
    label: 'Sharp',
    emoji: '🏹',
    blurb: 'Really hurts. Flies like an arrow.',
    entity: 'minecraft:arrow',
  },
  {
    kind: 'snowball',
    label: 'Bonk',
    emoji: '❄️',
    blurb: 'Knocks mobs about but doesn’t hurt them.',
    entity: 'minecraft:snowball',
  },
  {
    kind: 'egg',
    label: 'Splat',
    emoji: '🥚',
    blurb: 'Splats like an egg. Might make a chicken!',
    entity: 'minecraft:egg',
  },
];

export function projectileSpec(kind: ProjectileKind) {
  return PROJECTILE_KINDS.find((p) => p.kind === kind) ?? (PROJECTILE_KINDS[0] as (typeof PROJECTILE_KINDS)[number]);
}

export const ITEM_PRESETS: Record<ItemKind, ItemPreset> = {
  sword: {
    kind: 'sword',
    label: 'Sword',
    emoji: '⚔️',
    blurb: 'For fighting mobs.',
    sliders: [POWER, DURABILITY],
  },
  pickaxe: {
    kind: 'pickaxe',
    label: 'Pickaxe',
    emoji: '⛏️',
    blurb: 'For mining stone and ores.',
    sliders: [POWER, DURABILITY, DIG_SPEED],
  },
  axe: {
    kind: 'axe',
    label: 'Axe',
    emoji: '🪓',
    blurb: 'For chopping wood.',
    sliders: [POWER, DURABILITY, DIG_SPEED],
  },
  shovel: {
    kind: 'shovel',
    label: 'Shovel',
    emoji: '🥄',
    blurb: 'For digging dirt and sand.',
    sliders: [POWER, DURABILITY, DIG_SPEED],
  },
  bow: {
    kind: 'bow',
    label: 'Bow',
    emoji: '🏹',
    blurb: 'Shoots arrows from far away.',
    sliders: [DRAW_TIME, DURABILITY],
  },
  throwable: {
    kind: 'throwable',
    label: 'Throwing weapon',
    emoji: '🪃',
    blurb: 'Chuck it! Like a ninja star.',
    sliders: [THROW_POWER, { ...STACK_SIZE, label: 'How many you can carry' }],
    hasProjectilePicker: true,
  },
  armor: {
    kind: 'armor',
    label: 'Armor',
    emoji: '🛡️',
    blurb: 'Wear it to take less damage.',
    sliders: [
      {
        key: 'protection',
        label: 'How much it protects you',
        hint: 'Higher means you take less damage.',
        min: 1,
        max: 20,
        step: 1,
      },
      DURABILITY,
    ],
    hasArmorSlotPicker: true,
  },
  food: {
    kind: 'food',
    label: 'Food',
    emoji: '🍎',
    blurb: 'Eat it to fill your hunger bar.',
    sliders: [
      {
        key: 'nutrition',
        label: 'How much hunger it fills',
        hint: 'Half a drumstick each.',
        min: 1,
        max: 20,
        step: 1,
      },
    ],
    hasAlwaysEatToggle: true,
  },
  plain: {
    kind: 'plain',
    label: 'Just an item',
    emoji: '💎',
    blurb: 'A collectible. Great for crafting recipes.',
    sliders: [STACK_SIZE],
  },
};

export const ITEM_PRESET_ORDER: ItemKind[] = [
  'sword',
  'bow',
  'throwable',
  'pickaxe',
  'axe',
  'shovel',
  'armor',
  'food',
  'plain',
];

export const ARMOR_SLOTS: { slot: ArmorSlot; label: string; emoji: string; wearableSlot: string }[] = [
  { slot: 'head', label: 'Helmet', emoji: '🪖', wearableSlot: 'slot.armor.head' },
  { slot: 'chest', label: 'Chestplate', emoji: '🦺', wearableSlot: 'slot.armor.chest' },
  { slot: 'legs', label: 'Leggings', emoji: '👖', wearableSlot: 'slot.armor.legs' },
  { slot: 'feet', label: 'Boots', emoji: '🥾', wearableSlot: 'slot.armor.feet' },
];

export function armorSlotSpec(slot: ArmorSlot) {
  return ARMOR_SLOTS.find((s) => s.slot === slot) ?? (ARMOR_SLOTS[1] as (typeof ARMOR_SLOTS)[number]);
}

export function sliderFor(kind: ItemKind, key: SliderKey): SliderSpec | undefined {
  return ITEM_PRESETS[kind].sliders.find((s) => s.key === key);
}

/** Tool-ish kinds share the damage/durability/hand-held component shape. */
export const DIGGER_KINDS: ItemKind[] = ['pickaxe', 'axe', 'shovel'];
export const TOOL_KINDS: ItemKind[] = ['sword', 'pickaxe', 'axe', 'shovel'];

/**
 * Vanilla block tags used by minecraft:digger so each tool mines the family of
 * blocks a player expects. These are real vanilla tags, matching the tags
 * vanilla tools query.
 */
export const DIGGER_TAG: Record<string, string> = {
  pickaxe: 'minecraft:is_pickaxe_item_destructible',
  axe: 'minecraft:is_axe_item_destructible',
  shovel: 'minecraft:is_shovel_item_destructible',
};
