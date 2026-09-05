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

✅ **One identifier may be reused across registries.** An item and a block both
called "Ruby" ship as `ns:ruby` twice, and BDS loads the pack with **no content-log
complaint at all** — checked on a live server, not inferred. So the generator
de-duplicates names *within* each registry and not across them. Display names are
independent too: the three lang key shapes above never collide.

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

⚠️ **Without `minecraft:enchantable` an item cannot be enchanted AT ALL** — not
at a table, not on an anvil, not with a book — while every vanilla equivalent
can. Nothing in game explains the refusal. Needs `format_version` ≥ 1.20.30.

```json
"minecraft:enchantable": { "slot": "sword", "value": 14 }
```

`slot` ∈ `none|all|g_armor|armor_head|armor_torso|armor_feet|armor_legs|sword|
bow|spear|crossbow|melee_spear|g_tool|hoe|shears|flintsteel|shield|g_digging|
axe|pickaxe|shovel|fishing_rod|carrot_stick|elytra|cosmetic_head`.

⚠️ **A chestplate is `armor_torso` here but `slot.armor.chest` in
`minecraft:wearable`.** Two vocabularies for one concept, one component apart.

`value` is vanilla enchantability: gold 22, wood 15, iron 14, diamond 10,
stone 5. Higher means better enchantments for fewer levels.

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

⚠️ **`unlock` is REQUIRED since 1.20** on shaped recipes. Without it the recipe
is rejected outright and never registers:

```
[Recipes][error] recipes/x.json | ns:craft_x | 1.20+ Recipes require unlock data
```

It sits between `key` and `result`, and vanilla unlocks on the recipe's own
ingredients — Mojang's `diamond_sword.json` uses
`"unlock": [ { "item": "minecraft:diamond" } ]`. The Learn reference does not
document the field **at all**; `bedrock-samples` was the only source that had it.

This one is the best argument in this file for reading the content log. Every
recipe the generator emitted for the first two days was dead on arrival, and
nothing showed it: the item still existed, still answered `/give`, still had a
name and a texture. Only the log knew.

⚠️ A recipe with the **same ingredients as a vanilla one** logs a duplicate
warning and both stay craftable. Harmless, but avoid it in test fixtures —
diamond+diamond+stick is literally vanilla's diamond sword.

## Script API (Phase 4) — VERIFIED

Confirmed on 2026-08-31 against retail 1.26.45 **and** Bedrock Dedicated Server
1.26.45.1: packs load, all eight rule actions execute, and every trigger fires
from real player input.

A script-enabled BP adds a **third module** and a **second kind of dependency**:

```json
"modules": [
  { "type": "data",   "uuid": "<bp module>",     "version": [1, 0, 0] },
  { "type": "script", "language": "javascript",
    "entry": "scripts/main.js",
    "uuid": "<a FIFTH uuid>", "version": [1, 0, 0] }
],
"dependencies": [
  { "uuid": "<rp header>",          "version": [1, 0, 0] },
  { "module_name": "@minecraft/server", "version": "2.0.0" }
]
```

⚠️ **Two different dependency shapes in one array.** A pack dependency is
`uuid` + a `[x,y,z]` array. A script-module dependency is `module_name` + a
**string** semver. Same array, different schema.

⚠️ **The version floor is the dangerous field.** Declare a version the engine
does not have and the pack fails to load *entirely*. Within a major version
Minecraft resolves like npm's `^`: a dependency on `2.0.0` "may actually have
that dependency fulfilled with" a higher `2.x`. So a **low floor is strictly
safer than a high one**, which is the opposite of Microsoft's published advice
(that advice targets marketplace content chasing new APIs — not our case).

Confirmed in the client's own words — this is the promotion happening live:

```
[Scripting] Plugin Discovered [LocalTest] ModuleId [fbc8b6e5-...]
[Scripting] Plugin [LocalTest] - promoted [@minecraft/server]
            from [2.0.0] to [2.9.0] requested by [LocalTest - 1.0.0]
```

Mapping the module version to the game build, since Learn's table is stale
(it stops at 1.21.60 and was last touched 2025-07):

| npm dist-tag | version string | implies game build |
| --- | --- | --- |
| `latest` (stable) | `2.9.0` | current retail — this client is 1.26.45 |
| `rc` | `2.10.0-rc.1.26.50-preview.27` | 1.26.50 preview |
| `beta` | `2.11.0-beta.1.26.50-preview.27` | 1.26.50 preview |

The rc/beta tags embed the build number, which is what pins stable 2.9.0 to
retail 1.26.4x. We target floor **`2.0.0`** (published, stable, same major).

**Stable modules need no experiment.** Only `-beta` modules require the "Beta
APIs" world toggle — a hard requirement for us, since a kid must never have to
find a settings switch.

Major 1 → 2 was a breaking change; 1.x and 2.x are different API surfaces.
Verify any `world.afterEvents.*` name against the **v2** signature, not v1.

⚠️ **The "V2 needs the Beta APIs experiment" line in the V2 Overview is
stale.** It was written (ms.date 2025-07) while 2.0.0 was still beta, and the
same page says "when version 2.0.0 comes out of beta and into stable...".
It since has: npm's `latest` is a plain `2.9.0`. What settles it is the
WorldAfterEvents reference in its **stable** view (updated 2026-08-18), which
lists `worldLoad` — an event that *only exists in V2*, having been renamed from
`worldInitialize` — with no experimental fence around it.

Event names confirmed present in the stable set: `itemUse`, `playerBreakBlock`,
`playerPlaceBlock`, `entityHitEntity`, `entityDie`, `entityHurt`,
`playerSpawn`, `projectileHitEntity`, `worldLoad`. Anything wrapped in
`moniker range="minecraft-bedrock-experimental"` on that page is *not* safe for
us — it needs the experiment.

Under V2 scripts run in **early execution**, where most of the `world` object
throws. `world.afterEvents.*.subscribe` is explicitly allowed there; anything
touching world state must wait for `worldLoad` or an event callback.

Order note: import declarations hoist, so a `const` above an `import` is legal
JavaScript. We still emit the import first — "legal per spec" and "what the
engine does" have already diverged three times in this project.



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
