/**
 * Pill mode's leaves in the round. A crown is a handful of leafy volumes: each a lumpy core (dark leaf litter
 * painted on it from the side it faces) wrapped in leaf cards that sit on its skin in 3D, fixed where they
 * are (they don't turn to you), each card a clump of single leaf stamps with a ragged edge. Lit by which way it
 * faces the sun, in hard steps, from a normal that blends the volume's and the whole crown's, so a tree has a
 * sunny side, a shaded side and a dark underneath, and shadows itself and the ground through the gaps.
 * Bushes are the same, low to the ground. Built into chunks the camera can skip when they're out of view.
 */
import * as THREE from 'three';
import { clump } from './art/brush';
import { atlas } from './art/sprites';
import type { TreeKind } from './art/trees';
import { BAYER, LIGHT, light, toTexture, type LayerMesh } from './gl';
import { PAL } from './palette';
import { hash2, mulberry, Pix, shade, type Ramp } from './pix';
import { treeSize } from './solid';

export type Grove = { kind: TreeKind | 'bush'; x: number; z: number; s: number; far: boolean };

/** Leaf volumes per crown, near and far. */
const BLOBS: Record<TreeKind | 'bush', number> = { oak: 9, beech: 8, birch: 7, young: 4, ancient: 12, bush: 4 };
/** Card sprite sizes (clump radius in texels) and the world size of a texel. */
const CARD_R = [7, 10, 13, 17];
const TEXEL = 0.0216;
const MAT = 32;

const VERT = /* glsl */ `
attribute vec2 info;
varying vec2 vUv;
varying vec3 vWorld;
varying vec3 vN;
varying vec2 vInfo;
void main() {
  vUv = uv;
  vInfo = info;
  vN = normal;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const FRAG = /* glsl */ `
