import { blankTexture, parseHex, toHex } from '../bedrock/texture';
import type { MobRig } from '../bedrock/mobGeometry';
import { rigUvMap, type CubeFace } from '../bedrock/mobUv';
import type { Texture } from '../bedrock/types';

/**
 * Build a starter skin for a mob rig.
 *
 * A mob's texture is one flat sheet whose regions map onto different body
 * parts, which is not something a kid can guess at from a blank canvas.
 *
 * This used to block out the rig's coarse `uvRegions` — bounding boxes, not
 * the real faces — which painted several hundred pixels of sheet that maps
 * onto nothing, quietly teaching the kid that those squares were part of the
 * creature. It now fills the exact rectangles from `rigUvMap`, so what is
 * coloured in is precisely what shows up in the game.
 *
 * Every face gets its own shade, lit as if from above. That is what makes the
 * starter creature readable in the 3D preview from the first second: the top
 * of the head is visibly not the front of the head, so a kid can tell which
 * way round they are painting before they have painted anything.
 */

/** Relative brightness per face, as if the sun were overhead and in front. */
const FACE_LIGHT: Record<CubeFace, number> = {
  top: 1.18,
  front: 1.06,
  right: 0.94,
  left: 0.88,
  back: 0.8,
  bottom: 0.66,
};

/** And per part, so the head reads as distinct from the body it sits on. */
const PART_LIGHT: Record<string, number> = {
  head: 1.12,
  body: 1,
  arms: 0.92,
  legs: 0.84,
  wings: 0.96,
};

function shade(hex: string, amount: number): string {
  const rgb = parseHex(hex) ?? [201, 154, 99];
  return toHex(rgb[0] * amount, rgb[1] * amount, rgb[2] * amount);
}

export function starterMobTexture(rig: MobRig, baseColor = '#c99a63'): Texture {
  const map = rigUvMap(rig);
  const size = map.size;
  const texture = blankTexture(size as 16);
  const pixels = new Array<string | null>(size * size).fill(null);

  for (const area of map.areas) {
    const fill = shade(baseColor, FACE_LIGHT[area.face] * (PART_LIGHT[area.partId] ?? 1));
    for (let y = area.y; y < Math.min(area.y + area.h, size); y++) {
      for (let x = area.x; x < Math.min(area.x + area.w, size); x++) {
        pixels[y * size + x] = fill;
      }
    }
  }

  // Two eyes on the front of the head. A kid should not have to be told which
  // rectangle is the face, and a creature that is already looking back at them
  // is a much better start than a beige box.
  const face = map.areas.find((a) => a.partId === 'head' && a.face === 'front');
  if (face && face.w >= 4 && face.h >= 4) {
    const eye = shade(baseColor, 0.25);
    const row = face.y + Math.floor(face.h * 0.35);
    const left = face.x + Math.max(1, Math.floor(face.w * 0.22));
    const right = face.x + face.w - 1 - Math.max(1, Math.floor(face.w * 0.22));
    for (const x of new Set([left, right])) {
      if (x >= face.x && x < face.x + face.w && row < size) pixels[row * size + x] = eye;
    }
  }

  return { size: texture.size, pixels };
}
