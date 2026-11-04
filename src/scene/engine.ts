import * as THREE from 'three';
import { projects } from '@/content/projects';
import { reedSprites } from './art/gear';
import { COMPUTER, KEYBOARD, pictureToScreen, screenPicture, screenStatic, screenTune } from './art/props';
import { cut, Shatter } from './shatter';
import { atlas, CRITTERS, critterKind, FAUNA, TUFT_KINDS, type FloraInfo } from './art/sprites';
import { LITTER } from './art/floor';
import { pickSeason, type Season } from './season';
import { Weather } from './weather';
import { sfx } from '@/sound/sfx';
import { BEECH_BARK, BIRCH_BARK, TREE_D, TREE_SET, type TreeKind } from './art/trees';
import type { Painted } from './art/worker';
import { atmosFor, CLEARING, CORRIDOR, DISC_WORLD, DISCS, EDGE_Z, FRAMES, HOLLOW, K0, PUDDLES, ROOF, SHORT_SIDE, SUN, SUN_TINT, texelAt } from './config';
import { blitMesh, overlayMesh, depthMaterial, floorMesh, fogMesh, layerMesh, light, meshFor, motes, quadFor, skyMesh, solidMesh, fixFacing, toTexture, view, type LayerMesh } from './gl';
import { Arms, WEAPONS } from './arms';
import { Fauna, type Beast } from './fauna';
import { Decals, Voxels } from './fx';
import { medals, points } from './hunt';
import { goldKnife } from '@/site/eggs';
import type { Surface } from '@/sound/sfx';
import { Controls, Hud, Puffs, RIPPLES, scopePass, waterMesh } from './play';
import { Bake, barkTexture, extrude, floppyTexture, keysTexture, ringsTexture, stumpGeometry, trunkGeometry } from './solid';
import { buildFoliage, type Grove } from './foliage';
import { buildCottage, COTTAGE_BOXES, COTTAGE_POSTS, inCottage, MIRA, SHELF_KINDS, SIGN_PIVOT } from './cottage';
import { Seller } from './seller';
import { purse, wallet } from './wallet';
import { CROSS_COLORS, PIXELS, settings } from './settings';
import { CASE_KINDS, CASES, skinById, skinTiles, type CaseKind } from './loot';
import { BOUNDS, critterSpots, EYE, extraTrees, GLADE, inBounds, LAKE, POND, RIVER, RIVER_W, SPAWN, waterDist } from './world';
import { PAL, setPalette } from './palette';
import { hash2, hex, mix, mulberry, noise1, Pix, ramp, rgbOf, shade } from './pix';
import { forest, forestNow } from './store';

