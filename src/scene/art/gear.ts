/**
 * What pill mode adds to the painting: the muzzle flash, the crosshair and hit marker, the arcade counter's
 * digits, and the reeds round the water. Painted in the same ramps and outlines as everything else.
 */
import { hash2, hex, mulberry, Pix, ramp, shade } from '../pix';
import { PAL } from '../palette';
import { tuft } from './brush';

export const INK = hex('#1a1410');
export const CREAM = hex('#f1ebd6');

/** The hit marker: four short diagonals round the middle, cream with a dark edge. */
export function hitSprite(): Pix {
  const p = new Pix(15, 15);
  const on = new Set<number>();
  for (const [sx, sy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) for (let i = 3; i <= 5; i++) on.add((7 + sy * i) * 15 + 7 + sx * i);
  for (let y = 0; y < 15; y++)
    for (let x = 0; x < 15; x++) {
      const i = y * 15 + x;
      if (on.has(i)) p.set(x, y, hex('#fffbea'));
      else if (on.has(i - 1) || on.has(i + 1) || on.has(i - 15) || on.has(i + 15)) p.set(x, y, INK);
    }
  return p;
}

/** A small burst at the muzzle: a cross of light with a hot middle, two frames of it. */
export function flashSprite(big: boolean): Pix {
  const s = big ? 13 : 9;
  const p = new Pix(s, s);
  const c = (s - 1) / 2;
  const hot = hex('#fff6d0');
  const warm = hex('#f2c35a');
  const deep = hex('#d27a32');
  const rnd = mulberry(big ? 31 : 32);
  for (let y = 0; y < s; y++)
    for (let x = 0; x < s; x++) {
      const dx = Math.abs(x - c);
      const dy = Math.abs(y - c);
      const r = Math.max(dx, dy) + Math.min(dx, dy) * 1.6;
      const lim = c * (0.75 + rnd() * 0.35);
      if (r > lim) continue;
      p.set(x, y, r < lim * 0.35 ? hot : r < lim * 0.7 ? warm : deep);
    }
  return p;
}

// --- a chunky 5×7 pixel font for the counter ---------------------------------------------------------------
const GLYPHS: Record<string, string[]> = {
  '0': ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
  '1': ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  '2': ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  '3': ['####.', '....#', '....#', '.###.', '....#', '....#', '####.'],
  '4': ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  '5': ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  '6': ['..##.', '.#...', '#....', '####.', '#...#', '#...#', '.###.'],
  '7': ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
  '8': ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  '9': ['.###.', '#...#', '#...#', '.####', '....#', '...#.', '.##..'],
  '+': ['.....', '..#..', '..#..', '#####', '..#..', '..#..', '.....'],
  x: ['.....', '.....', '#...#', '.#.#.', '..#..', '.#.#.', '#...#'],
  m: ['.....', '.....', '##.#.', '#.#.#', '#.#.#', '#.#.#', '#.#.#'],
  '!': ['..#..', '..#..', '..#..', '..#..', '..#..', '.....', '..#..'],
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  C: ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  G: ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.####'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  I: ['.###.', '..#..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  J: ['..###', '...#.', '...#.', '...#.', '#..#.', '#..#.', '.##..'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
  N: ['#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  Q: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '##.##', '#...#'],
  X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
  '.': ['.....', '.....', '.....', '.....', '.....', '.##..', '.##..'],
  ',': ['.....', '.....', '.....', '.....', '.##..', '..#..', '.#...'],
  ':': ['.....', '.##..', '.##..', '.....', '.##..', '.##..', '.....'],
  '/': ['....#', '...#.', '...#.', '..#..', '.#...', '.#...', '#....'],
  '-': ['.....', '.....', '.....', '.###.', '.....', '.....', '.....'],
  '×': ['.....', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '.....'],
  "'": ['..#..', '..#..', '.#...', '.....', '.....', '.....', '.....'],
};

/** Words in the pixel font, cream (or `color`) with a dark outline all round and a drop below. Spaces are narrow. */
export function pixelText(text: string, color = CREAM, top = hex('#fffbea')): Pix {
  text = text.replace(/ /g, ' ');
  const w = text.length * 6 + 2;
  const p = new Pix(w, 10);
  const ink = new Uint8Array(w * 10);
  [...text].forEach((ch, i) => {
    const g = GLYPHS[ch] ?? GLYPHS[ch.toUpperCase()];
    if (!g) return;
    g.forEach((row, y) => [...row].forEach((c, x) => c === '#' && (ink[(y + 1) * w + 1 + i * 6 + x] = 1)));
  });
  for (let y = 0; y < 10; y++)
    for (let x = 0; x < w; x++) {
      if (ink[y * w + x]) {
        p.set(x, y, y <= 2 ? top : color);
        continue;
      }
      let near = false;
      for (let j = -1; j <= 2 && !near; j++) for (let i = -1; i <= 1 && !near; i++) if (ink[(y - j) * w + x - i] && y - j >= 0 && y - j < 10 && x - i >= 0 && x - i < w) near = true;
      if (near) p.set(x, y, INK);
    }
  return p;
}

/**
 * A key hint in the pixel font: the key on a little cream keycap (dark letters, a darker lip under it), then what
 * it does in `color`. Used under the scope (SHIFT HOLD BREATH), by the ammo (R RELOAD) and the like.
 */
export function keyHint(key: string, label: string, color = CREAM): Pix {
  const kw = key.length * 6 + 3;
  const cap = new Pix(kw + 2, 12);
  for (let y = 0; y < 12; y++)
    for (let x = 0; x < kw + 2; x++) {
      const edge = x === 0 || x === kw + 1 || y === 0 || y >= 10;
      const corner = (x === 0 || x === kw + 1) && (y === 0 || y === 11);
      if (corner) continue;
      cap.set(x, y, edge ? INK : y === 9 ? hex('#b8ad94') : y === 1 ? hex('#fffbea') : CREAM);
    }
  [...key].forEach((ch, i) => {
    const g = GLYPHS[ch] ?? GLYPHS[ch.toUpperCase()];
    g?.forEach((row, y) => [...row].forEach((c, x) => c === '#' && cap.set(2 + i * 6 + x, 2 + y, INK)));
  });
  if (!label) return cap;
  const text = pixelText(label, color, hex('#fffbea'));
  const p = new Pix(cap.w + 2 + text.w, 12);
  p.blit(cap, 0, 0);
  p.blit(text, cap.w + 2, 1);
  return p;
}

/** The little rabbit head that stands for "animals" on the counter. */
export function tallyIcon(): Pix {
  const rows = ['.#..#..', '.#..#..', '.#..#..', '.####..', '#####..', '#.##.#.', '######.', '.####..'];
  const p = new Pix(9, 10);
  const ink = (x: number, y: number) => rows[y - 1]?.[x - 1] === '#';
  for (let y = 0; y < 10; y++)
    for (let x = 0; x < 9; x++) {
      if (ink(x, y)) p.set(x, y, y <= 3 ? hex('#fffbea') : CREAM);
      else if (ink(x - 1, y) || ink(x + 1, y) || ink(x, y - 1) || ink(x, y + 1) || ink(x, y - 2) || ink(x - 1, y - 1) || ink(x + 1, y - 1)) p.set(x, y, INK);
    }
  // the eye
  p.set(2, 6, INK);
  return p;
}

/**
 * The crosshair for a weapon, opened up by `gap` pixels as you move, jump and fire: the rifle's four arms, the
 * shotgun's ring (the spread of its pellets), the knife's single point. Cream (warm when an animal is in it),
 * outlined. Centred on its middle pixel.
 */
export function dynamicCross(kind: 'rifle' | 'shotgun' | 'knife', gap: number, color: number): Pix {
  const r = kind === 'shotgun' ? Math.max(4, gap + 4) : gap + 6;
  const s = r * 2 + 5;
  const p = new Pix(s, s);
  const c = Math.floor(s / 2);
  const on = new Set<number>();
  const put = (x: number, y: number) => on.add(y * s + x);
  if (kind === 'knife') put(c, c);
  else if (kind === 'shotgun') {
    for (let a = 0; a < 24; a++) {
      const ang = (a / 24) * Math.PI * 2;
      put(Math.round(c + Math.cos(ang) * r), Math.round(c + Math.sin(ang) * r));
    }
    put(c, c);
  } else {
    const g0 = 2 + gap;
    for (let i = 0; i < 4; i++) {
      put(c, c - g0 - i);
      put(c, c + g0 + i);
      put(c - g0 - i, c);
      put(c + g0 + i, c);
    }
    put(c, c);
  }
  for (let y = 0; y < s; y++)
    for (let x = 0; x < s; x++) {
      const i = y * s + x;
      if (on.has(i)) p.set(x, y, color);
      else if (on.has(i - 1) || on.has(i + 1) || on.has(i - s) || on.has(i + s)) p.set(x, y, INK);
    }
  return p;
}

/** The crosshair: four short arms round an open middle, cream (or warm when something's in it), outlined. */
export function crosshairSprite(color: number): Pix {
  const p = new Pix(11, 11);
  const arm = [[5, 1], [5, 2], [5, 8], [5, 9], [1, 5], [2, 5], [8, 5], [9, 5], [5, 5]];
  const on = new Set(arm.map(([x, y]) => y * 11 + x));
  for (let y = 0; y < 11; y++)
    for (let x = 0; x < 11; x++) {
      if (on.has(y * 11 + x)) p.set(x, y, color);
      else if (on.has(y * 11 + x - 1) || on.has(y * 11 + x + 1) || on.has((y - 1) * 11 + x) || on.has((y + 1) * 11 + x)) p.set(x, y, INK);
    }
  return p;
}

/** Reeds and bulrushes for the water's edge, and a flat grey stone. */
export function reedSprites(): Pix[] {
  const out: Pix[] = [];
  const reed = ramp('#1f3a22', '#2e5230', '#41693a', '#5c8446', '#7fa157');
  for (let k = 0; k < 3; k++) {
    const h = 16 + k * 5;
    const p = new Pix(13, h + 2);
    const rnd = mulberry(400 + k);
    // tall blades, a couple of them leaning out over the water
    for (let i = 0; i < 6 + k; i++) {
      const x0 = 3 + rnd() * 7;
      const top = h * (0.55 + rnd() * 0.45);
      const lean = (rnd() - 0.5) * 5;
      for (let y = 0; y < top; y++) {
        const t = y / top;
        p.set(Math.round(x0 + lean * t * t), h + 1 - y, shade(reed, 0.25 + t * 0.6 + (hash2(i, y, 9) - 0.5) * 0.15));
      }
    }
    // the brown heads of the bulrushes
    for (let i = 0; i < 1 + k; i++) {
      const x = 4 + Math.round(rnd() * 5);
      const y = Math.round(h * 0.18 + rnd() * 4);
      for (let j = 0; j < 4; j++) {
        p.set(x, y + j, hex(j === 0 ? '#8a5a38' : '#5e3a22'));
        p.set(x + 1, y + j, hex(j === 0 ? '#a6744a' : '#7a4e2c'));
      }
      p.set(x, y - 1, reed[2]);
      for (let j = 4; j < 8; j++) p.set(x, y + j, reed[3]);
    }
    tuft(p, 6, h + 1, 6, PAL.edge.grass, 420 + k, 0.55);
    p.outline(0.6, 0.86);
    p.bleed();
    out.push(p);
  }
  return out;
}
