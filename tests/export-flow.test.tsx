import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import App from '../src/App';
import { deleteProject, listProjects, loadProject, saveProject } from '../src/storage/db';
import { createItem, createProject } from '../src/bedrock/project';
import { captureDownloads } from './helpers/download';
import { applySwatch, SWATCHES } from '../src/components/swatches';

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

async function clickDownload(user: User, capture: ReturnType<typeof captureDownloads>) {
  await user.click(screen.getByRole('button', { name: /download my mod/i }));
  await act(async () => {
    await capture.waitForDownload();
  });
}

describe('export and onboarding', () => {
  let capture: ReturnType<typeof captureDownloads>;

  beforeEach(async () => {
    for (const p of await listProjects()) await deleteProject(p.id);
    capture = captureDownloads();
  });

  afterEach(() => capture.restore());

  it('shows the how-to-install screen right after the download', async () => {
    const user = userEvent.setup();
    render(<App />);
    await newMod(user, 'Ruby Mod');
    await clickDownload(user, capture);

    expect(await screen.findByRole('heading', { name: /your mod is ready/i })).toBeInTheDocument();
    expect(screen.getByText('Ruby_Mod.mcaddon')).toBeInTheDocument();

    // Default platform is Windows and its steps are visible.
    expect(screen.getByText(/double-click it/i)).toBeInTheDocument();

    await settleAutosave();
  }, 40000);

  it('gives real instructions for each device', async () => {
    const user = userEvent.setup();
    render(<App />);
    await newMod(user, 'Ruby Mod');
    await clickDownload(user, capture);
    await screen.findByRole('heading', { name: /your mod is ready/i });

    await user.click(screen.getByRole('button', { name: /phone or tablet/i }));
    expect(screen.getByText(/open your files or downloads app/i)).toBeInTheDocument();
    expect(screen.getByText(/copy to minecraft/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /chromebook/i }));
    expect(screen.getByText(/play files or linux files/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /xbox/i }));
    expect(screen.getByText(/can’t open add-on files directly/i)).toBeInTheDocument();

    await settleAutosave();
  }, 40000);

  it('tells the kid to activate BOTH packs, and what invisible items mean', async () => {
    // The docs claim activating the behavior pack auto-activates its linked
    // resource pack. On-device that did not happen, and the resulting
    // symptom — items that exist, are named correctly and are completely
    // invisible — is impossible for a kid to diagnose. So the instructions
    // say to switch both on, and name that symptom explicitly.
    const user = userEvent.setup();
    render(<App />);
    await newMod(user, 'Linked Mod');
    await clickDownload(user, capture);
    await screen.findByRole('heading', { name: /your mod is ready/i });

    expect(screen.getByText(/you need both/i)).toBeInTheDocument();
    expect(screen.getByText(/if your stuff is invisible/i)).toBeInTheDocument();

    await settleAutosave();
  }, 40000);

  it('can re-download from the instructions screen and go back to editing', async () => {
    const user = userEvent.setup();
    render(<App />);
    await newMod(user, 'Ruby Mod');
    await clickDownload(user, capture);
    await screen.findByRole('heading', { name: /your mod is ready/i });

    const before = capture.downloads.length;
    await user.click(screen.getByRole('button', { name: /download it again/i }));
    await waitFor(() => expect(capture.downloads.length).toBe(before + 1));

    await user.click(screen.getByRole('button', { name: /keep editing/i }));
    expect(await screen.findByRole('heading', { name: 'Ruby Mod' })).toBeInTheDocument();

    await settleAutosave();
  }, 40000);

  it('bumps the pack version on every export so re-imports replace the old copy', async () => {
    const user = userEvent.setup();
    render(<App />);
    await newMod(user, 'Version Mod');

    await clickDownload(user, capture);
    await screen.findByRole('heading', { name: /your mod is ready/i });
    await user.click(screen.getByRole('button', { name: /download it again/i }));
    await waitFor(() => expect(capture.downloads.length).toBe(2));

    await settleAutosave();
    const stored = (await listProjects())[0];
    expect(stored?.version).toEqual([1, 0, 2]);
  }, 40000);
});