uniform sampler2D map;
uniform sampler2D mats;
uniform float matCount;
uniform float matTexel;
uniform float appear;
uniform float snow;
varying vec2 vUv;
varying vec3 vWorld;
varying vec3 vN;
varying vec2 vInfo;
${BAYER}
${LIGHT}
void main() {
  vec4 c;
  if (vInfo.x > 0.5) {
    // the core: leaf litter laid on from the side the face looks along, at the wood's own pixel size
    vec3 fn = abs(normalize(cross(dFdx(vWorld), dFdy(vWorld))));
    vec2 q = (fn.y >= fn.x && fn.y >= fn.z ? vWorld.xz : fn.x >= fn.z ? vWorld.zy : vWorld.xy) / matTexel;
    vec2 f = fract(q / ${MAT.toFixed(1)});
    c = texture2D(mats, vec2(f.x, (vInfo.y + f.y) / matCount));
  } else {
    c = texture2D(map, vUv);
    if (c.a < 0.5) discard;
  }
  vec3 n = normalize(vN);
  float face = dot(n, -sunDir);
  // hard steps: the sunny side, the side, the shade; the underneath darker still
  float side = face > 0.38 ? 1.0 : face > -0.08 ? 0.8 : 0.62;
  float top = n.y > 0.55 ? 1.06 : n.y < -0.45 ? 0.78 : 1.0;
  float sun = face > -0.1 ? sunAt(vWorld + n * 0.06, 0.002) : 0.0;
  vec3 l = ambient * side * top + sunColor * sun * (face > 0.4 ? 0.6 : 0.4) + lamp(vWorld);
  vec3 col = c.rgb;
  // winter: snow lies on what faces up
  if (snow > 0.5 && n.y > 0.45 && bayer(gl_FragCoord.xy) < (n.y - 0.45) * 2.4) col = mix(col, vec3(0.9, 0.93, 0.96), 0.85);
  gl_FragColor = vec4(col * l, 1.0);
}`;

const DEPTH = /* glsl */ `
uniform sampler2D map;
varying vec2 vUv;
varying vec2 vInfo;
void main() {
  if (vInfo.x < 0.5 && texture2D(map, vUv).a < 0.5) discard;
  gl_FragColor = vec4(1.0);
}`;

/** A tile of leaf litter for the inside of a volume: dark, with leaves stamped over it, seamless. */
function leafMat(pal: Ramp, seed: number) {
  const p = new Pix(MAT, MAT, true);
  for (let y = 0; y < MAT; y++) for (let x = 0; x < MAT; x++) p.set(x, y, shade(pal, 0.14 + (hash2(x, y, seed) - 0.5) * 0.12));
  const rnd = mulberry(seed);
  const leaf = ['.#.', '###', '###', '.#.'];
  for (let i = 0; i < 70; i++) {
    const lx = Math.floor(rnd() * MAT);
    const ly = Math.floor(rnd() * MAT);
    const t = 0.3 + rnd() * 0.45;
    leaf.forEach((row, j) =>
      [...row].forEach((ch, k) => {
        if (ch !== '#') return;
        const yy = (ly + j) % MAT;
        p.set(lx + k, yy, shade(pal, j === 0 ? t + 0.15 : j === 3 ? t - 0.12 : t));
      }),
    );
  }
  return p;
}

type Blob = { x: number; y: number; z: number; r: number; pal: number; far: boolean; seed: number; cx: number; cy: number; cz: number; rx: number; ry: number };

/**
 * The crowns of every tree in `groves`, in chunks. `lite` (phones) keeps the volumes simpler and the cards fewer.
 */
export function buildFoliage(groves: Grove[], lite: boolean) {
  const winter = PAL.fullness <= 0;
  // the leaf colours: each kind's own (and its second ramp for some volumes), or in winter the wood's greys
  const pals: Ramp[] = [];
  const palIndex = (r: Ramp) => {
    let i = pals.indexOf(r);
    if (i < 0) i = pals.push(r) - 1;
    return i;
  };
  const LEAF_OF: Record<TreeKind | 'bush', Ramp> = winter
    ? { oak: PAL.mid.leaf, beech: PAL.mid.leaf, birch: PAL.edge.leaf, young: PAL.edge.leaf, ancient: PAL.deep.leaf, bush: PAL.mid.leaf }
    : PAL.leaves;
  const ALT: Record<TreeKind | 'bush', Ramp> = winter ? LEAF_OF : PAL.leaves2;

  const blobs: Blob[] = [];
  for (const g of groves) {
    const rnd = mulberry((Math.round(g.x * 131) * 73856093) ^ (Math.round(g.z * 113) * 19349663) ^ 0x5eed);
    const s = g.s;
    let cx = g.x;
    let cz = g.z;
    let cy: number;
    let rx: number;
    let ry: number;
    if (g.kind === 'bush') {
      cy = 0.22 * s;
      rx = 0.55 * s;
      ry = 0.3 * s;
    } else {
      const t = treeSize(g.kind);
      cy = t.cy * s;
      rx = t.rx * s;
      ry = t.ry * s;
      // a crown leans a touch off its trunk, the way real ones do
      cx += (rnd() - 0.5) * rx * 0.12;
      cz += (rnd() - 0.5) * rx * 0.12;
    }
    const n = Math.max(g.kind === 'bush' ? 3 : 3, Math.round(BLOBS[g.kind] * (g.far ? 0.5 : 1)));
    const main = palIndex(LEAF_OF[g.kind]);
    const alt = palIndex(ALT[g.kind]);
    const avg = (rx + ry) / 2;
    // the heart of it, big, so nothing shows through
    blobs.push({ x: cx, y: cy, z: cz, r: Math.min(rx, ry) * (g.kind === 'bush' ? 0.75 : 0.66), pal: main, far: g.far, seed: Math.floor(rnd() * 1e6), cx, cy, cz, rx, ry });
    for (let k = 1; k < n; k++) {
      // spread evenly over the crown (a spiral), mostly round the top and sides
      const yy = g.kind === 'bush' ? -0.1 + rnd() * 0.6 : 1 - 1.55 * ((k - 0.5) / (n - 1));
      const az = k * 2.39996 + rnd() * 0.7;
      const ring = Math.sqrt(Math.max(0, 1 - yy * yy));
      const dx = Math.cos(az) * ring;
      const dz = Math.sin(az) * ring;
      const r = avg * (g.kind === 'bush' ? 0.5 + rnd() * 0.15 : 0.36 + rnd() * 0.1) * (yy > 0.6 ? 0.85 : 1);
      blobs.push({
        x: cx + dx * rx * 0.56,
        y: Math.max(g.kind === 'bush' ? r * 0.6 : 0, cy + yy * ry * 0.5),
        z: cz + dz * rx * 0.56,
        r,
        pal: rnd() < PAL.mix ? alt : main,
        far: g.far,
        seed: Math.floor(rnd() * 1e6),
        cx,
        cy,
        cz,
        rx,
        ry,
      });
    }
  }

  // the paint: card clumps for every colour and size, and a litter tile per colour
  const sprites: Pix[] = [];
  pals.forEach((pal, i) => {
    CARD_R.forEach((r, j) => {
      const sz = r * 2 + 6;
      const p = new Pix(sz, sz);
      clump(p, sz / 2, sz / 2, r, pal, 7100 + i * 31 + j, 0.02);
      p.outline();
      p.bleed();
      sprites.push(p);
    });
  });
  const cards = atlas(sprites);
  const matPix = new Pix(MAT, MAT * pals.length);
  pals.forEach((pal, i) => matPix.blit(leafMat(pal, 8100 + i * 13), 0, i * MAT));
  const mapTex = toTexture(cards.pix, { mips: true });
  const matTex = toTexture(matPix, { mips: false });

  // the shapes: a lumpy icosahedron for the core, the same for every volume, displaced the same everywhere
  const ico = (detail: number) => {
    const g = new THREE.IcosahedronGeometry(1, detail);
    const pos = g.getAttribute('position') as THREE.BufferAttribute;
    // weld the corners the geometry repeats, so each sits once and the lumps stay closed
    const key = (i: number) => `${pos.getX(i).toFixed(3)},${pos.getY(i).toFixed(3)},${pos.getZ(i).toFixed(3)}`;
    const verts: [number, number, number][] = [];
    const seen = new Map<string, number>();
    const idx: number[] = [];
    for (let i = 0; i < pos.count; i++) {
      const k = key(i);
      let v = seen.get(k);
      if (v === undefined) {
        v = verts.push([pos.getX(i), pos.getY(i), pos.getZ(i)]) - 1;
        seen.set(k, v);
      }
      idx.push(v);
    }
    g.dispose();
    return { verts, idx };
  };
  const shapes = { near: ico(lite ? 0 : 1), far: ico(0) };
  const cardsPer = (b: Blob) => (b.far ? 4 : lite ? 6 : 11);

  // into chunks
  const CH = 20;
  const chunks = new Map<string, Blob[]>();
  for (const b of blobs) {
    const k = `${Math.floor(b.x / CH)},${Math.floor(b.z / CH)}`;
    const list = chunks.get(k);
    if (list) list.push(b);
    else chunks.set(k, [b]);
  }

  const lit = new THREE.ShaderMaterial({
    uniforms: { ...light, map: { value: mapTex }, mats: { value: matTex }, matCount: { value: pals.length }, matTexel: { value: TEXEL }, appear: { value: 1 }, snow: { value: PAL.snowy ? 1 : 0 } },
    vertexShader: VERT,
    fragmentShader: FRAG,
    side: THREE.DoubleSide,
  });
  const depth = new THREE.ShaderMaterial({ uniforms: { map: { value: mapTex } }, vertexShader: VERT, fragmentShader: DEPTH, side: THREE.DoubleSide });

  const meshes: LayerMesh[] = [];
  const nb = new THREE.Vector3();
  const nc = new THREE.Vector3();
  const p = new THREE.Vector3();
  const nrm = new THREE.Vector3();
  const t1 = new THREE.Vector3();
  const t2 = new THREE.Vector3();
  const dir = new THREE.Vector3();
  const UP = new THREE.Vector3(0, 1, 0);
  const SIDE = new THREE.Vector3(1, 0, 0);
  /** The light's normal at a point: half the volume's own roundness, half the whole crown's. */
  const lightN = (b: Blob, px: number, py: number, pz: number, out: THREE.Vector3) => {
    nb.set(px - b.x, py - b.y, pz - b.z).normalize();
    nc.set((px - b.cx) / b.rx, (py - b.cy) / b.ry, (pz - b.cz) / b.rx).normalize();
    return out.copy(nb).multiplyScalar(0.5).addScaledVector(nc, 0.5).normalize();
  };

  for (const list of chunks.values()) {
    let nv = 0;
    let ni = 0;
    for (const b of list) {
      const sh = b.far ? shapes.far : shapes.near;
      nv += sh.verts.length + cardsPer(b) * 4;
      ni += sh.idx.length + cardsPer(b) * 6;
    }
    const pos = new Float32Array(nv * 3);
    const nor = new Float32Array(nv * 3);
    const uv = new Float32Array(nv * 2);
    const info = new Float32Array(nv * 2);
    const index = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
    let v = 0;
    let ii = 0;
    for (const b of list) {
      const rnd = mulberry(b.seed);
      const sh = b.far ? shapes.far : shapes.near;
      const base = v;
      const rc = b.r * 0.8;
      for (const [x, y, z] of sh.verts) {
        // lumps: the same direction always pushed out the same, so shared corners stay shared
        const bump = 1 + (hash2(Math.round(x * 50), Math.round(y * 50) + Math.round(z * 50) * 101, b.seed & 1023) - 0.5) * 0.34;
        p.set(b.x + x * rc * bump, b.y + y * rc * bump * 0.86, b.z + z * rc * bump);
        pos.set([p.x, p.y, p.z], v * 3);
        lightN(b, p.x, p.y, p.z, nrm);
        nor.set([nrm.x, nrm.y, nrm.z], v * 3);
        info.set([1, b.pal], v * 2);
        v++;
      }
      for (const k of sh.idx) index[ii++] = base + k;
      // the cards on its skin, each a clump of leaves, tipped out a little from the surface
      const n = cardsPer(b);
      for (let c = 0; c < n; c++) {
        let y = rnd() * 2 - 1;
        if (y < -0.55 && rnd() < 0.6) y = -y;
        const az = rnd() * Math.PI * 2;
        const ring = Math.sqrt(1 - y * y);
        dir.set(Math.cos(az) * ring, y, Math.sin(az) * ring);
        const out = b.r * (0.74 + rnd() * 0.22);
        p.set(b.x + dir.x * out, b.y + dir.y * out * 0.88, b.z + dir.z * out);
        nrm.set(dir.x + (rnd() - 0.5) * 0.9, dir.y + (rnd() - 0.5) * 0.9, dir.z + (rnd() - 0.5) * 0.9).normalize();
        t1.crossVectors(nrm, Math.abs(nrm.y) > 0.9 ? SIDE : UP).normalize();
        t2.crossVectors(nrm, t1);
        const roll = rnd() * Math.PI * 2;
        const cr = Math.cos(roll);
        const sr = Math.sin(roll);
        const ax = t1.clone().multiplyScalar(cr).addScaledVector(t2, sr);
        const ay = t1.clone().multiplyScalar(-sr).addScaledVector(t2, cr);
        const half = b.r * (0.5 + rnd() * 0.22);
        // the clump whose pixels come closest to the wood's own pixel size at this card's size
        const want = (half * 2) / TEXEL;
        let sj = 0;
        for (let j = 1; j < CARD_R.length; j++) if (Math.abs(CARD_R[j] * 2 + 6 - want) < Math.abs(CARD_R[sj] * 2 + 6 - want)) sj = j;
        const rect = cards.rects[b.pal * CARD_R.length + sj];
        const u0 = rect.x / cards.pix.w;
        const u1 = (rect.x + rect.w) / cards.pix.w;
        const v0 = rect.y / cards.pix.h;
        const v1 = (rect.y + rect.h) / cards.pix.h;
        lightN(b, p.x, p.y, p.z, nb);
        const q = v;
        for (const [sx, sy, uu, vv] of [[-1, 1, u0, v0], [1, 1, u1, v0], [-1, -1, u0, v1], [1, -1, u1, v1]] as const) {
          pos.set([p.x + (ax.x * sx + ay.x * sy) * half, p.y + (ax.y * sx + ay.y * sy) * half, p.z + (ax.z * sx + ay.z * sy) * half], v * 3);
          nor.set([nb.x, nb.y, nb.z], v * 3);
          uv.set([uu, vv], v * 2);
          info.set([0, b.pal], v * 2);
          v++;
        }
        index.set([q, q + 2, q + 1, q + 2, q + 3, q + 1], ii);
        ii += 6;
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setAttribute('info', new THREE.BufferAttribute(info, 2));
    geo.setIndex(new THREE.BufferAttribute(index, 1));
    geo.computeBoundingSphere();
    const m = new THREE.Mesh(geo, lit) as unknown as LayerMesh;
    m.userData = { born: -1, lit, depth, caster: true };
    m.frustumCulled = true;
    meshes.push(m);
  }
  return meshes;
}
