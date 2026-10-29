/**
 * Pill mode's world: where you may walk, and the water you only find there (a lake behind where the walk
 * starts, a river down the far left of the wood, a pond deep on the right). Plain numbers, no three.js:
 * the water shader, the collisions and the planting all read the same shapes.
 */
import { CLEARING, HOLLOW } from './config';
import { mulberry } from './pix';

/** The invisible fence. The wood carries on past it into the fog, so it never looks like an edge. */
export const BOUNDS = { x0: -24, x1: 29, z0: -106, z1: 33 };
/** Where you wake up, and how high your eyes are. */
export const SPAWN = { x: 0, z: 2.4 };
export const EYE = 0.68;

export const LAKE = { x: 3, z: 19.5, rx: 9.5, rz: 5.6 };
export const POND = { x: 15.5, z: -46, rx: 3.3, rz: 2.3 };
/** The river, upstream (deep in the wood) to where it runs into the lake. */
export const RIVER: [number, number][] = [
  [-20, -118], [-18.6, -90], [-21.4, -64], [-18, -40], [-20.4, -18], [-16.8, 1], [-10.5, 12.5], [-4.5, 17.8],
];
export const RIVER_W = 1.2;
/** The open meadow round the lake, where no trees grow. */
export const GLADE = { x: 1, z: 13, rx: 17, rz: 18 };

const ell = (x: number, z: number, e: { x: number; z: number; rx: number; rz: number }) =>
  (Math.hypot((x - e.x) / e.rx, (z - e.z) / e.rz) - 1) * Math.min(e.rx, e.rz);

function seg(x: number, z: number, a: [number, number], b: [number, number]) {
  const bx = b[0] - a[0];
  const bz = b[1] - a[1];
  const h = Math.max(0, Math.min(1, ((x - a[0]) * bx + (z - a[1]) * bz) / (bx * bx + bz * bz)));
  return Math.hypot(x - a[0] - bx * h, z - a[1] - bz * h);
}

/** How far a point is from the nearest water, in world units (negative in it). */
export function waterDist(x: number, z: number) {
  let d = Math.min(ell(x, z, LAKE), ell(x, z, POND));
  for (let i = 0; i < RIVER.length - 1; i++) d = Math.min(d, seg(x, z, RIVER[i], RIVER[i + 1]) - RIVER_W);
  return d;
}

export const inBounds = (x: number, z: number, m = 0) => x > BOUNDS.x0 + m && x < BOUNDS.x1 - m && z > BOUNDS.z0 + m && z < BOUNDS.z1 - m;

/** Lily pads on the still water: x, z, radius, where the notch points. */
export const PADS: [number, number, number, number][] = [
  [0.2, 21.4, 0.34, 0.4], [1.1, 22.2, 0.26, 2.1], [6.4, 17.3, 0.38, 4.2], [7.5, 18.4, 0.24, 1.2], [9.6, 20.6, 0.3, 5.6],
  [-2.6, 18.4, 0.28, 3.3], [4.2, 23.6, 0.32, 0.9], [-0.8, 16.4, 0.22, 2.6],
  [14.6, -45.4, 0.3, 1.8], [16.6, -46.9, 0.26, 4.9], [15.9, -44.6, 0.2, 0.2], [13.8, -46.7, 0.24, 3.7],
];

/** Where the path runs on the walk, so extra planting keeps off it. */
const pathX = (z: number) => {
  const ex = CLEARING.exitX;
  return z > -56 ? 0 : z > -71 ? 0.3 : z > -96 ? 0.3 + ((-71 - z) / 25) * (ex - 0.3) : ex;
};

/**
 * The trees pill mode adds to the walk's: a wood all round the meadow behind the start, and wide bands past
 * the fence on every side, thinning into the fog. Seeded, so everyone wakes in the same wood.
 */
export function extraTrees(taken: { x: number; z: number }[]) {
  const rnd = mulberry(8080);
  const out: { x: number; z: number; s: number; pick: number }[] = [];
  const all = [...taken];
  const free = (x: number, z: number, gap: number) => all.every((t) => (t.x - x) ** 2 + (t.z - z) ** 2 > gap);
  const glade = (x: number, z: number) => ((x - GLADE.x) / GLADE.rx) ** 2 + ((z - GLADE.z) / GLADE.rz) ** 2 < 1;
  const tryAt = (x: number, z: number, gap: number) => {
    if (waterDist(x, z) < 1.1 || glade(x, z) || !free(x, z, gap)) return;
    // the walk's own wood is left as it is, except past the fence
    if (z < -6 && z > -108 && Math.abs(x - pathX(z)) < 28.5) return;
    if (Math.abs(x - CLEARING.exitX) < 7 && z < HOLLOW.camZ && z > -108) return;
    const t = { x, z, s: 0.85 + rnd() * 0.4, pick: rnd() };
    out.push(t);
    all.push(t);
  };
  // round the meadow behind the start, thick
  for (let i = 0; i < 5000 && out.length < 420; i++) tryAt(-60 + rnd() * 120, -7 + rnd() * 72, 1.7);
  // past the fence on both sides of the wood, and behind the hollow
  for (let i = 0; i < 5000 && out.length < 900; i++) {
    const z = -6 - rnd() * 140;
    const side = rnd() < 0.5 ? -1 : 1;
    tryAt(pathX(z) + side * (28.5 + rnd() * 30), z, 2.2);
  }
  for (let i = 0; i < 3000 && out.length < 1100; i++) tryAt(-60 + rnd() * 124, -104 - rnd() * 40, 2);
  return out;
}

/** Spots for the critters that live only in pill mode: anywhere inside the fence, off the water and the path. */
export function critterSpots(count: number, seed: number) {
  const rnd = mulberry(seed);
  const out: [number, number][] = [];
  for (let i = 0; i < 4000 && out.length < count; i++) {
    const x = BOUNDS.x0 + 2 + rnd() * (BOUNDS.x1 - BOUNDS.x0 - 4);
    const z = BOUNDS.z0 + 2 + rnd() * (BOUNDS.z1 - BOUNDS.z0 - 4);
    if (waterDist(x, z) < 0.8 || Math.hypot(x - SPAWN.x, z - SPAWN.z) < 6) continue;
    out.push([x, z]);
  }
  return out;
}
