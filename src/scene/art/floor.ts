import { PAL } from '../palette';
import { hash2, hex, mulberry, noise2, Pix, shade, type Ramp } from '../pix';
import type { Season } from '../season';

/**
 * A tiling patch of forest floor seen from above, stored as light values (0..1) in the red channel:
 * calm ground with short blades and leaf litter. The floor shader colours it per stretch of the walk.
 */
export function floorPattern(): Pix {
  const n = 256;
  const p = new Pix(n, n, true);
  const v = new Float32Array(n * n);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      // tileable noise: sample a torus of the noise field
      const a = noise2((x / n) * 8, (y / n) * 8, 3) + noise2(((x + n / 2) % n) / n * 8, (y / n) * 8, 4);
      v[y * n + x] = 0.47 + (a / 2 - 0.5) * 0.1;
    }
  }
  const rnd = mulberry(6);
  for (let i = 0; i < 5200; i++) {
    const x = Math.floor(rnd() * n);
    const y = Math.floor(rnd() * n);
    const len = 2 + Math.floor(rnd() * 3);
    const dv = rnd() < 0.55 ? 0.1 : -0.09;
    const lean = rnd() < 0.5 ? -1 : 1;
    for (let s = 0; s < len; s++) {
      const px = (x + (s === len - 1 ? lean : 0) + n) % n;
      const py = (y - s + n) % n;
      v[py * n + px] = Math.max(0, Math.min(0.99, v[py * n + px] + dv));
    }
  }
  for (let i = 0; i < n * n; i++) {
    const c = Math.round(v[i] * 255);
    p.data[i] = (0xff000000 | (c << 16) | (c << 8) | c) >>> 0;
  }
  return p;
}

const seven = (r: Ramp): number[] => Array.from({ length: 7 }, (_, i) => shade(r, i / 6));

/** One row of seven colours per stretch of the walk; the last row is the sun in the clearing. */
export function floorRamps(): { pix: Pix; rows: number } {
  const list = [PAL.edge.grass, PAL.mid.grass, PAL.deep.grass, PAL.clearing.grass, PAL.hollow.grass, PAL.clearing.sun];
  const p = new Pix(7, list.length);
  list.forEach((r, row) => seven(r).forEach((c, i) => p.set(i, row, c)));
  return { pix: p, rows: list.length };
}

/** Fallen leaf shapes seen from above: # body, + lit edge, - its stalk or shaded edge. */
const LEAF_SHAPES = [
  ['.+.', '+#+', '#-#', '.-.'],
  ['+#.', '##-', '.--'],
  ['.++.', '+##+', '####', '.-#.', '..-.'],
  ['.+..', '+##.', '.##-', '..-.'],
  ['+.', '#-'],
  ['.+.', '###', '.#.'],
];

/**
 * What lies on the floor besides the grass, as a tile the floor shader lays over its ramps: colour in rgb and a
 * rank in alpha (0 is bare ground). A stretch of the walk shows the stamps ranked above its own threshold, so the
 * same tile gives a thick carpet of leaves deep in the wood and a few blown ones in the meadow.
 * Autumn: beech copper, birch gold, cherry red, oak brown. Spring: last year's brown leaves and blossom petals.
 * Summer: a few old leaves and twigs. Winter: glints in the snow and the odd twig.
 */
export function floorLitter(season: Season): Pix {
  const n = 256;
  const p = new Pix(n, n, true);
  const rnd = mulberry(9090);
  const rank = () => Math.max(1, Math.round(rnd() * 254));
  const put = (x: number, y: number, c: number, r: number) => p.set(((x % n) + n) % n, ((y % n) + n) % n, ((c & 0xffffff) | (r << 24)) >>> 0);
  const stamp = (x: number, y: number, pal: Ramp, r: number) => {
    const sh = LEAF_SHAPES[Math.floor(rnd() * LEAF_SHAPES.length)];
    const t = 0.35 + rnd() * 0.4;
    const flip = rnd() < 0.5;
    sh.forEach((row, j) => [...row].forEach((ch, i) => {
      if (ch === '.') return;
      const xx = flip ? row.length - 1 - i : i;
      put(x + xx, y + j, shade(pal, ch === '+' ? t + 0.22 : ch === '-' ? t - 0.25 : t), r);
    }));
  };
  const twig = (x: number, y: number, r: number) => {
    const len = 3 + Math.floor(rnd() * 6);
    const dx = rnd() < 0.5 ? 1 : -1;
    for (let i = 0; i < len; i++) put(x + i * dx, y + Math.floor(i * (0.3 + rnd() * 0.4)), hex(rnd() < 0.5 ? '#3a2a1c' : '#54402c'), r);
  };
  const brown = PAL.leaves.bush;
  const old = [hex('#3a2a18'), hex('#4e3a22'), hex('#66502e'), hex('#806640'), hex('#9a7e52')] as Ramp;
  if (season === 'autumn') {
    const pals = [PAL.leaves.beech, PAL.leaves.birch, PAL.leaves.young, PAL.leaves.oak, PAL.leaves2.beech, brown, old];
    for (let i = 0; i < 5200; i++) stamp(Math.floor(rnd() * n), Math.floor(rnd() * n), pals[Math.floor(rnd() * pals.length)], rank());
    for (let i = 0; i < 60; i++) twig(Math.floor(rnd() * n), Math.floor(rnd() * n), rank());
  } else if (season === 'spring') {
    for (let i = 0; i < 700; i++) stamp(Math.floor(rnd() * n), Math.floor(rnd() * n), old, rank());
    // blossom petals blown in from the cherries: single pixels and pairs
    for (let i = 0; i < 1400; i++) {
      const x = Math.floor(rnd() * n);
      const y = Math.floor(rnd() * n);
      const c = hex(rnd() < 0.4 ? '#efd2d4' : '#f8f2ea');
      const r = rank();
      put(x, y, c, r);
      if (rnd() < 0.4) put(x + 1, y, c, r);
    }
  } else if (season === 'summer') {
    for (let i = 0; i < 420; i++) stamp(Math.floor(rnd() * n), Math.floor(rnd() * n), old, rank());
    for (let i = 0; i < 80; i++) twig(Math.floor(rnd() * n), Math.floor(rnd() * n), rank());
  } else {
    // glints: the shader makes these twinkle as you move
    for (let i = 0; i < 1500; i++) put(Math.floor(rnd() * n), Math.floor(rnd() * n), hex('#ffffff'), rank());
    for (let i = 0; i < 40; i++) twig(Math.floor(rnd() * n), Math.floor(rnd() * n), rank());
    for (let i = 0; i < 160; i++) stamp(Math.floor(rnd() * n), Math.floor(rnd() * n), old, Math.max(1, Math.round(hash2(i, 3, 5) * 120)));
  }
  // the bare ground between the stamps takes its neighbours' colour (alpha stays 0), so the mipmaps (which
  // calm the tile down as it goes off into the distance) don't darken its leaves
  p.bleed();
  return p;
}

/** How much of the litter each stretch shows (meadow, wood, deep wood, clearing, hollow), by season. */
export const LITTER: Record<Season, [number, number, number, number, number]> = {
  spring: [0.25, 0.4, 0.45, 0.3, 0.4],
  summer: [0.05, 0.25, 0.35, 0.12, 0.4],
  autumn: [0.3, 0.62, 0.66, 0.42, 0.6],
  winter: [0.7, 0.55, 0.45, 0.75, 0.4],
};
