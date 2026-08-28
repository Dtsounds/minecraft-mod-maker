/**
 * Build a real .mcaddon on disk so it can be imported into Minecraft Bedrock
 * for the on-device smoke test.
 *
 *   npx tsx scripts/make-sample.mts            (or: npm run sample)
 */
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildAddon } from '../src/bedrock/pack';
import { zipAddonBytes } from '../src/bedrock/package';
import { createProject, createItem } from '../src/bedrock/project';
import { blankTexture } from '../src/bedrock/texture';
import type { ModItem, Texture } from '../src/bedrock/types';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(here, '..', 'sample-output');

/** A simple readable sword shape so the item is visibly not a blank square. */
function swordTexture(): Texture {
  const t = blankTexture(16);
  const set = (x: number, y: number, c: string) => {
    t.pixels[y * 16 + x] = c;
  };
  for (let i = 0; i < 9; i++) set(4 + i, 10 - i, '#ff4d6d'); // blade
  for (let i = 0; i < 9; i++) set(3 + i, 10 - i, '#ffa1b4'); // highlight
  set(3, 12, '#7a4a2a');
  set(4, 11, '#7a4a2a');
  set(2, 13, '#7a4a2a');
  set(5, 13, '#c0c0c0');
  set(4, 14, '#c0c0c0');
  set(3, 13, '#c0c0c0');
  return t;
}

function gemTexture(): Texture {
  const t = blankTexture(16);
  const set = (x: number, y: number, c: string) => {
    t.pixels[y * 16 + x] = c;
  };
  for (let y = 5; y <= 10; y++) {
    for (let x = 5; x <= 10; x++) {
      const edge = y === 5 || y === 10 || x === 5 || x === 10;
      set(x, y, edge ? '#8c1d33' : '#ff4d6d');
    }
  }
  set(6, 6, '#ffd0da');
  set(7, 6, '#ffd0da');
  return t;
}

const project = createProject('Ruby Mod', 'Shiny ruby tools and gems!');

const gem: ModItem = {
  ...createItem('plain'),
  name: 'Ruby',
  texture: gemTexture(),
  stackSize: 64,
};

const sword: ModItem = {
  ...createItem('sword'),
  name: 'Ruby Sword',
  texture: swordTexture(),
  power: 9,
  durability: 900,
  recipe: {
    enabled: true,
    grid: [
      null, 'minecraft:diamond', null,
      null, 'minecraft:diamond', null,
      null, 'minecraft:stick', null,
    ],
    count: 1,
  },
};

const snack: ModItem = {
  ...createItem('food'),
  name: 'Ruby Snack',
  texture: gemTexture(),
  nutrition: 8,
  canAlwaysEat: true,
};

project.items = [gem, sword, snack];

const addon = buildAddon(project);
const bytes = await zipAddonBytes(addon);

await mkdir(outDir, { recursive: true });
const outPath = resolve(outDir, addon.fileName);
await writeFile(outPath, bytes);

console.log(`Wrote ${outPath} (${bytes.byteLength} bytes)`);
console.log('\nFiles inside:');
for (const file of addon.files) console.log(`  ${file.path}`);
