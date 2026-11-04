import * as THREE from 'three';
import { light } from './gl';
import { hex, rgbOf } from './pix';
import type { Season } from './season';

/**
 * What's in the air this season, drawn as whole game pixels: snowflakes in winter, leaves tumbling down in autumn,
 * blossom petals in spring, pollen and seed fluff in summer (and fireflies down in the dark by the cat).
 * A field of points that lives in the world but wraps round the camera, all moved in the shader, so it costs
 * nothing on the CPU. They write depth, so the fog takes them like everything else.
 */
type Kind = { count: number; box: [number, number, number]; fall: number; sway: number; drift: [number, number]; size: [number, number]; shape: number; colors: string[]; ahead: number; zone?: [number, number] };

const KINDS: Record<Season, Kind[]> = {
  winter: [{ count: 1500, box: [16, 7, 24], fall: 0.55, sway: 0.18, drift: [0.12, 0.05], size: [1, 3], shape: 0, colors: ['#ffffff', '#eef3f6', '#dfe7ec'], ahead: 9 }],
  autumn: [
    { count: 240, box: [16, 6, 24], fall: 0.32, sway: 0.5, drift: [0.35, 0.1], size: [2, 4], shape: 1, colors: ['#d48033', '#b55e21', '#dcc54a', '#bb4421', '#866b2c', '#e9a751'], ahead: 9 },
  ],
  spring: [{ count: 220, box: [16, 6, 24], fall: 0.22, sway: 0.45, drift: [0.25, 0.05], size: [1, 2], shape: 2, colors: ['#f8f2ea', '#efd2d4', '#f4e4e0'], ahead: 9 }],
  summer: [
    { count: 150, box: [16, 5, 24], fall: 0.04, sway: 0.35, drift: [0.1, 0.02], size: [1, 2], shape: 2, colors: ['#f4efe2', '#e8e2cc'], ahead: 9 },
    // fireflies, only in the dark of the hollow
    { count: 90, box: [12, 2.2, 16], fall: -0.02, sway: 0.4, drift: [0, 0], size: [1, 2], shape: 3, colors: ['#e6f08a', '#c8e060'], ahead: 4, zone: [-84, -999] },
  ],
};

export class Weather {
  readonly group = new THREE.Group();
  private mats: THREE.ShaderMaterial[] = [];
  private kinds: Kind[];

  constructor(season: Season, scale = 1) {
    this.kinds = KINDS[season];
    for (const k of this.kinds) {
      const n = Math.round(k.count * scale);
      const seed = new Float32Array(n * 4);
      let s = 1234 + k.shape * 77;
      const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
      for (let i = 0; i < n * 4; i++) seed[i] = rnd();
      const g = new THREE.BufferGeometry();
      // three wants a position; the shader works it out from the seed
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
      g.setAttribute('seed', new THREE.BufferAttribute(seed, 4));
      const cols = k.colors.slice(0, 6).map((c) => {
        const [r, gg, b] = rgbOf(hex(c));
        return new THREE.Vector3(r / 255, gg / 255, b / 255);
      });
      while (cols.length < 6) cols.push(cols[cols.length % k.colors.length].clone());
      const mat = new THREE.ShaderMaterial({
        uniforms: {
          time: { value: 0 },
          center: { value: new THREE.Vector3() },
          box: { value: new THREE.Vector3(...k.box) },
          fall: { value: k.fall },
          sway: { value: k.sway },
          drift: { value: new THREE.Vector2(...k.drift) },
          size: { value: new THREE.Vector2(...k.size) },
          zone: { value: new THREE.Vector2(...(k.zone ?? [999, -999])) },
          cols: { value: cols },
          ambient: light.ambient,
          px: { value: 1 },
        },
        defines: { SHAPE: k.shape },
        vertexShader: /* glsl */ `
          attribute vec4 seed;
          uniform float time;
          uniform vec3 center;
          uniform vec3 box;
          uniform float fall;
          uniform float sway;
          uniform vec2 drift;
          uniform vec2 size;
          uniform vec2 zone;
          uniform float px;
          varying float vSeed;
          varying float vSize;
          varying float vOn;
          void main() {
            vSeed = seed.w;
            float sp = 0.6 + 0.8 * fract(seed.w * 7.13);
            vec3 p = seed.xyz * box;
            p.y -= time * fall * sp;
            p.x += time * drift.x + sin(time * (0.5 + seed.w) + seed.w * 20.0) * sway;
            p.z += time * drift.y + cos(time * (0.4 + seed.w * 0.7) + seed.w * 13.0) * sway * 0.6;
            vec3 lo = center - box * 0.5;
            vec3 w = lo + mod(p - lo, box);
            w.y = max(w.y, 0.02);
            vec4 mv = viewMatrix * vec4(w, 1.0);
            float d = max(0.3, -mv.z);
            // near ones a few pixels across, far ones a single pixel; whole pixels only
            vSize = floor(clamp(size.y * 3.0 / d, size.x, size.y) + 0.5);
            vOn = w.z < zone.x && w.z > zone.y ? 1.0 : 0.0;
            gl_PointSize = vSize * px;
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: /* glsl */ `
          uniform vec3 cols[6];
          uniform vec3 ambient;
          uniform float time;
          varying float vSeed;
          varying float vSize;
          varying float vOn;
          void main() {
            if (vOn < 0.5) discard;
            vec2 c = floor(gl_PointCoord * vSize);
            vec3 col = cols[int(mod(vSeed * 97.0, 6.0))];
#if SHAPE == 0
            // a flake: a dot, or a little cross when it's near
            if (vSize > 2.5 && abs(c.x - 1.0) + abs(c.y - 1.0) > 1.0) discard;
#elif SHAPE == 1
            // a leaf tumbling: it flips between faces, edges and its stalk
            float f = mod(floor(time * (2.0 + vSeed * 3.0) + vSeed * 40.0), 4.0);
            if (vSize > 1.5) {
              if (f < 1.0 && (c.x + c.y) > vSize) discard;
              if (f >= 1.0 && f < 2.0 && abs(c.x - c.y) > 1.0) discard;
              if (f >= 2.0 && f < 3.0 && c.y > 0.0 && c.y < vSize - 1.0 && c.x != floor(vSize * 0.5)) discard;
              if (f >= 3.0 && (c.x + c.y) < vSize - 2.0) discard;
            }
            if (f >= 2.0 && f < 3.0) col *= 0.72;
#elif SHAPE == 2
            if (vSize > 1.5 && c.x + c.y > 1.0) discard;
#else
            // a firefly: blinks slowly
            float b = sin(time * (1.2 + vSeed) + vSeed * 30.0);
            if (b < 0.35) discard;
            if (vSize > 1.5 && b < 0.8) discard;
            gl_FragColor = vec4(col, 1.0);
            return;
#endif
            gl_FragColor = vec4(col * (0.42 + ambient * 0.62), 1.0);
          }`,
      });
      this.mats.push(mat);
      const pts = new THREE.Points(g, mat);
      pts.frustumCulled = false;
      pts.renderOrder = 12;
      this.group.add(pts);
    }
  }

  /** Follows the camera: in the walk the field sits ahead of it, in pill mode round you. */
  update(time: number, cam: THREE.Vector3, playing: boolean) {
    this.kinds.forEach((k, i) => {
      const u = this.mats[i].uniforms;
      u.time.value = time;
      u.center.value.set(cam.x, k.box[1] * 0.5, cam.z - (playing ? 0 : k.ahead));
    });
  }

  dispose() {
    for (const p of this.group.children as THREE.Points[]) {
      p.geometry.dispose();
      (p.material as THREE.Material).dispose();
    }
  }
}
