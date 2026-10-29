/**
 * Breaking a sprite to pieces: it is cut into plank-like shards (each keeps its own painted pixels), which fly,
 * tumble, knock into each other and bounce on the floor until they lie still; and a spray of pixel particles
 * (chips, moss, leaves, paper, dust) goes with them, with a puff of dust wherever a shard lands hard.
 * All shards are one mesh and all particles one set of points, so the whole thing is two draw calls,
 * and nothing is worked out once everything has come to rest.
 */

import * as THREE from 'three';
import { BAYER, light, meshFor, toTexture, type LayerMesh } from './gl';
import { mulberry, Pix } from './pix';
import { K0 } from './config';

export type Shards = { atlas: Pix; pieces: { x: number; y: number; w: number; h: number; ax: number; ay: number }[] };

/**
 * Cuts a sprite into about `count` shards: every painted pixel joins its nearest seed, the distance stretched
 * across so the shards come out long like split planks. The shards are packed side by side into one atlas.
 */
export function cut(src: Pix, count: number, seed: number): Shards {
  const rnd = mulberry(seed);
  const seeds: [number, number][] = [];
  for (let tries = 0; seeds.length < count && tries < count * 60; tries++) {
    const x = Math.floor(rnd() * src.w);
    const y = Math.floor(rnd() * src.h);
    if (src.get(x, y) >>> 24) seeds.push([x, y]);
  }
  const owner = new Int32Array(src.w * src.h).fill(-1);
  const box = seeds.map(() => [Infinity, Infinity, -1, -1]);
  for (let y = 0; y < src.h; y++) {
    for (let x = 0; x < src.w; x++) {
      if (!(src.data[y * src.w + x] >>> 24)) continue;
      let best = 0;
      let bd = Infinity;
      for (let i = 0; i < seeds.length; i++) {
        const dx = (x - seeds[i][0]) * 0.5;
        const dy = y - seeds[i][1];
        const d = dx * dx + dy * dy;
        if (d < bd) {
          bd = d;
          best = i;
        }
      }
      owner[y * src.w + x] = best;
      const b = box[best];
      b[0] = Math.min(b[0], x);
      b[1] = Math.min(b[1], y);
      b[2] = Math.max(b[2], x);
      b[3] = Math.max(b[3], y);
    }
  }
  // shelf-pack the shards, tallest first
  const order = box.map((b, i) => i).filter((i) => box[i][2] >= 0).sort((a, b) => box[b][3] - box[b][1] - (box[a][3] - box[a][1]));
  const width = 256;
  const place: { x: number; y: number }[] = [];
  let sx = 0;
  let sy = 0;
  let row = 0;
  for (const i of order) {
    const w = box[i][2] - box[i][0] + 3;
    const h = box[i][3] - box[i][1] + 3;
    if (sx + w > width) {
      sx = 0;
      sy += row;
      row = 0;
    }
    place[i] = { x: sx + 1, y: sy + 1 };
    sx += w;
    row = Math.max(row, h);
  }
  const atlas = new Pix(width, Math.max(1, sy + row));
  const pieces: Shards['pieces'] = [];
  for (const i of order) {
    const [x0, y0, x1, y1] = box[i];
    const at = place[i];
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (owner[y * src.w + x] === i) atlas.set(at.x + x - x0, at.y + y - y0, src.data[y * src.w + x]);
    pieces.push({ x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1, ax: at.x, ay: at.y });
  }
  atlas.bleed();
  return { atlas, pieces };
}

type Shard = {
  p: THREE.Vector3;
  v: THREE.Vector3;
  q: THREE.Quaternion;
  w: THREE.Vector3;
  hx: number;
  hy: number;
  r: number;
  rest: boolean;
};

const MAX_DUST = 4;
const up = new THREE.Vector3(0, 1, 0);
const zAxis = new THREE.Vector3(0, 0, 1);
const ax = new THREE.Vector3();
const ay = new THREE.Vector3();
const tmp = new THREE.Vector3();
const dq = new THREE.Quaternion();
const flat = new THREE.Quaternion();
const yaw = new THREE.Quaternion();

