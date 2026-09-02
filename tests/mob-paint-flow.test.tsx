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
  // The creature is the canvas now; the flat sheet is behind a button.
  await screen.findByRole('group', { name: /paint on it, or drag to turn it/i });
}

/** The flat sheet now lives behind a button — open it before poking at it. */
async function openSheet(user: User) {
  await user.click(screen.getByRole('button', { name: /show the flat picture/i }));
  await screen.findByRole('dialog', { name: /the flat picture/i });
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

    // On the creature itself, first — that is where a kid now paints.
    const world = screen.getByTestId('mob-preview-world');
    const nose = (world.querySelector('[data-bone="head"]') as HTMLElement).querySelector(
      '[data-face="front"] .mob-preview__texel',
    ) as HTMLElement;
    await user.hover(nose);
    expect(await screen.findByRole('status')).toHaveTextContent('Head — front');

    // And on the flat sheet, for anyone who opens it.
    await openSheet(user);
    // The quadruped's head is an 8x8x6 box at uv 0,0, so its face is at (6,6).
    expect(cell(8, 8)).toHaveAccessibleName(/head front/i);
  }, 40000);

  it('marks the two thirds of the canvas that show up nowhere', async () => {
    const user = userEvent.setup();
    render(<App />);
    await openPainter(user);
    await openSheet(user);

    const map = rigUvMap(mobRig('quadruped'));
    const dead = map.used.indexOf(false);
    expect(cell(dead % 64, Math.floor(dead / 64))).toHaveClass('pixel-grid__cell--dead');
    expect(cell(8, 8)).not.toHaveClass('pixel-grid__cell--dead');

    // And it says so, rather than leaving the kid to wonder. Scoped to the
    // pop-up: the creature behind it has a readout of its own, which `aria-
    // modal` hides from assistive tech but not from a query.
    await user.hover(cell(63, 63));
    const sheet = screen.getByRole('dialog', { name: /the flat picture/i });
    expect(within(sheet).getByRole('status')).toHaveTextContent(/not on your creature/i);
  }, 40000);

  it('dims everything but the part the kid picked', async () => {
    const user = userEvent.setup();
    render(<App />);
    await openPainter(user);

    const parts = screen.getByRole('group', { name: /which part to paint/i });
    await user.click(within(parts).getByRole('button', { name: /head/i }));
    await openSheet(user);

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
    // Six boxes for the quadruped rig, six faces each.
    expect(world.querySelectorAll('[data-bone]')).toHaveLength(6);
    expect(world.querySelectorAll('.mob-preview__face')).toHaveLength(36);

    // Every texel that shows on the creature exists as an element, and no
    // more: that is what makes the model itself clickable.
    const map = rigUvMap(mobRig('quadruped'));
    expect(world.querySelectorAll('.mob-preview__texel')).toHaveLength(
      map.used.filter(Boolean).length,
    );

    // The head box's front face carries the head's front rectangle. The whole
    // point of the preview is that this correspondence is real.
    const head = world.querySelector('[data-bone="head"]') as HTMLElement;
    const front = head.querySelector('[data-face="front"]') as HTMLElement;
    const area = map.areas.find((a) => a.partId === 'head' && a.face === 'front');
    const first = front.querySelector('.mob-preview__texel') as HTMLElement;
    expect(first).toHaveAccessibleName(`Paint ${(area?.x ?? 0) + 1}, ${(area?.y ?? 0) + 1}`);
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

  it('paints straight onto the creature, and the flat sheet agrees', async () => {
    // The whole point: a kid should never have to work out which square of a
    // 64x64 sheet is the nose. They click the nose.
    const user = userEvent.setup();
    render(<App />);
    await openPainter(user);

    const world = screen.getByTestId('mob-preview-world');
    const head = world.querySelector('[data-bone="head"]') as HTMLElement;
    const front = head.querySelector('[data-face="front"]') as HTMLElement;
    const texels = front.querySelectorAll<HTMLElement>('.mob-preview__texel');

    // Pick a colour, then click a texel in the middle of the creature's face.
    await user.click(screen.getByRole('button', { name: /colour #c22036/i }));
    const target = texels[Math.floor(texels.length / 2)] as HTMLElement;
    const [, tx, ty] = /Paint (\d+), (\d+)/.exec(target.getAttribute('aria-label') ?? '') ?? [];
    await user.click(target);

    // The same pixel of the flat grid changed — one texture, two surfaces.
    expect(target.style.background).toBe('rgb(194, 32, 54)');

    // ...and the same pixel of the flat sheet changed: one texture, two views.
    await openSheet(user);
    const flat = cell(Number(tx) - 1, Number(ty) - 1);
    expect(flat).toHaveAccessibleName(/#c22036/i);
  }, 40000);

  it('carries a 3D stroke into the saved skin, as one undo', async () => {
    const user = userEvent.setup();
    render(<App />);
    await openPainter(user);

    const world = screen.getByTestId('mob-preview-world');
    const front = (world.querySelector('[data-bone="head"]') as HTMLElement).querySelector(
      '[data-face="front"]',
    ) as HTMLElement;
    const texels = front.querySelectorAll<HTMLElement>('.mob-preview__texel');
    await user.click(screen.getByRole('button', { name: /colour #c22036/i }));
    await user.click(texels[0] as HTMLElement);
    await user.click(texels[1] as HTMLElement);

    // Undo takes back one dab, not the whole session.
    await user.click(screen.getByRole('button', { name: /undo/i }));
    expect((texels[0] as HTMLElement).style.background).toBe('rgb(194, 32, 54)');

    await user.click(screen.getByRole('button', { name: /done/i }));
    // Back on the creature screen, the skin kept the paint.
    const still = screen.getByTestId('mob-preview-world');
    const kept = still.querySelectorAll<HTMLElement>('.mob-preview__texel');
    expect([...kept].some((t) => t.style.background === 'rgb(194, 32, 54)')).toBe(true);
  }, 40000);

  it('turns instead of painting once the kid says so', async () => {
    const user = userEvent.setup();
    render(<App />);
    await openPainter(user);

    // In turning mode the texels stop being buttons, so a drag cannot smear
    // paint across a creature the kid only meant to spin round.
    expect(screen.getAllByRole('button', { name: /^Paint \d+, \d+$/ }).length).toBeGreaterThan(0);
    await user.click(screen.getByRole('button', { name: /painting/i }));
    expect(screen.queryAllByRole('button', { name: /^Paint \d+, \d+$/ })).toHaveLength(0);

    // The turn buttons work whatever mode it is in.
    const world = screen.getByTestId('mob-preview-world');
    const before = world.style.transform;
    await user.click(screen.getByRole('button', { name: /turn right/i }));
    expect(world.style.transform).not.toBe(before);
  }, 40000);

  it('flies the camera to the part the kid picked, and back out again', async () => {
    // Painting a chicken's foot on a whole chicken means aiming at four
    // pixels. Framing the part makes those same four pixels fill the stage.
    const user = userEvent.setup();
    render(<App />);
    await openPainter(user);

    const world = screen.getByTestId('mob-preview-world');
    expect(world.style.transform).toMatch(/scale\(1\)/);

    const parts = screen.getByRole('group', { name: /which part to paint/i });
    await user.click(within(parts).getByRole('button', { name: /legs/i }));

    // Zoomed in, and centred on something other than the whole creature.
    const zoom = Number(/scale\(([\d.]+)\)/.exec(world.style.transform)?.[1]);
    expect(zoom).toBeGreaterThan(1);
    expect(world.style.transform).not.toMatch(/translate3d\(0px, 0px, 0px\)/);

    await user.click(within(parts).getByRole('button', { name: /^All$/i }));
    expect(world.style.transform).toMatch(/scale\(1\)/);
    expect(world.style.transform).toMatch(/translate3d\(0px, 0px, 0px\)/);
  }, 40000);

  it('only paints the part in close-up, not the scenery behind it', async () => {
    const user = userEvent.setup();
    render(<App />);
    await openPainter(user);

    const parts = screen.getByRole('group', { name: /which part to paint/i });
    await user.click(within(parts).getByRole('button', { name: /head/i }));

    const world = screen.getByTestId('mob-preview-world');
    const paintable = (bone: string) =>
      (world.querySelector(`[data-bone="${bone}"]`) as HTMLElement).querySelectorAll('button').length;

    expect(paintable('head')).toBeGreaterThan(0);
    // The faded body is scenery: it must not take paint meant for the head.
    expect(paintable('body')).toBe(0);
  }, 40000);

  it('shuts the flat picture again with Escape, or the close button', async () => {
    const user = userEvent.setup();
    render(<App />);
    await openPainter(user);
    await openSheet(user);

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: /the flat picture/i })).not.toBeInTheDocument();

    await openSheet(user);
    await user.click(screen.getByRole('button', { name: /close/i }));
    expect(screen.queryByRole('dialog', { name: /the flat picture/i })).not.toBeInTheDocument();
    // Still on the creature, with the paint intact.
    expect(screen.getByTestId('mob-preview-world')).toBeInTheDocument();
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
    // No creature, so no pop-up either: the grid is simply the canvas.
    expect(screen.queryByRole('button', { name: /show the flat picture/i })).not.toBeInTheDocument();
    expect(screen.getByRole('grid', { name: /drawing grid/i })).toBeInTheDocument();
  }, 40000);
});
