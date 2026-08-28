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
 * NOTE ON VERSION NUMBERING: as of 2026 Minecraft's public version string is
 * year-based (the retail client shows "v26.45"), but pack JSON still uses the
 * old scheme, where that same build is `1.26.45`. So a client displaying
 * "26.45" wants 1.26.x content.
 *
 * This was originally pinned to [1, 21, 0] to maximise the range of clients
 * that could load a kid's add-on, reasoning that min_engine_version is only a
 * floor. That was the wrong trade. Bedrock auto-updates on every platform, so
 * essentially nobody is running an old client — while targeting a stale
 * schema actively breaks on current ones. Microsoft's own guidance is to
 * target the newest release, and on-device testing agreed.
 */
export const MIN_ENGINE_VERSION: readonly [number, number, number] = [1, 26, 0];

/**
 * format_version for behavior-pack items/*.json.
 *
 * This is the schema version the item file is parsed against, and it must
 * agree with the FIELD SHAPES used inside the file. That coupling caused a
 * real bug: minecraft:icon changed from `{"texture": key}` to
 * `{"textures": {"default": key}}`, and declaring the newer field under an
 * older format_version produced items that loaded, registered, responded to
 * /give and showed their names — while rendering completely invisible.
 *
 * Microsoft's platform guidance says item types should be within one minor
 * version of the retail release ("N or N-1"). The retail line is 1.26.x, so
 * 1.21.30 was well outside that window.
 *
 * 1.26.40 is the newest documented stable update at time of writing. Note
 * that item definitions at 1.26.30+ must contain at least one entry in
 * `minecraft:item.components` or they fail to register — we always emit an
 * icon and a display name, so that holds.
 */
export const ITEM_FORMAT_VERSION = '1.26.40' as const;

/**
 * format_version for behavior-pack recipes/*.json.
 *
 * The recipe schema itself has been stable for years and the docs' vanilla
 * examples still ship 1.12-1.20, but the platform guidance lists recipes as
 * an "N-1" file type, and the item mismatch above is a good argument for not
 * leaving any file several drops behind the client that has to read it.
 */
export const RECIPE_FORMAT_VERSION = '1.26.40' as const;

/**
 * format_version for behavior-pack blocks/*.json (Milestone 5).
 */
export const BLOCK_FORMAT_VERSION = '1.26.40' as const;

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