describe('My Mods and autosave', () => {
  beforeEach(async () => {
    for (const p of await listProjects()) await deleteProject(p.id);
  });

  it('keeps a mod, its items and its artwork across a full reload', async () => {
    // Seed storage directly, then mount the app fresh — the same thing that
    // happens when a kid closes the tab and comes back tomorrow.
    const project = createProject('Persisted Mod', 'Still here');
    project.items = [
      {
        ...createItem('pickaxe'),
        name: 'Rock Breaker',
        texture: applySwatch(SWATCHES[1]!, 16),
        power: 4,
        durability: 800,
        digSpeed: 9,
      },
    ];
    await saveProject(project);

    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole('button', { name: 'Open Persisted Mod' }));
    expect(await screen.findByRole('heading', { name: 'Persisted Mod' })).toBeInTheDocument();
    expect(screen.getByText('Still here')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit Rock Breaker' })).toBeInTheDocument();

    // The artwork survived, not just the name.
    await user.click(screen.getByRole('button', { name: 'Edit Rock Breaker' }));
    await user.click(screen.getByRole('button', { name: /^Powers$/ }));
    expect(screen.getByLabelText('Power')).toHaveValue('4');
    expect(screen.getByLabelText(/digging speed/i)).toHaveValue('9');

    await settleAutosave();
  }, 40000);

  it('autosaves an edit without the kid pressing save', async () => {
    const user = userEvent.setup();
    render(<App />);
    await newMod(user, 'Auto Mod');

    await user.click(screen.getByRole('button', { name: /add an item/i }));
    await user.type(screen.getByLabelText(/name it/i), 'Autosaved Thing');
    await user.click(screen.getByRole('button', { name: /back to my mod/i }));

    await settleAutosave();

    const stored = (await listProjects()).find((p) => p.name === 'Auto Mod');
    expect(stored?.items[0]?.name).toBe('Autosaved Thing');
  }, 40000);

  it('shows a saved indicator', async () => {
    const user = userEvent.setup();
    render(<App />);
    await newMod(user, 'Indicator Mod');
    await settleAutosave();
    expect(screen.getByText(/saved/i)).toBeInTheDocument();
  }, 40000);

  it('lists several mods and opens the right one', async () => {
    for (const name of ['Alpha Mod', 'Beta Mod', 'Gamma Mod']) {
      await saveProject({ ...createProject(name, ''), updatedAt: Date.now() + name.length });
    }

    const user = userEvent.setup();
    render(<App />);

    expect(await screen.findByRole('button', { name: 'Open Alpha Mod' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open Beta Mod' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Open Gamma Mod' }));
    expect(await screen.findByRole('heading', { name: 'Gamma Mod' })).toBeInTheDocument();

    await settleAutosave();
  }, 40000);

  it('asks before deleting a whole mod, and can be cancelled', async () => {
    await saveProject(createProject('Precious Mod', ''));

    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('button', { name: 'Open Precious Mod' });

    // Cancelling keeps it.
    await user.click(screen.getByRole('button', { name: 'Delete Precious Mod' }));
    await user.click(screen.getByRole('button', { name: 'Keep Precious Mod' }));
    expect(screen.getByRole('button', { name: 'Open Precious Mod' })).toBeInTheDocument();

    // Confirming removes it, from the screen and from storage.
    await user.click(screen.getByRole('button', { name: 'Delete Precious Mod' }));
    await user.click(screen.getByRole('button', { name: 'Really delete Precious Mod' }));

    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Open Precious Mod' })).not.toBeInTheDocument(),
    );
    expect(await listProjects()).toHaveLength(0);
  }, 40000);

  it('reopens a mod with the UUIDs it was created with, so re-imports update in place', async () => {
    const project = createProject('Stable Mod', '');
    await saveProject(project);
    const reloaded = await loadProject(project.id);
    expect(reloaded?.uuids).toEqual(project.uuids);
  });
});
