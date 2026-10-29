import { clamp, hash2, mulberry, noise1, noise2, Pix, shade, type Ramp } from '../pix';

/** The shared brushes. Light comes from above, a little from the left, the way it falls through a canopy. */

const LX = -0.38;
const LY = -0.92;

type Circle = [number, number, number];

/** Small leaf shapes, drawn tip down: # is the leaf, + its lit upper edge, - its shaded lower edge. */
const LEAVES = [
  ['.++..', '+##+.', '.###-', '..#-.'],
  ['..++.', '.+##+', '-###.', '.-#..'],
  ['.++.', '+##+', '####', '-##-', '.-..'],
  ['++..', '+##.', '.##-', '..--'],
  ['..++', '.##+', '-##.', '--..'],
  ['.+.', '+#+', '###', '-#-'],
].map((rows) => rows.map((r) => r.split('')));

/**
 * One leaf clump: a dark heart of shade, then hundreds of small leaves laid over it from the back,
 * each with a lit edge and a shaded one, lighter where they face the light, so the clump has a ragged,
 * leafy outline instead of a round one.
 */
export function clump(p: Pix, cx: number, cy: number, r: number, pal: Ramp, seed: number, bias = 0) {
  const rnd = mulberry(seed);
  // the shade inside the clump, so no sky shows between the leaves
  const inner = r * 0.78;
  for (let y = Math.floor(cy - inner); y <= cy + inner; y++) {
    for (let x = Math.floor(cx - inner); x <= cx + inner; x++) {
      const dx = (x + 0.5 - cx) / inner;
      const dy = (y + 0.5 - cy) / (inner * 0.92);
      if (dx * dx + dy * dy + (hash2(x >> 1, y >> 1, seed) - 0.5) * 0.3 > 1) continue;
      p.set(x, y, shade(pal, 0.1 + bias + (hash2(x, y, seed + 1) - 0.5) * 0.12 - dy * 0.06));
    }
  }
  // the leaves: back ones first (lower, darker), front ones last (higher, lit)
  const count = Math.round(r * r * 0.55);
  const leaves: [number, number, number][] = [];
  for (let i = 0; i < count; i++) {
    const ang = rnd() * Math.PI * 2;
    const rr = Math.sqrt(rnd()) * r;
    leaves.push([cx + Math.cos(ang) * rr, cy + Math.sin(ang) * rr * 0.9, rnd()]);
  }
  leaves.sort((m, n) => n[1] - m[1] + (m[2] - n[2]) * r * 0.4);
  for (const [lx, ly, z] of leaves) {
    const nx = (lx - cx) / r;
    const ny = (ly - cy) / r;
    const facing = -(nx * LX + ny * LY);
    const t = 0.46 + bias + facing * 0.32 - ny * 0.12 + (z - 0.5) * 0.22;
    const base = shade(pal, t);
    const lit = shade(pal, t + 0.2);
    const dim = shade(pal, t - 0.2);
    const leaf = LEAVES[Math.floor(rnd() * LEAVES.length)];
    const ox = Math.round(lx - leaf[0].length / 2);
    const oy = Math.round(ly - leaf.length / 2);
    for (let j = 0; j < leaf.length; j++) {
      for (let i = 0; i < leaf[j].length; i++) {
        const ch = leaf[j][i];
        if (ch === '.') continue;
        p.set(ox + i, oy + j, ch === '+' ? lit : ch === '-' ? dim : base);
      }
    }
  }
}

/**
 * A band of canopy across the whole buffer, from a line of rounded treetops `top(x)` down to a ragged
 * lower edge `bottom(x)`. Clumps are painted top row first, so each lower clump lays its lit crown
 * over the crease above it. Nothing is filled flat, so nothing needs stretching.
 */
