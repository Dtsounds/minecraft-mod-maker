# Bedrock schema cheat sheet

Every fact here was verified against Microsoft's live docs or Mojang's
`bedrock-samples`, and most were confirmed working in a real client on
**2026-08-30, Bedrock v26.45**.

**Grep this file before fetching anything online.** The reference pages are
~60KB each and were wrong or misleading three separate times; the entries below
marked ⚠️ are the ones that actually broke.

Version numbering note: since 2026 the client shows a year-based string
(`v26.45`) but pack JSON still uses the old scheme — that build is `1.26.45`.

---

## Pinned versions

| File | `format_version` |
| --- | --- |
| `manifest.json` | `2` (integer; v3 is preview-only) |
| `min_engine_version` | `[1, 26, 0]` |
| `items/*.json` | `"1.26.40"` |
| `blocks/*.json` | `"1.26.40"` |
| `recipes/*.json` | `"1.26.40"` |
| `entities/*.json` | `"1.21.0"` ⚠️ deliberately older, see below |
| `entity/*.entity.json` (RP) | `"1.10.0"` |
| `models/entity/*.geo.json` | `"1.12.0"` |
| `textures/*_texture.json` | none — these have no versioning concept |

⚠️ **Entities stay below 1.26.40 on purpose.** The 1.26.40 notes: entity
definitions at 1.26.40+ "now fail to load when invalid data is supplied to
several components and AI goals". The platform guidance separately exempts
entities from the N-1 rule ("entity type versioning is highly variable").

⚠️ **Don't target an old schema for everything else.** Items were pinned at
1.21.30 against a 1.26.45 client and every texture was invisible, because
`minecraft:icon` changed shape in between.

## Manifest

`dependencies` is a **top-level** section, not under `header`.

⚠️ **One-directional only: BP → RP.** A mutual BP↔RP dependency is a cycle
Minecraft cannot resolve; it refuses the import with *"missing one or more
dependencies"*. Microsoft's own RP example has no `dependencies` at all.

Four distinct UUIDs: BP header, BP module, RP header, RP module. A pack's
identity **is** its header UUID — keep it stable so re-imports update in place
instead of stacking up duplicates.

Module types: `data` (BP), `resources` (RP).

## Three registries, three sets of rules

These differ in ways that fail **silently**:

| | Items | Blocks | Mobs |
| --- | --- | --- | --- |
| texture atlas | `item_texture.json` (`atlas.items`) | `terrain_texture.json` (`atlas.terrain`) | direct path, no atlas |
| texture folder | `textures/items/` | `textures/blocks/` | `textures/entity/` |
| lang key | `item.<ns>:<id>=Name` | `tile.<ns>:<id>.name=Name` | `entity.<ns>:<id>.name=Name` |
| `minecraft:loot` | n/a | bare string path | object `{ "table": path }` |

Spawn eggs get their own key: `item.spawn_egg.entity.<ns>:<id>.name=…`

## Items

⚠️ **`minecraft:icon` must use the `textures` map.** The flat `texture` field is
documented as *"Deprecated - no longer in use"*. An item using it loads,
registers, answers `/give` and shows its name — and renders **completely
invisible**. Nothing but an in-game look catches this.

```json
"minecraft:icon": { "textures": { "default": "<atlas key>" } }
```

Verified component pairings — each is inert without its partner:

| Want | Needs |
| --- | --- |
| edible | `minecraft:food` **+** `minecraft:use_modifiers` |
| bow | `minecraft:shooter` **+** `minecraft:use_modifiers`; ammo item needs `minecraft:projectile` (vanilla arrows have it) |
| throwable | `minecraft:throwable` **+** `minecraft:projectile` on the item itself |

`minecraft:use_animation` is **not** needed for food — a control item without it
was still edible. Don't add it "to be safe".

Bow ammunition needs `search_inventory: true` and `use_in_creative: true`, or
the bow is silently inert in Creative.

