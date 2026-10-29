import { hex, mulberry, Pix } from '../pix';

/**
 * Cosy flowers that dress the floating name, painted into its own buffer at the forest's pixel size:
 * a little posy on the r, a sprig hanging from the y's tail, a vine up the h with a posy on top, a wreath
 * hugging the o and a corsage where the x crosses. The colours are the meadow's own, natural, never pastel.
 */

const GREEN = ['#1f3a24', '#2f5a2a', '#3f7432', '#4f8a3a', '#7fb04a', '#a6c96a'].map(hex);

type Head = { rows: string[]; legend: Record<string, string> };
const HEADS: Record<string, Head> = {
  daisy: { rows: ['.w.w.', 'wwyww', '.wwW.'], legend: { w: '#ece6d4', W: '#c9c3b0', y: '#e7b73c' } },
  bigDaisy: { rows: ['..w..', '.wWw.', 'wWyWw', '.wWw.', '..w..'], legend: { w: '#ece6d4', W: '#d8d1bd', y: '#e7b73c' } },
  campion: { rows: ['.rr.', 'rRRr', '.rr.'], legend: { r: '#a8443c', R: '#d36a55' } },
  rose: { rows: ['.rRr.', 'rRyRr', '.rrr.'], legend: { r: '#a8443c', R: '#c95a4a', y: '#e7b73c' } },
  buttercup: { rows: ['.yy.', 'yYYy', '.yy.'], legend: { y: '#d9a92a', Y: '#f2d36a' } },
  forget: { rows: ['.b.', 'byb', '.b.'], legend: { b: '#5d6aa8', y: '#e7b73c' } },
  bell: { rows: ['bB', 'bb', 'b.'], legend: { b: '#5d6aa8', B: '#8691c8' } },
};
const parsed: Record<string, { rows: string[]; cols: Record<string, number> }> = {};
for (const k in HEADS) {
  const cols: Record<string, number> = {};
  for (const c in HEADS[k].legend) cols[c] = hex(HEADS[k].legend[c]);
  parsed[k] = { rows: HEADS[k].rows, cols };
}

/** A flower head, centred on (cx, cy). */
function head(p: Pix, kind: string, cx: number, cy: number) {
  const { rows, cols } = parsed[kind];
  const ox = Math.round(cx - (rows[0].length - 1) / 2);
  const oy = Math.round(cy - (rows.length - 1) / 2);
  rows.forEach((row, j) => row.split('').forEach((ch, i) => cols[ch] !== undefined && p.set(ox + i, oy + j, cols[ch])));
}

/** A leaf growing from (x, y) out to one side (dir) and a little up (or down, with up = -1), lit on top. */
function leaf(p: Pix, x: number, y: number, dir: number, big = false, up = 1) {
  x = Math.round(x);
  y = Math.round(y);
  p.set(x + dir, y, GREEN[2]);
  p.set(x + dir * 2, y - up, GREEN[4]);
  p.set(x + dir * 2, y, GREEN[3]);
  p.set(x + dir * 3, y - up, GREEN[3]);
  if (big) {
    p.set(x + dir, y - up, GREEN[4]);
    p.set(x + dir * 3, y - up * 2, GREEN[5]);
    p.set(x + dir * 4, y - up * 2, GREEN[3]);
    p.set(x + dir * 3, y, GREEN[1]);
  }
}

/** A 1px stem from (x0, y0) to (x1, y1), darker at the foot. */
function stem(p: Pix, x0: number, y0: number, x1: number, y1: number) {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    // a slight bow, so no stem is ruler-straight
    const bow = Math.sin(t * Math.PI) * 0.6 * Math.sign(x1 - x0 || 1);
    p.set(Math.round(x0 + (x1 - x0) * t + bow), Math.round(y0 + (y1 - y0) * t), t < 0.4 ? GREEN[1] : GREEN[2]);
  }
}

/** A posy standing on (x, y): leaves fanned at its foot and three blooms, leaning towards `dir`. */
function posy(p: Pix, x: number, y: number, dir: number, kinds: [string, string, string]) {
  const tips: [number, number][] = [
    [x - 4 + dir, y - 4],
    [x + dir * 2, y - 7],
    [x + 4 + dir, y - 3],
  ];
  tips.forEach(([tx, ty]) => stem(p, x, y, tx, ty));
  leaf(p, x - 1, y - 1, -1, true);
  leaf(p, x + 1, y - 1, 1, true);
  leaf(p, x + dir, y - 4, -dir);
  head(p, kinds[0], tips[0][0], tips[0][1] - 1);
  head(p, kinds[2], tips[2][0], tips[2][1] - 1);
  head(p, kinds[1], tips[1][0], tips[1][1] - 1);
}

type Box = { x0: number; x1: number; y0: number; y1: number };

/**
 * Dresses the name. `base` is the baseline row, `letters` each letter's span in buffer columns,
 * in the order r, y, h, o, x; their shapes are read from what is already painted.
 */
