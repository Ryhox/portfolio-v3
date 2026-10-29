import { PAL } from '../palette';
import { clamp, hash2, hex, mulberry, noise1, noise2, Pix, ramp, shade, type Ramp } from '../pix';
import { fern, ground, mossCushion, mossPatch, mushroom, rock, tuft, vine } from './brush';
import type { Layer } from './forest';

type Pt = [number, number];

/** Fills a convex polygon; `fn` picks the colour per pixel. */
function poly(p: Pix, pts: Pt[], fn: (x: number, y: number) => number | null) {
  const xs = pts.map((q) => q[0]);
  const ys = pts.map((q) => q[1]);
  for (let y = Math.floor(Math.min(...ys)); y <= Math.max(...ys); y++) {
    for (let x = Math.floor(Math.min(...xs)); x <= Math.max(...xs); x++) {
      const cx = x + 0.5;
      const cy = y + 0.5;
      let inside = true;
      for (let i = 0; i < pts.length; i++) {
        const [ax, ay] = pts[i];
        const [bx, by] = pts[(i + 1) % pts.length];
        if ((bx - ax) * (cy - ay) - (by - ay) * (cx - ax) < 0) {
          inside = false;
          break;
        }
      }
      if (!inside) continue;
      const c = fn(x, y);
      if (c !== null) p.set(x, y, c);
    }
  }
}

/** Drawn at this scale over the design grid below, so the computer can grow without losing its lines. */
const CS = 1.9;
const s_ = (v: number) => Math.round(v * CS);

/** Where things sit on the computer sprite, in its pixels. */
export const COMPUTER = {
  w: s_(100),
  h: s_(72),
  ax: s_(50),
  /** the case's foot: this row stands on the floor */
  ay: s_(71),
  screen: { x: s_(28), y: s_(15), w: s_(39), h: s_(26) },
  slot: { x: s_(55), y: s_(61), w: s_(20) },
  led: { x: s_(52), y: s_(63) },
};

/**
 * The old computer: a beige CRT on a desktop case, a keyboard dropped in the grass,
 * moss on top and grass growing up round its feet. Light falls from above.
 * Coordinates are on a 100 × 86 design grid, scaled by CS.
 */
export function computerSprite(): Pix {
  const { w, h } = COMPUTER;
  const p = new Pix(w, h);
  const s = PAL.computer.shell;
  const dk = PAL.computer.dark;
  const g = PAL.clearing.grass;
  const sun = PAL.clearing.sun;
  const grain = (x: number, y: number) => (hash2(x, y, 77) < 0.07 ? -1 : 0);
  const at = (r: Ramp, i: number) => r[Math.max(0, Math.min(r.length - 1, i))];
  const P = (pts: Pt[]): Pt[] => pts.map(([x, y]) => [x * CS, y * CS]);
  const box = (x0: number, y0: number, x1: number, y1: number, fn: (x: number, y: number) => number) => {
    for (let y = s_(y0); y < s_(y1); y++) for (let x = s_(x0); x < s_(x1); x++) p.set(x, y, fn(x, y));
  };

  // shadow on the grass
  for (let x = s_(8); x < s_(92); x++) {
    const e = Math.abs(x - s_(50)) / s_(42);
    for (let y = s_(70); y < s_(74) - e * 3; y++) p.set(x, y, at(g, 0));
  }

  // the case
  poly(p, P([[12, 56], [18, 51], [89, 51], [83, 56]]), (x, y) => at(s, 5 + grain(x, y)));
  poly(p, P([[83, 56], [89, 51], [89, 65], [83, 71]]), (x, y) => at(s, (y < s_(54) ? 3 : 2) + grain(x, y)));
  box(12, 56, 83, 71, (x, y) => at(s, (y === s_(56) ? 5 : y >= s_(69) ? 2 : x === s_(12) ? 3 : 4) + grain(x, y)));
  // vents on the left of the case
  for (let r = 0; r < 4; r++) for (let x = s_(17); x < s_(40); x++) p.set(x, s_(59 + r * 2), s[2]);
  // the drive: bezel, slot, eject button
  box(50, 58, 79, 66, (_x, y) => (y === s_(58) ? s[2] : y === s_(66) - 1 ? s[5] : s[3]));
  for (let x = COMPUTER.slot.x; x < COMPUTER.slot.x + COMPUTER.slot.w; x++) {
    p.set(x, COMPUTER.slot.y, dk[0]);
    p.set(x, COMPUTER.slot.y + 1, s[2]);
  }
  box(76, 63, 78, 64, () => s[1]);
  for (let i = 0; i < 3; i++) p.set(COMPUTER.led.x + i, COMPUTER.led.y, dk[1]);

  // the monitor: top, right side, front
  poly(p, P([[20, 8], [27, 2], [82, 2], [75, 8]]), (x, y) => at(s, 6 - (y > s_(6) ? 1 : 0) + grain(x, y)));
  poly(p, P([[75, 8], [82, 2], [82, 46], [75, 52]]), (x, y) => {
    const vent = y > s_(12) && y < s_(40) && (x + y) % 4 === 0 && x > s_(76) && x < s_(81);
    return at(s, (vent ? 1 : y < s_(6) ? 3 : 2) + grain(x, y));
  });
  box(20, 8, 75, 52, (x, y) => at(s, (y === s_(8) ? 5 : x === s_(20) ? 3 : y >= s_(50) ? 3 : 4) + grain(x, y)));
  // the recess round the glass
  const sc = COMPUTER.screen;
  for (let y = sc.y - 3; y < sc.y + sc.h + 3; y++) {
    for (let x = sc.x - 3; x < sc.x + sc.w + 3; x++) p.set(x, y, y < sc.y || x < sc.x ? s[2] : s[5]);
  }
  for (let y = sc.y; y < sc.y + sc.h; y++) for (let x = sc.x; x < sc.x + sc.w; x++) p.set(x, y, PAL.computer.screen[0]);
  // badge and power button under the glass
  for (let x = s_(30); x < s_(37); x++) p.set(x, s_(46), s[3]);
  box(66, 46, 68, 48, (_x, y) => (y === s_(46) ? s[2] : s[3]));

  // moss cushions along the top of the monitor and on the case, drooping over the front edge
  const moss = ramp('#1c301b', '#28411f', '#365727', '#486d30', '#5e853a', '#7c9c4b', '#a3b866');
  const rnd0 = mulberry(31);
  for (let i = 0; i < 7; i++) {
    const x = s_(26) + rnd0() * s_(52);
    mossCushion(p, x, s_(8), s_(5) + rnd0() * s_(7), s_(2) + rnd0() * s_(2.4), moss, 40 + i);
  }
  for (let i = 0; i < 4; i++) mossCushion(p, s_(22) + rnd0() * s_(54), s_(4) + rnd0() * s_(2), s_(4) + rnd0() * s_(5), s_(1.6), moss, 60 + i, false);
  mossCushion(p, s_(20), s_(56), s_(9), s_(2.4), moss, 70);
  mossCushion(p, s_(84), s_(51), s_(5), s_(1.6), moss, 71);
  // a sprout on top, and ivy hanging down the side of the monitor
  p.set(s_(62), 1, sun[2]);
  p.set(s_(62) - 1, 2, sun[1]);
  p.set(s_(62) + 1, 1, sun[3]);
  vine(p, s_(81), s_(4), s_(50), PAL.clearing.leaf.slice(1), 81);
  vine(p, s_(77), s_(8), s_(22), PAL.clearing.leaf.slice(1), 82);

  // grass growing up round the case and over the keyboard
  const rnd = mulberry(91);
  for (let i = 0; i < 34; i++) {
    const x = s_(8) + rnd() * s_(84);
    tuft(p, x, s_(71) - rnd() * 2, 4 + rnd() * 8, rnd() < 0.5 ? sun : g, 92 + i, 0.55);
  }
  p.outline(0.6, 0.88);
  return p;
}

