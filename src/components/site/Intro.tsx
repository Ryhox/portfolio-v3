'use client';

import { useEffect, useRef } from 'react';
import { site } from '@/content/site';
import { burstAt, createHeroWord, type HeroWord } from '@/site/hero3d';
import { progress } from '@/site/scroll';
import { NoWebGL } from '@/site/webgl';
import { sfx } from '@/sound/sfx';

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/**
 * The landing: white, and the name in the middle, written out by the pen as the page opens, then floating in 3D
 * with its posies. Scroll, and it trembles and
 * bursts, a letter at a time from the middle outwards, into sharp shards that tumble away; then the evening floods
 * out of where it was like ink in water and becomes the next part of the page. All of it follows the scroll, so scrolling back puts
 * the name together again.
 */
export default function Intro() {
  const sec = useRef<HTMLElement>(null);
  const stick = useRef<HTMLDivElement>(null);
  const cv = useRef<HTMLCanvasElement>(null);
  const name = useRef<HTMLHeadingElement>(null);
  const open = useRef<HTMLDivElement>(null);
  const hint = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const s = sec.current;
    const c = cv.current;
    const h1 = name.current;
    const panel = open.current;
    if (!s || !c || !h1 || !panel) return;
    let word: HeroWord | null = null;
    let raf = 0;
    let visible = true;
    let popped = -1;
    let lastClip = '';
    let lastHint = '';
    const make = () => {
      try {
        word?.dispose();
        word = createHeroWord(c, h1);
      } catch (e) {
        // no WebGL: the page's own heading shows instead (said in the console only if it was anything else)
        if (!(e instanceof NoWebGL)) console.warn(e);
        word = null;
        h1.dataset.three = 'off';
      }
    };
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (!visible) return;
      const p = progress(s, stick.current?.offsetHeight || window.innerHeight);
      // the evening floods out of the middle like ink, as the name goes
      const flood = easeInOut(clamp01((p - 0.42) / 0.55));
      if (word?.due(p, now, flood)) word.render(p, now, flood);
      // the burst, letter by letter, with a sound for each
      [2, 1, 3, 0, 4].forEach((li, k) => {
        if (p > burstAt(li) && popped < k) {
          popped = k;
          sfx.play('burst', { gain: 0.4, rate: 0.9 + k * 0.08, pan: (li - 2) * 0.35 });
          sfx.play('pop', { gain: 0.3, rate: 1.4 - k * 0.1 });
        }
      });
      if (p < burstAt(2) - 0.02) popped = -1;
      // without WebGL the evening simply opens out of the middle instead
      const k = word ? 0 : flood;
      const clip = k <= 0 ? 'inset(50% 50% 50% 50%)' : `inset(${((1 - k) * 50).toFixed(2)}%)`;
      if (clip !== lastClip) panel.style.clipPath = lastClip = clip;
      // the hint to scroll goes as soon as you do
      const h = hint.current;
      // (compared with what was last set: the style reads back "1" for "1.000", which re-set it every frame)
      const ho = (1 - clamp01(p / 0.04)).toFixed(3);
      if (h && ho !== lastHint) h.style.opacity = lastHint = ho;
    };
    // the fonts first, so the word is cut from the real letters
    let alive = true;
    let soon = 0;
    (document.fonts?.ready ?? Promise.resolve()).then(() => {
      // a task of its own, not the tail of the page's hydration: the page answers in between
      soon = window.setTimeout(() => {
        if (!alive) return;
        make();
        // drawn once it's built (a step at a time, so the page stays free meanwhile)
        const w = word;
        (w ? w.ready : Promise.resolve()).then(() => {
          if (alive && w === word) raf = requestAnimationFrame(frame);
        });
      }, 0);
    });
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
    io.observe(s);
    let resizeT = 0;
    const ro = new ResizeObserver(() => {
      clearTimeout(resizeT);
      resizeT = window.setTimeout(() => word?.build(), 120);
    });
    ro.observe(c);
    return () => {
      alive = false;
      clearTimeout(soon);
      cancelAnimationFrame(raf);
      clearTimeout(resizeT);
      io.disconnect();
      ro.disconnect();
      word?.dispose();
    };
  }, []);

  return (
    <section ref={sec} className="landing" aria-labelledby="intro-name">
      <div ref={stick} className="landing-stick">
        <h1 ref={name} id="intro-name" className="landing-name" aria-label={`${site.name}, ${site.jobTitle.toLowerCase()}`}>
          <span aria-hidden="true">ryhox</span>
        </h1>
        <div ref={open} className="landing-open" aria-hidden="true" />
        <canvas ref={cv} className="landing-canvas" aria-hidden="true" />
        <div ref={hint} className="scroll-hint" aria-hidden="true">
          <svg viewBox="0 0 30 52">
            <path pathLength={1} d="M15 2c-4 6 4 10 0 16s-4 10 0 16c2 3 1 7 0 10" />
            <path pathLength={1} d="M7.5 37.5c3 3.4 5.4 6.4 7.4 8.8 2.2-2.6 4.6-5.6 7.6-8.6" />
          </svg>
          <span>scroll</span>
        </div>
      </div>
    </section>
  );
}
