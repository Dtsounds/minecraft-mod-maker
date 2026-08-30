import type { CompiledRule } from './rules';

/**
 * The behavior pack's `scripts/main.js`.
 *
 * This runtime is a CONSTANT. It is written once, reviewed once, and shipped
 * byte-identical in every mod. The only thing that changes between one kid's
 * mod and another's is the JSON rule table spliced in at the top.
 *
 * That is the whole safety argument for Phase 4. If we generated a bespoke
 * program per project, every new preset would be another chance to emit
 * JavaScript that does not parse — and a script error in Bedrock is a *silent*
 * failure that surfaces only in the content log, which is exactly the class of
 * bug that cost this project four debugging rounds already. Interpreting data
 * instead means the shipped code path is the same one the tests exercise.
 *
 * Defensive choices worth keeping:
 *
 *  - Every action runs inside `system.run`, which both escapes the read-only
 *    window an after-event handler runs in and isolates a throwing action from
 *    the event dispatch itself.
 *  - Every action is individually wrapped, so one impossible rule cannot stop
 *    the other rules in the same mod from working.
 *  - Locations are copied to plain `{x,y,z}` at event time. The live reference
 *    can belong to an entity that is gone by the time the deferred action runs
 *    — reading `.location` off a dead entity throws.
 *  - Nothing touches world state at module scope. Under Script API V2 scripts
 *    are evaluated in "early execution", where most of the `world` object
 *    throws; subscribing to events is explicitly permitted there, so the
 *    subscriptions are all this file does up front.
 */
/**
 * Kept separate so it can be emitted BEFORE the rule data.
 *
 * Import declarations are hoisted, so placing them after a `const` is legal
 * and esbuild parses it happily — but "legal per spec" and "what Bedrock's
 * engine does" are not the same claim, and this project has been bitten three
 * times by exactly that gap. Conventional order costs nothing.
 */
const RUNTIME_IMPORT = 'import { world, system, ItemStack } from "@minecraft/server";';

/** Separates the generated data header from the fixed runtime below it. */
export const RUNTIME_MARKER = '// --- runtime: identical in every mod ---';

