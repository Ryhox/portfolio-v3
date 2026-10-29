import * as THREE from 'three';
import { texelAt } from './config';
import type { Layer } from './art/forest';
import type { Pix } from './pix';

/** Uploads a pixel buffer as a crisp texture. Mipmaps keep far layers from shimmering. */
export function toTexture(p: Pix, o: { repeat?: boolean; mips?: boolean } = {}): THREE.DataTexture {
  const t = new THREE.DataTexture(new Uint8Array(p.data.buffer), p.w, p.h, THREE.RGBAFormat, THREE.UnsignedByteType);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = o.mips === false ? THREE.NearestFilter : THREE.NearestMipmapNearestFilter;
  t.generateMipmaps = o.mips !== false;
  t.wrapS = o.repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  t.wrapT = THREE.ClampToEdgeWrapping;
  t.flipY = false;
  t.colorSpace = THREE.NoColorSpace;
  t.needsUpdate = true;
  return t;
}

/**
 * A quad covering the buffer's texels (plus `ext` texels of stretched edge on each side),
 * placed so texel (ax, ay) lands on the mesh origin, with texels of d·K0 world units.
 * Row 0 of the buffer is uploaded first, so v grows downwards like the buffer.
 */
export function quadFor(w: number, h: number, ax: number, ay: number, d: number, ext: { side?: number } = {}) {
  const t = texelAt(d);
  const u0 = -(ext.side ?? 0);
  const u1 = w + (ext.side ?? 0);
  const g = new THREE.BufferGeometry();
  const pos = new Float32Array([
    (u0 - ax) * t, ay * t, 0,
    (u1 - ax) * t, ay * t, 0,
    (u0 - ax) * t, (ay - h) * t, 0,
    (u1 - ax) * t, (ay - h) * t, 0,
  ]);
  const uv = new Float32Array([u0 / w, 0, u1 / w, 0, u0 / w, 1, u1 / w, 1]);
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex([0, 2, 1, 2, 3, 1]);
  return g;
}

export const BAYER = /* glsl */ `
float bayer(vec2 p) {
  int i = int(mod(p.x, 4.0)) + int(mod(p.y, 4.0)) * 4;
  float m[16] = float[16](0.,8.,2.,10.,12.,4.,14.,6.,3.,11.,1.,9.,15.,7.,13.,5.);
  return (m[i] + 0.5) / 16.0;
}`;

/**
 * The light every surface shares: one sun with a shadow map, a sky ambient, and the monitor
 * as a small point light. Uniform objects are shared, so setting them once lights the whole forest.
 */
export const light = {
  shadowMap: { value: null as THREE.Texture | null },
  shadowMatrix: { value: new THREE.Matrix4() },
  /** The direction sunlight travels: down, towards you, and to the left. */
  sunDir: { value: new THREE.Vector3(-0.32, -0.86, 0.4).normalize() },
  sunColor: { value: new THREE.Vector3(1, 0.94, 0.76) },
  ambient: { value: new THREE.Vector3(0.9, 0.9, 0.86) },
  /** In front of this z there is no roof of leaves: open meadow, full sun. */
  roofZ: { value: -4.6 },
  lampPos: { value: new THREE.Vector4(0, 0, 0, 0) },
  lampColor: { value: new THREE.Vector3() },
};

export const LIGHT = /* glsl */ `
uniform sampler2D shadowMap;
uniform mat4 shadowMatrix;
uniform vec3 sunDir;
uniform vec3 sunColor;
uniform vec3 ambient;
uniform float roofZ;
uniform vec4 lampPos;
uniform vec3 lampColor;
float sunAt(vec3 wp, float bias) {
  vec4 s = shadowMatrix * vec4(wp, 1.0);
  vec3 c = s.xyz / s.w;
  // beyond the shadow map: open sky over the meadow, full shade under the roof of leaves (no seam where it ends)
  if (c.x < 0.0 || c.x > 1.0 || c.y < 0.0 || c.y > 1.0 || c.z > 1.0) return wp.z > roofZ ? 1.0 : 0.0;
  return c.z - bias > texture2D(shadowMap, c.xy).r ? 0.0 : 1.0;
}
vec3 lamp(vec3 wp) {
  vec3 d = wp - lampPos.xyz;
  return lampColor * lampPos.w / (1.0 + dot(d, d) * 7.0);
}`;

