import { PAL } from '../palette';
import { hex, Pix } from '../pix';
import { tuft } from './brush';

/**
 * Small hand-drawn sprites: flowers and mushrooms for the floor, and the animals that run about. Each is a grid of characters; the legend maps them to colours.
 */

type Legend = Record<string, string>;

function draw(rows: string[], legend: Legend, flip = false): Pix {
  const h = rows.length;
  const w = Math.max(...rows.map((r) => r.length));
  const p = new Pix(w, h);
  const cols: Record<string, number> = {};
  for (const k in legend) cols[k] = hex(legend[k]);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ch = rows[y][flip ? w - 1 - x : x];
      if (ch && ch !== '.' && cols[ch] !== undefined) p.set(x, y, cols[ch]);
    }
  }
  return p;
}

/** Packs sprites into one buffer, left to right, bottoms aligned to the bottom row. Returns where each went. */
export function atlas(list: Pix[], pad = 1) {
  const w = list.reduce((s, p) => s + p.w + pad, 0);
  const h = Math.max(...list.map((p) => p.h));
  const out = new Pix(w, h);
  const rects: { x: number; y: number; w: number; h: number }[] = [];
  let x = 0;
  for (const p of list) {
    out.blit(p, x, h - p.h);
    rects.push({ x, y: h - p.h, w: p.w, h: p.h });
    x += p.w + pad;
  }
  return { pix: out, rects };
}

// --- flowers and mushrooms ---------------------------------------------------------------------------

const G = { g: '#2f5a2a', G: '#4f8a3a', l: '#7fb04a' };

export const FLORA: { name: string; rows: string[]; legend: Legend }[] = [
  {
    name: 'daisy',
    rows: ['.w.w.', 'wwyww', '.wwW.', '..g..', '..g..', '.lg..', '..g..'],
    legend: { ...G, w: '#ece6d4', W: '#c9c3b0', y: '#e7b73c' },
  },
  {
    name: 'daisies',
    rows: ['.w.....', 'wyw..w.', '.w..wyw', '.g...w.', '.g.l.g.', '.gg.gg.', '..g.g..'],
    legend: { ...G, w: '#ece6d4', y: '#e7b73c' },
  },
  {
    name: 'buttercup',
    rows: ['.yy.', 'yYYy', '.yy.', '.g..', '.g..', 'lg..', '.g..'],
    legend: { ...G, y: '#d9a92a', Y: '#f2d36a' },
  },
  {
    name: 'bluebells',
    rows: ['..g..', '.gbg.', '.b.gb', 'bB..B', 'B..g.', '...g.', '..lg.', '...g.'],
    legend: { ...G, b: '#5d6aa8', B: '#8691c8' },
  },
  {
    name: 'campion',
    rows: ['.rr.', 'rRRr', '.rr.', '..g.', '.lg.', '..g.'],
    legend: { ...G, r: '#a8443c', R: '#d36a55' },
  },
  {
    name: 'clover',
    rows: ['.ww..', 'wWww.', '.ww.l', '..gll', '.lg..', '..g..'],
    legend: { ...G, w: '#e3dccb', W: '#f6f1e4' },
  },
  {
    name: 'toadstool',
    rows: ['..rrrr..', '.rwrrwr.', 'rrrrrwrr', 'rwrrrrrR', '.RRRRRR.', '...ss...', '...sS...', '..sssS..'],
    legend: { r: '#b8392c', R: '#7c2620', w: '#f1e9d6', s: '#e3d8bc', S: '#b9ac8e' },
  },
  {
    name: 'toadstool-small',
    rows: ['.rrr.', 'rwrrr', 'RRRRR', '..s..', '.sS..'],
    legend: { r: '#b8392c', R: '#7c2620', w: '#f1e9d6', s: '#e3d8bc', S: '#b9ac8e' },
  },
  {
    name: 'brown-caps',
    rows: ['.....cc.', '.ccc.cCc', 'cCcCc.s.', '.sss..s.', '..s...s.', '..s..ss.'],
    legend: { c: '#8a5a38', C: '#b9875a', s: '#d8cdb0' },
  },
  {
    name: 'sprout',
    rows: ['l...l', '.l.l.', '..g..', '..g..'],
    legend: G,
  },
];

/** Grass tufts in each stretch's greens (meadow, wood, deep wood, clearing, hollow), three of each. */
export const TUFT_ZONES = 5;
export const TUFT_KINDS = 3;
export function tuftSprites(): Pix[] {
  const zones = [PAL.edge.grass, PAL.mid.grass, PAL.deep.grass, PAL.clearing.grass, PAL.hollow.grass];
  const out: Pix[] = [];
  zones.forEach((pal, z) => {
    for (let k = 0; k < TUFT_KINDS; k++) {
      const h = 7 + k * 3;
      const p = new Pix(11, h + 1);
      // lit blades, a little lighter than the ground they stand on, so they read as grass and not as dark spots
      tuft(p, 5, h, h, pal, 900 + z * 10 + k, 0.58 + k * 0.05);
      tuft(p, 6, h, h * 0.7, pal, 950 + z * 10 + k, 0.5);
      out.push(p);
    }
  });
  return out;
}