/** The keyboard, dropped a little askew in the grass in front of the computer. Its bottom row lies on the floor. */
export const KEYBOARD = { w: s_(54), h: s_(12), cx: s_(27.5) };
export function keyboardSprite(): Pix {
  const p = new Pix(KEYBOARD.w, KEYBOARD.h);
  const g = PAL.clearing.grass;
  const sun = PAL.clearing.sun;
  const grain = (x: number, y: number) => (hash2(x, y, 78) < 0.07 ? -1 : 0);
  const at = (r: Ramp, i: number) => r[Math.max(0, Math.min(r.length - 1, i))];
  // the design grid's keyboard sat at x 3..52, y 72..84; shift it to this sprite's corner
  const P = (pts: Pt[]): Pt[] => pts.map(([x, y]) => [x * CS, (y - 72) * CS]);
  const s_k = (v: number) => Math.round(v * CS);
  poly(p, P([[3, 82], [9, 74], [52, 72], [47, 80]]), (x, y) => at(PAL.computer.key, 2 + grain(x, y)));
  for (let r = 0; r < 3; r++) {
    for (let k = 0; k < 13; k++) {
      const x = s_k(9 + k * 3 + (2 - r) * 1.9);
      const y = s_k(2 + r * 2 - k * 0.06);
      for (let i = 0; i < 3; i++) p.set(x + i, y, PAL.computer.key[3]);
    }
  }
  for (let x = s_k(4); x < s_k(48); x++) {
    const y = Math.round(s_k(10) - (x - s_k(3)) * (2 / 44));
    p.set(x, y, PAL.computer.key[0]);
    p.set(x, y + 1, PAL.computer.key[0]);
  }
  const rnd = mulberry(93);
  for (let i = 0; i < 16; i++) tuft(p, rnd() * KEYBOARD.w, KEYBOARD.h - 1 - rnd() * 3, 3 + rnd() * 6, rnd() < 0.5 ? sun : g, 140 + i, 0.55);
  p.outline(0.6, 0.88);
  return p;
}

/** The empty grey-green of the glass, with a cursor when `cursor` is on. */
export function screenIdle(cursor: boolean): Pix {
  const { w, h } = COMPUTER.screen;
  const p = new Pix(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) p.set(x, y, shade(PAL.computer.screen, 0.3 + (y / h) * 0.2));
  if (cursor) for (let y = 3; y < 6; y++) for (let x = 3; x < 5; x++) p.set(x, y, PAL.computer.glass[0]);
  roundCorners(p);
  return p;
}

/** The glass showing a project picture, already shrunk to the glass and posterised. */
export function screenPicture(px: Uint32Array, scan = 1): Pix {
  const { w, h } = COMPUTER.screen;
  const p = new Pix(w, h);
  const rows = Math.round(h * scan);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) p.set(x, y, y < rows ? px[y * w + x] : shade(PAL.computer.screen, 0.3));
  }
  if (scan < 1) for (let x = 0; x < w; x++) p.set(x, Math.min(h - 1, rows), PAL.computer.glass[1]);
  roundCorners(p);
  return p;
}

