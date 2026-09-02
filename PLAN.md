# Bedrock Mod Maker — Project Plan

> ## Where this actually stands — 31 August 2026
>
> **Live at https://dtsounds.github.io/minecraft-mod-maker/** — pushed to
> GitHub Pages automatically on every commit to `master`.
>
> **Phases 1–4 are built and verified in the real game.** Items, blocks,
> creatures, recipes and rules all work on-device. The sections
> below are the original plan, kept for the reasoning — read this box for what
> is actually true. 301 tests.
>
> **Phase 4 shipped as a rule builder, not Blockly.** "When [trigger] → do
> [action]", six triggers and eight actions, built from presets like every
> other creator. The deciding argument was this project's own non-negotiable:
> every add-on must be valid for *any* input. A general block workspace can
> express infinitely many programs, plenty of which throw at runtime — and a
> Bedrock script error is *silent*, visible only in the content log. A closed
> vocabulary can be checked exhaustively. The rule model is a strict subset of
> blocks, so **Blockly remains open as an advanced mode** on top of it.
>
> **Beyond the original plan**, the app now also:
> - saves a mod to a `.modmaker.json` file and opens it back up
> - installs as a PWA and runs with no network
> - requests persistent storage, so mods are not evicted as cache
>
> Section 4 below says "no backend needed for v1–v3 (avoids hosting costs)".
> Still true: it is hosted, but it is *static* hosting. There is no backend, no
> account, and nothing about a child leaves their browser — not even a font,
> which is why the pixel font is self-hosted rather than linked from Google.
>
> ### What changed about how we verify things
>
> The single most useful lesson of this build: **`npm test` was green through
> every real bug.** It verifies our bytes against our own understanding of the
> schema, which is exactly the thing that was wrong. Two tools now close that
> gap, and `CLAUDE.md` has the detail:
>
> - `npm run check-log` — reads what Minecraft itself said about the packs on
>   its last launch. This is how we found that **every crafting recipe the app
>   had ever generated was rejected at load**, for two days, while the suite
>   stayed green and the mod looked fine.
> - `npm run serve-test` — runs the packs against a real Bedrock Dedicated
>   Server with nobody playing, and reports on all eight rule actions.
>
> ### Done since
>
> - **Painting a creature is no longer guesswork.** The skin canvas now shows
>   which rectangle is which part and which face, greys out the two thirds of
>   it that map onto nothing, lets a kid paint one part at a time, and shows
>   the assembled creature in 3D beside the grid, updating as they paint. All
>   of it derived from the rig by `src/bedrock/mobUv.ts`.
> - **Restyled as a creator tool**, not a kids' toy: graphite, one amber
>   accent, hairlines, an inline-SVG icon set in place of emoji on every
>   control. Game pictograms (items, mobs, presets) stay as emoji deliberately.
>   The page also uses the window now — it was capped at 1180px, and the 3D
>   stage was a fixed 420px however big the screen was.
> - **Picking a body part zooms the camera to it**, so painting a chicken's
>   foot is not aiming at four pixels. The rest fades and stops taking paint.
> - **You can paint on the creature itself, and that is now the whole page.**
>   Each face of the 3D model is a grid of its own texture pixels, so clicking
>   the nose paints the nose — no raycasting, and the model is as testable as
>   the flat grid. The flat sheet folds away behind a button and reopens as a
>   large pop-up for fiddly work. Both surfaces edit one texture through one
>   undo stack.
> - **Backup files shrunk ~22x.** A saved texture is now a palette plus a
>   run-length string rather than one hex string per pixel, so the on-device
>   test mod's `.modmaker.json` went from 353KB to 16KB and a 64x64 creature
>   skin from ~50KB to ~2KB. `src/storage/textureCodec.ts`; the app's own state
>   and the generated `.mcaddon` bytes are untouched, and format-1 files still
>   open.
>
> ### Genuinely next, roughly in order of value
>
> 1. **Block sounds.** The content log says `No sound found for block type
>    'normal'` — custom blocks are silent to walk on and break. Small, real.
> 1b. **Eyeball the 3D creature in a browser.** The rectangles, the orientation
>    and painting-by-click are covered by tests and by rendering the rigs out
>    flat; what nobody has done is *look* at the CSS-transformed version, or
>    drag a stroke across it. Mirrored limbs are the likeliest thing to be
>    subtly wrong.
> 2. **More triggers and actions.** Cheap and additive now the machinery exists;
>    add a preset, not packaging code.
> 3. **Pack textures in IndexedDB too**, the same way. Autosave is where a kid's
>    twenty mods actually live, and storage pressure is what eviction follows.
> 4. **Blockly as an advanced mode**, if rules start to feel limiting.
> 5. **A desktop build (Tauri)** — but only to kill the `.mcaddon` import dance
>    by writing straight into Minecraft's folder, which is the one thing a
>    browser cannot do. `scripts/install-local.mts` already does exactly that.
>    Not for storage; storage is solved. Costs code signing, installers, and
>    the school-Chromebook story.
> 6. **Phase 5** (accounts, cloud save, sharing) — the first thing that would
>    put a backend and children's data in scope. Weigh that carefully.

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
