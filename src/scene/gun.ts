/**
 * The rifle in pill mode, a real 3D model held in view (the way Minecraft holds its items, only built from
 * proper parts): walnut stock and fore-end, blued barrel and receiver, a scope on two rings, and a bolt that
 * lifts, comes back and throws the brass after every shot. Pixel textures, light in hard steps with a glint
 * on the metal, a dark outline round every part. Drawn in its own small pass at the game's pixel size, then
 * laid over the view, so it never pokes into a tree you stand against.
 */
import * as THREE from 'three';
import { hash2, mulberry, noise1, Pix, ramp, shade, type Ramp } from './pix';

const WOOD = ramp('#2a170d', '#432614', '#5c3820', '#7a4e2c', '#986638', '#b6834c', '#d0a468');
const METAL = ramp('#121416', '#1f2326', '#2f3437', '#454c4f', '#646c6e', '#8c9494');
const SCOPE = ramp('#0c0e10', '#16191c', '#22262a', '#323840', '#4a5258', '#6c767c');
const BRASS = ramp('#6e4f1c', '#9a7430', '#c9a04a', '#e8c873', '#f6e3a4');

function tile(pal: Ramp, grain: boolean, seed: number) {
  const p = new Pix(16, 32, true);
  const rnd = mulberry(seed);
  for (let y = 0; y < 32; y++)
    for (let x = 0; x < 16; x++) {
      let t = 0.55 + (hash2(x, y, seed) - 0.5) * 0.12;
      if (grain) t += (noise1(x * 0.9 + noise1(y * 0.12, seed) * 2.2, seed + 1) - 0.5) * 0.45;
      p.set(x, y, shade(pal, t));
    }
  if (grain) for (let i = 0; i < 6; i++) p.set(Math.floor(rnd() * 16), Math.floor(rnd() * 32), pal[1]);
  const tex = new THREE.DataTexture(new Uint8Array(p.data.buffer), p.w, p.h, THREE.RGBAFormat, THREE.UnsignedByteType);
  tex.magFilter = tex.minFilter = THREE.NearestFilter;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.NoColorSpace;
  tex.needsUpdate = true;
  return tex;
}

const VERT = /* glsl */ `
uniform float inflate;
varying vec3 vNormal;
varying vec2 vUv;
void main() {
  vUv = uv;
  vNormal = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position + normal * inflate, 1.0);
}`;

const FRAG = /* glsl */ `
uniform sampler2D map;
uniform float shade;
uniform float metal;
varying vec3 vNormal;
varying vec2 vUv;
void main() {
  vec3 n = normalize(vNormal);
  vec3 L = normalize(vec3(-0.45, 0.8, 0.5));
  float d = dot(n, L);
  float band = d > 0.55 ? 1.0 : d > 0.05 ? 0.78 : 0.58;
  vec3 c = texture2D(map, vUv * vec2(1.0, 2.0)).rgb * band * shade;
  // a hard glint where the metal catches the light
  float s = dot(n, normalize(L + vec3(0.0, 0.0, 1.0)));
  if (metal > 0.5 && s > 0.94) c += vec3(0.22, 0.24, 0.24) * shade;
  gl_FragColor = vec4(c, 1.0);
}`;