const RUNTIME_BODY = String.raw`
/** Run an action outside the event's read-only window, never throwing. */
function later(fn) {
  try {
    system.run(function () {
      try {
        fn();
      } catch (err) {
        // One broken rule must not take the others down with it.
      }
    });
  } catch (err) {
    /* system unavailable — nothing sensible left to do */
  }
}

/** A copy, because the entity this came from may not survive the tick. */
function pointOf(source) {
  try {
    var l = source.location;
    return { x: l.x, y: l.y, z: l.z };
  } catch (err) {
    return null;
  }
}

function isPlayer(entity) {
  try {
    return !!entity && entity.typeId === "minecraft:player";
  } catch (err) {
    return false;
  }
}

function perform(rule, ctx) {
  var action = rule.action;

  if (action === "effect") {
    if (!ctx.player) return;
    // addEffect takes TICKS; amplifier is zero-based, so "level 1" is 0.
    ctx.player.addEffect(rule.effect, rule.seconds * 20, {
      amplifier: rule.strength - 1,
      showParticles: true
    });
    return;
  }

  if (action === "message") {
    if (ctx.player) ctx.player.sendMessage(rule.message);
    else world.sendMessage(rule.message);
    return;
  }

  if (!ctx.dimension || !ctx.point) return;

  if (action === "lightning") {
    ctx.dimension.spawnEntity("minecraft:lightning_bolt", ctx.point);
    return;
  }

  if (action === "explode") {
    // Never breaksBlocks: a kid triggering this on their own house and losing
    // the build is not a fun surprise, and it cannot be undone.
    ctx.dimension.createExplosion(ctx.point, rule.radius, {
      breaksBlocks: false,
      causesFire: false
    });
    return;
  }

  if (action === "summon") {
    for (var i = 0; i < rule.summonCount; i++) {
      ctx.dimension.spawnEntity(rule.summon, ctx.point);
    }
    return;
  }

  if (action === "giveItem") {
    // Dropped rather than inserted, so a full inventory is not a silent no-op.
    ctx.dimension.spawnItem(new ItemStack(rule.give, rule.giveCount), ctx.point);
    return;
  }

  if (action === "playSound") {
    ctx.dimension.playSound(rule.sound, ctx.point);
    return;
  }

  if (action === "setOnFire") {
    var target = ctx.entity || ctx.player;
    if (target) target.setOnFire(rule.fireSeconds, true);
    return;
  }
}

/** Fire every rule whose trigger and subject both match. */
function dispatch(trigger, subject, ctx) {
  for (var i = 0; i < RULES.length; i++) {
    var rule = RULES[i];
    if (rule.trigger !== trigger) continue;
    if (rule.subject !== null && rule.subject !== subject) continue;
    later(
      (function (r) {
        return function () {
          perform(r, ctx);
        };
      })(rule)
    );
  }
}

function contextFromEntity(entity, player) {
  return {
    player: player || null,
    entity: entity || null,
    dimension: entity ? entity.dimension : player ? player.dimension : null,
    point: pointOf(entity || player)
  };
}

world.afterEvents.itemUse.subscribe(function (event) {
  var player = event.source;
  if (!player || !event.itemStack) return;
  dispatch("useItem", event.itemStack.typeId, contextFromEntity(player, player));
});

world.afterEvents.playerBreakBlock.subscribe(function (event) {
  var broken = event.brokenBlockPermutation;
  if (!broken || !broken.type) return;
  dispatch("breakBlock", broken.type.id, {
    player: event.player || null,
    entity: event.player || null,
    dimension: event.dimension,
    point: pointOf(event.block)
  });
});

world.afterEvents.playerPlaceBlock.subscribe(function (event) {
  if (!event.block) return;
  dispatch("placeBlock", event.block.typeId, {
    player: event.player || null,
    entity: event.player || null,
    dimension: event.dimension,
    point: pointOf(event.block)
  });
});

world.afterEvents.entityHitEntity.subscribe(function (event) {
  var hit = event.hitEntity;
  if (!hit) return;
  var attacker = event.damagingEntity;
  dispatch("hitMob", hit.typeId, contextFromEntity(hit, isPlayer(attacker) ? attacker : null));
});

world.afterEvents.entityDie.subscribe(function (event) {
  var dead = event.deadEntity;
  if (!dead) return;
  var killer = event.damageSource ? event.damageSource.damagingEntity : null;
  dispatch("mobDies", dead.typeId, contextFromEntity(dead, isPlayer(killer) ? killer : null));
});

world.afterEvents.playerSpawn.subscribe(function (event) {
  // Only a genuine arrival, not every respawn after dying.
  if (!event.initialSpawn || !event.player) return;
  dispatch("playerJoins", null, contextFromEntity(event.player, event.player));
});

world.afterEvents.worldLoad.subscribe(function () {
  if (BANNER) world.sendMessage("[" + BANNER + "] " + RULES.length + " rule(s) loaded");
});
`;

const BACKSLASH = String.fromCharCode(0x5c);
const LINE_SEPARATORS = new RegExp(
  `[${String.fromCharCode(0x2028)}${String.fromCharCode(0x2029)}]`,
  'g',
);

/**
 * JSON is a subset of JS *except* for U+2028/U+2029, which are legal inside a
 * JSON string but are line terminators in JavaScript source. Escaping them
 * costs nothing and removes the one way a kid's typed message could change the
 * meaning of the file it is embedded in.
 */
function jsLiteral(value: unknown): string {
  // Built from char codes rather than written literally: U+2028 IS a line
  // terminator in JavaScript source, so a regex literal containing one does
  // not even parse. The compiler catches that; a reviewer very likely would not.
  return JSON.stringify(value).replace(LINE_SEPARATORS, (ch) =>
    BACKSLASH + "u" + ch.charCodeAt(0).toString(16),
  );
}

export interface RuntimeOptions {
  /**
   * When set, the runtime announces how many rules loaded on world load.
   *
   * This exists to make one on-device test decisive. If the banner appears,
   * the script module resolved and is running, so any misbehaving rule is a
   * rule bug; if it does not appear, the manifest or the module version is
   * wrong and no rule was ever going to fire. Without it those two failures
   * look identical from inside the game. Off for a kid's real export.
   */
  banner?: string;
}

/** The complete `scripts/main.js` for a mod. */
export function buildScriptMain(rules: CompiledRule[], options: RuntimeOptions = {}): string {
  const header = [
    '// Generated by Bedrock Mod Maker.',
    '// The code below is the same in every mod; only RULES changes.',
    RUNTIME_IMPORT,
    '',
    `const RULES = ${jsLiteral(rules)};`,
    `const BANNER = ${options.banner ? jsLiteral(options.banner) : 'null'};`,
    '',
    RUNTIME_MARKER,
  ].join('\n');

  return `${header}\n${RUNTIME_BODY}`;
}
