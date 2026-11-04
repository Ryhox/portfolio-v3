/**
 * What you carry in pill mode, each a real 3D model held in view (no hands, the way the rifle always was): the
 * bolt-action rifle with its scope, a pump shotgun, and a butterfly knife. Pixel textures, light in hard steps
 * with a glint on the metal, a dark outline round every part. Drawn in their own small pass at the game's pixel
 * size and laid over the view, so they never poke into a tree you stand against.
 *
 * The weapons keep their own time: the bolt, the pump, the reloads (a magazine; shells one by one), the knife's
 * slash and stab, swapping, and inspecting (F): the rifle turned over, the shotgun racked for show, and the
 * butterfly knife flipped open and spun the way they do it on the servers.
 */
import * as THREE from 'three';
import { sfx } from '@/sound/sfx';
import type { Role } from './loot';
import { hash2, mulberry, Pix, ramp, shade, type Ramp } from './pix';

export type WeaponId = 'rifle' | 'shotgun' | 'knife';
export const WEAPONS: WeaponId[] = ['rifle', 'shotgun', 'knife'];

// warm ramps, the wood's own: gunmetal with brown in it, never a cold blue-grey
const WOOD = ramp('#2e170b', '#4a2612', '#69381a', '#8a4e24', '#a8682e', '#c4853c', '#dca456');
const WALNUT = ramp('#20110a', '#341c10', '#4c2a17', '#663a1f', '#804c28', '#9c6034');
const METAL = ramp('#141210', '#211e1a', '#302c26', '#433e36', '#5c554a', '#7e7566');
const STEEL = ramp('#4a4740', '#6a665c', '#8c877a', '#aea898', '#cdc6b4', '#ece6d4');
const SCOPE = ramp('#100e0c', '#1a1714', '#25211c', '#332e27', '#463f35', '#605747');
const BRASS = ramp('#6e4f1c', '#9a7430', '#c9a04a', '#e8c873', '#f6e3a4');
const HULL = ramp('#4a1210', '#7a1e18', '#a82a22', '#c8402e', '#e05a40');
const GOLD = ramp('#6a4a10', '#9a7018', '#c89a28', '#e8c448', '#f8e080', '#fff4c0');
const HANDLE = ramp('#16100c', '#241a14', '#36281e', '#4a3828', '#624a34');

/**
 * A tile of paint, laid on the weapon at one texel to one screen pixel (never stretched): wood with long grain
 * lines and a knot now and then, metal with faint brushing and the odd scratch, the knife's handles with their
 * row of holes. Seamless both ways.
 */
const TW = 64;
const TH = 32;
/** Texels to a unit of the weapon: about one to a screen pixel where it's held. */
const DENSITY = 440;
function tile(pal: Ramp, kind: 'grain' | 'plain' | 'holes' | 'knurl', seed: number) {
  const p = new Pix(TW, TH, true);
  const TAU = Math.PI * 2;
  for (let y = 0; y < TH; y++)
    for (let x = 0; x < TW; x++) {
      // flat tones, the way pixel art paints a surface: one colour with a few deliberate marks, never a speckle
      const steps = pal.length - 1;
      const at = (i: number) => i / steps;
      let t = at(Math.round(steps * 0.55));
      if (kind === 'grain') {
        // grain runs along the weapon: dark lines that wander a little up and down, a light streak now and then
        const v = y + Math.sin((x / TW) * TAU + seed) * 2.4 + Math.sin((x / TW) * TAU * 3 + seed * 2) * 0.8;
        const band = ((v % 7) + 7) % 7;
        if (band < 1) t -= 1 / steps;
        else if (band > 5.6 && hash2(x >> 4, Math.floor(v / 7), seed) > 0.5) t += 1 / steps;
      }
      if (kind === 'plain') {
        // brushed: a short light streak here and there along the length, a rare dark scratch
        const h = hash2(x >> 3, y, seed + 2);
        if (h > 0.94) t += 1 / steps;
        else if (h < 0.015) t -= 1 / steps;
      }
      if (kind === 'knurl') t += (x + y) % 3 === 0 ? 0.15 : (x - y + 96) % 3 === 0 ? -0.15 : 0;
      // the butterfly knife's handles: a row of holes down the middle of each
      if (kind === 'holes' && (y < 3 || y > TH - 3) && x % 8 > 1 && x % 8 < 6) t = 0.0;
      p.set(x, y, shade(pal, t));
    }
  if (kind === 'grain') {
    // a knot or two
    const rnd = mulberry(seed);
    for (let i = 0; i < 2; i++) {
      const kx = Math.floor(rnd() * TW);
      const ky = Math.floor(rnd() * TH);
      for (let j = -1; j <= 1; j++) for (let k = -2; k <= 2; k++) if (Math.abs(k) + Math.abs(j) < 3) p.set(kx + k, (ky + j + TH) % TH, shade(pal, Math.abs(k) + Math.abs(j) === 0 ? 0.05 : 0.25));
    }
  }
  const tex = new THREE.DataTexture(new Uint8Array(p.data.buffer), p.w, p.h, THREE.RGBAFormat, THREE.UnsignedByteType);
  tex.magFilter = tex.minFilter = THREE.NearestFilter;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.NoColorSpace;
  tex.needsUpdate = true;
  return tex;
}

const VERT = /* glsl */ `
uniform float inflate;
uniform mat4 local;
varying vec3 vNormal;
varying vec2 vUv;
varying vec3 vPos;
varying vec3 vLocalN;
void main() {
  vUv = uv;
  vNormal = normalize(mat3(modelMatrix) * normal);
  // where on the weapon this is (for a skin's paint, which wraps the whole weapon at one scale)
  vPos = (local * vec4(position, 1.0)).xyz;
  vLocalN = mat3(local) * normal;
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position + normal * inflate, 1.0);
}`;

