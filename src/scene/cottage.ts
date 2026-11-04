/**
 * Mira's cottage on the far shore of the lake (pill mode only): a timber-framed cottage on a stone plinth,
 * a shingled roof gone mossy, a stone chimney, a plank door with a round window, the shop window with its
 * shutters thrown open and a striped awning, a sign hung out on a bracket, and her stall in front with the three
 * cases on a gingham cloth. Every surface painted in code at the wood's pixel size and lit like everything else.
 */
import * as THREE from 'three';
import { CASES, CASE_KINDS, type CaseKind } from './loot';
import { pixelText } from './art/gear';
import { hash2, hex, mix, mulberry, noise1, Pix, ramp, shade, type Ramp } from './pix';

/** Where it stands: its middle, the front (towards the lake, -z), and the stall and Mira in front of it. */
export const COTTAGE = { x: 5, z: 28.6, w: 2.5, d: 1.9 };
const X0 = COTTAGE.x - COTTAGE.w / 2;
const X1 = COTTAGE.x + COTTAGE.w / 2;
const Z0 = COTTAGE.z - COTTAGE.d / 2;
const Z1 = COTTAGE.z + COTTAGE.d / 2;
const PLINTH = 0.1;
const WALL = 1.05;
const TOP = PLINTH + WALL;
const RIDGE = TOP + 0.8;
const SHOP_X = COTTAGE.x - 0.32;
const DOOR_X = COTTAGE.x + 0.72;
const SHOP_Y0 = 0.44;
const SHOP_Y1 = 0.94;
/** The cases on the shelves behind the shop glass, left to right, bottom shelf first. */
export const SHELF_KINDS: CaseKind[] = ['hollow', 'meadow', 'deepwood', 'meadow', 'deepwood', 'hollow', 'meadow', 'hollow'];
/** The bar the sign hangs from: it swings about this line (along x). */
export const SIGN_PIVOT: [number, number, number] = [X1 + 0.24, 1.0, Z0];
export const STALL = { x: SHOP_X, z: Z0 - 0.62, w: 1.04, d: 0.42, h: 0.36 };
export const MIRA = { x: SHOP_X, z: Z0 - 0.24 };
/** What you bump into, as boxes on the ground. */
export const COTTAGE_BOXES: { x0: number; x1: number; z0: number; z1: number; h: number; off?: boolean }[] = [
  { x0: X0 - 0.06, x1: X1 + 0.06, z0: Z0 - 0.05, z1: Z1 + 0.06, h: 2.3 },
  { x0: STALL.x - STALL.w / 2 - 0.02, x1: STALL.x + STALL.w / 2 + 0.02, z0: STALL.z - STALL.d / 2 - 0.02, z1: STALL.z + STALL.d / 2 + 0.02, h: 0.48 },
  { x0: X1 + 0.08, x1: X1 + 0.48, z0: Z0 + 0.15, z1: Z0 + 0.62, h: 0.52 },
];
export const COTTAGE_POSTS: { x: number; z: number; r: number }[] = [
  { x: X0 - 0.35, z: Z0 - 0.55, r: 0.07 },
  { x: X1 + 0.32, z: Z0 - 0.25, r: 0.17 },
];
/** The ground the cottage keeps clear (no grass through the floor). */
export const inCottage = (x: number, z: number) => x > X0 - 0.5 && x < X1 + 0.7 && z > Z0 - 1.1 && z < Z1 + 0.3;

const TX = 0.0125;

// --- the paint ---------------------------------------------------------------------------------------------
// mid-toned, so it reads as cream (not burnt white) in full sun
const PLASTER = ramp('#5c5240', '#746850', '#887a60', '#958670', '#a09078', '#aa9c84');
const TIMBER = ramp('#22150c', '#352214', '#4a311c', '#5f4026', '#755032');
const STONE = ramp('#3a3834', '#55524a', '#6e6a60', '#878276', '#a29c8e');
const SHINGLE = ramp('#3a1c14', '#58281a', '#763620', '#92472a', '#ab5c36', '#c47648');
const MOSS = ramp('#2a3a1a', '#3e5424', '#56702e', '#6e8a3a');
const PLANK = ramp('#3a2414', '#54361e', '#6e4a2a', '#875e36', '#a07444');
const IRON = ramp('#141414', '#24221f', '#3a3631', '#55504a');
const GREEN = ramp('#1e3a26', '#2c5434', '#3e7046', '#558c5a');

const repeat = (p: Pix) => {
  const t = new THREE.DataTexture(new Uint8Array(p.data.buffer), p.w, p.h, THREE.RGBAFormat, THREE.UnsignedByteType);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestMipmapNearestFilter;
  t.generateMipmaps = true;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.flipY = false;
  t.colorSpace = THREE.NoColorSpace;
  t.needsUpdate = true;
  return t;
};

