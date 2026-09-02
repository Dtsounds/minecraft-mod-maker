import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Texture } from '../../bedrock/types';
import { normalizeTexture, resizeTexture, type TextureSize, TEXTURE_SIZES } from '../../bedrock/texture';
import { DEFAULT_COLOR, PALETTE_ROWS } from './palette';
import {
  TOOLS,
  type ToolId,
  clearTexture,
  drawLine,
  floodFill,
  getPixel,
  mirrorHorizontal,
  setPixel,
} from './tools';
import { useUndoStack } from './useUndoStack';
import { Icon } from '../Icon';

/**
 * A map of what the canvas means, for textures that wrap onto something.
 *
 * An item's texture is just a picture, but a creature's is a sheet that folds
 * onto a set of boxes: most of it shows nowhere, and two rectangles can be the
 * same arm twice. Passing this in draws that on top of the grid. Deliberately
 * a plain shape rather than an import from the mob code — the editor should
 * not have to know what a rig is.
 */
export interface PixelGuide {
  /** `size * size`, false where painting shows up nowhere. */
  used: boolean[];
  areas: {
    x: number;
    y: number;
    w: number;
    h: number;
    partId: string;
    partLabel: string;
    faceLabel: string;
  }[];
  /** When set, everything outside this part is dimmed away. */
  focus?: string | null;
}

interface Props {
  texture: Texture;
  title?: string;
  /** Offer the 16/32/64 size switcher. */
  allowResize?: boolean;
  /** Draw the part/face map over the grid. */
  guide?: PixelGuide;
  /**
   * A better painting surface than a flat square — the 3D creature.
   *
   * It gets the texture as it is being painted and a brush onto it, so it
   * paints through this editor's tools, colour and undo stack rather than
   * beside them. When one is given it becomes the main event and the flat
   * sheet folds away behind a button, because for a creature the sheet is the
   * fallback, not the thing a kid wants to look at.
   */
  stage?: (brush: {
    texture: Texture;
    paint: (x: number, y: number, phase: 'start' | 'continue', connect: boolean) => void;
  }) => ReactNode;
  onSave: (texture: Texture) => void;
  onCancel: () => void;
}

/**
 * The pixel texture editor.
 *
 * Rendered as a grid of <button> cells rather than a <canvas>: at 16-64px a
 * side that is at most 4096 nodes, it gives every pixel a real hit target and
 * keyboard focus for free, and it means the editor is fully driveable from
 * tests without faking canvas coordinates.
 */
