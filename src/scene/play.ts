/**
 * Pill mode's moving parts that don't need the forest's insides: the controls (keys and mouse, or two thumbs),
 * the water, the puffs where a shot lands, and the HUD (rifle, crosshair, arcade counter) drawn into the small
 * pixel frame itself, so it is made of exactly the same pixels as the wood.
 */
import * as THREE from 'three';
import { crosshairSprite, CREAM, flashSprite, hitSprite, pixelText, tallyIcon } from './art/gear';
import { BAYER, LIGHT, light, toTexture } from './gl';
import { hex, Pix } from './pix';
import { LAKE, PADS, POND, RIVER, RIVER_W } from './world';

// --- controls -------------------------------------------------------------------------------------------
export class Controls {
  keys = new Set<string>();
  /** Mouse (or thumb) travel since last asked, in CSS pixels. */
  dx = 0;
  dy = 0;
  fire = false;
  jump = false;
  /** Held: looking through the scope. Pressed: use what is in front of you (put a disc in). */
  zoom = false;
  use = false;
  locked = false;
  readonly touch: boolean;
  stick = { id: -1, x0: 0, y0: 0, x: 0, y: 0 };
  private look = { id: -1, x: 0, y: 0, at: 0, moved: 0 };
  private off: (() => void)[] = [];

  constructor(
    private canvas: HTMLCanvasElement,
    private onLock: (locked: boolean) => void,
  ) {
    this.touch = window.matchMedia('(pointer: coarse)').matches;
  }

  attach() {
    const on = <K extends keyof WindowEventMap>(t: K, f: (e: WindowEventMap[K]) => void, o?: AddEventListenerOptions) => {
      window.addEventListener(t, f, o);
      this.off.push(() => window.removeEventListener(t, f, o));
    };
    const game = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'ShiftLeft', 'ShiftRight', 'KeyE'];
    on('keydown', (e) => {
      if (!game.includes(e.code)) return;
      e.preventDefault();
      this.keys.add(e.code);
      if (e.code === 'Space') this.jump = true;
      if (e.code === 'KeyE' && !e.repeat) this.use = true;
    });
    on('keyup', (e) => this.keys.delete(e.code));
    on('blur', () => this.keys.clear());
    on('mousemove', (e) => {
      if (!this.locked) return;
      this.dx += e.movementX;
      this.dy += e.movementY;
    });
    on('mousedown', (e) => {
      if (this.touch) return;
      if (e.button === 2 && this.locked) this.zoom = true;
      if (e.button !== 0) return;
      if (this.locked) this.fire = true;
      else if (e.target === this.canvas) this.lock();
    });
    on('mouseup', (e) => {
      if (e.button === 2) this.zoom = false;
    });
    on('contextmenu', (e) => e.preventDefault());
    // the touch screen's buttons
    on('play-zoom' as keyof WindowEventMap, () => (this.zoom = !this.zoom));
    on('play-use' as keyof WindowEventMap, () => (this.use = true));
    const lockChange = () => {
      this.locked = document.pointerLockElement === this.canvas;
      if (!this.locked) {
        this.keys.clear();
        this.zoom = false;
      }
      this.onLock(this.locked);
    };
    document.addEventListener('pointerlockchange', lockChange);
    this.off.push(() => document.removeEventListener('pointerlockchange', lockChange));
    if (this.touch) {
      // left thumb walks (a stick appears where it lands), right thumb looks, a quick tap shoots
      on('pointerdown', (e) => {
        if (e.pointerType !== 'touch' || e.target !== this.canvas) return;
        if (e.clientX < innerWidth * 0.45 && this.stick.id < 0) this.stick = { id: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY };
        else if (this.look.id < 0) this.look = { id: e.pointerId, x: e.clientX, y: e.clientY, at: performance.now(), moved: 0 };
      });
      on('pointermove', (e) => {
        if (e.pointerId === this.stick.id) {
          this.stick.x = e.clientX;
          this.stick.y = e.clientY;
        } else if (e.pointerId === this.look.id) {
          const mx = e.clientX - this.look.x;
          const my = e.clientY - this.look.y;
          this.dx += mx * 1.6;
          this.dy += my * 1.6;
          this.look.moved += Math.abs(mx) + Math.abs(my);
          this.look.x = e.clientX;
          this.look.y = e.clientY;
        }
      });
      const up = (e: PointerEvent) => {
        if (e.pointerId === this.stick.id) this.stick.id = -1;
        if (e.pointerId === this.look.id) {
          if (this.look.moved < 12 && performance.now() - this.look.at < 300) this.fire = true;
          this.look.id = -1;
        }
      };
      on('pointerup', up);
      on('pointercancel', up);
    }
  }

  detach() {
    this.off.forEach((f) => f());
    this.off = [];
    this.keys.clear();
    this.zoom = false;
    this.stick.id = -1;
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();
  }

  lock() {
    if (this.touch) return;
    try {
      const r = this.canvas.requestPointerLock() as unknown as Promise<void> | undefined;
      r?.catch?.(() => {});
    } catch {
      /* not allowed right now (just after Esc): the pause screen stays */
    }
  }

  /** Strafe and forward, each -1..1. */
  move(): [number, number] {
    const k = this.keys;
    let x = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    let z = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
    if (this.stick.id >= 0) {
      const r = 46;
      x = Math.max(-1, Math.min(1, (this.stick.x - this.stick.x0) / r));
      z = Math.max(-1, Math.min(1, -(this.stick.y - this.stick.y0) / r));
    }
    const len = Math.hypot(x, z);
    return len > 1 ? [x / len, z / len] : [x, z];
  }

  get running() {
    return this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') || (this.stick.id >= 0 && Math.hypot(this.stick.x - this.stick.x0, this.stick.y - this.stick.y0) > 40);
  }
}