/** Plaster between dark oak beams; `holes` are where a door or window goes (posts either side of them). */
function wallPix(w: number, h: number, seed: number, holes: [number, number][], gable = 0) {
  const H = h + gable;
  const p = new Pix(w, H);
  const rnd = mulberry(seed);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < w; x++) {
      let t = 0.78 + (hash2(x >> 1, y >> 1, seed) - 0.5) * 0.12 + (hash2(x, y, seed + 1) - 0.5) * 0.06;
      // splashed and greyer at the foot
      if (y > H - 12 && hash2(x, y, seed + 2) < (y - (H - 12)) / 14) t -= 0.25;
      p.set(x, y, shade(PLASTER, t));
    }
  // a few hairline cracks
  for (let i = 0; i < 4; i++) {
    let x = rnd() * w;
    let y = gable + rnd() * h * 0.7;
    for (let k = 0; k < 10; k++) {
      p.set(Math.round(x), Math.round(y), shade(PLASTER, 0.35));
      x += rnd() - 0.5;
      y += 0.8;
    }
  }
  const beam = (x0: number, y0: number, bw: number, bh: number, upright: boolean) => {
    for (let y = Math.max(0, Math.round(y0)); y < Math.min(H, Math.round(y0 + bh)); y++)
      for (let x = Math.max(0, Math.round(x0)); x < Math.min(w, Math.round(x0 + bw)); x++) {
        const along = upright ? y : x;
        const across = upright ? x - x0 : y - y0;
        let t = 0.55 + (noise1(along * 0.15 + across * 3.1, seed + 9) - 0.5) * 0.4 + (hash2(x, y, seed + 5) - 0.5) * 0.1;
        if (across < 1) t += 0.25;
        else if (across >= (upright ? bw : bh) - 1) t -= 0.3;
        p.set(x, y, shade(TIMBER, t));
      }
  };
  const brace = (xa: number, ya: number, xb: number, yb: number) => {
    const n = Math.ceil(Math.hypot(xb - xa, yb - ya));
    for (let i = 0; i <= n; i++) {
      const x = xa + ((xb - xa) * i) / n;
      const y = ya + ((yb - ya) * i) / n;
      for (let k = -2; k <= 2; k++) p.set(Math.round(x + k), Math.round(y), shade(TIMBER, k === -2 ? 0.8 : k === 2 ? 0.2 : 0.5 + (hash2(i, k, seed) - 0.5) * 0.2));
    }
  };
  const g = gable;
  beam(0, g, w, 6, false);
  beam(0, H - 7, w, 7, false);
  beam(0, g, 6, h, true);
  beam(w - 6, g, 6, h, true);
  const mid = g + Math.round(h * 0.46);
  const inHole = (x: number) => holes.some(([a, b]) => x > a - 6 && x < b + 6);
  for (let x = 6; x < w - 6; x++) if (!inHole(x)) beam(x, mid, 1, 5, false);
  for (const [a, b] of holes) {
    beam(a - 6, g, 6, h, true);
    beam(b, g, 6, h, true);
  }
  if (!inHole(20)) brace(7, H - 8, 30, mid + 4);
  if (!inHole(w - 20)) brace(w - 8, H - 8, w - 31, mid + 4);
  if (gable) {
    // the gable: a king post up the middle and the rafters along its slopes
    beam(w / 2 - 3, 0, 6, g, true);
    for (let y = 0; y < g; y++) {
      const off = (y / g) * (w / 2);
      for (let k = 0; k < 6; k++) {
        p.set(Math.round(w / 2 - off - k), y, shade(TIMBER, 0.45 + k * 0.05));
        p.set(Math.round(w / 2 + off + k - 1), y, shade(TIMBER, 0.45 + k * 0.05));
      }
    }
  }
  return p;
}

function stonePix() {
  const p = new Pix(32, 24, true);
  for (let y = 0; y < 24; y++)
    for (let x = 0; x < 32; x++) {
      const row = Math.floor(y / 8);
      const off = row % 2 ? 8 : 0;
      const sx = (x + off) % 16;
      const sy = y % 8;
      const stone = Math.floor((x + off) / 16) + row * 7;
      let t = 0.5 + (hash2(stone, row, 61) - 0.5) * 0.4 + (hash2(x, y, 62) - 0.5) * 0.12;
      if (sy === 0 || sx === 0) t = 0.08;
      else if (sy === 1 || sx === 1) t += 0.2;
      else if (sy === 7 || sx === 15) t -= 0.15;
      p.set(x, y, shade(STONE, t));
      if (sy > 4 && hash2(x, y, 63) < 0.12) p.set(x, y, shade(MOSS, 0.5));
    }
  return p;
}

function shinglePix() {
  const p = new Pix(32, 24, true);
  for (let y = 0; y < 24; y++)
    for (let x = 0; x < 32; x++) {
      const row = Math.floor(y / 6);
      const off = row % 2 ? 4 : 0;
      const sx = (x + off) % 8;
      const sy = y % 6;
      const tile = Math.floor((x + off) / 8) + row * 5;
      let t = 0.55 + (hash2(tile, row, 71) - 0.5) * 0.35 - sy * 0.04;
      if (sy === 5) t = 0.06;
      if (sx === 0) t -= 0.3;
      if (sy === 4 && (sx === 1 || sx === 7)) t = 0.1;
      let c = shade(SHINGLE, t);
      // moss creeping over the tiles
      if (noise1(x * 0.2 + y * 0.31, 72) + hash2(x, y, 73) * 0.3 > 0.92) c = shade(MOSS, 0.4 + hash2(x, y, 74) * 0.5);
      p.set(x, y, c);
    }
  return p;
}

function plankPix(dark = 0) {
  const p = new Pix(16, 32, true);
  for (let y = 0; y < 32; y++)
    for (let x = 0; x < 16; x++) {
      let t = 0.5 - dark + (noise1(y * 0.2 + x * 7.3, 81) - 0.5) * 0.35 + (hash2(x, y, 82) - 0.5) * 0.08;
      if (x % 8 === 0) t = 0.08;
      else if (x % 8 === 1) t += 0.15;
      p.set(x, y, shade(PLANK, t));
    }
  return p;
}

