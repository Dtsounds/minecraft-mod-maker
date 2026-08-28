# Bedrock Mod Maker — Project Plan

## 1. Concept

A web app where a kid can create real Minecraft **Bedrock Edition** add-ons
(custom items, blocks, and mobs) through big colorful buttons, drag-and-drop,
and a pixel-art texture editor — **no typing JSON, no coding.** When they're
done, they click one button and download a `.mcaddon` file they can open
directly on their device to play with their creation in Minecraft.

Bedrock doesn't have "mods" the way Java Edition does (no Forge/Fabric,
no arbitrary code injection). Everything is either:
- **Data-driven JSON** (behavior pack + resource pack) — items, blocks,
  recipes, simple entity stats/behaviors, loot tables, textures, sounds.
- **Script API** (`@minecraft/server` etc., JavaScript/TypeScript) — for
  custom event-driven logic (optional, advanced).

For a kid-friendly v1, we target **JSON-only add-ons** — that alone covers
"give me a new sword," "make a purple creeper that drops diamonds," "add a
block that heals me." Visual scripting (Scratch-style blocks that emit
Script API code) is a later phase, not v1.

## 2. Target user & design principles

- Ages roughly 8–14, reading level should skew simple, some may not read fluently.
- **Can't break it**: every wizard produces a technically valid, importable
  add-on no matter what the kid picks. No blank text fields where a typo
  causes a silent failure.
- **Show, don't ask**: pick from an icon grid, pick from a texture swatch,
  drag a slider — avoid dropdowns full of jargon.
- **Instant visual feedback**: changing a stat or texture updates a live
  preview immediately.
- **Plain language**: "Power" not "Attack Damage," "Toughness" not "Armor
  Toughness," "How many hits to break" not "Durability."
- **Undo everywhere**, autosave to the browser (no login required for v1).
- **One export button** that always works: bundles everything into a
  `.mcaddon` and downloads it.
- Bright, game-like UI (think Scratch / Minecraft Education aesthetic), big
  touch targets — assume this may run on a school Chromebook or tablet.

## 3. Scope

### Phase 1 — MVP
- Project setup wizard: mod name, icon, short description → generates the
  behavior pack + resource pack shells with valid `manifest.json` pairs
  (matching UUIDs, correct `format_version`, `min_engine_version`,
  `dependencies` linking BP ↔ RP).
- **Pixel texture editor**: 16×16 (and 32×32/64×64 for blocks/items that
  want more detail) grid, color palette, fill/eraser/eyedropper, exports a
  transparent PNG.
- **Item creator**: name, icon (from the pixel editor or a built-in swatch
  library), item type preset (sword / pickaxe / axe / armor piece / food /
  plain item), sliders for damage/durability/hunger-restore as applicable,
  optional 3×3 crafting-grid recipe builder (drag vanilla items into slots).
- **Export**: packages BP + RP into one `.mcaddon`, downloads it, and shows
  a short kid-readable "how to open this on your device" guide.

### Phase 2
- **Block creator**: texture per face (or all-same), name, how many hits to
  break, what tool is needed, what it drops, whether it's solid/see-through/
  glows.
- Recipe editor extended to block recipes + smelting/furnace recipes.

### Phase 3
- **Mob/creature creator**: start from a vanilla mob template (cow, chicken,
  zombie, skeleton, etc. — reuses vanilla geometry/animations so no 3D
  modeling is needed), recolor via the pixel editor or a texture swatch,
  sliders for health/speed/damage, behavior toggle switches: Friendly /
  Hostile / Tameable / Rideable / Breedable, custom loot drops.

### Phase 4 — Stretch
- Scratch/Blockly-style visual scripting ("When a player touches this
  block → give them a potion effect") that compiles to `@minecraft/server`
  Script API code, added as a `scripts/` module in the behavior pack.

### Phase 5 — Stretch
- Optional accounts + cloud save, a gallery to share/import mods with a
  short code, remixing other kids' public creations.

### Explicit non-goals for v1–v3
- No raw JSON/code editing exposed in the UI.
- No custom 3D entity modeling/animation.
- No multiplayer server logic, no marketplace publishing.

## 4. Technical architecture

- **Stack**: React + TypeScript, Vite. Runs entirely client-side in the
  browser — no backend needed for v1–v3 (avoids hosting costs and any
  concern about handling data from child users, since nothing leaves the
  browser). Autosave project state to `IndexedDB`.
- **Texture/pixel editor**: custom `<canvas>` component (small enough not
  to need a heavy library) — grid draw, palette, undo stack, export to PNG
  via `canvas.toBlob`.
- **Packaging**: build the pack folder structure in memory, then zip with
  `JSZip` and trigger a browser download as `<modname>.mcaddon`.
- **Validation layer**: a small internal module that fills Bedrock JSON
  templates from the wizard's form state and guarantees required fields/
  UUIDs are always present — the kid-facing UI never has a state that
  produces invalid output.
- **Testing**: an automated check that every generated add-on actually
  matches the current Bedrock add-on JSON schema/shape (unit tests per
  generator: item, block, manifest), plus a manual smoke test importing a
  generated `.mcaddon` into real Minecraft Bedrock.

## 5. Bedrock add-on technical shape (for reference)

```
MyMod.mcaddon  (zip)
├── MyMod_BP/
│   ├── manifest.json        (header.uuid = BP-UUID, module.uuid = BP-mod-UUID,
│   │                          dependencies: [{uuid: RP-UUID, version}])
│   ├── items/*.json
│   ├── blocks/*.json
│   ├── entities/*.json
│   ├── recipes/*.json
│   ├── loot_tables/*.json
│   └── scripts/ (phase 4 only)
└── MyMod_RP/
    ├── manifest.json        (header.uuid = RP-UUID, module.uuid = RP-mod-UUID)
    ├── textures/
    │   ├── item_texture.json
    │   ├── terrain_texture.json
    │   ├── items/*.png
    │   └── blocks/*.png
    ├── models/entity/ (only if reusing vanilla geometry references)
    ├── entity/*.json  (client entity: texture + geometry + render controller refs)
    └── texts/en_US.lang (item/block/entity display names)
```

Key rules to get right (kids never see this, but the generator must):
- Every BP and RP has its own UUID; the BP manifest's `dependencies` array
  must reference the RP's UUID (and vice versa is not required, but keeping
  both consistent avoids import errors).
- `format_version` on each JSON file must match the schema version the
  generator targets — pick one current stable target version and pin it
  (Opus should confirm the current stable Bedrock format/version numbers
  when implementing, since Mojang revises these periodically).
- Namespaced identifiers required everywhere, e.g. `kidmod:ruby_sword`
  (lowercase, underscores, a consistent short namespace per mod/project).
- Item/block display names come from `texts/en_US.lang`, not the JSON
  itself.

## 6. Suggested build order (also mirrored in the Opus instructions below)

1. Repo scaffold, empty React/Vite/TS app, JSZip wired up.
2. Manifest/pack generator + "download empty valid .mcaddon" as the first
   working vertical slice (proves the packaging pipeline end to end).
3. Pixel texture editor component (standalone, testable on its own).
4. Item creator wizard wired to the generator + texture editor.
5. Export flow polish + kid-facing "how to install" instructions screen.
6. Ship MVP, test on-device, then move to Phase 2 (blocks) and beyond.
