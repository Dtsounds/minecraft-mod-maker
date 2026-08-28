/**
 * The default palette. Chosen to cover the colours a kid reaches for first —
 * skin/wood/stone/metal neutrals plus saturated primaries — so most textures
 * can be drawn without ever opening the custom colour picker.
 */
export const PALETTE_ROWS: string[][] = [
  ['#000000', '#3d3d3d', '#6b6b6b', '#9a9a9a', '#c9c9c9', '#ffffff'],
  ['#7a1220', '#c22036', '#ff4d5e', '#ff8a3d', '#ffb703', '#ffe066'],
  ['#123d1e', '#1f7a3a', '#3fbf5f', '#7ee081', '#c2f0a0', '#e8ffcc'],
  ['#0d2b57', '#1f5fbf', '#45b7f5', '#9ad9ff', '#6b3fb5', '#b98aff'],
  ['#3d2414', '#6b4223', '#9c6634', '#c99a63', '#e8c39e', '#ffe0c2'],
  ['#5a0f3d', '#a3216b', '#ff5c9e', '#00c2a8', '#c9a227', '#f5e6c8'],
];

export const PALETTE = PALETTE_ROWS.flat();

export const DEFAULT_COLOR = '#ff4d5e';
