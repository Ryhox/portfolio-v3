import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { BAYER, LIGHT, light } from './gl';
import { hash2, hex, Pix, ramp, shade, type Ramp } from './pix';
import type { Season } from './season';

/**
 * Pill mode's animals as real 3D, the old-school way: each one a handful of boxes with chunky pixel fur painted
 * on them (eyes on the face, a white tip on the fox's tail, spines on the hedgehog), lit in hard steps like the
 * trees. Every species is one instanced mesh; legs, heads, tails, ears and wings are swung in the vertex shader
 * from per-animal numbers (stride, how fast it's going, wing beat, how alert it is), so a meadow full of them
 * costs a few draw calls.
 */
export type Species = 'rabbit' | 'hare' | 'hedgehog' | 'squirrel' | 'fox' | 'deer' | 'robin' | 'jay' | 'bullfinch' | 'frog' | 'butterfly';

/** Bones: what a part does when the animal moves. */
const B = { body: 0, legA: 1, legB: 2, head: 3, tail: 4, wingL: 5, wingR: 6, ear: 7 };
type Part = { bone: number; size: [number, number, number]; at: [number, number, number]; pivot?: [number, number, number]; tile: number; face?: number };

type Def = {
  parts: Part[];
  tiles: { pal: Ramp; kind?: 'fur' | 'spines' | 'eyes' | 'plain' | 'tip' | 'belly' }[];
  speed: number;
  hop?: number;
  flier?: boolean;
  /** size of a shot at it: half length, height, half width (and where its head is, for headshots) */
  box: [number, number, number];
  headAt: [number, number, number];
  headR: number;
  small?: boolean;
};

const leg = (x: number, z: number, h: number, w: number, bone: number, tile: number): Part => ({ bone, size: [w, h, w], at: [x, h / 2, z], pivot: [x, h, z], tile });

