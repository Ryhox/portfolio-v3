/**
 * Text that lives in the forest: blocks of words laid out and painted onto a canvas at full
 * resolution, then hung in the scene as a plane. The page's real links are pinned over them.
 */

import { ICON_SIZE, ICONS, type IconKey } from '@/content/icons';

export type Run = { text: string; font: 'display' | 'text' | 'italic' | 'pixel'; size: number; color: string; link?: string; weight?: number; button?: boolean; icon?: IconKey };

/** The size of one block of a pixel button, in CSS pixels. */
const blockOf = (size: number) => Math.max(2, Math.round(size / 8));
/** A button's width and height in CSS pixels (whole blocks), for its text width. */
function buttonBox(r: Run, textW: number) {
  const b = blockOf(r.size);
  const inner = 8 * b + (r.icon ? (ICON_SIZE + 3) * b : 0) + textW;
  return { b, w: Math.ceil(inner / b) * b, h: (r.icon ? ICON_SIZE + 5 : Math.max(11, Math.ceil((r.size * 1.25) / b) + 6)) * b };
}
/** A paragraph: runs that wrap together. `row` keeps them on one line with gaps instead. */
export type Para = { runs: Run[]; gap?: number; row?: boolean; after?: number; lineHeight?: number };
export type Painted = { canvas: HTMLCanvasElement; w: number; h: number; links: { id: string; x: number; y: number; w: number; h: number }[] };

const families: Record<string, string> = {};
function family(kind: Run['font']) {
  const v = kind === 'text' ? '--font-text' : kind === 'pixel' ? '--font-pixel' : '--font-display';
  if (!families[v]) families[v] = getComputedStyle(document.documentElement).getPropertyValue(v).trim() || 'Georgia, serif';
  return families[v];
}
const fontOf = (r: Run) => `${r.font === 'italic' ? 'italic ' : ''}${r.weight ?? (r.font === 'text' ? 450 : 420)} ${r.size}px ${family(r.font)}`;

/** What the words sit on: nothing, or a soft dark of the wood (`scrim`) so they read over light. */
export type Look = 'none' | 'scrim';

/**
 * Lays the paragraphs out `width` CSS pixels wide and paints them at `ratio` device pixels per CSS pixel,
 * on the given `look`. Links come back in CSS pixels.
 */
