import type { AnySliderSpec } from '../components/Slider';
import type { ActionKind, RuleEffect, RuleSound, TriggerKind } from './types';

/**
 * Rule presets — the vocabulary of "When X happens, do Y".
 *
 * Same contract as the item/block/mob presets: each entry declares the fields
 * it exposes and the safe range of every one of them, the UI draws itself from
 * that, and the generator clamps against the same numbers. The two cannot
 * drift, and a hand-edited autosave still produces a valid script.
 *
 * This vocabulary is deliberately closed. A general block-programming
 * workspace can express infinitely many programs, plenty of which throw at
 * runtime — and in Bedrock a script error is a *silent* failure that only
 * shows up in the content log. A fixed set of triggers and actions can be
 * checked exhaustively, which is what makes "a kid must never produce a
 * broken pack" hold for scripting too.
 */

/** Which of the kid's own creations a trigger watches. */
export type SubjectKind = 'item' | 'block' | 'mob' | 'none';

export interface TriggerSpec {
  trigger: TriggerKind;
  label: string;
  emoji: string;
  blurb: string;
  /** Which list the subject picker is populated from. */
  subject: SubjectKind;
  /** Shown when the kid has not made anything of the required kind yet. */
  emptyHint: string;
}

export const TRIGGERS: TriggerSpec[] = [
  {
    trigger: 'useItem',
    label: 'Someone uses my item',
    emoji: '✋',
    blurb: 'Right-click or tap-and-hold while holding it.',
    subject: 'item',
    emptyHint: 'Make an item first, then this trigger can watch it.',
  },
  {
    trigger: 'breakBlock',
    label: 'Someone breaks my block',
    emoji: '⛏️',
    blurb: 'Happens the moment the block pops.',
    subject: 'block',
    emptyHint: 'Make a block first, then this trigger can watch it.',
  },
  {
    trigger: 'placeBlock',
    label: 'Someone places my block',
    emoji: '🧱',
    blurb: 'Happens as soon as it is put down.',
    subject: 'block',
    emptyHint: 'Make a block first, then this trigger can watch it.',
  },
  {
    trigger: 'hitMob',
    label: 'Someone hits my creature',
    emoji: '⚔️',
    blurb: 'Any melee hit, even one that does not defeat it.',
    subject: 'mob',
    emptyHint: 'Make a creature first, then this trigger can watch it.',
  },
  {
    trigger: 'mobDies',
    label: 'My creature is defeated',
    emoji: '💀',
    blurb: 'Happens where the creature fell.',
    subject: 'mob',
    emptyHint: 'Make a creature first, then this trigger can watch it.',
  },
  {
    trigger: 'playerJoins',
    label: 'A player joins the world',
    emoji: '🚪',
    blurb: 'Only the first time they spawn in, not every respawn.',
    subject: 'none',
    emptyHint: '',
  },
];

export function triggerSpec(trigger: TriggerKind): TriggerSpec {
  return TRIGGERS.find((t) => t.trigger === trigger) ?? (TRIGGERS[0] as TriggerSpec);
}

/** Which extra controls an action needs. */
export interface ActionSpec {
  action: ActionKind;
  label: string;
  emoji: string;
  blurb: string;
  sliders: AnySliderSpec[];
  hasEffectPicker?: boolean;
  hasSoundPicker?: boolean;
  hasMessageBox?: boolean;
  hasSummonPicker?: boolean;
  hasGivePicker?: boolean;
}

const STRENGTH: AnySliderSpec = {
  key: 'strength',
  label: 'How strong',
  hint: 'Level 1 is gentle, level 5 is very strong.',
  min: 1,
  max: 5,
  step: 1,
};

const SECONDS: AnySliderSpec = {
  key: 'seconds',
  label: 'How long it lasts',
  hint: 'In seconds.',
  min: 1,
  max: 120,
  step: 1,
  unit: 'seconds',
};

const RADIUS: AnySliderSpec = {
  key: 'radius',
  label: 'How big the bang is',
  hint: 'This never breaks blocks — it only knocks things around.',
  min: 1,
  max: 8,
  step: 1,
};

const FIRE_SECONDS: AnySliderSpec = {
  key: 'fireSeconds',
  label: 'How long it burns',
  hint: 'In seconds.',
  min: 1,
  max: 30,
  step: 1,
  unit: 'seconds',
};

const SUMMON_COUNT: AnySliderSpec = {
  key: 'summonCount',
  label: 'How many appear',
  hint: 'They all show up in the same spot.',
  min: 1,
  max: 10,
  step: 1,
};

const GIVE_COUNT: AnySliderSpec = {
  key: 'giveCount',
  label: 'How many',
  hint: 'They drop on the ground so you can pick them up.',
  min: 1,
  max: 64,
  step: 1,
};

