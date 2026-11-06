'use client';

import { useEffect, useRef } from 'react';
import { paintCurtain, type Tree } from '@/site/curtain';
import { artPx } from '@/site/paint/canvas';
import { paintProjects, QUOTE } from '@/site/projectsPage';
import { useSeason } from '@/site/season';
import { createSketch, type Sketch } from '@/site/sketch';
import { NoWebGL } from '@/site/webgl';
import { sfx } from '@/sound/sfx';

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const easeOut = (t: number) => 1 - (1 - t) ** 3;

/**
 * The way into the work, in one flowing movement: the wood's own pixel trees stand closed across the screen and
 * start to part like a curtain as the page comes up; behind them a page inks itself in, "Projects" in big letters
 * and a line from Emerson under it; and as it settles it burns away from the middle of the screen outwards into the wood
 * behind it, its lines lingering a moment over the colours of the clearing itself, where
 * the walk starts. Nothing but the trees moves. Scroll back up and it all comes back.
 */
export default function Dive() {
  const season = useSeason();
  const sec = useRef<HTMLElement>(null);
  const scene = useRef<HTMLDivElement>(null);
  const cv = useRef<HTMLCanvasElement>(null);
  const flat = useRef<HTMLCanvasElement>(null);
  const curtain = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const s = sec.current;
    if (!s) return;
    // it's all set up only once it's within a couple of screens: nothing of it is seen before, and the page's first
    // moments are the name's
    let stop: (() => void) | null = null;
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting || stop) return;
        io.disconnect();
        stop = setup(s) ?? null;
      },
      { rootMargin: '200% 0px' },
    );
    io.observe(s);
    return () => {
      io.disconnect();
      stop?.();
    };
  }, [season]);

  function setup(s: HTMLElement) {
    const sc = scene.current;
    const c = cv.current;
    const art = flat.current;
    const ct = curtain.current;
    if (!sc || !c || !art || !ct) return;
    let gl: Sketch | null = null;
    try {
      gl = createSketch(c);
      gl.setPaper(getComputedStyle(document.documentElement).getPropertyValue('--paper'));
      s.dataset.gl = 'on';
    } catch (e) {
      // no WebGL: the drawing is shown as it is, and simply dissolves through a soft mask
      if (!(e instanceof NoWebGL)) console.warn(e);
    }
    // the trees, standing where they close the screen off; at a whole number of screen pixels to each art pixel
    const trees: Tree[] = [];
    let lastOpen = -1;
    const place = () => {
      const W = sc.clientWidth || window.innerWidth;
      const H = sc.clientHeight || window.innerHeight;
      const px = artPx();
      const k = Math.max(1, Math.round(H / (262 * px)));
      const u = px * k;
      for (const t of trees) {
        const x = t.side < 0 ? t.at * W : W - t.at * W;
        t.el.style.width = `${t.el.width * u}px`;
        t.el.style.height = `${t.el.height * u}px`;
        t.el.style.left = `${Math.round(x - t.ax * u)}px`;
        t.el.style.top = `${Math.round(H + (t.bush ? 2 : 5) * u - t.ay * u)}px`;
        t.el.style.zIndex = String(t.bush ? 12 : 10 - t.depth);
      }
      lastOpen = -1;
    };
    const stopTrees = paintCurtain(season, (t) => {
      t.el.className = 'dive-tree';
      ct.appendChild(t.el);
      trees.push(t);
      place();
    });
    let size = '';
    const paint = () => {
      const W = sc.clientWidth || window.innerWidth;
      const H = sc.clientHeight || window.innerHeight;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const key = `${W}x${H}x${dpr}`;
      if (key === size) return;
      size = key;
      paintProjects(art, W, H, dpr);
      place();
      if (gl) {
        gl.resize();
        gl.setArt(art);
      }
    };
    (document.fonts?.ready ?? Promise.resolve()).then(() => {
      size = '';
      paint();
    });
    paint();
    const ro = new ResizeObserver(paint);
    ro.observe(sc);
    let raf = 0;
    let rumbled = false;
    let last = '';
    // one timeline for the whole way in, in screens: 0 as the page's top comes up over the foot of the screen,
    // 1 when it reaches the top, on to the end; followed with a soft lag, so it glides rather than steps
    let flow = -1;
    let then = performance.now();
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - then) / 1000);
      then = now;
      const vw = sc.clientWidth || window.innerWidth;
      const vh = sc.clientHeight || window.innerHeight;
      const top = s.getBoundingClientRect().top;
      const end = (s.offsetHeight - vh) / vh + 1;
      const u = Math.max(0, Math.min(end, 1 - top / vh));
      flow = flow < 0 || Math.abs(u - flow) > 1.2 ? u : flow + (u - flow) * (1 - Math.exp(-dt * 7));
      if (top > vh * 1.2 && flow <= 0.001) return;
      const f = flow;
      // the burn opens from the middle of the screen
      const gx = vw / 2;
      const gy = vh / 2;
      // the trees start to part while the page is still coming up, the inner ones first and furthest, the bushes
      // at their feet quickest; the line from Emerson inks itself in behind them as they go, and before it has
      // quite settled the page starts to burn away, so one thing always flows into the next
      const smooth = (x: number) => x * x * (3 - 2 * x);
      if (Math.abs(f - lastOpen) > 0.0004) {
        lastOpen = f;
        const dpr = window.devicePixelRatio || 1;
        let all = 1;
        for (const t of trees) {
          const start = t.bush ? 0.62 : 0.68 + t.depth * 0.05;
          const k = smooth(clamp01((f - start) / 0.62));
          all = Math.min(all, k);
          const reach = t.bush ? 0.74 : 0.52 + (0.16 * (4 - t.depth)) / 4;
          const dx = Math.round(t.side * k * vw * reach * dpr) / dpr;
          t.el.style.transform = `translate3d(${dx}px, 0, 0)`;
        }
        ct.dataset.open = trees.length && all >= 1 ? 'true' : 'false';
      }
      const arrive = clamp01((f - 0.85) / 0.45);
      // (the burn's front only shows past about a seventh of the shader's way, so it starts from there: no dead hold)
      const bx = clamp01((f - 1.2) / Math.max(0.5, end - 0.08 - 1.2));
      const d = bx > 0 ? 0.14 + 0.86 * (bx < 0.5 ? 2 * bx * bx : 1 - (-2 * bx + 2) ** 2 / 2) : 0;
      const far = Math.hypot(Math.max(gx, vw - gx), Math.max(gy, vh - gy));
      const gone = d >= 0.999;
      s.dataset.gone = gone ? 'true' : 'false';
      if (gl && !gone) gl.render({ art: [0, 0, vw, vh], glass: [gx, gy], far, arrive: easeOut(arrive), d, now });
      let mask = 'none';
      if (!gl && d > 0) {
        const feather = Math.min(vw, vh) * 0.42;
        const r1 = d * (far + feather * 1.2);
        mask = `radial-gradient(circle at ${gx.toFixed(1)}px ${gy.toFixed(1)}px, transparent ${(r1 - feather).toFixed(1)}px, #000 ${r1.toFixed(1)}px)`;
      }
      if (!gl) {
        const key = `${mask}|${arrive.toFixed(3)}`;
        if (key !== last) {
          last = key;
          art.style.opacity = easeOut(arrive).toFixed(3);
          sc.style.webkitMaskImage = mask;
          sc.style.maskImage = mask;
        }
      }
      if (f > 1.3 && !rumbled) {
        rumbled = true;
        sfx.play('whoosh', { gain: 0.6 });
      }
      if (f < 1) rumbled = false;
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      stopTrees();
      ct.replaceChildren();
      ro.disconnect();
      gl?.dispose();
      delete s.dataset.gl;
    };
  }

  return (
    <section ref={sec} id="work-intro" className="dive" data-stage="dive" aria-labelledby="dive-title">
      <div className="dive-stick">
        <h2 id="dive-title" className="sr-only">
          Projects
        </h2>
        <figure className="sr-only">
          <blockquote>{QUOTE.text}</blockquote>
          <figcaption>{QUOTE.by}</figcaption>
        </figure>
        <div ref={scene} className="dive-scene">
          <canvas ref={cv} className="dive-canvas" aria-hidden="true" />
          <canvas ref={flat} className="dive-flat" aria-hidden="true" />
        </div>
        <div ref={curtain} className="dive-curtain" aria-hidden="true" />
      </div>
    </section>
  );
}
