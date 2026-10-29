/**
 * Pill mode's real 3D things, built from the same paint as the walk's sprites: trees with round trunks and
 * crowns of leaf clumps hung in 3D (each clump a little card turned to you, the way leafy trees are built in
 * most games), the stump, the computer and the notice board pushed out of their sprites into solid slabs,
 * the keyboard and the floppies as flat boxes. All the shapes here, none of the lighting.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { clump } from './art/brush';
import { SPECS, TREE_D, type TreeKind } from './art/trees';
import { texelAt } from './config';
import { PAL } from './palette';
import { hash2, hex, mulberry, noise1, noise2, Pix, shade, type Ramp } from './pix';

// --- baking many copies of a shape into one geometry ---------------------------------------------------------
export class Bake {
  private pos: number[] = [];
  private nor: number[] = [];
  private uv: number[] = [];
  private idx: number[] = [];
  private v = new THREE.Vector3();
  private nm = new THREE.Matrix3();

  add(g: THREE.BufferGeometry, m: THREE.Matrix4) {
    const p = g.getAttribute('position');
    const n = g.getAttribute('normal');
    const u = g.getAttribute('uv');
    const ix = g.getIndex();
    const base = this.pos.length / 3;
    this.nm.getNormalMatrix(m);
    for (let i = 0; i < p.count; i++) {
      this.v.fromBufferAttribute(p, i).applyMatrix4(m);
      this.pos.push(this.v.x, this.v.y, this.v.z);
      this.v.fromBufferAttribute(n, i).applyMatrix3(this.nm).normalize();
      this.nor.push(this.v.x, this.v.y, this.v.z);
      this.uv.push(u.getX(i), u.getY(i));
    }
    if (ix) for (let j = 0; j < ix.count; j++) this.idx.push(base + ix.getX(j));
    else for (let i = 0; i < p.count; i++) this.idx.push(base + i);
  }

  get empty() {
    return this.idx.length === 0;
  }

  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setIndex(this.idx);
    return g;
  }
}

const repeatTex = (p: Pix) => {
  const t = new THREE.DataTexture(new Uint8Array(p.data.buffer), p.w, p.h, THREE.RGBAFormat, THREE.UnsignedByteType);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestMipmapNearestFilter;
  t.generateMipmaps = true;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.NoColorSpace;
  t.needsUpdate = true;
  return t;
};

// --- bark --------------------------------------------------------------------------------------------------
const BARK_W = 32;
const BARK_H = 64;
/** A tile of bark that wraps round a trunk: furrows running up it, moss low down on some, birch's dark marks. */
export function barkTexture(bark: Ramp, o: { moss?: Ramp; birch?: boolean; seed: number }) {
  const p = new Pix(BARK_W, BARK_H, true);
  for (let y = 0; y < BARK_H; y++) {
    for (let x = 0; x < BARK_W; x++) {
      const g = noise1(x * 0.42 + noise1(y * 0.06, o.seed) * 1.6, o.seed + 1);
      let t = o.birch ? 0.78 : 0.58;
      if (!o.birch && g > 0.66) t -= 0.26;
      else if (!o.birch && g < 0.22) t += 0.12;
      t += (hash2(x, y, o.seed + 2) - 0.5) * 0.08;
      let c = shade(bark, t);
      if (o.moss && noise2(x * 0.16, y * 0.09, o.seed + 3) > 0.64) c = shade(o.moss, 0.35 + hash2(x, y, o.seed + 4) * 0.4);
      p.set(x, y, c);
    }
  }
  if (o.birch) {
    const rnd = mulberry(o.seed + 5);
    for (let i = 0; i < 26; i++) {
      const x = Math.floor(rnd() * BARK_W);
      const y = Math.floor(rnd() * BARK_H);
      const len = 2 + Math.floor(rnd() * 5);
      for (let k = 0; k < len; k++) p.set(x + k, y, bark[0]);
    }
  }
  return repeatTex(p);
}

// --- trees ---------------------------------------------------------------------------------------------------
const lathe = (pts: [number, number][], segs: number) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), segs);
const up = new THREE.Vector3(0, 1, 0);

