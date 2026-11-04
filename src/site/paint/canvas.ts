import { Pix, rgbOf } from '@/scene/pix';

/**
 * The page's pixel pictures: painted into the same little buffers as the wood (`Pix`), then put on 2D canvases
 * shown at a whole number of screen pixels per art pixel, so nothing is ever smoothed.
 */
export function toCanvas(p: Pix, into?: HTMLCanvasElement) {
  const c = into ?? document.createElement('canvas');
  if (c.width !== p.w || c.height !== p.h) {
    c.width = p.w;
    c.height = p.h;
  }
  const g = c.getContext('2d')!;
  const bytes = new Uint8ClampedArray(p.w * p.h * 4);
  bytes.set(new Uint8Array(p.data.buffer, p.data.byteOffset, p.w * p.h * 4));
  g.putImageData(new ImageData(bytes, p.w, p.h), 0, 0);
  return c;
}

/** The art pixel size in CSS pixels, as the head script worked it out (the same as the wood's). */
export function artPx() {
  const v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--px'));
  return v > 0 ? v : 3;
}

const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
/** 17 masks (0/16 … 16/16 of the pixels), to fade one picture into another in dithered steps. */
export function ditherMasks(g: CanvasRenderingContext2D) {
  const out: CanvasPattern[] = [];
  for (let k = 0; k <= 16; k++) {
    const c = document.createElement('canvas');
    c.width = c.height = 4;
    const cg = c.getContext('2d')!;
    cg.fillStyle = '#000';
    for (let i = 0; i < 16; i++) if (BAYER4[i] < k) cg.fillRect(i % 4, Math.floor(i / 4), 1, 1);
    out.push(g.createPattern(c, 'repeat')!);
  }
  return out;
}

export const bayer = (x: number, y: number) => (BAYER4[(x & 3) + (y & 3) * 4] + 0.5) / 16;

const pack = (r: number, g: number, b: number, a = 255) => ((a << 24) | (Math.max(0, Math.min(255, Math.round(b))) << 16) | (Math.max(0, Math.min(255, Math.round(g))) << 8) | Math.max(0, Math.min(255, Math.round(r)))) >>> 0;

/**
 * The same picture later in the day: `step` 1 is late afternoon, 2 golden hour, 3 the alpenglow, when the valley
 * has gone into blue shade and only the rock still catches the sun, pink and orange (`glow` 1 for the rock).
 */
export function tint(p: Pix, step: number, glow = 0): Pix {
  const out = new Pix(p.w, p.h);
  if (step === 0) {
    out.data.set(p.data);
    return out;
  }
  const k = step / 3;
  for (let i = 0; i < p.data.length; i++) {
    const c = p.data[i];
    if (!(c >>> 24)) continue;
    let [r, g, b] = rgbOf(c);
    const lum = (r * 0.3 + g * 0.55 + b * 0.15) / 255;
    const lit = Math.min(1, Math.max(0, (lum - 0.3) / 0.5));
    // the valley cools and darkens as the sun goes
    const dark = 1 - k * (0.32 - glow * 0.22);
    r *= dark;
    g *= dark;
    b *= dark;
    // shadows go blue-violet
    const cool = k * (1 - lit) * 0.35;
    r += (70 - r) * cool;
    g += (64 - g) * cool;
    b += (120 - b) * cool;
    // what still sees the sun warms: gold on grass and wood, pink-orange on the rock
    const warm = lit * (glow > 0 ? Math.min(1, k * 1.25) * 0.62 : k * 0.28);
    const [wr, wg, wb] = glow > 0 ? (step >= 3 ? [246, 150, 140] : [248, 186, 128]) : [250, 196, 120];
    r += (wr - r) * warm;
    g += (wg - g) * warm;
    b += (wb - b) * warm;
    out.data[i] = pack(r, g, b, c >>> 24);
  }
  return out;
}
