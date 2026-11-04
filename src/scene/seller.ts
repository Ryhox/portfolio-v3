/**
 * Mira, who keeps the case shop by the lake, made the way 3D pixel-art characters are: few polygons, every
 * surface hand-painted in pixels (the shading painted in too), an ink line round her, a big head with big
 * painted eyes. Cottagecore: ginger hair half up in a bun with a white scrunchie, wavy locks framing her face,
 * a cream blouse with puffed bishop sleeves and lace at the cuffs, a peach corset with lace along the top and a
 * string of pearls, a pale blue skirt printed with little flowers, lace socks and mary-janes, a leather
 * satchel on a strap across her. She stands with a hand on her hip, breathes, shifts her weight, blinks,
 * follows you with her eyes, waves when you come up, cheers when you buy, talks with her hands, and ducks when
 * a bullet goes past.
 */
import * as THREE from 'three';
import { solidMesh, toTexture, type LayerMesh } from './gl';
import { hash2, hex, mix, Pix, ramp, shade, type Ramp } from './pix';

const SKIN = ramp('#cfaa9a', '#e2c0b0', '#eed2c4', '#f6e2d6', '#fbefe8');
const HAIR = ramp('#4e1a0c', '#742810', '#9a3a16', '#bc5020', '#d66a30', '#e88c4c', '#f4b47a');
const CREAM = ramp('#a89c88', '#c8bea8', '#e0d8c6', '#efe9dc', '#f9f5ec', '#fffdf8');
const PEACH = ramp('#a87c64', '#c49880', '#dab29a', '#e9c6ae', '#f4dac6');
const SKY = ramp('#566e8c', '#7690ae', '#94acc6', '#b2c6da', '#ccdcea');
const LEATHER = ramp('#3a200f', '#5a3418', '#7a4a24', '#9a6232', '#b67c44', '#cc9a62');
const INK = hex('#1f1410');

type Face = 'open' | 'blink' | 'happy' | 'wow';

const tex = (p: Pix) => toTexture(p, { mips: false, repeat: true });

/** A painted swatch: one colour with the faintest dither, for skin. */
function swatch(r: Ramp, t: number, seed: number) {
  const p = new Pix(8, 8);
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) p.set(x, y, shade(r, t + (hash2(x, y, seed) - 0.5) * 0.08));
  return p;
}

/**
 * Her face, painted the way 3D pixel-art anime faces are (48 × 36, laid over the front of her head): big round
 * eyes outlined all round in ink, the top line heavy, lots of white with a small green iris and its pupil and a
 * catchlight, lashes flicking out at the outer corners and short ones under the eye; small brows high up under
 * the fringe; the nose no more than a hint; a small mouth a little open. Each expression its own.
 */