/** The view's turn about the upright axis. Zero on the walk (the camera never turns); in pill mode it follows you. */
export const view = { yaw: { value: 0 }, lightYaw: { value: 0 } };

const LAYER_VERT = /* glsl */ `
uniform vec4 uvRect;
uniform float yaw;
uniform float lightYaw;
#ifdef BATCHED
attribute vec3 anchor;
#endif
varying vec2 vUv;
varying vec3 vWorld;
vec3 turn(vec3 p, vec3 a, float t) {
  vec3 d = p - a;
  float c = cos(t);
  float s = sin(t);
  return a + vec3(d.x * c + d.z * s, d.y, -d.x * s + d.z * c);
}
void main() {
  vUv = uvRect.xy + uv * uvRect.zw;
  vec3 p = position;
  vec3 pl = position;
#ifdef FACE
  // every sprite turns about its own upright axis to lie flat to the view, the way Doom draws its sprites:
  // never thin from the side, and never leaning when you look up (looking up is a shear, not a tilt)
#ifdef BATCHED
  vec3 a = anchor;
#else
  vec3 a = vec3(0.0);
#endif
  // lit (and casting shadow) as if it faced the sun, whichever way you look, so the light never moves
  pl = turn(position, a, lightYaw);
#ifdef SHADOW
  p = pl;
#else
  p = turn(position, a, yaw);
#endif
#endif
  vWorld = (modelMatrix * vec4(pl, 1.0)).xyz;
  vec4 w = modelMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const LAYER_FRAG = /* glsl */ `
