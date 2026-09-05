import { buildBehaviorManifest, buildResourceManifest, packDescription } from './manifest';
import { buildItemJson, itemShortName } from './item';
import { buildBlockJson, buildBlockLootTable, blockShortName } from './block';
import { buildRecipeJson, buildBlockRecipeJson, buildSmeltingRecipeJson } from './recipe';
import { buildClientEntityJson, buildEntityJson, buildMobLootTable, mobShortName } from './mob';
import { buildGeometryJson, mobRig } from './mobGeometry';
import { textureToPng } from './texture';
import { toAddonFileName, toIdentifierSegment, toPackFolderName } from './ids';
import { buildRuleTable } from './rules';
import { buildScriptMain } from './runtime';
import { SCRIPT_ENTRY } from './versions';
import type { BuiltAddon, ModProject, PackFile } from './types';

const json = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;

/**
 * Turn a project into the complete in-memory file tree of a .mcaddon.
 *
 * This is the whole generator layer's entry point and it is intentionally
 * pure: project state in, list of files out. No DOM, no zip, no download —
 * which is what lets the tests assert on the exact bytes that ship.
 */
export interface BuildOptions {
  /**
   * Diagnostic banner for the script runtime. Set only by `install-local`;
   * a kid's export never announces itself in chat. See `RuntimeOptions`.
   */
  banner?: string;
  /** Append the runtime self-test. install-local only. */
  selfTest?: boolean;
}

