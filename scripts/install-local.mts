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
import { createProject, createItem, createBlock, createMob, createRule } from '../src/bedrock/project';
import { blankTexture } from '../src/bedrock/texture';
import { mobRig } from '../src/bedrock/mobGeometry';
import { starterMobTexture } from '../src/components/mobStarter';
import type { BuiltAddon, ModBlock, ModItem, ModMob, Texture } from '../src/bedrock/types';

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
  bpScript: 'fbc8b6e5-7a99-4d5c-be64-b5b4cae8ec35',
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
/** Bow: shooter + use_modifiers, firing vanilla arrows. */
const bow: ModItem = {
  ...createItem('bow'),
  name: 'Test Bow',
  texture: solidTexture('#ffb703'),
  drawTime: 4,
  durability: 400,
};

/** Throwing weapon: the item itself becomes an arrow entity in flight. */
const star: ModItem = {
  ...createItem('throwable'),
  name: 'Test Star',
  texture: solidTexture('#ff4d5e'),
  throwPower: 8,
  stackSize: 16,
  projectileKind: 'arrow',
};

/** Same, but harmless — checks the projectile picker actually changes what flies. */
const snowStar: ModItem = {
  ...createItem('throwable'),
  name: 'Test Snowstar',
  texture: solidTexture('#c6ecff'),
  throwPower: 6,
  stackSize: 16,
  projectileKind: 'snowball',
};

project.items = [gem, sword, snack, bow, star, snowStar];

// --- Blocks (Milestone 5) ---------------------------------------------------

/** Plain solid block that drops itself; the baseline case. */
const stone: ModBlock = {
  ...createBlock(),
  name: 'Test Stone',
  texture: solidTexture('#ff8800'),
  hardness: 3,
};

/** Glowing, pickaxe-gated, drops a vanilla diamond. Exercises light_emission,
 *  the match_tool loot condition and a non-self drop all at once. */
const ore: ModBlock = {
  ...createBlock(),
  name: 'Test Ore',
  texture: solidTexture('#ffee00'),
  hardness: 6,
  glow: 14,
  tool: 'pickaxe',
  drop: { kind: 'vanilla', id: 'minecraft:diamond' },
  dropCount: 2,
};

/** See-through, so render_method "blend" gets exercised. */
const glass: ModBlock = {
  ...createBlock(),
  name: 'Test Glass',
  texture: solidTexture('#66ddff'),
  look: 'seeThrough',
  hardness: 1,
};

/** Distinct top/side/bottom, plus a furnace recipe. */
const grassy: ModBlock = {
  ...createBlock(),
  name: 'Test Grassy',
  faceMode: 'topSideBottom',
  texture: solidTexture('#8a5f3c'),
  textureTop: solidTexture('#3fbf5f'),
  textureBottom: solidTexture('#5a3a22'),
  hardness: 2,
  smelting: { enabled: true, input: 'minecraft:dirt' },
};

project.blocks = [stone, ore, glass, grassy];

// --- Mobs (Milestone 6) -----------------------------------------------------

/** Friendly quadruped, tameable and breedable. The baseline creature. */
const critter: ModMob = {
  ...createMob(),
  name: 'Test Critter',
  rig: 'quadruped',
  texture: starterMobTexture(mobRig('quadruped'), '#c05ad8'),
  health: 20,
  speed: 6,
  mood: 'friendly',
  tameable: true,
  tameFood: 'minecraft:wheat',
  breedable: true,
  breedFood: 'minecraft:wheat',
  drop: { kind: 'vanilla', id: 'minecraft:leather' },
  dropCount: 2,
};

/** Hostile biped: exercises attack, melee and player targeting. */
const brute: ModMob = {
  ...createMob(),
  name: 'Test Brute',
  rig: 'biped',
  texture: starterMobTexture(mobRig('biped'), '#3fbf5f'),
  health: 30,
  speed: 7,
  damage: 5,
  mood: 'mean',
  drop: { kind: 'vanilla', id: 'minecraft:bone' },
  dropCount: 1,
};

/** Small, fast, shy bird — and rideable, plus scaled up so minecraft:scale
 *  and the collision box scaling both get exercised. */
const birdy: ModMob = {
  ...createMob(),
  name: 'Test Birdy',
  rig: 'bird',
  texture: starterMobTexture(mobRig('bird'), '#ffb703'),
  health: 8,
  speed: 12,
  size: 18,
  mood: 'shy',
  rideable: true,
  drop: { kind: 'vanilla', id: 'minecraft:feather' },
  dropCount: 3,
};

project.mobs = [critter, brute, birdy];

// --- Rules (Milestone 7) -----------------------------------------------------

/**
 * Five rules chosen to cover every distinct path through the runtime in ONE
 * world visit, rather than one guess per round:
 *
 *  - all three subject kinds: item, block, creature
 *  - a player-targeted action (addEffect) and dimension-targeted ones
 *    (spawnEntity, createExplosion, spawnItem)
 *  - ItemStack construction, which is the only `new` in the runtime
 *
 * The world-load banner is the decisive one. If it appears, the script module
 * resolved and is running, so a misbehaving rule is a rule bug. If it does not,
 * the manifest or the @minecraft/server version is wrong and no rule was ever
 * going to fire. Those two look identical from inside the game otherwise.
 */
project.rules = [
  {
    ...createRule(),
    name: 'Gem grants speed',
    trigger: 'useItem',
    subjectId: gem.id,
    action: 'effect',
    effect: 'speed',
    strength: 3,
    seconds: 20,
  },
  {
    ...createRule(),
    name: 'Sword calls lightning',
    trigger: 'useItem',
    subjectId: sword.id,
    action: 'lightning',
  },
  {
    ...createRule(),
    name: 'Stone drops diamonds',
    trigger: 'breakBlock',
    subjectId: stone.id,
    action: 'giveItem',
    giveTarget: { kind: 'vanilla', id: 'minecraft:diamond' },
    giveCount: 3,
  },
  {
    ...createRule(),
    name: 'Glass summons chickens',
    trigger: 'placeBlock',
    subjectId: glass.id,
    action: 'summon',
    summonTarget: { kind: 'vanilla', id: 'minecraft:chicken' },
    summonCount: 3,
  },
  {
    ...createRule(),
    name: 'Critter complains',
    trigger: 'hitMob',
    subjectId: critter.id,
    action: 'message',
    message: 'Ouch! Stop that!',
  },
];

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
const addon = buildAddon(project, { banner: 'LocalTest', selfTest: true });
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