type Opts = {
  canvas: HTMLCanvasElement;
  /** Current (smoothed) scroll position in CSS pixels. */
  scroll: () => number;
  /** The season the wood is painted in. */
  season: Season;
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
type Inbox = { all: PainterMsg[]; listener: ((m: PainterMsg) => void) | null };
const inboxes = new Map<Season, Inbox>();
/** Starts the three painters for a season (once): a wood painted in another season is kept, so going back is instant. */
export function startPainters(season: Season): Inbox {
  let box = inboxes.get(season);
  if (box) return box;
  const inbox: Inbox = { all: [], listener: null };
  box = inbox;
  inboxes.set(season, inbox);
  if (typeof Worker === 'undefined') return inbox;
  for (let group = 0; group < 3; group++) {
    // a classic worker: that is what the production bundle starts it as (a module worker fails silently there)
    const w = new Worker(new URL('./art/worker.ts', import.meta.url));
    const put = (m: PainterMsg) => {
      inbox.all.push(m);
      inbox.listener?.(m);
      if (m.key === 'done' || m.key === 'failed') w.terminate();
    };
    w.onmessage = (e: MessageEvent<PainterMsg>) => put(e.data);
    w.onerror = (ev) => {
      console.warn('forest painter failed', ev.message);
      put({ key: 'failed' });
    };
    w.postMessage({ group, season });
  }
  return inbox;
}
if (typeof window !== 'undefined') startPainters(pickSeason());

export function createForest(o: Opts) {
  THREE.ColorManagement.enabled = false;
  const season = o.season;
  setPalette(season);
  const painterInbox = startPainters(season);
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
  // pill mode's coarse map over the whole wood, for the light far off
  const FAR_HALF = 120;
  const sunFar = new THREE.OrthographicCamera(-FAR_HALF, FAR_HALF, FAR_HALF, -FAR_HALF, 30, 170);
  sunFar.layers.enableAll();
  const farShadow = new THREE.WebGLRenderTarget(2048, 2048, { depthTexture: new THREE.DepthTexture(2048, 2048) });
  light.shadowFar.value = farShadow.depthTexture;
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
  // what's in the air this season (fewer on phones)
  const weather = new Weather(season, window.matchMedia('(pointer: coarse)').matches ? 0.5 : 1);
  scene.add(weather.group);

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
  let floorLitterTex: THREE.DataTexture | null = null;
  let floraInfo: FloraInfo | null = null;
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
      case 'floorLitter':
        // mipmapped: far off and at a slant the leaves average out instead of sparkling as you move
        floorLitterTex = toTexture(pix, { repeat: true, mips: true });
        floorLitterTex.wrapT = THREE.RepeatWrapping;
        break;
      case 'floorRamps': {
        const rows = (m.extra as { rows: number }).rows;
        floor = floorMesh(floorPattern!, toTexture(pix, { mips: false }), rows, 0.008, floorLitterTex);
        const fl = floor.material.uniforms;
        fl.litterAmt.value = [...LITTER[season]];
        fl.winter.value = season === 'winter' ? 1 : 0;
        fl.exitX.value = CLEARING.exitX;
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
        scatterFlora(pix, m.extra as FloraInfo);
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
        const s = screenStatic(0, IDLE_STATIC);
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
  function scatterFlora(pix: Pix, info: FloraInfo) {
    floraInfo = info;
    const rects = info.rects;
    const rnd = mulberry(77);
    const P = info.patches;
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
    // what grows where this season (the painter's lists)
    const { meadow, wood, clearing, hollow } = info.sets;
    const off = (x: number, pathX: number, min: number) => Math.abs(x - pathX) > min;
    // the meadow at the edge of the wood is full of wildflowers, in patches
    for (let i = 0; i < Math.round(120 * P); i++) {
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
    for (let i = 0; i < Math.round(230 * P); i++) {
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
    for (let i = 0; i < Math.round(220 * P); i++) {
      const a = rnd() * Math.PI * 2;
      const r = 1.2 + rnd() * 2.6;
      const x = CLEARING.computer.x + Math.cos(a) * r * 1.4;
      const z = CLEARING.computer.z - 1.2 + Math.sin(a) * r * 0.7;
      if (z > -73.2 || (z > -76 && Math.abs(x - CLEARING.computer.x) < 1.4)) continue;
      put(clearing[Math.floor(rnd() * clearing.length)], x, z);
    }
    // the hollow: toadstools round the stump
    for (let i = 0; i < Math.round(140 * P); i++) {
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
    for (let i = 0; i < Math.round(11000 * info.grass); i++) {
      {
        const gx = -7 + rnd() * 18;
        const gz = -0.3 - rnd() * 107;
        // only under the discs, the computer and the stump is the ground kept clear
        if (gz < -72.4 && gz > -74.55 && Math.abs(gx - cx) < 2.4) continue;
        if (gz < -74.95 && gz > -76.2 && Math.abs(gx - cx) < 1.2) continue;
        if (gz < -100.4 && gz > -101.8 && Math.abs(gx - CLEARING.exitX) < 0.8) continue;
        put(info.tufts + zoneAt(gz) * TUFT_KINDS + Math.floor(rnd() * TUFT_KINDS), gx, gz);
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
    // role (0 small, 1 spiky, 2 climber, 3 bird, 4 by the water, 5 wings), x, z: just off the path, all the way along.
    // Who fills each role is the season's: rabbits go white in winter, hedgehogs sleep and foxes come out
    const homes: [number, number, number][] = [
      [0, -1.2, -2.4], [3, 0.9, -1.9], [3, 1.2, -2.2], [4, -0.7, -1.5], [2, 1.6, -3.4],
      [1, -0.8, -8], [0, 0.9, -11], [3, -0.6, -14], [2, 1.0, -17], [4, -0.9, -20],
      [0, 0.7, -24], [1, -1.0, -28], [3, 0.8, -31], [2, -0.8, -35], [0, 1.1, -39],
      [4, -0.6, -43], [3, 0.7, -46], [1, 0.9, -50], [0, -0.9, -54], [2, 0.8, -58],
      [3, -0.7, -62], [4, 0.9, -65], [3, 1.8, -77.5], [1, -2.0, -76.5], [2, 2.5, -80],
      [0, CLEARING.exitX - 0.9, -85], [3, CLEARING.exitX + 0.8, -89],
      [4, CLEARING.exitX - 1.1, -99], [3, CLEARING.exitX + 1.3, -100.5], [0, CLEARING.exitX + 1.9, -102],
      [5, -0.9, -3.1], [5, 1.4, -12.5], [5, -2.6, -33], [5, 1.6, -78.2],
    ];
    critterTex = tex;
    for (const [role, x, z] of homes) makeCritter(roleKind(role), x, z, rnd);
  }
  let critterTex: THREE.Texture | null = null;
  const ROLES = ['small', 'spiky', 'climber', 'bird', 'water', 'wing'] as const;
  const BIRDS = new Set(['robin', 'jay', 'bullfinch', 'butterfly']);
  const roleKind = (role: number) => critterKind(FAUNA[season][ROLES[role]]);
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
      let hop = c.state === 'move' && def.hop ? Math.abs(Math.sin(c.phase * Math.PI * 0.5)) * def.hop : 0;
      // butterflies never land: they bob along in the air over the flowers
      if (def.fly) {
        c.phase += dt * 10;
        hop = 0.28 + Math.sin(now * 2.1 + c.origin.x * 3) * 0.12 + Math.sin(now * 5.3 + c.origin.y) * 0.04;
      }
      // snap to the texel grid so they move like pixel art
      const t = texelAt(CRITTER_D);
      c.mesh.position.set(Math.round(c.x / t) * t, Math.round(hop / t) * t, c.z);
    }
  }

  // the floating name lives on the page now (the site's own hero); the wood only keeps a flag for "fonts are in"
  let textGaveUp = false;
  let hung = false;

  // --- the sharp pass: words painted at full resolution, drawn over the pixels (the floppies' labels) ---------
  const boardScene = new THREE.Scene();
  const boardCam = new THREE.PerspectiveCamera();
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

  /** Phones and tablets: lighter foliage in pill mode. */
  const coarse = window.matchMedia('(pointer: coarse)').matches;

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
  const size = { W: 1, H: 1, fovH: 1, scale: 1, devW: 1, devH: 1, cssW: 1, cssH: 1, offX: 0, offY: 0, wide: true, restX: 0 };
  let walk = new THREE.CatmullRomCurve3([new THREE.Vector3(), new THREE.Vector3(0, 0, -1)]);
  let leave = new THREE.CatmullRomCurve3([new THREE.Vector3(), new THREE.Vector3(0, 0, -1)]);
  /** start: the wood begins to show (the page above it starts to fall away); walk: the walk sets off; a/b: the clearing; c: the cat */
  const stages = { start: 0, walk: 0, a: 1, b: 2, c: 3 };

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
    // the page above the wood: the walk only sets off once it has fallen away
    const dive = document.querySelector<HTMLElement>('[data-stage="dive"]');
    stages.start = dive ? dive.offsetTop : 0;
    stages.walk = dive ? Math.min(stages.a - 1, dive.offsetTop + dive.offsetHeight - (dive.querySelector<HTMLElement>('.dive-stick')?.offsetHeight || window.innerHeight)) : 0;
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
    // the computer stands in the middle of the view (the words that stood right of it are gone)
    size.restX = CLEARING.computer.x;
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
    const right = size.W / 2 - margin - compScreenX;
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
    // the way in: no walk from the edge of the wood, just the last few steps up to the computer, taken while the
    // drawing of the clearing (the page's, over the wood) comes alive into it
    walk = new THREE.CatmullRomCurve3(
      [new THREE.Vector3(size.restX * 0.55, 0.66, CLEARING.camZ + 4.5), new THREE.Vector3(size.restX * 0.85, 0.57, CLEARING.camZ + 1.9), rest],
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
    // the view is always as wide as the wood's own pixels make it (fovH); in pill mode the pixels may be finer
    const short = Math.min(size.devW, size.devH);
    size.fovH = Math.ceil(size.devH / Math.max(1, Math.round(short / SHORT_SIDE)));
    size.scale = Math.max(1, Math.round(short / (playing ? PIXELS[settings.get().pixels] : SHORT_SIDE)));
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
    camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan((size.fovH * K0) / 2));
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
  }

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // --- the drive ----------------------------------------------------------------------------------------
  let loaded: number | null = null;
  let bootAt = -1;
  /** The boot the screen last grew to full screen for. */
  let grewFor = -1;
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
        offAt = now;
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
  /** When the disc last came out, for the page on the glass dissolving back into static. */
  let offAt = -1;
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
  /**
   * How bright the waiting static is; how long tuning in takes (the static brightens over the first third, and the
   * page on the glass comes up through static of its own from there); how long the page takes to dissolve back out.
   */
  const IDLE_STATIC = 0.42;
  const TV_ON = 0.9;
  const TV_OFF = 0.5;
  function updateScreen(now: number) {
    if (!screen.tex || !screen.pix || screenBroken) return;
    let key: string;
    let pix: Pix;
    // an old TV, always on: static while it waits; a disc tunes it in (the static brightens, then clears to the
    // picture), and when the disc comes out it's back to static (on the walk the page dissolves into it, see
    // .pin-screen). The static runs at 14 fps.
    const frame = Math.floor(now * 14);
    if (bootAt < 0) {
      key = `idle${frame}`;
      if (key === lastScreen) return;
      pix = screenStatic(frame, IDLE_STATIC);
    } else {
      const k = Math.min(1, (now - bootAt) / TV_ON);
      const shot = playing && loaded !== null ? screenShot(loaded) : dark;
      const which = shot === dark ? '' : loaded;
      if (k < 1) {
        key = `on${frame}:${Math.floor(k * 30)}${which}`;
        if (key === lastScreen) return;
        pix = screenTune(k, frame, shot, IDLE_STATIC);
      } else {
        key = `shot${which}`;
        if (key === lastScreen) return;
        pix = screenPicture(shot);
      }
    }
    lastScreen = key;
    screen.pix.data.set(pix.data);
    screen.tex.needsUpdate = true;
  }

  // --- light and fog along the walk ---------------------------------------------------------------------
  const atmos = atmosFor(season).map((a) => ({ ...a, fogV: v3(a.fog), skyV: v3(a.sky), zenithV: v3(a.zenith) }));
  const air = { fog: new THREE.Vector3(), sky: new THREE.Vector3(), zenith: new THREE.Vector3(), clouds: 0, density: 0.03, falloff: 3, ambient: 0.9, shafts: 1, sun: 1 };
  /** Pill mode's light: the same everywhere (only the fog is the place's own), so light never runs ahead of you. */
  const still = { ambient: 0.92, sun: 1.12 };
  /** The walk's weather laid out along the world, for pill mode's fog to read where each bit of it is. */
  function fogZones() {
    const fz = fog.material.uniforms;
    atmos.forEach((a, i) => {
      if (i > 7) return;
      fz.zoneZ.value[i] = a.z;
      (fz.zoneFog.value as THREE.Vector3[])[i].copy(a.fogV);
      fz.zoneDen.value[i] = a.density;
      fz.zoneFall.value[i] = a.falloff;
      fz.zoneShaft.value[i] = a.shafts;
    });
    // the puddles' fog reads the very same
    const mz = fogMirror.material.uniforms;
    for (const k of ['zoneZ', 'zoneFog', 'zoneDen', 'zoneFall', 'zoneShaft'] as const) mz[k] = fz[k];
  }
  fogZones();
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

  function placePins(atClearing: boolean, near: boolean, discsOn = atClearing) {
    const st = forest.get();
    const layer = $('discs');
    const active = discsOn ? 'true' : 'false';
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
    // the monitor's glass, for the project video; once it has lit up, it grows to fill the screen (the page's
    // full-screen view, which starts from the glass), once for each disc that goes in
    const t = texelAt(CLEARING.camZ - CLEARING.computer.z);
    const sc = COMPUTER.screen;
    const x0 = CLEARING.computer.x + (sc.x - COMPUTER.ax) * t;
    const y1 = (COMPUTER.ay - sc.y) * t;
    // (the page comes up once the static has brightened, and tunes in through static of its own: see .pin-screen)
    const glass = atClearing && st.loaded !== null && bootAt >= 0 && clock - bootAt > TV_ON * 0.35;
    // inside the screen it stays up while a flip swaps the disc behind it (the page changes channel itself); when
    // the disc comes out, it stays a moment to dissolve back into the static
    const on = glass || st.full;
    const fading = atClearing && offAt >= 0 && clock - offAt < TV_OFF;
    const el = $('pin-screen');
    const r = pin(el, x0, y1 - sc.h * t, x0 + sc.w * t, y1, CLEARING.computer.z + 0.01, on || fading);
    if (el && r) {
      fitPage(el, r.w);
      const tune = on ? 'in' : 'out';
      if (el.dataset.tune !== tune) el.dataset.tune = tune;
    }
    if (st.full) grewFor = bootAt;
    else if (glass && st.loaded === st.selected && grewFor !== bootAt && clock - bootAt > TV_ON * 0.35 + 1.05) {
      grewFor = bootAt;
      forest.set({ full: true });
    }
  }

  /**
   * The page on the glass is laid out at the window's size and scaled down onto the glass, so that once you're inside
   * the screen (the glass covering the window) it's exactly the window: `--k` is how far it's scaled.
   */
  let pageFit = '';
  function fitPage(el: HTMLElement, glassW: number) {
    const px = (size.scale * size.cssW) / size.devW;
    const k = glassW / (COMPUTER.screen.w * insideM() * px);
    const key = `${k.toFixed(4)} ${size.cssW} ${size.cssH}`;
    if (key === pageFit) return;
    pageFit = key;
    el.style.setProperty('--k', k.toFixed(4));
    el.style.setProperty('--pw', `${size.cssW}px`);
    el.style.setProperty('--ph', `${size.cssH}px`);
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
  /** The side of the cottage the last ray met (for its mark), if that's what it met. */
  const boxNormal = new THREE.Vector3();
  let boxHit = false;
  /**
   * How far along a flat ray (x, z) → (fx, fz) the first trunk (or wall of the cottage) is, or null if none within
   * max. `y0` and `tanP` say how high the ray is along the way, so it can pass over the stall and the roof.
   */
  function firstSolid(x: number, z: number, fx: number, fz: number, max: number, y0 = 0.5, tanP = 0) {
    let best = Infinity;
    boxHit = false;
    for (const b of COTTAGE_BOXES) {
      if (b.off) continue;
      let t0 = 0;
      let t1 = max;
      let ax = 0;
      let az = 0;
      for (const [o, f, lo, hi, axis] of [[x, fx, b.x0, b.x1, 0], [z, fz, b.z0, b.z1, 1]] as const) {
        if (Math.abs(f) < 1e-9) {
          if (o < lo || o > hi) t0 = Infinity;
          continue;
        }
        const ta = (lo - o) / f;
        const tb = (hi - o) / f;
        const near = Math.min(ta, tb);
        if (near > t0) {
          t0 = near;
          ax = axis === 0 ? -Math.sign(f) : 0;
          az = axis === 1 ? -Math.sign(f) : 0;
        }
        t1 = Math.min(t1, Math.max(ta, tb));
      }
      if (t0 > t1 || t0 >= best || y0 + tanP * t0 > b.h) continue;
      best = t0;
      boxHit = true;
      boxNormal.set(ax, 0, az);
    }
    for (const so of solids) {
      const ox = so.x - x;
      const oz = so.z - z;
      const t = ox * fx + oz * fz;
      if (t < 0 || t - so.r > max) continue;
      const qx = ox - fx * t;
      const qz = oz - fz * t;
      const d2 = qx * qx + qz * qz;
      if (d2 > so.r * so.r) continue;
      const tt = t - Math.sqrt(so.r * so.r - d2);
      if (tt < best) {
        best = tt;
        boxHit = false;
      }
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
  function playFlora(info: FloraInfo) {
    const rnd = mulberry(1717);
    const items: [number, number, number][] = [];
    const pick = (a: number, b: number, t: number) => (rnd() < t ? b : a);
    const zone = (z: number) =>
      z > -6 ? 0 : z > -30 ? pick(0, 1, (-6 - z) / 24) : z > -58 ? pick(1, 2, (-30 - z) / 28) : z > -68 ? pick(2, 3, (-58 - z) / 10) : z > -79 ? 3 : z > -90 ? pick(3, 4, (-79 - z) / 11) : 4;
    for (let i = 0; i < 26000; i++) {
      const x = -34 + rnd() * 70;
      const z = -114 + rnd() * 162;
      if (x > -7 && x < 11 && z < -0.3 && z > -107.3) continue;
      if (inCottage(x, z)) continue;
      if (waterDist(x, z) < 0.12) continue;
      if (rnd() > info.grass) continue;
      items.push([info.tufts + zone(z) * TUFT_KINDS + Math.floor(rnd() * TUFT_KINDS), x, z]);
    }
    const patch = (cx: number, cz: number, n: number, kinds: number[], r: number) => {
      for (let k = 0; k < n; k++) {
        const rr = Math.pow(rnd(), 0.7) * r;
        const a = rnd() * Math.PI * 2;
        const x = cx + Math.cos(a) * rr;
        const z = cz + Math.sin(a) * rr * 0.7;
        if (waterDist(x, z) > 0.2 && !inCottage(x, z)) items.push([kinds[Math.floor(rnd() * kinds.length)], x, z]);
      }
    };
    const { meadow, wood, ring } = info.sets;
    for (let i = 0; i < Math.round(170 * info.patches); i++) {
      const a = rnd() * Math.PI * 2;
      const r = Math.sqrt(rnd()) * 0.95;
      patch(GLADE.x + Math.cos(a) * r * GLADE.rx, GLADE.z + Math.sin(a) * r * GLADE.rz, 5 + Math.floor(rnd() * 9), meadow, 0.45);
    }
    for (let i = 0; i < Math.round(320 * info.patches); i++) {
      const x = BOUNDS.x0 + rnd() * (BOUNDS.x1 - BOUNDS.x0);
      const z = -8 - rnd() * 100;
      if (x > -5 && x < 9) continue;
      const k = wood[Math.floor(rnd() * wood.length)];
      patch(x, z, 4 + Math.floor(rnd() * 8), [k, k, k, k, wood[Math.floor(rnd() * wood.length)]], 0.25);
    }
    // a fairy ring of toadstools in the dark beside the pond
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      items.push([ring[i % ring.length], 11.2 + Math.cos(a) * 1.15, -51 + Math.sin(a) * 0.9]);
    }
    return items;
  }

  /** Reeds along every bank, in clumps; the lake's near shore is left mostly open so you see the water. */
  function reedSpots() {
    const rnd = mulberry(2323);
    const out: [number, number, number][] = [];
    const clump = (x: number, z: number) => {
      const n = 1 + Math.floor(rnd() * 3);
      for (let k = 0; k < n; k++) {
        const kind = Math.floor(rnd() * 3);
        const rx = x + (rnd() - 0.5) * 0.3;
        const rz = z + (rnd() - 0.5) * 0.2;
        if (!inCottage(rx, rz)) out.push([kind, rx, rz]);
      }
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
  let arms: Arms | null = null;
  let fauna: Fauna | null = null;
  let voxels: Voxels | null = null;
  let decals: Decals | null = null;
  /** The hunt: points, kills, the streak, your breath, the spread of your shots, the turns you've made. */
  const hunt = { kills: 0, points: 0, streak: 0, first: true, chainAt: [] as number[], scopedAt: -9, yawHist: [] as [number, number][], breath: 1, holding: false, tired: 0, beat: 0, spread: 0, recoil: 0, jumpedAt: -9 };
  let scope: ReturnType<typeof scopePass> | null = null;
  let lens: THREE.WebGLRenderTarget | null = null;
  let prompt: string | null = null;
  let rippleNext = 0;
  const wading = { ring: 0, dry: true, air: false };
  const ray = new THREE.Raycaster();
  const props3d = { discs: [] as LayerMesh[], pc: null as LayerMesh | null };
  let screenBroken = false;
  /** Mira, and whether you're near her (she waves as you come up) */
  let seller: Seller | null = null;
  let miraNear = false;
  const unwatch: (() => void)[] = [];
  /** The skin each weapon wears, from what you have on at Mira's. */
  function applySkins() {
    if (!arms) return;
    for (const w of WEAPONS) {
      const it = purse.worn(w);
      const sk = it ? skinById(it.skin) : undefined;
      const key = it && sk ? it.uid : '';
      // only painted when it changes, so this is cheap enough to ask every frame
      if (arms.wears(w) === key) continue;
      arms.setSkin(w, key, it && sk ? skinTiles(sk, it.seed, it.wear) : null);
    }
  }
  /**
   * What can be broken at Mira's: the three cases on her table, the shop window's glass, each case on the shelves
   * behind it, the barrel by the door. Shot or cut, each bursts into its own bits with the right sound, and is
   * back a while later (Mira tidies up). The sign hanging out front swings when it's hit.
   */
  type Breakable = { meshes: LayerMesh[]; kind: 'crate' | 'shelf' | 'glass' | 'barrel' | 'box' | 'lamp'; colors: string[]; dead: number; at: THREE.Vector3; then?: () => void };
  const breakables: Breakable[] = [];
  const shopSign = { meshes: [] as LayerMesh[], angle: 0, vel: 0, creak: 0 };
  function buildBreakables(parts: Map<string, LayerMesh[]>) {
    const centre = (ms: LayerMesh[]) => {
      const box = new THREE.Box3();
      for (const m of ms) {
        m.geometry.computeBoundingBox();
        box.union(m.geometry.boundingBox!);
      }
      return box.getCenter(new THREE.Vector3());
    };
    const caseColors = (k: CaseKind) => [CASES[k].color, CASES[k].dark, '#c9a04a', '#e8c873'];
    const put = (meshes: LayerMesh[] | undefined, kind: Breakable['kind'], colors: string[]) => meshes?.length && breakables.push({ meshes, kind, colors, dead: 0, at: centre(meshes) });
    for (const k of CASE_KINDS) put(parts.get(k), 'crate', caseColors(k));
    SHELF_KINDS.forEach((k, i) => put(parts.get(`shelf${i}`), 'shelf', caseColors(k)));
    put(parts.get('glass'), 'glass', ['#f4fbf8', '#cfe0dc', '#a8c4c0', '#ffffff']);
    put([...(parts.get('barrel') ?? []), ...(parts.get('barrelLid') ?? [])], 'barrel', ['#6e4a2a', '#875e36', '#a07444', '#3a3631', '#54361e']);
    put(parts.get('crateTop'), 'box', ['#3a2414', '#54361e', '#6e4a2a', '#875e36']);
    put(parts.get('crateBig'), 'box', ['#54361e', '#6e4a2a', '#875e36', '#a07444']);
    put(parts.get('lamp'), 'lamp', ['#fff6d0', '#ffe9a8', '#f2c25a', '#e8b850']);
    // the barrel's and the bottom box's bumps go with them; the top box falls with the one under it
    const barrel = breakables.find((b) => b.kind === 'barrel');
    if (barrel) barrel.then = () => Object.assign(COTTAGE_POSTS[1], { x: 1e6, z: 1e6 });
    const [top, big] = breakables.filter((b) => b.kind === 'box');
    if (big)
      big.then = () => {
        COTTAGE_BOXES[2].off = true;
        if (top && top.dead <= 0) smash(top);
      };
    shopSign.meshes = [...(parts.get('sign') ?? []), ...(parts.get('signwood') ?? [])];
  }
  /** Everything breakable (still whole) and the sign, along the ray, nearest first, out to `far`. */
  function shopHits(far = Infinity) {
    const list: THREE.Object3D[] = [...shopSign.meshes];
    for (const b of breakables) if (b.dead <= 0) list.push(...b.meshes);
    ray.near = 0;
    ray.far = far;
    const hits = ray.intersectObjects(list, false);
    ray.far = Infinity;
    return hits.map((h) => ({ h, b: breakables.find((b) => b.meshes.includes(h.object as LayerMesh)) ?? null, sign: shopSign.meshes.includes(h.object as LayerMesh) }));
  }
  function smash(b: Breakable) {
    // broken until the page is loaded again
    b.dead = 1;
    for (const m of b.meshes) m.userData.dead = true;
    const glass = b.kind === 'glass' || b.kind === 'lamp';
    voxels?.burst(b.at, b.colors, b.kind === 'barrel' ? 40 : glass ? 50 : 26, glass ? 0.018 : b.kind === 'barrel' ? 0.035 : 0.026, glass ? 1.3 : 1.8);
    puffs?.burst(tv.copy(b.at), glass ? ['#ffffff', '#e4f0ec', '#cfe0dc'] : ['#ece6d4', '#d8d2c0', '#a07444'], !glass, glass ? 18 : 12);
    const ps = placeSound(b.at.x, b.at.z);
    if (glass) sfx.play('glass', { ...ps, gain: ps.gain * 1.4 });
    else {
      sfx.play('wood', { ...ps, rate: b.kind === 'barrel' ? 0.7 : 1 });
      sfx.play('thud', ps);
      if (b.kind === 'barrel') sfx.play('board', { ...ps, gain: ps.gain * 0.6 });
    }
    seller?.flinch();
    b.then?.();
  }
  /** The sign, hit: it swings away from the hit, about its bar; a shot leaves a hole in it and knocks chips off. */
  function swingSign(fromZ: number, hit?: THREE.Intersection) {
    if (hit?.uv) {
      const tex = (hit.object as LayerMesh).material.uniforms.map.value as THREE.DataTexture;
      const img = tex.image as { data: Uint8Array; width: number; height: number };
      const hx = Math.floor((hit.uv.x - Math.floor(hit.uv.x)) * img.width);
      const hy = Math.floor((hit.uv.y - Math.floor(hit.uv.y)) * img.height);
      const put = (x: number, y: number, c: number[]) => {
        if (x < 0 || y < 0 || x >= img.width || y >= img.height) return;
        img.data.set([...c, 255], (y * img.width + x) * 4);
      };
      for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) put(hx + dx, hy + dy, [26, 20, 16]);
      for (const [dx, dy] of [[-1, 0], [2, 1], [0, -1], [1, 2], [-1, 2], [2, -1]]) if (Math.random() < 0.7) put(hx + dx, hy + dy, [200, 168, 120]);
      tex.needsUpdate = true;
      puffs?.burst(tv.copy(hit.point), ['#c8a878', '#a07444', '#6e4a2a', '#e2c898'], false, 12);
    }
    shopSign.vel += (fromZ >= 0 ? -1 : 1) * 4.5;
    const ps = placeSound(SIGN_PIVOT[0], SIGN_PIVOT[2]);
    sfx.play('wood', { ...ps, rate: 1.3 });
    sfx.play('creak', ps);
  }
  function updateShop(dt: number) {
    // the sign on its bar: a pendulum, damped
    shopSign.vel += (-38 * Math.sin(shopSign.angle) - 1.3 * shopSign.vel) * dt;
    shopSign.angle = Math.max(-1.3, Math.min(1.3, shopSign.angle + shopSign.vel * dt));
    for (const m of shopSign.meshes) m.rotation.x = shopSign.angle;
    // it creaks at the top of each swing while it's still going
    shopSign.creak -= dt;
    if (Math.abs(shopSign.vel) < 0.4 && Math.abs(shopSign.angle) > 0.25 && shopSign.creak <= 0) {
      shopSign.creak = 0.35;
      sfx.play('creak', { ...placeSound(SIGN_PIVOT[0], SIGN_PIVOT[2]), gain: 0.5 });
    }
  }

  /** Opens one of pill mode's pages over the wood (the shop, your cases), letting the mouse go. */
  function openPanel(kind: 'shop' | 'cases') {
    forest.set({ panel: kind });
    if (kind === 'shop') {
      seller?.wave();
      sfx.play('hello', placeSound(MIRA.x, MIRA.z));
    } else sfx.play('unlock', { gain: 0.5 });
    if (document.pointerLockElement) document.exitPointerLock();
  }

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
    solids.push({ x: CLEARING.computer.x, z: CLEARING.computer.z - 0.2, r: 0.5 }, { x: CLEARING.exitX, z: HOLLOW.stumpZ, r: 0.66 }, ...COTTAGE_POSTS);
    for (const so of solids) {
      const k = cellKey(Math.floor(so.x / 2), Math.floor(so.z / 2));
      const list = grid.get(k);
      if (list) list.push(so);
      else grid.set(k, [so]);
    }
    if (floraArt && floraInfo) spriteBatch(floraArt, FLORA_D, playFlora(floraInfo));
    const reeds = atlas(reedSprites());
    spriteBatch({ pix: reeds.pix, rects: reeds.rects, tex: toTexture(reeds.pix, { mips: true }) }, 7, reedSpots());
    buildProps();
    // Mira's cottage across the lake, and Mira
    const shopParts = new Map<string, LayerMesh[]>();
    for (const { key, geo, tex } of buildCottage()) {
      // the sign turns about the bar it hangs from
      const hung = key === 'sign' || key === 'signwood';
      if (hung) geo.translate(-SIGN_PIVOT[0], -SIGN_PIVOT[1], -SIGN_PIVOT[2]);
      geo.computeBoundingSphere();
      const m = add(solidMesh(geo, tex), hung ? SIGN_PIVOT[0] : 0, hung ? SIGN_PIVOT[1] : 0, hung ? SIGN_PIVOT[2] : 0);
      Object.assign(m.userData, { playOnly: true, always: true });
      shopParts.set(key, [...(shopParts.get(key) ?? []), m]);
    }
    buildBreakables(shopParts);
    seller = new Seller(MIRA.x, MIRA.z, Math.PI);
    scene.add(seller.group);
    for (const m of seller.meshes) {
      renderer.initTexture(m.material.uniforms.map.value as THREE.Texture);
      layers.push(m);
    }
    // the skins she sells, worn as soon as they're put on
    unwatch.push(wallet.subscribe(() => playing && applySkins()));
    let pixelsWere = settings.get().pixels;
    unwatch.push(
      settings.subscribe(() => {
        if (!playing) return;
        sfx.setVolume(settings.get().volume);
        // finer or chunkier pixels: the frame is laid out again
        if (settings.get().pixels !== pixelsWere) {
          pixelsWere = settings.get().pixels;
          resize();
        }
      }),
    );
    const cheer = () => seller?.cheer();
    window.addEventListener('mira-cheer', cheer);
    unwatch.push(() => window.removeEventListener('mira-cheer', cheer));
    // the season's animals, in 3D, all over the wood
    fauna = new Fauna(season, critterSpots(70, 617), mulberry(616));
    fauna.group.visible = false;
    scene.add(fauna.group);
    voxels = new Voxels();
    decals = new Decals();
    scene.add(voxels.mesh, decals.mesh);
    water = waterMesh(floorPattern!, mirroredFog.texture, 0.008 * 256);
    scene.add(water);
    playHide.push(water);
    puffs = new Puffs();
    scene.add(puffs.points);
    hud = new Hud();
    arms = new Arms(goldKnife());
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
    const groves: Grove[] = [];
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
      groves.push({ kind: tr.kind, x: tr.x, z: tr.z, s: tr.s, far });
    }
    const barks: Record<string, THREE.Texture> = {
      mid: barkTexture(PAL.mid.bark, { moss: PAL.mid.moss, seed: 41 }),
      beech: barkTexture(BEECH_BARK, { seed: 42 }),
      birch: barkTexture(BIRCH_BARK, { birch: true, seed: 43 }),
      deep: barkTexture(PAL.deep.bark, { moss: PAL.mid.moss, seed: 44 }),
    };
    for (const [key, b] of bakes) Object.assign(add(solidMesh(b.geometry(), barks[key]), 0, 0, 0).userData, { playOnly: true, always: true });
    // the crowns and the bushes in the round
    for (const m of buildFoliage(groves, coarse)) Object.assign(add(m, 0, 0, 0).userData, { playOnly: true, always: true });
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

  /** The floppies follow the drive (standing up as they fly into the slot). */
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
  }

  function enterPlay() {
    buildPlay();
    playing = true;
    // pill mode may draw finer pixels than the walk (a setting)
    if (settings.get().pixels !== 'chunky') resize();
    Object.assign(P, { x: SPAWN.x, z: SPAWN.z, y: 0, vy: 0, vx: 0, vz: 0, yaw: 0, pitch: -0.04, kick: 0, cool: 0.3, walk: 0 });
    Object.assign(wading, { ring: 0, dry: true, air: false });
    // the walk's flat animals stay on the walk; pill mode has its own, in the round
    for (const c of critters) c.mesh.userData.offPlay = true;
    if (fauna) fauna.group.visible = true;
    if (voxels) voxels.mesh.visible = true;
    if (decals) decals.mesh.visible = true;
    hunt.breath = 1;
    hunt.tired = 0;
    hunt.holding = false;
    zoom = 1;
    aimT = 0;
    applySkins();
    sfx.setVolume(settings.get().volume);
    sfx.play('pill');
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
    hud?.setScore(wallet.get().points, hunt.kills);
    lastScreen = '';
  }

  function exitPlay() {
    if (!playing) return;
    playing = false;
    if (size.H !== size.fovH) resize();
    controls?.detach();
    forest.set({ paused: false, prompt: null, panel: null });
    sfx.setVolume(1);
    pinPoint($('mira-say'), 0, 0, 0, false);
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
    view.yaw.value = 0;
    view.lightYaw.value = 0;
    tiltPx = panPx = 0;
    zoom = 1;
    aimT = 0;
    camera.rotation.set(0, 0, 0);
    camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan((size.fovH * K0) / 2));
    camera.updateProjectionMatrix();
    if (fauna) fauna.group.visible = false;
    if (voxels) voxels.mesh.visible = false;
    decals?.clear();
    for (const c of critters) {
      c.mesh.userData.offPlay = false;
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
      // the cottage and the stall: out of the box, to the nearest side
      for (const b of COTTAGE_BOXES) {
        if (b.off) continue;
        const cx = Math.max(b.x0, Math.min(nx, b.x1));
        const cz = Math.max(b.z0, Math.min(nz, b.z1));
        const dx = nx - cx;
        const dz = nz - cz;
        const d = Math.hypot(dx, dz);
        if (d >= R) continue;
        if (d > 1e-5) {
          nx = cx + (dx / d) * R;
          nz = cz + (dz / d) * R;
        } else {
          const m = Math.min(nx - b.x0, b.x1 - nx, nz - b.z0, b.z1 - nz);
          if (m === nx - b.x0) nx = b.x0 - R;
          else if (m === b.x1 - nx) nx = b.x1 + R;
          else if (m === nz - b.z0) nz = b.z0 - R;
          else nz = b.z1 + R;
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

  /** What the ground under you is, for the sound of your steps. */
  function surfaceAt(x: number, z: number): Surface {
    const wd = waterDist(x, z);
    if (wd < 0) return frozen(x, z) ? 'snow' : 'water';
    if (season === 'winter') return 'snow';
    const glade = ((x - GLADE.x) / GLADE.rx) ** 2 + ((z - GLADE.z) / GLADE.rz) ** 2 < 1;
    if (season === 'autumn' && !glade) return 'leaves';
    return glade || z > -6 ? 'grass' : 'dirt';
  }
  const onRiver = (x: number, z: number) => {
    for (let i = 0; i < RIVER.length - 1; i++) {
      const [ax, az] = RIVER[i];
      const [bx, bz] = RIVER[i + 1];
      const vx = bx - ax;
      const vz = bz - az;
      const t = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / (vx * vx + vz * vz)));
      if (Math.hypot(x - ax - vx * t, z - az - vz * t) < RIVER_W) return true;
    }
    return false;
  };
  /** Winter freezes the lake and the pond (you walk on the ice); the river keeps running. */
  const frozen = (x: number, z: number) => season === 'winter' && !onRiver(x, z);

  /** How a sound at (x, z) sits: left or right of where you look, and how loud from here. */
  function placeSound(x: number, z: number) {
    const dx = x - P.x;
    const dz = z - P.z;
    const d = Math.hypot(dx, dz);
    const rx = Math.cos(P.yaw);
    const rz = -Math.sin(P.yaw);
    return { pan: d > 0.01 ? (dx * rx + dz * rz) / d : 0, gain: 1 / (1 + d * 0.12) };
  }

  /** Running speed, by what you carry: lighter with the knife. */
  const RUN = { rifle: 4.3, shotgun: 4.6, knife: 5.3 };
  const WALK = 2.5;
  function updatePlayer(dt: number) {
    const c = controls!;
    const a = arms!;
    const panel = forest.get().panel;
    paused = (!c.touch && !c.locked) || panel !== null;
    const t = clock;
    // 4: your cases, opened over the wood (and 4 again puts them away)
    if (c.swap === 4) {
      c.swap = null;
      if (panel === 'cases') {
        forest.set({ panel: null });
        c.lock();
      } else if (!panel && !(!c.touch && !c.locked)) openPanel('cases');
    }
    // weapons: swapping, reloading, inspecting
    if (!paused) {
      if (c.swap !== null) {
        if (c.swap === 'q') a.swapLast();
        else if (c.swap === 'next') a.cycle(1);
        else if (c.swap === 'prev') a.cycle(-1);
        else a.switchTo(WEAPONS[c.swap - 1] ?? a.current);
      }
      if (c.reload) a.reload();
      if (c.inspect) a.inspect();
    }
    c.swap = null;
    c.reload = c.inspect = false;
    // raising the weapon to the eye: the rifle's scope comes up; the shotgun's sights, a little zoom
    const wantAim = c.zoom && !paused && a.aims && a.action !== 'reload' && a.action !== 'deploy';
    const was = aimT;
    aimT = Math.max(0, Math.min(1, aimT + ((wantAim ? 1 : -1) * dt) / 0.2));
    if (a.current !== 'rifle' && aimT > 0.7 && a.current === 'shotgun') aimT = Math.min(aimT, 1);
    const scoped = a.current === 'rifle' ? smooth(0.7, 1, aimT) : 0;
    if (scoped >= 1 && was < 1) {
      hunt.scopedAt = t;
      sfx.play('zoom');
    }
    if (scoped <= 0) hunt.scopedAt = -9;
    zoom = a.current === 'rifle' ? 1 + 2.4 * scoped : a.current === 'shotgun' ? 1 + 0.28 * smooth(0, 1, aimT) : 1;
    lastTurn = [c.dx, c.dy];
    if (!paused) {
      const S = settings.get();
      const sens = ((c.touch ? 0.0045 : 0.0022) / zoom) * S.sens * (aimT > 0.5 ? S.scopeSens : 1);
      P.yaw -= c.dx * sens;
      P.pitch = Math.max(-0.6, Math.min(0.6, P.pitch - c.dy * sens * (S.invertY ? -1 : 1)));
    }
    c.dx = c.dy = 0;
    // how far you've turned lately, for the flicks and the 360s
    hunt.yawHist.push([t, P.yaw]);
    while (hunt.yawHist.length && t - hunt.yawHist[0][0] > 1.3) hunt.yawHist.shift();
    // holding your breath behind the scope (Shift): steady for a few seconds, then shaking while you get it back
    const wantsBreath = scoped > 0.5 && (c.keys.has('ShiftLeft') || c.keys.has('ShiftRight')) && hunt.tired <= 0;
    if (wantsBreath && !hunt.holding && hunt.breath > 0.15) {
      hunt.holding = true;
      hunt.beat = t;
      sfx.play('breathIn', { gain: 0.8 });
    }
    if (hunt.holding && (!wantsBreath || hunt.breath <= 0)) {
      hunt.holding = false;
      sfx.play('breathOut', { gain: hunt.breath <= 0 ? 1 : 0.5 });
      if (hunt.breath <= 0) hunt.tired = 2.6;
    }
    if (hunt.holding) {
      hunt.breath = Math.max(0, hunt.breath - dt / 3.6);
      if (t - hunt.beat > 0.75) {
        hunt.beat = t;
        sfx.play('heart', { gain: 0.5 });
      }
    } else hunt.breath = Math.min(1, hunt.breath + dt / (hunt.tired > 0 ? 6 : 3));
    hunt.tired = Math.max(0, hunt.tired - dt);
    // through the scope your breathing moves the view; moving makes it worse, held breath all but stills it
    const wd = waterDist(P.x, P.z);
    const ice = frozen(P.x, P.z);
    const wet = P.y <= 0 && wd < 0 && !ice;
    const depth = wet ? Math.min(1, -wd / 1.1) : 0;
    const hv = Math.hypot(P.vx, P.vz);
    const sway = scoped * (hunt.holding ? 0.12 : hunt.tired > 0 ? 2.6 : 1) * (1 + Math.min(2, hv * 0.4) + (P.y > 0 ? 3 : 0));
    const drift = (k: number) => [Math.sin(k * 0.7) * 0.004 + Math.sin(k * 1.9) * 0.0012 + Math.sin(k * 4.3) * 0.0006, Math.sin(k * 1.1 + 1) * 0.003 + Math.sin(k * 2.7) * 0.0008];
    const [d0, d1] = drift(t - dt);
    const [e0, e1] = drift(t);
    P.yaw += (e0 - d0) * sway;
    P.pitch += (e1 - d1) * sway;
    // moving, the way Source does it: acceleration on the ground with friction, and in the air a little
    // strafing control that a good turn turns into speed (bunny hopping)
    const [mx, mz] = paused ? [0, 0] : c.move();
    const run = !scoped && (c.running || a.current === 'knife');
    const top = (run ? RUN[a.current] : WALK) * (1 - depth * 0.45) * (1 - aimT * (a.current === 'rifle' ? 0.55 : 0.3));
    const sy = Math.sin(P.yaw);
    const cy = Math.cos(P.yaw);
    let wx = cy * mx - sy * mz;
    let wz = -sy * mx - cy * mz;
    const wl = Math.hypot(wx, wz);
    if (wl > 1e-4) {
      wx /= wl;
      wz /= wl;
    }
    const wishSpeed = top * Math.min(1, wl);
    const accel = (speed: number, k: number, cap = speed) => {
      const cur = P.vx * wx + P.vz * wz;
      const add = cap - cur;
      if (add <= 0) return;
      const acc = Math.min(k * speed * dt, add);
      P.vx += acc * wx;
      P.vz += acc * wz;
    };
    const ground = P.y <= 0;
    // a jump pressed a moment before you land still counts; holding Space hops again, but loses a little to friction
    const buffered = t - c.jumpAt < 0.14 && c.jumpAt > hunt.jumpedAt;
    const wantsJump = !paused && ground && (buffered || c.hopping);
    if (ground) {
      if (!(wantsJump && buffered)) {
        const sp = Math.hypot(P.vx, P.vz);
        if (sp > 0) {
          const drop = Math.max(sp, 1.6) * (wet ? 8 : 6) * dt;
          const k = Math.max(0, sp - drop) / sp;
          P.vx *= k;
          P.vz *= k;
        }
      }
      if (wl > 1e-4) accel(wishSpeed, 10);
    } else if (wl > 1e-4) accel(wishSpeed, 14, 0.62);
    // a speed limit somewhere well past running, so nobody leaves the wood
    const hs = Math.hypot(P.vx, P.vz);
    if (hs > 13) {
      P.vx *= 13 / hs;
      P.vz *= 13 / hs;
    }
    moveTo(P.x + P.vx * dt, P.z + P.vz * dt);
    if (wantsJump) {
      P.vy = 2.9;
      hunt.jumpedAt = c.jumpAt;
      sfx.play('jump', { gain: 0.4 });
    }
    c.jump = false;
    P.vy -= 9.5 * dt;
    P.y += P.vy * dt;
    if (P.y <= 0) {
      if (!ground && P.vy < -2) sfx.play('land', { gain: Math.min(0.6, -P.vy * 0.12), rate: ice ? 1.5 : 1 });
      if (!ground) sfx.step(season === 'winter' ? 'snow' : 'grass', { gain: 0.45 });
      P.y = 0;
      P.vy = 0;
    }
    const v = Math.hypot(P.vx, P.vz);
    P.walk = P.y > 0 ? 0 : Math.min(1, v / 2.5);
    const before = Math.floor(P.step / Math.PI);
    P.step += dt * v * 2.6;
    // a footstep each stride (each dip of the head's bob): grass, or snow in winter
    if (P.y <= 0 && Math.floor(P.step / Math.PI) !== before && v > 0.6) sfx.step(season === 'winter' ? 'snow' : 'grass', { gain: 0.3 + Math.min(0.25, v * 0.05) });
    // wading: rings spreading from your legs as you go, a splash with each stride, a big one jumping in
    if (wet) {
      wading.ring -= dt;
      const fx = -sy * 0.18;
      const fz = -cy * 0.18;
      if (wading.dry || wading.air) {
        ripple(P.x, P.z, 1);
        ripple(P.x + fx, P.z + fz, 0.7);
        puffs?.burst(tv.set(P.x - sy * 0.35, 0.04, P.z - cy * 0.35), SPLASH, false, wading.air ? 26 : 16);
        sfx.play('splash', { gain: wading.air ? 0.7 : 0.4 });
        wading.ring = 0.3;
      } else if ((v > 0.35 && wading.ring <= 0) || wading.ring < -1.4) {
        ripple(P.x - sy * 0.5, P.z - cy * 0.5, 0.45 + 0.45 * Math.min(1, v / 3));
        if (v > 0.35) puffs?.burst(tv.set(P.x - sy * 0.6, 0.03, P.z - cy * 0.6), SPLASH, false, 7 + Math.round(v * 2));
        wading.ring = 0.36 - 0.14 * Math.min(1, v / 4);
      }
    }
    wading.dry = !(wd < 0) || ice;
    wading.air = P.y > 0;
    // the shot kicks the view up a little, and it settles back; the spread blooms with each shot and settles
    P.kick *= Math.exp(-dt * 9);
    hunt.recoil *= Math.exp(-dt * 3.2);
    const pitch = P.pitch + P.kick;
    camera.rotation.set(0, P.yaw, 0);
    camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan((size.fovH * K0) / 2 / zoom));
    camera.updateProjectionMatrix();
    // looking up and down: a shear of the picture (verticals stay vertical), never a tilt of the camera
    const pm = camera.projectionMatrix;
    pm.elements[9] = Math.tan(pitch) * pm.elements[5];
    camera.projectionMatrixInverse.copy(pm).invert();
    tiltPx = ((Math.tan(pitch) * zoom) / K0) * (size.H / size.fovH);
    panPx = ((P.yaw * zoom) / K0) * (size.H / size.fovH);
    // how wide a shot goes: still and scoped, it goes where you look; on the move, in the air, from the hip, it
    // goes wide; the shotgun's pellets spread anyway
    const moving = Math.min(1.5, v / RUN.rifle);
    const air = P.y > 0 ? 1 : 0;
    hunt.spread =
      a.current === 'rifle'
        ? (scoped > 0.9 ? 0.0006 : 0.05) + moving * (scoped > 0.9 ? 0.018 : 0.04) + air * 0.12 + hunt.recoil
        : a.current === 'shotgun'
          ? 0.068 - aimT * 0.03 + moving * 0.02 + air * 0.05 + hunt.recoil * 0.5
          : 0;
    // the trigger; the knife keeps slashing while the button is held, its right button stabs
    if (!paused) {
      if (a.current === 'knife') {
        if ((c.fire || c.fireHeld) && a.ready && a.trigger(false)) swing(false);
        else if (c.alt && a.ready && a.trigger(true)) swing(true);
      } else if (c.fire && a.trigger()) shoot(pitch);
    }
    c.fire = false;
    c.alt = false;
    return eye.set(P.x, EYE + P.y - depth * 0.2 + Math.sin(P.step * 2) * 0.02 * P.walk * (1 - aimT), P.z);
  }

  type Hit = { b: Beast; t: number; head: boolean };
  /**
   * Every animal along a shot from your eye, nearest first: the shot is a ray straight out from the middle of the
   * view, turned by `dyaw` and tipped by `dpitch` (its spread), up to `max` away. A couple of screen pixels' grace
   * all round, so small things far off are still fair to hit; a smaller target, the head, for a headshot.
   */
  function shotHits(pitch: number, dyaw: number, dpitch: number, max: number): Hit[] {
    if (!fauna) return [];
    const cam = camera.position;
    const yaw = P.yaw + dyaw;
    const fx = -Math.sin(yaw);
    const fz = -Math.cos(yaw);
    const tanP = Math.tan(pitch + dpitch);
    const out: Hit[] = [];
    for (const b of fauna.beasts) {
      if (b.dead > 0) continue;
      const ox = b.x - cam.x;
      const oz = b.z - cam.z;
      const depth = ox * fx + oz * fz;
      if (depth < 0.2 || depth > max) continue;
      const side = ox * -fz + oz * fx;
      const s = b.scale;
      const [hl, ht, hw] = b.def.box;
      const across = Math.abs(Math.sin(b.head - Math.atan2(fz, fx))) * hl * s + Math.abs(Math.cos(b.head - Math.atan2(fz, fx))) * hw * s;
      const tol = ((b.def.small ? 2.4 : 1.4) * depth * K0) / zoom;
      const ry = cam.y + tanP * depth;
      if (Math.abs(side) > across + tol || ry < b.y - tol || ry > b.y + ht * s + tol) continue;
      fauna.headPos(b, tv);
      const hd = tv.x - cam.x;
      const hz = tv.z - cam.z;
      const hDepth = hd * fx + hz * fz;
      const hSide = hd * -fz + hz * fx;
      const hy = cam.y + tanP * hDepth;
      const head = Math.hypot(hSide, hy - tv.y) < b.def.headR * s + tol * 0.4;
      out.push({ b, t: depth, head });
    }
    return out.sort((p, q) => p.t - q.t);
  }

  /** A kill: points, medals, the burst; birds that were flying, butterflies with a butterfly knife, all of it. */
  function kill(h: Hit, collateral: number, metres: number, knife?: { combo: number; finisher: boolean }) {
    const b = h.b;
    const a = arms!;
    const t = clock;
    hunt.kills++;
    hunt.streak++;
    hunt.chainAt = hunt.chainAt.filter((k) => t - k < 2.2);
    const ys = hunt.yawHist;
    const spun = ys.length > 1 ? ys.reduce((s, [, y], i) => (i ? s + Math.abs(y - ys[i - 1][1]) : 0), 0) : 0;
    const recent = ys.filter(([k]) => t - k < 0.16);
    const flick = recent.length > 1 ? Math.abs(recent[recent.length - 1][1] - recent[0][1]) : 0;
    const fwdx = Math.cos(b.head);
    const fwdz = Math.sin(b.head);
    const tox = P.x - b.x;
    const toz = P.z - b.z;
    const backstab = (fwdx * tox + fwdz * toz) / (Math.hypot(tox, toz) || 1) < -0.35;
    const list = medals({
      weapon: a.current,
      aim: aimT,
      scopedFor: hunt.scopedAt > 0 ? t - hunt.scopedAt : 99,
      metres,
      airborne: P.y > 0.05,
      speed: Math.hypot(P.vx, P.vz) / RUN.knife,
      wading: waterDist(P.x, P.z) < 0 && !frozen(P.x, P.z),
      headshot: h.head,
      backstab,
      flying: b.fly > 0 || (!!b.def.flier && b.y > 0.25 && b.sp !== 'butterfly'),
      species: b.sp,
      spun,
      flick,
      collateral,
      chain: hunt.chainAt.length,
      streak: hunt.streak,
      breath: hunt.holding,
      first: hunt.first,
      dark: P.z < -86,
      combo: knife?.combo,
      finisher: knife?.finisher,
    });
    hunt.first = false;
    hunt.chainAt.push(t);
    const { mult, points: pts } = points(list);
    hunt.points += pts;
    // the points are the money at Mira's
    purse.earn(pts);
    purse.streak(hunt.streak);
    hud?.setScore(wallet.get().points, hunt.kills);
    hud?.hit(true);
    if (list.length) hud?.medals(list, mult);
    // the burst: its own colours in little cubes, and a splash of cartoon jam
    const at = fauna!.centre(b, new THREE.Vector3());
    const big = b.def.small ? 0.022 : 0.045;
    voxels?.burst(at, fauna!.colours(b), b.def.small ? 26 : 46, big, 1.6);
    voxels?.burst(at, ['#e0304a', '#ff6a80', '#b81c34', '#ffa0b0'], b.def.small ? 14 : 24, big * 0.7, 2.2, 2.4);
    puffs?.burst(tv.copy(at), ['#ece6d4', '#d8d2c0'], true, 10);
    const ps = placeSound(b.x, b.z);
    sfx.play('burst', { ...ps, gain: ps.gain * 0.8 });
    sfx.play('squeak', { ...ps, rate: b.def.small ? 1.4 : 0.8 });
    sfx.play('kill', { rate: 1 + Math.min(0.6, (mult - 1) * 0.05) });
    if (list.length > 1 || mult >= 2) sfx.play('medal', { at: 0.12, rate: Math.min(1.6, 0.9 + mult * 0.03) });
    tv.copy(at).setY(at.y + b.def.box[1] * b.scale * 0.6).project(camera);
    hud?.plusOne((tv.x * 0.5 + 0.5) * hudFrame.W, (tv.y * 0.5 + 0.5) * hudFrame.H + 10, Math.max(1, Math.round(metres)), pts);
    b.dead = 6 + Math.random() * 8;
  }

  /** Where a shot ended that hit no animal: the trunk, the ground, the water, the snow; its mark and its sound. */
  function impact(pitch: number, dyaw: number, dpitch: number, max: number) {
    const cam = camera.position;
    const yaw = P.yaw + dyaw;
    const fx = -Math.sin(yaw);
    const fz = -Math.cos(yaw);
    const tanP = Math.tan(pitch + dpitch);
    const groundT = tanP < -0.005 ? Math.min(max, cam.y / -tanP) : max;
    const trunk = firstSolid(cam.x, cam.z, fx, fz, groundT, cam.y, tanP);
    if (trunk !== null) {
      const y = cam.y + tanP * trunk;
      if (y > 0 && y < 6) {
        const wall = boxHit;
        const hp = tv.set(cam.x + fx * trunk, y, cam.z + fz * trunk);
        // the mark on the bark (or the cottage's wall), facing back out at you
        const so = wall ? null : nearSolids(hp.x, hp.z).reduce<Solid | null>((best, s) => (!best || Math.hypot(s.x - hp.x, s.z - hp.z) < Math.hypot(best.x - hp.x, best.z - hp.z) ? s : best), null);
        const n = wall ? boxNormal.clone() : so ? new THREE.Vector3(hp.x - so.x, 0, hp.z - so.z).normalize() : new THREE.Vector3(-fx, 0, -fz);
        decals?.add(hp, n, 'bark', 0.07);
        puffs?.burst(hp.clone().addScaledVector(n, 0.03), ['#4a4134', '#615645', '#c8a878', '#e2c898'], false, 14);
        if (season === 'winter' && y > 1.2) puffs?.burst(hp.clone().setY(y + 0.2), ['#ffffff', '#e8eef2'], false, 10);
        const ps = placeSound(hp.x, hp.z);
        sfx.play('wood', { ...ps, rate: 0.9 + Math.random() * 0.2 });
      }
      return;
    }
    if (tanP >= -0.005 || groundT >= max) return;
    const gx = cam.x + fx * groundT;
    const gz = cam.z + fz * groundT;
    const ps = placeSound(gx, gz);
    const up = new THREE.Vector3(0, 1, 0);
    if (waterDist(gx, gz) < 0 && !frozen(gx, gz)) {
      ripple(gx, gz, 1);
      puffs?.burst(tv.set(gx, 0.03, gz), SPLASH, false, 22);
      sfx.play('splash', { ...ps, rate: 1.3 });
      return;
    }
    if (waterDist(gx, gz) < 0) {
      // ice: chips and a star of a crack
      decals?.add(tv.set(gx, 0.015, gz), up, 'snow', 0.09);
      puffs?.burst(tv.set(gx, 0.03, gz), ['#e8f2f8', '#c8dce8', '#ffffff'], false, 16);
      sfx.play('glass', { ...ps, gain: ps.gain * 0.5 });
      return;
    }
    const puddle = PUDDLES.some(([px, pz, rx, rz]) => ((gx - px) / rx) ** 2 + ((gz - pz) / rz) ** 2 < 1);
    if (puddle && season !== 'winter') {
      puffs?.burst(tv.set(gx, 0.03, gz), SPLASH, false, 18);
      sfx.play('water', { ...ps, rate: 1.4 });
      return;
    }
    if (season === 'winter') {
      decals?.add(tv.set(gx, 0.006, gz), up, 'snow', 0.08);
      puffs?.burst(tv.set(gx, 0.03, gz), ['#ffffff', '#eef3f6', '#dfe7ec', '#c4ced8'], true, 18);
      sfx.play('snow', ps);
      return;
    }
    decals?.add(tv.set(gx, 0.006, gz), up, 'earth', 0.07);
    // autumn's leaves jump up where it lands
    const cols = season === 'autumn' && surfaceAt(gx, gz) === 'leaves' ? ['#d48033', '#b55e21', '#dcc54a', '#866b2c', '#3b2f22'] : ['#3b2f22', '#5a4632', '#436433', '#7b9655'];
    puffs?.burst(tv.set(gx, 0.02, gz), cols, false, 20);
    sfx.play('dirt', ps);
  }

  /** The rifle (one bullet, which goes through an animal into the next) or the shotgun (nine pellets). */
  function shoot(pitch: number) {
    const a = arms!;
    const rifle = a.current === 'rifle';
    P.kick += rifle ? (aimT > 0.7 ? 0.03 : 0.05) : 0.075;
    hunt.recoil += rifle ? 0.03 : 0.04;
    hud?.fire();
    const cam = camera.position;
    // every animal for a good way round hears it and bolts
    for (const b of fauna?.beasts ?? []) if (b.dead <= 0 && Math.hypot(b.x - cam.x, b.z - cam.z) < (rifle ? 16 : 11)) startle(b, cam.x, cam.z);
    // Mira ducks when a shot goes anywhere near her (it never touches her)
    if (seller) {
      const fx0 = -Math.sin(P.yaw);
      const fz0 = -Math.cos(P.yaw);
      const ox = MIRA.x - cam.x;
      const oz = MIRA.z - cam.z;
      const along = ox * fx0 + oz * fz0;
      const y = cam.y + Math.tan(pitch) * along;
      if (along > 0 && along < 60 && Math.abs(ox * -fz0 + oz * fx0) < 0.7 && y > -0.2 && y < 1.3) {
        seller.flinch();
        sfx.play('eep', placeSound(MIRA.x, MIRA.z));
      }
    }
    // the computer, straight down the middle
    ray.setFromCamera(new THREE.Vector2(0, 0), camera);
    const pc = props3d.pc ? ray.intersectObject(props3d.pc, false)[0] : undefined;
    const first = shotHits(pitch, 0, 0, 80)[0];
    const animalT = first ? first.t / Math.cos(pitch) : Infinity;
    // Mira's things: the cases, the glass, the cases behind it, the barrel, the sign
    ray.setFromCamera(new THREE.Vector2(0, 0), camera);
    const shop = shopHits();
    const sh0 = shop[0];
    if (sh0 && sh0.h.distance < animalT && sh0.h.distance < (pc?.distance ?? Infinity)) {
      if (sh0.sign) swingSign(-Math.cos(P.yaw), sh0.h);
      else if (sh0.b) {
        smash(sh0.b);
        // a rifle bullet goes on through the glass into the case on the shelf behind it
        if (rifle && sh0.b.kind === 'glass') {
          const next = shop.find((x) => x.b && x.b.kind === 'shelf');
          if (next?.b) smash(next.b);
        }
      }
      hud?.hit();
      return;
    }
    if (pc && pc.distance < animalT) {
      const t = texelAt(CLEARING.camZ - CLEARING.computer.z);
      const ix = (pc.point.x - CLEARING.computer.x) / t + COMPUTER.ax - COMPUTER.screen.x;
      const iy = COMPUTER.ay - pc.point.y / t - COMPUTER.screen.y;
      const onGlass = ix >= 0 && iy >= 0 && ix < COMPUTER.screen.w && iy < COMPUTER.screen.h && pc.point.z > CLEARING.computer.z - 0.05;
      if (onGlass && !screenBroken) {
        breakScreen(ix, iy, pc.point);
        sfx.play('glass');
      } else {
        puffs?.burst(tv.copy(pc.point), ['#fff6c8', '#f2d36a', '#d9d2bc', '#857c68'], false, 14);
        decals?.add(pc.point, pc.face?.normal ?? new THREE.Vector3(0, 0, 1), 'metal', 0.05);
        sfx.play('metal', placeSound(pc.point.x, pc.point.z));
      }
      hud?.hit();
      return;
    }
    const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;
    const pellets = rifle ? 1 : 9;
    const killed = new Set<Beast>();
    let any = false;
    for (let k = 0; k < pellets; k++) {
      const dy = gauss() * hunt.spread;
      const dp = gauss() * hunt.spread;
      const range = rifle ? 120 : 30;
      const hits = shotHits(pitch, dy, dp, range);
      // the rifle's bullet goes on through, up to three; a pellet stops in the first animal it meets
      const through = rifle ? hits.slice(0, 3) : hits.slice(0, 1);
      // anything in the way stops it: a trunk
      const fx = -Math.sin(P.yaw + dy);
      const fz = -Math.cos(P.yaw + dy);
      const trunk = firstSolid(cam.x, cam.z, fx, fz, range, cam.y, Math.tan(pitch + dp));
      const live = through.filter((h) => trunk === null || h.t < trunk);
      if (!live.length) {
        if (rifle || k % 3 === 0) impact(pitch, dy, dp, range);
        continue;
      }
      any = true;
      live.forEach((h) => {
        if (killed.has(h.b)) return;
        killed.add(h.b);
        kill(h, rifle ? live.length - 1 : 0, h.t * (1.65 / EYE));
      });
    }
    if (any) {
      hud?.hit(true);
      sfx.play('hit', { gain: 0.7 });
    } else hunt.streak = 0;
  }

  /** The knife: a slash, or (heavier, slower, further) a stab, at whatever is just in front of you. */
  function swing(heavy: boolean) {
    if (!fauna) return;
    const kind = heavy ? 'stab' : arms!.swing;
    // the jab reaches a little further, the finisher sweeps wide round you and can take more than one
    const reach = heavy ? 1.5 : kind === 'spin' ? 1.55 : kind === 'jab' ? 1.35 : 1.2;
    const arc = kind === 'spin' ? 0.2 : kind === 'jab' ? 0.85 : 0.72;
    const fx = -Math.sin(P.yaw);
    const fz = -Math.cos(P.yaw);
    const inReach: [Beast, number][] = [];
    for (const b of fauna.beasts) {
      if (b.dead > 0) continue;
      const dx = b.x - P.x;
      const dz = b.z - P.z;
      const d = Math.hypot(dx, dz);
      // in front of you, within the swing's arc, and about the height of your arm (or lower)
      if (d > reach || (dx * fx + dz * fz) / (d || 1) < arc || b.y > 1.1 + P.y) continue;
      inReach.push([b, d]);
    }
    inReach.sort((p, q) => p[1] - q[1]);
    const best = inReach[0]?.[0] ?? null;
    const bd = inReach[0]?.[1] ?? reach;
    const extra = heavy ? undefined : { combo: arms!.combo, finisher: kind === 'spin' };
    if (best && kind === 'spin') for (const [b, d] of inReach.slice(1, 3)) kill({ b, t: d, head: false }, 0, d * (1.65 / EYE), extra);
    if (!best) {
      // Mira's things, cut (or the sign knocked swinging)
      ray.setFromCamera(new THREE.Vector2(0, 0), camera);
      const cut = shopHits(reach + 0.35)[0];
      if (cut) {
        if (cut.sign) swingSign(-Math.cos(P.yaw));
        else if (cut.b) smash(cut.b);
        return;
      }
      // the blade into a trunk
      const trunk = firstSolid(P.x, P.z, fx, fz, reach);
      if (trunk !== null) {
        sfx.play('wood', { rate: 1.4, gain: 0.6, at: 0.08 });
        puffs?.burst(tv.set(P.x + fx * trunk, EYE * 0.8, P.z + fz * trunk), ['#4a4134', '#c8a878'], false, 8);
      }
      return;
    }
    setTimeout(() => sfx.play('stab', { gain: 0.8 }), heavy ? 280 : 120);
    kill({ b: best, t: bd, head: false }, 0, bd * (1.65 / EYE), extra);
  }

  /** An animal hears you or sees you: it bolts away from (x, z), and birds take off. */
  function startle(b: Beast, x: number, z: number) {
    if (b.flee > 0 || b.fly > 0) return;
    b.flee = 1.8 + Math.random() * 0.8;
    b.state = 'move';
    b.t = b.flee;
    b.alert = 1;
    b.want = Math.atan2(b.z - z, b.x - x) + (Math.random() - 0.5) * 0.8;
    b.head = b.want;
    if (b.def.flier && b.sp !== 'butterfly') {
      b.fly = 0.01;
      sfx.play('flap', placeSound(b.x, b.z));
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
    // Mira, at her stall: close and looking her way
    const mx = MIRA.x - P.x;
    const mz = MIRA.z - P.z;
    const md = Math.hypot(mx, mz);
    const atMira = md < 2.4 && (mx * fx + mz * fz) / Math.max(md, 1e-3) > 0.3;
    const next = paused ? null : atMira ? 'Talk to Mira · cases & skins' : best >= 0 ? `Insert “${projects[best].title}”` : atPc ? `Eject “${projects[loaded!].title}”` : null;
    if (next !== prompt) {
      prompt = next;
      forest.set({ prompt });
    }
    if (c.use) {
      c.use = false;
      if (paused) return;
      if (atMira) openPanel('shop');
      else if (best >= 0) forest.set({ selected: best });
      else if (atPc) forest.set({ selected: null });
    }
  }

  /**
   * An animal hit: it bursts into its own pixels in pieces that tumble, bounce and lie
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
  function respawn(b: Beast) {
    const cam = camera.position;
    for (let i = 0; i < 60; i++) {
      const x = BOUNDS.x0 + 2 + Math.random() * (BOUNDS.x1 - BOUNDS.x0 - 4);
      const z = BOUNDS.z0 + 2 + Math.random() * (BOUNDS.z1 - BOUNDS.z0 - 4);
      if (waterDist(x, z) < 0.8 || Math.hypot(x - cam.x, z - cam.z) < 14) continue;
      b.x = x;
      b.z = z;
      b.home = [x, z];
      break;
    }
    Object.assign(b, { y: b.sp === 'butterfly' ? 0.4 : 0, fly: 0, flee: 0, dead: 0, alert: 0, state: 'idle', t: 1 + Math.random() });
  }

  /**
   * The animals in pill mode: they wander and graze, look up when you come near, bolt when you get close (or
   * shoot), birds take off and fly away over the trees, butterflies flutter about over the grass and never land.
   */
  function updateFauna(dt: number, now: number) {
    if (!fauna) return;
    const cam = camera.position;
    for (const b of fauna.beasts) {
      if (b.dead > 0) {
        b.dead -= dt;
        if (b.dead <= 0) respawn(b);
        continue;
      }
      const dx = b.x - cam.x;
      const dz = b.z - cam.z;
      const d2 = dx * dx + dz * dz;
      const shy = b.sp === 'deer' ? 42 : b.def.flier ? 14 : 9;
      if (d2 < shy * 1.8) b.alert = Math.min(1, b.alert + dt * 2);
      else b.alert = Math.max(0, b.alert - dt);
      if (d2 < shy && b.flee <= 0 && b.fly === 0 && b.sp !== 'butterfly') startle(b, cam.x, cam.z);
      b.flee -= dt;
      b.t -= dt;
      if (b.fly > 0) {
        // flown off: up, away, over the trees, and back later somewhere else
        b.fly += dt;
        b.y += dt * (0.8 + b.fly * 0.9);
        b.x += Math.cos(b.head) * 2.6 * dt;
        b.z += Math.sin(b.head) * 2.6 * dt;
        b.phase += dt * 20;
        if (b.y > 4.5) b.dead = 4 + Math.random() * 5;
        continue;
      }
      if (b.sp === 'butterfly') {
        // a butterfly's wandering flight: a lazy curve, a bob, now and then a dart
        b.want += (Math.sin(now * 0.7 + b.phase) * 1.4 + (Math.random() - 0.5) * 2) * dt;
        b.head += (b.want - b.head) * Math.min(1, dt * 3);
        const sp = d2 < 4 ? 1.6 : 0.6;
        const nx = b.x + Math.cos(b.head) * sp * dt;
        const nz = b.z + Math.sin(b.head) * sp * dt;
        if (inBounds(nx, nz, 0.5)) {
          b.x = nx;
          b.z = nz;
        } else b.want += Math.PI;
        b.y = 0.35 + Math.sin(now * 2.3 + b.phase) * 0.15 + Math.sin(now * 5.1 + b.phase * 2) * 0.05;
        b.state = 'move';
        continue;
      }
      if (b.t <= 0) {
        if (b.state === 'idle') {
          b.state = 'move';
          b.t = 0.6 + Math.random() * 1.8;
          const hx = b.home[0] - b.x;
          const hz = b.home[1] - b.z;
          b.want = hx * hx + hz * hz > 20 ? Math.atan2(hz, hx) : b.head + (Math.random() - 0.5) * 2.6;
        } else {
          b.state = 'idle';
          b.t = 0.8 + Math.random() * 3;
        }
      }
      // turning towards where it wants to go, not snapping round
      let dh = b.want - b.head;
      dh = Math.atan2(Math.sin(dh), Math.cos(dh));
      b.head += dh * Math.min(1, dt * (b.flee > 0 ? 10 : 4));
      if (b.state === 'move') {
        const sp = b.def.speed * 0.45 * (b.flee > 0 ? 2.8 : 1);
        const nx = b.x + Math.cos(b.head) * sp * dt;
        const nz = b.z + Math.sin(b.head) * sp * dt;
        const blocked = (waterDist(nx, nz) < 0.3 && !frozen(nx, nz)) || !inBounds(nx, nz, 0.5) || nearSolids(nx, nz).some((s) => Math.hypot(s.x - nx, s.z - nz) < s.r + 0.08) || COTTAGE_BOXES.some((c) => !c.off && nx > c.x0 - 0.1 && nx < c.x1 + 0.1 && nz > c.z0 - 0.1 && nz < c.z1 + 0.1);
        if (blocked) b.want = b.head + Math.PI * (0.6 + Math.random() * 0.5);
        else {
          b.x = nx;
          b.z = nz;
        }
        b.phase += dt * (b.def.hop ? 9 : 12) * (b.flee > 0 ? 1.7 : 1);
      } else b.phase += dt * 1.2;
    }
    fauna.sync(now);
  }

  function updatePlayWorld(dt: number, now: number) {
    if (water) {
      const wu = water.material.uniforms;
      wu.time.value = now;
      wu.res.value.set(size.W, size.H);
    }
    puffs?.update(dt);
    voxels?.update(dt);
    decals?.update(dt);
    updateGibs(dt);
    updateMira(dt, now);
    updateShop(dt);
  }

  /** Mira at her stall, and the line she says over it as you come near. */
  function updateMira(dt: number, now: number) {
    if (!seller) return;
    const panel = forest.get().panel;
    seller.talking = panel === 'shop';
    seller.update(dt, now, P.x, P.z, EYE + P.y);
    const dx = MIRA.x - P.x;
    const dz = MIRA.z - P.z;
    const d = Math.hypot(dx, dz);
    if (d < 4.5 && !miraNear) {
      miraNear = true;
      seller.wave();
      sfx.play('hello', placeSound(MIRA.x, MIRA.z));
    } else if (d > 6.5) miraNear = false;
    const fx = -Math.sin(P.yaw);
    const fz = -Math.cos(P.yaw);
    const ahead = (dx * fx + dz * fz) / Math.max(d, 1e-3);
    pinPoint($('mira-say'), MIRA.x, 0.9, MIRA.z, d < 7.5 && d > 0.6 && ahead > 0.35 && !paused && panel === null);
  }

  /**
   * After the fog: the weapon (its own pass, laid over the view), then the scope's glass if it's up, then the
   * flat HUD. The blit shows whichever frame ends up with all of it.
   */
  function drawHud(dt: number) {
    if (!hud || !controls || !arms || !scope || !lens) return;
    const a = arms;
    const scoped = a.current === 'rifle' && aimT > 0.75;
    const shade = Math.min(1.05, 0.42 + air.ambient * 0.62);
    a.update(dt, { W: size.W, H: size.H, walk: P.walk, shade, aim: aimT, turn: lastTurn, visible: !paused && !scoped, air: P.y > 0 ? Math.min(1, P.vy * 0.4) : 0, fine: size.H / size.fovH });
    if (!paused && !scoped) a.render(renderer, fogged);
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
      su.shift.value.set(Math.round(scopeSway.x), Math.round(scopeSway.y - a.kick * 16));
      tv.set(-SUN[0], -SUN[1], -SUN[2]).applyQuaternion(camera.quaternion.clone().invert());
      su.sun.value.set(tv.x, tv.y, 0.25 + Math.max(0, -tv.z) * 0.75);
      su.shade.value = shade;
      renderer.setRenderTarget(lens);
      renderer.render(scope.scene, postCam);
      out = lens;
    } else scopeSway.set(0, 0);
    // the HUD is drawn in the wood's own chunky pixels whatever the frame's are: with finer pixels it gets its own
    // frame at the chunky size, laid over the finished picture at a whole-number scale (so it never shrinks)
    const hs = Math.max(1, Math.round(Math.min(size.devW, size.devH) / SHORT_SIDE));
    const own = hs !== size.scale;
    hudFrame.W = own ? Math.ceil(size.devW / hs) : size.W;
    hudFrame.H = own ? Math.ceil(size.devH / hs) : size.H;
    const k = hudFrame.W / size.W;
    const hOffX = (hudFrame.W * hs - size.devW) / 2;
    const hOffY = (hudFrame.H * hs - size.devH) / 2;
    const st = controls.stick;
    const toG = (x: number, y: number): [number, number] => [(x * size.devW) / size.cssW / hs + hOffX / hs, hudFrame.H - ((y * size.devH) / size.cssH + hOffY) / hs];
    let stick = null;
    if (st.id >= 0) {
      const [x0, y0] = toG(st.x0, st.y0);
      const [x, y] = toG(st.x, st.y);
      stick = { on: true, x0, y0, x, y };
    }
    // the crosshair's gap: the spread in (the HUD's) screen pixels
    const pxPerRad = (size.H / 2 / Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)) * k;
    const hv = Math.hypot(P.vx, P.vz);
    const S = settings.get();
    hud.setScore(wallet.get().points, hunt.kills);
    // the weapons always wear what's equipped (checked every frame: nothing can leave an old skin on)
    applySkins();
    // what the page's hotbar and hints need to know, told only when it changes
    const fs0 = forest.get();
    const aiming = aimT > 0.75;
    if (fs0.weapon !== a.current || fs0.ammo.rifle !== a.ammo.rifle || fs0.ammo.shotgun !== a.ammo.shotgun || fs0.aiming !== aiming) forest.set({ weapon: a.current, ammo: { ...a.ammo }, aiming });
    const [mx, my] = a.muzzle(size.W, size.H);
    hud.update(dt, {
      W: hudFrame.W,
      H: hudFrame.H,
      hot: !paused && shotHits(P.pitch + P.kick, 0, 0, a.current === 'knife' ? 1.5 : 80).length > 0,
      show: !paused,
      aim: aimT,
      muzzle: [mx * k, my * k],
      stick,
      weapon: a.current,
      gap: a.current === 'knife' ? 0 : hunt.spread * pxPerRad * (a.current === 'shotgun' ? 1 : 0.7),
      ammo: a.current === 'knife' ? null : [a.ammo[a.current], a.max[a.current]],
      reloading: a.action === 'reload',
      breath: scoped ? { left: hunt.breath, tired: hunt.tired > 0, holding: hunt.holding } : null,
      speed: hv > RUN.knife * 1.1 ? (hv / RUN.knife) * 250 : null,
      hints: S.hints,
      cross: hex(CROSS_COLORS[S.crosshair]),
      speedo: S.speedo,
    });
    hudFrame.own = own;
    if (!own) {
      renderer.setRenderTarget(out);
      renderer.autoClear = false;
      renderer.render(hud.scene, hud.cam);
      renderer.autoClear = true;
    } else {
      if (hudTarget.width !== hudFrame.W || hudTarget.height !== hudFrame.H) hudTarget.setSize(hudFrame.W, hudFrame.H);
      const color = renderer.getClearColor(new THREE.Color());
      const alpha = renderer.getClearAlpha();
      renderer.setRenderTarget(hudTarget);
      renderer.setClearColor(0x000000, 0);
      renderer.clear();
      renderer.render(hud.scene, hud.cam);
      renderer.setClearColor(color, alpha);
      const hu = hudOverlay.material.uniforms;
      hu.lowRes.value.set(hudFrame.W, hudFrame.H);
      hu.scale.value = hs;
      hu.offset.value.set(Math.floor(hOffX), Math.floor(hOffY));
    }
    blit.material.uniforms.frame.value = out.texture;
  }
  /** The HUD's own frame (in the wood's chunky pixels), when the picture's pixels are finer. */
  const hudFrame = { W: 1, H: 1, own: false };
  const hudTarget = new THREE.WebGLRenderTarget(4, 4, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, generateMipmaps: false, depthBuffer: false });
  const hudOverlay = overlayMesh(hudTarget.texture);
  const hudScene = new THREE.Scene();
  hudScene.add(hudOverlay);

  // --- the loop -----------------------------------------------------------------------------------------
  let ready = false;
  const slowFrames: [number, number, number][] = [];
  let readyAt = 0;
  const timing = { start: Math.round(performance.now()), paint: [] as number[], paintedAt: 0, warmUp: 0, receive: [] as [string, number][] };
  Object.assign(window, { __slowFrames: slowFrames, __timing: timing });
  let raf = 0;
  const base = new THREE.Vector3();

  function cameraAt(s: number) {
    // above the clearing the camera already stands at the computer, still: the page burns away to show it
    if (s <= stages.a) base.set(size.restX, CLEARING.camY, CLEARING.camZ);
    else if (s <= stages.b) base.set(size.restX, CLEARING.camY, CLEARING.camZ);
    // out of the clearing it sets off at once, and slows only as it reaches the cat
    else base.copy(leave.getPointAt(easeAway(clamp01((s - stages.b) / (stages.c - stages.b)))));
    return base;
  }

  // --- the big screen: the camera dives into the monitor until its glass (the project's video) fills the window --
  const lean = { p: 0 };
  /** How far past the window the glass reaches once you're inside it, so its round corners stay out of sight. */
  const OVERSCAN = 1.06;
  /** Game pixels per texel of the glass once you're inside it: enough for it to cover the whole window. */
  const insideM = () => Math.max(size.W / COMPUTER.screen.w, size.H / COMPUTER.screen.h) * OVERSCAN;
  const leanAt = new THREE.Vector3();
  const leaned = new THREE.Vector3();
  /**
   * Where the camera looks from while the big screen is up (or on its way): a straight dolly from the walk's view
   * into the glass until it covers the window, eased by the log of the distance so the zoom feels even. The camera
   * only moves, never turns, like everywhere on the walk.
   */
  function leanIn(at: THREE.Vector3, dt: number) {
    const want = forest.get().full && !playing;
    const step = reduced ? 1 : dt / (want ? 1.15 : 0.8);
    lean.p = want ? Math.min(1, lean.p + step) : Math.max(0, lean.p - step);
    if (lean.p <= 0) return at;
    const dc = CLEARING.camZ - CLEARING.computer.z;
    const t = texelAt(dc);
    const sc = COMPUTER.screen;
    const gx = CLEARING.computer.x + (sc.x + sc.w / 2 - COMPUTER.ax) * t;
    const gy = (COMPUTER.ay - sc.y - sc.h / 2) * t;
    const gz = CLEARING.computer.z + 0.01;
    // into the screen: the glass ends up covering the whole window, centred, its edges just past the window's;
    // a texel is dc/D game pixels seen from D away (the wood is painted for the clearing's own view)
    const D1 = (dc * size.H) / (insideM() * size.fovH);
    leanAt.set(gx, gy, gz + D1);
    const D0 = Math.max(D1 + 1e-3, at.z - gz);
    const D = D0 * Math.pow(D1 / D0, easeInOut(lean.p));
    const f = (D0 - D) / (D0 - D1);
    return leaned.set(at.x + (leanAt.x - at.x) * f, at.y + (leanAt.y - at.y) * f, gz + D);
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
  let wasInWood = false;

  // the shadow camera follows you, snapped to its own texels so shadows don't crawl
  const lf = new THREE.Vector3();
  const lr = new THREE.Vector3();
  const lu = new THREE.Vector3();
  const focus = new THREE.Vector3();
  const bias = new THREE.Matrix4().set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
  const lastFocus = new THREE.Vector3(Infinity, 0, 0);
  const farFocus = new THREE.Vector3();
  const lastFar = new THREE.Vector3(Infinity, 0, 0);
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
    const nearDue = !(focus.equals(lastFocus) && shadowFrame % 8 !== 0);
    // pill mode's coarse map over the whole wood: redrawn once you've gone a good way, and now and then
    light.farOn.value = playing ? 1 : 0;
    let farDue = false;
    if (playing) {
      farFocus.set(Math.round(camera.position.x / 12) * 12, 1.5, Math.round(camera.position.z / 12) * 12);
      farDue = !farFocus.equals(lastFar) || shadowFrame % 240 === 0;
    }
    if (!nearDue && !farDue) return;
    if (nearDue) {
      lastFocus.copy(focus);
      sunCam.up.copy(lu);
      sunCam.position.copy(focus).addScaledVector(lf, -70);
      sunCam.lookAt(focus);
      sunCam.updateMatrixWorld();
    }
    const hidden: LayerMesh[] = [];
    for (const m of layers) {
      if (m.userData.caster) m.material = m.userData.depth;
      else if (m.visible) {
        m.visible = false;
        hidden.push(m);
      }
    }
    sky.visible = false;
    weather.group.visible = false;
    if (floor) floor.visible = false;
    if (dust) dust.visible = false;
    led.visible = false;
    if (water) water.visible = false;
    const puffsOn = puffs?.points.visible ?? false;
    if (puffs) puffs.points.visible = false;
    // the animals' pieces and their spray read the shadow map, so they mustn't draw into it
    for (const g of gibs) g.sh.mesh.visible = g.sh.spray.points.visible = false;
    fauna?.useDepth(true);
    const effects = [voxels?.mesh, decals?.mesh].filter(Boolean) as THREE.Object3D[];
    const effectsOn = effects.map((m) => m.visible);
    for (const m of effects) m.visible = false;
    if (nearDue) {
      renderer.setRenderTarget(shadow);
      renderer.render(scene, sunCam);
      light.shadowMatrix.value.copy(bias).multiply(sunCam.projectionMatrix).multiply(sunCam.matrixWorldInverse);
    }
    if (farDue) {
      lastFar.copy(farFocus);
      // the animals move about: leave them out of the coarse map (it's only for what's far off)
      const animals = fauna?.group.visible ?? false;
      if (fauna) fauna.group.visible = false;
      sunFar.up.copy(lu);
      sunFar.position.copy(farFocus).addScaledVector(lf, -100);
      sunFar.lookAt(farFocus);
      sunFar.updateMatrixWorld();
      renderer.setRenderTarget(farShadow);
      renderer.render(scene, sunFar);
      if (fauna) fauna.group.visible = animals;
      light.shadowFarMatrix.value.copy(bias).multiply(sunFar.projectionMatrix).multiply(sunFar.matrixWorldInverse);
    }
    fauna?.useDepth(false);
    effects.forEach((m, i) => (m.visible = effectsOn[i]));
    for (const m of layers) m.material = m.userData.lit;
    for (const m of hidden) m.visible = true;
    sky.visible = true;
    weather.group.visible = true;
    if (floor) floor.visible = true;
    if (dust) dust.visible = true;
    led.visible = true;
    if (water) water.visible = playing;
    if (puffs) puffs.points.visible = puffsOn;
    for (const g of gibs) g.sh.mesh.visible = g.sh.spray.points.visible = true;
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
    weather.group.visible = false;
    if (flora) flora.visible = false;
    renderer.setRenderTarget(mirrored);
    renderer.render(scene, mirrorCam);
    weather.group.visible = true;
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
    let discsOn = false;
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
      // at the computer, and scrolled down to it: above the clearing the camera already stands there too (the page
      // over it burns away to show it), but the discs, the links and the video wait until you've arrived
      at = follow(target, dt, !(Math.abs(s - from) < window.innerHeight * 1.5));
      atClearing = Math.abs(target.z - CLEARING.camZ) < 0.6 && s >= stages.a - window.innerHeight * 0.04;
      // the discs stay yours to pick while you can still see them: a little either side of the clearing too
      discsOn = s >= stages.a - window.innerHeight * 0.2 && (Math.abs(target.z - CLEARING.camZ) < 0.6 || Math.abs(at.z - CLEARING.camZ) < 1.6);
    }

    camera.position.copy(playing ? at : leanIn(at, dt));
    camera.updateMatrixWorld();
    const arrival = arrivals.shift();
    if (arrival) receive(arrival);
    else if (warmAfter) {
      warmAfter = false;
      warmUp();
    }

    airAt(at.z);
    if (playing) {
      air.ambient = still.ambient;
      air.sun = still.sun;
    }
    light.ambient.value.setScalar(air.ambient);
    light.sunColor.value.set(SUN_TINT[season][0], SUN_TINT[season][1], SUN_TINT[season][2]).multiplyScalar(air.sun);
    weather.update(now, camera.position, playing);
    const on = loaded !== null && discs[loaded]?.t === 1;
    light.lampPos.value.set(slot.x - 0.1, 0.45, CLEARING.computer.z + 0.25, on ? 0.55 : 0.14);
    light.lampColor.value.set(0.55, 0.78, 0.62);
    (led.material as THREE.MeshBasicMaterial).color.setHex(on ? (Math.floor(now / 0.09) % 7 === 0 ? 0x2f6b2c : 0x6fcf4e) : 0x1f241d);
    const fu = fog.material.uniforms;
    fu.fogColor.value.copy(air.fog);
    fu.density.value = air.density;
    fu.falloff.value = air.falloff;
    fu.shafts.value = air.shafts;
    fu.zoned.value = playing ? 1 : 0;
    fogMirror.material.uniforms.zoned.value = fu.zoned.value;
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
      updateFauna(dt, now);
      updatePlayWorld(dt, now);
      updateProps();
      updatePrompt();
    } else {
      updateCritters(dt, now);
    }
    if (dust) (dust.material as THREE.ShaderMaterial).uniforms.time.value = now;
    if (cat.mesh && cat.open && cat.shut) {
      const cycle = now % 4.2;
      cat.mesh.material.uniforms.map.value = cycle > 4.02 || (cycle > 3.78 && cycle < 3.9) ? cat.shut : cat.open;
    }
    // leaning in to the big screen, the discs aren't yours to pick
    if (!playing) placePins(atClearing, lean.p === 0 && at.z < -40 && at.z > -78, discsOn && lean.p === 0);

    // the page covers the wood until you get to it: draw nothing until then (it's the phone's battery);
    // "in the wood" (for the loading screen and the sound) once the white has started to fall away
    const drawing = playing || !!trans || s > stages.start - window.innerHeight * 0.25;
    const inWood = playing || s > stages.start + (stages.walk - stages.start) * 0.45;
    if (inWood !== wasInWood) {
      wasInWood = inWood;
      if (inWood) document.documentElement.dataset.inWood = '';
      else delete document.documentElement.dataset.inWood;
      sfx.bed('wood', inWood && ready, 0.8, season);
    }
    if (!drawing) return;

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
    // the HUD, in its own chunky pixels, over the finer picture
    if (playing && hudFrame.own) {
      renderer.autoClear = false;
      renderer.render(hudScene, postCam);
      renderer.autoClear = true;
    }
    if (playing) return;
    // the floppies' labels, sharp, over the pixels, through the same camera and the same crop
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
    if (!ready && hero && planted && (hung || textGaveUp)) markReady();
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
    tryReady();
  }, 900);
  // a disposed forest must never touch the GL context again: the next one shares it (strict mode builds the
  // forest twice), and a stray upload changes GL state behind the new renderer's back (it flipped the name)
  let disposed = false;
  (document.fonts?.ready ?? Promise.resolve()).then(() => {
    if (disposed) return;
    clearTimeout(fontWait);
    hung = true;
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
  if (process.env.NODE_ENV !== 'production') Object.assign(window, { __forest: { camera, stages, size, scene, layers, fog: fog.material.uniforms, light, atmos, renderer, main, fogged, P, store: forest, critters, play: () => ({ playing, hunt, controls, arms, fauna, solids }) } });

  return {
    measure,
    dispose() {
      disposed = true;
      unwatch.forEach((f) => f());
      sfx.bed('wood', false);
      delete document.documentElement.dataset.inWood;
      cancelAnimationFrame(raf);
      controls?.detach();
      clearTimeout(fontWait);
      painterInbox.listener = null;
      ro.disconnect();
      window.removeEventListener('resize', onLayout);
      window.visualViewport?.removeEventListener('resize', onLayout);
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
      farShadow.dispose();
      hudTarget.dispose();
      renderer.dispose();
    },
  };
}
