# Bedrock Mod Maker — working notes

Kid-facing web app that generates real Minecraft Bedrock `.mcaddon` files.
Client-side only. Milestones 0–6 are complete and verified in-game.

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

Presets (`presets.ts`, `blockPresets.ts`, `mobPresets.ts`) declare their own
sliders with min/max. The UI draws from them **and** the generator clamps
against them, so the two cannot drift. Add new content types by adding a
preset, not by touching packaging.

## Non-negotiables

- Every generated add-on must be valid for *any* input. Clamp in the generator,
  not just the UI. A kid must never produce a broken pack.
- `Math.max/min` propagate NaN — use the `clampInt`/`clampNumber` helpers.
- No raw JSON or code exposed in the UI. No login, no backend, nothing leaves
  the browser.
- Ask before adding a dependency that sends data off the machine.

## Testing

`npm test` — 204 tests. `npm run build`, `npx tsc -b --noEmit`.

The suite verifies our bytes against our own understanding, which is *not* the
same as the game agreeing: it passed cleanly through four real on-device bugs.
Structural tests are necessary and not sufficient — finish with `install-local`.