function defs(season: Season): Record<Species, Def> {
  const winter = season === 'winter';
  const brown = ramp('#4a3a2c', '#6a5440', '#7d6650', '#988066', '#b09a7e');
  const deerCoat = winter ? ramp('#3e362e', '#5a4e42', '#6e6052', '#847464', '#9a8a78') : ramp('#5e3a1e', '#7e5028', '#9a6434', '#b47c44', '#c8925a');
  const fox = ramp('#7a3414', '#a04a1c', '#c05e24', '#d87a36', '#e8984e');
  const white = ramp('#b8bec4', '#d4d8dc', '#e8eaec', '#f6f8f8', '#ffffff');
  const dark = ramp('#14110e', '#1e1a16', '#2a241e', '#3a322a');
  const red = ramp('#5a2414', '#8a3418', '#b8462a', '#d0583a');
  const grey = ramp('#3e3e44', '#56565e', '#6e7078', '#888a92');
  const squirrel = ramp('#5a2410', '#7a3418', '#a3542a', '#c06a34', '#d48444');
  const frog = ramp('#26401c', '#36592a', '#4f7d36', '#6a9a44', '#86ad55');
  const jay = ramp('#6a4e40', '#8a6a5a', '#b08a74', '#c8a490');
  const blue = ramp('#1e3a6e', '#2c5a9a', '#4a78b8', '#7aa0d8');
  const spines = ramp('#2a2018', '#3e3024', '#5a4636', '#6e5a46', '#8a7458');
  const wing = season === 'spring' ? ramp('#8a7a10', '#b0a020', '#cdbc32', '#ece27a') : ramp('#7a3a10', '#b06020', '#d8902a', '#f6cc68');
  const bird = (body: Ramp, breast: Ramp, head: Ramp): Def => ({
    tiles: [{ pal: body }, { pal: breast, kind: 'belly' }, { pal: head, kind: 'eyes' }, { pal: dark }, { pal: ramp('#c89a2a', '#e0b840') }],
    parts: [
      { bone: B.body, size: [0.12, 0.09, 0.08], at: [0, 0.1, 0], tile: 0, face: 1 },
      { bone: B.head, size: [0.07, 0.07, 0.07], at: [0.07, 0.16, 0], pivot: [0.05, 0.13, 0], tile: 2 },
      { bone: B.head, size: [0.035, 0.016, 0.018], at: [0.12, 0.155, 0], pivot: [0.05, 0.13, 0], tile: 4 },
      { bone: B.tail, size: [0.08, 0.02, 0.05], at: [-0.09, 0.12, 0], pivot: [-0.05, 0.11, 0], tile: 3 },
      { bone: B.wingL, size: [0.08, 0.015, 0.07], at: [-0.01, 0.12, -0.075], pivot: [0, 0.12, -0.04], tile: 0 },
      { bone: B.wingR, size: [0.08, 0.015, 0.07], at: [-0.01, 0.12, 0.075], pivot: [0, 0.12, 0.04], tile: 0 },
      leg(0.01, -0.02, 0.055, 0.012, B.legA, 4),
      leg(0.01, 0.02, 0.055, 0.012, B.legB, 4),
    ],
    speed: 1.2,
    hop: 0.05,
    flier: true,
    box: [0.08, 0.2, 0.06],
    headAt: [0.07, 0.16, 0],
    headR: 0.05,
    small: true,
  });
  const rabbit = (coat: Ramp, ears: number): Def => ({
    tiles: [{ pal: coat }, { pal: coat, kind: 'eyes' }, { pal: white, kind: 'plain' }, { pal: coat, kind: 'tip' }, { pal: coat, kind: 'belly' }],
    parts: [
      { bone: B.body, size: [0.28, 0.18, 0.18], at: [0, 0.14, 0], tile: 0, face: 4 },
      { bone: B.head, size: [0.14, 0.13, 0.13], at: [0.17, 0.24, 0], pivot: [0.11, 0.2, 0], tile: 1 },
      { bone: B.ear, size: [0.035, ears, 0.04], at: [0.14, 0.3 + ears / 2, -0.035], pivot: [0.14, 0.3, -0.035], tile: 3 },
      { bone: B.ear, size: [0.035, ears, 0.04], at: [0.14, 0.3 + ears / 2, 0.035], pivot: [0.14, 0.3, 0.035], tile: 3 },
      { bone: B.tail, size: [0.06, 0.06, 0.06], at: [-0.16, 0.17, 0], pivot: [-0.14, 0.17, 0], tile: 2 },
      leg(0.09, -0.055, 0.07, 0.045, B.legA, 0),
      leg(0.09, 0.055, 0.07, 0.045, B.legB, 0),
      { bone: B.legB, size: [0.1, 0.06, 0.055], at: [-0.08, 0.03, -0.07], pivot: [-0.04, 0.06, -0.07], tile: 0 },
      { bone: B.legA, size: [0.1, 0.06, 0.055], at: [-0.08, 0.03, 0.07], pivot: [-0.04, 0.06, 0.07], tile: 0 },
    ],
    speed: 1.7,
    hop: 0.1,
    box: [0.16, 0.36, 0.1],
    headAt: [0.17, 0.24, 0],
    headR: 0.08,
    small: true,
  });
  return {
    rabbit: rabbit(brown, 0.14),
    hare: rabbit(white, 0.17),
    hedgehog: {
      tiles: [{ pal: spines, kind: 'spines' }, { pal: ramp('#8a7458', '#b09a78', '#c9b08a'), kind: 'eyes' }, { pal: dark }],
      parts: [
        { bone: B.body, size: [0.22, 0.12, 0.17], at: [0, 0.08, 0], tile: 0 },
        { bone: B.head, size: [0.08, 0.07, 0.08], at: [0.14, 0.06, 0], pivot: [0.1, 0.06, 0], tile: 1 },
        leg(0.06, -0.05, 0.03, 0.025, B.legA, 2),
        leg(0.06, 0.05, 0.03, 0.025, B.legB, 2),
        leg(-0.06, -0.05, 0.03, 0.025, B.legB, 2),
        leg(-0.06, 0.05, 0.03, 0.025, B.legA, 2),
      ],
      speed: 0.5,
      box: [0.13, 0.15, 0.09],
      headAt: [0.14, 0.06, 0],
      headR: 0.05,
      small: true,
    },
    squirrel: {
      tiles: [{ pal: squirrel }, { pal: squirrel, kind: 'eyes' }, { pal: squirrel, kind: 'fur' }, { pal: ramp('#c8b494', '#e8d9bd'), kind: 'plain' }],
      parts: [
        { bone: B.body, size: [0.15, 0.13, 0.1], at: [0, 0.12, 0], tile: 0, face: 3 },
        { bone: B.head, size: [0.09, 0.09, 0.08], at: [0.1, 0.2, 0], pivot: [0.07, 0.17, 0], tile: 1 },
        { bone: B.ear, size: [0.02, 0.05, 0.025], at: [0.09, 0.27, -0.025], pivot: [0.09, 0.245, -0.025], tile: 0 },
        { bone: B.ear, size: [0.02, 0.05, 0.025], at: [0.09, 0.27, 0.025], pivot: [0.09, 0.245, 0.025], tile: 0 },
        { bone: B.tail, size: [0.08, 0.24, 0.08], at: [-0.12, 0.22, 0], pivot: [-0.08, 0.1, 0], tile: 2 },
        leg(0.05, -0.035, 0.06, 0.03, B.legA, 0),
        leg(0.05, 0.035, 0.06, 0.03, B.legB, 0),
        leg(-0.05, -0.04, 0.06, 0.035, B.legB, 0),
        leg(-0.05, 0.04, 0.06, 0.035, B.legA, 0),
      ],
      speed: 2.2,
      hop: 0.06,
      box: [0.14, 0.34, 0.07],
      headAt: [0.1, 0.2, 0],
      headR: 0.06,
      small: true,
    },
    fox: {
      tiles: [{ pal: fox }, { pal: fox, kind: 'eyes' }, { pal: fox, kind: 'tip' }, { pal: dark }, { pal: white, kind: 'plain' }],
      parts: [
        { bone: B.body, size: [0.4, 0.15, 0.13], at: [0, 0.22, 0], tile: 0, face: 4 },
        { bone: B.head, size: [0.13, 0.11, 0.11], at: [0.25, 0.28, 0], pivot: [0.19, 0.25, 0], tile: 1 },
        { bone: B.head, size: [0.08, 0.05, 0.06], at: [0.34, 0.255, 0], pivot: [0.19, 0.25, 0], tile: 4 },
        { bone: B.ear, size: [0.03, 0.07, 0.04], at: [0.24, 0.37, -0.035], pivot: [0.24, 0.335, -0.035], tile: 3 },
        { bone: B.ear, size: [0.03, 0.07, 0.04], at: [0.24, 0.37, 0.035], pivot: [0.24, 0.335, 0.035], tile: 3 },
        { bone: B.tail, size: [0.3, 0.09, 0.09], at: [-0.33, 0.2, 0], pivot: [-0.19, 0.23, 0], tile: 2 },
        leg(0.14, -0.045, 0.15, 0.04, B.legA, 3),
        leg(0.14, 0.045, 0.15, 0.04, B.legB, 3),
        leg(-0.14, -0.045, 0.15, 0.04, B.legB, 3),
        leg(-0.14, 0.045, 0.15, 0.04, B.legA, 3),
      ],
      speed: 2.6,
      box: [0.22, 0.4, 0.08],
      headAt: [0.27, 0.28, 0],
      headR: 0.08,
    },
    deer: {
      tiles: [{ pal: deerCoat }, { pal: deerCoat, kind: 'eyes' }, { pal: dark }, { pal: white, kind: 'plain' }, { pal: deerCoat, kind: 'belly' }],
      parts: [
        { bone: B.body, size: [0.52, 0.24, 0.2], at: [0, 0.52, 0], tile: 0, face: 4 },
        { bone: B.head, size: [0.1, 0.26, 0.09], at: [0.25, 0.7, 0], pivot: [0.22, 0.58, 0], tile: 0 },
        { bone: B.head, size: [0.18, 0.1, 0.1], at: [0.33, 0.84, 0], pivot: [0.22, 0.58, 0], tile: 1 },
        { bone: B.ear, size: [0.03, 0.08, 0.06], at: [0.28, 0.93, -0.05], pivot: [0.28, 0.89, -0.05], tile: 0 },
        { bone: B.ear, size: [0.03, 0.08, 0.06], at: [0.28, 0.93, 0.05], pivot: [0.28, 0.89, 0.05], tile: 0 },
        { bone: B.tail, size: [0.04, 0.07, 0.08], at: [-0.27, 0.58, 0], pivot: [-0.26, 0.62, 0], tile: 3 },
        leg(0.2, -0.07, 0.42, 0.05, B.legA, 0),
        leg(0.2, 0.07, 0.42, 0.05, B.legB, 0),
        leg(-0.2, -0.07, 0.42, 0.055, B.legB, 0),
        leg(-0.2, 0.07, 0.42, 0.055, B.legA, 0),
      ],
      speed: 3,
      box: [0.3, 0.98, 0.11],
      headAt: [0.33, 0.84, 0],
      headR: 0.1,
    },
    robin: bird(ramp('#4a3a2c', '#5e4a3a', '#6b5a48', '#80705e'), ramp('#a8442a', '#c2583a', '#d8704c'), ramp('#4a3a2c', '#6b5a48')),
    jay: bird(jay, blue, jay),
    bullfinch: bird(grey, ramp('#a83e34', '#d0584a', '#e07a6a'), dark),
    frog: {
      tiles: [{ pal: frog }, { pal: frog, kind: 'eyes' }, { pal: ramp('#a8a060', '#d8cf8a'), kind: 'plain' }],
      parts: [
        { bone: B.body, size: [0.13, 0.06, 0.11], at: [0, 0.05, 0], tile: 0, face: 2 },
        { bone: B.head, size: [0.06, 0.05, 0.1], at: [0.08, 0.065, 0], pivot: [0.06, 0.05, 0], tile: 1 },
        { bone: B.head, size: [0.03, 0.03, 0.03], at: [0.08, 0.1, -0.035], pivot: [0.06, 0.05, 0], tile: 1 },
        { bone: B.head, size: [0.03, 0.03, 0.03], at: [0.08, 0.1, 0.035], pivot: [0.06, 0.05, 0], tile: 1 },
        { bone: B.legA, size: [0.09, 0.03, 0.04], at: [-0.07, 0.02, -0.07], pivot: [-0.03, 0.03, -0.07], tile: 0 },
        { bone: B.legA, size: [0.09, 0.03, 0.04], at: [-0.07, 0.02, 0.07], pivot: [-0.03, 0.03, 0.07], tile: 0 },
        leg(0.05, -0.05, 0.03, 0.02, B.legB, 0),
        leg(0.05, 0.05, 0.03, 0.02, B.legB, 0),
      ],
      speed: 1.4,
      hop: 0.14,
      box: [0.09, 0.12, 0.08],
      headAt: [0.08, 0.07, 0],
      headR: 0.05,
      small: true,
    },
    butterfly: {
      tiles: [{ pal: dark }, { pal: wing, kind: 'tip' }],
      parts: [
        { bone: B.body, size: [0.05, 0.014, 0.014], at: [0, 0, 0], tile: 0 },
        { bone: B.wingL, size: [0.05, 0.004, 0.06], at: [0.005, 0, -0.035], pivot: [0, 0, -0.005], tile: 1 },
        { bone: B.wingR, size: [0.05, 0.004, 0.06], at: [0.005, 0, 0.035], pivot: [0, 0, 0.005], tile: 1 },
        { bone: B.wingL, size: [0.035, 0.004, 0.04], at: [-0.025, 0, -0.025], pivot: [0, 0, -0.005], tile: 1 },
        { bone: B.wingR, size: [0.035, 0.004, 0.04], at: [-0.025, 0, 0.025], pivot: [0, 0, 0.005], tile: 1 },
      ],
      speed: 1.1,
      flier: true,
      box: [0.05, 0.05, 0.06],
      headAt: [0.02, 0, 0],
      headR: 0.02,
      small: true,
    },
  };
}

