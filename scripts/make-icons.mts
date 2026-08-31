/**
 * Generate the PWA icons.
 *
 * Uses the app's own dependency-free PNG encoder rather than adding an image
 * library for two files. The art is a 16x16 pixel grid scaled up by whole
 * numbers, so the icon stays crisp at every size and looks like what the app
 * makes — which is the point of it.
 *
 *   npx tsx scripts/make-icons.mts
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { crc32, deflateSync } from 'node:zlib';

/**
 * A properly compressed PNG.
 *
 * The app's own `png.ts` encoder writes uncompressed deflate blocks, which is
 * the right trade for a 16x16 texture built in the browser — but it turns a
 * flat 512x512 icon into a megabyte. Here we are in Node at author time, so
 * zlib is free and the icon lands at a few KB. Same file format, different
 * cost profile, so this does not belong in the shipped encoder.
 */
function encodePng(rgba: Uint8Array, width: number, height: number): Uint8Array {
  const chunk = (type: string, data: Uint8Array): Uint8Array => {
    const out = new Uint8Array(12 + data.length);
    const view = new DataView(out.buffer);
    view.setUint32(0, data.length);
    out.set([...type].map((c) => c.charCodeAt(0)), 4);
    out.set(data, 8);
    const crcInput = out.subarray(4, 8 + data.length);
    view.setUint32(8 + data.length, crc32(crcInput) >>> 0);
    return out;
  };

  const ihdr = new Uint8Array(13);
  const ihdrView = new DataView(ihdr.buffer);
  ihdrView.setUint32(0, width);
  ihdrView.setUint32(4, height);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA

  // Each scanline is prefixed with its filter byte; 0 = none.
  const raw = new Uint8Array(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 4)] = 0;
    raw.set(rgba.subarray(y * width * 4, (y + 1) * width * 4), y * (1 + width * 4) + 1);
  }

  const parts = [
    new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', new Uint8Array(deflateSync(raw, { level: 9 }))),
    chunk('IEND', new Uint8Array(0)),
  ];

  const total = parts.reduce((n, p) => n + p.length, 0);
  const png = new Uint8Array(total);
  let at = 0;
  for (const part of parts) {
    png.set(part, at);
    at += part.length;
  }
  return png;
}

/** 16x16. '.' is transparent; letters index the palette below. */
const ART = [
  '................',
  '................',
  '...........sss..',
  '..........sshs..',
  '.........sshhs..',
  '........sshhs...',
  '..hhh..sshhs....',
  '.hhwhhsshhs.....',
  '.hwwwhhhhs......',
  '.hhwhhhhs.......',
  '..hhhwhs........',
  '...h.whs........',
  '..h..ws.........',
  '.....s..........',
  '................',
  '................',
];

const PALETTE: Record<string, [number, number, number, number]> = {
  s: [0xc6, 0xc6, 0xc6, 255], // stone edge
  h: [0x8b, 0x5a, 0x2b, 255], // handle
  w: [0xff, 0xff, 0xff, 255], // highlight
};

const BACKGROUND: [number, number, number, number] = [0x5b, 0xa1, 0x27, 255]; // grass

function render(size: number): Uint8Array {
  const scale = Math.floor(size / 16);
  const rgba = new Uint8Array(size * size * 4);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const cell = ART[Math.floor(y / scale)]?.[Math.floor(x / scale)] ?? '.';
      const colour = PALETTE[cell] ?? BACKGROUND;
      rgba[i] = colour[0];
      rgba[i + 1] = colour[1];
      rgba[i + 2] = colour[2];
      rgba[i + 3] = colour[3];
    }
  }
  return encodePng(rgba, size, size);
}

const out = join(process.cwd(), 'public');
await mkdir(out, { recursive: true });

for (const size of [192, 512]) {
  const bytes = render(size);
  await writeFile(join(out, `icon-${size}.png`), bytes);
  console.log(`  public/icon-${size}.png  ${bytes.length} bytes`);
}

console.log('done');
