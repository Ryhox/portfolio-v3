'use client';

import type { ReactNode } from 'react';

/**
 * The page's own doodle look, for pill mode's menus: a sheet of the same pale paper as the page above the wood,
 * outlined in pen (four strokes that overshoot at the corners, the way you'd draw a box), a cross-hatched shadow
 * under it, and a strip of gingham tape holding it on. Dark ink on paper, so it all reads over the wood.
 */
export function Paper({ className = '', children, tape = true }: { className?: string; children: ReactNode; tape?: boolean }) {
  return (
    <div className={`paper-wrap ${className}`}>
      <div className="paper-hatch" aria-hidden="true" />
      <div className="paper">{children}</div>
      <svg className="paper-line" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <path vectorEffect="non-scaling-stroke" d="M0.6 1.6C25 0.9 60 2.4 99.3 1.1M98.6 0.2C99.4 30 98.5 66 99.1 99.4M99.7 98.6C70 99.3 32 98.1 0.4 98.9M1.4 99.7C0.6 70 1.5 32 0.9 0.3" />
      </svg>
      {tape && <span className="paper-tape" aria-hidden="true" />}
    </div>
  );
}

/** A pen squiggle under a title, in the season's colour. */
export function Squiggle({ className = '' }: { className?: string }) {
  return (
    <svg className={`squiggle ${className}`} viewBox="0 0 120 10" preserveAspectRatio="none" aria-hidden="true">
      <path d="M2 6c10-5 18 4 28 0s18 4 28 0 18 4 28 0 18 4 32-1" />
    </svg>
  );
}

/** A loop drawn round whatever is picked (a tab, a colour). */
export function Loop() {
  return (
    <svg className="doodle-loop" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true">
      <path vectorEffect="non-scaling-stroke" d="M58 4C30 1 4 8 3 21s28 17 52 16 43-5 42-17S70 2 40 5" />
    </svg>
  );
}

/** A tick, scribbled in a box: the settings' switches. */
export function Tick({ on }: { on: boolean }) {
  return (
    <svg className="doodle-tick" viewBox="0 0 24 24" aria-hidden="true">
      <path className="box" d="M3 3.5c6-.6 12-.4 18 .2M20.6 3c.5 6 .4 12-.1 18M21 20.6c-6 .5-12 .4-18-.1M3.4 21C2.9 15 3 9 3.5 3" />
      {on && <path className="mark" d="M6 12.5c2 1.6 3.4 3.4 4.6 5.6C12.6 12 16 7 20.5 3.5" />}
    </svg>
  );
}