uniform sampler2D map;
uniform float appear;
uniform float lit;
varying vec2 vUv;
varying vec3 vWorld;
${BAYER}
${LIGHT}
void main() {
  vec4 c = texture2D(map, vUv);
  if (c.a < 0.5) discard;
  // painted pixels carry their own shading; the sun adds where it actually reaches them
  vec3 l = ambient + sunColor * sunAt(vWorld, 0.0012) * 0.6 + lamp(vWorld);
  gl_FragColor = vec4(c.rgb * mix(vec3(1.0), l, lit), 1.0);
}`;

const DEPTH_FRAG = /* glsl */ `
uniform sampler2D map;
varying vec2 vUv;
void main() {
  if (texture2D(map, vUv).a < 0.5) discard;
  gl_FragColor = vec4(1.0);
}`;

export type LayerMesh = THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial> & {
  userData: { born: number; lit: THREE.ShaderMaterial; depth: THREE.ShaderMaterial; caster: boolean; [k: string]: unknown };
};

const defines = (face: boolean, batched: boolean, shadow = false) => ({ ...(face ? { FACE: '' } : {}), ...(batched ? { BATCHED: '' } : {}), ...(shadow ? { SHADOW: '' } : {}) });

/** `face`: turns to the view in pill mode (everything but the roof); `batched`: many sprites in one mesh, each round its anchor. */
export function depthMaterial(map: THREE.Texture, uvRect = { value: new THREE.Vector4(0, 0, 1, 1) }, face = true, batched = false) {
  return new THREE.ShaderMaterial({ uniforms: { map: { value: map }, uvRect, yaw: view.yaw, lightYaw: view.lightYaw }, defines: defines(face, batched, true), vertexShader: LAYER_VERT, fragmentShader: DEPTH_FRAG, side: THREE.DoubleSide });
}

export function layerMaterial(map: THREE.Texture, lit = 1, batched = false) {
  return new THREE.ShaderMaterial({
    uniforms: { ...light, map: { value: map }, appear: { value: 1 }, lit: { value: lit }, uvRect: { value: new THREE.Vector4(0, 0, 1, 1) }, yaw: view.yaw, lightYaw: view.lightYaw },
    defines: defines(true, batched),
    vertexShader: LAYER_VERT,
    fragmentShader: LAYER_FRAG,
    side: THREE.DoubleSide,
  });
}

export function meshFor(geometry: THREE.BufferGeometry, tex: THREE.Texture, lit = 1, caster = true): LayerMesh {
  const batched = !!geometry.getAttribute('anchor');
  const mat = layerMaterial(tex, lit, batched);
  const m = new THREE.Mesh(geometry, mat) as unknown as LayerMesh;
  m.userData = { born: -1, lit: mat, depth: depthMaterial(tex, mat.uniforms.uvRect, true, batched), caster };
  m.frustumCulled = false;
  return m;
}

/** Stops a sprite turning with the view, so it stays as it was put, like a real thing (the screen, the shards). */
export function fixFacing(m: LayerMesh) {
  for (const mat of [m.userData.lit, m.userData.depth]) {
    mat.uniforms.yaw = { value: 0 };
    mat.uniforms.lightYaw = { value: 0 };
  }
}

const SOLID_VERT = /* glsl */ `
varying vec2 vUv;
varying vec3 vWorld;
varying vec3 vNormal;
void main() {
  vUv = uv;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  vNormal = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const SOLID_FRAG = /* glsl */ `
uniform sampler2D map;
uniform float appear;
varying vec2 vUv;
varying vec3 vWorld;
varying vec3 vNormal;
${BAYER}
${LIGHT}
void main() {
  vec4 c = texture2D(map, vUv);
  if (c.a < 0.5) discard;
  vec3 n = normalize(vNormal);
  if (!gl_FrontFacing) n = -n;
  float face = dot(n, -sunDir);
  // pixel-art shading in hard steps: the side towards the sun lighter even in the leaves' shade, tops a touch lighter
  float side = face > 0.3 ? 1.0 : face > -0.15 ? 0.84 : 0.68;
  float top = n.y > 0.6 ? 1.08 : 1.0;
  float sun = face > 0.0 ? sunAt(vWorld + n * 0.03, 0.0015) : 0.0;
  vec3 l = ambient * side * top + sunColor * sun * (face > 0.45 ? 0.62 : 0.4) + lamp(vWorld);
  gl_FragColor = vec4(c.rgb * l, 1.0);
}`;

/**
 * A real solid thing (pill mode): lit on its faces by the sun's direction in hard steps, shadowed and casting
 * shadow like everything else. Shaped like a LayerMesh, so the forest handles it the same way.
 */
export function solidMesh(geometry: THREE.BufferGeometry, tex: THREE.Texture, caster = true): LayerMesh {
  const mat = new THREE.ShaderMaterial({ uniforms: { ...light, map: { value: tex }, appear: { value: 1 } }, vertexShader: SOLID_VERT, fragmentShader: SOLID_FRAG, side: THREE.DoubleSide });
  const depth = new THREE.ShaderMaterial({ uniforms: { map: { value: tex } }, vertexShader: SOLID_VERT, fragmentShader: DEPTH_FRAG, side: THREE.DoubleSide });
  const m = new THREE.Mesh(geometry, mat) as unknown as LayerMesh;
  m.userData = { born: -1, lit: mat, depth, caster };
  m.frustumCulled = false;
  return m;
}

export function layerMesh(l: Layer, ext: { side?: number } = {}, mips = true, lit = 1): LayerMesh {
  return meshFor(quadFor(l.pix.w, l.pix.h, l.ax, l.ay, l.d, ext), toTexture(l.pix, { repeat: l.repeat, mips }), lit);
}

/**
 * The sky behind everything: lightest at the horizon (`mid`), deepening to `edge` overhead, with flat pixel
 * clouds drifting slowly across it. `cover` is how much of it the clouds take: a few on a fine day, a grey lid
 * deep in the wood. Clouds are a lit body and a shaded underside, their fringes dithered, never blurred.
 */
export function skyMesh() {
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      mid: { value: new THREE.Vector3() },
      edge: { value: new THREE.Vector3() },
      cover: { value: 0 },
      time: { value: 0 },
      res: { value: new THREE.Vector2(1, 1) },
      // pill mode: how many pixels looking up pushes the horizon down, and how far the view has turned
      tilt: { value: 0 },
      pan: { value: 0 },
    },
    vertexShader: /* glsl */ `void main() { gl_Position = vec4(position.xy, 1.0, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform vec3 mid;
      uniform vec3 edge;
      uniform float cover;
      uniform float time;
      uniform vec2 res;
      uniform float tilt;
      uniform float pan;
      ${BAYER}
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
      }
      float fbm(vec2 p) {
        float v = 0.0;
        float a = 0.5;
        for (int i = 0; i < 4; i++) {
          v += noise(p) * a;
          p = p * 2.03 + 7.1;
          a *= 0.5;
        }
        return v;
      }
      void main() {
        vec2 px = floor(gl_FragCoord.xy);
        float hy = px.y + floor(tilt);
        float v = min(1.0, abs(hy / res.y - 0.5) * 2.0);
        vec3 col = mix(mid, edge, v * v);
        // clouds only overhead; at the horizon the haze has them
        float up = clamp((hy / res.y - 0.5) * 2.0, 0.0, 1.0);
        if (cover > 0.0 && up > 0.0) {
          // flat and wide, the way fair-weather clouds lie, drifting a pixel every couple of seconds
          vec2 q = vec2((px.x - floor(pan) + floor(time * 0.5)) / res.y * 2.2, hy / res.y * 6.0);
          float n = fbm(q);
          float d = bayer(px) * 0.06;
          float edgeAt = 1.0 - cover * 0.62;
          float fade = smoothstep(0.08, 0.45, up);
          if (n + d > edgeAt + (1.0 - fade) * 0.3) {
            vec3 body = mix(mid, vec3(1.0), 0.32);
            vec3 under = mix(mid, edge, 0.45) * 0.93;
            // the underside: where the cloud above is thicker than here
            float above = fbm(q + vec2(0.0, 0.16));
            col = above + d > n + 0.015 ? body : under;
          }
        }
        gl_FragColor = vec4(col, 1.0);
      }`,
    depthTest: false,
    depthWrite: false,
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  m.frustumCulled = false;
  m.renderOrder = -100;
  return m;
}