export const RIPPLES = 10;

// --- water ---------------------------------------------------------------------------------------------
/**
 * Every stretch of water in one flat mesh. Its shape comes from the same numbers the collisions use; the
 * shore is ragged with the floor's own pattern. It shows the wood upside down (the puddles' mirrored view),
 * deepening to dark green-teal away from the bank, with a pale lip, glints that come and go, lily pads,
 * and the leaves' shade falling on it like on the ground.
 */
export function waterMesh(pattern: THREE.Texture, reflection: THREE.Texture, tile: number) {
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      ...light,
      pattern: { value: pattern },
      reflection: { value: reflection },
      tile: { value: tile },
      res: { value: new THREE.Vector2(1, 1) },
      time: { value: 0 },
      lake: { value: new THREE.Vector4(LAKE.x, LAKE.z, LAKE.rx, LAKE.rz) },
      pond: { value: new THREE.Vector4(POND.x, POND.z, POND.rx, POND.rz) },
      river: { value: RIVER.map(([x, z]) => new THREE.Vector2(x, z)) },
      riverW: { value: RIVER_W },
      pads: { value: PADS.map((p) => new THREE.Vector4(...p)) },
      // rings spreading where you wade (x, z, when, how strong)
      ripples: { value: Array.from({ length: RIPPLES }, () => new THREE.Vector4(0, 0, -99, 0)) },
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorld;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vWorld = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D pattern;
      uniform sampler2D reflection;
      uniform float tile;
      uniform vec2 res;
      uniform float time;
      uniform vec4 lake;
      uniform vec4 pond;
      uniform vec2 river[${RIVER.length}];
      uniform float riverW;
      uniform vec4 pads[${PADS.length}];
      uniform vec4 ripples[${RIPPLES}];
      varying vec3 vWorld;
      ${BAYER}
      ${LIGHT}
      float ell(vec2 p, vec4 e) { return (length((p - e.xy) / e.zw) - 1.0) * min(e.z, e.w); }
      float seg(vec2 p, vec2 a, vec2 b) {
        vec2 pa = p - a;
        vec2 ba = b - a;
        return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0));
      }
      float h1(vec2 c) { return fract(sin(dot(c, vec2(12.9898, 78.233))) * 43758.5453); }
      void main() {
        vec2 p = vWorld.xz;
        float d = min(ell(p, lake), ell(p, pond));
        for (int i = 0; i < ${RIVER.length - 1}; i++) d = min(d, seg(p, river[i], river[i + 1]) - riverW);
        d += (texture2D(pattern, p / tile * 0.45).r - 0.47) * 0.9;
        if (d > 0.0) discard;
        float sun = sunAt(vWorld, 0.002);
        vec3 l = ambient + sunColor * sun * 0.32;
        // the wood upside down, wobbling a pixel at a time
        vec2 ruv = gl_FragCoord.xy / res;
        ruv.y = 1.0 - ruv.y;
        float wob = sin(p.x * 2.7 + time * 1.4) + sin(p.y * 5.1 - time * 1.1);
        ruv.x += floor(wob * 1.2) / res.x;
        vec3 refl = texture2D(reflection, ruv).rgb;
        float deep = clamp(-d / 2.0, 0.0, 1.0);
        deep = floor(deep * 3.0 + bayer(gl_FragCoord.xy) * 0.9) / 3.0;
        vec3 body = mix(vec3(0.2, 0.34, 0.31), vec3(0.05, 0.13, 0.15), deep) * l;
        // like real water: a mirror when you look across it, clear down to its dark bed when you look into it
        float slant = 1.0 - abs(normalize(cameraPosition - vWorld).y);
        float mirror = mix(0.12, 0.78, slant * slant) - deep * 0.1;
        vec3 col = mix(body, refl * vec3(0.78, 0.9, 0.94), mirror);
        // the bank: wet mud under the shallows, then a pale lip where the water meets it
        if (d > -0.07) col = mix(col, vec3(0.4, 0.46, 0.36) * l, 0.55);
        else if (d > -0.24) col = mix(col, vec3(0.15, 0.13, 0.09) * l, 0.45);
        // glints: short dashes that wink on and off across the surface
        vec2 cell = floor(p * vec2(2.5, 7.0));
        float g = h1(cell);
        if (g > 0.982 && fract(time * 0.5 + g * 13.0) < 0.3) col = mix(col, vec3(0.86, 0.9, 0.78) * (0.6 + sun * 0.5), 0.45);
        // rings spreading from where you wade or a shot went in, two to each, fading as they grow
        for (int i = 0; i < ${RIPPLES}; i++) {
          vec4 R = ripples[i];
          float age = time - R.z;
          if (age < 0.0 || age > 1.8) continue;
          float dist = length(p - R.xy);
          float fade = (1.0 - age / 1.8) * R.w;
          float rad = 0.06 + age * 0.62;
          if (abs(dist - rad) < 0.032 + age * 0.014) col = mix(col, vec3(0.86, 0.92, 0.84) * (0.6 + l * 0.5), min(1.0, fade));
          else if (abs(dist - rad * 0.6) < 0.022 + age * 0.008) col = mix(col, vec3(0.72, 0.8, 0.74) * (0.55 + l * 0.5), min(1.0, fade * 0.5));
        }
        // lily pads, each with its notch, and a white flower on a few
        for (int i = 0; i < ${PADS.length}; i++) {
          vec4 P = pads[i];
          vec2 q = p - P.xy;
          float r = length(q);
          if (r > P.z) continue;
          float a = atan(q.y, q.x) - P.w;
          a = abs(mod(a + 3.14159, 6.28318) - 3.14159);
          if (a < 0.32 && r > P.z * 0.2) continue;
          col = (r > P.z * 0.78 ? vec3(0.16, 0.3, 0.14) : q.x + q.y > 0.0 ? vec3(0.27, 0.46, 0.21) : vec3(0.33, 0.54, 0.25)) * l;
          if (mod(float(i), 3.0) < 0.5 && r < P.z * 0.3) col = vec3(0.93, 0.9, 0.82) * l;
        }
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  // one sheet over all the water there is
  const m = new THREE.Mesh(new THREE.PlaneGeometry(52, 152), mat);
  m.rotation.x = -Math.PI / 2;
  m.position.set(-3, 0.012, -46);
  m.frustumCulled = false;
  m.visible = false;
  return m;
}

