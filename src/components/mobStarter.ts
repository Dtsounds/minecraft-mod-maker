import { blankTexture } from '../bedrock/texture';
import type { MobRig } from '../bedrock/mobGeometry';
import type { Texture } from '../bedrock/types';

/**
 * Build a starter skin for a mob rig.
 *
 * A mob's texture is one flat sheet whose regions map onto different body
 * parts, which is not something a kid can guess at from a blank canvas. This
 * blocks out each UV region in a distinct shade so the head, body and limbs
 * are visibly separate areas to paint inside.
 *
 * The regions come from the rig itself, so they cannot drift away from the
 * geometry's actual UVs.
 */
export function starterMobTexture(rig: MobRig, baseColor = '#c99a63'): Texture {
  const size = rig.textureSize;
  const texture = blankTexture(size as 16);
  const pixels = new Array<string | null>(size * size).fill(null);

  const shade = (hex: string, amount: number): string => {
    const value = parseInt(hex.replace('#', ''), 16);
    const channel = (shift: number) => {
      const c = (value >> shift) & 0xff;
      return Math.max(0, Math.min(255, Math.round(c * amount)));
    };
    return `#${[channel(16), channel(8), channel(0)]
      .map((c) => c.toString(16).padStart(2, '0'))
      .join('')}`;
  };

  const colors: Record<MobRig['uvRegions'][number]['part'], string> = {
    head: shade(baseColor, 1.15),
    body: baseColor,
    limb: shade(baseColor, 0.8),
  };

  for (const region of rig.uvRegions) {
    const fill = colors[region.part];
    for (let y = region.y; y < Math.min(region.y + region.h, size); y++) {
      for (let x = region.x; x < Math.min(region.x + region.w, size); x++) {
        pixels[y * size + x] = fill;
      }
    }
  }

  return { size: texture.size, pixels };
}