export function canopy(
  p: Pix,
  o: { top: (x: number) => number; bottom: (x: number) => number; pal: Ramp; seed: number; rMin: number; rMax: number; gaps?: number },
) {
  const { pal, seed, rMin, rMax } = o;
  const rnd = mulberry(seed);
  let lowest = 0;
  let highest = p.h;
  for (let x = 0; x < p.w; x += 4) {
    lowest = Math.max(lowest, o.bottom(x));
    highest = Math.min(highest, o.top(x));
  }
  const rows: Circle[][] = [];
  for (let y = highest; y < lowest; y += rMin * 1.1) {
    const row: Circle[] = [];
    for (let x = rnd() * rMax; x < p.w; x += rMin * (1.15 + rnd() * 0.9)) {
      const r = rMin + rnd() * (rMax - rMin);
      const cy = y + (rnd() - 0.5) * rMin;
      if (cy - r * 0.35 < o.top(x)) continue;
      // stay above the ragged lower edge, with the odd clump hanging a little lower
      if (cy + r * 0.7 > o.bottom(x) + (rnd() < 0.12 ? r * 0.8 : 0)) continue;
      if (o.gaps && cy > o.top(x) + rMax * 1.5 && rnd() < o.gaps) continue;
      row.push([x, cy, r]);
    }
    rows.push(row);
  }
  let n = 0;
  for (const row of rows) for (const [x, y, r] of row) clump(p, x, y, r, pal, seed * 31 + n++, -0.06);
}

/** A trunk with a slight bend, root flare, bark crevices and moss on the lit side. */
export function trunk(
  p: Pix,
  cx: number,
  top: number,
  bottom: number,
  w: number,
  pal: Ramp,
  seed: number,
  o: { moss?: Ramp; light?: number; flare?: number; mossy?: number } = {},
) {
  const light = o.light ?? -1;
  const flareH = o.flare ?? w * 1.1;
  const n = pal.length - 1;
  for (let y = Math.floor(top); y <= bottom; y++) {
    const k = (y - top) / Math.max(1, bottom - top);
    let half = (w / 2) * (0.86 + 0.14 * k);
    const fy = bottom - y;
    if (fy < flareH) half += Math.pow(1 - fy / flareH, 2.4) * w * 0.75;
    const xc = cx + (noise1(y * 0.018, seed + 3) - 0.5) * w * 0.35;
    const x0 = Math.round(xc - half);
    const x1 = Math.round(xc + half);
    for (let x = x0; x < x1; x++) {
      const u = (x + 0.5 - x0) / Math.max(1, x1 - x0);
      const s = light < 0 ? 1 - u : u;
      let lv = s < 0.16 ? 0 : s < 0.46 ? 1 : s < 0.8 ? 2 : 3;
      const cv = noise1(x * 0.34 + noise1(y * 0.06, seed) * 2.4, seed + 11);
      if (cv > 0.7) lv -= 1;
      else if (cv < 0.14 && lv >= 2) lv += 1;
      if (hash2(x, y >> 2, seed) < 0.04) lv -= 1;
      let c = pal[Math.max(0, Math.min(n, lv))];
      p.set(x, y, c);
    }
  }
  if (o.moss) {
    const rnd = mulberry(seed + 70);
    const h = bottom - top;
    const side = light < 0 ? -1 : 1;
    // a thick collar round the roots, then a few patches climbing the shaded side
    mossPatch(p, cx, bottom - w * 0.35, w * 0.95, w * 0.42, o.moss, seed + 71, true, -0.04);
    const patches = 2 + Math.floor(rnd() * 3) + Math.round((o.mossy ?? 0) * 20);
    for (let i = 0; i < patches; i++) {
      const y = bottom - h * (0.12 + Math.pow(rnd(), 1.6) * 0.5);
      const x = cx - side * w * (0.15 + rnd() * 0.25);
      mossPatch(p, x, y, w * (0.18 + rnd() * 0.22), w * (0.3 + rnd() * 0.6), o.moss, seed + 80 + i, true, -0.08);
    }
  }
}

/** A tapering limb between two points, drawn as stacked trunk slices. */
export function limb(p: Pix, x0: number, y0: number, x1: number, y1: number, w0: number, w1: number, pal: Ramp, seed: number) {
  const len = Math.hypot(x1 - x0, y1 - y0);
  const steps = Math.ceil(len * 1.5);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = x0 + (x1 - x0) * t;
    const y = y0 + (y1 - y0) * t + Math.sin(t * Math.PI) * len * 0.06;
    const half = (w0 + (w1 - w0) * t) / 2;
    for (let j = -Math.ceil(half); j <= Math.ceil(half); j++) {
      if (Math.abs(j) > half) continue;
      const s = (j + half) / (2 * half);
      const lv = s < 0.3 ? 2 : s < 0.75 ? 1 : 0;
      p.set(x, y + j, pal[Math.min(pal.length - 1, lv + (hash2(Math.round(x), Math.round(y + j), seed) < 0.08 ? 1 : 0))]);
    }
  }
}

