import * as THREE from 'three';
import { hash2 } from '@/scene/pix';
import { posies } from './posies';

/**
 * The name in the landing, in three.js: "ryhox" painted sharp at full resolution, dressed with its posies, given a
 * little depth, floating. It is cut into shards (glass-like triangles, each carrying its piece of the letters and
 * flowers) that sit flush, so whole it is just the word; the scroll shakes it and bursts it, a letter at a time from
 * the middle outwards, every shard tumbling away in 3D and lit as it turns. Everything after the cut is the shader's,
 * as a function of the scroll, so scrolling back puts the name together again.
 */

const LAYERS = 22;
/** When each letter goes (the scroll through the landing), the middle one first. */
export const burstAt = (letter: number) => 0.3 + Math.abs(letter - 2) * 0.07;

const VERT = /* glsl */ `
  attribute vec3 aCenter;
  attribute vec3 aDir;
  attribute vec3 aAxis;
  attribute vec2 aSpin;
  attribute float aLetter;
  attribute float aLayer;
  uniform float uP;
  uniform float uTime;
  uniform float uShake;
  uniform float uThick;
  uniform float uFall;
  uniform float uNear;
  uniform float uHop[5];
  varying vec2 vUv;
  varying float vShade;
  varying float vFade;
  varying float vLayer;
  varying float vLetter;

  vec3 turn(vec3 v, vec3 axis, float a) {
    float c = cos(a), s = sin(a);
    return v * c + cross(axis, v) * s + axis * dot(axis, v) * (1.0 - c);
  }

  void main() {
    vUv = uv;
    vLayer = aLayer;
    vLetter = aLetter;
    float start = aSpin.y;
    float age = max(0.0, uP - start) * 1.6;
    // once it's flying, a shard is a thin sliver: the depth behind it folds into its face
    float depth = 1.0 - smoothstep(0.0, 0.09, age);
    if (aLayer > 0.5 && depth <= 0.0) {
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      return;
    }
    vec3 local = position;
    local.z -= aLayer * uThick * depth;
    vec3 n = vec3(0.0, 0.0, 1.0);
    vec3 c = aCenter;
    c.y += uHop[int(aLetter)];
    if (age <= 0.0) {
      // a tremble before it goes, the letter shaking on its own
      float k = uShake * smoothstep(start - 0.17, start - 0.01, uP);
      c.xy += vec2(sin(uTime * 53.0 + aLetter * 1.7), cos(uTime * 61.0 + aLetter * 2.3)) * k;
    } else {
      float a = aSpin.x * age;
      local = turn(local, aAxis, a);
      n = turn(n, aAxis, a);
      c += aDir * age;
      c.y -= uFall * age * age;
    }
    vec4 world = modelMatrix * vec4(c + local, 1.0);
    vec3 wn = normalize(mat3(modelMatrix) * n);
    // lit from the upper left; facing you it is exactly its own colour, turned it darkens or catches the light
    vec3 L = normalize(vec3(-0.35, 0.55, 1.0));
    float d = dot(wn, L) / L.z;
    vShade = clamp(0.5 + 0.5 * d, 0.32, 1.18);
    // what flies at you fades before it gets there; everything fades as it falls away
    // and once the ink has the screen, the last of them melt into it
    vFade = (1.0 - smoothstep(uNear * 0.35, uNear * 0.7, world.z)) * (1.0 - smoothstep(0.75, 1.15, age)) * (1.0 - smoothstep(0.62, 0.86, uP));
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const FRAG = /* glsl */ `
  uniform sampler2D uMap;
  uniform sampler2D uMask;
  uniform vec2 uTexel;
  uniform float uDraw;
  uniform float uL0[5];
  uniform float uL1[5];
  varying vec2 vUv;
  varying float vShade;
  varying float vFade;
  varying float vLayer;
  varying float vLetter;
  void main() {
    // the depth behind the face is the letters' alone: the posies are on the face, in their own colours (with the
    // word's dark depth behind them too, a small flower is mostly a dark rim)
    vec4 t = vLayer > 0.5 ? texture2D(uMask, vUv) : texture2D(uMap, vUv);
    // painted premultiplied, so the filtering never darkens a petal's edge; its own colour back out of it
    t.rgb /= max(t.a, 0.004);
    float a = t.a * vFade;
    if (uDraw < 1.0) {
      // written out as the page opens: one letter after another, the pen tracing its outline from left to
      // right, the ink filling it in just behind the pen
      int li = int(vLetter + 0.5);
      float lx = clamp((vUv.x - uL0[li]) / max(1e-4, uL1[li] - uL0[li]), 0.0, 1.0);
      float k = clamp((uDraw - float(li) * 0.1) / 0.5, 0.0, 1.0);
      float e = 0.0;
      for (int i = 0; i < 4; i++) {
        vec2 o = vec2(i == 0 ? 2.0 : i == 1 ? -2.0 : 0.0, i == 2 ? 2.0 : i == 3 ? -2.0 : 0.0) * uTexel;
        e = max(e, abs(t.a - texture2D(uMap, vUv + o).a));
      }
      float outline = smoothstep(0.12, 0.4, e) * smoothstep(lx - 0.03, lx, k * 1.06);
      float fill = smoothstep(lx - 0.12, lx, (k - 0.3) * 1.75);
      a *= vLayer > 0.5 ? fill : max(outline, fill);
    }
    if (a < 0.01) discard;
    // the depth behind the face: the same shape, darker, deepening to the back
    float side = vLayer > 0.5 ? 0.42 - vLayer * 0.012 : 1.0;
    float shade = gl_FrontFacing ? vShade : vShade * 0.55;
    vec3 col = t.rgb * side * shade + (shade > 1.0 ? (shade - 1.0) * 0.9 : 0.0);
    gl_FragColor = vec4(col, a);
  }
