import { PAL } from '../palette';
import { hex, Pix, type Ramp } from '../pix';
import type { Season } from '../season';
import { tuft } from './brush';

/**
 * Small hand-drawn sprites: flowers and mushrooms for the floor, and the animals that run about. Each is a grid of
 * characters; the legend maps them to colours. What grows and what runs about follows the season, the way it does
 * in a South Tyrolean wood: crocus and anemones in spring, foxgloves and wild strawberries in summer, autumn
 * crocus, chestnuts and mushrooms in autumn, Christmas roses and dry stalks in the snow in winter.
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

type Flower = { rows: string[]; legend: Legend; outline?: boolean };

const FLOWERS: Record<string, Flower> = {
  // summer's meadow
  daisy: { rows: ['.w.w.', 'wwyww', '.wwW.', '..g..', '..g..', '.lg..', '..g..'], legend: { ...G, w: '#ece6d4', W: '#c9c3b0', y: '#e7b73c' } },
  daisies: { rows: ['.w.....', 'wyw..w.', '.w..wyw', '.g...w.', '.g.l.g.', '.gg.gg.', '..g.g..'], legend: { ...G, w: '#ece6d4', y: '#e7b73c' } },
  buttercup: { rows: ['.yy.', 'yYYy', '.yy.', '.g..', '.g..', 'lg..', '.g..'], legend: { ...G, y: '#d9a92a', Y: '#f2d36a' } },
  bluebells: { rows: ['..g..', '.gbg.', '.b.gb', 'bB..B', 'B..g.', '...g.', '..lg.', '...g.'], legend: { ...G, b: '#5d6aa8', B: '#8691c8' } },
  campion: { rows: ['.rr.', 'rRRr', '.rr.', '..g.', '.lg.', '..g.'], legend: { ...G, r: '#a8443c', R: '#d36a55' } },
  clover: { rows: ['.ww..', 'wWww.', '.ww.l', '..gll', '.lg..', '..g..'], legend: { ...G, w: '#e3dccb', W: '#f6f1e4' } },
  redClover: { rows: ['.rRr.', 'rRrRr', '.rRr.', '.lgl.', 'l.g.l', '..g..'], legend: { ...G, r: '#9c3e62', R: '#c96a8c' } },
  yarrow: { rows: ['wWwWw', '.wWw.', '..g..', '.lg..', '..gl.', '..g..'], legend: { ...G, w: '#ddd6c4', W: '#f4efe2' } },
  knapweed: { rows: ['p.P.p', '.pPp.', '.PpP.', '..g..', '.lg..', '..gl.'], legend: { ...G, p: '#6e4290', P: '#9e70c0' } },
  stjohn: { rows: ['y.Y.y', '.yYy.', 'YyoyY', '.yYy.', '..g..', '.lgl.'], legend: { ...G, y: '#d9a92a', Y: '#f2d36a', o: '#b8741e' } },
  foxglove: { rows: ['..p..', '.pP..', '..pP.', '.Ppw.', '.pPp.', '..Pp.', '.pPp.', '..pP.', '.Pp..', '..g..', '.lgl.', 'lGgGl'], legend: { ...G, p: '#94407a', P: '#c870a6', w: '#f0dce6' } },
  strawberry: { rows: ['.w....', 'wyw.r.', '.w.rRr', 'lGl.rl', 'GlGlGl'], legend: { ...G, w: '#f1ece2', y: '#e7b73c', r: '#a82a24', R: '#e2524a' } },
  sprout: { rows: ['l...l', '.l.l.', '..g..', '..g..'], legend: G },
  // spring
  crocus: { rows: ['.P.', 'pPp', 'pPp', '.p.', 'lg.', '.gl', '.g.'], legend: { ...G, p: '#6a4698', P: '#a283cf' } },
  crocuses: { rows: ['.P...W.', 'pPp.wWw', 'pPp.wWw', '.p.P.w.', 'lgpPpgl', '.g.p.g.', '.g.g.g.'], legend: { ...G, p: '#6a4698', P: '#a283cf', w: '#d8d0e6', W: '#f2eef6' } },
  primrose: { rows: ['.yYy.', 'yYoYy', '.yYy.', 'lGlGl', '.lGl.'], legend: { ...G, y: '#dcc864', Y: '#f2e39a', o: '#c98e26' } },
  anemone: { rows: ['.w.w.', 'wwyWw', '.wWw.', '..g..', '.lgl.', 'l.g.l', '..g..'], legend: { ...G, w: '#f1ece2', W: '#d8c8d0', y: '#e7b73c' } },
  anemones: { rows: ['.w....w..', 'wyw..wyw.', '.w..w.w..', '.g.wyw.g.', 'lgl.w.lgl', '.g..g..g.'], legend: { ...G, w: '#f1ece2', y: '#e7b73c' } },
  snowdrop: { rows: ['.gg.', '.g.g', '.g.w', '.gwW', '.g.w', '.g..', 'lg..', '.gl.'], legend: { ...G, w: '#f4f2ec', W: '#bcd2b8' } },
  violet: { rows: ['v.V', 'vVv', '.y.', 'lgl', '.g.'], legend: { ...G, v: '#55468e', V: '#8a76c6', y: '#e7c44a' } },
  lungwort: { rows: ['.r.b.', 'rRbBb', '.gbg.', 'lGgGl', '.lGl.'], legend: { ...G, r: '#b85a82', R: '#dc86a6', b: '#56629e', B: '#8a96d2' } },
  dandelion: { rows: ['.yYy.', 'yYYYy', '.yYy.', '..g..', 'l.g.l', '.lgl.'], legend: { ...G, y: '#d89e22', Y: '#f2cf4a' } },
  dandelionClock: { rows: ['.w.w.', 'w.W.w', '.WWW.', 'w.W.w', '.w.w.', '..g..', '..g..', '.lg..'], legend: { ...G, w: '#d8d4c6', W: '#f8f6ee' } },
  garlic: { rows: ['.w.w.w.', 'wWw.wWw', '.w.g.w.', '..g.g..', 'lGlgGll', 'GlGlGlG'], legend: { ...G, w: '#e6e2d6', W: '#fbf8f0' } },
  morel: { rows: ['.cCc.', 'cCcCc', 'CcCcC', 'cCcCc', '.sss.', '.sSs.'], legend: { c: '#5e4430', C: '#8e6e4a', s: '#e3d8bc', S: '#b9ac8e' }, outline: true },
  // mushrooms
  toadstool: { rows: ['..rrrr..', '.rwrrwr.', 'rrrrrwrr', 'rwrrrrrR', '.RRRRRR.', '...ss...', '...sS...', '..sssS..'], legend: { r: '#b8392c', R: '#7c2620', w: '#f1e9d6', s: '#e3d8bc', S: '#b9ac8e' }, outline: true },
  toadstoolSmall: { rows: ['.rrr.', 'rwrrr', 'RRRRR', '..s..', '.sS..'], legend: { r: '#b8392c', R: '#7c2620', w: '#f1e9d6', s: '#e3d8bc', S: '#b9ac8e' }, outline: true },
  brownCaps: { rows: ['.....cc.', '.ccc.cCc', 'cCcCc.s.', '.sss..s.', '..s...s.', '..s..ss.'], legend: { c: '#8a5a38', C: '#b9875a', s: '#d8cdb0' }, outline: true },
  chanterelle: { rows: ['.oOo..', 'oOOOo.', '.oOo.o', '..o.oO', '..o..o'], legend: { o: '#c98622', O: '#eeb24a' }, outline: true },
  porcini: { rows: ['.cCCc.', 'cCCCCc', 'cccccc', '.ssSs.', '.sssS.', '.sSss.', '..sS..'], legend: { c: '#6a3c20', C: '#94592e', s: '#e3d6b4', S: '#c2b38e' }, outline: true },
  parasol: { rows: ['..cCc..', '.cwCwc.', 'cCcwcCc', '.ccccc.', '...s...', '...sS..', '..ss...', '...s...', '..sSs..'], legend: { c: '#7e5e40', C: '#a8865e', w: '#e2d6c2', s: '#e8dcc6', S: '#c0b29a' }, outline: true },
  puffballs: { rows: ['....wW', '.wW.wW', 'wWWwww', 'wwwW..', '.ww...'], legend: { w: '#ded6c2', W: '#fbf8f0' }, outline: true },
  // autumn
  autumnCrocus: { rows: ['.l.', 'lLl', 'lLl', 'lLl', '.l.', '.w.', '.w.', '.w.'], legend: { l: '#9a6cb4', L: '#cdaee0', w: '#e8e2dc' } },
  autumnCrocuses: { rows: ['.l...L.', 'lLl.lLl', 'lLl.lLl', 'lLl.lLl', '.l...l.', '.w.l.w.', '.wlLlw.', '.w.w.w.'], legend: { l: '#9a6cb4', L: '#cdaee0', w: '#e8e2dc' } },
  heather: { rows: ['.p.P.p.', 'pPp.pPp', '.gpPpg.', 'gGgpgGg', '.GgGgG.'], legend: { p: '#8e4a7c', P: '#c47aac', g: '#3a5230', G: '#58723c' } },
  cyclamen: { rows: ['.mM.', 'mMm.', '.m..', '.g..', 'gGg.', 'GgGg'], legend: { m: '#a83672', M: '#de6aa4', g: '#4a6a44', G: '#8aa480' } },
  chestnut: { rows: ['.g.g.g.', 'g.GgG.g', '.GbBbG.', 'gGbBbGg', '.gGgGg.'], legend: { g: '#7e7436', G: '#a89a52', b: '#4e2814', B: '#8a4a26' }, outline: true },
  chestnuts: { rows: ['.bB...', 'bBBb.B', 'bbbbBb'], legend: { b: '#4e2814', B: '#8e5028' }, outline: true },
  acorns: { rows: ['.c..c.', 'cCc.Cc', 'aAa.aA', '.a..a.'], legend: { c: '#5a4428', C: '#7a6038', a: '#9a7a3a', A: '#c09a4a' } },
  leafPile: { rows: ['...oO.r...', '.yoOrRoy..', 'oOyRroOyRo', 'RroOyrRoOy'], legend: { o: '#b8621e', O: '#e09040', r: '#8e341a', R: '#c44e26', y: '#d0a42c' } },
  rosehip: { rows: ['..b..', '.rb..', 'rRbr.', '.bbRr', '.b.r.', '.b...'], legend: { b: '#5a3a26', r: '#a82a22', R: '#e0503c' } },
  stalk: { rows: ['.s.', 'sSs', 'sSs', '.s.', '.t.', '.t.', 'tt.', '.t.'], legend: { s: '#7a5c3a', S: '#b08e62', t: '#8a7650' } },
  // winter
  christmasRose: { rows: ['.wWw.', 'wWyWw', '.wWw.', '.gGg.', 'gGgGg'], legend: { w: '#e8e4dc', W: '#ffffff', y: '#d8a42a', g: '#1c3424', G: '#2c5032' } },
  stalks: { rows: ['.s..s.', '.s.ss.', 's..s.s', 's.s..s', '.ss.s.', '..ss..'], legend: { s: '#9a865a' } },
  snowLump: { rows: ['..wWWw..', '.wWWWWw.', 'wwWWWWww'], legend: { w: '#b8c6d0', W: '#eef3f6' } },
  snowman: { rows: ['..k..', '.kkk.', '.wWw.', '.eoW.', '.wWw.', 'wWWWw', 'wWkWw', '.wWw.'], legend: { k: '#2a2420', w: '#c8d4dc', W: '#f6f8f8', e: '#1a1614', o: '#e0762a' }, outline: true },
  berries: { rows: ['.b.b..', 'rb.br.', '.bRb..', 'r.b.Rr', '..b...'], legend: { b: '#4a3424', r: '#a82a22', R: '#dc4a3a' } },
};

/** What grows where, by season: the meadow by the start, the wood along the path, the clearing, the hollow, and the fairy ring. */
type Sets = { meadow: string[]; wood: string[]; clearing: string[]; hollow: string[]; ring: string[] };
const GROWS: Record<Season, Sets & { patches: number; grass: number }> = {
  spring: {
    meadow: ['crocus', 'crocus', 'crocuses', 'crocuses', 'dandelion', 'dandelion', 'primrose', 'primrose', 'daisy', 'violet', 'dandelionClock'],
    wood: ['anemones', 'anemones', 'anemone', 'anemone', 'snowdrop', 'primrose', 'lungwort', 'lungwort', 'violet', 'garlic', 'garlic', 'morel', 'sprout'],
    clearing: ['daisy', 'daisy', 'dandelion', 'dandelion', 'primrose', 'crocus', 'violet', 'sprout'],
    hollow: ['morel', 'anemone', 'sprout', 'garlic', 'violet'],
    ring: ['anemone', 'anemones'],
    patches: 1,
    grass: 0.9,
  },
  summer: {
    meadow: ['daisy', 'daisies', 'buttercup', 'buttercup', 'bluebells', 'campion', 'clover', 'clover', 'redClover', 'redClover', 'yarrow', 'knapweed', 'stjohn'],
    wood: ['foxglove', 'strawberry', 'strawberry', 'bluebells', 'bluebells', 'campion', 'chanterelle', 'brownCaps', 'sprout', 'sprout', 'toadstoolSmall', 'daisy', 'clover'],
    clearing: ['daisy', 'daisies', 'buttercup', 'buttercup', 'clover', 'redClover', 'strawberry', 'sprout'],
    hollow: ['brownCaps', 'chanterelle', 'toadstool', 'bluebells', 'campion', 'sprout'],
    ring: ['toadstool', 'toadstoolSmall'],
    patches: 1,
    grass: 1,
  },
  autumn: {
    meadow: ['autumnCrocus', 'autumnCrocus', 'autumnCrocuses', 'autumnCrocuses', 'stalk', 'stalk', 'leafPile', 'puffballs'],
    wood: ['toadstool', 'toadstool', 'toadstoolSmall', 'toadstoolSmall', 'brownCaps', 'brownCaps', 'porcini', 'porcini', 'parasol', 'puffballs', 'chestnut', 'chestnut', 'chestnuts', 'acorns', 'leafPile', 'leafPile', 'leafPile', 'cyclamen', 'cyclamen', 'rosehip'],
    clearing: ['heather', 'heather', 'cyclamen', 'leafPile', 'leafPile', 'chestnut', 'puffballs', 'autumnCrocus', 'porcini'],
    hollow: ['toadstool', 'toadstool', 'brownCaps', 'brownCaps', 'porcini', 'leafPile', 'leafPile', 'parasol'],
    ring: ['toadstool', 'toadstoolSmall'],
    patches: 1.1,
    grass: 0.6,
  },
  winter: {
    meadow: ['stalks', 'stalks', 'stalk', 'snowLump', 'snowLump', 'snowLump', 'rosehip', 'berries'],
    wood: ['snowLump', 'snowLump', 'snowLump', 'stalks', 'stalks', 'christmasRose', 'christmasRose', 'berries', 'stalk'],
    clearing: ['christmasRose', 'snowLump', 'snowLump', 'stalks', 'berries'],
    hollow: ['snowLump', 'snowLump', 'stalks', 'christmasRose'],
    // a ring of tiny snowmen beside the frozen pond: somebody had a long afternoon
    ring: ['snowman'],
    patches: 0.55,
    grass: 0.22,
  },
};

