import { blankTexture, resizeTexture, type TextureSize } from '../bedrock/texture';
import type { Texture } from '../bedrock/types';

/**
 * Built-in starter pictures.
 *
 * Each one is drawn programmatically at 16x16 from a tiny ASCII map, so the
 * library costs no binary assets and every shape can be recoloured. A kid who
 * doesn't want to draw can pick one of these and still ship a real texture
 * rather than an invisible item.
 */

export interface Swatch {
  id: string;
  label: string;
  /** 16 rows of 16 characters. '.' is transparent; other chars index `colors`. */
  map: string[];
  colors: Record<string, string>;
}

const SWORD: Swatch = {
  id: 'sword',
  label: 'Sword',
  map: [
    '..............ee',
    '.............ebe',
    '............ebbe',
    '...........ebbe.',
    '..........ebbe..',
    '.........ebbe...',
    '........ebbe....',
    '.......ebbe.....',
    '..hh..ebbe......',
    '.hgghebbe.......',
    '..hhgbbe........',
    '.hg.hbe.........',
    'hg...he.........',
    'h...............',
    '................',
    '................',
  ],
  colors: { e: '#c9c9c9', b: '#ffffff', h: '#6b4223', g: '#9c6634' },
};

const PICKAXE: Swatch = {
  id: 'pickaxe',
  label: 'Pickaxe',
  map: [
    '................',
    '...eee....eee...',
    '..ebbbeeeebbbe..',
    '..ebeeebbeeebe..',
    '...e...hh...e...',
    '.......hh.......',
    '.......hh.......',
    '......hgh.......',
    '......hgh.......',
    '.....hgh........',
    '.....hgh........',
    '....hgh.........',
    '....hgh.........',
    '....hh..........',
    '................',
    '................',
  ],
  colors: { e: '#3d3d3d', b: '#9a9a9a', h: '#6b4223', g: '#9c6634' },
};

const GEM: Swatch = {
  id: 'gem',
  label: 'Gem',
  map: [
    '................',
    '................',
    '....dddddd......',
    '...dllllldd.....',
    '..dlbbbbllld....',
    '..dlbbbbllld....',
    '..dlbblllllld...',
    '..dllllllllld...',
    '...dlllllllld...',
    '....dllllllld...',
    '.....dlllllld...',
    '......dllllld...',
    '.......dlllld...',
    '........dddd....',
    '................',
    '................',
  ],
  colors: { d: '#0d5f7a', l: '#45b7f5', b: '#c6ecff' },
};

const APPLE: Swatch = {
  id: 'apple',
  label: 'Fruit',
  map: [
    '................',
    '.......gg.......',
    '......gg........',
    '....ggss........',
    '...rrrrrrr......',
    '..rrhhrrrrrr....',
    '..rhhrrrrrrr....',
    '.rrhrrrrrrrrr...',
    '.rrrrrrrrrrrr...',
    '.rrrrrrrrrrrr...',
    '.rrrrrrrrrrrr...',
    '..rrrrrrrrrr....',
    '..rrrrrrrrrr....',
    '...rrrrrrrr.....',
    '.....rrrr.......',
    '................',
  ],
  colors: { r: '#c22036', h: '#ff8a9e', g: '#1f7a3a', s: '#6b4223' },
};

const STAR: Swatch = {
  id: 'star',
  label: 'Star',
  map: [
    '................',
    '.......yy.......',
    '.......yy.......',
    '......yyyy......',
    '......ywwy......',
    '.....yywwyy.....',
    'yyyyyywwyyyyyy..',
    '.yyyyywwyyyyy...',
    '..yyyyyyyyyy....',
    '...yyyyyyyy.....',
    '...yyyyyyyy.....',
    '..yyyy..yyyy....',
    '..yyy....yyy....',
    '.yy........yy...',
    '................',
    '................',
  ],
  colors: { y: '#ffb703', w: '#ffe066' },
};

const POTION: Swatch = {
  id: 'potion',
  label: 'Bottle',
  map: [
    '................',
    '......cccc......',
    '......cccc......',
    '.......cc.......',
    '......gggg......',
    '.....gg..gg.....',
    '....gg....gg....',
    '....g.pppp.g....',
    '....gppppppg....',
    '....gppppppg....',
    '....gppppppg....',
    '....gppppppg....',
    '.....gppppg.....',
    '......gggg......',
    '................',
    '................',
  ],
  colors: { c: '#6b4223', g: '#c6ecff', p: '#a3216b' },
};

const INGOT: Swatch = {
  id: 'ingot',
  label: 'Ingot',
  map: [
    '................',
    '................',
    '................',
    '................',
    '.....oooooo.....',
    '....oyyyyyyo....',
    '...oyyyyyyyyo...',
    '..oyywwwwyyyyo..',
    '..oyywwwwyyyyo..',
    '..oyyyyyyyyyyo..',
    '..oyyyyyyyyyyo..',
    '...oooooooooo...',
    '................',
    '................',
    '................',
    '................',
  ],
  colors: { o: '#c9a227', y: '#ffb703', w: '#ffe066' },
};

const HEART: Swatch = {
  id: 'heart',
  label: 'Heart',
  map: [
    '................',
    '................',
    '...pp.....pp....',
    '..pRRpp.ppRRp...',
    '.pRRRRRpRRRRRp..',
    '.pRwRRRRRRRRRp..',
    '.pRwRRRRRRRRRp..',
    '.pRRRRRRRRRRRp..',
    '..pRRRRRRRRRp...',
    '...pRRRRRRRp....',
    '....pRRRRRp.....',
    '.....pRRRp......',
    '......pRp.......',
    '.......p........',
    '................',
    '................',
  ],
  colors: { p: '#7a1220', R: '#ff4d5e', w: '#ffd0da' },
};

export const SWATCHES: Swatch[] = [SWORD, PICKAXE, GEM, INGOT, APPLE, STAR, POTION, HEART];

/** Render a swatch to a texture, scaled to the requested size. */
export function applySwatch(swatch: Swatch, size: TextureSize | number = 16): Texture {
  const base = blankTexture(16);
  for (let y = 0; y < 16; y++) {
    const row = swatch.map[y] ?? '';
    for (let x = 0; x < 16; x++) {
      const key = row[x];
      const color = key && key !== '.' ? swatch.colors[key] : undefined;
      if (color) base.pixels[y * 16 + x] = color;
    }
  }
  return size === 16 ? base : resizeTexture(base, size as TextureSize);
}
