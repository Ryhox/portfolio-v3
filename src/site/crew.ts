/**
 * The crew: every tool I work with as a little character whose body is its real logo (a WEBP in /logos), with eyes
 * put where they sit best on that logo (on the eyes it already has, if it has any), a blush, arms with white gloves
 * and legs with shoes, all in crisp pixels over the smooth logo. Each has its own way of flying when clicked and of dangling when carried.
 */

export type Logo =
  | 'three' | 'r3f' | 'glsl' | 'webgl'
  | 'next' | 'react' | 'ts' | 'flutter'
  | 'ollama' | 'node' | 'postgres' | 'mysql' | 'js'
  | 'java' | 'kotlin' | 'csharp' | 'arduino' | 'fabric'
  | 'gsap' | 'lenis' | 'shaders' | 'physics';

/** How it flies when clicked. */
export type Fly = 'flap' | 'flip' | 'rocket' | 'heli' | 'float' | 'leap' | 'twirl';
/** How it dangles when carried. */
export type Dangle = 'kick' | 'swing' | 'flail' | 'shiver' | 'wheee';

export type Spec = {
  /** Eye centres, as fractions of the logo's width and height. */
  eyes: [number, number][];
  /** Eye size, as a fraction of the body's height. */
  eye: number;
  /** Blush under the eyes (false for the few where it would muddy the logo). */
  blush: boolean;
  /** How tall the body is, against the others. */
  size: number;
  /** Where the arms join, as a fraction of the body's height. */
  shoulder: number;
  /** Where the legs join, as a fraction of the body's width either side of the middle. */
  hip: number;
  limb: string;
  shoe: string;
  /** No legs of its own (it stands on its own shape). */
  legs?: false;
  /** A white rim round the eyes, on the dark logos. */
  rim?: boolean;
  fly: Fly;
  dangle: Dangle;
};