// --- puffs where a shot lands ----------------------------------------------------------------------------------
const PUFF_N = 30;
const PUFFS = 6;
/** Little bursts of pixels: smoke and fur where an animal was, dirt or bark chips where you missed. */
export class Puffs {
  readonly points: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;
  private pos = new Float32Array(PUFF_N * PUFFS * 3);
  private vel = new Float32Array(PUFF_N * PUFFS * 3);
  private col = new Float32Array(PUFF_N * PUFFS * 3);
  private age = new Float32Array(PUFF_N * PUFFS).fill(9);
  private life = new Float32Array(PUFF_N * PUFFS).fill(1);
  private size = new Float32Array(PUFF_N * PUFFS);
  private up = new Uint8Array(PUFF_N * PUFFS);
  private next = 0;

  constructor() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    g.setAttribute('fade', new THREE.BufferAttribute(new Float32Array(PUFF_N * PUFFS).fill(1), 1));
    g.setAttribute('size', new THREE.BufferAttribute(this.size, 1));
    this.points = new THREE.Points(
      g,
      new THREE.ShaderMaterial({
        uniforms: { ambient: light.ambient },
        vertexShader: /* glsl */ `
          attribute vec3 color;
          attribute float fade;
          attribute float size;
          varying vec3 vColor;
          varying float vFade;
          void main() {
            vColor = color;
            vFade = fade;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            gl_PointSize = fade >= 1.0 ? 0.0 : size;
          }`,
        fragmentShader: /* glsl */ `
          uniform vec3 ambient;
          varying vec3 vColor;
          varying float vFade;
          ${BAYER}
          void main() {
            if (bayer(gl_FragCoord.xy) < vFade) discard;
            gl_FragColor = vec4(vColor * (0.35 + ambient * 0.7), 1.0);
          }`,
      }),
    );
    this.points.frustumCulled = false;
    this.points.visible = false;
  }

  /** A burst at a point, in the given colours: `up` throws it upwards (smoke), otherwise it spatters and falls. */
  burst(at: THREE.Vector3, colors: string[], up: boolean, count = PUFF_N) {
    const base = this.next * PUFF_N;
    this.next = (this.next + 1) % PUFFS;
    const cs = colors.map((c) => {
      const n = hex(c);
      return [(n & 255) / 255, ((n >>> 8) & 255) / 255, ((n >>> 16) & 255) / 255];
    });
    for (let i = 0; i < PUFF_N; i++) {
      const k = base + i;
      if (i >= count) {
        this.age[k] = 9;
        continue;
      }
      const a = Math.random() * Math.PI * 2;
      const r = Math.random();
      this.pos.set([at.x + Math.cos(a) * r * 0.05, at.y + Math.random() * 0.06, at.z + Math.sin(a) * r * 0.05], k * 3);
      const sp = up ? 0.35 + Math.random() * 0.5 : 0.6 + Math.random() * 1.1;
      this.vel.set([Math.cos(a) * sp, up ? 0.25 + Math.random() * 0.6 : 0.8 + Math.random() * 1.4, Math.sin(a) * sp], k * 3);
      this.col.set(cs[Math.floor(Math.random() * cs.length)], k * 3);
      this.age[k] = 0;
      this.up[k] = up ? 1 : 0;
      this.life[k] = (up ? 0.55 : 0.45) + Math.random() * 0.45;
      this.size[k] = Math.random() < (up ? 0.55 : 0.25) ? 2 : 1;
    }
    this.points.visible = true;
  }

  update(dt: number) {
    if (!this.points.visible) return;
    const fade = this.points.geometry.getAttribute('fade') as THREE.BufferAttribute;
    let any = false;
    for (let k = 0; k < this.age.length; k++) {
      if (this.age[k] >= this.life[k]) {
        fade.setX(k, 1);
        continue;
      }
      any = true;
      this.age[k] += dt;
      const smoke = this.up[k] === 1;
      const drag = Math.exp(-dt * (smoke ? 3.2 : 1.2));
      this.vel[k * 3] *= drag;
      this.vel[k * 3 + 2] *= drag;
      this.vel[k * 3 + 1] = this.vel[k * 3 + 1] * drag - dt * (smoke ? -0.15 : 5.5);
      for (let j = 0; j < 3; j++) this.pos[k * 3 + j] += this.vel[k * 3 + j] * dt;
      if (this.pos[k * 3 + 1] < 0.01) {
        this.pos[k * 3 + 1] = 0.01;
        this.vel[k * 3 + 1] = 0;
      }
      fade.setX(k, Math.max(0, (this.age[k] / this.life[k] - 0.35) / 0.65));
    }
    this.points.geometry.getAttribute('position').needsUpdate = true;
    this.points.geometry.getAttribute('color').needsUpdate = true;
    this.points.geometry.getAttribute('size').needsUpdate = true;
    fade.needsUpdate = true;
    if (!any) this.points.visible = false;
  }
}