/** A limb from a to b: an open tapering cylinder. */
function limb(a: THREE.Vector3, b: THREE.Vector3, r0: number, r1: number) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  const g = new THREE.CylinderGeometry(r1, r0, len, 5, 1, true);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(up, dir.normalize()));
  g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  return g;
}

/** Sizes from the painted tree (in world units at scale 1): trunk radius, crown centre height and radii. */
export function treeSize(kind: TreeKind) {
  const s = SPECS[kind];
  const t = texelAt(TREE_D);
  return { r: (s.trunkW * t) / 2, flare: (s.flare * t) / 2, cy: (s.h - 1 - s.crown[1]) * t, rx: s.crown[2] * t, ry: s.crown[3] * t };
}

/** The wooden part of a tree, at scale 1 standing on (0, 0, 0): flared foot, trunk up into the crown, limbs. */
export function trunkGeometry(kind: TreeKind) {
  const { r, flare, cy, rx, ry } = treeSize(kind);
  const top = cy + ry * 0.25;
  const g = lathe([[r + flare * 0.9, 0], [r + flare * 0.45, 0.07], [r * 1.12, 0.28], [r, 0.8], [r * 0.86, top * 0.6], [r * 0.5, top]], 8);
  // the bark tile repeats at the painting's own pixel size
  const t = texelAt(TREE_D);
  const uv = g.getAttribute('uv') as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * Math.max(1, Math.round((Math.PI * 2 * r) / (BARK_W * t))), (uv.getY(i) * top) / (BARK_H * t));
  const parts: THREE.BufferGeometry[] = [g];
  const n = SPECS[kind].limbs;
  for (let i = 0; i < n; i++) {
    const a = i * 2.4 + 0.6;
    const y0 = cy - ry * (0.25 + 0.2 * (i % 2));
    parts.push(limb(new THREE.Vector3(0, y0, 0), new THREE.Vector3(Math.cos(a) * rx * 0.62, cy + ry * 0.2, Math.sin(a) * rx * 0.62), r * 0.5, r * 0.18));
  }
  return mergeGeometries(parts.map((p) => p.toNonIndexed()))!;
}

/** The leaves' paint: clumps of three greens (the walk's edge, mid and deep wood) in seven sizes. */
export const CLUMP_SIZES = [6, 8, 10, 12, 14, 16, 19];
export const LEAF = { edge: 0, mid: 1, deep: 2 };
export function clumpSprites(): Pix[] {
  const out: Pix[] = [];
  [PAL.edge.leaf, PAL.mid.leaf, PAL.deep.leaf].forEach((pal, k) => {
    CLUMP_SIZES.forEach((r, i) => {
      const s = r * 2 + 6;
      const p = new Pix(s, s);
      clump(p, s / 2, s / 2, r, pal, 3100 + k * 20 + i, 0.02);
      p.outline();
      p.bleed();
      out.push(p);
    });
  });
  return out;
}
const sizeIndex = (r: number) => CLUMP_SIZES.reduce((b, s, i) => (Math.abs(s - r) < Math.abs(CLUMP_SIZES[b] - r) ? i : b), 0);

/** One leaf card: which clump sprite, where its middle is, how big (world units per sprite pixel). */
export type Card = { sprite: number; x: number; y: number; z: number; px: number };
const LEAF_OF: Record<TreeKind, number> = { oak: LEAF.mid, beech: LEAF.mid, birch: LEAF.edge, young: LEAF.edge, ancient: LEAF.deep };

/**
 * A tree's crown: clumps scattered through its oval, most near the skin so it reads round from every side,
 * a few big dark ones in the heart so no sky shows through, and a little undergrowth at the foot of the big ones.
 */
