import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import App from '../src/App';
import { deleteProject, listProjects } from '../src/storage/db';
import { mobRig } from '../src/bedrock/mobGeometry';
import { rigUvMap } from '../src/bedrock/mobUv';

type User = ReturnType<typeof userEvent.setup>;

/** New mod -> add a creature -> the painting screen. */
async function openPainter(user: User, rig?: RegExp) {
  await user.click(await screen.findByRole('button', { name: /make a new mod/i }));
  await user.type(screen.getByLabelText(/what’s it called/i), 'Paint Mod');
  await user.click(screen.getByRole('button', { name: /let’s go/i }));
  await user.click(await screen.findByRole('button', { name: /add a creature/i }));
  await user.type(screen.getByLabelText(/name it/i), 'Blob');
  if (rig) await user.click(screen.getByRole('button', { name: rig }));
  await user.click(screen.getByRole('button', { name: /next: draw it/i }));
  await user.click(screen.getByRole('button', { name: /start me off/i }));
  await user.click(screen.getByRole('button', { name: /paint its skin/i }));
  await screen.findByRole('grid', { name: /drawing grid/i });
}

/** The cell at (x, y) of the 64x64 grid. */
function cell(x: number, y: number) {
  const cells = screen.getAllByRole('gridcell');
  return cells[y * 64 + x] as HTMLElement;
}

/** A pixel that really is on the named part — asked of the map, not guessed. */
function pixelOn(part: string): [number, number] {
  const area = rigUvMap(mobRig('quadruped')).areas.find((a) => a.partId === part);
  if (!area) throw new Error(`no ${part} in the quadruped rig`);
  return [area.x, area.y];
}