export function PixelEditor({
  texture,
  title = 'Draw your picture',
  allowResize = true,
  guide,
  stage,
  onSave,
  onCancel,
}: Props) {
  const history = useUndoStack<Texture>(normalizeTexture(texture));
  const current = history.present;

  const [tool, setTool] = useState<ToolId>('pencil');
  const [color, setColor] = useState<string>(DEFAULT_COLOR);
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const painting = useRef(false);
  const lastCell = useRef<{ x: number; y: number } | null>(null);
  const reset = history.reset;

  // A different subject (another item) resets the canvas and its history.
  useEffect(() => {
    reset(normalizeTexture(texture));
  }, [texture, reset]);

  // A guide only makes sense against the canvas it was built for. If a resize
  // ever put the two out of step, showing nothing beats showing a lie.
  const map = guide && guide.used.length === current.size * current.size ? guide : undefined;

  const areaAt = useCallback(
    (x: number, y: number) =>
      map?.areas.find((a) => x >= a.x && x < a.x + a.w && y >= a.y && y < a.y + a.h) ?? null,
    [map],
  );

  const applyAt = useCallback(
    (x: number, y: number, continuing: boolean, connect = true) => {
      if (tool === 'eyedropper') {
        const picked = getPixel(current, x, y);
        if (picked) setColor(picked);
        return;
      }

      if (tool === 'fill') {
        // On a creature, a fill belongs to the face that was clicked. Without
        // that bound it crosses the transparent gaps between faces and paints
        // the whole animal — and on dead space it would scribble thousands of
        // pixels that show nowhere and then have to be saved.
        if (map) {
          const area = areaAt(x, y);
          if (area) history.commit(floodFill(current, x, y, color, area));
          return;
        }
        history.commit(floodFill(current, x, y, color));
        return;
      }

      const paint = tool === 'eraser' ? null : color;
      // `connect` is false when the previous point of this stroke was on
      // another face of the model: joining those two up would draw a line
      // straight across whatever sits between them on the flat sheet.
      const from = continuing && connect ? lastCell.current : null;
      const next = from ? drawLine(current, from, { x, y }, paint) : setPixel(current, x, y, paint);
      // Mid-stroke updates bypass history so one drag is one undo step.
      if (continuing) history.replace(next);
      else history.commit(next);
    },
    [tool, color, current, history, map, areaAt],
  );

  const handleDown = (x: number, y: number) => {
    painting.current = true;
    lastCell.current = { x, y };
    applyAt(x, y, false);
  };

  const handleEnter = (x: number, y: number) => {
    if (!painting.current) return;
    if (tool === 'fill' || tool === 'eyedropper') return;
    applyAt(x, y, true);
    lastCell.current = { x, y };
  };

  useEffect(() => {
    const stop = () => {
      painting.current = false;
      lastCell.current = null;
    };
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
    return () => {
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
    };
  }, []);

  useEffect(() => {
    if (!sheetOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setSheetOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sheetOpen]);

  const handleResize = (size: TextureSize) => {
    if (size === current.size) return;
    history.commit(resizeTexture(current, size));
  };

  const readout = useMemo(() => {
    if (!map) return null;
    if (!hover) return 'Point at the grid to see which bit of your creature it paints.';
    const area = areaAt(hover.x, hover.y);
    if (!area) return 'This square is not on your creature — painting here shows nowhere.';
    return `${area.partLabel} — ${area.faceLabel.toLowerCase()}`;
  }, [map, hover, areaAt]);

  const brush = {
    texture: current,
    paint: (x: number, y: number, phase: 'start' | 'continue', connect: boolean) => {
      applyAt(x, y, phase === 'continue', connect);
      lastCell.current = { x, y };
    },
  };

  // The flat sheet. Rendered in place when it is the only surface there is,
  // and inside the pop-up when the creature has taken the main slot.
  const canvas = (
    <div className="pixel-canvas stack">
        <div className="pixel-canvas__frame">
        <div
          className="pixel-grid"
          style={{ gridTemplateColumns: `repeat(${current.size}, 1fr)` }}
          role="grid"
          aria-label="Drawing grid"
          onPointerLeave={() => {
            lastCell.current = null;
            setHover(null);
          }}
        >
          {current.pixels.map((cell, index) => {
            const x = index % current.size;
            const y = Math.floor(index / current.size);
            const where = `${x + 1}, ${y + 1}`;
            const area = map ? areaAt(x, y) : null;
            const dead = map ? !map.used[index] : false;
            const muted = Boolean(map?.focus && area && area.partId !== map.focus);
            const what = area ? `, ${area.partLabel} ${area.faceLabel.toLowerCase()}` : dead ? ', not on your creature' : '';
            return (
              <button
                key={index}
                type="button"
                className={`pixel-grid__cell${dead ? ' pixel-grid__cell--dead' : ''}${
                  muted ? ' pixel-grid__cell--muted' : ''
                }`}
                role="gridcell"
                aria-label={(cell ? `Pixel ${where}, ${cell}` : `Pixel ${where}, empty`) + what}
                style={cell ? { background: cell } : undefined}
                onPointerDown={(e) => {
                  // Release capture so a drag that leaves this button still
                  // fires pointerenter on its neighbours.
                  e.currentTarget.releasePointerCapture?.(e.pointerId);
                  handleDown(x, y);
                }}
                onPointerEnter={() => {
                  if (map) setHover({ x, y });
                  handleEnter(x, y);
                }}
                onFocus={() => map && setHover({ x, y })}
                onClick={() => {
                  // Keyboard / assistive activation, and the path tests take.
                  if (!painting.current) applyAt(x, y, false);
                }}
              />
            );
          })}
        </div>

        {map && (
          <div className="pixel-guide" aria-hidden>
            {map.areas.map((area) => {
              const pct = (n: number) => `${(n / current.size) * 100}%`;
              const big = area.w >= 6 && area.h >= 5;
              const dim = Boolean(map.focus && area.partId !== map.focus);
              return (
                <div
                  key={`${area.x},${area.y},${area.w},${area.h},${area.faceLabel}`}
                  className={`pixel-guide__area${dim ? ' pixel-guide__area--dim' : ''}`}
                  style={{ left: pct(area.x), top: pct(area.y), width: pct(area.w), height: pct(area.h) }}
                >
                  {big && <span className="pixel-guide__label">{area.faceLabel}</span>}
                </div>
              );
            })}
          </div>
        )}
        </div>

        {readout && (
          <p className="pixel-canvas__readout" role="status">
            {readout}
          </p>
        )}
    </div>
  );

  return (
    <div className="pixel-editor stack">
      <div className="row">
        <h2>{title}</h2>
        <span className="spacer" />
        <button className="btn btn--ghost" onClick={onCancel}>
          Cancel
        </button>
        <button className="btn btn--go" onClick={() => onSave(current)}>
          <Icon name="check" size={17} />
          Done
        </button>
      </div>

      <div className={`pixel-editor__body${stage ? ' pixel-editor__body--stage' : ''}`}>
        {stage ? <div className="pixel-editor__stage">{stage(brush)}</div> : canvas}

        <div className="pixel-editor__controls stack">
          <div className="tool-row" role="group" aria-label="Tools">
            {TOOLS.map((t) => (
              <button
                key={t.id}
                className={`tool ${tool === t.id ? 'tool--on' : ''}`}
                aria-pressed={tool === t.id}
                title={t.hint}
                onClick={() => setTool(t.id)}
              >
                <Icon name={t.icon} />
                <span className="tiny">{t.label}</span>
              </button>
            ))}
          </div>

          <div className="stack">
            <div className="row">
              <span className="field__label">Colour</span>
              <span
                className="swatch swatch--current"
                style={{ background: color }}
                aria-label={`Current colour ${color}`}
              />
              <span className="spacer" />
              <label className="btn btn--ghost btn--icon" title="Pick any colour">
                <Icon name="palette" />
                <input
                  type="color"
                  className="sr-only"
                  aria-label="Pick a custom colour"
                  value={color}
                  onChange={(e) => {
                    setColor(e.target.value);
                    setTool('pencil');
                  }}
                />
              </label>
            </div>
            <div className="palette" role="group" aria-label="Colour palette">
              {PALETTE_ROWS.map((row, rowIndex) => (
                <div className="palette__row" key={rowIndex}>
                  {row.map((swatch) => (
                    <button
                      key={swatch}
                      className={`swatch ${color === swatch ? 'swatch--on' : ''}`}
                      style={{ background: swatch }}
                      aria-label={`Colour ${swatch}`}
                      aria-pressed={color === swatch}
                      onClick={() => {
                        setColor(swatch);
                        if (tool === 'eraser' || tool === 'eyedropper') setTool('pencil');
                      }}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>

          <div className="row">
            <button className="btn btn--ghost" onClick={history.undo} disabled={!history.canUndo}>
              <Icon name="undo" size={17} />
              Undo
            </button>
            <button className="btn btn--ghost" onClick={history.redo} disabled={!history.canRedo}>
              <Icon name="redo" size={17} />
              Redo
            </button>
          </div>

          <div className="row">
            <button className="btn btn--ghost" onClick={() => history.commit(mirrorHorizontal(current))}>
              <Icon name="mirror" size={17} />
              Mirror
            </button>
            <button className="btn btn--danger" onClick={() => history.commit(clearTexture(current))}>
              <Icon name="trash" size={17} />
              Clear
            </button>
          </div>

          {allowResize && (
            <div className="stack">
              <span className="field__label">Detail</span>
              <div className="row" role="group" aria-label="Texture size">
                {TEXTURE_SIZES.map((size) => (
                  <button
                    key={size}
                    className={`btn ${current.size === size ? '' : 'btn--ghost'}`}
                    aria-pressed={current.size === size}
                    onClick={() => handleResize(size)}
                  >
                    {size}×{size}
                  </button>
                ))}
              </div>
              <p className="tiny muted">Bigger means more detail, but more squares to fill in.</p>
            </div>
          )}

          {stage && (
            <button className="btn btn--ghost" onClick={() => setSheetOpen(true)}>
              <Icon name="grid" size={17} />
              Show the flat picture
            </button>
          )}
        </div>
      </div>

      {stage && sheetOpen && (
        <div className="pixel-sheet">
          <div className="pixel-sheet__panel stack" role="dialog" aria-modal="true" aria-label="The flat picture">
            <div className="row">
              <h3>The flat picture</h3>
              <span className="spacer" />
              <button className="btn btn--go" onClick={() => setSheetOpen(false)}>
                <Icon name="check" size={17} />
                Close
              </button>
            </div>
            <p className="tiny muted">
              This is the whole skin, unfolded. Every box shows which bit of your creature it
              wraps onto — the hatched squares are not on it at all.
            </p>
            {canvas}
          </div>
        </div>
      )}
    </div>
  );
}