function facePix(kind: Face) {
  const p = new Pix(48, 36);
  const c = (h: string) => hex(h);
  const ink = INK;
  const white = c('#fffdf8');
  const whiteS = c('#e6e0dc');
  const iris = c('#2f7a46');
  const irisL = c('#5aa86c');
  const pupil = c('#0a120c');
  const glint = c('#ffffff');
  const brow = c('#6a2410');
  const mouthD = c('#4a1418');
  const mouthIn = c('#8a2c34');
  const tooth = c('#fffaf2');
  // the two eyes, an eye's width apart; `o(i)` runs from the inner corner (0) to the outer one (8)
  for (const [inner, dir] of [[20, -1], [27, 1]] as const) {
    const o = (i: number) => inner + i * dir;
    // small brows, high, mostly under the fringe
    void brow;
    if (kind === 'open' || kind === 'wow') {
      const wide = kind === 'wow';
      // half-lidded, the way the reference has them: a heavy straight lid line, flicked out at the corner
      const top = wide ? 16 : 17;
      for (let i = 0; i <= 8; i++) {
        p.set(o(i), top, ink);
        p.set(o(i), top + 1, ink);
      }
      p.set(o(9), top, ink);
      p.set(o(10), top - 1, ink);
      // the eye under it: a big dark iris filling most of it, a little white either side
      for (let j = top + 2; j <= 22; j++)
        for (let i = 0; i <= 8; i++) {
          const edge = (j === 22 && (i <= 1 || i >= 7)) || i === 0 || i === 8;
          if (edge) {
            if (j < 22 && (i === 0 || i === 8)) p.set(o(i), j, j === top + 2 ? ink : white);
            continue;
          }
          const inIris = wide ? i >= 3 && i <= 5 && j >= top + 3 : i >= 2 && i <= 6;
          if (!inIris) p.set(o(i), j, j === top + 2 ? whiteS : white);
          else p.set(o(i), j, j <= top + 2 ? pupil : j === top + 3 ? c('#14301e') : j >= 21 ? irisL : iris);
        }
      // the pupil, and one small catchlight
      if (!wide) {
        for (const [i, j] of [[3, 20], [4, 20], [5, 20], [4, 21], [3, 19], [4, 19], [5, 19]] as const) p.set(o(i), j, pupil);
        p.set(o(2), top + 3, glint);
      } else p.set(o(4), 19, pupil);
      // the lower line, fine, and the lower lashes as little ticks
      for (let i = 1; i <= 7; i++) p.set(o(i), 23, c('#4a3632'));
      for (const i of [1, 3, 5, 7]) p.set(o(i), 24, ink);
      p.set(o(7), 25, ink);
    } else if (kind === 'blink') {
      // shut: one heavy line, the lashes hanging from it
      for (let i = 0; i <= 8; i++) p.set(o(i), i === 0 || i === 8 ? 19 : 20, ink);
      p.set(o(9), 19, ink);
      for (const i of [2, 4, 6]) p.set(o(i), 21, ink);
    } else {
      // happy: closed in a smile, two arcs
      for (let i = 0; i <= 8; i++) p.set(o(i), i === 0 || i === 8 ? 21 : i === 1 || i === 7 ? 20 : 19, ink);
      p.set(o(9), 20, ink);
    }
    // the faintest warmth on the cheek
    p.set(o(3), 26, c('#f2c2b6'));
    p.set(o(5), 26, c('#f2c2b6'));
  }
  // the nose: only its shade
  p.set(24, 28, c('#dcb4a4'));
  // the mouth
  if (kind === 'wow') {
    for (const [x, y] of [[23, 30], [24, 30], [22, 31], [25, 31], [23, 32], [24, 32]]) p.set(x, y, mouthD);
    p.set(23, 31, mouthIn);
    p.set(24, 31, mouthIn);
  } else if (kind === 'happy') {
    for (let x = 21; x <= 26; x++) p.set(x, 30, mouthD);
    for (let x = 22; x <= 25; x++) p.set(x, 31, mouthIn);
    p.set(22, 31, tooth);
    p.set(23, 32, mouthD);
    p.set(24, 32, mouthD);
  } else {
    // small and a little open, a tiny tooth showing at each side
    for (let x = 21; x <= 26; x++) p.set(x, 30, mouthD);
    p.set(21, 31, mouthD);
    p.set(22, 31, tooth);
    p.set(23, 31, mouthIn);
    p.set(24, 31, mouthIn);
    p.set(25, 31, tooth);
    p.set(26, 31, mouthD);
    for (let x = 22; x <= 25; x++) p.set(x, 32, mouthD);
  }
  // the fringe's shadow on her forehead, just under where its points end
  const shadow = c('#e0bcac');
  for (let x = 4; x < 44; x++) {
    p.set(x, 13, shadow);
    if ((x + 14) % 2 === 0) p.set(x, 14, shadow);
  }
  void tooth;
  return p;
}

/** Ginger hair, painted in strands with dark lines between them and a sheen across; `end` cuts the tips. */
function hairPix(end: 'none' | 'wavy' | 'spiky', seed: number) {
  const W = 32;
  const H = 32;
  const p = new Pix(W, H, true);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (end === 'wavy' && y > H - 7 + Math.round(Math.sin((x / W) * Math.PI * 6) * 3)) continue;
      if (end === 'spiky' && y > H - 1 - Math.abs(((x * 5) % 12) - 6) * 2) continue;
      const strand = Math.floor((x + Math.sin(y * 0.35) * 1.5) / 4);
      let t = 0.5 + (hash2(strand, 0, seed) - 0.5) * 0.25;
      if (((x + Math.round(Math.sin(y * 0.35) * 1.5)) & 3) === 0) t = 0.16;
      // the sheen: a band of light across, broken by the strands
      if (y > 5 && y < 10 && (x + y) % 4 !== 0) t += 0.32;
      t -= (y / H) * 0.12;
      p.set(x, y, shade(HAIR, t));
    }
  return p;
}

/** Cream cotton: soft folds, and (`lace`) a scalloped lace edge at the bottom. */
function cottonPix(lace: boolean) {
  const W = 32;
  const H = 32;
  const p = new Pix(W, H, true);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const fold = Math.sin((x / W) * Math.PI * 2 * 4 + y * 0.08);
      let c = shade(CREAM, 0.68 + fold * 0.16);
      if (lace && y >= H - 7) {
        const sx = x % 6;
        const sy = y - (H - 7);
        if (sy > 3 && Math.hypot(sx - 2.5, (sy - 3) * 1.2) > 3) continue;
        c = (sx + sy) % 3 === 0 ? shade(CREAM, 0.45) : shade(CREAM, 0.95);
      }
      p.set(x, y, c);
    }
  return p;
}

