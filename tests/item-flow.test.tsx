import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import App from '../src/App';
import { deleteProject, listProjects } from '../src/storage/db';
import { captureDownloads, openMcaddon } from './helpers/download';
import { isPng, readPngSize } from '../src/bedrock/png';

type User = ReturnType<typeof userEvent.setup>;

async function settleAutosave() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 900));
  });
}

/** Create a mod and land on its editor screen. */
async function newMod(user: User, name: string) {
  await user.click(await screen.findByRole('button', { name: /make a new mod/i }));
  await user.type(screen.getByLabelText(/what’s it called/i), name);
  await user.click(screen.getByRole('button', { name: /let’s go/i }));
  await screen.findByRole('heading', { name });
}

async function download(user: User, capture: ReturnType<typeof captureDownloads>) {
  await user.click(screen.getByRole('button', { name: /download my mod/i }));
  let result!: Awaited<ReturnType<typeof capture.waitForDownload>>;
  await act(async () => {
    result = await capture.waitForDownload();
  });
  // Since Milestone 4 the app lands on the how-to-install screen once the
  // file is in the browser; waiting for it also settles the export state.
  await screen.findByRole('heading', { name: /your mod is ready/i }, { timeout: 5000 });
  return openMcaddon(result.bytes);
}

describe('item creator, driven through the UI', () => {
  let capture: ReturnType<typeof captureDownloads>;

  beforeEach(async () => {
    for (const p of await listProjects()) await deleteProject(p.id);
    capture = captureDownloads();
  });

  afterEach(() => capture.restore());

  it('builds a sword with a picture and a recipe, and ships it in the .mcaddon', async () => {
    const user = userEvent.setup();
    render(<App />);
    await newMod(user, 'Ruby Mod');

    await user.click(screen.getByRole('button', { name: /add an item/i }));

    // Step 1: name and type.
    await user.type(screen.getByLabelText(/name it/i), 'Ruby Sword');
    expect(screen.getByText('ruby_mod:ruby_sword')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Sword.*fighting mobs/i }));
    await user.click(screen.getByRole('button', { name: /next: draw it/i }));

    // Step 2: use a built-in starter picture instead of drawing.
    await user.click(screen.getByRole('button', { name: /use the sword picture/i }));
    await user.click(screen.getByRole('button', { name: /next: powers/i }));

    // Step 3: sliders. Set power to its maximum.
    // A range input can't be typed into; set it the way the browser does.
    const power = screen.getByLabelText('Power');
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
      setter?.call(power, '12');
      power.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(screen.getByText('12')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /next: recipe/i }));

    // Step 4: turn the recipe on and place ingredients by tapping.
    await user.click(screen.getByLabelText(/let players craft this/i));

    // Diamond lives under the Ores tab; stick under Basics.
    await user.click(screen.getByRole('tab', { name: /ores/i }));
    await user.click(screen.getByRole('button', { name: 'Diamond' }));
    await user.click(screen.getByRole('button', { name: /Slot row 1 column 2, empty/ }));
    await user.click(screen.getByRole('button', { name: /Slot row 2 column 2, empty/ }));

    await user.click(screen.getByRole('tab', { name: /basics/i }));
    await user.click(screen.getByRole('button', { name: 'Stick' }));
    await user.click(screen.getByRole('button', { name: /Slot row 3 column 2, empty/ }));

    await user.click(screen.getByRole('button', { name: /all done/i }));
    await screen.findByRole('heading', { name: 'Ruby Mod' });

    // Export and inspect what the kid actually receives.
    const addon = await download(user, capture);

    expect(addon.has('Ruby_Mod_BP/items/ruby_sword.json')).toBe(true);
    expect(addon.has('Ruby_Mod_BP/recipes/ruby_sword.json')).toBe(true);
    expect(addon.has('Ruby_Mod_RP/textures/items/ruby_sword.png')).toBe(true);

    const item = await addon.json('Ruby_Mod_BP/items/ruby_sword.json');
    expect(item['minecraft:item'].description.identifier).toBe('ruby_mod:ruby_sword');
    expect(item['minecraft:item'].components['minecraft:damage']).toEqual({ value: 12 });
    expect(item['minecraft:item'].components['minecraft:max_stack_size']).toBe(1);

    const recipe = await addon.json('Ruby_Mod_BP/recipes/ruby_sword.json');
    expect(recipe['minecraft:recipe_shaped'].pattern).toEqual(['A', 'A', 'B']);
    expect(recipe['minecraft:recipe_shaped'].result.item).toBe('ruby_mod:ruby_sword');

    const atlas = await addon.json('Ruby_Mod_RP/textures/item_texture.json');
    expect(atlas.texture_data['ruby_mod:ruby_sword']).toEqual({ textures: 'textures/items/ruby_sword' });

    const lang = await addon.text('Ruby_Mod_RP/texts/en_US.lang');
    expect(lang).toContain('item.ruby_mod:ruby_sword=Ruby Sword');

    const png = await addon.bytes('Ruby_Mod_RP/textures/items/ruby_sword.png');
    expect(isPng(png)).toBe(true);
    expect(readPngSize(png)).toEqual([16, 16]);
    // The starter picture actually painted something.
    expect(png.byteLength).toBeGreaterThan(100);

    await settleAutosave();
  }, 40000);

  it('shows only the sliders that make sense for the chosen type', async () => {
    const user = userEvent.setup();
    render(<App />);
    await newMod(user, 'Slider Mod');
    await user.click(screen.getByRole('button', { name: /add an item/i }));
    await user.click(screen.getByRole('button', { name: /next: draw it/i }));
    await user.click(screen.getByRole('button', { name: /next: powers/i }));

    // Sword: power + durability, no hunger.
    expect(screen.getByLabelText('Power')).toBeInTheDocument();
    expect(screen.getByLabelText(/how many hits before it breaks/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/how much hunger/i)).not.toBeInTheDocument();

    // Switch to Food: hunger appears, power disappears.
    await user.click(screen.getByRole('button', { name: /^Name$/ }));
    await user.click(screen.getByRole('button', { name: /Food.*hunger bar/i }));
    await user.click(screen.getByRole('button', { name: /^Powers$/ }));
    expect(screen.getByLabelText(/how much hunger it fills/i)).toBeInTheDocument();
    expect(screen.queryByLabelText('Power')).not.toBeInTheDocument();
    expect(screen.getByLabelText(/even when you’re not hungry/i)).toBeInTheDocument();

    // Switch to Plain: only stack size.
    await user.click(screen.getByRole('button', { name: /^Name$/ }));
    await user.click(screen.getByRole('button', { name: /Just an item/i }));
    await user.click(screen.getByRole('button', { name: /^Powers$/ }));
    expect(screen.getByLabelText(/how many fit in one slot/i)).toBeInTheDocument();
    expect(screen.queryByLabelText('Power')).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/how much hunger/i)).not.toBeInTheDocument();

    await settleAutosave();
  }, 40000);

  it('exports a food item with the components that make it edible', async () => {
    const user = userEvent.setup();
    render(<App />);
    await newMod(user, 'Snack Mod');

    await user.click(screen.getByRole('button', { name: /add an item/i }));
    await user.type(screen.getByLabelText(/name it/i), 'Berry Bun');
    await user.click(screen.getByRole('button', { name: /Food.*hunger bar/i }));
    await user.click(screen.getByRole('button', { name: /next: draw it/i }));
    await user.click(screen.getByRole('button', { name: /use the fruit picture/i }));
    await user.click(screen.getByRole('button', { name: /next: powers/i }));
    await user.click(screen.getByLabelText(/even when you’re not hungry/i));
    await user.click(screen.getByRole('button', { name: /next: recipe/i }));
    await user.click(screen.getByRole('button', { name: /all done/i }));

    const addon = await download(user, capture);
    const item = await addon.json('Snack_Mod_BP/items/berry_bun.json');
    const components = item['minecraft:item'].components;

    expect(components['minecraft:food']).toMatchObject({ can_always_eat: true });
    // Food is inert without use_modifiers.
    expect(components['minecraft:use_modifiers']).toBeDefined();
    expect(item['minecraft:item'].description.menu_category.category).toBe('nature');
    // No recipe was requested, so none is written.
    expect(addon.has('Snack_Mod_BP/recipes/berry_bun.json')).toBe(false);

    await settleAutosave();
  }, 40000);

  it('keeps two items with the same name from colliding', async () => {
    const user = userEvent.setup();
    render(<App />);
    await newMod(user, 'Twin Mod');

    for (let i = 0; i < 2; i++) {
      await user.click(screen.getByRole('button', { name: /add an item/i }));
      await user.type(screen.getByLabelText(/name it/i), 'Gem');
      await user.click(screen.getByRole('button', { name: /next: draw it/i }));
      await user.click(screen.getByRole('button', { name: /use the gem picture/i }));
      await user.click(screen.getByRole('button', { name: /back to my mod/i }));
    }

    const addon = await download(user, capture);
    expect(addon.has('Twin_Mod_BP/items/gem.json')).toBe(true);
    expect(addon.has('Twin_Mod_BP/items/gem_2.json')).toBe(true);

    const first = await addon.json('Twin_Mod_BP/items/gem.json');
    const second = await addon.json('Twin_Mod_BP/items/gem_2.json');
    expect(first['minecraft:item'].description.identifier).not.toBe(
      second['minecraft:item'].description.identifier,
    );

    const atlas = await addon.json('Twin_Mod_RP/textures/item_texture.json');
    expect(Object.keys(atlas.texture_data)).toHaveLength(2);

    await settleAutosave();
  }, 40000);

  it('deletes an item after a confirm tap', async () => {
    const user = userEvent.setup();
    render(<App />);
    await newMod(user, 'Delete Mod');

    await user.click(screen.getByRole('button', { name: /add an item/i }));
    await user.type(screen.getByLabelText(/name it/i), 'Doomed');
    await user.click(screen.getByRole('button', { name: /back to my mod/i }));

    expect(screen.getByRole('button', { name: 'Edit Doomed' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Delete Doomed' }));
    // Destructive actions ask first.
    await user.click(screen.getByRole('button', { name: /really delete doomed/i }));

    await waitFor(() => expect(screen.queryByRole('button', { name: 'Edit Doomed' })).not.toBeInTheDocument());
    expect(screen.getByText(/no items yet/i)).toBeInTheDocument();

    await settleAutosave();
  }, 40000);

  it('warns when an item would be invisible in-game', async () => {
    const user = userEvent.setup();
    render(<App />);
    await newMod(user, 'Blank Mod');

    await user.click(screen.getByRole('button', { name: /add an item/i }));
    await user.type(screen.getByLabelText(/name it/i), 'Ghost');
    await user.click(screen.getByRole('button', { name: /next: draw it/i }));
    expect(screen.getByText(/blank right now/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /back to my mod/i }));
    const bar = screen.getByText(/blank picture/i);
    expect(within(bar).getByText(/invisible/i)).toBeInTheDocument();

    await settleAutosave();
  }, 40000);
});
