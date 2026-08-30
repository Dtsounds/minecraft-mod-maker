import { describe, expect, it } from 'vitest';
import { buildClientEntityJson, buildEntityJson, buildMobLootTable, mobIdentifier } from '../src/bedrock/mob';
import { buildGeometryJson, MOB_RIGS, mobRig } from '../src/bedrock/mobGeometry';
import { createMob } from '../src/bedrock/project';
import { CLIENT_ENTITY_FORMAT_VERSION, ENTITY_FORMAT_VERSION } from '../src/bedrock/versions';
import { MOB_HEALTH, sizeToScale, speedToMovement } from '../src/bedrock/mobPresets';
import type { ModMob } from '../src/bedrock/types';

function make(overrides: Partial<ModMob> = {}): ModMob {
  return { ...createMob(), name: 'Fluff Beast', ...overrides };
}

const comp = (m: ModMob) => buildEntityJson('rubymod', m)['minecraft:entity'].components;

describe('entity JSON', () => {
  it('uses the pinned entity format_version, below the strict-validation threshold', () => {
    expect(buildEntityJson('rubymod', make()).format_version).toBe(ENTITY_FORMAT_VERSION);
    // 1.26.40+ hard-fails entity loads on invalid component data.
    const [major, minor] = ENTITY_FORMAT_VERSION.split('.').map(Number);
    expect(major! * 1000 + minor! * 10).toBeLessThan(1 * 1000 + 26 * 10 + 40);
  });

  it('is spawnable and summonable so /summon and the egg both work', () => {
    const d = buildEntityJson('rubymod', make())['minecraft:entity'].description;
    expect(d.identifier).toBe('rubymod:fluff_beast');
    expect(d.is_spawnable).toBe(true);
    expect(d.is_summonable).toBe(true);
  });

  it('emits the core components every mob needs to exist and move', () => {
    const c = comp(make());
    for (const key of [
      'minecraft:physics',
      'minecraft:health',
      'minecraft:movement',
      'minecraft:navigation.walk',
      'minecraft:movement.basic',
      'minecraft:collision_box',
      'minecraft:type_family',
      'minecraft:behavior.float',
      'minecraft:behavior.random_stroll',
    ]) {
      expect(c[key], `missing ${key}`).toBeDefined();
    }
  });

  it('sets health value and max together', () => {
    expect(comp(make({ health: 30 }))['minecraft:health']).toEqual({ value: 30, max: 30 });
  });

  it('clamps absurd health', () => {
    expect(comp(make({ health: 9999 }))['minecraft:health']).toEqual({
      value: MOB_HEALTH.max,
      max: MOB_HEALTH.max,
    });
    const low = comp(make({ health: -20 }))['minecraft:health'] as { value: number };
    expect(low.value).toBeGreaterThan(0);
  });

  it('keeps movement speed inside sane vanilla territory', () => {
    for (const speed of [-5, 1, 20, 9999, NaN]) {
      const movement = comp(make({ speed }))['minecraft:movement'] as { value: number };
      expect(movement.value).toBeGreaterThan(0);
      expect(movement.value).toBeLessThanOrEqual(1);
    }
    // Cow-ish at the middle of the slider.
    expect(speedToMovement(5)).toBeCloseTo(0.25, 2);
  });

  it('omits scale at normal size and sets it otherwise', () => {
    expect(comp(make({ size: 10 }))['minecraft:scale']).toBeUndefined();
    expect(comp(make({ size: 20 }))['minecraft:scale']).toEqual({ value: 2 });
    expect(sizeToScale(3)).toBeCloseTo(0.3, 2);
  });

  it('scales the collision box with size', () => {
    const normal = comp(make({ size: 10 }))['minecraft:collision_box'] as { width: number };
    const big = comp(make({ size: 20 }))['minecraft:collision_box'] as { width: number };
    expect(big.width).toBeGreaterThan(normal.width);
  });
});

