'use client';

import Lenis from 'lenis';
import { useEffect, useRef, useState } from 'react';
import { createForest } from '@/scene/engine';

/** The fixed canvas behind the page, and the smooth scroll that walks you through it. */
export default function Forest() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const lenis = reduced ? null : new Lenis({ autoRaf: true, lerp: 0.09, wheelMultiplier: 0.9 });
    // the clearing catches a wheel flick: the dying rest of it is swallowed (a trackpad keeps sending it for a
    // while), but only briefly, and a fresh push goes on at once
    let release: (() => void) | null = null;
    const hold = (to: number) => {
      if (!lenis || lenis.isScrolling !== 'smooth' || release) return false;
      lenis.scrollTo(to, { immediate: true, force: true });
      lenis.stop();
      const since = performance.now();
      let last = since;
      let prev = Infinity;
      const note = (e: WheelEvent) => {
        const now = performance.now();
        const d = Math.abs(e.deltaY);
        // a flick only ever dies down; a delta that grows again is a new push
        if (now - since > 180 && d > prev * 1.25 + 2) release?.();
        prev = d;
        last = now;
      };
      let frame = 0;
      const check = () => {
        const now = performance.now();
        if (now - since < 650 && (now - since < 180 || now - last < 90)) frame = requestAnimationFrame(check);
        else release?.();
      };
      release = () => {
        cancelAnimationFrame(frame);
        window.removeEventListener('wheel', note);
        release = null;
        lenis.start();
      };
      window.addEventListener('wheel', note, { passive: true });
      frame = requestAnimationFrame(check);
      return true;
    };
    let engine: ReturnType<typeof createForest> | null = null;
    try {
      engine = createForest({
        canvas: c,
        scroll: () => (lenis ? lenis.animatedScroll : window.scrollY),
        hold,
        title: () => document.querySelector('.hero h1'),
        onReady: () => {
          setReady(true);
          document.documentElement.dataset.forest = 'ready';
        },
      });
    } catch (e) {
      // no WebGL: the page still reads fine on the plain background, and the loading screen steps aside
      console.warn(e);
      document.documentElement.dataset.forest = 'failed';
    }
    if (process.env.NODE_ENV !== 'production') Object.assign(window, { __lenis: lenis });
    const remeasure = () => engine?.measure();
    document.fonts?.ready.then(remeasure);
    window.addEventListener('load', remeasure);
    return () => {
      window.removeEventListener('load', remeasure);
      release?.();
      engine?.dispose();
      lenis?.destroy();
    };
  }, []);

  return <canvas ref={canvas} className="forest" data-ready={ready} aria-hidden="true" />;
}
