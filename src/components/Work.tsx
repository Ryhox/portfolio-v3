'use client';

import { useEffect, useRef, useSyncExternalStore } from 'react';
import { projects } from '@/content/projects';
import { forest } from '@/scene/store';
import { scrollToY } from '@/site/scroll';
import ScreenPage from './ScreenPage';

const subscribe = forest.subscribe;
const get = forest.get;
const server = forest.server;

/**
 * A disc picked from a little off the computer (the discs can be picked a little either side of it) brings you the
 * short way to where you stand at it, so the screen tunes in and you dive in right away, not when you next scroll.
 */
function toComputer() {
  const work = document.querySelector<HTMLElement>('[data-stage="work"]');
  const stick = work?.querySelector<HTMLElement>('.work-stick');
  if (!work || !stick) return;
  const a = work.offsetTop + 2;
  const b = Math.max(a, work.offsetTop + work.offsetHeight - stick.offsetHeight - 2);
  const y = window.scrollY;
  const to = Math.min(b, Math.max(a, y));
  if (Math.abs(to - y) > 1) scrollToY(to);
}

/**
 * Into the screen from the monitor's glass, for a disc that's in but whose dive you weren't there for. (Not for the
 * page's own buttons: Leave's click comes up through the glass too.)
 */
const diveIn = (e: React.MouseEvent) => {
  if ((e.target as HTMLElement).closest('button, a')) return;
  const st = forest.get();
  if (!st.full && !st.playing && st.selected !== null && st.loaded === st.selected) forest.set({ full: true });
};

/**
 * The clearing. The discs and the computer are drawn by the forest; this is everything laid over them (moved into
 * place every frame): buttons on the discs, and the project's page on the monitor's glass (`ScreenPage`). Once a
 * disc has booted the monitor, the forest dives into the glass until that page fills the window.
 */
export default function Work() {
  const state = useSyncExternalStore(subscribe, get, server);
  const glass = useRef<HTMLDivElement>(null);

  // the static the page tunes in through: a tile of it, painted once, as dim as the glass's own waiting static
  useEffect(() => {
    const el = glass.current;
    if (!el) return;
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    if (!g) return;
    const img = g.createImageData(128, 128);
    let seed = 9091;
    for (let i = 0; i < 128 * 128; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const n = seed / 4294967296;
      const v = Math.min(1, 0.05 + n * n * 0.45);
      img.data.set([16 + v * 214, 22 + v * 222, 18 + v * 206, 255], i * 4);
    }
    g.putImageData(img, 0, 0);
    el.style.setProperty('--static', `url(${c.toDataURL()})`);
  }, []);

  return (
    <section className="work" data-stage="work" aria-labelledby="work-title">
      <h2 id="work-title" className="sr-only">
        Selected work
      </h2>
      {/* one screen tall (svh): the forest measures the clearing's stay by it */}
      <div className="work-stick" aria-hidden="true" />

      <div id="discs" className="discs" data-active="false">
        {projects.map((p, i) => (
          <button
            key={p.slug}
            type="button"
            data-disc={i}
            aria-pressed={state.selected === i}
            aria-label={`${p.title}: load the disc`}
            onPointerEnter={() => forest.set({ hovered: i })}
            onPointerLeave={() => forest.get().hovered === i && forest.set({ hovered: null })}
            onFocus={() => forest.set({ hovered: i })}
            onBlur={() => forest.get().hovered === i && forest.set({ hovered: null })}
            onClick={() => {
              const pick = state.selected === i ? null : i;
              if (pick !== null) toComputer();
              forest.set({ selected: pick });
            }}
          ></button>
        ))}
      </div>

      {/* the monitor's glass: the project's page, scaled onto it (the forest dives into it to read it) */}
      <div ref={glass} id="pin-screen" className="pin pin-screen" data-show="false" onClick={diveIn}>
        <ScreenPage />
      </div>
    </section>
  );
}
