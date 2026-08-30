/**
 * Read what Minecraft itself said about our packs, the last time it ran.
 *
 * This is the missing half of the testing story. `npm test` verifies our bytes
 * against our own understanding of the schema, which is not the same as the
 * game agreeing — and the game does not agree quietly. It writes a content log
 * every launch, naming the exact file and the exact reason it rejected
 * something.
 *
 * That log had been sitting on disk unread for two days holding this line:
 *
 *   [Recipes][error] recipes/test_sword.json | 1.20+ Recipes require unlock data
 *
 * Every crafting recipe the generator had ever produced was being rejected at
 * load. The item still existed and still answered /give, so the mod looked
 * fine, the test suite was green, and Milestone 3 was marked verified.
 *
 *   npm run check-log
 *
 * Run it after any world load. It costs one second and needs nobody to play.
 */
import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { existsSync } from 'node:fs';

const LOG_DIRS = [
  join(homedir(), 'AppData', 'Roaming', 'Minecraft Bedrock', 'logs'),
  join(
    homedir(),
    'AppData',
    'Local',
    'Packages',
    'Microsoft.MinecraftUWP_8wekyb3d8bbwe',
    'LocalState',
    'logs',
  ),
];

/** Newest ContentLog across every place Minecraft might have written one. */
async function newestLog(): Promise<{ path: string; mtime: Date } | null> {
  let best: { path: string; mtime: Date } | null = null;
  for (const dir of LOG_DIRS) {
    if (!existsSync(dir)) continue;
    for (const entry of await readdir(dir)) {
      if (!entry.startsWith('ContentLog')) continue;
      const path = join(dir, entry);
      try {
        const s = await stat(path);
        if (!best || s.mtime > best.mtime) best = { path, mtime: s.mtime };
      } catch {
        /* skip unreadable log */
      }
    }
  }
  return best;
}

const found = await newestLog();
if (!found) {
  console.error('No ContentLog found. Has Minecraft been launched on this machine?');
  process.exit(1);
}

const raw = await readFile(found.path, 'utf8');
const lines = raw
  .split('\n')
  .map((l) => l.trim())
  .filter(Boolean);

const age = Math.round((Date.now() - found.mtime.getTime()) / 60000);
console.log(`ContentLog: ${found.path}`);
console.log(`Written:    ${found.mtime.toLocaleString()} (${age} min ago)\n`);

// A log older than the packs on disk describes a build that no longer exists.
const packManifest = join(
  homedir(),
  'AppData',
  'Roaming',
  'Minecraft Bedrock',
  'Users',
);
if (existsSync(packManifest)) {
  const installed = await newestPackWrite(packManifest);
  if (installed && installed > found.mtime) {
    console.log('⚠️  STALE: the packs on disk are newer than this log.');
    console.log('   Load the world again before trusting anything below.\n');
  }
}

/** When was a LocalTest pack file last written? */
async function newestPackWrite(usersDir: string): Promise<Date | null> {
  let newest: Date | null = null;
  const walk = async (dir: string, depth: number): Promise<void> => {
    if (depth > 8) return;
    let entries: string[];
    try {
      entries = await readdir(dir);
    } catch {
      return;
    }
    for (const entry of entries) {
      const path = join(dir, entry);
      let s;
      try {
        s = await stat(path);
      } catch {
        continue;
      }
      if (s.isDirectory()) {
        if (entry.endsWith('_BP') || entry.endsWith('_RP')) {
          if (!newest || s.mtime > newest) newest = s.mtime;
          continue;
        }
        await walk(path, depth + 1);
      }
    }
  };
  await walk(usersDir, 0);
  return newest;
}

// The runtime's own self-test, which reports via console.warn so its results
// land here rather than needing someone to watch the chat window.
const selfTest = lines.filter((l) => l.includes('[SELFTEST]'));
const scripting = lines.filter((l) => l.includes('[Scripting]') && !l.includes('[SELFTEST]'));
const problems = lines.filter(
  (l) => /\[(error|warning)\]/i.test(l) && !l.includes('[SELFTEST]'),
);
const sounds = problems.filter((l) => l.includes('[Sound]'));
const real = problems.filter((l) => !l.includes('[Sound]'));

if (scripting.length > 0) {
  console.log('SCRIPTING');
  for (const line of scripting) console.log(`  ${line}`);
  console.log('');
}

if (selfTest.length > 0) {
  const failed = selfTest.filter((l) => l.includes('FAIL'));
  console.log(`RUNTIME SELF-TEST  (${selfTest.length - failed.length}/${selfTest.length} actions OK)`);
  for (const line of selfTest) {
    console.log(`  ${line.slice(line.indexOf('[SELFTEST]'))}`);
  }
  console.log('');
  if (failed.length > 0) {
    console.log(`❌ ${failed.length} action(s) failed — see the :: reason on each line above.\n`);
  }
} else {
  console.log('RUNTIME SELF-TEST  no results in this log.');
  console.log('  Either the world has not been loaded since install-local, or the');
  console.log('  script never reached the self-test. Check the SCRIPTING lines above.\n');
}

if (real.length === 0) {
  console.log('✅ No errors or warnings from any pack.');
} else {
  console.log(`❌ ${real.length} error/warning line(s):`);
  for (const line of real) console.log(`  ${line}`);
}

if (sounds.length > 0) {
  console.log(`\n(${sounds.length} cosmetic [Sound] line(s) suppressed.)`);
}

// Non-zero on real problems so this can gate a workflow later.
process.exit(real.length > 0 || selfTest.some((l) => l.includes('FAIL')) ? 1 : 0);
