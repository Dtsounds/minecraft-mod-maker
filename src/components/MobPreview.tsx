import { useMemo, useRef, useState } from 'react';
import type { MobRig } from '../bedrock/mobGeometry';
import { cubeFaces, describePixel, rigUvMap, type CubeFace } from '../bedrock/mobUv';
import { normalizeTexture } from '../bedrock/texture';
import type { Texture } from '../bedrock/types';

interface Props {
  texture: Texture;
  rig: MobRig;
  /** Rendered box size in CSS pixels. */
  size?: number;
  label?: string;
  /** Supply this and the creature itself becomes the canvas. */
  onPaint?: (x: number, y: number, phase: 'start' | 'continue', connect: boolean) => void;
  /** Fade every part except this one, matching the flat grid. */
  focus?: string | null;
}

/**
 * The creature, in 3D, built out of the same rig that ships in the pack — and
 * painted directly, if you hand it `onPaint`.
 *
 * It is CSS 3D transforms rather than a 3D library, and every face is a grid
 * of its own texture pixels rather than an image. That second choice is what
 * makes painting on the model possible without projecting a click back through
 * a camera: a texel is a real element, so the browser's own hit testing says
 * which pixel was touched, `backface-visibility` already refuses the faces
 * pointing away, and the whole surface can be driven from a test with no
 * layout at all. It is the bargain the flat grid already makes, and it costs
 * less than the flat grid does — only the texels that appear on the creature
 * exist, which is about a third of the sheet.
 *
 * Minecraft's model space is x east, y up, z south, and a mob faces north.
 * CSS is x right, y DOWN, z toward the viewer. So `y` and `z` both flip, which
 * turns the mob's north face towards whoever is looking at it — exactly the
 * face the kid thinks of as the front. One texel is one model unit in a box
 * unwrap, so a face's pixel grid is exactly its size in the world.
 */

/** Where each face sits on its box, once flipped into CSS. */
const FACE_TRANSFORMS: Record<CubeFace, (w: number, h: number, d: number) => string> = {
  front: (_w, _h, d) => `translateZ(${d / 2}px)`,
  back: (_w, _h, d) => `rotateY(180deg) translateZ(${d / 2}px)`,
  right: (w) => `rotateY(90deg) translateZ(${w / 2}px)`,
  left: (w) => `rotateY(-90deg) translateZ(${w / 2}px)`,
  top: (_w, h) => `rotateX(90deg) translateZ(${h / 2}px)`,
  bottom: (_w, h) => `rotateX(-90deg) translateZ(${h / 2}px)`,
};

/** A mirrored box shows its twin's sides, flipped — so swap east and west. */
const MIRRORED: Record<CubeFace, CubeFace> = {
  front: 'front',
  back: 'back',
  top: 'top',
  bottom: 'bottom',
  left: 'right',
  right: 'left',
};

const FACES = Object.keys(FACE_TRANSFORMS) as CubeFace[];

/** `leg0` -> `legs`, matching how `mobUv` groups parts. */
function partOf(boneName: string): string {
  const stem = boneName.replace(/\d+$/, '');
  return stem === 'head' || stem === 'body' ? stem : `${stem}s`;
}