/**
 * Her top, front in the middle: the cream blouse over the shoulders with a square neck and a string of pearls at
 * the collarbone, then the peach corset with lace along its top, boning down it, and laced up the front.
 */
function torsoPix() {
  const W = 48;
  const H = 40;
  const p = new Pix(W, H, true);
  const mid = (W - 1) / 2;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const f = Math.abs(x - mid);
      let c: number;
      if (y < 17) {
        c = shade(CREAM, 0.74 + Math.sin(x * 0.7) * 0.08 - (f > 15 ? 0.12 : 0));
        // the square neck, skin at the collarbones
        if (f < 7 && y > 1 && y < 12) c = shade(SKIN, 0.68 - (y > 9 ? 0.1 : 0));
        // its lace edge
        if (f < 9 && f >= 7 && y > 1 && y < 13) c = (x + y) % 2 ? shade(CREAM, 0.98) : shade(CREAM, 0.6);
        if (f < 9 && y === 12) c = (x % 2) ? shade(CREAM, 0.98) : shade(CREAM, 0.6);
        // the pearls
        if (f < 6 && y === 4 + Math.round((f * f) / 14) && x % 2 === 0) c = hex('#fffdf4');
      } else if (y < 20) {
        // the lace along the corset's top
        c = (x % 4 === 0 && y === 19) || ((x + y) % 2 === 0 && y < 19) ? shade(CREAM, 0.95) : shade(CREAM, 0.7);
        if (y === 19 && x % 4 === 2) c = shade(PEACH, 0.6);
      } else {
        c = shade(PEACH, 0.62 + Math.sin(x * 0.55) * 0.08 - (f > 16 ? 0.15 : 0));
        // boning lines
        if (x % 8 === 3) c = shade(PEACH, 0.35);
        // laced up the front with a cream ribbon
        if (f < 2.2 && (y - x + 60) % 3 === 0) c = shade(CREAM, 0.95);
        if (f >= 2 && f < 3) c = shade(PEACH, 0.2);
        if (y >= H - 2) c = shade(PEACH, 0.3);
      }
      p.set(x, y, c);
    }
  return p;
}

/** The skirt: pale blue with soft folds, printed with little cream and rose flowers on sprigs of sage. */
function skirtPix() {
  const W = 64;
  const H = 40;
  const p = new Pix(W, H, true);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const fold = Math.sin((x / W) * Math.PI * 2 * 7);
      p.set(x, y, shade(SKY, 0.6 + fold * 0.2 - (y < 3 ? 0.25 : 0)));
    }
  const flowers = [
    ['#f6efe0', '#d8a640'],
    ['#e6a8a8', '#c87070'],
    ['#f6efe0', '#d8a640'],
    ['#f2d38a', '#c08a30'],
  ];
  for (let k = 0; k < 40; k++) {
    const fx = Math.floor(hash2(k, 1, 51) * W);
    const fy = 4 + Math.floor(hash2(k, 2, 51) * (H - 8));
    const [petal, heart] = flowers[k % flowers.length].map(hex);
    // a sprig of sage under it
    p.set(fx + 1, fy + 2, hex('#7e9a6a'));
    p.set(fx + 2, fy + 3, hex('#5e7a4c'));
    for (const [dx, dy] of [[0, -1], [-1, 0], [1, 0], [0, 1]]) p.set(fx + dx, fy + dy, petal);
    p.set(fx, fy, heart);
  }
  // a darker hem
  for (let x = 0; x < W; x++) p.set(x, H - 1, shade(SKY, 0.25));
  return p;
}

function leatherPix() {
  const p = new Pix(16, 16, true);
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) {
      let t = 0.55 + (hash2(x >> 1, y >> 1, 61) - 0.5) * 0.15;
      if (y === 0) t = 0.85;
      if (y === 15 || x === 15) t = 0.25;
      // stitching
      if (y === 2 && x % 3 === 0) t = 0.95;
      p.set(x, y, shade(LEATHER, t));
    }
  return p;
}

/** The socks: white with a lace frill at the top. */
function sockPix() {
  const p = new Pix(16, 8, true);
  for (let y = 0; y < 8; y++) for (let x = 0; x < 16; x++) p.set(x, y, y < 2 ? ((x + y) % 2 ? shade(CREAM, 0.98) : shade(CREAM, 0.6)) : shade(CREAM, 0.85 - y * 0.03));
  return p;
}

/** Turns a lathe's or sphere's v round, so row 0 of the paint is at the top. */
function flipV(g: THREE.BufferGeometry) {
  const uv = g.getAttribute('uv') as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i));
  return g;
}
/** Turned on a lathe (front at the middle of the paint), few sides, the way low-poly people are made. */
const lathe = (pts: [number, number][], segs: number) => flipV(new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), segs, Math.PI));

