import { PAL, SEASON } from '../palette';
import { hex, mulberry, Pix, ramp, type Ramp } from '../pix';
import { branches, bush, clump, fern, limb, snowOn, trunk } from './brush';

/**
 * Whole trees, one per sprite, so the wood can be planted tree by tree at real depths
 * instead of in rows. Painted for distance TREE_D; each kind has its own shape, bark and leaves,
 * and wears the season (`PAL.leaves`): fresh in spring, deep in summer, copper and gold in autumn, bare
 * branches under snow in winter.
 */
export const TREE_D = 8;

export type TreeKind = 'oak' | 'beech' | 'birch' | 'young' | 'ancient';

export const BEECH_BARK = ramp('#2c2e2a', '#43463f', '#5d6157', '#787c70', '#959889');
export const BIRCH_BARK = ramp('#2a2723', '#8f8c84', '#c9c5b9', '#e2ded2', '#f1eee5');

export type Spec = {
  w: number;
  h: number;
  trunkW: number;
  crown: [number, number, number, number]; // centre x, centre y, radius x, radius y
  rMin: number;
  rMax: number;
  count: number;
  bark: Ramp;
  moss?: Ramp;
  flare: number;
  limbs: number;
};

export const SPECS: Record<TreeKind, Spec> = {
  oak: { w: 176, h: 250, trunkW: 18, crown: [88, 84, 72, 54], rMin: 9, rMax: 17, count: 46, bark: PAL.mid.bark, moss: PAL.mid.moss, flare: 22, limbs: 3 },
  beech: { w: 140, h: 276, trunkW: 14, crown: [70, 92, 56, 72], rMin: 8, rMax: 15, count: 42, bark: BEECH_BARK, flare: 14, limbs: 2 },
  birch: { w: 112, h: 262, trunkW: 9, crown: [56, 96, 42, 64], rMin: 6, rMax: 11, count: 40, bark: BIRCH_BARK, flare: 8, limbs: 2 },
  young: { w: 84, h: 158, trunkW: 6, crown: [42, 46, 32, 30], rMin: 6, rMax: 10, count: 18, bark: PAL.mid.bark, flare: 6, limbs: 1 },
  ancient: { w: 232, h: 262, trunkW: 32, crown: [116, 82, 100, 60], rMin: 10, rMax: 19, count: 64, bark: PAL.deep.bark, moss: PAL.mid.moss, flare: 40, limbs: 4 },
};

/** The leaves a kind wears this season, and a crown's clump colour (a few clumps take the season's second ramp). */
export const leafOf = (kind: TreeKind | 'bush', rnd: () => number): Ramp => (rnd() < PAL.mix ? PAL.leaves2[kind] : PAL.leaves[kind]);

/** Dry leaves that stay on through winter: young trees and beeches keep theirs (they rattle in the wind). */
const KEEPS: Record<TreeKind | 'bush', number> = { oak: 0.12, beech: 0.25, birch: 0, young: 0.55, ancient: 0.06, bush: 0.1 };

/**
 * A crown of leaf clumps through an oval, top ones first so the lower ones lay their lit tops over them; bare
 * branches with a few dry leaves instead, when the season has them off.
 */