function roundCorners(p: Pix) {
  const c = PAL.computer.shell[2];
  p.set(0, 0, c);
  p.set(p.w - 1, 0, c);
  p.set(0, p.h - 1, PAL.computer.shell[5]);
  p.set(p.w - 1, p.h - 1, PAL.computer.shell[5]);
}

/** Shrinks a picture to the glass (cover fit) and posterises it so it reads as pixels. */
export function pictureToScreen(img: HTMLImageElement, focusX = 0.5): Uint32Array {
  const { w, h } = COMPUTER.screen;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true })!;
  const ir = img.width / img.height;
  const r = w / h;
  let sw = img.width;
  let sh = img.height;
  if (ir > r) sw = img.height * r;
  else sh = img.width / r;
  const sx = (img.width - sw) * focusX;
  const sy = (img.height - sh) / 2;
  g.imageSmoothingQuality = 'high';
  g.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
  const d = g.getImageData(0, 0, w, h).data;
  const out = new Uint32Array(w * h);
  const q = (v: number) => Math.round(Math.round((v / 255) * 5) * (255 / 5));
  for (let i = 0; i < w * h; i++) {
    // a touch of green phosphor and a little lift, so it sits in the old glass
    const r0 = q(d[i * 4] * 0.92 + 6);
    const g0 = q(d[i * 4 + 1] * 0.95 + 12);
    const b0 = q(d[i * 4 + 2] * 0.88 + 6);
    out[i] = (0xff000000 | (Math.min(255, b0) << 16) | (Math.min(255, g0) << 8) | Math.min(255, r0)) >>> 0;
  }
  return out;
}

/**
 * A 3.5" floppy lying in the grass, seen from above at the scene's slant, turned by `angle`.
 * `size` is its width in pixels. Returns the sprite and where its centre is.
 */
export function discSprite(size: number, angle: number, body: string, accent: string, seed: number) {
  const squash = 0.62;
  const ca = Math.cos(angle);
  const sa = Math.sin(angle);
  const half = size * 0.72;
  const w = Math.ceil(half * 2) + 3;
  const h = Math.ceil(half * 2 * squash) + 4;
  const cx = w / 2 - 1;
  const cy = h / 2 - 1.5;
  const p = new Pix(w, h);
  const b = hex(body);
  const bd = darken(b, 0.62);
  const bl = darken(b, 1.25);
  const ac = hex(accent);
  const metal = PAL.disc.metal;
  const label = PAL.disc.label;
  const ink = PAL.disc.ink;
  const inside = new Uint8Array(w * h);
  const uvAt = (x: number, y: number): [number, number] => {
    const dx = x + 0.5 - cx;
    const dy = (y + 0.5 - cy) / squash;
    return [(dx * ca + dy * sa) / size + 0.5, (-dx * sa + dy * ca) / size + 0.5];
  };
  const isIn = (u: number, v: number) => u >= 0 && u <= 1 && v >= 0 && v <= 1 && !(u - 0.9 > v);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [u, v] = uvAt(x, y);
      if (!isIn(u, v)) continue;
      inside[y * w + x] = 1;
      let c = (u + v) * 0.5 < 0.42 ? bl : b;
      if (u < 0.05 || v > 0.95) c = bd;
      if (u > 0.28 && u < 0.72 && v < 0.36) {
        c = shade(metal, 0.75 - v);
        if (u > 0.52 && u < 0.64 && v > 0.06 && v < 0.29) c = bd;
      } else if (u > 0.13 && u < 0.87 && v > 0.47 && v < 0.97) {
        c = label[v < 0.6 ? 1 : 2];
        if (v < 0.57) c = ac;
      }
      if (u > 0.86 && u < 0.94 && v > 0.04 && v < 0.12) c = bd;
      p.set(x, y, c);
    }
  }
  // its thickness, then its shadow on the grass
  for (let y = h - 1; y > 0; y--) {
    for (let x = 0; x < w; x++) {
      if (!inside[y * w + x] && inside[(y - 1) * w + x]) p.set(x, y, bd);
    }
  }
  const shadow = PAL.clearing.grass[0];
  for (let y = h - 1; y > 1; y--) {
    for (let x = 1; x < w; x++) {
      if (p.get(x, y) >>> 24) continue;
      if (inside[(y - 2) * w + (x - 1)]) p.set(x, y, shadow);
    }
  }
  p.outline(0.62, 0.9);
  return { pix: p, cx, cy };
}

function darken(c: number, f: number): number {
  const r = Math.min(255, Math.round((c & 255) * f));
  const g = Math.min(255, Math.round(((c >>> 8) & 255) * f));
  const b = Math.min(255, Math.round(((c >>> 16) & 255) * f));
  return (0xff000000 | (b << 16) | (g << 8) | r) >>> 0;
}

/** The cat, drawn by hand. k = fur, y/Y = eyes, t = tail. Edges facing up catch a little light. */
export const CAT = [
  '.......k.........k......',
  '......kk........kk......',
  '......kkk......kkk......',
  '......kkkkkkkkkkkk......',
  '.....kkkkkkkkkkkkkk.....',
  '.....kkkkkkkkkkkkkk.....',
  '.....kkYykkkkkkYykk.....',
  '.....kkyykkkkkkyykk.....',
  '.....kkkkkkkkkkkkkk.....',
  '......kkkkkkkkkkkk......',
  '.......kkkkkkkkkk.......',
  '..tt...kkkkkkkkkk.......',
  '.t..t.kkkkkkkkkkkk......',
  '.t..tkkkkkkkkkkkkkk.....',
  '..t.tkkkkkkkkkkkkkkk....',
  '....tkkkkkkkkkkkkkkk....',
  '....tkkkkkkkkkkkkkkkk...',
  '...ttkkkkkkkkkkkkkkkk...',
  '...tkkkkkkkkkkkkkkkkkk..',
  '...tkkkkkkkkkkkkkkkkkk..',
  '...ttkkkkkkkkkkkkkkkkk..',
  '....tkkkkkk.kkkk.kkkkk..',
  '.....kkkkkkkkkkkkkkkkk..',
];

