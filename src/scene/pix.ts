/**
 * A tiny pixel buffer and the maths every sprite generator shares.
 * Colours are packed as 0xAABBGGRR so the buffer can be uploaded to WebGL as RGBA bytes untouched.
 */

export type Ramp = readonly number[];

export function hex(h: string): number {
  const n = parseInt(h.slice(1), 16);
  return (0xff000000 | ((n & 255) << 16) | (n & 0xff00) | ((n >> 16) & 255)) >>> 0;
}

/** A ramp is a list of colours from dark to light. */
export const ramp = (...hs: string[]): Ramp => hs.map(hex);

export const rgbOf = (c: number): [number, number, number] => [c & 255, (c >>> 8) & 255, (c >>> 16) & 255];

export function mix(a: number, b: number, t: number): number {
  const [ar, ag, ab] = rgbOf(a);
  const [br, bg, bb] = rgbOf(b);
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return (0xff000000 | (bl << 16) | (g << 8) | r) >>> 0;
}

export const clamp = (v: number, lo = 0, hi = 1) => (v < lo ? lo : v > hi ? hi : v);

/** Picks a ramp colour for a 0..1 light value. */
export function shade(r: Ramp, t: number): number {
  const i = Math.round(clamp(t) * (r.length - 1));
  return r[i];
}

export function mulberry(seed: number) {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hash2(x: number, y: number, s = 0): number {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

const smooth = (f: number) => f * f * (3 - 2 * f);

export function noise1(x: number, s = 0): number {
  const i = Math.floor(x);
  const u = smooth(x - i);
  return hash2(i, 0, s) * (1 - u) + hash2(i + 1, 0, s) * u;
}

export function noise2(x: number, y: number, s = 0): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const u = smooth(x - ix);
  const v = smooth(y - iy);
  const a = hash2(ix, iy, s);
  const b = hash2(ix + 1, iy, s);
  const c = hash2(ix, iy + 1, s);
  const d = hash2(ix + 1, iy + 1, s);
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}

export class Pix {
  readonly data: Uint32Array;

  /** `wrap` makes x wrap around, for layers that tile sideways forever. */
  constructor(
    readonly w: number,
    readonly h: number,
    readonly wrap = false,
  ) {
    this.data = new Uint32Array(w * h);
  }

  index(x: number, y: number): number {
    x = Math.floor(x);
    y = Math.floor(y);
    if (y < 0 || y >= this.h) return -1;
    if (this.wrap) x = ((x % this.w) + this.w) % this.w;
    else if (x < 0 || x >= this.w) return -1;
    return y * this.w + x;
  }

  set(x: number, y: number, c: number) {
    const i = this.index(x, y);
    if (i >= 0) this.data[i] = c;
  }

  get(x: number, y: number): number {
    const i = this.index(x, y);
    return i >= 0 ? this.data[i] : 0;
  }

  /** Only paints where something is already painted. */
  over(x: number, y: number, c: number) {
    const i = this.index(x, y);
    if (i >= 0 && this.data[i] >>> 24) this.data[i] = c;
  }

  rect(x: number, y: number, w: number, h: number, c: number) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c);
  }

  /** A 1px line (Bresenham). */
  line(x0: number, y0: number, x1: number, y1: number, c: number) {
    x0 = Math.round(x0);
    y0 = Math.round(y0);
    x1 = Math.round(x1);
    y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.set(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y0 += sy;
      }
    }
  }

  /** Copies another buffer in, skipping its transparent pixels. */
  blit(src: Pix, ox: number, oy: number) {
    for (let y = 0; y < src.h; y++) {
      for (let x = 0; x < src.w; x++) {
        const c = src.data[y * src.w + x];
        if (c >>> 24) this.set(ox + x, oy + y, c);
      }
    }
  }

  /**
   * A selective outline, as pixel artists draw it: edge pixels take a darker shade of their own colour,
   * strongest where the shape turns away from the light (bottom and right), soft on the lit side.
   */
  outline(dark = 0.52, soft = 0.8) {
    const { w, h, data } = this;
    const src = data.slice();
    const solid = (x: number, y: number) => {
      if (y < 0 || y >= h) return false;
      if (this.wrap) x = ((x % w) + w) % w;
      else if (x < 0 || x >= w) return false;
      return (src[y * w + x] >>> 24) > 0;
    };
    const tint = (c: number, f: number) => {
      // towards a warm near-black rather than grey
      const r = Math.round((c & 255) * f + 22 * (1 - f) * 0.6);
      const g = Math.round(((c >>> 8) & 255) * f + 18 * (1 - f) * 0.6);
      const b = Math.round(((c >>> 16) & 255) * f + 14 * (1 - f) * 0.6);
      return ((c & 0xff000000) | (b << 16) | (g << 8) | r) >>> 0;
    };
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const c = src[y * w + x];
        if (!(c >>> 24)) continue;
        const shadowSide = !solid(x, y + 1) || !solid(x + 1, y);
        const litSide = !solid(x, y - 1) || !solid(x - 1, y);
        if (shadowSide) data[y * w + x] = tint(c, dark);
        else if (litSide) data[y * w + x] = tint(c, soft);
      }
    }
  }

  /**
   * Gives transparent pixels the colour of their nearest painted neighbour in the row (alpha stays 0),
   * so mipmaps don't pull dark fringes in from the empty black around shapes.
   */
  bleed() {
    const { w, h, data } = this;
    for (let y = 0; y < h; y++) {
      const row = y * w;
      let last = -1;
      for (let x = 0; x < w; x++) {
        const c = data[row + x];
        if (c >>> 24) last = c & 0xffffff;
        else if (last >= 0) data[row + x] = last;
      }
      last = -1;
      for (let x = w - 1; x >= 0; x--) {
        const c = data[row + x];
        if (c >>> 24) last = c & 0xffffff;
        else if (last >= 0 && !(data[row + x] & 0xffffff)) data[row + x] = last;
      }
    }
  }
}
