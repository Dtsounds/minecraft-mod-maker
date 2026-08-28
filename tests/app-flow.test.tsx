import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import App from '../src/App';
import { deleteProject, listProjects } from '../src/storage/db';
import { captureDownloads, openMcaddon } from './helpers/download';

/**
 * The autosave hook writes ~600ms after the last edit. Flush that inside
 * act() so its setState lands during the test rather than after teardown.
 */
/**
 * Wait for the export to reach the browser. The whole wait runs inside act()
 * because the export handler resolves mid-wait and flips `exporting` back off.
 */
async function awaitDownload(capture: ReturnType<typeof captureDownloads>) {
  let download!: Awaited<ReturnType<typeof capture.waitForDownload>>;
  await act(async () => {
    download = await capture.waitForDownload();
  });
  // Since Milestone 4 the app lands on the how-to-install screen once the
  // file is in the browser; waiting for it also settles the export state.
  await screen.findByRole('heading', { name: /your mod is ready/i }, { timeout: 5000 });
  return download;
}

async function settleAutosave() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 900));
  });
}

/**
 * Milestone 1 acceptance, driven through the real UI: a kid opens the app,
 * makes a mod, and taps Download. We then unzip the bytes the browser was
 * handed and check they form a valid, importable add-on.
 */
describe('new mod -> download, through the UI', () => {
  let capture: ReturnType<typeof captureDownloads>;

  beforeEach(async () => {
    for (const p of await listProjects()) await deleteProject(p.id);
    capture = captureDownloads();
  });

  afterEach(() => capture.restore());

  it('walks the whole flow and downloads a valid .mcaddon', async () => {
    const user = userEvent.setup();
    render(<App />);

    // Home screen, empty state.
    expect(await screen.findByRole('heading', { name: /make your own minecraft stuff/i })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(/haven’t made anything yet/i)).toBeInTheDocument());

    // Start a new mod.
    await user.click(screen.getByRole('button', { name: /make a new mod/i }));
    expect(screen.getByRole('heading', { name: /name your mod/i })).toBeInTheDocument();

    // The namespace preview updates live as they type.
    await user.type(screen.getByLabelText(/what’s it called/i), 'Ruby Mod');
    expect(screen.getByText('ruby_mod')).toBeInTheDocument();
    await user.type(screen.getByLabelText(/what does it do/i), 'Shiny ruby things');

    await user.click(screen.getByRole('button', { name: /let’s go/i }));

    // Editor screen for the new project.
    expect(await screen.findByRole('heading', { name: 'Ruby Mod' })).toBeInTheDocument();
    expect(screen.getByText('Shiny ruby things')).toBeInTheDocument();

    // Download.
    await user.click(screen.getByRole('button', { name: /download my mod/i }));
    const download = await awaitDownload(capture);
    expect(download.fileName).toBe('Ruby_Mod.mcaddon');

    const addon = await openMcaddon(download.bytes);
    expect(addon.has('Ruby_Mod_BP/manifest.json')).toBe(true);
    expect(addon.has('Ruby_Mod_RP/manifest.json')).toBe(true);

    const bp = await addon.json('Ruby_Mod_BP/manifest.json');
    const rp = await addon.json('Ruby_Mod_RP/manifest.json');
    expect(bp.header.name).toBe('Ruby Mod');
    expect(bp.dependencies[0].uuid).toBe(rp.header.uuid);
    // Exporting bumps the version so a re-import replaces the old copy.
    expect(bp.header.version).toEqual([1, 0, 1]);
    await settleAutosave();
  }, 20000);

  it('autosaves the new mod so it shows up in My Mods', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole('button', { name: /make a new mod/i }));
    await user.type(screen.getByLabelText(/what’s it called/i), 'Saved Mod');
    await user.click(screen.getByRole('button', { name: /let’s go/i }));
    await screen.findByRole('heading', { name: 'Saved Mod' });

    await user.click(screen.getByRole('button', { name: /my mods/i }));
    expect(await screen.findByRole('button', { name: 'Open Saved Mod' })).toBeInTheDocument();

    const stored = await listProjects();
    expect(stored.map((p) => p.name)).toContain('Saved Mod');
    await settleAutosave();
  }, 20000);

  it('falls back to a valid mod name when the kid types nothing', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole('button', { name: /make a new mod/i }));
    await user.click(screen.getByRole('button', { name: /let’s go/i }));

    expect(await screen.findByRole('heading', { name: 'My Mod' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /download my mod/i }));
    const download = await awaitDownload(capture);
    expect(download.fileName).toBe('My_Mod.mcaddon');

    const addon = await openMcaddon(download.bytes);
    const bp = await addon.json('My_Mod_BP/manifest.json');
    expect(bp.header.description.length).toBeGreaterThan(0);
    await settleAutosave();
  }, 20000);
});