/**
 * Ground from row `y` down: a grass fill whose strokes get longer towards the viewer,
 * a fringe of blades on top, and a flat last row so the edge can be stretched down for ever.
 */
export function ground(
  p: Pix,
  y: number,
  pal: Ramp,
  seed: number,
  o: { blades?: number; tall?: number; base?: number; fadeTo?: number; strokes?: number; fill?: boolean } = {},
) {
  const tall = o.tall ?? 6;
  const blades = o.blades ?? 0.7;
  const base = o.base ?? 0.45;
  const fadeTo = o.fadeTo ?? 0.25;
  const strokes = o.strokes ?? 0.14;
  const depth = p.h - y;
  const n = pal.length;
  const fill = o.fill !== false;
  for (let j = 0; fill && j < depth; j++) {
    const k = j / Math.max(1, depth - 1);
    const t = base + (fadeTo - base) * Math.min(1, k * 1.4);
    const row = y + j;
    for (let x = 0; x < p.w; x++) {
      const wob = (noise2(x * 0.02, row * 0.3, seed) - 0.5) * 0.08;
      p.set(x, row, shade(pal, t + wob));
    }
  }
  // grass strokes in the fill, longer and sparser as they come closer
  const rnd = mulberry(seed + 1);
  const count = fill ? Math.floor(p.w * depth * strokes * 0.12) : 0;
  for (let i = 0; i < count; i++) {
    const j = Math.floor(Math.pow(rnd(), 0.8) * depth * 0.92);
    const k = j / depth;
    const x = Math.floor(rnd() * p.w);
    const len = 2 + Math.floor(rnd() * (2 + k * 6));
    const lean = rnd() < 0.5 ? -1 : 1;
    const t0 = base + (fadeTo - base) * Math.min(1, k * 1.4);
    const c = shade(pal, t0 + (rnd() < 0.55 ? 0.18 : -0.16));
    for (let s = 0; s < len; s++) p.set(x + (s > len * 0.6 ? lean : 0), y + j - s, c);
  }
  // the fringe: dark back blades, then lighter front ones
  for (let pass = 0; pass < 2; pass++) {
    for (let x = 0; x < p.w; x++) {
      if (hash2(x, pass, seed + 4) > blades) continue;
      const h = 1 + Math.floor(noise1(x * 0.21, seed + pass * 7) * tall * 0.9 + hash2(x, 9, seed + pass) * tall * 0.6);
      const lean = hash2(x, 3, seed + pass) < 0.5 ? -1 : 1;
      const c = pass === 0 ? pal[Math.max(0, Math.round((base - 0.12) * (n - 1)))] : shade(pal, base + 0.16 + hash2(x, 5, seed) * 0.22);
      for (let s = 0; s < h; s++) p.set(x + (s > h * 0.55 ? lean : 0), y - s + pass, c);
    }
  }
  // the stretchable last row
  if (!fill) return;
  const last = shade(pal, fadeTo);
  for (let x = 0; x < p.w; x++) p.set(x, p.h - 1, last);
}

/** A low bush: a heap of small clumps. */
export function bush(p: Pix, cx: number, by: number, w: number, h: number, pal: Ramp, seed: number) {
  const rnd = mulberry(seed);
  const n = Math.max(3, Math.round(w / 6));
  const list: Circle[] = [];
  for (let i = 0; i < n; i++) {
    const u = n === 1 ? 0.5 : i / (n - 1);
    const r = h * (0.38 + rnd() * 0.22);
    const bump = Math.sin(u * Math.PI);
    list.push([cx + (u - 0.5) * w * 0.85 + (rnd() - 0.5) * 3, by - r * 0.7 - bump * h * 0.35, r]);
  }
  list.sort((a, b) => a[1] - b[1]);
  list.forEach(([x, y, r], i) => clump(p, x, y, r, pal, seed + i * 13, -0.04));
}