function doorPix() {
  const w = 36;
  const h = 68;
  const p = new Pix(w, h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let t = 0.5 + (noise1(y * 0.18 + Math.floor(x / 6) * 9.1, 91) - 0.5) * 0.3 + (hash2(x, y, 92) - 0.5) * 0.08;
      if (x % 6 === 0) t = 0.1;
      p.set(x, y, shade(GREEN, t));
    }
  // ledges and a brace, iron hinges, a round window, the latch
  for (const y of [10, 56]) for (let x = 0; x < w; x++) for (let k = 0; k < 4; k++) p.set(x, y + k, shade(GREEN, k === 0 ? 0.8 : k === 3 ? 0.15 : 0.5));
  for (let i = 0; i < 40; i++) for (let k = 0; k < 3; k++) p.set(4 + Math.round((i / 40) * 26) + k, 52 - i, shade(GREEN, 0.4 + k * 0.15));
  for (const y of [11, 57]) for (let x = 0; x < 14; x++) p.set(x, y + 1, shade(IRON, x === 13 ? 0.9 : 0.5));
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const d = Math.hypot(x - w / 2 + 0.5, y - 24);
      if (d < 6) p.set(x, y, d > 4.6 ? shade(IRON, 0.5) : (x + y) % 5 === 0 && d < 3 ? hex('#a8c8b8') : hex('#2a3a34'));
    }
  p.rect(28, 34, 3, 5, shade(IRON, 0.3));
  p.set(29, 35, shade(IRON, 1));
  return p;
}

/** The shop window from outside: shelves inside with cases on them, curtains drawn back, a little lamp. */
function shopPix() {
  const w = 80;
  const h = 40;
  const p = new Pix(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) p.set(x, y, mix(hex('#1c1812'), hex('#3a2a1c'), (hash2(x, y, 101) * 0.3 + y / h) * 0.5));
  // shelves
  for (const sy of [14, 28]) for (let x = 0; x < w; x++) p.set(x, sy, shade(PLANK, 0.7)), p.set(x, sy + 1, shade(PLANK, 0.3));
  // cases on them, in their colours
  const rnd = mulberry(103);
  for (const sy of [14, 28])
    for (let x = 4; x < w - 10; x += 9 + Math.floor(rnd() * 4)) {
      const c = CASES[CASE_KINDS[Math.floor(rnd() * 3)]];
      const bw = 6;
      const bh = 5 + Math.floor(rnd() * 2);
      for (let y = sy - bh; y < sy; y++) for (let i = 0; i < bw; i++) p.set(x + i, y, y === sy - bh ? mix(hex(c.color), 0xffffffff, 0.3) : i === 0 ? hex(c.dark) : hex(c.color));
      p.set(x + 2, sy - bh + 2, hex('#e8c873'));
    }
  // a lamp, and curtains drawn to the sides
  for (let y = 2; y < 8; y++) for (let x = 36; x < 42; x++) p.set(x, y, hex(y < 4 ? '#f6dc8a' : '#e8b850'));
  for (let y = 0; y < h; y++)
    for (let x = 0; x < 10 - Math.round((y / h) * 4); x++) {
      p.set(x, y, shade(ramp('#6a2a24', '#8a3a30', '#a84e3e', '#c46a54'), 0.45 + Math.sin(x * 1.3) * 0.25));
      p.set(w - 1 - x, y, shade(ramp('#6a2a24', '#8a3a30', '#a84e3e', '#c46a54'), 0.45 + Math.sin(x * 1.3) * 0.25));
    }
  // the glass: a cool sheen, two streaks of light
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if ((x + y) % 23 === 0 || (x + y) % 23 === 1) p.set(x, y, mix(p.get(x, y), hex('#cfe0dc'), 0.35));
    }
  return p;
}

/** Clears a rectangle out of a painting (a window you see through). */
function cutHole(p: Pix, x0: number, y0: number, x1: number, y1: number) {
  for (let y = Math.max(0, y0); y < Math.min(p.h, y1); y++) for (let x = Math.max(0, x0); x < Math.min(p.w, x1); x++) p.data[y * p.w + x] = 0;
  return p;
}

/** Shop glass, the pixel-art way: mostly clear, a sparse sheen of pale pixels, two bright streaks across it. */
function glassPix() {
  const w = 80;
  const h = 40;
  const p = new Pix(w, h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const streak = (x + y) % 23;
      if (streak === 0 || streak === 1) p.set(x, y, hex(streak ? '#e4f0ec' : '#cfe0dc'));
      else if ((x + y * 3) % 7 === 0 && (x + y) % 2 === 0) p.set(x, y, hex('#a8c4c0'));
    }
  return p;
}

function sidePanePix() {
  const w = 40;
  const h = 32;
  const p = new Pix(w, h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let c = mix(hex('#1e2a28'), hex('#3a4a44'), y / h);
      if ((x + y) % 17 < 2) c = mix(c, hex('#cfe0dc'), 0.3);
      // lace curtains in the lower half
      if (y > h * 0.45 && (x + y) % 3 !== 0) c = mix(c, hex('#ece4d0'), y > h * 0.5 ? 0.8 : 0.4);
      p.set(x, y, c);
    }
  return p;
}

/** Shutters: green planks with a heart cut through. */
function shutterPix() {
  const w = 20;
  const h = 40;
  const p = new Pix(w, h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let t = 0.55 + (noise1(y * 0.2 + Math.floor(x / 5) * 5.1, 111) - 0.5) * 0.3;
      if (x % 5 === 0) t = 0.12;
      if (y === 6 || y === h - 7) t = 0.85;
      p.set(x, y, shade(GREEN, t));
    }
  const heart = ['.#.#.', '#####', '#####', '.###.', '..#..'];
  heart.forEach((row, j) => [...row].forEach((ch, i) => ch === '#' && p.set(8 + i, 14 + j, hex('#14100c'))));
  return p;
}

