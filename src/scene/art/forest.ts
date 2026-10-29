import { CORRIDOR, texelAt } from '../config';
import { PAL } from '../palette';
import { mulberry, noise1, Pix, shade, type Ramp } from '../pix';
import { bush, canopy, clump, fern, ground, limb, trunk, tuft } from './brush';

export type Tone = { leaf: Ramp; bark: Ramp; moss: Ramp; grass: Ramp };

/** A painted layer: its pixels, the texel that sits at world (x, 0), and the distance it's painted for. */
export type Layer = { pix: Pix; ax: number; ay: number; d: number; repeat?: boolean };

const darker = (r: Ramp, n = 1): Ramp => r.slice(0, r.length - n);

/**
 * One screen of trees: back trunks, front trunks, a canopy that arches over the path and ends in
 * real rounded treetops (nothing is stretched), undergrowth and a fringe of grass on the floor.
 * It tiles sideways; the path (x = cx) is kept clear unless `closed`.
 */
export function frame(o: {
  d: number;
  seed: number;
  tone: Tone;
  canopy: number;
  arch: number;
  gaps: number;
  cx?: number;
  corridor?: number;
  w?: number;
  closed?: boolean;
  thick?: number;
}): Layer {
  const t = texelAt(o.d);
  const w = o.w ?? 1024;
  const corridor = o.closed ? 0 : (o.corridor ?? CORRIDOR) / t;
  const archPx = o.arch / t;
  const thick = (o.thick ?? 2.6) / t;
  const crown = o.canopy / t + archPx + thick;
  const ay = Math.round(14 + crown + 12);
  const h = ay + 6;
  const p = new Pix(w, h, true);
  const ax = w / 2;
  const px = ax + (o.cx ?? 0) / t;
  const rnd = mulberry(o.seed);
  const near = (x: number) => (o.closed ? 1e9 : Math.abs(x - px));
  const arch = (x: number) => {
    const dx = (x - px) / (Math.max(corridor, 20) * 2.4);
    return o.closed ? 0 : Math.exp(-dx * dx) * archPx;
  };
  const bottom = (x: number) => ay - (o.canopy / t + arch(x)) + (noise1(x * 0.035, o.seed) - 0.5) * 16 + (noise1(x * 0.14, o.seed + 1) - 0.5) * 6;
  // the line of treetops: big crowns with smaller bumps
  const top = (x: number) =>
    ay - crown + arch(x) * 0.4 + (noise1(x * 0.012, o.seed + 5) - 0.5) * 34 + (noise1(x * 0.05, o.seed + 6) - 0.5) * 14;

  // a closed wall: the dark of the wood fills in behind the trunks, so nothing shows through
  if (o.closed) {
    for (let x = 0; x < w; x++) for (let y = Math.floor(top(x) + 20); y < ay + 2; y++) p.set(x, y, shade(o.tone.leaf, 0.05 + noise1(x * 0.11, o.seed + 8) * 0.12));
  }
  const back = Math.round(w / 46);
  for (let i = 0; i < back; i++) {
    const x = rnd() * w;
    const tw = 4 + rnd() * 6;
    if (near(x) < corridor * 0.9 + tw) continue;
    trunk(p, x, bottom(x) - 24, ay + 1, tw, darker(o.tone.bark, 2), o.seed + i * 7, { light: x < px ? 1 : -1, flare: tw });
  }
  const front = Math.round(w / 92);
  for (let i = 0; i < front; i++) {
    const x = (i + 0.2 + rnd() * 0.6) * (w / front);
    const tw = 9 + rnd() * 14;
    if (near(x) < corridor + tw / 2 + 3) continue;
    trunk(p, x, bottom(x) - 30, ay + 2, tw, o.tone.bark, o.seed + i * 17 + 3, { moss: o.tone.moss, light: x < px ? 1 : -1, flare: tw * 1.2 });
  }
  canopy(p, { top, bottom, pal: o.tone.leaf, seed: o.seed, rMin: 7, rMax: 15, gaps: o.gaps });
  const bushes = Math.round(w / 52);
  for (let i = 0; i < bushes; i++) {
    const x = rnd() * w;
    const bw = 12 + rnd() * 26;
    if (near(x) < corridor * 0.7 + bw / 2) continue;
    bush(p, x, ay + 2, bw, 7 + rnd() * 9, darker(o.tone.leaf, 1), o.seed + i * 29 + 5);
  }
  const ferns = Math.round(w / 70);
  for (let i = 0; i < ferns; i++) {
    const x = rnd() * w;
    if (near(x) < corridor * 0.45) continue;
    fern(p, x, ay + 2, 6 + rnd() * 8, o.tone.leaf, o.seed + i * 41);
  }
  p.bleed();
  return { pix: p, ax, ay, d: o.d, repeat: true };
}

