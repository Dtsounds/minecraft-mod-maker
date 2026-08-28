/**
 * Minimal PNG encoder (8-bit RGBA, non-interlaced).
 *
 * Why not canvas.toBlob? Because the generator layer has to run in Node under
 * vitest as well as in the browser, and toBlob is async, environment-specific
 * and non-deterministic across platforms. Encoding here keeps texture bytes
 * byte-identical between the tests and the real download, which is exactly
 * the property we want when the correctness bar is "Minecraft must import it".
 *
 * Compression uses stored (uncompressed) DEFLATE blocks. That is a fully
 * conformant zlib stream, and a 64x64 RGBA texture is ~16 KB — irrelevant
 * inside a zip that gets deflated again on the way out.
 */

const PNG_SIGNATURE = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    c = (CRC_TABLE[(c ^ (bytes[i] as number)) & 0xff] as number) ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function adler32(bytes: Uint8Array): number {
  let a = 1;
  let b = 0;
  for (let i = 0; i < bytes.length; i++) {
    a = (a + (bytes[i] as number)) % 65521;
    b = (b + a) % 65521;
  }
  return ((b << 16) | a) >>> 0;
}

function u32be(value: number): Uint8Array {
  return new Uint8Array([(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff]);
}

function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const typeBytes = new Uint8Array([...type].map((ch) => ch.charCodeAt(0)));
  const body = concat([typeBytes, data]);
  return concat([u32be(data.length), body, u32be(crc32(body))]);
}

/** Wrap raw bytes in a zlib stream built from stored DEFLATE blocks. */
function zlibStored(raw: Uint8Array): Uint8Array {
  const parts: Uint8Array[] = [new Uint8Array([0x78, 0x01])];
  const MAX = 0xffff;
  if (raw.length === 0) {
    parts.push(new Uint8Array([0x01, 0x00, 0x00, 0xff, 0xff]));
  }
  for (let offset = 0; offset < raw.length; offset += MAX) {
    const slice = raw.subarray(offset, Math.min(offset + MAX, raw.length));
    const isLast = offset + MAX >= raw.length ? 1 : 0;
    parts.push(
      new Uint8Array([
        isLast,
        slice.length & 0xff,
        (slice.length >>> 8) & 0xff,
        ~slice.length & 0xff,
        (~slice.length >>> 8) & 0xff,
      ]),
    );
    parts.push(slice);
  }
  parts.push(u32be(adler32(raw)));
  return concat(parts);
}

/**
 * Encode an RGBA buffer as a PNG.
 * @param rgba `width * height * 4` bytes, row-major, non-premultiplied.
 */
export function encodePng(rgba: Uint8Array, width: number, height: number): Uint8Array {
  if (rgba.length !== width * height * 4) {
    throw new Error(`encodePng: expected ${width * height * 4} bytes, got ${rgba.length}`);
  }

  // Prefix every scanline with filter type 0 (None).
  const stride = width * 4;
  const filtered = new Uint8Array((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    filtered[y * (stride + 1)] = 0;
    filtered.set(rgba.subarray(y * stride, (y + 1) * stride), y * (stride + 1) + 1);
  }

  const ihdr = concat([
    u32be(width),
    u32be(height),
    new Uint8Array([8, 6, 0, 0, 0]), // bit depth 8, colour type 6 (RGBA), no interlace
  ]);

  return concat([
    PNG_SIGNATURE,
    chunk('IHDR', ihdr),
    chunk('IDAT', zlibStored(filtered)),
    chunk('IEND', new Uint8Array(0)),
  ]);
}

/** True if the buffer starts with the PNG magic number. */
export function isPng(bytes: Uint8Array): boolean {
  if (bytes.length < 8) return false;
  return PNG_SIGNATURE.every((b, i) => bytes[i] === b);
}

/** Read `[width, height]` out of a PNG's IHDR. Used by tests. */
export function readPngSize(bytes: Uint8Array): [number, number] {
  if (!isPng(bytes)) throw new Error('not a PNG');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return [view.getUint32(16), view.getUint32(20)];
}
