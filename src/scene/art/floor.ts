import { PAL } from '../palette';
import { mulberry, noise2, Pix, shade, type Ramp } from '../pix';

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