export const CAT_SIZE = { w: CAT[0].length, h: CAT.length };

export function catSprite(blink: boolean): Pix {
  const { w, h } = CAT_SIZE;
  const p = new Pix(w, h);
  const fur = PAL.hollow.cat;
  const eye = PAL.hollow.eye;
  const solid = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && CAT[y][x] !== '.';
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ch = CAT[y][x];
      if (ch === '.') continue;
      let c = fur[0];
      if (ch === 't' || ch === 'k') {
        // a faint rim where the light from the hollow catches the fur
        if (!solid(x, y - 1) || (!solid(x - 1, y) && y < 12)) c = fur[2];
        else if (!solid(x + 1, y) || !solid(x - 1, y)) c = fur[1];
      }
      if (ch === 'Y') c = blink ? fur[0] : eye[2];
      if (ch === 'y') c = blink ? (y === 7 ? fur[3] : fur[0]) : eye[1];
      p.set(x, y, c);
    }
  }
  return p;
}

/**
 * The cat holding out a paw with a pill on it, laid over the sitting cat (same grid, wider to the right).
 * Frame 0 is the paw on its way up, frame 1 held out. Spans of [row, x0, x1, colour key].
 */
const PAW: [number, number, number, string][][] = [
  [
    [12, 21, 22, 'Q'], [12, 23, 24, 'W'], [13, 20, 22, 'P'], [13, 23, 25, 'w'], [14, 21, 22, 'R'], [14, 23, 24, 'v'],
    [15, 19, 25, 'r'], [16, 17, 25, 'k'], [16, 17, 18, 'r'], [17, 16, 21, 'k'], [17, 16, 16, 'r'],
  ],
  [
    [9, 24, 25, 'Q'], [9, 26, 27, 'W'], [10, 23, 25, 'P'], [10, 26, 28, 'w'], [11, 24, 25, 'R'], [11, 26, 27, 'v'],
    [12, 22, 28, 'r'], [13, 20, 28, 'k'], [13, 20, 21, 'r'], [14, 18, 25, 'k'], [14, 18, 19, 'r'], [15, 16, 22, 'k'], [15, 16, 17, 'r'], [16, 15, 19, 'k'],
    [13, 28, 28, 'p'],
  ],
];
export const PAW_W = 32;
/** Where the pill lies on the held-out paw, in the cat's pixels. */
export const PILL_AT = { x: 25.5, y: 9 };

export function catPawSprite(frame: number): Pix {
  const p = new Pix(PAW_W, CAT_SIZE.h);
  const cols: Record<string, number> = {
    k: PAL.hollow.cat[0], r: PAL.hollow.cat[2], p: hex('#5a3434'),
    P: hex('#b8392c'), Q: hex('#d9705a'), R: hex('#7c2620'), w: hex('#e9e1d0'), W: hex('#fbf6e8'), v: hex('#b9ac8e'),
  };
  for (const [y, x0, x1, c] of PAW[frame]) for (let x = x0; x <= x1; x++) p.set(x, y, cols[c]);
  return p;
}

/**
 * The cat's hollow, near layer: a mossy stump with roots in the grass, a toadstool or two,
 * and shade towards you where the footer sits. The stump top is at `top` (pixels above the ground row).
 */