/** The awning: green and cream stripes, and a scalloped edge hanging off its front. */
function awningPix(valance: boolean) {
  const w = 48;
  const h = valance ? 8 : 24;
  const p = new Pix(w, h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const stripe = Math.floor(x / 6) % 2 === 0;
      let c = stripe ? hex('#3e7046') : hex('#efe4c8');
      if (hash2(x, y, 121) < 0.06) c = mix(c, 0xff000000, 0.12);
      if (valance) {
        const sx = (x % 6) - 2.5;
        if (y > 4 && Math.hypot(sx, (y - 4) * 1.4) > 3.2) continue;
        if (y === 0) c = mix(c, 0xff000000, 0.2);
      } else if (y > h - 2) c = mix(c, 0xff000000, 0.25);
      p.set(x, y, c);
    }
  return p;
}

function clothPix() {
  const p = new Pix(16, 16, true);
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) {
      const a = Math.floor(x / 4) % 2 === 0;
      const b = Math.floor(y / 4) % 2 === 0;
      p.set(x, y, a && b ? hex('#a8443a') : a || b ? hex('#d88a7c') : hex('#f2e6d2'));
    }
  return p;
}

/** One of the three cases on the stall: its colour, a lighter lid, brass corners and latch, the handle on top. */
function cratePix(kind: CaseKind) {
  const c = CASES[kind];
  const body: Ramp = ramp(c.dark, c.color);
  const p = new Pix(24, 16);
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 24; x++) {
      let col = y < 5 ? mix(hex(c.color), 0xffffffff, 0.22) : shade(body, 0.6 + (hash2(x, y, 131) - 0.5) * 0.4);
      if (y === 5) col = hex(c.dark);
      if ((x < 3 || x > 20) && (y < 3 || y > 12)) col = hex('#c9a04a');
      if (x >= 10 && x < 14 && y >= 4 && y < 9) col = hex(y === 4 ? '#e8c873' : '#c9a04a');
      p.set(x, y, col);
    }
  return p;
}

/** The sign: CASES carved and painted, a case under it. */
function signPix() {
  const w = 52;
  const h = 26;
  const p = new Pix(w, h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let t = 0.6 + (noise1(x * 0.2 + y * 3.1, 141) - 0.5) * 0.3;
      if (x < 2 || y < 2 || x > w - 3 || y > h - 3) t = 0.2;
      p.set(x, y, shade(PLANK, t));
    }
  const text = pixelText('CASES', hex('#f2c24a'), hex('#fff1b8'));
  p.blit(text, Math.round((w - text.w) / 2), 3);
  const kinds: CaseKind[] = ['meadow', 'deepwood', 'hollow'];
  kinds.forEach((k, i) => {
    const c = CASES[k];
    for (let y = 15; y < 22; y++) for (let x = 0; x < 9; x++) p.set(9 + i * 13 + x, y, y === 15 ? mix(hex(c.color), 0xffffffff, 0.3) : hex(c.color));
  });
  return p;
}

function barrelPix() {
  const p = new Pix(32, 24, true);
  for (let y = 0; y < 24; y++)
    for (let x = 0; x < 32; x++) {
      let t = 0.5 + (noise1(y * 0.25 + Math.floor(x / 4) * 3.3, 151) - 0.5) * 0.3;
      if (x % 4 === 0) t = 0.15;
      let c = shade(PLANK, t);
      if (y === 4 || y === 5 || y === 18 || y === 19) c = shade(IRON, y % 2 ? 0.3 : 0.7);
      p.set(x, y, c);
    }
  return p;
}

function flowerBoxPix() {
  const p = new Pix(24, 12, true);
  const cols = ['#c8402e', '#e05a40', '#f2c24a', '#efe4c8', '#d87aa0'];
  for (let y = 0; y < 12; y++)
    for (let x = 0; x < 24; x++) {
      let c = shade(GREEN, 0.3 + hash2(x, y, 161) * 0.5);
      if (hash2(x >> 1, y >> 1, 162) > 0.62) c = hex(cols[Math.floor(hash2(x >> 1, y >> 1, 163) * cols.length)]);
      p.set(x, y, c);
    }
  return p;
}

// --- the building ------------------------------------------------------------------------------------------
type V3 = [number, number, number];
type Surface = { tex: THREE.Texture; pos: number[]; nor: number[]; uv: number[] };

