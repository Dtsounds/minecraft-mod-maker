/**
 * Diagnostic add-on.
 *
 * Not part of the app — a throwaway probe that puts several competing
 * hypotheses into ONE importable pack so a single in-game look settles all of
 * them at once, instead of one guess per round trip.
 *
 * What it tests:
 *   A. item_texture.json key style — namespaced ("diag:ns_key") vs plain
 *      ("plain_key"). Both reference the SAME png, so whichever item is
 *      visible tells us which key style Minecraft actually resolves.
 *   B. minecraft:use_animation shape — documented object form {"value":"eat"}
 *      vs the shorthand string form "eat". Whichever item is edible wins.
 *   C. Whether a trivial 1-ingredient recipe crafts at all.
 *
 * Every item uses a solid, unmissable colour block so "visible" vs
 * "invisible" is unambiguous.
 *
 *   npx tsx scripts/make-diagnostic.mts
 */
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import JSZip from 'jszip';
import { encodePng } from '../src/bedrock/png';
import { uuid } from '../src/bedrock/ids';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(here, '..', 'sample-output');

const NS = 'diag';
const FOLDER = 'Diagnostic';
const ITEM_FORMAT = '1.21.30';

/** A solid 16x16 block of one colour — impossible to mistake for invisible. */
function solidPng(r: number, g: number, b: number): Uint8Array {
  const rgba = new Uint8Array(16 * 16 * 4);
  for (let i = 0; i < 16 * 16; i++) {
    rgba[i * 4] = r;
    rgba[i * 4 + 1] = g;
    rgba[i * 4 + 2] = b;
    rgba[i * 4 + 3] = 255;
  }
  return encodePng(rgba, 16, 16);
}

const bpHeader = uuid();
const bpModule = uuid();
const rpHeader = uuid();
const rpModule = uuid();
const version = [1, 0, 0];

const manifest = (name: string, type: 'data' | 'resources', header: string, mod: string, deps?: object[]) => ({
  format_version: 2,
  header: {
    name,
    description: 'Texture-key and food-component probe',
    uuid: header,
    version,
    min_engine_version: [1, 21, 0],
  },
  modules: [{ description: name, type, uuid: mod, version }],
  ...(deps ? { dependencies: deps } : {}),
});

const item = (
  id: string,
  displayName: string,
  iconKey: string,
  extra: Record<string, unknown> = {},
) => ({
  format_version: ITEM_FORMAT,
  'minecraft:item': {
    description: { identifier: `${NS}:${id}`, menu_category: { category: 'items' } },
    components: {
      'minecraft:icon': { texture: iconKey },
      'minecraft:display_name': { value: displayName },
      'minecraft:max_stack_size': 64,
      ...extra,
    },
  },
});

const FOOD_BASE = {
  'minecraft:food': { nutrition: 6, saturation_modifier: 0.6, can_always_eat: true },
  'minecraft:use_modifiers': { use_duration: 1.6, movement_modifier: 0.35 },
};

const json = (v: unknown) => `${JSON.stringify(v, null, 2)}\n`;

const zip = new JSZip();

// ---- Behavior pack ---------------------------------------------------------
zip.file(
  `${FOLDER}_BP/manifest.json`,
  json(manifest('Diagnostic BP', 'data', bpHeader, bpModule, [{ uuid: rpHeader, version }])),
);

// A. texture key style
zip.file(`${FOLDER}_BP/items/a_ns_key.json`, json(item('a_ns_key', 'Diag A Namespaced', `${NS}:ns_key`)));
zip.file(`${FOLDER}_BP/items/b_plain_key.json`, json(item('b_plain_key', 'Diag B Plain', 'plain_key')));

// B. use_animation shape. Both reference the plain key so texture style is not
// a second variable inside this test.
zip.file(
  `${FOLDER}_BP/items/c_food_object.json`,
  json(
    item('c_food_object', 'Diag C Food Object', 'plain_key', {
      ...FOOD_BASE,
      'minecraft:use_animation': { value: 'eat' },
    }),
  ),
);
zip.file(
  `${FOLDER}_BP/items/d_food_string.json`,
  json(
    item('d_food_string', 'Diag D Food String', 'plain_key', {
      ...FOOD_BASE,
      'minecraft:use_animation': 'eat',
    }),
  ),
);
// Control: food with no use_animation at all — what currently ships.
zip.file(
  `${FOLDER}_BP/items/e_food_none.json`,
  json(item('e_food_none', 'Diag E Food None', 'plain_key', { ...FOOD_BASE })),
);

// C. trivial recipe: one stick -> one B item.
zip.file(
  `${FOLDER}_BP/recipes/craft_b.json`,
  json({
    format_version: '1.20.10',
    'minecraft:recipe_shaped': {
      description: { identifier: `${NS}:craft_b` },
      tags: ['crafting_table'],
      pattern: ['A'],
      key: { A: { item: 'minecraft:stick' } },
      result: { item: `${NS}:b_plain_key`, count: 1 },
    },
  }),
);

// ---- Resource pack ---------------------------------------------------------
zip.file(`${FOLDER}_RP/manifest.json`, json(manifest('Diagnostic RP', 'resources', rpHeader, rpModule)));

const icon = solidPng(255, 0, 255);
zip.file(`${FOLDER}_BP/pack_icon.png`, icon);
zip.file(`${FOLDER}_RP/pack_icon.png`, icon);

// One PNG, registered under BOTH key styles.
zip.file(`${FOLDER}_RP/textures/items/blob.png`, solidPng(255, 0, 255));
zip.file(
  `${FOLDER}_RP/textures/item_texture.json`,
  json({
    resource_pack_name: FOLDER,
    texture_name: 'atlas.items',
    texture_data: {
      [`${NS}:ns_key`]: { textures: 'textures/items/blob' },
      plain_key: { textures: 'textures/items/blob' },
    },
  }),
);

zip.file(
  `${FOLDER}_RP/texts/en_US.lang`,
  [
    `item.${NS}:a_ns_key=Diag A Namespaced`,
    `item.${NS}:b_plain_key=Diag B Plain`,
    `item.${NS}:c_food_object=Diag C Food Object`,
    `item.${NS}:d_food_string=Diag D Food String`,
    `item.${NS}:e_food_none=Diag E Food None`,
    'pack.name=Diagnostic',
    '',
  ].join('\n'),
);
zip.file(`${FOLDER}_RP/texts/languages.json`, json(['en_US']));

const bytes = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
await mkdir(outDir, { recursive: true });
const outPath = resolve(outDir, 'Diagnostic.mcaddon');
await writeFile(outPath, bytes);

console.log(`Wrote ${outPath} (${bytes.byteLength} bytes)\n`);
console.log('In game, search creative for "diag" or run /give @s diag:a_ns_key etc.\n');
console.log('  A - NAMESPACED key   visible?  -> item_texture key may be namespaced');
console.log('  B - PLAIN key        visible?  -> item_texture key must be plain');
console.log('  C - food OBJECT anim edible?   -> use {"value":"eat"}');
console.log('  D - food STRING anim edible?   -> use "eat"');
console.log('  E - food NO anim     edible?   -> animation was not the problem');
console.log('  Craft 1 stick -> B             -> recipes work at all');