export class Gun {
  readonly scene = new THREE.Scene();
  readonly cam = new THREE.PerspectiveCamera(60, 1, 0.04, 220);
  private target = new THREE.WebGLRenderTarget(4, 4, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, generateMipmaps: false });
  private rig = new THREE.Group();
  private bolt = new THREE.Group();
  private brass: { mesh: THREE.Mesh; v: THREE.Vector3; spin: THREE.Vector3; age: number }[] = [];
  private mats: THREE.ShaderMaterial[] = [];
  private composite: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
  private post = new THREE.Scene();
  private postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private phase = 0;
  private sway = new THREE.Vector2();
  private lens: THREE.ShaderMaterial;
  private tmp = new THREE.Vector3();
  kick = 0;
  /** 0..1 through working the bolt after a shot. */
  cycle = 1;
  private ejected = true;

  constructor() {
    const wood = tile(WOOD, true, 901);
    const metal = tile(METAL, false, 902);
    const scope = tile(SCOPE, false, 903);
    const brass = tile(BRASS, false, 904);
    const part = (g: THREE.BufferGeometry, tex: THREE.Texture, isMetal: boolean, at: [number, number, number], rot: [number, number, number] = [0, 0, 0], parent: THREE.Object3D = this.rig) => {
      const mat = new THREE.ShaderMaterial({ uniforms: { map: { value: tex }, shade: { value: 1 }, metal: { value: isMetal ? 1 : 0 }, inflate: { value: 0 } }, vertexShader: VERT, fragmentShader: FRAG });
      this.mats.push(mat);
      const m = new THREE.Mesh(g, mat);
      m.position.set(...at);
      m.rotation.set(...rot);
      // the outline: the same part pushed out a hair along its normals, its back faces drawn dark
      const line = new THREE.Mesh(
        g,
        new THREE.ShaderMaterial({ uniforms: { inflate: { value: 0.0022 } }, vertexShader: VERT, fragmentShader: /* glsl */ `void main() { gl_FragColor = vec4(0.07, 0.055, 0.045, 1.0); }`, side: THREE.BackSide }),
      );
      m.add(line);
      parent.add(m);
      return m;
    };
    const box = (w: number, h: number, l: number) => new THREE.BoxGeometry(w, h, l);
    const tube = (r0: number, r1: number, l: number, n = 8) => new THREE.CylinderGeometry(r0, r1, l, n).rotateX(Math.PI / 2);
    // the rifle lies along -z, muzzle forward, sights up
    part(tube(0.016, 0.019, 0.62), metal, true, [0, 0, -0.56]);
    part(tube(0.022, 0.022, 0.03), metal, true, [0, 0, -0.86]);
    part(box(0.008, 0.026, 0.012), metal, true, [0, 0.026, -0.84]);
    part(box(0.062, 0.07, 0.27), metal, true, [0, -0.004, -0.11]);
    part(box(0.07, 0.05, 0.36), wood, false, [0, -0.04, -0.4]);
    part(box(0.072, 0.11, 0.38), wood, false, [0, -0.07, 0.2], [0.1, 0, 0]);
    part(box(0.07, 0.07, 0.12), wood, false, [0, -0.13, 0.36], [0.22, 0, 0]);
    part(box(0.074, 0.13, 0.016), metal, false, [0, -0.1, 0.42], [0.1, 0, 0]);
    part(box(0.052, 0.1, 0.06), wood, false, [0, -0.08, 0.02], [-0.45, 0, 0]);
    // the trigger guard and trigger
    part(box(0.012, 0.008, 0.09), metal, true, [0, -0.07, -0.08]);
    part(box(0.012, 0.04, 0.008), metal, true, [0, -0.052, -0.125]);
    part(box(0.006, 0.03, 0.006), metal, true, [0, -0.05, -0.085], [0.3, 0, 0]);
    // the scope on its rings
    part(tube(0.031, 0.031, 0.3), scope, true, [0, 0.09, -0.12]);
    part(tube(0.036, 0.031, 0.06), scope, true, [0, 0.09, 0.06]);
    part(tube(0.033, 0.045, 0.07), scope, true, [0, 0.09, -0.3]);
    part(tube(0.013, 0.013, 0.03, 6), scope, true, [0, 0.13, -0.12], [Math.PI / 2, 0, 0]);
    for (const z of [-0.2, -0.04]) part(box(0.03, 0.06, 0.022), scope, true, [0, 0.048, z]);
    // the eyepiece's glass, facing you: deep blue-green with the light caught across its top
    const glass = new Pix(16, 16);
    for (let y = 0; y < 16; y++)
      for (let x = 0; x < 16; x++) {
        const d = Math.hypot(x - 7.5, y - 7.5) / 8;
        glass.set(x, y, shade(ramp('#081016', '#10202a', '#1c3442', '#2f5466', '#5f8ea0', '#b8dbe6'), 0.45 - d * 0.35 + (y < 6 && x > 3 && x < 11 && (x + y) % 3 === 0 ? 0.5 : 0)));
      }
    glass.set(5, 4, 0xffe6dbb8);
    glass.set(6, 4, 0xffe6dbb8);
    const gt = new THREE.DataTexture(new Uint8Array(glass.data.buffer), 16, 16, THREE.RGBAFormat, THREE.UnsignedByteType);
    gt.magFilter = gt.minFilter = THREE.NearestFilter;
    gt.colorSpace = THREE.NoColorSpace;
    gt.needsUpdate = true;
    void gt;
    // the eyepiece glass: dark coated glass, and in it the exit pupil, a small bright disc of the magnified view
    // with the reticle in it, sliding about as your eye is off the axis; the light caught on the glass on top
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
          // the view fills nearly all the glass; only its very edge goes dark as your eye is off the axis
          if (pd < 0.86) {
            vec2 at = lowRes * 0.5 + pc / 0.86 * min(lowRes.x, lowRes.y) * 0.16;
            col = texture2D(frame, at / lowRes).rgb * (pd > 0.76 ? 0.5 : 0.95);
            if (abs(pc.x) < 0.03 || abs(pc.y) < 0.03) col *= 0.15;
          }
          if (d > 0.78 && q.y > 0.05 && q.x < 0.25) col = mix(col, vec3(0.5, 0.6, 0.64) * shade, 0.4);
          // the glass itself: a faint sheen over the whole picture
          col = mix(col, vec3(0.6, 0.7, 0.72) * shade, 0.08);
          if (length(q - vec2(-0.34, 0.44)) < 0.14) col = mix(col, vec3(0.86, 0.92, 0.9), 0.6);
          if (d > 0.93) col = vec3(0.05, 0.055, 0.06);
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    const eyepiece = new THREE.Mesh(new THREE.CircleGeometry(0.032, 14), this.lens);
    eyepiece.position.set(0, 0.09, 0.0905);
    this.rig.add(eyepiece);
    // the bolt: a handle out to the right with a round knob, hinged so it can lift and come back
    this.bolt.position.set(0.03, 0.012, 0.0);
    this.rig.add(this.bolt);
    part(tube(0.007, 0.007, 0.07, 6).rotateY(Math.PI / 2), metal, true, [0.035, 0, 0], [0, 0, -0.35], this.bolt);
    part(new THREE.IcosahedronGeometry(0.016, 0), metal, true, [0.07, -0.024, 0], [0, 0, 0], this.bolt);
    for (let i = 0; i < 3; i++) {
      const mesh = part(tube(0.007, 0.007, 0.032, 6), brass, true, [0, 0, 0], [0, 0, 0], this.scene);
      mesh.visible = false;
      this.brass.push({ mesh, v: new THREE.Vector3(), spin: new THREE.Vector3(), age: 9 });
    }
    this.scene.add(this.rig);
    // laid over the view: only where the rifle is
    this.composite = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({
        uniforms: { map: { value: this.target.texture } },
        vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
        fragmentShader: /* glsl */ `uniform sampler2D map; varying vec2 vUv; void main() { vec4 c = texture2D(map, vUv); if (c.a < 0.5) discard; gl_FragColor = vec4(c.rgb, 1.0); }`,
        depthTest: false,
        depthWrite: false,
      }),
    );
    this.composite.frustumCulled = false;
    this.post.add(this.composite);
  }

  fire() {
    this.kick = 1;
    this.cycle = 0;
    this.ejected = false;
  }

  /**
   * Places the rifle for this frame: low on the right at rest, the scope's eyepiece brought to your eye as
   * `aim` goes to 1. It bobs as you walk, lags behind your turns, kicks up and back, works its bolt.
   */
  update(dt: number, o: { W: number; H: number; walk: number; shade: number; aim: number; turn: [number, number]; visible: boolean }) {
    this.cam.aspect = o.W / o.H;
    this.cam.updateProjectionMatrix();
    if (this.target.width !== o.W || this.target.height !== o.H) this.target.setSize(o.W, o.H);
    for (const m of this.mats) m.uniforms.shade.value = o.shade;
    this.phase += dt * (5 + o.walk * 4) * Math.min(1, o.walk * 3);
    this.kick = Math.max(0, this.kick - dt * 4.5);
    this.cycle = Math.min(1, this.cycle + dt / 0.6);
    const k0 = 1 - Math.exp(-dt * 9);
    this.sway.x += (Math.max(-0.08, Math.min(0.08, o.turn[0] * 0.0016)) - this.sway.x) * k0;
    this.sway.y += (Math.max(-0.06, Math.min(0.06, o.turn[1] * 0.0016)) - this.sway.y) * k0;
    const e = o.aim * o.aim * (3 - 2 * o.aim);
    const calm = 1 - e;
    const k = this.kick * this.kick;
    const t = performance.now() / 1000;
    const r = this.rig;
    r.position.set(
      0.17 * calm + Math.sin(this.phase) * 0.012 * o.walk * calm,
      -0.17 * calm - 0.09 * e - Math.abs(Math.cos(this.phase)) * 0.014 * o.walk * calm + Math.sin(t * 1.4) * 0.003 * calm + k * 0.012,
      -0.36 * calm - 0.3 * e + k * 0.07,
    );
    r.rotation.set(0.04 * calm + k * 0.16 - this.sway.y * calm, 0.12 * calm + this.sway.x * calm, Math.sin(this.phase) * 0.025 * o.walk * calm);
    // the bolt: up, back, forward, down
    const c = this.cycle;
    const up = c < 0.15 ? 0 : c < 0.3 ? (c - 0.15) / 0.15 : c < 0.75 ? 1 : c < 0.9 ? 1 - (c - 0.75) / 0.15 : 0;
    const back = c < 0.3 ? 0 : c < 0.45 ? (c - 0.3) / 0.15 : c < 0.6 ? 1 : c < 0.75 ? 1 - (c - 0.6) / 0.15 : 0;
    this.bolt.rotation.z = up * 1.1;
    this.bolt.position.z = back * 0.07;
    // the brass flies out as the bolt comes back
    if (!this.ejected && c > 0.42) {
      this.ejected = true;
      const b = this.brass.find((x) => x.age > 0.9) ?? this.brass[0];
      b.age = 0;
      b.mesh.position.copy(this.tmp.set(0.04, 0.03, -0.08).applyMatrix4(r.matrixWorld));
      b.v.set(0.9 + Math.random() * 0.3, 0.7 + Math.random() * 0.3, 0.15);
      b.spin.set(Math.random() * 14, Math.random() * 14, Math.random() * 14);
    }
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

  /** Where the muzzle is on screen, in game pixels (y up), for the flash and the smoke. */
  muzzle(W: number, H: number): [number, number] {
    this.tmp.set(0, 0, -0.89).applyMatrix4(this.rig.matrixWorld).project(this.cam);
    return [(this.tmp.x * 0.5 + 0.5) * W, (this.tmp.y * 0.5 + 0.5) * H];
  }

  /** Draws the rifle in its own pass, then lays it over `onto`. */
  render(renderer: THREE.WebGLRenderer, onto: THREE.WebGLRenderTarget) {
    // the eyepiece looks into this very frame (it was drawn just before)
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
