/**
 * Install generated packs straight into Minecraft's development pack folders.
 *
 * Why this exists: the import-and-report loop was costing a round trip per
 * hypothesis AND silently testing stale packs, because every .mcaddon import
 * landed as a NEW pack while the world kept the previously activated one. The
 * world under test was still loading a build from hours earlier.
 *
 * development_behavior_packs / development_resource_packs are read directly
 * off disk by Minecraft. Packs there:
 *   - need no .mcaddon import at all
 *   - appear in the world's pack list automatically
 *   - are overwritten in place here, so no duplicates can accumulate
 *   - pick up changes on the next world load
 *
 * So the loop becomes: run this, reload the world, look. One activation ever.
 *
 *   npx tsx scripts/install-local.mts
 */
import { mkdir, rm, writeFile, readFile, readdir, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { existsSync } from 'node:fs';
import { buildAddon } from '../src/bedrock/pack';
import { createProject, createItem } from '../src/bedrock/project';
import { blankTexture } from '../src/bedrock/texture';
import type { BuiltAddon, ModItem, Texture } from '../src/bedrock/types';

/**
 * Find com.mojang. There are several possible homes and only one is live:
 *  - the standalone Bedrock launcher (AppData/Roaming/Minecraft Bedrock/Users/<id>)
 *  - the Microsoft Store UWP build
 *  - the Preview build
 */
async function findMojangRoots(): Promise<string[]> {
  const home = homedir();
  const roots: string[] = [];

  const launcherUsers = join(home, 'AppData', 'Roaming', 'Minecraft Bedrock', 'Users');
  if (existsSync(launcherUsers)) {
    for (const entry of await readdir(launcherUsers)) {
      const candidate = join(launcherUsers, entry, 'games', 'com.mojang');
      if (existsSync(candidate)) roots.push(candidate);
    }
  }

  for (const pkg of ['Microsoft.MinecraftUWP_8wekyb3d8bbwe', 'Microsoft.MinecraftWindowsBeta_8wekyb3d8bbwe']) {
    const candidate = join(home, 'AppData', 'Local', 'Packages', pkg, 'LocalState', 'games', 'com.mojang');
    if (existsSync(candidate)) roots.push(candidate);
  }
  return roots;
}

/** Pick the root that has actually been used most recently. */
async function pickLiveRoot(roots: string[]): Promise<string | null> {
  let best: { path: string; mtime: number } | null = null;
  for (const root of roots) {
    const worlds = join(root, 'minecraftWorlds');
    if (!existsSync(worlds)) continue;
    let newest = 0;
    for (const entry of await readdir(worlds)) {
      try {
        const s = await stat(join(worlds, entry));
        newest = Math.max(newest, s.mtimeMs);
      } catch {
        /* skip unreadable world */
      }
    }
    if (!best || newest > best.mtime) best = { path: root, mtime: newest };
  }
  return best?.path ?? roots[0] ?? null;
}

/** Write a built add-on into the development pack folders. */
async function install(root: string, addon: BuiltAddon): Promise<void> {
  const bpRoot = join(root, 'development_behavior_packs');
  const rpRoot = join(root, 'development_resource_packs');

  // Group by the pack folder each file belongs to.
  const byTop = new Map<string, typeof addon.files>();
  for (const file of addon.files) {
    const top = file.path.split('/')[0] as string;
    if (!byTop.has(top)) byTop.set(top, []);
    (byTop.get(top) as typeof addon.files).push(file);
  }

  for (const [top, files] of byTop) {
    const isBehavior = top.endsWith('_BP');
    const dest = join(isBehavior ? bpRoot : rpRoot, top);

    // Replace wholesale so a removed file never lingers from a previous run.
    await rm(dest, { recursive: true, force: true });
    await mkdir(dest, { recursive: true });

    for (const file of files) {
      const rel = file.path.slice(top.length + 1);
      const target = join(dest, rel);
      await mkdir(dirname(target), { recursive: true });
      if (file.kind === 'text') await writeFile(target, file.content, 'utf8');
      else await writeFile(target, file.content);
    }
    console.log(`  installed ${files.length.toString().padStart(2)} files -> ${dest}`);
  }
}

// --- The test mod ------------------------------------------------------------

function solidTexture(hex: string): Texture {
  const t = blankTexture(16);
  return { size: 16, pixels: t.pixels.map(() => hex) };
}

const project = createProject('LocalTest', 'Installed straight into the dev folders');
project.uuids = {
  bpHeader: 'b7e4d2a1-3c55-4f18-9a20-71d0e6c4a891',
  bpModule: 'c8f5e3b2-4d66-4a29-8b31-82e1f7d5b902',
  rpHeader: 'd9a6f4c3-5e77-4b3a-9c42-93f2a8e6ca13',
  rpModule: 'eab7a5d4-6f88-4c4b-ad53-a4a3b9f7db24',
};

const gem: ModItem = { ...createItem('plain'), name: 'Test Gem', texture: solidTexture('#ff00ff'), stackSize: 64 };
const sword: ModItem = {
  ...createItem('sword'),
  name: 'Test Sword',
  texture: solidTexture('#00ff00'),
  power: 9,
  durability: 900,
  recipe: {
    enabled: true,
    grid: [null, 'minecraft:diamond', null, null, 'minecraft:diamond', null, null, 'minecraft:stick', null],
    count: 1,
  },
};
const snack: ModItem = {
  ...createItem('food'),
  name: 'Test Snack',
  texture: solidTexture('#00ffff'),
  nutrition: 8,
  canAlwaysEat: true,
};
project.items = [gem, sword, snack];

// --- World injection ---------------------------------------------------------

/**
 * Install into a specific world and activate it there.
 *
 * The development_* folders turned out not to be scanned by the standalone
 * launcher build, but worlds carry their own copies of every pack they use
 * (that is how the previously imported packs were being loaded). Writing
 * there and listing the pack in world_{behavior,resource}_packs.json activates
 * it with no in-game steps at all.
 *
 * Only the pack folders and the two activation manifests are touched; the
 * world database itself is never opened. Both manifests are backed up first.
 */
async function injectIntoWorld(worldDir: string, addon: BuiltAddon, uuids: { bp: string; rp: string }) {
  const byTop = new Map<string, typeof addon.files>();
  for (const file of addon.files) {
    const top = file.path.split('/')[0] as string;
    if (!byTop.has(top)) byTop.set(top, []);
    (byTop.get(top) as typeof addon.files).push(file);
  }

  for (const [top, files] of byTop) {
    const isBehavior = top.endsWith('_BP');
    const dest = join(worldDir, isBehavior ? 'behavior_packs' : 'resource_packs', top);
    await rm(dest, { recursive: true, force: true });
    await mkdir(dest, { recursive: true });
    for (const file of files) {
      const target = join(dest, file.path.slice(top.length + 1));
      await mkdir(dirname(target), { recursive: true });
      if (file.kind === 'text') await writeFile(target, file.content, 'utf8');
      else await writeFile(target, file.content);
    }
    console.log(`  world pack -> ${dest}`);
  }

  const version = [1, 0, 0];
  for (const [name, id] of [
    ['world_behavior_packs.json', uuids.bp],
    ['world_resource_packs.json', uuids.rp],
  ] as const) {
    const path = join(worldDir, name);
    if (existsSync(path)) {
      const backup = `${path}.bak`;
      if (!existsSync(backup)) await writeFile(backup, await readFile(path));
    }
    await writeFile(path, `${JSON.stringify([{ pack_id: id, version }], null, 2)}\n`, 'utf8');
    console.log(`  activated in ${name}`);
  }
}

/** Delete previously injected test packs so nothing stale can win. */
async function cleanWorldPacks(worldDir: string, keep: string[]) {
  for (const sub of ['behavior_packs', 'resource_packs']) {
    const dir = join(worldDir, sub);
    if (!existsSync(dir)) continue;
    for (const entry of await readdir(dir)) {
      if (keep.includes(entry)) continue;
      await rm(join(dir, entry), { recursive: true, force: true });
      console.log(`  removed stale ${sub}/${entry}`);
    }
  }
}

// --- Run ---------------------------------------------------------------------

const roots = await findMojangRoots();
if (roots.length === 0) {
  console.error('Could not find a com.mojang folder. Is Minecraft Bedrock installed?');
  process.exit(1);
}
console.log('com.mojang locations found:');
for (const r of roots) console.log(`  ${r}`);

const live = await pickLiveRoot(roots);
if (!live) {
  console.error('No usable com.mojang root.');
  process.exit(1);
}
console.log(`\nInstalling into the most recently used one:\n  ${live}\n`);

const addon = buildAddon(project);
await install(live, addon);

// Inject into the most recently played world and activate it there. The dev
// folders are not scanned by every Bedrock build (this machine's standalone
// launcher ignores them), but world-local packs are always loaded, so this is
// the reliable path.
const worldsDir = join(live, 'minecraftWorlds');
let newest: { dir: string; mtime: number; name: string } | null = null;
for (const entry of await readdir(worldsDir)) {
  const dir = join(worldsDir, entry);
  try {
    const s = await stat(dir);
    if (!s.isDirectory()) continue;
    if (!newest || s.mtimeMs > newest.mtime) {
      let name = entry;
      try {
        name = (await readFile(join(dir, 'levelname.txt'), 'utf8')).trim();
      } catch {
        /* fall back to the folder id */
      }
      newest = { dir, mtime: s.mtimeMs, name };
    }
  } catch {
    /* skip unreadable world */
  }
}

if (newest) {
  console.log(`\nInjecting into world "${newest.name}"\n  ${newest.dir}`);
  await cleanWorldPacks(newest.dir, ['LocalTest_BP', 'LocalTest_RP']);
  await injectIntoWorld(newest.dir, addon, {
    bp: project.uuids.bpHeader,
    rp: project.uuids.rpHeader,
  });
} else {
  console.log('\nNo world found to inject into.');
}

console.log('\nDone. Launch Minecraft and open that world — the pack is already');
console.log('activated, so there is nothing to import or switch on.');
console.log('\n  /give @s localtest:test_gem     -> solid MAGENTA square');
console.log('  /give @s localtest:test_sword   -> solid GREEN square');
console.log('  /give @s localtest:test_snack   -> solid CYAN square (edible)');
console.log('\nRe-running overwrites the same folders in place, so there is never a');
console.log('duplicate and never anything to re-activate.');