const INK = '#2b1d24';
const SPEC: Record<Logo, Spec> = {
  three: { eyes: [[0.36, 0.27], [0.57, 0.33]], eye: 0.085, blush: true, size: 1, shoulder: 0.38, hip: 0.14, limb: INK, shoe: '#2b2b2b', fly: 'flip', dangle: 'kick' },
  r3f: { eyes: [[0.42, 0.36], [0.58, 0.36]], eye: 0.085, blush: true, size: 0.9, shoulder: 0.5, hip: 0.12, limb: INK, shoe: '#1f2533', rim: true, fly: 'twirl', dangle: 'swing' },
  glsl: { eyes: [[0.36, 0.3], [0.64, 0.3]], eye: 0.085, blush: true, size: 0.92, shoulder: 0.56, hip: 0.2, limb: INK, shoe: '#36586e', rim: true, fly: 'rocket', dangle: 'flail' },
  webgl: { eyes: [[0.37, 0.33], [0.63, 0.33]], eye: 0.085, blush: true, size: 0.94, shoulder: 0.55, hip: 0.2, limb: INK, shoe: '#990000', fly: 'flap', dangle: 'shiver' },
  next: { eyes: [[0.36, 0.33], [0.64, 0.33]], eye: 0.09, blush: false, size: 0.95, shoulder: 0.55, hip: 0.18, limb: INK, shoe: '#111111', rim: true, fly: 'rocket', dangle: 'swing' },
  react: { eyes: [[0.4, 0.43], [0.6, 0.43]], eye: 0.075, blush: true, size: 0.95, shoulder: 0.5, hip: 0.12, limb: INK, shoe: '#1e7f99', fly: 'heli', dangle: 'wheee' },
  ts: { eyes: [[0.35, 0.24], [0.63, 0.24]], eye: 0.085, blush: true, size: 0.92, shoulder: 0.55, hip: 0.22, limb: INK, shoe: '#0b4f86', rim: true, fly: 'flip', dangle: 'kick' },
  flutter: { eyes: [[0.45, 0.35], [0.63, 0.21]], eye: 0.07, blush: true, size: 1, shoulder: 0.52, hip: 0.16, limb: INK, shoe: '#19599a', fly: 'flap', dangle: 'flail' },
  // the llama, the elephant and the dolphin have eyes of their own: these sit on them
  ollama: { eyes: [[0.253, 0.464], [0.75, 0.464]], eye: 0.072, blush: true, size: 1.05, shoulder: 0.66, hip: 0.22, limb: INK, shoe: '#1a1a1a', legs: false, fly: 'float', dangle: 'wheee' },
  node: { eyes: [[0.37, 0.4], [0.63, 0.4]], eye: 0.085, blush: true, size: 0.98, shoulder: 0.55, hip: 0.17, limb: INK, shoe: '#2f6b2c', rim: true, fly: 'heli', dangle: 'swing' },
  postgres: { eyes: [[0.42, 0.33], [0.735, 0.32]], eye: 0.072, blush: true, size: 1.02, shoulder: 0.42, hip: 0.1, limb: INK, shoe: '#1e3a5c', rim: true, fly: 'float', dangle: 'shiver' },
  mysql: { eyes: [[0.245, 0.215]], eye: 0.085, blush: true, size: 0.98, shoulder: 0.46, hip: 0.1, limb: INK, shoe: '#2e5f84', fly: 'leap', dangle: 'wheee' },
  js: { eyes: [[0.33, 0.25], [0.6, 0.25]], eye: 0.085, blush: true, size: 0.92, shoulder: 0.55, hip: 0.22, limb: INK, shoe: '#323330', fly: 'rocket', dangle: 'kick' },
  java: { eyes: [[0.4, 0.69], [0.62, 0.69]], eye: 0.06, blush: true, size: 1.06, shoulder: 0.72, hip: 0.15, limb: INK, shoe: '#0074bd', fly: 'twirl', dangle: 'swing' },
  kotlin: { eyes: [[0.2, 0.32], [0.41, 0.32]], eye: 0.08, blush: true, size: 0.9, shoulder: 0.55, hip: 0.22, limb: INK, shoe: '#7f52ff', rim: true, fly: 'flip', dangle: 'flail' },
  csharp: { eyes: [[0.44, 0.47], [0.585, 0.47]], eye: 0.07, blush: false, size: 0.98, shoulder: 0.55, hip: 0.17, limb: INK, shoe: '#68217a', rim: true, fly: 'heli', dangle: 'kick' },
  arduino: { eyes: [[0.25, 0.32], [0.735, 0.32]], eye: 0.1, blush: true, size: 0.6, shoulder: 0.5, hip: 0.2, limb: INK, shoe: '#00979c', fly: 'flap', dangle: 'wheee' },
  fabric: { eyes: [[0.38, 0.42], [0.62, 0.42]], eye: 0.08, blush: true, size: 0.92, shoulder: 0.5, hip: 0.2, limb: INK, shoe: '#7a6a4e', fly: 'float', dangle: 'swing' },
  gsap: { eyes: [[0.36, 0.32], [0.64, 0.32]], eye: 0.09, blush: true, size: 0.88, shoulder: 0.55, hip: 0.22, limb: INK, shoe: '#0e100f', fly: 'rocket', dangle: 'flail' },
  lenis: { eyes: [[0.34, 0.5], [0.66, 0.5]], eye: 0.06, blush: true, size: 1.02, shoulder: 0.55, hip: 0.16, limb: INK, shoe: '#ff5a4a', fly: 'twirl', dangle: 'shiver' },
  shaders: { eyes: [[0.4, 0.75], [0.6, 0.75]], eye: 0.095, blush: true, size: 0.72, shoulder: 0.62, hip: 0.2, limb: INK, shoe: '#a86a32', fly: 'flip', dangle: 'wheee' },
  physics: { eyes: [[0.38, 0.55], [0.62, 0.55]], eye: 0.075, blush: true, size: 0.95, shoulder: 0.58, hip: 0.18, limb: INK, shoe: '#5a3a1e', fly: 'leap', dangle: 'kick' },
};
export const specOf = (l: Logo) => SPEC[l];

