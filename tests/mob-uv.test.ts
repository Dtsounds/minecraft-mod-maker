import { describe, expect, it } from 'vitest';
import { MOB_RIGS, mobRig } from '../src/bedrock/mobGeometry';
import { areaAt, cubeFaces, describePixel, rigUvMap } from '../src/bedrock/mobUv';
import { starterMobTexture } from '../src/components/mobStarter';

describe('the box unwrap', () => {
  it('puts the six faces where Minecraft puts them', () => {
    // A player skin's head is the canonical case: an 8x8x8 box at uv 0,0 with
    // the face at (8,8), the top at (8,0) and the back at (24,8).
    const faces = cubeFaces([0, 0], [8, 8, 8]);
    const at = (face: string) => faces.find((f) => f.face === face);
    expect(at('top')).toEqual({ face: 'top', x: 8, y: 0, w: 8, h: 8 });
    expect(at('bottom')).toEqual({ face: 'bottom', x: 16, y: 0, w: 8, h: 8 });
    expect(at('right')).toEqual({ face: 'right', x: 0, y: 8, w: 8, h: 8 });
    expect(at('front')).toEqual({ face: 'front', x: 8, y: 8, w: 8, h: 8 });
    expect(at('left')).toEqual({ face: 'left', x: 16, y: 8, w: 8, h: 8 });
    expect(at('back')).toEqual({ face: 'back', x: 24, y: 8, w: 8, h: 8 });
  });

  it('tiles vanilla’s pig exactly, which is what proves the face order', () => {
    // Cubes copied from Mojang/bedrock-samples, geometry.pig.v1.8, on a 64x32
    // sheet. A wrong face order overflows the sheet or falls short of it;
    // vanilla's own model lands flush against both far edges.
    const pig = [
      { name: 'body', uv: [28, 8], size: [10, 16, 8] },
      { name: 'head', uv: [0, 0], size: [8, 8, 8] },
      { name: 'snout', uv: [16, 16], size: [4, 3, 1] },
      { name: 'leg0', uv: [0, 16], size: [4, 6, 4] },
    ] as const;

    let right = 0;
    let bottom = 0;
    for (const cube of pig) {
      for (const f of cubeFaces(cube.uv as [number, number], cube.size as [number, number, number])) {
        expect(f.x + f.w).toBeLessThanOrEqual(64);
        expect(f.y + f.h).toBeLessThanOrEqual(32);
        right = Math.max(right, f.x + f.w);
        bottom = Math.max(bottom, f.y + f.h);
      }
    }
    expect([right, bottom]).toEqual([64, 32]);
  });

  it('survives a degenerate box rather than emitting nonsense', () => {
    expect(cubeFaces([0, 0], [0, 0, 0]).every((f) => f.w === 0 || f.h === 0)).toBe(true);
  });
});

