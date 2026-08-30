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

function setSlider(input: HTMLElement, value: string) {
  act(() => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    setter?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

describe('mob creator, driven through the UI', () => {
  let capture: ReturnType<typeof captureDownloads>;

  beforeEach(async () => {
    for (const p of await listProjects()) await deleteProject(p.id);
    capture = captureDownloads();
  });

  afterEach(() => capture.restore());

  it('builds a mean creature and ships every file it needs', async () => {
    const user = userEvent.setup();
    render(<App />);
    await newMod(user, 'Beast Mod');

    await user.click(screen.getByRole('button', { name: /add a creature/i }));
    await user.type(screen.getByLabelText(/name it/i), 'Fluff Beast');
    expect(screen.getByText('beast_mod:fluff_beast')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /next: draw it/i }));
    await user.click(screen.getByRole('button', { name: /start me off/i }));
    await user.click(screen.getByRole('button', { name: /next: powers/i }));

    setSlider(screen.getByLabelText(/how much health/i), '40');
    setSlider(screen.getByLabelText(/how fast it moves/i), '8');
    await user.click(screen.getByRole('button', { name: /a minecraft item/i }));
    const dropGroup = screen.getByRole('group', { name: /which minecraft item/i });
    await user.click(within(dropGroup).getByRole('button', { name: 'Leather' }));

    await user.click(screen.getByRole('button', { name: /next: behaviour/i }));
    await user.click(screen.getByRole('button', { name: /Mean.*attacks players/i }));
    await user.click(screen.getByRole('button', { name: /all done/i }));
    await screen.findByRole('heading', { name: 'Beast Mod' });

    const addon = await download(user, capture);

    // A working mob needs all four of these; missing any one is a broken mob.
    expect(addon.has('Beast_Mod_BP/entities/fluff_beast.json')).toBe(true);
    expect(addon.has('Beast_Mod_RP/entity/fluff_beast.entity.json')).toBe(true);
    expect(addon.has('Beast_Mod_RP/models/entity/fluff_beast.geo.json')).toBe(true);
    expect(addon.has('Beast_Mod_RP/textures/entity/fluff_beast.png')).toBe(true);
    expect(addon.has('Beast_Mod_BP/loot_tables/entities/fluff_beast.json')).toBe(true);

    const entity = await addon.json('Beast_Mod_BP/entities/fluff_beast.json');
    const components = entity['minecraft:entity'].components;
    expect(entity['minecraft:entity'].description.identifier).toBe('beast_mod:fluff_beast');
    expect(entity['minecraft:entity'].description.is_summonable).toBe(true);
    expect(components['minecraft:health']).toEqual({ value: 40, max: 40 });
    expect(components['minecraft:attack']).toBeDefined();
    expect(components['minecraft:behavior.melee_attack']).toBeDefined();

    // Entity loot is an OBJECT with `table`, unlike a block's bare string.
    expect(components['minecraft:loot']).toEqual({
      table: 'loot_tables/entities/fluff_beast.json',
    });
    const loot = await addon.json('Beast_Mod_BP/loot_tables/entities/fluff_beast.json');
    expect(loot.pools[0].entries[0].name).toBe('minecraft:leather');

    // The client entity must point at OUR geometry, never a versioned
    // vanilla identifier that could be renamed out from under us.
    const client = await addon.json('Beast_Mod_RP/entity/fluff_beast.entity.json');
    const description = client['minecraft:client_entity'].description;
    expect(description.geometry.default).toBe('geometry.beast_mod.fluff_beast');
    expect(description.textures.default).toBe('textures/entity/fluff_beast');
    expect(description.render_controllers).toEqual(['controller.render.default']);

    // ...and that geometry identifier must actually exist in the pack.
    const geo = await addon.json('Beast_Mod_RP/models/entity/fluff_beast.geo.json');
    expect(geo['minecraft:geometry'][0].description.identifier).toBe('geometry.beast_mod.fluff_beast');

    const lang = await addon.text('Beast_Mod_RP/texts/en_US.lang');
    expect(lang).toContain('entity.beast_mod:fluff_beast.name=Fluff Beast');
    expect(lang).toContain('item.spawn_egg.entity.beast_mod:fluff_beast.name=Spawn Fluff Beast');

    const png = await addon.bytes('Beast_Mod_RP/textures/entity/fluff_beast.png');
    expect(isPng(png)).toBe(true);
    expect(readPngSize(png)).toEqual([64, 64]);

    await settleAutosave();
  }, 40000);

  it('only shows the damage slider for a mean creature', async () => {
    const user = userEvent.setup();
    render(<App />);
    await newMod(user, 'Mood Mod');

    await user.click(screen.getByRole('button', { name: /add a creature/i }));
    await user.click(screen.getByRole('button', { name: /next: draw it/i }));
    await user.click(screen.getByRole('button', { name: /next: powers/i }));
    expect(screen.queryByLabelText(/how hard it hits/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^Behaviour$/ }));
    await user.click(screen.getByRole('button', { name: /Mean.*attacks players/i }));
    await user.click(screen.getByRole('button', { name: /^Powers$/ }));
    expect(screen.getByLabelText(/how hard it hits/i)).toBeInTheDocument();

    await settleAutosave();
  }, 40000);

  it('wires up taming, breeding and riding together', async () => {
    const user = userEvent.setup();
    render(<App />);
    await newMod(user, 'Tame Mod');

    await user.click(screen.getByRole('button', { name: /add a creature/i }));
    await user.type(screen.getByLabelText(/name it/i), 'Pet Blob');
    await user.click(screen.getByRole('button', { name: /next: draw it/i }));
    await user.click(screen.getByRole('button', { name: /next: powers/i }));
    await user.click(screen.getByRole('button', { name: /next: behaviour/i }));

    await user.click(screen.getByLabelText(/you can tame it/i));
    const tameGroup = screen.getByRole('group', { name: /tame it with/i });
    await user.click(within(tameGroup).getByRole('button', { name: 'Bone' }));

    await user.click(screen.getByLabelText(/make a baby/i));
    const breedGroup = screen.getByRole('group', { name: /feed them/i });
    await user.click(within(breedGroup).getByRole('button', { name: 'Wheat' }));

    await user.click(screen.getByLabelText(/you can ride it/i));
    await user.click(screen.getByRole('button', { name: /all done/i }));

    const addon = await download(user, capture);
    const c = (await addon.json('Tame_Mod_BP/entities/pet_blob.json'))['minecraft:entity'].components;

    expect(c['minecraft:tameable'].tame_items).toEqual(['minecraft:bone']);
    expect(c['minecraft:rideable'].family_types).toEqual(['player']);
    expect(c['minecraft:breedable'].breeds_with.baby_type).toBe('tame_mod:pet_blob');
    expect(c['minecraft:behavior.tempt'].items).toEqual(['minecraft:wheat']);

    await settleAutosave();
  }, 40000);

  it('changes body shape and keeps a square 64px skin', async () => {
    const user = userEvent.setup();
    render(<App />);
    await newMod(user, 'Shape Mod');

    await user.click(screen.getByRole('button', { name: /add a creature/i }));
    await user.type(screen.getByLabelText(/name it/i), 'Walker');
    await user.click(screen.getByRole('button', { name: /Two legs.*zombie/i }));
    await user.click(screen.getByRole('button', { name: /next: draw it/i }));
    await user.click(screen.getByRole('button', { name: /start me off/i }));
    await user.click(screen.getByRole('button', { name: /back to my mod/i }));

    const addon = await download(user, capture);
    const geo = await addon.json('Shape_Mod_RP/models/entity/walker.geo.json');
    const bones = geo['minecraft:geometry'][0].bones.map((b: { name: string }) => b.name);
    // Biped rig: arms present, and legs still named leg0/leg1 so the vanilla
    // quadruped walk animation swings them.
    expect(bones).toContain('arm0');
    expect(bones).toContain('leg0');
    expect(bones).toContain('leg1');
    expect(geo['minecraft:geometry'][0].description.texture_width).toBe(64);

    const png = await addon.bytes('Shape_Mod_RP/textures/entity/walker.png');
    expect(readPngSize(png)).toEqual([64, 64]);

    await settleAutosave();
  }, 40000);

  it('omits the loot component when the creature drops nothing', async () => {
    const user = userEvent.setup();
    render(<App />);
    await newMod(user, 'Bare Mod');

    await user.click(screen.getByRole('button', { name: /add a creature/i }));
    await user.type(screen.getByLabelText(/name it/i), 'Ghosty');
    await user.click(screen.getByRole('button', { name: /back to my mod/i }));

    const addon = await download(user, capture);
    const c = (await addon.json('Bare_Mod_BP/entities/ghosty.json'))['minecraft:entity'].components;
    expect(c['minecraft:loot']).toBeUndefined();
    expect(addon.has('Bare_Mod_BP/loot_tables/entities/ghosty.json')).toBe(false);

    await settleAutosave();
  }, 40000);

  it('keeps items, blocks and creatures together in one mod', async () => {
    const user = userEvent.setup();
    render(<App />);
    await newMod(user, 'All Mod');

    await user.click(screen.getByRole('button', { name: /add an item/i }));
    await user.type(screen.getByLabelText(/name it/i), 'Thing');
    await user.click(screen.getByRole('button', { name: /back to my mod/i }));

    await user.click(screen.getByRole('button', { name: /add a block/i }));
    await user.type(screen.getByLabelText(/name it/i), 'Thing');
    await user.click(screen.getByRole('button', { name: /back to my mod/i }));

    await user.click(screen.getByRole('button', { name: /add a creature/i }));
    await user.type(screen.getByLabelText(/name it/i), 'Thing');
    await user.click(screen.getByRole('button', { name: /back to my mod/i }));

    const addon = await download(user, capture);
    expect(addon.has('All_Mod_BP/items/thing.json')).toBe(true);
    expect(addon.has('All_Mod_BP/blocks/thing.json')).toBe(true);
    expect(addon.has('All_Mod_BP/entities/thing.json')).toBe(true);

    // Three different registries, three different lang key shapes.
    const lang = await addon.text('All_Mod_RP/texts/en_US.lang');
    expect(lang).toContain('item.all_mod:thing=Thing');
    expect(lang).toContain('tile.all_mod:thing.name=Thing');
    expect(lang).toContain('entity.all_mod:thing.name=Thing');

    await settleAutosave();
  }, 40000);
});