export function hollowStump(): Layer & { catAt: [number, number] } {
  const d = 5;
  const w = 1024;
  const ay = 120;
  const h = ay + 16;
  const p = new Pix(w, h, true);
  const cx = w / 2;
  const H = PAL.hollow;

  // the stump
  const rx = 40;
  const ry = 10;
  const top = ay - 52;
  const rnd = mulberry(702);
  for (let y = top; y <= ay + 3; y++) {
    const k = (y - top) / (ay - top);
    const half = rx + Math.pow(k, 4) * 14 + (noise1(y * 0.2, 3) - 0.5) * 2;
    for (let x = Math.floor(cx - half); x < cx + half; x++) {
      const u = (x + 0.5 - cx) / half;
      const a = Math.asin(clamp(u, -0.999, 0.999));
      const groove = noise1(a * 7 + noise1(y * 0.07, 5) * 1.5, 704);
      let t = 0.62 - u * 0.38 - k * 0.12;
      if (groove > 0.66) t -= 0.22;
      else if (groove < 0.2) t += 0.1;
      if (Math.abs(u) > 0.9) t -= 0.15;
      // the foot is solid bark, darkening into the ground; moss only on the upper sides, in patches
      if (k > 0.82) t -= (k - 0.82) * 1.6;
      let c = shade(H.bark, t + (hash2(x, y, 705) - 0.5) * 0.08);
      const m = noise2(x * 0.12, y * 0.16, 706) - k * 0.7 + (u < 0 ? 0.06 : -0.06);
      if (k < 0.62 && m > 0.5) c = shade(H.moss, 0.3 + (m - 0.5) * 2 - u * 0.3 + (hash2(x, y, 708) - 0.5) * 0.25);
      p.set(x, y, c);
    }
  }
  // roots spreading into the grass
  for (const [sx, dir, len] of [[-34, -1, 30], [-14, -1, 16], [22, 1, 22], [36, 1, 32]] as const) {
    for (let i = 0; i < len; i++) {
      const t = i / len;
      const x = cx + sx + dir * i;
      const y = ay - 8 + t * 10 + Math.sin(t * 3) * 1.5;
      const thick = Math.round(7 * (1 - t) + 1);
      for (let j = 0; j < thick; j++) {
        const c = shade(H.bark, (j === 0 ? 0.62 : 0.5) - (j / thick) * 0.4 - t * 0.15 - (dir > 0 ? 0.08 : 0));
        p.set(x, y + j, c);
      }
    }
  }
  // the cut top: rings, a darker rim, moss creeping over the edge
  for (let y = top - ry; y <= top + ry; y++) {
    for (let x = cx - rx; x <= cx + rx; x++) {
      const dx = (x + 0.5 - cx) / rx;
      const dy = (y + 0.5 - top) / ry;
      const e = Math.sqrt(dx * dx + dy * dy);
      if (e > 1) continue;
      const ring = (e * 5.5 + noise2(x * 0.1, y * 0.3, 709) * 0.8) % 1;
      let c = shade(H.rings, 0.7 - e * 0.45 - dx * 0.15 + (ring < 0.3 ? -0.2 : 0));
      if (e > 0.86) c = shade(H.bark, 0.35 - dy * 0.2);
      if (e > 0.78 && noise2(x * 0.18, y * 0.5, 710) > 0.55) c = shade(H.moss, 0.55 - dy * 0.3 + (hash2(x, y, 711) - 0.5) * 0.3);
      p.set(x, y, c);
    }
  }
  // grass in front of the roots, toadstools, a pebble
  for (let i = 0; i < 18; i++) tuft(p, cx - 70 + rnd() * 140, ay + 2 + rnd() * 6, 5 + rnd() * 7, H.grass, 720 + i, 0.55);
  mushroom(p, cx + 66, ay + 6, 9, H.cap, H.stem, 730);
  mushroom(p, cx + 76, ay + 8, 5, H.cap, H.stem, 731);
  mushroom(p, cx - 82, ay + 12, 6, H.cap, H.stem, 732);
  rock(p, cx - 60, ay + 10, 9, 5, PAL.clearing.rock, 733);
  for (let i = 0; i < 10; i++) {
    const side = i % 2 ? 1 : -1;
    fern(p, cx + side * (110 + rnd() * 260), ay + 8 + rnd() * 6, 10 + rnd() * 10, H.wall.slice(2), 740 + i);
  }
  p.outline();
  p.bleed();
  return { pix: p, ax: cx, ay: ay + 2, d, repeat: true, catAt: [cx, top - 3] };
}

/**
 * The back of the hollow: leaves swirling round a lighter heart, darkening outwards
 * until it's just the dark of the wood. `cy` is the heart's height in pixels from the top.
 */
export function hollowWall(): Layer & { heart: [number, number] } {
  const d = 11;
  const w = 1120;
  const h = 780;
  const p = new Pix(w, h);
  const cx = w / 2;
  const cy = 390;
  const wall = PAL.hollow.wall;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) p.set(x, y, wall[0]);
  const rnd = mulberry(801);
  const strokes = 1700;
  const list: { r: number; a: number; len: number; wd: number }[] = [];
  for (let i = 0; i < strokes; i++) {
    // rings all the way out past the edges of the screen, so the swirl never just ends
    const r = 18 + Math.pow(rnd(), 0.8) * 372;
    list.push({ r, a: rnd() * Math.PI * 2, len: 0.35 + rnd() * 0.7, wd: 2 + rnd() * (3 + r * 0.02) });
  }
  // outermost first, so the lighter inner strokes sit on top
  list.sort((a, b) => b.r - a.r);
  for (const s of list) {
    const steps = Math.ceil(s.len * s.r * 1.2);
    const light = clamp(1 - s.r / 330);
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const a = s.a + t * s.len;
      // a spiral: the radius tightens along the stroke
      const r = s.r * (1 - t * 0.12);
      const x = cx + Math.cos(a) * r * 1.25;
      const y = cy + Math.sin(a) * r * 0.82;
      const taper = Math.sin(t * Math.PI);
      const wd = Math.max(1, s.wd * taper);
      for (let j = 0; j < wd; j++) {
        const nx = Math.cos(a);
        const ny = Math.sin(a);
        // inner edge of each stroke catches the light from the heart
        const edge = j < 1 ? 0.12 : j > wd - 1.5 ? -0.08 : 0;
        const c = shade(wall, 0.08 + light * light * 0.8 + edge + (hash2(Math.round(x), Math.round(y), 802) - 0.5) * 0.06);
        p.set(x + nx * j * 1.25, y + ny * j * 0.82, c);
      }
    }
  }
  // the heart itself: soft lit leaves behind the cat
  for (let y = cy - 70; y < cy + 70; y++) {
    for (let x = cx - 100; x < cx + 100; x++) {
      const dx = (x - cx) / 82;
      const dy = (y - cy) / 56;
      const e = dx * dx + dy * dy + (noise2(x * 0.08, y * 0.08, 803) - 0.5) * 0.5;
      if (e > 1) continue;
      p.set(x, y, shade(wall, 0.62 + (1 - e) * 0.38 + (hash2(x >> 1, y >> 1, 804) - 0.5) * 0.12));
    }
  }
  return { pix: p, ax: cx, ay: cy, d, heart: [cx, cy] };
}