/** Who lives in the wood this season, and how many of each (for 60 or so animals). */
export const CAST: Record<Season, [Species, number][]> = {
  spring: [['rabbit', 12], ['hedgehog', 5], ['squirrel', 9], ['robin', 8], ['deer', 5], ['fox', 3], ['butterfly', 10]],
  summer: [['rabbit', 11], ['hedgehog', 6], ['squirrel', 8], ['robin', 7], ['jay', 3], ['deer', 6], ['fox', 3], ['butterfly', 16]],
  autumn: [['rabbit', 10], ['hedgehog', 6], ['squirrel', 13], ['jay', 9], ['deer', 8], ['fox', 5], ['robin', 3]],
  winter: [['hare', 13], ['fox', 8], ['squirrel', 6], ['bullfinch', 9], ['robin', 5], ['deer', 9]],
};

const TILE = 8;
function paintTile(p: Pix, ox: number, oy: number, t: Def['tiles'][number], seed: number) {
  for (let y = 0; y < TILE; y++)
    for (let x = 0; x < TILE; x++) {
      let v = 0.55 + (hash2(x, y, seed) - 0.5) * 0.35;
      if (t.kind === 'spines') v = (x + y * 2) % 3 === 0 ? 0.95 : (x + y) % 2 ? 0.4 : 0.2;
      if (t.kind === 'fur') v += (y % 3 === 0 ? 0.15 : 0) - x * 0.02;
      if (t.kind === 'plain') v = 0.6 + (hash2(x, y, seed) - 0.5) * 0.15;
      if (t.kind === 'belly' && y > 5) v = 0.95;
      p.set(ox + x, oy + y, shade(t.pal, v));
      if (t.kind === 'tip' && x < 3) p.set(ox + x, oy + y, y % 2 ? hex('#f6f2ea') : hex('#e8e2d6'));
    }
  if (t.kind === 'eyes') {
    // two dark eyes with a glint, high on the face, and a dark nose
    for (const ey of [2, 5]) {
      p.set(ox + ey, oy + 2, hex('#0c0a08'));
      p.set(ox + ey, oy + 3, hex('#0c0a08'));
      p.set(ox + ey, oy + 2, ey === 2 ? hex('#f4f0e4') : hex('#0c0a08'));
    }
    p.set(ox + 3, oy + 6, hex('#2a1c16'));
    p.set(ox + 4, oy + 6, hex('#2a1c16'));
  }
}

