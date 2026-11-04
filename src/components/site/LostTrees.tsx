'use client';

import { useEffect, useRef } from 'react';
import { treeSprite, type TreeKind } from '@/scene/art/trees';
import { setPalette } from '@/scene/palette';
import { toCanvas } from '@/site/paint/canvas';
import { seasonStore, useSeason } from '@/site/season';

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
      const c = toCanvas(sp.pix);
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