const FRAG = /* glsl */ `
uniform sampler2D map;
uniform float shade;
uniform float metal;
uniform float density;
varying vec3 vNormal;
varying vec2 vUv;
varying vec3 vPos;
varying vec3 vLocalN;
void main() {
  vec3 n = normalize(vNormal);
  vec3 L = normalize(vec3(-0.45, 0.8, 0.5));
  float d = dot(n, L);
  // the paint laid on from the side, the top or the front, whichever way the face looks, at the screen's own
  // pixel size along the whole weapon (a skin wraps it the same way)
  vec3 a = abs(vLocalN);
  vec2 uv = (a.x >= a.y && a.x >= a.z ? vPos.zy : a.y >= a.z ? vPos.zx : vPos.xy) * density;
  vec3 c = texture2D(map, uv).rgb;
  // pixel-art light in three hard steps: warm where it's lit, cool and a little violet in the shade
  vec3 tint = d > 0.55 ? vec3(1.08, 1.03, 0.94) : d > 0.05 ? vec3(0.82, 0.8, 0.82) : vec3(0.55, 0.52, 0.64);
  c *= tint * shade;
  // a hard glint where the metal (or lacquer) catches the light
  float s = dot(n, normalize(L + vec3(0.0, 0.0, 1.0)));
  if (metal > 0.5 && s > 0.95) c += vec3(0.26, 0.24, 0.2) * shade;
  gl_FragColor = vec4(c, 1.0);
}`;

/**
 * Lays the weapon over the view the way the wood's sprites are drawn: a one-pixel line of warm ink all round it,
 * a dark line wherever a nearer part's edge lies over a farther one (the scope over the receiver, the pump over
 * the tube), and its own edge a shade darker on the side away from the light.
 */
const COMPOSITE = /* glsl */ `
uniform sampler2D map;
uniform sampler2D depth;
uniform vec2 res;
uniform vec2 tres;
uniform float margin;
uniform vec2 off;
varying vec2 vUv;
float lin(float d) {
  float z = d * 2.0 - 1.0;
  return 2.0 * 0.02 * 220.0 / (220.0 + 0.02 - z * (220.0 - 0.02));
}
void main() {
  vec2 px = 1.0 / tres;
  // the picture moved by whole pixels; it was drawn with a margin all round, so moving it never shows a cut edge
  vec2 vUv = (vUv * res - off + margin) / tres;
  if (vUv.x < 0.0 || vUv.y < 0.0 || vUv.x > 1.0 || vUv.y > 1.0) discard;
  vec4 c = texture2D(map, vUv);
  float aL = texture2D(map, vUv - vec2(px.x, 0.0)).a;
  float aR = texture2D(map, vUv + vec2(px.x, 0.0)).a;
  float aD = texture2D(map, vUv - vec2(0.0, px.y)).a;
  float aU = texture2D(map, vUv + vec2(0.0, px.y)).a;
  vec3 ink = vec3(0.102, 0.078, 0.063);
  if (c.a < 0.5) {
    if (max(max(aL, aR), max(aU, aD)) > 0.5) gl_FragColor = vec4(ink, 1.0);
    else discard;
    return;
  }
  float d = lin(texture2D(depth, vUv).r);
  float n = min(min(lin(texture2D(depth, vUv - vec2(px.x, 0.0)).r), lin(texture2D(depth, vUv + vec2(px.x, 0.0)).r)), min(lin(texture2D(depth, vUv - vec2(0.0, px.y)).r), lin(texture2D(depth, vUv + vec2(0.0, px.y)).r)));
  vec3 col = c.rgb;
  if (n < d - 0.014) col = mix(col, ink, 0.82);
  else if (aD < 0.5 || aR < 0.5) col *= 0.72;
  gl_FragColor = vec4(col, 1.0);
}`;

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const seg = (t: number, a: number, b: number) => clamp01((t - a) / (b - a));

type Action = 'idle' | 'fire' | 'reload' | 'inspect' | 'deploy' | 'slash' | 'stab';
/** The knife's quick swings: a sweep either way, a jab, a rising cut, and the spinning finisher of a combo. */
export type Swing = 'left' | 'right' | 'jab' | 'upper' | 'spin';
const SWING_TIME: Record<Swing, number> = { left: 0.58, right: 0.58, jab: 0.46, upper: 0.62, spin: 0.85 };

const AXIS_X = new THREE.Vector3(1, 0, 0);
const AXIS_Y = new THREE.Vector3(0, 1, 0);
const AXIS_Z = new THREE.Vector3(0, 0, 1);
/**
 * A way of holding the knife: the blade pointing along `dir` (its tip), the flat of it turned towards `face`.
 * The knife's own blade runs along -z, its flat faces x, its edge is +y once open.
 */
function hold(dir: THREE.Vector3, face: THREE.Vector3) {
  const z = dir.clone().normalize().negate();
  const x = face.clone().addScaledVector(z, -face.dot(z)).normalize();
  const y = new THREE.Vector3().crossVectors(z, x);
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
}
/** At rest: up and to the left across the corner, the flat to you, edge down. Stabbing: straight ahead. */
const KNIFE_HOLD = hold(new THREE.Vector3(-0.5, 0.55, -0.67), new THREE.Vector3(0.25, 0.1, 1));
const STAB_DIR = new THREE.Vector3(-0.22, 0.16, -1).normalize();
const KNIFE_STAB = hold(STAB_DIR, new THREE.Vector3(0.6, 1, 0.3));