export function floraSprites(): Pix[] {
  return FLORA.map((f) => {
    const p = draw(f.rows, f.legend);
    // the mushrooms get their outline; thin-stemmed flowers stay as they are
    if (/toadstool|caps/.test(f.name)) p.outline(0.55, 0.85);
    return p;
  });
}

// --- the animals --------------------------------------------------------------------------------------

/** Each animal: its frames (all facing right), how it moves, and which frames it uses for what. */
export type Critter = {
  name: string;
  frames: string[][];
  legend: Legend;
  /** frames for standing still, and for moving */
  idle: number[];
  move: number[];
  speed: number;
  hop?: number;
};

export const CRITTERS: Critter[] = [
  {
    name: 'rabbit',
    legend: { b: '#7d6650', B: '#5c4a3a', l: '#a89176', w: '#e9e1d0', e: '#1a1612', p: '#c98d84' },
    frames: [
      ['..bb....', '..bB....', '..bb....', '.bbbb...', 'bebbbb..', 'bbbbbbb.', '.pbbbbbw', '..bBbBBw', '..bB.bB.'],
      ['...bb...', '...bB...', '..bbb...', '.bebbbb.', 'pbbbbbbb', '.bbbbbbw', '..bBBBBw', '.bB...bB', '........'],
      ['........', '...bb...', '..bbbB..', '.bebbbbb', 'pbbbbbbw', '.bbbbbbw', 'bB.BBBB.', '........', '........'],
    ],
    idle: [0],
    move: [1, 2],
    speed: 1.6,
    hop: 0.09,
  },
  {
    name: 'hedgehog',
    legend: { s: '#4a3c30', S: '#6e5a46', f: '#c9b08a', e: '#14110e', n: '#1d1814' },
    frames: [
      ['..sSsSs...', '.sSsSsSsS.', 'sSsSsSsSff', 'sSsSsSsfef', '.sssssffnf', '..f..f....'],
      ['..sSsSs...', '.sSsSsSsS.', 'sSsSsSsSff', 'sSsSsSsfef', '.sssssffnf', '.f....f...'],
    ],
    idle: [0],
    move: [0, 1],
    speed: 0.45,
  },
  {
    name: 'squirrel',
    legend: { r: '#a3542a', R: '#7a3c1e', o: '#c97a3e', w: '#e8d9bd', e: '#15110d' },
    frames: [
      ['.rr.......', 'rrRr......', 'rRRr..rr..', '.rRr.rerr.', '.rRrrrrrw.', '..rrrrrrw.', '...rrRrr..', '...R..R...'],
      ['..........', '.rr.......', 'rrRr...rr.', 'rRRrr.rerr', '.rRRrrrrrw', '..rrrrrrw.', '..R.rR.R..', '..........'],
    ],
    idle: [0],
    move: [1, 0],
    speed: 2.2,
    hop: 0.05,
  },
  {
    name: 'bird',
    legend: { b: '#6b5a48', B: '#4a3d31', r: '#c2583a', e: '#14110e', y: '#d9a92a' },
    frames: [
      ['..bb..', '.bbeby', 'Bbbrr.', '.Bbbr.', '..b.b.'],
      ['......', '..bb..', '.bbeby', 'BBbrr.', '..b.b.'],
      ['......', '......', '.bbb..', 'BbbreY', '..b.b.'],
    ],
    idle: [0, 0, 0, 2, 0, 2],
    move: [1, 0],
    speed: 1.2,
    hop: 0.06,
  },
  {
    name: 'frog',
    legend: { g: '#4f7d36', G: '#36592a', l: '#86ad55', e: '#121410', y: '#d8cf8a' },
    frames: [
      ['.le.le.', 'lgglggl', 'gggggGg', 'Gyyyyyg', 'G.G.G.G'],
      ['.le.le.', 'lgglggl', 'gggggGg', 'GyyyyGg', 'G.....G', '.G...G.'],
    ],
    idle: [0],
    move: [1],
    speed: 1.4,
    hop: 0.12,
  },
];

export function critterSprites() {
  const list: Pix[] = [];
  const index: number[][] = [];
  for (const c of CRITTERS) {
    index.push(c.frames.map((f) => {
      const p = draw(f, c.legend);
      p.outline(0.55, 0.85);
      list.push(p);
      return list.length - 1;
    }));
  }
  return { list, index };
}


