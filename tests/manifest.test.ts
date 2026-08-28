import { describe, expect, it } from 'vitest';
import { buildBehaviorManifest, buildResourceManifest } from '../src/bedrock/manifest';
import { createProject } from '../src/bedrock/project';
import { isUuid } from '../src/bedrock/ids';
import { MANIFEST_FORMAT_VERSION, MIN_ENGINE_VERSION } from '../src/bedrock/versions';

const project = createProject('Ruby Mod', 'Shiny ruby things');

describe('manifest generator', () => {
  it('emits format_version 2 (the stable manifest syntax)', () => {
    expect(buildBehaviorManifest(project).format_version).toBe(MANIFEST_FORMAT_VERSION);
    expect(buildResourceManifest(project).format_version).toBe(2);
  });

  it('names the two halves distinguishably', () => {
    // Both packs appearing as the same name in their separate tabs makes it
    // impossible to see at a glance whether both are switched on, which is
    // the most common cause of invisible items.
    expect(buildBehaviorManifest(project).header.name).toBe('Ruby Mod');
    expect(buildResourceManifest(project).header.name).toBe('Ruby Mod Art');
  });

  it('includes every required header field', () => {
    for (const manifest of [buildBehaviorManifest(project), buildResourceManifest(project)]) {
      const { header } = manifest;
      expect(header.name).toBeTruthy();
      expect(header.description).toBeTruthy();
      expect(isUuid(header.uuid)).toBe(true);
      expect(header.version).toHaveLength(3);
      expect(header.min_engine_version).toEqual([...MIN_ENGINE_VERSION]);
    }
  });

  it('uses the correct module type for each pack', () => {
    expect(buildBehaviorManifest(project).modules[0]?.type).toBe('data');
    expect(buildResourceManifest(project).modules[0]?.type).toBe('resources');
  });

  it('gives the header and the module different UUIDs', () => {
    const bp = buildBehaviorManifest(project);
    const rp = buildResourceManifest(project);
    const all = [bp.header.uuid, bp.modules[0]?.uuid, rp.header.uuid, rp.modules[0]?.uuid];
    expect(new Set(all).size).toBe(4);
    for (const value of all) expect(isUuid(value)).toBe(true);
  });

  it('links BP -> RP through a top-level dependencies array', () => {
    const bp = buildBehaviorManifest(project);
    const rp = buildResourceManifest(project);
    // dependencies is a TOP-LEVEL section, not header.dependencies.
    expect(bp.dependencies?.[0]?.uuid).toBe(rp.header.uuid);
    expect(bp.dependencies?.[0]?.version).toEqual(rp.header.version);
    expect((bp.header as unknown as Record<string, unknown>).dependencies).toBeUndefined();
  });

  it('does NOT link RP -> BP', () => {
    // Regression: a mutual BP<->RP dependency is a cycle Minecraft cannot
    // resolve, and it rejects the whole .mcaddon on import with "missing one
    // or more dependencies". The link must stay one-directional.
    const rp = buildResourceManifest(project);
    expect(rp.dependencies).toBeUndefined();
  });

  it('never produces a circular dependency between the two packs', () => {
    const bp = buildBehaviorManifest(project);
    const rp = buildResourceManifest(project);
    const bpPointsAtRp = bp.dependencies?.some((d) => d.uuid === rp.header.uuid) ?? false;
    const rpPointsAtBp = rp.dependencies?.some((d) => d.uuid === bp.header.uuid) ?? false;
    expect(bpPointsAtRp).toBe(true);
    expect(rpPointsAtBp).toBe(false);
  });

  it('never emits an empty description', () => {
    const blank = createProject('X', '   ');
    expect(buildBehaviorManifest(blank).header.description.trim().length).toBeGreaterThan(0);
  });

  it('keeps UUIDs stable across repeated builds of the same project', () => {
    const a = buildBehaviorManifest(project);
    const b = buildBehaviorManifest(project);
    expect(a.header.uuid).toBe(b.header.uuid);
  });

  it('gives two different projects different UUIDs', () => {
    const other = createProject('Other Mod', '');
    expect(buildBehaviorManifest(other).header.uuid).not.toBe(buildBehaviorManifest(project).header.uuid);
  });
});