`;

/** The evening's ink: a front that runs out in fingers and bays (domain-warped noise), a wetter rim, droplets ahead. */
const INK_VERT = /* glsl */ `
  void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }
`;
const INK_FRAG = /* glsl */ `
  uniform float uK;
  uniform float uT;
  uniform float uMax;
  uniform vec2 uRes;
  uniform vec2 uC;
  uniform vec3 uCol;
  uniform vec3 uRim;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.03 + vec2(17.1, 9.2); a *= 0.5; }
    return v;
  }
  void main() {
    vec2 p = (gl_FragCoord.xy - uC) / uRes.y;
    float r = length(p);
    float R = uK * uMax;
    float grow = min(1.0, uK * 4.0);
    float aa = 1.5 / uRes.y;
    // the noise only moves the front by a quarter screen either way (fbm stays within 0..1), and the droplets reach
    // at most 0.09 past it: well inside it's plain ink, well outside nothing, so only the front needs the noise
    // (the same picture, for a fraction of the work once the ink has the screen)
    float reachOut = 0.23 * grow;
    if (r < R - reachOut - 0.05 - aa) {
      gl_FragColor = vec4(uCol, 1.0);
      return;
    }
    if (r > R + reachOut + 0.1 + 12.0 * aa) {
      gl_FragColor = vec4(0.0);
      return;
    }
    vec2 q = vec2(fbm(p * 2.4 + uT * 0.06), fbm(p * 2.4 - uT * 0.05 + 5.2));
    float n = fbm(p * 3.0 + q * 1.7);
    float field = r - (n - 0.5) * 0.46 * grow;
    float body = 1.0 - smoothstep(R - aa, R + aa, field);
    // droplets flicked out ahead of the front: hard-edged, fewer the further out
    float dn = noise(p * 15.0 + q * 3.0);
    float reach = R + 0.09 * (1.0 - smoothstep(0.0, 1.0, field - R) * 0.0) * noise(p * 4.0 + 3.0);
    float edgeAa = 12.0 * aa;
    float drops = smoothstep(0.765, 0.765 + edgeAa, dn) * step(field, reach) * step(0.015, uK);
    float m = max(body, drops);
    float rim = smoothstep(R - 0.04, R, field) * body;
    vec3 col = mix(uCol, uRim, rim * 0.7);
    gl_FragColor = vec4(col * m, m);
  }
