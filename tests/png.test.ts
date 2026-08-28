import { describe, expect, it } from 'vitest';
import { encodePng, isPng, readPngSize } from '../src/bedrock/png';
import { blankTexture, textureToPng, textureToRgba, normalizeTexture, resizeTexture } from '../src/bedrock/texture';

describe('png encoder', () => {
  it('produces a well-formed PNG with the right dimensions', () => {
    const rgba = new Uint8Array(16 * 16 * 4).fill(200);
    const png = encodePng(rgba, 16, 16);
    expect(isPng(png)).toBe(true);
    expect(readPngSize(png)).toEqual([16, 16]);
  });

  it('emits IHDR, IDAT and IEND chunks in order', () => {
    const png = encodePng(new Uint8Array(4 * 4 * 4), 4, 4);
    const text = Array.from(png, (b) => String.fromCharCode(b)).join('');
    expect(text.indexOf('IHDR')).toBeLessThan(text.indexOf('IDAT'));
    expect(text.indexOf('IDAT')).toBeLessThan(text.indexOf('IEND'));
  });

  it('rejects a buffer of the wrong length', () => {
    expect(() => encodePng(new Uint8Array(10), 16, 16)).toThrow();
  });

  it('handles the largest supported texture (multi-block deflate path)', () => {
    const png = encodePng(new Uint8Array(64 * 64 * 4).fill(7), 64, 64);
    expect(readPngSize(png)).toEqual([64, 64]);
  });
});

describe('texture -> rgba', () => {
  it('makes unset pixels fully transparent', () => {
    const rgba = textureToRgba(blankTexture(16));
    expect(rgba.every((b) => b === 0)).toBe(true);
  });

  it('writes opaque colour for painted pixels', () => {
    const texture = blankTexture(16);
    texture.pixels[0] = '#ff0000';
    const rgba = textureToRgba(texture);
    expect(Array.from(rgba.slice(0, 4))).toEqual([255, 0, 0, 255]);
  });

  it('exports every supported size at native resolution', () => {
    for (const size of [16, 32, 64] as const) {
      expect(readPngSize(textureToPng(blankTexture(size)))).toEqual([size, size]);
    }
  });
});

describe('texture normalisation', () => {
  it('repairs corrupt stored textures instead of throwing', () => {
    const broken = { size: 999, pixels: null } as never;
    const fixed = normalizeTexture(broken);
    expect(fixed.size).toBe(16);
    expect(fixed.pixels).toHaveLength(256);
  });

  it('drops junk colour values', () => {
    const texture = { size: 16, pixels: new Array(256).fill(null) as (string | null)[] };
    texture.pixels[0] = 'not-a-colour';
    texture.pixels[1] = '#00ff00';
    const fixed = normalizeTexture(texture);
    expect(fixed.pixels[0]).toBeNull();
    expect(fixed.pixels[1]).toBe('#00ff00');
  });

  it('resizes with nearest-neighbour so pixel art stays crisp', () => {
    const source = blankTexture(16);
    source.pixels[0] = '#ff0000';
    const bigger = resizeTexture(source, 32);
    expect(bigger.size).toBe(32);
    expect(bigger.pixels[0]).toBe('#ff0000');
    expect(bigger.pixels[1]).toBe('#ff0000'); // one source pixel -> 2x2 block
  });
});
