'use client';

import { useLayoutEffect, useRef, type ReactNode } from 'react';

/** Art pixels per CSS pixel: the sign is painted in chunky pixels, like the wood. */
const PX = 3;

const C = {
  outline: '#5a2c12',
  frameDark: '#8a4a20',
  frame: '#c27a3a',
  frameLight: '#e9a85c',
  frameShine: '#fbd394',
  plank: ['#d48f4c', '#dd9a55', '#e6a862'],
  grain: '#b8743a',
  seam: '#7e4620',
  nail: '#4a2510',
  shadow: 'rgba(24,14,8,0.45)',
  leaf: ['#2f5a22', '#4e8a33', '#7cba48', '#a8d86a'],
};

const hash = (x: number, y: number) => {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

/** A wooden sign painted at w × h art pixels: a light carved frame, warm planks with grain and nails, leaves on two corners. */
function paint(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  const rect = (x: number, y: number, rw: number, rh: number, col: string) => {
    g.fillStyle = col;
    g.fillRect(x, y, rw, rh);
  };
  /** A rectangle with its corners stepped in by n pixels. */
  const rounded = (x: number, y: number, rw: number, rh: number, n: number, col: string) => {
    for (let i = 0; i < n; i++) rect(x + n - i, y + i, rw - 2 * (n - i), 1, col), rect(x + n - i, y + rh - 1 - i, rw - 2 * (n - i), 1, col);
    rect(x, y + n, rw, rh - 2 * n, col);
  };
  const m = 6;
  const W = w - m * 2;
  const H = h - m * 2 - 3;
  // its shadow on the wood behind
  rounded(m + 2, m + 4, W, H, 3, C.shadow);
  // the frame: dark edge, a light carved band with a shine on top, dark again inside
  rounded(m, m, W, H, 3, C.outline);
  rounded(m + 1, m + 1, W - 2, H - 2, 3, C.frame);
  rect(m + 4, m + 1, W - 8, 1, C.frameShine);
  rect(m + 2, m + 2, W - 4, 1, C.frameLight);
  rect(m + 1, m + 4, 1, H - 8, C.frameLight);
  rect(m + 2, m + H - 3, W - 4, 1, C.frameDark);
  rounded(m + 4, m + 4, W - 8, H - 8, 1, C.outline);
  // the planks, with their grain, seams and nails
  const x0 = m + 5;
  const y0 = m + 5;
  const iw = W - 10;
  const ih = H - 10;
  const plankH = 10;
  for (let y = 0; y < ih; y++) {
    const k = Math.floor(y / plankH);
    const row = y % plankH;
    for (let x = 0; x < iw; x++) {
      let col = C.plank[(k + (hash(x >> 3, k) < 0.2 ? 1 : 0)) % 2 === 0 ? 1 : 0];
      if (row === 0) col = C.seam;
      else if (row === 1) col = C.plank[2];
      else if (hash(Math.floor((x + k * 7) / 6), y) < 0.12 || (hash(x, y) < 0.04 && row > 2)) col = C.grain;
      rect(x0 + x, y0 + y, 1, 1, col);
    }
    if (row === 4) for (const nx of [3, iw - 4]) rect(x0 + nx, y0 + y, 1, 1, C.nail);
  }
  // a little shade under the top of the frame
  rect(x0, y0, iw, 1, C.seam);
  // leaves on the top-left and bottom-right corners
  const leaf = (lx: number, ly: number, dir: number) => {
    const shape = ['.12.', '1233', '1223', '.11.'];
    shape.forEach((row, j) => [...row].forEach((ch, i) => ch !== '.' && rect(lx + (dir > 0 ? i : 3 - i), ly + j, 1, 1, C.leaf[Number(ch)])));
    rect(lx + (dir > 0 ? -1 : 4), ly + 2, 1, 1, C.leaf[0]);
  };
  for (const [lx, ly, d] of [[m - 2, m + 1, 1], [m + 3, m - 3, 1], [m + 7, m + 2, -1], [m + W - 5, m + H - 6, -1], [m + W - 9, m + H - 2, 1], [m + W - 1, m + H - 9, -1]] as const) leaf(lx, ly, d);
  return c.toDataURL();
}

/** Its content on a painted wooden sign, repainted to its exact size so the pixels never stretch. */
export default function WoodSign({ className, children }: { className?: string; children: ReactNode }) {
  const el = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const d = el.current;
    if (!d) return;
    let last = '';
    const draw = () => {
      const w = Math.ceil(d.offsetWidth / PX);
      const h = Math.ceil(d.offsetHeight / PX);
      const key = `${w}x${h}`;
      if (key === last || !w || !h) return;
      last = key;
      d.style.backgroundImage = `url(${paint(w, h)})`;
      d.style.backgroundSize = `${w * PX}px ${h * PX}px`;
    };
    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(d);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={el} className={className}>
      {children}
    </div>
  );
}