describe('mood toggles', () => {
  it('a friendly mob neither attacks nor panics', () => {
    const c = comp(make({ mood: 'friendly' }));
    expect(c['minecraft:attack']).toBeUndefined();
    expect(c['minecraft:behavior.melee_attack']).toBeUndefined();
    expect(c['minecraft:behavior.panic']).toBeUndefined();
  });

  it('a shy mob panics but never attacks', () => {
    const c = comp(make({ mood: 'shy' }));
    expect(c['minecraft:behavior.panic']).toBeDefined();
    expect(c['minecraft:attack']).toBeUndefined();
  });

  it('a mean mob gets attack, melee and player targeting together', () => {
    const c = comp(make({ mood: 'mean', damage: 7 }));
    expect(c['minecraft:attack']).toEqual({ damage: 7 });
    expect(c['minecraft:behavior.melee_attack']).toBeDefined();
    const target = c['minecraft:behavior.nearest_attackable_target'] as {
      entity_types: { filters: { value: string } }[];
    };
    expect(target.entity_types[0]?.filters.value).toBe('player');
  });

  it('clamps attack damage', () => {
    expect(comp(make({ mood: 'mean', damage: 9999 }))['minecraft:attack']).toEqual({ damage: 20 });
  });
});

describe('behaviour toggles', () => {
  it('adds tameable only when a real food is chosen', () => {
    expect(comp(make({ tameable: true, tameFood: null }))['minecraft:tameable']).toBeUndefined();
    expect(comp(make({ tameable: false, tameFood: 'minecraft:wheat' }))['minecraft:tameable']).toBeUndefined();
    const tame = comp(make({ tameable: true, tameFood: 'minecraft:wheat' }))['minecraft:tameable'] as {
      tame_items: string[];
    };
    expect(tame.tame_items).toEqual(['minecraft:wheat']);
  });

  it('refuses a taming food that is not on the built-in list', () => {
    expect(
      comp(make({ tameable: true, tameFood: 'minecraft:not_a_food' }))['minecraft:tameable'],
    ).toBeUndefined();
  });

  it('adds rideable with a player seat', () => {
    expect(comp(make({ rideable: false }))['minecraft:rideable']).toBeUndefined();
    const ride = comp(make({ rideable: true }))['minecraft:rideable'] as { family_types: string[] };
    expect(ride.family_types).toEqual(['player']);
  });

  it('adds breedable plus its supporting behaviours, pointed at itself', () => {
    const c = comp(make({ breedable: true, breedFood: 'minecraft:carrot' }));
    const breed = c['minecraft:breedable'] as { breeds_with: { mate_type: string; baby_type: string } };
    expect(breed.breeds_with.mate_type).toBe('rubymod:fluff_beast');
    expect(breed.breeds_with.baby_type).toBe('rubymod:fluff_beast');
    expect(c['minecraft:behavior.breed']).toBeDefined();
    expect(c['minecraft:behavior.tempt']).toBeDefined();
  });

  it('gives every behaviour goal a numeric priority', () => {
    const c = comp(
      make({ mood: 'mean', tameable: true, tameFood: 'minecraft:bone', rideable: true, breedable: true, breedFood: 'minecraft:wheat' }),
    );
    for (const [key, value] of Object.entries(c)) {
      if (!key.startsWith('minecraft:behavior.')) continue;
      expect(typeof (value as { priority: unknown }).priority, `${key} priority`).toBe('number');
    }
  });
});

describe('client entity', () => {
  it('uses the vanilla-compatible material, controller and animation', () => {
    const d = buildClientEntityJson('rubymod', make())['minecraft:client_entity'].description;
    expect(buildClientEntityJson('rubymod', make()).format_version).toBe(CLIENT_ENTITY_FORMAT_VERSION);
    expect(d.materials['default']).toBe('entity_alphatest');
    expect(d.render_controllers).toEqual(['controller.render.default']);
    // Verified against Mojang's quadruped.animation.json.
    expect(d.animations['walk']).toBe('animation.quadruped.walk');
  });

  it('points texture and geometry at our own files, not vanilla ones', () => {
    const d = buildClientEntityJson('rubymod', make())['minecraft:client_entity'].description;
    expect(d.textures['default']).toBe('textures/entity/fluff_beast');
    // Never a versioned vanilla identifier like geometry.cow.v2.
    expect(d.geometry['default']).toBe('geometry.rubymod.fluff_beast');
    expect(d.geometry['default']).not.toMatch(/^geometry\.(cow|pig|chicken)/);
  });
});

