/**
 * Verify a generated add-on against a REAL Minecraft server, with nobody
 * playing.
 *
 * The retail client is a GUI application with no headless mode, so every
 * on-device check used to need a human to open a world and look at something.
 * Mojang's Bedrock Dedicated Server is the same engine as a console
 * application: it loads the same packs, runs the same Script API, and prints
 * script `console.*` output straight to stdout.
 *
 * So this script installs the packs into a throwaway server world, starts the
 * server, waits for the runtime's self-test to report on every rule action,
 * stops the server, and prints the results. No client, no player, no gameplay.
 *
 *   npm run serve-test
 *
 * The server lives outside the repo (~/bedrock-server by default, override
 * with BDS_HOME) because it is ~100MB of Mojang's binaries and has no business
 * in version control.
 *
 * What this DOES verify: packs load, the script module resolves, every action's
 * API call actually works against the real engine, and nothing in any pack is
 * rejected at load.
 *
 * What it does NOT verify: that a trigger fires from real player input, or that
 * anything looks right. Those still need eyes — but they are now the only
 * things that do.
 */
import { mkdir, rm, writeFile, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { buildAddon } from '../src/bedrock/pack';
import { testProject } from './testProject';

const BDS_HOME = process.env['BDS_HOME'] ?? join(homedir(), 'bedrock-server');
const LEVEL = 'ModMakerTest';
/** Generous: a first run has to generate the world before scripts even start. */
const TIMEOUT_MS = 180_000;

if (!existsSync(join(BDS_HOME, 'bedrock_server.exe'))) {
  console.error(`No Bedrock Dedicated Server at ${BDS_HOME}`);
  console.error('Set BDS_HOME, or download it from:');
  console.error('  https://net-secondary.web.minecraft-services.net/api/v1.0/download/links');
  process.exit(1);
}

// --- Install the packs -------------------------------------------------------

const addon = buildAddon(testProject(), { banner: 'ServeTest', selfTest: true });

const byTop = new Map<string, typeof addon.files>();
for (const file of addon.files) {
  const top = file.path.split('/')[0] as string;
  if (!byTop.has(top)) byTop.set(top, []);
  (byTop.get(top) as typeof addon.files).push(file);
}

const worldDir = join(BDS_HOME, 'worlds', LEVEL);

for (const [top, files] of byTop) {
  const isBehavior = top.endsWith('_BP');
  // Server-wide copy, so the server knows the pack exists...
  const shared = join(BDS_HOME, isBehavior ? 'behavior_packs' : 'resource_packs', top);
  // ...and a world-local copy, which is what actually gets loaded.
  const local = join(worldDir, isBehavior ? 'behavior_packs' : 'resource_packs', top);

  for (const dest of [shared, local]) {
    await rm(dest, { recursive: true, force: true });
    await mkdir(dest, { recursive: true });
    for (const file of files) {
      const target = join(dest, file.path.slice(top.length + 1));
      await mkdir(dirname(target), { recursive: true });
      if (file.kind === 'text') await writeFile(target, file.content, 'utf8');
      else await writeFile(target, file.content);
    }
  }
  console.log(`  installed ${files.length} files -> ${top}`);
}

const project = testProject();
for (const [name, id] of [
  ['world_behavior_packs.json', project.uuids.bpHeader],
  ['world_resource_packs.json', project.uuids.rpHeader],
] as const) {
  await writeFile(
    join(worldDir, name),
    `${JSON.stringify([{ pack_id: id, version: [1, 0, 0] }], null, 2)}\n`,
    'utf8',
  );
}

// --- Point the server at that world -----------------------------------------

const propsPath = join(BDS_HOME, 'server.properties');
const props = await readFile(propsPath, 'utf8');
const patched = props
  .split('\n')
  .map((line) => {
    if (line.startsWith('level-name=')) return `level-name=${LEVEL}`;
    // Nobody is going to connect, so skip the Xbox Live handshake entirely.
    if (line.startsWith('online-mode=')) return 'online-mode=false';
    if (line.startsWith('allow-list=')) return 'allow-list=false';
    // THE important one. Off by default, and without it the server silently
    // swallows both script console output and every pack-load complaint —
    // which is the only reason to be running it at all.
    if (line.startsWith('content-log-console-output-enabled='))
      return 'content-log-console-output-enabled=true';
    if (line.startsWith('content-log-file-enabled=')) return 'content-log-file-enabled=true';
    if (line.startsWith('content-log-level=')) return 'content-log-level=verbose';
    return line;
  })
  .join('\n');
await writeFile(propsPath, patched, 'utf8');

// --- Run it ------------------------------------------------------------------

console.log(`\nStarting server (level "${LEVEL}")...\n`);

const server = spawn(join(BDS_HOME, 'bedrock_server.exe'), {
  cwd: BDS_HOME,
  stdio: ['pipe', 'pipe', 'pipe'],
});

const selfTest: string[] = [];
const problems: string[] = [];
let stopped = false;
let sawServerStart = false;

function stop(): void {
  if (stopped) return;
  stopped = true;
  try {
    server.stdin.write('stop\n');
  } catch {
    server.kill();
  }
  // If it will not go quietly, make it.
  setTimeout(() => server.kill(), 15_000).unref();
}

function consume(chunk: string): void {
  for (const line of chunk.split('\n')) {
    const text = line.trim();
    if (!text) continue;

    if (text.includes('Server started') && !sawServerStart) {
      sawServerStart = true;
      // A server with nobody connected ticks NO chunks, so every world-touching
      // API call fails with LocationInUnloadedChunkError. A ticking area is how
      // an operator pins chunks loaded without a player standing in them —
      // which is the whole trick that makes headless verification possible.
      server.stdin.write('tickingarea add circle 0 0 0 4 selftest\n');
    }

    if (text.includes('[SELFTEST]')) {
      const body = text.slice(text.indexOf('[SELFTEST]'));
      selfTest.push(body);
      console.log(`  ${body}`);
      if (body.includes('DONE')) stop();
      continue;
    }

    // Content-log entries look like `[Recipes][error]-...`; the server's own
    // lines carry a level in the timestamp bracket. Match those two shapes
    // rather than any line containing the letters "error", which otherwise
    // catches cheerful things like `errorMessage=(null)`.
    const contentError = /\[[A-Za-z]+\]\[(error|warning)\]/i.test(text);
    const serverError = /\d\s+(ERROR|WARN)\]/.test(text);
    const benign =
      text.includes('[Sound]') ||
      text.includes('errorMessage=(null)') ||
      text.includes('Content logging to console');

    if ((contentError || serverError) && !benign) {
      problems.push(text);
      console.log(`  ! ${text}`);
    }
  }
}