export function garland(p: Pix, base: number, letters: [number, number][], seed: number) {
  const rnd = mulberry(seed);
  const inked = (x: number, y: number) => (p.get(x, y) >>> 24) > 0;
  const boxOf = ([a, b]: [number, number]): Box => {
    const box = { x0: b, x1: a, y0: p.h, y1: 0 };
    for (let x = a; x <= b; x++) for (let y = 0; y < p.h; y++) {
      if (!inked(x, y)) continue;
      box.x0 = Math.min(box.x0, x);
      box.x1 = Math.max(box.x1, x);
      box.y0 = Math.min(box.y0, y);
      box.y1 = Math.max(box.y1, y);
    }
    return box;
  };
  const topAt = (x: number) => {
    for (let y = 0; y < p.h; y++) if (inked(x, y)) return y;
    return p.h;
  };
  if (letters.length < 5) return;
  // inset each span a little, so a neighbour's overhang isn't mistaken for the letter
  const [r, y, h, o, x] = letters.map(([a, b]) => boxOf([a + 1, b - 1]));

  // the r: a posy on the round drop at the end of its arm
  {
    let tx = r.x1;
    for (let c = r.x1; c > r.x0 + (r.x1 - r.x0) * 0.55; c--) if (topAt(c) <= topAt(tx)) tx = c;
    posy(p, tx, topAt(tx), 1, ['forget', 'campion', 'daisy']);
  }

  // the y: a sprig hanging from the drop at the end of its tail, a bell at the tip
  {
    let lx = y.x1;
    for (let c = y.x0; c <= y.x1; c++) if (inked(c, y.y1) || inked(c, y.y1 - 1)) {
      lx = c;
      break;
    }
    const ly = y.y1 - 2;
    stem(p, lx, ly, lx - 3, ly + 4);
    leaf(p, lx, ly, -1, true, -1);
    leaf(p, lx, ly - 3, -1, true);
    leaf(p, lx - 2, ly + 2, 1, false, -1);
    head(p, 'bell', lx - 4, ly + 5);
    head(p, 'campion', lx - 6, ly - 4);
    head(p, 'forget', lx - 1, ly - 6);
  }

  // the h: a vine up its stem with a posy where it reaches the top
  {
    let cols: number[] = [];
    for (let c = h.x0; c <= h.x1; c++) if (inked(c, h.y0 + 3)) cols.push(c);
    if (!cols.length) cols = [h.x0 + 2];
    const cx = Math.round((cols[0] + cols[cols.length - 1]) / 2);
    const top = topAt(cx);
    let vx = cx;
    for (let s = 0; s < base - top; s++) {
      const vy = base - s;
      vx = cx + Math.round(Math.sin(s * 0.42 + seed) * 2.2);
      p.set(vx, vy, GREEN[2]);
      if (s % 4 === 2 && s < base - top - 4) leaf(p, vx, vy, Math.floor(s / 4) % 2 === 0 ? -1 : 1, s < (base - top) * 0.55);
    }
    posy(p, vx, top, -1, ['buttercup', 'bigDaisy', 'forget']);
  }

  // the o: a wreath of leaves hugging its lower left, three small blooms set in it
  {
    const cx = (o.x0 + o.x1) / 2;
    const cy = (o.y0 + o.y1) / 2;
    const rx = (o.x1 - o.x0) / 2 + 1;
    const ry = (o.y1 - o.y0) / 2 + 1;
    const from = Math.PI * 0.55;
    const to = Math.PI * 1.25;
    const steps = Math.round((to - from) * Math.max(rx, ry) * 0.9);
    for (let i = 0; i <= steps; i++) {
      const a = from + ((to - from) * i) / steps;
      const px = cx + Math.cos(a) * rx;
      const py = cy + Math.sin(a) * ry;
      p.set(Math.round(px), Math.round(py), GREEN[1]);
      if (i % 3 === 0) {
        // leaves stand out from the ring, alternately pointing along it both ways
        const out = Math.cos(a) < 0 ? -1 : 1;
        leaf(p, px, py, out, i % 6 === 0, Math.sin(a) > 0.3 ? -1 : 1);
      }
    }
    const blooms: [string, number][] = [['rose', 0.7], ['forget', 0.88], ['daisy', 1.08]];
    for (const [kind, f] of blooms) head(p, kind, cx + Math.cos(Math.PI * f) * rx, cy + Math.sin(Math.PI * f) * ry);
  }

  // the x: a corsage where its strokes cross
  {
    const cx = Math.round((x.x0 + x.x1) / 2);
    const cy = Math.round(base - (base - x.y0) * 0.5);
    leaf(p, cx - 1, cy + 1, -1, true, -1);
    leaf(p, cx + 1, cy + 1, 1, true, -1);
    leaf(p, cx - 1, cy - 1, -1, true);
    leaf(p, cx + 1, cy - 2, 1);
    head(p, 'forget', cx + 3, cy + 2);
    head(p, 'buttercup', cx - 3, cy + 1);
    head(p, 'rose', cx, cy - 1);
  }

  // and a small tuft at a few of the feet where the letters meet the ground
  for (let c = r.x0, run = -1; c <= x.x1 + 1; c++) {
    const on = inked(c, base) && inked(c, base - 1);
    if (on && run < 0) run = c;
    if (!on && run >= 0) {
      if (rnd() < 0.45) {
        const fx = Math.round(run + (c - 1 - run) * (rnd() < 0.5 ? 0.1 : 0.9));
        for (let j = 0; j < 4; j++) {
          const bx = fx + j - 2;
          const bh = 2 + rnd() * 3;
          const lean = (j - 1.5) * 0.6;
          for (let s = 0; s < bh; s++) p.set(Math.round(bx + lean * (s / bh) * (s / bh)), base + 1 - s, GREEN[Math.min(4, 1 + Math.floor((s / bh) * 3))]);
        }
      }
      run = -1;
    }
  }
}
