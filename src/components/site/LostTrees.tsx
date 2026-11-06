'use client';

import { useEffect, useRef } from 'react';
import { treeSprite, type TreeKind } from '@/scene/art/trees';
import { SUN_TINT } from '@/scene/config';
import { setPalette } from '@/scene/palette';
import { Pix } from '@/scene/pix';
import { toCanvas } from '@/site/paint/canvas';
import { seasonStore, useSeason } from '@/site/season';

/** The light the wood's sprites are painted for (`LAYER_FRAG` in gl.ts): ambient + sun × 0.6, the sun's tint by season. */
const AMBIENT = 1.04;
const SUN = 0.5;
/** A breath of the wood's haze: the paper's own colour, so they sit on the page. */
const HAZE = [0xef, 0xe8, 0xd4];
const HAZE_K = 0.1;

/**
 * The wood's light, baked in. In the forest every sprite is lit by the sun, so its painted colours are a shade darker
 * than they ever show; bare on paper they look dark and flat. So each pixel gets the sun here the way it would there:
 * the leaves on the sun's side of the crown (it shines from up and to the right) in full sun, those with leaves between
 * them and it in the crown's own shade, the trunk under the crown shaded too.
 */
function sunlit(p: Pix, tint: readonly number[]) {
  const out = new Pix(p.w, p.h);
  const sx = 0.35;
  const sy = -0.94;
  for (let y = 0; y < p.h; y++)
    for (let x = 0; x < p.w; x++) {
      const c = p.get(x, y);
      if (!(c >>> 24)) continue;
      // how much of the tree lies between this pixel and the sun, the nearest leaves counting most
      let block = 0;
      for (let k = 2; k <= 8; k++) if (p.get(Math.round(x + sx * k), Math.round(y + sy * k)) >>> 24) block += 2.2 / k;
      const sun = Math.max(0, 1 - block * 0.55);
      const ch = (v: number, i: number) => {
        const lit = Math.min(255, v * (AMBIENT + tint[i] * SUN * sun));
        return Math.round(lit + (HAZE[i] - lit) * HAZE_K);
      };
      out.set(x, y, ((c & 0xff000000) | (ch((c >>> 16) & 255, 2) << 16) | (ch((c >>> 8) & 255, 1) << 8) | ch(c & 255, 0)) >>> 0);
    }
  return out;
}

/** The 404's doodle is 720 × 320 units, its ground at 268. */
const VIEW_W = 720;
const VIEW_H = 320;
const GROUND = 268;

/** Which of the wood's trees stand where (`x` is the trunk, in the doodle's units), back ones first. */
const TREES: { kind: TreeKind; seed: number; x: number }[] = [
  { kind: 'young', seed: 1402, x: 206 },
  { kind: 'birch', seed: 1302, x: 530 },
  { kind: 'oak', seed: 1101, x: 104 },
  { kind: 'beech', seed: 1201, x: 622 },
];

/**
 * The wood's own pixel trees, in the season, standing either side of the 404's signpost: each painted onto its own
 * little canvas and shown at a whole number of screen pixels per art pixel (about one CSS pixel each at full size),
 * so nothing is ever smoothed. They stand behind the doodle, so its grass grows in front of their trunks.
 */
export default function LostTrees() {
  const box = useRef<HTMLDivElement>(null);
  // the visit's season (the calendar's, or one picked with ?season= / earlier in the visit), as the wood wears it;
  // painted from the client's own value, not the server's placeholder, so they never show the wrong season first
  const season = useSeason();

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const now = seasonStore.get();
    if (season !== now) return;
    setPalette(now);
    const canvases = TREES.map((t) => {
      const sp = treeSprite(t.kind, t.seed);
      const c = toCanvas(sunlit(sp.pix, SUN_TINT[now]));
      c.className = 'nf-tree';
      c.style.setProperty('--x', String((t.x / VIEW_W) * 100));
      c.style.setProperty('--w', String(sp.pix.w));
      c.style.setProperty('--h', String(sp.pix.h));
      c.style.setProperty('--ax', String(sp.ax));
      return c;
    });
    el.replaceChildren(...canvases);
    // a whole number of device pixels per art pixel, as near the doodle's own scale as that allows
    const fit = () => {
      const dpr = window.devicePixelRatio || 1;
      const n = Math.max(1, Math.round((el.clientWidth / VIEW_W) * dpr));
      el.style.setProperty('--s', String(n / dpr));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => {
      ro.disconnect();
      el.replaceChildren();
    };
  }, [season]);

  return <div ref={box} className="nf-trees" aria-hidden="true" style={{ '--ground': ((VIEW_H - GROUND) / VIEW_H) * 100 } as React.CSSProperties} />;
}
