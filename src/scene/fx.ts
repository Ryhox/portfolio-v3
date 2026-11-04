import * as THREE from 'three';
import { LIGHT, light } from './gl';
import { hex, Pix, rgbOf } from './pix';

/**
 * Pill mode's little effects in 3D: the cubes an animal bursts into (its own colours, and a cartoon jam red, never
 * gore), and the marks shots leave: a hole in a trunk with the pale wood showing round it, a scuff in the earth,
 * a dent in the snow. All pooled, all instanced: a burst costs nothing to draw.
 */
const VOX = 360;
export class Voxels {
  readonly mesh: THREE.InstancedMesh<THREE.BoxGeometry, THREE.ShaderMaterial>;
  private pos = new Float32Array(VOX * 3);
  private vel = new Float32Array(VOX * 3);
  private spin = new Float32Array(VOX * 3);
  private rot = new Float32Array(VOX * 3);
  private size = new Float32Array(VOX);
  private age = new Float32Array(VOX).fill(99);
  private life = new Float32Array(VOX).fill(1);
  private next = 0;
  private m4 = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private e = new THREE.Euler();
  private v = new THREE.Vector3();
  private s = new THREE.Vector3();
  private col = new THREE.Color();

  constructor() {
    const mat = new THREE.ShaderMaterial({
      uniforms: { ...light },
      vertexShader: /* glsl */ `
        varying vec3 vColor;
        varying vec3 vWorld;
        varying vec3 vNormal;
        void main() {
          vColor = instanceColor;
          vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0);
          vWorld = w.xyz;
          vNormal = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
          gl_Position = projectionMatrix * viewMatrix * w;
        }`,
      fragmentShader: /* glsl */ `
        varying vec3 vColor;
        varying vec3 vWorld;
        varying vec3 vNormal;
        ${LIGHT}
        void main() {
          vec3 n = normalize(vNormal);
          float f = dot(n, -sunDir);
          float side = f > 0.3 ? 1.0 : f > -0.15 ? 0.82 : 0.64;
          vec3 l = (ambient * 0.9 + 0.2) * side + sunColor * (f > 0.0 ? sunAt(vWorld + n * 0.02, 0.0015) : 0.0) * 0.5;
          gl_FragColor = vec4(vColor * l, 1.0);
        }`,
    });
    this.mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mat, VOX);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(VOX * 3), 3);
    this.mesh.frustumCulled = false;
    this.m4.makeScale(0, 0, 0);
    for (let i = 0; i < VOX; i++) this.mesh.setMatrixAt(i, this.m4);
  }

  /** A burst of `n` cubes at `at`, flying out and up, in the given colours. */
  burst(at: THREE.Vector3, colors: string[], n: number, size: number, speed: number, up = 1.6) {
    for (let k = 0; k < n; k++) {
      const i = this.next;
      this.next = (this.next + 1) % VOX;
      const a = Math.random() * Math.PI * 2;
      const sp = speed * (0.3 + Math.random() * 0.9);
      this.pos.set([at.x + (Math.random() - 0.5) * size * 3, at.y + (Math.random() - 0.5) * size * 3, at.z + (Math.random() - 0.5) * size * 3], i * 3);
      this.vel.set([Math.cos(a) * sp, up * (0.6 + Math.random()), Math.sin(a) * sp], i * 3);
      this.spin.set([Math.random() * 14 - 7, Math.random() * 14 - 7, Math.random() * 14 - 7], i * 3);
      this.rot.set([0, 0, 0], i * 3);
      this.size[i] = size * (0.6 + Math.random() * 0.8);
      this.age[i] = 0;
      this.life[i] = 2.2 + Math.random() * 2;
      const [r, g, b] = rgbOf(hex(colors[k % colors.length]));
      this.mesh.instanceColor!.setXYZ(i, r / 255, g / 255, b / 255);
    }
    this.mesh.instanceColor!.needsUpdate = true;
  }

  update(dt: number) {
    for (let i = 0; i < VOX; i++) {
      if (this.age[i] >= this.life[i]) {
        if (this.age[i] < 90) {
          this.age[i] = 99;
          this.mesh.setMatrixAt(i, this.m4.makeScale(0, 0, 0));
        }
        continue;
      }
      this.age[i] += dt;
      const k = i * 3;
      this.vel[k + 1] -= 9 * dt;
      for (let j = 0; j < 3; j++) {
        this.pos[k + j] += this.vel[k + j] * dt;
        this.rot[k + j] += this.spin[k + j] * dt;
      }
      // they bounce once or twice in the grass, then lie still and sink
      const half = this.size[i] / 2;
      if (this.pos[k + 1] < half) {
        this.pos[k + 1] = half;
        this.vel[k + 1] *= -0.3;
        this.vel[k] *= 0.5;
        this.vel[k + 2] *= 0.5;
        this.spin[k] *= 0.4;
        this.spin[k + 1] *= 0.4;
        this.spin[k + 2] *= 0.4;
      }
      const sink = Math.max(0, this.age[i] - (this.life[i] - 0.8)) / 0.8;
      this.v.set(this.pos[k], this.pos[k + 1] - sink * this.size[i], this.pos[k + 2]);
      this.q.setFromEuler(this.e.set(this.rot[k], this.rot[k + 1], this.rot[k + 2]));
      this.s.setScalar(this.size[i] * (1 - sink * 0.6));
      this.mesh.setMatrixAt(i, this.m4.compose(this.v, this.q, this.s));
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

export type Mark = 'bark' | 'earth' | 'snow' | 'metal';
const MARKS = 64;
/** Marks shots leave on things, laid flat on what they hit, slowly fading away. */
export class Decals {
  readonly mesh: THREE.InstancedMesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  private age = new Float32Array(MARKS).fill(99);
  private next = 0;
  private m4 = new THREE.Matrix4();
  private kind = new Float32Array(MARKS);

  constructor() {
    // four little marks side by side in one strip: bark (a dark hole, pale splinters round it), earth, snow, metal
    const p = new Pix(32, 8);
    const put = (ox: number, hole: string, rim: string, chips: string) => {
      for (let y = 0; y < 8; y++)
        for (let x = 0; x < 8; x++) {
          const d = Math.hypot(x - 3.5, y - 3.5);
          if (d < 1.6) p.set(ox + x, y, hex(hole));
          else if (d < 2.6) p.set(ox + x, y, hex(rim));
          else if (d < 3.8 && (x * 7 + y * 3) % 5 === 0) p.set(ox + x, y, hex(chips));
        }
    };
    put(0, '#140e0a', '#c8a878', '#e2c898');
    put(8, '#1a120c', '#3a2a1c', '#4a3828');
    put(16, '#8a9aaa', '#c4ced8', '#e8eef2');
    put(24, '#141414', '#8a8e90', '#d0d4d4');
    const tex = new THREE.DataTexture(new Uint8Array(p.data.buffer), 32, 8, THREE.RGBAFormat, THREE.UnsignedByteType);
    tex.magFilter = tex.minFilter = THREE.NearestFilter;
    tex.colorSpace = THREE.NoColorSpace;
    tex.needsUpdate = true;
    const geo = new THREE.PlaneGeometry(1, 1);
    const kind = new THREE.InstancedBufferAttribute(this.kind, 1);
    const fade = new THREE.InstancedBufferAttribute(new Float32Array(MARKS), 1);
    geo.setAttribute('kind', kind);
    geo.setAttribute('fade', fade);
    const mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: tex }, ...light },
      vertexShader: /* glsl */ `
        attribute float kind;
        attribute float fade;
        varying vec2 vUv;
        varying float vFade;
        varying vec3 vWorld;
        void main() {
          vUv = vec2((uv.x + kind) / 4.0, uv.y);
          vFade = fade;
          vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0);
          vWorld = w.xyz;
          gl_Position = projectionMatrix * viewMatrix * w;
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D map;
        varying vec2 vUv;
        varying float vFade;
        varying vec3 vWorld;
        ${LIGHT}
        float bay(vec2 p) { int i = int(mod(p.x, 4.0)) + int(mod(p.y, 4.0)) * 4; float m[16] = float[16](0.,8.,2.,10.,12.,4.,14.,6.,3.,11.,1.,9.,15.,7.,13.,5.); return (m[i] + 0.5) / 16.0; }
        void main() {
          vec4 c = texture2D(map, vUv);
          if (c.a < 0.5 || bay(gl_FragCoord.xy) < vFade) discard;
          gl_FragColor = vec4(c.rgb * (ambient * 0.85 + 0.15 + sunColor * sunAt(vWorld, 0.002) * 0.3), 1.0);
        }`,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    this.mesh = new THREE.InstancedMesh(geo, mat, MARKS);
    this.mesh.frustumCulled = false;
    this.m4.makeScale(0, 0, 0);
    for (let i = 0; i < MARKS; i++) this.mesh.setMatrixAt(i, this.m4);
  }

  /** A mark at `at`, facing out along `normal`, `size` across. */
  add(at: THREE.Vector3, normal: THREE.Vector3, kind: Mark, size = 0.06) {
    const i = this.next;
    this.next = (this.next + 1) % MARKS;
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal.clone().normalize());
    const spin = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.random() * Math.PI * 2);
    q.multiply(spin);
    this.mesh.setMatrixAt(i, this.m4.compose(at.clone().addScaledVector(normal, 0.004), q, new THREE.Vector3(size, size, size)));
    this.kind[i] = ['bark', 'earth', 'snow', 'metal'].indexOf(kind);
    (this.mesh.geometry.getAttribute('kind') as THREE.BufferAttribute).needsUpdate = true;
    this.age[i] = 0;
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  update(dt: number) {
    const fade = this.mesh.geometry.getAttribute('fade') as THREE.BufferAttribute;
    for (let i = 0; i < MARKS; i++) {
      if (this.age[i] > 90) continue;
      this.age[i] += dt;
      fade.setX(i, Math.max(0, (this.age[i] - 24) / 6));
      if (this.age[i] > 30) {
        this.age[i] = 99;
        this.mesh.setMatrixAt(i, this.m4.makeScale(0, 0, 0));
        this.mesh.instanceMatrix.needsUpdate = true;
      }
    }
    fade.needsUpdate = true;
  }

  clear() {
    for (let i = 0; i < MARKS; i++) {
      this.age[i] = 99;
      this.mesh.setMatrixAt(i, this.m4.makeScale(0, 0, 0));
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