/** Faces grouped by what they're painted with; each group becomes one solid mesh. */
class Mesher {
  surfaces = new Map<string, Surface>();
  constructor(private textures: Record<string, THREE.Texture>) {}
  /** A flat convex face: corners in order, with their uvs. */
  face(key: string, pts: V3[], uvs: [number, number][]) {
    let s = this.surfaces.get(key);
    if (!s) this.surfaces.set(key, (s = { tex: this.textures[key], pos: [], nor: [], uv: [] }));
    const a = new THREE.Vector3(...pts[0]);
    const n = new THREE.Vector3().subVectors(new THREE.Vector3(...pts[1]), a).cross(new THREE.Vector3().subVectors(new THREE.Vector3(...pts[2]), a)).normalize();
    for (let i = 1; i < pts.length - 1; i++)
      for (const k of [0, i, i + 1]) {
        s.pos.push(...pts[k]);
        s.nor.push(n.x, n.y, n.z);
        s.uv.push(...uvs[k]);
      }
  }
  /** A face whose uvs come from its corners' places: along `u` and down `v`, `su`/`sv` world units to a repeat. */
  planar(key: string, pts: V3[], o: V3, u: V3, v: V3, su: number, sv: number) {
    const dot = (p: V3, d: V3) => (p[0] - o[0]) * d[0] + (p[1] - o[1]) * d[1] + (p[2] - o[2]) * d[2];
    this.face(key, pts, pts.map((p) => [dot(p, u) / su, dot(p, v) / sv] as [number, number]));
  }
  /** A box, every side tiled with one texture at `s` world units to a repeat (or different keys for top/sides). */
  box(key: string, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, s: number, top = key) {
    const R: V3 = [1, 0, 0];
    const L: V3 = [-1, 0, 0];
    const F: V3 = [0, 0, 1];
    const B: V3 = [0, 0, -1];
    const D: V3 = [0, -1, 0];
    // front (-z), back (+z), left (-x), right (+x): counter-clockwise from outside
    this.planar(key, [[x0, y1, z0], [x1, y1, z0], [x1, y0, z0], [x0, y0, z0]], [x0, y1, z0], R, D, s, s);
    this.planar(key, [[x1, y1, z1], [x0, y1, z1], [x0, y0, z1], [x1, y0, z1]], [x1, y1, z1], L, D, s, s);
    this.planar(key, [[x0, y1, z1], [x0, y1, z0], [x0, y0, z0], [x0, y0, z1]], [x0, y1, z1], B, D, s, s);
    this.planar(key, [[x1, y1, z0], [x1, y1, z1], [x1, y0, z1], [x1, y0, z0]], [x1, y1, z0], F, D, s, s);
    this.planar(top, [[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]], [x0, y1, z1], R, B, s, s);
    this.planar(key, [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], [x0, y0, z0], R, F, s, s);
  }
  geometries() {
    return [...this.surfaces.entries()].map(([key, s]) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(s.pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(s.nor, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(s.uv, 2));
      return { key, geo: g, tex: s.tex };
    });
  }
}