/** Each logo's picture, and the outline of its shape (for where the arms and legs meet it). */
export type Body = { img: HTMLImageElement; aspect: number; edge: (v: number) => [number, number]; foot: (u: number) => number; solid: (u: number, v: number) => boolean };
const bodies = new Map<Logo, Promise<Body>>();
export function loadBody(l: Logo): Promise<Body> {
  let b = bodies.get(l);
  if (b) return b;
  b = new Promise<Body>((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.src = `/logos/${l}.webp`;
    img.onerror = reject;
    img.onload = () => {
      const N = 64;
      const w = Math.max(8, Math.round(N * Math.min(1, img.naturalWidth / img.naturalHeight)));
      const h = Math.max(8, Math.round(N * Math.min(1, img.naturalHeight / img.naturalWidth)));
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const g = c.getContext('2d', { willReadFrequently: true })!;
      g.drawImage(img, 0, 0, w, h);
      const d = g.getImageData(0, 0, w, h).data;
      const on = (x: number, y: number) => d[(y * w + x) * 4 + 3] > 90;
      // the outline at a height: its leftmost and rightmost (as fractions of the width)
      const edge = (v: number): [number, number] => {
        const y = Math.max(0, Math.min(h - 1, Math.round(v * (h - 1))));
        let a = -1;
        let z = -1;
        for (let x = 0; x < w; x++)
          if (on(x, y)) {
            if (a < 0) a = x;
            z = x;
          }
        return a < 0 ? [0.3, 0.7] : [a / (w - 1), z / (w - 1)];
      };
      // the bottom of the shape at a point across it (as a fraction of the height)
      const foot = (u: number) => {
        const x = Math.max(0, Math.min(w - 1, Math.round(u * (w - 1))));
        for (let y = h - 1; y >= 0; y--) if (on(x, y)) return y / (h - 1);
        return 1;
      };
      const solid = (u: number, v: number) => on(Math.max(0, Math.min(w - 1, Math.round(u * (w - 1)))), Math.max(0, Math.min(h - 1, Math.round(v * (h - 1)))));
      resolve({ img, aspect: img.naturalWidth / img.naturalHeight, edge, foot, solid });
    };
  });
  bodies.set(l, b);
  return b;
}

export type Pose = {
  /** Where its feet are (the middle between them), in CSS pixels. */
  x: number;
  y: number;
  /** The body's turn, and how squashed it is (1 = not at all; < 1 squat, > 1 stretched). */
  rot: number;
  squash: number;
  dir: number;
  /** The walk's phase, and how much it is walking (0..1). */
  phase: number;
  walk: number;
  /** Off the ground: legs dangle. */
  air: number;
  arms: 'hang' | 'walk' | 'up' | 'flap' | 'heli' | 'out' | 'flail' | 'cheer' | 'wave';
  legs: 'stand' | 'walk' | 'dangle' | 'kick' | 'tuck';
  eyes: 'open' | 'happy' | 'wide' | 'dizzy' | 'shut';
  /** Where it is looking, as a unit-ish vector. */
  look: [number, number];
  t: number;
};

/** The size of one pixel of the crew's eyes, arms and legs, for a base size B (whole CSS pixels). */
export const pixelOf = (B: number) => Math.max(2, Math.round(B / 34));

/** The body's size on screen for a base size B. */
export function bodySize(b: Body, s: Spec, B: number) {
  let h = B * s.size;
  let w = h * b.aspect;
  const maxW = B * 1.55;
  if (w > maxW) {
    w = maxW;
    h = w / b.aspect;
  }
  return { w, h, leg: s.legs === false ? 0 : pixelOf(B) * 8 };
}

const EYE = '#1a0f18';
const BLUSH = ['#f2828e', '#f6a0a8'];

