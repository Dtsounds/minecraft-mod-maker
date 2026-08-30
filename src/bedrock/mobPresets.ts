import type { AnySliderSpec } from '../components/Slider';

/**
 * Kid-facing mob options.
 *
 * Every behaviour toggle maps to a small, fixed set of vanilla components
 * copied in shape from Mojang's own entity definitions. There is deliberately
 * no freeform behaviour authoring: a kid picks from these, and each choice is
 * a combination we can reason about and test.
 */

export const MOB_HEALTH: AnySliderSpec = {
  key: 'health',
  label: 'How much health it has',
  hint: 'Two hearts per 4 health. A cow has 10.',
  min: 1,
  max: 100,
  step: 1,
};

export const MOB_SPEED: AnySliderSpec = {
  key: 'speed',
  label: 'How fast it moves',
  hint: 'A cow is about 5, a horse is much faster.',
  min: 1,
  max: 20,
  step: 1,
};

export const MOB_DAMAGE: AnySliderSpec = {
  key: 'damage',
  label: 'How hard it hits',
  hint: 'Only matters if it’s a mean mob.',
  min: 1,
  max: 20,
  step: 1,
};

export const MOB_SIZE: AnySliderSpec = {
  key: 'size',
  label: 'How big it is',
  hint: '10 is normal size. 20 is twice as big.',
  min: 3,
  max: 30,
  step: 1,
};

export const MOB_DROP_COUNT: AnySliderSpec = {
  key: 'dropCount',
  label: 'How many it drops',
  hint: 'How much you get when you beat it.',
  min: 1,
  max: 16,
  step: 1,
};

/**
 * Clamp that also absorbs NaN and undefined.
 *
 * Math.max/Math.min propagate NaN rather than clamping it, so a corrupt
 * autosave holding NaN would sail through a naive clamp and end up in the
 * entity JSON — where a NaN movement speed is a broken mob.
 */
function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.round(value)));
}

/** Movement speed slider (1-20) to the vanilla `minecraft:movement` scale. */
export function speedToMovement(speed: number): number {
  // Cow is 0.25 at slider 5; keep the whole range in sane vanilla territory.
  return Math.round(clampNumber(speed, MOB_SPEED.min, MOB_SPEED.max) * 0.05 * 100) / 100;
}

/** Size slider (3-30) to `minecraft:scale`, where 10 means 1.0. */
export function sizeToScale(size: number): number {
  return Math.round((clampNumber(size, MOB_SIZE.min, MOB_SIZE.max) / 10) * 10) / 10;
}

export type MobMood = 'friendly' | 'shy' | 'mean';

export interface MobMoodSpec {
  mood: MobMood;
  label: string;
  emoji: string;
  blurb: string;
}

export const MOB_MOODS: MobMoodSpec[] = [
  {
    mood: 'friendly',
    label: 'Friendly',
    emoji: '💚',
    blurb: 'Wanders around and never fights back.',
  },
  {
    mood: 'shy',
    label: 'Shy',
    emoji: '💨',
    blurb: 'Runs away when you hurt it.',
  },
  {
    mood: 'mean',
    label: 'Mean',
    emoji: '💢',
    blurb: 'Chases and attacks players.',
  },
];

export function mobMoodSpec(mood: MobMood): MobMoodSpec {
  return MOB_MOODS.find((m) => m.mood === mood) ?? (MOB_MOODS[0] as MobMoodSpec);
}

/**
 * Items a kid can pick for taming and breeding.
 *
 * Kept to a short list of foods that genuinely exist as items, because a
 * `tame_items` or `feed_items` entry naming something that isn't an item is
 * the kind of silent failure that is very hard to notice in game.
 */
export const MOB_FOODS: { id: string; label: string; emoji: string }[] = [
  { id: 'minecraft:wheat', label: 'Wheat', emoji: '🌾' },
  { id: 'minecraft:apple', label: 'Apple', emoji: '🍎' },
  { id: 'minecraft:carrot', label: 'Carrot', emoji: '🥕' },
  { id: 'minecraft:potato', label: 'Potato', emoji: '🥔' },
  { id: 'minecraft:sweet_berries', label: 'Berries', emoji: '🫐' },
  { id: 'minecraft:bone', label: 'Bone', emoji: '🦴' },
  { id: 'minecraft:cocoa_beans', label: 'Cocoa', emoji: '🟤' },
  { id: 'minecraft:egg', label: 'Egg', emoji: '🥚' },
];

export function isMobFood(id: unknown): id is string {
  return typeof id === 'string' && MOB_FOODS.some((f) => f.id === id);
}
