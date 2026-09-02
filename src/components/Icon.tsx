import type { ReactNode } from 'react';

/**
 * The interface's icons, drawn here rather than typed as emoji.
 *
 * Emoji were the fast way to get a picture on every button, and they cost more
 * than they looked: every platform draws them differently, they carry a colour
 * and a cartoon style nothing else in the app shares, and a wall of them reads
 * as a toy. These are one stroke weight, one grid, and they take the colour of
 * whatever they sit in.
 *
 * A deliberate line: this covers the *interface* — tools, navigation, state.
 * The pictograms that stand for things in the game (a diamond, a cow, an
 * apple, the sixty vanilla items in the recipe grid) stay as emoji. They are
 * content, not chrome; a kid is picking a diamond, not a "gem icon", and
 * hand-drawing sixty Minecraft items would be worse at the job as well as
 * being a month of work.
 *
 * 24x24 grid, 1.75 stroke, round caps. Anything new should match, or the set
 * stops reading as a set.
 */

const ICONS: Record<string, ReactNode> = {
  // --- drawing tools ---
  pencil: (
    <>
      <path d="M4 20.5l1-4L16 5.5l3 3L8 19.5l-4 1z" />
      <path d="M14.5 7l3 3" />
    </>
  ),
  eraser: (
    <>
      <path d="M8.5 19.5L4 15a1.5 1.5 0 010-2.1l7.4-7.4a1.5 1.5 0 012.1 0l4.5 4.5a1.5 1.5 0 010 2.1l-7.4 7.4z" />
      <path d="M10 19.5h10M9 8.5l6.5 6.5" />
    </>
  ),
  bucket: (
    <>
      <path d="M11 4.5l7.5 7.5-6.5 6.5a1.5 1.5 0 01-2.1 0l-5.4-5.4a1.5 1.5 0 010-2.1z" />
      <path d="M21 15.5c0 1-.7 1.8-1.6 1.8s-1.6-.8-1.6-1.8 1.6-2.8 1.6-2.8 1.6 1.8 1.6 2.8z" />
    </>
  ),
  dropper: (
    <>
      <path d="M4 20h2l9-9" />
      <path d="M13.5 6.5l4 4 2-2a2.8 2.8 0 00-4-4z" />
      <path d="M4 20v-2" />
    </>
  ),
  // --- history and transforms ---
  undo: (
    <>
      <path d="M4 9h10a5.5 5.5 0 010 11h-4" />
      <path d="M8 5L4 9l4 4" />
    </>
  ),
  redo: (
    <>
      <path d="M20 9H10a5.5 5.5 0 000 11h4" />
      <path d="M16 5l4 4-4 4" />
    </>
  ),
  mirror: (
    <>
      <path d="M12 3v18" strokeDasharray="3 3" />
      <path d="M9 7L4 12l5 5zM15 7l5 5-5 5z" />
    </>
  ),
  rotateLeft: (
    <>
      <path d="M4.5 12a7.5 7.5 0 107.5-7.5H6" />
      <path d="M9 1.5L5.5 4.5 9 7.5" />
    </>
  ),
  rotateRight: (
    <>
      <path d="M19.5 12a7.5 7.5 0 11-7.5-7.5H18" />
      <path d="M15 1.5l3.5 3L15 7.5" />
    </>
  ),
  orbit: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M20.5 12c0 2.2-3.8 4-8.5 4s-8.5-1.8-8.5-4 3.8-4 8.5-4" />
      <path d="M17 6.5l3.5 1.5-1.5 3.5" />
    </>
  ),
  brush: (
    <>
      <path d="M14 4.5l5.5 5.5-6 6-5.5-5.5z" />
      <path d="M8 10.5l-2.5 2.5c-1.5 1.5-1 3-2 4.5 1.8.6 3.5.6 5-.9l2.5-2.5" />
    </>
  ),
  // --- structure ---
  cube: (
    <>
      <path d="M12 2.5l8.5 4.8v9.4L12 21.5l-8.5-4.8V7.3z" />
      <path d="M3.5 7.3L12 12l8.5-4.7M12 12v9.5" />
    </>
  ),
  gem: (
    <>
      <path d="M7 3.5h10l4 6-9 11-9-11z" />
      <path d="M3 9.5h18M9 3.5l3 6 3-6M12 9.5v11" />
    </>
  ),
  paw: (
    <>
      <circle cx="7" cy="9" r="2" />
      <circle cx="12" cy="6.5" r="2" />
      <circle cx="17" cy="9" r="2" />
      <path d="M12 11c3 0 5 2.2 5 4.6 0 2-1.6 3.4-3.4 2.9-1-.3-2.2-.3-3.2 0C8.6 19 7 17.6 7 15.6 7 13.2 9 11 12 11z" />
    </>
  ),
  bolt: <path d="M13.5 2.5L5 13.5h6l-.5 8L19 10.5h-6z" />,
  sliders: (
    <>
      <path d="M4 8h10M18 8h2M4 16h4M12 16h8" />
      <circle cx="16" cy="8" r="2" />
      <circle cx="10" cy="16" r="2" />
    </>
  ),
  grid: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="1.5" />
      <path d="M9.2 3.5v17M14.8 3.5v17M3.5 9.2h17M3.5 14.8h17" />
    </>
  ),
  tag: (
    <>
      <path d="M3.5 11.5v-7a1 1 0 011-1h7l9 9-8 8z" />
      <circle cx="8" cy="8" r="1.6" />
    </>
  ),
  swatch: (
    <>
      <rect x="3.5" y="3.5" width="11" height="11" rx="1.5" />
      <path d="M9.5 20.5h9a2 2 0 002-2v-9" />
      <path d="M17.5 9.5v9h-9" />
    </>
  ),
  palette: (
    <>
      <path d="M12 3.5a8.5 8.5 0 000 17c1.2 0 1.8-.8 1.8-1.7 0-1.4-1-1.7-1-2.8 0-.9.7-1.5 1.7-1.5h1.6a4.4 4.4 0 004.4-4.4c0-3.6-3.8-6.6-8.5-6.6z" />
      <circle cx="7.5" cy="11" r="1.1" />
      <circle cx="10.5" cy="7.5" r="1.1" />
      <circle cx="15" cy="8" r="1.1" />
    </>
  ),
  folder: <path d="M3.5 6.5a1 1 0 011-1h4l2 2.5h9a1 1 0 011 1v9a1 1 0 01-1 1h-15a1 1 0 01-1-1z" />,
  // --- actions and state ---
  check: <path d="M4.5 12.5l5 5 10-11" />,
  close: <path d="M5.5 5.5l13 13M18.5 5.5l-13 13" />,
  plus: <path d="M12 4.5v15M4.5 12h15" />,
  trash: (
    <>
      <path d="M4.5 6.5h15M9.5 6.5V4h5v2.5" />
      <path d="M6.5 6.5l1 13h9l1-13" />
      <path d="M10.5 10v6M13.5 10v6" />
    </>
  ),
  arrowLeft: <path d="M19 12H5M11 6l-6 6 6 6" />,
  arrowRight: <path d="M5 12h14M13 6l6 6-6 6" />,
  download: (
    <>
      <path d="M12 3.5v12M7 10.5l5 5 5-5" />
      <path d="M4 19.5h16" />
    </>
  ),
  save: (
    <>
      <path d="M4.5 5.5a1 1 0 011-1h11l3 3v11a1 1 0 01-1 1h-13a1 1 0 01-1-1z" />
      <path d="M8 4.5v5h7v-5M8 19.5v-6h8v6" />
    </>
  ),
  warning: (
    <>
      <path d="M12 3.5l9.5 16.5h-19z" />
      <path d="M12 9.5v5M12 17.2v.1" />
    </>
  ),
  bulb: (
    <>
      <path d="M9 17.5a6 6 0 116 0v1.5a1.5 1.5 0 01-1.5 1.5h-3A1.5 1.5 0 019 19z" />
      <path d="M9.5 17.5h5" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7v5.2l3.2 2.3" />
    </>
  ),
  star: <path d="M12 3.5l2.7 5.6 6.1.8-4.5 4.2 1.2 6-5.5-3-5.5 3 1.2-6-4.5-4.2 6.1-.8z" />,
  ban: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M6 6l12 12" />
    </>
  ),
  monitor: (
    <>
      <rect x="2.5" y="4.5" width="19" height="12.5" rx="1.5" />
      <path d="M9 20.5h6M12 17v3.5" />
    </>
  ),
  phone: (
    <>
      <rect x="6.5" y="2.5" width="11" height="19" rx="2" />
      <path d="M10.5 18.5h3" />
    </>
  ),
  gamepad: (
    <>
      <path d="M8.5 7.5h7a5.5 5.5 0 015.4 6.6l-.5 2.4a2.6 2.6 0 01-4.6 1L14 15.5h-4l-1.8 2a2.6 2.6 0 01-4.6-1l-.5-2.4A5.5 5.5 0 018.5 7.5z" />
      <path d="M7 11.5h2.5M8.25 10.2v2.6" />
      <circle cx="16" cy="11.5" r="1" />
    </>
  ),
};

export type IconName = keyof typeof ICONS;

interface Props {
  name: IconName;
  /** Edge length in px. Inherits colour from its parent either way. */
  size?: number;
  className?: string;
}

export function Icon({ name, size = 20, className }: Props) {
  return (
    <svg
      className={className ? `icon ${className}` : 'icon'}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
    >
      {ICONS[name]}
    </svg>
  );
}
