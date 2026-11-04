/**
 * World layout. The camera never tilts; it looks down -z the whole way.
 * K0 is the height of one screen pixel at distance 1, so a layer painted for distance D
 * has texels of D·K0 world units and sits pixel-for-pixel on the screen when seen from D.
 */
export const K0 = 0.0027;
export const texelAt = (d: number) => d * K0;

/** Aim for about this many game pixels across the short side of the screen. */
export const SHORT_SIDE = 250;

export const HERO = { x: 0, y: 0.9, z: 0 };

/** The corridor the walk takes through the trees, as half-widths in world units. */
export const CORRIDOR = 1.35;

/** Tree screens between the edge of the wood and the clearing: z, the distance they're painted for, depth tone. */
export const FRAMES = [
  { z: -11, d: 11, tone: 'edge', seed: 11, canopy: 2.3, arch: 1.1, gaps: 0.1 },
  { z: -19, d: 12, tone: 'edge', seed: 19, canopy: 2.2, arch: 1.0, gaps: 0.08 },
  { z: -29, d: 12, tone: 'mid', seed: 29, canopy: 2.1, arch: 0.9, gaps: 0.06 },
  { z: -40, d: 12, tone: 'mid', seed: 40, canopy: 2.0, arch: 0.8, gaps: 0.05 },
  { z: -52, d: 12, tone: 'deep', seed: 52, canopy: 1.9, arch: 0.7, gaps: 0.03 },
  { z: -63, d: 10, tone: 'deep', seed: 63, canopy: 1.8, arch: 0.6, gaps: 0.02 },
] as const;

export const EDGE_Z = -5;

/** The clearing with the computer. The camera rests here, a little lower, while you pick a disc. */
export const CLEARING = {
  camY: 0.5,
  camZ: -71,
  computer: { x: 0, z: -75 },
  groundZ: -76,
  backdropZ: -84,
  /** Where the path leaves the clearing, off to the right of the computer. */
  exitX: 4.35,
  shaftZ: -74.9,
};

/** The cat's hollow, where the footer lives. */
export const HOLLOW = {
  camY: 0.6,
  camZ: -96,
  frameZ: -90,
  stumpZ: -101,
  wallZ: -107,
};


/** The direction sunlight travels: down, a little towards you, and to the left. */
const sun = [-0.32, -0.86, 0.4];
const sunLen = Math.hypot(sun[0], sun[1], sun[2]);
export const SUN = sun.map((v) => v / sunLen) as [number, number, number];

/** The roof of leaves (shadows only), in world units, and the size of its mask. */
export const ROOF = { y: 14, x0: -26, x1: 30, z0: -4.6, z1: -150, w: 512, h: 1280 };


/**
 * Light and fog along the walk, by camera z: a fine day at the edge of the wood, greyer and mistier the deeper
 * you go, bright again in the clearing, then dark down to the cat. `sun` scales the sunlight. The sky runs from
 * `sky` at the horizon to `zenith` overhead, and `clouds` is how much of it they cover.
 */
export const ATMOS = [
  { z: 0, fog: '#b6b38e', sky: '#e9ead6', zenith: '#8fafc8', clouds: 0.8, density: 0.034, falloff: 4, ambient: 1.02, shafts: 8, sun: 1.32 },
  { z: -14, fog: '#a4a686', sky: '#dfe0c9', zenith: '#98b1c2', clouds: 0.82, density: 0.04, falloff: 3.8, ambient: 0.95, shafts: 7, sun: 1.15 },
  { z: -32, fog: '#828a7d', sky: '#adb2a4', zenith: '#959c97', clouds: 0.9, density: 0.062, falloff: 3.4, ambient: 0.78, shafts: 6, sun: 0.74 },
  { z: -52, fog: '#646c66', sky: '#7c847d', zenith: '#6c736e', clouds: 1, density: 0.08, falloff: 3.2, ambient: 0.66, shafts: 5, sun: 0.52 },
  { z: -63, fog: '#5c655e', sky: '#717a72', zenith: '#646b66', clouds: 1, density: 0.08, falloff: 3, ambient: 0.64, shafts: 6, sun: 0.55 },
  { z: -71, fog: '#6f8760', sky: '#bccaa6', zenith: '#8eadc4', clouds: 0.75, density: 0.042, falloff: 2.6, ambient: 0.82, shafts: 16, sun: 1.1 },
  { z: -86, fog: '#18241a', sky: '#203024', zenith: '#1a261d', clouds: 0, density: 0.05, falloff: 2.5, ambient: 0.52, shafts: 7, sun: 1 },
  { z: -96, fog: '#121b14', sky: '#182419', zenith: '#141e16', clouds: 0, density: 0.05, falloff: 2.5, ambient: 0.5, shafts: 7, sun: 1 },
] as const;

