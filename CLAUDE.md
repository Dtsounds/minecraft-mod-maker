# Bedrock Mod Maker — working notes

Kid-facing web app that generates real Minecraft Bedrock `.mcaddon` files.
Client-side only. Milestones 0–7 are complete and verified in-game.

## Read this before touching Bedrock JSON

**`docs/bedrock-schema.md` is a cheat sheet of every schema fact already
verified against a live client.** Grep it first. It exists because fetching
Microsoft's reference pages costs ~60KB each and they were wrong or misleading
three separate times. Only research online if the answer genuinely isn't there.

When you must research: **prefer `github.com/Mojang/bedrock-samples`** (the real
shipping vanilla packs) over `learn.microsoft.com`. The docs describe intent;
the samples are ground truth. Raw URLs work:
`raw.githubusercontent.com/Mojang/bedrock-samples/main/<path>`.

## Testing in the real game

```bash
npm run install-local
```

Writes the packs straight into the live Minecraft world and activates them.
Dave then just opens the world — nothing to import or switch on.

**Never send `.mcaddon` files for manual importing.** Each import registers a
*new* pack while the world keeps the previously activated one, so you end up
testing a stale build. That silently wasted four debugging rounds once.

Minecraft's live data on this machine is the **standalone launcher** path:

```
%APPDATA%\Minecraft Bedrock\Users\<id>\games\com.mojang
```

**not** the Microsoft Store package folders, which are empty here. You have
shell access — read `minecraftWorlds/<world>/world_behavior_packs.json` to see
what is *actually* loaded rather than asking.

## Verify headless first — no human needed

```bash
npm run serve-test
```

Runs the generated packs against **Mojang's Bedrock Dedicated Server**, which
is the same engine as the retail client but a console application: same pack
loading, same Script API, script `console.*` straight to stdout. It installs
the test mod, boots the server, waits for the runtime's self-test to exercise
every rule action, stops the server, and reports.

The server lives at `~/bedrock-server` (override with `BDS_HOME`) — outside the
repo, since it is ~100MB of Mojang's binaries. Get the current URL from
`https://net-secondary.web.minecraft-services.net/api/v1.0/download/links`
and match the retail client's version.

Two non-obvious things this needed, both of which look like a broken script:

- **`content-log-console-output-enabled=true`** in `server.properties`.
  Off by default, and without it the server silently swallows script output
  *and* every pack-load complaint — the only two things worth running it for.
- **A ticking area.** A server with nobody connected ticks **no chunks**, so
  every world-touching API call fails with `LocationInUnloadedChunkError`.
  `serve-test` issues `tickingarea add circle 0 0 0 4` once the server is up.
  That is the trick that makes player-free verification work at all.

What this covers: packs load, the script module resolves, and every rule
action's API call really works. What it cannot cover: a trigger firing from
real player input, and whether anything *looks* right. Those two are the only
things left that need Dave.

## Read the content log before asking Dave anything

```bash
npm run check-log
```

**Minecraft writes down exactly what it rejected, every launch**, in
`%APPDATA%\Minecraft Bedrock\logs\ContentLog*.txt` — the offending file, the
identifier, and the reason. This is a *free, automated* verification channel
and it went unread for the first two days of this project.

It was holding this the whole time:

```
[Recipes][error] recipes/test_sword.json | 1.20+ Recipes require unlock data
```

Every crafting recipe the generator had ever produced was being rejected at
load. The item still existed and still answered `/give`, so the mod looked
fine, the suite was green, and Milestone 3 was marked "verified on-device".

`check-log` also warns when the packs on disk are **newer than the log** — that
means the log describes a build that no longer exists, which is the same
stale-build trap that once wasted four rounds.

The runtime additionally self-tests: `install-local` appends a block that calls
every rule action once a few seconds after load and reports each one via
`console.warn`, which lands in the content log. So all eight actions are
verified by loading the world once and running `check-log` — no gameplay, and
nothing for Dave to observe or interpret. That block never ships to a kid.

## Asking Dave to test

He has limited patience for round-trips, and rightly so. Before asking:

- automate whatever you can against the real system
- make each check a single unambiguous observation ("is it magenta or blank?",
  not "does it look right?" — "clear" once meant opposite things to us)
- batch competing hypotheses into ONE test build instead of one guess per round

## Architecture

`src/bedrock/` is the generator layer: project state in, list of files out.
**No React or DOM imports there** — that separation is what lets tests assert
on the exact bytes that ship.