export function buildAddon(project: ModProject, options: BuildOptions = {}): BuiltAddon {
  const folder = toPackFolderName(project.name);
  const bp = `${folder}_BP`;
  const rp = `${folder}_RP`;
  const ns = toIdentifierSegment(project.namespace, 'mymod');

  const files: PackFile[] = [];
  const text = (path: string, content: string) => files.push({ path, kind: 'text', content });
  const binary = (path: string, content: Uint8Array) => files.push({ path, kind: 'binary', content });

  // Where each of the kid's creations ended up, keyed by its project-local id.
  // Populated as each registry is written so the recorded identifier is the
  // de-duplicated one that actually ships, not the name it started with.
  const itemIdentifierById = new Map<string, string>();
  const blockIdentifierById = new Map<string, string>();
  const mobIdentifierById = new Map<string, string>();

  // --- Manifests -----------------------------------------------------------
  // The behavior manifest cannot be built yet: whether it declares a script
  // module depends on whether any rule survives compilation, and that is not
  // known until every registry has its final identifiers. Reserve its slot so
  // the file ordering stays exactly as it was before rules existed.
  const bpManifestSlot = files.length;
  text(`${bp}/manifest.json`, '');
  text(`${rp}/manifest.json`, json(buildResourceManifest(project)));

  // --- Pack icons ----------------------------------------------------------
  // Both packs show this in the in-game pack list.
  const iconPng = textureToPng(project.icon);
  binary(`${bp}/pack_icon.png`, iconPng);
  binary(`${rp}/pack_icon.png`, iconPng);

  // --- Items ---------------------------------------------------------------
  const textureData: Record<string, { textures: string }> = {};
  const langLines: string[] = [];
  const usedNames = new Set<string>();

  for (const item of project.items) {
    // Two items called "Ruby Sword" would collide on one filename and one
    // identifier, silently dropping the second. Disambiguate instead.
    let shortName = itemShortName(item);
    if (usedNames.has(shortName)) {
      let n = 2;
      while (usedNames.has(`${shortName}_${n}`)) n++;
      shortName = `${shortName}_${n}`;
    }
    usedNames.add(shortName);

    const scoped = { ...item, name: item.name };
    const identifier = `${ns}:${shortName}`;
    itemIdentifierById.set(item.id, identifier);

    // Rebuild the JSON against the de-duplicated short name.
    const itemJson = buildItemJson(ns, scoped);
    itemJson['minecraft:item'].description.identifier = identifier;
    itemJson['minecraft:item'].components['minecraft:icon'] = { textures: { default: identifier } };
    text(`${bp}/items/${shortName}.json`, json(itemJson));

    const recipeJson = buildRecipeJson(ns, scoped);
    if (recipeJson) {
      const recipe = recipeJson['minecraft:recipe_shaped'];
      recipe.description.identifier = `${ns}:craft_${shortName}`;
      recipe.result.item = identifier;
      text(`${bp}/recipes/${shortName}.json`, json(recipeJson));
    }

    binary(`${rp}/textures/items/${shortName}.png`, textureToPng(item.texture));
    textureData[identifier] = { textures: `textures/items/${shortName}` };

    // Verified key shape: `item.<namespace>:<id>=Display Name` (no `.name`).
    langLines.push(`item.${identifier}=${sanitizeLangValue(item.name, 'Unnamed item')}`);
  }

  // --- Blocks --------------------------------------------------------------
  const terrainData: Record<string, { textures: string }> = {};
  const usedBlockNames = new Set<string>();

  for (const block of project.blocks ?? []) {
    let shortName = blockShortName(block);
    if (usedBlockNames.has(shortName)) {
      let n = 2;
      while (usedBlockNames.has(`${shortName}_${n}`)) n++;
      shortName = `${shortName}_${n}`;
    }
    usedBlockNames.add(shortName);

    const identifier = `${ns}:${shortName}`;
    blockIdentifierById.set(block.id, identifier);
    // Texture keys, re-derived from the de-duplicated short name.
    const side = identifier;
    const top = `${identifier}_top`;
    const bottom = `${identifier}_bottom`;

    const blockJson = buildBlockJson(ns, block);
    const blockBody = blockJson['minecraft:block'];
    blockBody.description.identifier = identifier;
    const materials = blockBody.components['minecraft:material_instances'] as Record<
      string,
      { texture: string; render_method: string }
    >;
    if (materials['*']) materials['*'].texture = side;
    if (materials['up']) materials['up'].texture = top;
    if (materials['down']) materials['down'].texture = bottom;

    const loot = buildBlockLootTable(ns, block, (itemId) => itemIdentifierById.get(itemId) ?? null);
    if (loot) {
      blockBody.components['minecraft:loot'] = `loot_tables/blocks/${shortName}.json`;
      // Re-point a "drops itself" entry at the de-duplicated identifier.
      for (const pool of loot.pools) {
        for (const entry of pool.entries) {
          if (entry.name === `${ns}:${blockShortName(block)}`) entry.name = identifier;
        }
      }
      text(`${bp}/loot_tables/blocks/${shortName}.json`, json(loot));
    } else {
      // "Drops nothing" is expressed by omitting the component entirely,
      // rather than pointing it at a loot table file that does not exist.
      delete blockBody.components['minecraft:loot'];
    }

    // Written once, after the loot decision has settled the components.
    text(`${bp}/blocks/${shortName}.json`, json(blockJson));

    const blockRecipe = buildBlockRecipeJson(ns, block);
    if (blockRecipe) {
      const r = blockRecipe['minecraft:recipe_shaped'];
      r.description.identifier = `${ns}:craft_${shortName}`;
      r.result.item = identifier;
      text(`${bp}/recipes/block_${shortName}.json`, json(blockRecipe));
    }

    const smelt = buildSmeltingRecipeJson(ns, block);
    if (smelt) {
      const r = smelt['minecraft:recipe_furnace'];
      r.description.identifier = `${ns}:smelt_${shortName}`;
      r.output = identifier;
      text(`${bp}/recipes/smelt_${shortName}.json`, json(smelt));
    }

    // Block textures live in textures/blocks and the terrain atlas, NOT the
    // item atlas — different folder, different file, different atlas name.
    binary(`${rp}/textures/blocks/${shortName}.png`, textureToPng(block.texture));
    terrainData[side] = { textures: `textures/blocks/${shortName}` };
    if (block.faceMode === 'topSideBottom') {
      binary(`${rp}/textures/blocks/${shortName}_top.png`, textureToPng(block.textureTop));
      binary(`${rp}/textures/blocks/${shortName}_bottom.png`, textureToPng(block.textureBottom));
      terrainData[top] = { textures: `textures/blocks/${shortName}_top` };
      terrainData[bottom] = { textures: `textures/blocks/${shortName}_bottom` };
    }
    // Blocks use `tile.<id>.name` — note both the `tile.` prefix and the
    // `.name` suffix, neither of which items use.
    langLines.push(`tile.${identifier}.name=${sanitizeLangValue(block.name, 'Unnamed block')}`);
  }

  // --- Mobs ----------------------------------------------------------------
  const usedMobNames = new Set<string>();

  for (const mob of project.mobs ?? []) {
    let shortName = mobShortName(mob);
    if (usedMobNames.has(shortName)) {
      let n = 2;
      while (usedMobNames.has(`${shortName}_${n}`)) n++;
      shortName = `${shortName}_${n}`;
    }
    usedMobNames.add(shortName);

    const identifier = `${ns}:${shortName}`;
    mobIdentifierById.set(mob.id, identifier);
    const rig = mobRig(mob.rig);

    const entityJson = buildEntityJson(ns, mob);
    const entityBody = entityJson['minecraft:entity'];
    entityBody.description.identifier = identifier;
    // Breeding refers to the mob's own identifier for both mate and baby.
    const breedable = entityBody.components['minecraft:breedable'] as
      | { breeds_with: { mate_type: string; baby_type: string } }
      | undefined;
    if (breedable) {
      breedable.breeds_with.mate_type = identifier;
      breedable.breeds_with.baby_type = identifier;
    }

    const loot = buildMobLootTable(mob, (itemId) => itemIdentifierById.get(itemId) ?? null);
    if (loot) {
      // Entity loot uses an OBJECT with a `table` key, unlike blocks, where
      // minecraft:loot is a bare string. Copied from vanilla chicken.json.
      entityBody.components['minecraft:loot'] = { table: `loot_tables/entities/${shortName}.json` };
      text(`${bp}/loot_tables/entities/${shortName}.json`, json(loot));
    }
    text(`${bp}/entities/${shortName}.json`, json(entityJson));

    const clientJson = buildClientEntityJson(ns, mob);
    const clientBody = clientJson['minecraft:client_entity'].description;
    clientBody.identifier = identifier;
    clientBody.textures['default'] = `textures/entity/${shortName}`;
    const geometryId = `geometry.${ns}.${shortName}`;
    clientBody.geometry['default'] = geometryId;
    text(`${rp}/entity/${shortName}.entity.json`, json(clientJson));

    // Our own rig, under our own identifier, so vanilla renaming its
    // versioned geometry cannot break a kid's mob.
    text(`${rp}/models/entity/${shortName}.geo.json`, json(buildGeometryJson(geometryId, rig)));

    binary(`${rp}/textures/entity/${shortName}.png`, textureToPng(mob.texture));

    // Entities use `entity.<id>.name`, and the spawn egg has its own key.
    const mobLabel = sanitizeLangValue(mob.name, 'Unnamed creature');
    langLines.push(`entity.${identifier}.name=${mobLabel}`);
    langLines.push(`item.spawn_egg.entity.${identifier}.name=Spawn ${mobLabel}`);
  }

  // --- Rules (Milestone 7) -------------------------------------------------
  // Compiled after every registry, so a rule always names the identifier that
  // actually shipped. Rules that cannot run — a deleted subject, an unfinished
  // action — are dropped by the compiler rather than shipped broken.
  const rules = buildRuleTable(project, {
    item: (id) => itemIdentifierById.get(id) ?? null,
    block: (id) => blockIdentifierById.get(id) ?? null,
    mob: (id) => mobIdentifierById.get(id) ?? null,
  });

  if (rules.length > 0) {
    text(`${bp}/${SCRIPT_ENTRY}`, buildScriptMain(rules, { banner: options.banner, selfTest: options.selfTest }));
  }

  // --- Resource pack texture atlases ---------------------------------------
  // These carry no format_version — the platform version guidance lists
  // textures/*_texture.json as "(no versioning concept)".
  text(
    `${rp}/textures/item_texture.json`,
    json({
      resource_pack_name: toPackFolderName(project.name),
      texture_name: 'atlas.items',
      texture_data: textureData,
    }),
  );

  if (Object.keys(terrainData).length > 0) {
    text(
      `${rp}/textures/terrain_texture.json`,
      json({
        resource_pack_name: toPackFolderName(project.name),
        texture_name: 'atlas.terrain',
        padding: 8,
        num_mip_levels: 4,
        texture_data: terrainData,
      }),
    );
  }

  // --- Language file -------------------------------------------------------
  langLines.push(`pack.name=${sanitizeLangValue(project.name, 'My Mod')}`);
  langLines.push(
    `pack.description=${sanitizeLangValue(packDescription(project), 'A mod made with Bedrock Mod Maker')}`,
  );
  text(`${rp}/texts/en_US.lang`, `${langLines.join('\n')}\n`);
  text(`${rp}/texts/languages.json`, json(['en_US']));
  text(`${bp}/texts/en_US.lang`, `${langLines.join('\n')}\n`);
  text(`${bp}/texts/languages.json`, json(['en_US']));

  // Now that the rule count is known, fill the slot reserved above. A mod with
  // no runnable rules declares no script module at all, so it stays byte-for-
  // byte what it was before Phase 4 existed.
  files[bpManifestSlot] = {
    path: `${bp}/manifest.json`,
    kind: 'text',
    content: json(buildBehaviorManifest(project, { scripts: rules.length > 0 })),
  };

  return { fileName: toAddonFileName(project.name), files };
}

/**
 * .lang is line-based `key=value`; strip anything that would break a line.
 *
 * The fallback is per-caller because this text is what the player reads. One
 * shared default meant an unnamed sword, block and creature were all called
 * "My Mod" in-game — the mod's own name, on three unrelated things.
 */
function sanitizeLangValue(value: string, fallback: string): string {
  return value.replace(/[\r\n]+/g, ' ').replace(/=/g, '-').trim() || fallback;
}
