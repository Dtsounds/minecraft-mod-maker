import { describe, expect, it } from 'vitest';
import { buildItemJson } from '../src/bedrock/item';
import { createItem } from '../src/bedrock/project';
import { ITEM_PRESETS, ITEM_PRESET_ORDER } from '../src/bedrock/presets';
import { ITEM_FORMAT_VERSION } from '../src/bedrock/versions';
import type { ItemKind, ModItem } from '../src/bedrock/types';

function make(kind: ItemKind, overrides: Partial<ModItem> = {}): ModItem {
  return { ...createItem(kind), name: 'Test Thing', ...overrides };
}

const VALID_CATEGORIES = ['construction', 'equipment', 'items', 'nature', 'none'];

describe('item JSON shape', () => {
  it('uses the pinned item format_version', () => {
    expect(buildItemJson('mymod', make('sword')).format_version).toBe(ITEM_FORMAT_VERSION);
  });

  it('emits a namespaced, sanitised identifier', () => {
    const json = buildItemJson('Ruby Mod', make('sword', { name: 'Ruby Sword!!' }));
    expect(json['minecraft:item'].description.identifier).toBe('ruby_mod:ruby_sword');
  });

  it('always has an icon and a display name', () => {
    for (const kind of ITEM_PRESET_ORDER) {
      const components = buildItemJson('mymod', make(kind))['minecraft:item'].components;
      expect(components['minecraft:icon']).toEqual({ texture: 'mymod:test_thing' });
      expect(components['minecraft:display_name']).toEqual({ value: 'Test Thing' });
    }
  });

  it('uses a valid menu_category for every preset', () => {
    for (const kind of ITEM_PRESET_ORDER) {
      const { category } = buildItemJson('mymod', make(kind))['minecraft:item'].description.menu_category;
      expect(VALID_CATEGORIES).toContain(category);
    }
  });

  it('produces valid JSON for every preset with default values', () => {
    for (const kind of ITEM_PRESET_ORDER) {
      const json = buildItemJson('mymod', make(kind));
      expect(() => JSON.parse(JSON.stringify(json))).not.toThrow();
      expect(Object.keys(json['minecraft:item'].components).length).toBeGreaterThan(1);
    }
  });
});

describe('tool presets', () => {
  it('gives a sword damage, durability and a stack size of 1', () => {
    const c = buildItemJson('mymod', make('sword', { power: 9, durability: 900 }))['minecraft:item'].components;
    expect(c['minecraft:damage']).toEqual({ value: 9 });
    expect(c['minecraft:durability']).toMatchObject({ max_durability: 900 });
    expect(c['minecraft:max_stack_size']).toBe(1);
    expect(c['minecraft:hand_equipped']).toBe(true);
  });

  it('gives diggers a destroy_speeds entry against the right vanilla tag', () => {
    const expected: Record<string, string> = {
      pickaxe: 'minecraft:is_pickaxe_item_destructible',
      axe: 'minecraft:is_axe_item_destructible',
      shovel: 'minecraft:is_shovel_item_destructible',
    };
    for (const [kind, tag] of Object.entries(expected)) {
      const c = buildItemJson('mymod', make(kind as ItemKind, { digSpeed: 7 }))['minecraft:item'].components;
      const digger = c['minecraft:digger'] as { destroy_speeds: { block: { tags: string }; speed: number }[] };
      expect(digger.destroy_speeds[0]?.block.tags).toContain(tag);
      expect(digger.destroy_speeds[0]?.speed).toBe(7);
    }
  });

  it('does not give a sword a digger component', () => {
    const c = buildItemJson('mymod', make('sword'))['minecraft:item'].components;
    expect(c['minecraft:digger']).toBeUndefined();
  });
});