export function crown(p: Pix, kind: TreeKind | 'bush', o: { cx: number; cy: number; rx: number; ry: number; count: number; rMin: number; rMax: number; trunkX: number; trunkTop: number; w: number; bark: Ramp; seed: number }) {
  const rnd = mulberry(o.seed * 7 + 3);
  if (PAL.fullness <= 0) {
    // the limbs fan out from the top of the trunk and split until they are twigs
    const mains = Math.max(3, Math.round(o.rx / 14));
    let tips: [number, number][] = [];
    for (let i = 0; i < mains; i++) {
      const u = mains === 1 ? 0.5 : i / (mains - 1);
      const ang = -Math.PI / 2 + (u - 0.5) * 2.1 + (rnd() - 0.5) * 0.25;
      const y0 = o.trunkTop + o.ry * (0.25 + rnd() * 0.5);
      tips = tips.concat(
        branches(p, { x: o.trunkX, y: y0, ang, len: Math.min(o.rx, o.ry) * (0.55 + rnd() * 0.25), w: Math.max(2, o.w * 0.55), depth: 4, pal: o.bark, seed: o.seed + 50 + i, cx: o.cx, cy: o.cy, rx: o.rx, ry: o.ry, droop: kind === 'birch' }),
      );
    }
    // the few dry leaves kept, in little bunches at the twig ends
    const keep = KEEPS[kind];
    for (const [x, y] of tips) if (rnd() < keep) clump(p, x, y, 2 + rnd() * 2.5, PAL.leaves[kind], o.seed + Math.round(x * 3 + y), 0.05);
    return;
  }
  const n = Math.round(o.count * PAL.fullness);
  const clumps: [number, number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = rnd() * Math.PI * 2;
    const r = Math.sqrt(rnd());
    clumps.push([o.cx + Math.cos(a) * r * o.rx * 0.82, o.cy + Math.sin(a) * r * o.ry * 0.82, o.rMin + rnd() * (o.rMax - o.rMin)]);
  }
  // a thinner crown shows more of its limbs: give it a couple more
  if (PAL.fullness < 0.9)
    for (let i = 0; i < 2; i++) {
      const side = i % 2 ? 1 : -1;
      limb(p, o.trunkX, o.cy + o.ry * 0.1, o.trunkX + side * o.rx * 0.55, o.cy - o.ry * 0.45, o.w * 0.35, 2, o.bark, o.seed + 70 + i);
    }
  clumps.sort((a, b) => a[1] - b[1]);
  clumps.forEach(([x, y, r], i) => clump(p, x, y, r, leafOf(kind, rnd), o.seed * 13 + i, ((o.cy - y) / o.ry) * 0.1 - 0.04));
  // blossom: a wild cherry in white, dotted with its flowers
  if (SEASON === 'spring' && kind === 'young') for (let i = 0; i < 60; i++) {
    const a = rnd() * Math.PI * 2;
    const r = Math.sqrt(rnd());
    const x = Math.round(o.cx + Math.cos(a) * r * o.rx * 0.9);
    const y = Math.round(o.cy + Math.sin(a) * r * o.ry * 0.9);
    if (p.get(x, y) >>> 24) p.set(x, y, hex(rnd() < 0.3 ? '#f4d6d8' : '#fbf6f0'));
  }
}

/** Ferns, the season's way: green in summer, rust in autumn, under snow (none) in winter. */
export function seasonFern(p: Pix, x: number, by: number, size: number, pal: Ramp, seed: number) {
  if (SEASON === 'winter') return;
  fern(p, x, by, size, SEASON === 'autumn' ? ramp('#2e1a0e', '#4a2a12', '#6e3e18', '#935620', '#b4722e') : pal, seed);
}

