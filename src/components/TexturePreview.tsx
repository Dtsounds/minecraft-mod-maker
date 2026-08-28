import { normalizeTexture } from '../bedrock/texture';
import type { Texture } from '../bedrock/types';

interface Props {
  texture: Texture;
  /** Rendered edge length in CSS pixels. */
  size?: number;
  label?: string;
}

/**
 * Renders a texture as a CSS grid of divs rather than a canvas. At 16-64px of
 * source data that is cheap, stays crisp at any zoom, and — unlike a canvas —
 * is inspectable from tests and screen readers.
 */
export function TexturePreview({ texture, size = 64, label }: Props) {
  const safe = normalizeTexture(texture);
  return (
    <div
      className="texture-preview"
      style={{
        width: size,
        height: size,
        gridTemplateColumns: `repeat(${safe.size}, 1fr)`,
        gridTemplateRows: `repeat(${safe.size}, 1fr)`,
      }}
      role="img"
      aria-label={label ?? 'Texture preview'}
    >
      {safe.pixels.map((color, i) => (
        <span key={i} style={color ? { background: color } : undefined} />
      ))}
    </div>
  );
}
