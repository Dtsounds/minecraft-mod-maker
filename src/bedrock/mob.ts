import { ENTITY_FORMAT_VERSION, CLIENT_ENTITY_FORMAT_VERSION } from './versions';
import { clampInt, toIdentifierSegment } from './ids';
import {
  MOB_DAMAGE,
  MOB_DROP_COUNT,
  MOB_HEALTH,
  isMobFood,
  sizeToScale,
  speedToMovement,
} from './mobPresets';
import { mobRig } from './mobGeometry';
import { isKnownVanillaId } from './vanillaItems';
import type { ModMob } from './types';

export function mobShortName(mob: ModMob): string {
  return toIdentifierSegment(mob.name, 'my_mob');
}

export function mobIdentifier(namespace: string, mob: ModMob): string {
  return `${toIdentifierSegment(namespace, 'mymod')}:${mobShortName(mob)}`;
}

export interface EntityJson {
  format_version: string;
  'minecraft:entity': {
    description: {
      identifier: string;
      is_spawnable: boolean;
      is_summonable: boolean;
    };
    components: Record<string, unknown>;
  };
}

/**
 * Build `entities/<name>.json`.
 *
 * Component shapes are copied from Mojang's own chicken.json rather than the
 * reference pages: health/movement/collision_box/navigation.walk/physics and
 * the behaviour priority ordering all match a real shipping entity.
 *
 * On format_version: the 1.26.40 release notes state that entity definitions
 * at 1.26.40 or later "now fail to load when invalid data is supplied to
 * several components and AI goals", and advise validating before raising the
 * version. The platform guidance separately exempts entities from the N-1
 * rule ("entity type versioning is highly variable"). Staying below that
 * strict-validation threshold is the conservative choice and the one Mojang
 * actually recommends.
 */
export function buildEntityJson(namespace: string, mob: ModMob): EntityJson {
  const ns = toIdentifierSegment(namespace, 'mymod');
  const shortName = mobShortName(mob);
  const identifier = `${ns}:${shortName}`;
  const rig = mobRig(mob.rig);
  const family = toIdentifierSegment(mob.name, 'my_mob');

  const health = clampInt(mob.health, MOB_HEALTH.min, MOB_HEALTH.max);
  const scale = sizeToScale(mob.size);

  const components: Record<string, unknown> = {
    'minecraft:type_family': { family: [family, 'mob'] },
    'minecraft:health': { value: health, max: health },
    'minecraft:movement': { value: speedToMovement(mob.speed) },
    'minecraft:navigation.walk': { can_path_over_water: true, avoid_damage_blocks: true },
    'minecraft:movement.basic': {},
    'minecraft:jump.static': {},
    'minecraft:can_climb': {},
    'minecraft:physics': {},
    'minecraft:collision_box': {
      width: Math.round(rig.collision.width * scale * 100) / 100,
      height: Math.round(rig.collision.height * scale * 100) / 100,
    },
    'minecraft:nameable': {},
    // Priorities follow vanilla's ordering: float first, then reactions,
    // then idle wandering, then looking around.
    'minecraft:behavior.float': { priority: 0 },
    'minecraft:behavior.random_stroll': { priority: 6, speed_multiplier: 1.0 },
    'minecraft:behavior.look_at_player': { priority: 7, look_distance: 6.0 },
    'minecraft:behavior.random_look_around': { priority: 8 },
  };

  if (scale !== 1) components['minecraft:scale'] = { value: scale };

  if (mob.mood === 'mean') {
    components['minecraft:attack'] = { damage: clampInt(mob.damage, MOB_DAMAGE.min, MOB_DAMAGE.max) };
    components['minecraft:behavior.melee_attack'] = { priority: 3, speed_multiplier: 1.25, track_target: true };
    components['minecraft:behavior.nearest_attackable_target'] = {
      priority: 2,
      must_see: true,
      reselect_targets: true,
      entity_types: [
        {
          filters: { test: 'is_family', subject: 'other', value: 'player' },
          max_dist: 16,
        },
      ],
    };
  } else if (mob.mood === 'shy') {
    components['minecraft:behavior.panic'] = { priority: 1, speed_multiplier: 1.5 };
  }

  if (mob.tameable && isMobFood(mob.tameFood)) {
    // `tame_items` plus a tame event is the minimum viable tameable setup.
    components['minecraft:tameable'] = {
      probability: 0.5,
      tame_items: [mob.tameFood],
      tame_event: { event: 'minecraft:on_tame', target: 'self' },
    };
  }

  if (mob.rideable) {
    components['minecraft:rideable'] = {
      seat_count: 1,
      family_types: ['player'],
      seats: { position: [0, rig.collision.height * scale, 0] },
    };
  }

  if (mob.breedable && isMobFood(mob.breedFood)) {
    components['minecraft:breedable'] = {
      require_tame: false,
      breeds_with: { mate_type: identifier, baby_type: identifier },
      love_filters: {
        test: 'has_component',
        subject: 'self',
        operator: '!=',
        value: 'minecraft:is_baby',
      },
    };
    components['minecraft:behavior.breed'] = { priority: 4, speed_multiplier: 1.0 };
    components['minecraft:behavior.tempt'] = {
      priority: 5,
      speed_multiplier: 1.0,
      items: [mob.breedFood],
    };
  }

  return {
    format_version: ENTITY_FORMAT_VERSION,
    'minecraft:entity': {
      description: { identifier, is_spawnable: true, is_summonable: true },
      components,
    },
  };
}