export function paintBoard(paras: Para[], width: number, ratio: number, look: Look = 'scrim'): Painted {
  const scrim = look === 'scrim';
  const measure = document.createElement('canvas').getContext('2d')!;
  type Placed = { run: Run; text: string; x: number; y: number; w: number };
  const placed: Placed[] = [];
  const links: Painted['links'] = [];
  let y = 0;
  for (const p of paras) {
    const lh = (p.lineHeight ?? 1.4) * Math.max(...p.runs.map((r) => r.size));
    const hasButton = p.runs.some((r) => r.button);
    if (p.row) {
      let x = 0;
      for (const r of p.runs) {
        measure.font = fontOf(r);
        const tw = measure.measureText(r.text).width;
        const box = r.button ? buttonBox(r, tw) : null;
        const w = box ? box.w : tw;
        // a button leaves two blocks above it for its sprout
        const top = box ? box.b * 2 : 0;
        placed.push({ run: r, text: r.text, x, y: y + top, w });
        if (r.link) links.push({ id: r.link, x: x - 2, y: y + top - 2, w: w + 4, h: (box ? box.h : lh) + 4 });
        x += w + (p.gap ?? 22);
      }
      y += hasButton ? Math.max(...p.runs.map((r) => (r.button ? buttonBox(r, 0).h + buttonBox(r, 0).b * 4 : r.size))) : lh;
    } else {
      let x = 0;
      for (const r of p.runs) {
        measure.font = fontOf(r);
        const space = measure.measureText(' ').width;
        const start = { x, y };
        for (const word of r.text.split(' ')) {
          const w = measure.measureText(word).width;
          if (x > 0 && x + w > width) {
            x = 0;
            y += lh;
          }
          placed.push({ run: r, text: word, x, y, w });
          x += w + space;
        }
        if (r.link) links.push({ id: r.link, x: start.x - 4, y: start.y - 4, w: x - start.x + 4, h: y - start.y + lh + 4 });
      }
      y += lh;
    }
    y += p.after ?? 8;
  }
  const pad = scrim ? 60 : 8;
  const padTop = pad;
  const w = width + pad * 2;
  const h = Math.ceil(y + pad * 2);
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(w * ratio);
  canvas.height = Math.ceil(h * ratio);
  const g = canvas.getContext('2d')!;
  g.scale(ratio, ratio);
  if (scrim) {
    const grad = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) / 2);
    grad.addColorStop(0, 'rgba(10,18,12,0.84)');
    grad.addColorStop(0.62, 'rgba(10,18,12,0.62)');
    grad.addColorStop(1, 'rgba(10,18,12,0)');
    g.save();
    g.translate(w / 2, h / 2);
    g.scale(1, h / Math.max(w, h));
    g.translate(-w / 2, -h / 2);
    g.fillStyle = grad;
    // fill well past the edges: the oval fades to nothing on its own, so there is never a hard edge
    g.fillRect(-w, -Math.max(w, h) * 2, w * 3, Math.max(w, h) * 5);
    g.restore();
  }
  g.textBaseline = 'top';
  for (const p of placed) {
    g.font = fontOf(p.run);
    if (p.run.button) {
      const st = p.run.link ? buttonState[p.run.link] : undefined;
      const box = buttonBox(p.run, 0);
      gameButton(g, pad + p.x, padTop + p.y, p.w, box.h, box.b, st, p.run, p.text);
      continue;
    }
    g.fillStyle = p.run.color;
    g.fillText(p.text, pad + p.x, padTop + p.y);
    if (p.run.link) {
      g.globalAlpha = 0.45;
      g.fillRect(pad + p.x, padTop + p.y + p.run.size * 1.12, p.w, 1);
      g.globalAlpha = 1;
    }
  }
  for (const l of links) {
    l.x += pad;
    l.y += padTop;
  }
  return { canvas, w, h, links };
}

/** Which painted buttons are under the pointer or pressed, by link id. */
export const buttonState: Record<string, 'hover' | 'press'> = {};

const BTN = {
  outline: '#1d1612',
  shadow: 'rgba(18,13,11,0.45)',
  body: '#fbf6e9',
  dark: '#e4d9bf',
  hover: { body: '#e9f0cf', dark: '#cbd8a6' },
  press: { body: '#dbe6bc', dark: '#bccb92' },
  text: '#1d1612',
};
/** The moss a hovered button grows, and the flowers in it. */
const MOSS = { dark: '#3f6a2e', mid: '#5e8c3a', light: '#8ab452', pink: '#e47f98', white: '#fff6e6', yellow: '#f2c24a' };

/**
 * A button painted the way the page's are, all in whole blocks: a scrap of the pale paper with a stepped outline
 * in ink and a shadow down and to the right, ink letters, a little depth along its foot. Under the pointer it
 * turns highlighter yellow; pressed, it goes down onto its shadow.
 * Painted from a few big overlapping shapes, never block by block, so no seams can show between blocks.
 */