/** A shower of square pixel particles: chips that bounce, dust that rises and thins, leaves and paper that flutter down. */
class Spray {
  readonly points: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;
  private n = 0;
  private readonly pos: Float32Array;
  private readonly vel: Float32Array;
  private readonly col: Float32Array;
  private readonly size: Float32Array;
  private readonly life: Float32Array;
  private readonly age: Float32Array;
  private readonly kind: Uint8Array;
  constructor(private readonly max: number) {
    this.pos = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.col = new Float32Array(max * 4);
    this.size = new Float32Array(max);
    this.life = new Float32Array(max);
    this.age = new Float32Array(max);
    this.kind = new Uint8Array(max);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('size', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    g.setDrawRange(0, 0);
    const mat = new THREE.ShaderMaterial({
      uniforms: { ambient: light.ambient, k0: { value: K0 } },
      vertexShader: /* glsl */ `
        attribute vec4 color;
        attribute float size;
        uniform float k0;
        varying vec4 vC;
        void main() {
          vC = color;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          // size is in world units: as many game pixels as it covers at its distance, at least one
          gl_PointSize = max(1.0, floor(size / (-mv.z * k0) + 0.5));
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 ambient;
        varying vec4 vC;
        ${BAYER}
        void main() {
          // see-through by dithering, never by blending, so they stay pixels
          if (vC.a < bayer(gl_FragCoord.xy)) discard;
          gl_FragColor = vec4(vC.rgb * (0.35 + ambient * 0.75), 1.0);
        }`,
    });
    this.points = new THREE.Points(g, mat);
    this.points.frustumCulled = false;
  }
  get active() {
    return this.n > 0;
  }
  get capacity() {
    return this.max;
  }
  /** kind: 0 chip, 1 dust, 2 flutter (leaf, paper) */
  emit(x: number, y: number, z: number, vx: number, vy: number, vz: number, rgb: [number, number, number], size: number, life: number, kind: number) {
    if (this.n >= this.max) return;
    const i = this.n++;
    this.pos.set([x, y, z], i * 3);
    this.vel.set([vx, vy, vz], i * 3);
    this.col.set([rgb[0], rgb[1], rgb[2], kind === 1 ? 0.55 : 1], i * 4);
    this.size[i] = size;
    this.life[i] = life;
    this.age[i] = 0;
    this.kind[i] = kind;
  }
  update(dt: number, t: number) {
    const { pos, vel, col, size, life, age, kind } = this;
    for (let i = 0; i < this.n; i++) {
      age[i] += dt;
      const k = kind[i];
      const o = i * 3;
      if (k === 1) {
        // dust: slows at once, drifts up, swells and thins
        const drag = Math.exp(-dt * 4);
        vel[o] *= drag;
        vel[o + 1] = vel[o + 1] * drag + dt * 0.12;
        vel[o + 2] *= drag;
        size[i] += dt * 0.012;
        col[i * 4 + 3] = 0.55 * Math.max(0, 1 - age[i] / life[i]);
      } else if (k === 2) {
        // leaves and paper: light, they sway down
        vel[o + 1] -= dt * 2.2;
        const drag = Math.exp(-dt * 2.5);
        vel[o] = vel[o] * drag + Math.sin(t * 6 + i) * dt * 1.6;
        vel[o + 1] *= drag;
        vel[o + 2] *= drag;
      } else {
        vel[o + 1] -= dt * 9.8;
      }
      pos[o] += vel[o] * dt;
      pos[o + 1] += vel[o + 1] * dt;
      pos[o + 2] += vel[o + 2] * dt;
      if (pos[o + 1] < 0.004 && k !== 1) {
        // the floor: chips bounce and skid, light things settle
        pos[o + 1] = 0.004;
        vel[o + 1] = k === 0 && vel[o + 1] < -0.6 ? -vel[o + 1] * 0.3 : 0;
        vel[o] *= k === 0 ? 0.6 : 0;
        vel[o + 2] *= k === 0 ? 0.6 : 0;
      }
      if (k !== 1 && age[i] > life[i] - 0.6) col[i * 4 + 3] = Math.max(0, (life[i] - age[i]) / 0.6);
      if (age[i] >= life[i]) {
        // swap the last one in
        const j = --this.n;
        pos.copyWithin(o, j * 3, j * 3 + 3);
        vel.copyWithin(o, j * 3, j * 3 + 3);
        col.copyWithin(i * 4, j * 4, j * 4 + 4);
        size[i] = size[j];
        life[i] = life[j];
        age[i] = age[j];
        kind[i] = kind[j];
        i--;
      }
    }
    const g = this.points.geometry;
    g.setDrawRange(0, this.n);
    (g.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (g.attributes.color as THREE.BufferAttribute).needsUpdate = true;
    (g.attributes.size as THREE.BufferAttribute).needsUpdate = true;
  }
  clear() {
    this.n = 0;
    this.points.geometry.setDrawRange(0, 0);
  }
}

const rgbOf = (c: number): [number, number, number] => [(c & 255) / 255, ((c >>> 8) & 255) / 255, ((c >>> 16) & 255) / 255];

/** The broken pieces of one sprite (whatever was painted on it goes with them), and their spray. */
export class Shatter {
  readonly mesh: LayerMesh;
  readonly spray: Spray;
  private shards: Shard[] = [];
  private readonly geo: THREE.BufferGeometry;
  private readonly posAttr: THREE.BufferAttribute;
  private sinking = -1;
  private still = true;
  private clock = 0;
  private dust = 0;

  constructor(
    private readonly src: Pix,
    private readonly shards0: Shards,
    maxParticles: number,
  ) {
    const n = shards0.pieces.length;
    this.geo = new THREE.BufferGeometry();
    this.posAttr = new THREE.BufferAttribute(new Float32Array(n * 12), 3).setUsage(THREE.DynamicDrawUsage);
    const uv = new Float32Array(n * 8);
    const idx: number[] = [];
    const { atlas } = shards0;
    shards0.pieces.forEach((pc, i) => {
      const u0 = pc.ax / atlas.w;
      const u1 = (pc.ax + pc.w) / atlas.w;
      const v0 = pc.ay / atlas.h;
      const v1 = (pc.ay + pc.h) / atlas.h;
      uv.set([u0, v0, u1, v0, u0, v1, u1, v1], i * 8);
      idx.push(i * 4, i * 4 + 2, i * 4 + 1, i * 4 + 2, i * 4 + 3, i * 4 + 1);
    });
    this.geo.setAttribute('position', this.posAttr);
    this.geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    this.geo.setIndex(idx);
    this.mesh = meshFor(this.geo, toTexture(atlas, { mips: false }), 1, false);
    this.mesh.material.side = THREE.DoubleSide;
    this.mesh.userData.always = true;
    this.mesh.visible = false;
    this.spray = new Spray(maxParticles);
  }

  get busy() {
    return !this.still || this.spray.active || this.sinking >= 0;
  }

  /**
   * Breaks the sprite where it stands: `place` maps a sprite pixel (x, y) to the world, `t` is one texel
   * in world units, `turn` the sprite's facing. Shards and spray burst out from `from`, and toward the viewer.
   */
  burst(place: (x: number, y: number, out: THREE.Vector3) => THREE.Vector3, t: number, turn: THREE.Quaternion, from: THREE.Vector3, seed: number) {
    const rnd = mulberry(seed);
    this.sinking = -1;
    this.still = false;
    this.mesh.visible = true;
    this.shards = this.shards0.pieces.map((pc) => {
      const p = place(pc.x + pc.w / 2, pc.y + pc.h / 2, new THREE.Vector3());
      const out = tmp.copy(p).sub(from);
      out.z = Math.abs(out.z) + 0.4;
      out.normalize();
      const speed = 1.6 + rnd() * 3.2;
      const v = new THREE.Vector3(out.x * speed, 1.2 + rnd() * 3.4 + out.y * speed * 0.5, out.z * speed * 0.8 + rnd() * 0.8);
      const w = new THREE.Vector3((rnd() - 0.5) * 14, (rnd() - 0.5) * 10, (rnd() - 0.5) * 14);
      const hx = (pc.w / 2) * t;
      const hy = (pc.h / 2) * t;
      return { p, v, q: turn.clone(), w, hx, hy, r: Math.max(0.02, Math.min(hx, hy) * 0.9), rest: false };
    });
    // the spray: made of the sprite's own colours, so the wood throws wood chips and the moss throws moss
    const { src } = this;
    const count = Math.min(this.spray.capacity * 0.75, 520);
    const at = new THREE.Vector3();
    for (let i = 0; i < count; i++) {
      const x = Math.floor(rnd() * src.w);
      const y = Math.floor(rnd() * src.h);
      const c = src.get(x, y);
      if (!(c >>> 24)) continue;
      place(x, y, at);
      const rgb = rgbOf(c);
      const green = rgb[1] > rgb[0] * 1.15 && rgb[1] > rgb[2];
      const pale = rgb[0] + rgb[1] + rgb[2] > 2.2;
      const kind = green || pale ? (rnd() < 0.6 ? 2 : 0) : 0;
      const out = tmp.copy(at).sub(from).normalize();
      const sp = (kind === 2 ? 1.2 : 2.5) + rnd() * 4;
      this.spray.emit(at.x, at.y, at.z, out.x * sp + (rnd() - 0.5), 1 + rnd() * 4 + out.y * sp * 0.4, Math.abs(out.z) * sp + rnd() * 1.5, rgb, t * (kind === 2 ? 2 : 1 + rnd() * 1.5), 2.5 + rnd() * 3, kind);
    }
    // and a cloud of dust where it stood
    for (let i = 0; i < 46; i++) {
      const x = Math.floor(rnd() * src.w);
      const y = Math.floor(rnd() * src.h);
      place(x, y, at);
      const g = 0.62 + rnd() * 0.12;
      this.spray.emit(at.x, at.y, at.z + 0.05, (rnd() - 0.5) * 2.4, (rnd() - 0.2) * 1.2, rnd() * 1.4, [g, g * 0.94, g * 0.82], t * (3 + rnd() * 4), 1 + rnd() * 1.4, 1);
    }
  }

  /** The pieces sink into the ground and the spray dies away (a new board is coming). */
  sink() {
    if (!this.mesh.visible) return;
    this.sinking = 0;
  }

  update(dt: number) {
    if (!this.busy) return;
    this.clock += dt;
    if (this.spray.active) this.spray.update(dt, this.clock);
    if (this.sinking >= 0) {
      this.sinking += dt;
      for (const s of this.shards) s.p.y -= dt * 0.5;
      this.write();
      if (this.sinking > 1.2) {
        this.sinking = -1;
        this.still = true;
        this.mesh.visible = false;
        this.shards = [];
      }
      return;
    }
    if (this.still) return;
    this.dust = 0;
    const steps = dt > 0.02 ? 2 : 1;
    const h = dt / steps;
    let moving = false;
    for (let k = 0; k < steps; k++) {
      for (const s of this.shards) {
        if (s.rest) continue;
        moving = true;
        s.v.y -= 9.8 * h;
        s.p.addScaledVector(s.v, h);
        // spin: q' = ½ ω q
        dq.set(s.w.x * h * 0.5, s.w.y * h * 0.5, s.w.z * h * 0.5, 0).multiply(s.q);
        s.q.set(s.q.x + dq.x, s.q.y + dq.y, s.q.z + dq.z, s.q.w + dq.w).normalize();
        // how far the shard reaches down, as it is turned
        ax.set(1, 0, 0).applyQuaternion(s.q);
        ay.set(0, 1, 0).applyQuaternion(s.q);
        const reach = Math.abs(ax.y) * s.hx + Math.abs(ay.y) * s.hy + 0.006;
        if (s.p.y < reach) {
          s.p.y = reach;
          const hit = -s.v.y;
          if (hit > 1.4) this.impact(s, hit);
          s.v.y = hit > 0.5 ? hit * 0.3 : 0;
          s.v.x *= 0.7;
          s.v.z *= 0.7;
          s.w.multiplyScalar(0.62);
          // lying down: ease it flat, face up or down as it fell, keeping its heading
          tmp.set(0, 0, 1).applyQuaternion(s.q);
          flat.setFromUnitVectors(zAxis, tmp.y >= 0 ? up : tmp.set(0, -1, 0));
          yaw.setFromAxisAngle(up, Math.atan2(ax.x, ax.z) - Math.PI / 2);
          flat.premultiply(yaw);
          s.q.slerp(flat, Math.min(1, h * 7));
          if (s.v.lengthSq() < 0.02 && s.w.lengthSq() < 0.3) {
            s.rest = true;
            s.v.set(0, 0, 0);
          }
        }
      }
      // shards knock each other apart
      for (let i = 0; i < this.shards.length; i++) {
        const a = this.shards[i];
        for (let j = i + 1; j < this.shards.length; j++) {
          const b = this.shards[j];
          if (a.rest && b.rest) continue;
          tmp.subVectors(b.p, a.p);
          const dist = tmp.length();
          const min = a.r + b.r;
          if (dist >= min || dist < 1e-5) continue;
          tmp.divideScalar(dist);
          const push = (min - dist) * 0.5;
          a.p.addScaledVector(tmp, -push);
          b.p.addScaledVector(tmp, push);
          const rel = (b.v.x - a.v.x) * tmp.x + (b.v.y - a.v.y) * tmp.y + (b.v.z - a.v.z) * tmp.z;
          if (rel < 0) {
            const j2 = -rel * 0.7;
            a.v.addScaledVector(tmp, -j2);
            b.v.addScaledVector(tmp, j2);
            a.rest = b.rest = false;
          }
        }
      }
    }
    this.write();
    if (!moving) this.still = true;
  }

  /** A shard landing hard: a puff of dust and a few chips off the floor. */
  private impact(s: Shard, speed: number) {
    if (this.dust++ > MAX_DUST) return;
    const n = Math.min(10, Math.round(speed * 2));
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const g = 0.5 + Math.random() * 0.15;
      this.spray.emit(s.p.x, 0.02, s.p.z, Math.cos(a) * speed * 0.35, 0.3 + Math.random() * 0.6, Math.sin(a) * speed * 0.35, [g, g * 0.95, g * 0.8], 0.02 + Math.random() * 0.03, 0.8 + Math.random() * 0.8, 1);
    }
    for (let i = 0; i < 3; i++) {
      const a = Math.random() * Math.PI * 2;
      this.spray.emit(s.p.x, 0.02, s.p.z, Math.cos(a) * 1.4, 1 + Math.random() * 1.6, Math.sin(a) * 1.4, [0.26, 0.36 + Math.random() * 0.12, 0.18], 0.012, 1.4, 0);
    }
  }

  /** Writes every shard's four corners into the mesh. */
  private write() {
    const arr = this.posAttr.array as Float32Array;
    this.shards.forEach((s, i) => {
      ax.set(s.hx, 0, 0).applyQuaternion(s.q);
      ay.set(0, s.hy, 0).applyQuaternion(s.q);
      const o = i * 12;
      arr[o] = s.p.x - ax.x + ay.x;
      arr[o + 1] = s.p.y - ax.y + ay.y;
      arr[o + 2] = s.p.z - ax.z + ay.z;
      arr[o + 3] = s.p.x + ax.x + ay.x;
      arr[o + 4] = s.p.y + ax.y + ay.y;
      arr[o + 5] = s.p.z + ax.z + ay.z;
      arr[o + 6] = s.p.x - ax.x - ay.x;
      arr[o + 7] = s.p.y - ax.y - ay.y;
      arr[o + 8] = s.p.z - ax.z - ay.z;
      arr[o + 9] = s.p.x + ax.x - ay.x;
      arr[o + 10] = s.p.y + ax.y - ay.y;
      arr[o + 11] = s.p.z + ax.z - ay.z;
    });
    this.posAttr.needsUpdate = true;
  }

  /** Earth thrown up where a new board pulls itself out of the ground. */
  dirt(x0: number, x1: number, z: number) {
    for (let i = 0; i < 70; i++) {
      const x = x0 + Math.random() * (x1 - x0);
      const brown = Math.random() < 0.6;
      const rgb: [number, number, number] = brown ? [0.3, 0.22, 0.15] : [0.22, 0.38, 0.16];
      this.spray.emit(x, 0.02, z + (Math.random() - 0.5) * 0.2, (Math.random() - 0.5) * 1.6, 1 + Math.random() * 2.4, Math.random() * 0.8, rgb, 0.012 + Math.random() * 0.012, 1.2 + Math.random(), 0);
    }
    for (let i = 0; i < 18; i++) {
      const x = x0 + Math.random() * (x1 - x0);
      this.spray.emit(x, 0.03, z + 0.05, (Math.random() - 0.5) * 1.2, 0.2 + Math.random() * 0.5, Math.random() * 0.5, [0.55, 0.5, 0.42], 0.03 + Math.random() * 0.03, 1 + Math.random(), 1);
    }
  }

  /** Whether the shards are showing (flying, lying about or sinking). */
  get shown() {
    return this.mesh.visible;
  }

  dispose() {
    this.geo.dispose();
    (this.mesh.material.uniforms.map.value as THREE.Texture).dispose();
    this.mesh.material.dispose();
    this.spray.points.geometry.dispose();
    this.spray.points.material.dispose();
  }
}
