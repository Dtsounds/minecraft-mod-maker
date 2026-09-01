/**
 * Save a mod to a file, and open one back up.
 *
 * Until now a kid's work existed in exactly one browser on exactly one
 * computer and nowhere else. Autosave is reliable — a project survives a
 * reload, a crash, a reboot — but it cannot survive "Clear browsing data",
 * a new laptop, or a school account being reset, and there was no way to put
 * a copy on a USB stick or email it to a grandparent.
 *
 * This is the cheap half of the fix. A backup is a plain `.json` file the kid
 * owns, and restoring it is the same code path as loading from storage, so a
 * file that has been hand-edited, truncated or written by an older version
 * still opens rather than crashing.
 */

import type { ModProject } from '../bedrock/types';
import { normalizeProject } from '../bedrock/project';
import { toPackFolderName } from '../bedrock/ids';
import { packTextures, unpackTextures } from './textureCodec';

/**
 * Bumped only if the shape changes in a way `normalizeProject` cannot repair.
 *
 * 2 packs textures as a palette plus a run-length string (see `textureCodec`),
 * which an older build would read as a texture with no pixels — a blank
 * canvas, silently. That is exactly the "update this one first" case below,
 * and the only reason this number moved. Format 1 files still open here.
 */
export const BACKUP_FORMAT = 2;

export interface BackupFile {
  format: number;
  app: 'bedrock-mod-maker';
  savedAt: number;
  /**
   * The project — but with every texture packed, so this is deliberately not
   * `ModProject`. `parseBackup` is the only thing that should read it, and it
   * hands the result to `unpackTextures` before anything else sees it.
   */
  project: unknown;
}

export const BACKUP_EXTENSION = '.modmaker.json';

/** Filename a kid will recognise in their Downloads folder. */
export function backupFileName(project: ModProject): string {
  return `${toPackFolderName(project.name)}${BACKUP_EXTENSION}`;
}

/** The bytes of a backup file. Pretty-printed: it is a file a human may open. */
export function serializeBackup(project: ModProject): string {
  const payload: BackupFile = {
    format: BACKUP_FORMAT,
    app: 'bedrock-mod-maker',
    savedAt: Date.now(),
    project: packTextures(project),
  };
  return `${JSON.stringify(payload, null, 2)}\n`;
}

export class BackupError extends Error {}

/**
 * Parse a backup file back into a project.
 *
 * Total for any string input: the only two outcomes are a valid project or a
 * `BackupError` carrying a sentence a child can act on. Anything structurally
 * repairable is repaired rather than rejected — the point of a backup is to
 * get the work back, not to be strict about it.
 */
export function parseBackup(text: string): ModProject {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new BackupError('That file isn’t a saved mod. Pick a .modmaker.json file.');
  }

  if (!raw || typeof raw !== 'object') {
    throw new BackupError('That file isn’t a saved mod. Pick a .modmaker.json file.');
  }

  const body = raw as Partial<BackupFile> & Partial<ModProject>;

  // Accept either a wrapped backup or a bare project — someone will eventually
  // hand us the inner object, and refusing it would be pedantry.
  const candidate =
    body.project && typeof body.project === 'object'
      ? body.project
      : 'name' in body || 'items' in body
        ? (body as unknown as ModProject)
        : null;

  if (!candidate) {
    throw new BackupError('That file doesn’t have a mod in it.');
  }

  if (typeof body.format === 'number' && body.format > BACKUP_FORMAT) {
    throw new BackupError(
      'That mod was saved by a newer version of Bedrock Mod Maker. Update this one first.',
    );
  }

  // Unpack before normalising: `normalizeProject` knows only the plain
  // one-entry-per-pixel shape, and would read a packed texture as blank.
  return normalizeProject(unpackTextures(candidate) as Partial<ModProject>);
}

/**
 * Read a picked file as text.
 *
 * `Blob.text()` is the obvious call and is missing on older Safari and iPad
 * builds — which are squarely in this app's audience — so it falls back to
 * FileReader. The packaging layer already carries the mirror image of this for
 * `Blob.arrayBuffer()`.
 */
export function readFileText(file: Blob): Promise<string> {
  if (typeof file.text === 'function') return file.text();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error('That file could not be read.'));
    reader.readAsText(file);
  });
}

/**
 * Ask the browser to keep our storage rather than evict it under disk
 * pressure. Granted automatically for an installed app; for a plain tab
 * Chrome weighs engagement. Either way it can only help, and a refusal is not
 * an error worth showing a child.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    const storage = navigator.storage;
    if (!storage || typeof storage.persist !== 'function') return false;
    if (typeof storage.persisted === 'function' && (await storage.persisted())) return true;
    return await storage.persist();
  } catch {
    return false;
  }
}
