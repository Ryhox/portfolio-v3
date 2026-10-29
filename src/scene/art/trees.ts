import { PAL } from '../palette';
import { mulberry, Pix, ramp, type Ramp } from '../pix';
import { bush, clump, fern, limb, trunk } from './brush';

/**
 * Whole trees, one per sprite, so the wood can be planted tree by tree at real depths
 * instead of in rows. Painted for distance TREE_D; each kind has its own shape, bark and leaves.
 */
export const TREE_D = 8;

export type TreeKind = 'oak' | 'beech' | 'birch' | 'young' | 'ancient';

const BEECH_BARK = ramp('#2c2e2a', '#43463f', '#5d6157', '#787c70', '#959889');
const BIRCH_BARK = ramp('#2a2723', '#8f8c84', '#c9c5b9', '#e2ded2', '#f1eee5');

type Spec = {
  w: number;
  h: number;
  trunkW: number;
  crown: [number, number, number, number]; // centre x, centre y, radius x, radius y
  rMin: number;
  rMax: number;
  count: number;
  bark: Ramp;
  leaf: Ramp;
  moss?: Ramp;
  flare: number;
  limbs: number;
};

const SPECS: Record<TreeKind, Spec> = {
  oak: { w: 176, h: 250, trunkW: 18, crown: [88, 84, 72, 54], rMin: 9, rMax: 17, count: 46, bark: PAL.mid.bark, leaf: PAL.mid.leaf, moss: PAL.mid.moss, flare: 22, limbs: 3 },
  beech: { w: 140, h: 276, trunkW: 14, crown: [70, 92, 56, 72], rMin: 8, rMax: 15, count: 42, bark: BEECH_BARK, leaf: PAL.mid.leaf, flare: 14, limbs: 2 },
  birch: { w: 112, h: 262, trunkW: 9, crown: [56, 96, 42, 64], rMin: 6, rMax: 11, count: 40, bark: BIRCH_BARK, leaf: PAL.edge.leaf, flare: 8, limbs: 2 },
  young: { w: 84, h: 158, trunkW: 6, crown: [42, 46, 32, 30], rMin: 6, rMax: 10, count: 18, bark: PAL.mid.bark, leaf: PAL.edge.leaf, flare: 6, limbs: 1 },
  ancient: { w: 232, h: 262, trunkW: 32, crown: [116, 82, 100, 60], rMin: 10, rMax: 19, count: 64, bark: PAL.deep.bark, leaf: PAL.deep.leaf, moss: PAL.mid.moss, flare: 40, limbs: 4 },
};

/** One tree. Its bottom row stands on the floor at the middle of the trunk (ax). */
export function treeSprite(kind: TreeKind, seed: number): { pix: Pix; ax: number; ay: number } {
  const s = SPECS[kind];
  const p = new Pix(s.w, s.h);
  const rnd = mulberry(seed);
  const ax = Math.round(s.w / 2 + (rnd() - 0.5) * s.trunkW * 0.6);
  const ay = s.h - 1;
  const [cx, cy, rx, ry] = s.crown;

  // the trunk, lit from the right where the sun comes from, running up into the crown
  trunk(p, ax, cy - ry * 0.2, ay, s.trunkW, s.bark, seed + 1, { light: 1, moss: s.moss, flare: s.flare, mossy: kind === 'ancient' ? 0.08 : 0 });
  if (kind === 'birch') {
    // the black marks on white birch bark
    for (let y = Math.round(cy); y < ay - 4; y += 3 + Math.floor(rnd() * 6)) {
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
  // the crown: clumps scattered through an oval, top ones first so the lower ones lay their lit tops over them
  const clumps: [number, number, number][] = [];
  for (let i = 0; i < s.count; i++) {
    const a = rnd() * Math.PI * 2;
    const r = Math.sqrt(rnd());
    const x = cx + Math.cos(a) * r * rx * 0.82;
    const y = cy + Math.sin(a) * r * ry * 0.82;
    clumps.push([x, y, s.rMin + rnd() * (s.rMax - s.rMin)]);
  }
  clumps.sort((a, b) => a[1] - b[1]);
  clumps.forEach(([x, y, r], i) => clump(p, x, y, r, s.leaf, seed * 13 + i, (cy - y) / ry * 0.1 - 0.04));
  // a little undergrowth at the foot of the big ones
  if (kind === 'oak' || kind === 'ancient') {
    bush(p, ax - s.trunkW, ay + 1, s.trunkW * 1.6, 8 + rnd() * 6, PAL.mid.leaf, seed + 30);
    fern(p, ax + s.trunkW * 0.9, ay + 1, 10, PAL.mid.leaf, seed + 31);
  }
  p.outline();
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

/** A low bush to plant between the trees. */
export function bushSprite(seed: number): { pix: Pix; ax: number; ay: number } {
  const p = new Pix(70, 34);
  bush(p, 35, 33, 56, 20, PAL.mid.leaf, seed);
  fern(p, 12, 33, 12, PAL.mid.leaf, seed + 1);
  p.outline();
  p.bleed();
  return { pix: p, ax: 35, ay: 33 };
}
