/**
 * Where each part of a creature lands on its texture.
 *
 * A mob's skin is one flat square that wraps onto a pile of boxes, and until
 * now nothing said which rectangle was which: a kid painted a 64x64 grid and
 * found out what they had made by exporting it. Two thirds of that grid maps
 * to nothing at all, so a lot of careful painting simply vanished.
 *
 * None of that needs new data. We author the rigs, so every rectangle is
 * derivable — a box at `uv: [u, v]` with `size: [w, h, d]` unwraps into six
 * faces in Minecraft's fixed arrangement:
 *
 * ```
 *           (u+d, v)  (u+d+w, v)
 *           +--------+--------+                top and bottom are w x d
 *           |  top   | bottom |
 *  +--------+--------+--------+--------+       sides sit at y = v + d
 *  | right  | front  |  left  |  back  |       right/left are d x h
 *  +--------+--------+--------+--------+       front/back are w x h
 *  (u, v+d)
 * ```
 *
 * Verified against Mojang's own `bedrock-samples`: run this unwrap over
 * `geometry.pig.v1.8` and the faces tile its 64x32 sheet exactly to (64, 32)
 * with nothing off-sheet, and the same for the cow and the chicken. That is
 * the check worth keeping — a wrong face order overflows or falls short.
 *
 * The pig also settles a question a kid will ask: its four legs all share one
 * rectangle. Vanilla does that deliberately, our biped's arms and legs do it
 * too, and it means painting one limb paints its twin. That is why an area
 * knows every bone it serves rather than just one.
 */

import type { Bone, MobRig } from './mobGeometry';

export type CubeFace = 'top' | 'bottom' | 'right' | 'front' | 'left' | 'back';

/** Kid-facing name for each face. "Under" beats "bottom" when read aloud. */
const FACE_LABELS: Record<CubeFace, string> = {
  front: 'Front',
  back: 'Back',
  top: 'Top',
  bottom: 'Under',
  left: 'Left',
  right: 'Right',
};

/** One rectangle of the texture, and everything it shows up on. */
export interface UvArea {
  x: number;
  y: number;
  w: number;
  h: number;
  face: CubeFace;
  /** Every bone this rectangle paints. More than one means twins share it. */
  bones: string[];
  /** Which part group it belongs to — `head`, `body`, `legs`, `arms`, `wings`. */
  partId: string;
  /** e.g. "Head", "Both arms". */
  partLabel: string;
  /** e.g. "Front". */
  faceLabel: string;
}

/** A group of areas a kid can think about as one thing. */
export interface UvPart {
  id: string;
  label: string;
  areas: UvArea[];
}

export interface RigUvMap {
  size: number;
  areas: UvArea[];
  parts: UvPart[];
  /** `size * size`, true where a pixel actually shows on the creature. */
  used: boolean[];
}

/** The six rectangles a box unwraps to. Pure arithmetic; see the diagram. */
export function cubeFaces(
  uv: [number, number],
  size: [number, number, number],
): { face: CubeFace; x: number; y: number; w: number; h: number }[] {
  const [u, v] = uv;
  const [w, h, d] = size.map((n) => Math.max(0, Math.round(n))) as [number, number, number];
  return [
    { face: 'top', x: u + d, y: v, w, h: d },
    { face: 'bottom', x: u + d + w, y: v, w, h: d },
    { face: 'right', x: u, y: v + d, w: d, h },
    { face: 'front', x: u + d, y: v + d, w, h },
    { face: 'left', x: u + d + w, y: v + d, w: d, h },
    { face: 'back', x: u + 2 * d + w, y: v + d, w, h },
  ];
}

/** `leg0` -> `legs`. The trailing number is an index, not a different part. */
function groupOf(boneName: string): string {
  const stem = boneName.replace(/\d+$/, '');
  if (stem === 'head' || stem === 'body') return stem;
  return `${stem}s`;
}

const GROUP_LABELS: Record<string, { label: string; plural: string; emoji: string }> = {
  head: { label: 'Head', plural: 'Head', emoji: '😀' },
  body: { label: 'Body', plural: 'Body', emoji: '🫃' },
  legs: { label: 'Leg', plural: 'Legs', emoji: '🦵' },
  arms: { label: 'Arm', plural: 'Arms', emoji: '💪' },
  wings: { label: 'Wing', plural: 'Wings', emoji: '🪶' },
};

function groupLabel(group: string, shared: boolean): { one: string; many: string } {
  const spec = GROUP_LABELS[group] ?? { label: group, plural: group };
  return { one: shared ? `Both ${spec.plural.toLowerCase()}` : spec.label, many: spec.plural };
}

/**
 * Build the whole map for a rig.
 *
 * Areas are keyed by their rectangle, so two bones that share one — vanilla's
 * mirrored twins — come back as a single area naming both, rather than as two
 * areas fighting over the same pixels.
 */
export function rigUvMap(rig: MobRig): RigUvMap {
  const size = rig.textureSize;
  const byRect = new Map<string, UvArea>();
  const order: string[] = [];

  const visit = (bone: Bone) => {
    for (const cube of bone.cubes ?? []) {
      for (const f of cubeFaces(cube.uv, cube.size)) {
        if (f.w <= 0 || f.h <= 0) continue;
        const key = `${f.x},${f.y},${f.w},${f.h},${f.face}`;
        const existing = byRect.get(key);
        if (existing) {
          if (!existing.bones.includes(bone.name)) existing.bones.push(bone.name);
          continue;
        }
        const partId = groupOf(bone.name);
        byRect.set(key, {
          ...f,
          bones: [bone.name],
          partId,
          partLabel: '',
          faceLabel: FACE_LABELS[f.face],
        });
        order.push(key);
      }
    }
  };

  for (const bone of rig.bones) visit(bone);

  const areas = order.map((key) => byRect.get(key) as UvArea);
  for (const area of areas) {
    area.partLabel = groupLabel(area.partId, area.bones.length > 1).one;
  }

  const parts: UvPart[] = [];
  for (const area of areas) {
    let part = parts.find((p) => p.id === area.partId);
    if (!part) {
      const names = groupLabel(area.partId, false);
      part = { id: area.partId, label: names.many, areas: [] };
      parts.push(part);
    }
    part.areas.push(area);
  }

  const used = new Array<boolean>(size * size).fill(false);
  for (const area of areas) {
    for (let y = area.y; y < Math.min(area.y + area.h, size); y++) {
      for (let x = area.x; x < Math.min(area.x + area.w, size); x++) used[y * size + x] = true;
    }
  }

  return { size, areas, parts, used };
}

/** The area under a pixel, or null where nothing on the creature shows it. */
export function areaAt(map: RigUvMap, x: number, y: number): UvArea | null {
  for (const area of map.areas) {
    if (x >= area.x && x < area.x + area.w && y >= area.y && y < area.y + area.h) return area;
  }
  return null;
}

/** "Head — front", or null for dead space. What the kid reads while painting. */
export function describePixel(map: RigUvMap, x: number, y: number): string | null {
  const area = areaAt(map, x, y);
  return area ? `${area.partLabel} — ${area.faceLabel.toLowerCase()}` : null;
}
