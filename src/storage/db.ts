/**
 * Thin IndexedDB wrapper. One object store of projects, keyed by id.
 *
 * Deliberately tiny and dependency-free: a kid's work only ever lives on
 * their own device, so there is no sync, no migration engine, and no schema
 * beyond "a bag of projects". Every read path is defensive — a corrupt or
 * half-written record degrades to "that project didn't load", never to a
 * crash that loses the other projects too.
 */

import type { ModProject } from '../bedrock/types';
import { normalizeProject } from '../bedrock/project';

const DB_NAME = 'bedrock-mod-maker';
const DB_VERSION = 1;
const STORE = 'projects';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not available'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB'));
  });
  return dbPromise;
}

function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const request = fn(tx.objectStore(STORE));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
      }),
  );
}

export async function saveProject(project: ModProject): Promise<void> {
  // structuredClone-safe plain copy; also strips any accidental proxies.
  const plain = JSON.parse(JSON.stringify(project)) as ModProject;
  await run('readwrite', (store) => store.put(plain));
}

export async function loadProject(id: string): Promise<ModProject | null> {
  try {
    const raw = await run<ModProject | undefined>('readonly', (store) => store.get(id));
    return raw ? normalizeProject(raw) : null;
  } catch {
    return null;
  }
}

export async function listProjects(): Promise<ModProject[]> {
  try {
    const raw = await run<ModProject[]>('readonly', (store) => store.getAll());
    return (raw ?? [])
      .map((p) => {
        try {
          return normalizeProject(p);
        } catch {
          return null;
        }
      })
      .filter((p): p is ModProject => p !== null)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

export async function deleteProject(id: string): Promise<void> {
  try {
    await run('readwrite', (store) => store.delete(id));
  } catch {
    /* deleting something that isn't there is not an error worth surfacing */
  }
}

/** Test hook — drops the cached connection so a fresh DB can be opened. */
export function resetDbForTests(): void {
  dbPromise = null;
}
