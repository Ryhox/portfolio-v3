'use client';

import { useEffect, useRef, useSyncExternalStore } from 'react';
import { projects } from '@/content/projects';
import { forest } from '@/scene/store';
import ScreenPage from './ScreenPage';

const subscribe = forest.subscribe;
const get = forest.get;

/**
 * The clearing. The discs and the computer are drawn by the forest; this is everything laid over them (moved into
 * place every frame): buttons on the discs, and the project's page on the monitor's glass (`ScreenPage`). Once a
 * disc has booted the monitor, the forest dives into the glass until that page fills the window.
 */
export default function Work() {
  const state = useSyncExternalStore(subscribe, get, get);
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
            onClick={() => forest.set({ selected: state.selected === i ? null : i })}
          ></button>
        ))}
      </div>

      {/* the monitor's glass: the project's page, scaled onto it (the forest dives into it to read it) */}
      <div ref={glass} id="pin-screen" className="pin pin-screen" data-show="false">
        <ScreenPage />
      </div>
    </section>
  );
}
