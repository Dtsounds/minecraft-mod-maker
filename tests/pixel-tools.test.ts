import { describe, expect, it } from 'vitest';
import { blankTexture } from '../src/bedrock/texture';
import {
  clearTexture,
  drawLine,
  floodFill,
  getPixel,
  mirrorHorizontal,
  setPixel,
} from '../src/components/PixelEditor/tools';
import type { Texture } from '../src/bedrock/types';

const RED = '#ff0000';
const BLUE = '#0000ff';

function painted(size = 4, color = RED): Texture {
  const t = blankTexture(size as 16);
  return { size, pixels: t.pixels.slice(0, size * size).fill(color) };
}

describe('setPixel', () => {
  it('paints without mutating the original', () => {
    const before = blankTexture(16);
    const after = setPixel(before, 3, 4, RED);
    expect(getPixel(after, 3, 4)).toBe(RED);
    expect(getPixel(before, 3, 4)).toBeNull();
  });

  it('returns the same object when nothing changes (so undo stays clean)', () => {
    const t = setPixel(blankTexture(16), 1, 1, RED);
    expect(setPixel(t, 1, 1, RED)).toBe(t);
  });

  it('ignores out-of-bounds coordinates', () => {
    const t = blankTexture(16);
    expect(setPixel(t, -1, 0, RED)).toBe(t);
    expect(setPixel(t, 16, 0, RED)).toBe(t);
    expect(setPixel(t, 0, 99, RED)).toBe(t);
  });
});

describe('drawLine', () => {
  it('fills the gap between two far-apart pointer samples', () => {
    // Without interpolation a fast drag would leave a dotted trail.
    const t = drawLine(blankTexture(16), { x: 0, y: 0 }, { x: 5, y: 0 }, RED);
    for (let x = 0; x <= 5; x++) expect(getPixel(t, x, 0)).toBe(RED);
    expect(getPixel(t, 6, 0)).toBeNull();
  });

  it('draws diagonals', () => {
    const t = drawLine(blankTexture(16), { x: 0, y: 0 }, { x: 4, y: 4 }, RED);
    for (let i = 0; i <= 4; i++) expect(getPixel(t, i, i)).toBe(RED);
  });

  it('handles a zero-length line', () => {
    const t = drawLine(blankTexture(16), { x: 2, y: 2 }, { x: 2, y: 2 }, RED);
    expect(getPixel(t, 2, 2)).toBe(RED);
  });

  it('erases along a line when given null', () => {
    const t = drawLine(painted(4), { x: 0, y: 0 }, { x: 3, y: 0 }, null);
    for (let x = 0; x <= 3; x++) expect(getPixel(t, x, 0)).toBeNull();
    expect(getPixel(t, 0, 1)).toBe(RED);
  });
});

describe('floodFill', () => {
  it('fills a whole empty canvas from one tap', () => {
    const t = floodFill(blankTexture(16), 8, 8, RED);
    expect(t.pixels.every((p) => p === RED)).toBe(true);
  });

  it('stops at a border of a different colour', () => {
    // Draw a vertical wall down the middle of a 4x4, then fill the left half.
    let t = blankTexture(4 as 16);
    t = { size: 4, pixels: new Array(16).fill(null) };
    for (let y = 0; y < 4; y++) t = setPixel(t, 2, y, BLUE);

    const filled = floodFill(t, 0, 0, RED);
    expect(getPixel(filled, 0, 0)).toBe(RED);
    expect(getPixel(filled, 1, 3)).toBe(RED);
    expect(getPixel(filled, 2, 0)).toBe(BLUE); // the wall survives
    expect(getPixel(filled, 3, 0)).toBeNull(); // right side untouched
  });

  it('is a no-op when the target already has the fill colour', () => {
    const t = painted(4);
    expect(floodFill(t, 0, 0, RED)).toBe(t);
  });

  it('does not overflow on a full-size 64x64 canvas', () => {
    const big = blankTexture(64);
    const filled = floodFill(big, 0, 0, RED);
    expect(filled.pixels.every((p) => p === RED)).toBe(true);
  });

  it('ignores out-of-bounds taps', () => {
    const t = blankTexture(16);
    expect(floodFill(t, 99, 99, RED)).toBe(t);
  });
});

describe('clear and mirror', () => {
  it('clears every pixel', () => {
    expect(clearTexture(painted(4)).pixels.every((p) => p === null)).toBe(true);
  });

  it('mirrors the left half onto the right', () => {
    let t: Texture = { size: 4, pixels: new Array(16).fill(null) };
    t = setPixel(t, 0, 0, RED);
    t = setPixel(t, 1, 2, BLUE);
    const m = mirrorHorizontal(t);
    expect(getPixel(m, 3, 0)).toBe(RED);
    expect(getPixel(m, 2, 2)).toBe(BLUE);
    // The left half is unchanged.
    expect(getPixel(m, 0, 0)).toBe(RED);
  });
});