/**
 * The beam of light falling into the clearing: two hard-edged bands of thin light, no blur.
 * Alpha is stored in the buffer and blended over the scene.
 */
export function shaftSprite(): Pix {
  const w = 150;
  const h = 250;
  const p = new Pix(w, h);
  const col = (a: number) => {
    const ai = Math.round(a * 255);
    return ((ai << 24) | (0xb0 << 16) | (0xf3 << 8) | 0xee) >>> 0;
  };
  for (let y = 0; y < h; y++) {
    const k = y / h;
    const centre = 112 - k * 66;
    const half = 18 + k * 30;
    for (let x = 0; x < w; x++) {
      const dx = Math.abs(x - centre) / half;
      if (dx > 1) continue;
      let a = dx < 0.55 ? 0.17 : 0.09;
      // streaks inside the beam
      if (noise1((x - centre) * 0.5 + y * 0.02, 901) > 0.7) a += 0.04;
      // the beam softens out where it reaches the ground, in steps
      if (k > 0.8) a *= Math.max(0, 1 - Math.floor((k - 0.8) * 25) / 5);
      if (a > 0) p.set(x, y, col(a));
    }
  }
  return p;
}

/** What's written on the notice board, and the fonts to write it in (font-family strings). */
export type NoticeText = {
  title: string;
  kicker?: string;
  body: string;
  stack?: string;
  links: string[];
  /** which link is under the pointer, and which is pressed */
  hover: number | null;
  press: number | null;
  fonts: { display: string; pixel: string };
};
type Rect = { x: number; y: number; w: number; h: number };
/** The old notice board in the clearing: where its paper and its painted buttons are, and the foot it stands on. */
export type Notice = { pix: Pix; ax: number; ay: number; paper: Rect; links: Rect[] };

const INK = { title: hex('#36261b'), kicker: hex('#55652a'), body: hex('#43331f'), soft: hex('#776651') };
const BTN = { outline: hex('#2b1e16'), body: hex('#94bc72'), light: hex('#c4e199'), dark: hex('#668f4c'), hover: hex('#a6cd83'), text: hex('#fffbea') };
let scratch: CanvasRenderingContext2D | null = null;

/**
 * Writes text into a sprite in true pixels: each line is drawn by the browser at the sprite's own size and
 * kept only where it's solidly inked, so letters come out crisp, never smudged. Returns the lines' width.
 */
function letter(p: Pix, x: number, y: number, text: string, font: string, color: number) {
  scratch ??= document.createElement('canvas').getContext('2d', { willReadFrequently: true })!;
  const g = scratch;
  g.font = font;
  const w = Math.ceil(g.measureText(text).width) + 2;
  const h = 24;
  if (g.canvas.width < w || g.canvas.height < h) {
    g.canvas.width = Math.max(g.canvas.width, w);
    g.canvas.height = h;
  }
  g.clearRect(0, 0, g.canvas.width, h);
  g.font = font;
  g.textBaseline = 'top';
  g.fillStyle = '#000';
  g.fillText(text, 1, 1);
  const d = g.getImageData(0, 0, w, h).data;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (d[(j * w + i) * 4 + 3] > 120) p.set(x + i - 1, y + j - 1, color);
  return w - 2;
}

