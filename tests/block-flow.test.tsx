import { act, render, screen, within } from '@testing-library/react';
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
  await screen.findByRole('heading', { name: /your mod is ready/i }, { timeout: 5000 });
  return openMcaddon(result.bytes);
}

/** Range inputs cannot be typed into; drive them the way a browser does. */
function setSlider(input: HTMLElement, value: string) {
  act(() => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    setter?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

describe('block creator, driven through the UI', () => {
  let capture: ReturnType<typeof captureDownloads>;

  beforeEach(async () => {
    for (const p of await listProjects()) await deleteProject(p.id);
    capture = captureDownloads();
  });

  afterEach(() => capture.restore());

  it('builds a glowing ore block with a tool requirement and ships it', async () => {
    const user = userEvent.setup();
    render(<App />);
    await newMod(user, 'Ruby Mod');

    await user.click(screen.getByRole('button', { name: /add a block/i }));
    await user.type(screen.getByLabelText(/name it/i), 'Ruby Ore');
    expect(screen.getByText('ruby_mod:ruby_ore')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /next: draw it/i }));
    await user.click(screen.getByRole('button', { name: /use the gem picture/i }));
    await user.click(screen.getByRole('button', { name: /next: breaking/i }));

    setSlider(screen.getByLabelText(/how many hits to break/i), '8');
    setSlider(screen.getByLabelText(/how much it glows/i), '12');
    await user.click(screen.getByRole('button', { name: /⛏️ Pickaxe/ }));
    await user.click(screen.getByRole('button', { name: /a minecraft item/i }));
    await user.click(screen.getByRole('button', { name: 'Diamond' }));

    await user.click(screen.getByRole('button', { name: /next: recipe/i }));
    await user.click(screen.getByRole('button', { name: /all done/i }));
    await screen.findByRole('heading', { name: 'Ruby Mod' });

    const addon = await download(user, capture);

    expect(addon.has('Ruby_Mod_BP/blocks/ruby_ore.json')).toBe(true);
    expect(addon.has('Ruby_Mod_BP/loot_tables/blocks/ruby_ore.json')).toBe(true);
    expect(addon.has('Ruby_Mod_RP/textures/blocks/ruby_ore.png')).toBe(true);
    expect(addon.has('Ruby_Mod_RP/textures/terrain_texture.json')).toBe(true);

    const block = await addon.json('Ruby_Mod_BP/blocks/ruby_ore.json');
    const components = block['minecraft:block'].components;
    expect(block['minecraft:block'].description.identifier).toBe('ruby_mod:ruby_ore');
    // Both required together from 1.21.80 onward.
    expect(components['minecraft:geometry']).toBe('minecraft:geometry.full_block');
    expect(components['minecraft:material_instances']['*'].texture).toBe('ruby_mod:ruby_ore');
    expect(components['minecraft:light_emission']).toBe(12);
    expect(components['minecraft:loot']).toBe('loot_tables/blocks/ruby_ore.json');

    const loot = await addon.json('Ruby_Mod_BP/loot_tables/blocks/ruby_ore.json');
    expect(loot.pools[0].entries[0].name).toBe('minecraft:diamond');
    expect(loot.pools[0].conditions[0].condition).toBe('match_tool');
    expect(loot.pools[0].conditions[0]['minecraft:match_tool_filter_all']).toContain('minecraft:is_pickaxe');

    // Block textures use the terrain atlas, not the item atlas.
    const terrain = await addon.json('Ruby_Mod_RP/textures/terrain_texture.json');
    expect(terrain.texture_name).toBe('atlas.terrain');
    expect(terrain.texture_data['ruby_mod:ruby_ore']).toEqual({ textures: 'textures/blocks/ruby_ore' });

    // Blocks use `tile.<id>.name`, unlike items.
    const lang = await addon.text('Ruby_Mod_RP/texts/en_US.lang');
    expect(lang).toContain('tile.ruby_mod:ruby_ore.name=Ruby Ore');

    const png = await addon.bytes('Ruby_Mod_RP/textures/blocks/ruby_ore.png');
    expect(isPng(png)).toBe(true);
    expect(readPngSize(png)).toEqual([16, 16]);

    await settleAutosave();
  }, 40000);

  it('writes per-face textures when top and bottom are separate', async () => {
    const user = userEvent.setup();
    render(<App />);
    await newMod(user, 'Face Mod');

    await user.click(screen.getByRole('button', { name: /add a block/i }));
    await user.type(screen.getByLabelText(/name it/i), 'Grassy');
    await user.click(screen.getByRole('button', { name: /next: draw it/i }));
    await user.click(screen.getByLabelText(/top and bottom their own pictures/i));
    await user.click(screen.getByRole('button', { name: /use the gem picture/i }));
    await user.click(screen.getByRole('button', { name: /back to my mod/i }));

    const addon = await download(user, capture);
    const materials = (await addon.json('Face_Mod_BP/blocks/grassy.json'))['minecraft:block'].components[
      'minecraft:material_instances'
    ];
    expect(materials['*'].texture).toBe('face_mod:grassy');
    expect(materials['up'].texture).toBe('face_mod:grassy_top');
    expect(materials['down'].texture).toBe('face_mod:grassy_bottom');

    expect(addon.has('Face_Mod_RP/textures/blocks/grassy_top.png')).toBe(true);
    expect(addon.has('Face_Mod_RP/textures/blocks/grassy_bottom.png')).toBe(true);

    const terrain = await addon.json('Face_Mod_RP/textures/terrain_texture.json');
    expect(Object.keys(terrain.texture_data).sort()).toEqual([
      'face_mod:grassy',
      'face_mod:grassy_bottom',
      'face_mod:grassy_top',
    ]);

    await settleAutosave();
  }, 40000);

  it('adds crafting and furnace recipes for a block', async () => {
    const user = userEvent.setup();
    render(<App />);
    await newMod(user, 'Cook Mod');

    await user.click(screen.getByRole('button', { name: /add a block/i }));
    await user.type(screen.getByLabelText(/name it/i), 'Baked Brick');
    await user.click(screen.getByRole('button', { name: /next: draw it/i }));
    await user.click(screen.getByRole('button', { name: /next: breaking/i }));
    await user.click(screen.getByRole('button', { name: /next: recipe/i }));

    await user.click(screen.getByLabelText(/craft it in a crafting table/i));
    await user.click(screen.getByRole('tab', { name: /basics/i }));
    await user.click(screen.getByRole('button', { name: 'Cobblestone' }));
    await user.click(screen.getByRole('button', { name: /Slot row 1 column 1, empty/ }));
    await user.click(screen.getByRole('button', { name: /Slot row 1 column 2, empty/ }));

    await user.click(screen.getByLabelText(/cook it in a furnace/i));
    const cookGroup = screen.getByRole('group', { name: /what to cook/i });
    await user.click(within(cookGroup).getByRole('button', { name: 'Clay' }));

    await user.click(screen.getByRole('button', { name: /all done/i }));

    const addon = await download(user, capture);

    const craft = await addon.json('Cook_Mod_BP/recipes/block_baked_brick.json');
    expect(craft['minecraft:recipe_shaped'].pattern).toEqual(['AA']);
    expect(craft['minecraft:recipe_shaped'].result.item).toBe('cook_mod:baked_brick');

    const smelt = await addon.json('Cook_Mod_BP/recipes/smelt_baked_brick.json');
    expect(smelt['minecraft:recipe_furnace'].input).toBe('minecraft:clay_ball');
    expect(smelt['minecraft:recipe_furnace'].output).toBe('cook_mod:baked_brick');
    expect(smelt['minecraft:recipe_furnace'].tags).toContain('furnace');

    await settleAutosave();
  }, 40000);

  it('omits the loot component entirely for a block that drops nothing', async () => {
    const user = userEvent.setup();
    render(<App />);
    await newMod(user, 'Void Mod');

    await user.click(screen.getByRole('button', { name: /add a block/i }));
    await user.type(screen.getByLabelText(/name it/i), 'Void Stone');
    await user.click(screen.getByRole('button', { name: /next: draw it/i }));
    await user.click(screen.getByRole('button', { name: /next: breaking/i }));
    await user.click(screen.getByRole('button', { name: /^Nothing$/ }));
    await user.click(screen.getByRole('button', { name: /back to my mod/i }));

    const addon = await download(user, capture);
    const components = (await addon.json('Void_Mod_BP/blocks/void_stone.json'))['minecraft:block'].components;
    // Pointing minecraft:loot at a file that does not exist is a load error.
    expect(components['minecraft:loot']).toBeUndefined();
    expect(addon.has('Void_Mod_BP/loot_tables/blocks/void_stone.json')).toBe(false);

    await settleAutosave();
  }, 40000);

  it('keeps items and blocks in the same mod without colliding', async () => {
    const user = userEvent.setup();
    render(<App />);
    await newMod(user, 'Both Mod');

    await user.click(screen.getByRole('button', { name: /add an item/i }));
    await user.type(screen.getByLabelText(/name it/i), 'Shiny');
    await user.click(screen.getByRole('button', { name: /back to my mod/i }));

    await user.click(screen.getByRole('button', { name: /add a block/i }));
    await user.type(screen.getByLabelText(/name it/i), 'Shiny');
    await user.click(screen.getByRole('button', { name: /back to my mod/i }));

    const addon = await download(user, capture);
    // Same name, different registries — both are valid and distinct.
    expect(addon.has('Both_Mod_BP/items/shiny.json')).toBe(true);
    expect(addon.has('Both_Mod_BP/blocks/shiny.json')).toBe(true);
    expect(addon.has('Both_Mod_RP/textures/items/shiny.png')).toBe(true);
    expect(addon.has('Both_Mod_RP/textures/blocks/shiny.png')).toBe(true);

    const lang = await addon.text('Both_Mod_RP/texts/en_US.lang');
    expect(lang).toContain('item.both_mod:shiny=Shiny');
    expect(lang).toContain('tile.both_mod:shiny.name=Shiny');

    await settleAutosave();
  }, 40000);
});