/** Discs, as placed at the clearing: pixels from the computer's centre on screen, the distance they lie at, and a turn. */
export const DISCS = [
  { dx: -150, d: 3.4, a: -0.3 },
  { dx: -74, d: 2.75, a: 0.22 },
  { dx: 6, d: 2.45, a: -0.1 },
  { dx: 86, d: 2.8, a: 0.34 },
  { dx: 132, d: 3.3, a: -0.2 },
  { dx: -168, d: 2.35, a: 0.1 },
];
/** A floppy's width in world units: big enough to write on. */
export const DISC_WORLD = 0.28;

/** Rain puddles on the floor (x, z, half-width, half-depth). None in the meadow: they start inside the wood. */
export const PUDDLES: [number, number, number, number][] = [
  [0.2, -27, 0.6, 0.34],
  [-0.4, -38, 0.75, 0.36],
  [0.45, -50, 0.55, 0.3],
  [-0.25, -61, 0.7, 0.34],
  [0.95, -75.7, 0.5, 0.26],
  [-1.05, -77.2, 0.55, 0.24],
  [CLEARING.exitX + 0.95, -99.4, 0.6, 0.28],
  [CLEARING.exitX - 0.3, -91, 0.55, 0.3],
];

type Air = { z: number; fog: string; sky: string; zenith: string; clouds: number; density: number; falloff: number; ambient: number; shafts: number; sun: number };
const mixHex = (a: string, b: string, t: number) => {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (n: number, s: number) => (n >> s) & 255;
  const m = (s: number) => Math.round(ch(pa, s) + (ch(pb, s) - ch(pa, s)) * t);
  return `#${((m(16) << 16) | (m(8) << 8) | m(0)).toString(16).padStart(6, '0')}`;
};

/**
 * The walk's light and fog in each season, from summer's (ATMOS): spring fresher and clearer, autumn golden and
 * misty (the valleys fill with fog in October), winter bright and cold with the snow throwing light back up.
 * `hollow` is true for the dark stretch down to the cat, which keeps its dark.
 */
export function atmosFor(season: 'spring' | 'summer' | 'autumn' | 'winter'): Air[] {
  const S: Record<typeof season, { fog: [string, number, number]; sky: [string, number]; zenith: [string, number]; density: number; sun: number; ambient: number; clouds: number }> = {
    summer: { fog: ['#000000', 0, 0], sky: ['#000000', 0], zenith: ['#000000', 0], density: 1, sun: 1, ambient: 1, clouds: 1 },
    spring: { fog: ['#b9c8a6', 0.22, 0], sky: ['#e8efdc', 0.25], zenith: ['#86b0d4', 0.35], density: 0.88, sun: 1.05, ambient: 1.03, clouds: 1 },
    autumn: { fog: ['#c9a878', 0.34, 0.25], sky: ['#eedcbc', 0.35], zenith: ['#a0b4c4', 0.2], density: 1.3, sun: 1, ambient: 0.97, clouds: 1.05 },
    winter: { fog: ['#c8d0d8', 0.58, 0.35], sky: ['#e8ecf0', 0.62], zenith: ['#a8bccc', 0.5], density: 1.08, sun: 0.82, ambient: 1.16, clouds: 1.1 },
  };
  const m = S[season];
  return ATMOS.map((a) => {
    const hollow = a.z <= -86;
    return {
      ...a,
      fog: mixHex(a.fog, hollow ? mixHex(m.fog[0], '#000000', 0.75) : m.fog[0], hollow ? m.fog[2] : m.fog[1]),
      sky: mixHex(a.sky, m.sky[0], hollow ? m.sky[1] * 0.3 : m.sky[1]),
      zenith: mixHex(a.zenith, m.zenith[0], hollow ? m.zenith[1] * 0.3 : m.zenith[1]),
      density: a.density * m.density,
      sun: a.sun * m.sun,
      ambient: a.ambient * (hollow ? 1 + (m.ambient - 1) * 0.5 : m.ambient),
      clouds: Math.min(1, a.clouds * m.clouds),
    };
  });
}

/** The colour of sunlight by season: warm in summer, gold in autumn, a cold white in winter. */
export const SUN_TINT = { spring: [1, 0.95, 0.82], summer: [1, 0.94, 0.76], autumn: [1, 0.86, 0.6], winter: [0.98, 0.97, 0.92] } as const;
