import * as THREE from 'three';
import { projects } from '@/content/projects';
import { garland } from './art/garland';
import { reedSprites } from './art/gear';
import { CAT_SIZE, COMPUTER, KEYBOARD, noticeSprite, PAW_W, PILL_AT, pictureToScreen, screenIdle, screenPicture, type Notice, type NoticeText } from './art/props';
import { cut, Shatter } from './shatter';
import { atlas, CRITTERS, FLORA, TUFT_KINDS } from './art/sprites';
import { BEECH_BARK, BIRCH_BARK, TREE_D, TREE_SET, type TreeKind } from './art/trees';
import type { Painted } from './art/worker';
import { ATMOS, CLEARING, CORRIDOR, DISC_WORLD, DISCS, EDGE_Z, FRAMES, HERO, HOLLOW, K0, PUDDLES, ROOF, SHORT_SIDE, SUN, texelAt } from './config';
import { blitMesh, depthMaterial, floorMesh, fogMesh, layerMesh, light, meshFor, motes, quadFor, skyMesh, solidMesh, fixFacing, toTexture, view, type LayerMesh } from './gl';
import { Gun } from './gun';
import { Controls, Hud, Puffs, RIPPLES, scopePass, waterMesh } from './play';
import { Bake, barkTexture, cardGeometry, clumpSprites, crownCards, extrude, floppyTexture, keysTexture, ringsTexture, stumpGeometry, trunkGeometry, type Card } from './solid';
import { BOUNDS, critterSpots, EYE, extraTrees, GLADE, inBounds, LAKE, POND, RIVER, RIVER_W, SPAWN, waterDist } from './world';
import { PAL } from './palette';
import { hash2, hex, mix, mulberry, noise1, Pix, ramp, rgbOf, shade } from './pix';
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
  type Critter = {
    mesh: LayerMesh; kind: number; home: THREE.Vector2; origin: THREE.Vector2; x: number; z: number; y: number; dir: number;
    /** pill mode: which way it heads (radians in the x-z plane), a bird's time aloft, seconds until it's back after a hit */
    head: number; fly: number; dead: number; w: number; box: number; rect: number; flip: boolean;
    state: 'idle' | 'move'; t: number; phase: number; flee: number;
  };
  const critters: Critter[] = [];
  let critterAtlas: { rects: { x: number; y: number; w: number; h: number }[]; index: number[][]; w: number; h: number } | null = null;
  let dust: THREE.Points | null = null;
  let flora: LayerMesh | null = null;
  type Art = { pix: Pix; rects: { x: number; y: number; w: number; h: number }[]; tex: THREE.Texture };
  let floraArt: Art | null = null;
  let stumpArt: { pix: Pix; ax: number; ay: number; d: number; tex: THREE.Texture } | null = null;
  const paw = { mesh: null as LayerMesh | null, tex: [] as THREE.Texture[] };
  let computerPix: Pix | null = null;
  let critterPix: Pix | null = null;
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
        critterPix = pix;
        spawnCritters(toTexture(pix, { mips: false }));
        break;
      }
      case 'backdrop':
        add(layerMesh(l, { side: 3000 }), 0, 0, CLEARING.backdropZ);
        break;
      case 'computer': {
        computerPix = pix;
        const d = CLEARING.camZ - CLEARING.computer.z;
        add(layerMesh({ pix, ax: COMPUTER.ax, ay: COMPUTER.ay, d }, {}, false), CLEARING.computer.x, 0, CLEARING.computer.z, 'computer');
        const s = screenIdle(true);
        const sm = layerMesh({ pix: s, ax: COMPUTER.ax - COMPUTER.screen.x, ay: COMPUTER.ay - COMPUTER.screen.y, d }, {}, false, 0);
        sm.userData.caster = false;
        // the glass stays on the computer's face when you walk round it in pill mode
        fixFacing(sm);
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
        // its band of ferns runs out far to the sides for the walk's view; pill mode stands the stump alone
        st.userData.walkOnly = true;
        stumpArt = { pix, ax: m.ax, ay: m.ay, d: m.d, tex: st.material.uniforms.map.value as THREE.Texture };
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
      case 'catPaw0':
      case 'catPaw1': {
        paw.tex[m.key === 'catPaw0' ? 0 : 1] = toTexture(pix, { mips: false });
        if (!paw.mesh && cat.mesh) {
          const d = HOLLOW.camZ - HOLLOW.stumpZ;
          const pm = meshFor(quadFor(PAW_W, pix.h, CAT_SIZE.w / 2, pix.h, d), paw.tex[0] ?? paw.tex[1], 0.45, false);
          paw.mesh = add(pm, cat.mesh.position.x, cat.mesh.position.y, HOLLOW.stumpZ + 0.012);
          Object.assign(paw.mesh.userData, { hollow: true, hidden: true, offPlay: true });
        }
        break;
      }
      case 'hollowWall': {
        // the heart of the swirl sits behind the cat
        const d = HOLLOW.camZ - HOLLOW.wallZ;
        const wall = add(layerMesh(l, { side: 600 }), CLEARING.exitX, HOLLOW.camY + 30 * d * K0, HOLLOW.wallZ);
        wall.userData.hollow = true;
        wall.userData.walkOnly = true;
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
    // each spot takes one of its kind's sprites
    for (const sp of spots) {
      const options = treeTex.map((tt, i) => (tt.kind === sp.kind ? i : -1)).filter((i) => i >= 0);
      const gi = options[Math.floor(rnd() * options.length)];
      walkTrees.push({ ...sp, gi, flip: rnd() < 0.5 });
    }
    for (const m of batchTrees(walkTrees)) m.userData.walkOnly = true;
    planted = true;
  }
  type Planted = { kind: TreeKind | 'bush'; gi: number; x: number; z: number; s: number; flip: boolean };
  const walkTrees: Planted[] = [];
  /** One batch per painted sprite. In pill mode each tree turns round its own foot to face you. */
  function batchTrees(list: Planted[]) {
    const t = texelAt(TREE_D);
    const groups = treeTex.map(() => ({ pos: [] as number[], uv: [] as number[], idx: [] as number[], anchor: [] as number[] }));
    for (const sp of list) {
      const tt = treeTex[sp.gi];
      const g = groups[sp.gi];
      const k = t * sp.s;
      const x0 = sp.x - tt.ax * k;
      const x1 = sp.x + (tt.pix.w - tt.ax) * k;
      const y1 = (tt.ay + 1) * k;
      const n = g.pos.length / 3;
      g.pos.push(x0, y1, sp.z, x1, y1, sp.z, x0, 0, sp.z, x1, 0, sp.z);
      for (let a = 0; a < 4; a++) g.anchor.push(sp.x, 0, sp.z);
      const flip = sp.flip;
      const v1 = (tt.ay + 1) / tt.pix.h;
      g.uv.push(flip ? 1 : 0, 0, flip ? 0 : 1, 0, flip ? 1 : 0, v1, flip ? 0 : 1, v1);
      g.idx.push(n, n + 2, n + 1, n + 2, n + 3, n + 1);
    }
    const out: LayerMesh[] = [];
    groups.forEach((g, i) => {
      if (!g.idx.length) return;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(g.pos, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(g.uv, 2));
      geo.setAttribute('anchor', new THREE.Float32BufferAttribute(g.anchor, 3));
      geo.setIndex(g.idx);
      const mesh = add(meshFor(geo, treeTex[i].tex), 0, 0, 0);
      mesh.userData.always = true;
      out.push(mesh);
    });
    return out;
  }

  // --- flowers and mushrooms, all in one mesh --------------------------------------------------------
  function scatterFlora(pix: Pix, rects: { x: number; y: number; w: number; h: number }[]) {
    const rnd = mulberry(77);
    const t = texelAt(FLORA_D);
    const pos: number[] = [];
    const uv: number[] = [];
    const idx: number[] = [];
    const anchor: number[] = [];
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
      for (let a = 0; a < 4; a++) anchor.push(x, 0, z);
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
    g.setAttribute('anchor', new THREE.Float32BufferAttribute(anchor, 3));
    g.setIndex(idx);
    const ftex = toTexture(pix, { mips: true });
    floraArt = { pix, rects, tex: ftex };
    flora = add(meshFor(g, ftex), 0, 0, 0);
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
    critterTex = tex;
    for (const [kind, x, z] of homes) makeCritter(kind, x, z, rnd);
  }
  let critterTex: THREE.Texture | null = null;
  function makeCritter(kind: number, x: number, z: number, rnd: () => number) {
    const frames = critterAtlas!.index[kind];
    const r0 = critterAtlas!.rects[frames[0]];
    const boxH = Math.max(...frames.map((f) => critterAtlas!.rects[f].h));
    const mesh = meshFor(quadFor(r0.w, boxH, r0.w / 2, boxH, CRITTER_D), critterTex!);
    mesh.userData.boxH = boxH;
    add(mesh, x, 0, z);
    const c: Critter = {
      mesh, kind, home: new THREE.Vector2(x, z), origin: new THREE.Vector2(x, z), x, z, y: 0,
      dir: rnd() < 0.5 ? -1 : 1, state: 'idle', t: rnd() * 2, phase: rnd() * 10, flee: 0,
      head: Math.random() * Math.PI * 2, fly: 0, dead: 0, w: r0.w, box: boxH, rect: frames[0], flip: false,
    };
    critters.push(c);
    return c;
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
    // computer; on other wide screens they float high on the right, over the canopy. On phones and tall windows
    // only the project's links show, as buttons at the bottom of the page
    buildNotice();
    if (notice.on || !size.wide) {
      if (boards.work) {
        boardScene.remove(boards.work.mesh);
        (boards.work.mesh.material.uniforms.map.value as THREE.Texture).dispose();
        delete boards.work;
      }
      return;
    }
    const wd = 4.6;
    const ww = Math.min(470, size.cssW * 0.34);
    const base = Math.min(1, Math.max(0.68, size.cssW / 760));
    hang('work', (fit) => workParas(base * fit), ww, wd, CLEARING.camZ - wd, () => {
      const k = perCss(wd);
      // high on the right, so the links never sit behind a disc
      return [size.restX + size.W * 0.1 * wd * K0 - 60 * k, CLEARING.camY + size.H * 0.3 * wd * K0 + 60 * k];
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
    // pill mode always has the board standing in the clearing, to read and to shoot
    const was = notice.on;
    notice.on = playing || (size.wide && avail >= 168);
    if (!notice.on) {
      if (notice.sharp) notice.sharp.visible = false;
      // the page's links over its buttons go with it
      if (was) for (const el of document.querySelectorAll<HTMLElement>('[data-pin^="work-link"]')) pin(el, 0, 0, 0, 0, 0, false);
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
    fixFacing(sh.mesh);
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
    if (!playing && notice.state === 'standing' && ready && o.scroll() > stages.a + 6 && Math.abs(camera.position.z - CLEARING.camZ) < 3) breakNotice();
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
  const pressedAt: Record<string, number> = {};
  const buttonEvent = (state: 'hover' | 'press' | null) => (ev: Event) => {
    const el = (ev.target as HTMLElement | null)?.closest?.('[data-pin]') as HTMLElement | null;
    if (!el?.dataset.pin) return;
    const id = el.dataset.pin;
    const apply = () => {
      if (disposed) return;
      const next = state ?? undefined;
      if (buttonState[id] === next) return;
      if (next) buttonState[id] = next;
      else delete buttonState[id];
      if (next === 'press') pressedAt[id] = performance.now();
      // the socials hang on their own board even where the work's words are on the notice board
      if (boards.socials) hangAll();
    };
    // a quick click still shows the button going down: it stays pressed a moment, however short the click
    const held = performance.now() - (pressedAt[id] ?? -1e9);
    if (buttonState[id] === 'press' && state !== 'press' && held < 160) setTimeout(apply, 160 - held);
    else apply();
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
    // the clearing's stay is measured in the page's own screens (svh, the sticky's height): innerHeight grows as a
    // phone's address bar slides away, and that made the stay vanish, so the walk ran straight on past the computer
    const screen = work?.querySelector<HTMLElement>('.work-stick')?.offsetHeight || window.innerHeight;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    if (work) {
      stages.a = work.offsetTop;
      stages.b = work.offsetTop + work.offsetHeight - screen;
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
    if (boards.socials) hangAll();
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
      d.mesh.visible = e < 0.999 && !playing;
    });
  }

  let lastScreen = '';
  /** The projects' little screen pictures, for the monitor in pill mode. */
  const shots: Uint32Array[] = [];
  function screenShot(i: number) {
    if (!shots[i]) {
      shots[i] = dark;
      const img = new Image();
      img.onload = () => {
        shots[i] = pictureToScreen(img);
        lastScreen = '';
      };
      img.src = `/screens/${projects[i].slug}.png`;
    }
    return shots[i];
  }
  const dark = new Uint32Array(COMPUTER.screen.w * COMPUTER.screen.h).fill(PAL.computer.screen[1]);
  function updateScreen(now: number) {
    if (!screen.tex || !screen.pix || screenBroken) return;
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
      const shot = playing && loaded !== null ? screenShot(loaded) : dark;
      key = `boot${steps}${shot === dark ? '' : loaded}`;
      if (key === lastScreen) return;
      pix = screenPicture(shot, steps);
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
    // on phones and tall windows, the picked project's links wait at the bottom of the screen
    const bar = $('work-bar');
    const barOn = atClearing && !size.wide && st.selected !== null ? 'true' : 'false';
    if (bar && bar.dataset.show !== barOn) bar.dataset.show = barOn;
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

  // --- the cat's pill ------------------------------------------------------------------------------------
  /**
   * A second after you sit down by the cat, she holds out a paw with a pill on it; a line of words over it and
   * a Take button under it are the page's own, pinned to the paw.
   */
  const offer = { t: 0 };
  function updateOffer(dt: number, s: number, at: THREE.Vector3) {
    // she has it ready as you come down to her, not after you've sat a while
    const there = ready && !trans && s >= stages.c - window.innerHeight * 0.35 && at.z < HOLLOW.camZ + 2.5;
    offer.t = there ? offer.t + dt : 0;
    const frame = offer.t < 0.15 ? -1 : offer.t < 0.3 ? 0 : 1;
    if (paw.mesh) {
      paw.mesh.userData.hidden = frame < 0;
      const tex = paw.tex[Math.max(0, frame)];
      if (tex) paw.mesh.material.uniforms.map.value = tex;
    }
    const show = frame === 1 && offer.t > 0.45 && !!paw.mesh;
    const t = texelAt(HOLLOW.camZ - HOLLOW.stumpZ);
    const p = paw.mesh?.position;
    const px = (p?.x ?? 0) + (PILL_AT.x - CAT_SIZE.w / 2) * t;
    const py = (p?.y ?? 0) + (CAT_SIZE.h - PILL_AT.y) * t;
    pinPoint($('pill-say'), px - 2.5 * t, py + 3 * t, p?.z ?? 0, show);
    pinPoint($('pill-take'), px - 2.5 * t, py - 7 * t, p?.z ?? 0, show);
  }
  /** Moves a page element so its anchor sits on a point in the forest (its own CSS places it round that point). */
  function pinPoint(el: HTMLElement | null, x: number, y: number, z: number, show: boolean) {
    if (!el) return;
    let last = written.get(el);
    if (!last) {
      last = { show: !show, t: '', w: '', h: '' };
      written.set(el, last);
    }
    if (last.show !== show) {
      el.dataset.show = show ? 'true' : 'false';
      last.show = show;
    }
    if (!show) return;
    const [ax, ay] = toCss(a3.set(x, y, z));
    const tr = `translate(${ax.toFixed(1)}px, ${ay.toFixed(1)}px)`;
    if (tr !== last.t) el.style.transform = last.t = tr;
  }

  // --- pill mode: walking about in the wood ------------------------------------------------------------
  /**
   * You wake at the edge of the wood where the walk began, and can go anywhere inside an invisible fence.
   * Built the way the old 2.5D shooters were: the camera only ever turns about the upright, every sprite turns
   * with it (so nothing goes paper thin), looking up and down shears the picture instead of tilting it (so the
   * trees stay upright), and the rifle and counter are drawn in the same game pixels as the wood.
   */
  let playing = false;
  let paused = false;
  let tiltPx = 0;
  let score = 0;
  const P = { x: SPAWN.x, z: SPAWN.z, y: 0, vy: 0, vx: 0, vz: 0, yaw: 0, pitch: 0, kick: 0, step: 0, walk: 0, cool: 0 };
  const eye = new THREE.Vector3();
  const tv = new THREE.Vector3();
  let controls: Controls | null = null;
  let hud: Hud | null = null;
  let puffs: Puffs | null = null;
  let water: ReturnType<typeof waterMesh> | null = null;
  /** Pill mode's ground cover and water: not in the puddles' mirrored view. */
  const playHide: THREE.Object3D[] = [];
  const lids: THREE.Mesh[] = [];
  let playBuilt = false;
  let shardsShown = false;
  type Solid = { x: number; z: number; r: number };
  let solids: Solid[] = [];
  const grid = new Map<number, Solid[]>();
  const cellKey = (i: number, j: number) => (i + 1000) * 4000 + j + 2000;
  function nearSolids(x: number, z: number) {
    const out: Solid[] = [];
    const i0 = Math.floor(x / 2);
    const j0 = Math.floor(z / 2);
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) out.push(...(grid.get(cellKey(i0 + i, j0 + j)) ?? []));
    return out;
  }
  /** How far along a flat ray (x, z) → (fx, fz) the first trunk is, or null if none within max. */
  function firstSolid(x: number, z: number, fx: number, fz: number, max: number) {
    let best = Infinity;
    for (const so of solids) {
      const ox = so.x - x;
      const oz = so.z - z;
      const t = ox * fx + oz * fz;
      if (t < 0 || t - so.r > max) continue;
      const qx = ox - fx * t;
      const qz = oz - fz * t;
      const d2 = qx * qx + qz * qz;
      if (d2 > so.r * so.r) continue;
      best = Math.min(best, t - Math.sqrt(so.r * so.r - d2));
    }
    return best <= max ? best : null;
  }

  /** Sprites from an atlas, one quad each standing on the floor, all in one mesh. */
  function spriteBatch(art: Art, d: number, items: [number, number, number][]) {
    const t = texelAt(d);
    const pos: number[] = [];
    const uv: number[] = [];
    const idx: number[] = [];
    const anchor: number[] = [];
    for (const [kind, x, z] of items) {
      const r = art.rects[kind];
      const w = r.w * t;
      const h = r.h * t;
      const n = pos.length / 3;
      pos.push(x - w / 2, h, z, x + w / 2, h, z, x - w / 2, 0, z, x + w / 2, 0, z);
      const u0 = r.x / art.pix.w;
      const u1 = (r.x + r.w) / art.pix.w;
      const v0 = r.y / art.pix.h;
      const v1 = (r.y + r.h) / art.pix.h;
      uv.push(u0, v0, u1, v0, u0, v1, u1, v1);
      idx.push(n, n + 2, n + 1, n + 2, n + 3, n + 1);
      for (let a = 0; a < 4; a++) anchor.push(x, 0, z);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setAttribute('anchor', new THREE.Float32BufferAttribute(anchor, 3));
    g.setIndex(idx);
    const m = add(meshFor(g, art.tex, 1, false), 0, 0, 0);
    Object.assign(m.userData, { always: true, playOnly: true });
    playHide.push(m);
    return m;
  }

  /** Grass over all the ground the walk never covered, wildflowers round the lake, mushrooms in the wood. */
  function playFlora() {
    const rnd = mulberry(1717);
    const items: [number, number, number][] = [];
    const pick = (a: number, b: number, t: number) => (rnd() < t ? b : a);
    const zone = (z: number) =>
      z > -6 ? 0 : z > -30 ? pick(0, 1, (-6 - z) / 24) : z > -58 ? pick(1, 2, (-30 - z) / 28) : z > -68 ? pick(2, 3, (-58 - z) / 10) : z > -79 ? 3 : z > -90 ? pick(3, 4, (-79 - z) / 11) : 4;
    for (let i = 0; i < 26000; i++) {
      const x = -34 + rnd() * 70;
      const z = -114 + rnd() * 162;
      if (x > -7 && x < 11 && z < -0.3 && z > -107.3) continue;
      if (waterDist(x, z) < 0.12) continue;
      items.push([FLORA.length + zone(z) * TUFT_KINDS + Math.floor(rnd() * TUFT_KINDS), x, z]);
    }
    const patch = (cx: number, cz: number, n: number, kinds: number[], r: number) => {
      for (let k = 0; k < n; k++) {
        const rr = Math.pow(rnd(), 0.7) * r;
        const a = rnd() * Math.PI * 2;
        const x = cx + Math.cos(a) * rr;
        const z = cz + Math.sin(a) * rr * 0.7;
        if (waterDist(x, z) > 0.2) items.push([kinds[Math.floor(rnd() * kinds.length)], x, z]);
      }
    };
    const meadow = [0, 1, 2, 2, 3, 4, 5, 5, 0, 1];
    const wood = [6, 7, 8, 8, 6, 3, 3, 0, 5, 2, 4, 7, 1];
    for (let i = 0; i < 170; i++) {
      const a = rnd() * Math.PI * 2;
      const r = Math.sqrt(rnd()) * 0.95;
      patch(GLADE.x + Math.cos(a) * r * GLADE.rx, GLADE.z + Math.sin(a) * r * GLADE.rz, 5 + Math.floor(rnd() * 9), meadow, 0.45);
    }
    for (let i = 0; i < 320; i++) {
      const x = BOUNDS.x0 + rnd() * (BOUNDS.x1 - BOUNDS.x0);
      const z = -8 - rnd() * 100;
      if (x > -5 && x < 9) continue;
      const k = wood[Math.floor(rnd() * wood.length)];
      patch(x, z, 4 + Math.floor(rnd() * 8), [k, k, k, k, wood[Math.floor(rnd() * wood.length)]], 0.25);
    }
    // a fairy ring of toadstools in the dark beside the pond
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      items.push([i % 3 ? 6 : 7, 11.2 + Math.cos(a) * 1.15, -51 + Math.sin(a) * 0.9]);
    }
    return items;
  }

  /** Reeds along every bank, in clumps; the lake's near shore is left mostly open so you see the water. */
  function reedSpots() {
    const rnd = mulberry(2323);
    const out: [number, number, number][] = [];
    const clump = (x: number, z: number) => {
      const n = 1 + Math.floor(rnd() * 3);
      for (let k = 0; k < n; k++) out.push([Math.floor(rnd() * 3), x + (rnd() - 0.5) * 0.3, z + (rnd() - 0.5) * 0.2]);
    };
    for (const [e, count] of [[LAKE, 46], [POND, 16]] as const) {
      for (let i = 0; i < count; i++) {
        const a = rnd() * Math.PI * 2;
        if (e === LAKE && Math.sin(a) < -0.25 && rnd() < 0.8) continue;
        const k = 1 + (rnd() - 0.35) * 0.08;
        clump(e.x + Math.cos(a) * e.rx * k, e.z + Math.sin(a) * e.rz * k);
      }
    }
    for (let i = 0; i < RIVER.length - 1; i++) {
      const [ax, az] = RIVER[i];
      const [bx, bz] = RIVER[i + 1];
      const len = Math.hypot(bx - ax, bz - az);
      const nx = -(bz - az) / len;
      const nz = (bx - ax) / len;
      for (let d = 0; d < len; d += 0.8) {
        for (const side of [-1, 1]) {
          if (rnd() > 0.42) continue;
          const off = RIVER_W + (rnd() - 0.3) * 0.25;
          clump(ax + ((bx - ax) * d) / len + nx * side * off, az + ((bz - az) * d) / len + nz * side * off);
        }
      }
    }
    return out;
  }

  /** The way every sprite faces for the light: towards the sun, so light and shadow never move as you turn. */
  const LIGHT_YAW = Math.atan2(-SUN[0], -SUN[2]);
  let panPx = 0;
  /** How far the view is zoomed (the scope), and how far the rifle is raised to the eye (0..1). */
  let zoom = 1;
  let aimT = 0;
  let aimDepth = Infinity;
  let lastTurn: [number, number] = [0, 0];
  const scopeSway = new THREE.Vector2();
  let gun: Gun | null = null;
  let scope: ReturnType<typeof scopePass> | null = null;
  let lens: THREE.WebGLRenderTarget | null = null;
  let prompt: string | null = null;
  let rippleNext = 0;
  const wading = { ring: 0, dry: true, air: false };
  const ray = new THREE.Raycaster();
  const props3d = { discs: [] as LayerMesh[], board: [] as LayerMesh[], boardFor: null as Notice | null, pc: null as LayerMesh | null };
  let screenBroken = false;

  function buildPlay() {
    if (playBuilt) return;
    playBuilt = true;
    // the walk's wood, less the trees that stood where the water is, and more of it all round
    const kept = walkTrees.filter((t) => waterDist(t.x, t.z) > 0.9);
    const kinds: TreeKind[] = ['oak', 'oak', 'oak', 'beech', 'beech', 'beech', 'birch', 'birch', 'young', 'young', 'ancient'];
    const extra = extraTrees(walkTrees).map((t): Planted => {
      const kind: TreeKind | 'bush' = t.pick < 0.1 ? 'bush' : kinds[Math.floor(((t.pick * 7919) % 1) * kinds.length)];
      return { kind, gi: 0, x: t.x, z: t.z, s: t.s, flip: false };
    });
    // the two big trees at the edge of the wood stand in 3D too
    const ex = Math.abs(keyed.edgeL?.position.x ?? 2.6);
    const edge: Planted[] = [-1, 1].map((sd) => ({ kind: 'oak', gi: 0, x: sd * ex, z: EDGE_Z, s: 1.45, flip: false }));
    const all = [...kept, ...extra, ...edge];
    plantSolidTrees(all);
    for (const k of ['edgeL', 'edgeR', 'computer', 'keyboard']) if (keyed[k]) keyed[k].userData.walkOnly = true;
    // what you bump into: trunks (bushes you push through), the computer, the stump
    const R: Record<string, number> = { oak: 0.2, beech: 0.16, birch: 0.11, young: 0.08, ancient: 0.36, bush: 0 };
    solids = all.filter((t) => R[t.kind] > 0).map((t) => ({ x: t.x, z: t.z, r: R[t.kind] * t.s }));
    solids.push({ x: CLEARING.computer.x, z: CLEARING.computer.z - 0.2, r: 0.5 }, { x: CLEARING.exitX, z: HOLLOW.stumpZ, r: 0.66 });
    for (const so of solids) {
      const k = cellKey(Math.floor(so.x / 2), Math.floor(so.z / 2));
      const list = grid.get(k);
      if (list) list.push(so);
      else grid.set(k, [so]);
    }
    if (floraArt) spriteBatch(floraArt, FLORA_D, playFlora());
    const reeds = atlas(reedSprites());
    spriteBatch({ pix: reeds.pix, rects: reeds.rects, tex: toTexture(reeds.pix, { mips: true }) }, 7, reedSpots());
    buildProps();
    // more animals all over, and frogs by the water
    if (critterAtlas && critterTex) {
      const rnd = mulberry(616);
      const ck = [0, 0, 0, 1, 1, 2, 2, 2, 3, 3, 3, 4];
      critterSpots(46, 617).forEach(([x, z], i) => {
        makeCritter(ck[i % ck.length], x, z, rnd).mesh.userData.playOnly = true;
      });
      for (let i = 0; i < 10; i++) {
        const e = i < 6 ? LAKE : POND;
        const a = rnd() * Math.PI * 2;
        makeCritter(4, e.x + Math.cos(a) * (e.rx + 0.5), e.z + Math.sin(a) * (e.rz + 0.5), rnd).mesh.userData.playOnly = true;
      }
    }
    water = waterMesh(floorPattern!, mirroredFog.texture, 0.008 * 256);
    scene.add(water);
    playHide.push(water);
    puffs = new Puffs();
    scene.add(puffs.points);
    hud = new Hud();
    gun = new Gun();
    scope = scopePass();
    lens = new THREE.WebGLRenderTarget(size.W, size.H, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, generateMipmaps: false, depthBuffer: false });
    // a lid of leaves over the wood past the walk's own roof, so the sun doesn't pour in beyond the fence
    const solidPix = new Pix(1, 1);
    solidPix.data[0] = 0xffffffff;
    const lidTex = toTexture(solidPix, { mips: false });
    for (const [x0, x1, z0, z1] of [[-170, ROOF.x0, ROOF.z0, -280], [ROOF.x1, 170, ROOF.z0, -280], [ROOF.x0, ROOF.x1, ROOF.z1, -280]]) {
      const lid = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z0 - z1), depthMaterial(lidTex, undefined, false));
      lid.rotation.x = -Math.PI / 2;
      lid.position.set((x0 + x1) / 2, ROOF.y, (z0 + z1) / 2);
      lid.layers.set(1);
      lid.frustumCulled = false;
      lid.visible = false;
      scene.add(lid);
      lids.push(lid);
    }
    renderer.compile(scene, camera);
  }

  /**
   * The trees in 3D: each a round trunk with its flared foot and limbs (all of one bark baked into one mesh),
   * and a crown of leaf clumps hung through its oval, every clump a card that turns to you (all in one mesh).
   * Seeded by where each tree stands, so the wood is the same for everyone.
   */
  function plantSolidTrees(list: Planted[]) {
    const tmpl = new Map<TreeKind, THREE.BufferGeometry>();
    const bakes = new Map<string, Bake>();
    const cards: Card[] = [];
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const sv = new THREE.Vector3();
    const pv = new THREE.Vector3();
    const Y = new THREE.Vector3(0, 1, 0);
    const barkOf = (k: TreeKind) => (k === 'beech' ? 'beech' : k === 'birch' ? 'birch' : k === 'ancient' ? 'deep' : 'mid');
    for (const tr of list) {
      const rnd = mulberry((Math.round(tr.x * 97) * 73856093) ^ (Math.round(tr.z * 89) * 19349663));
      const far = !inBounds(tr.x, tr.z, -3);
      if (tr.kind !== 'bush') {
        let g = tmpl.get(tr.kind);
        if (!g) tmpl.set(tr.kind, (g = trunkGeometry(tr.kind)));
        m4.compose(pv.set(tr.x, 0, tr.z), q.setFromAxisAngle(Y, rnd() * Math.PI * 2), sv.setScalar(tr.s));
        const key = barkOf(tr.kind);
        let b = bakes.get(key);
        if (!b) bakes.set(key, (b = new Bake()));
        b.add(g, m4);
      }
      crownCards(tr.kind, tr.x, tr.z, tr.s, far, rnd, cards);
    }
    const barks: Record<string, THREE.Texture> = {
      mid: barkTexture(PAL.mid.bark, { moss: PAL.mid.moss, seed: 41 }),
      beech: barkTexture(BEECH_BARK, { seed: 42 }),
      birch: barkTexture(BIRCH_BARK, { birch: true, seed: 43 }),
      deep: barkTexture(PAL.deep.bark, { moss: PAL.mid.moss, seed: 44 }),
    };
    for (const [key, b] of bakes) Object.assign(add(solidMesh(b.geometry(), barks[key]), 0, 0, 0).userData, { playOnly: true, always: true });
    const leaves = atlas(clumpSprites());
    const lm = add(meshFor(cardGeometry(cards, leaves.rects, leaves.pix.w, leaves.pix.h), toTexture(leaves.pix, { mips: true })), 0, 0, 0);
    Object.assign(lm.userData, { playOnly: true, always: true });
  }

  /** The stump, the computer, the keyboard and the floppies as solid things. */
  function buildProps() {
    const solid = (g: THREE.BufferGeometry, tex: THREE.Texture, x: number, y: number, z: number) => {
      const m = add(solidMesh(g, tex), x, y, z);
      m.userData.playOnly = true;
      return m;
    };
    if (cat.mesh) {
      const st = stumpGeometry(cat.mesh.position.y);
      solid(st.side, barkTexture(PAL.hollow.bark, { moss: PAL.hollow.moss, seed: 45 }), CLEARING.exitX, 0, HOLLOW.stumpZ);
      solid(st.cap, ringsTexture(), CLEARING.exitX, 0, HOLLOW.stumpZ);
    }
    if (computerPix && keyed.computer) {
      const ex = extrude(computerPix, texelAt(CLEARING.camZ - CLEARING.computer.z), COMPUTER.ax, COMPUTER.ay, 0.42, paintComputerBack);
      props3d.pc = solid(ex.body, keyed.computer.material.uniforms.map.value as THREE.Texture, CLEARING.computer.x, 0, CLEARING.computer.z);
      solid(ex.back, toTexture(ex.backPix, { mips: false }), CLEARING.computer.x, 0, CLEARING.computer.z);
    }
    if (keyed.keyboard) {
      const w = KEYBOARD.w * texelAt(KEYBOARD_D);
      solid(new THREE.BoxGeometry(w, 0.035, w * 0.36), keysTexture(), keyed.keyboard.position.x, 0.018, CLEARING.camZ - KEYBOARD_D + 0.12).rotation.y = 0.12;
    }
    discs.forEach((d, i) => {
      if (!d) return;
      const pr = projects[i];
      props3d.discs[i] = solid(new THREE.BoxGeometry(DISC_WORLD, 0.016, DISC_WORLD), floppyTexture(pr.title, pr.disc.body, pr.disc.stripe), d.rest.x, 0.008, d.rest.z);
      d.mesh.userData.offPlay = true;
    });
  }

  /** The back of the old computer: vent slots, a maker's sticker, the power socket, screws, moss on top. */
  function paintComputerBack(p: Pix, main: number) {
    const on = (x: number, y: number) => p.get(x, y) >>> 24 > 0;
    const dark = mix(main, 0xff1a1612, 0.55);
    const deep = mix(main, 0xff100c0a, 0.8);
    const light = mix(main, 0xffffffff, 0.18);
    for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) if (on(x, y)) p.set(x, y, hash2(x, y, 961) < 0.08 ? dark : hash2(x, y, 962) < 0.06 ? light : main);
    const sc = COMPUTER.screen;
    // rows of vent slots across the back of the tube
    for (let y = sc.y + 4; y < sc.y + sc.h - 4; y += 5)
      for (let x = sc.x + 6; x < sc.x + sc.w - 10; x += 9) for (let k = 0; k < 6; k++) if (on(x + k, y)) p.set(x + k, y, deep), on(x + k, y + 1) && p.set(x + k, y + 1, dark);
    // the sticker, with its lines of small print
    const sx = sc.x + sc.w / 2 - 12;
    const sy = sc.y + sc.h + 10;
    p.rect(sx, sy, 24, 12, 0xffd8d2bd);
    for (let i = 0; i < 3; i++) p.rect(sx + 3, sy + 3 + i * 3, 14 - i * 3, 1, 0xff6e665a);
    // the power socket and the cable's stub, low on the case
    const px = COMPUTER.slot.x + 4;
    const py = COMPUTER.slot.y - 2;
    p.rect(px, py, 10, 7, deep);
    for (const dx of [2, 5, 8]) p.rect(px + dx - 1, py + 2, 1, 3, 0xff8c9494);
    for (const [x, y] of [[sc.x + 2, sc.y - 6], [sc.x + sc.w - 3, sc.y - 6], [sc.x + 2, sc.y + sc.h + 4], [sc.x + sc.w - 3, sc.y + sc.h + 4]]) p.set(x, y, deep);
    // moss along the top, where the rain sits
    for (let x = 0; x < p.w; x++)
      for (let y = 0; y < p.h; y++) {
        if (!on(x, y)) continue;
        if (noise1(x * 0.21, 963) > 0.45) for (let k = 0; k < 2 + Math.floor(noise1(x * 0.5, 964) * 4); k++) on(x, y + k) && p.set(x, y + k, shade(PAL.clearing.grass, 0.3 + hash2(x, k, 965) * 0.4));
        break;
      }
  }

  /** The back of the notice board: plain planks, their grain and gaps, a nail at each end. */
  function paintBoardBack(p: Pix) {
    const wood = ramp('#3a2a1c', '#5a4129', '#76583a', '#8f6f4b', '#a8875f');
    for (let y = 0; y < p.h; y++)
      for (let x = 0; x < p.w; x++) {
        if (!(p.get(x, y) >>> 24)) continue;
        const plank = Math.floor(y / 7);
        let t = 0.5 + (noise1(x * 0.16 + plank * 13.1, 966) - 0.5) * 0.4 + (hash2(x, y, 967) - 0.5) * 0.1;
        if (y % 7 === 0) t = 0.05;
        p.set(x, y, shade(wood, t));
      }
    for (let y = 3; y < p.h; y += 7)
      for (let x = 0; x < p.w; x++) {
        if (!(p.get(x, y) >>> 24)) continue;
        p.set(x + 3, y, wood[0]);
        let e = x;
        while (e < p.w && p.get(e, y) >>> 24) e++;
        p.set(e - 4, y, wood[0]);
        break;
      }
  }

  /** The floppies follow the drive (standing up as they fly into the slot); the board stands as the walk's does. */
  function updateProps() {
    discs.forEach((d, i) => {
      const m = props3d.discs[i];
      if (!d || !m) return;
      const e = d.t;
      const p = d.mesh.position;
      m.position.set(p.x, e > 0 ? p.y + 0.05 : 0.008, p.z);
      m.rotation.set((-Math.PI / 2) * smooth(0, 0.35, e), e > 0 ? 0 : DISCS[i].a, 0);
      m.scale.setScalar(1 - 0.5 * smooth(0.6, 1, e));
      m.userData.dead = e >= 0.98;
    });
    const sp = notice.sprite;
    if (props3d.boardFor !== sp) {
      for (const m of props3d.board) {
        scene.remove(m);
        layers.splice(layers.indexOf(m), 1);
        m.geometry.dispose();
      }
      props3d.board = [];
      props3d.boardFor = sp;
      if (sp && notice.mesh) {
        const ex = extrude(sp.pix, texelAt(NOTICE_D), sp.ax, sp.ay, 0.05, paintBoardBack);
        const tex = notice.mesh.material.uniforms.map.value as THREE.Texture;
        for (const [g, t] of [[ex.body, tex], [ex.back, toTexture(ex.backPix, { mips: false })]] as const) {
          const m = add(solidMesh(g, t), 0, 0, 0);
          m.matrixAutoUpdate = false;
          m.userData.playOnly = true;
          props3d.board.push(m);
        }
      }
    }
    for (const m of props3d.board) {
      m.matrix.copy(notice.mesh!.matrix);
      m.matrixWorldNeedsUpdate = true;
      m.userData.dead = !notice.on || notice.state === 'broken';
    }
  }

  function enterPlay() {
    buildPlay();
    playing = true;
    Object.assign(P, { x: SPAWN.x, z: SPAWN.z, y: 0, vy: 0, vx: 0, vz: 0, yaw: 0, pitch: -0.04, kick: 0, cool: 0.3, walk: 0 });
    Object.assign(wading, { ring: 0, dry: true, air: false });
    for (const c of critters) {
      c.mesh.scale.setScalar(CRIT_SCALE);
      c.mesh.material.uniforms.lit.value = 0.55;
    }
    zoom = 1;
    aimT = 0;
    if (!controls) controls = new Controls(o.canvas, (locked) => playing && forest.set({ paused: !locked }));
    controls.attach();
    controls.locked = document.pointerLockElement === o.canvas;
    forest.set({ paused: !controls.touch && !controls.locked });
    if (water) water.visible = true;
    for (const l of lids) l.visible = true;
    // the floor reaches out to the fog on every side, and the sun's shadows reach further round you
    if (floor) {
      floor.scale.set(3, 2.4, 1);
      floor.position.z = -50;
    }
    sunCam.left = sunCam.bottom = -30;
    sunCam.right = sunCam.top = 30;
    sunCam.updateProjectionMatrix();
    if (text) {
      text.material.depthFunc = THREE.LessEqualDepth;
      text.renderOrder = 0;
    }
    offer.t = 0;
    pinPoint($('pill-say'), 0, 0, 0, false);
    pinPoint($('pill-take'), 0, 0, 0, false);
    hud?.setScore(score);
    lastScreen = '';
  }

  function exitPlay() {
    if (!playing) return;
    playing = false;
    controls?.detach();
    forest.set({ paused: false, prompt: null });
    prompt = null;
    if (water) water.visible = false;
    for (const l of lids) l.visible = false;
    if (puffs) puffs.points.visible = false;
    while (gibs.length) dropGib(gibs.pop()!);
    screenBroken = false;
    if (floor) {
      floor.scale.set(1, 1, 1);
      floor.position.z = -68;
    }
    sunCam.left = sunCam.bottom = -SHADOW_HALF;
    sunCam.right = sunCam.top = SHADOW_HALF;
    sunCam.updateProjectionMatrix();
    if (text) {
      text.material.depthFunc = THREE.AlwaysDepth;
      text.renderOrder = 50;
    }
    view.yaw.value = 0;
    view.lightYaw.value = 0;
    tiltPx = panPx = 0;
    zoom = 1;
    aimT = 0;
    camera.rotation.set(0, 0, 0);
    camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan((size.H * K0) / 2));
    camera.updateProjectionMatrix();
    for (const c of critters) {
      c.mesh.scale.setScalar(1);
      c.mesh.material.uniforms.lit.value = 1;
      c.x = c.origin.x;
      c.z = c.origin.y;
      c.home.copy(c.origin);
      Object.assign(c, { y: 0, fly: 0, dead: 0, flee: 0, state: 'idle' });
      c.mesh.userData.dead = false;
    }
    spring.live = false;
    lastScroll = NaN;
    lastScreen = '';
  }

  /** Stepping in and out: the picture dissolves to the dark of the wood in dithered steps, then back. */
  let trans: { dir: 'in' | 'out'; t: number; swapped: boolean } | null = null;
  function updateTrans(dt: number) {
    const fu = blit.material.uniforms.fade;
    if (!trans) {
      fu.value = 0;
      return;
    }
    trans.t += dt;
    const outT = reduced ? 0.15 : trans.dir === 'in' ? 0.6 : 0.4;
    const inT = reduced ? 0.15 : 0.75;
    if (!trans.swapped) {
      fu.value = Math.min(1, trans.t / outT);
      if (trans.t >= outT) {
        trans.swapped = true;
        trans.t = 0;
        if (trans.dir === 'in') enterPlay();
        else exitPlay();
      }
    } else {
      fu.value = Math.max(0, 1 - trans.t / inT);
      if (trans.t >= inT) trans = null;
    }
  }
  forest.subscribe(() => {
    const want = forest.get().playing;
    const heading = trans ? trans.dir === 'in' : playing;
    if (want !== heading) trans = { dir: want ? 'in' : 'out', t: 0, swapped: false };
  });

  /** Moves you towards (nx, nz): round trunks and along the fence. You can wade into the water. */
  function moveTo(nx: number, nz: number) {
    const R = 0.22;
    for (let k = 0; k < 2; k++) {
      for (const so of nearSolids(nx, nz)) {
        const dx = nx - so.x;
        const dz = nz - so.z;
        const d = Math.hypot(dx, dz);
        const min = so.r + R;
        if (d < min && d > 1e-5) {
          nx = so.x + (dx / d) * min;
          nz = so.z + (dz / d) * min;
        }
      }
    }
    const ok = (x: number, z: number) => inBounds(x, z, 0.3);
    if (ok(nx, nz)) {
      P.x = nx;
      P.z = nz;
    } else if (ok(nx, P.z)) {
      P.x = nx;
      P.vz = 0;
    } else if (ok(P.x, nz)) {
      P.z = nz;
      P.vx = 0;
    } else P.vx = P.vz = 0;
  }

  /** A ring spreading on the water from (x, z). */
  function ripple(x: number, z: number, strength: number) {
    if (!water) return;
    (water.material.uniforms.ripples.value as THREE.Vector4[])[rippleNext].set(x, z, clock, strength);
    rippleNext = (rippleNext + 1) % RIPPLES;
  }
  const SPLASH = ['#e4eee9', '#bfd2cc', '#93aca6', '#6f8c86'];

  function updatePlayer(dt: number) {
    const c = controls!;
    paused = !c.touch && !c.locked;
    // raising the rifle to the eye, then the scope's view coming in
    aimT = Math.max(0, Math.min(1, aimT + ((c.zoom && !paused ? 1 : -1) * dt) / 0.2));
    const scoped = smooth(0.7, 1, aimT);
    zoom = 1 + 2.4 * scoped;
    lastTurn = [c.dx, c.dy];
    if (!paused) {
      const sens = (c.touch ? 0.0045 : 0.0022) / zoom;
      P.yaw -= c.dx * sens;
      P.pitch = Math.max(-0.6, Math.min(0.6, P.pitch - c.dy * sens));
    }
    c.dx = c.dy = 0;
    // through the scope your breathing moves the view, slowly
    const t = clock;
    const drift = (k: number) => [Math.sin(k * 0.7) * 0.004 + Math.sin(k * 1.9) * 0.001, Math.sin(k * 1.1 + 1) * 0.003];
    const [d0, d1] = drift(t - dt);
    const [e0, e1] = drift(t);
    P.yaw += (e0 - d0) * scoped;
    P.pitch += (e1 - d1) * scoped;
    const wd = waterDist(P.x, P.z);
    const wet = P.y <= 0 && wd < 0;
    const depth = wet ? Math.min(1, -wd / 1.1) : 0;
    const [mx, mz] = paused ? [0, 0] : c.move();
    const speed = (c.running && aimT < 0.5 ? 4.6 : 2.5) * (1 - depth * 0.45) * (1 - aimT * 0.45);
    const sy = Math.sin(P.yaw);
    const cy = Math.cos(P.yaw);
    // right is (cos, 0, -sin), forward is (-sin, 0, -cos)
    const wx = (cy * mx - sy * mz) * speed;
    const wz = (-sy * mx - cy * mz) * speed;
    const a = 1 - Math.exp(-dt * (P.y > 0 ? 2.5 : 11));
    P.vx += (wx - P.vx) * a;
    P.vz += (wz - P.vz) * a;
    moveTo(P.x + P.vx * dt, P.z + P.vz * dt);
    if (c.jump && P.y <= 0 && !paused) P.vy = 2.7;
    c.jump = false;
    P.vy -= 9.5 * dt;
    P.y += P.vy * dt;
    if (P.y <= 0) {
      P.y = 0;
      P.vy = 0;
    }
    const v = Math.hypot(P.vx, P.vz);
    P.walk = P.y > 0 ? 0 : Math.min(1, v / 2.5);
    P.step += dt * v * 2.6;
    // wading: rings spreading from your legs as you go, a splash with each stride, a big one jumping in
    if (wet) {
      wading.ring -= dt;
      const fx = -sy * 0.18;
      const fz = -cy * 0.18;
      if (wading.dry || wading.air) {
        ripple(P.x, P.z, 1);
        ripple(P.x + fx, P.z + fz, 0.7);
        puffs?.burst(tv.set(P.x - sy * 0.35, 0.04, P.z - cy * 0.35), SPLASH, false, wading.air ? 26 : 16);
        wading.ring = 0.3;
      } else if ((v > 0.35 && wading.ring <= 0) || wading.ring < -1.4) {
        ripple(P.x - sy * 0.5, P.z - cy * 0.5, 0.45 + 0.45 * Math.min(1, v / 3));
        if (v > 0.35) puffs?.burst(tv.set(P.x - sy * 0.6, 0.03, P.z - cy * 0.6), SPLASH, false, 7 + Math.round(v * 2));
        wading.ring = 0.36 - 0.14 * Math.min(1, v / 4);
      }
    }
    wading.dry = !(wd < 0);
    wading.air = P.y > 0;
    // the shot lifts the view a little, and it settles back
    P.kick *= Math.exp(-dt * 9);
    const pitch = P.pitch + P.kick;
    camera.rotation.set(0, P.yaw, 0);
    camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan((size.H * K0) / 2 / zoom));
    camera.updateProjectionMatrix();
    // looking up and down: a shear of the picture (verticals stay vertical), never a tilt of the camera
    const pm = camera.projectionMatrix;
    pm.elements[9] = Math.tan(pitch) * pm.elements[5];
    camera.projectionMatrixInverse.copy(pm).invert();
    tiltPx = (Math.tan(pitch) * zoom) / K0;
    panPx = (P.yaw * zoom) / K0;
    if (c.fire) {
      c.fire = false;
      if (!paused && P.cool <= 0) shoot(pitch);
    }
    P.cool -= dt;
    return eye.set(P.x, EYE + P.y - depth * 0.2 + Math.sin(P.step * 2) * 0.02 * P.walk * (1 - aimT), P.z);
  }

  /** The animal under the crosshair, if a shot would reach it (no trunk in the way); its distance in aimDepth. */
  function aim(pitch: number): Critter | null {
    aimDepth = Infinity;
    if (!critterAtlas || !playing) return null;
    const cam = camera.position;
    const fx = -Math.sin(P.yaw);
    const fz = -Math.cos(P.yaw);
    const tanP = Math.tan(pitch);
    const tc = texelAt(CRITTER_D);
    let best: Critter | null = null;
    let bd = 60;
    for (const c of critters) {
      if (c.dead > 0 || !c.mesh.visible) continue;
      const p = c.mesh.position;
      const ox = p.x - cam.x;
      const oz = p.z - cam.z;
      const depth = ox * fx + oz * fz;
      if (depth < 0.3 || depth > bd) continue;
      // a couple of game pixels' grace all round: small things far off are still fair to hit
      const tol = (2.2 * depth * K0) / zoom;
      const side = ox * -fz + oz * fx;
      const ay = tanP * depth;
      const oy = p.y - cam.y;
      if (Math.abs(side) > (c.w * tc * CRIT_SCALE) / 2 + tol || ay < oy - tol || ay > oy + c.box * tc * CRIT_SCALE + tol) continue;
      if (firstSolid(cam.x, cam.z, fx, fz, depth) !== null) continue;
      best = c;
      bd = depth;
    }
    aimDepth = best ? bd : Infinity;
    return best;
  }

  /** How far along the view the notice board is, if the shot meets it. */
  function boardHit() {
    const b = props3d.board[0];
    if (!b || b.userData.dead) return null;
    ray.setFromCamera(new THREE.Vector2(0, 0), camera);
    return ray.intersectObject(b, false)[0]?.distance ?? null;
  }

  function shoot(pitch: number) {
    P.cool = 0.62;
    P.kick += aimT > 0.7 ? 0.03 : 0.05;
    hud?.fire();
    gun?.fire();
    const hit = aim(pitch);
    const board = boardHit();
    const cam = camera.position;
    // the computer: the glass of its screen bursts; anywhere else on the case, sparks
    ray.setFromCamera(new THREE.Vector2(0, 0), camera);
    const pc = props3d.pc ? ray.intersectObject(props3d.pc, false)[0] : undefined;
    if (pc && pc.distance < aimDepth && pc.distance < (board ?? Infinity)) {
      const t = texelAt(CLEARING.camZ - CLEARING.computer.z);
      const ix = (pc.point.x - CLEARING.computer.x) / t + COMPUTER.ax - COMPUTER.screen.x;
      const iy = COMPUTER.ay - pc.point.y / t - COMPUTER.screen.y;
      const onGlass = ix >= 0 && iy >= 0 && ix < COMPUTER.screen.w && iy < COMPUTER.screen.h && pc.point.z > CLEARING.computer.z - 0.05;
      if (onGlass && !screenBroken) breakScreen(ix, iy, pc.point);
      else puffs?.burst(tv.copy(pc.point), ['#fff6c8', '#f2d36a', '#d9d2bc', '#857c68'], false, 14);
      hud?.hit();
      return;
    }
    // the notice board, if it's nearer than any animal in the way: it bursts, words and all
    if (board !== null && board < aimDepth && notice.state !== 'broken') {
      breakNotice();
      hud?.hit();
      return;
    }
    if (hit) {
      const tc = texelAt(CRITTER_D) * CRIT_SCALE;
      const p = hit.mesh.position;
      const fur = Object.values(CRITTERS[hit.kind].legend);
      // a puff of smoke and fluff, and it's gone (it comes back later, somewhere else)
      explode(hit);
      puffs?.burst(tv.set(p.x, p.y + hit.box * tc * 0.5, p.z), ['#ece6d4', '#d8d2c0', fur[0]], true, 12);
      hit.dead = 7 + Math.random() * 7;
      hit.mesh.userData.dead = true;
      hit.mesh.visible = false;
      score++;
      hud?.setScore(score);
      hud?.hit();
      tv.set(p.x, p.y + hit.box * tc, p.z).project(camera);
      // in metres: your eyes are about a person's height above the grass
      hud?.plusOne((tv.x * 0.5 + 0.5) * size.W, (tv.y * 0.5 + 0.5) * size.H + 10, Math.max(1, Math.round(Math.hypot(p.x - cam.x, p.z - cam.z) * (1.65 / EYE))));
      return;
    }
    // a miss chips bark off the trunk in the way, or kicks up the ground (or the water) where it lands
    const fx = -Math.sin(P.yaw);
    const fz = -Math.cos(P.yaw);
    const tanP = Math.tan(pitch);
    const ground = tanP < -0.01 ? Math.min(60, cam.y / -tanP) : 60;
    const trunk = firstSolid(cam.x, cam.z, fx, fz, ground);
    if (trunk !== null) {
      const y = cam.y + tanP * trunk;
      if (y > 0 && y < 4) puffs?.burst(tv.set(cam.x + fx * trunk, y, cam.z + fz * trunk), ['#4a4134', '#615645', '#2c2a26', '#7c9c4b'], false, 16);
    } else if (tanP < -0.01 && ground < 60) {
      const gx = cam.x + fx * ground;
      const gz = cam.z + fz * ground;
      if (waterDist(gx, gz) < 0) {
        ripple(gx, gz, 1);
        puffs?.burst(tv.set(gx, 0.03, gz), SPLASH, false, 20);
      } else puffs?.burst(tv.set(gx, 0.02, gz), ['#3b2f22', '#5a4632', '#436433', '#7b9655'], false, 18);
    }
  }

  /** What E would do here: put the floppy you're looking at into the computer, or take the one in it out. */
  function updatePrompt() {
    const c = controls!;
    const fx = -Math.sin(P.yaw);
    const fz = -Math.cos(P.yaw);
    let best = -1;
    let bd = 2.1;
    discs.forEach((d, i) => {
      if (!d || d.t > 0) return;
      const dx = d.rest.x - P.x;
      const dz = d.rest.z - P.z;
      const dist = Math.hypot(dx, dz);
      if (dist < bd && (dx * fx + dz * fz) / Math.max(dist, 1e-3) > 0.5) {
        best = i;
        bd = dist;
      }
    });
    const atPc = loaded !== null && Math.hypot(CLEARING.computer.x - P.x, CLEARING.computer.z - P.z) < 2.4;
    const next = paused ? null : best >= 0 ? `Insert “${projects[best].title}”` : atPc ? `Eject “${projects[loaded!].title}”` : null;
    if (next !== prompt) {
      prompt = next;
      forest.set({ prompt });
    }
    if (c.use) {
      c.use = false;
      if (best >= 0) forest.set({ selected: best });
      else if (atPc) forest.set({ selected: null });
    }
  }

  /**
   * An animal hit: it bursts like the notice board does, its own pixels in pieces that tumble, bounce and lie
   * in the grass, with a spray of cartoon-bright red (jam, not gore) that spatters round it; later it all sinks.
   */
  const gibs: { sh: Shatter; age: number; sunk: boolean }[] = [];
  /** In pill mode the animals are bigger and kept bright in the shade, so you can find them in the wood. */
  const CRIT_SCALE = 1.7;
  const RED: [number, number, number][] = [[0.92, 0.18, 0.32], [1, 0.45, 0.58], [0.74, 0.1, 0.22], [1, 0.7, 0.76]];
  function explode(c: Critter) {
    if (!critterAtlas || !critterPix) return;
    const r = critterAtlas.rects[c.rect];
    // painted at twice the size (each pixel four), so the bits it throws are finer than the animal is chunky
    const src = new Pix(r.w * 2, r.h * 2);
    for (let y = 0; y < r.h * 2; y++) for (let x = 0; x < r.w * 2; x++) src.set(x, y, critterPix.get(r.x + (c.flip ? r.w - 1 - (x >> 1) : x >> 1), r.y + (y >> 1)));
    const sh = new Shatter(src, cut(src, 7, 301 + gibs.length), 260);
    fixFacing(sh.mesh);
    scene.add(sh.mesh, sh.spray.points);
    const t = (texelAt(CRITTER_D) / 2) * CRIT_SCALE;
    const rx = Math.cos(P.yaw);
    const rz = -Math.sin(P.yaw);
    const b = c.mesh.position;
    const place = (x: number, y: number, out: THREE.Vector3) => out.set(b.x + rx * (x - r.w) * t, b.y + (r.h * 2 - y - 0.5) * t, b.z + rz * (x - r.w) * t);
    const from = place(r.w, r.h * 1.2, new THREE.Vector3());
    sh.burst(place, t, new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), P.yaw), from, 500 + Math.floor(Math.random() * 1000));
    for (let i = 0; i < 90; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 0.6 + Math.random() * 2.4;
      sh.spray.emit(from.x, from.y, from.z, Math.cos(a) * sp, 0.8 + Math.random() * 3.2, Math.sin(a) * sp, RED[i % RED.length], t * (1 + Math.random() * 1.6), 3 + Math.random() * 3, 0);
    }
    gibs.push({ sh, age: 0, sunk: false });
    if (gibs.length > 5) dropGib(gibs.shift()!);
  }
  function dropGib(g: { sh: Shatter }) {
    scene.remove(g.sh.mesh, g.sh.spray.points);
    g.sh.dispose();
  }
  function updateGibs(dt: number) {
    for (let i = gibs.length - 1; i >= 0; i--) {
      const g = gibs[i];
      g.age += dt;
      g.sh.update(dt);
      if (g.age > 7 && !g.sunk) {
        g.sunk = true;
        g.sh.sink();
      }
      if (g.age > 11) {
        dropGib(g);
        gibs.splice(i, 1);
      }
    }
  }

  /**
   * The monitor's glass, shot: it bursts into shards that fly and tumble with a glitter of glass and a few
   * sparks, and the screen is left black and cracked, the fractures running out from where it was hit.
   */
  function breakScreen(ix: number, iy: number, at: THREE.Vector3) {
    if (!screen.pix || !screen.tex) return;
    screenBroken = true;
    const glass = new Pix(screen.pix.w, screen.pix.h);
    // the shards are glass: the picture seen through a cold grey sheen, so they fall like glass and not like leaves
    for (let i = 0; i < glass.data.length; i++) glass.data[i] = mix(screen.pix.data[i] | 0xff000000, hex('#7a8794'), 0.6);
    const sh = new Shatter(glass, cut(glass, 18, 811), 320);
    fixFacing(sh.mesh);
    scene.add(sh.mesh, sh.spray.points);
    const t = texelAt(CLEARING.camZ - CLEARING.computer.z);
    const sc = COMPUTER.screen;
    const place = (x: number, y: number, out: THREE.Vector3) => out.set(CLEARING.computer.x + (sc.x + x - COMPUTER.ax) * t, (COMPUTER.ay - sc.y - y) * t, CLEARING.computer.z + 0.03);
    sh.burst(place, t, new THREE.Quaternion(), tv.set(at.x, at.y, CLEARING.computer.z - 0.3), 900 + Math.floor(Math.random() * 99));
    for (let i = 0; i < 70; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 0.6 + Math.random() * 2;
      const g = 0.75 + Math.random() * 0.25;
      sh.spray.emit(at.x, at.y, at.z + 0.04, Math.cos(a) * sp, 0.5 + Math.random() * 2.5, 0.6 + Math.random() * 1.8, [g * 0.85, g, g], t * (0.6 + Math.random()), 2 + Math.random() * 2.5, 0);
    }
    gibs.push({ sh, age: 0, sunk: false });
    puffs?.burst(tv.copy(at), ['#fff6c8', '#f2d36a', '#ffffff'], false, 14);
    // what's left in the frame: black, cracked from the hit, a few teeth of glass at the edges
    const p = screen.pix;
    const rnd = mulberry(4040 + Math.round(ix * 7 + iy));
    p.data.fill(hex('#060a08'));
    for (let y = 0; y < p.h; y++)
      for (let x = 0; x < p.w; x++) {
        const e = Math.min(x, y, p.w - 1 - x, p.h - 1 - y);
        if (e < 3 && rnd() < 0.55 - e * 0.15) p.set(x, y, rnd() < 0.5 ? hex('#3a5a50') : hex('#6f9a8c'));
      }
    for (let k = 0; k < 10; k++) {
      let x = ix;
      let y = iy;
      const a0 = (k / 10) * Math.PI * 2 + rnd() * 0.5;
      for (let i = 0; i < 46; i++) {
        const a = a0 + (rnd() - 0.5) * 0.9;
        x += Math.cos(a) * 1.2;
        y += Math.sin(a) * 1.2;
        p.set(Math.round(x), Math.round(y), i < 8 ? hex('#cfe6dc') : hex('#86ab9e'));
      }
    }
    for (let y = -2; y <= 2; y++) for (let x = -2; x <= 2; x++) if (x * x + y * y < 6) p.set(Math.round(ix) + x, Math.round(iy) + y, hex('#000000'));
    screen.tex.needsUpdate = true;
    lastScreen = 'broken';
  }

  /** Back somewhere out of sight. */
  function respawn(c: Critter) {
    const cam = camera.position;
    for (let i = 0; i < 60; i++) {
      const x = BOUNDS.x0 + 2 + Math.random() * (BOUNDS.x1 - BOUNDS.x0 - 4);
      const z = BOUNDS.z0 + 2 + Math.random() * (BOUNDS.z1 - BOUNDS.z0 - 4);
      if (waterDist(x, z) < 0.8 || Math.hypot(x - cam.x, z - cam.z) < 14) continue;
      c.x = x;
      c.z = z;
      c.home.set(x, z);
      break;
    }
    Object.assign(c, { y: 0, fly: 0, flee: 0, dead: 0, state: 'idle', t: 1 + Math.random() });
    c.mesh.userData.dead = false;
  }

  /** The animals in pill mode: they wander, bolt when you come close, and birds take off and fly away. */
  function updatePlayCritters(dt: number, now: number) {
    if (!critterAtlas) return;
    const cam = camera.position;
    const rx = Math.cos(P.yaw);
    const rz = -Math.sin(P.yaw);
    for (const c of critters) {
      const def = CRITTERS[c.kind];
      if (c.dead > 0) {
        c.dead -= dt;
        if (c.dead <= 0) respawn(c);
        else continue;
      }
      const dx = c.x - cam.x;
      const dz = c.z - cam.z;
      if (dx * dx + dz * dz < (c.kind === 3 ? 14 : 9) && c.flee <= 0 && c.fly === 0) {
        c.flee = 1.8;
        c.state = 'move';
        c.t = 1.8;
        c.head = Math.atan2(dz, dx) + (Math.random() - 0.5) * 0.9;
        if (c.kind === 3) c.fly = 0.01;
      }
      c.flee -= dt;
      c.t -= dt;
      if (c.fly > 0) {
        c.fly += dt;
        c.y += dt * (0.8 + c.fly * 0.9);
        c.x += Math.cos(c.head) * 2.4 * dt;
        c.z += Math.sin(c.head) * 2.4 * dt;
        c.phase += dt * 20;
        // flown off over the trees: back later, elsewhere
        if (c.y > 4.5) {
          c.dead = 4 + Math.random() * 5;
          c.mesh.userData.dead = true;
          continue;
        }
      } else {
        if (c.t <= 0) {
          if (c.state === 'idle') {
            c.state = 'move';
            c.t = 0.6 + Math.random() * 1.6;
            const hx = c.home.x - c.x;
            const hz = c.home.y - c.z;
            c.head = hx * hx + hz * hz > 16 ? Math.atan2(hz, hx) : Math.random() * Math.PI * 2;
          } else {
            c.state = 'idle';
            c.t = 0.8 + Math.random() * 2.6;
          }
        }
        if (c.state === 'move') {
          const sp = def.speed * 0.4 * (c.flee > 0 ? 2.6 : 1);
          const nx = c.x + Math.cos(c.head) * sp * dt;
          const nz = c.z + Math.sin(c.head) * sp * dt;
          if (waterDist(nx, nz) < 0.3 || !inBounds(nx, nz, 0.5)) c.head += Math.PI * (0.6 + Math.random() * 0.5);
          else {
            c.x = nx;
            c.z = nz;
          }
          c.phase += dt * (def.hop ? 9 : 12) * (c.flee > 0 ? 1.6 : 1);
        }
      }
      const moving = c.state === 'move' || c.fly > 0;
      const frames = moving ? def.move : def.idle;
      const fi = moving ? frames[Math.floor(c.phase) % frames.length] : frames[Math.floor((now + c.phase) * 1.5) % frames.length];
      c.rect = critterAtlas.index[c.kind][fi];
      const r = critterAtlas.rects[c.rect];
      // sprites face right: flip when it heads left across your view
      c.flip = Math.cos(c.head) * rx + Math.sin(c.head) * rz < 0;
      setFrame(c.mesh, r, critterAtlas.w, critterAtlas.h, c.flip, c.box);
      const hop = moving && def.hop && c.fly === 0 ? Math.abs(Math.sin(c.phase * Math.PI * 0.5)) * def.hop : 0;
      c.mesh.position.set(c.x, c.y + hop, c.z);
    }
  }

  function updatePlayWorld(dt: number, now: number) {
    if (water) {
      const wu = water.material.uniforms;
      wu.time.value = now;
      wu.res.value.set(size.W, size.H);
    }
    puffs?.update(dt);
    updateGibs(dt);
  }

  /**
   * After the fog: the rifle (its own pass, laid over the view), then the scope's glass if it's up, then the
   * flat HUD. The blit shows whichever frame ends up with all of it.
   */
  function drawHud(dt: number) {
    if (!hud || !controls || !gun || !scope || !lens) return;
    const scoped = aimT > 0.75;
    const shade = Math.min(1.05, 0.42 + air.ambient * 0.62);
    gun.update(dt, { W: size.W, H: size.H, walk: P.walk, shade, aim: aimT, turn: lastTurn, visible: !paused && !scoped });
    if (!paused && !scoped) gun.render(renderer, fogged);
    let out = fogged;
    if (scoped) {
      if (lens.width !== size.W || lens.height !== size.H) lens.setSize(size.W, size.H);
      // the eye drifts off the scope's axis as the rifle sways and kicks: the shadow comes in from that side
      const k = 1 - Math.exp(-dt * 8);
      scopeSway.x += (Math.max(-12, Math.min(12, -lastTurn[0] * 0.5)) - scopeSway.x) * k;
      scopeSway.y += (Math.max(-10, Math.min(10, lastTurn[1] * 0.5)) - scopeSway.y) * k;
      const su = scope.uniforms;
      su.frame.value = fogged.texture;
      su.lowRes.value.set(size.W, size.H);
      su.open.value = smooth(0.75, 1, aimT);
      su.shift.value.set(Math.round(scopeSway.x), Math.round(scopeSway.y - gun.kick * 16));
      // where the sun is, seen from here, for the glare on the glass
      tv.set(-SUN[0], -SUN[1], -SUN[2]).applyQuaternion(camera.quaternion.clone().invert());
      su.sun.value.set(tv.x, tv.y, 0.25 + Math.max(0, -tv.z) * 0.75);
      su.shade.value = shade;
      renderer.setRenderTarget(lens);
      renderer.render(scope.scene, postCam);
      out = lens;
    } else scopeSway.set(0, 0);
    const st = controls.stick;
    const toG = (x: number, y: number): [number, number] => [(x * size.devW) / size.cssW / size.scale + size.offX / size.scale, size.H - ((y * size.devH) / size.cssH + size.offY) / size.scale];
    let stick = null;
    if (st.id >= 0) {
      const [x0, y0] = toG(st.x0, st.y0);
      const [x, y] = toG(st.x, st.y);
      stick = { on: true, x0, y0, x, y };
    }
    hud.update(dt, { W: size.W, H: size.H, hot: !paused && !!aim(P.pitch + P.kick), show: !paused, aim: aimT, muzzle: gun.muzzle(size.W, size.H), stick });
    renderer.setRenderTarget(out);
    renderer.autoClear = false;
    renderer.render(hud.scene, hud.cam);
    renderer.autoClear = true;
    blit.material.uniforms.frame.value = out.texture;
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
    // in pill mode it looks where you look, and is drawn every frame (the sprites turn with you)
    if (playing) focus.set(camera.position.x, 1.5, camera.position.z);
    else focus.set(camera.position.x, 1.5, camera.position.z - 13);
    const texel = (2 * sunCam.right) / SHADOW_SIZE;
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
    if (water) water.visible = false;
    const puffsOn = puffs?.points.visible ?? false;
    if (puffs) puffs.points.visible = false;
    // the board's pieces and their spray read the shadow map, so they mustn't draw into it
    const sh = notice.shatter;
    const shards = sh?.mesh.visible ?? false;
    if (sh) sh.mesh.visible = sh.spray.points.visible = false;
    for (const g of gibs) g.sh.mesh.visible = g.sh.spray.points.visible = false;
    // the notice board is drawn in the sharp pass, but its shadow still falls in the forest
    const board = notice.mesh && notice.on && notice.state !== 'broken' && !playing;
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
    if (water) water.visible = playing;
    if (puffs) puffs.points.visible = puffsOn;
    for (const g of gibs) g.sh.mesh.visible = g.sh.spray.points.visible = true;
    light.shadowMatrix.value.copy(bias).multiply(sunCam.projectionMatrix).multiply(sunCam.matrixWorldInverse);
  }

  /** Renders the wood from under the floor (and fogs it), for the puddles to show. Skipped in the meadow. */
  function mirrorPass(now: number) {
    if (!floor) return;
    const fl = floor.material.uniforms;
    const wet = playing ? 1 : smooth(-8, -16, camera.position.z);
    fl.wet.value = wet;
    fl.time.value = now;
    const cz = camera.position.z;
    const cxp = camera.position.x;
    const ahead = playing || PUDDLES.some(([px, pz]) => pz < cz - 0.3 && pz > cz - 24 && Math.abs(px - cxp) < 7);
    fl.wet.value = ahead ? wet : 0;
    if (wet <= 0 || !ahead) return;
    mirrorCam.copy(camera);
    mirrorCam.position.y = -camera.position.y;
    mirrorCam.updateMatrixWorld();
    mirrorCam.projectionMatrix.copy(camera.projectionMatrix);
    mirrorCam.projectionMatrixInverse.copy(camera.projectionMatrixInverse);
    const sku = (sky.material as THREE.ShaderMaterial).uniforms;
    if (playing) {
      // the view from under the water shears the other way, and the sky is drawn at its half size
      mirrorCam.projectionMatrix.elements[9] *= -1;
      mirrorCam.projectionMatrixInverse.copy(mirrorCam.projectionMatrix).invert();
      sku.tilt.value = -tiltPx / 2;
      sku.pan.value = panPx / 2;
      sku.res.value.set(Math.ceil(size.W / 2), Math.ceil(size.H / 2));
      for (const h of playHide) h.visible = false;
    }
    floor.visible = false;
    if (flora) flora.visible = false;
    renderer.setRenderTarget(mirrored);
    renderer.render(scene, mirrorCam);
    floor.visible = true;
    if (flora) flora.visible = true;
    if (playing) {
      sku.tilt.value = tiltPx;
      sku.pan.value = panPx;
      sku.res.value.set(size.W, size.H);
      for (const h of playHide) h.visible = true;
    }
    const mu = fogMirror.material.uniforms;
    const fu = fog.material.uniforms;
    for (const k of ['fogColor', 'camPos', 'projInv', 'viewInv'] as const) mu[k].value.copy(fu[k].value);
    for (const k of ['density', 'falloff', 'shafts'] as const) mu[k].value = fu[k].value;
    mu.res.value.set(Math.ceil(size.W / 2), Math.ceil(size.H / 2));
    mu.camPos.value.copy(mirrorCam.position);
    mu.projInv.value.copy(mirrorCam.projectionMatrixInverse);
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
    updateTrans(dt);
    let atClearing = false;
    let at: THREE.Vector3;
    if (playing) at = updatePlayer(dt);
    else {
      let target = cameraAt(s);
      // walking down into the clearing, the rest of the flick is caught there (never on the way back)
      const from = lastScroll;
      lastScroll = s;
      if (ready && o.hold && from < stages.a && s >= stages.a && o.hold(stages.a)) {
        // a fast fling is already past the computer this frame: aim for where it was caught
        lastScroll = stages.a;
        target = cameraAt(stages.a);
      }
      atClearing = Math.abs(target.z - CLEARING.camZ) < 0.6;
      at = follow(target, dt, !(Math.abs(s - from) < window.innerHeight * 1.5));
      // the board bursting gives the view a short, dying jolt
      if (notice.shake > 0) {
        const k = (notice.shake / 0.4) ** 2 * 0.035;
        at.x += (Math.random() - 0.5) * k;
        at.y += (Math.random() - 0.5) * k;
      }
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
    su.tilt.value = playing ? tiltPx : 0;
    su.pan.value = playing ? panPx : 0;
    view.lightYaw.value = playing ? LIGHT_YAW : 0;
    view.yaw.value = playing ? P.yaw : 0;

    for (const m of layers) {
      const u = m.userData;
      if (playing) m.visible = !u.walkOnly && !u.hidden && !u.offPlay && !u.dead;
      else {
        // the hollow only shows once you've left the clearing: from the walk its tall wall stood over the wood
        const hollow = u.hollow === true && camera.position.z > CLEARING.camZ - 0.8;
        m.visible = !u.playOnly && !hollow && !u.hidden && (u.always === true || camera.position.z - m.position.z > 0.02);
      }
      m.material.uniforms.appear.value = u.born < 0 ? 1 : clamp01((now - u.born) / 0.5);
    }

    updateDrive(now);
    updateScreen(now);
    if (playing) {
      updatePlayCritters(dt, now);
      updatePlayWorld(dt, now);
      updateNotice(dt);
      updateProps();
      updatePrompt();
    } else {
      updateCritters(dt, now);
      updateNotice(dt);
      updateOffer(dt, s, at);
    }
    if (dust) (dust.material as THREE.ShaderMaterial).uniforms.time.value = now;
    if (cat.mesh && cat.open && cat.shut) {
      const cycle = now % 4.2;
      cat.mesh.material.uniforms.map.value = cycle > 4.02 || (cycle > 3.78 && cycle < 3.9) ? cat.shut : cat.open;
    }
    if (!playing) placePins(atClearing, at.z < -40 && at.z > -78);

    shadowPass();
    mirrorPass(now);
    renderer.setRenderTarget(main);
    renderer.render(scene, camera);
    renderer.setRenderTarget(fogged);
    renderer.render(fogScene, postCam);
    if (playing) drawHud(dt);
    if (!playing) blit.material.uniforms.frame.value = fogged.texture;
    renderer.setRenderTarget(null);
    renderer.render(blitScene, postCam);
    if (playing) return;
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
    if (!ready && hero && planted && (text || textGaveUp) && (boards.socials || notice.mesh || textGaveUp)) markReady();
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
    // the page has settled by now (a phone may have shown it zoomed out while it loaded)
    measure();
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
  window.visualViewport?.addEventListener('resize', onLayout);
  resize();
  tick();
  if (process.env.NODE_ENV !== 'production') Object.assign(window, { __forest: { camera, stages, size, scene, layers, fog: fog.material.uniforms, light, atmos, renderer, main, fogged, P, store: forest, notice, critters, play: () => ({ playing, score, controls, aim: () => aim(P.pitch + P.kick), solids }) } });

  return {
    measure,
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      controls?.detach();
      clearTimeout(fontWait);
      painterInbox.listener = null;
      ro.disconnect();
      window.removeEventListener('resize', onLayout);
      window.visualViewport?.removeEventListener('resize', onLayout);
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
