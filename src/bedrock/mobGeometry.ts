/**
 * Body shapes for custom mobs.
 *
 * Design decision worth recording. The obvious approach — and the one the
 * build prompt suggests — is to reference vanilla geometry identifiers like
 * `geometry.cow.v2` straight from our client entity. Two problems killed that:
 *
 *  1. Those identifiers are VERSIONED and churn. Vanilla's pig has moved
 *     geometry.pig.v1.8 -> geometry.pig.v3, and cow is on geometry.cow.v2.
 *     Pinning a versioned vanilla identifier is exactly the class of mistake
 *     that made every custom item invisible earlier in this project.
 *  2. Vanilla mob textures have their own UV layouts at sizes like 64x32.
 *     A kid painting on our square canvas would land pixels in meaningless
 *     places.
 *
 * So we ship our own box rigs instead. This is NOT 3D modelling: they are
 * fixed cube layouts, the kid never edits them, and there is no modelling UI.
 * What it buys is control of the UV layout (so a painted texture maps
 * predictably) and immunity from vanilla renaming things.
 *
 * Animation still comes from vanilla. `animation.quadruped.walk` was verified
 * against Mojang's own quadruped.animation.json to animate exactly the bones
 * `leg0`..`leg3` — so any rig that names its legs that way gets vanilla leg
 * movement for free, and a rig with only leg0/leg1 simply has the other two
 * ignored. That is why every rig below uses vanilla bone naming.
 */

export interface Cube {
  origin: [number, number, number];
  size: [number, number, number];
  uv: [number, number];
  mirror?: boolean;
}

export interface Bone {
  name: string;
  pivot: [number, number, number];
  parent?: string;
  cubes: Cube[];
}

/** A rectangle of the texture, so the starter image can block out regions. */
export interface UvRegion {
  x: number;
  y: number;
  w: number;
  h: number;
  /** Which body part this covers — drives the starter texture's colours. */
  part: 'head' | 'body' | 'limb';
}

export interface MobRig {
  id: 'quadruped' | 'biped' | 'bird';
  label: string;
  emoji: string;
  blurb: string;
  /** Square texture, so it round-trips through our pixel editor unchanged. */
  textureSize: 64;
  collision: { width: number; height: number };
  bones: Bone[];
  uvRegions: UvRegion[];
}

/** Cow/pig shaped: four legs, animated by animation.quadruped.walk. */
const QUADRUPED: MobRig = {
  id: 'quadruped',
  label: 'Four legs',
  emoji: '🐄',
  blurb: 'Like a cow or a pig.',
  textureSize: 64,
  collision: { width: 0.9, height: 1.3 },
  bones: [
    {
      name: 'body',
      pivot: [0, 10, 0],
      cubes: [{ origin: [-4, 6, -6], size: [8, 8, 12], uv: [0, 16] }],
    },
    {
      name: 'head',
      pivot: [0, 12, -6],
      cubes: [{ origin: [-4, 8, -12], size: [8, 8, 6], uv: [0, 0] }],
    },
    { name: 'leg0', pivot: [-2, 6, -4], cubes: [{ origin: [-4, 0, -6], size: [4, 6, 4], uv: [0, 40] }] },
    { name: 'leg1', pivot: [2, 6, -4], cubes: [{ origin: [0, 0, -6], size: [4, 6, 4], uv: [16, 40] }] },
    { name: 'leg2', pivot: [-2, 6, 4], cubes: [{ origin: [-4, 0, 2], size: [4, 6, 4], uv: [32, 40] }] },
    { name: 'leg3', pivot: [2, 6, 4], cubes: [{ origin: [0, 0, 2], size: [4, 6, 4], uv: [48, 40] }] },
  ],
  uvRegions: [
    { x: 0, y: 0, w: 28, h: 14, part: 'head' },
    { x: 0, y: 16, w: 40, h: 20, part: 'body' },
    { x: 0, y: 40, w: 64, h: 10, part: 'limb' },
  ],
};

