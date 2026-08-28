/**
 * Identifier hygiene. Bedrock requires lowercase, underscore-separated,
 * namespaced identifiers. A kid types "Ruby Sword!!" and we must still emit
 * something Minecraft accepts — so every one of these functions is total:
 * it returns a valid result for any input string, including empty.
 */

const MAX_SEGMENT = 48;

/** Collapse arbitrary text into a safe `[a-z0-9_]+` identifier segment. */
export function toIdentifierSegment(input: string, fallback = 'thing'): string {
  const cleaned = input
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_{2,}/g, '_')
    .slice(0, MAX_SEGMENT)
    .replace(/_+$/g, '');

  if (cleaned.length === 0) return fallback;
  // Identifiers may not start with a digit in practice; prefix if needed.
  return /^[0-9]/.test(cleaned) ? `x_${cleaned}`.slice(0, MAX_SEGMENT) : cleaned;
}

/** A mod's namespace, derived from its name. */
export function toNamespace(modName: string): string {
  return toIdentifierSegment(modName, 'mymod');
}

/** Full namespaced identifier, e.g. `rubymod:ruby_sword`. */
export function toIdentifier(namespace: string, name: string, fallback = 'thing'): string {
  return `${toIdentifierSegment(namespace, 'mymod')}:${toIdentifierSegment(name, fallback)}`;
}

/**
 * Folder-safe pack name, e.g. "Ruby's Mod!" -> "Rubys_Mod". Used for the
 * `<Name>_BP` / `<Name>_RP` directories inside the .mcaddon.
 */
export function toPackFolderName(modName: string): string {
  const cleaned = modName
    .replace(/['’]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_{2,}/g, '_')
    .slice(0, MAX_SEGMENT)
    .replace(/_+$/g, '');
  return cleaned.length > 0 ? cleaned : 'MyMod';
}

/** Filename for the downloaded add-on. */
export function toAddonFileName(modName: string): string {
  return `${toPackFolderName(modName)}.mcaddon`;
}

/**
 * RFC 4122 v4 UUID. Uses crypto.randomUUID where available (all target
 * browsers and Node 24) and falls back to getRandomValues.
 */
export function uuid(): string {
  const c: Crypto | undefined = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();

  const bytes = new Uint8Array(16);
  if (c && typeof c.getRandomValues === 'function') {
    c.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = ((bytes[6] as number) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] as number) & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

/** Clamp a number into a range, coercing NaN/undefined to the minimum. */
export function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.round(value)));
}

export function clampFloat(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}