/**
 * Pixels for the eyes, arms and legs: blocks of P CSS pixels on a grid that travels with the body (its origin at
 * ox, oy), so they stay pixel art but glide with the logo instead of snapping against it as it moves.
 */
function pixels(g: CanvasRenderingContext2D, P: number, ox = 0, oy = 0) {
  const q = (v: number) => Math.round(v / P);
  const put = (ax: number, ay: number, c: string, w = 1, h = 1) => {
    g.fillStyle = c;
    g.fillRect(ox + ax * P, oy + ay * P, w * P, h * P);
  };
  /** A line of whole pixels (thickness k), from one screen point to another. */
  const line = (x0: number, y0: number, x1: number, y1: number, c: string, k = 1) => {
    let ax = q(x0 - ox);
    let ay = q(y0 - oy);
    const bx = q(x1 - ox);
    const by = q(y1 - oy);
    const dx = Math.abs(bx - ax);
    const dy = -Math.abs(by - ay);
    const sx = ax < bx ? 1 : -1;
    const sy = ay < by ? 1 : -1;
    let err = dx + dy;
    const o = Math.floor((k - 1) / 2);
    for (let n = 0; n < 400; n++) {
      put(ax - o, ay - o, c, k, k);
      if (ax === bx && ay === by) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        ax += sx;
      }
      if (e2 <= dx) {
        err += dx;
        ay += sy;
      }
    }
  };
  /** A bent limb: two straight runs of pixels through the elbow or knee. */
  const limb = (a: [number, number], m: [number, number], b: [number, number], c: string, k: number) => {
    line(a[0], a[1], m[0], m[1], c, k);
    line(m[0], m[1], b[0], b[1], c, k);
  };
  return { q: (v: number, o: 'x' | 'y' = 'x') => q(v - (o === 'x' ? ox : oy)), put, line, limb };
}

