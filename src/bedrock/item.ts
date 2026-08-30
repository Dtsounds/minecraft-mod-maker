import { ITEM_FORMAT_VERSION } from './versions';
import { clampInt, toIdentifier, toIdentifierSegment } from './ids';
import {
  ARMOR_SLOTS,
  DIGGER_KINDS,
  DIGGER_TAG,
  ITEM_PRESETS,
  TOOL_KINDS,
  armorSlotSpec,
  projectileSpec,
} from './presets';
import type { ItemKind, ModItem } from './types';

export interface ItemJson {
  format_version: string;
  'minecraft:item': {
    description: {
      identifier: string;
      menu_category: { category: string; group?: string };
    };
    components: Record<string, unknown>;
  };
}

/** Creative-inventory tab. Valid values: construction, equipment, items, nature, none. */
function menuCategory(kind: ItemKind): { category: string; group?: string } {
  switch (kind) {
    case 'sword':
    case 'pickaxe':
    case 'axe':
    case 'shovel':
    case 'bow':
    case 'throwable':
    case 'armor':
      return { category: 'equipment' };
    case 'food':
      return { category: 'nature' };
    default:
      return { category: 'items' };
  }
}

/** Read a slider value back through its preset's clamp. Never trusts input. */
export function clampedSlider(
  item: ModItem,
  key: 'power' | 'durability' | 'digSpeed' | 'protection' | 'nutrition' | 'stackSize' | 'drawTime' | 'throwPower',
): number {
  const spec = ITEM_PRESETS[item.kind].sliders.find((s) => s.key === key);
  const raw = item[key];
  if (!spec) {
    // Slider isn't part of this preset; fall back to a globally safe value.
    return clampInt(typeof raw === 'number' ? raw : 1, 1, 64);
  }
  return clampInt(typeof raw === 'number' ? raw : spec.min, spec.min, spec.max);
}

/** The identifier this item will have inside the pack, e.g. `rubymod:ruby_sword`. */
export function itemIdentifier(namespace: string, item: ModItem): string {
  return toIdentifier(namespace, item.name, 'my_item');
}

/** Short name used for filenames and texture keys. */
export function itemShortName(item: ModItem): string {
  return toIdentifierSegment(item.name, 'my_item');
}

/**
 * Build `items/<name>.json`.
 *
 * Component choices are grounded in the minecraft:item reference; the notable
 * one is that `minecraft:food` is inert on its own — the docs state it
 * "Must have the 'minecraft:use_modifiers' component in order to function
 * properly", so food items always get both.
 *
 * The display name is written twice on purpose: as a `minecraft:display_name`
 * component *and* as an en_US.lang entry. Either alone is enough on a current
 * client, but together a kid can never end up staring at a raw
 * `item.rubymod:ruby_sword` string in their inventory.
 */
