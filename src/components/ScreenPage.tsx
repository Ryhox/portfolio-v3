'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { fxOf, projects } from '@/content/projects';
import { forest } from '@/scene/store';
import { sfx } from '@/sound/sfx';
import Chevron from './site/Chevron';
import FilmFx from './site/FilmFx';
import { FlourishPaths } from './site/Flourish';
import { FilmSources } from './site/ProjectBits';

const SCROLL_KEYS = new Set(['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' ']);
/** How long the forest takes to lean back out of the screen (`leanIn` in the engine), before the disc comes out. */
const LEAN_OUT_MS = 820;

/**
 * The page on the monitor's glass, for the picked project: its title along the top, its video on the left and what it
 * is on the right, prev/next and its links along the bottom, Leave in the corner. It's laid out at the window's size and
 * scaled onto the glass (the forest sets `--k`), so diving into the screen grows it until it is the window: everything
 * is on the screen. Usable only once you're inside; a flip changes the channel: the whole screen fizzes with static and
 * clears to the next project.
 */
export default function ScreenPage() {
  const st = useSyncExternalStore(forest.subscribe, forest.get, forest.server);
  const page = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const leaving = useRef(false);
  const last = useRef(0);
  // each flip changes the channel: the whole screen goes to static and clears to the next project
  const [flips, setFlips] = useState(0);
  if (st.selected !== null) last.current = st.selected;
  const p = projects[st.selected ?? st.loaded ?? last.current];
  const inside = st.full && !st.playing;
  const lit = (st.loaded !== null && !st.playing) || inside;
  // the film is fetched only once a disc is picked (until then the monitor shows static): nothing to download on
  // the page's first visit. Its sources appearing is what makes the video start loading.
  const fetching = useRef(false);
  if (st.selected !== null || st.loaded !== null) fetching.current = true;

  // the film only runs while the screen shows it
  useEffect(() => {
    const v = video.current;
    if (!v) return;
    if (lit) v.play().catch(() => {});
    else v.pause();
  }, [lit, p.slug]);

  const leave = useCallback(() => {
    if (leaving.current || !forest.get().full) return;
    leaving.current = true;
    sfx.play('tick');
    // the forest leans back out of the screen, then the disc comes back out of the drive
    forest.set({ full: false });
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.setTimeout(() => {
      leaving.current = false;
      if (!forest.get().full) forest.set({ selected: null });
    }, reduced ? 0 : LEAN_OUT_MS);
  }, []);

  const flip = useCallback((by: number) => {
    const s = forest.get().selected;
    if (s === null || leaving.current) return;
    sfx.play('tick');
    setFlips((n) => n + 1);
    forest.set({ selected: (s + by + projects.length) % projects.length });
  }, []);

  // inside the screen: the keys flip and leave, and nothing scrolls the page behind
  useEffect(() => {
    if (!inside) return;
    page.current?.focus({ preventScroll: true });
    const stop = (e: Event) => e.preventDefault();
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') leave();
      else if (e.key === 'ArrowLeft') flip(-1);
      else if (e.key === 'ArrowRight') flip(1);
      else if (!SCROLL_KEYS.has(e.key) || (e.key === ' ' && (e.target as HTMLElement).closest?.('button, a'))) return;
      e.preventDefault();
    };
    window.addEventListener('wheel', stop, { passive: false });
    window.addEventListener('touchmove', stop, { passive: false });
    window.addEventListener('keydown', key);
    return () => {
      window.removeEventListener('wheel', stop);
      window.removeEventListener('touchmove', stop);
      window.removeEventListener('keydown', key);
    };
  }, [inside, flip, leave]);

  return (
    <div ref={page} className="screen-page" tabIndex={-1} inert={!inside} aria-hidden={!inside} role="region" aria-label={p.title}>
      <header className="sp-top">
        <div className="sp-head" key={p.slug}>
          <h2 className="sp-title">{p.title}</h2>
          <svg className="sp-flourish" viewBox="0 4 360 34" aria-hidden="true">
            <FlourishPaths />
          </svg>
        </div>
        <button type="button" className="pixel-btn sp-leave" onClick={leave}>
          Leave
        </button>
      </header>

      <div className="sp-mid">
        <div className="sp-media">
          <div className="sp-frame" key={p.slug}>
            <video
              ref={video}
              muted
              loop
              playsInline
              autoPlay
              preload="auto"
              onLoadedMetadata={(e) => {
                const v = e.currentTarget;
                if (v.videoWidth) v.parentElement?.style.setProperty('--ar', (v.videoWidth / v.videoHeight).toFixed(4));
              }}
            >
              {fetching.current && <FilmSources slug={p.slug} av1={p.av1} />}
            </video>
            <FilmFx video={video} slug={p.slug} title={p.title} stack={p.stack} />
          </div>
        </div>
        <div className="sp-text" key={p.slug}>
          <p className="sp-kicker">{p.kicker}</p>
          <p className="sp-desc">{p.description}</p>
          <ul className="sp-tags" aria-label="Made with">
            {p.stack.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
      </div>

      <nav className="sp-nav" aria-label="Projects">
        <button type="button" className="pixel-btn sp-arrow" aria-label="Previous project" onClick={() => flip(-1)}>
          <Chevron />
        </button>
        {p.links.map((l) => (
          <a key={l.href} href={l.href} target="_blank" rel="noreferrer" className="pixel-btn" data-fx={fxOf(l.label)} aria-label={`${p.title}: ${l.label}`}>
            {l.label}
          </a>
        ))}
        <button type="button" className="pixel-btn sp-arrow" aria-label="Next project" onClick={() => flip(1)}>
          <Chevron flip />
        </button>
      </nav>
      {flips > 0 && <span key={flips} className="sp-static" aria-hidden="true" />}
    </div>
  );
}