/** A fern: a few arching fronds with alternating leaflets. */
export function fern(p: Pix, x: number, by: number, size: number, pal: Ramp, seed: number) {
  const rnd = mulberry(seed);
  const fronds = 4 + Math.floor(rnd() * 3);
  for (let f = 0; f < fronds; f++) {
    const side = f % 2 === 0 ? -1 : 1;
    const spread = (0.25 + rnd() * 0.75) * side;
    const len = size * (0.7 + rnd() * 0.4);
    const steps = Math.ceil(len * 1.4);
    const tone = 0.35 + rnd() * 0.45;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const px = x + spread * len * t;
      const py = by - len * (0.9 * t - 0.75 * t * t * Math.abs(spread));
      const c = shade(pal, tone + (1 - t) * -0.1);
      p.set(px, py, c);
      if (i % 2 === 0 && t > 0.12 && t < 0.92) {
        const leaf = Math.max(1, Math.round((1 - t) * 3));
        for (let l = 1; l <= leaf; l++) {
          p.set(px - l * 0.3 * side, py - l, shade(pal, tone + 0.12));
          p.set(px + l * 0.5 * side, py + l * 0.6, shade(pal, tone - 0.08));
        }
      }
    }
  }
}

/** A grass tuft: a fan of blades. */
export function tuft(p: Pix, x: number, by: number, h: number, pal: Ramp, seed: number, light = 0.6) {
  const rnd = mulberry(seed);
  const blades = 4 + Math.floor(rnd() * 5);
  for (let b = 0; b < blades; b++) {
    const lean = (rnd() - 0.5) * 1.6;
    const bh = h * (0.5 + rnd() * 0.5);
    const c = shade(pal, light + (rnd() - 0.5) * 0.35);
    for (let s = 0; s < bh; s++) p.set(x + (b - blades / 2) * 0.7 + lean * (s / bh) * (s / bh) * 3, by - s, c);
  }
}

/** A rock half sunk in the grass. */
export function rock(p: Pix, cx: number, by: number, w: number, h: number, pal: Ramp, seed: number) {
  for (let y = Math.floor(by - h); y <= by; y++) {
    for (let x = Math.floor(cx - w / 2); x <= cx + w / 2; x++) {
      const dx = (x + 0.5 - cx) / (w / 2);
      const dy = (y + 0.5 - by) / h;
      const lump = 1 - (noise1(x * 0.3, seed) - 0.5) * 0.25;
      if (dx * dx + dy * dy > lump) continue;
      const facing = -(dx * LX + dy * LY);
      let t = 0.45 + facing * 0.4 + (hash2(x, y, seed) - 0.5) * 0.12;
      if (y >= by - 1) t -= 0.25;
      p.set(x, y, shade(pal, t));
    }
  }
}

/** A small mushroom. */
export function mushroom(p: Pix, cx: number, by: number, s: number, cap: Ramp, stem: Ramp, seed: number) {
  const sh = Math.round(s * 0.9);
  for (let y = 0; y < sh; y++) {
    for (let x = -1; x <= 0; x++) p.set(cx + x, by - y, stem[x === -1 ? 2 : 1]);
  }
  const cw = s;
  const ch = Math.max(2, Math.round(s * 0.55));
  const top = by - sh - ch + 1;
  for (let y = 0; y < ch; y++) {
    const k = y / ch;
    const half = Math.round((cw / 2) * Math.sqrt(1 - (1 - k) * (1 - k) * 0.85));
    for (let x = -half; x <= half - 1; x++) {
      const u = (x + half) / Math.max(1, 2 * half);
      let t = 0.75 - u * 0.5 - k * 0.25;
      if (y === ch - 1) t = 0.1;
      if (hash2(x, y, seed) < 0.1 && y < ch - 1) t += 0.25;
      p.set(cx + x, top + y, shade(cap, t));
    }
  }
}

/** Fills a buffer column-wise with a vertical gradient between two ramp values (for solid backs). */
export function wash(p: Pix, y0: number, y1: number, pal: Ramp, t0: number, t1: number, seed: number) {
  for (let y = y0; y < y1; y++) {
    const k = (y - y0) / Math.max(1, y1 - y0);
    for (let x = 0; x < p.w; x++) p.set(x, y, shade(pal, t0 + (t1 - t0) * k + (noise2(x * 0.04, y * 0.04, seed) - 0.5) * 0.12));
  }
}

export { clamp };

/**
 * A hanging vine: a strand that sways a little as it falls, with small leaves alternating left and right,
 * lit on their upper edge, thinning out towards the tip.
 */