export interface ClientEntityJson {
  format_version: string;
  'minecraft:client_entity': {
    description: {
      identifier: string;
      materials: Record<string, string>;
      textures: Record<string, string>;
      geometry: Record<string, string>;
      animations: Record<string, string>;
      scripts: { animate: unknown[] };
      render_controllers: string[];
      spawn_egg: { texture: string };
    };
  };
}

/**
 * Build `entity/<name>.entity.json` for the resource pack.
 *
 * `entity_alphatest` is the stock material for a mob whose texture has
 * transparent pixels, and `controller.render.default` is vanilla's generic
 * controller (Geometry.default / Material.default / Texture.default) — no
 * custom render controller is needed for one texture and one geometry.
 *
 * The only vanilla animation referenced is `animation.quadruped.walk`, which
 * was verified to animate exactly leg0..leg3. Every rig names its legs that
 * way, so two-legged rigs simply leave leg2/leg3 unmatched.
 */
export function buildClientEntityJson(namespace: string, mob: ModMob): ClientEntityJson {
  const ns = toIdentifierSegment(namespace, 'mymod');
  const shortName = mobShortName(mob);

  return {
    format_version: CLIENT_ENTITY_FORMAT_VERSION,
    'minecraft:client_entity': {
      description: {
        identifier: `${ns}:${shortName}`,
        materials: { default: 'entity_alphatest' },
        textures: { default: `textures/entity/${shortName}` },
        geometry: { default: `geometry.${ns}.${shortName}` },
        animations: { walk: 'animation.quadruped.walk' },
        scripts: { animate: [{ walk: 'query.modified_move_speed' }] },
        render_controllers: ['controller.render.default'],
        // Vanilla spawn egg art, tinted by the game; shipping our own egg
        // texture would mean another atlas entry for no real gain.
        spawn_egg: { texture: 'spawn_egg_chicken' },
      },
    },
  };
}

export interface MobLootJson {
  pools: { rolls: number; entries: { type: string; name: string }[] }[];
}

/** Build `loot_tables/entities/<name>.json` for what the mob drops on death. */
export function buildMobLootTable(
  mob: ModMob,
  resolveMyItem: (itemId: string) => string | null,
): MobLootJson | null {
  let dropName: string | null = null;
  switch (mob.drop?.kind) {
    case 'vanilla':
      dropName = isKnownVanillaId(mob.drop.id) ? mob.drop.id : null;
      break;
    case 'myItem':
      dropName = resolveMyItem(mob.drop.itemId);
      break;
    default:
      dropName = null;
  }
  if (!dropName) return null;

  return {
    pools: [
      {
        rolls: clampInt(mob.dropCount ?? 1, MOB_DROP_COUNT.min, MOB_DROP_COUNT.max),
        entries: [{ type: 'item', name: dropName }],
      },
    ],
  };
}
