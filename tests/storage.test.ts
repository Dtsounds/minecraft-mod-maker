import { beforeEach, describe, expect, it } from 'vitest';
import { deleteProject, listProjects, loadProject, saveProject } from '../src/storage/db';
import { createProject } from '../src/bedrock/project';

describe('IndexedDB project storage', () => {
  beforeEach(async () => {
    for (const p of await listProjects()) await deleteProject(p.id);
  });

  it('round-trips a project', async () => {
    const project = createProject('Ruby Mod', 'Shiny things');
    await saveProject(project);
    const loaded = await loadProject(project.id);
    expect(loaded?.name).toBe('Ruby Mod');
    expect(loaded?.uuids.bpHeader).toBe(project.uuids.bpHeader);
  });

  it('lists projects newest-first', async () => {
    const older = { ...createProject('Older', ''), updatedAt: 1000 };
    const newer = { ...createProject('Newer', ''), updatedAt: 2000 };
    await saveProject(older);
    await saveProject(newer);
    const all = await listProjects();
    expect(all.map((p) => p.name)).toEqual(['Newer', 'Older']);
  });

  it('returns null for a missing project rather than throwing', async () => {
    expect(await loadProject('nope')).toBeNull();
  });

  it('deletes', async () => {
    const project = createProject('Doomed', '');
    await saveProject(project);
    await deleteProject(project.id);
    expect(await loadProject(project.id)).toBeNull();
  });
});