export function crownCards(kind: TreeKind | 'bush', x: number, z: number, sc: number, far: boolean, rnd: () => number, out: Card[]) {
  const t = texelAt(TREE_D);
  const card = (leaf: number, r: number, cx: number, cy: number, cz: number, k: number) => out.push({ sprite: leaf * CLUMP_SIZES.length + sizeIndex(r), x: cx, y: cy, z: cz, px: t * sc * k });
  if (kind === 'bush') {
    const n = far ? 7 : 12;
    for (let i = 0; i < n; i++) {
      const a = rnd() * Math.PI * 2;
      const rr = Math.sqrt(rnd());
      card(LEAF.mid, 8 + rnd() * 6, x + Math.cos(a) * rr * 0.6 * sc, (0.18 + rnd() * 0.32) * sc, z + Math.sin(a) * rr * 0.6 * sc, 1.5);
    }
    return;
  }
  const s = SPECS[kind];
  const { cy, rx, ry } = treeSize(kind);
  const leaf = LEAF_OF[kind];
  const n = Math.round(s.count * (far ? 0.55 : 0.95));
  for (let i = 0; i < n; i++) {
    let dx = 0;
    let dy = 0;
    let dz = 0;
    let len = 2;
    while (len > 1 || len < 0.05) {
      dx = rnd() * 2 - 1;
      dy = rnd() * 2 - 1;
      dz = rnd() * 2 - 1;
      len = Math.hypot(dx, dy, dz);
    }
    const u = (0.58 + 0.42 * Math.sqrt(rnd())) / len;
    card(leaf, s.rMin + rnd() * (s.rMax - s.rMin), x + dx * u * rx * sc, (cy + dy * u * ry) * sc, z + dz * u * rx * sc, far ? 2.1 : 1.65);
  }
  for (let i = 0; i < 3; i++) card(LEAF.deep, 19, x + (rnd() - 0.5) * rx * 0.6 * sc, (cy + (rnd() - 0.6) * ry * 0.4) * sc, z + (rnd() - 0.5) * rx * 0.6 * sc, 2.2);
  if (!far && (kind === 'oak' || kind === 'ancient')) {
    for (let i = 0; i < 3; i++) {
      const a = rnd() * Math.PI * 2;
      card(LEAF.mid, 8 + rnd() * 4, x + Math.cos(a) * 0.45 * sc, 0.16 * sc, z + Math.sin(a) * 0.45 * sc, 1.4);
    }
  }
}

