# Bedrock Mod Maker

**Live: https://dtsounds.github.io/minecraft-mod-maker/**

A browser app where a kid (roughly 8–14, non-programmer) visually creates real
Minecraft **Bedrock Edition** add-ons — no JSON, no code — and downloads a
working `.mcaddon` they can open on their device to play with.

Everything runs client-side. There is no backend, no account, and nothing
leaves the browser — not even a font. Projects autosave to IndexedDB, can be
saved to a file and opened back up, and the app installs as a PWA and runs
offline.

## Running it

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # 293 tests
npm run build
npm run sample     # writes a real .mcaddon to sample-output/
npm run install-local  # installs straight into the live Minecraft world
npm run check-log      # what Minecraft itself said about the packs, last launch
npm run make-icons     # regenerate the PWA icons
npm run serve-test     # verify against a real dedicated server, no player needed
```

## What's built

| Milestone | Status |
| --- | --- |
| 0 — Scaffold, JSZip, IndexedDB autosave | ✅ |
| 1 — Packaging pipeline (BP/RP manifests → `.mcaddon`) | ✅ |
| 2 — Pixel texture editor | ✅ |
| 3 — Item creator (7 presets + 3×3 recipe builder) | ✅ verified on-device |
| 4 — Export onboarding + My Mods | ✅ verified on-device |
| 5 — Block creator | ✅ verified on-device |
| 6 — Mob creator | ✅ verified on-device |
| 7 — Rules (Script API) | ✅ verified on-device |
| 8 — Save/open mods as files; installable + offline | ✅ verified on the live site |

## Hosting it

Static site, no backend. Every push to `master` builds and publishes to GitHub
Pages via `.github/workflows/deploy.yml` (typecheck and tests gate the deploy).

Serving from a subpath — which is what Pages does,
`username.github.io/<repo>/` — is the case that breaks PWAs, so it is worth
re-checking after any change to the service worker or the manifest. Everything
resolves against the registration scope rather than the domain root.

## Before changing Bedrock JSON

`docs/bedrock-schema.md` is a cheat sheet of every schema fact already verified
against a live client — grep it before researching anything online. It exists
because the reference pages are ~60KB each and were misleading three separate
times. `CLAUDE.md` carries the working rules for this repo.

## Architecture

The generator layer (`src/bedrock/`) is deliberately free of React and DOM
imports: project state goes in, a list of files comes out. That separation is
what lets the packaging tests assert on the exact bytes that ship, and it means
new item/block/mob presets can be added without touching packaging code.

```
src/bedrock/
  versions.ts     pinned Bedrock schema versions, with doc citations
  ids.ts          identifier/UUID hygiene — total functions, no throws
  png.ts          dependency-free PNG encoder (same bytes in Node and browser)
  texture.ts      texture model, normalisation, resampling
  manifest.ts     BP/RP manifest pair
  item.ts         item JSON per preset
  recipe.ts       shaped crafting recipes
  pack.ts         assembles the whole file tree (pure)
  rulePresets.ts  the closed trigger/action vocabulary
  rules.ts        rules -> a validated data table (never code)
  runtime.ts      the fixed scripts/main.js interpreter
  package.ts      JSZip + browser download