export function buildItemJson(namespace: string, item: ModItem): ItemJson {
  const ns = toIdentifierSegment(namespace, 'mymod');
  const shortName = itemShortName(item);
  const identifier = `${ns}:${shortName}`;
  const displayName = item.name.trim() || 'My Item';

  const components: Record<string, unknown> = {
    // NOTE: the shape here matters. `{ texture: "key" }` is documented as
    // "Deprecated - no longer in use" on the minecraft:icon reference page,
    // and an item using it renders completely invisible in-game while
    // otherwise working perfectly. The current shape is a `textures` map
    // whose `default` entry names the key from item_texture.json.
    'minecraft:icon': { textures: { default: identifier } },
    'minecraft:display_name': { value: displayName },
  };

  const isTool = TOOL_KINDS.includes(item.kind);
  const isDigger = DIGGER_KINDS.includes(item.kind);

  if (isTool) {
    components['minecraft:max_stack_size'] = 1;
    components['minecraft:hand_equipped'] = true;
    components['minecraft:damage'] = { value: clampedSlider(item, 'power') };
    components['minecraft:durability'] = {
      max_durability: clampedSlider(item, 'durability'),
      damage_chance: { min: 100, max: 100 },
    };
  }

  if (isDigger) {
    const tag = DIGGER_TAG[item.kind];
    if (tag) {
      components['minecraft:digger'] = {
        use_efficiency: true,
        destroy_speeds: [
          {
            block: { tags: `query.any_tag('${tag}')` },
            speed: clampedSlider(item, 'digSpeed'),
          },
        ],
      };
    }
  }

  if (item.kind === 'bow') {
    // The shooter reference is explicit on both of these: it "must have the
    // minecraft:use_modifiers component in order to function properly", and
    // its ammunition "must have the minecraft:projectile component". Vanilla
    // arrows already carry projectile, which is why arrows are the ammo.
    const drawTime = clampedSlider(item, 'drawTime');
    components['minecraft:max_stack_size'] = 1;
    components['minecraft:hand_equipped'] = true;
    components['minecraft:durability'] = {
      max_durability: clampedSlider(item, 'durability'),
      damage_chance: { min: 100, max: 100 },
    };
    components['minecraft:shooter'] = {
      ammunition: [
        {
          item: 'minecraft:arrow',
          search_inventory: true,
          use_in_creative: true,
          use_offhand: true,
        },
      ],
      max_draw_duration: Math.round(drawTime * 0.2 * 10) / 10,
      scale_power_by_draw_duration: true,
      charge_on_draw: false,
    };
    components['minecraft:use_modifiers'] = {
      use_duration: 999,
      movement_modifier: 0.35,
    };
  }

  if (item.kind === 'throwable') {
    // The item itself becomes the projectile, so it needs minecraft:projectile
    // naming the ENTITY to spawn — unlike a bow, where the arrow carries it.
    const power = clampedSlider(item, 'throwPower');
    const projectile = projectileSpec(item.projectileKind ?? 'arrow');
    components['minecraft:max_stack_size'] = clampedSlider(item, 'stackSize');
    components['minecraft:throwable'] = {
      do_swing_animation: true,
      launch_power_scale: 1.0,
      max_launch_power: Math.round(power * 0.2 * 10) / 10,
      scale_power_by_draw_duration: false,
    };
    components['minecraft:projectile'] = {
      projectile_entity: projectile.entity,
      minimum_critical_power: 1.25,
    };
    components['minecraft:use_modifiers'] = {
      use_duration: 0.1,
      movement_modifier: 1.0,
    };
  }

  if (item.kind === 'armor') {
    const slot = armorSlotSpec(
      ARMOR_SLOTS.some((s) => s.slot === item.armorSlot) ? item.armorSlot : 'chest',
    );
    components['minecraft:max_stack_size'] = 1;
    components['minecraft:wearable'] = {
      protection: clampedSlider(item, 'protection'),
      slot: slot.wearableSlot,
    };
    components['minecraft:durability'] = {
      max_durability: clampedSlider(item, 'durability'),
      damage_chance: { min: 100, max: 100 },
    };
    components['minecraft:tags'] = { tags: ['minecraft:is_armor'] };
  }

  if (item.kind === 'food') {
    components['minecraft:max_stack_size'] = 64;
    components['minecraft:food'] = {
      nutrition: clampedSlider(item, 'nutrition'),
      saturation_modifier: 0.6,
      can_always_eat: item.canAlwaysEat === true,
    };
    // Required alongside minecraft:food, per the item component reference.
    components['minecraft:use_modifiers'] = {
      use_duration: 1.6,
      movement_modifier: 0.35,
    };
  }

  if (item.kind === 'plain') {
    components['minecraft:max_stack_size'] = clampedSlider(item, 'stackSize');
  }

  return {
    format_version: ITEM_FORMAT_VERSION,
    'minecraft:item': {
      description: {
        identifier,
        menu_category: menuCategory(item.kind),
      },
      components,
    },
  };
}
