/**
 * Diagnostic add-on, round 2.
 *
 * Round 1 established:
 *   - the behavior pack loads and items register (/give works)
 *   - food already works WITHOUT minecraft:use_animation (C, D and E were all
 *     edible), so that component was a red herring
 *   - BOTH item_texture.json key styles render invisible, so the key
 *     convention is not the problem either
 *
 * That leaves the image data itself, or the resource pack not applying.
 *
 * Prime suspect: our PNG encoder emits *stored* (uncompressed) DEFLATE
 * blocks. That is spec-valid — node's zlib inflates it, CRCs check out — but
 * effectively no real-world PNG is encoded that way, because every normal
 * encoder actually compresses. A decoder that only ever meets Huffman-coded
 * blocks can pass every test in the wild and still fail on ours.
 *
 * This pack isolates exactly that variable: two items, same pixels, same
 * texture key style, differing ONLY in how the IDAT is compressed.
 *
 *   F = our encoder            (stored / uncompressed DEFLATE)
 *   G = same pixels via zlib   (real Huffman-compressed DEFLATE)
 *
 * Also drops `texture_name` from item_texture.json, since Microsoft's own
 * examples omit it — if BOTH F and G light up, that field was the culprit.
 *
 * Reading the result:
 *   G visible, F not      -> the encoder is the bug; switch to real DEFLATE
 *   both visible          -> `texture_name` was the bug
 *   neither, icons shown  -> packs load; item texture resolution is broken
 *   neither, no icons     -> the resource pack is not applying at all
 *
 *   npx tsx scripts/make-diagnostic.mts
 */
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';
import JSZip from 'jszip';
import { encodePng } from '../src/bedrock/png';
import { uuid } from '../src/bedrock/ids';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(here, '..', 'sample-output');

const NS = 'diag';
const FOLDER = 'Diagnostic';

/** Solid 16x16 RGBA block — unmistakable when it renders. */
function solidRgba(r: number, g: number, b: number): Uint8Array {
  const rgba = new Uint8Array(16 * 16 * 4);
  for (let i = 0; i < 16 * 16; i++) {
    rgba[i * 4] = r;
    rgba[i * 4 + 1] = g;
    rgba[i * 4 + 2] = b;
    rgba[i * 4 + 3] = 255;
  }
  return rgba;
}

// ---- Known-good PNG encoder, using real zlib compression -------------------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of bytes) c = (CRC_TABLE[(c ^ b) & 0xff] as number) ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function u32(n: number): Uint8Array {
  return new Uint8Array([(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff]);
}

function cat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const body = cat([new Uint8Array([...type].map((c) => c.charCodeAt(0))), data]);
  return cat([u32(data.length), body, u32(crc32(body))]);
}

/** Identical structure to src/bedrock/png.ts, but with REAL deflate. */
function encodePngCompressed(rgba: Uint8Array, w: number, h: number): Uint8Array {
  const stride = w * 4;
  const filtered = new Uint8Array((stride + 1) * h);
  for (let y = 0; y < h; y++) {
    filtered[y * (stride + 1)] = 0;
    filtered.set(rgba.subarray(y * stride, (y + 1) * stride), y * (stride + 1) + 1);
  }
  return cat([
    new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', cat([u32(w), u32(h), new Uint8Array([8, 6, 0, 0, 0])])),
    chunk('IDAT', new Uint8Array(deflateSync(Buffer.from(filtered), { level: 9 }))),
    chunk('IEND', new Uint8Array(0)),
  ]);
}

// ---------------------------------------------------------------------------
const magenta = solidRgba(255, 0, 255);
const cyan = solidRgba(0, 255, 255);

const storedPng = encodePng(magenta, 16, 16); // our shipping encoder
const deflatePng = encodePngCompressed(cyan, 16, 16); // known-good
const iconPng = encodePngCompressed(solidRgba(255, 200, 0), 16, 16);

console.log(`F (stored)  : ${storedPng.byteLength} bytes`);
console.log(`G (deflate) : ${deflatePng.byteLength} bytes`);

const bpHeader = uuid();
const bpModule = uuid();
const rpHeader = uuid();
const rpModule = uuid();
const version = [1, 0, 0];

const manifest = (name: string, type: 'data' | 'resources', header: string, mod: string, deps?: object[]) => ({
  format_version: 2,
  header: {
    name,
    description: 'PNG encoding probe',
    uuid: header,
    version,
    min_engine_version: [1, 21, 0],
  },
  modules: [{ description: name, type, uuid: mod, version }],
  ...(deps ? { dependencies: deps } : {}),
});

const item = (id: string, displayName: string, iconKey: string) => ({
  format_version: '1.21.30',
  'minecraft:item': {
    description: { identifier: `${NS}:${id}`, menu_category: { category: 'items' } },
    components: {
      'minecraft:icon': { texture: iconKey },
      'minecraft:display_name': { value: displayName },
      'minecraft:max_stack_size': 64,
    },
  },
});

const json = (v: unknown) => `${JSON.stringify(v, null, 2)}\n`;
const zip = new JSZip();

zip.file(
  `${FOLDER}_BP/manifest.json`,
  json(manifest('Diagnostic BP', 'data', bpHeader, bpModule, [{ uuid: rpHeader, version }])),
);
zip.file(`${FOLDER}_BP/items/f_stored.json`, json(item('f_stored', 'Diag F Stored', 'f_stored')));
zip.file(`${FOLDER}_BP/items/g_deflate.json`, json(item('g_deflate', 'Diag G Deflate', 'g_deflate')));

zip.file(`${FOLDER}_RP/manifest.json`, json(manifest('Diagnostic RP', 'resources', rpHeader, rpModule)));
zip.file(`${FOLDER}_BP/pack_icon.png`, iconPng);
zip.file(`${FOLDER}_RP/pack_icon.png`, iconPng);

zip.file(`${FOLDER}_RP/textures/items/f_stored.png`, storedPng);
zip.file(`${FOLDER}_RP/textures/items/g_deflate.png`, deflatePng);

// No `texture_name` — Microsoft's own item_texture.json examples omit it.
zip.file(
  `${FOLDER}_RP/textures/item_texture.json`,
  json({
    resource_pack_name: FOLDER,
    texture_data: {
      f_stored: { textures: 'textures/items/f_stored' },
      g_deflate: { textures: 'textures/items/g_deflate' },
    },
  }),
);

zip.file(
  `${FOLDER}_RP/texts/en_US.lang`,
  [`item.${NS}:f_stored=Diag F Stored`, `item.${NS}:g_deflate=Diag G Deflate`, 'pack.name=Diagnostic', ''].join(
    '\n',
  ),
);
zip.file(`${FOLDER}_RP/texts/languages.json`, json(['en_US']));

const bytes = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
await mkdir(outDir, { recursive: true });
const outPath = resolve(outDir, 'Diagnostic.mcaddon');
await writeFile(outPath, bytes);

console.log(`\nWrote ${outPath} (${bytes.byteLength} bytes)\n`);
console.log('  /give @s diag:f_stored    -> MAGENTA if our encoder works');
console.log('  /give @s diag:g_deflate   -> CYAN    if real deflate works');
console.log('  pack icons in the pack list are ORANGE (real deflate)');
