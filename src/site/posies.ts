import { mulberry } from '@/scene/pix';

/**
 * The flowers that dress the name, drawn smooth at full resolution (the same posies the wood's pixel title wore):
 * a posy on the r's arm, a sprig hanging off the y's tail, a vine up the h with a posy on top, a wreath hugging the
 * o and a corsage where the x crosses, with tufts of grass at a few feet. Natural colours, never pastel.
 */

const GREEN = ['#1f3a24', '#2f5a2a', '#3f7432', '#4f8a3a', '#7fb04a', '#a6c96a'];

type Box = { x0: number; x1: number; y0: number; y1: number };
type Kind = 'daisy' | 'bigDaisy' | 'campion' | 'rose' | 'buttercup' | 'forget' | 'bell';

/** What the word is drawn on: its alpha, for finding the letters' shapes. */
type Ink = { w: number; h: number; a: Uint8ClampedArray };

export function posies(g: CanvasRenderingContext2D, ink: Ink, base: number, letters: [number, number][], u: number, seed = 7) {
  const rnd = mulberry(seed);
  const inked = (x: number, y: number) => {
    x = Math.round(x);
    y = Math.round(y);
    return x >= 0 && y >= 0 && x < ink.w && y < ink.h && ink.a[(y * ink.w + x) * 4 + 3] > 140;
  };
  const boxOf = ([a, b]: [number, number]): Box => {
    const box = { x0: b, x1: a, y0: ink.h, y1: 0 };
    const step = Math.max(1, Math.round(u * 0.25));
    for (let x = a; x <= b; x += step)
      for (let y = 0; y < ink.h; y += step) {
        if (!inked(x, y)) continue;
        box.x0 = Math.min(box.x0, x);
        box.x1 = Math.max(box.x1, x);
        box.y0 = Math.min(box.y0, y);
        box.y1 = Math.max(box.y1, y);
      }
    return box;
  };
  const topAt = (x: number) => {
    for (let y = 0; y < ink.h; y++) if (inked(x, y)) return y;
    return ink.h;
  };
  // where each letter's dressing went, so its pieces burst with it
  const dressed: Box[] = letters.map(() => ({ x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity }));
  let cur = 0;
  const grow = (x: number, y: number, r: number) => {
    const b = dressed[cur];
    b.x0 = Math.min(b.x0, x - r);
    b.x1 = Math.max(b.x1, x + r);
    b.y0 = Math.min(b.y0, y - r);
    b.y1 = Math.max(b.y1, y + r);
  };

  g.save();
  g.lineCap = 'round';
  g.lineJoin = 'round';

  /** A stem from (x0, y0) to (x1, y1), with a slight bow, darker at the foot. */
  const stem = (x0: number, y0: number, x1: number, y1: number, w = 0.75) => {
    const mx = (x0 + x1) / 2 + (y1 - y0) * 0.12 * Math.sign(x1 - x0 || 1);
    const my = (y0 + y1) / 2;
    const gr = g.createLinearGradient(x0, y0, x1, y1);
    gr.addColorStop(0, GREEN[1]);
    gr.addColorStop(1, GREEN[2]);
    g.strokeStyle = gr;
    g.lineWidth = w * u;
    g.beginPath();
    g.moveTo(x0, y0);
    g.quadraticCurveTo(mx, my, x1, y1);
    g.stroke();
    grow(x1, y1, u);
    grow(x0, y0, u);
  };

  /** A leaf from (x, y) out to one side (dir) and a little up (or down, up = -1), lit along its midrib. */
  const leaf = (x: number, y: number, dir: number, big = false, up = 1) => {
    const L = (big ? 4.6 : 3.2) * u;
    const W = (big ? 1.5 : 1.1) * u;
    const ang = Math.atan2(-up * 0.55, dir);
    g.save();
    g.translate(x, y);
    g.rotate(ang);
    g.beginPath();
    g.moveTo(0, 0);
    g.bezierCurveTo(L * 0.3, -W, L * 0.75, -W * 0.9, L, 0);
    g.bezierCurveTo(L * 0.75, W * 0.9, L * 0.3, W, 0, 0);
    const gr = g.createLinearGradient(0, -W, 0, W);
    gr.addColorStop(0, GREEN[big ? 4 : 3]);
    gr.addColorStop(1, GREEN[2]);
    g.fillStyle = gr;
    g.fill();
    g.strokeStyle = GREEN[5];
    g.globalAlpha = 0.55;
    g.lineWidth = 0.28 * u;
    g.beginPath();
    g.moveTo(L * 0.12, 0);
    g.quadraticCurveTo(L * 0.5, -W * 0.18, L * 0.86, 0);
    g.stroke();
    g.restore();
    grow(x + Math.cos(ang) * L, y + Math.sin(ang) * L, W);
    grow(x, y, W);
  };

  const petals = (cx: number, cy: number, n: number, r: number, pr: number, fill: string, shade: string, rot = 0) => {
    for (let i = 0; i < n; i++) {
      const a = rot + (i / n) * Math.PI * 2;
      g.save();
      g.translate(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      g.rotate(a);
      g.beginPath();
      g.ellipse(0, 0, pr, pr * 0.62, 0, 0, Math.PI * 2);
      // the lower petals a shade darker, as if lit from above
      g.fillStyle = Math.sin(a) > 0.35 ? shade : fill;
      g.fill();
      g.restore();
    }
  };
  const dot = (cx: number, cy: number, r: number, c: string) => {
    g.beginPath();
    g.arc(cx, cy, r, 0, Math.PI * 2);
    g.fillStyle = c;
    g.fill();
  };

  /** A flower head, centred on (cx, cy). */
  const head = (kind: Kind, cx: number, cy: number) => {
    const k = u;
    switch (kind) {
      case 'daisy':
        petals(cx, cy, 8, 0.95 * k, 0.85 * k, '#ece6d4', '#c9c3b0', 0.2);
        dot(cx, cy, 0.62 * k, '#e7b73c');
        dot(cx - 0.18 * k, cy - 0.2 * k, 0.22 * k, '#f2d36a');
        grow(cx, cy, 1.9 * k);
        break;
      case 'bigDaisy':
        petals(cx, cy, 11, 1.35 * k, 1.15 * k, '#ece6d4', '#d8d1bd', 0.1);
        dot(cx, cy, 0.82 * k, '#e7b73c');
        dot(cx - 0.25 * k, cy - 0.25 * k, 0.3 * k, '#f2d36a');
        grow(cx, cy, 2.6 * k);
        break;
      case 'campion':
        petals(cx, cy, 5, 0.8 * k, 0.85 * k, '#d36a55', '#a8443c', -Math.PI / 2);
        dot(cx, cy, 0.38 * k, '#7e2c28');
        grow(cx, cy, 1.7 * k);
        break;
      case 'rose': {
        dot(cx, cy, 1.55 * k, '#a8443c');
        g.strokeStyle = '#c95a4a';
        g.lineWidth = 0.42 * k;
        for (let i = 0; i < 3; i++) {
          g.beginPath();
          g.arc(cx + 0.1 * k, cy - 0.05 * k, (1.15 - i * 0.36) * k, 0.4 + i * 1.7, 0.4 + i * 1.7 + Math.PI * 1.25);
          g.stroke();
        }
        dot(cx + 0.1 * k, cy - 0.05 * k, 0.26 * k, '#7e2c28');
        grow(cx, cy, 1.7 * k);
        break;
      }
      case 'buttercup':
        petals(cx, cy, 5, 0.72 * k, 0.8 * k, '#e0b030', '#c9971f', -Math.PI / 2);
        dot(cx, cy, 0.4 * k, '#b98a1c');
        dot(cx - 0.5 * k, cy - 0.55 * k, 0.24 * k, '#f6dc7c');
        grow(cx, cy, 1.6 * k);
        break;
      case 'forget':
        petals(cx, cy, 5, 0.55 * k, 0.55 * k, '#6b78b8', '#56629f', -Math.PI / 2);
        dot(cx, cy, 0.26 * k, '#e7b73c');
        grow(cx, cy, 1.1 * k);
        break;
      case 'bell': {
        g.save();
        g.translate(cx, cy);
        g.beginPath();
        g.moveTo(-0.7 * k, -0.9 * k);
        g.bezierCurveTo(-0.8 * k, 0.1 * k, -1.0 * k, 0.6 * k, -1.15 * k, 1.0 * k);
        g.quadraticCurveTo(-0.6 * k, 0.75 * k, 0, 1.05 * k);
        g.quadraticCurveTo(0.6 * k, 0.75 * k, 1.15 * k, 1.0 * k);
        g.bezierCurveTo(1.0 * k, 0.6 * k, 0.8 * k, 0.1 * k, 0.7 * k, -0.9 * k);
        g.quadraticCurveTo(0, -1.3 * k, -0.7 * k, -0.9 * k);
        g.fillStyle = '#5d6aa8';
        g.fill();
        g.beginPath();
        g.ellipse(-0.3 * k, -0.2 * k, 0.22 * k, 0.6 * k, 0.1, 0, Math.PI * 2);
        g.fillStyle = '#8691c8';
        g.fill();
        g.restore();
        grow(cx, cy, 1.4 * k);
        break;
      }
    }
  };

  /** A posy standing on (x, y): leaves fanned at its foot and three blooms, leaning towards `dir`. */
  const posy = (x: number, y: number, dir: number, kinds: [Kind, Kind, Kind]) => {
    const tips: [number, number][] = [
      [x + (-4 + dir) * u, y - 4.2 * u],
      [x + dir * 2 * u, y - 7.4 * u],
      [x + (4 + dir) * u, y - 3.4 * u],
    ];
    tips.forEach(([tx, ty]) => stem(x, y, tx, ty));
    leaf(x - u, y - u * 0.6, -1, true);
    leaf(x + u, y - u * 0.6, 1, true);
    leaf(x + dir * u * 0.6, y - 4 * u, -dir);
    head(kinds[0], tips[0][0], tips[0][1] - u);
    head(kinds[2], tips[2][0], tips[2][1] - u);
    head(kinds[1], tips[1][0], tips[1][1] - u);
  };

  if (letters.length >= 5) {
    const inset = Math.round(u);
    const [r, y, h, o, x] = letters.map(([a, b]) => boxOf([a + inset, b - inset]));

    // the r: a posy on the round drop at the end of its arm
    cur = 0;
    {
      let tx = r.x1;
      for (let c = r.x1; c > r.x0 + (r.x1 - r.x0) * 0.55; c -= Math.max(1, u * 0.25)) if (topAt(c) <= topAt(tx)) tx = c;
      posy(tx, topAt(tx) + u * 0.4, 1, ['forget', 'campion', 'daisy']);
    }

    // the y: a sprig hanging from the end of its tail, a bell at the tip
    cur = 1;
    {
      let lx = y.x1;
      for (let c = y.x0; c <= y.x1; c++)
        if (inked(c, y.y1 - u * 0.5) || inked(c, y.y1 - u * 1.2)) {
          lx = c;
          break;
        }
      const ly = y.y1 - 1.6 * u;
      stem(lx, ly, lx - 3 * u, ly + 4 * u);
      leaf(lx, ly, -1, true, -1);
      leaf(lx, ly - 3 * u, -1, true);
      leaf(lx - 2 * u, ly + 2 * u, 1, false, -1);
      head('bell', lx - 3.6 * u, ly + 5 * u);
      head('campion', lx - 5.6 * u, ly - 3.6 * u);
      head('forget', lx - 1 * u, ly - 5.6 * u);
    }

    // the h: a vine up its stem with a posy where it reaches the top
    cur = 2;
    {
      const cols: number[] = [];
      for (let c = h.x0; c <= h.x1; c++) if (inked(c, h.y0 + 3 * u)) cols.push(c);
      const cx = cols.length ? (cols[0] + cols[cols.length - 1]) / 2 : h.x0 + 2 * u;
      const top = topAt(cx);
      const len = (base - top) / u;
      g.strokeStyle = GREEN[2];
      g.lineWidth = 0.6 * u;
      g.beginPath();
      let vx = cx;
      for (let s = 0; s <= len; s += 0.25) {
        const vy = base - s * u;
        vx = cx + Math.sin(s * 0.42 + seed) * 2.1 * u;
        if (s === 0) g.moveTo(vx, vy);
        else g.lineTo(vx, vy);
        grow(vx, vy, u);
      }
      g.stroke();
      for (let s = 2; s < len - 4; s += 4) {
        const sx = cx + Math.sin(s * 0.42 + seed) * 2.1 * u;
        leaf(sx, base - s * u, Math.floor(s / 4) % 2 === 0 ? -1 : 1, s < len * 0.55);
      }
      posy(vx, top + u * 0.4, -1, ['buttercup', 'bigDaisy', 'forget']);
    }

    // the o: a wreath of leaves hugging its lower left, three small blooms set in it
    cur = 3;
    {
      const cx = (o.x0 + o.x1) / 2;
      const cy = (o.y0 + o.y1) / 2;
      const rx = (o.x1 - o.x0) / 2 + u;
      const ry = (o.y1 - o.y0) / 2 + u;
      const from = Math.PI * 0.55;
      const to = Math.PI * 1.25;
      g.strokeStyle = GREEN[1];
      g.lineWidth = 0.55 * u;
      g.beginPath();
      g.ellipse(cx, cy, rx, ry, 0, from, to);
      g.stroke();
      const steps = Math.round(((to - from) * Math.max(rx, ry)) / u / 1.1);
      for (let i = 0; i <= steps; i++) {
        const a = from + ((to - from) * i) / steps;
        const px = cx + Math.cos(a) * rx;
        const py = cy + Math.sin(a) * ry;
        grow(px, py, u);
        if (i % 3 === 0) leaf(px, py, Math.cos(a) < 0 ? -1 : 1, i % 6 === 0, Math.sin(a) > 0.3 ? -1 : 1);
      }
      const blooms: [Kind, number][] = [['rose', 0.7], ['forget', 0.88], ['daisy', 1.08]];
      for (const [kind, f] of blooms) head(kind, cx + Math.cos(Math.PI * f) * rx, cy + Math.sin(Math.PI * f) * ry);
    }

    // the x: a corsage where its strokes cross
    cur = 4;
    {
      const cx = (x.x0 + x.x1) / 2;
      const cy = base - (base - x.y0) * 0.5;
      leaf(cx - u, cy + u, -1, true, -1);
      leaf(cx + u, cy + u, 1, true, -1);
      leaf(cx - u, cy - u, -1, true);
      leaf(cx + u, cy - 2 * u, 1);
      head('forget', cx + 3 * u, cy + 2 * u);
      head('buttercup', cx - 3 * u, cy + u);
      head('rose', cx, cy - u);
    }

    // and a small tuft of grass at a few of the feet
    const feet: number[][] = [];
    const step = Math.max(1, Math.round(u * 0.25));
    for (let c = r.x0, run = -1; c <= x.x1 + step; c += step) {
      const on = inked(c, base - u * 0.4) && inked(c, base - u * 1.2);
      if (on && run < 0) run = c;
      if (!on && run >= 0) {
        feet.push([run, c - step]);
        run = -1;
      }
    }
    for (const [a, b] of feet) {
      if (rnd() >= 0.45) continue;
      const fx = a + (b - a) * (rnd() < 0.5 ? 0.12 : 0.88);
      cur = Math.max(0, letters.findIndex(([l0, l1]) => fx >= l0 && fx <= l1));
      for (let j = 0; j < 5; j++) {
        const bx = fx + (j - 2) * 0.7 * u;
        const bh = (2.2 + rnd() * 3) * u;
        const lean = (j - 2) * 0.7 * u;
        g.strokeStyle = GREEN[1 + (j % 3)];
        g.lineWidth = 0.5 * u;
        g.beginPath();
        g.moveTo(bx, base + 0.6 * u);
        g.quadraticCurveTo(bx + lean * 0.2, base - bh * 0.5, bx + lean, base - bh);
        g.stroke();
        grow(bx + lean, base - bh, u * 0.5);
      }
    }
  }
  g.restore();
  return dressed;
}
