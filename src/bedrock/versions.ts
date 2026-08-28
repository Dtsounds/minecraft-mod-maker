/**
 * Pinned Minecraft Bedrock schema versions.
 *
 * VERIFIED against Microsoft Learn's live Bedrock creator docs on 2026-08-28.
 * Everything in this file is a deliberate, cited choice — do not "modernise"
 * a number here without re-reading the linked page, because Mojang revises
 * these with game updates and a wrong value means the add-on silently fails
 * to import.
 *
 * Sources:
 *  - manifest.json reference (format_version 2 is stable; 3 is preview-only):
 *    https://learn.microsoft.com/en-us/minecraft/creator/reference/content/addonsreference/packmanifest
 *  - Latest Platform Version Guidance (the "N or N-1" rule, per-file-type
 *    minimum format versions):
 *    https://learn.microsoft.com/en-us/minecraft/creator/documents/practices/latestplatformversion
 *  - How to Add Custom Items (worked manifest + item + item_texture examples):
 *    https://learn.microsoft.com/en-us/minecraft/creator/documents/addcustomitems
 *  - minecraft:item reference (menu_category, component shapes, per-component
 *    minimum format versions):
 *    https://learn.microsoft.com/en-us/minecraft/creator/reference/content/itemreference/examples/itemcomponents/minecraft_item
 *  - Shaped recipe reference:
 *    https://learn.microsoft.com/en-us/minecraft/creator/reference/content/recipereference/examples/recipedefinitions/minecraftrecipe_shaped
 */

/**
 * manifest.json syntax version. The reference page states this "may be 1 for
 * skin packs or 2 for resource, behavior, and world templates. Version 3 is a
 * new update of the manifest currently in preview." We target 2.
 */
export const MANIFEST_FORMAT_VERSION = 2 as const;

/**
 * The floor engine version a player needs to load our packs.
 *
 * The retail line at time of writing is 1.26.x. Microsoft's guidance says to
 * target the newest release, but that guidance exists for Marketplace
 * conformance — for this tool the priority is the opposite: a kid's .mcaddon
 * must import on whatever build happens to be on their tablet, school
 * Chromebook, or console. min_engine_version is a *floor*: a client older
 * than this refuses the pack outright, while a newer client loads it fine.
 *
 * 1.21.0 is the oldest release that supports every component we emit, so it
 * is the widest floor we can pick without giving anything up.
 */
export const MIN_ENGINE_VERSION: readonly [number, number, number] = [1, 21, 0];

/**
 * format_version for behavior-pack items/*.json.
 *
 * 1.21.30 is comfortably inside stable and is the minimum that supports every
 * component this app can emit:
 *   minecraft:durability   >= 1.20.0
 *   minecraft:digger       >= 1.20.30
 *   minecraft:use_modifiers>= 1.20.50   (required for minecraft:food to work)
 *   menu_category          >= 1.20.x
 *   minecraft:dyeable      >= 1.21.30
 */
export const ITEM_FORMAT_VERSION = '1.21.30' as const;

/**
 * format_version for behavior-pack recipes/*.json. The recipe schema has been
 * stable for a long time; the docs' own vanilla examples still ship 1.12–1.20.
 * 1.20.10 is the well-proven value for shaped/shapeless crafting recipes.
 */
export const RECIPE_FORMAT_VERSION = '1.20.10' as const;

/**
 * format_version for behavior-pack blocks/*.json (Milestone 5).
 */
export const BLOCK_FORMAT_VERSION = '1.21.30' as const;

/**
 * Pack version reported in both manifests. Bumped when a kid re-exports so
 * Minecraft replaces the previously imported copy instead of ignoring it.
 */
export const DEFAULT_PACK_VERSION: readonly [number, number, number] = [1, 0, 0];

/**
 * Note: textures/item_texture.json and textures/terrain_texture.json have
 * "(no versioning concept)" per the platform-version guidance page — they
 * carry no format_version field at all. Do not add one.
 */
