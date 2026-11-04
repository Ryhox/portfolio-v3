'use client';

import { useEffect, useRef, useSyncExternalStore } from 'react';
import { forest } from '@/scene/store';
import { scrollToEl } from '@/site/scroll';
import { sfx } from '@/sound/sfx';
import { lockPointer } from '../Pill';

const PAGES = [
  { label: 'About', target: '#hello' },
  { label: 'Tech stack', target: '#crew' },
  { label: 'Projects', target: '[data-stage="work"]' },
];

/**
 * The bar along the top, drawn like a doodle in the margin: the name with a sprig on it, the pages, and the sound
 * switch (a little hand-drawn speaker). It slips away as you scroll down and comes back as soon as you scroll up;
 * in the game it isn't there at all.
 */
export default function Nav() {
  const bar = useRef<HTMLElement>(null);
  const muted = useSyncExternalStore(
    (f) => sfx.subscribe(f),
    () => sfx.muted,
    () => false,
  );

  useEffect(() => {
    const el = bar.current;
    if (!el) return;
    let last = window.scrollY;
    let hidden = false;
    let raf = 0;
    const frame = () => {
      raf = requestAnimationFrame(frame);
      const y = window.scrollY;
      const dy = y - last;
      if (Math.abs(dy) < 3) return;
      last = y;
      const hide = dy > 0 && y > 80;
      if (hide !== hidden) {
        hidden = hide;
        el.dataset.hidden = hide ? 'true' : 'false';
      }
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <nav ref={bar} className="nav" aria-label="Main" data-hidden="false">
      <a
        className="nav-logo"
        href="#top"
        onClick={(e) => {
          e.preventDefault();
          scrollToEl(document.body);
        }}
      >
        <span>ryhox</span>
        <svg viewBox="0 0 30 26" aria-hidden="true">
          <path d="M4 24c3-6 6-11 10-14M14 10c-1-3 0-6 3-7 1 3-1 6-3 7zM9 17c-4-1-6-3-6-6 3 0 6 3 6 6zM14 10c3-2 7-2 10 0-3 3-7 3-10 0z" />
          <circle cx="24.5" cy="7.5" r="2.4" />
          <circle cx="17.6" cy="3.6" r="1.3" />
        </svg>
      </a>
      <ul className="nav-pages">
        {PAGES.map((p) => (
          <li key={p.label}>
            <a
              href={p.target.startsWith('#') ? p.target : '#work'}
              onClick={(e) => {
                e.preventDefault();
                sfx.play('tick');
                scrollToEl(document.querySelector<HTMLElement>(p.target));
              }}
            >
              {p.label}
              {/* a squiggle the pen draws under it as you point at it */}
              <svg viewBox="0 0 60 8" preserveAspectRatio="none" aria-hidden="true">
                <path pathLength={1} d="M1 5c6-4 10 3 16-1s10 3 16-1 10 3 16-1 8 2 10 0" />
              </svg>
            </a>
          </li>
        ))}
        <li>
          <a
            href="#pill"
            className="nav-pill"
            onClick={(e) => {
              e.preventDefault();
              // straight into the wood (once it's there): the click is what lets the mouse be taken
              if (document.documentElement.dataset.forest !== 'ready') return;
              sfx.play('tick');
              forest.set({ playing: true, paused: false });
              lockPointer();
            }}
          >
            <span className="nav-long">Take the pill</span>
            <span className="nav-short">The pill</span>
            <svg viewBox="0 0 60 8" preserveAspectRatio="none" aria-hidden="true">
              <path pathLength={1} d="M1 5c6-4 10 3 16-1s10 3 16-1 10 3 16-1 8 2 10 0" />
            </svg>
          </a>
        </li>
      </ul>
      <button
        type="button"
        className="nav-sound"
        aria-pressed={!muted}
        aria-label={muted ? 'Turn the sound on' : 'Turn the sound off'}
        onClick={() => {
          sfx.unlock();
          sfx.setMuted(!muted);
          if (muted) setTimeout(() => sfx.play('chime'), 60);
        }}
      >
        <svg viewBox="0 0 34 28" aria-hidden="true">
          <path d="M4 11.5c-.4 1.6-.3 3.6.1 5.2 2.2.4 4 .3 5.8.1l7.4 6.4c.9-6 .8-13.4-.2-19.6l-7.2 6.6c-1.9-.2-3.9-.1-5.9 1.3z" />
          {muted ? (
            <path d="M22 9.5l8 9M30.2 9.2l-8.4 9.6" />
          ) : (
            <>
              <path className="wave" d="M21.5 10.2c1.6 1.9 1.7 5.3.1 7.4" />
              <path className="wave far" d="M25 6.8c3.4 3.6 3.6 10.4.2 14.2" />
            </>
          )}
        </svg>
      </button>
    </nav>
  );
}