```

### Pinned Bedrock versions

Verified against Microsoft Learn's live creator docs on **2026-08-28**. See
`src/bedrock/versions.ts` for the citations and the reasoning behind each
choice.

| Thing | Value |
| --- | --- |
| manifest `format_version` | `2` (v3 is preview-only) |
| `min_engine_version` | `[1, 26, 0]` |
| items `format_version` | `"1.26.40"` |
| blocks `format_version` | `"1.26.40"` |
| recipes `format_version` | `"1.26.40"` |
| entities `format_version` | `"1.21.0"` (see below) |
| client entities `format_version` | `"1.10.0"` (what vanilla still ships) |
| `textures/*_texture.json` | no `format_version` (none exists for these) |

**Version numbering:** since 2026 the retail client shows a year-based string
(e.g. `v26.45`), but pack JSON still uses the old scheme — that same build is
`1.26.45` internally. A client displaying "26.45" wants 1.26.x content.

These originally targeted 1.21.x, on the reasoning that `min_engine_version`
is only a floor so a low value maximises the range of clients that can load a
kid's add-on. **That was the wrong trade.** Bedrock auto-updates on every
platform, so almost nobody runs an old client, while a stale schema actively
breaks on current ones: `minecraft:icon` changed shape between 1.21 and 1.26,
and declaring a newer field under an older `format_version` yields items that
load and register but render invisible. Target the current release.

Two details in `OPUS_BUILD_PROMPT.md` did not match the live docs, and the docs
won:

- Manifest `dependencies` is a **top-level** section, not `header.dependencies`.
- The `.lang` display-name key is `item.<ns>:<id>=Name`, **not** `…​.name=Name`.

**Entities are the one exception to targeting the newest schema.** The 1.26.40
notes say entity definitions at 1.26.40+ "now fail to load when invalid data is
supplied to several components and AI goals", and the platform guidance
separately exempts entities from the N-1 rule ("entity type versioning is highly
variable"). Staying below that strict-validation threshold is Mojang's own
advice.

### Three registries, three sets of rules

Items, blocks and mobs each differ in ways that fail *silently* if you assume
they work alike:

| | Items | Blocks | Mobs |
| --- | --- | --- | --- |
| texture atlas | `item_texture.json` (`atlas.items`) | `terrain_texture.json` (`atlas.terrain`) | direct path, no atlas |
| lang key | `item.<ns>:<id>` | `tile.<ns>:<id>.name` | `entity.<ns>:<id>.name` |
| `minecraft:loot` | n/a | bare string | object with `table` |

### Mob geometry: our own rigs, vanilla animations

The build prompt suggests referencing vanilla geometry identifiers. We don't,
for two reasons: they are versioned and churn (`geometry.pig.v1.8` →
`geometry.pig.v3`, `geometry.cow.v2`), and vanilla UV layouts are sized like
64×32 so a kid painting our square canvas would land pixels in meaningless
places.

Instead `mobGeometry.ts` ships three fixed box rigs under our own identifiers.
That is not 3D modelling — a kid never edits them and there is no modelling UI —
but it gives us control of the UV layout and immunity from vanilla renames.
Animation still comes from vanilla: `animation.quadruped.walk` was verified
against Mojang's `quadruped.animation.json` to animate exactly `leg0`–`leg3`, so
every rig names its legs that way and gets vanilla leg movement free.

### Dependency direction (learned the hard way)

The BP↔RP link is **one-directional: BP → RP only**. An early version also
pointed the RP back at the BP, reasoning that a mutual link would keep the two
halves enabled together. Minecraft cannot resolve the cycle and rejects the
whole add-on on import with *"missing one or more dependencies"*. Caught by an
on-device import, not by any test — the structural tests were happy, because
both UUIDs and versions matched perfectly. `tests/manifest.test.ts` now has a
regression test for the cycle specifically.

## Testing

```
tests/ids            identifier sanitisation, UUIDs, clamping
tests/png            PNG encoding, texture normalisation and resampling
tests/storage        IndexedDB round-trips and graceful degradation
tests/manifest       manifest shape and BP↔RP linkage
tests/packaging      zips, unzips, and validates the archive as Minecraft reads it
tests/texture-codec  packing textures for a saved file, and unpacking junk
tests/mob-uv         which rectangle of a skin lands on which bit of a creature
tests/mob-paint-flow the creature painter: the map, the parts, painting in 3D
tests/pixel-tools    drawing operations as pure functions
tests/pixel-editor   the editor driven through its real UI
tests/item           item JSON per preset, plus clamping of absurd values
tests/recipe         pattern cropping, key assignment, unknown-id rejection
tests/app-flow       new mod → download, end to end
tests/item-flow      the item wizard → download, end to end
tests/export-flow    onboarding, autosave, My Mods, delete confirmation
```

The UI tests drive real components with `@testing-library/user-event` and then
unzip the bytes the browser was actually handed, rather than asserting on
in-memory objects.

## On-device verification

**Verified working on Minecraft Bedrock v26.45 (internally 1.26.45) on
2026-08-30.** All three content types confirmed in game:

- **Items** appear, render their textures, are edible where applicable, and
  craft from their recipes.
- **Blocks** place and break, respect their hardness, glow, render see-through,
  show per-face textures, gate drops behind the required tool, and smelt.
- **Mobs** spawn, render their painted skins, walk with animated legs, and
  honour their mood and tame/breed/ride toggles.

Getting there took four real bugs and two false trails:

| # | Bug | Symptom | Caught by |
| --- | --- | --- | --- |
| 1 | Circular BP<->RP manifest dependency | "missing one or more dependencies" on import | on-device |
| 2 | `minecraft:icon` used the deprecated `texture` field | items load, register, are named — and render invisible | on-device |
| 3 | Schema pinned to 1.21.30 against a 1.26.45 client | same invisible-item symptom | on-device |
| 4 | Test fixtures regenerated UUIDs every build | every import became a NEW pack; the world kept loading an hours-old one | reading the world's own files |

Two false trails, both disproven by testing rather than argument: the PNG
encoder (a pack icon produced by it rendered fine, so Minecraft reads our
PNGs), and `minecraft:use_animation` (a control item without it was edible, so
food already worked).

### The testing loop that actually worked

Handing over `.mcaddon` files to import by hand was the biggest waste of time
here — not just slow but actively misleading, because bug 4 meant the game
kept loading a stale pack while newer ones piled up unactivated. Several
rounds of "still broken" were measuring code that was never running.

```bash
npm run install-local
```

writes the generated packs **directly into Minecraft's live world**, clears
previously injected test packs, and activates them in
`world_{behavior,resource}_packs.json`. Nothing to import, nothing to switch
on. It locates `com.mojang` across all three possible layouts — note that the
standalone Bedrock launcher keeps its data under
`%APPDATA%/Minecraft Bedrock/Users/<id>/games/com.mojang`, **not** under the
Microsoft Store package folders, which is why the Store paths all looked empty.

### What the test suite could not catch

All four bugs produced output that was internally consistent and schema-shaped,
so 126 passing tests had nothing to say about any of them. The tests verify our
bytes against our own understanding, which is worth having and is not the same
as the game agreeing. Where a doc and the game disagreed the game won every
time — and where the docs were ambiguous, Mojang's published `bedrock-samples`
vanilla packs settled it faster than the reference pages did.

Run `npm run sample` and open `sample-output/Ruby_Mod.mcaddon` to test.