/** Grass tufts in each stretch's colours (meadow, wood, deep wood, clearing, hollow), three of each. */
export const TUFT_ZONES = 5;
export const TUFT_KINDS = 3;
function tuftSprites(season: Season): Pix[] {
  // in winter the floor's ramps are snow: what pokes out of it is last year's straw
  const S = PAL.straw;
  // in autumn the wood's floor is leaves: what grass there is has gone olive and dry
  const dry: Ramp = [hex('#2e2e18'), hex('#3e3c1e'), hex('#524e26'), hex('#68622e'), hex('#807838'), hex('#9a9048')];
  const zones: Ramp[] =
    season === 'winter'
      ? [S, S.slice(0, 5), S.slice(0, 4), S, S.slice(0, 4)]
      : season === 'autumn'
        ? [PAL.edge.grass, dry, dry.slice(0, 5), PAL.clearing.grass, dry.slice(0, 5)]
        : [PAL.edge.grass, PAL.mid.grass, PAL.deep.grass, PAL.clearing.grass, PAL.hollow.grass];
  const out: Pix[] = [];
  zones.forEach((pal, z) => {
    for (let k = 0; k < TUFT_KINDS && season === 'winter'; k++) {
      // a few dry stalks poking out of the snow, thin, leaning, one with a seed head
      const h = 6 + k * 3;
      const p = new Pix(9, h + 1);
      const n = 2 + k;
      for (let b = 0; b < n; b++) {
        const x0 = 2 + b * 2 + (k % 2);
        const bh = h - ((b * 5 + k * 3) % 4);
        const lean = (b % 2 ? 1 : -1) * (0.15 + k * 0.08);
        for (let y = 0; y < bh; y++) p.set(Math.round(x0 + lean * y), h - y, pal[Math.min(pal.length - 1, 1 + (y > bh * 0.6 ? 1 : 0))]);
        if (b === n - 1) p.set(Math.round(x0 + lean * bh), h - bh, pal[0]);
      }
      out.push(p);
    }
    for (let k = 0; k < TUFT_KINDS && season !== 'winter'; k++) {
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

/**
 * The season's floor sprites in one list: its flowers and mushrooms, then the grass tufts. `sets` names indices
 * into the list for each part of the wood; `tufts` is where the grass starts; `patches` and `grass` scale how much.
 */
export function floraFor(season: Season) {
  const g = GROWS[season];
  const names = [...new Set([...g.meadow, ...g.wood, ...g.clearing, ...g.hollow, ...g.ring])];
  const sprites = names.map((n) => {
    const f = FLOWERS[n];
    const p = draw(f.rows, f.legend);
    // the mushrooms get their outline; thin-stemmed flowers stay as they are
    if (f.outline) p.outline(0.55, 0.85);
    return p;
  });
  const at = (list: string[]) => list.map((n) => names.indexOf(n));
  const sets = { meadow: at(g.meadow), wood: at(g.wood), clearing: at(g.clearing), hollow: at(g.hollow), ring: at(g.ring) };
  return { list: [...sprites, ...tuftSprites(season)], sets, tufts: sprites.length, patches: g.patches, grass: g.grass };
}
export type FloraSets = Record<keyof Sets, number[]>;
export type FloraInfo = { rects: { x: number; y: number; w: number; h: number }[]; sets: FloraSets; tufts: number; patches: number; grass: number };

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
  /** flutters in the air instead of walking (butterflies) */
  fly?: boolean;
};

const RABBIT = [
  ['..bb....', '..bB....', '..bb....', '.bbbb...', 'bebbbb..', 'bbbbbbb.', '.pbbbbbw', '..bBbBBw', '..bB.bB.'],
  ['...bb...', '...bB...', '..bbb...', '.bebbbb.', 'pbbbbbbb', '.bbbbbbw', '..bBBBBw', '.bB...bB', '........'],
  ['........', '...bb...', '..bbbB..', '.bebbbbb', 'pbbbbbbw', '.bbbbbbw', 'bB.BBBB.', '........', '........'],
];
const BIRD = [
  ['..bb..', '.bbeby', 'Bbbrr.', '.Bbbr.', '..b.b.'],
  ['......', '..bb..', '.bbeby', 'BBbrr.', '..b.b.'],
  ['......', '......', '.bbb..', 'BbbreY', '..b.b.'],
];

export const CRITTERS: Critter[] = [
  {
    name: 'rabbit',
    legend: { b: '#7d6650', B: '#5c4a3a', l: '#a89176', w: '#e9e1d0', e: '#1a1612', p: '#c98d84' },
    frames: RABBIT,
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
  { name: 'robin', legend: { b: '#6b5a48', B: '#4a3d31', r: '#c2583a', e: '#14110e', y: '#d9a92a', Y: '#d9a92a' }, frames: BIRD, idle: [0, 0, 0, 2, 0, 2], move: [1, 0], speed: 1.2, hop: 0.06 },
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
  {
    name: 'fox',
    legend: { o: '#b8582a', O: '#de8a44', w: '#efe6d6', k: '#2a1c14', e: '#14110e' },
    frames: [
      ['...........o.o', '...........ooo', '..........ooeo', '..........oOOk', 'w..ooooooooww.', 'wOooooooooow..', '.wO.oooooo....', '....k.k..k.k..'],
      ['...........o.o', '...........ooo', '..........ooeo', '..........oOOk', 'w..ooooooooww.', 'wOooooooooow..', '.wO.oooooo....', '...k...kk...k.'],
      ['...........o.o', '...........ooo', '..........ooeo', '..........oOOk', 'w..ooooooooww.', 'wOooooooooow..', '.wO.oooooo....', '.....kk..k.k..'],
    ],
    idle: [0],
    move: [1, 2],
    speed: 2.4,
  },
  {
    name: 'deer',
    legend: { b: '#8e6440', B: '#b0845a', d: '#5e4028', w: '#e8dcc8', k: '#1c1410', e: '#14110e' },
    frames: [
      ['........b.b.', '........bbb.', '........bebk', '........bbbk', '.......bb...', '......bb....', 'wbbbbbbbb...', 'wbBBBBBbb...', '.bbbbbbbb...', '.b.d...b.d..', '.b.d...b.d..', '.b.d...b.d..', '.k.k...k.k..'],
      ['........b.b.', '........bbb.', '........bebk', '........bbbk', '.......bb...', '......bb....', 'wbbbbbbbb...', 'wbBBBBBbb...', '.bbbbbbbb...', '..bd...bd...', '.b..d.b..d..', '.b..d.b..d..', 'k...k.k...k.'],
    ],
    idle: [0],
    move: [1, 0],
    speed: 2.6,
  },
  {
    name: 'hare',
    // a mountain hare in its winter white, the tips of its ears still black
    legend: { b: '#e4e8ea', B: '#b8bec4', l: '#f6f8f8', w: '#ffffff', e: '#14110e', p: '#c9a0a0', k: '#1c1a1a' },
    frames: RABBIT.map((f) => f.map((row, y) => (y === 0 ? row.replace(/b/g, 'k') : row))),
    idle: [0],
    move: [1, 2],
    speed: 1.9,
    hop: 0.1,
  },
  { name: 'jay', legend: { b: '#b08a74', B: '#2a2420', r: '#4a78b8', e: '#14110e', y: '#2a2420', Y: '#2a2420' }, frames: BIRD, idle: [0, 0, 2, 0, 2], move: [1, 0], speed: 1.3, hop: 0.07 },
  { name: 'bullfinch', legend: { b: '#6e7078', B: '#1c1a1c', r: '#d0584a', e: '#0c0a0a', y: '#2a2420', Y: '#2a2420' }, frames: BIRD, idle: [0, 0, 0, 2, 0], move: [1, 0], speed: 1.1, hop: 0.06 },
  {
    name: 'butterfly',
    legend: { o: '#d8902a', O: '#f6cc68', k: '#2a2018' },
    frames: [
      ['o.k.o', 'oOkOo', '.oko.', '.o.o.'],
      ['..k..', '.oko.', '.OkO.', '..k..'],
    ],
    idle: [0, 1],
    move: [0, 1],
    speed: 1.1,
    fly: true,
  },
];

/** Which animal lives in each of the walk's homes this season: rabbits go white, hedgehogs and frogs sleep. */
export const FAUNA: Record<Season, Record<'small' | 'spiky' | 'climber' | 'bird' | 'water' | 'wing', string>> = {
  spring: { small: 'rabbit', spiky: 'hedgehog', climber: 'squirrel', bird: 'robin', water: 'frog', wing: 'butterfly' },
  summer: { small: 'rabbit', spiky: 'hedgehog', climber: 'squirrel', bird: 'robin', water: 'frog', wing: 'butterfly' },
  autumn: { small: 'rabbit', spiky: 'hedgehog', climber: 'squirrel', bird: 'jay', water: 'fox', wing: 'deer' },
  winter: { small: 'hare', spiky: 'fox', climber: 'squirrel', bird: 'bullfinch', water: 'hare', wing: 'deer' },
};

/** Butterflies' colours by season: brimstones in spring, small tortoiseshells in summer. */
const WINGS: Partial<Record<Season, Legend>> = { spring: { o: '#cdbc32', O: '#ece27a', k: '#2a2018' } };

export function critterSprites(season: Season) {
  const list: Pix[] = [];
  const index: number[][] = [];
  for (const c of CRITTERS) {
    const legend = c.name === 'butterfly' ? (WINGS[season] ?? c.legend) : c.legend;
    index.push(c.frames.map((f) => {
      const p = draw(f, legend);
      p.outline(0.55, 0.85);
      list.push(p);
      return list.length - 1;
    }));
  }
  return { list, index };
}

export const critterKind = (name: string) => CRITTERS.findIndex((c) => c.name === name);

/** One of the floor's flowers or mushrooms on its own (the page's pictures use them too). */
export function flowerPix(name: string): Pix {
  const f = FLOWERS[name];
  const p = draw(f.rows, f.legend);
  if (f.outline) p.outline(0.55, 0.85);
  return p;
}

/** One animal's frame on its own, facing right. */
export function critterPix(name: string, frame = 0, season: Season = 'summer'): Pix {
  const c = CRITTERS[critterKind(name)];
  const legend = c.name === 'butterfly' ? (WINGS[season] ?? c.legend) : c.legend;
  const p = draw(c.frames[frame % c.frames.length], legend);
  p.outline(0.55, 0.85);
  return p;
}
