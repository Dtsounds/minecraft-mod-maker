# Build prompt for Claude Opus: Bedrock Mod Maker

Paste everything below into a fresh Claude Code / Opus session in this
project's folder.

---

You are building **"Bedrock Mod Maker"**: a web app that lets a kid (roughly
ages 8–14, non-programmer) visually create real Minecraft **Bedrock
Edition** add-ons — no JSON, no code, no typing required beyond names. When
they're done, one button downloads a working `.mcaddon` file they can open
on their device to play with what they made.

## Ground truth on Bedrock add-ons (so you don't have to rediscover this)

Bedrock has no Forge/Fabric-style code mods. "Mods" are **add-ons**: a
**behavior pack** (BP, server-side data/logic — JSON) paired with a
**resource pack** (RP, client-side assets — textures/sounds/models/JSON),
zipped together as a single `.mcaddon`. Custom logic beyond stats/recipes
requires the `@minecraft/server` Script API (JS/TS) — **out of scope for
this build**; v1–v3 are JSON-only.

Required shape (verify exact current `format_version` numbers and current
`@minecraft/server` stable version against Microsoft's current Bedrock
add-on documentation before hardcoding them — Mojang/Microsoft revise these
periodically and your training data may be stale):

```
<ModName>.mcaddon  (a zip file)
├── <ModName>_BP/
│   ├── manifest.json
│   ├── items/*.json
│   ├── blocks/*.json
│   ├── entities/*.json
│   ├── recipes/*.json
│   └── loot_tables/*.json
└── <ModName>_RP/
    ├── manifest.json
    ├── textures/item_texture.json
    ├── textures/terrain_texture.json
    ├── textures/items/*.png
    ├── textures/blocks/*.png
    ├── entity/*.json
    └── texts/en_US.lang
```

- BP and RP each get their own UUID (`header.uuid`) plus a separate module
  UUID (`modules[0].uuid`). The BP manifest's `header.dependencies` must
  list the RP's `header.uuid` + matching version so Minecraft links them.
- Identifiers are namespaced: `<shortmodname>:<thing_name>`, lowercase,
  underscores only.
- Display names live in `texts/en_US.lang` as
  `item.<namespace>:<name>.name=Display Name`, not inline in the item JSON.
- Every generated file must be valid enough that Minecraft actually loads
  it without an import error — this is the single most important
  correctness bar for the whole project. If you're ever unsure of a current
  field name or schema shape, look it up rather than guessing.

## Product requirements

Full design rationale is in [`PLAN.md`](PLAN.md) in this folder — read it
first. Summary of what to build, in order:

### Milestone 0 — Scaffold
- React + TypeScript + Vite, client-side only, no backend.
- Add `jszip` for packaging.
- Set up `IndexedDB`-backed autosave of project state (so a kid doesn't
  lose work on refresh) — a thin wrapper is fine, don't pull in a heavy
  state library unless you judge it genuinely needed.

### Milestone 1 — Packaging pipeline (prove it end-to-end first)
- A "New Mod" flow: mod name, an icon (reuse the texture editor from
  Milestone 2 or a placeholder for now), short description.
- Generate valid BP + RP `manifest.json` pairs with correct UUIDs/
  dependencies from that input.
- "Download" button zips BP + RP into `<ModName>.mcaddon` via JSZip and
  triggers a browser download.
- Write an automated test that unzips the output and asserts the manifest
  pair is structurally valid (matching UUIDs, required fields present).
  Getting a real empty add-on importable into Minecraft before building
  any other feature is the point of this milestone — don't skip ahead.

### Milestone 2 — Pixel texture editor
- Standalone component: N×N grid (support 16×16 and 32×32), click/drag to
  paint, color palette + custom color picker, eraser, fill bucket,
  eyedropper, undo/redo.
- Exports a transparent PNG via canvas at the correct pixel size for
  Bedrock item/block textures.
- Should be usable/testable independent of the item/block wizards.