describe('rigs', () => {
  it('names legs leg0.. so vanilla quadruped.walk animates them', () => {
    for (const rig of MOB_RIGS) {
      const legs = rig.bones.filter((b) => b.name.startsWith('leg')).map((b) => b.name);
      expect(legs.length, `${rig.id} has no legs`).toBeGreaterThan(0);
      for (const leg of legs) expect(leg).toMatch(/^leg[0-3]$/);
    }
  });

  it('gives every rig a head and a body', () => {
    for (const rig of MOB_RIGS) {
      const names = rig.bones.map((b) => b.name);
      expect(names, `${rig.id}`).toContain('head');
      expect(names, `${rig.id}`).toContain('body');
    }
  });

  it('keeps every cube UV inside the texture', () => {
    for (const rig of MOB_RIGS) {
      for (const bone of rig.bones) {
        for (const cube of bone.cubes) {
          const [w, h, d] = cube.size;
          const needW = 2 * (d + w);
          const needH = d + h;
          expect(cube.uv[0] + needW, `${rig.id}/${bone.name} u`).toBeLessThanOrEqual(rig.textureSize);
          expect(cube.uv[1] + needH, `${rig.id}/${bone.name} v`).toBeLessThanOrEqual(rig.textureSize);
        }
      }
    }
  });

  it('uses a square texture so the pixel editor can round-trip it', () => {
    for (const rig of MOB_RIGS) expect(rig.textureSize).toBe(64);
  });

  it('builds a geometry file with matching texture dimensions', () => {
    const rig = mobRig('quadruped');
    const geo = buildGeometryJson('geometry.test.thing', rig);
    const description = geo['minecraft:geometry'][0]!.description;
    expect(description.identifier).toBe('geometry.test.thing');
    expect(description.texture_width).toBe(64);
    expect(description.texture_height).toBe(64);
    expect(geo['minecraft:geometry'][0]!.bones.length).toBeGreaterThan(3);
  });
});

describe('mob loot', () => {
  const resolve = (id: string) => (id === 'item-1' ? 'rubymod:ruby' : null);

  it('drops nothing by default', () => {
    expect(buildMobLootTable(make(), resolve)).toBeNull();
  });

  it('can drop a vanilla item', () => {
    const loot = buildMobLootTable(make({ drop: { kind: 'vanilla', id: 'minecraft:leather' } }), resolve)!;
    expect(loot.pools[0]?.entries[0]?.name).toBe('minecraft:leather');
  });

  it('can drop one of the kid’s own items', () => {
    const loot = buildMobLootTable(make({ drop: { kind: 'myItem', itemId: 'item-1' } }), resolve)!;
    expect(loot.pools[0]?.entries[0]?.name).toBe('rubymod:ruby');
  });

  it('returns null for an unknown vanilla id or a deleted item', () => {
    expect(buildMobLootTable(make({ drop: { kind: 'vanilla', id: 'minecraft:nope' } }), resolve)).toBeNull();
    expect(buildMobLootTable(make({ drop: { kind: 'myItem', itemId: 'gone' } }), resolve)).toBeNull();
  });

  it('clamps the drop count', () => {
    const loot = buildMobLootTable(
      make({ drop: { kind: 'vanilla', id: 'minecraft:bone' }, dropCount: 999 }),
      resolve,
    )!;
    expect(loot.pools[0]?.rolls).toBe(16);
  });
});

describe('identifiers', () => {
  it('sanitises a kid-typed mob name', () => {
    expect(mobIdentifier('Ruby Mod', make({ name: 'Fluff Beast!!' }))).toBe('ruby_mod:fluff_beast');
  });

  it('produces a valid identifier from an empty name', () => {
    expect(mobIdentifier('rubymod', make({ name: '   ' }))).toMatch(/^rubymod:[a-z][a-z0-9_]*$/);
  });
});
