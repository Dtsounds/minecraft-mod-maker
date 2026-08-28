import { buildBehaviorManifest, buildResourceManifest } from './manifest';
import { buildItemJson, itemShortName } from './item';
import { buildRecipeJson } from './recipe';
import { textureToPng } from './texture';
import { toAddonFileName, toIdentifierSegment, toPackFolderName } from './ids';
import type { BuiltAddon, ModProject, PackFile } from './types';

const json = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;

/**
 * Turn a project into the complete in-memory file tree of a .mcaddon.
 *
 * This is the whole generator layer's entry point and it is intentionally
 * pure: project state in, list of files out. No DOM, no zip, no download —
 * which is what lets the tests assert on the exact bytes that ship.
 */
export function buildAddon(project: ModProject): BuiltAddon {
  const folder = toPackFolderName(project.name);
  const bp = `${folder}_BP`;
  const rp = `${folder}_RP`;
  const ns = toIdentifierSegment(project.namespace, 'mymod');

  const files: PackFile[] = [];
  const text = (path: string, content: string) => files.push({ path, kind: 'text', content });
  const binary = (path: string, content: Uint8Array) => files.push({ path, kind: 'binary', content });

  // --- Manifests -----------------------------------------------------------
  text(`${bp}/manifest.json`, json(buildBehaviorManifest(project)));
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
    langLines.push(`item.${identifier}=${sanitizeLangValue(item.name)}`);
  }

  // --- Resource pack texture atlas ----------------------------------------
  // item_texture.json carries no format_version — the platform version
  // guidance lists textures/*_texture.json as "(no versioning concept)".
  text(
    `${rp}/textures/item_texture.json`,
    json({
      resource_pack_name: toPackFolderName(project.name),
      texture_name: 'atlas.items',
      texture_data: textureData,
    }),
  );

  // --- Language file -------------------------------------------------------
  langLines.push(`pack.name=${sanitizeLangValue(project.name)}`);
  langLines.push(`pack.description=${sanitizeLangValue(project.description)}`);
  text(`${rp}/texts/en_US.lang`, `${langLines.join('\n')}\n`);
  text(`${rp}/texts/languages.json`, json(['en_US']));
  text(`${bp}/texts/en_US.lang`, `${langLines.join('\n')}\n`);
  text(`${bp}/texts/languages.json`, json(['en_US']));

  return { fileName: toAddonFileName(project.name), files };
}

/** .lang is line-based `key=value`; strip anything that would break a line. */
function sanitizeLangValue(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').replace(/=/g, '-').trim() || 'My Mod';
}
