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
  /** Extra panel above the tools — gets the texture as it is being painted. */
  sidebar?: (texture: Texture) => ReactNode;
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
  sidebar,
  onSave,
  onCancel,
}: Props) {
  const history = useUndoStack<Texture>(normalizeTexture(texture));
  const current = history.present;

  const [tool, setTool] = useState<ToolId>('pencil');
  const [color, setColor] = useState<string>(DEFAULT_COLOR);
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
  const painting = useRef(false);
  const lastCell = useRef<{ x: number; y: number } | null>(null);
  const reset = history.reset;

  // A different subject (another item) resets the canvas and its history.
  useEffect(() => {
    reset(normalizeTexture(texture));
  }, [texture, reset]);

  const applyAt = useCallback(
    (x: number, y: number, continuing: boolean) => {
      if (tool === 'eyedropper') {
        const picked = getPixel(current, x, y);
        if (picked) setColor(picked);
        return;
      }

      if (tool === 'fill') {
        history.commit(floodFill(current, x, y, color));
        return;
      }

      const paint = tool === 'eraser' ? null : color;
      const from = continuing ? lastCell.current : null;
      const next = from ? drawLine(current, from, { x, y }, paint) : setPixel(current, x, y, paint);
      // Mid-stroke updates bypass history so one drag is one undo step.
      if (continuing) history.replace(next);
      else history.commit(next);
    },
    [tool, color, current, history],
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

  const handleResize = (size: TextureSize) => {
    if (size === current.size) return;
    history.commit(resizeTexture(current, size));
  };

  // A guide only makes sense against the canvas it was built for. If a resize
  // ever put the two out of step, showing nothing beats showing a lie.
  const map = guide && guide.used.length === current.size * current.size ? guide : undefined;

  const areaAt = useCallback(
    (x: number, y: number) =>
      map?.areas.find((a) => x >= a.x && x < a.x + a.w && y >= a.y && y < a.y + a.h) ?? null,
    [map],
  );

  const readout = useMemo(() => {
    if (!map) return null;
    if (!hover) return 'Point at the grid to see which bit of your creature it paints.';
    const area = areaAt(hover.x, hover.y);
    if (!area) return 'This square is not on your creature — painting here shows nowhere.';
    return `${area.partLabel} — ${area.faceLabel.toLowerCase()}`;
  }, [map, hover, areaAt]);

  return (
    <div className="pixel-editor stack">
      <div className="row">
        <h2>{title}</h2>
        <span className="spacer" />
        <button className="btn btn--ghost" onClick={onCancel}>
          Cancel
        </button>
        <button className="btn btn--go" onClick={() => onSave(current)}>
          ✓ Done
        </button>
      </div>

      <div className="pixel-editor__body">
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

        <div className="pixel-editor__controls stack">
          {sidebar?.(current)}
          <div className="tool-row" role="group" aria-label="Tools">
            {TOOLS.map((t) => (
              <button
                key={t.id}
                className={`tool ${tool === t.id ? 'tool--on' : ''}`}
                aria-pressed={tool === t.id}
                title={t.hint}
                onClick={() => setTool(t.id)}
              >
                <span aria-hidden>{t.emoji}</span>
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
                🎨
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
              ↩️ Undo
            </button>
            <button className="btn btn--ghost" onClick={history.redo} disabled={!history.canRedo}>
              ↪️ Redo
            </button>
          </div>

          <div className="row">
            <button className="btn btn--ghost" onClick={() => history.commit(mirrorHorizontal(current))}>
              🪞 Mirror
            </button>
            <button className="btn btn--danger" onClick={() => history.commit(clearTexture(current))}>
              🗑️ Clear
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
        </div>
      </div>
    </div>
  );
}
