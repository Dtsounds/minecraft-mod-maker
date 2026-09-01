import { useMemo, useRef, useState } from 'react';
import type { MobRig } from '../bedrock/mobGeometry';
import { cubeFaces, type CubeFace } from '../bedrock/mobUv';
import { textureToDataUrl } from '../bedrock/texture';
import type { Texture } from '../bedrock/types';

interface Props {
  texture: Texture;
  rig: MobRig;
  /** Rendered box size in CSS pixels. */
  size?: number;
  label?: string;
}

/**
 * The creature, in 3D, built out of the same rig that ships in the pack.
 *
 * Until this existed the only way to find out what a skin looked like was to
 * export the mod, import it, and go and find the thing in a world. A kid was
 * painting a flat square and hoping.
 *
 * It is CSS 3D transforms, not a 3D library: six absolutely-positioned divs
 * per box, each showing its own rectangle of the texture through
 * `background-position`. A rig is at most seven boxes, so this is ~40 nodes —
 * cheaper than the pixel grid next to it, with nothing added to the bundle and
 * nothing fetched at runtime. It also stays inspectable from tests and by a
 * screen reader, which a `<canvas>` would not be.
 *
 * Minecraft's model space is x east, y up, z south, and a mob faces north.
 * CSS is x right, y DOWN, z toward the viewer. So `y` and `z` both flip, which
 * turns the mob's north face towards whoever is looking at it — exactly the
 * face the kid thinks of as the front.
 */

/** Which UV rectangle shows on which side of the box, once flipped into CSS. */
const FACE_TRANSFORMS: Record<CubeFace, (w: number, h: number, d: number) => string> = {
  front: (_w, _h, d) => `translateZ(${d / 2}px)`,
  back: (_w, _h, d) => `rotateY(180deg) translateZ(${d / 2}px)`,
  right: (w) => `rotateY(90deg) translateZ(${w / 2}px)`,
  left: (w) => `rotateY(-90deg) translateZ(${w / 2}px)`,
  top: (_w, h) => `rotateX(90deg) translateZ(${h / 2}px)`,
  bottom: (_w, h) => `rotateX(-90deg) translateZ(${h / 2}px)`,
};

/** The on-screen size of each face, in model units, before scaling. */
const FACE_SIZES: Record<CubeFace, (w: number, h: number, d: number) => [number, number]> = {
  front: (w, h) => [w, h],
  back: (w, h) => [w, h],
  right: (_w, h, d) => [d, h],
  left: (_w, h, d) => [d, h],
  top: (w, _h, d) => [w, d],
  bottom: (w, _h, d) => [w, d],
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

export function MobPreview({ texture, rig, size = 200, label }: Props) {
  const [angle, setAngle] = useState({ yaw: -28, pitch: 14 });
  const drag = useRef<{ x: number; y: number } | null>(null);

  const url = useMemo(() => textureToDataUrl(texture), [texture]);

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

  const onPointerDown = (e: React.PointerEvent) => {
    drag.current = { x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const from = drag.current;
    if (!from) return;
    drag.current = { x: e.clientX, y: e.clientY };
    setAngle((a) => ({
      yaw: a.yaw + (e.clientX - from.x) * 0.6,
      // Clamped, because tipping past vertical reads as the creature breaking.
      pitch: Math.max(-60, Math.min(60, a.pitch - (e.clientY - from.y) * 0.6)),
    }));
  };
  const stopDrag = () => {
    drag.current = null;
  };

  return (
    <div className="mob-preview stack">
      <div
        className="mob-preview__stage"
        style={{ width: size, height: size }}
        role="img"
        aria-label={label ?? 'Your creature, in 3D. Drag to turn it around.'}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={stopDrag}
        onPointerCancel={stopDrag}
      >
        <div
          className="mob-preview__world"
          data-testid="mob-preview-world"
          style={{ transform: `rotateX(${-angle.pitch}deg) rotateY(${angle.yaw}deg)` }}
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
              return (
                <div
                  key={`${bone.name}-${cubeIndex}`}
                  className="mob-preview__box"
                  data-bone={bone.name}
                  style={{ transform: `translate3d(${centre.x}px, ${centre.y}px, ${centre.z}px)` }}
                >
                  {(Object.keys(FACE_TRANSFORMS) as CubeFace[]).map((face) => {
                    const source = cube.mirror ? MIRRORED[face] : face;
                    const rect = rects.find((r) => r.face === source);
                    if (!rect || rect.w <= 0 || rect.h <= 0) return null;
                    const [fw, fh] = FACE_SIZES[face](w, h, d);
                    return (
                      <div
                        key={face}
                        className="mob-preview__face"
                        data-face={face}
                        style={{
                          width: fw * scale,
                          height: fh * scale,
                          marginLeft: (-fw * scale) / 2,
                          marginTop: (-fh * scale) / 2,
                          transform: `${FACE_TRANSFORMS[face](w * scale, h * scale, d * scale)}${
                            cube.mirror ? ' scaleX(-1)' : ''
                          }`,
                          backgroundImage: `url(${url})`,
                          backgroundSize: `${rig.textureSize * scale}px ${rig.textureSize * scale}px`,
                          backgroundPosition: `${-rect.x * scale}px ${-rect.y * scale}px`,
                        }}
                      />
                    );
                  })}
                </div>
              );
            }),
          )}
        </div>
      </div>
      <p className="tiny muted centre">Drag the creature to turn it around.</p>
    </div>
  );
}