/** Zombie/player shaped. Legs are leg0/leg1 so quadruped.walk still swings them. */
const BIPED: MobRig = {
  id: 'biped',
  label: 'Two legs',
  emoji: '🧟',
  blurb: 'Like a zombie or a person.',
  textureSize: 64,
  collision: { width: 0.6, height: 1.9 },
  bones: [
    {
      name: 'body',
      pivot: [0, 24, 0],
      cubes: [{ origin: [-4, 12, -2], size: [8, 12, 4], uv: [16, 16] }],
    },
    {
      name: 'head',
      pivot: [0, 24, 0],
      cubes: [{ origin: [-4, 24, -4], size: [8, 8, 8], uv: [0, 0] }],
    },
    {
      name: 'arm0',
      pivot: [-5, 22, 0],
      cubes: [{ origin: [-8, 12, -2], size: [4, 12, 4], uv: [40, 16] }],
    },
    {
      name: 'arm1',
      pivot: [5, 22, 0],
      cubes: [{ origin: [4, 12, -2], size: [4, 12, 4], uv: [40, 16], mirror: true }],
    },
    { name: 'leg0', pivot: [-2, 12, 0], cubes: [{ origin: [-4, 0, -2], size: [4, 12, 4], uv: [0, 16] }] },
    { name: 'leg1', pivot: [2, 12, 0], cubes: [{ origin: [0, 0, -2], size: [4, 12, 4], uv: [0, 16], mirror: true }] },
  ],
  uvRegions: [
    { x: 0, y: 0, w: 32, h: 16, part: 'head' },
    { x: 16, y: 16, w: 24, h: 20, part: 'body' },
    { x: 0, y: 16, w: 16, h: 20, part: 'limb' },
    { x: 40, y: 16, w: 16, h: 20, part: 'limb' },
  ],
};

/** Chicken shaped: small body, two legs, wings. */
const BIRD: MobRig = {
  id: 'bird',
  label: 'Bird',
  emoji: '🐔',
  blurb: 'Like a chicken.',
  textureSize: 64,
  collision: { width: 0.6, height: 0.8 },
  bones: [
    {
      name: 'body',
      pivot: [0, 10, 0],
      cubes: [{ origin: [-3, 6, -4], size: [6, 8, 6], uv: [0, 16] }],
    },
    {
      name: 'head',
      pivot: [0, 14, -4],
      cubes: [{ origin: [-2, 14, -6], size: [4, 6, 3], uv: [0, 0] }],
    },
    { name: 'leg0', pivot: [-1.5, 5, 0], cubes: [{ origin: [-3, 0, -2], size: [3, 5, 3], uv: [26, 0] }] },
    { name: 'leg1', pivot: [1.5, 5, 0], cubes: [{ origin: [0, 0, -2], size: [3, 5, 3], uv: [26, 12] }] },
    { name: 'wing0', pivot: [-3, 11, 0], cubes: [{ origin: [-4, 8, -3], size: [1, 4, 6], uv: [40, 0] }] },
    {
      name: 'wing1',
      pivot: [3, 11, 0],
      cubes: [{ origin: [3, 8, -3], size: [1, 4, 6], uv: [40, 0], mirror: true }],
    },
  ],
  uvRegions: [
    { x: 0, y: 0, w: 20, h: 12, part: 'head' },
    { x: 0, y: 16, w: 24, h: 20, part: 'body' },
    { x: 26, y: 0, w: 12, h: 22, part: 'limb' },
    { x: 40, y: 0, w: 14, h: 14, part: 'limb' },
  ],
};

export const MOB_RIGS: MobRig[] = [QUADRUPED, BIPED, BIRD];

export function mobRig(id: MobRig['id']): MobRig {
  return MOB_RIGS.find((r) => r.id === id) ?? QUADRUPED;
}

export interface GeometryJson {
  format_version: string;
  'minecraft:geometry': {
    description: {
      identifier: string;
      texture_width: number;
      texture_height: number;
      visible_bounds_width: number;
      visible_bounds_height: number;
      visible_bounds_offset: [number, number, number];
    };
    bones: Bone[];
  }[];
}

/**
 * Build the geometry file for a rig.
 *
 * `format_version` 1.12.0 is the minimum for the array-style
 * `minecraft:geometry` layout, per the platform version guidance table which
 * lists Models at a minimum of 1.12.0.
 */
export function buildGeometryJson(identifier: string, rig: MobRig): GeometryJson {
  return {
    format_version: '1.12.0',
    'minecraft:geometry': [
      {
        description: {
          identifier,
          texture_width: rig.textureSize,
          texture_height: rig.textureSize,
          visible_bounds_width: 3,
          visible_bounds_height: 2.5,
          visible_bounds_offset: [0, 1, 0],
        },
        bones: rig.bones,
      },
    ],
  };
}