/** All the leaf cards as one mesh of quads, each turning round its own middle. */
export function cardGeometry(cards: Card[], rects: { x: number; y: number; w: number; h: number }[], aw: number, ah: number) {
  const pos = new Float32Array(cards.length * 12);
  const uv = new Float32Array(cards.length * 8);
  const anchor = new Float32Array(cards.length * 12);
  const idx = new Uint32Array(cards.length * 6);
  cards.forEach((c, i) => {
    const r = rects[c.sprite];
    const w = (r.w * c.px) / 2;
    const h = (r.h * c.px) / 2;
    pos.set([c.x - w, c.y + h, c.z, c.x + w, c.y + h, c.z, c.x - w, c.y - h, c.z, c.x + w, c.y - h, c.z], i * 12);
    const u0 = r.x / aw;
    const u1 = (r.x + r.w) / aw;
    const v0 = r.y / ah;
    const v1 = (r.y + r.h) / ah;
    uv.set([u0, v0, u1, v0, u0, v1, u1, v1], i * 8);
    for (let k = 0; k < 4; k++) anchor.set([c.x, c.y, c.z], i * 12 + k * 3);
    const n = i * 4;
    idx.set([n, n + 2, n + 1, n + 2, n + 3, n + 1], i * 6);
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setAttribute('anchor', new THREE.BufferAttribute(anchor, 3));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  return g;
}

// --- pushing a sprite out into a slab ------------------------------------------------------------------------
/**
 * A sprite made solid: its painting on the front, a plain back in its main colour, and sides along its whole
 * outline, each side face the colour just inside the edge (so the sides read as the thing's body, not its
 * outline). Texel (ax, ay) sits at the origin, row 0 at the top, like quadFor; it runs back `depth` from z = 0.
 */
export function extrude(pix: Pix, t: number, ax: number, ay: number, depth: number, paintBack?: (back: Pix, main: number) => void) {
  const { w, h } = pix;
  const solid = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && pix.data[y * w + x] >>> 24 > 0;
  const pos: number[] = [];
  const nor: number[] = [];
  const uv: number[] = [];
  const quad = (a: number[], b: number[], c: number[], d: number[], n: number[], uvs: number[]) => {
    pos.push(...a, ...b, ...c, ...b, ...d, ...c);
    for (let i = 0; i < 6; i++) nor.push(...n);
    const [ua, va, ub, vb, uc, vc, ud, vd] = uvs;
    uv.push(ua, va, ub, vb, uc, vc, ub, vb, ud, vd, uc, vc);
  };
  const X = (x: number) => (x - ax) * t;
  const Y = (y: number) => (ay - y) * t;
  quad([X(0), Y(0), 0], [X(w), Y(0), 0], [X(0), Y(h), 0], [X(w), Y(h), 0], [0, 0, 1], [0, 0, 1, 0, 0, 1, 1, 1]);
  const inner = (x: number, y: number, dx: number, dy: number): [number, number] => {
    for (const k of [2, 1]) if (solid(x + dx * k, y + dy * k)) return [(x + dx * k + 0.5) / w, (y + dy * k + 0.5) / h];
    return [(x + 0.5) / w, (y + 0.5) / h];
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!solid(x, y)) continue;
      const z0 = 0;
      const z1 = -depth;
      if (!solid(x - 1, y)) {
        const [u, v] = inner(x, y, 1, 0);
        quad([X(x), Y(y), z1], [X(x), Y(y), z0], [X(x), Y(y + 1), z1], [X(x), Y(y + 1), z0], [-1, 0, 0], [u, v, u, v, u, v, u, v]);
      }
      if (!solid(x + 1, y)) {
        const [u, v] = inner(x, y, -1, 0);
        quad([X(x + 1), Y(y), z0], [X(x + 1), Y(y), z1], [X(x + 1), Y(y + 1), z0], [X(x + 1), Y(y + 1), z1], [1, 0, 0], [u, v, u, v, u, v, u, v]);
      }
      if (!solid(x, y - 1)) {
        const [u, v] = inner(x, y, 0, 1);
        quad([X(x), Y(y), z1], [X(x + 1), Y(y), z1], [X(x), Y(y), z0], [X(x + 1), Y(y), z0], [0, 1, 0], [u, v, u, v, u, v, u, v]);
      }
      if (!solid(x, y + 1)) {
        const [u, v] = inner(x, y, 0, -1);
        quad([X(x), Y(y + 1), z0], [X(x + 1), Y(y + 1), z0], [X(x), Y(y + 1), z1], [X(x + 1), Y(y + 1), z1], [0, -1, 0], [u, v, u, v, u, v, u, v]);
      }
    }
  }
  const body = new THREE.BufferGeometry();
  body.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  body.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  body.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  // the back: the same outline, filled with the thing's most common colour, a shade darker at the rim
  const counts = new Map<number, number>();
  for (const c of pix.data) if (c >>> 24 && (c & 255) + ((c >>> 8) & 255) + ((c >>> 16) & 255) > 120) counts.set(c, (counts.get(c) ?? 0) + 1);
  const main = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? hex('#7a6f5a');
  const backPix = new Pix(w, h);
  for (let i = 0; i < pix.data.length; i++) if (pix.data[i] >>> 24) backPix.data[i] = main;
  paintBack?.(backPix, main);
  backPix.outline(0.7, 0.9);
  const back = new THREE.BufferGeometry();
  const bp: number[] = [];
  const bn: number[] = [];
  const bu: number[] = [];
  bp.push(X(w), Y(0), -depth, X(0), Y(0), -depth, X(w), Y(h), -depth, X(0), Y(0), -depth, X(0), Y(h), -depth, X(w), Y(h), -depth);
  for (let i = 0; i < 6; i++) bn.push(0, 0, -1);
  // seen from behind it is the mirror image of the front's outline
  bu.push(1, 0, 0, 0, 1, 1, 0, 0, 0, 1, 1, 1);
  back.setAttribute('position', new THREE.Float32BufferAttribute(bp, 3));
  back.setAttribute('normal', new THREE.Float32BufferAttribute(bn, 3));
  back.setAttribute('uv', new THREE.Float32BufferAttribute(bu, 2));
  return { body, back, backPix };
}