describe('armor preset', () => {
  it('maps the armor slot picker to a real wearable slot', () => {
    const slots: Record<string, string> = {
      head: 'slot.armor.head',
      chest: 'slot.armor.chest',
      legs: 'slot.armor.legs',
      feet: 'slot.armor.feet',
    };
    for (const [slot, wearable] of Object.entries(slots)) {
      const c = buildItemJson(
        'mymod',
        make('armor', { armorSlot: slot as 'head', protection: 7 }),
      )['minecraft:item'].components;
      expect(c['minecraft:wearable']).toEqual({ protection: 7, slot: wearable });
    }
  });

  it('falls back to the chest slot if stored state has a bogus slot', () => {
    const c = buildItemJson('mymod', make('armor', { armorSlot: 'nonsense' as 'head' }))['minecraft:item']
      .components;
    expect(c['minecraft:wearable']).toMatchObject({ slot: 'slot.armor.chest' });
  });

  it('tags armor so vanilla systems recognise it', () => {
    const c = buildItemJson('mymod', make('armor'))['minecraft:item'].components;
    expect(c['minecraft:tags']).toEqual({ tags: ['minecraft:is_armor'] });
  });
});

describe('food preset', () => {
  it('always pairs minecraft:food with minecraft:use_modifiers', () => {
    // The item reference states food "must have the use_modifiers component
    // in order to function properly" — without it the item is not edible.
    const c = buildItemJson('mymod', make('food', { nutrition: 8 }))['minecraft:item'].components;
    expect(c['minecraft:food']).toMatchObject({ nutrition: 8, can_always_eat: false });
    expect(c['minecraft:use_modifiers']).toBeDefined();
  });

  it('passes the always-eat toggle through', () => {
    const c = buildItemJson('mymod', make('food', { canAlwaysEat: true }))['minecraft:item'].components;
    expect(c['minecraft:food']).toMatchObject({ can_always_eat: true });
  });
});

describe('plain preset', () => {
  it('exposes only the stack size', () => {
    const c = buildItemJson('mymod', make('plain', { stackSize: 16 }))['minecraft:item'].components;
    expect(c['minecraft:max_stack_size']).toBe(16);
    expect(c['minecraft:damage']).toBeUndefined();
    expect(c['minecraft:durability']).toBeUndefined();
    expect(c['minecraft:food']).toBeUndefined();
  });
});

describe('clamping — a kid must never produce an absurd value', () => {
  it('clamps values below the slider minimum', () => {
    const c = buildItemJson(
      'mymod',
      make('sword', { power: -50, durability: -9999 }),
    )['minecraft:item'].components;
    expect((c['minecraft:damage'] as { value: number }).value).toBe(ITEM_PRESETS.sword.sliders[0]!.min);
    expect((c['minecraft:durability'] as { max_durability: number }).max_durability).toBeGreaterThan(0);
  });

  it('clamps values above the slider maximum', () => {
    const c = buildItemJson(
      'mymod',
      make('sword', { power: 99999, durability: 10 ** 9 }),
    )['minecraft:item'].components;
    expect((c['minecraft:damage'] as { value: number }).value).toBe(15);
    expect((c['minecraft:durability'] as { max_durability: number }).max_durability).toBe(3000);
  });

  it('coerces NaN and undefined to the minimum', () => {
    const c = buildItemJson(
      'mymod',
      make('sword', { power: NaN, durability: undefined as unknown as number }),
    )['minecraft:item'].components;
    expect((c['minecraft:damage'] as { value: number }).value).toBe(1);
    expect(Number.isFinite((c['minecraft:durability'] as { max_durability: number }).max_durability)).toBe(true);
  });

  it('never emits a negative or zero durability for any preset', () => {
    for (const kind of ITEM_PRESET_ORDER) {
      const c = buildItemJson('mymod', make(kind, { durability: -1, power: -1, protection: -1, nutrition: -1 }))[
        'minecraft:item'
      ].components;
      const durability = c['minecraft:durability'] as { max_durability: number } | undefined;
      if (durability) expect(durability.max_durability).toBeGreaterThan(0);
    }
  });

  it('produces a valid item even from a completely empty name', () => {
    const json = buildItemJson('mymod', make('sword', { name: '   ' }));
    expect(json['minecraft:item'].description.identifier).toMatch(/^mymod:[a-z][a-z0-9_]*$/);
    expect(json['minecraft:item'].components['minecraft:display_name']).toEqual({ value: 'My Item' });
  });
});
