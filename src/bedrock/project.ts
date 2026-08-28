import { uuid, toNamespace } from './ids';
import { blankTexture, normalizeTexture } from './texture';
import { ITEM_PRESETS } from './presets';
import { normalizeGrid } from './recipe';
import type { ItemKind, ModItem, ModProject, Texture } from './types';

/** A pleasant default icon so a brand-new mod is never a blank square. */
function defaultIcon(): Texture {
  const size = 16;
  const pixels = new Array<string | null>(size * size).fill(null);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const edge = x === 0 || y === 0 || x === size - 1 || y === size - 1;
      const inner = x > 3 && x < size - 4 && y > 3 && y < size - 4;
      pixels[y * size + x] = edge ? '#2b1b45' : inner ? '#ffd447' : '#7b4bd6';
    }
  }
  return { size, pixels };
}

export function createProject(name: string, description: string): ModProject {
  const now = Date.now();
  return {
    id: uuid(),
    name: name.trim() || 'My Mod',
    description: description.trim(),
    namespace: toNamespace(name),
    icon: defaultIcon(),
    uuids: {
      bpHeader: uuid(),
      bpModule: uuid(),
      rpHeader: uuid(),
      rpModule: uuid(),
    },
    version: [1, 0, 0],
    items: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function createItem(kind: ItemKind = 'sword'): ModItem {
  return {
    id: uuid(),
    name: '',
    kind,
    texture: blankTexture(16),
    power: 5,
    durability: 250,
    digSpeed: 6,
    armorSlot: 'chest',
    protection: 5,
    nutrition: 4,
    canAlwaysEat: false,
    stackSize: 64,
    recipe: { enabled: false, grid: new Array(9).fill(null), count: 1 },
    ...{},
  };
}

/**
 * Repair anything loaded from storage. Autosaved state can predate a schema
 * change or be hand-edited; the app must still open it rather than crash.
 */
export function normalizeItem(raw: Partial<ModItem> | undefined): ModItem {
  const base = createItem();
  const kind: ItemKind = raw?.kind && raw.kind in ITEM_PRESETS ? raw.kind : 'plain';
  return {
    ...base,
    ...raw,
    id: typeof raw?.id === 'string' && raw.id ? raw.id : base.id,
    name: typeof raw?.name === 'string' ? raw.name : '',
    kind,
    texture: normalizeTexture(raw?.texture),
    armorSlot: raw?.armorSlot ?? 'chest',
    canAlwaysEat: raw?.canAlwaysEat === true,
    recipe: {
      enabled: raw?.recipe?.enabled === true,
      grid: normalizeGrid(raw?.recipe?.grid),
      count: typeof raw?.recipe?.count === 'number' ? raw.recipe.count : 1,
    },
  };
}

export function normalizeProject(raw: Partial<ModProject> | undefined): ModProject {
  const base = createProject(raw?.name ?? 'My Mod', raw?.description ?? '');
  return {
    ...base,
    ...raw,
    id: typeof raw?.id === 'string' && raw.id ? raw.id : base.id,
    name: (typeof raw?.name === 'string' && raw.name.trim()) || 'My Mod',
    description: typeof raw?.description === 'string' ? raw.description : '',
    namespace: typeof raw?.namespace === 'string' && raw.namespace ? raw.namespace : base.namespace,
    icon: normalizeTexture(raw?.icon),
    uuids: {
      bpHeader: raw?.uuids?.bpHeader ?? base.uuids.bpHeader,
      bpModule: raw?.uuids?.bpModule ?? base.uuids.bpModule,
      rpHeader: raw?.uuids?.rpHeader ?? base.uuids.rpHeader,
      rpModule: raw?.uuids?.rpModule ?? base.uuids.rpModule,
    },
    version: Array.isArray(raw?.version) && raw.version.length === 3 ? (raw.version as [number, number, number]) : [1, 0, 0],
    items: Array.isArray(raw?.items) ? raw.items.map((i) => normalizeItem(i)) : [],
    createdAt: typeof raw?.createdAt === 'number' ? raw.createdAt : base.createdAt,
    updatedAt: typeof raw?.updatedAt === 'number' ? raw.updatedAt : base.updatedAt,
  };
}

/** Bump the patch number so a re-import replaces the previous copy in-game. */
export function bumpVersion(project: ModProject): [number, number, number] {
  const [major, minor, patch] = project.version;
  return [major, minor, patch + 1];
}
