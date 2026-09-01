import { describe, expect, it } from 'vitest';
import {
  isPackedTexture,
  packTexture,
  packTextures,
  unpackTexture,
  unpackTextures,
  type PackedTexture,
} from '../src/storage/textureCodec';
import { blankTexture, normalizeTexture, toHex } from '../src/bedrock/texture';
import type { Texture } from '../src/bedrock/types';

/** A texture with a bit of everything: transparency, runs, single pixels. */
function stripes(size: 16 | 32 | 64 = 16): Texture {
  const pixels = new Array<string | null>(size * size).fill(null);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (y % 3 === 0) pixels[y * size + x] = '#ff00ff';
      else if (y % 3 === 1 && x < size / 2) pixels[y * size + x] = '#00ff00';
    }
  }
  return { size, pixels };
}

function repack(texture: Texture): Texture {
  const packed = packTexture(texture);
  expect(isPackedTexture(packed)).toBe(true);
  return unpackTexture(packed as PackedTexture);
}

describe('packing a texture', () => {
  it('gets every pixel back, exactly', () => {
    const original = stripes(32);
    expect(repack(original)).toEqual(normalizeTexture(original));
  });

  it('round-trips a blank canvas and a fully painted one', () => {
    const blank = blankTexture(16);
    expect(repack(blank)).toEqual(blank);

    const solid: Texture = { size: 16, pixels: new Array(256).fill('#123456') };
    expect(repack(solid)).toEqual(solid);
  });

  it('is dramatically smaller than one entry per pixel', () => {
    const before = JSON.stringify(stripes(64), null, 2).length;
    const after = JSON.stringify(packTexture(stripes(64)), null, 2).length;
    expect(after).toBeLessThan(before / 10);
  });

  it('keeps a texture that uses too many colours rather than losing any', () => {
    // Past 52 colours the run alphabet is out of characters. A bigger file is
    // a far better outcome than a lossy one.
    const size = 16;
    const pixels = new Array<string | null>(size * size)
      .fill(null)
      .map((_, i) => (i < 60 ? toHex(i * 4, i, 255 - i) : null));
    const packed = packTexture({ size, pixels });
    expect(isPackedTexture(packed)).toBe(false);
    expect(packed).toEqual(normalizeTexture({ size, pixels }));
  });

  it('repairs a texture on the way in, so junk never reaches the file', () => {
    const packed = packTexture({ size: 16, pixels: ['not a colour', '#ABCDEF'] } as Texture);
    const back = unpackTexture(packed as PackedTexture);
    expect(back.pixels[0]).toBeNull();
    expect(back.pixels[1]).toBe('#abcdef');
    expect(back.pixels).toHaveLength(256);
  });
});

describe('unpacking anything at all', () => {
  it('leaves the rest transparent when the runs are truncated', () => {
    const back = unpackTexture({ size: 16, palette: ['#ff0000'], runs: 'A4' });
    expect(back.pixels.slice(0, 4)).toEqual(['#ff0000', '#ff0000', '#ff0000', '#ff0000']);
    expect(back.pixels.slice(4).every((p) => p === null)).toBe(true);
  });

  it('clips a run that overshoots the canvas', () => {
    const back = unpackTexture({ size: 16, palette: ['#ff0000'], runs: 'A99999' });
    expect(back.pixels).toHaveLength(256);
    expect(back.pixels.every((p) => p === '#ff0000')).toBe(true);
  });

  it('treats an unknown character or a missing palette entry as transparent', () => {
    const back = unpackTexture({ size: 16, palette: [], runs: '!!A4?B2' });
    expect(back.pixels.every((p) => p === null)).toBe(true);
  });

  it('falls back to 16x16 when the size is nonsense', () => {
    const back = unpackTexture({ size: 999, palette: ['#ff0000'], runs: 'A4' } as PackedTexture);
    expect(back.size).toBe(16);
    expect(back.pixels).toHaveLength(256);
  });

  it('survives a hand-mangled file without throwing', () => {
    for (const runs of ['', '1234', '.'.repeat(300), 'A0B-1', 'AAAAAAAA9999999999999']) {
      expect(() => unpackTexture({ size: 16, palette: ['#ff0000'], runs })).not.toThrow();
    }
  });
});

describe('walking a whole project', () => {
  it('finds textures by shape, wherever they are nested', () => {
    const tree = { a: [{ texture: stripes(16) }], b: { deep: { skin: stripes(16) } }, c: 7 };
    const packed = packTextures(tree) as typeof tree;
    expect(isPackedTexture(packed.a[0]?.texture)).toBe(true);
    expect(isPackedTexture(packed.b.deep.skin)).toBe(true);
    expect(packed.c).toBe(7);
    expect(unpackTextures(packed)).toEqual({
      a: [{ texture: normalizeTexture(stripes(16)) }],
      b: { deep: { skin: normalizeTexture(stripes(16)) } },
      c: 7,
    });
  });

  it('leaves an older file’s plain pixel arrays alone', () => {
    const old = { texture: stripes(16) };
    expect(unpackTextures(old)).toEqual(old);
  });
});
