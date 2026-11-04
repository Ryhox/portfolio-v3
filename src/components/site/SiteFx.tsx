'use client';

import { useEffect, useRef, useState } from 'react';
import { sfx } from '@/sound/sfx';
import { artPx } from '@/site/paint/canvas';

/**
 * The page's own little machinery: words that come into focus as you reach them, the sheet the crew rises on, and
 * a thing to type: "meow" sends the black cat across the bottom of the screen. (The sound switch is the navbar's.)
 */
export default function SiteFx() {
  const [walk, setWalk] = useState(0);
  const cat = useRef<HTMLCanvasElement>(null);

  // reveals: things rise softly into place as the scroll reaches them, and sink back as it leaves them (scrubbed,
  // from their top at the foot of the screen to a fifth of the way up; the styles are in site.css). The crew's sheet
  // rises over the evening the same way, its corners easing square as it gets to the top
  useEffect(() => {
    const els = [...document.querySelectorAll<HTMLElement>('[data-reveal]')];
    const crew = document.getElementById('crew');
    const hello = document.getElementById('hello');
    let rise = 1;
    const last = new Map<HTMLElement, string>();
    const set = (el: HTMLElement, name: string, v: number) => {
      const s = v.toFixed(3);
      if (last.get(el) === s) return;
      last.set(el, s);
      el.style.setProperty(name, s);
    };
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf = 0;
    const frame = () => {
      raf = requestAnimationFrame(frame);
      const vh = window.innerHeight;
      for (const el of els) {
        const top = el.getBoundingClientRect().top;
        if (top > vh * 1.5 || top < -vh * 2) continue;
        const k = reduced ? 1 : Math.max(0, Math.min(1, (vh - top) / (vh * 0.2)));
        set(el, '--rv', 1 - (1 - k) ** 3);
      }
      if (crew) {
        // where its top really is (its own lift taken out, or the lift would chase itself)
        const top = crew.getBoundingClientRect().top - rise * 60;
        const k = reduced ? 0 : Math.max(0, Math.min(1, top / vh));
        rise = k;
        set(crew, '--rise', k);
        // the evening it rises over sinks back as it's covered
        if (hello) set(hello, '--sink', 1 - k);
      }
    };
    raf = requestAnimationFrame(frame);
    document.documentElement.dataset.fx = 'on';
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    let typed = '';
    const onKey = (e: KeyboardEvent) => {
      if (document.documentElement.dataset.play !== undefined) return;
      if ((e.target as HTMLElement)?.closest?.('input, textarea')) return;
      typed = (typed + e.key.toLowerCase()).slice(-8);
      if (typed.endsWith('meow')) {
        setWalk((w) => w + 1);
        sfx.play('meow');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const c = cat.current;
    if (!c || !walk) return;
    const g = c.getContext('2d')!;
    // the black cat, side on, two strides
    const rows = [
      ['k.........k.k.', 'k........kkkkk', '.k.......kekek', '.kkkkkkkkkkkk.', '..kkkkkkkkkk..', '..k.k....k.k..', '..k..k..k...k.'],
      ['k.........k.k.', '.k.......kkkkk', '.k.......kekek', '.kkkkkkkkkkkk.', '..kkkkkkkkkk..', '...kk....kk...', '...k.k..k.k...'],
    ];
    c.width = 14;
    c.height = 7;
    const px = artPx();
    c.style.width = `${14 * px}px`;
    c.style.height = `${7 * px}px`;
    let f = 0;
    const id = setInterval(() => {
      g.clearRect(0, 0, 14, 7);
      rows[(f = 1 - f)].forEach((r, y) =>
        [...r].forEach((ch, x) => {
          if (ch === '.') return;
          g.fillStyle = ch === 'e' ? '#e2bd3a' : '#0a0b0a';
          g.fillRect(x, y, 1, 1);
        }),
      );
    }, 160);
    c.dataset.walk = '0';
    void c.offsetWidth;
    c.dataset.walk = '1';
    const stop = setTimeout(() => clearInterval(id), 9000);
    return () => {
      clearInterval(id);
      clearTimeout(stop);
    };
  }, [walk]);

  return (
    <>
      <canvas ref={cat} className="walking-cat" aria-hidden="true" />
    </>
  );
}