/** One tree. Its bottom row stands on the floor at the middle of the trunk (ax). */
export function treeSprite(kind: TreeKind, seed: number): { pix: Pix; ax: number; ay: number } {
  const s = SPECS[kind];
  const p = new Pix(s.w, s.h);
  const rnd = mulberry(seed);
  const ax = Math.round(s.w / 2 + (rnd() - 0.5) * s.trunkW * 0.6);
  const ay = s.h - 1;
  const [cx, cy, rx, ry] = s.crown;
  const bare = PAL.fullness <= 0;

  // the trunk, lit from the right where the sun comes from, running up into the crown (higher when it's bare)
  const top = bare ? cy - ry * 0.55 : cy - ry * 0.2;
  trunk(p, ax, top, ay, s.trunkW, s.bark, seed + 1, { light: 1, moss: s.moss ? PAL.mid.moss : undefined, flare: s.flare, mossy: kind === 'ancient' ? 0.08 : 0 });
  if (kind === 'birch') {
    // the black marks on white birch bark
    for (let y = Math.round(top); y < ay - 4; y += 3 + Math.floor(rnd() * 6)) {
      const len = 2 + Math.floor(rnd() * 4);
      const x0 = ax - Math.floor(s.trunkW / 2) + Math.floor(rnd() * (s.trunkW - len));
      for (let i = 0; i < len; i++) p.over(x0 + i, y, s.bark[0]);
    }
  }
  // limbs reaching out into the crown
  for (let i = 0; i < s.limbs; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const y0 = cy + ry * (0.2 + rnd() * 0.35);
    limb(p, ax, y0, ax + side * rx * (0.45 + rnd() * 0.3), y0 - ry * (0.35 + rnd() * 0.3), s.trunkW * 0.5, 2, s.bark, seed + 10 + i);
  }
  crown(p, kind, { cx, cy, rx, ry, count: s.count, rMin: s.rMin, rMax: s.rMax, trunkX: ax, trunkTop: top, w: s.trunkW, bark: s.bark, seed });
  // a little undergrowth at the foot of the big ones
  if (kind === 'oak' || kind === 'ancient') {
    if (!bare) bush(p, ax - s.trunkW, ay + 1, s.trunkW * 1.6, 8 + rnd() * 6, PAL.leaves.bush, seed + 30);
    seasonFern(p, ax + s.trunkW * 0.9, ay + 1, 10, PAL.mid.leaf, seed + 31);
  }
  p.outline();
  if (PAL.snowy) snowOn(p, PAL.snow, seed + 90);
  p.bleed();
  return { pix: p, ax, ay };
}

/** Which kinds get painted, and how many of each (different seeds). */
export const TREE_SET: { kind: TreeKind; seeds: number[] }[] = [
  { kind: 'oak', seeds: [1101, 1102] },
  { kind: 'beech', seeds: [1201, 1202] },
  { kind: 'birch', seeds: [1301, 1302] },
  { kind: 'young', seeds: [1401, 1402] },
  { kind: 'ancient', seeds: [1501] },
];

/** A low bush to plant between the trees: leafy, or in winter a tangle of twigs with red haws and snow on it. */
export function bushSprite(seed: number): { pix: Pix; ax: number; ay: number } {
  const p = new Pix(70, 34);
  const rnd = mulberry(seed);
  if (PAL.fullness <= 0) {
    const twig = ramp('#1f1812', '#3a2c20', '#54412f', '#6e5640');
    for (let i = 0; i < 7; i++) {
      const ang = -Math.PI / 2 + (i / 6 - 0.5) * 2.2;
      branches(p, { x: 35 + (rnd() - 0.5) * 10, y: 33, ang, len: 12 + rnd() * 6, w: 2, depth: 3, pal: twig, seed: seed + i * 7, cx: 35, cy: 20, rx: 32, ry: 16 });
    }
    for (let i = 0; i < 16; i++) {
      const x = Math.round(10 + rnd() * 50);
      const y = Math.round(8 + rnd() * 18);
      if (p.get(x, y) >>> 24) p.set(x, y, hex(rnd() < 0.5 ? '#b8392c' : '#d6503e'));
    }
  } else {
    bush(p, 35, 33, 56, 20, PAL.leaves.bush, seed);
    // berries in autumn, blackthorn's white blossom in spring
    const dots = SEASON === 'autumn' ? ['#b8392c', '#8a2a24', '#d6503e'] : SEASON === 'spring' ? ['#fbf6f0', '#f4e4e0'] : [];
    for (let i = 0; dots.length && i < 26; i++) {
      const x = Math.round(12 + rnd() * 46);
      const y = Math.round(16 + rnd() * 16);
      if (p.get(x, y) >>> 24) p.set(x, y, hex(dots[i % dots.length]));
    }
    seasonFern(p, 12, 33, 12, PAL.mid.leaf, seed + 1);
  }
  p.outline();
  if (PAL.snowy) snowOn(p, PAL.snow, seed + 9);
  p.bleed();
  return { pix: p, ax: 35, ay: 33 };
}