// --- the scope ---------------------------------------------------------------------------------------------
/**
 * Looking through the scope, as glass does it: the picture is only in a round eyepiece that opens up as the
 * rifle comes to your eye; the lens bends it a little towards the rim, where red and blue part; it darkens at
 * the edge; a crescent of scope shadow creeps in from the side your eye is off the axis (sway, recoil); faint
 * glare and two ghost reflections of the sun sit on the glass; the duplex reticle is in the lens itself.
 */
export function scopePass() {
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      frame: { value: null as THREE.Texture | null },
      lowRes: { value: new THREE.Vector2(1, 1) },
      open: { value: 1 },
      shift: { value: new THREE.Vector2() },
      sun: { value: new THREE.Vector3(0, 1, 0) },
      shade: { value: 1 },
    },
    vertexShader: /* glsl */ `void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D frame;
      uniform vec2 lowRes;
      uniform float open;
      uniform vec2 shift;
      uniform vec3 sun;
      uniform float shade;
      ${BAYER}
      void main() {
        vec2 p = floor(gl_FragCoord.xy) + 0.5;
        float full = min(lowRes.x, lowRes.y) * 0.6;
        float R = full * mix(0.3, 1.0, open);
        vec2 c = lowRes * 0.5 + shift;
        vec2 q = (p - c) / R;
        float d = length(q);
        float dith = bayer(p);
        if (d > 1.0) {
          // the inside of the tube, its rim just catching the light
          vec3 tube = vec3(0.018, 0.022, 0.02);
          if (d < 1.05) tube = vec3(0.08, 0.09, 0.085) * shade * (dith < 0.5 ? 1.0 : 0.55);
          gl_FragColor = vec4(tube, 1.0);
          return;
        }
        vec2 dir = d > 0.0 ? q / d : vec2(0.0);
        // the lens: magnified a touch in the middle, bending towards the rim, colours parting at the edge
        vec2 at = lowRes * 0.5 + q * full * (0.86 + 0.14 * d * d);
        float fringe = smoothstep(0.7, 1.0, d) * 1.5;
        vec3 col;
        col.r = texture2D(frame, (at + dir * fringe) / lowRes).r;
        col.g = texture2D(frame, at / lowRes).g;
        col.b = texture2D(frame, (at - dir * fringe) / lowRes).b;
        // the coating's faint cool cast, and the edge darkening in dithered steps
        col *= vec3(0.95, 1.0, 1.03);
        float vig = smoothstep(0.8, 1.0, d);
        if (dith < vig * 0.75) col *= 0.7;
        // scope shadow: your eye off the axis lets the tube's dark creep in from that side
        float off = length(shift) / full;
        if (off > 0.004) {
          float side = dot(dir, -normalize(shift));
          if (d > 1.0 - off * 2.6 * (0.5 + side) && side > -0.2) col *= dith < 0.7 ? 0.12 : 0.4;
        }
        // glare on the glass: a soft band across it and two ghosts of the light, opposite the sun
        vec2 s2 = normalize(sun.xy + vec2(0.0001));
        float g = sun.z * shade;
        float band = abs(dot(q, vec2(-s2.y, s2.x)) * 0.6 + dot(q, s2) * 0.25 - 0.32);
        if (band < 0.05 && dith < 0.3 * g) col += vec3(0.07, 0.075, 0.07);
        for (int i = 1; i <= 2; i++) {
          float k = float(i);
          float r = length(q + s2 * (0.25 + 0.3 * k));
          if (abs(r - 0.07 * k) < 0.018 && dith < 0.55 * g) col += vec3(0.05, 0.07, 0.06) * k;
        }
        // the duplex reticle: fine lines through the middle, thick posts out at the edge
        vec2 rp = p - c;
        float thin = 0.5;
        float post = d > 0.55 ? 1.5 : thin;
        if ((abs(rp.x) < post && abs(rp.y) > 1.0) || (abs(rp.y) < post && abs(rp.x) > 1.0) || length(rp) < 0.8) col = vec3(0.03, 0.035, 0.03);
        gl_FragColor = vec4(col, 1.0);
      }`,
    depthTest: false,
    depthWrite: false,
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
  const m = new THREE.Mesh(g, mat);
  m.frustumCulled = false;
  const scene = new THREE.Scene();
  scene.add(m);
  return { scene, uniforms: mat.uniforms };
}