/**
 * The forest floor: one real ground plane under the whole walk. A tiling pattern of light values is
 * looked up in a ramp per stretch of the walk (meadow, wood, clearing, hollow); stretches hand over
 * with a dither, never a smooth blend. Sunlit grass turns yellow-green, like under a gap in the leaves.
 */
export function floorMesh(pattern: THREE.Texture, ramps: THREE.Texture, rows: number, texel: number) {
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      ...light,
      pattern: { value: pattern },
      ramps: { value: ramps },
      rows: { value: rows },
      tile: { value: texel * 256 },
      reflection: { value: null as THREE.Texture | null },
      res: { value: new THREE.Vector2(1, 1) },
      time: { value: 0 },
      wet: { value: 0 },
      puddles: { value: Array.from({ length: 8 }, () => new THREE.Vector4()) },
      contacts: { value: Array.from({ length: 4 }, () => new THREE.Vector4()) },
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
      uniform sampler2D ramps;
      uniform float rows;
      uniform float tile;
      uniform sampler2D reflection;
      uniform vec2 res;
      uniform float time;
      uniform float wet;
      uniform vec4 puddles[8];
      uniform vec4 contacts[4];
      varying vec3 vWorld;
      ${BAYER}
      ${LIGHT}
      float h1(float n) { return fract(sin(n) * 43758.5453); }
      vec3 ramp(float row, float v) {
        float i = clamp(floor(v * 7.0), 0.0, 6.0);
        return texture2D(ramps, vec2((i + 0.5) / 7.0, (row + 0.5) / rows)).rgb;
      }
      void main() {
        vec2 uv = vWorld.xz / tile;
        float v = texture2D(pattern, uv).r;
        float z = vWorld.z;
        float zone =
          z > -6.0 ? 0.0 :
          z > -30.0 ? (-6.0 - z) / 24.0 :
          z > -58.0 ? 1.0 + (-30.0 - z) / 28.0 :
          z > -68.0 ? 2.0 + (-58.0 - z) / 10.0 :
          z > -79.0 ? 3.0 :
          z > -90.0 ? 3.0 + (-79.0 - z) / 11.0 : 4.0;
        float a = floor(zone);
        // stretches of the walk hand over in ragged patches of the ground itself, not a regular dither
        float th = clamp(texture2D(pattern, uv * 0.23 + 0.31).r * 1.6 - 0.3, 0.02, 0.98);
        float row = (zone - a) > th ? min(a + 1.0, rows - 2.0) : a;
        float sun = sunAt(vWorld, 0.002);
        vec3 col = ramp(row, v);
        if (sun > 0.5 && z < roofZ) col = ramp(rows - 1.0, v + 0.05);
        vec3 l = ambient + sunColor * sun * 0.32 + lamp(vWorld);
        vec3 outc = col * l;
        // where something stands, the ground under and round it is in its shade, in two hard steps
        for (int i = 0; i < 4; i++) {
          vec4 C = contacts[i];
          if (C.z <= 0.0) continue;
          vec2 q = (vWorld.xz - C.xy) / C.zw;
          float e = dot(q, q) + (v - 0.47) * 0.5;
          if (e < 1.0) outc *= e < 0.45 ? 0.55 : 0.75;
        }
        // rain puddles: the wood upside down in them, and now and then a drip spreading rings
        if (wet > 0.0) {
          float pud = 0.0;
          vec2 rip = vec2(0.0);
          for (int i = 0; i < 8; i++) {
            vec4 P = puddles[i];
            if (P.z <= 0.0) continue;
            vec2 q = (vWorld.xz - P.xy) / P.zw;
            float e = dot(q, q) + (texture2D(pattern, uv * 0.45 + float(i) * 0.13).r - 0.47) * 0.9;
            if (e >= 1.0) continue;
            pud = max(pud, 1.0 - e);
            float fi = float(i);
            float beat = time * 0.42 + fi * 0.37;
            float slot = floor(beat);
            float age = fract(beat);
            vec2 c = P.xy + (vec2(h1(slot * 12.9 + fi), h1(slot * 78.2 + fi * 3.1)) - 0.5) * P.zw;
            vec2 dv = vWorld.xz - c;
            float d = length(dv);
            if (age < 0.8 && abs(d - age * 0.42) < 0.022) rip = dv / max(d, 1e-4) * (1.0 - age);
          }
          if (pud > 0.0) {
            vec2 ruv = gl_FragCoord.xy / res;
            ruv.y = 1.0 - ruv.y;
            ruv += rip * vec2(2.0, 1.0) / res;
            vec3 refl = texture2D(reflection, ruv).rgb;
            vec3 wetc = outc * 0.5;
            outc = mix(wetc, refl * 0.92 + 0.02, wet * (pud < 0.06 ? 0.25 : 0.8));
            if (length(rip) > 0.0) outc += 0.06 * wet;
          }
        }
        gl_FragColor = vec4(outc, 1.0);
      }`,
    side: THREE.DoubleSide,
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(90, 150), mat);
  m.rotation.x = -Math.PI / 2;
  m.position.set(0, 0, -68);
  m.frustumCulled = false;
  return m;
}

/**
 * The fog: marches each game pixel's view ray through height fog, sampling the sun's shadow map,
 * so light that gets through the leaves shows as shafts in the mist and shadows carve through it.
 * Dithered per pixel, so it stays pixel art rather than a soft glow.
 */
export function fogMesh(color: THREE.Texture, depth: THREE.Texture) {
  return fullscreen(
    new THREE.ShaderMaterial({
      uniforms: {
        ...light,
        tColor: { value: color },
        tDepth: { value: depth },
        res: { value: new THREE.Vector2(1, 1) },
        projInv: { value: new THREE.Matrix4() },
        viewInv: { value: new THREE.Matrix4() },
        camPos: { value: new THREE.Vector3() },
        fogColor: { value: new THREE.Vector3(1, 1, 1) },
        density: { value: 0.04 },
        falloff: { value: 3 },
        start: { value: 2 },
        shafts: { value: 1 },
        maxDist: { value: 110 },
        mirror: { value: 1 },
      },
      vertexShader: /* glsl */ `void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D tColor;
        uniform sampler2D tDepth;
        uniform vec2 res;
        uniform mat4 projInv;
        uniform mat4 viewInv;
        uniform vec3 camPos;
        uniform vec3 fogColor;
        uniform float density;
        uniform float falloff;
        uniform float start;
        uniform float shafts;
        uniform float maxDist;
        uniform float mirror;
        ${BAYER}
        ${LIGHT}
        const int STEPS = 30;
        void main() {
          vec2 uv = gl_FragCoord.xy / res;
          vec3 col = texture2D(tColor, uv).rgb;
          float depth = texture2D(tDepth, uv).r;
          vec4 vp = projInv * vec4(uv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
          vp /= vp.w;
          vec3 ray = (viewInv * vp).xyz - camPos;
          float len = length(ray);
          vec3 dir = ray / len;
          if (depth >= 1.0) len = maxDist;
          len = min(len, maxDist);
          // forward scattering: shafts are brightest when you look towards the light
          float mu = dot(dir, -sunDir);
          float g = 0.6;
          float phase = (1.0 - g * g) / pow(1.0 + g * g - 2.0 * g * mu, 1.5) * 0.3;
          // march near steps densely, far ones sparsely; no per-pixel jitter, so no grid of dots over the picture
          float j = 0.5;
          float T = 1.0;
          vec3 S = vec3(0.0);
          float prev = 0.0;
          for (int i = 0; i < STEPS; i++) {
            float k = (float(i) + j) / float(STEPS);
            float t = len * k * k;
            float ds = t - prev;
            prev = t;
            if (t < start) continue;
            vec3 p = camPos + dir * t;
            // the mirrored view (for puddles) marches below the ground; fold it back up
            p.y *= mirror;
            float dens = density * exp(-max(p.y, 0.0) / falloff);
            float sun = sunAt(p, 0.0);
            // light through gaps in the roof scatters strongly; the open meadow just glows a little
            vec3 inS = fogColor + sunColor * sun * phase * (p.z < roofZ ? shafts : 0.5);
            S += T * dens * ds * inS;
            T *= exp(-dens * ds);
          }
          gl_FragColor = vec4(col * T + S, 1.0);
        }`,
      depthTest: false,
      depthWrite: false,
    }),
  );
}

function fullscreen(mat: THREE.ShaderMaterial) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
  const m = new THREE.Mesh(g, mat);
  m.frustumCulled = false;
  return m;
}

/** Copies the small frame to the screen, each game pixel exactly `scale` device pixels wide. */
export function blitMesh(tex: THREE.Texture) {
  return fullscreen(
    new THREE.ShaderMaterial({
      uniforms: {
        frame: { value: tex },
        lowRes: { value: new THREE.Vector2(1, 1) },
        scale: { value: 1 },
        offset: { value: new THREE.Vector2() },
        lift: { value: new THREE.Vector3(0.035, 0.04, 0.03) },
        // a dithered fade to one colour, for stepping into and out of pill mode
        fade: { value: 0 },
        fadeTo: { value: new THREE.Vector3(0.04, 0.07, 0.05) },
      },
      vertexShader: /* glsl */ `void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D frame;
        uniform vec2 lowRes;
        uniform float scale;
        uniform vec2 offset;
        uniform vec3 lift;
        uniform float fade;
        uniform vec3 fadeTo;
        ${BAYER}
        void main() {
          vec2 p = floor((gl_FragCoord.xy + offset) / scale);
          vec3 c = texture2D(frame, (p + 0.5) / lowRes).rgb;
          if (fade > 0.0 && bayer(p) < fade) c = fadeTo;
          // faded film: blacks lifted towards a warm green, never quite black
          c = lift + min(c, 1.0) * (1.0 - lift);
          gl_FragColor = vec4(c, 1.0);
        }`,
      depthTest: false,
      depthWrite: false,
    }),
  );
}

/** Dust in the light: single pixels that open into little crosses, shown only where the sun reaches them. */
export function motes(count: number, seed: number) {
  const pos = new Float32Array(count * 3);
  const phase = new Float32Array(count);
  let s = seed;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < count; i++) {
    pos[i * 3] = rnd();
    pos[i * 3 + 1] = rnd();
    pos[i * 3 + 2] = rnd();
    phase[i] = rnd() * 100;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('phase', new THREE.BufferAttribute(phase, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { ...light, time: { value: 0 }, box: { value: new THREE.Matrix4() } },
    vertexShader: /* glsl */ `
      attribute float phase;
      uniform float time;
      uniform mat4 box;
      uniform sampler2D shadowMap;
      uniform mat4 shadowMatrix;
      varying float vOn;
      void main() {
        vec3 p = position;
        p.y = fract(p.y - time * 0.01 * (0.5 + fract(phase * 3.1)));
        vec4 wp = box * vec4(p, 1.0);
        vec4 sc = shadowMatrix * wp;
        float lit = sc.z - 0.003 > texture2D(shadowMap, sc.xy).r ? 0.0 : 1.0;
        float s = sin(time * (0.7 + fract(phase) * 0.9) + phase);
        vOn = lit > 0.5 ? s : -1.0;
        gl_Position = projectionMatrix * viewMatrix * wp;
        gl_PointSize = s > 0.8 ? 3.0 : 1.0;
      }`,
    fragmentShader: /* glsl */ `
      varying float vOn;
      void main() {
        if (vOn < 0.15) discard;
        if (vOn > 0.8) {
          vec2 c = floor(gl_PointCoord * 3.0);
          if (c.x != 1.0 && c.y != 1.0) discard;
        }
        gl_FragColor = vec4(0.98, 0.97, 0.8, 1.0);
      }`,
    depthWrite: false,
  });
  const pts = new THREE.Points(g, mat);
  pts.frustumCulled = false;
  pts.renderOrder = 11;
  return pts;
}
