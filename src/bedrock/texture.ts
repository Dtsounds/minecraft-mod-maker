import type { Texture } from './types';
import { encodePng } from './png';

export const TEXTURE_SIZES = [16, 32, 64] as const;
export type TextureSize = (typeof TEXTURE_SIZES)[number];

export function isTextureSize(n: number): n is TextureSize {
  return (TEXTURE_SIZES as readonly number[]).includes(n);
}

/** A fully transparent canvas of the given size. */
export function blankTexture(size: TextureSize = 16): Texture {
  return { size, pixels: new Array(size * size).fill(null) };
}

const HEX_RE = /^#?([0-9a-f]{6})$/i;

/** Parse `#rrggbb` to `[r, g, b]`. Returns null for anything unparseable. */
export function parseHex(hex: string): [number, number, number] | null {
  const match = HEX_RE.exec(hex.trim());
  if (!match) return null;
  const value = parseInt(match[1] as string, 16);
  return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
}

export function toHex(r: number, g: number, b: number): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  return `#${[clamp(r), clamp(g), clamp(b)].map((n) => n.toString(16).padStart(2, '0')).join('')}`;
}

/**
 * Repair a texture that came from storage or an older version of the app.
 * Anything wrong — bad size, wrong pixel count, junk colour strings — is
 * fixed rather than thrown, because a corrupt autosave must never stop a kid
 * from exporting.
 */
export function normalizeTexture(texture: Texture | undefined | null): Texture {
  if (!texture || !isTextureSize(texture.size)) return blankTexture(16);
  const { size } = texture;
  const pixels = new Array<string | null>(size * size).fill(null);
  const source = Array.isArray(texture.pixels) ? texture.pixels : [];
  for (let i = 0; i < pixels.length; i++) {
    const value = source[i];
    if (typeof value === 'string' && parseHex(value)) {
      pixels[i] = value.startsWith('#') ? value.toLowerCase() : `#${value.toLowerCase()}`;
    }
  }
  return { size, pixels };
}

/** Convert a texture to raw RGBA bytes (transparent where the pixel is null). */
export function textureToRgba(texture: Texture): Uint8Array {
  const { size, pixels } = texture;
  const out = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    const rgb = pixels[i] ? parseHex(pixels[i] as string) : null;
    if (!rgb) continue; // leave as 0,0,0,0
    out[i * 4] = rgb[0];
    out[i * 4 + 1] = rgb[1];
    out[i * 4 + 2] = rgb[2];
    out[i * 4 + 3] = 255;
  }
  return out;
}

/** Encode a texture as a transparent PNG at its native pixel size. */
export function textureToPng(texture: Texture): Uint8Array {
  const safe = normalizeTexture(texture);
  return encodePng(textureToRgba(safe), safe.size, safe.size);
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/**
 * Base64, by hand.
 *
 * `btoa` exists in browsers and `Buffer` in Node, and reaching for either
 * would make this file behave differently in a test than it does for a kid.
 * `png.ts` already pays this price for the same reason.
 */
function toBase64(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i] as number;
    const b = bytes[i + 1];
    const c = bytes[i + 2];
    const n = (a << 16) | ((b ?? 0) << 8) | (c ?? 0);
    out += B64[(n >> 18) & 63] as string;
    out += B64[(n >> 12) & 63] as string;
    out += b === undefined ? '=' : (B64[(n >> 6) & 63] as string);
    out += c === undefined ? '=' : (B64[n & 63] as string);
  }
  return out;
}

/** The texture as a `data:` URL, for anything that wants it as an image. */
export function textureToDataUrl(texture: Texture): string {
  return `data:image/png;base64,${toBase64(textureToPng(texture))}`;
}

/** True if every pixel is transparent — used to warn before exporting. */
export function isTextureEmpty(texture: Texture): boolean {
  return normalizeTexture(texture).pixels.every((p) => p === null);
}

/** Resize by nearest-neighbour, so scaling up stays crisp pixel art. */
export function resizeTexture(texture: Texture, size: TextureSize): Texture {
  const source = normalizeTexture(texture);
  if (source.size === size) return source;
  const pixels = new Array<string | null>(size * size).fill(null);
  for (let y = 0; y < size; y++) {
    const sy = Math.floor((y * source.size) / size);
    for (let x = 0; x < size; x++) {
      const sx = Math.floor((x * source.size) / size);
      pixels[y * size + x] = source.pixels[sy * source.size + sx] ?? null;
    }
  }
  return { size, pixels };
}
