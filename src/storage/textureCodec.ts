/**
 * Compact texture encoding for saved files.
 *
 * A texture is `size * size` entries of `#rrggbb` or null, and written
 * straight out as pretty-printed JSON that is one line per pixel: a 64x64
 * creature skin costs ~50KB even though a starter skin uses three colours.
 * Twenty mods in a Downloads folder is a real number for a kid, and every one
 * of those bytes is the string `"#c99a63",` repeated.
 *
 * So a saved texture is a palette plus a run-length string instead:
 *
 * ```json
 * { "size": 64, "palette": ["#e4ae72", "#c99a63"], "runs": ".1088A8B24A8" }
 * ```
 *
 * `.` is transparent; `A`-`Z` then `a`-`z` are palette entries 0-51; a run of
 * more than one repeats the character that many times. Pixel art is nearly all
 * runs, so this is ~25x smaller and still something a human can open and read.
 *
 * Nothing in the app's own state changes shape — the codec runs at the file
 * boundary only, so the pixel editor, the generator and every test keep the
 * plain array they already have.
 */

import type { Texture } from '../bedrock/types';
import { isTextureSize, normalizeTexture } from '../bedrock/texture';

/** Palette index -> character. Deliberately no digits: digits mean run length. */
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const TRANSPARENT = '.';

/** How the codec writes a texture into a file. */
export interface PackedTexture {
  size: number;
  palette: string[];
  runs: string;
}

/** A texture as it lives in the app: one entry per pixel. */
export function isPlainTexture(value: unknown): value is Texture {
  if (!value || typeof value !== 'object') return false;
  const v = value as Partial<Texture>;
  return typeof v.size === 'number' && Array.isArray(v.pixels);
}

/** A texture as it lives in a file. */
export function isPackedTexture(value: unknown): value is PackedTexture {
  if (!value || typeof value !== 'object') return false;
  const v = value as Partial<PackedTexture>;
  return typeof v.size === 'number' && typeof v.runs === 'string' && Array.isArray(v.palette);
}

/**
 * Pack a texture for writing.
 *
 * Returns the texture unchanged if it uses more than 52 colours — beyond the
 * alphabet, and a bigger file is a far better outcome than a lossy one. Kids
 * paint from swatches, so this is a safety net rather than a real case.
 */
export function packTexture(texture: Texture): Texture | PackedTexture {
  const safe = normalizeTexture(texture);
  const palette: string[] = [];
  const index = new Map<string, number>();

  for (const pixel of safe.pixels) {
    if (pixel === null || index.has(pixel)) continue;
    if (palette.length >= ALPHABET.length) return safe;
    index.set(pixel, palette.length);
    palette.push(pixel);
  }

  const charFor = (pixel: string | null): string =>
    pixel === null ? TRANSPARENT : (ALPHABET[index.get(pixel) as number] as string);

  let runs = '';
  let run = 0;
  for (let i = 0; i < safe.pixels.length; i++) {
    run++;
    if (safe.pixels[i + 1] === safe.pixels[i] && i + 1 < safe.pixels.length) continue;
    runs += charFor(safe.pixels[i] ?? null) + (run > 1 ? String(run) : '');
    run = 0;
  }

  return { size: safe.size, palette, runs };
}

const RUN_RE = /([.A-Za-z])(\d*)/g;

/**
 * Unpack a texture read from a file.
 *
 * Total for any input: a truncated string leaves the rest transparent, a run
 * that overshoots is clipped, an unknown character is transparent, and the
 * result goes through `normalizeTexture` regardless. A hand-edited or
 * half-written file opens with whatever survived.
 */
export function unpackTexture(packed: PackedTexture): Texture {
  const size = isTextureSize(packed.size) ? packed.size : 16;
  const palette = Array.isArray(packed.palette) ? packed.palette : [];
  const pixels = new Array<string | null>(size * size).fill(null);

  let at = 0;
  RUN_RE.lastIndex = 0;
  for (let m = RUN_RE.exec(packed.runs); m && at < pixels.length; m = RUN_RE.exec(packed.runs)) {
    const char = m[1] as string;
    const count = m[2] ? Number.parseInt(m[2], 10) : 1;
    const slot = char === TRANSPARENT ? -1 : ALPHABET.indexOf(char);
    const color = slot >= 0 ? palette[slot] : undefined;
    const end = Math.min(pixels.length, at + (Number.isFinite(count) ? count : 1));
    if (typeof color === 'string') pixels.fill(color, at, end);
    at = end;
  }

  return normalizeTexture({ size, pixels });
}

/**
 * Walk a value and pack every texture in it. Textures are found by shape
 * rather than by path, so a new kind of content that carries one is covered
 * without touching this file — the same bargain the presets make.
 */
export function packTextures(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(packTextures);
  if (isPlainTexture(value)) return packTexture(value);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, inner] of Object.entries(value)) out[key] = packTextures(inner);
    return out;
  }
  return value;
}

/** The mirror image, for reading. Leaves an older file's plain arrays alone. */
export function unpackTextures(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(unpackTextures);
  if (isPackedTexture(value)) return unpackTexture(value);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, inner] of Object.entries(value)) out[key] = unpackTextures(inner);
    return out;
  }
  return value;
}