`menu_category.category` ∈ `construction | equipment | items | nature | none`.

Armor slots: `slot.armor.head|chest|legs|feet`, `slot.weapon.offhand`.

Digger tags: `minecraft:is_{pickaxe,axe,shovel}_item_destructible`.

## Blocks

⚠️ **`minecraft:geometry` and `minecraft:material_instances` must BOTH be
present** if either is (since 1.21.80). Shipping one alone fails to load.

```json
"minecraft:geometry": "minecraft:geometry.full_block",
"minecraft:material_instances": { "*": { "texture": "<key>", "render_method": "opaque" } }
```

Faces: `*` is the fallback; `up`/`down`/`north`/`south`/`east`/`west` override.
There is **no** `sides` face.

`render_method` ∈ `opaque | blend | alpha_test | alpha_test_single_sided |
double_sided | blend_to_opaque | alpha_test_to_opaque |
alpha_test_single_sided_to_opaque`.

⚠️ `minecraft:light_emission` is an **integer 0–15**; 1.26.20+ rejects
out-of-range values at load time.

`seconds_to_destroy` reference points: wool 0.8, concrete slab 1.8, sand 7.5.

⚠️ **Tool requirements cannot use `item_specific_speeds`** — the reference says
it "currently requires UpcomingFeatures experiment to be enabled". Gate the
*drop* via the loot table instead:

```json
"conditions": [{ "condition": "match_tool",
  "minecraft:match_tool_filter_all": ["minecraft:is_tool", "minecraft:is_pickaxe"] }]
```

Consequence, surfaced in the UI: the wrong tool still breaks the block, it just
yields nothing — same as vanilla stone by hand.

"Drops nothing" means **omitting** `minecraft:loot`, not pointing it at a
missing file.

## Mobs

Four files, all required:

```
BP  entities/<name>.json
RP  entity/<name>.entity.json
RP  models/entity/<name>.geo.json
RP  textures/entity/<name>.png
```

⚠️ **Don't reference vanilla geometry identifiers.** They are versioned and
churn (`geometry.pig.v1.8` → `geometry.pig.v3`, `geometry.cow.v2`), and vanilla
UV layouts are sized like 64×32. We ship our own rigs instead — see
`src/bedrock/mobGeometry.ts`.

Animation **is** reused from vanilla: `animation.quadruped.walk` animates
exactly `leg0`–`leg3` (verified in Mojang's `quadruped.animation.json`), so any
rig naming its legs that way gets vanilla leg movement free. Extra leg names are
simply ignored.

Client entity: `materials: { default: "entity_alphatest" }` and
`render_controllers: ["controller.render.default"]` — the stock pair for one
texture and one geometry. No custom render controller needed.

Modern vanilla mobs are full of climate-variant properties; **don't copy
`cow.json`**. `chicken.json` is the simple reference for component shapes.

Behaviour goals all take a numeric `priority` (lower runs first). Vanilla
ordering: float 0, panic 1, attack 2–3, breed 4, tempt 5, stroll 6,
look_at_player 7, random_look_around 8.

## Recipes

Shaped patterns must be **cropped to their bounding box**. A single centred
ingredient becomes `["A"]`, not `["   ", " A ", "   "]` — the uncropped form is
only craftable from those exact squares.

Furnace: `minecraft:recipe_furnace` with `input` and `output` as plain strings,
`tags: ["furnace", "blast_furnace"]`.

## Useful bedrock-samples paths

```
behavior_pack/items/apple.json                  simple item
behavior_pack/entities/chicken.json             simple entity
behavior_pack/blocks/*.block.json               (preview branch only)
behavior_pack/loot_tables/blocks/*.json
resource_pack/entity/*.entity.json              client entities
resource_pack/textures/item_texture.json        atlas shape
resource_pack/textures/terrain_texture.json     atlas shape
resource_pack/render_controllers/default.render_controllers.json
resource_pack/animations/quadruped.animation.json
```