/** Draws one of the crew. B is the base size of a body, in CSS pixels. */
export function drawMate(g: CanvasRenderingContext2D, b: Body, s: Spec, B: number, p: Pose) {
  const { w, h, leg } = bodySize(b, s, B);
  const P = pixelOf(B);
  // the body: its middle, turned and squashed about there
  const hipY = p.y - leg * (1 - p.air * 0.12);
  const cx = p.x;
  const cy = hipY - h / 2 + (leg ? P : 0);
  const px = pixels(g, P, cx, cy);
  const sx = 1 / Math.sqrt(p.squash);
  const sy = p.squash;
  const cos = Math.cos(p.rot);
  const sin = Math.sin(p.rot);
  /** A point on the body (fractions of the logo) to the screen. */
  const at = (u: number, v: number): [number, number] => {
    const lx = (u - 0.5) * w * sx;
    const ly = (v - 0.5) * h * sy + (h - h * sy) / 2;
    return [cx + lx * cos - ly * sin, cy + lx * sin + ly * cos];
  };
  const t = p.t;

  // its shadow on the ground, smaller the higher it is
  const lift = Math.max(0, 1 - p.air * 0.7);
  g.fillStyle = `rgba(43, 29, 36, ${0.14 * lift})`;
  g.beginPath();
  g.ellipse(p.x, p.y + P, w * 0.42 * (0.6 + lift * 0.4), B * 0.05 * (0.6 + lift * 0.4), 0, 0, Math.PI * 2);
  g.fill();

  // legs, 2 pixels wide, and their shoes pointing the way it's going
  if (leg) {
    for (const side of [-1, 1]) {
      const fu = 0.5 + side * s.hip;
      const hip = at(fu, Math.min(0.98, b.foot(fu) - 0.03));
      let fx: number;
      let fy: number;
      const grounded = p.legs === 'stand' || p.legs === 'walk';
      if (grounded) {
        const ph = p.phase + (side > 0 ? 0 : Math.PI);
        const swing = p.legs === 'walk' ? Math.sin(ph) : 0;
        fx = p.x + side * w * 0.1 + swing * P * 3 * p.dir;
        fy = p.y - (p.legs === 'walk' && Math.cos(ph) < -0.5 ? P : 0);
      } else {
        // in the air the legs hang under the hips, kicking or tucked
        const k = p.legs === 'kick' ? Math.sin(t * 22 + (side > 0 ? 0 : Math.PI)) * 0.6 : p.legs === 'tuck' ? -0.35 * side : Math.sin(t * 5 + side) * 0.18;
        const len = leg * (p.legs === 'tuck' ? 0.6 : 0.95);
        const a = p.rot * 0.6 + k;
        fx = hip[0] + Math.sin(a) * len + side * P;
        fy = hip[1] + Math.cos(a) * len;
      }
      const knee: [number, number] = [(hip[0] + fx) / 2 + side * P, (hip[1] + fy) / 2];
      px.limb(hip, knee, [fx, fy - P], s.limb, 2);
      // the shoe: 4 by 2, toes forward, a glint of light on it
      const ax = px.q(fx) - (p.dir < 0 ? 3 : 1);
      const ay = px.q(fy, 'y') - 1;
      px.put(ax, ay, s.shoe, 4, 2);
      px.put(ax + (p.dir < 0 ? 0 : 3), ay, s.limb, 1, 1);
      px.put(ax + (p.dir < 0 ? 2 : 1), ay, '#ffffff', 1, 1);
    }
  }

  // the body, the logo itself
  g.save();
  g.translate(cx, cy);
  g.rotate(p.rot);
  g.scale(sx, sy);
  g.translate(0, (h - h * sy) / (2 * sy));
  g.imageSmoothingEnabled = true;
  g.drawImage(b.img, -w / 2, -h / 2, w, h);
  g.restore();

  // arms, 1 pixel thin, with white gloves
  const [el, er] = b.edge(s.shoulder);
  for (const side of [-1, 1]) {
    const sh = at(side < 0 ? el + 0.015 : er - 0.015, s.shoulder);
    const A = P * 9;
    let ang: number;
    switch (p.arms) {
      case 'walk':
        ang = 0.35 + Math.sin(p.phase + (side > 0 ? Math.PI : 0)) * 0.45;
        break;
      case 'up':
        ang = 2.5 + Math.sin(t * 9 + side) * 0.25;
        break;
      case 'flap':
        ang = 1.55 + Math.sin(t * 26) * 0.75;
        break;
      case 'heli':
        ang = t * 28 * side;
        break;
      case 'out':
        ang = 1.45 + Math.sin(t * 3 + side) * 0.08;
        break;
      case 'flail':
        ang = 1.6 + Math.sin(t * 17 + side * 1.3) * 1.1;
        break;
      case 'cheer':
        ang = 2.6 + Math.sin(t * 14) * 0.18;
        break;
      case 'wave':
        // hello: the arm on the side it faces goes up and waves
        ang = side === (p.dir || 1) ? 2.55 + Math.sin(t * 13) * 0.4 : 0.3;
        break;
      default:
        ang = 0.3 + Math.sin(t * 1.6 + side) * 0.06;
    }
    // the angle is from straight down, outwards; the body's turn carries it round
    const a = (p.arms === 'heli' ? ang : ang * side) + p.rot;
    const dx = Math.sin(a);
    const dy = Math.cos(a);
    const hx = sh[0] + dx * A;
    const hy = sh[1] + dy * A;
    const elbow: [number, number] = [(sh[0] + hx) / 2 + dy * side * P, (sh[1] + hy) / 2 - dx * side * P];
    px.limb(sh, elbow, [hx, hy], s.limb, 1);
    // the glove: a little cross of ink, white inside, a shade in its corner
    const gx = px.q(hx) - 1;
    const gy = px.q(hy, 'y') - 1;
    px.put(gx - 1, gy, INK, 5, 3);
    px.put(gx, gy - 1, INK, 3, 5);
    px.put(gx, gy, '#ffffff', 3, 3);
    px.put(gx + (side < 0 ? 0 : 2), gy + 2, '#d8d2c4');
  }

  // the face: eyes of a few pixels, a glint in each, a blush under them
  const e = Math.max(2, Math.min(4, Math.round((h * s.eye * 0.95) / P)));
  const rim = s.rim ?? false;
  for (const [u, v] of s.eyes) {
    const [x, y] = at(u, v);
    const side = s.eyes.length > 1 ? (u < 0.5 ? -1 : 1) : -1;
    // looking: the whole eye shifts a pixel the way it looks
    const lx = Math.round(Math.max(-1, Math.min(1, p.look[0] * 1.6)));
    const ly = Math.round(Math.max(-1, Math.min(1, p.look[1] * 1.6)));
    const ex = px.q(x) - Math.floor(e / 2) + (p.eyes === 'open' ? lx : 0);
    const ey = px.q(y, 'y') - Math.floor((e + 1) / 2) + (p.eyes === 'open' ? ly : 0);
    if (s.blush) {
      const bx = side < 0 ? ex - 1 : ex + e - 1;
      px.put(bx, ey + e + 2, BLUSH[0], 2, 1);
      px.put(bx + (side < 0 ? 0 : 1), ey + e + 2, BLUSH[1]);
    }
    switch (p.eyes) {
      case 'happy':
        // ^ ^
        if (rim) px.put(ex - 1, ey, '#ffffff', e + 2, 3);
        px.put(ex, ey + 1, EYE);
        px.put(ex + 1, ey, EYE, Math.max(1, e - 2), 1);
        px.put(ex + e - 1, ey + 1, EYE);
        break;
      case 'shut':
        if (rim) px.put(ex - 1, ey + e - 2, '#ffffff', e + 2, 3);
        px.put(ex, ey + e - 1, EYE, e, 1);
        break;
      case 'dizzy':
        // x x
        if (rim) px.put(ex - 1, ey - 1, '#ffffff', e + 3, e + 3);
        for (let i = 0; i <= e; i++) {
          px.put(ex + i, ey + i, EYE);
          px.put(ex + e - i, ey + i, EYE);
        }
        break;
      case 'wide': {
        // scared: a big white eye, a small pupil darting about
        px.put(ex - 1, ey - 1, EYE, e + 2, e + 3);
        px.put(ex, ey, '#ffffff', e, e + 1);
        const j = Math.sin(t * 40 + side) > 0 ? 1 : 0;
        px.put(ex + Math.floor((e - 1) / 2) + j * (e > 2 ? 1 : 0), ey + Math.floor(e / 2), EYE, 1, 2);
        break;
      }
      default:
        if (rim) px.put(ex - 1, ey - 1, '#ffffff', e + 2, e + 3);
        px.put(ex, ey, EYE, e, e + 1);
        px.put(ex, ey, '#ffffff');
        if (e > 2) px.put(ex + e - 1, ey + e, '#4a3a48');
    }
  }
}

