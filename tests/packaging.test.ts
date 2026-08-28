import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { buildAddon } from '../src/bedrock/pack';
import { zipAddonBytes } from '../src/bedrock/package';
import { createProject } from '../src/bedrock/project';
import { isUuid } from '../src/bedrock/ids';
import { isPng, readPngSize } from '../src/bedrock/png';
import type { ModProject } from '../src/bedrock/types';

/**
 * The Milestone 1 bar: take a project all the way to zipped bytes, unzip
 * those bytes again, and assert the result is a structurally valid add-on.
 * Nothing here trusts the in-memory objects — everything is read back out of
 * the archive, the same way Minecraft will.
 */
async function unzip(project: ModProject) {
  const bytes = await zipAddonBytes(buildAddon(project));
  const zip = await JSZip.loadAsync(bytes);
  const paths = Object.keys(zip.files).filter((p) => !zip.files[p]?.dir);
  const readJson = async (path: string) => JSON.parse((await zip.file(path)!.async('string')) as string);
  const readText = (path: string) => zip.file(path)!.async('string');
  const readBytes = (path: string) => zip.file(path)!.async('uint8array');
  return { zip, paths, readJson, readText, readBytes, bytes };
}

describe('packaging pipeline', () => {
  it('produces a non-empty zip named after the mod', async () => {
    const project = createProject("Zoe's Mod!", 'Test');
    const addon = buildAddon(project);
    expect(addon.fileName).toBe('Zoes_Mod.mcaddon');
    const bytes = await zipAddonBytes(addon);
    expect(bytes.byteLength).toBeGreaterThan(200);
    // Zip local file header magic.
    expect(Array.from(bytes.slice(0, 4))).toEqual([0x50, 0x4b, 0x03, 0x04]);
  });

  it('lays out the BP and RP folders Minecraft expects', async () => {
    const { paths } = await unzip(createProject('Ruby Mod', 'Shiny'));
    expect(paths).toContain('Ruby_Mod_BP/manifest.json');
    expect(paths).toContain('Ruby_Mod_RP/manifest.json');
    expect(paths).toContain('Ruby_Mod_RP/textures/item_texture.json');
    expect(paths).toContain('Ruby_Mod_RP/texts/en_US.lang');
    expect(paths).toContain('Ruby_Mod_BP/pack_icon.png');
    expect(paths).toContain('Ruby_Mod_RP/pack_icon.png');
  });

  it('keeps every file inside one of the two pack folders', async () => {
    const { paths } = await unzip(createProject('Ruby Mod', ''));
    for (const path of paths) {
      expect(path.startsWith('Ruby_Mod_BP/') || path.startsWith('Ruby_Mod_RP/')).toBe(true);
    }
  });

  it('round-trips manifests that are still linked after unzipping', async () => {
    const { readJson } = await unzip(createProject('Ruby Mod', 'Shiny'));
    const bp = await readJson('Ruby_Mod_BP/manifest.json');
    const rp = await readJson('Ruby_Mod_RP/manifest.json');

    expect(bp.format_version).toBe(2);
    expect(rp.format_version).toBe(2);
    expect(bp.modules[0].type).toBe('data');
    expect(rp.modules[0].type).toBe('resources');

    // The linkage that makes the two halves import as one add-on. It is
    // one-directional on purpose: a mutual dependency is a cycle Minecraft
    // rejects at import time with "missing one or more dependencies".
    expect(bp.dependencies[0].uuid).toBe(rp.header.uuid);
    expect(bp.dependencies[0].version).toEqual(rp.header.version);
    expect(rp.dependencies).toBeUndefined();

    for (const id of [bp.header.uuid, bp.modules[0].uuid, rp.header.uuid, rp.modules[0].uuid]) {
      expect(isUuid(id)).toBe(true);
    }
    expect(new Set([bp.header.uuid, bp.modules[0].uuid, rp.header.uuid, rp.modules[0].uuid]).size).toBe(4);
  });

  it('writes a valid pack_icon.png in both packs', async () => {
    const { readBytes } = await unzip(createProject('Ruby Mod', ''));
    for (const path of ['Ruby_Mod_BP/pack_icon.png', 'Ruby_Mod_RP/pack_icon.png']) {
      const png = await readBytes(path);
      expect(isPng(png)).toBe(true);
      expect(readPngSize(png)).toEqual([16, 16]);
    }
  });

  it('emits parseable JSON for every .json file in the archive', async () => {
    const { paths, readText } = await unzip(createProject('Ruby Mod', 'Shiny'));
    const jsonPaths = paths.filter((p) => p.endsWith('.json'));
    expect(jsonPaths.length).toBeGreaterThan(2);
    for (const path of jsonPaths) {
      const raw = await readText(path);
      expect(() => JSON.parse(raw), `${path} should be valid JSON`).not.toThrow();
    }
  });

  it('exports an empty mod — a mod with no items is still a valid add-on', async () => {
    const { readJson, paths } = await unzip(createProject('Empty Mod', ''));
    const atlas = await readJson('Empty_Mod_RP/textures/item_texture.json');
    expect(atlas.texture_data).toEqual({});
    expect(paths.some((p) => p.includes('/items/'))).toBe(false);
  });

  it('survives a hostile mod name without producing invalid paths', async () => {
    const project = createProject('!!! ???', '');
    const addon = buildAddon(project);
    expect(addon.fileName).toBe('MyMod.mcaddon');
    const zip = await JSZip.loadAsync(await zipAddonBytes(addon));
    for (const path of Object.keys(zip.files)) {
      expect(path).toMatch(/^[A-Za-z0-9_./]+$/);
    }
  });

  it('does not add a format_version to item_texture.json', async () => {
    // textures/*_texture.json is listed as "(no versioning concept)" in the
    // platform version guidance — adding one is a real-world import error.
    const { readJson } = await unzip(createProject('Ruby Mod', ''));
    const atlas = await readJson('Ruby_Mod_RP/textures/item_texture.json');
    expect(atlas.format_version).toBeUndefined();
    expect(atlas.resource_pack_name).toBe('Ruby_Mod');
  });
});
