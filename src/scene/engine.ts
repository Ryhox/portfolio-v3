import * as THREE from 'three';
import { projects } from '@/content/projects';
import { garland } from './art/garland';
import { COMPUTER, KEYBOARD, noticeSprite, screenIdle, screenPicture, type Notice, type NoticeText } from './art/props';
import { cut, Shatter } from './shatter';
import { CRITTERS, FLORA, TUFT_KINDS } from './art/sprites';
import { TREE_D, TREE_SET, type TreeKind } from './art/trees';
import type { Painted } from './art/worker';
import { ATMOS, CLEARING, CORRIDOR, DISCS, EDGE_Z, FRAMES, HERO, HOLLOW, K0, PUDDLES, ROOF, SHORT_SIDE, SUN, texelAt } from './config';
import { blitMesh, depthMaterial, floorMesh, fogMesh, layerMesh, light, meshFor, motes, quadFor, skyMesh, toTexture, type LayerMesh } from './gl';
import { PAL } from './palette';
import { hex, mulberry, Pix, rgbOf } from './pix';
import { forest, forestNow } from './store';
import { buttonState, paintBoard, type Look, type Painted as Board2D, type Para } from './boards';

type Opts = {
  canvas: HTMLCanvasElement;
  /** Current (smoothed) scroll position in CSS pixels. */
  scroll: () => number;
  /** The heading whose font the floating name is set in. */
  title: () => HTMLElement | null;
  onReady: () => void;
  /** Stops the scroll at this position until the current flick is over; false if it can't. */
  hold?: (to: number) => boolean;
};

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const ease = (t: number) => 1 - Math.pow(1 - t, 3);
/** Starts at walking pace, eases to a stop. */
const easeAway = (t: number) => 1 - (1 - t) * (1 - t) * (1 + t);
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smooth = (a: number, b: number, t: number) => {
  const x = clamp01((t - a) / (b - a));
  return x * x * (3 - 2 * x);
};
const v3 = (c: string) => {
  const [r, g, b] = rgbOf(hex(c));
  return new THREE.Vector3(r / 255, g / 255, b / 255);
};
const pixFrom = (m: Painted) => {
  const p = new Pix(m.w, m.h, m.repeat);
  p.data.set(new Uint32Array(m.buf));
  return p;
};

const TEXT_Z = -3.2;
/** The floating name's width in game pixels, the same on every screen. */
const TEXT_PX = 200;
const CRITTER_D = 9;
const FLORA_D = 5;
const SHADOW_SIZE = 1024;
/** The keyboard lies a little in front of the computer, so it's painted for a little closer. */
const KEYBOARD_D = 3.15;
const SHADOW_HALF = 22;

type PainterMsg = Painted | { key: 'done'; group: number; times: number[] } | { key: 'failed' };

/**
 * Three painters, started the moment this module loads (before the page has even finished waking up),
 * each painting one group of the wood. Everything they send is kept, so a forest made again (hot reload,
 * React's double start in development) gets the whole lot replayed.
 */
const painterInbox: { all: PainterMsg[]; listener: ((m: PainterMsg) => void) | null } = { all: [], listener: null };
if (typeof window !== 'undefined' && typeof Worker !== 'undefined') {
  for (let group = 0; group < 3; group++) {
    // a classic worker: that is what the production bundle starts it as (a module worker fails silently there)
    const w = new Worker(new URL('./art/worker.ts', import.meta.url));
    const put = (m: PainterMsg) => {
      painterInbox.all.push(m);
      painterInbox.listener?.(m);
    };
    w.onmessage = (e: MessageEvent<PainterMsg>) => put(e.data);
    w.onerror = (ev) => {
      console.warn('forest painter failed', ev.message);
      put({ key: 'failed' });
    };
    w.postMessage(group);
  }
}