describe('painting a creature', () => {
  beforeEach(async () => {
    for (const p of await listProjects()) await deleteProject(p.id);
  });

  it('says which bit of the creature each square paints', async () => {
    const user = userEvent.setup();
    render(<App />);
    await openPainter(user);

    // The quadruped's head is an 8x8x6 box at uv 0,0, so its face is at (6,6).
    expect(cell(8, 8)).toHaveAccessibleName(/head front/i);
    await user.hover(cell(8, 8));
    expect(await screen.findByRole('status')).toHaveTextContent('Head — front');
  }, 40000);

  it('marks the two thirds of the canvas that show up nowhere', async () => {
    const user = userEvent.setup();
    render(<App />);
    await openPainter(user);

    const map = rigUvMap(mobRig('quadruped'));
    const dead = map.used.indexOf(false);
    expect(cell(dead % 64, Math.floor(dead / 64))).toHaveClass('pixel-grid__cell--dead');
    expect(cell(8, 8)).not.toHaveClass('pixel-grid__cell--dead');

    // And it says so, rather than leaving the kid to wonder.
    await user.hover(cell(63, 63));
    expect(await screen.findByRole('status')).toHaveTextContent(/not on your creature/i);
  }, 40000);

  it('dims everything but the part the kid picked', async () => {
    const user = userEvent.setup();
    render(<App />);
    await openPainter(user);

    const parts = screen.getByRole('group', { name: /which part to paint/i });
    await user.click(within(parts).getByRole('button', { name: /head/i }));

    const [hx, hy] = pixelOn('head');
    const [bx, by] = pixelOn('body');
    expect(cell(hx, hy)).not.toHaveClass('pixel-grid__cell--muted');
    expect(cell(bx, by)).toHaveClass('pixel-grid__cell--muted');
    // Picking it again goes back to showing everything.
    await user.click(within(parts).getByRole('button', { name: /head/i }));
    expect(cell(bx, by)).not.toHaveClass('pixel-grid__cell--muted');
  }, 40000);

  it('offers the parts that this body shape actually has', async () => {
    const user = userEvent.setup();
    render(<App />);
    await openPainter(user, /Bird.*chicken/i);

    const parts = screen.getByRole('group', { name: /which part to paint/i });
    expect(within(parts).getByRole('button', { name: /wings/i })).toBeInTheDocument();
    expect(within(parts).queryByRole('button', { name: /arms/i })).not.toBeInTheDocument();
  }, 40000);

  it('shows the creature in 3D, textured from the skin being painted', async () => {
    const user = userEvent.setup();
    render(<App />);
    await openPainter(user);

    const world = screen.getByTestId('mob-preview-world');
    // Six boxes for the quadruped rig, six faces each, all textured.
    expect(world.querySelectorAll('[data-bone]')).toHaveLength(6);
    const faces = world.querySelectorAll<HTMLElement>('.mob-preview__face');
    expect(faces).toHaveLength(36);
    for (const face of faces) expect(face.style.backgroundImage).toMatch(/url\("?data:image\/png;base64,/);

    // The head box's front face must show the head's front rectangle. The
    // whole point of the preview is that this correspondence is real.
    const head = world.querySelector('[data-bone="head"]') as HTMLElement;
    const front = head.querySelector('[data-face="front"]') as HTMLElement;
    const area = rigUvMap(mobRig('quadruped')).areas.find(
      (a) => a.partId === 'head' && a.face === 'front',
    );
    const scale = Number.parseFloat(front.style.backgroundSize) / 64;
    expect(Number.parseFloat(front.style.backgroundPosition)).toBeCloseTo(-(area?.x ?? 0) * scale, 4);
  }, 40000);

  it('builds the creature the right way up and the right way round', async () => {
    // Minecraft's y points up and its z points south; CSS y points down and z
    // points at the viewer, so both flip. Get either wrong and the creature is
    // upside down or inside out — which a texture assertion would not notice.
    const user = userEvent.setup();
    render(<App />);
    await openPainter(user);

    const world = screen.getByTestId('mob-preview-world');
    const centre = (bone: string) => {
      const el = world.querySelector(`[data-bone="${bone}"]`) as HTMLElement;
      const m = /translate3d\(([-\d.]+)px, ([-\d.]+)px, ([-\d.]+)px\)/.exec(el.style.transform);
      if (!m) throw new Error(`no position for ${bone}: ${el.style.transform}`);
      return { x: Number(m[1]), y: Number(m[2]), z: Number(m[3]) };
    };

    // The head sits above the body on screen, and in front of it.
    expect(centre('head').y).toBeLessThan(centre('body').y);
    expect(centre('head').z).toBeGreaterThan(centre('body').z);
    // The legs are below the body.
    expect(centre('leg0').y).toBeGreaterThan(centre('body').y);
    // leg0 and leg1 are a left/right pair, so they straddle the middle.
    expect(Math.sign(centre('leg0').x)).toBe(-Math.sign(centre('leg1').x));

    // And the front face is pushed towards the viewer, not away from it.
    const head = world.querySelector('[data-bone="head"]') as HTMLElement;
    const front = head.querySelector('[data-face="front"]') as HTMLElement;
    expect(front.style.transform).toMatch(/^translateZ\([\d.]+px\)$/);
  }, 40000);

  it('leaves an item’s texture as a plain square, with no creature map', async () => {
    // The guide is a creature thing. An item's picture is just a picture.
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole('button', { name: /make a new mod/i }));
    await user.type(screen.getByLabelText(/what’s it called/i), 'Plain Mod');
    await user.click(screen.getByRole('button', { name: /let’s go/i }));
    await user.click(await screen.findByRole('button', { name: /add an item/i }));
    await user.type(screen.getByLabelText(/name it/i), 'Rock');
    await user.click(screen.getByRole('button', { name: /next: draw it/i }));
    await user.click(screen.getByRole('button', { name: /draw|paint/i }));
    await screen.findByRole('grid', { name: /drawing grid/i });

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.queryByTestId('mob-preview-world')).not.toBeInTheDocument();
    expect(document.querySelectorAll('.pixel-grid__cell--dead')).toHaveLength(0);
  }, 40000);
});