```
versions.ts     pinned schema versions + why each was chosen
ids.ts          identifier/UUID hygiene; every function is total, never throws
png.ts          dependency-free PNG encoder (identical bytes in Node + browser)
item.ts / block.ts / mob.ts   per-registry generators
pack.ts         assembles the whole file tree (pure)
package.ts      JSZip + browser download
```

Presets (`presets.ts`, `blockPresets.ts`, `mobPresets.ts`, `rulePresets.ts`)
declare their own sliders with min/max. The UI draws from them **and** the
generator clamps against them, so the two cannot drift. Add new content types
by adding a preset, not by touching packaging.

### Where a creature's skin lands is derived, never written down

`mobUv.ts` unwraps a rig's boxes into labelled rectangles: which part, which
face, and every bone that shares it. The pixel editor's overlay, the "paint one
part at a time" buttons, the 3D preview and the starter skin all read that one
map, so none of them can drift apart.

Two facts it exists to make visible, both of which had been confusing kids:

- **Two thirds of the canvas maps to nothing.** 67% dead for the quadruped,
  71% biped, 85% bird. Painting there shows up nowhere, silently.
- **Twins share a rectangle.** The biped's two arms read the same pixels, as do
  its legs and the bird's wings. Vanilla does this too — `geometry.pig.v1.8`
  uses one rectangle for all four legs.

The unwrap was checked against `Mojang/bedrock-samples`: run it over the pig,
cow and chicken and every face lands on-sheet, tiling the pig's 64x32 exactly
to (64, 32). `tests/mob-uv.test.ts` keeps that as a fixture. A wrong face order
overflows or falls short, so that one assertion is the whole proof.

There used to be a hand-written `uvRegions` list on each rig for the starter
skin. It had drifted into covering hundreds of dead pixels — a second source of
truth doing what second sources of truth do. It is gone.

### The 3D preview is CSS, not a 3D library

`MobPreview.tsx` builds the creature from six absolutely-positioned divs per
box, each showing its own rectangle of the texture through
`background-position`. ~40 nodes, nothing added to the bundle, and inspectable
from tests — which is how the orientation is pinned: Minecraft's y is up and
its z is south, CSS's y is down and its z faces the viewer, so both flip.
`tests/mob-paint-flow.test.tsx` asserts the head ends up above and in front of
the body, because upside-down and inside-out are the two ways this goes wrong
and no texture assertion would notice either.

### Textures are packed at the file boundary, not in the app

`src/storage/textureCodec.ts` writes a texture into a `.modmaker.json` as a
palette plus a run-length string. Nothing else in the app sees that shape: the
pixel editor, the generator and every test keep the plain one-entry-per-pixel
array. `parseBackup` unpacks *before* `normalizeProject`, because
`normalizeProject` knows only the plain shape and would silently read a packed
texture as a blank canvas — which is also why `BACKUP_FORMAT` moved to 2.

### Rules ship data, never generated code

`runtime.ts` holds `scripts/main.js` as a **constant** — byte-identical in
every export, so it is reviewed and tested once. A kid's rules are compiled by
`rules.ts` into a JSON table spliced into the top of it, and the runtime
interprets that. Nothing a kid can type produces JavaScript.

Keep it that way. If a new action needs bespoke emitted code, add a branch to
the fixed runtime and a field to the data instead — a Bedrock script error is
*silent* except in the content log, which is the failure mode that has cost
this project the most.

A pack with no runnable rules declares no script module at all, so pre-Phase-4
mods still generate byte-identical output and cannot fail on a dependency they
do not use.

## Non-negotiables

- Every generated add-on must be valid for *any* input. Clamp in the generator,
  not just the UI. A kid must never produce a broken pack.
- `Math.max/min` propagate NaN — use the `clampInt`/`clampNumber` helpers.
- No raw JSON or code exposed in the UI. No login, no backend, nothing leaves
  the browser.
- Ask before adding a dependency that sends data off the machine.
- **No external requests at runtime, fonts included.** The app loads zero
  third-party resources. A Google Fonts `<link>` would send every child's IP
  address to a third party on every load, quietly undoing the one privacy
  promise the project makes. The pixel font is self-hosted in
  `src/styles/fonts/` (12KB, SIL OFL, license shipped alongside).

## Testing

`npm test` — 289 tests. `npm run build`, `npx tsc -b --noEmit`.

The suite verifies our bytes against our own understanding, which is *not* the
same as the game agreeing: it passed cleanly through four real on-device bugs.
Structural tests are necessary and not sufficient — finish with `install-local`.
