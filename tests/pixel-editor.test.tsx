import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PixelEditor } from '../src/components/PixelEditor/PixelEditor';
import { blankTexture, textureToPng } from '../src/bedrock/texture';
import { isPng, readPngSize } from '../src/bedrock/png';
import type { Texture } from '../src/bedrock/types';

/** The grid cell at (x, y), 1-indexed in the accessible name. */
function cell(x: number, y: number) {
  return screen.getByRole('gridcell', { name: new RegExp(`^Pixel ${x + 1}, ${y + 1},`) });
}

function renderEditor(texture: Texture = blankTexture(16)) {
  const onSave = vi.fn();
  const onCancel = vi.fn();
  render(<PixelEditor texture={texture} onSave={onSave} onCancel={onCancel} />);
  return { onSave, onCancel };
}

/** The texture handed to onSave by the Done button. */
async function saveAndGet(onSave: ReturnType<typeof vi.fn>, user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /done/i }));
  expect(onSave).toHaveBeenCalled();
  return onSave.mock.calls.at(-1)?.[0] as Texture;
}

describe('pixel editor, driven through the UI', () => {
  it('renders one cell per pixel', () => {
    renderEditor(blankTexture(16));
    expect(screen.getAllByRole('gridcell')).toHaveLength(256);
  });

  it('paints a pixel in the selected colour', async () => {
    const user = userEvent.setup();
    const { onSave } = renderEditor();

    await user.click(screen.getByRole('button', { name: 'Colour #3fbf5f' }));
    await user.click(cell(2, 3));

    const saved = await saveAndGet(onSave, user);
    expect(saved.pixels[3 * 16 + 2]).toBe('#3fbf5f');
  });

  it('erases with the eraser tool', async () => {
    const user = userEvent.setup();
    const start = blankTexture(16);
    start.pixels[0] = '#ff0000';
    const { onSave } = renderEditor(start);

    await user.click(screen.getByRole('button', { name: /erase/i }));
    await user.click(cell(0, 0));

    const saved = await saveAndGet(onSave, user);
    expect(saved.pixels[0]).toBeNull();
  });

  it('flood-fills the canvas from a single tap', async () => {
    const user = userEvent.setup();
    const { onSave } = renderEditor();

    await user.click(screen.getByRole('button', { name: 'Colour #45b7f5' }));
    await user.click(screen.getByRole('button', { name: /fill/i }));
    await user.click(cell(8, 8));

    const saved = await saveAndGet(onSave, user);
    expect(saved.pixels.every((p) => p === '#45b7f5')).toBe(true);
  });

  it('picks up a colour with the eyedropper and paints with it', async () => {
    const user = userEvent.setup();
    const start = blankTexture(16);
    start.pixels[0] = '#c9a227';
    const { onSave } = renderEditor(start);

    await user.click(screen.getByRole('button', { name: /pick/i }));
    await user.click(cell(0, 0));
    await user.click(screen.getByRole('button', { name: /draw/i }));
    await user.click(cell(5, 5));

    const saved = await saveAndGet(onSave, user);
    expect(saved.pixels[5 * 16 + 5]).toBe('#c9a227');
  });

  it('undoes and redoes a stroke', async () => {
    const user = userEvent.setup();
    const { onSave } = renderEditor();

    const undo = screen.getByRole('button', { name: /undo/i });
    const redo = screen.getByRole('button', { name: /redo/i });
    expect(undo).toBeDisabled();
    expect(redo).toBeDisabled();

    await user.click(cell(1, 1));
    expect(undo).toBeEnabled();

    await user.click(undo);
    let saved = await saveAndGet(onSave, user);
    expect(saved.pixels[1 * 16 + 1]).toBeNull();

    await user.click(redo);
    saved = await saveAndGet(onSave, user);
    expect(saved.pixels[1 * 16 + 1]).toBe('#ff4d5e');
  });

  it('undoes a fill in one step, not one step per pixel', async () => {
    const user = userEvent.setup();
    const { onSave } = renderEditor();

    await user.click(screen.getByRole('button', { name: /fill/i }));
    await user.click(cell(0, 0));
    await user.click(screen.getByRole('button', { name: /undo/i }));

    const saved = await saveAndGet(onSave, user);
    expect(saved.pixels.every((p) => p === null)).toBe(true);
  });

  it('clears the whole canvas, and the clear is undoable', async () => {
    const user = userEvent.setup();
    const start = blankTexture(16);
    start.pixels[0] = '#ff0000';
    const { onSave } = renderEditor(start);

    await user.click(screen.getByRole('button', { name: /clear/i }));
    let saved = await saveAndGet(onSave, user);
    expect(saved.pixels.every((p) => p === null)).toBe(true);

    await user.click(screen.getByRole('button', { name: /undo/i }));
    saved = await saveAndGet(onSave, user);
    expect(saved.pixels[0]).toBe('#ff0000');
  });

  it('mirrors the drawing left-to-right', async () => {
    const user = userEvent.setup();
    const { onSave } = renderEditor();

    await user.click(cell(0, 0));
    await user.click(screen.getByRole('button', { name: /mirror/i }));

    const saved = await saveAndGet(onSave, user);
    expect(saved.pixels[15]).toBe('#ff4d5e');
  });

  it('switches grid size and keeps the artwork', async () => {
    const user = userEvent.setup();
    const { onSave } = renderEditor();

    await user.click(cell(0, 0));
    await user.click(screen.getByRole('button', { name: '32×32' }));
    expect(screen.getAllByRole('gridcell')).toHaveLength(1024);

    const saved = await saveAndGet(onSave, user);
    expect(saved.size).toBe(32);
    // Nearest-neighbour upscale: one source pixel becomes a 2x2 block.
    expect(saved.pixels[0]).toBe('#ff4d5e');
    expect(saved.pixels[1]).toBe('#ff4d5e');
  });

  it('cancels without saving', async () => {
    const user = userEvent.setup();
    const { onSave, onCancel } = renderEditor();

    await user.click(cell(0, 0));
    await user.click(screen.getByRole('button', { name: /cancel/i }));

    expect(onCancel).toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('exports what was drawn as a transparent PNG at Bedrock pixel size', async () => {
    const user = userEvent.setup();
    const { onSave } = renderEditor();

    await user.click(cell(0, 0));
    const saved = await saveAndGet(onSave, user);

    const png = textureToPng(saved);
    expect(isPng(png)).toBe(true);
    expect(readPngSize(png)).toEqual([16, 16]);

    // Painted pixel is opaque; its neighbour is fully transparent.
    const { textureToRgba } = await import('../src/bedrock/texture');
    const rgba = textureToRgba(saved);
    expect(rgba[3]).toBe(255);
    expect(rgba[7]).toBe(0);
  });
});