`;

export type HeroWord = {
  /** Sizes the word to the page's heading again (after a resize or once the fonts are in). */
  build: () => void;
  /** Draws the word at scroll progress p, with the evening's ink flooded in to `flood` (0..1). */
  render: (p: number, now: number, flood?: number) => void;
  /**
   * Whether drawing at this p and flood would show anything new. Always, with a graphics card (the word floats);
   * without one (WebGL drawn in software, every frame costs the page a long pause) it holds still once written,
   * and is drawn again only when the scroll moves it.
   */
  due: (p: number, now: number, flood: number) => boolean;
  dispose: () => void;
};

/** The word's renderer; and whether the browser draws WebGL without a graphics card (in software, slowly). */
function makeRenderer(canvas: HTMLCanvasElement) {
  const opts = { canvas, alpha: true, antialias: true, powerPreference: 'high-performance' as const };
  try {
    return { renderer: new THREE.WebGLRenderer({ ...opts, failIfMajorPerformanceCaveat: true }), soft: false };
  } catch {
    return { renderer: new THREE.WebGLRenderer(opts), soft: true };
  }
}

export function createHeroWord(canvas: HTMLCanvasElement, h1: HTMLElement): HeroWord {
  const { renderer, soft } = makeRenderer(canvas);
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 1, 20000);
  const group = new THREE.Group();
  scene.add(group);
  const uniforms = {
    uMap: { value: null as THREE.Texture | null },
    uMask: { value: null as THREE.Texture | null },
    uP: { value: 0 },
    uTime: { value: 0 },
    uShake: { value: 0 },
    uThick: { value: 1 },
    uFall: { value: 1 },
    uNear: { value: 1000 },
    uHop: { value: [0, 0, 0, 0, 0] },
    uDraw: { value: 0 },
    uTexel: { value: new THREE.Vector2(1, 1) },
    uL0: { value: [0, 0, 0, 0, 0] },
    uL1: { value: [1, 1, 1, 1, 1] },
  };
  const material = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms, side: THREE.DoubleSide, alphaToCoverage: true });
  // a fading shard thins its coverage, but must never thin what's under it: over the ink the canvas stays opaque
  // (else the white page behind would show through as grey)
  material.blending = THREE.CustomBlending;
  material.blendEquation = THREE.AddEquation;
  material.blendSrc = THREE.OneFactor;
  material.blendDst = THREE.ZeroFactor;
  material.blendEquationAlpha = THREE.AddEquation;
  material.blendSrcAlpha = THREE.OneFactor;
  material.blendDstAlpha = THREE.OneFactor;
  // the ink: one quad over the whole screen
  const inkScene = new THREE.Scene();
  const inkCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const inkU = {
    uK: { value: 0 },
    uT: { value: 0 },
    uMax: { value: 1 },
    uRes: { value: new THREE.Vector2(1, 1) },
    uC: { value: new THREE.Vector2() },
    uCol: { value: new THREE.Color(0x23 / 255, 0x1c / 255, 0x18 / 255) },
    uRim: { value: new THREE.Color(0x10 / 255, 0x0c / 255, 0x0a / 255) },
  };
  const inkMat = new THREE.ShaderMaterial({ vertexShader: INK_VERT, fragmentShader: INK_FRAG, uniforms: inkU, transparent: true, premultipliedAlpha: true, depthTest: false, depthWrite: false });
  const ink = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), inkMat);
  ink.frustumCulled = false;
  inkScene.add(ink);
  let mesh: THREE.Mesh | null = null;
  let texture: THREE.CanvasTexture | null = null;
  let mask: THREE.CanvasTexture | null = null;
  // when it was first drawn: the pen writes it out once, as the page opens
  let drawnFrom = 0;
  let started = false;
  /** What was last drawn (scroll, ink, how far written), so a still word isn't drawn again. */
  let shown = '';
  let W = 1;
  let H = 1;
  let fs = 100;

  function build() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    W = canvas.clientWidth || window.innerWidth;
    H = canvas.clientHeight || window.innerHeight;
    renderer.setPixelRatio(dpr);
    renderer.setSize(W, H, false);
    camera.aspect = W / H;
    // the plane z = 0 is the page: one unit, one CSS pixel
    camera.position.set(0, 0, H / 2 / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
    camera.updateProjectionMatrix();
    uniforms.uNear.value = camera.position.z;
    uniforms.uFall.value = H * 2.2;

    // the word, where the page's heading is, painted at a little more than the screen's resolution
    const cs = getComputedStyle(h1);
    fs = parseFloat(cs.fontSize);
    const S = dpr * 1.5;
    const c = document.createElement('canvas');
    const g = c.getContext('2d', { willReadFrequently: true })!;
    const font = `${cs.fontStyle} ${cs.fontWeight} ${fs * S}px ${cs.fontFamily}`;
    const spacing = parseFloat(cs.letterSpacing) || 0;
    const setFont = () => {
      g.font = font;
      g.letterSpacing = `${spacing * S}px`;
      g.fillStyle = '#1c2a1d';
      g.textBaseline = 'alphabetic';
    };
    setFont();
    const text = 'ryhox';
    const m = g.measureText(text);
    const asc = Math.ceil(m.actualBoundingBoxAscent);
    const desc = Math.ceil(m.actualBoundingBoxDescent);
    const u = (fs * S) / 64;
    const padX = Math.ceil(9 * u);
    const padTop = Math.ceil(11 * u);
    const padBot = Math.ceil(8 * u);
    c.width = Math.ceil(m.width + padX * 2);
    c.height = asc + desc + padTop + padBot;
    setFont();
    const base = padTop + asc;
    g.fillText(text, padX, base);
    const letters = [...text].map((_, i): [number, number] => [Math.floor(padX + g.measureText(text.slice(0, i)).width), Math.ceil(padX + g.measureText(text.slice(0, i + 1)).width)]);
    const ink = { w: c.width, h: c.height, a: g.getImageData(0, 0, c.width, c.height).data };
    // the letters alone, before they're dressed: what the depth behind the face is made of
    const bare = document.createElement('canvas');
    bare.width = c.width;
    bare.height = c.height;
    bare.getContext('2d')!.drawImage(c, 0, 0);
    const dressed = posies(g, ink, base, letters, u);
    const alpha = g.getImageData(0, 0, c.width, c.height).data;

    const tex = (from: HTMLCanvasElement) => {
      const t = new THREE.CanvasTexture(from);
      t.colorSpace = THREE.NoColorSpace;
      t.premultiplyAlpha = true;
      t.anisotropy = 4;
      t.generateMipmaps = true;
      t.minFilter = THREE.LinearMipmapLinearFilter;
      return t;
    };
    texture?.dispose();
    mask?.dispose();
    texture = tex(c);
    mask = tex(bare);
    uniforms.uMap.value = texture;
    uniforms.uMask.value = mask;

    // where it sits: centred where the heading's letters are (the heading box, a touch above the middle)
    const box = h1.getBoundingClientRect();
    const top = canvas.getBoundingClientRect();
    const tw = c.width / S;
    const th = c.height / S;
    const baseY = box.top - top.top + (box.height + m.actualBoundingBoxAscent / S - m.actualBoundingBoxDescent / S) / 2;
    const left = box.left - top.left + (box.width - m.width / S) / 2 - padX / S;
    const topY = baseY - base / S;
    // to world: x right, y up, centred on the screen
    const wx = (cx: number) => left + cx / S - W / 2;
    const wy = (cy: number) => H / 2 - (topY + cy / S);
    // each letter's span across the texture, its flowers and all, for the pen to cross
    letters.forEach(([a, b], i) => {
      const d = dressed[i];
      uniforms.uL0.value[i] = Math.max(0, Math.min(a, d.x0)) / c.width;
      uniforms.uL1.value[i] = Math.min(c.width, Math.max(b, d.x1)) / c.width;
    });
    uniforms.uTexel.value.set(1 / c.width, 1 / c.height);

    // the cut: a jittered grid, each cell split corner to corner one way or the other, glass-like
    const cell = fs * 0.105 * S;
    const nx = Math.ceil(c.width / cell);
    const ny = Math.ceil(c.height / cell);
    const pt = (i: number, j: number): [number, number] => {
      const edge = i === 0 || j === 0 || i === nx || j === ny;
      const jx = edge ? 0 : (hash2(i, j, 21) - 0.5) * cell * 0.8;
      const jy = edge ? 0 : (hash2(i, j, 22) - 0.5) * cell * 0.8;
      return [Math.min(c.width, i * cell + jx), Math.min(c.height, j * cell + jy)];
    };
    /** Whether anything is painted inside a triangle (every couple of pixels of it looked at, edges and all). */
    const inked = (t: [number, number][]) => {
      const [[ax, ay], [bx, by], [cx2, cy2]] = t;
      const x0 = Math.max(0, Math.floor(Math.min(ax, bx, cx2)) - 1);
      const x1 = Math.min(c.width - 1, Math.ceil(Math.max(ax, bx, cx2)) + 1);
      const y0 = Math.max(0, Math.floor(Math.min(ay, by, cy2)) - 1);
      const y1 = Math.min(c.height - 1, Math.ceil(Math.max(ay, by, cy2)) + 1);
      const area = (bx - ax) * (cy2 - ay) - (cx2 - ax) * (by - ay);
      const slack = Math.abs(area) * 0.02;
      for (let y = y0; y <= y1; y += 2)
        for (let x = x0; x <= x1; x += 2) {
          const w0 = (bx - x) * (cy2 - y) - (cx2 - x) * (by - y);
          const w1 = (cx2 - x) * (ay - y) - (ax - x) * (cy2 - y);
          const w2 = (ax - x) * (by - y) - (bx - x) * (ay - y);
          const inside = area > 0 ? w0 >= -slack && w1 >= -slack && w2 >= -slack : w0 <= slack && w1 <= slack && w2 <= slack;
          if (inside && alpha[(y * c.width + x) * 4 + 3] > 2) return true;
        }
      return false;
    };
    const tris: [number, number][][] = [];
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < nx; i++) {
        const a = pt(i, j);
        const b = pt(i + 1, j);
        const cc = pt(i + 1, j + 1);
        const d = pt(i, j + 1);
        const pair = hash2(i, j, 23) < 0.5 ? [[a, b, cc], [a, cc, d]] : [[a, b, d], [b, cc, d]];
        // only the pieces with something on them
        for (const t of pair) if (inked(t)) tris.push(t);
      }

    // whose each piece is: the letter its dressing came with, or the letter it sits over
    const owner = (x: number, y: number) => {
      for (let i = 0; i < dressed.length; i++) {
        const d = dressed[i];
        const inGlyph = x >= letters[i][0] && x <= letters[i][1] && y >= padTop * 0.9 && y <= base + desc;
        if (!inGlyph && x >= d.x0 && x <= d.x1 && y >= d.y0 && y <= d.y1) return i;
      }
      let best = 0;
      let bd = Infinity;
      letters.forEach(([a, b], i) => {
        const dd = x < a ? a - x : x > b ? x - b : 0;
        if (dd < bd) {
          bd = dd;
          best = i;
        }
      });
      return best;
    };
    const centres = letters.map(([a, b]) => [wx((a + b) / 2), wy(base - asc * 0.45)]);

    const n = tris.length * 3;
    const pos = new Float32Array(n * 3);
    const uv = new Float32Array(n * 2);
    const cen = new Float32Array(n * 3);
    const dir = new Float32Array(n * 3);
    const axis = new Float32Array(n * 3);
    const spin = new Float32Array(n * 2);
    const let_ = new Float32Array(n);
    tris.forEach((t, k) => {
      const cx = (t[0][0] + t[1][0] + t[2][0]) / 3;
      const cy = (t[0][1] + t[1][1] + t[2][1]) / 3;
      const li = owner(cx, cy);
      const X = wx(cx);
      const Y = wy(cy);
      const [lx, ly] = centres[li];
      const dx = X - lx;
      const dy = Y - ly;
      const dd = Math.hypot(dx, dy) || 1;
      const sp = (0.55 + hash2(k, 1, 31) * 0.9) * H;
      // out from the letter's middle and up, some of it at you and some away
      const vx = (dx / dd) * sp * 0.9 + (hash2(k, 2, 31) - 0.5) * H * 0.25;
      const vy = (dy / dd) * sp * 0.7 + H * (0.35 + hash2(k, 3, 31) * 0.4);
      const vz = (hash2(k, 4, 31) - 0.4) * H * 0.9;
      let ax = hash2(k, 5, 31) - 0.5;
      let ay = hash2(k, 6, 31) - 0.5;
      let az = (hash2(k, 7, 31) - 0.5) * 0.6;
      const al = Math.hypot(ax, ay, az) || 1;
      ax /= al;
      ay /= al;
      az /= al;
      const start = burstAt(li) + hash2(k, 8, 31) * 0.035;
      const turns = 4 + hash2(k, 9, 31) * 9;
      for (let v = 0; v < 3; v++) {
        const o = k * 3 + v;
        // a hair bigger than its cut, so the whole word shows no seams
        const ex = t[v][0] + (t[v][0] - cx) * 0.02;
        const ey = t[v][1] + (t[v][1] - cy) * 0.02;
        pos.set([(ex - cx) / S, -(ey - cy) / S, 0], o * 3);
        uv.set([ex / c.width, 1 - ey / c.height], o * 2);
        cen.set([X, Y, 0], o * 3);
        dir.set([vx, vy, vz], o * 3);
        axis.set([ax, ay, az], o * 3);
        spin.set([turns, start], o * 2);
        let_[o] = li;
      }
    });
    const geo = new THREE.InstancedBufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setAttribute('aCenter', new THREE.BufferAttribute(cen, 3));
    geo.setAttribute('aDir', new THREE.BufferAttribute(dir, 3));
    geo.setAttribute('aAxis', new THREE.BufferAttribute(axis, 3));
    geo.setAttribute('aSpin', new THREE.BufferAttribute(spin, 2));
    geo.setAttribute('aLetter', new THREE.BufferAttribute(let_, 1));
    // the face, and the layers of depth behind it
    geo.setAttribute('aLayer', new THREE.InstancedBufferAttribute(new Float32Array(Array.from({ length: LAYERS }, (_, i) => i)), 1));
    geo.instanceCount = LAYERS;
    uniforms.uThick.value = (fs * 0.055) / (LAYERS - 1);
    uniforms.uShake.value = fs * 0.011;
    if (mesh) {
      group.remove(mesh);
      mesh.geometry.dispose();
    }
    mesh = new THREE.Mesh(geo, material);
    mesh.frustumCulled = false;
    group.add(mesh);
  }

  function render(p: number, now: number, flood = 0) {
    const t = now / 1000;
    uniforms.uP.value = p;
    uniforms.uTime.value = t;
    // the evening, flooding out of where the name was like ink in water, under the flying shards
    const dpr = renderer.getPixelRatio();
    inkU.uK.value = flood;
    inkU.uT.value = t;
    inkU.uRes.value.set(W * dpr, H * dpr);
    inkU.uC.value.set((W / 2) * dpr, (H / 2 + H * 0.03) * dpr);
    inkU.uMax.value = Math.hypot(W / H / 2 + 0.08, 0.58) + 0.32;
    ink.visible = flood > 0;
    // written out once, fast, the first time it's seen (not if the page opens already scrolled past it)
    if (!started) {
      started = true;
      drawnFrom = p > 0.05 ? -1e9 : now;
    }
    const draw = (now - drawnFrom) / 1000 / 0.95;
    uniforms.uDraw.value = Math.min(1, draw);
    // floating: a slow sway that shows its depth, easing in once it's written, settling as it starts to shake
    // (not without a graphics card: there it holds still, so it needn't be drawn again every frame)
    const calm = soft ? 0 : (1 - Math.min(1, p / 0.2)) * Math.min(1, Math.max(0, (draw - 0.85) / 0.8));
    shown = `${p.toFixed(4)}|${flood.toFixed(4)}|${Math.min(1, draw) >= 1 ? 1 : draw}`;
    group.rotation.y = Math.sin(t * 0.55) * 0.16 * calm;
    group.rotation.x = Math.sin(t * 0.4 + 1) * 0.06 * calm;
    group.position.y = Math.sin(t * 0.8) * fs * 0.025 * calm;
    renderer.autoClear = true;
    if (ink.visible) {
      renderer.render(inkScene, inkCam);
      renderer.autoClear = false;
      renderer.clearDepth();
    }
    renderer.render(scene, camera);
    renderer.autoClear = true;
  }

  build();
  // the ink is first drawn only when the scroll gets there, and its shader is a big one: compiled now, alongside,
  // so that frame never waits for it (on Windows that wait was over a second)
  renderer.compileAsync(inkScene, inkCam).catch(() => {});
  // ...and drawn with once, into a scrap the size of a stamp, once the page is quiet: on Windows a shader is only
  // finished at its first draw, and that first draw would otherwise be the first frame of the evening
  const warm = () => {
    const scrap = new THREE.WebGLRenderTarget(4, 4);
    inkU.uK.value = 0.5;
    ink.visible = true;
    renderer.setRenderTarget(scrap);
    renderer.render(inkScene, inkCam);
    renderer.setRenderTarget(null);
    scrap.dispose();
    inkU.uK.value = 0;
  };
  const warmId = 'requestIdleCallback' in window ? window.requestIdleCallback(warm, { timeout: 4000 }) : (setTimeout(warm, 2000) as unknown as number);
  return {
    build,
    render,
    due(p, now, flood) {
      if (!soft || !started) return true;
      // still being written, or moved (the tremble before the burst moves with the scroll too)
      if ((now - drawnFrom) / 1000 / 0.95 < 1) return true;
      return `${p.toFixed(4)}|${flood.toFixed(4)}|1` !== shown;
    },
    dispose() {
      if ('cancelIdleCallback' in window) window.cancelIdleCallback(warmId);
      clearTimeout(warmId);
      mesh?.geometry.dispose();
      material.dispose();
      ink.geometry.dispose();
      inkMat.dispose();
      texture?.dispose();
      mask?.dispose();
      renderer.dispose();
    },
  };
}