function gameButton(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, b: number, state: 'hover' | 'press' | undefined, run: Run, text: string) {
  const rest = Math.round(y / b) * b;
  const pressed = state === 'press';
  const x0 = Math.round(x / b) * b + (pressed ? b : 0);
  const y0 = rest + (pressed ? b : 0);
  const tone = state === 'hover' ? BTN.hover : pressed ? BTN.press : BTN;
  const rect = (rx: number, ry: number, rw: number, rh: number, c: string) => {
    g.fillStyle = c;
    g.fillRect(rx, ry, rw, rh);
  };
  /** A rectangle with its corners stepped in by n blocks: two overlapping rects, so no seam. */
  const rounded = (rx: number, ry: number, rw: number, rh: number, n: number, c: string) => {
    rect(rx + n * b, ry, rw - 2 * n * b, rh, c);
    rect(rx, ry + n * b, rw, rh - 2 * n * b, c);
  };
  if (!pressed) rounded(Math.round(x / b) * b + b, rest + b, w, h, 1, BTN.shadow);
  rounded(x0, y0, w, h, 1, BTN.outline);
  // the paper, inset one block, its corners stepped once more, a shade along its foot
  rounded(x0 + b, y0 + b, w - 2 * b, h - 2 * b, 1, tone.body);
  rect(x0 + 2 * b, y0 + h - 2 * b, w - 4 * b, b, tone.dark);
  // hovered: moss along its top, block by block, with flowers in it, and a tuft on its corner
  if (state === 'hover') {
    const hash = (n: number) => {
      const v = Math.sin(n * 127.1 + 311.7) * 43758.5453;
      return v - Math.floor(v);
    };
    const cols = Math.round(w / b);
    const tops: number[] = [];
    let prev = 2;
    for (let i = 0; i < cols; i++) {
      const hh = Math.max(prev - 1, Math.min(prev + 1, 1 + (hash(i) > 0.45 ? 1 : 0)));
      prev = hh;
      tops.push(hh);
      for (let j = 0; j < hh; j++) rect(x0 + i * b, y0 - (j - 1) * b - b, b + 0.5, b + 0.5, j === hh - 1 ? (hash(i * 3.1) > 0.45 ? MOSS.light : MOSS.mid) : j === hh - 2 ? MOSS.mid : MOSS.dark);
    }
    for (const [at, petal, heart] of [[0.24, MOSS.pink, MOSS.yellow], [0.68, MOSS.white, MOSS.yellow]] as const) {
      const i = Math.round(cols * at);
      const fy = y0 - (tops[i] ?? 2) * b - b;
      rect(x0 + i * b, fy, b, b, heart);
      rect(x0 + (i - 1) * b, fy, b, b, petal);
      rect(x0 + (i + 1) * b, fy, b, b, petal);
      rect(x0 + i * b, fy - b, b, b, petal);
      rect(x0 + i * b, fy + b, b, b, petal);
    }
    // the tuft, a little mound on the bottom-right corner with a pink flower
    for (let i = 0; i < 6; i++) {
      const mh = Math.round(3 * Math.sin((Math.PI * (i + 0.5)) / 6)) + 1;
      for (let j = 0; j < mh; j++) rect(x0 + w - 3 * b + i * b, y0 + h - j * b, b + 0.5, b + 0.5, j === mh - 1 ? MOSS.light : j === mh - 2 ? MOSS.mid : MOSS.dark);
    }
    rect(x0 + w, y0 + h - 4 * b, b, b, MOSS.yellow);
    rect(x0 + w - b, y0 + h - 4 * b, b, b, MOSS.pink);
    rect(x0 + w + b, y0 + h - 4 * b, b, b, MOSS.pink);
    rect(x0 + w, y0 + h - 5 * b, b, b, MOSS.pink);
  }
  // the icon: each pixel drawn a hair larger than its block, so neighbours overlap instead of leaving seams
  let tx = x0 + 4 * b;
  if (run.icon) {
    const iy = y0 + Math.round((h / b - ICON_SIZE) / 2) * b;
    const { rows: ir, colors } = ICONS[run.icon];
    ir.forEach((row, j) => {
      // whole runs of one colour as one rect
      let i = 0;
      while (i < row.length) {
        const ch = row[i];
        let k = i;
        while (k < row.length && row[k] === ch) k++;
        if (ch !== '.' && colors[ch]) rect(tx + i * b, iy + j * b, (k - i) * b + 0.6, b + 0.6, colors[ch]);
        i = k;
      }
    });
    tx += (ICON_SIZE + 3) * b;
  }
  // the words, in pixels, in ink
  g.font = `${Math.max(run.weight ?? 600, 700)} ${run.size}px ${family('pixel')}`;
  g.textBaseline = 'middle';
  const ty = y0 + h / 2 + b * 0.2;
  g.fillStyle = BTN.text;
  g.fillText(text, tx, ty);
  g.textBaseline = 'top';
}