export class Arms {
  readonly scene = new THREE.Scene();
  readonly cam = new THREE.PerspectiveCamera(60, 1, 0.02, 220);
  private target = new THREE.WebGLRenderTarget(4, 4, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, generateMipmaps: false, depthTexture: new THREE.DepthTexture(4, 4) });
  private rigs: Record<WeaponId, THREE.Group> = { rifle: new THREE.Group(), shotgun: new THREE.Group(), knife: new THREE.Group() };
  private mats: THREE.ShaderMaterial[] = [];
  private composite: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
  private post = new THREE.Scene();
  private postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private lens: THREE.ShaderMaterial;
  private tmp = new THREE.Vector3();
  private phase = 0;
  private sway = new THREE.Vector2();
  // the rifle's moving parts
  private bolt = new THREE.Group();
  private mag = new THREE.Group();
  // the shotgun's
  private pump = new THREE.Group();
  private loadShell!: THREE.Mesh;
  // the knife's: the safe handle stays in the hand; the blade and the bite handle swing round their pins
  private safe = new THREE.Group();
  private bite = new THREE.Group();
  private blade = new THREE.Group();
  private brass: { mesh: THREE.Mesh; v: THREE.Vector3; spin: THREE.Vector3; age: number; kind: 'brass' | 'hull' }[] = [];
  /** every part a skin can paint: its material, what it is, whose it is, and its own paint */
  private paintable: { mat: THREE.ShaderMaterial; role: Role; weapon: WeaponId; base: THREE.Texture; metal: number }[] = [];
  /** the skin each weapon wears now (a key, so the same one isn't painted twice) */
  private worn: Record<WeaponId, string> = { rifle: '', shotgun: '', knife: '' };
  private emitted = true;
  /** where the finished picture is moved to this frame, in whole pixels (the bob, the sway, coming up) */
  private off = new THREE.Vector2();
  private margin = 0;
  /** the knife's swing, and how far into a combo it is */
  swing: Swing = 'left';
  combo = 0;
  private comboAt = -9;

  current: WeaponId = 'rifle';
  private wanted: WeaponId = 'rifle';
  last: WeaponId = 'knife';
  action: Action = 'deploy';
  /** seconds into the current action */
  t = 0;
  kick = 0;
  ammo = { rifle: 5, shotgun: 6 };
  readonly max = { rifle: 5, shotgun: 6 };
  private reloadShells = 0;
  private lowering = 0;
  /** the knife is gold once every toadstool on the page has been found */
  gold = false;

  constructor(gold = false) {
    this.gold = gold;
    const wood = tile(WOOD, 'grain', 901);
    const walnut = tile(WALNUT, 'grain', 905);
    const metal = tile(METAL, 'plain', 902);
    const scope = tile(SCOPE, 'plain', 903);
    const brass = tile(BRASS, 'plain', 904);
    const hull = tile(HULL, 'plain', 906);
    const steel = tile(gold ? GOLD : STEEL, 'plain', 907);
    const handles = tile(gold ? GOLD : HANDLE, 'holes', 908);
    const knurl = tile(METAL, 'knurl', 909);
    const fiber = tile(ramp('#c8461a', '#e86424', '#ff8a34', '#ffb05a'), 'plain', 910);
    let weaponOf: WeaponId = 'rifle';
    const part = (g: THREE.BufferGeometry, tex: THREE.Texture, isMetal: boolean, at: [number, number, number], rot: [number, number, number] = [0, 0, 0], parent: THREE.Object3D, role?: Role) => {
      const mat = new THREE.ShaderMaterial({
        uniforms: { map: { value: tex }, shade: { value: 1 }, metal: { value: isMetal ? 1 : 0 }, inflate: { value: 0 }, local: { value: new THREE.Matrix4() }, density: { value: DENSITY } },
        vertexShader: VERT,
        fragmentShader: FRAG,
      });
      this.mats.push(mat);
      const m = new THREE.Mesh(g, mat);
      m.position.set(...at);
      m.rotation.set(...rot);
      m.updateMatrix();
      mat.uniforms.local.value.copy(m.matrix);
      if (role) this.paintable.push({ mat, role, weapon: weaponOf, base: tex, metal: isMetal ? 1 : 0 });
      // (the outline is drawn round the whole weapon when it's laid over the view)
      parent.add(m);
      return m;
    };
    const box = (w: number, h: number, l: number) => new THREE.BoxGeometry(w, h, l);
    const tube = (r0: number, r1: number, l: number, n = 8) => new THREE.CylinderGeometry(r0, r1, l, n).rotateX(Math.PI / 2);

    // --- the rifle: it lies along -z, muzzle forward, sights up ---------------------------------------------
    const R = this.rigs.rifle;
    weaponOf = 'rifle';
    part(tube(0.016, 0.019, 0.62), metal, true, [0, 0, -0.56], [0, 0, 0], R, 'metal');
    part(tube(0.022, 0.022, 0.03), metal, true, [0, 0, -0.86], [0, 0, 0], R);
    part(box(0.008, 0.026, 0.012), metal, true, [0, 0.026, -0.84], [0, 0, 0], R);
    part(box(0.062, 0.07, 0.27), metal, true, [0, -0.004, -0.11], [0, 0, 0], R, 'metal');
    part(box(0.07, 0.05, 0.36), wood, false, [0, -0.04, -0.4], [0, 0, 0], R, 'body');
    part(box(0.072, 0.11, 0.38), wood, false, [0, -0.07, 0.2], [0.1, 0, 0], R, 'body');
    part(box(0.07, 0.07, 0.12), wood, false, [0, -0.13, 0.36], [0.22, 0, 0], R, 'body');
    part(box(0.074, 0.13, 0.016), metal, false, [0, -0.1, 0.42], [0.1, 0, 0], R);
    part(box(0.052, 0.1, 0.06), wood, false, [0, -0.08, 0.02], [-0.45, 0, 0], R, 'body');
    part(box(0.012, 0.008, 0.09), metal, true, [0, -0.07, -0.08], [0, 0, 0], R);
    part(box(0.012, 0.04, 0.008), metal, true, [0, -0.052, -0.125], [0, 0, 0], R);
    part(box(0.006, 0.03, 0.006), metal, true, [0, -0.05, -0.085], [0.3, 0, 0], R);
    part(tube(0.031, 0.031, 0.3), scope, true, [0, 0.09, -0.12], [0, 0, 0], R, 'scope');
    part(tube(0.036, 0.031, 0.06), scope, true, [0, 0.09, 0.06], [0, 0, 0], R, 'scope');
    part(tube(0.033, 0.045, 0.07), scope, true, [0, 0.09, -0.3], [0, 0, 0], R, 'scope');
    part(tube(0.013, 0.013, 0.03, 6), scope, true, [0, 0.13, -0.12], [Math.PI / 2, 0, 0], R, 'scope');
    for (const z of [-0.2, -0.04]) part(box(0.03, 0.06, 0.022), scope, true, [0, 0.048, z], [0, 0, 0], R);
    // the magazine under the receiver (it comes out on a reload)
    this.mag.position.set(0, -0.06, -0.12);
    R.add(this.mag);
    part(box(0.04, 0.07, 0.08), metal, true, [0, -0.03, 0], [0, 0, 0], this.mag, 'metal');
    // the eyepiece glass: in it the exit pupil, a small bright disc of the magnified view with its reticle
    this.lens = new THREE.ShaderMaterial({
      uniforms: { frame: { value: null as THREE.Texture | null }, lowRes: { value: new THREE.Vector2(1, 1) }, off: { value: new THREE.Vector2() }, shade: { value: 1 } },
      vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D frame;
        uniform vec2 lowRes;
        uniform vec2 off;
        uniform float shade;
        varying vec2 vUv;
        void main() {
          vec2 q = vUv * 2.0 - 1.0;
          float d = length(q);
          vec3 col = vec3(0.02, 0.04, 0.05) * (0.6 + shade * 0.4);
          vec2 pc = q - off;
          float pd = length(pc);
          if (pd < 0.86) {
            vec2 at = lowRes * 0.5 + pc / 0.86 * min(lowRes.x, lowRes.y) * 0.16;
            col = texture2D(frame, at / lowRes).rgb * (pd > 0.76 ? 0.5 : 0.95);
            if (abs(pc.x) < 0.03 || abs(pc.y) < 0.03) col *= 0.15;
          }
          if (d > 0.78 && q.y > 0.05 && q.x < 0.25) col = mix(col, vec3(0.5, 0.6, 0.64) * shade, 0.4);
          col = mix(col, vec3(0.6, 0.7, 0.72) * shade, 0.08);
          if (length(q - vec2(-0.34, 0.44)) < 0.14) col = mix(col, vec3(0.86, 0.92, 0.9), 0.6);
          if (d > 0.93) col = vec3(0.05, 0.055, 0.06);
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    const eyepiece = new THREE.Mesh(new THREE.CircleGeometry(0.032, 14), this.lens);
    eyepiece.position.set(0, 0.09, 0.0905);
    R.add(eyepiece);
    this.bolt.position.set(0.03, 0.012, 0.0);
    R.add(this.bolt);
    part(tube(0.007, 0.007, 0.07, 6).rotateY(Math.PI / 2), metal, true, [0.035, 0, 0], [0, 0, -0.35], this.bolt);
    part(new THREE.IcosahedronGeometry(0.016, 0), metal, true, [0.07, -0.024, 0], [0, 0, 0], this.bolt);

    // --- the pump shotgun: a long barrel over its magazine tube, the fore-end that racks, walnut stock -------
    const S = this.rigs.shotgun;
    weaponOf = 'shotgun';
    part(tube(0.019, 0.019, 0.66), metal, true, [0, 0.012, -0.5], [0, 0, 0], S, 'metal');
    part(tube(0.015, 0.015, 0.5), metal, true, [0, -0.032, -0.42], [0, 0, 0], S, 'metal');
    // iron sights: a front post with a bright bead at the muzzle, a ghost ring on the receiver; raised to the
    // eye, the bead sits in the middle of the ring, and both on the middle of the view
    part(box(0.006, 0.022, 0.012), metal, true, [0, 0.042, -0.8], [0, 0, 0], S);
    part(box(0.008, 0.007, 0.007), fiber, false, [0, 0.0545, -0.8], [0, 0, 0], S);
    part(box(0.026, 0.016, 0.026), metal, true, [0, 0.04, -0.03], [0, 0, 0], S);
    part(new THREE.TorusGeometry(0.0095, 0.0024, 6, 14), metal, true, [0, 0.055, -0.03], [0, 0, 0], S);
    for (const sx of [-1, 1]) part(box(0.004, 0.03, 0.022), metal, true, [sx * 0.0165, 0.052, -0.03], [0, 0, 0], S);
    part(box(0.064, 0.085, 0.24), metal, true, [0, -0.01, -0.06], [0, 0, 0], S, 'metal');
    part(box(0.03, 0.012, 0.08), steel, true, [0.033, 0.006, -0.06], [0, 0, 0], S);
    part(box(0.07, 0.1, 0.36), walnut, false, [0, -0.07, 0.24], [0.14, 0, 0], S, 'body');
    part(box(0.068, 0.07, 0.1), walnut, false, [0, -0.12, 0.4], [0.26, 0, 0], S, 'body');
    part(box(0.074, 0.13, 0.016), metal, false, [0, -0.11, 0.46], [0.14, 0, 0], S);
    part(box(0.012, 0.008, 0.09), metal, true, [0, -0.07, -0.02], [0, 0, 0], S);
    part(box(0.006, 0.03, 0.006), metal, true, [0, -0.05, -0.03], [0.3, 0, 0], S);
    this.pump.position.set(0, -0.032, -0.36);
    S.add(this.pump);
    part(box(0.056, 0.05, 0.17), walnut, false, [0, 0, 0], [0, 0, 0], this.pump, 'body');
    for (let i = 0; i < 4; i++) part(box(0.058, 0.006, 0.01), knurl, false, [0, 0.022, -0.06 + i * 0.04], [0, 0, 0], this.pump);
    // the shell going in, on a reload
    this.loadShell = part(tube(0.011, 0.011, 0.05, 6), hull, false, [0, -0.06, -0.12], [0, 0, 0], S);
    this.loadShell.visible = false;

    // --- the butterfly knife --------------------------------------------------------------------------------
    const K = this.rigs.knife;
    // the pivot pins sit at the blade's tang; the handles hang back from them, the blade forward
    const pivot = new THREE.Group();
    pivot.position.set(0, 0, -0.12);
    K.add(pivot);
    pivot.add(this.safe, this.bite, this.blade);
    this.safe.position.set(-0.009, 0, 0);
    this.bite.position.set(0.009, 0, 0);
    weaponOf = 'knife';
    part(box(0.012, 0.026, 0.16), handles, true, [0, 0, 0.08], [0, 0, 0], this.safe, 'handle');
    part(box(0.012, 0.026, 0.16), handles, true, [0, 0, 0.08], [0, 0, 0], this.bite, 'handle');
    part(box(0.014, 0.01, 0.018), steel, true, [0.003, -0.012, 0.155], [0, 0, 0], this.bite);
    // the blade: a tanto-ish profile, its edge along the bottom
    const sh = new THREE.Shape();
    sh.moveTo(0, -0.012);
    sh.lineTo(-0.11, -0.012);
    sh.lineTo(-0.15, 0.004);
    sh.lineTo(-0.135, 0.013);
    sh.lineTo(0, 0.013);
    sh.lineTo(0, -0.012);
    const bladeGeo = new THREE.ExtrudeGeometry(sh, { depth: 0.004, bevelEnabled: false }).rotateY(Math.PI / 2).translate(-0.002, 0, 0);
    part(bladeGeo, steel, true, [0, 0, 0], [0, 0, 0], this.blade, 'blade');
    part(tube(0.006, 0.006, 0.03, 6).rotateY(Math.PI / 2), steel, true, [0, 0, 0], [0, 0, 0], this.blade);

    for (let i = 0; i < 4; i++) {
      const kind = i < 2 ? 'brass' : 'hull';
      const mesh = part(kind === 'brass' ? tube(0.007, 0.007, 0.032, 6) : tube(0.011, 0.011, 0.05, 6), kind === 'brass' ? brass : hull, true, [0, 0, 0], [0, 0, 0], this.scene);
      mesh.visible = false;
      this.brass.push({ mesh, v: new THREE.Vector3(), spin: new THREE.Vector3(), age: 9, kind });
    }
    for (const id of WEAPONS) {
      this.rigs[id].visible = id === this.current;
      this.scene.add(this.rigs[id]);
    }
    // laid over the view: only where the weapon is
    this.composite = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({
        uniforms: { map: { value: this.target.texture }, depth: { value: this.target.depthTexture }, res: { value: new THREE.Vector2(4, 4) }, tres: { value: new THREE.Vector2(4, 4) }, margin: { value: 0 }, off: { value: this.off } },
        vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
        fragmentShader: COMPOSITE,
        depthTest: false,
        depthWrite: false,
      }),
    );
    this.composite.frustumCulled = false;
    this.post.add(this.composite);
    this.start('deploy');
  }

  /**
   * Dresses a weapon in a skin: its tiles by where they go, or null for the weapon as it comes. `key` says which
   * skin it is, so asking again for the one it already wears costs nothing.
   */
  /** Which skin a weapon wears now (its key; '' as it comes). */
  wears(weapon: WeaponId) {
    return this.worn[weapon];
  }

  setSkin(weapon: WeaponId, key: string, tiles: Partial<Record<Role, Pix>> | null) {
    if (this.worn[weapon] === key) return;
    this.worn[weapon] = key;
    const made = new Map<Role, THREE.Texture>();
    const old = new Set<THREE.Texture>();
    for (const p of this.paintable) {
      if (p.weapon !== weapon) continue;
      const was = p.mat.uniforms.map.value as THREE.Texture;
      if (was !== p.base) old.add(was);
      const pix = tiles?.[p.role];
      if (pix) {
        let tex = made.get(p.role);
        if (!tex) {
          tex = new THREE.DataTexture(new Uint8Array(pix.data.buffer.slice(0)), pix.w, pix.h, THREE.RGBAFormat, THREE.UnsignedByteType);
          tex.magFilter = tex.minFilter = THREE.NearestFilter;
          tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
          tex.colorSpace = THREE.NoColorSpace;
          tex.needsUpdate = true;
          made.set(p.role, tex);
        }
        p.mat.uniforms.map.value = tex;
        // painted, it still catches the light on its lacquer
        p.mat.uniforms.metal.value = 1;
      } else {
        p.mat.uniforms.map.value = p.base;
        p.mat.uniforms.metal.value = p.metal;
      }
    }
    for (const t of old) t.dispose();
  }

  private start(a: Action) {
    this.action = a;
    this.t = 0;
    this.emitted = false;
  }

  /** How long each action takes, for the current weapon. */
  private dur(a: Action = this.action) {
    const w = this.current;
    if (a === 'deploy') return w === 'knife' ? 0.75 : 0.55;
    if (a === 'fire') return w === 'rifle' ? 1.05 : 0.85;
    if (a === 'reload') return w === 'rifle' ? 2.1 : 0.5;
    if (a === 'inspect') return w === 'knife' ? 3.2 : 2.4;
    if (a === 'slash') return SWING_TIME[this.swing] * (1 - Math.min(3, this.combo) * 0.03);
    if (a === 'stab') return 0.95;
    return 1;
  }

  get busy() {
    return this.action !== 'idle' && this.action !== 'inspect';
  }
  get ready() {
    if (this.lowering > 0) return false;
    if (this.action === 'idle' || this.action === 'inspect') return true;
    // the end of a swing runs straight on into the next: that's how a combo flows
    return this.current === 'knife' && this.action === 'slash' && this.t > this.dur() * 0.8;
  }
  /** Whether right-click looks down the sights (the knife stabs instead). */
  get aims() {
    return this.current !== 'knife';
  }

  /** Pulls the trigger (or swings the knife): true if it went off, and it has, its sound and its animation. */
  trigger(heavy = false): boolean {
    if (!this.ready) {
      // a shell going in can be cut short by firing
      if (!(this.current === 'shotgun' && this.action === 'reload' && this.ammo.shotgun > 0)) return false;
      this.reloadShells = 0;
    }
    if (this.current === 'knife') {
      if (heavy) {
        this.combo = 0;
        this.start('stab');
        sfx.play('swing', { rate: 0.7 });
        return true;
      }
      // a click soon after the last swing (or the button held) carries on the combo; every fourth is the finisher
      const now = performance.now() / 1000;
      this.combo = now - this.comboAt < 1.05 ? this.combo + 1 : 0;
      this.comboAt = now;
      const prev = this.swing;
      const pick = (list: Swing[]) => list[Math.floor(Math.random() * list.length)];
      if (this.combo % 4 === 3) this.swing = 'spin';
      else if (this.combo === 0) this.swing = pick(['left', 'right', 'jab', 'upper']);
      else this.swing = prev === 'left' ? pick(['right', 'right', 'jab']) : prev === 'right' ? pick(['left', 'left', 'upper']) : prev === 'upper' ? 'jab' : pick(['left', 'right']);
      this.start('slash');
      sfx.play('swing', { rate: (this.swing === 'jab' ? 1.3 : 1) + Math.random() * 0.15 + Math.min(4, this.combo) * 0.04 });
      if (this.swing === 'spin') {
        sfx.play('swing', { at: 0.2, rate: 0.85 });
        for (const at of [0.05, 0.2, 0.35]) sfx.play('flip', { at });
      }
      return true;
    }
    if (this.ammo[this.current] <= 0) {
      sfx.play('dry');
      this.reload();
      return false;
    }
    this.ammo[this.current]--;
    this.kick = 1;
    this.start('fire');
    sfx.play(this.current);
    if (this.current === 'rifle') sfx.play('bolt', { at: 0.32, gain: 0.8 });
    else sfx.play('pump', { at: 0.18, gain: 0.9 });
    return true;
  }

  reload() {
    if (this.current === 'knife' || this.busy) return;
    const w = this.current;
    if (this.ammo[w] >= this.max[w]) return;
    this.reloadShells = w === 'shotgun' ? this.max.shotgun - this.ammo.shotgun : 0;
    this.start('reload');
    if (w === 'rifle') {
      sfx.play('magOut', { at: 0.25 });
      sfx.play('magIn', { at: 1.0 });
      sfx.play('bolt', { at: 1.45, gain: 0.8 });
    }
  }

  inspect() {
    if (this.action !== 'idle') return;
    this.start('inspect');
    if (this.current === 'knife') for (const at of [0.35, 0.62, 0.9, 1.18, 1.46, 1.74, 2.3, 2.75]) sfx.play('flip', { at, rate: 0.9 + Math.random() * 0.25 });
    else if (this.current === 'shotgun') sfx.play('pump', { at: 1.1 });
    else sfx.play('bolt', { at: 1.0, gain: 0.7 });
  }

  /** Swaps to a weapon (it comes up after the one in hand goes down). */
  switchTo(id: WeaponId) {
    if (id === this.wanted) return;
    this.wanted = id;
    this.lowering = 0.18;
  }
  cycle(dir: number) {
    const i = WEAPONS.indexOf(this.wanted);
    this.switchTo(WEAPONS[(i + dir + WEAPONS.length) % WEAPONS.length]);
  }
  swapLast() {
    this.switchTo(this.last);
  }

  /** The bolt or the pump has finished: a round is in. (For telling when the gun may fire again.) */
  private finish() {
    if (this.action === 'reload' && this.current === 'shotgun') {
      this.ammo.shotgun = Math.min(this.max.shotgun, this.ammo.shotgun + 1);
      this.reloadShells--;
      if (this.reloadShells > 0) {
        this.start('reload');
        return;
      }
      sfx.play('pump', { gain: 0.8 });
    }
    if (this.action === 'reload' && this.current === 'rifle') this.ammo.rifle = this.max.rifle;
    this.start('idle');
  }

  /**
   * Places the weapon for this frame: low on the right at rest, raised to the eye as `aim` goes to 1; it bobs as
   * you walk, lags behind your turns, kicks, works its action, swings or flips.
   */
  update(dt: number, o: { W: number; H: number; walk: number; shade: number; aim: number; turn: [number, number]; visible: boolean; air: number; fine?: number }) {
    // drawn bigger than the screen by a margin all round, the view widened to match, so the middle is the screen
    const M = Math.ceil((24 * o.H) / 250);
    const tw = o.W + 2 * M;
    const th = o.H + 2 * M;
    this.margin = M;
    this.cam.aspect = tw / th;
    this.cam.fov = THREE.MathUtils.radToDeg(2 * Math.atan((Math.tan(Math.PI / 6) * th) / o.H));
    this.cam.updateProjectionMatrix();
    if (this.target.width !== tw || this.target.height !== th) this.target.setSize(tw, th);
    const cu = this.composite.material.uniforms;
    cu.res.value.set(o.W, o.H);
    cu.tres.value.set(tw, th);
    cu.margin.value = M;
    for (const m of this.mats) {
      m.uniforms.shade.value = o.shade;
      // finer pixels (a setting): the paint finer to match, still a texel to a pixel
      m.uniforms.density.value = DENSITY * (o.fine ?? 1);
    }
    // swapping: the one in hand drops out of view, the next comes up
    if (this.lowering > 0) {
      this.lowering -= dt;
      if (this.lowering <= 0) {
        this.last = this.current;
        this.current = this.wanted;
        for (const id of WEAPONS) this.rigs[id].visible = id === this.current;
        this.start('deploy');
        sfx.play('deploy');
        if (this.current === 'knife') for (const at of [0.12, 0.3, 0.48]) sfx.play('flip', { at });
      }
    }
    this.t += dt;
    if (this.action !== 'idle' && this.t >= this.dur()) this.finish();
    this.phase += dt * (5 + o.walk * 4) * Math.min(1, o.walk * 3);
    this.kick = Math.max(0, this.kick - dt * 4.5);
    const k0 = 1 - Math.exp(-dt * 9);
    this.sway.x += (Math.max(-0.08, Math.min(0.08, o.turn[0] * 0.0016)) - this.sway.x) * k0;
    this.sway.y += (Math.max(-0.06, Math.min(0.06, o.turn[1] * 0.0016)) - this.sway.y) * k0;
    const e = o.aim * o.aim * (3 - 2 * o.aim);
    const calm = 1 - e;
    const k = this.kick * this.kick;
    const t = performance.now() / 1000;
    const a = this.action;
    const at = this.dur() > 0 ? this.t / this.dur() : 1;
    const drop = this.lowering > 0 ? 1 - this.lowering / 0.18 : a === 'deploy' ? 1 - ease(seg(at, 0, 0.8)) : 0;
    const r = this.rigs[this.current];
    // The pose itself holds still, so its pixels never crawl. The bob as you walk, the lag behind your turns,
    // the breathing, coming up and going down: all of that moves the finished picture, a whole pixel at a time,
    // the way a sprite moves. Only the weapon's own actions (the bolt, a reload, a swing) move it in 3D.
    const px = o.H / 250;
    const bob = calm * o.walk;
    const loose = 1 - e * 0.9;
    const ox = Math.sin(this.phase) * 6 * bob * px - this.sway.x * 150 * px * loose;
    const oy = -Math.abs(Math.cos(this.phase)) * 6 * bob * px + this.sway.y * 120 * px * loose + Math.sin(t * 1.4) * 1.4 * px * calm - drop * o.H * 0.6 + o.air * 9 * px;
    // never further than the margin it was drawn with (going down out of view, it may go as far as it likes)
    this.off.set(Math.max(-M, Math.min(M, Math.round(ox))), Math.min(M, Math.round(oy)));
    if (this.current === 'knife') {
      // held in the right hand just below the frame: the handle runs out of view at the bottom right and the
      // blade rises up and to the left across the corner, its flat towards you, its edge down
      r.position.set(0.2, -0.2, -0.32);
      this.knifeMotion(a, at, r);
    } else {
      const shotgun = this.current === 'shotgun';
      // raised to the eye: the rifle's scope, or the shotgun's ghost ring and bead lined up on the middle
      r.position.set(0.17 * calm, -0.17 * calm - (shotgun ? 0.055 : 0.09) * e + k * 0.012, -0.36 * calm - (shotgun ? 0.22 : 0.3) * e + k * 0.07);
      r.rotation.set(0.04 * calm + k * (shotgun ? 0.26 : 0.16), 0.12 * calm, 0);
      this.gunMotion(a, at, r);
    }
    // the brass and the hulls flying out
    for (const b of this.brass) {
      b.age += dt;
      b.mesh.visible = b.age < 0.9 && o.visible;
      if (!b.mesh.visible) continue;
      b.v.y -= 4 * dt;
      b.mesh.position.addScaledVector(b.v, dt);
      b.mesh.rotation.x += b.spin.x * dt;
      b.mesh.rotation.y += b.spin.y * dt;
      b.mesh.rotation.z += b.spin.z * dt;
    }
    r.visible = o.visible;
    this.scene.updateMatrixWorld();
  }

  private eject(kind: 'brass' | 'hull', from: THREE.Vector3) {
    const b = this.brass.find((x) => x.kind === kind && x.age > 0.9) ?? this.brass.find((x) => x.kind === kind)!;
    b.age = 0;
    b.mesh.position.copy(from);
    b.v.set(0.9 + Math.random() * 0.3, 0.7 + Math.random() * 0.3, 0.15);
    b.spin.set(Math.random() * 14, Math.random() * 14, Math.random() * 14);
    sfx.play(kind === 'brass' ? 'shell' : 'hull', { gain: 0.6 });
  }

  private gunMotion(a: Action, at: number, r: THREE.Group) {
    const rifle = this.current === 'rifle';
    this.bolt.rotation.z = 0;
    this.bolt.position.z = 0;
    this.pump.position.z = -0.36;
    this.mag.position.y = -0.06;
    this.mag.visible = true;
    this.loadShell.visible = false;
    if (a === 'fire') {
      if (rifle) {
        // the bolt: up, back, forward, down
        const c = at;
        const up = c < 0.2 ? 0 : c < 0.32 ? (c - 0.2) / 0.12 : c < 0.68 ? 1 : c < 0.8 ? 1 - (c - 0.68) / 0.12 : 0;
        const back = c < 0.32 ? 0 : c < 0.44 ? (c - 0.32) / 0.12 : c < 0.56 ? 1 : c < 0.68 ? 1 - (c - 0.56) / 0.12 : 0;
        this.bolt.rotation.z = up * 1.1;
        this.bolt.position.z = back * 0.07;
        if (!this.emitted && c > 0.44) {
          this.emitted = true;
          this.eject('brass', this.tmp.set(0.04, 0.03, -0.08).applyMatrix4(r.matrixWorld));
        }
      } else {
        // the pump: back, the hull out, forward
        const back = at < 0.18 ? 0 : at < 0.38 ? ease((at - 0.18) / 0.2) : at < 0.55 ? 1 - ease((at - 0.38) / 0.17) : 0;
        this.pump.position.z = -0.36 + back * 0.09;
        r.rotation.x -= back * 0.06;
        if (!this.emitted && at > 0.32) {
          this.emitted = true;
          this.eject('hull', this.tmp.set(0.05, 0.02, -0.06).applyMatrix4(r.matrixWorld));
        }
      }
    } else if (a === 'reload') {
      if (rifle) {
        // tilted down to the right: the magazine out, a new one in, the bolt worked
        const tilt = ease(seg(at, 0, 0.15)) * (1 - ease(seg(at, 0.85, 1)));
        r.rotation.z += tilt * 0.5;
        r.rotation.x += tilt * 0.25;
        const out = seg(at, 0.12, 0.3);
        const back = seg(at, 0.42, 0.55);
        this.mag.position.y = -0.06 - out * 0.25 + back * 0.25;
        this.mag.visible = at < 0.3 || at > 0.42;
        const c = seg(at, 0.66, 0.84);
        this.bolt.rotation.z = Math.sin(c * Math.PI) * 1.1;
        this.bolt.position.z = Math.sin(c * Math.PI) * 0.07;
      } else {
        // rolled over, a shell pushed up into the tube
        r.rotation.z += 0.55;
        r.rotation.x += 0.12;
        this.loadShell.visible = at < 0.7;
        this.loadShell.position.set(0, -0.08 + seg(at, 0.1, 0.6) * 0.05, -0.08 - seg(at, 0.3, 0.7) * 0.08);
        if (!this.emitted && at > 0.6) {
          this.emitted = true;
          sfx.play('shellIn');
        }
      }
    } else if (a === 'inspect') {
      // turned over to look at it, and back
      const turn = Math.sin(seg(at, 0.05, 0.75) * Math.PI);
      r.rotation.z += turn * (rifle ? 1.25 : -1.1);
      r.rotation.y -= turn * 0.5;
      r.position.x -= turn * 0.06;
      r.position.y += turn * 0.04;
      if (!rifle) this.pump.position.z = -0.36 + Math.sin(seg(at, 0.45, 0.6) * Math.PI) * 0.09;
      else {
        const c = seg(at, 0.4, 0.6);
        this.bolt.rotation.z = Math.sin(c * Math.PI) * 1.1;
        this.bolt.position.z = Math.sin(c * Math.PI) * 0.07;
      }
    }
  }

  /** The butterfly knife: open in the hand, swinging, and its flips. */
  private knifeMotion(a: Action, at: number, r: THREE.Group) {
    let open = 0;
    let bladeSpin = 0;
    // the grip: the way it's held, turned towards a straight-ahead point while it stabs or jabs
    let point = 0;
    const p = seg(at, 0, 0.78);
    const s = Math.sin(p * Math.PI);
    if (a === 'stab') {
      const back = seg(at, 0, 0.3);
      const thrust = seg(at, 0.3, 0.45);
      const home = seg(at, 0.55, 1);
      point = ease(Math.min(1, back * 0.6 + thrust * 0.4) * (1 - home));
      // drawn back, driven in along the blade, and home again
      r.position.addScaledVector(STAB_DIR, -back * 0.05 + thrust * 0.2 - home * 0.15);
      r.position.x -= (thrust - home) * 0.06;
    } else if (a === 'slash' && this.swing === 'jab') {
      point = s * 0.85;
      r.position.addScaledVector(STAB_DIR, s * 0.14);
      r.position.x -= s * 0.05;
    }
    r.quaternion.copy(KNIFE_HOLD);
    if (point > 0) r.quaternion.slerp(KNIFE_STAB, point);
    if (a === 'deploy') {
      // flipped open on the way up: the blade comes round out of the handles, twice
      open = ease(seg(at, 0.1, 0.9));
      bladeSpin = (1 - open) * Math.PI * 3;
    } else if (a === 'inspect') {
      // the show: brought up into view, the blade fanned round the pins again and again, a toss and catch
      // (it turns over end to end in its own plane), then rolled to show both sides
      const lift = Math.sin(seg(at, 0, 1) * Math.PI);
      r.position.x -= lift * 0.06;
      r.position.y += lift * 0.05;
      const fan = seg(at, 0.08, 0.6);
      bladeSpin = fan > 0 && fan < 1 ? fan * Math.PI * 6 : 0;
      const toss = seg(at, 0.62, 0.84);
      r.position.y += Math.sin(toss * Math.PI) * 0.08;
      r.rotateX(-ease(toss) * Math.PI * 2);
      r.rotateZ(Math.sin(seg(at, 0.84, 1) * Math.PI) * 1.4);
    } else if (a === 'slash') {
      const w = this.swing;
      if (w === 'left') {
        // a sweep from right to left, the tip leading
        r.rotateOnWorldAxis(AXIS_Y, s * 0.8);
        r.rotateOnWorldAxis(AXIS_Z, s * 0.55);
        r.position.x += (0.03 * (1 - p) - 0.15 * p) * s;
        r.position.y += s * 0.03;
        r.position.z -= s * 0.05;
      } else if (w === 'right') {
        // the backhand: rolled over so the edge leads, swept from the left across to the right
        r.rotateZ(s * Math.PI * 0.8);
        r.rotateOnWorldAxis(AXIS_Y, -s * 0.55);
        r.rotateOnWorldAxis(AXIS_Z, -s * 0.5);
        r.position.x += (-0.15 * (1 - p) + 0.03 * p) * s;
        r.position.y += s * 0.04;
        r.position.z -= s * 0.05;
      } else if (w === 'upper') {
        // a rising cut from low on the right up to the left
        r.rotateOnWorldAxis(AXIS_X, -s * 0.45);
        r.rotateOnWorldAxis(AXIS_Z, s * 0.75);
        r.position.x += (0.02 * (1 - p) - 0.11 * p) * s;
        r.position.y += (-0.05 * (1 - p) + 0.09 * p) * s;
        r.position.z -= s * 0.04;
      } else if (w === 'spin') {
        // the finisher: the knife turned right over in its own plane as it sweeps wide to the left
        r.rotateX(-ease(p) * Math.PI * 2);
        r.rotateOnWorldAxis(AXIS_Y, s * 0.6);
        r.position.x += (0.05 * (1 - p) - 0.17 * p) * s;
        r.position.y += s * 0.05;
        r.position.z -= s * 0.06;
      }
    }
    if (a !== 'deploy') open = 1;
    // the blade and the bite handle swing round the pins together; the safe handle stays put
    this.blade.rotation.x = Math.PI - bladeSpin;
    this.bite.rotation.x = bladeSpin * 0.5 * (1 - open) + Math.sin(bladeSpin) * 0.4;
    this.safe.rotation.x = 0;
  }

  /** Where the muzzle is on screen, in game pixels (y up), for the flash and the smoke. */
  muzzle(W: number, H: number): [number, number] {
    const z = this.current === 'rifle' ? -0.89 : -0.85;
    this.tmp.set(0, this.current === 'shotgun' ? 0.012 : 0, z).applyMatrix4(this.rigs[this.current].matrixWorld).project(this.cam);
    const M = this.margin;
    return [(this.tmp.x * 0.5 + 0.5) * (W + 2 * M) - M + this.off.x, (this.tmp.y * 0.5 + 0.5) * (H + 2 * M) - M + this.off.y];
  }

  /** Draws the weapon in its own pass, then lays it over `onto`. */
  render(renderer: THREE.WebGLRenderer, onto: THREE.WebGLRenderTarget) {
    const lu = this.lens.uniforms;
    lu.frame.value = onto.texture;
    lu.lowRes.value.set(onto.width, onto.height);
    lu.off.value.set(this.sway.x * 2 - 0.06, -this.sway.y * 2 + this.kick * 0.25 + 0.05);
    lu.shade.value = this.mats[0]?.uniforms.shade.value ?? 1;
    const color = renderer.getClearColor(new THREE.Color());
    const alpha = renderer.getClearAlpha();
    renderer.setRenderTarget(this.target);
    renderer.setClearColor(0x000000, 0);
    renderer.clear();
    renderer.render(this.scene, this.cam);
    renderer.setClearColor(color, alpha);
    renderer.setRenderTarget(onto);
    renderer.autoClear = false;
    renderer.render(this.post, this.postCam);
    renderer.autoClear = true;
  }
}