/**
 * A ball shaped into a head (and anything laid over it, by its own radius, the same way, so face and hair stay
 * on): a soft round cranium, a flatter face, full cheeks, and a jaw that narrows to a small chin.
 */
function headShape(g: THREE.BufferGeometry, r: number, lift: number) {
  const p = g.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) p.setXYZ(i, ...headPoint(p.getX(i), p.getY(i), p.getZ(i), r, lift));
  g.computeVertexNormals();
  return g;
}

/**
 * Where a point of a ball of radius `r` goes on her head: the anime head. A round cranium; the face flat; the
 * cheeks widest at the eyes; under them the jaw lines run in nearly straight to a small pointed chin that sits
 * forward and a little low; the back of the jaw tucks in to a slim neck.
 */
function headPoint(x: number, y: number, z: number, r: number, lift: number): [number, number, number] {
  const ny = y / r;
  const nz = z / r;
  let X = x * 0.98;
  let Y = y;
  let Z = z * 0.94;
  if (ny < 0) {
    const t = Math.min(1, -ny);
    // full cheeks that round down into a soft point at the chin: an oval, never a triangle
    const k = Math.pow(t, 1.7);
    X *= 1 - 0.52 * k;
    Z *= nz > 0 ? 1 - 0.1 * k : 1 - 0.45 * k;
    Y *= 1 - 0.04 * t;
    // the chin comes forward a little, the lower it is
    const w = Math.min(1, Math.max(0, (t - 0.6) / 0.4));
    Z += 0.14 * r * w * w * Math.max(0, Math.min(1, 1 + nz * 1.2));
  }
  // the cheeks, full round the eyes
  if (ny > -0.42 && ny < 0.14) X *= 1.04;
  // a flat face
  if (nz > 0.35 && ny > -0.8 && ny < 0.62) Z -= (nz - 0.35) * 0.17 * r;
  return [X, Y + lift, Z];
}

/**
 * A point of hair: a chunky low-poly spike from its root on the head (`theta0`, a band `width` round the head at
 * `phi`) out to its tip (`theta1`, swept `sweep` round), lying on the head's own shape at radius `r0` → `r1`.
 */
function hairSpike(R: number, lift: number, theta0: number, theta1: number, phi: number, width: number, sweep: number, r0: number, r1: number) {
  const at = (theta: number, ph: number, rad: number) => headPoint(-rad * Math.cos(ph) * Math.sin(theta), rad * Math.cos(theta), rad * Math.sin(ph) * Math.sin(theta), R * (rad / R), lift);
  const bl = at(theta0, phi - width / 2, R * r0);
  const br = at(theta0, phi + width / 2, R * r0);
  const back = at(theta0 + 0.08, phi, R * (r0 + 0.06));
  const tip = at(theta1, phi + sweep, R * r1);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([...bl, ...br, ...back, ...tip], 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0.5, 0.1, 0.5, 1], 2));
  g.setIndex([0, 3, 1, 1, 3, 2, 2, 3, 0, 0, 1, 2]);
  g.computeVertexNormals();
  return g;
}

/** A long strand of hair: rooted on her head at (`theta0`, `phi`), `width` round it, hanging to `tip` (head space). */
function hairStrand(R: number, lift: number, theta0: number, phi: number, width: number, tip: [number, number, number]) {
  const at = (theta: number, ph: number, rad: number) => headPoint(-rad * Math.cos(ph) * Math.sin(theta), rad * Math.cos(theta), rad * Math.sin(ph) * Math.sin(theta), rad, lift);
  const v = (p: [number, number, number]) => new THREE.Vector3(...p);
  const bl = v(at(theta0, phi - width / 2, R * 1.1));
  const br = v(at(theta0, phi + width / 2, R * 1.1));
  const back = v(at(theta0 + 0.1, phi, R * 1.17));
  const root = bl.clone().add(br).multiplyScalar(0.5);
  const end = v(tip);
  // a knee halfway down, bowed out round the cheek, the strand narrower there: a tapering three-sided prism
  const knee = root.clone().lerp(end, 0.5);
  knee.x += Math.sign(end.x) * 0.008;
  const across = br.clone().sub(bl).multiplyScalar(0.3);
  const ml = knee.clone().sub(across);
  const mr = knee.clone().add(across);
  const mb = knee.clone().add(back.clone().sub(root).multiplyScalar(0.5));
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([bl, br, back, ml, mr, mb, end].flatMap((p) => [p.x, p.y, p.z]), 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0.5, 0.05, 0.2, 0.5, 0.8, 0.5, 0.5, 0.55, 0.5, 1], 2));
  g.setIndex([0, 3, 1, 1, 3, 4, 1, 4, 2, 2, 4, 5, 2, 5, 0, 0, 5, 3, 3, 6, 4, 4, 6, 5, 5, 6, 3, 0, 1, 2]);
  g.computeVertexNormals();
  return g;
}