export function createForest(o: Opts) {
  THREE.ColorManagement.enabled = false;
  const renderer = new THREE.WebGLRenderer({ canvas: o.canvas, antialias: false, alpha: false, depth: false, stencil: false, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.setPixelRatio(1);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 16 / 9, 0.04, 220);
  const sunCam = new THREE.OrthographicCamera(-SHADOW_HALF, SHADOW_HALF, SHADOW_HALF, -SHADOW_HALF, 40, 110);
  sunCam.layers.enableAll();

  const main = new THREE.WebGLRenderTarget(4, 4, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, generateMipmaps: false, depthTexture: new THREE.DepthTexture(4, 4) });
  const fogged = new THREE.WebGLRenderTarget(4, 4, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, generateMipmaps: false, depthBuffer: false });
  const shadow = new THREE.WebGLRenderTarget(SHADOW_SIZE, SHADOW_SIZE, { depthTexture: new THREE.DepthTexture(SHADOW_SIZE, SHADOW_SIZE) });
  light.shadowMap.value = shadow.depthTexture;
  light.sunDir.value.set(...SUN);

  // the view from below the ground, for the puddles
  const mirrorCam = new THREE.PerspectiveCamera();
  const mirrored = new THREE.WebGLRenderTarget(4, 4, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, generateMipmaps: false, depthTexture: new THREE.DepthTexture(4, 4) });
  const mirroredFog = new THREE.WebGLRenderTarget(4, 4, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, generateMipmaps: false, depthBuffer: false });
  const fogScene = new THREE.Scene();
  const blitScene = new THREE.Scene();
  const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const fog = fogMesh(main.texture, main.depthTexture!);
  const blit = blitMesh(fogged.texture);
  fogScene.add(fog);
  // the puddles' view gets its own fog pass, so the two never share state
  const fogMirror = fogMesh(mirrored.texture, mirrored.depthTexture!);
  fogMirror.material.uniforms.mirror.value = -1;
  const mirrorFogScene = new THREE.Scene();
  mirrorFogScene.add(fogMirror);
  blitScene.add(blit);

  const sky = skyMesh();
  scene.add(sky);

  const layers: LayerMesh[] = [];
  const keyed: Record<string, LayerMesh> = {};
  let clock = 0;
  const add = (m: LayerMesh, x: number, y: number, z: number, key?: string) => {
    renderer.initTexture(m.material.uniforms.map.value as THREE.Texture);
    m.position.set(x, y, z);
    m.userData.born = clock < 0.05 ? -1 : clock;
    scene.add(m);
    layers.push(m);
    if (key) keyed[key] = m;
    return m;
  };

  // --- what the worker paints arrives here ------------------------------------------------------------
  let floor: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial> | null = null;
  let floorPattern: THREE.DataTexture | null = null;
  const discs: { mesh: LayerMesh; w: number; h: number; size: number; cx: number; cy: number; rest: THREE.Vector3; t: number; from: number; to: number; start: number; dur: number; lift: number }[] = [];
  const screen = { mesh: null as LayerMesh | null, pix: null as Pix | null, tex: null as THREE.DataTexture | null };
  const led = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0x1f241d }));
  const cat = { mesh: null as LayerMesh | null, open: null as THREE.Texture | null, shut: null as THREE.Texture | null };
  type Critter = { mesh: LayerMesh; kind: number; home: THREE.Vector2; x: number; z: number; dir: number; state: 'idle' | 'move'; t: number; phase: number; flee: number };
  const critters: Critter[] = [];
  let critterAtlas: { rects: { x: number; y: number; w: number; h: number }[]; index: number[][]; w: number; h: number } | null = null;
  let dust: THREE.Points | null = null;
  let flora: LayerMesh | null = null;
  const got = new Set<string>();

  function receive(m: Painted) {
    got.add(m.key);
    // the loading bar fills as the pieces of the forest arrive
    document.documentElement.style.setProperty('--load', String(Math.min(0.94, 0.06 + got.size / 32)));
    const pix = pixFrom(m);
    const l = { pix, ax: m.ax, ay: m.ay, d: m.d, repeat: m.repeat };
    switch (m.key) {
      case 'edgeL':
      case 'edgeR':
        add(layerMesh(l), m.key === 'edgeL' ? -2.6 : 2.6, 0, EDGE_Z, m.key);
        placeEdge();
        break;
      case 'edgeGround':
        add(layerMesh(l, { side: 3000 }), 0, 0, EDGE_Z + 0.02);
        break;
      case 'floorPattern':
        floorPattern = toTexture(pix, { repeat: true });
        floorPattern.wrapT = THREE.RepeatWrapping;
        break;
      case 'floorRamps': {
        const rows = (m.extra as { rows: number }).rows;
        floor = floorMesh(floorPattern!, toTexture(pix, { mips: false }), rows, 0.008);
        const fl = floor.material.uniforms;
        fl.reflection.value = mirroredFog.texture;
        fl.res.value.set(size.W, size.H);
        PUDDLES.forEach((p, i) => fl.puddles.value[i].set(...p));
        placeClearing();
        scene.add(floor);
        break;
      }
      case 'roof': {
        const roof = new THREE.Mesh(new THREE.PlaneGeometry(ROOF.x1 - ROOF.x0, ROOF.z0 - ROOF.z1), depthMaterial(toTexture(pix, { mips: false })));
        roof.rotation.x = -Math.PI / 2;
        roof.position.set((ROOF.x0 + ROOF.x1) / 2, ROOF.y, (ROOF.z0 + ROOF.z1) / 2);
        roof.layers.set(1);
        roof.frustumCulled = false;
        // after the turn, v = 0 lies at the edge of the wood, where mask row 0 is
        scene.add(roof);
        break;
      }
      case 'flora':
        scatterFlora(pix, m.extra as { x: number; y: number; w: number; h: number }[]);
        break;
      case 'critters': {
        const e = m.extra as { rects: { x: number; y: number; w: number; h: number }[]; index: number[][] };
        critterAtlas = { ...e, w: pix.w, h: pix.h };
        spawnCritters(toTexture(pix, { mips: false }));
        break;
      }
      case 'backdrop':
        add(layerMesh(l, { side: 3000 }), 0, 0, CLEARING.backdropZ);
        break;
      case 'computer': {
        const d = CLEARING.camZ - CLEARING.computer.z;
        add(layerMesh({ pix, ax: COMPUTER.ax, ay: COMPUTER.ay, d }, {}, false), CLEARING.computer.x, 0, CLEARING.computer.z, 'computer');
        const s = screenIdle(true);
        const sm = layerMesh({ pix: s, ax: COMPUTER.ax - COMPUTER.screen.x, ay: COMPUTER.ay - COMPUTER.screen.y, d }, {}, false, 0);
        sm.userData.caster = false;
        screen.mesh = add(sm, CLEARING.computer.x, 0, CLEARING.computer.z + 0.01);
        screen.pix = s;
        screen.tex = sm.material.uniforms.map.value as THREE.DataTexture;
        const t = texelAt(d);
        led.scale.set(2 * t, t, 1);
        led.position.set(CLEARING.computer.x + (COMPUTER.led.x + 1 - COMPUTER.ax) * t, (COMPUTER.ay - COMPUTER.led.y - 0.5) * t, CLEARING.computer.z + 0.012);
        scene.add(led);
        break;
      }
      case 'keyboard': {
        const kb = add(layerMesh({ pix, ax: KEYBOARD.cx, ay: pix.h, d: KEYBOARD_D }, {}, false), 0, 0, CLEARING.camZ - KEYBOARD_D, 'keyboard');
        kb.userData.caster = true;
        placeClearing();
        break;
      }
      case 'hollowFrame':
        add(layerMesh(l, { side: 3000 }), 0, 0, HOLLOW.frameZ).userData.hollow = true;
        break;
      case 'stump': {
        const st = add(layerMesh(l, { side: 3000 }), CLEARING.exitX, 0, HOLLOW.stumpZ);
        st.userData.hollow = true;
        const [cx, cy] = (m.extra as { catAt: [number, number] }).catAt;
        const t = texelAt(m.d);
        st.userData.catAt = [CLEARING.exitX + (cx - m.ax) * t, (m.ay - cy) * t];
        break;
      }
      case 'catOpen':
      case 'catShut': {
        const tex = toTexture(pix, { mips: false });
        if (m.key === 'catOpen') {
          const st = layers.find((x) => x.userData.catAt) as LayerMesh & { userData: { catAt: [number, number] } };
          const d = HOLLOW.camZ - HOLLOW.stumpZ;
          const cm = meshFor(quadFor(pix.w, pix.h, pix.w / 2, pix.h, d), tex);
          cat.open = tex;
          cat.mesh = add(cm, st?.userData.catAt[0] ?? CLEARING.exitX, st?.userData.catAt[1] ?? 0.7, HOLLOW.stumpZ + 0.01);
          cat.mesh.userData.hollow = true;
        } else cat.shut = tex;
        break;
      }
      case 'hollowWall': {
        // the heart of the swirl sits behind the cat
        const d = HOLLOW.camZ - HOLLOW.wallZ;
        add(layerMesh(l, { side: 600 }), CLEARING.exitX, HOLLOW.camY + 30 * d * K0, HOLLOW.wallZ).userData.hollow = true;
        break;
      }
      case 'hollowBack':
        add(layerMesh(l, { side: 3000 }), CLEARING.exitX, 0, HOLLOW.wallZ).userData.hollow = true;
        break;
      default:
        if (m.key.startsWith('tree:') || m.key.startsWith('bush:')) {
          const kind = m.key.startsWith('bush:') ? 'bush' : (m.extra as { kind: TreeKind }).kind;
          treeTex.push({ key: m.key, kind, pix, ax: m.ax, ay: m.ay, tex: toTexture(pix, { mips: true }) });
          if (treeTex.length === TREE_COUNT) plantTrees();
        } else if (m.key.startsWith('disc')) {
          const i = Number(m.key.slice(4));
          const e = m.extra as { cx: number; cy: number; size: number };
          const mesh = layerMesh(l, {}, false);
          const t = texelAt(m.d);
          discs[i] = { mesh, w: pix.w * t, h: pix.h * t, size: e.size * t, cx: e.cx * t, cy: e.cy * t, rest: new THREE.Vector3(), t: 0, from: 0, to: 0, start: 0, dur: 1, lift: 0 };
          add(mesh, 0, 0, CLEARING.camZ - DISCS[i].d);
          if (i === projects.length - 1) {
            placeClearing();
            dust = motes(18, 7);
            scene.add(dust);
            placeClearing();
          }
        } else {
          const f = /^f(\d)$/.exec(m.key);
          if (f) add(layerMesh(l, { side: 4000 }), 0, 0, FRAMES[Number(f[1])].z);
        }
    }
    tryReady();
  }

  function setFrame(mesh: LayerMesh, r: { x: number; y: number; w: number; h: number }, aw: number, ah: number, flip: boolean, boxH = r.h) {
    const u = mesh.material.uniforms.uvRect.value as THREE.Vector4;
    const v0 = (ah - boxH) / ah;
    if (flip) u.set((r.x + r.w) / aw, v0, -r.w / aw, boxH / ah);
    else u.set(r.x / aw, v0, r.w / aw, boxH / ah);
  }

  // --- the trees, planted one by one at real depths, batched per sprite -----------------------------------
  const TREE_COUNT = TREE_SET.reduce((n, t) => n + t.seeds.length, 0) + 2;
  const treeTex: { key: string; kind: TreeKind | 'bush'; pix: Pix; ax: number; ay: number; tex: THREE.Texture }[] = [];
  let planted = false;
  function plantTrees() {
    // two painters race to send the sprites; put them in a fixed order first, so every visitor gets the same wood
    treeTex.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
    const rnd = mulberry(4242);
    const cx = CLEARING.computer.x;
    const ex = CLEARING.exitX;
    const pathX = (z: number) => (z > -56 ? 0 : z > -71 ? 0.3 : z > -96 ? 0.3 + ((-71 - z) / 25) * (ex - 0.3) : ex);
    const spots: { kind: TreeKind | 'bush'; x: number; z: number; s: number }[] = [];
    // round the clearing and behind the stump, placed by hand so the light falls between them
    const placed: [TreeKind, number, number][] = [
      ['oak', cx - 5.6, -74.8], ['birch', cx - 3.3, -79.3], ['beech', cx - 1.5, -80.9], ['oak', cx + 1.8, -81.2],
      ['beech', cx + 3.6, -79.1], ['young', cx + 4.3, -75.9], ['ancient', cx + 2.9, -83.6], ['oak', cx - 2.8, -83.3],
      ['birch', ex - 5.4, -100.6], ['young', ex + 5.2, -100.9], ['oak', ex - 6.6, -102.5], ['beech', ex + 6.8, -103.2],
    ];
    for (const [kind, x, z] of placed) spots.push({ kind, x, z, s: 0.9 + rnd() * 0.25 });
    const clear = (x: number, z: number) => {
      if (z > -6) return false;
      if (Math.abs(x - pathX(z)) < 1.2) return false;
      const qx = (x - cx) / 3.7;
      const qz = (z + 76.5) / 3.6;
      if (qx * qx + qz * qz < 1) return false;
      if (z < -66 && z > -76 && Math.abs(x - 0.3) < 3.4) return false;
      const hx = (x - ex) / 2.5;
      const hz = (z + 100.6) / 2.4;
      if (hx * hx + hz * hz < 1) return false;
      if (z < -88 && z > -100 && Math.abs(x - ex) < 2.3) return false;
      if (z < -97 && Math.abs(x - ex) < 6) return false;
      return spots.every((t) => (t.x - x) ** 2 + (t.z - z) ** 2 > 1.5);
    };
    const kinds: TreeKind[] = ['oak', 'oak', 'oak', 'beech', 'beech', 'beech', 'birch', 'birch', 'young', 'young', 'ancient'];
    for (let i = 0; i < 1600 && spots.length < 430; i++) {
      const z = -6 - rnd() * 104;
      const side = rnd() < 0.5 ? -1 : 1;
      const x = pathX(z) + side * (1.2 + Math.pow(rnd(), 0.9) * 13);
      if (!clear(x, z)) continue;
      const far = Math.abs(x - pathX(z)) > 3;
      let kind = kinds[Math.floor(rnd() * kinds.length)];
      if (kind === 'ancient' && !far) kind = 'oak';
      spots.push({ kind: rnd() < 0.12 ? 'bush' : kind, x, z, s: 0.85 + rnd() * 0.35 });
    }
    // a sparser band further out, from its own seed so the wood near the path stays as it was:
    // wide screens see trees to their edges instead of empty mist
    const wide = mulberry(5151);
    for (let i = 0, n = 0; i < 1600 && n < 320; i++) {
      const z = -6 - wide() * 104;
      const side = wide() < 0.5 ? -1 : 1;
      const x = pathX(z) + side * (13.5 + wide() * 15);
      if (!clear(x, z)) continue;
      spots.push({ kind: wide() < 0.1 ? 'bush' : kinds[Math.floor(wide() * kinds.length)], x, z, s: 0.9 + wide() * 0.35 });
      n++;
    }
    // one batch per painted sprite: each spot takes one of its kind's sprites
    const t = texelAt(TREE_D);
    const groups = treeTex.map(() => ({ pos: [] as number[], uv: [] as number[], idx: [] as number[] }));
    for (const sp of spots) {
      const options = treeTex.map((tt, i) => (tt.kind === sp.kind ? i : -1)).filter((i) => i >= 0);
      const gi = options[Math.floor(rnd() * options.length)];
      const tt = treeTex[gi];
      const g = groups[gi];
      const k = t * sp.s;
      const x0 = sp.x - tt.ax * k;
      const x1 = sp.x + (tt.pix.w - tt.ax) * k;
      const y1 = (tt.ay + 1) * k;
      const n = g.pos.length / 3;
      g.pos.push(x0, y1, sp.z, x1, y1, sp.z, x0, 0, sp.z, x1, 0, sp.z);
      const flip = rnd() < 0.5;
      const v1 = (tt.ay + 1) / tt.pix.h;
      g.uv.push(flip ? 1 : 0, 0, flip ? 0 : 1, 0, flip ? 1 : 0, v1, flip ? 0 : 1, v1);
      g.idx.push(n, n + 2, n + 1, n + 2, n + 3, n + 1);
    }
    groups.forEach((g, i) => {
      if (!g.idx.length) return;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(g.pos, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(g.uv, 2));
      geo.setIndex(g.idx);
      const mesh = add(meshFor(geo, treeTex[i].tex), 0, 0, 0);
      mesh.userData.always = true;
    });
    planted = true;
  }

  // --- flowers and mushrooms, all in one mesh --------------------------------------------------------
  function scatterFlora(pix: Pix, rects: { x: number; y: number; w: number; h: number }[]) {
    const rnd = mulberry(77);
    const t = texelAt(FLORA_D);
    const pos: number[] = [];
    const uv: number[] = [];
    const idx: number[] = [];
    const put = (kind: number, x: number, z: number) => {
      const r = rects[kind];
      const w = r.w * t;
      const h = r.h * t;
      const n = pos.length / 3;
      pos.push(x - w / 2, h, z, x + w / 2, h, z, x - w / 2, 0, z, x + w / 2, 0, z);
      const u0 = r.x / pix.w;
      const u1 = (r.x + r.w) / pix.w;
      const v0 = r.y / pix.h;
      const v1 = (r.y + r.h) / pix.h;
      uv.push(u0, v0, u1, v0, u0, v1, u1, v1);
      idx.push(n, n + 2, n + 1, n + 2, n + 3, n + 1);
    };
    // kinds: 0 daisy 1 daisies 2 buttercup 3 bluebells 4 campion 5 clover 6 toadstool 7 small toadstool 8 brown caps 9 sprout
    const meadow = [0, 1, 2, 2, 3, 4, 5, 5, 0, 1];
    const wood = [6, 7, 8, 8, 6, 3, 3, 0, 5, 2, 4, 7, 1];
    const clearing = [0, 1, 2, 5, 3, 9];
    const hollow = [6, 7, 6, 8, 4, 3];
    const off = (x: number, pathX: number, min: number) => Math.abs(x - pathX) > min;
    // the meadow at the edge of the wood is full of wildflowers, in patches
    for (let i = 0; i < 120; i++) {
      const px = (rnd() - 0.5) * 10;
      const pz = -0.6 - rnd() * 4.6;
      const n = 6 + Math.floor(rnd() * 10);
      for (let k = 0; k < n; k++) {
        const r = Math.pow(rnd(), 0.7) * 0.4;
        const a = rnd() * Math.PI * 2;
        const x = px + Math.cos(a) * r;
        const z = pz + Math.sin(a) * r * 0.6;
        if (z > -0.4 || !off(x, 0, 0.28)) continue;
        put(meadow[Math.floor(rnd() * meadow.length)], x, z);
      }
    }
    // the wood: patches of mushrooms and wildflowers along both sides of the path
    for (let i = 0; i < 230; i++) {
      const z = -5.5 - rnd() * 62;
      const side = rnd() < 0.5 ? -1 : 1;
      const cx = side * (0.5 + Math.pow(rnd(), 1.4) * 3.6);
      const n = 4 + Math.floor(rnd() * 9);
      const kind = wood[Math.floor(rnd() * wood.length)];
      // a tight cluster: most of one kind, a couple of others mixed in, thinning out at the edge
      for (let k = 0; k < n; k++) {
        const r = Math.pow(rnd(), 0.7) * 0.22;
        const a = rnd() * Math.PI * 2;
        const x = cx + Math.cos(a) * r;
        if (!off(x, 0, 0.4)) continue;
        put(rnd() < 0.8 ? kind : wood[Math.floor(rnd() * wood.length)], x, z + Math.sin(a) * r * 0.7);
      }
    }
    // the clearing: flowers round the edge of the sun, kept off the discs
    for (let i = 0; i < 220; i++) {
      const a = rnd() * Math.PI * 2;
      const r = 1.2 + rnd() * 2.6;
      const x = CLEARING.computer.x + Math.cos(a) * r * 1.4;
      const z = CLEARING.computer.z - 1.2 + Math.sin(a) * r * 0.7;
      if (z > -73.2 || (z > -76 && Math.abs(x - CLEARING.computer.x) < 1.4)) continue;
      put(clearing[Math.floor(rnd() * clearing.length)], x, z);
    }
    // the hollow: toadstools round the stump
    for (let i = 0; i < 140; i++) {
      const a = rnd() * Math.PI * 2;
      const r = 0.7 + rnd() * 1.9;
      const x = CLEARING.exitX + Math.cos(a) * r;
      const z = HOLLOW.stumpZ + 0.4 + Math.sin(a) * r * 0.5;
      if (z > HOLLOW.camZ - 1.5) continue;
      put(hollow[Math.floor(rnd() * hollow.length)], x, z);
    }
    // grass over the whole floor, in each stretch's greens, handing over with a scatter rather than a line
    const zoneAt = (z: number) => {
      const pick = (a: number, b: number, t: number) => (rnd() < t ? b : a);
      if (z > -6) return 0;
      if (z > -30) return pick(0, 1, (-6 - z) / 24);
      if (z > -58) return pick(1, 2, (-30 - z) / 28);
      if (z > -68) return pick(2, 3, (-58 - z) / 10);
      if (z > -79) return 3;
      if (z > -90) return pick(3, 4, (-79 - z) / 11);
      return 4;
    };
    // grass over the whole floor, scattered at random (a grid of tufts reads as a checkerboard)
    const cx = CLEARING.computer.x;
    for (let i = 0; i < 11000; i++) {
      {
        const gx = -7 + rnd() * 18;
        const gz = -0.3 - rnd() * 107;
        // only under the discs, the computer and the stump is the ground kept clear
        if (gz < -72.4 && gz > -74.55 && Math.abs(gx - cx) < 2.4) continue;
        if (gz < -74.95 && gz > -76.2 && Math.abs(gx - cx) < 1.2) continue;
        if (gz < -100.4 && gz > -101.8 && Math.abs(gx - CLEARING.exitX) < 0.8) continue;
        put(FLORA.length + zoneAt(gz) * TUFT_KINDS + Math.floor(rnd() * TUFT_KINDS), gx, gz);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    flora = add(meshFor(g, toTexture(pix, { mips: true })), 0, 0, 0);
    flora.userData.always = true;
    flora.userData.caster = false;
  }

  // --- the animals ------------------------------------------------------------------------------------
  function spawnCritters(tex: THREE.Texture) {
    if (!critterAtlas) return;
    const rnd = mulberry(91);
    // kind (0 rabbit, 1 hedgehog, 2 squirrel, 3 bird, 4 frog), x, z: just off the path, all the way along
    const homes: [number, number, number][] = [
      [0, -1.2, -2.4], [3, 0.9, -1.9], [3, 1.2, -2.2], [4, -0.7, -1.5], [2, 1.6, -3.4],
      [1, -0.8, -8], [0, 0.9, -11], [3, -0.6, -14], [2, 1.0, -17], [4, -0.9, -20],
      [0, 0.7, -24], [1, -1.0, -28], [3, 0.8, -31], [2, -0.8, -35], [0, 1.1, -39],
      [4, -0.6, -43], [3, 0.7, -46], [1, 0.9, -50], [0, -0.9, -54], [2, 0.8, -58],
      [3, -0.7, -62], [4, 0.9, -65], [3, 1.8, -77.5], [1, -2.0, -76.5], [2, 2.5, -80],
      [0, CLEARING.exitX - 0.9, -85], [3, CLEARING.exitX + 0.8, -89],
      [4, CLEARING.exitX - 1.1, -99], [3, CLEARING.exitX + 1.3, -100.5], [0, CLEARING.exitX + 1.9, -102],
    ];
    for (const [kind, x, z] of homes) {
      const frames = critterAtlas.index[kind];
      const r0 = critterAtlas.rects[frames[0]];
      const boxH = Math.max(...frames.map((f) => critterAtlas!.rects[f].h));
      const mesh = meshFor(quadFor(r0.w, boxH, r0.w / 2, boxH, CRITTER_D), tex);
      mesh.userData.boxH = boxH;
      add(mesh, x, 0, z);
      critters.push({ mesh, kind, home: new THREE.Vector2(x, z), x, z, dir: rnd() < 0.5 ? -1 : 1, state: 'idle', t: rnd() * 2, phase: rnd() * 10, flee: 0 });
    }
  }

  function updateCritters(dt: number, now: number) {
    if (!critterAtlas) return;
    const cam = camera.position;
    for (const c of critters) {
      const def = CRITTERS[c.kind];
      const ahead = cam.z - c.z;
      // the camera coming close sends them scurrying off sideways
      if (ahead > 0 && ahead < 3.2 && Math.abs(c.x - cam.x) < 1.5 && c.flee <= 0) {
        c.flee = 1.4;
        c.state = 'move';
        c.dir = c.x >= cam.x ? 1 : -1;
        c.t = 1.4;
      }
      c.flee -= dt;
      c.t -= dt;
      if (c.t <= 0) {
        if (c.state === 'idle') {
          c.state = 'move';
          c.t = 0.5 + Math.random() * 1.4;
          if (Math.abs(c.x - c.home.x) > 0.9) c.dir = c.x > c.home.x ? -1 : 1;
          else if (Math.random() < 0.5) c.dir = -c.dir;
        } else {
          c.state = 'idle';
          c.t = 0.8 + Math.random() * 2.6;
        }
      }
      const speed = def.speed * 0.32 * (c.flee > 0 ? 2.2 : 1);
      if (c.state === 'move') {
        c.x += c.dir * speed * dt;
        c.z += Math.sin(now * 0.7 + c.phase) * speed * dt * 0.25;
        c.phase += dt * (def.hop ? 9 : 12);
      }
      const frames = c.state === 'move' ? def.move : def.idle;
      const fi = c.state === 'move' ? frames[Math.floor(c.phase) % frames.length] : frames[Math.floor((now + c.phase) * 1.5) % frames.length];
      const r = critterAtlas.rects[critterAtlas.index[c.kind][fi]];
      setFrame(c.mesh, r, critterAtlas.w, critterAtlas.h, c.dir < 0, c.mesh.userData.boxH as number);
      const hop = c.state === 'move' && def.hop ? Math.abs(Math.sin(c.phase * Math.PI * 0.5)) * def.hop : 0;
      // snap to the texel grid so they move like pixel art
      const t = texelAt(CRITTER_D);
      c.mesh.position.set(Math.round(c.x / t) * t, Math.round(hop / t) * t, c.z);
    }
  }

  // --- the floating name ------------------------------------------------------------------------------
  let text: LayerMesh | null = null;
  let textGaveUp = false;
  let textW = 0;
  function buildText() {
    const h1 = o.title();
    const family = h1 ? getComputedStyle(h1).fontFamily : 'Georgia, serif';
    const target = Math.min(TEXT_PX, Math.round(size.W * 0.8));
    if (text && Math.abs(target - textW) < 6) return;
    textW = target;
    const c = document.createElement('canvas');
    const g = c.getContext('2d', { willReadFrequently: true })!;
    let fs = 100;
    g.font = `700 ${fs}px ${family}`;
    fs = Math.max(12, Math.round((fs * target) / Math.max(1, g.measureText('ryhox').width)));
    g.font = `700 ${fs}px ${family}`;
    const m = g.measureText('ryhox');
    const asc = Math.ceil(m.actualBoundingBoxAscent);
    const desc = Math.ceil(m.actualBoundingBoxDescent);
    // room round the word for the flowers that dress it: posies stand on the tops, a sprig hangs off the y
    const pad = 6;
    const top = 10;
    const letters = [...'ryhox'].map((_, i): [number, number] => [
      Math.floor(2 + pad + g.measureText('ryhox'.slice(0, i)).width),
      Math.ceil(2 + pad + g.measureText('ryhox'.slice(0, i + 1)).width),
    ]);
    c.width = Math.ceil(m.width) + 4 + pad * 2;
    c.height = asc + desc + 4 + top + 4;
    g.font = `700 ${fs}px ${family}`;
    g.fillStyle = '#000';
    g.textBaseline = 'alphabetic';
    g.fillText('ryhox', 2 + pad, asc + 2 + top);
    const data = g.getImageData(0, 0, c.width, c.height).data;
    const p = new Pix(c.width, c.height);
    const ink = hex('#1c2a1d');
    const edge = hex('#2c3d2b');
    for (let i = 0; i < c.width * c.height; i++) {
      const a = data[i * 4 + 3];
      if (a > 150) p.data[i] = ink;
      else if (a > 90) p.data[i] = edge;
    }
    garland(p, asc + 2 + top, letters, 7);
    p.bleed();
    const mesh = layerMesh({ pix: p, ax: p.w / 2, ay: asc * 0.62 + 2 + top, d: HERO.z - TEXT_Z }, {}, false, 0.35);
    if (text) {
      scene.remove(text);
      layers.splice(layers.indexOf(text), 1);
      text.geometry.dispose();
    }
    text = add(mesh, HERO.x, HERO.y, TEXT_Z);
    text.userData.born = -1;
    // drawn last and always on top (nothing stands in front of it), still writing its depth for the fog
    text.renderOrder = 50;
    mesh.material.depthFunc = THREE.AlwaysDepth;
  }

  // --- words hung in the forest, painted sharp and drawn over the pixels ------------------------------------
  type Board = { key: string; mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>; art: Board2D; d: number; z: number; at: () => [number, number] };
  const boardScene = new THREE.Scene();
  const boardCam = new THREE.PerspectiveCamera();
  const boards: Record<string, Board> = {};
  const CREAM = '#f1ebd6';
  const LEAF = '#c9d48f';
  /** World units per CSS pixel for something at distance d, on this screen. */
  const perCss = (d: number) => (d * K0 * (size.devW / size.cssW)) / size.scale;
  // the socials as pixel buttons, each with its own little icon
  const linksRow = (prefix: string, px: number): Para => ({
    row: true,
    gap: Math.round(px * 0.8),
    runs: (['github', 'modrinth', 'email', 'discord'] as const).map((key) => ({
      text: key === 'github' ? 'GitHub' : key[0].toUpperCase() + key.slice(1),
      font: 'pixel' as const,
      size: px,
      weight: 600,
      color: CREAM,
      link: `${prefix}-${key}`,
      button: true,
      icon: key,
    })),
  });
  /** The words beside the computer where there's no notice board for them (over the canopy), `fit` times their full size. */
  function workParas(fit: number): Para[] {
    const sel = forest.get().selected;
    const s = (v: number) => Math.round(v * fit);
    if (sel === null) {
      return [
        { runs: [{ text: 'Selected work', font: 'display', size: s(50), color: CREAM }], after: 6, lineHeight: 1.05 },
        { runs: [{ text: 'Pick up a disc to load it.', font: 'text', size: s(18), color: CREAM }] },
      ];
    }
    const p = projects[sel];
    return [
      { runs: [{ text: p.title, font: 'display', size: s(50), color: CREAM }], after: 4, lineHeight: 1.05 },
      { runs: [{ text: p.kicker, font: 'italic', size: s(21), color: LEAF }], after: s(14) },
      { runs: [{ text: p.description, font: 'text', size: s(18), color: CREAM }], after: s(12), lineHeight: 1.5 },
      { runs: [{ text: p.stack.join(' · '), font: 'text', size: s(15), color: 'rgba(241,235,214,0.8)' }], after: s(16) },
      { row: true, gap: s(16), runs: p.links.map((l, i) => ({ text: l.label, font: 'pixel' as const, size: s(18), weight: 600, color: CREAM, link: `work-link${i}`, button: true })) },
    ];
  }

  function boardMaterial(tex: THREE.Texture) {
    return new THREE.ShaderMaterial({
      uniforms: {
        map: { value: tex },
        fogColor: { value: new THREE.Vector3() },
        fog: { value: 0 },
        opacity: { value: 1 },
        // the forest's own depth, so trees and the name in front hide words behind them
        tDepth: { value: main.depthTexture },
        lowRes: blit.material.uniforms.lowRes,
        scale: blit.material.uniforms.scale,
        offset: blit.material.uniforms.offset,
      },
      vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D map;
        uniform vec3 fogColor;
        uniform float fog;
        uniform float opacity;
        uniform sampler2D tDepth;
        uniform vec2 lowRes;
        uniform float scale;
        uniform vec2 offset;
        varying vec2 vUv;
        void main() {
          vec2 px = floor((gl_FragCoord.xy + offset) / scale);
          if (texture2D(tDepth, (px + 0.5) / lowRes).r < gl_FragCoord.z - 0.00001) discard;
          vec4 c = texture2D(map, vUv);
          gl_FragColor = vec4(mix(c.rgb, fogColor, fog), c.a * opacity);
        }`,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
  }

  /** A pixel sprite drawn in the sharp pass: whole texels as crisp blocks however it's turned, in the air's light. */
  function spriteMaterial(tex: THREE.Texture) {
    const m = boardMaterial(tex);
    m.uniforms.shade = { value: 1 };
    m.fragmentShader = m.fragmentShader
      .replace('uniform float opacity;', 'uniform float opacity;\n        uniform float shade;')
      .replace('vec4 c = texture2D(map, vUv);', 'vec4 c = texture2D(map, vUv);\n          if (c.a < 0.5) discard;\n          c = vec4(c.rgb * shade, 1.0);');
    return m;
  }

  /**
   * Paints (or repaints) a board and hangs it; `at` gives its top-left corner in world x/y.
   * Given paragraphs by size and a `fitH`, the words shrink until they fit that many CSS pixels high.
   */
  function hang(key: string, paras: Para[] | ((fit: number) => Para[]), width: number, d: number, z: number, at: () => [number, number], look: Look = 'scrim', fitH = Infinity) {
    const ratio = Math.min(3, (size.devW / size.cssW) * 1.6);
    const sized = typeof paras === 'function' ? paras : () => paras;
    let art = paintBoard(sized(1), width, ratio, look);
    for (let fit = 0.95; art.h > fitH && fit > 0.4; fit -= 0.05) art = paintBoard(sized(fit), width, ratio, look);
    const tex = new THREE.CanvasTexture(art.canvas);
    tex.colorSpace = THREE.NoColorSpace;
    tex.anisotropy = 4;
    renderer.initTexture(tex);
    const old = boards[key];
    if (old) {
      (old.mesh.material.uniforms.map.value as THREE.Texture).dispose();
      old.mesh.material.uniforms.map.value = tex;
      old.art = art;
      old.at = at;
      return;
    }
    const geo = new THREE.PlaneGeometry(1, 1);
    geo.translate(0.5, -0.5, 0);
    const mesh = new THREE.Mesh(geo, boardMaterial(tex));
    mesh.frustumCulled = false;
    boardScene.add(mesh);
    boards[key] = { key, mesh, art, d, z, at };
  }

  function hangAll() {
    const m = 24;
    const toPx = (css: number) => (css * (size.devW / size.cssW)) / size.scale;
    // the socials, low on the left of the meadow: you walk past them
    const sd = 2.4;
    hang('socials', [linksRow('socials', Math.round(Math.min(20, Math.max(14, size.cssW / 110))))], 640, sd, HERO.z - sd, () => {
      const k = perCss(sd);
      const b = boards.socials.art;
      return [HERO.x + (-size.W / 2 + toPx(m)) * sd * K0 - 8 * k, HERO.y - (size.H / 2 - toPx(m)) * sd * K0 + (b.h - 8) * k];
    }, 'none');
    // the words beside the computer: written right on the old notice board where it has room beside the
    // computer; elsewhere (phones, squarish windows) they float over the dark of the canopy
    buildNotice();
    if (notice.on) {
      if (boards.work) {
        boardScene.remove(boards.work.mesh);
        (boards.work.mesh.material.uniforms.map.value as THREE.Texture).dispose();
        delete boards.work;
      }
      return;
    }
    const wd = 4.6;
    const wide = size.wide;
    const ww = wide ? Math.min(470, size.cssW * 0.34) : size.cssW - 40;
    const base = Math.min(1, Math.max(0.68, size.cssW / 760));
    hang('work', (fit) => workParas(base * fit), ww, wd, CLEARING.camZ - wd, () => {
      const k = perCss(wd);
      const b = boards.work.art;
      // high on the right, so the links never sit behind a disc
      if (wide) return [size.restX + size.W * 0.1 * wd * K0 - 60 * k, CLEARING.camY + size.H * 0.3 * wd * K0 + 60 * k];
      return [size.restX - (b.w / 2) * k, CLEARING.camY + (size.H / 2 - toPx(16)) * wd * K0 + 50 * k];
    });
  }

  // --- the old notice board in the clearing ---------------------------------------------------------------
  /**
   * A pixel sprite like the computer, with the words painted right on its paper; painted here (not in the
   * painters) because its size follows the screen and its words follow the disc you pick. It stands in the free
   * space right of the computer, turned to face you. Walk on and it bursts to pieces, which stay lying in the
   * grass, words and all, until you pick another disc: then a new board pulls itself up out of the ground.
   */
  const NOTICE_D = 3.6;
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const notice = {
    on: false,
    mesh: null as LayerMesh | null,
    sharp: null as THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial> | null,
    sprite: null as Notice | null,
    key: '',
    z: CLEARING.camZ - NOTICE_D,
    yaw: 0,
    state: 'standing' as 'standing' | 'broken' | 'rising',
    rise: 1,
    shake: 0,
    shatter: null as Shatter | null,
  };
  const noticeTilt = new THREE.Matrix4();
  const tiltA = new THREE.Matrix4();
  const noticeAt = new THREE.Vector3();
  const noticeAt2 = new THREE.Vector3();
  /** What the board says: the picked disc's project, or how to pick one. */
  let noticeFonts: NoticeText['fonts'] | null = null;
  function noticeText(sel: number | null): NoticeText {
    if (!noticeFonts) {
      const root = getComputedStyle(document.documentElement);
      noticeFonts = { display: root.getPropertyValue('--font-display').trim() || 'Georgia, serif', pixel: root.getPropertyValue('--font-pixel').trim() || 'monospace' };
    }
    const fonts = noticeFonts;
    const state = (i: number) => buttonState[`work-link${i}`];
    if (sel === null) return { title: 'Selected work', body: 'Pick up a disc to load it.', links: [], hover: null, press: null, fonts };
    const pr = projects[sel];
    const hover = pr.links.findIndex((_, i) => state(i) === 'hover');
    const press = pr.links.findIndex((_, i) => state(i) === 'press');
    return { title: pr.title, kicker: pr.kicker, body: pr.description, stack: pr.stack.join(' · '), links: pr.links.map((l) => l.label), hover: hover < 0 ? null : hover, press: press < 0 ? null : press, fonts };
  }
  function buildNotice() {
    const t = texelAt(NOTICE_D);
    // the free space right of the computer, in game pixels from the middle of the screen
    const from = size.W * 0.07;
    const avail = size.W * 0.5 - from - 6;
    notice.on = size.wide && avail >= 168;
    if (!notice.on) {
      if (notice.sharp) notice.sharp.visible = false;
      return;
    }
    const bw = Math.round(Math.min(196, avail - 14));
    // as tall as fits under the top of the screen (the turn brings its near edge up a little), on short posts
    const floorAt = -CLEARING.camY / t;
    const legs = 6;
    const bh = Math.round(Math.min(bw * 0.8, (size.H / 2 - 3) / 1.07 - floorAt - 7 - legs));
    const cx = from + Math.min(avail, bw + 12) / 2 + 2;
    const sel = forest.get().selected;
    const text = noticeText(sel);
    const key = [bw, bh, legs, sel, text.hover, text.press, document.fonts?.status].join();
    if (notice.key !== key) {
      notice.key = key;
      const sp = noticeSprite(bw, bh, legs, text);
      // the low pass keeps it only for its shadow; what you see is drawn in the sharp pass, where every texel
      // stays a crisp block however the board is turned, so the words on it read cleanly
      const mesh = layerMesh({ pix: sp.pix, ax: sp.ax, ay: sp.ay, d: NOTICE_D }, {}, false);
      mesh.matrixAutoUpdate = false;
      mesh.userData.hidden = true;
      const sharp = new THREE.Mesh(mesh.geometry, spriteMaterial(mesh.material.uniforms.map.value as THREE.Texture));
      sharp.matrixAutoUpdate = false;
      sharp.frustumCulled = false;
      if (notice.mesh) {
        scene.remove(notice.mesh);
        layers.splice(layers.indexOf(notice.mesh), 1);
        notice.mesh.geometry.dispose();
        (notice.mesh.material.uniforms.map.value as THREE.Texture).dispose();
      }
      if (notice.sharp) {
        boardScene.remove(notice.sharp);
        notice.sharp.material.dispose();
      }
      notice.mesh = add(mesh, 0, 0, notice.z, 'notice');
      notice.mesh.userData.born = -1;
      notice.sharp = sharp;
      boardScene.add(sharp);
      notice.sprite = sp;
    }
    const x = size.restX + cx * t;
    notice.mesh!.position.set(x, 0, notice.z);
    // turned to face you where you stand in the clearing
    notice.yaw = -Math.atan2(x - size.restX, NOTICE_D) * 0.62;
  }
  /** Where a pixel of the board's sprite is in the world, as the board stands now. */
  function onNotice(x: number, y: number, out: THREE.Vector3) {
    const sp = notice.sprite!;
    const t = texelAt(NOTICE_D);
    return out.set((x - sp.ax) * t, (sp.ay - y) * t, 0).applyMatrix4(notice.mesh!.matrix);
  }
  /** Bursts the board: cut as it stands (words and all), thrown out towards you, dust where it stood. */
  function breakNotice() {
    const sp = notice.sprite!;
    if (notice.shatter) {
      scene.remove(notice.shatter.mesh, notice.shatter.spray.points);
      notice.shatter.dispose();
    }
    const sh = new Shatter(sp.pix, cut(sp.pix, coarse ? 30 : 56, 97), coarse ? 320 : 900);
    scene.add(sh.mesh, sh.spray.points);
    notice.shatter = sh;
    const turn = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), notice.yaw);
    const from = onNotice(sp.pix.w / 2, sp.pix.h * 0.38, new THREE.Vector3());
    from.x -= Math.sin(notice.yaw) * 0.35;
    from.z -= Math.cos(notice.yaw) * 0.35;
    sh.burst(onNotice, texelAt(NOTICE_D), turn, from, 97);
    notice.state = 'broken';
    notice.shake = reduced ? 0 : 0.4;
  }
  /** A new board pulls itself out of the ground; the old pieces sink away. */
  function raiseNotice() {
    notice.state = 'rising';
    notice.rise = 0;
    notice.shatter?.sink();
    const sp = notice.sprite;
    if (sp && notice.shatter) {
      onNotice(0, sp.pix.h, noticeAt);
      onNotice(sp.pix.w, sp.pix.h, noticeAt2);
      notice.shatter.dirt(noticeAt.x, noticeAt2.x, notice.z + 0.1);
    }
  }
  function updateNotice(dt: number) {
    // follow the screen's layout (the clearing's rest point moves with it) and the picked disc
    buildNotice();
    const sh = notice.shatter;
    sh?.update(dt);
    if (sh && !notice.on) sh.mesh.visible = false;
    if (!notice.on || !notice.mesh || !notice.sprite) return;
    notice.shake = Math.max(0, notice.shake - dt);
    if (notice.state === 'standing' && ready && o.scroll() > stages.a + 6 && Math.abs(camera.position.z - CLEARING.camZ) < 3) breakNotice();
    if (notice.state === 'rising') {
      notice.rise = reduced ? 1 : Math.min(1, notice.rise + dt / 1.1);
      if (notice.rise >= 1) notice.state = 'standing';
    }
    // face the camera; while rising, come up out of the ground with a little overshoot
    const r = notice.state === 'rising' ? notice.rise : 1;
    const c1 = 1.70158;
    const e = 1 + (c1 + 1) * Math.pow(r - 1, 3) + c1 * Math.pow(r - 1, 2);
    const sink = (1 - e) * (notice.sprite.pix.h * texelAt(NOTICE_D) + 0.05);
    const m = notice.mesh;
    const x = m.position.x;
    noticeTilt.makeTranslation(x, -sink, notice.z);
    noticeTilt.multiply(tiltA.makeRotationY(notice.yaw));
    noticeTilt.multiply(tiltA.makeTranslation(-x, 0, -notice.z));
    m.updateMatrix();
    m.matrix.premultiply(noticeTilt);
    m.matrixWorldNeedsUpdate = true;
    // the sharp board, in the same place, fogged with distance and dimmed with the clearing's light
    const sharp = notice.sharp!;
    sharp.matrix.copy(m.matrix);
    sharp.matrixWorldNeedsUpdate = true;
    const dz = camera.position.z - notice.z;
    const su = sharp.material.uniforms;
    su.fogColor.value.copy(air.fog);
    su.fog.value = Math.min(1, 1 - Math.exp(-Math.max(0, dz - 5) * air.density * 1.6));
    su.opacity.value = Math.min(1, (dz - 0.05) * 3);
    su.shade.value = Math.min(1.05, air.ambient * 0.7 + 0.36);
    sharp.visible = notice.state !== 'broken' && dz > 0.05 && su.fog.value < 0.97;
    // the page's real links over the buttons painted on the paper
    const show = notice.state === 'standing' && Math.abs(camera.position.z - CLEARING.camZ) < 0.6;
    notice.sprite.links.forEach((l, i) => {
      onNotice(l.x, l.y + l.h, noticeAt);
      onNotice(l.x + l.w, l.y, noticeAt2);
      pin($(`[data-pin="work-link${i}"]`), Math.min(noticeAt.x, noticeAt2.x), Math.min(noticeAt.y, noticeAt2.y), Math.max(noticeAt.x, noticeAt2.x), Math.max(noticeAt.y, noticeAt2.y), (noticeAt.z + noticeAt2.z) / 2, show);
    });
  }
  const buttonEvent = (state: 'hover' | 'press' | null) => (ev: Event) => {
    const el = (ev.target as HTMLElement | null)?.closest?.('[data-pin]') as HTMLElement | null;
    if (!el?.dataset.pin) return;
    const id = el.dataset.pin;
    const next = state ?? undefined;
    if (buttonState[id] === next) return;
    if (next) buttonState[id] = next;
    else delete buttonState[id];
    if (boards.work) hangAll();
  };
  const onOver = buttonEvent('hover');
  const onOut = buttonEvent(null);
  const onDown = buttonEvent('press');
  document.addEventListener('pointerover', onOver);
  document.addEventListener('pointerout', onOut);
  document.addEventListener('pointerdown', onDown);
  document.addEventListener('pointerup', onOver);
  document.addEventListener('focusin', onOver);
  document.addEventListener('focusout', onOut);
  let paintedFor: number | null | undefined;
  forest.subscribe(() => {
    const sel = forest.get().selected;
    if (sel === paintedFor) return;
    paintedFor = sel;
    // picking a disc while the board lies in pieces brings a new one up; its words follow the disc either way
    if (notice.on && notice.state === 'broken' && sel !== null) raiseNotice();
    if (boards.work) hangAll();
  });

  function updateBoards() {
    for (const b of Object.values(boards)) {
      const k = perCss(b.d);
      const [x, y] = b.at();
      b.mesh.position.set(x, y, b.z);
      b.mesh.scale.set(b.art.w * k, b.art.h * k, 1);
      const dz = camera.position.z - b.z;
      b.mesh.visible = dz > 0.05;
      const u = b.mesh.material.uniforms;
      u.fogColor.value.copy(air.fog);
      u.fog.value = Math.min(1, 1 - Math.exp(-Math.max(0, dz - 5) * air.density * 1.6));
      u.opacity.value = Math.min(1, (dz - 0.05) * 3) * (1 - u.fog.value);
      b.mesh.visible = b.mesh.visible && u.fog.value < 0.97;
      // the page's real links ride on top of the painted ones
      for (const l of b.art.links) {
        const el = $(`[data-pin="${l.id}"]`);
        pin(el, x + l.x * k, y - (l.y + l.h) * k, x + (l.x + l.w) * k, y - l.y * k, b.z, b.mesh.visible && u.fog.value < 0.5);
      }
    }
  }

  // --- the writing on each floppy's label: sharp, lying on the disc, going wherever the disc goes -------------
  const labels: (THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial> | null)[] = [];
  let fontsIn = false;
  function labelTexture(title: string) {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 262;
    const g = c.getContext('2d')!;
    const fam = getComputedStyle(document.documentElement).getPropertyValue('--font-hand').trim() || 'cursive';
    // the biggest size at which the title fits on two lines
    let fs = 130;
    let lines: string[] = [title];
    for (; fs > 30; fs -= 4) {
      g.font = `600 ${fs}px ${fam}`;
      const words = title.split(' ');
      lines = [];
      let line = '';
      for (const w of words) {
        const t = line ? `${line} ${w}` : w;
        if (g.measureText(t).width > c.width * 0.92 && line) {
          lines.push(line);
          line = w;
        } else line = t;
      }
      lines.push(line);
      if (lines.length <= 2 && lines.every((l) => g.measureText(l).width <= c.width * 0.92) && lines.length * fs * 0.95 <= c.height * 0.9) break;
    }
    g.fillStyle = '#2c2a26';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const lh = fs * 0.95;
    lines.forEach((l, i) => g.fillText(l, c.width / 2, c.height / 2 + (i - (lines.length - 1) / 2) * lh));
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.NoColorSpace;
    tex.anisotropy = 8;
    renderer.initTexture(tex);
    return tex;
  }
  const lm = new THREE.Matrix4();
  function updateLabels() {
    if (!fontsIn) return;
    discs.forEach((d, i) => {
      if (!d) return;
      let mesh = labels[i];
      if (!mesh) {
        mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), boardMaterial(labelTexture(projects[i].title)));
        mesh.matrixAutoUpdate = false;
        mesh.frustumCulled = false;
        boardScene.add(mesh);
        labels[i] = mesh;
      }
      // where the label area of the floppy (u 0.13–0.87, v 0.58–0.96 in its own square) sits on the sprite
      const a = DISCS[i].a;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const sq = 0.62;
      const S = d.size;
      const W = 0.72 * S;
      const H = 0.36 * S;
      const L = 0.27 * S;
      const lx = -L * sa;
      const ly = d.h - (d.cy + L * ca * sq);
      lm.set(ca * W, sa * H, 0, lx, -sa * sq * W, ca * sq * H, 0, ly, 0, 0, 1, 0.003, 0, 0, 0, 1);
      d.mesh.updateMatrixWorld();
      mesh.matrix.multiplyMatrices(d.mesh.matrixWorld, lm);
      mesh.matrixWorldNeedsUpdate = true;
      mesh.visible = d.mesh.visible && d.t === 0 && camera.position.z - d.mesh.position.z > 0.05;
      const u = mesh.material.uniforms;
      const dz = camera.position.z - d.mesh.position.z;
      u.fogColor.value.copy(air.fog);
      u.fog.value = Math.min(1, 1 - Math.exp(-Math.max(0, dz - 5) * air.density * 1.6));
      u.opacity.value = 0.92;
    });
  }

  // --- sizing -----------------------------------------------------------------------------------------
  const size = { W: 1, H: 1, scale: 1, devW: 1, devH: 1, cssW: 1, cssH: 1, offX: 0, offY: 0, wide: true, restX: 0 };
  let walk = new THREE.CatmullRomCurve3([new THREE.Vector3(), new THREE.Vector3(0, 0, -1)]);
  let leave = new THREE.CatmullRomCurve3([new THREE.Vector3(), new THREE.Vector3(0, 0, -1)]);
  const stages = { a: 1, b: 2, c: 3 };

  function measure() {
    const work = document.querySelector<HTMLElement>('[data-stage="work"]');
    const vh = window.innerHeight;
    const max = document.documentElement.scrollHeight - vh;
    if (work) {
      stages.a = work.offsetTop;
      stages.b = work.offsetTop + work.offsetHeight - vh;
    }
    stages.c = Math.max(stages.b + 1, max);
  }

  function placeEdge() {
    // fixed per screen shape (not per width), so the snapshot shown while loading lines up exactly
    const tx = size.wide ? 2.6 : CORRIDOR + 0.23;
    if (keyed.edgeL) keyed.edgeL.position.x = -tx;
    if (keyed.edgeR) keyed.edgeR.position.x = tx;
  }

  /** Where the camera rests at the clearing, and where the discs go, for this screen shape. */
  function placeClearing() {
    const dComp = CLEARING.camZ - CLEARING.computer.z;
    size.restX = size.wide ? CLEARING.computer.x + 0.13 * size.W * dComp * K0 : CLEARING.computer.x;
    const compScreenX = (CLEARING.computer.x - size.restX) / (dComp * K0);
    // contact shade under the computer and the stump
    if (floor) {
      const cu = floor.material.uniforms.contacts.value as THREE.Vector4[];
      const wComp = COMPUTER.w * dComp * K0;
      cu[0].set(CLEARING.computer.x + 0.02, CLEARING.computer.z + 0.05, wComp * 0.52, 0.34);
      cu[2].set(CLEARING.exitX, HOLLOW.stumpZ + 0.1, 0.78, 0.3);
    }
    // the keyboard lies in front of the computer's left half, as it was drawn
    if (keyed.keyboard) keyed.keyboard.position.x = size.restX + (compScreenX - Math.round(22.5 * 1.9)) * KEYBOARD_D * K0;
    const margin = 34;
    const left = compScreenX - (-size.W / 2 + margin);
    const right = (size.wide ? size.W * 0.08 : size.W / 2 - margin) - compScreenX;
    const minDx = Math.min(...DISCS.map((s) => s.dx));
    const maxDx = Math.max(...DISCS.map((s) => s.dx));
    const fitL = Math.min(1, left / -minDx);
    const fitR = Math.min(1, right / maxDx);
    discs.forEach((disc, i) => {
      if (!disc) return;
      const s = DISCS[i];
      const dx = s.dx * (s.dx < 0 ? fitL : fitR);
      disc.rest.set(size.restX + (compScreenX + dx) * s.d * K0, 0, CLEARING.camZ - s.d);
    });
    if (dust) (dust.material as THREE.ShaderMaterial).uniforms.box.value.makeScale(2.4, 2.2, 1.2).setPosition(CLEARING.computer.x - 1.0, 0.05, CLEARING.computer.z - 0.4);
    const rest = new THREE.Vector3(size.restX, CLEARING.camY, CLEARING.camZ);
    walk = new THREE.CatmullRomCurve3(
      [new THREE.Vector3(HERO.x, HERO.y, HERO.z), new THREE.Vector3(0, 0.88, -9), new THREE.Vector3(0.04, 0.82, -24), new THREE.Vector3(0.08, 0.74, -40), new THREE.Vector3(size.restX * 0.5, 0.62, -56), rest],
      false,
      'centripetal',
    );
    leave = new THREE.CatmullRomCurve3(
      [rest, new THREE.Vector3(size.restX + 1.1, 0.52, -76), new THREE.Vector3(CLEARING.exitX, 0.58, CLEARING.backdropZ), new THREE.Vector3(CLEARING.exitX, 0.6, HOLLOW.frameZ), new THREE.Vector3(CLEARING.exitX, HOLLOW.camY, HOLLOW.camZ)],
      false,
      'centripetal',
    );
  }

  function resize(devW?: number, devH?: number) {
    const cssW = o.canvas.clientWidth || window.innerWidth;
    const cssH = o.canvas.clientHeight || window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    size.devW = devW ?? Math.round(cssW * dpr);
    size.devH = devH ?? Math.round(cssH * dpr);
    size.cssW = cssW;
    size.cssH = cssH;
    size.scale = Math.max(1, Math.round(Math.min(size.devW, size.devH) / SHORT_SIDE));
    size.W = Math.ceil(size.devW / size.scale);
    size.H = Math.ceil(size.devH / size.scale);
    size.offX = (size.W * size.scale - size.devW) / 2;
    size.offY = (size.H * size.scale - size.devH) / 2;
    size.wide = size.W / size.H > 1.15;
    renderer.setSize(size.devW, size.devH, false);
    main.setSize(size.W, size.H);
    fogged.setSize(size.W, size.H);
    mirrored.setSize(Math.ceil(size.W / 2), Math.ceil(size.H / 2));
    mirroredFog.setSize(Math.ceil(size.W / 2), Math.ceil(size.H / 2));
    floor?.material.uniforms.res.value.set(size.W, size.H);
    camera.aspect = size.W / size.H;
    camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan((size.H * K0) / 2));
    camera.updateProjectionMatrix();
    const u = blit.material.uniforms;
    u.lowRes.value.set(size.W, size.H);
    u.scale.value = size.scale;
    u.offset.value.set(Math.floor(size.offX), Math.floor(size.offY));
    fog.material.uniforms.res.value.set(size.W, size.H);
    (sky.material as THREE.ShaderMaterial).uniforms.res.value.set(size.W, size.H);
    placeEdge();
    placeClearing();
    measure();
    if (text) buildText();
    if (boards.work) hangAll();
  }

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // --- the drive ----------------------------------------------------------------------------------------
  let loaded: number | null = null;
  let bootAt = -1;
  const slot = new THREE.Vector3();
  function updateSlot() {
    const t = texelAt(CLEARING.camZ - CLEARING.computer.z);
    slot.set(CLEARING.computer.x + (COMPUTER.slot.x + COMPUTER.slot.w / 2 - COMPUTER.ax) * t, (COMPUTER.ay - COMPUTER.slot.y - 1) * t, CLEARING.computer.z + 0.02);
  }
  updateSlot();
  function move(i: number, to: number, now: number) {
    const d = discs[i];
    if (!d) return;
    d.from = d.t;
    d.to = to;
    d.start = now;
    d.dur = (reduced ? 0.2 : to > 0 ? 0.62 : 0.5) * Math.max(0.3, Math.abs(to - d.t));
  }
  function updateDrive(now: number) {
    const st = forest.get();
    const busy = discs.some((d) => d && d.t !== d.to);
    if (!busy && st.selected !== loaded) {
      if (loaded !== null && discs[loaded]?.t === 1) {
        move(loaded, 0, now);
        bootAt = -1;
        forest.set({ loaded: null });
        loaded = null;
      } else if (st.selected !== null && discs[st.selected]) {
        move(st.selected, 1, now);
        loaded = st.selected;
      }
    }
    discs.forEach((d, i) => {
      if (!d) return;
      if (d.t !== d.to) {
        const k = Math.min(1, (now - d.start) / d.dur);
        d.t = d.from + (d.to - d.from) * easeInOut(k);
        if (k >= 1) {
          d.t = d.to;
          if (d.to === 1) {
            bootAt = now;
            forest.set({ loaded: i });
          }
        }
      }
      const hover = st.hovered === i && d.t === 0 ? 1 : 0;
      d.lift += (hover - d.lift) * 0.25;
      const e = d.t;
      const tex = texelAt(DISCS[i].d);
      d.mesh.position.lerpVectors(d.rest, slot, e);
      d.mesh.position.y += Math.sin(Math.PI * e) * 0.2 + Math.round(d.lift * 3) * tex;
      const narrow = (COMPUTER.slot.w * texelAt(4) * 0.9) / d.w;
      d.mesh.scale.set(1 + (narrow - 1) * ease(e), 1 - 0.9 * smooth(0.55, 1, e), 1);
      d.mesh.visible = e < 0.999;
    });
  }

  let lastScreen = '';
  const dark = new Uint32Array(COMPUTER.screen.w * COMPUTER.screen.h).fill(PAL.computer.screen[1]);
  function updateScreen(now: number) {
    if (!screen.tex || !screen.pix) return;
    let key: string;
    let pix: Pix;
    if (bootAt < 0) {
      const on = Math.floor(now / 0.53) % 2 === 0;
      key = `idle${on}`;
      if (key === lastScreen) return;
      pix = screenIdle(on);
    } else {
      const k = Math.min(1, (now - bootAt) / 0.35);
      const steps = Math.floor(k * 13) / 13;
      key = `boot${steps}`;
      if (key === lastScreen) return;
      pix = screenPicture(dark, steps);
    }
    lastScreen = key;
    screen.pix.data.set(pix.data);
    screen.tex.needsUpdate = true;
  }

  // --- light and fog along the walk ---------------------------------------------------------------------
  const atmos = ATMOS.map((a) => ({ ...a, fogV: v3(a.fog), skyV: v3(a.sky), zenithV: v3(a.zenith) }));
  const air = { fog: new THREE.Vector3(), sky: new THREE.Vector3(), zenith: new THREE.Vector3(), clouds: 0, density: 0.03, falloff: 3, ambient: 0.9, shafts: 1, sun: 1 };
  function airAt(z: number) {
    let i = 0;
    while (i < atmos.length - 2 && z < atmos[i + 1].z) i++;
    const a = atmos[i];
    const b = atmos[i + 1];
    const t = clamp01((a.z - z) / (a.z - b.z));
    air.fog.lerpVectors(a.fogV, b.fogV, t);
    air.sky.lerpVectors(a.skyV, b.skyV, t);
    air.zenith.lerpVectors(a.zenithV, b.zenithV, t);
    air.clouds = a.clouds + (b.clouds - a.clouds) * t;
    air.density = a.density + (b.density - a.density) * t;
    air.falloff = a.falloff + (b.falloff - a.falloff) * t;
    air.ambient = a.ambient + (b.ambient - a.ambient) * t;
    air.shafts = a.shafts + (b.shafts - a.shafts) * t;
    air.sun = a.sun + (b.sun - a.sun) * t;
  }

  // --- pinning page elements to things in the forest ----------------------------------------------------
  const tmp = new THREE.Vector3();
  function toCss(v: THREE.Vector3): [number, number] {
    tmp.copy(v).project(camera);
    const xd = (tmp.x * 0.5 + 0.5) * size.W * size.scale - size.offX;
    const yd = (1 - (tmp.y * 0.5 + 0.5)) * size.H * size.scale - size.offY;
    return [(xd / size.devW) * size.cssW, (yd / size.devH) * size.cssH];
  }
  const a3 = new THREE.Vector3();
  const b3 = new THREE.Vector3();
  // what was last written to each pinned element, so the page is only touched when something changes
  const written = new WeakMap<HTMLElement, { show: boolean; t: string; w: string; h: string }>();
  function pin(el: HTMLElement | null, x0: number, y0: number, x1: number, y1: number, z: number, show: boolean) {
    if (!el) return null;
    let last = written.get(el);
    if (!last) {
      last = { show: !show, t: '', w: '', h: '' };
      written.set(el, last);
    }
    if (last.show !== show) {
      el.dataset.show = show ? 'true' : 'false';
      last.show = show;
    }
    if (!show) return null;
    const [ax, ay] = toCss(a3.set(x0, y1, z));
    const [bx, by] = toCss(b3.set(x1, y0, z));
    const t = `translate(${ax.toFixed(1)}px, ${ay.toFixed(1)}px)`;
    const w = `${(bx - ax).toFixed(1)}px`;
    const h = `${(by - ay).toFixed(1)}px`;
    if (t !== last.t) el.style.transform = last.t = t;
    if (w !== last.w) el.style.width = last.w = w;
    if (h !== last.h) el.style.height = last.h = h;
    return { w: bx - ax, h: by - ay };
  }
  const els = new Map<string, HTMLElement | null>();
  /** Page elements by selector, looked up once. */
  const $ = (sel: string) => {
    let el = els.get(sel);
    if (el === undefined || (el && !el.isConnected)) {
      el = document.querySelector<HTMLElement>(sel.startsWith('[') ? sel : `#${sel}`);
      els.set(sel, el);
    }
    return el;
  };

  function placePins(atClearing: boolean, near: boolean) {
    const st = forest.get();
    const layer = $('discs');
    const active = atClearing ? 'true' : 'false';
    if (layer && layer.dataset.active !== active) layer.dataset.active = active;
    discs.forEach((d, i) => {
      if (!d) return;
      const b = $(`[data-disc="${i}"]`);
      const p = d.mesh.position;
      const r = pin(b, p.x - d.w * 0.5 * d.mesh.scale.x, p.y, p.x + d.w * 0.5 * d.mesh.scale.x, p.y + d.h * d.mesh.scale.y, p.z, near && d.mesh.visible && p.z < camera.position.z - 0.3);
      if (b && r) {
        const moving = d.t > 0 ? 'true' : 'false';
        if (b.dataset.moving !== moving) b.dataset.moving = moving;
      }
    });
    // the monitor's glass, for the project video
    const t = texelAt(CLEARING.camZ - CLEARING.computer.z);
    const sc = COMPUTER.screen;
    const x0 = CLEARING.computer.x + (sc.x - COMPUTER.ax) * t;
    const y1 = (COMPUTER.ay - sc.y) * t;
    pin($('pin-screen'), x0, y1 - sc.h * t, x0 + sc.w * t, y1, CLEARING.computer.z + 0.01, atClearing && st.loaded !== null && bootAt >= 0 && clock - bootAt > 0.3);
  }

  // --- the loop -----------------------------------------------------------------------------------------
  let ready = false;
  const slowFrames: [number, number, number][] = [];
  let readyAt = 0;
  const timing = { start: Math.round(performance.now()), paint: [] as number[], paintedAt: 0, warmUp: 0, receive: [] as [string, number][] };
  Object.assign(window, { __slowFrames: slowFrames, __timing: timing });
  let raf = 0;
  const base = new THREE.Vector3();

  function cameraAt(s: number) {
    if (s <= stages.a) base.copy(walk.getPointAt(easeInOut(clamp01(s / stages.a))));
    else if (s <= stages.b) base.set(size.restX, CLEARING.camY, CLEARING.camZ);
    // out of the clearing it sets off at once, and slows only as it reaches the cat
    else base.copy(leave.getPointAt(easeAway(clamp01((s - stages.b) / (stages.c - stages.b)))));
    return base;
  }

  /**
   * The camera rides a soft spring behind the scroll. Come into the clearing fast and it sinks a little past
   * the rest and settles back, instead of stopping dead. What you see strays at most SPRING_REACH from the path.
   */
  const SPRING_REACH = 0.32;
  const spring = { x: new THREE.Vector3(), v: new THREE.Vector3(), live: false };
  const sprung = new THREE.Vector3();
  const off = new THREE.Vector3();
  function follow(target: THREE.Vector3, dt: number, jump: boolean) {
    if (!spring.live || jump || reduced) {
      spring.x.copy(target);
      spring.v.set(0, 0, 0);
      spring.live = true;
      return sprung.copy(target);
    }
    const w = 8.5;
    const damp = 0.55;
    const cap = SPRING_REACH * 2.5;
    const steps = Math.ceil(dt * 240);
    const h = dt / steps;
    for (let i = 0; i < steps; i++) {
      off.subVectors(spring.x, target);
      spring.v.addScaledVector(off, -w * w * h).addScaledVector(spring.v, -2 * damp * w * h);
      spring.x.addScaledVector(spring.v, h);
      // on a fast walk it simply trails at the cap, so an overshoot stays one soft bounce and never runs away
      off.subVectors(spring.x, target);
      const len = off.length();
      if (len > cap) {
        off.multiplyScalar(cap / len);
        spring.x.copy(target).add(off);
        const away = spring.v.dot(off) / cap;
        if (away > 0) spring.v.addScaledVector(off, -away / cap);
      }
    }
    off.subVectors(spring.x, target);
    const len = off.length();
    if (len > 1e-6) off.multiplyScalar((SPRING_REACH * Math.tanh(len / SPRING_REACH)) / len);
    return sprung.copy(target).add(off);
  }
  let lastScroll = NaN;

  // the shadow camera follows you, snapped to its own texels so shadows don't crawl
  const lf = new THREE.Vector3();
  const lr = new THREE.Vector3();
  const lu = new THREE.Vector3();
  const focus = new THREE.Vector3();
  const bias = new THREE.Matrix4().set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
  const lastFocus = new THREE.Vector3(Infinity, 0, 0);
  let shadowFrame = 0;
  function shadowPass() {
    lf.set(...SUN);
    lr.crossVectors(lf, new THREE.Vector3(0, 1, 0)).normalize();
    lu.crossVectors(lr, lf).normalize();
    focus.set(camera.position.x, 1.5, camera.position.z - 13);
    const texel = (2 * SHADOW_HALF) / SHADOW_SIZE;
    const fx = focus.dot(lr);
    const fy = focus.dot(lu);
    focus.addScaledVector(lr, Math.round(fx / texel) * texel - fx).addScaledVector(lu, Math.round(fy / texel) * texel - fy);
    shadowFrame++;
    if (focus.equals(lastFocus) && shadowFrame % 8 !== 0) return;
    lastFocus.copy(focus);
    sunCam.up.copy(lu);
    sunCam.position.copy(focus).addScaledVector(lf, -70);
    sunCam.lookAt(focus);
    sunCam.updateMatrixWorld();
    const hidden: LayerMesh[] = [];
    for (const m of layers) {
      if (m.userData.caster) m.material = m.userData.depth;
      else if (m.visible) {
        m.visible = false;
        hidden.push(m);
      }
    }
    sky.visible = false;
    if (floor) floor.visible = false;
    if (dust) dust.visible = false;
    led.visible = false;
    // the board's pieces and their spray read the shadow map, so they mustn't draw into it
    const sh = notice.shatter;
    const shards = sh?.mesh.visible ?? false;
    if (sh) sh.mesh.visible = sh.spray.points.visible = false;
    // the notice board is drawn in the sharp pass, but its shadow still falls in the forest
    const board = notice.mesh && notice.on && notice.state !== 'broken';
    if (board) notice.mesh!.visible = true;
    renderer.setRenderTarget(shadow);
    renderer.render(scene, sunCam);
    if (notice.mesh) notice.mesh.visible = false;
    for (const m of layers) m.material = m.userData.lit;
    for (const m of hidden) m.visible = true;
    if (sh) {
      sh.mesh.visible = shards;
      sh.spray.points.visible = true;
    }
    sky.visible = true;
    if (floor) floor.visible = true;
    if (dust) dust.visible = true;
    led.visible = true;
    light.shadowMatrix.value.copy(bias).multiply(sunCam.projectionMatrix).multiply(sunCam.matrixWorldInverse);
  }

  /** Renders the wood from under the floor (and fogs it), for the puddles to show. Skipped in the meadow. */
  function mirrorPass(now: number) {
    if (!floor) return;
    const fl = floor.material.uniforms;
    const wet = smooth(-8, -16, camera.position.z);
    fl.wet.value = wet;
    fl.time.value = now;
    const cz = camera.position.z;
    const cxp = camera.position.x;
    const ahead = PUDDLES.some(([px, pz]) => pz < cz - 0.3 && pz > cz - 24 && Math.abs(px - cxp) < 7);
    fl.wet.value = ahead ? wet : 0;
    if (wet <= 0 || !ahead) return;
    mirrorCam.copy(camera);
    mirrorCam.position.y = -camera.position.y;
    mirrorCam.updateMatrixWorld();
    mirrorCam.projectionMatrix.copy(camera.projectionMatrix);
    mirrorCam.projectionMatrixInverse.copy(camera.projectionMatrixInverse);
    floor.visible = false;
    if (flora) flora.visible = false;
    renderer.setRenderTarget(mirrored);
    renderer.render(scene, mirrorCam);
    floor.visible = true;
    if (flora) flora.visible = true;
    const mu = fogMirror.material.uniforms;
    const fu = fog.material.uniforms;
    for (const k of ['fogColor', 'camPos', 'projInv', 'viewInv'] as const) mu[k].value.copy(fu[k].value);
    for (const k of ['density', 'falloff', 'shafts'] as const) mu[k].value = fu[k].value;
    mu.res.value.set(Math.ceil(size.W / 2), Math.ceil(size.H / 2));
    mu.camPos.value.copy(mirrorCam.position);
    mu.viewInv.value.copy(mirrorCam.matrixWorld);
    renderer.setRenderTarget(mirroredFog);
    renderer.render(mirrorFogScene, postCam);
  }

  function tick() {
    raf = requestAnimationFrame(tick);
    const now = forestNow();
    const rawDt = now - clock;
    if (ready && rawDt > 0.03) slowFrames.push([Math.round(rawDt * 1000), +camera.position.z.toFixed(1), Math.round((now - readyAt) * 1000)]);
    const dt = Math.min(0.05, rawDt);
    clock = now;

    const s = o.scroll();
    const target = cameraAt(s);
    const atClearing = Math.abs(target.z - CLEARING.camZ) < 0.6;
    // walking down into the clearing, the rest of the flick is caught there (never on the way back)
    const from = lastScroll;
    lastScroll = s;
    if (ready && o.hold && from < stages.a && s >= stages.a && o.hold(stages.a)) lastScroll = stages.a;
    const at = follow(target, dt, !(Math.abs(s - from) < window.innerHeight * 1.5));
    // the board bursting gives the view a short, dying jolt
    if (notice.shake > 0) {
      const k = (notice.shake / 0.4) ** 2 * 0.035;
      at.x += (Math.random() - 0.5) * k;
      at.y += (Math.random() - 0.5) * k;
    }

    camera.position.copy(at);
    camera.updateMatrixWorld();
    const arrival = arrivals.shift();
    if (arrival) receive(arrival);
    else if (warmAfter) {
      warmAfter = false;
      warmUp();
    }

    airAt(at.z);
    light.ambient.value.setScalar(air.ambient);
    light.sunColor.value.set(1, 0.94, 0.76).multiplyScalar(air.sun);
    const on = loaded !== null && discs[loaded]?.t === 1;
    light.lampPos.value.set(slot.x - 0.1, 0.45, CLEARING.computer.z + 0.25, on ? 0.55 : 0.14);
    light.lampColor.value.set(0.55, 0.78, 0.62);
    (led.material as THREE.MeshBasicMaterial).color.setHex(on ? (Math.floor(now / 0.09) % 7 === 0 ? 0x2f6b2c : 0x6fcf4e) : 0x1f241d);
    const fu = fog.material.uniforms;
    fu.fogColor.value.copy(air.fog);
    fu.density.value = air.density;
    fu.falloff.value = air.falloff;
    fu.shafts.value = air.shafts;
    fu.camPos.value.copy(camera.position);
    fu.projInv.value.copy(camera.projectionMatrixInverse);
    fu.viewInv.value.copy(camera.matrixWorld);
    const su = (sky.material as THREE.ShaderMaterial).uniforms;
    su.mid.value.copy(air.sky);
    su.edge.value.copy(air.zenith);
    su.cover.value = air.clouds;
    su.time.value = now;

    for (const m of layers) {
      // the hollow only shows once you've left the clearing: from the walk its tall wall stood over the wood
      const hollow = m.userData.hollow === true && camera.position.z > CLEARING.camZ - 0.8;
      m.visible = !hollow && !m.userData.hidden && (m.userData.always === true || camera.position.z - m.position.z > 0.02);
      m.material.uniforms.appear.value = m.userData.born < 0 ? 1 : clamp01((now - m.userData.born) / 0.5);
    }

    updateDrive(now);
    updateScreen(now);
    updateCritters(dt, now);
    updateNotice(dt);
    if (dust) (dust.material as THREE.ShaderMaterial).uniforms.time.value = now;
    if (cat.mesh && cat.open && cat.shut) {
      const cycle = now % 4.2;
      cat.mesh.material.uniforms.map.value = cycle > 4.02 || (cycle > 3.78 && cycle < 3.9) ? cat.shut : cat.open;
    }
    placePins(atClearing, at.z < -40 && at.z > -78);

    shadowPass();
    mirrorPass(now);
    renderer.setRenderTarget(main);
    renderer.render(scene, camera);
    renderer.setRenderTarget(fogged);
    renderer.render(fogScene, postCam);
    renderer.setRenderTarget(null);
    renderer.render(blitScene, postCam);
    // the words, sharp, over the pixels, through the same camera and the same crop
    updateBoards();
    updateLabels();
    boardCam.fov = camera.fov;
    boardCam.aspect = camera.aspect;
    boardCam.near = camera.near;
    boardCam.far = camera.far;
    boardCam.setViewOffset(size.W * size.scale, size.H * size.scale, Math.floor(size.offX), Math.floor(size.offY), size.devW, size.devH);
    boardCam.position.copy(camera.position);
    boardCam.updateMatrixWorld();
    renderer.autoClear = false;
    renderer.render(boardScene, boardCam);
    renderer.autoClear = true;
  }

  // the loading screen stays until the whole wood is painted, uploaded and compiled, so the first scroll is smooth
  const doneGroups = new Set<number>();
  const arrivals: Painted[] = [];
  let warmAfter = false;
  function tryReady() {
    // the meadow's two painters are enough: the clearing and the hollow finish behind the first view
    const hero = doneGroups.has(0) && doneGroups.has(1);
    if (!ready && hero && planted && (text || textGaveUp) && (boards.work || notice.mesh || textGaveUp)) markReady();
  }

  /** Compiles every shader and allocates every render target up front, so scrolling never waits on the GPU. */
  function warmUp() {
    updateLabels();
    renderer.compile(scene, camera);
    renderer.compile(fogScene, postCam);
    renderer.compile(mirrorFogScene, postCam);
    renderer.compile(boardScene, boardCam);
    for (const t of [mirrored, mirroredFog]) {
      renderer.setRenderTarget(t);
      renderer.clear();
    }
    renderer.setRenderTarget(null);
  }

  function markReady() {
    if (ready) return;
    ready = true;
    document.documentElement.style.setProperty('--load', '1');
    readyAt = forestNow();
    o.onReady();
  }

  // the worker paints; meanwhile the page is already there
  // the painters started when this module loaded; take everything they've sent so far, then the rest as it comes
  const handle = (msg: PainterMsg) => {
    if (msg.key === 'failed') {
      document.documentElement.dataset.forest = 'failed';
      return;
    }
    if (msg.key === 'done') {
      const done = msg as { group: number; times: number[] };
      timing.paint.push(...done.times);
      timing.paintedAt = Math.round(performance.now());
      doneGroups.add(done.group);
      if (ready) {
        warmAfter = true;
        return;
      }
      const t = performance.now();
      warmUp();
      timing.warmUp = Math.round(performance.now() - t);
      tryReady();
      return;
    }
    // before the first view everything is taken at once (the loading screen hides it); after that,
    // one piece per frame, so handing pictures to the GPU never stalls a frame
    if (ready) {
      arrivals.push(msg as Painted);
      return;
    }
    const t = performance.now();
    receive(msg as Painted);
    timing.receive.push([msg.key, Math.round(performance.now() - t)]);
  };
  painterInbox.listener = handle;
  painterInbox.all.forEach(handle);

  const fontWait = setTimeout(() => {
    textGaveUp = true;
    if (!text) buildText();
    tryReady();
  }, 900);
  // a disposed forest must never touch the GL context again: the next one shares it (strict mode builds the
  // forest twice), and a stray upload changes GL state behind the new renderer's back (it flipped the name)
  let disposed = false;
  (document.fonts?.ready ?? Promise.resolve()).then(() => {
    if (disposed) return;
    clearTimeout(fontWait);
    buildText();
    hangAll();
    fontsIn = true;
    if (doneGroups.size) warmUp();
    tryReady();
  });

  const ro = new ResizeObserver((entries) => {
    const box = entries[0].devicePixelContentBoxSize?.[0];
    if (box) resize(box.inlineSize, box.blockSize);
    else resize();
  });
  try {
    ro.observe(o.canvas, { box: 'device-pixel-content-box' });
  } catch {
    ro.observe(o.canvas);
  }
  const onLayout = () => measure();
  window.addEventListener('resize', onLayout);
  resize();
  tick();
  if (process.env.NODE_ENV !== 'production') Object.assign(window, { __forest: { camera, stages, size, scene, layers, fog: fog.material.uniforms, light, atmos, renderer, main, fogged } });

  return {
    measure,
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      clearTimeout(fontWait);
      painterInbox.listener = null;
      ro.disconnect();
      window.removeEventListener('resize', onLayout);
      document.removeEventListener('pointerover', onOver);
      document.removeEventListener('pointerout', onOut);
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('pointerup', onOver);
      document.removeEventListener('focusin', onOver);
      document.removeEventListener('focusout', onOut);
      scene.traverse((obj) => {
        const m = obj as THREE.Mesh;
        m.geometry?.dispose();
        const mat = m.material as THREE.ShaderMaterial | undefined;
        (mat?.uniforms?.map?.value as THREE.Texture | undefined)?.dispose();
        mat?.dispose?.();
      });
      main.dispose();
      fogged.dispose();
      mirrored.dispose();
      mirroredFog.dispose();
      shadow.dispose();
      renderer.dispose();
    },
  };
}
