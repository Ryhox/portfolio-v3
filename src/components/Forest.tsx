'use client';

import Lenis from 'lenis';
import { useEffect, useRef, useState } from 'react';
import type { createForest as CreateForest } from '@/scene/engine';
import { forest } from '@/scene/store';
import { installSecrets } from '@/site/pill';
import { seasonStore } from '@/site/season';
import { setScroller } from '@/site/scroll';
import { NoWebGL } from '@/site/webgl';
import { sfx } from '@/sound/sfx';

/** The fixed canvas behind the page, and the smooth scroll that walks you through it. */
export default function Forest() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const lenis = reduced ? null : new Lenis({ autoRaf: true, lerp: 0.09, wheelMultiplier: 0.9 });
    setScroller(lenis);
    // fingers on the glass, and when the last one left: a touch scroll and its fling are the browser's own
    let fingers = 0;
    let lifted = -Infinity;
    const onFinger = (e: TouchEvent) => {
      fingers = e.touches.length;
      if (!fingers) lifted = performance.now();
    };
    for (const t of ['touchstart', 'touchend', 'touchcancel'] as const) window.addEventListener(t, onFinger, { passive: true });
    // the clearing catches a wheel flick: the dying rest of it is swallowed (a trackpad keeps sending it for a
    // while), but only briefly, and a fresh push goes on at once. A finger's swipe or fling is caught the same way:
    // held while that finger stays down, and a fresh touch goes on at once
    let release: (() => void) | null = null;
    const hold = (to: number) => {
      if (!lenis || release) return false;
      const touch = lenis.isScrolling === 'native' && (fingers > 0 || performance.now() - lifted < 4000);
      if (lenis.isScrolling !== 'smooth' && !touch) return false;
      const root = document.documentElement;
      // a fling only ends if the page can't scroll for a moment
      if (touch) root.dataset.caught = '';
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
      // the finger that was caught has left the glass, so the next touch is a new one
      let gone = false;
      const press = () => gone && release?.();
      let frame = 0;
      const check = () => {
        const now = performance.now();
        if (!fingers) gone = true;
        const held = touch ? !gone || now - since < 400 : now - since < 650 && (now - since < 180 || now - last < 90);
        if (held) frame = requestAnimationFrame(check);
        else release?.();
      };
      release = () => {
        cancelAnimationFrame(frame);
        window.removeEventListener('wheel', note);
        window.removeEventListener('touchstart', press);
        delete root.dataset.caught;
        release = null;
        lenis.start();
      };
      window.addEventListener('wheel', note, { passive: true });
      window.addEventListener('touchstart', press, { passive: true });
      frame = requestAnimationFrame(check);
      return true;
    };
    let engine: ReturnType<typeof CreateForest> | null = null;
    // the engine is its own script (loading it starts the painters in their workers), apart from the page's first
    // one: the name on the landing doesn't wait for the whole wood's code
    let createForest: typeof CreateForest | null = null;
    let loading = false;
    let gone = false;
    // the wood is painted in the visit's season; picking another on the page paints it again
    const start = () => {
      if (!createForest) return go();
      engine?.dispose();
      engine = null;
      delete document.documentElement.dataset.forest;
      setReady(false);
      try {
        engine = createForest({
          canvas: c,
          scroll: () => (lenis ? lenis.animatedScroll : window.scrollY),
          hold,
          season: seasonStore.get(),
          onReady: () => {
            setReady(true);
            document.documentElement.dataset.forest = 'ready';
          },
        });
      } catch (e) {
        // no WebGL: the page still reads fine on the plain background, and the loading screen steps aside
        if (!(e instanceof NoWebGL)) console.warn(e);
        document.documentElement.dataset.forest = 'failed';
      }
    };
    // the wood is several screens down (past the name, the About and the crew): its code is fetched, its painters set
    // to work and the engine set up as soon as you do anything at all (scroll, move the mouse, touch, type); at once
    // if the page opens already in or near it. The page's first moments are the name's.
    // (`forest-wake`: `pill.enter()` typed in the console, which reaches the page as no event of its own)
    const WAKE = ['scroll', 'wheel', 'pointermove', 'pointerdown', 'keydown', 'touchstart', 'forest-wake'] as const;
    const go = () => {
      WAKE.forEach((e) => window.removeEventListener(e, go));
      if (loading) return;
      loading = true;
      import('@/scene/engine').then((m) => {
        if (gone) return;
        createForest = m.createForest;
        start();
      });
    };
    if (window.scrollY > window.innerHeight * 0.5) go();
    else WAKE.forEach((e) => window.addEventListener(e, go, { passive: true }));
    const unseason = seasonStore.subscribe(start);
    if (process.env.NODE_ENV !== 'production') Object.assign(window, { __lenis: lenis });
    // pill mode is a secret: only `pill.enter()` in the console gets you in (DevTools lists the secrets)
    installSecrets();
    // pill mode: the page steps aside, the scroll stops where it is, and the tab shows the pill
    // (inside the monitor's screen, the scroll holds still too)
    let wasPlaying = false;
    let wasStill = false;
    const unplay = forest.subscribe(() => {
      const { playing, paused, full } = forest.get();
      const root = document.documentElement;
      if (playing && paused) root.dataset.paused = '';
      else delete root.dataset.paused;
      if (full && !playing) root.dataset.full = '';
      else delete root.dataset.full;
      const still = playing || full;
      if (still !== wasStill) {
        wasStill = still;
        if (still) lenis?.stop();
        else lenis?.start();
      }
      if (playing === wasPlaying) return;
      wasPlaying = playing;
      if (playing) root.dataset.play = '';
      else delete root.dataset.play;
      for (const l of document.querySelectorAll<HTMLLinkElement>('link[rel~="icon"]')) {
        l.dataset.walk ??= l.href;
        l.href = playing ? '/icon-pill.svg' : l.dataset.walk;
      }
    });
    const remeasure = () => engine?.measure();
    document.fonts?.ready.then(remeasure);
    window.addEventListener('load', remeasure);
    return () => {
      gone = true;
      WAKE.forEach((e) => window.removeEventListener(e, go));
      window.removeEventListener('load', remeasure);
      for (const t of ['touchstart', 'touchend', 'touchcancel'] as const) window.removeEventListener(t, onFinger);
      release?.();
      unplay();
      unseason();
      setScroller(null);
      engine?.dispose();
      lenis?.destroy();
    };
  }, []);

  return <canvas ref={canvas} className="forest" data-ready={ready} aria-hidden="true" />;
}