server.stdout.setEncoding('utf8');
server.stderr.setEncoding('utf8');
server.stdout.on('data', consume);
server.stderr.on('data', consume);

const timer = setTimeout(() => {
  console.log('\nTimed out waiting for the self-test.');
  stop();
}, TIMEOUT_MS);

const code: number = await new Promise((resolve) => {
  server.on('close', (c) => resolve(c ?? 0));
});
clearTimeout(timer);

// --- Report ------------------------------------------------------------------

const failed = selfTest.filter((l) => l.includes('FAIL'));
const passed = selfTest.filter((l) => l.startsWith('[SELFTEST] OK'));

console.log('\n--- RESULT ---------------------------------------------------');
console.log(`server started:   ${sawServerStart ? 'yes' : 'NO'}`);
console.log(`actions passed:   ${passed.length}`);
console.log(`actions failed:   ${failed.length}`);
console.log(`pack problems:    ${problems.length}`);

if (failed.length > 0) {
  console.log('\nFailures:');
  for (const line of failed) console.log(`  ${line}`);
}
if (problems.length > 0) {
  console.log('\nPack problems:');
  for (const line of problems) console.log(`  ${line}`);
}
if (selfTest.length === 0) {
  console.log('\nThe self-test never reported. The script did not run at all —');
  console.log('check the server output above for how far it got.');
}

console.log(`\nserver exit code ${code}`);
process.exit(failed.length > 0 || problems.length > 0 || selfTest.length === 0 ? 1 : 0);