/**
 * One of the two big trees at the edge of the wood, framing the view from the meadow:
 * a whole tree with its crown at the top, its branches reaching into the picture.
 * `side` -1 is the left tree.
 */
export function edgeTree(side: -1 | 1): Layer {
  const d = 5;
  const w = 320;
  const ay = 372;
  const h = ay + 4;
  const p = new Pix(w, h);
  const inward = -side;
  const tx = side < 0 ? 70 : w - 70;
  const seed = side < 0 ? 101 : 202;
  const rnd = mulberry(seed);
  const bark = PAL.edge.bark;
  const leaf = PAL.edge.leaf;

  trunk(p, tx + inward * 76, 70, ay + 1, 15, darker(bark, 1), seed + 1, { light: inward, moss: PAL.edge.moss, flare: 18 });
  trunk(p, tx, 40, ay + 2, 34, bark, seed + 2, { light: inward, moss: PAL.edge.moss, flare: 44, mossy: 0.05 });
  limb(p, tx + inward * 8, 214, tx + inward * 100, 176, 11, 4, bark, seed + 3);
  limb(p, tx + inward * 10, 262, tx + inward * 62, 248, 7, 3, bark, seed + 4);
  limb(p, tx - inward * 6, 120, tx + inward * 50, 84, 9, 3, bark, seed + 5);

  // crown at the top, the big overhang into the picture, a low branch
  const masses: [number, number, number, number, number][] = [
    [14, 70, 92, 46, 34],
    [60, 186, 74, 26, 24],
    [72, 242, 30, 10, 7],
  ];
  const clumps: [number, number, number][] = [];
  for (const [mx, my, sx, sy, n] of masses) {
    for (let i = 0; i < n; i++) {
      const u = rnd() * 2 - 1;
      const x = tx + inward * (mx + u * sx);
      const y = my + (rnd() * 2 - 1) * sy + Math.max(0, u) * sy * 0.6;
      clumps.push([x, y, 8 + rnd() * 12]);
    }
  }
  clumps.sort((a, b) => a[1] - b[1]);
  clumps.forEach(([x, y, r], i) => clump(p, x, y, r, leaf, seed * 7 + i, 0.02));

  bush(p, tx + inward * 30, ay + 2, 40, 14, leaf, seed + 9);
  bush(p, tx - inward * 26, ay + 2, 30, 11, darker(leaf, 1), seed + 10);
  fern(p, tx + inward * 52, ay + 3, 16, leaf, seed + 11);
  fern(p, tx - inward * 8, ay + 3, 12, leaf, seed + 12);
  p.outline();
  p.bleed();
  return { pix: p, ax: tx, ay, d };
}

/** Tall meadow grass along the edge of the wood. */
export function edgeGround(): Layer {
  const d = 5;
  const w = 1024;
  const ay = 22;
  const p = new Pix(w, ay + 2, true);
  ground(p, ay, PAL.edge.grass, 303, { tall: 12, base: 0.5, fadeTo: 0.24, blades: 0.85, fill: false });
  const rnd = mulberry(304);
  for (let i = 0; i < 40; i++) tuft(p, rnd() * w, ay + 1, 8 + rnd() * 12, PAL.edge.grass, 305 + i, 0.5);
  p.bleed();
  return { pix: p, ax: w / 2, ay, d, repeat: true };
}

/** The trees behind the clearing: darker, closer together, the path carrying on between them. */
export function clearingBackdrop(exitX: number): Layer {
  return frame({ d: 13, seed: 501, tone: { ...PAL.mid, leaf: PAL.clearing.leaf, bark: PAL.clearing.bark }, canopy: 2.0, arch: 0.4, gaps: 0.02, cx: exitX, corridor: 1.1 });
}

/** The last stretch before the hollow. */
export function hollowFrame(cx: number): Layer {
  return frame({ d: 8, seed: 90, tone: PAL.deep, canopy: 1.7, arch: 0.5, gaps: 0, cx });
}

/** Behind the cat: the wood closes in, dense and dark, nothing to walk through. */
export function hollowBack(): Layer {
  return frame({ d: 11, seed: 107, tone: { ...PAL.deep, leaf: PAL.hollow.wall.slice(1, 8) }, canopy: 1.6, arch: 0, gaps: 0, closed: true, thick: 3.2 });
}