/** A ribbon of hair, `w` wide, hanging from `from` through `pts` (each a little further down), twisting gently. */
function ribbon(pts: [number, number, number][], w: number, face: [number, number, number]) {
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const n = new THREE.Vector3(...face).normalize();
  pts.forEach(([x, y, z], i) => {
    const next = pts[Math.min(pts.length - 1, i + 1)];
    const prev = pts[Math.max(0, i - 1)];
    const d = new THREE.Vector3(next[0] - prev[0], next[1] - prev[1], next[2] - prev[2]).normalize();
    const side = new THREE.Vector3().crossVectors(d, n).normalize().multiplyScalar((w / 2) * (1 - (i / pts.length) * 0.3));
    pos.push(x - side.x, y - side.y, z - side.z, x + side.x, y + side.y, z + side.z);
    const v = i / (pts.length - 1);
    uv.push(0, v, 1, v);
    if (i > 0) {
      const a = (i - 1) * 2;
      idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** The ink line round her: each part again, a hair bigger, its back faces drawn dark. */
const OUTLINE = new THREE.ShaderMaterial({
  uniforms: { thick: { value: 0.0021 } },
  vertexShader: /* glsl */ `
    uniform float thick;
    void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position + normal * thick, 1.0); }`,
  fragmentShader: /* glsl */ `void main() { gl_FragColor = vec4(0.12, 0.08, 0.063, 1.0); }`,
  side: THREE.BackSide,
});

export class Seller {
  readonly group = new THREE.Group();
  readonly meshes: LayerMesh[] = [];
  private torso = new THREE.Group();
  private head = new THREE.Group();
  private hairBack = new THREE.Group();
  private arms: { up: THREE.Group; fore: THREE.Group }[] = [];
  private faces: Record<Face, THREE.Texture>;
  private face: LayerMesh;
  private blinkAt = 2;
  private mood: 'idle' | 'wave' | 'cheer' | 'flinch' = 'idle';
  private moodT = 0;
  private lookYaw = 0;
  private lookPitch = 0;
  private pose = { l: [0.62, 0, -1.55, 0], r: [-0.14, 0.05, -0.18, -0.25] };
  talking = false;

  constructor(x: number, z: number, faceYaw: number) {
    this.group.position.set(x, 0, z);
    this.group.rotation.y = faceYaw;
    const part = (g: THREE.BufferGeometry, t: THREE.Texture, parent: THREE.Object3D, line = true) => {
      const m = solidMesh(g, t, true, true);
      m.userData.playOnly = true;
      m.frustumCulled = false;
      if (line) {
        const o = new THREE.Mesh(g, OUTLINE);
        o.frustumCulled = false;
        m.add(o);
      }
      parent.add(m);
      this.meshes.push(m);
      return m;
    };
    const skin = tex(swatch(SKIN, 0.62, 331));
    const cotton = tex(cottonPix(false));
    const lace = tex(cottonPix(true));
    const leather = tex(leatherPix());

    // feet: mary-janes, lace socks, slim legs under the skirt
    for (const sx of [-1, 1]) {
      const shoe = new THREE.BoxGeometry(0.03, 0.02, 0.054, 1, 1, 1);
      shoe.translate(sx * 0.024, 0.01, 0.01);
      part(shoe, leather, this.group);
      const sock = flipV(new THREE.CylinderGeometry(0.0135, 0.0128, 0.04, 6, 1));
      sock.translate(sx * 0.024, 0.038, 0);
      part(sock, tex(sockPix()), this.group);
      const leg = new THREE.CylinderGeometry(0.0145, 0.012, 0.13, 6);
      leg.translate(sx * 0.023, 0.12, 0);
      part(leg, skin, this.group);
    }
    // the skirt, to mid-calf, its hem falling in soft waves
    const skirt = lathe([[0.044, 0.43], [0.054, 0.41], [0.068, 0.36], [0.082, 0.28], [0.093, 0.2], [0.1, 0.13]], 12);
    const sp = skirt.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < sp.count; i++) {
      const a = Math.atan2(sp.getX(i), sp.getZ(i));
      if (sp.getY(i) < 0.15) sp.setY(i, sp.getY(i) + Math.sin(a * 6) * 0.005);
      sp.setZ(i, sp.getZ(i) * 0.88);
    }
    skirt.computeVertexNormals();
    part(skirt, tex(skirtPix()), this.group);

    // from the waist up, turning at the waist
    this.torso.position.set(0, 0.42, 0);
    this.group.add(this.torso);
    const body = lathe([[0.046, -0.01], [0.041, 0.015], [0.039, 0.035], [0.044, 0.06], [0.051, 0.078], [0.054, 0.09], [0.053, 0.102], [0.05, 0.112], [0.052, 0.122], [0.054, 0.13], [0.044, 0.142], [0.016, 0.152]], 12);
    const bp = body.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < bp.count; i++) {
      const bx = bp.getX(i);
      const by = bp.getY(i);
      let bz = bp.getZ(i);
      // the bust, high under the lace
      if (bz > 0 && by > 0.062 && by < 0.116) {
        const r = Math.hypot(bx, bz) || 1;
        bz += 0.016 * Math.sin((Math.PI * (by - 0.062)) / 0.054) * Math.pow(Math.max(0, bz / r), 2);
      }
      bp.setX(i, bx * 1.12);
      bp.setZ(i, bz * 0.8);
    }
    body.computeVertexNormals();
    part(body, tex(torsoPix()), this.torso);
    const neck = new THREE.CylinderGeometry(0.0104, 0.0122, 0.048, 6);
    neck.translate(0, 0.165, 0);
    part(neck, skin, this.torso);
    // the satchel on its strap, across her from the right shoulder to the left hip
    const strapFrom = new THREE.Vector3(-0.048, 0.128, 0.03);
    const strapTo = new THREE.Vector3(0.074, -0.03, 0.046);
    const strapLen = strapFrom.distanceTo(strapTo);
    const strap = new THREE.BoxGeometry(0.008, strapLen, 0.004);
    strap.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), strapTo.clone().sub(strapFrom).normalize()));
    strap.translate((strapFrom.x + strapTo.x) / 2, (strapFrom.y + strapTo.y) / 2, (strapFrom.z + strapTo.z) / 2 + 0.012);
    part(strap, leather, this.torso);
    const bag = new THREE.BoxGeometry(0.068, 0.056, 0.026);
    bag.rotateY(0.25);
    bag.translate(0.084, -0.06, 0.03);
    part(bag, leather, this.torso);
    const flap = new THREE.BoxGeometry(0.07, 0.03, 0.028);
    flap.rotateY(0.25);
    flap.translate(0.084, -0.043, 0.033);
    part(flap, tex(swatch(LEATHER, 0.75, 371)), this.torso);
    const buckle = new THREE.BoxGeometry(0.012, 0.01, 0.006);
    buckle.rotateY(0.25);
    buckle.translate(0.087, -0.055, 0.05);
    part(buckle, tex(swatch(ramp('#8a6a2a', '#c9a04a', '#e8c873'), 0.6, 372)), this.torso, false);

    // the arms, in bishop sleeves: puffed at the shoulder, full down to a gathered cuff and a frill of lace
    for (const sx of [1, -1]) {
      const up = new THREE.Group();
      up.position.set(sx * 0.058, 0.122, 0);
      this.torso.add(up);
      const upper = lathe([[0.012, 0.01], [0.022, -0.004], [0.024, -0.03], [0.021, -0.07], [0.02, -0.112]], 8);
      part(upper, cotton, up);
      const fore = new THREE.Group();
      fore.position.set(0, -0.11, 0);
      up.add(fore);
      const sleeve = lathe([[0.02, 0.004], [0.024, -0.03], [0.03, -0.066], [0.031, -0.08], [0.016, -0.088]], 8);
      part(sleeve, cotton, fore);
      const frill = lathe([[0.015, -0.086], [0.021, -0.1]], 8);
      part(frill, lace, fore);
      const hand = new THREE.BoxGeometry(0.016, 0.026, 0.01);
      hand.translate(0, -0.11, 0);
      part(hand, skin, fore);
      this.arms.push({ up, fore });
    }

    // the head, big, on the neck: her face painted on its front, her hair over and round it
    this.head.position.set(0, 0.182, 0);
    // the head a sixth of her height, as in the reference
    this.head.scale.setScalar(0.9);
    this.torso.add(this.head);
    const R = 0.06;
    const lift = 0.055;
    part(headShape(new THREE.SphereGeometry(R, 12, 10), R, lift), skin, this.head);
    this.faces = { open: tex(facePix('open')), blink: tex(facePix('blink')), happy: tex(facePix('happy')), wow: tex(facePix('wow')) };
    const fg = headShape(flipV(new THREE.SphereGeometry(R * 1.01, 16, 12, Math.PI / 2 - 0.85, 1.7, 0.8, 1.32)), R * 1.01, lift);
    this.face = part(fg, this.faces.open, this.head, false);
    const hair = tex(hairPix('none', 351));
    // the crown of her hair, and the back and sides down past her jaw
    part(headShape(flipV(new THREE.SphereGeometry(R * 1.09, 14, 8, 0, Math.PI * 2, 0, 1.02)), R * 1.09, lift), hair, this.head);
    part(headShape(flipV(new THREE.SphereGeometry(R * 1.13, 14, 9, Math.PI / 2 + 0.95, Math.PI * 2 - 1.9, 0.6, 1.95)), R * 1.13, lift), hair, this.head);
    // the fringe: long chunky points of every length, the ones over her eyes stopping just above them, one down
    // between them, the outer ones longer, down past her cheeks
    const spike = tex(hairPix('none', 352));
    const front = Math.PI / 2;
    const fringe: [number, number, number, number][] = [
      [-0.95, 1.6, 0.05, 0.42], [-0.68, 1.46, 0.06, 0.38], [-0.42, 1.31, 0.05, 0.34], [-0.2, 1.33, 0.03, 0.3], [0, 1.68, 0, 0.24],
      [0.2, 1.31, -0.03, 0.3], [0.42, 1.34, -0.05, 0.34], [0.68, 1.48, -0.06, 0.38], [0.95, 1.62, -0.04, 0.42],
    ];
    for (const [off, end, sweep, w] of fringe) part(hairSpike(R, lift, 0.95, end, front + off, w, sweep, 1.1, 1.045), spike, this.head, false);
    // long jagged strands from the temples down past her jaw to her shoulders, either side of her face
    const strands: [number, number, number, number][] = [[1.12, 0.06, -0.08, 0.034], [1.32, 0.072, -0.13, 0.014], [1.52, 0.077, -0.16, -0.006], [1.78, 0.07, -0.14, -0.026]];
    for (const sx of [-1, 1])
      for (const [off, tx, ty, tz] of strands) part(hairStrand(R, lift, 1.05, front + sx * off, 0.46, [sx * tx, lift + ty, tz]), spike, this.head, false);
    // two pointed tufts standing up off the crown, and strands flicking out at the sides, as in the reference
    for (const sx of [-1, 1]) {
      // a wide triangular tuft, rooted along the crown, its point up and out
      part(hairSpike(R, lift, 0.85, 0.3, front + sx * 1.15, 0.95, 0, 1.08, 1.6), spike, this.head, false);
      part(hairSpike(R, lift, 1.25, 1.8, front + sx * 1.45, 0.42, sx * 0.1, 1.1, 1.4), spike, this.head, false);
      part(hairSpike(R, lift, 1.55, 2.15, front + sx * 1.7, 0.4, sx * 0.12, 1.1, 1.36), spike, this.head, false);
    }
    // the half-up bun at the back, tied with a white scrunchie
    const bun = new THREE.SphereGeometry(0.03, 8, 6);
    bun.translate(0, lift + 0.05, -0.052);
    part(bun, hair, this.head);
    const scrunchie = new THREE.TorusGeometry(0.024, 0.009, 5, 10);
    scrunchie.rotateX(-0.9);
    scrunchie.translate(0, lift + 0.038, -0.04);
    part(scrunchie, lace, this.head);
    // the rest of it, long down her back, its ends in jagged points
    this.hairBack.position.set(0, lift - 0.01, 0);
    this.head.add(this.hairBack);
    const fall = new THREE.CylinderGeometry(0.066, 0.078, 0.22, 12, 3, true, 1.3, Math.PI * 2 - 2.6);
    fall.translate(0, -0.1, -0.006);
    part(flipV(fall), tex(hairPix('spiky', 353)), this.hairBack, false);
    void mix;
    void ribbon;
  }

  /** She waves (as you come up). */
  wave() {
    if (this.mood === 'flinch') return;
    this.mood = 'wave';
    this.moodT = 0;
  }
  /** A little cheer when you buy something. */
  cheer() {
    this.mood = 'cheer';
    this.moodT = 0;
  }
  /** A shot went past her. */
  flinch() {
    this.mood = 'flinch';
    this.moodT = 0;
  }

  /** `px`, `pz`: where you are, `eye`: how high your eyes are. */
  update(dt: number, now: number, px: number, pz: number, eye: number) {
    this.moodT += dt;
    const g = this.group;
    // where you are, as she stands: ahead of her is +z, and she only turns her head so far
    const dx = px - g.position.x;
    const dz = pz - g.position.z;
    const local = Math.atan2(dx, dz) - g.rotation.y;
    let yaw = Math.atan2(Math.sin(local), Math.cos(local));
    const dist = Math.hypot(dx, dz);
    if (Math.abs(yaw) > 1.9 || dist > 14) yaw = 0;
    yaw = Math.max(-1.05, Math.min(1.05, yaw));
    const pitch = Math.max(-0.35, Math.min(0.35, Math.atan2(eye - 0.66, Math.max(0.3, dist))));
    const k = 1 - Math.exp(-dt * 5);
    this.lookYaw += (yaw - this.lookYaw) * k;
    this.lookPitch += (pitch - this.lookPitch) * k;
    // poses: [upper arm out, upper arm forward, forearm bend, forearm forward] for her left and right arm
    let L = [0.62, 0, -1.55, 0];
    let Rr = [-0.14, 0.05, -0.18, -0.25];
    let bounce = 0;
    let crouch = 0;
    let tilt = 0;
    let lean = 0;
    let face: Face = 'open';
    const t = this.moodT;
    if (this.mood === 'wave') {
      // up beside her head (a little overshoot as it gets there), the forearm upright, the hand waved from the
      // elbow three or four times, her head tipped towards it, then down again
      const T = 2.3;
      if (t > T) this.mood = 'idle';
      const rise = Math.min(1, t / 0.32);
      const up = (1 + 2.2 * Math.pow(rise - 1, 3) + 1.2 * Math.pow(rise - 1, 2)) * (t > T - 0.35 ? Math.max(0, (T - t) / 0.35) : 1);
      const waving = t > 0.3 && t < T - 0.35 ? Math.sin((t - 0.3) * 13.5) : 0;
      Rr = [-0.14 - 1.96 * up, 0.25 * up, -0.18 * (1 - up) + (1.04 + waving * 0.38) * up, 0.12 * up];
      tilt = 0.1 * up;
      lean = -0.03 * up;
      face = t > 0.25 && t < T - 0.3 ? 'happy' : 'open';
    } else if (this.mood === 'cheer') {
      if (t > 1.4) this.mood = 'idle';
      const up = Math.min(1, t / 0.2) * Math.min(1, (1.4 - t) / 0.3);
      L = [0.62 + 1.9 * up, 0, -1.55 + 1.2 * up, 0];
      Rr = [-0.14 - 2.4 * up, 0, -0.18 + 0.4 * up, 0];
      bounce = Math.abs(Math.sin(t * 9)) * 0.012 * up;
      face = 'happy';
    } else if (this.mood === 'flinch') {
      if (t > 1.2) this.mood = 'idle';
      const up = Math.min(1, t / 0.08) * Math.min(1, (1.2 - t) / 0.35);
      L = [0.62 - 0.4 * up, -1.6 * up, -1.55 + 0.1 * up, -1.2 * up];
      Rr = [-0.14 + 0.15 * up, -1.6 * up, -0.18 - 0.6 * up, -1.2 * up];
      crouch = 0.035 * up;
      face = 'wow';
    } else if (this.talking) {
      // talking with her hands: the forearm brought forward, palm up, moving as she talks
      Rr = [-0.22, -0.12, 0.25 + Math.sin(now * 3.1) * 0.15, -1.15 + Math.sin(now * 2.3) * 0.2];
      tilt = Math.sin(now * 0.9) * 0.06;
    }
    // ease into the pose
    const kp = 1 - Math.exp(-dt * 14);
    this.pose.l = this.pose.l.map((v, i) => v + (L[i] - v) * kp);
    this.pose.r = this.pose.r.map((v, i) => v + (Rr[i] - v) * kp);
    for (const [arm, p, sx] of [[this.arms[0], this.pose.l, 1], [this.arms[1], this.pose.r, -1]] as const) {
      arm.up.rotation.set(p[1], 0, p[0]);
      arm.fore.rotation.set(p[3], 0, p[2] * (sx > 0 ? 1 : -1));
    }
    // breathing, the weight shifting from hip to hip, the head turned to you, the hair swinging after it
    const breathe = Math.sin(now * 1.7);
    this.torso.scale.set(1, 1 + breathe * 0.008, 1 + breathe * 0.01);
    this.torso.position.y = 0.42 - crouch;
    g.position.y = bounce;
    g.rotation.z = Math.sin(now * 0.55) * 0.012;
    this.torso.rotation.set(crouch * 3, this.lookYaw * 0.25, -Math.sin(now * 0.55) * 0.02 + lean);
    this.head.rotation.set(-this.lookPitch + crouch * 4 + Math.sin(now * 0.8) * 0.02, this.lookYaw * 0.75, Math.sin(now * 0.45) * 0.05 + tilt);
    this.hairBack.rotation.set(Math.max(0, -this.lookPitch) * 0.5 + 0.06, -this.lookYaw * 0.2, 0);
    // blinking
    if (now > this.blinkAt) this.blinkAt = now + 2.4 + hash2(Math.floor(now), 7, 3) * 3;
    const blink = this.blinkAt - now > 0 && this.blinkAt - now < 0.12;
    const want = face === 'open' && blink ? this.faces.blink : this.faces[face];
    if (this.face.material.uniforms.map.value !== want) this.face.material.uniforms.map.value = want;
  }
}
