import { bushSprite, treeSprite, type TreeKind } from '@/scene/art/trees';
import { setPalette } from '@/scene/palette';
import type { Season } from '@/scene/season';
import { toCanvas } from '@/site/paint/canvas';

/**
 * The trees that stand in front of the Projects page: the wood's own pixel trees, in the season, closed across
 * the screen like a curtain, inner ones in front. Each is painted on its own little canvas, one per idle moment,
 * so the page never stalls for them.
 */

/** Where each one stands, as a fraction of the screen's width from its own edge, from the inside out. */
const LAYOUT: { kind: TreeKind; at: number; seed: number }[] = [
  { kind: 'young', at: 0.47, seed: 1401 },
  { kind: 'birch', at: 0.38, seed: 1301 },
  { kind: 'oak', at: 0.28, seed: 1101 },
  { kind: 'beech', at: 0.16, seed: 1201 },
  { kind: 'ancient', at: 0.05, seed: 1501 },
];

export type Tree = { el: HTMLCanvasElement; ax: number; ay: number; at: number; side: -1 | 1; depth: number; bush: boolean };

/** Paints the curtain for `season`, one tree at a time; `onTree` gets each as it's ready. */
export function paintCurtain(season: Season, onTree: (t: Tree) => void) {
  setPalette(season);
  const jobs: (() => void)[] = [];
  for (const side of [-1, 1] as const)
    LAYOUT.forEach((l, i) => {
      jobs.push(() => {
        const sp = treeSprite(l.kind, l.seed + (side > 0 ? 50 : 0));
        onTree({ el: toCanvas(sp.pix), ax: sp.ax, ay: sp.ay, at: l.at + (side > 0 ? 0.012 : 0), side, depth: i, bush: false });
      });
    });
  // and bushes along the foot, where the trunks leave gaps
  for (const side of [-1, 1] as const)
    [0.43, 0.32, 0.2].forEach((at, i) => {
      jobs.push(() => {
        const sp = bushSprite(2100 + i * 7 + (side > 0 ? 3 : 0));
        onTree({ el: toCanvas(sp.pix), ax: sp.ax, ay: sp.ay, at, side, depth: -1, bush: true });
      });
    });
  let cancelled = false;
  const idle = (f: () => void) => (typeof window.requestIdleCallback === 'function' ? window.requestIdleCallback(f, { timeout: 400 }) : setTimeout(f, 16));
  const next = () => {
    if (cancelled) return;
    const job = jobs.shift();
    if (!job) return;
    job();
    idle(next);
  };
  idle(next);
  return () => {
    cancelled = true;
  };
}