describe('the map for each rig', () => {
  it('keeps every face inside the sheet', () => {
    for (const rig of MOB_RIGS) {
      const map = rigUvMap(rig);
      for (const area of map.areas) {
        expect(area.x + area.w).toBeLessThanOrEqual(map.size);
        expect(area.y + area.h).toBeLessThanOrEqual(map.size);
      }
    }
  });

  it('names twins that share one rectangle, instead of listing it twice', () => {
    // Both of the biped's arms read the same pixels — paint one, paint both.
    const map = rigUvMap(mobRig('biped'));
    const shared = map.areas.filter((a) => a.bones.length > 1);
    expect(shared.length).toBeGreaterThan(0);
    expect(shared.some((a) => a.bones.includes('arm0') && a.bones.includes('arm1'))).toBe(true);
    expect(shared.every((a) => a.partLabel.startsWith('Both'))).toBe(true);

    // ...and no rectangle appears twice.
    const keys = map.areas.map((a) => `${a.x},${a.y},${a.w},${a.h},${a.face}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('groups bones into parts a kid can pick', () => {
    expect(rigUvMap(mobRig('quadruped')).parts.map((p) => p.id)).toEqual(['body', 'head', 'legs']);
    expect(rigUvMap(mobRig('biped')).parts.map((p) => p.id)).toEqual(['body', 'head', 'arms', 'legs']);
    expect(rigUvMap(mobRig('bird')).parts.map((p) => p.id)).toEqual(['body', 'head', 'legs', 'wings']);
    for (const part of rigUvMap(mobRig('bird')).parts) expect(part.areas.length).toBeGreaterThan(0);
  });

  it('knows which pixels show on the creature and which are wasted', () => {
    // Most of the sheet maps to nothing. That is the fact the editor has to
    // show, or a kid paints into the void and wonders why nothing changed.
    for (const rig of MOB_RIGS) {
      const map = rigUvMap(rig);
      expect(map.used).toHaveLength(map.size * map.size);
      const live = map.used.filter(Boolean).length;
      expect(live).toBeGreaterThan(0);
      expect(live).toBeLessThan(map.size * map.size);
      // and `used` agrees with `areaAt`, pixel for pixel
      for (let i = 0; i < map.used.length; i++) {
        const x = i % map.size;
        const y = Math.floor(i / map.size);
        expect(Boolean(areaAt(map, x, y))).toBe(map.used[i]);
      }
    }
  });

  it('describes a pixel in words, and says nothing for dead space', () => {
    const map = rigUvMap(mobRig('quadruped'));
    // The quadruped's head is an 8x8x6 box at uv 0,0: its face starts at (6,6).
    expect(describePixel(map, 8, 8)).toBe('Head — front');
    expect(describePixel(map, 63, 63)).toBeNull();
  });
});

describe('the starter skin', () => {
  it('colours in exactly what shows on the creature, and nothing else', () => {
    // It used to fill the rig's coarse bounding boxes, which painted several
    // hundred squares that map onto nothing — teaching a kid that those
    // squares were part of their creature.
    for (const rig of MOB_RIGS) {
      const map = rigUvMap(rig);
      const skin = starterMobTexture(rig);
      for (let i = 0; i < skin.pixels.length; i++) {
        expect(skin.pixels[i] === null).toBe(!map.used[i]);
      }
    }
  });

  it('shades each face differently, so you can tell which way round it is', () => {
    const rig = mobRig('quadruped');
    const map = rigUvMap(rig);
    const skin = starterMobTexture(rig);
    const colourOf = (partId: string, face: string) => {
      const area = map.areas.find((a) => a.partId === partId && a.face === face);
      if (!area) throw new Error(`no ${partId} ${face}`);
      return skin.pixels[area.y * map.size + area.x];
    };
    // A single flat colour is a beige box; lit faces are a readable creature.
    expect(colourOf('head', 'top')).not.toBe(colourOf('head', 'front'));
    expect(colourOf('head', 'front')).not.toBe(colourOf('body', 'front'));
    expect(colourOf('head', 'top')).not.toBe(colourOf('head', 'bottom'));
  });

  it('puts two eyes on the front of the head', () => {
    // So a kid never has to be told which rectangle is the face.
    const rig = mobRig('quadruped');
    const map = rigUvMap(rig);
    const skin = starterMobTexture(rig);
    const face = map.areas.find((a) => a.partId === 'head' && a.face === 'front');
    if (!face) throw new Error('no head front');

    const inFace: string[] = [];
    for (let y = face.y; y < face.y + face.h; y++) {
      for (let x = face.x; x < face.x + face.w; x++) {
        inFace.push(skin.pixels[y * map.size + x] as string);
      }
    }
    const counts = new Map<string, number>();
    for (const c of inFace) counts.set(c, (counts.get(c) ?? 0) + 1);
    const eyes = [...counts.entries()].filter(([, n]) => n === 2);
    expect(eyes).toHaveLength(1);
  });
});
