# Bedrock Mod Maker

A browser app where a kid (roughly 8–14, non-programmer) visually creates real
Minecraft **Bedrock Edition** add-ons — no JSON, no code — and downloads a
working `.mcaddon` they can open on their device to play with.

Everything runs client-side. There is no backend, no account, and nothing
leaves the browser; projects autosave to IndexedDB.

## Running it

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # 122 tests
npm run build
npm run sample     # writes a real .mcaddon to sample-output/ for device testing
```

## What's built

| Milestone | Status |
| --- | --- |
| 0 — Scaffold, JSZip, IndexedDB autosave | ✅ |
| 1 — Packaging pipeline (BP/RP manifests → `.mcaddon`) | ✅ |
| 2 — Pixel texture editor | ✅ |
| 3 — Item creator (7 presets + 3×3 recipe builder) | ✅ |
| 4 — Export onboarding + My Mods | ✅ |
| 5 — Block creator | not started |
| 6 — Mob creator | not started |

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
  package.ts      JSZip + browser download
```

### Pinned Bedrock versions

Verified against Microsoft Learn's live creator docs on **2026-08-28**. See
`src/bedrock/versions.ts` for the citations and the reasoning behind each
choice.

| Thing | Value |
| --- | --- |
| manifest `format_version` | `2` (v3 is preview-only) |
| `min_engine_version` | `[1, 21, 0]` |
| items `format_version` | `"1.21.30"` |
| recipes `format_version` | `"1.20.10"` |
| `textures/*_texture.json` | no `format_version` (none exists for these) |

`min_engine_version` is deliberately conservative. Microsoft's guidance is to
target the newest release, but that exists for Marketplace conformance; here
the priority is the opposite — the file has to import on whatever build is on
a kid's tablet. `min_engine_version` is a floor, so a lower value works on more
devices and costs nothing on newer ones.

Two details in `OPUS_BUILD_PROMPT.md` did not match the live docs, and the docs
won:

- Manifest `dependencies` is a **top-level** section, not `header.dependencies`.
- The `.lang` display-name key is `item.<ns>:<id>=Name`, **not** `…​.name=Name`.

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

Import status is tracked here because the structural tests cannot substitute
for it:

- **2026-08-28** — first on-device import **failed**: "missing one or more
  dependencies", caused by a circular BP↔RP manifest dependency. Fixed; see
  *Dependency direction* above.
- **2026-08-28** — items imported, registered and named correctly but were
  **invisible**. Two independent causes:
  1. `minecraft:icon` was written as `{"texture": key}`. That field is
     documented as *"Deprecated - no longer in use"*; the current shape is
     `{"textures": {"default": key}}`. An item using the old field loads,
     registers, and shows its name while rendering nothing at all.
  2. The resource pack was not activated in the world. Microsoft's docs say
     activating the behavior pack auto-activates its linked resource pack;
     in practice it did not, so the onboarding now tells you to switch on
     both and names the invisible-item symptom explicitly.
- **Pending** — re-import after the icon fix, and confirmation of textures,
  edible food, and recipe cropping.

### What the test suite could not catch

Three separate bugs (circular dependency, deprecated icon field, resource
pack not activated) all produced output that was internally consistent and
schema-shaped. The tests verified our own bytes against our own
understanding, which is worth a lot but is not the same as the game agreeing.
Where a doc and the game disagreed, the game won every time.

Run `npm run sample` and open `sample-output/Ruby_Mod.mcaddon` to test.
