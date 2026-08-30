import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import App from '../src/App';
import { deleteProject, listProjects } from '../src/storage/db';
import { captureDownloads, openMcaddon } from './helpers/download';

type User = ReturnType<typeof userEvent.setup>;

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

/** Make a plain item so a rule has something to watch. */
async function addItem(user: User, name: string) {
  await user.click(screen.getByRole('button', { name: /add an item/i }));
  await user.type(screen.getByLabelText(/name it/i), name);
  await user.click(screen.getByRole('button', { name: /back to my mod/i }));
}

describe('rule creator, driven through the UI', () => {
  let capture: ReturnType<typeof captureDownloads>;

  beforeEach(async () => {
    for (const p of await listProjects()) await deleteProject(p.id);
    capture = captureDownloads();
  });

  afterEach(() => capture.restore());

  it('builds a rule and ships a script module in the add-on', async () => {
    const user = userEvent.setup();
    render(<App />);
    await newMod(user, 'Rule Mod');
    await addItem(user, 'Magic Gem');

    await user.click(screen.getByRole('button', { name: /add a rule/i }));
    await user.type(screen.getByLabelText(/call this rule something/i), 'Zap');

    // "Someone uses my item" is the default trigger; pick the gem as subject.
    const which = screen.getByRole('group', { name: /which one/i });
    await user.click(within(which).getByRole('button', { name: /magic gem/i }));

    await user.click(screen.getByRole('button', { name: /…do this/i }));
    await user.click(screen.getByRole('button', { name: /strike lightning/i }));
    await user.click(screen.getByRole('button', { name: /back to my mod/i }));

    const files = await download(user, capture);

    const manifest = await files.json('Rule_Mod_BP/manifest.json');
    const script = manifest.modules.find((m: { type: string }) => m.type === 'script');
    expect(script.entry).toBe('scripts/main.js');
    expect(manifest.dependencies).toContainEqual({
      module_name: '@minecraft/server',
      version: '2.0.0',
    });

    const main = await files.text('Rule_Mod_BP/scripts/main.js');
    expect(main).toContain('rule_mod:magic_gem');
    expect(main).toContain('"action":"lightning"');
    // No experiment toggle is involved, and the runtime never announces itself
    // in a kid's export.
    expect(main).toContain('const BANNER = null;');
  });

  it('shows the rule as a plain-language sentence', async () => {
    const user = userEvent.setup();
    render(<App />);
    await newMod(user, 'Sentence Mod');
    await addItem(user, 'Magic Gem');

    await user.click(screen.getByRole('button', { name: /add a rule/i }));
    const which = screen.getByRole('group', { name: /which one/i });
    await user.click(within(which).getByRole('button', { name: /magic gem/i }));

    // The read-back is the only way a kid can check the rule means what they
    // intended, so it has to name both halves.
    // Text is split across <strong>/<em>, so match the container itself.
    const sentence = document.querySelector('.rule-sentence') as HTMLElement;
    expect(sentence.textContent).toMatch(/someone uses my item/i);
    expect(sentence.textContent).toMatch(/magic gem/i);
    expect(sentence.textContent).toMatch(/give a potion effect/i);
  });

  it('warns about an unfinished rule instead of shipping it', async () => {
    const user = userEvent.setup();
    render(<App />);
    await newMod(user, 'Warn Mod');

    // A rule with no subject picked at all.
    await user.click(screen.getByRole('button', { name: /add a rule/i }));
    await user.click(screen.getByRole('button', { name: /back to my mod/i }));

    expect(screen.getByText(/one rule isn’t finished/i)).toBeInTheDocument();

    const files = await download(user, capture);
    expect(files.has('Warn_Mod_BP/scripts/main.js')).toBe(false);

    // ...and crucially the pack still imports: no script module means no
    // dependency that could fail to resolve.
    const manifest = await files.json('Warn_Mod_BP/manifest.json');
    expect(manifest.modules.some((m: { type: string }) => m.type === 'script')).toBe(false);
  });

  it('offers only the creatures list once the trigger is about creatures', async () => {
    const user = userEvent.setup();
    render(<App />);
    await newMod(user, 'Swap Mod');
    await addItem(user, 'Magic Gem');

    await user.click(screen.getByRole('button', { name: /add a rule/i }));
    expect(within(screen.getByRole('group', { name: /which one/i })).getByRole('button', {
      name: /magic gem/i,
    })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /someone hits my creature/i }));
    // No creatures exist, so the picker must say so rather than offer the item.
    expect(screen.getByText(/make a creature first/i)).toBeInTheDocument();
  });

  it('lets a rule drop one of the kid’s own items', async () => {
    const user = userEvent.setup();
    render(<App />);
    await newMod(user, 'Loot Mod');
    await addItem(user, 'Magic Gem');

    await user.click(screen.getByRole('button', { name: /add a rule/i }));
    await user.click(within(screen.getByRole('group', { name: /which one/i })).getByRole('button', {
      name: /magic gem/i,
    }));
    await user.click(screen.getByRole('button', { name: /…do this/i }));
    await user.click(screen.getByRole('button', { name: /drop an item/i }));

    const mine = screen.getByRole('group', { name: /one of my items/i });
    await user.click(within(mine).getByRole('button', { name: /magic gem/i }));
    await user.click(screen.getByRole('button', { name: /back to my mod/i }));

    const files = await download(user, capture);
    const main = await files.text('Loot_Mod_BP/scripts/main.js');
    expect(main).toContain('"give":"loot_mod:magic_gem"');
  });
});