export function vine(p: Pix, x: number, y0: number, len: number, pal: Ramp, seed: number) {
  const rnd = mulberry(seed);
  const stem = shade(pal, 0.25);
  let vx = x;
  for (let s = 0; s < len; s++) {
    const y = y0 + s;
    vx = x + Math.round(Math.sin(s * 0.18 + seed) * 1.4 + (noise1(s * 0.1, seed) - 0.5) * 2);
    p.set(vx, y, stem);
    const thin = 1 - s / len;
    if (s % 3 === 1 && rnd() < 0.35 + thin * 0.6) {
      const side = (Math.floor(s / 3) % 2 === 0 ? -1 : 1) * (rnd() < 0.15 ? -1 : 1);
      const t = 0.45 + (rnd() - 0.5) * 0.3 + thin * 0.1;
      // a little leaf: two pixels out, one down, lit on top
      p.set(vx + side, y, shade(pal, t + 0.15));
      p.set(vx + side * 2, y, shade(pal, t));
      p.set(vx + side * 2, y + 1, shade(pal, t - 0.15));
      if (thin > 0.4) p.set(vx + side * 3, y + 1, shade(pal, t - 0.05));
    }
  }
}

/** Moss is grown from tiny tufts: a dark foot, a body, a lit tip. */
const TUFTS = [
  ['.+.', '###', '-#-'],
  ['+.', '##', '-#'],
  ['.+', '##', '#-'],
  ['+', '#', '-'],
  ['.++', '###', '--.'],
];

/** Moss tufts packed into an oval; with overOnly it only grows where something is already painted (bark). */
export function mossPatch(p: Pix, cx: number, cy: number, rx: number, ry: number, pal: Ramp, seed: number, overOnly = false, light = 0) {
  const rnd = mulberry(seed);
  const n = Math.round(rx * ry * 1.6);
  const spots: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = rnd() * Math.PI * 2;
    const r = Math.sqrt(rnd());
    const x = cx + Math.cos(a) * r * rx;
    const y = cy + Math.sin(a) * r * ry;
    // ragged edges: thin out towards the rim
    if (r > 0.7 && noise2(x * 0.4, y * 0.4, seed) < 0.5) continue;
    spots.push([x, y]);
  }
  spots.sort((m, k) => m[1] - k[1]);
  const put = overOnly ? (x: number, y: number, c: number) => p.over(x, y, c) : (x: number, y: number, c: number) => p.set(x, y, c);
  for (const [x, y] of spots) {
    const t = 0.42 + light + (rnd() - 0.5) * 0.24 - ((y - cy) / ry) * 0.12;
    const tuft = TUFTS[Math.floor(rnd() * TUFTS.length)];
    const ox = Math.round(x - 1);
    const oy = Math.round(y - 1);
    for (let j = 0; j < tuft.length; j++) {
      for (let i = 0; i < tuft[j].length; i++) {
        const ch = tuft[j][i];
        if (ch === '.') continue;
        put(ox + i, oy + j, shade(pal, ch === '+' ? t + 0.26 : ch === '-' ? t - 0.24 : t));
      }
    }
  }
}

/**
 * A cushion of moss sitting on a ledge at row y, w wide and up to h high: tufts heaped into a soft mound,
 * the odd strand hanging over the edge.
 */
export function mossCushion(p: Pix, cx: number, y: number, w: number, h: number, pal: Ramp, seed: number, drips = true) {
  const rnd = mulberry(seed);
  // the mound's shaded body first, so no gaps show between tufts
  for (let x = Math.floor(cx - w / 2); x <= cx + w / 2; x++) {
    const u = (x - cx) / (w / 2);
    const top = Math.round(Math.sqrt(Math.max(0, 1 - u * u)) * h * 0.7);
    for (let j = 0; j <= top; j++) p.set(x, y - j, shade(pal, 0.18 + (hash2(x, j, seed) - 0.5) * 0.1));
  }
  mossPatch(p, cx, y - h * 0.45, w / 2, h * 0.55, pal, seed + 1, false, 0.04);
  if (drips) {
    for (let x = Math.floor(cx - w / 2) + 1; x < cx + w / 2; x++) {
      if (rnd() > 0.14) continue;
      const len = 1 + Math.floor(rnd() * 4);
      for (let j = 1; j <= len; j++) p.set(x, y + j, shade(pal, 0.38 - j * 0.07));
      p.set(x, y + len + 1, shade(pal, 0.55));
    }
  }
}