// --- the stump -----------------------------------------------------------------------------------------------
/** The cat's stump, round: flared bark foot with moss up its sides, rings on top, roots into the grass. */
export function stumpGeometry(top: number) {
  const r = 0.55;
  const side = lathe([[r * 1.38, 0], [r * 1.16, 0.05], [r * 1.04, 0.16], [r, top * 0.55], [r * 1.01, top]], 12);
  const uv = side.getAttribute('uv') as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 6, uv.getY(i) * 1.4);
  const roots: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 5; i++) {
    const a = i * 1.27 + 0.3;
    roots.push(limb(new THREE.Vector3(Math.cos(a) * r * 0.9, 0.14, Math.sin(a) * r * 0.9), new THREE.Vector3(Math.cos(a) * r * 2, -0.02, Math.sin(a) * r * 2), 0.09, 0.025));
  }
  const cap = new THREE.CircleGeometry(r * 1.01, 14);
  cap.rotateX(-Math.PI / 2);
  cap.translate(0, top, 0);
  return { side: mergeGeometries([side.toNonIndexed(), ...roots.map((g) => g.toNonIndexed())])!, cap };
}

export function ringsTexture() {
  const n = 48;
  const p = new Pix(n, n);
  const H = PAL.hollow;
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const dx = (x + 0.5 - n / 2) / (n / 2);
      const dy = (y + 0.5 - n / 2) / (n / 2);
      const e = Math.hypot(dx, dy);
      const ring = (e * 6 + noise2(x * 0.2, y * 0.2, 709) * 0.7) % 1;
      let c = shade(H.rings, 0.72 - e * 0.4 + (ring < 0.3 ? -0.22 : 0));
      if (e > 0.88) c = shade(H.bark, 0.42);
      if (e > 0.8 && noise2(x * 0.3, y * 0.3, 710) > 0.55) c = shade(H.moss, 0.5 + (hash2(x, y, 711) - 0.5) * 0.3);
      p.set(x, y, c);
    }
  return repeatTex(p);
}

// --- the keyboard and the floppies -----------------------------------------------------------------------------
export function keysTexture() {
  const p = new Pix(64, 24);
  const k = PAL.computer.key;
  const s = PAL.computer.shell;
  p.rect(0, 0, 64, 24, s[3]);
  for (let row = 0; row < 4; row++)
    for (let col = 0; col < 15; col++) {
      const x = 2 + col * 4;
      const y = 3 + row * 5;
      p.rect(x, y, 3, 3, k[2]);
      p.set(x, y, k[3]);
      p.set(x + 2, y + 2, k[0]);
    }
  p.rect(16, 18, 30, 3, k[2]);
  return repeatTex(p);
}

/** A floppy seen from above: its colour, the metal shutter, and the label with the project's name written on it. */
export function floppyTexture(title: string, body: string, stripe: string) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  // big, clear writing: it has to read from standing height
  const g = c.getContext('2d')!;
  g.fillStyle = body;
  g.fillRect(0, 0, 128, 128);
  g.fillStyle = '#aab0af';
  g.fillRect(34, 0, 60, 40);
  g.fillStyle = '#585e60';
  g.fillRect(70, 8, 12, 24);
  g.fillStyle = '#efe9d6';
  g.fillRect(14, 58, 100, 64);
  g.fillStyle = stripe;
  g.fillRect(14, 58, 100, 7);
  const fam = getComputedStyle(document.documentElement).getPropertyValue('--font-hand').trim() || 'cursive';
  g.fillStyle = '#2c2a26';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  let fs = 40;
  g.font = `700 ${fs}px ${fam}`;
  const words = title.split(' ');
  const lines = words.length > 1 && g.measureText(title).width > 92 ? [words.slice(0, Math.ceil(words.length / 2)).join(' '), words.slice(Math.ceil(words.length / 2)).join(' ')] : [title];
  while (fs > 12 && lines.some((l) => g.measureText(l).width > 94)) g.font = `700 ${(fs -= 2)}px ${fam}`;
  lines.forEach((l, i) => g.fillText(l, 64, 93 + (i - (lines.length - 1) / 2) * fs * 0.9));
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace;
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestMipmapNearestFilter;
  return t;
}