export function MobPreview({ texture, rig, size = 200, label, onPaint, focus }: Props) {
  const [angle, setAngle] = useState({ yaw: -28, pitch: 14 });
  const [turning, setTurning] = useState(false);
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ x: number; y: number } | null>(null);
  // Which face the last painted texel was on, so a stroke joins up along one
  // face but never smears a line across the gap between two of them.
  const stroke = useRef<string | null>(null);

  const skin = useMemo(() => normalizeTexture(texture), [texture]);
  const map = useMemo(() => rigUvMap(rig), [rig]);
  const paintable = Boolean(onPaint) && !turning;

  // Fit the rig in the box: find its extent, then scale so it fills the frame.
  const bounds = useMemo(() => {
    let minY = Infinity;
    let maxY = -Infinity;
    let reach = 1;
    for (const bone of rig.bones) {
      for (const cube of bone.cubes) {
        minY = Math.min(minY, cube.origin[1]);
        maxY = Math.max(maxY, cube.origin[1] + cube.size[1]);
        reach = Math.max(reach, Math.abs(cube.origin[0]), Math.abs(cube.origin[0] + cube.size[0]));
        reach = Math.max(reach, Math.abs(cube.origin[2]), Math.abs(cube.origin[2] + cube.size[2]));
      }
    }
    if (!Number.isFinite(minY) || !Number.isFinite(maxY)) return { minY: 0, maxY: 16, reach: 8 };
    return { minY, maxY, reach };
  }, [rig]);

  const span = Math.max(bounds.maxY - bounds.minY, bounds.reach * 2, 1);
  const scale = (size * 0.78) / span;
  const midY = (bounds.minY + bounds.maxY) / 2;

  /**
   * Fly the camera to whichever part the kid picked.
   *
   * Painting a chicken's foot on a whole chicken means aiming at a target four
   * pixels across. Framing the part instead makes those same four pixels fill
   * the stage, and because it is one transform on the world rather than a
   * different render, everything inside it — the texels, the hit testing, the
   * drag to turn — carries on working untouched.
   */
  const camera = useMemo(() => {
    const cubes = rig.bones
      .filter((b) => !focus || partOf(b.name) === focus)
      .flatMap((b) => b.cubes);
    if (!focus || cubes.length === 0) return { zoom: 1, x: 0, y: 0, z: 0 };

    const lo = [Infinity, Infinity, Infinity];
    const hi = [-Infinity, -Infinity, -Infinity];
    for (const cube of cubes) {
      for (let i = 0; i < 3; i++) {
        lo[i] = Math.min(lo[i] as number, cube.origin[i] as number);
        hi[i] = Math.max(hi[i] as number, (cube.origin[i] as number) + (cube.size[i] as number));
      }
    }
    const mid = lo.map((n, i) => (n + (hi[i] as number)) / 2) as [number, number, number];
    // The diagonal, so the part still fits however it is turned.
    const reach = Math.max(...hi.map((n, i) => n - (lo[i] as number)), 1) * 1.35;
    return {
      zoom: Math.min(4, Math.max(1, span / reach)),
      x: mid[0] * scale,
      y: -(mid[1] - midY) * scale,
      z: -mid[2] * scale,
    };
  }, [rig, focus, span, scale, midY]);

  const turn = (byYaw: number) => setAngle((a) => ({ ...a, yaw: a.yaw + byYaw }));

  const startDrag = (e: React.PointerEvent) => {
    drag.current = { x: e.clientX, y: e.clientY };
    setDragging(true);
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const moveDrag = (e: React.PointerEvent) => {
    const from = drag.current;
    if (!from) return;
    drag.current = { x: e.clientX, y: e.clientY };
    setAngle((a) => ({
      yaw: a.yaw + (e.clientX - from.x) * 0.6,
      // Clamped, because tipping past vertical reads as the creature breaking.
      pitch: Math.max(-60, Math.min(60, a.pitch - (e.clientY - from.y) * 0.6)),
    }));
  };
  const endDrag = () => {
    drag.current = null;
    stroke.current = null;
    setDragging(false);
  };

  // Naming the part under the pointer is most of what the flat sheet's overlay
  // was for, and it belongs here now that the creature is the main surface.
  const readout = hover
    ? describePixel(map, hover.x, hover.y)
    : onPaint
      ? 'Point at your creature to see which bit you are about to paint.'
      : null;

  const hint = !onPaint
    ? 'Drag the creature to turn it around.'
    : turning
      ? 'Drag the creature to turn it around.'
      : focus
        ? 'Close-up. Paint away — drag the background to turn it, or tap ✨ All to zoom back out.'
        : 'Paint straight onto the creature. Drag the background to turn it.';

  return (
    <div className="mob-preview stack">
      <div
        className={`mob-preview__stage${paintable ? ' mob-preview__stage--paint' : ''}`}
        style={{ width: size, height: size }}
        role={onPaint ? 'group' : 'img'}
        aria-label={
          label ?? (onPaint ? 'Your creature. Paint on it, or drag to turn it.' : 'Your creature, in 3D.')
        }
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerLeave={() => {
          endDrag();
          setHover(null);
        }}
      >
        <div
          className={`mob-preview__world${dragging ? '' : ' mob-preview__world--eased'}`}
          data-testid="mob-preview-world"
          style={{
            transform:
              `scale(${camera.zoom}) rotateX(${-angle.pitch}deg) rotateY(${angle.yaw}deg) ` +
              `translate3d(${-camera.x}px, ${-camera.y}px, ${-camera.z}px)`,
          }}
        >
          {rig.bones.flatMap((bone) =>
            bone.cubes.map((cube, cubeIndex) => {
              const [w, h, d] = cube.size;
              const centre = {
                x: (cube.origin[0] + w / 2) * scale,
                y: -(cube.origin[1] + h / 2 - midY) * scale,
                z: -(cube.origin[2] + d / 2) * scale,
              };
              const rects = cubeFaces(cube.uv, cube.size);
              const dim = Boolean(focus && focus !== partOf(bone.name));
              return (
                <div
                  key={`${bone.name}-${cubeIndex}`}
                  className="mob-preview__box"
                  data-bone={bone.name}
                  style={{ transform: `translate3d(${centre.x}px, ${centre.y}px, ${centre.z}px)` }}
                >
                  {FACES.map((face) => {
                    const rect = rects.find((r) => r.face === (cube.mirror ? MIRRORED[face] : face));
                    if (!rect || rect.w <= 0 || rect.h <= 0) return null;
                    const key = `${rect.x},${rect.y},${rect.w},${rect.h}`;
                    return (
                      <div
                        key={face}
                        className={`mob-preview__face${dim ? ' mob-preview__face--dim' : ''}`}
                        data-face={face}
                        style={{
                          width: rect.w * scale,
                          height: rect.h * scale,
                          marginLeft: (-rect.w * scale) / 2,
                          marginTop: (-rect.h * scale) / 2,
                          gridTemplateColumns: `repeat(${rect.w}, 1fr)`,
                          transform: `${FACE_TRANSFORMS[face](w * scale, h * scale, d * scale)}${
                            cube.mirror ? ' scaleX(-1)' : ''
                          }`,
                        }}
                      >
                        {Array.from({ length: rect.w * rect.h }, (_, i) => {
                          const tx = rect.x + (i % rect.w);
                          const ty = rect.y + Math.floor(i / rect.w);
                          const colour = skin.pixels[ty * skin.size + tx] ?? null;
                          const style = colour ? { background: colour } : undefined;
                          // While one part is framed, the faded rest is scenery:
                          // it must not take the paint meant for the close-up.
                          if (!paintable || dim) {
                            return <span key={i} className="mob-preview__texel" style={style} />;
                          }
                          return (
                            <button
                              key={i}
                              type="button"
                              className="mob-preview__texel"
                              aria-label={`Paint ${tx + 1}, ${ty + 1}`}
                              style={style}
                              onPointerDown={(e) => {
                                // Painting is not turning.
                                e.stopPropagation();
                                e.currentTarget.releasePointerCapture?.(e.pointerId);
                                stroke.current = key;
                                onPaint?.(tx, ty, 'start', false);
                              }}
                              onPointerEnter={(e) => {
                                setHover({ x: tx, y: ty });
                                if (e.buttons === 0) return;
                                const connect = stroke.current === key;
                                stroke.current = key;
                                onPaint?.(tx, ty, 'continue', connect);
                              }}
                              onFocus={() => setHover({ x: tx, y: ty })}
                              onClick={() => onPaint?.(tx, ty, 'start', false)}
                            />
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              );
            }),
          )}
        </div>
      </div>

      {readout && (
        <p className="pixel-canvas__readout" role="status">
          {readout}
        </p>
      )}

      {onPaint && (
        <div className="row mob-preview__controls">
          <button className="btn btn--ghost btn--icon" onClick={() => turn(-45)} aria-label="Turn left">
            ↺
          </button>
          <button
            className={`btn ${turning ? '' : 'btn--ghost'}`}
            aria-pressed={turning}
            onClick={() => setTurning((t) => !t)}
          >
            {turning ? '🤚 Turning' : '🖌️ Painting'}
          </button>
          <button className="btn btn--ghost btn--icon" onClick={() => turn(45)} aria-label="Turn right">
            ↻
          </button>
        </div>
      )}
      <p className="tiny muted centre">{hint}</p>
    </div>
  );
}
