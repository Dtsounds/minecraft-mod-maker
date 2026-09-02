import type { Texture } from '../../bedrock/types';

export type ToolId = 'pencil' | 'eraser' | 'fill' | 'eyedropper';

export interface Tool {
  id: ToolId;
  label: string;
  emoji: string;
  hint: string;
}

export const TOOLS: Tool[] = [
  { id: 'pencil', label: 'Draw', emoji: '✏️', hint: 'Paint pixels.' },
  { id: 'eraser', label: 'Erase', emoji: '🧽', hint: 'Rub pixels out.' },
  { id: 'fill', label: 'Fill', emoji: '🪣', hint: 'Flood a whole area with colour.' },
  { id: 'eyedropper', label: 'Pick', emoji: '💧', hint: 'Copy a colour you already used.' },
];

/**
 * All drawing operations are pure: texture in, new texture out. Keeping them
 * out of the component is what lets the undo stack store plain snapshots and
 * lets the tools be tested without rendering anything.
 */

export function indexOf(texture: Texture, x: number, y: number): number {
  return y * texture.size + x;
}

export function inBounds(texture: Texture, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < texture.size && y < texture.size;
}

export function getPixel(texture: Texture, x: number, y: number): string | null {
  if (!inBounds(texture, x, y)) return null;
  return texture.pixels[indexOf(texture, x, y)] ?? null;
}

/** Paint one pixel. Returns the same object when nothing changes. */
export function setPixel(texture: Texture, x: number, y: number, color: string | null): Texture {
  if (!inBounds(texture, x, y)) return texture;
  const index = indexOf(texture, x, y);
  if (texture.pixels[index] === color) return texture;
  const pixels = texture.pixels.slice();
  pixels[index] = color;
  return { size: texture.size, pixels };
}

/**
 * Paint a straight line of pixels. Pointer events arrive far slower than a
 * fast drag moves, so without interpolation a quick swipe leaves a dotted
 * trail instead of a stroke.
 */
export function drawLine(
  texture: Texture,
  from: { x: number; y: number },
  to: { x: number; y: number },
  color: string | null,
): Texture {
  let result = texture;
  let x = from.x;
  let y = from.y;
  const dx = Math.abs(to.x - x);
  const dy = -Math.abs(to.y - y);
  const sx = x < to.x ? 1 : -1;
  const sy = y < to.y ? 1 : -1;
  let error = dx + dy;

  // Bresenham. Bounded by the grid size so it can never spin.
  for (let guard = 0; guard < 4096; guard++) {
    result = setPixel(result, x, y, color);
    if (x === to.x && y === to.y) break;
    const doubled = 2 * error;
    if (doubled >= dy) {
      error += dy;
      x += sx;
    }
    if (doubled <= dx) {
      error += dx;
      y += sy;
    }
  }
  return result;
}

/** A rectangle a fill may not spill out of. */
export interface FillBounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Flood fill the contiguous region of matching colour, 4-way connected.
 *
 * `bounds` keeps the flood inside one rectangle, and a creature's skin needs
 * it. On that sheet a face is a rectangle among other rectangles, the gaps
 * between them are transparent, and transparent is a colour a fill will happily
 * cross: on a blank skin every pixel matches every other one, so a single tap
 * of the bucket painted the entire creature. Bounded, it fills the face that
 * was clicked, which is what "fill" means when you are pointing at a nose.
 */
export function floodFill(
  texture: Texture,
  x: number,
  y: number,
  color: string | null,
  bounds?: FillBounds,
): Texture {
  if (!inBounds(texture, x, y)) return texture;
  const target = getPixel(texture, x, y);
  if (target === color) return texture;

  const { size } = texture;
  const left = bounds ? Math.max(0, bounds.x) : 0;
  const top = bounds ? Math.max(0, bounds.y) : 0;
  const right = bounds ? Math.min(size - 1, bounds.x + bounds.w - 1) : size - 1;
  const bottom = bounds ? Math.min(size - 1, bounds.y + bounds.h - 1) : size - 1;
  if (x < left || x > right || y < top || y > bottom) return texture;

  const pixels = texture.pixels.slice();
  const stack: number[] = [y * size + x];
  const seen = new Uint8Array(size * size);

  while (stack.length > 0) {
    const index = stack.pop() as number;
    if (seen[index]) continue;
    seen[index] = 1;
    if ((pixels[index] ?? null) !== target) continue;
    pixels[index] = color;

    const px = index % size;
    const py = Math.floor(index / size);
    if (px > left) stack.push(index - 1);
    if (px < right) stack.push(index + 1);
    if (py > top) stack.push(index - size);
    if (py < bottom) stack.push(index + size);
  }

  return { size, pixels };
}

/** Clear every pixel. */
export function clearTexture(texture: Texture): Texture {
  return { size: texture.size, pixels: new Array(texture.size * texture.size).fill(null) };
}

/** Mirror left-to-right — the fastest way to make a symmetrical sprite. */
export function mirrorHorizontal(texture: Texture): Texture {
  const { size } = texture;
  const pixels = texture.pixels.slice();
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < Math.floor(size / 2); x++) {
      pixels[y * size + (size - 1 - x)] = texture.pixels[y * size + x] ?? null;
    }
  }
  return { size, pixels };
}
