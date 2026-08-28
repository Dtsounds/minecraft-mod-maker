/**
 * Diagnostic add-on, round 6.
 *
 * Ground truth pulled from Mojang/bedrock-samples (the actual shipping vanilla
 * packs) rather than the docs, which have now been misleading three times:
 *
 *   behavior_pack/items/apple.json
 *     format_version "1.26.30"
 *     "minecraft:icon": { "textures": { "default": "apple" } }
 *
 *   resource_pack/textures/item_texture.json
 *     { "resource_pack_name": "vanilla",
 *       "texture_name": "atlas.items",
 *       "texture_data": { "apple": { "textures": "textures/items/apple" } } }
 *
 *   resource_pack/ has NO items/ directory — custom items need no client-side
 *   definition.
 *
 * Our generated files now match all of that exactly, so the shape is right and
 * the remaining question is narrower: are OUR item_texture.json entries being
 * registered at all?
 *
 * Round 4 gave us the lever. Overriding textures/items/apple.png turned apples
 * magenta, which proves two things at once: our PNGs load, and VANILLA's
 * item_texture.json is still live (the "apple" key still resolves, or the
 * override would have had nothing to attach to).
 *
 * So this round points a custom item at a texture key we did not define:
 *
 *   S -> icon key "apple"          a key only VANILLA registers
 *   T -> icon key "diag6_custom"   a key only WE register
 *
 * S and T are otherwise identical. That splits the last ambiguity:
 *
 *   S magenta, T blank -> icon->key lookup works; our item_texture.json
 *                         entries are not being merged in
 *   both blank         -> the icon component is not resolving at all, even
 *                         against a known-good vanilla key
 *   both coloured      -> it all works, and the earlier failures were the
 *                         duplicate-pack mess
 *
 * Reuses DIAG5's UUIDs on purpose so this REPLACES it instead of adding yet
 * another pack.
 */
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import JSZip from 'jszip';
import { encodePng } from '../src/bedrock/png';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(here, '..', 'sample-output');

const ROUND = 6;
const NS = `diag${ROUND}`;
const FOLDER = `DIAG${ROUND}`;

function solid(r: number, g: number, b: number): Uint8Array {
  const rgba = new Uint8Array(16 * 16 * 4);
  for (let i = 0; i < 16 * 16; i++) {
    rgba[i * 4] = r;
    rgba[i * 4 + 1] = g;
    rgba[i * 4 + 2] = b;
    rgba[i * 4 + 3] = 255;
  }
  return encodePng(rgba, 16, 16);
}

// Same UUIDs as DIAG5, so this updates that pack in place.
const bpHeader = 'd393e012-0898-440d-ba05-3d4b2a44424d';
const bpModule = 'ae1bed17-112a-4060-ae5a-c3aca94252e7';
const rpHeader = '55ddb07f-7728-4059-95e3-d0fee5f760a5';
const rpModule = '519d172f-6e3b-4f56-ba20-9bdd9ab1bcb2';
const version = [1, 0, 6];

const manifest = (name: string, type: 'data' | 'resources', header: string, mod: string, deps?: object[]) => ({
  format_version: 2,
  header: {
    name,
    description: 'Texture key registration probe',
    uuid: header,
    version,
    min_engine_version: [1, 26, 0],
  },
  modules: [{ description: name, type, uuid: mod, version }],
  ...(deps ? { dependencies: deps } : {}),
});

/** Shaped exactly like Mojang's apple.json. */
const item = (id: string, name: string, iconKey: string) => ({
  format_version: '1.26.30',
  'minecraft:item': {
    description: { identifier: `${NS}:${id}`, menu_category: { category: 'items' } },
    components: {
      'minecraft:display_name': { value: name },
      'minecraft:icon': { textures: { default: iconKey } },
      'minecraft:max_stack_size': 64,
    },
  },
});

const json = (v: unknown) => `${JSON.stringify(v, null, 2)}\n`;
const zip = new JSZip();

zip.file(
  `${FOLDER}_BP/manifest.json`,
  json(manifest(`DIAG${ROUND} Behavior`, 'data', bpHeader, bpModule, [{ uuid: rpHeader, version }])),
);

// S borrows a texture key that ONLY vanilla registers.
zip.file(`${FOLDER}_BP/items/s_vanilla_key.json`, json(item('s_vanilla_key', `D${ROUND} S VanillaKey`, 'apple')));
// T uses a key that ONLY we register.
zip.file(`${FOLDER}_BP/items/t_our_key.json`, json(item('t_our_key', `D${ROUND} T OurKey`, `${NS}_custom`)));

zip.file(`${FOLDER}_RP/manifest.json`, json(manifest(`DIAG${ROUND} Art`, 'resources', rpHeader, rpModule)));
zip.file(`${FOLDER}_BP/pack_icon.png`, solid(255, 200, 0));
zip.file(`${FOLDER}_RP/pack_icon.png`, solid(255, 200, 0));

// Control: proves the resource pack is live and our PNGs load.
zip.file(`${FOLDER}_RP/textures/items/apple.png`, solid(255, 0, 255));
// T's texture.
zip.file(`${FOLDER}_RP/textures/items/${NS}_custom.png`, solid(0, 255, 0));

zip.file(
  `${FOLDER}_RP/textures/item_texture.json`,
  json({
    resource_pack_name: FOLDER,
    texture_name: 'atlas.items',
    texture_data: {
      [`${NS}_custom`]: { textures: `textures/items/${NS}_custom` },
    },
  }),
);

zip.file(
  `${FOLDER}_RP/texts/en_US.lang`,
  [
    `item.${NS}:s_vanilla_key=D${ROUND} S VanillaKey`,
    `item.${NS}:t_our_key=D${ROUND} T OurKey`,
    `pack.name=DIAG${ROUND}`,
    '',
  ].join('\n'),
);
zip.file(`${FOLDER}_RP/texts/languages.json`, json(['en_US']));

const bytes = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
await mkdir(outDir, { recursive: true });
const outPath = resolve(outDir, 'Diagnostic.mcaddon');
await writeFile(outPath, bytes);

console.log(`Wrote ${outPath} (${bytes.byteLength} bytes)\n`);
console.log(`  /give @s ${NS}:s_vanilla_key  -> MAGENTA if icon->key lookup works at all`);
console.log(`  /give @s ${NS}:t_our_key      -> GREEN   if OUR texture keys register`);
console.log('  /give @s apple                -> MAGENTA (control: resource pack is live)');
