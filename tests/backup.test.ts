import { describe, expect, it } from 'vitest';
import {
  BACKUP_EXTENSION,
  BackupError,
  backupFileName,
  parseBackup,
  requestPersistentStorage,
  serializeBackup,
} from '../src/storage/backup';
import { createItem, createMob, createProject, createRule } from '../src/bedrock/project';
import type { ModProject } from '../src/bedrock/types';

function fullProject(): ModProject {
  const p = createProject('Ruby World', 'Shiny things');
  p.items = [{ ...createItem('sword'), name: 'Ruby Sword' }];
  p.mobs = [{ ...createMob(), name: 'Glow Beast' }];
  p.rules = [{ ...createRule(), name: 'Zap' }];
  return p;
}

describe('backup files', () => {
  it('round-trips a whole mod without losing anything', () => {
    const original = fullProject();
    const restored = parseBackup(serializeBackup(original));

    expect(restored.name).toBe('Ruby World');
    expect(restored.items[0]?.name).toBe('Ruby Sword');
    expect(restored.mobs[0]?.name).toBe('Glow Beast');
    expect(restored.rules[0]?.name).toBe('Zap');
    // Identity must survive, or Minecraft treats the restored mod as a new
    // pack and stacks a duplicate alongside the original.
    expect(restored.id).toBe(original.id);
    expect(restored.uuids).toEqual(original.uuids);
  });

  it('names the file after the mod', () => {
    expect(backupFileName(createProject("Ruby's World!", ''))).toBe(`Rubys_World${BACKUP_EXTENSION}`);
  });

  it('refuses a file that is not JSON, in words a child can act on', () => {
    expect(() => parseBackup('this is not json')).toThrow(BackupError);
    expect(() => parseBackup('this is not json')).toThrow(/pick a \.modmaker\.json file/i);
  });

  it('refuses JSON with no mod in it', () => {
    expect(() => parseBackup('{"hello":"world"}')).toThrow(/doesn’t have a mod in it/i);
  });

  it('refuses a file from a newer version rather than mangling it', () => {
    const future = JSON.stringify({ format: 99, app: 'bedrock-mod-maker', project: fullProject() });
    expect(() => parseBackup(future)).toThrow(/newer version/i);
  });

  it('accepts a bare project object, not just a wrapped backup', () => {
    // Someone will eventually hand us the inner object; refusing it is pedantry.
    expect(parseBackup(JSON.stringify(fullProject())).name).toBe('Ruby World');
  });

  it('repairs a damaged mod rather than refusing to open it', () => {
    // The point of a backup is getting the work back, not being strict.
    const damaged = JSON.stringify({
      format: 1,
      project: { name: 'Half Eaten', items: [{ name: 'Thing', kind: 'nonsense' }], mobs: 'not an array' },
    });
    const restored = parseBackup(damaged);
    expect(restored.name).toBe('Half Eaten');
    expect(restored.items[0]?.kind).toBe('plain');
    expect(restored.mobs).toEqual([]);
  });

  it('produces a file a human can read', () => {
    const text = serializeBackup(fullProject());
    expect(text).toContain('\n  ');
    expect(text.endsWith('\n')).toBe(true);
    expect(JSON.parse(text).app).toBe('bedrock-mod-maker');
  });
});

describe('persistent storage', () => {
  it('never throws, whatever the browser says', async () => {
    await expect(requestPersistentStorage()).resolves.toBeTypeOf('boolean');
  });
});
