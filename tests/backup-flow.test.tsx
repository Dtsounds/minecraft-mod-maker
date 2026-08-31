import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import App from '../src/App';
import { deleteProject, listProjects } from '../src/storage/db';
import { captureDownloads } from './helpers/download';
import { parseBackup } from '../src/storage/backup';

type User = ReturnType<typeof userEvent.setup>;

async function newMod(user: User, name: string) {
  await user.click(await screen.findByRole('button', { name: /make a new mod/i }));
  await user.type(screen.getByLabelText(/what’s it called/i), name);
  await user.click(screen.getByRole('button', { name: /let’s go/i }));
  await screen.findByRole('heading', { name });
}

describe('saving a mod to a file, through the UI', () => {
  let capture: ReturnType<typeof captureDownloads>;

  beforeEach(async () => {
    for (const p of await listProjects()) await deleteProject(p.id);
    capture = captureDownloads();
  });

  afterEach(() => capture.restore());

  it('saves the newest work, not the last autosaved copy', async () => {
    // Regression: the backup was taken from the `projects` list, which is a
    // snapshot from the last listProjects(). Autosave is debounced, so adding
    // an item and immediately tapping My Mods and then 💾 produced a file with
    // the item MISSING — silently shipping a stale backup, which is the exact
    // failure this feature exists to prevent.
    const user = userEvent.setup();
    render(<App />);
    await newMod(user, 'Fresh Mod');

    await user.click(screen.getByRole('button', { name: /add an item/i }));
    await user.type(screen.getByLabelText(/name it/i), 'Brand New Sword');
    await user.click(screen.getByRole('button', { name: /back to my mod/i }));

    // Straight to the list and straight to save — no pause for autosave.
    await user.click(screen.getByRole('button', { name: /my mods/i }));
    await user.click(await screen.findByRole('button', { name: /save fresh mod to a file/i }));

    let result!: Awaited<ReturnType<typeof capture.waitForDownload>>;
    await act(async () => {
      result = await capture.waitForDownload();
    });

    expect(result.fileName).toBe('Fresh_Mod.modmaker.json');
    const restored = parseBackup(new TextDecoder().decode(result.bytes));
    expect(restored.items.map((i) => i.name)).toEqual(['Brand New Sword']);
  });

  it('opens a saved mod back up after storage is wiped', async () => {
    const user = userEvent.setup();
    render(<App />);
    await newMod(user, 'Round Trip');
    await user.click(screen.getByRole('button', { name: /add an item/i }));
    await user.type(screen.getByLabelText(/name it/i), 'Kept Sword');
    await user.click(screen.getByRole('button', { name: /back to my mod/i }));
    await user.click(screen.getByRole('button', { name: /my mods/i }));
    await user.click(await screen.findByRole('button', { name: /save round trip to a file/i }));

    let result!: Awaited<ReturnType<typeof capture.waitForDownload>>;
    await act(async () => {
      result = await capture.waitForDownload();
    });

    // Lose the mod — through the UI, so the app's own state agrees it is gone.
    // (Deleting behind its back leaves a stale id in state, and the restore is
    // then treated as a clash and renamed to "... copy".)
    await user.click(screen.getByRole("button", { name: /delete round trip/i }));
    await user.click(screen.getByRole("button", { name: /really delete round trip/i }));
    expect(screen.queryByRole("button", { name: /open round trip/i })).toBeNull();

    // The picker is a deliberately hidden input opened by the visible button,
    // and userEvent rightly refuses to interact with hidden elements — so the
    // change is dispatched directly.
    const text = new TextDecoder().decode(result.bytes);
    const file = new File([text], result.fileName, { type: 'application/json' });
    const input = document.querySelector('input[type=file]') as HTMLInputElement;
    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } });
    });

    expect(await screen.findByText(/opened “round trip”/i)).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /open round trip/i })).toBeInTheDocument();
  });

  it('explains an unopenable file instead of failing silently', async () => {
    render(<App />);
    await screen.findByRole('button', { name: /make a new mod/i });

    const input = document.querySelector('input[type=file]') as HTMLInputElement;
    const junk = new File(['not json at all'], 'notes.txt', { type: 'text/plain' });
    await act(async () => {
      fireEvent.change(input, { target: { files: [junk] } });
    });

    expect(await screen.findByText(/isn’t a saved mod/i)).toBeInTheDocument();
  });
});