/** Breaks text into lines no wider than `max` pixels in the given font. */
function wrap(text: string, font: string, max: number) {
  scratch ??= document.createElement('canvas').getContext('2d', { willReadFrequently: true })!;
  scratch.font = font;
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (line && scratch.measureText(next).width > max) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * Lays the words out on the paper, as large as they fit: a pixel serif title, then the rest in pixel type,
 * and a row of little pixel buttons for the links. Returns where the buttons went, or null if it doesn't fit.
 */
function writeNotice(p: Pix, paper: Rect, text: NoticeText, big: boolean): Rect[] | null {
  const m = 4;
  const x0 = paper.x + m;
  const max = paper.w - m * 2 - 3;
  const bottom = paper.y + paper.h - 4;
  const ts = big ? 16 : 14;
  const bs = big ? 12 : 11;
  const titleFont = `600 ${ts}px ${text.fonts.display}`;
  const font = `500 ${bs}px ${text.fonts.pixel}`;
  const parts: { lines: string[]; font: string; color: number; lh: number; after: number }[] = [
    { lines: wrap(text.title, titleFont, max), font: titleFont, color: INK.title, lh: ts + 1, after: 1 },
  ];
  if (text.kicker) parts.push({ lines: wrap(text.kicker, font, max), font, color: INK.kicker, lh: bs + 1, after: 2 });
  parts.push({ lines: wrap(text.body, font, max), font, color: INK.body, lh: bs, after: 2 });
  if (text.stack) parts.push({ lines: wrap(text.stack, font, max), font, color: INK.soft, lh: bs, after: 3 });
  const btnH = bs + 5;
  const height = parts.reduce((s, q) => s + q.lines.length * q.lh + q.after, 0) + (text.links.length ? btnH : 0);
  if (paper.y + m + height > bottom) return null;
  let y = paper.y + m;
  for (const q of parts) {
    for (const line of q.lines) {
      letter(p, x0, y, line, q.font, q.color);
      y += q.lh;
    }
    y += q.after;
  }
  // the links: little sage buttons with a dark rim and a lit top, pressed in when clicked
  const rects: Rect[] = [];
  let x = x0;
  text.links.forEach((label, i) => {
    scratch!.font = font;
    const w = Math.ceil(scratch!.measureText(label).width) + 10;
    const down = text.press === i ? 1 : 0;
    const by = y + down;
    for (let j = 0; j < btnH; j++) {
      for (let k = 0; k < w; k++) {
        const corner = (j === 0 || j === btnH - 1) && (k === 0 || k === w - 1);
        if (corner) continue;
        const rim = j === 0 || j === btnH - 1 || k === 0 || k === w - 1;
        const tone = rim ? BTN.outline : j === 1 ? BTN.light : j >= btnH - 3 ? BTN.dark : text.hover === i ? BTN.hover : BTN.body;
        p.set(x + k, by + j, tone);
      }
    }
    if (!down) for (let k = 1; k < w - 1; k++) p.set(x + k, by + btnH, BTN.outline);
    letter(p, x + 5, by + 3, label, font, BTN.outline);
    letter(p, x + 5, by + 2, label, font, BTN.text);
    rects.push({ x, y, w, h: btnH + 1 });
    x += w + 4;
  });
  return rects;
}

/**
 * The old notice board: a panel of weathered planks `bw` × `bh` under a little shingled roof, on round posts
 * `legs` tall, with a yellowed paper pinned in the middle and `text` written right on it in pixels, so the words
 * take the board's light and break with it. It stands right of the middle, so its left edge shows its thickness.
 * Moss sits thick on the roof and the ledges and creeps up the posts; ivy hangs down, grass and caps at its feet.
 */
export function noticeSprite(bw: number, bh: number, legs: number, text: NoticeText): Notice {
  const over = 6;
  const W = bw + over * 2;
  // room above for the moss heaped on the cap rail
  const py0 = 7;
  const py1 = py0 + bh;
  const H = py1 + legs + 1;
  const p = new Pix(W, H);
  const wood = ramp('#211a15', '#31271f', '#45382c', '#5a4a3a', '#715e4a', '#8a765e', '#a28f75');
  const paper = ramp('#8c7f63', '#b9aa86', '#d8caa6', '#ece0c1', '#f6edd4');
  const moss = ramp('#1c301b', '#28411f', '#365727', '#486d30', '#5e853a', '#7c9c4b', '#a3b866');
  const px0 = over;
  const px1 = over + bw;
  const at = (r: Ramp, i: number) => r[Math.max(0, Math.min(r.length - 1, i))];
  const grain = (x: number, y: number, s: number) => (hash2(x, y >> 1, s) < 0.1 ? -1 : hash2(x, y, s + 3) < 0.04 ? 1 : 0);
  const ground = H - 1;

  // the posts, round: lit on the left, falling into shade on the right, a soft shade on the grass round their feet
  const postW = 7;
  const posts = [px0 + Math.round(bw * 0.15), px1 - Math.round(bw * 0.15) - postW];
  for (let x = posts[0] - 8; x < posts[1] + postW + 10; x++) {
    const e = Math.abs(x - (posts[0] + posts[1] + postW) / 2) / ((posts[1] - posts[0]) / 2 + 12);
    for (let y = ground - 2 + Math.round(e * 2); y <= ground; y++) p.set(x, y, PAL.clearing.grass[0]);
  }
  const tones = [2, 5, 4, 4, 3, 2, 1];
  for (const x0 of posts) for (let y = py0 + 2; y <= ground; y++) for (let i = 0; i < postW; i++) p.set(x0 + i, y, at(wood, tones[i] + grain(x0 + i, y, 5)));

  // the panel's left edge: its thickness, receding towards the middle of the view
  for (let i = 1; i <= 3; i++) for (let y = py0 + Math.ceil(i * 0.6); y < py1 - Math.ceil(i * 0.4); y++) p.set(px0 - i, y, at(wood, 1 + grain(px0 - i, y, 6)));
  // the panel: a frame of four boards round a backing of planks, set back in its shade
  for (let y = py0; y < py1; y++) {
    for (let x = px0; x < px1; x++) {
      const fl = x - px0;
      const fr = px1 - 1 - x;
      const ft = y - py0;
      const fb = py1 - 1 - y;
      let t: number;
      if (ft < 5 && ft <= fl && ft <= fr) t = ft === 4 ? 4 : 5;
      else if (fb < 5 && fb <= fl && fb <= fr) t = fb === 4 ? 3 : 2;
      else if (fl < 5) t = fl === 0 ? 3 : 4;
      else if (fr < 5) t = fr === 0 ? 2 : 3;
      else {
        // the backing, its plank seams every seven rows, shadowed under the top board and the left one
        t = (ft - 5) % 7 === 0 ? 1 : 2;
        if (ft === 5 || fl === 5) t = 1;
        if (fr === 5 || fb === 5) t = 3;
      }
      p.set(x, y, at(wood, t + grain(x, y, 7)));
    }
  }
  // a cap rail along the top, a little proud of the panel, lit on top
  for (let y = py0 - 2; y < py0 + 2; y++) for (let x = px0 - 3; x < px1 + 3; x++) p.set(x, y, at(wood, (y === py0 - 2 ? 6 : y === py0 + 1 ? 2 : 4) + grain(x, y, 8)));
  // nail heads at the frame's corners
  for (const [nx, ny] of [[px0 + 2, py0 + 3], [px1 - 3, py0 + 3], [px0 + 2, py1 - 3], [px1 - 3, py1 - 3]]) {
    p.set(nx, ny, wood[0]);
    p.set(nx - 1, ny - 1, wood[6]);
  }

  // an older note peeking out from behind, low on the left
  const paperX = px0 + 9;
  const paperY = py0 + 8;
  const paperW = bw - 18;
  const paperH = bh - 17;
  for (let y = 0; y < 14; y++) for (let x = 0; x < 20; x++) {
    p.set(paperX - 3 + x + Math.floor(y / 3), paperY + paperH - 9 + y, at(paper, 2 - (y > 11 ? 1 : 0) + (hash2(x, y, 41) < 0.08 ? -1 : 0)));
  }
  // the paper's shadow on the backing, then the paper, yellowing towards its edges, with a dog-ear
  for (let y = paperY + 1; y <= paperY + paperH; y++) for (let x = paperX + 1; x <= paperX + paperW; x++) p.set(x, y, wood[0]);
  const ear = 6;
  for (let y = paperY; y < paperY + paperH; y++) {
    for (let x = paperX; x < paperX + paperW; x++) {
      const fx = x - paperX;
      const fy = y - paperY;
      if (paperW - 1 - fx + fy < ear) continue;
      const edge = Math.min(fx, fy, paperW - 1 - fx, paperH - 1 - fy);
      let t = edge === 0 ? 2 : edge < 3 ? 3 : 4;
      if (fy === paperH - 1) t = 1;
      if (edge > 2 && hash2(x, y, 43) < 0.012) t = 3;
      p.set(x, y, paper[t]);
    }
  }
  // the folded corner, its underside darker
  for (let j = 0; j < ear; j++) for (let i = 0; i < ear - j; i++) p.set(paperX + paperW - ear + i + j, paperY + j, paper[i === ear - j - 1 ? 1 : 2]);
  // a red pin at the top
  const pinX = paperX + Math.round(paperW / 2);
  p.set(pinX, paperY + 1, hex('#b8392c'));
  p.set(pinX + 1, paperY + 1, hex('#7c2620'));
  p.set(pinX, paperY, hex('#e8786a'));
  p.set(pinX + 1, paperY + 2, wood[0]);

  // moss: heaped thick along the cap rail and dripping over it, on the bottom ledge, creeping up the posts
  const rnd = mulberry(611);
  for (let i = 0; i < 9; i++) mossCushion(p, px0 - 2 + rnd() * (bw + 4), py0 - 2, 7 + rnd() * 10, 3 + rnd() * 2.5, moss, 620 + i);
  for (let i = 0; i < 4; i++) mossCushion(p, px0 + rnd() * bw, py1, 6 + rnd() * 9, 2 + rnd() * 1.5, moss, 660 + i);
  mossPatch(p, px0 + 3, py1 - 7, 3, 7, moss, 672, true);
  mossPatch(p, px1 - 3, py0 + 12, 2.5, 6, moss, 673, true);
  mossPatch(p, px0 + 2, py0 + 6, 2.5, 4, moss, 674, true);
  for (const x0 of posts) {
    mossPatch(p, x0 + 2, ground - 4, 3, Math.min(10, legs * 0.4 + 2), moss, 680 + x0, true);
    mossPatch(p, x0 + 1, py1 + legs * 0.45, 2, 3, moss, 690 + x0, true);
  }
  // ivy hanging off the cap rail and down the sides of the panel
  vine(p, px0 + 2, py0 + 1, Math.round(bh * 0.7 + legs * 0.4), PAL.clearing.leaf.slice(1), 701);
  vine(p, px1 - 2, py0 + 1, Math.round(bh * 0.45), PAL.clearing.leaf.slice(1), 702);

  // at its feet: grass, a few caps and a flower or two
  const g = PAL.clearing.grass;
  const sun = PAL.clearing.sun;
  for (let i = 0; i < 18; i++) {
    const x = posts[0] - 6 + rnd() * (posts[1] - posts[0] + postW + 12);
    tuft(p, x, ground - rnd(), 3 + rnd() * 6, rnd() < 0.4 ? sun : g, 720 + i, 0.55);
  }
  mushroom(p, posts[1] + postW + 2, ground, 5, PAL.hollow.cap, PAL.hollow.stem, 741);
  mushroom(p, posts[1] + postW + 6, ground, 3, PAL.hollow.cap, PAL.hollow.stem, 742);
  mushroom(p, posts[0] - 3, ground, 4, PAL.hollow.cap, PAL.hollow.stem, 743);
  for (const [fx, fc] of [[posts[0] + 10, '#ece6d4'], [posts[1] - 6, '#e7b73c'], [posts[0] - 6, '#a8443c']] as const) {
    p.set(fx, ground - 5, hex(fc));
    p.set(fx, ground - 4, PAL.clearing.leaf[3]);
  }
  p.outline(0.6, 0.88);

  // the words, written last and right on the paper: at full size, without the stack line if need be, smaller
  // only after that, and only if even that won't fit is the description cut short with an ellipsis
  const paperRect = { x: paperX, y: paperY, w: paperW, h: paperH };
  let links: Rect[] | null = null;
  for (let words = text.body.split(' '); !links && words.length; words = words.slice(0, -1)) {
    const body = words.length === text.body.split(' ').length ? text.body : `${words.join(' ')}…`;
    const scratchPix = new Pix(W, H);
    scratchPix.data.set(p.data);
    const t = { ...text, body };
    // the pixel type only stays whole at its full size, so the stack line goes before the type gets smaller
    const bare = { ...t, stack: undefined };
    links = writeNotice(scratchPix, paperRect, t, true) ?? writeNotice(scratchPix, paperRect, bare, true) ?? writeNotice(scratchPix, paperRect, bare, false);
    if (links) p.data.set(scratchPix.data);
  }
  return { pix: p, ax: Math.round(W / 2), ay: H, paper: paperRect, links: links ?? [] };
}
