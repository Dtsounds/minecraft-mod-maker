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
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import { existsSync } from 'node:fs';
import { buildAddon } from '../src/bedrock/pack';
import { testProject } from './testProject';
import type { BuiltAddon } from '../src/bedrock/types';

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

// Shared with serve-test, so the mod verified headless is byte-for-byte the
// mod the client loads. See scripts/testProject.ts.
const project = testProject();

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

// banner: makes the one on-device check decisive (see the rules block above).
// No selfTest here: it targets the player when one is present, so it would
// strike Dave with lightning, explode at his feet and set him alight on every
// world load. `npm run serve-test` covers all eight actions headlessly, which
// is what that block was for.
const addon = buildAddon(project, { banner: 'LocalTest' });
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
console.log('  /give @s localtest:test_bow     -> YELLOW bow, hold to draw, shoots arrows');
console.log('  /give @s localtest:test_star    -> RED star, THROW it, hurts (stacks to 16)');
console.log('  /give @s localtest:test_snowstar-> PALE star, throws a harmless snowball');
console.log('');
console.log('  /give @s localtest:test_stone   -> ORANGE block, drops itself');
console.log('  /give @s localtest:test_ore     -> YELLOW block, GLOWS, needs a pickaxe,');
console.log('                                     drops 2 diamonds (nothing by hand)');
console.log('  /give @s localtest:test_glass   -> BLUE block you can SEE THROUGH');
console.log('  /give @s localtest:test_grassy  -> GREEN top, BROWN sides, DARK bottom');
console.log('                                     (smelt dirt in a furnace to make one)');
console.log('');
console.log('  /summon localtest:test_critter  -> PURPLE 4-legged, tame with wheat, breeds');
console.log('  /summon localtest:test_brute    -> GREEN 2-legged, chases and hits you');
console.log('  /summon localtest:test_birdy    -> YELLOW bird, big, fast, runs away, rideable');
console.log('  (spawn eggs are in the creative menu too)');
console.log('');
console.log('  RULES (Milestone 7) — check these IN ORDER:');
console.log('   0. On world load, chat should say "[LocalTest] 5 rule(s) loaded".');
console.log('      If that line is MISSING, stop: the script module did not load at');
console.log('      all and none of the rules below can possibly work.');
console.log('   1. Hold test_gem, use it     -> you get SPEED for 20s');
console.log('   2. Hold test_sword, use it   -> LIGHTNING strikes you');
console.log('   3. Break a test_stone block  -> 3 DIAMONDS pop out');
console.log('   4. Place a test_glass block  -> 3 CHICKENS appear');
console.log('   5. Hit a test_critter        -> chat says "Ouch! Stop that!"');
console.log('\nRe-running overwrites the same folders in place, so there is never a');
console.log('duplicate and never anything to re-activate.');
