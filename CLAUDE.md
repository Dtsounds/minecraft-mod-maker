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

Presets (`presets.ts`, `blockPresets.ts`, `mobPresets.ts`, `rulePresets.ts`)
declare their own sliders with min/max. The UI draws from them **and** the
generator clamps against them, so the two cannot drift. Add new content types
by adding a preset, not by touching packaging.

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

## Testing

`npm test` — 230 tests. `npm run build`, `npx tsc -b --noEmit`.

The suite verifies our bytes against our own understanding, which is *not* the
same as the game agreeing: it passed cleanly through four real on-device bugs.
Structural tests are necessary and not sufficient — finish with `install-local`.
