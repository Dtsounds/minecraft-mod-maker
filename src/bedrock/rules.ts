import { clampInt } from './ids';
import {
  MAX_RULE_MESSAGE,
  RULE_EFFECTS,
  RULE_SOUNDS,
  actionSpec,
  isRuleEffect,
  isRuleSound,
  isSummonable,
  triggerSpec,
} from './rulePresets';
import { isKnownVanillaId } from './vanillaItems';
import type { ActionKind, ModProject, ModRule, RuleTarget, TriggerKind } from './types';

/**
 * Compile a kid's rules into the data table the shipped runtime interprets.
 *
 * The output of this module is *data*, never code. `scripts/main.js` is a
 * fixed, hand-written interpreter that is byte-identical in every export; the
 * only thing that varies between mods is the JSON table produced here. That
 * is what makes "a kid must never produce a broken pack" hold for scripting:
 * no input to this function can produce syntactically invalid JavaScript,
 * because no input to this function produces JavaScript at all.
 *
 * The second guarantee is that every rule that survives is *runnable*. A rule
 * that names a creature the kid has since deleted, or an action target that
 * no longer resolves, is dropped here rather than shipped for the runtime to
 * trip over.
 */

/** One rule, resolved down to concrete Minecraft identifiers. */
export interface CompiledRule {
  trigger: TriggerKind;
  /** Namespaced identifier the trigger watches, or null for `playerJoins`. */
  subject: string | null;
  action: ActionKind;
  effect?: string;
  strength?: number;
  seconds?: number;
  message?: string;
  radius?: number;
  fireSeconds?: number;
  summon?: string;
  summonCount?: number;
  give?: string;
  giveCount?: number;
  sound?: string;
}

/** Resolves a project-local item/block/mob id to its final identifier. */
export type IdentifierLookup = (refId: string) => string | null;

export interface RuleContext {
  /** Kid's own items, by ModItem.id. */
  item: IdentifierLookup;
  block: IdentifierLookup;
  mob: IdentifierLookup;
}

/** Pull a slider's clamped value straight from the action's own preset. */
function slider(action: ActionKind, key: string, raw: number): number {
  const spec = actionSpec(action).sliders.find((s) => s.key === key);
  if (!spec) return 0;
  return clampInt(raw, spec.min, spec.max);
}

/**
 * Resolve a target to a concrete identifier.
 *
 * `mine` targets are looked up through the same maps the rest of the pack
 * uses, so a rule always points at the de-duplicated identifier that actually
 * shipped — not at what the name suggested before a collision was resolved.
 */
function resolveTarget(
  target: RuleTarget | undefined,
  lookup: IdentifierLookup,
  isVanilla: (id: unknown) => boolean,
): string | null {
  if (!target || typeof target !== 'object') return null;
  if (target.kind === 'vanilla') return isVanilla(target.id) ? target.id : null;
  if (target.kind === 'mine') return lookup(target.refId);
  return null;
}

/** Strip anything that would break the chat line, then bound the length. */
function cleanMessage(raw: string): string {
  return raw.replace(/[\r\n]+/g, ' ').trim().slice(0, MAX_RULE_MESSAGE);
}

/**
 * Compile every runnable rule. Rules that cannot run are silently dropped —
 * the kid-facing UI is responsible for warning about them *before* export,
 * which is the same split used for "this item has no picture".
 */
export function buildRuleTable(project: ModProject, ctx: RuleContext): CompiledRule[] {
  const out: CompiledRule[] = [];

  for (const rule of project.rules ?? []) {
    if (!rule || rule.enabled === false) continue;

    const tSpec = triggerSpec(rule.trigger);
    // Guard against a hand-edited autosave naming a trigger we do not have.
    if (tSpec.trigger !== rule.trigger) continue;

    // --- Subject -----------------------------------------------------------
    let subject: string | null = null;
    if (tSpec.subject !== 'none') {
      if (!rule.subjectId) continue;
      const lookup =
        tSpec.subject === 'item' ? ctx.item : tSpec.subject === 'block' ? ctx.block : ctx.mob;
      subject = lookup(rule.subjectId);
      // The thing this rule watched has been deleted — drop the rule rather
      // than ship one that can never fire.
      if (!subject) continue;
    }

    const aSpec = actionSpec(rule.action);
    if (aSpec.action !== rule.action) continue;

    const compiled: CompiledRule = { trigger: rule.trigger, subject, action: rule.action };

    switch (rule.action) {
      case 'effect': {
        compiled.effect = isRuleEffect(rule.effect)
          ? rule.effect
          : (RULE_EFFECTS[0]?.effect as string);
        compiled.strength = slider('effect', 'strength', rule.strength);
        compiled.seconds = slider('effect', 'seconds', rule.seconds);
        break;
      }
      case 'message': {
        const text = cleanMessage(typeof rule.message === 'string' ? rule.message : '');
        // An empty bubble in chat is just confusing; treat it as unfinished.
        if (!text) continue;
        compiled.message = text;
        break;
      }
      case 'lightning':
        break;
      case 'explode': {
        compiled.radius = slider('explode', 'radius', rule.radius);
        break;
      }
      case 'summon': {
        const id = resolveTarget(rule.summonTarget, ctx.mob, isSummonable);
        if (!id) continue;
        compiled.summon = id;
        compiled.summonCount = slider('summon', 'summonCount', rule.summonCount);
        break;
      }
      case 'giveItem': {
        const id = resolveTarget(rule.giveTarget, ctx.item, isKnownVanillaId);
        if (!id) continue;
        compiled.give = id;
        compiled.giveCount = slider('giveItem', 'giveCount', rule.giveCount);
        break;
      }
      case 'playSound': {
        compiled.sound = isRuleSound(rule.sound)
          ? rule.sound
          : (RULE_SOUNDS[0]?.sound as string);
        break;
      }
      case 'setOnFire': {
        compiled.fireSeconds = slider('setOnFire', 'fireSeconds', rule.fireSeconds);
        break;
      }
      default:
        continue;
    }

    out.push(compiled);
  }

  return out;
}

/**
 * Why a rule the kid built will not ship, in their own words. Used by the UI
 * to warn before export — `buildRuleTable` just drops these silently.
 */
export function ruleProblem(rule: ModRule, ctx: RuleContext): string | null {
  const tSpec = triggerSpec(rule.trigger);
  if (tSpec.subject !== 'none') {
    const lookup =
      tSpec.subject === 'item' ? ctx.item : tSpec.subject === 'block' ? ctx.block : ctx.mob;
    if (!rule.subjectId) return `Pick which ${tSpec.subject} this rule watches.`;
    if (!lookup(rule.subjectId)) return `The ${tSpec.subject} this rule watched has been deleted.`;
  }
  if (rule.action === 'message' && !cleanMessage(rule.message ?? '')) {
    return 'Type what you want it to say.';
  }
  if (rule.action === 'summon' && !resolveTarget(rule.summonTarget, ctx.mob, isSummonable)) {
    return 'Pick a creature to summon.';
  }
  if (rule.action === 'giveItem' && !resolveTarget(rule.giveTarget, ctx.item, isKnownVanillaId)) {
    return 'Pick an item to drop.';
  }
  return null;
}