const VERT = /* glsl */ `
attribute float bone;
attribute vec3 pivot;
attribute vec4 aAnim;
varying vec2 vUv;
varying vec3 vWorld;
varying vec3 vNormal;
vec3 rotZ(vec3 p, vec3 c, float a) { vec3 d = p - c; float s = sin(a), k = cos(a); return c + vec3(d.x * k - d.y * s, d.x * s + d.y * k, d.z); }
vec3 rotX(vec3 p, vec3 c, float a) { vec3 d = p - c; float s = sin(a), k = cos(a); return c + vec3(d.x, d.y * k - d.z * s, d.y * s + d.z * k); }
vec3 bend(vec3 p) {
  float ph = aAnim.x;
  float mv = aAnim.y;
  float flap = aAnim.z;
  float alert = aAnim.w;
  if (bone == 1.0) return rotZ(p, pivot, sin(ph) * 0.75 * mv);
  if (bone == 2.0) return rotZ(p, pivot, -sin(ph) * 0.75 * mv);
  if (bone == 3.0) return rotZ(p, pivot, alert * 0.35 - mv * 0.12 + sin(ph * 0.5) * 0.06 * (1.0 - mv));
  if (bone == 4.0) return rotZ(p, pivot, sin(ph * 1.5) * 0.35 + mv * 0.2);
  if (bone == 5.0) return rotX(p, pivot, -0.2 - sin(flap) * 1.1);
  if (bone == 6.0) return rotX(p, pivot, 0.2 + sin(flap) * 1.1);
  if (bone == 7.0) return rotZ(p, pivot, -mv * 0.5 + alert * 0.2);
  return p;
}
void main() {
  vUv = uv;
  vec3 p = bend(position);
  vec3 n = normalize(bend(position + normal * 0.01) - p);
  vec4 w = modelMatrix * instanceMatrix * vec4(p, 1.0);
  vWorld = w.xyz;
  vNormal = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * n);
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const FRAG = /* glsl */ `
uniform sampler2D map;
uniform float snowy;
varying vec2 vUv;
varying vec3 vWorld;
varying vec3 vNormal;
${BAYER}
${LIGHT}
void main() {
  vec4 c = texture2D(map, vUv);
  vec3 n = normalize(vNormal);
  if (!gl_FrontFacing) n = -n;
  float face = dot(n, -sunDir);
  // hard steps, like the trees: the sun side, the side, the shade; tops a little lighter
  float side = face > 0.3 ? 1.0 : face > -0.15 ? 0.82 : 0.64;
  float top = n.y > 0.6 ? 1.1 : n.y < -0.6 ? 0.7 : 1.0;
  float sun = face > 0.0 ? sunAt(vWorld + n * 0.03, 0.0015) : 0.0;
  // kept bright in the wood's shade, so they can be found
  vec3 l = (ambient * 0.9 + 0.22) * side * top + sunColor * sun * 0.55;
  gl_FragColor = vec4(c.rgb * l, 1.0);
}`;

const DEPTH = /* glsl */ `void main() { gl_FragColor = vec4(1.0); }`;

export type Beast = {
  sp: Species;
  i: number;
  x: number;
  z: number;
  y: number;
  head: number;
  /** turning towards `want`, gently */
  want: number;
  state: 'idle' | 'move';
  t: number;
  phase: number;
  flee: number;
  fly: number;
  dead: number;
  alert: number;
  home: [number, number];
  scale: number;
  def: Def;
};

/** All the animals of the wood, by species, drawn and moved together. */
export class Fauna {
  readonly group = new THREE.Group();
  readonly beasts: Beast[] = [];
  private meshes = new Map<Species, { mesh: THREE.InstancedMesh; anim: THREE.InstancedBufferAttribute; list: Beast[] }>();
  private m4 = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private v = new THREE.Vector3();
  private s = new THREE.Vector3();
  private Y = new THREE.Vector3(0, 1, 0);
  readonly depthMats: THREE.ShaderMaterial[] = [];
  readonly litMats: THREE.ShaderMaterial[] = [];

  constructor(season: Season, spots: [number, number][], rnd: () => number) {
    const D = defs(season);
    const cast = CAST[season];
    let k = 0;
    for (const [sp, n] of cast) {
      const def = D[sp];
      // the species' fur, tile by tile, on one little atlas
      const cols = def.tiles.length;
      const pix = new Pix(TILE * cols, TILE);
      def.tiles.forEach((t, i) => paintTile(pix, i * TILE, 0, t, 31 + i * 7 + k));
      const tex = new THREE.DataTexture(new Uint8Array(pix.data.buffer), pix.w, pix.h, THREE.RGBAFormat, THREE.UnsignedByteType);
      tex.magFilter = tex.minFilter = THREE.NearestFilter;
      tex.colorSpace = THREE.NoColorSpace;
      tex.needsUpdate = true;
      const parts = def.parts.map((p) => {
        const g = new THREE.BoxGeometry(...p.size);
        g.translate(...p.at);
        const uv = g.getAttribute('uv') as THREE.BufferAttribute;
        const nor = g.getAttribute('normal') as THREE.BufferAttribute;
        for (let i = 0; i < uv.count; i++) {
          // the face (+x) of a head gets the eyes; the underside of a body its belly
          let tile = p.tile;
          if (p.face !== undefined && nor.getY(i) < -0.5) tile = p.face;
          const u = (tile + 0.06 + uv.getX(i) * 0.88) / cols;
          uv.setXY(i, u, 0.06 + uv.getY(i) * 0.88);
        }
        const n = g.getAttribute('position').count;
        g.setAttribute('bone', new THREE.Float32BufferAttribute(new Array(n).fill(p.bone), 1));
        const pv = p.pivot ?? p.at;
        g.setAttribute('pivot', new THREE.Float32BufferAttribute(Array.from({ length: n * 3 }, (_, j) => pv[j % 3]), 3));
        return g.toNonIndexed();
      });
      const geo = mergeGeometries(parts)!;
      const anim = new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4);
      geo.setAttribute('aAnim', anim);
      const lit = new THREE.ShaderMaterial({ uniforms: { ...light, map: { value: tex }, snowy: { value: season === 'winter' ? 1 : 0 } }, vertexShader: VERT, fragmentShader: FRAG });
      const depth = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: DEPTH });
      this.litMats.push(lit);
      this.depthMats.push(depth);
      const mesh = new THREE.InstancedMesh(geo, lit, n);
      mesh.frustumCulled = false;
      mesh.userData = { lit, depth, caster: true };
      this.group.add(mesh);
      const list: Beast[] = [];
      for (let i = 0; i < n; i++) {
        const [x, z] = spots[k++ % spots.length];
        const b: Beast = { sp, i, x, z, y: def.flier && sp === 'butterfly' ? 0.4 : 0, head: rnd() * Math.PI * 2, want: 0, state: 'idle', t: rnd() * 3, phase: rnd() * 10, flee: 0, fly: 0, dead: 0, alert: 0, home: [x, z], scale: 0.9 + rnd() * 0.25, def };
        b.want = b.head;
        list.push(b);
        this.beasts.push(b);
      }
      this.meshes.set(sp, { mesh, anim, list });
    }
  }

  /** Draws each animal where it is now: alive ones in place, dead ones gone. */
  sync(time: number) {
    for (const { mesh, anim, list } of this.meshes.values()) {
      for (const b of list) {
        const gone = b.dead > 0;
        const hop = b.state === 'move' && b.def.hop && b.fly === 0 ? Math.abs(Math.sin(b.phase * 0.5)) * b.def.hop * 1.6 : 0;
        this.v.set(b.x, b.y + hop, b.z);
        this.q.setFromAxisAngle(this.Y, -b.head);
        this.s.setScalar(gone ? 0 : b.scale);
        this.m4.compose(this.v, this.q, this.s);
        mesh.setMatrixAt(b.i, this.m4);
        const moving = b.state === 'move' || b.fly > 0 ? 1 : 0;
        const flap = b.def.flier ? (b.fly > 0 || b.sp === 'butterfly' ? time * (b.sp === 'butterfly' ? 26 : 34) + b.phase : Math.sin(time * 0.7 + b.phase) > 0.97 ? time * 30 : 0) : 0;
        anim.setXYZW(b.i, b.phase, moving * (b.fly > 0 ? 0 : 1), flap, b.alert);
      }
      mesh.instanceMatrix.needsUpdate = true;
      anim.needsUpdate = true;
    }
  }

  /** The point where a shot at `b` should aim, its body's middle (and its head). */
  centre(b: Beast, out: THREE.Vector3) {
    return out.set(b.x, b.y + b.def.box[1] * 0.5 * b.scale, b.z);
  }
  headPos(b: Beast, out: THREE.Vector3) {
    const [hx, hy] = b.def.headAt;
    return out.set(b.x + Math.cos(b.head) * hx * b.scale, b.y + hy * b.scale, b.z + Math.sin(b.head) * hx * b.scale);
  }

  /** Sets the shadow (depth) or the lit material on every species. */
  useDepth(on: boolean) {
    for (const { mesh } of this.meshes.values()) mesh.material = on ? (mesh.userData.depth as THREE.Material) : (mesh.userData.lit as THREE.Material);
  }

  /** Its fur's colours, for the bits it bursts into. */
  colours(b: Beast): string[] {
    return b.def.tiles.slice(0, 3).map((t) => {
      const c = t.pal[Math.min(t.pal.length - 1, 2)];
      return `#${[c & 255, (c >>> 8) & 255, (c >>> 16) & 255].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
    });
  }
}
