/**
 * Diagnostic add-on, round 3.
 *
 * Established so far, all from on-device testing:
 *   - behavior pack loads: items register, /give works, names correct
 *   - food works without minecraft:use_animation
 *   - our PNGs decode: a pack_icon.png from our own encoder rendered in the
 *     pack list (magenta in round 1, orange in round 2)
 *   - namespaced AND plain item_texture.json keys both render invisible
 *   - stored AND real-deflate PNGs both render invisible
 *   - fixing minecraft:icon to the non-deprecated {"textures":{"default":...}}
 *     shape did NOT make them visible
 *
 * Every one of those rules something out without telling us what is actually
 * wrong, because they all share an untested assumption: that the resource
 * pack is being applied to the world at all. Nothing so far distinguishes
 * "the RP is inactive" from "custom item textures do not resolve" — the
 * symptom is identical.
 *
 * So this pack stops testing custom items and tests the RESOURCE PACK ITSELF,
 * by overriding textures that already exist in vanilla:
 *
 *   textures/items/apple.png   -> solid MAGENTA
 *   textures/items/diamond.png -> solid CYAN
 *
 * Those need no item_texture.json entry, no icon component, no identifier and
 * no behavior pack. They rely on nothing but the resource pack being applied.
 * A magenta apple is proof the RP is live.
 *
 * Reading the result:
 *   apple magenta, custom item invisible -> RP is fine; custom item texture
 *                                           resolution is the bug
 *   apple normal                          -> the RP is not being applied, and
 *                                           every custom-item theory so far
 *                                           has been chasing a ghost
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

const bpHeader = uuid();
const bpModule = uuid();
const rpHeader = uuid();
const rpModule = uuid();
const version = [1, 0, 0];

const manifest = (name: string, type: 'data' | 'resources', header: string, mod: string, deps?: object[]) => ({
  format_version: 2,
  header: {
    name,
    description: 'Resource pack liveness probe',
    uuid: header,
    version,
    min_engine_version: [1, 26, 0],
  },
  modules: [{ description: name, type, uuid: mod, version }],
  ...(deps ? { dependencies: deps } : {}),
});

const json = (v: unknown) => `${JSON.stringify(v, null, 2)}\n`;
const zip = new JSZip();

// ---- Behavior pack: one custom item, correct modern icon shape -------------
zip.file(
  `${FOLDER}_BP/manifest.json`,
  json(manifest('Diagnostic BP', 'data', bpHeader, bpModule, [{ uuid: rpHeader, version }])),
);
const customItem = (id: string, name: string, formatVersion: string, icon: object) => ({
  format_version: formatVersion,
  'minecraft:item': {
    description: { identifier: `${NS}:${id}`, menu_category: { category: 'items' } },
    components: {
      'minecraft:icon': icon,
      'minecraft:display_name': { value: name },
      'minecraft:max_stack_size': 64,
    },
  },
});

// THE VARIABLE UNDER TEST: item format_version. The client is 1.26.45
// internally, so a 1.21.30 file is five drops behind, and minecraft:icon
// changed shape in between. P and Q differ ONLY in schema version.
zip.file(
  `${FOLDER}_BP/items/p_old_format.json`,
  json(customItem('p_old_format', 'Diag P Old 1.21.30', '1.21.30', { textures: { default: 'diag_custom' } })),
);
zip.file(
  `${FOLDER}_BP/items/q_new_format.json`,
  json(customItem('q_new_format', 'Diag Q New 1.26.40', '1.26.40', { textures: { default: 'diag_custom' } })),
);
// R pairs the OLD schema with the OLD field, which is at least self
// consistent — if R works and Q does not, the fix is to go backwards.
zip.file(
  `${FOLDER}_BP/items/r_old_both.json`,
  json(customItem('r_old_both', 'Diag R Old+texture', '1.21.30', { texture: 'diag_custom' })),
);

// ---- Resource pack ---------------------------------------------------------
zip.file(`${FOLDER}_RP/manifest.json`, json(manifest('Diagnostic RP', 'resources', rpHeader, rpModule)));
zip.file(`${FOLDER}_BP/pack_icon.png`, solid(255, 200, 0));
zip.file(`${FOLDER}_RP/pack_icon.png`, solid(255, 200, 0));

// THE KEY TEST. These overwrite vanilla textures by path alone — no
// item_texture.json entry, no identifier, no behavior pack involvement.
// If the resource pack is applied, apples turn magenta and diamonds cyan.
zip.file(`${FOLDER}_RP/textures/items/apple.png`, solid(255, 0, 255));
zip.file(`${FOLDER}_RP/textures/items/diamond.png`, solid(0, 255, 255));

// The custom item's own texture, for comparison.
zip.file(`${FOLDER}_RP/textures/items/diag_custom.png`, solid(0, 255, 0));
zip.file(
  `${FOLDER}_RP/textures/item_texture.json`,
  json({
    resource_pack_name: FOLDER,
    texture_name: 'atlas.items',
    texture_data: {
      diag_custom: { textures: 'textures/items/diag_custom' },
    },
  }),
);

zip.file(
  `${FOLDER}_RP/texts/en_US.lang`,
  [
    `item.${NS}:p_old_format=Diag P Old 1.21.30`,
    `item.${NS}:q_new_format=Diag Q New 1.26.40`,
    `item.${NS}:r_old_both=Diag R Old plus texture`,
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
console.log('Activate BOTH packs, then:');
console.log('  /give @s apple          -> MAGENTA if the resource pack is live');
console.log('  /give @s diamond        -> CYAN    if the resource pack is live');
console.log('  /give @s diag:p_old_format -> GREEN if 1.21.30 + textures.default works');
console.log('  /give @s diag:q_new_format -> GREEN if 1.26.40 + textures.default works');
console.log('  /give @s diag:r_old_both   -> GREEN if 1.21.30 + texture works');
console.log('\nIf apple/diamond look normal, the resource pack is not being applied,');
console.log('and no amount of custom-item tweaking will matter.');