export const ACTIONS: ActionSpec[] = [
  {
    action: 'effect',
    label: 'Give a potion effect',
    emoji: '🧪',
    blurb: 'Like drinking a potion — speed, strength, jumping and more.',
    sliders: [STRENGTH, SECONDS],
    hasEffectPicker: true,
  },
  {
    action: 'message',
    label: 'Say something',
    emoji: '💬',
    blurb: 'Pops up in the chat.',
    sliders: [],
    hasMessageBox: true,
  },
  {
    action: 'lightning',
    label: 'Strike lightning',
    emoji: '⚡',
    blurb: 'A real lightning bolt, right on the spot.',
    sliders: [],
  },
  {
    action: 'explode',
    label: 'Make an explosion',
    emoji: '💥',
    blurb: 'A safe bang — it will not break your build.',
    sliders: [RADIUS],
  },
  {
    action: 'summon',
    label: 'Summon creatures',
    emoji: '🐣',
    blurb: 'Any vanilla mob, or one of your own creatures.',
    sliders: [SUMMON_COUNT],
    hasSummonPicker: true,
  },
  {
    action: 'giveItem',
    label: 'Drop an item',
    emoji: '🎁',
    blurb: 'A vanilla item, or one of your own.',
    sliders: [GIVE_COUNT],
    hasGivePicker: true,
  },
  {
    action: 'playSound',
    label: 'Play a sound',
    emoji: '🔊',
    blurb: 'Everyone nearby hears it.',
    sliders: [],
    hasSoundPicker: true,
  },
  {
    action: 'setOnFire',
    label: 'Set on fire',
    emoji: '🔥',
    blurb: 'Sets whatever the trigger was about alight.',
    sliders: [FIRE_SECONDS],
  },
];

export function actionSpec(action: ActionKind): ActionSpec {
  return ACTIONS.find((a) => a.action === action) ?? (ACTIONS[0] as ActionSpec);
}

/**
 * Potion effects. These are the vanilla effect ids accepted by
 * `Entity.addEffect`. Kept to the ones that are fun and obviously visible —
 * nothing that just quietly changes a number.
 */
export const RULE_EFFECTS: { effect: RuleEffect; label: string; emoji: string }[] = [
  { effect: 'speed', label: 'Super speed', emoji: '💨' },
  { effect: 'jump_boost', label: 'Mega jump', emoji: '🦘' },
  { effect: 'strength', label: 'Extra strong', emoji: '💪' },
  { effect: 'regeneration', label: 'Healing', emoji: '❤️‍🩹' },
  { effect: 'resistance', label: 'Tough skin', emoji: '🛡️' },
  { effect: 'fire_resistance', label: 'Fireproof', emoji: '🧯' },
  { effect: 'night_vision', label: 'See in the dark', emoji: '🌙' },
  { effect: 'invisibility', label: 'Invisible', emoji: '👻' },
  { effect: 'water_breathing', label: 'Breathe underwater', emoji: '🫧' },
  { effect: 'slow_falling', label: 'Float down gently', emoji: '🪶' },
  { effect: 'levitation', label: 'Float upwards', emoji: '🎈' },
  { effect: 'slowness', label: 'Slowed down', emoji: '🐌' },
  { effect: 'weakness', label: 'Weak punches', emoji: '🫠' },
  { effect: 'poison', label: 'Poisoned', emoji: '🤢' },
];

export function isRuleEffect(value: unknown): value is RuleEffect {
  return RULE_EFFECTS.some((e) => e.effect === value);
}

/** Vanilla sound ids, verified names from the vanilla sound definitions. */
export const RULE_SOUNDS: { sound: RuleSound; label: string; emoji: string }[] = [
  { sound: 'random.levelup', label: 'Level up!', emoji: '🎉' },
  { sound: 'random.orb', label: 'Sparkle', emoji: '✨' },
  { sound: 'random.explode', label: 'Boom', emoji: '💥' },
  { sound: 'random.anvil_land', label: 'Clang', emoji: '🔨' },
  { sound: 'mob.ghast.scream', label: 'Scary scream', emoji: '👻' },
  { sound: 'mob.cat.meow', label: 'Meow', emoji: '🐱' },
  { sound: 'mob.chicken.plop', label: 'Plop', emoji: '🥚' },
  { sound: 'random.glass', label: 'Smash', emoji: '🪟' },
  { sound: 'random.toast', label: 'Ding', emoji: '🔔' },
  { sound: 'ambient.weather.thunder', label: 'Thunder', emoji: '⛈️' },
];

export function isRuleSound(value: unknown): value is RuleSound {
  return RULE_SOUNDS.some((s) => s.sound === value);
}

/**
 * Vanilla creatures offered by the summon picker. Same no-Mojang-assets rule
 * as the item palette: a glyph and a colour, never a shipped texture.
 */
export const SUMMONABLE: { id: string; label: string; emoji: string }[] = [
  { id: 'minecraft:chicken', label: 'Chicken', emoji: '🐔' },
  { id: 'minecraft:cow', label: 'Cow', emoji: '🐄' },
  { id: 'minecraft:pig', label: 'Pig', emoji: '🐖' },
  { id: 'minecraft:sheep', label: 'Sheep', emoji: '🐑' },
  { id: 'minecraft:wolf', label: 'Wolf', emoji: '🐺' },
  { id: 'minecraft:cat', label: 'Cat', emoji: '🐈' },
  { id: 'minecraft:bee', label: 'Bee', emoji: '🐝' },
  { id: 'minecraft:zombie', label: 'Zombie', emoji: '🧟' },
  { id: 'minecraft:skeleton', label: 'Skeleton', emoji: '💀' },
  { id: 'minecraft:creeper', label: 'Creeper', emoji: '🟩' },
  { id: 'minecraft:spider', label: 'Spider', emoji: '🕷️' },
  { id: 'minecraft:slime', label: 'Slime', emoji: '🟢' },
  { id: 'minecraft:allay', label: 'Allay', emoji: '🧚' },
  { id: 'minecraft:axolotl', label: 'Axolotl', emoji: '🦎' },
];

export function isSummonable(id: unknown): id is string {
  return SUMMONABLE.some((s) => s.id === id);
}

/** Longest message a kid can attach to a "say something" action. */
export const MAX_RULE_MESSAGE = 120;