/** The whole cottage, in world space, as solid pieces: one geometry per paint. */
export function buildCottage() {
  const fit = (p: Pix) => {
    const t = repeat(p);
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    t.generateMipmaps = false;
    t.minFilter = THREE.NearestFilter;
    return t;
  };
  const fw = Math.round((X1 - X0) / TX);
  const sd = Math.round((Z1 - Z0) / TX);
  const wh = Math.round(WALL / TX);
  const gh = Math.round((RIDGE - TOP) / TX);
  const u = (x: number) => Math.round((X1 - x) / TX);
  const textures: Record<string, THREE.Texture> = {
    // the shop window is a hole in the wall: you see into the display behind its glass
    front: fit(cutHole(wallPix(fw, wh, 201, [[u(DOOR_X + 0.22), u(DOOR_X - 0.22)], [u(SHOP_X + 0.5), u(SHOP_X - 0.5)]]), u(SHOP_X + 0.5), Math.round((TOP - SHOP_Y1) / TX), u(SHOP_X - 0.5), Math.round((TOP - SHOP_Y0) / TX))),
    back: fit(wallPix(fw, wh, 202, [[Math.round(fw / 2 - 20), Math.round(fw / 2 + 20)]])),
    left: fit(wallPix(sd, wh, 203, [[Math.round(sd / 2 - 20), Math.round(sd / 2 + 20)]], gh)),
    right: fit(wallPix(sd, wh, 204, [[Math.round(sd / 2 - 20), Math.round(sd / 2 + 20)]], gh)),
    stone: repeat(stonePix()),
    shingle: repeat(shinglePix()),
    plank: repeat(plankPix()),
    dark: repeat(plankPix(0.25)),
    door: fit(doorPix()),
    niche: repeat(plankPix(0.3)),
    glass: fit(glassPix()),
    signwood: repeat(plankPix(0.25)),
    pane: fit(sidePanePix()),
    shutter: fit(shutterPix()),
    awning: fit(awningPix(false)),
    valance: fit(awningPix(true)),
    cloth: repeat(clothPix()),
    sign: fit(signPix()),
    iron: repeat((() => {
      const p = new Pix(4, 4, true);
      for (let i = 0; i < 16; i++) p.set(i % 4, i >> 2, shade(IRON, 0.3 + hash2(i, 0, 171) * 0.4));
      return p;
    })()),
    barrel: repeat(barrelPix()),
    flowers: repeat(flowerBoxPix()),
    lamp: fit((() => {
      const p = new Pix(8, 8);
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) p.set(x, y, x === 0 || x === 7 || y === 0 || y === 7 ? shade(IRON, 0.4) : hex(y < 4 ? '#ffe9a8' : '#f2c25a'));
      return p;
    })()),
    meadow: fit(cratePix('meadow')),
    deepwood: fit(cratePix('deepwood')),
    hollow: fit(cratePix('hollow')),
  };
  // the boxes stacked by the door, each its own (they can be shot to bits)
  textures.crateBig = textures.plank;
  textures.crateTop = textures.dark;
  const m = new Mesher(textures);
  const R: V3 = [1, 0, 0];
  const L: V3 = [-1, 0, 0];
  const D: V3 = [0, -1, 0];
  const F: V3 = [0, 0, 1];
  const B: V3 = [0, 0, -1];
  // the plinth and the walls (each wall painted to fit; the sides run up into the gables)
  m.box('stone', X0 - 0.05, X1 + 0.05, 0, PLINTH, Z0 - 0.05, Z1 + 0.05, 0.4);
  const fitFace = (key: string, pts: V3[], o: V3, uu: V3, vv: V3, w: number, h: number) => m.planar(key, pts, o, uu, vv, w, h);
  fitFace('front', [[X1, TOP, Z0], [X0, TOP, Z0], [X0, PLINTH, Z0], [X1, PLINTH, Z0]], [X1, TOP, Z0], L, D, X1 - X0, WALL);
  fitFace('back', [[X0, TOP, Z1], [X1, TOP, Z1], [X1, PLINTH, Z1], [X0, PLINTH, Z1]], [X0, TOP, Z1], R, D, X1 - X0, WALL);
  const gable = RIDGE - TOP;
  fitFace('left', [[X0, TOP, Z0], [X0, RIDGE, COTTAGE.z], [X0, TOP, Z1], [X0, PLINTH, Z1], [X0, PLINTH, Z0]], [X0, RIDGE, Z0], B, D, Z0 - Z1, WALL + gable);
  fitFace('right', [[X1, TOP, Z1], [X1, RIDGE, COTTAGE.z], [X1, TOP, Z0], [X1, PLINTH, Z0], [X1, PLINTH, Z1]], [X1, RIDGE, Z1], F, D, Z0 - Z1, WALL + gable);
  // fix the sides' uv direction (they ran backwards): u across from the front corner
  // the roof: two slabs from the ridge down past the walls, shingled on top, planked under, with fascia boards
  const ox = 0.2;
  const oz = 0.26;
  const eave = TOP - (gable * oz) / (COTTAGE.d / 2);
  const th = 0.06;
  for (const side of [-1, 1]) {
    const zr = COTTAGE.z;
    const ze = side < 0 ? Z0 - oz : Z1 + oz;
    const a: V3 = [X0 - ox, RIDGE + 0.02, zr];
    const b: V3 = [X1 + ox, RIDGE + 0.02, zr];
    const c: V3 = [X1 + ox, eave, ze];
    const d: V3 = [X0 - ox, eave, ze];
    const slope = Math.hypot(ze - zr, RIDGE - eave);
    const dv: V3 = [0, (eave - RIDGE) / slope, (ze - zr) / slope];
    const top = side < 0 ? [a, b, c, d] : [b, a, d, c];
    m.planar('shingle', top as V3[], a, side < 0 ? R : L, dv, 0.4, 0.3);
    const lo = (p: V3): V3 => [p[0], p[1] - th, p[2]];
    const under = side < 0 ? [lo(d), lo(c), lo(b), lo(a)] : [lo(c), lo(d), lo(a), lo(b)];
    m.planar('dark', under as V3[], a, R, dv, 0.2, 0.4);
    // the fascia along the eave, and the two ends of the slab
    const fas = side < 0 ? [d, c, lo(c), lo(d)] : [c, d, lo(d), lo(c)];
    m.planar('plank', fas as V3[], d, side < 0 ? R : L, D, 0.2, 0.4);
    const endL = side < 0 ? [a, d, lo(d), lo(a)] : [d, a, lo(a), lo(d)];
    const endR = side < 0 ? [c, b, lo(b), lo(c)] : [b, c, lo(c), lo(b)];
    m.planar('plank', endL as V3[], a, side < 0 ? B : F, D, 0.2, 0.4);
    m.planar('plank', endR as V3[], b, side < 0 ? F : B, D, 0.2, 0.4);
  }
  // the ridge cap
  m.box('dark', X0 - ox - 0.02, X1 + ox + 0.02, RIDGE - 0.01, RIDGE + 0.06, COTTAGE.z - 0.05, COTTAGE.z + 0.05, 0.3);
  // the chimney, up through the roof at the right end (as you face the front), a cap on it
  const cx0 = X0 + 0.22;
  m.box('stone', cx0, cx0 + 0.3, 0, RIDGE + 0.42, COTTAGE.z + 0.18, COTTAGE.z + 0.5, 0.4);
  m.box('stone', cx0 - 0.03, cx0 + 0.33, RIDGE + 0.42, RIDGE + 0.48, COTTAGE.z + 0.15, COTTAGE.z + 0.53, 0.4);
  // the door: in its frame, a step of stone before it
  const dz = Z0 - 0.006;
  m.planar('door', [[DOOR_X + 0.22, PLINTH + 0.84, dz], [DOOR_X - 0.22, PLINTH + 0.84, dz], [DOOR_X - 0.22, PLINTH, dz], [DOOR_X + 0.22, PLINTH, dz]], [DOOR_X + 0.22, PLINTH + 0.84, dz], L, D, 0.44, 0.84);
  m.box('plank', DOOR_X - 0.27, DOOR_X - 0.22, PLINTH, PLINTH + 0.89, Z0 - 0.04, Z0, 0.2);
  m.box('plank', DOOR_X + 0.22, DOOR_X + 0.27, PLINTH, PLINTH + 0.89, Z0 - 0.04, Z0, 0.2);
  m.box('plank', DOOR_X - 0.27, DOOR_X + 0.27, PLINTH + 0.84, PLINTH + 0.9, Z0 - 0.045, Z0, 0.2);
  m.box('stone', DOOR_X - 0.3, DOOR_X + 0.3, 0, 0.06, Z0 - 0.22, Z0, 0.3);
  // the shop window: glass, frame and mullion, the counter ledge, the shutters folded back, the awning
  const wy0 = SHOP_Y0;
  const wy1 = SHOP_Y1;
  const wz = Z0 - 0.005;
  // behind the glass: a little display set into the wall, two shelves with cases on them (each its own, to shoot)
  const nz = Z0 + 0.15;
  m.planar('niche', [[SHOP_X + 0.5, wy1, nz], [SHOP_X - 0.5, wy1, nz], [SHOP_X - 0.5, wy0, nz], [SHOP_X + 0.5, wy0, nz]], [SHOP_X + 0.5, wy1, nz], L, D, 0.2, 0.4);
  m.planar('niche', [[SHOP_X - 0.5, wy1, Z0], [SHOP_X - 0.5, wy1, nz], [SHOP_X - 0.5, wy0, nz], [SHOP_X - 0.5, wy0, Z0]], [SHOP_X - 0.5, wy1, Z0], F, D, 0.2, 0.4);
  m.planar('niche', [[SHOP_X + 0.5, wy1, nz], [SHOP_X + 0.5, wy1, Z0], [SHOP_X + 0.5, wy0, Z0], [SHOP_X + 0.5, wy0, nz]], [SHOP_X + 0.5, wy1, nz], B, D, 0.2, 0.4);
  m.planar('niche', [[SHOP_X - 0.5, wy1, Z0], [SHOP_X + 0.5, wy1, Z0], [SHOP_X + 0.5, wy1, nz], [SHOP_X - 0.5, wy1, nz]], [SHOP_X - 0.5, wy1, Z0], R, F, 0.2, 0.4);
  for (const sy of [wy0, wy0 + 0.25]) m.box('plank', SHOP_X - 0.5, SHOP_X + 0.5, sy, sy + 0.016, Z0, nz, 0.2);
  SHELF_KINDS.forEach((k, i) => {
    const row = Math.floor(i / 4);
    const cx = SHOP_X - 0.36 + (i % 4) * 0.24 + (row ? 0.03 : -0.02);
    const by = wy0 + 0.016 + row * 0.25;
    const key = `shelf${i}`;
    textures[key] = textures[k];
    m.box(key, cx - 0.075, cx + 0.075, by, by + 0.09, Z0 + 0.035, Z0 + 0.115, 0.15);
  });
  // the glass, in the frame: a sheen of pale pixels and streaks, the display seen through it
  m.planar('glass', [[SHOP_X + 0.5, wy1, wz], [SHOP_X - 0.5, wy1, wz], [SHOP_X - 0.5, wy0, wz], [SHOP_X + 0.5, wy0, wz]], [SHOP_X + 0.5, wy1, wz], L, D, 1, wy1 - wy0);
  m.box('plank', SHOP_X - 0.54, SHOP_X + 0.54, wy1, wy1 + 0.05, Z0 - 0.04, Z0, 0.2);
  m.box('plank', SHOP_X - 0.54, SHOP_X - 0.5, wy0, wy1, Z0 - 0.04, Z0, 0.2);
  m.box('plank', SHOP_X + 0.5, SHOP_X + 0.54, wy0, wy1, Z0 - 0.04, Z0, 0.2);
  m.box('plank', SHOP_X - 0.015, SHOP_X + 0.015, wy0, wy1, Z0 - 0.03, Z0, 0.2);
  m.box('plank', SHOP_X - 0.6, SHOP_X + 0.6, wy0 - 0.05, wy0, Z0 - 0.24, Z0, 0.2);
  for (const sd2 of [-1, 1]) {
    const xa = SHOP_X + sd2 * 0.54;
    const xb = SHOP_X + sd2 * 0.8;
    const sz = Z0 - 0.012;
    const pts: V3[] = sd2 < 0 ? [[xa, wy1, sz], [xb, wy1, sz], [xb, wy0, sz], [xa, wy0, sz]] : [[xb, wy1, sz], [xa, wy1, sz], [xa, wy0, sz], [xb, wy0, sz]];
    m.planar('shutter', pts, pts[0], sd2 < 0 ? R : L, D, 0.26, wy1 - wy0);
  }
  const ay0 = 1.1;
  const ay1 = 0.98;
  const az = Z0 - 0.52;
  m.planar('awning', [[SHOP_X + 0.68, ay0, Z0], [SHOP_X - 0.68, ay0, Z0], [SHOP_X - 0.68, ay1, az], [SHOP_X + 0.68, ay1, az]], [SHOP_X + 0.68, ay0, Z0], L, [0, -0.23, -0.97], 0.34, 0.53);
  m.planar('valance', [[SHOP_X + 0.68, ay1, az], [SHOP_X - 0.68, ay1, az], [SHOP_X - 0.68, ay1 - 0.07, az], [SHOP_X + 0.68, ay1 - 0.07, az]], [SHOP_X + 0.68, ay1, az], L, D, 0.34, 0.07);
  for (const sd2 of [-1, 1]) {
    const x = SHOP_X + sd2 * 0.62;
    m.box('iron', x - 0.008, x + 0.008, ay1 - 0.02, ay1, az, Z0, 0.05);
  }
  // side windows with flower boxes, and one at the back
  for (const [x, nx] of [[X0, -1], [X1, 1]] as const) {
    const px = x + nx * 0.006;
    const zA = COTTAGE.z - 0.25;
    const zB = COTTAGE.z + 0.25;
    const pts: V3[] = nx < 0 ? [[px, 0.88, zB], [px, 0.88, zA], [px, 0.5, zA], [px, 0.5, zB]] : [[px, 0.88, zA], [px, 0.88, zB], [px, 0.5, zB], [px, 0.5, zA]];
    m.planar('pane', pts, pts[0], nx < 0 ? B : F, D, 0.5, 0.38);
    m.box('plank', Math.min(x, x + nx * 0.04), Math.max(x, x + nx * 0.04), 0.88, 0.92, zA - 0.04, zB + 0.04, 0.2);
    m.box('plank', Math.min(x, x + nx * 0.16), Math.max(x, x + nx * 0.16), 0.38, 0.48, zA - 0.06, zB + 0.06, 0.2, 'flowers');
  }
  const bpts: V3[] = [[COTTAGE.x - 0.25, 0.9, Z1 + 0.006], [COTTAGE.x + 0.25, 0.9, Z1 + 0.006], [COTTAGE.x + 0.25, 0.54, Z1 + 0.006], [COTTAGE.x - 0.25, 0.54, Z1 + 0.006]];
  m.planar('pane', bpts, bpts[0], R, D, 0.5, 0.36);
  // the sign out on its bracket at the left corner, painted both sides
  const sx = X1 + 0.02;
  m.box('iron', sx, sx + 0.42, 1.0, 1.02, Z0 - 0.01, Z0 + 0.01, 0.05);
  const sgn = (zz: number, flip: boolean) => {
    const pts: V3[] = flip
      ? [[sx + 0.06, 0.98, zz], [sx + 0.42, 0.98, zz], [sx + 0.42, 0.8, zz], [sx + 0.06, 0.8, zz]]
      : [[sx + 0.42, 0.98, zz], [sx + 0.06, 0.98, zz], [sx + 0.06, 0.8, zz], [sx + 0.42, 0.8, zz]];
    m.planar('sign', pts, pts[0], flip ? R : L, D, 0.36, 0.18);
  };
  sgn(Z0 - 0.012, false);
  sgn(Z0 + 0.012, true);
  m.box('signwood', sx + 0.06, sx + 0.42, 0.8, 0.98, Z0 - 0.011, Z0 + 0.011, 0.2, 'signwood');
  // the stall: a table with a gingham cloth, the three cases on it
  const { x: tx, z: tz, w: tw, d: td, h: tht } = STALL;
  m.box('cloth', tx - tw / 2, tx + tw / 2, tht - 0.03, tht, tz - td / 2, tz + td / 2, 0.16);
  m.box('cloth', tx - tw / 2, tx + tw / 2, tht - 0.09, tht - 0.03, tz - td / 2 - 0.004, tz - td / 2, 0.16);
  for (const [lx, lz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) m.box('plank', tx + lx * (tw / 2 - 0.05) - 0.025, tx + lx * (tw / 2 - 0.05) + 0.025, 0, tht - 0.03, tz + lz * (td / 2 - 0.05) - 0.025, tz + lz * (td / 2 - 0.05) + 0.025, 0.2);
  (['meadow', 'deepwood', 'hollow'] as CaseKind[]).forEach((k, i) => {
    const cx = tx + (i - 1) * 0.3;
    const cz = tz - 0.02;
    m.planar(k, [[cx - 0.1, tht + 0.1, cz - 0.06], [cx + 0.1, tht + 0.1, cz - 0.06], [cx + 0.1, tht, cz - 0.06], [cx - 0.1, tht, cz - 0.06]], [cx - 0.1, tht + 0.1, cz - 0.06], R, D, 0.2, 0.1);
    m.box(k, cx - 0.1, cx + 0.1, tht, tht + 0.1, cz - 0.059, cz + 0.06, 0.2);
    m.box(k, cx - 0.03, cx + 0.03, tht + 0.1, tht + 0.12, cz - 0.006, cz + 0.006, 0.05);
  });
  // a lantern on a post by the stall
  const lx = X0 - 0.35;
  const lz = Z0 - 0.55;
  m.box('dark', lx - 0.03, lx + 0.03, 0, 1.0, lz - 0.03, lz + 0.03, 0.3);
  m.box('dark', lx - 0.03, lx + 0.16, 0.96, 1.0, lz - 0.02, lz + 0.02, 0.3);
  m.box('lamp', lx + 0.08, lx + 0.18, 0.78, 0.92, lz - 0.05, lz + 0.05, 0.1);
  m.box('iron', lx + 0.07, lx + 0.19, 0.92, 0.95, lz - 0.06, lz + 0.06, 0.05);
  // crates and a barrel by the door
  m.box('crateBig', X1 + 0.1, X1 + 0.46, 0, 0.3, Z0 + 0.18, Z0 + 0.6, 0.3);
  m.box('crateTop', X1 + 0.14, X1 + 0.4, 0.3, 0.52, Z0 + 0.24, Z0 + 0.52, 0.3);
  const barrel = new THREE.LatheGeometry([0.13, 0.15, 0.16, 0.15, 0.13].map((r, i) => new THREE.Vector2(r, i * 0.1)), 12);
  barrel.translate(X1 + 0.32, 0, Z0 - 0.25);
  const lid = new THREE.CircleGeometry(0.13, 12).rotateX(-Math.PI / 2).translate(X1 + 0.32, 0.4, Z0 - 0.25);
  const bu = barrel.getAttribute('uv') as THREE.BufferAttribute;
  for (let i = 0; i < bu.count; i++) bu.setXY(i, bu.getX(i) * 3, bu.getY(i) * 1.6);
  const out = m.geometries();
  out.push({ key: 'barrel', geo: barrel, tex: textures.barrel }, { key: 'barrelLid', geo: lid, tex: textures.dark });
  return out;
}
