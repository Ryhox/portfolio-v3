/// <reference lib="webworker" />
/**
 * Paints the whole forest off the main thread, most visible first, and hands each finished
 * buffer over as soon as it's done. The page is usable from the first byte; the wood fills in.
 */
import { projects } from '@/content/projects';
import { DISC_WORLD, DISCS, texelAt } from '../config';
import { setPalette } from '../palette';
import type { Season } from '../season';
import type { Pix } from '../pix';
import { floorLitter, floorPattern, floorRamps } from './floor';
import { edgeTree, type Layer } from './forest';
import { bushSprite, TREE_D, TREE_SET, treeSprite } from './trees';
import { catSprite, computerSprite, discSprite, hollowStump, hollowWall, keyboardSprite } from './props';
import { roofMask } from './roof';
import { atlas, critterSprites, floraFor } from './sprites';

export type Painted = {
  key: string;
  w: number;
  h: number;
  ax: number;
  ay: number;
  d: number;
  repeat: boolean;
  buf: ArrayBuffer;
  extra?: unknown;
};

const ctx = self as unknown as DedicatedWorkerGlobalScope;

function send(key: string, pix: Pix, l: Partial<Layer> = {}, extra?: unknown) {
  const buf = pix.data.buffer as ArrayBuffer;
  const msg: Painted = { key, w: pix.w, h: pix.h, ax: l.ax ?? 0, ay: l.ay ?? pix.h, d: l.d ?? 5, repeat: !!l.repeat, buf, extra };
  ctx.postMessage(msg, [buf]);
}
const layer = (key: string, l: Layer, extra?: unknown) => send(key, l.pix, l, extra);

// the trees, one sprite per kind and seed; the forest plants them
const trees = TREE_SET.flatMap((t) => t.seeds.map((seed, i) => () => {
  const s = treeSprite(t.kind, seed);
  send(`tree:${t.kind}:${i}`, s.pix, { ax: s.ax, ay: s.ay, d: TREE_D }, { kind: t.kind });
}));

/** Three groups, painted by three workers at once: the two halves of the meadow, then everything further in. */
let season: Season = 'summer';
const groups: (() => void)[][] = [
  [
    () => layer('edgeL', edgeTree(-1)),
    () => {
      send('floorPattern', floorPattern());
      send('floorLitter', floorLitter(season));
      const r = floorRamps();
      send('floorRamps', r.pix, {}, { rows: r.rows });
    },
    ...trees.filter((_, i) => i % 2 === 0),
  ],
  [
    () => layer('edgeR', edgeTree(1)),
    ...trees.filter((_, i) => i % 2 === 1),
    () => [0, 1].forEach((i) => {
      const s = bushSprite(1600 + i);
      send(`bush:${i}`, s.pix, { ax: s.ax, ay: s.ay, d: TREE_D });
    }),
    () => {
      const fl = floraFor(season);
      const f = atlas(fl.list);
      send('flora', f.pix, {}, { rects: f.rects, sets: fl.sets, tufts: fl.tufts, patches: fl.patches, grass: fl.grass });
      const c = critterSprites(season);
      const a = atlas(c.list);
      send('critters', a.pix, {}, { rects: a.rects, index: c.index });
    },
    () => send('roof', roofMask()),
  ],
  [
    () => {
      send('computer', computerSprite());
      send('keyboard', keyboardSprite());
    },
    () => {
      projects.forEach((p, i) => {
        const s = DISCS[i];
        const size = DISC_WORLD / texelAt(s.d);
        const disc = discSprite(size, s.a, p.disc.body, p.disc.stripe, 50 + i);
        send(`disc${i}`, disc.pix, { ax: disc.cx, ay: disc.pix.h, d: s.d }, { cx: disc.cx, cy: disc.cy, size });
      });
    },
    () => {
      const st = hollowStump();
      layer('stump', st, { catAt: st.catAt });
      send('catOpen', catSprite(false));
      send('catShut', catSprite(true));
    },
    // the swirl of leaves behind the cat
    () => {
      const wall = hollowWall();
      send('hollowWall', wall.pix, { ax: wall.ax, ay: wall.ay, d: wall.d });
    },
  ],
];

ctx.onmessage = (e: MessageEvent<{ group: number; season: Season }>) => {
  const times: number[] = [];
  season = e.data.season;
  // every painter reads the palette as it paints: the season's colours first
  setPalette(season);
  for (const job of groups[e.data.group] ?? []) {
    const t = performance.now();
    job();
    times.push(Math.round(performance.now() - t));
  }
  ctx.postMessage({ key: 'done', group: e.data.group, times });
};