/** A popped-out eye, for the burst: a few pixels with a glint. */
export function drawLooseEye(g: CanvasRenderingContext2D, B: number, x: number, y: number) {
  const P = pixelOf(B);
  const px = pixels(g, P);
  const ex = px.q(x) - 1;
  const ey = px.q(y, 'y') - 1;
  px.put(ex - 1, ey - 1, '#ffffff', 5, 6);
  px.put(ex, ey, EYE, 3, 4);
  px.put(ex, ey, '#ffffff');
}

/** A fly, as a function of its time: lift above where it took off, sideways drift, turn, squash, and its pose. */
export function flight(kind: Fly, t: number, dir: number, H: number) {
  const ease = (x: number) => 1 - (1 - x) ** 3;
  const D = FLY_TIME[kind];
  const k = Math.min(1, t / D);
  let up = 0;
  let dx = 0;
  let rot = 0;
  let squash = 1;
  let arms: Pose['arms'] = 'out';
  let legs: Pose['legs'] = 'dangle';
  let eyes: Pose['eyes'] = 'happy';
  switch (kind) {
    case 'flap': {
      // flaps its arms like wings, up and up, hovers bobbing, glides back down
      const rise = k < 0.45 ? ease(k / 0.45) : k < 0.65 ? 1 : 1 - ease((k - 0.65) / 0.35) ** 0.8;
      up = rise * H * 0.42 + (k > 0.4 && k < 0.7 ? Math.sin(t * 9) * H * 0.02 : 0);
      dx = Math.sin(k * Math.PI) * dir * H * 0.12;
      rot = Math.sin(t * 6) * 0.1;
      arms = k < 0.85 ? 'flap' : 'out';
      legs = 'kick';
      break;
    }
    case 'flip': {
      // a crouch, a leap, a whole somersault
      if (k < 0.12) {
        squash = 1 - Math.sin((k / 0.12) * Math.PI) * 0.25;
        legs = 'stand';
        arms = 'hang';
        eyes = 'open';
      } else {
        const q = (k - 0.12) / 0.88;
        up = 4 * q * (1 - q) * H * 0.36;
        rot = -dir * ease(Math.min(1, q * 1.15)) * Math.PI * 2;
        legs = 'tuck';
        arms = 'up';
      }
      break;
    }
    case 'rocket': {
      // down low, then straight up like a rocket, a little wobble, and back down with arms up
      if (k < 0.14) {
        squash = 1 - Math.sin((k / 0.14) * Math.PI * 0.5) * 0.3;
        legs = 'stand';
        arms = 'hang';
        eyes = 'shut';
      } else if (k < 0.55) {
        const q = (k - 0.14) / 0.41;
        up = ease(q) * H * 0.6;
        squash = 1 + (1 - q) * 0.25;
        arms = 'cheer';
        legs = 'tuck';
        rot = Math.sin(t * 30) * 0.04;
      } else {
        const q = (k - 0.55) / 0.45;
        up = (1 - q * q) * H * 0.6;
        arms = 'up';
        legs = 'kick';
        eyes = q > 0.5 ? 'wide' : 'happy';
      }
      break;
    }
    case 'heli': {
      // spins its arms over its head like a rotor and lifts off, wobbling, then settles down again
      const rise = k < 0.5 ? ease(k / 0.5) : 1 - ease((k - 0.5) / 0.5) ** 1.2;
      up = rise * H * 0.4;
      rot = Math.sin(t * 7) * 0.08;
      dx = Math.sin(k * Math.PI * 2) * H * 0.05;
      arms = 'heli';
      legs = 'dangle';
      break;
    }
    case 'float': {
      // drifts up like a balloon, swaying, and floats down
      const rise = Math.sin(k * Math.PI);
      up = rise * H * 0.38;
      dx = Math.sin(k * Math.PI * 2) * H * 0.06 * dir;
      rot = Math.sin(t * 3) * 0.16;
      arms = 'out';
      legs = 'dangle';
      break;
    }
    case 'leap': {
      // a dolphin's leap: a long arc forwards, turned along it
      const q = k;
      up = 4 * q * (1 - q) * H * 0.42;
      dx = (q - 0.5) * dir * H * 0.5 + dir * H * 0.25;
      const slope = (4 - 8 * q) * 0.42 * H;
      rot = Math.atan2(-slope, dir * H * 0.5) * dir * 0.8;
      arms = 'out';
      legs = 'tuck';
      break;
    }
    case 'twirl': {
      // up on a spin, like a top
      up = Math.sin(k * Math.PI) * H * 0.34;
      squash = 1 + Math.sin(t * 25) * 0.05;
      rot = Math.sin(k * Math.PI * 6) * 0.35;
      arms = 'cheer';
      legs = 'kick';
      break;
    }
  }
  return { up, dx, rot, squash, arms, legs, eyes, done: k >= 1 };
}
export const FLY_TIME: Record<Fly, number> = { flap: 2.1, flip: 1.15, rocket: 1.7, heli: 2.2, float: 2.4, leap: 1.3, twirl: 1.6 };
