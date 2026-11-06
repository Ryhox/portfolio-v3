'use client';

import { Suspense, use, type ReactNode } from 'react';
import { forest } from '@/scene/store';

/** When a part of the page comes alive: near the screen (`near`, a selector), on taking the pill, or once you do anything. */
type Wake = { near?: string; margin?: string; play?: boolean; touched?: boolean };

const gates = new Map<string, Promise<void>>();
function gate(key: string, w: Wake) {
  let p = gates.get(key);
  if (p) return p;
  p = new Promise<void>((resolve) => {
    const offs: (() => void)[] = [];
    let done = false;
    const go = () => {
      if (done) return;
      done = true;
      offs.forEach((f) => f());
      resolve();
    };
    if (w.near) {
      const el = document.querySelector(w.near);
      // not on the page as it came from the server (a client-side visit): nothing to wait for
      if (!el) return go();
      const io = new IntersectionObserver((es) => es.some((e) => e.isIntersecting) && go(), { rootMargin: `${w.margin ?? '150%'} 0px` });
      io.observe(el);
      offs.push(() => io.disconnect());
    }
    if (w.play) {
      if (forest.get().playing) return go();
      offs.push(forest.subscribe(() => forest.get().playing && go()));
    }
    if (w.touched) {
      const evs = ['scroll', 'wheel', 'pointermove', 'pointerdown', 'keydown', 'touchstart'] as const;
      evs.forEach((e) => window.addEventListener(e, go, { passive: true }));
      offs.push(() => evs.forEach((e) => window.removeEventListener(e, go)));
    }
  });
  gates.set(key, p);
  return p;
}

function Gate({ id, wake, children }: { id: string; wake: Wake; children: ReactNode }) {
  if (typeof window !== 'undefined') use(gate(id, wake));
  return children;
}

/**
 * A part of the page that comes alive only when it's wanted. Its HTML is there from the start, exactly as it looks
 * (the server renders it whole); but React holds off hydrating it, with its effects, canvases and animation loops,
 * until it's near the screen (or the pill is taken, or you first scroll, click or type). While a boundary is held, React
 * leaves the server's DOM untouched and later hydrates those very nodes, so nothing is replaced and nothing moves.
 * It keeps the page's first seconds free for the name on the landing.
 */
export default function Later({ id, children, ...wake }: Wake & { id: string; children: ReactNode }) {
  return (
    <Suspense fallback={null}>
      <Gate id={id} wake={wake}>
        {children}
      </Gate>
    </Suspense>
  );
}