// --- the HUD ---------------------------------------------------------------------------------------------
const hudMaterial = (tex: THREE.Texture) =>
  new THREE.ShaderMaterial({
    uniforms: { map: { value: tex }, shade: { value: 1 }, fade: { value: 0 } },
    vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D map;
      uniform float shade;
      uniform float fade;
      varying vec2 vUv;
      ${BAYER}
      void main() {
        vec4 c = texture2D(map, vec2(vUv.x, 1.0 - vUv.y));
        if (c.a < 0.5) discard;
        if (fade > 0.0 && bayer(gl_FragCoord.xy) < fade) discard;
        gl_FragColor = vec4(c.rgb * shade, 1.0);
      }`,
    depthTest: false,
    depthWrite: false,
  });

type Sprite = THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial> & { userData: { w: number; h: number } };
function sprite(pix: Pix, order = 0): Sprite {
  const g = new THREE.PlaneGeometry(1, 1);
  g.translate(0.5, 0.5, 0);
  const m = new THREE.Mesh(g, hudMaterial(toTexture(pix, { mips: false }))) as unknown as Sprite;
  m.scale.set(pix.w, pix.h, 1);
  m.userData = { w: pix.w, h: pix.h };
  m.renderOrder = order;
  m.frustumCulled = false;
  return m;
}
/** Swaps a sprite's picture (and size). */
function repaint(s: Sprite, pix: Pix) {
  (s.material.uniforms.map.value as THREE.Texture).dispose();
  s.material.uniforms.map.value = toTexture(pix, { mips: false });
  s.scale.set(pix.w, pix.h, 1);
  s.userData = { w: pix.w, h: pix.h };
}
/** Puts a sprite's bottom-left corner on a whole pixel (y counts up from the bottom). */
const place = (s: Sprite, x: number, y: number) => s.position.set(Math.round(x), Math.round(y), 0);

function ring(r: number, thick: number, color: number): Pix {
  const s = r * 2 + 3;
  const p = new Pix(s, s);
  const c = (s - 1) / 2;
  for (let y = 0; y < s; y++)
    for (let x = 0; x < s; x++) {
      const d = Math.hypot(x - c, y - c);
      if (d <= r + 0.5 && d >= r - thick + 0.5) p.set(x, y, color);
      else if (d <= r + 1.5 && d >= r - thick - 0.5) p.set(x, y, hex('#1a1410'));
    }
  return p;
}

/**
 * What's drawn flat over the view, in game pixels: the muzzle flash and its smoke (at the 3D rifle's muzzle),
 * the crosshair (warm when an animal is in it), the hit marker, the arcade counter at the top, "+1"s rising
 * from what you hit, and on touch screens the walking stick under your thumb.
 */
export class Hud {
  readonly scene = new THREE.Scene();
  readonly cam = new THREE.OrthographicCamera(0, 1, 1, 0, -1, 1);
  private flash: Sprite[];
  private cross: Sprite;
  private crossHot: Sprite;
  private marker: Sprite;
  private tally: Sprite;
  private plus: { s: Sprite; d: Sprite; age: number; x: number; y: number }[] = [];
  private stickRing: Sprite;
  private stickKnob: Sprite;
  private smoke: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>;
  private smokeP: { x: number; y: number; vx: number; vy: number; age: number }[] = [];
  private score = -1;
  private pop = 0;
  private hitT = 9;
  flashT = 9;

  constructor() {
    this.flash = [sprite(flashSprite(true), 3), sprite(flashSprite(false), 3)];
    this.cross = sprite(crosshairSprite(CREAM), 4);
    this.crossHot = sprite(crosshairSprite(hex('#e5704f')), 4);
    this.marker = sprite(hitSprite(), 7);
    this.tally = sprite(new Pix(1, 1), 8);
    this.stickRing = sprite(ring(15, 2, hex('#f1ebd6')), 1);
    this.stickKnob = sprite(ring(5, 5, hex('#c9d48f')), 1);
    for (let i = 0; i < 5; i++) {
      const s = sprite(pixelText('+1', hex('#f2d36a'), hex('#fff1b8')), 9);
      const d = sprite(new Pix(1, 1), 9);
      s.visible = d.visible = false;
      this.plus.push({ s, d, age: 9, x: 0, y: 0 });
    }
    this.smoke = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ color: 0xd9d4c2, size: 2, sizeAttenuation: false, depthTest: false }));
    this.smoke.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(24 * 3), 3));
    this.smoke.frustumCulled = false;
    this.smoke.renderOrder = 3;
    this.scene.add(...this.flash, this.cross, this.crossHot, this.marker, this.tally, this.stickRing, this.stickKnob, this.smoke, ...this.plus.flatMap((p) => [p.s, p.d]));
  }

  setScore(n: number) {
    if (n === this.score) return;
    const first = this.score < 0;
    this.score = n;
    if (!first) this.pop = 0.4;
    this.paintTally();
  }

  private paintTally() {
    const hot = this.pop > 0;
    const icon = tallyIcon();
    const text = pixelText(`x${String(this.score).padStart(3, '0')}`, hot ? hex('#f2d36a') : CREAM, hot ? hex('#fff1b8') : hex('#fffbea'));
    const p = new Pix(icon.w + text.w + 1, Math.max(icon.h, text.h));
    p.blit(icon, 0, 0);
    p.blit(text, icon.w + 1, 0);
    repaint(this.tally, p);
  }

  /** A shot: the flash, and a wisp of smoke from the muzzle. */
  fire() {
    this.flashT = 0;
    for (let i = 0; i < 8; i++) this.smokeP.push({ x: 0, y: 0, vx: -6 - Math.random() * 10, vy: 6 + Math.random() * 10, age: -Math.random() * 0.08 });
    if (this.smokeP.length > 24) this.smokeP.splice(0, this.smokeP.length - 24);
  }

  /** A hit: the marker round the middle. */
  hit() {
    this.hitT = 0;
  }

  /** A "+1" rising from where the animal was (in game pixels, y up), and under it how far the shot was. */
  plusOne(x: number, y: number, metres: number) {
    const p = this.plus.find((q) => q.age >= 1.2) ?? this.plus[0];
    repaint(p.d, pixelText(`${metres}m!`, CREAM, hex('#fffbea')));
    p.age = 0;
    p.x = x - p.s.userData.w / 2;
    p.y = y;
  }

  update(dt: number, o: { W: number; H: number; hot: boolean; show: boolean; aim: number; muzzle: [number, number]; stick: { on: boolean; x0: number; y0: number; x: number; y: number } | null }) {
    const { W, H } = o;
    this.cam.right = W;
    this.cam.top = H;
    this.cam.updateProjectionMatrix();
    this.scene.visible = o.show;
    const scoped = o.aim > 0.75;
    const [mx, my] = o.muzzle;
    this.flashT += dt;
    this.flash.forEach((f, i) => {
      f.visible = !scoped && (i === 0 ? this.flashT < 0.045 : this.flashT >= 0.045 && this.flashT < 0.085);
      place(f, mx - (f.userData.w - 1) / 2, my - (f.userData.h - 1) / 2);
    });
    // a wisp of smoke from the muzzle, drifting up and away
    const sp = this.smoke.geometry.getAttribute('position') as THREE.BufferAttribute;
    this.smokeP = this.smokeP.filter((s) => s.age < 0.7);
    for (let i = 0; i < 24; i++) {
      const s = this.smokeP[i];
      if (!s || scoped) {
        sp.setXYZ(i, -99, -99, 0);
        continue;
      }
      if (s.age < 0) s.x = s.y = 0;
      s.age += dt;
      if (s.age > 0) {
        s.x += s.vx * dt;
        s.y += s.vy * dt;
      }
      const gone = s.age < 0 || ((i * 7) % 10) / 10 < s.age / 0.7;
      sp.setXYZ(i, gone ? -99 : Math.round(mx + s.x) + 0.5, gone ? -99 : Math.round(my + s.y) + 0.5, 0);
    }
    sp.needsUpdate = true;
    // the crosshair, dead centre (the scope has its own reticle)
    const cx = Math.floor(W / 2) - 5;
    const cy = Math.floor(H / 2) - 5;
    place(this.cross, cx, cy);
    place(this.crossHot, cx, cy);
    this.cross.visible = !o.hot && o.aim < 0.3;
    this.crossHot.visible = o.hot && o.aim < 0.3;
    this.hitT += dt;
    this.marker.visible = this.hitT < 0.28;
    place(this.marker, Math.floor(W / 2) - 7, Math.floor(H / 2) - 7);
    // the counter, top centre; it hops a pixel and flashes warm when it goes up
    if (this.pop > 0) {
      this.pop -= dt;
      if (this.pop <= 0) this.paintTally();
    }
    place(this.tally, Math.floor((W - this.tally.userData.w) / 2), H - this.tally.userData.h - 5 + (this.pop > 0.2 ? 1 : 0));
    for (const p of this.plus) {
      p.age += dt;
      p.s.visible = p.d.visible = p.age < 1.2;
      if (!p.s.visible) continue;
      const rise = Math.min(1, p.age / 0.5) * 12;
      place(p.s, p.x, p.y + rise);
      place(p.d, p.x + (p.s.userData.w - p.d.userData.w) / 2, p.y + rise - p.d.userData.h);
      p.s.material.uniforms.fade.value = p.d.material.uniforms.fade.value = Math.max(0, (p.age - 0.75) / 0.45);
    }
    // the touch stick, where the left thumb is
    const st = o.stick;
    this.stickRing.visible = this.stickKnob.visible = !!st?.on;
    if (st?.on) {
      const dx = st.x - st.x0;
      const dy = st.y - st.y0;
      const len = Math.hypot(dx, dy);
      const lim = Math.min(len, 13) / Math.max(len, 1e-6);
      place(this.stickRing, st.x0 - (this.stickRing.userData.w - 1) / 2, st.y0 - (this.stickRing.userData.h - 1) / 2);
      place(this.stickKnob, st.x0 + dx * lim - (this.stickKnob.userData.w - 1) / 2, st.y0 + dy * lim - (this.stickKnob.userData.h - 1) / 2);
      this.stickRing.material.uniforms.fade.value = 0.45;
    }
  }
}