### Milestone 3 — Item creator
- Kid-facing wizard: name, texture (from Milestone 2 or a built-in swatch
  library of simple presets), pick a type preset — Sword / Pickaxe / Axe /
  Armor / Food / Plain Item — each preset exposes only the sliders that
  make sense for it (e.g. Sword → "Power" and "How many hits to break";
  Food → "How much hunger it fills"; Plain Item → nothing extra).
- Optional recipe step: a 3×3 crafting-grid UI where the kid drags vanilla
  Minecraft items (ship a small built-in list of common vanilla item
  icons/ids) into slots to define a shaped recipe, output = the new item.
- Wire this into the Milestone 1 generator: produces
  `items/<name>.json`, updates `item_texture.json`, writes the PNG, adds
  the `.lang` entry, optionally writes `recipes/<name>.json`.
- Every slider must map to a valid item component with sane clamped
  ranges — a kid should not be able to produce an invalid or absurd
  (e.g. negative durability) value.

### Milestone 4 — Export/onboarding polish
- After download, show a short, kid-readable, illustrated "how to open
  this on your device" screen (Bedrock's actual import mechanism —
  confirm current steps per platform: opening the `.mcaddon` file directly
  on mobile/Windows imports it into Minecraft; describe this simply).
- Full autosave + "My Mods" list (localStorage/IndexedDB-backed) so a kid
  can come back and keep editing.

### Milestone 5 — Block creator (Phase 2)
- Same pattern as items: name, texture(s) (all-faces-same or per-face),
  "how many hits to break," what tool is required, what it drops, solid /
  see-through / glows toggles.
- Extend the recipe editor to cover block recipes and a simple furnace/
  smelting recipe.

### Milestone 6 — Mob/creature creator (Phase 3)
- Start from a small fixed list of vanilla mob templates (reuse vanilla
  geometry + animations by referencing the vanilla client entity's
  geometry/animation identifiers — **do not attempt custom 3D modeling**).
- Kid can recolor/retexture via the pixel editor, adjust health/speed/
  damage sliders, and flip behavior toggles: Friendly/Hostile, Tameable,
  Rideable, Breedable — each toggle maps to a small fixed set of proven
  vanilla-style behavior components, not freeform behavior authoring.
- Custom loot table on death.

Treat Milestones 0–4 as the MVP to ship and validate on a real device
before starting Milestone 5.

## UX bar (apply to every screen you build)

- No dropdown lists of technical jargon; prefer icon grids and sliders
  with plain-language labels (see examples above).
- Every wizard produces a valid add-on for any input combination — validate
  and clamp in the generator layer, not just the UI.
- Big touch targets, high-contrast bright UI, must work well on a
  Chromebook/tablet touchscreen as well as desktop with a mouse.
- Undo available everywhere a kid can make a destructive change.
- No login/account required for the MVP — everything local to the browser.

## Testing expectations

- Unit tests for every JSON generator (manifest, item, block, recipe,
  entity) asserting output shape against the current Bedrock schema.
- A packaging test that unzips a generated `.mcaddon` and checks folder
  structure + manifest linkage.
- At the end of the MVP milestone, actually import a generated `.mcaddon`
  into real Minecraft Bedrock (or state clearly if you cannot access a
  Bedrock client to verify, and tell the user exactly what to test
  manually) — don't claim the export "works" without this check or an
  explicit caveat that it's untested on-device.

## Working agreement

- Confirm current Bedrock `format_version` values and current
  `@minecraft/server` module version against Microsoft's live docs before
  hardcoding them; don't rely purely on training-data recall for these
  numbers since they change with game updates.
- Keep the generator layer (form state → JSON/PNG output) cleanly
  separated from the UI layer, so new item/block/mob presets can be added
  without touching the packaging code.
- Ask before adding a backend, accounts, or any dependency that sends data
  off the user's machine — this is meant to stay a private, offline-capable
  kid's tool.
