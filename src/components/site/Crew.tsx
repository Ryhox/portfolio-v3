'use client';

import { useEffect, useRef, useState } from 'react';
import { hash2 } from '@/scene/pix';
import { bodySize, drawLooseEye, drawMate, flight, loadBody, specOf, type Body, type Logo, type Pose, type Spec } from '@/site/crew';
import { sfx } from '@/sound/sfx';
import { FlourishPaths } from './Flourish';

type Tool = { name: string; logo: Logo; what: string };
type Trade = { title: string; line: string; crew: Tool[] };
/** The trades, and the tools each is done with: the crew that turns up for it, and what each one does. */
const TRADES: Trade[] = [
  {
    title: '3D & motion',
    line: 'Real-time 3D in a browser tab, and pages that move like they mean it.',
    crew: [
      { name: 'Three.js', logo: 'three', what: 'The 3D engine of the web: scenes, lights and cameras, drawn with WebGL.' },
      { name: 'GSAP', logo: 'gsap', what: 'Animation timelines and scroll choreography, to the frame.' },
      { name: 'Lenis', logo: 'lenis', what: 'Smooth scrolling, so a page glides instead of jumping.' },
    ],
  },
  {
    title: 'Everyday apps',
    line: 'Apps people open every day, on the web and on phones.',
    crew: [
      { name: 'JavaScript', logo: 'js', what: 'The language of the web, running in every browser there is.' },
      { name: 'TypeScript', logo: 'ts', what: 'JavaScript with types, so mistakes show up before anyone else sees them.' },
      { name: 'React', logo: 'react', what: 'Builds interfaces out of small components that update themselves.' },
      { name: 'Next.js', logo: 'next', what: 'The React framework this site runs on: routing, rendering, speed.' },
      { name: 'Flutter', logo: 'flutter', what: 'One codebase for real apps on iPhone, Android and the web.' },
    ],
  },
  {
    title: 'Servers & data',
    line: 'The servers and the databases behind the apps.',
    crew: [
      { name: 'Node.js', logo: 'node', what: 'JavaScript on the server: APIs, bots and the tools behind the apps.' },
      { name: 'PostgreSQL', logo: 'postgres', what: 'A rock-solid database for data that has to be right.' },
      { name: 'MySQL', logo: 'mysql', what: 'The classic open-source SQL database, quick and everywhere.' },
    ],
  },
  {
    title: 'Mods & hardware',
    line: 'Minecraft mods, and code for things that don’t live in a browser.',
    crew: [
      { name: 'Java', logo: 'java', what: 'What Minecraft is made of, and the mods I write for it.' },
      { name: 'C#', logo: 'csharp', what: 'Microsoft’s language, for Unity games and Windows tools.' },
      { name: 'Arduino', logo: 'arduino', what: 'Little boards that let code switch, sense and move real things.' },
    ],
  },
];

type Mate = {
  name: string;
  logo: Logo;
  spec: Spec;
  body: Body | null;
  x: number;
  y: number;
  vx: number;
  vy: number;
  dir: number;
  state: 'drop' | 'walk' | 'idle' | 'held' | 'fly' | 'air';
  t: number;
  phase: number;
  walk: number;
  squash: number;
  squashV: number;
  rot: number;
  rotV: number;
  fly: { t: number; x0: number; y0: number } | null;
  dizzy: number;
  blink: number;
  el: HTMLButtonElement | null;
  look: [number, number];
  heldV: [number, number];
  /** Which line of ground it stands on (a narrow screen has two). */
  row: number;
  hover: boolean;
  told: number;
};
/**
 * A flying piece. `sheet` holds the pieces of one burst logo, each cut out once in its own cell (`src`, in the sheet's
 * pixels), drawn at `dst` round the piece's own middle: no clipping while it flies.
 */
type Shard = { sheet: HTMLCanvasElement | null; src: [number, number, number, number]; dst: [number, number, number, number]; x: number; y: number; vx: number; vy: number; rot: number; spin: number; age: number; life: number; eye?: number };

const GRAV = 2600;
/**
 * The underline: a flourish in the middle (vines curling away from a knot of dots, a leaf on each), and from it two
 * ribbons of pen line unfurling to the edges of the page, each curling over twice and putting out a leaf or two on
 * the way, quieter the further it goes. Drawn out from the middle by the pen; laid out in real pixels so the curls
 * stay round at any width.
 */
function RibbonRule() {
  const ref = useRef<SVGSVGElement>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(Math.round(el.clientWidth)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const H = 46;
  const cx = w / 2;
  // the flourish is 360 wide; on a narrow page it shrinks to fit with room for the ribbons
  const k = Math.min(1, (w * 0.62) / 360);
  const ox = cx - 180 * k;
  const oy = 4;
  /** A ribbon from (x0, y0) out to the page's edge in direction dir: a gentle wave, curling over itself twice. */
  const ribbon = (x0: number, y0: number, dir: number) => {
    const length = dir < 0 ? x0 + 2 : w - x0 + 2;
    const curls = [
      { at: 0.24, r: 7.5 * Math.max(0.75, k) },
      { at: 0.58, r: 5.5 * Math.max(0.75, k) },
    ].map((c) => {
      const a = c.r / 1.7;
      return { ...c, a, s0: c.at * length, s1: c.at * length + a * Math.PI * 2 };
    });
    const calm = (s: number) => Math.min(1, ...curls.map((c) => (s < c.s0 ? (c.s0 - s) / 26 : s > c.s1 ? (s - c.s1) / 26 : 0)));
    const wave = (s: number) => Math.sin(s / 34 + 0.6) * 3.2 * (1 - s / length) * Math.max(0, calm(s));
    let d = '';
    for (let s = 0; s <= length; s += 1.6) {
      let x = x0 + dir * s;
      let y = y0 + wave(s);
      const c = curls.find((q) => s >= q.s0 && s <= q.s1);
      if (c) {
        const phi = (s - c.s0) / c.a;
        x = x0 + dir * (c.s0 + c.a * phi + c.r * Math.sin(phi));
        y = y0 - 1.05 * c.r * (1 - Math.cos(phi));
      }
      d += `${d ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
    }
    // and a leaf or two along it, tipped up off the line
    const leaves = [0.4, 0.8].map((f) => {
      const lx = x0 + dir * f * length;
      const ly = y0 + wave(f * length);
      const s = (1.3 - f * 0.45) * Math.max(0.75, k);
      return `M${lx.toFixed(1)} ${ly.toFixed(1)}c${(dir * 3 * s).toFixed(1)} ${(-6 * s).toFixed(1)} ${(dir * 9 * s).toFixed(1)} ${(-8 * s).toFixed(1)} ${(dir * 13 * s).toFixed(1)} ${(-5 * s).toFixed(1)}${(-dir * 3 * s).toFixed(1)} ${(4 * s).toFixed(1)} ${(-dir * 9 * s).toFixed(1)} ${(6 * s).toFixed(1)} ${(-dir * 13 * s).toFixed(1)} ${(5 * s).toFixed(1)}z`;
    });
    return { d, leaves };
  };
  const left = w ? ribbon(ox + 6 * k, oy + 15 * k, -1) : null;
  const right = w ? ribbon(ox + 354 * k, oy + 15 * k, 1) : null;
  return (
    <svg ref={ref} className="crew-rule" viewBox={`0 0 ${Math.max(1, w)} ${H}`} aria-hidden="true">
      {w > 0 && (
        <>
          <g className="rule-heart" transform={`translate(${ox.toFixed(1)} ${oy}) scale(${k.toFixed(3)})`}>
            <FlourishPaths />
          </g>
          <g className="rule-ribbons">
            <path pathLength={1} d={left!.d} />
            <path pathLength={1} d={right!.d} />
            {[...left!.leaves, ...right!.leaves].map((l, i) => (
              <path key={i} pathLength={1} d={l} />
            ))}
          </g>
        </>
      )}
    </svg>
  );
}
/** The size of a body, for this stage. */
const baseSize = (W: number, H: number) => Math.max(70, Math.min(150, W * 0.105, H * 0.165));

const INK = '#2b1d24';
/**
 * The meadow along the foot of the page, drawn in ink like a book's vignette: a ground line that wavers and breaks,
 * a little hatching under it, tufts of grass, a few pebbles and small flowers on stems. The same for everyone.
 */
function paintMeadow(W: number, H: number, grounds: number[], B: number, dpr: number) {
  const c = document.createElement('canvas');
  c.width = Math.round(W * dpr);
  c.height = Math.round(H * dpr);
  c.dataset.key = `${W}x${H}x${dpr}`;
  const g = c.getContext('2d')!;
  g.scale(dpr, dpr);
  for (const ground of grounds) meadowLine(g, W, ground, B);
  g.globalAlpha = 1;
  return c;
}

function meadowLine(g: CanvasRenderingContext2D, W: number, ground: number, B: number) {
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.strokeStyle = INK;
  g.fillStyle = INK;
  const y = (x: number) => ground + 2 + Math.sin(x * 0.011) * 2.2 + Math.sin(x * 0.047 + 1) * 1.1;
  // the ground line, in short strokes of the pen, now and then lifted
  for (let x = -10; x < W + 10; ) {
    const len = 40 + hash2(x, 1, 51) * 120;
    const gap = hash2(x, 2, 51) < 0.25 ? 4 + hash2(x, 3, 51) * 10 : 0;
    g.lineWidth = 1.1 + hash2(x, 4, 51) * 0.9;
    g.globalAlpha = 0.72 + hash2(x, 5, 51) * 0.2;
    g.beginPath();
    for (let u = 0; u <= len; u += 6) g[u ? 'lineTo' : 'moveTo'](x + u, y(x + u));
    g.stroke();
    x += len + gap;
  }
  // hatching under it, the shade of the bank
  g.globalAlpha = 0.28;
  g.lineWidth = 0.8;
  for (let x = 0; x < W; x += 5 + hash2(x, 6, 51) * 6) {
    if (hash2(Math.floor(x / 70), 7, 51) < 0.35) continue;
    const top = y(x) + 5;
    g.beginPath();
    g.moveTo(x, top);
    g.lineTo(x - 5, top + 5 + hash2(x, 8, 51) * 5);
    g.stroke();
  }
  // tufts of grass
  g.globalAlpha = 0.78;
  for (let x = 12; x < W; x += 34 + hash2(x, 9, 51) * 70) {
    const n = 3 + Math.floor(hash2(x, 10, 51) * 3);
    g.lineWidth = 1;
    for (let k = 0; k < n; k++) {
      const bx = x + (k - n / 2) * 2.4;
      const h = B * (0.06 + hash2(x, 11 + k, 51) * 0.08);
      const lean = (k - (n - 1) / 2) * 2.2 + (hash2(x, 20 + k, 51) - 0.5) * 3;
      g.beginPath();
      g.moveTo(bx, y(bx));
      g.quadraticCurveTo(bx + lean * 0.3, y(bx) - h * 0.6, bx + lean, y(bx) - h);
      g.stroke();
    }
  }
  // pebbles
  g.globalAlpha = 0.6;
  for (let x = 60; x < W; x += 140 + hash2(x, 30, 51) * 220) {
    const r = 2.5 + hash2(x, 31, 51) * 3;
    g.lineWidth = 0.9;
    g.beginPath();
    g.ellipse(x, y(x) - r * 0.45, r * 1.5, r, 0, Math.PI, 0);
    g.stroke();
  }
  // little flowers on stems: five petals drawn round, a dot in the middle
  for (let x = 90; x < W; x += 160 + hash2(x, 40, 51) * 240) {
    const h = B * (0.16 + hash2(x, 41, 51) * 0.14);
    const fx = x + (hash2(x, 42, 51) - 0.5) * 8;
    const fy = y(x) - h;
    g.globalAlpha = 0.8;
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(x, y(x));
    g.quadraticCurveTo(x + 4, y(x) - h * 0.5, fx, fy);
    g.stroke();
    // a leaf on the stem
    g.beginPath();
    g.ellipse(x + 3.5, y(x) - h * 0.38, 4.5, 1.6, -0.6, 0, Math.PI * 2);
    g.stroke();
    const pr = 3 + hash2(x, 43, 51) * 1.6;
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2 - Math.PI / 2;
      g.beginPath();
      g.ellipse(fx + Math.cos(a) * pr, fy + Math.sin(a) * pr, pr * 0.75, pr * 0.5, a, 0, Math.PI * 2);
      g.stroke();
    }
    g.beginPath();
    g.arc(fx, fy, 1.3, 0, Math.PI * 2);
    g.fill();
  }
  g.globalAlpha = 1;
}

/**
 * What I work with, as a crew: the title of each trade up top, and under it the tools it's done with, each a
 * little character whose body is its logo (pixel eyes, arms and legs), with its name on a tag over its head, wandering about. Click one and it
 * flies, each in its own way; grab one and it dangles and kicks; throw it and it bounces (fast enough and it's
 * dizzy). Scroll and they burst into shards, the next trade's title comes in, and its crew drops in.
 */
export default function Crew() {
  const sec = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const cv = useRef<HTMLCanvasElement>(null);
  const [index, setIndex] = useState(0);
  const idxRef = useRef(0);
  const mates = useRef<Mate[]>([]);
  const burst = useRef<Mate[]>([]);
  const view = useRef({ W: 1, H: 1, B: 100, ground: 1, gap: 0 });
  const pointer = useRef({ x: -1, y: -1, at: -9 });

  // the sheet rises over the evening (SiteFx rounds its corners as it comes); once it has the screen, the title is
  // written out. Then which trade the scroll is on (on a change the crew on stage bursts)
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const s = sec.current;
    if (!s) return;
    let raf = 0;
    let wasOpen = false;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const vh = window.innerHeight;
      // the stay is measured by the stage (lvh, steady), not the window, which grows as a phone's bar slides away
      const stick = s.querySelector<HTMLElement>('.crew-stick')?.offsetHeight || vh;
      const top = s.getBoundingClientRect().top;
      const intro = 0;
      const isOpen = top < vh * 0.18;
      if (isOpen !== wasOpen) {
        wasOpen = isOpen;
        setOpen(isOpen);
      }
      const span = Math.max(1, s.offsetHeight - stick - intro);
      const pp = Math.max(0, Math.min(1, (-top - intro) / span));
      const i = Math.min(TRADES.length - 1, Math.floor(pp * TRADES.length * 0.999));
      if (i !== idxRef.current) {
        idxRef.current = i;
        burst.current.push(...mates.current);
        mates.current = [];
        sfx.play('burst', { gain: 0.45 });
        sfx.play('pop', { gain: 0.35, at: 0.05, rate: 1.3 });
        setIndex(i);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // the crew of the trade in view drops in from above
  useEffect(() => {
    const st = stage.current;
    if (!st) return;
    const W = st.clientWidth || view.current.W;
    const crew = TRADES[index].crew;
    const rows = W < 640 ? 2 : 1;
    const list: Mate[] = crew.map((c, k) => {
      const row = rows === 2 ? k % 2 : 0;
      const j = rows === 2 ? Math.floor(k / 2) : k;
      const inRow = rows === 2 ? (row === 0 ? Math.ceil(crew.length / 2) : Math.floor(crew.length / 2)) : crew.length;
      return {
      name: c.name,
      logo: c.logo,
      spec: specOf(c.logo),
      body: null,
      x: (W * (j + 0.5)) / inRow + (hash2(k, index, 3) - 0.5) * 30,
      row,
      y: -160 - k * 110,
      vx: 0,
      vy: 0,
      dir: hash2(k, index, 4) < 0.5 ? -1 : 1,
      state: 'drop',
      t: 0,
      phase: k * 1.7,
      walk: 0,
      squash: 1,
      squashV: 0,
      rot: 0,
      rotV: 0,
      fly: null,
      dizzy: -9,
      blink: 1 + hash2(k, index, 5) * 3,
      el: null,
      look: [0, 0],
      heldV: [0, 0],
      hover: false,
      told: -9,
      };
    });
    mates.current = list;
    for (const m of list) loadBody(m.logo).then((b) => (m.body = b)).catch(() => {});
    // the next trade's crew, ready before it's needed
    for (const c of TRADES[index + 1]?.crew ?? []) loadBody(c.logo).catch(() => {});
  }, [index]);

  // the loop: walking, idling, dropping in, flying, being carried and thrown, bursting
  useEffect(() => {
    const st = stage.current;
    const c = cv.current;
    if (!st || !c) return;
    const g = c.getContext('2d')!;
    let dpr = 1;
    const size = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      const W = st.clientWidth;
      const H = st.clientHeight;
      const B = baseSize(W, H);
      // a narrow screen has two lines of ground, one higher up the page, so the crew isn't crammed into one
      view.current = { W, H, B, ground: H - Math.max(40, H * 0.085), gap: W < 640 ? Math.min(H * 0.21, B * 2.6) : 0 };
      c.width = Math.round(W * dpr);
      c.height = Math.round(H * dpr);
      c.style.width = `${W}px`;
      c.style.height = `${H}px`;
    };
    size();
    const ro = new ResizeObserver(size);
    ro.observe(st);
    let last = performance.now();
    let raf = 0;
    let visible = false;
    let shards: Shard[] = [];
    let meadow: HTMLCanvasElement | null = null;
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
    io.observe(st);
    const onMove = (e: PointerEvent) => {
      const r = st.getBoundingClientRect();
      pointer.current = { x: e.clientX - r.left, y: e.clientY - r.top, at: performance.now() / 1000 };
    };
    window.addEventListener('pointermove', onMove, { passive: true });

    /** A mate breaks into shards of its logo, its eyes popping out. */
    const shatter = (m: Mate) => {
      const b = m.body;
      const { B } = view.current;
      if (!b) return;
      const { w, h, leg } = bodySize(b, m.spec, B);
      const cx = m.x;
      const cy = m.y - leg - h / 2;
      const n = 5;
      const pt = (i: number, j: number): [number, number] => {
        const edge = i === 0 || j === 0 || i === n || j === n;
        return [(i + (edge ? 0 : (hash2(i, j, 41) - 0.5) * 0.7)) / n, (j + (edge ? 0 : (hash2(i, j, 42) - 0.5) * 0.7)) / n];
      };
      const tris: { tri: [number, number][]; u: number; v: number }[] = [];
      for (let j = 0; j < n; j++)
        for (let i = 0; i < n; i++) {
          const a = pt(i, j);
          const bb = pt(i + 1, j);
          const cc = pt(i + 1, j + 1);
          const d = pt(i, j + 1);
          for (const tri of hash2(i, j, 43) < 0.5 ? [[a, bb, cc], [a, cc, d]] : [[a, bb, d], [bb, cc, d]]) {
            const u = (tri[0][0] + tri[1][0] + tri[2][0]) / 3;
            const v = (tri[0][1] + tri[1][1] + tri[2][1]) / 3;
            if (!b.solid(u, v) && !tri.some(([p, q]) => b.solid(p * 0.8 + u * 0.2, q * 0.8 + v * 0.2))) continue;
            tris.push({ tri, u, v });
          }
        }
      // the logo is cut into its pieces once, each into its own cell of one small sheet (a pixel of room round it),
      // so they fly as plain pictures: clipping the whole logo again for every piece every frame was the cost of a burst
      const boxes = tris.map(({ tri }) => {
        const xs = tri.map(([p]) => p * w);
        const ys = tri.map(([, q]) => q * h);
        return [Math.floor(Math.min(...xs)) - 1, Math.floor(Math.min(...ys)) - 1, Math.ceil(Math.max(...xs)) + 1, Math.ceil(Math.max(...ys)) + 1];
      });
      const cw = Math.max(1, ...boxes.map(([x0, , x1]) => x1 - x0));
      const ch = Math.max(1, ...boxes.map(([, y0, , y1]) => y1 - y0));
      const cols = Math.max(1, Math.ceil(Math.sqrt(boxes.length)));
      const sheet = document.createElement('canvas');
      sheet.width = Math.ceil(cols * cw * dpr);
      sheet.height = Math.ceil(Math.ceil(boxes.length / cols) * ch * dpr);
      const sg = sheet.getContext('2d')!;
      tris.forEach(({ tri, u, v }, k) => {
        const [x0, y0, x1, y1] = boxes[k];
        const ox0 = (k % cols) * cw;
        const oy0 = Math.floor(k / cols) * ch;
        sg.save();
        sg.setTransform(dpr, 0, 0, dpr, (ox0 - x0) * dpr, (oy0 - y0) * dpr);
        sg.beginPath();
        tri.forEach(([p, q], i) => (i ? sg.lineTo(p * w, q * h) : sg.moveTo(p * w, q * h)));
        sg.closePath();
        sg.clip();
        sg.drawImage(b.img, 0, 0, w, h);
        sg.restore();
        const ox = (u - 0.5) * w;
        const oy = (v - 0.5) * h;
        const dd = Math.hypot(ox, oy) || 1;
        const sp = 380 + Math.random() * 620;
        shards.push({
          sheet,
          src: [ox0 * dpr, oy0 * dpr, (x1 - x0) * dpr, (y1 - y0) * dpr],
          dst: [x0 - u * w, y0 - v * h, x1 - x0, y1 - y0],
          x: cx + ox,
          y: cy + oy,
          vx: (ox / dd) * sp + (Math.random() - 0.5) * 200 + m.vx * 0.3,
          vy: (oy / dd) * sp * 0.6 - 520 - Math.random() * 520,
          rot: m.rot,
          spin: (Math.random() - 0.5) * 22,
          age: 0,
          life: 1.2 + Math.random() * 0.7,
        });
      });
      // the eyes, popping out
      for (const [u, v] of m.spec.eyes)
        shards.push({ sheet: null, src: [0, 0, 0, 0], dst: [0, 0, 0, 0], x: cx + (u - 0.5) * w, y: cy + (v - 0.5) * h, vx: (u - 0.5) * 900 + (Math.random() - 0.5) * 200, vy: -900 - Math.random() * 400, rot: 0, spin: (Math.random() - 0.5) * 12, age: 0, life: 1.6, eye: h * m.spec.eye });
    };

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!visible) return;
      const { W, H, B, ground: floor, gap } = view.current;
      const t = now / 1000;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, W, H);
      // the meadow they walk on, in ink
      if (!meadow || meadow.dataset.key !== `${W}x${H}x${dpr}`) meadow = paintMeadow(W, H, gap ? [floor, floor - gap] : [floor], B, dpr);
      g.drawImage(meadow, 0, 0, W, H);

      for (const m of burst.current) shatter(m);
      burst.current = [];
      const list = mates.current;
      const margin = B * 0.6;
      const pt = pointer.current;
      const watching = t - pt.at < 4 && pt.x >= 0;
      for (const m of list) {
        m.t -= dt;
        const body = m.body;
        // its own line of ground
        const ground = floor - m.row * gap;
        // squash and stretch ride a spring back to 1
        m.squashV += (-(m.squash - 1) * 420 - m.squashV * 16) * dt;
        m.squash += m.squashV * dt;
        if (m.state === 'held') {
          // dangling from your hand: it swings like a pendulum as you move it
          m.rotV += (-m.rot * 38 - m.rotV * 5.5 - m.heldV[0] * 0.012) * dt;
          m.rot += m.rotV * dt;
          m.phase += dt * 10;
        } else if (m.state === 'fly' && m.fly) {
          m.fly.t += dt;
          const f = flight(m.spec.fly, m.fly.t, m.dir, H);
          m.x = Math.max(margin, Math.min(W - margin, m.fly.x0 + f.dx));
          m.y = m.fly.y0 - f.up;
          m.rot = f.rot;
          if (f.done) {
            m.state = 'idle';
            m.fly = null;
            m.y = ground;
            m.rot = 0;
            m.t = 0.6 + Math.random();
            m.squash = 0.78;
            sfx.play('land', { gain: 0.3, rate: 1.2 });
          }
        } else if (m.state === 'drop' || m.state === 'air' || m.y < ground - 0.5) {
          // in the air (dropping in, or thrown): it flies, bounces off the sides and the top, bounces on landing
          m.vy += GRAV * dt;
          m.y += m.vy * dt;
          m.x += m.vx * dt;
          m.rot += m.rotV * dt;
          m.rotV *= Math.exp(-dt * 1.5);
          if (m.x < margin || m.x > W - margin) {
            m.x = Math.max(margin, Math.min(W - margin, m.x));
            m.vx = -m.vx * 0.6;
            m.rotV = -m.rotV * 0.7;
            sfx.play('thud', { gain: 0.2, rate: 1.6 });
          }
          if (m.y < B * 1.6 && m.vy < 0 && m.state !== 'drop') {
            m.y = B * 1.6;
            m.vy = Math.abs(m.vy) * 0.4;
          }
          if (m.y >= ground) {
            m.y = ground;
            m.squash = Math.max(0.68, 1 - Math.min(0.32, m.vy / 4000));
            if (m.vy > 700 && m.state === 'air') {
              m.vy = -m.vy * 0.4;
              m.rotV *= 0.6;
              sfx.play('land', { gain: 0.3, rate: 1.2 });
            } else {
              if (m.vy > 200) sfx.play('land', { gain: 0.25, rate: 1.4 });
              m.vy = 0;
              m.state = 'idle';
              m.t = 0.4 + Math.random() * 0.8;
            }
            m.vx *= 0.55;
          }
        } else {
          // on the ground: the turn settles, a throw slides to a stop, and otherwise it potters about
          m.rotV += (-m.rot * 90 - m.rotV * 12) * dt;
          m.rot += m.rotV * dt;
          if (Math.abs(m.vx) > 4) {
            m.x += m.vx * dt;
            m.vx *= Math.exp(-dt * 6);
          } else {
            m.vx = 0;
            if (m.t <= 0) {
              if (m.state === 'idle' && t > m.dizzy) {
                m.state = 'walk';
                m.t = 1 + Math.random() * 2.5;
                if (Math.random() < 0.5) m.dir = -m.dir;
              } else {
                m.state = 'idle';
                m.t = 0.8 + Math.random() * 2;
                // now and then a little hop of joy, for no reason
                if (Math.random() < 0.15) {
                  m.vy = -520;
                  m.y -= 1;
                }
              }
            }
            if (m.state === 'walk') {
              m.x += m.dir * B * 0.42 * dt;
              m.phase += dt * 9;
              if (m.x < margin + B * 0.2) m.dir = 1;
              if (m.x > W - margin - B * 0.2) m.dir = -1;
              // they turn back rather than walk into each other
              for (const o of list) if (o !== m && o.state !== 'held' && o.state !== 'fly' && Math.abs(o.x - m.x) < B * 1.6 && Math.abs(o.y - m.y) < 20 && Math.sign(o.x - m.x) === m.dir) m.dir = -m.dir;
            }
          }
          // and never stand inside one another: a gentle shove apart
          for (const o of list) {
            if (o === m || o.state === 'held' || o.state === 'fly' || Math.abs(o.y - m.y) > 20) continue;
            const d = m.x - o.x;
            const near = B * 1.45;
            if (Math.abs(d) < near) m.x += Math.sign(d || 1) * Math.min(B * 0.8 * dt, near - Math.abs(d));
          }
          m.x = Math.max(margin, Math.min(W - margin, m.x));
        }
        m.walk += ((m.state === 'walk' ? 1 : 0) - m.walk) * Math.min(1, dt * 8);

        // where it looks: at you if you're about, else the way it's going
        const { h, leg } = body ? bodySize(body, m.spec, B) : { h: B, leg: 0 };
        const headY = m.y - leg - h * 0.6;
        const target: [number, number] = watching ? [(pt.x - m.x) / (B * 2.2), (pt.y - headY) / (B * 2.2)] : [m.dir * 0.5 * m.walk, 0.1];
        m.look[0] += (target[0] - m.look[0]) * Math.min(1, dt * 9);
        m.look[1] += (target[1] - m.look[1]) * Math.min(1, dt * 9);
        m.blink -= dt;
        if (m.blink < -0.12) m.blink = 2 + Math.random() * 3.5;

        if (body) {
          const pose: Pose = { x: m.x, y: m.y, rot: m.rot, squash: m.squash, dir: m.dir, phase: m.phase, walk: m.walk, air: 0, arms: 'hang', legs: 'stand', eyes: m.blink < 0 ? 'shut' : 'open', look: m.look, t };
          if (m.hover && m.state !== 'walk') pose.arms = 'wave';
          if (m.state === 'walk') {
            pose.arms = m.hover ? 'wave' : 'walk';
            pose.legs = 'walk';
          }
          if (m.state === 'fly' && m.fly) {
            const f = flight(m.spec.fly, m.fly.t, m.dir, H);
            pose.arms = f.arms;
            pose.legs = f.legs;
            pose.eyes = f.eyes;
            pose.squash *= f.squash;
            pose.air = f.up > 4 ? 1 : 0;
          } else if (m.state === 'held') {
            pose.air = 1;
            const dv = m.spec.dangle;
            const speed = Math.hypot(m.heldV[0], m.heldV[1]);
            pose.squash *= 1 + Math.min(0.14, speed * 0.00012);
            if (dv === 'kick') Object.assign(pose, { arms: 'up', legs: 'kick', eyes: 'wide' });
            else if (dv === 'swing') Object.assign(pose, { arms: 'out', legs: 'dangle', eyes: 'open', look: [m.look[0] * 0.3, 0.8] });
            else if (dv === 'flail') Object.assign(pose, { arms: 'flail', legs: 'kick', eyes: 'wide' });
            else if (dv === 'shiver') Object.assign(pose, { arms: 'hang', legs: 'tuck', eyes: 'wide', x: m.x + Math.sin(t * 70) * B * 0.012 });
            else Object.assign(pose, { arms: 'cheer', legs: 'dangle', eyes: 'happy' });
          } else if (m.state === 'air' || m.state === 'drop' || m.y < ground - 2) {
            pose.air = 1;
            pose.arms = 'up';
            pose.legs = 'dangle';
            if (m.state === 'air') pose.eyes = 'wide';
          }
          if (t < m.dizzy && m.state !== 'held' && m.state !== 'fly') pose.eyes = 'dizzy';
          drawMate(g, body, m.spec, B, pose);
          // the page's own button (name tag and all) rides on it
          if (!m.el) m.el = st.querySelector<HTMLButtonElement>(`[data-mate="${CSS.escape(m.name)}"]`);
          if (m.el) {
            const { w } = bodySize(body, m.spec, B);
            const bw = `${Math.round(w)}px`;
            const bh = `${Math.round(h + leg)}px`;
            if (m.el.style.width !== bw) m.el.style.width = bw;
            if (m.el.style.height !== bh) m.el.style.height = bh;
            m.el.style.transform = `translate(${(m.x - w / 2).toFixed(1)}px, ${(m.y - h - leg).toFixed(1)}px)`;
            // its tag opens to say what it does: on hover, or while it flies after a tap
            const told = m.hover || t - m.told < 2.8 ? 'true' : 'false';
            if (m.el.dataset.told !== told) m.el.dataset.told = told;
          }
        }
      }

      // the shards of the ones that burst: tumbling, bouncing once on the floor, fading
      for (const s of shards) {
        s.age += dt;
        s.vy += GRAV * 0.9 * dt;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.rot += s.spin * dt;
        if (s.y > floor && s.vy > 0) {
          s.y = floor;
          s.vy *= -0.32;
          s.vx *= 0.6;
          s.spin *= 0.5;
        }
        const a = Math.max(0, Math.min(1, (s.life - s.age) / 0.35));
        if (a <= 0) continue;
        g.save();
        g.globalAlpha = a;
        g.translate(s.x, s.y);
        g.rotate(s.rot);
        if (s.eye && !s.sheet) {
          // a pixel eye stays upright and on the grid as it flies
          g.restore();
          g.save();
          g.globalAlpha = a;
          drawLooseEye(g, B, s.x, s.y);
        } else if (s.sheet) {
          g.drawImage(s.sheet, s.src[0], s.src[1], s.src[2], s.src[3], s.dst[0], s.dst[1], s.dst[2], s.dst[3]);
        }
        g.restore();
      }
      shards = shards.filter((s) => s.age < s.life);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      window.removeEventListener('pointermove', onMove);
    };
  }, []);

  const fly = (m: Mate) => {
    if (m.state === 'fly' || m.state === 'held') return;
    m.state = 'fly';
    m.fly = { t: 0, x0: m.x, y0: view.current.ground - m.row * view.current.gap };
    m.vx = m.vy = 0;
    m.dir = m.x < view.current.W / 2 ? 1 : -1;
    // on a touch screen there's no hover: what it does shows while it flies
    m.told = performance.now() / 1000;
    sfx.play(m.spec.fly === 'rocket' ? 'whoosh' : 'boing', { rate: 0.8 + (m.name.length % 5) * 0.1, gain: m.spec.fly === 'rocket' ? 0.35 : 1 });
  };

  /** Grab, carry, throw; or (without moving) a click, which makes it fly. */
  const grab = (name: string) => (e: React.PointerEvent<HTMLButtonElement>) => {
    const m = mates.current.find((x) => x.name === name);
    const st = stage.current;
    if (!m || !st) return;
    e.preventDefault();
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    const r = st.getBoundingClientRect();
    const sx = e.clientX;
    const sy = e.clientY;
    const off = [e.clientX - r.left - m.x, e.clientY - r.top - m.y];
    let moved = false;
    let trail: [number, number, number][] = [];
    const move = (ev: PointerEvent) => {
      if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 6) return;
      if (!moved) {
        moved = true;
        m.state = 'held';
        m.fly = null;
        m.vx = m.vy = 0;
        sfx.play('squeak', { rate: 0.9 + Math.random() * 0.3 });
      }
      const { W, H, B } = view.current;
      const nx = Math.max(B * 0.6, Math.min(W - B * 0.6, ev.clientX - r.left - off[0]));
      const ny = Math.max(B * 1.6, Math.min(view.current.ground - m.row * view.current.gap, ev.clientY - r.top - off[1]));
      const now = performance.now();
      trail.push([nx, ny, now]);
      trail = trail.filter((p) => now - p[2] < 90);
      const a = trail[0];
      const dtt = (now - a[2]) / 1000;
      m.heldV = dtt > 0.01 ? [(nx - a[0]) / dtt, (ny - a[1]) / dtt] : m.heldV;
      m.x = nx;
      m.y = Math.min(ny, H);
    };
    const up = () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      if (!moved) {
        fly(m);
        return;
      }
      // thrown: the way, and as fast as, it was moving as you let go
      const a = trail[0];
      const b = trail[trail.length - 1];
      const dtt = a && b && b[2] > a[2] ? (b[2] - a[2]) / 1000 : 0;
      m.vx = dtt ? Math.max(-2600, Math.min(2600, (b[0] - a[0]) / dtt)) : 0;
      m.vy = dtt ? Math.max(-2600, Math.min(2600, (b[1] - a[1]) / dtt)) : 0;
      m.rotV = m.vx * 0.004 + m.rotV;
      m.heldV = [0, 0];
      m.state = 'air';
      m.t = 0.8;
      const speed = Math.hypot(m.vx, m.vy);
      if (speed > 1300) m.dizzy = performance.now() / 1000 + 2.2;
      if (speed > 700) sfx.play('whoosh', { gain: 0.35, rate: 1.4 });
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  };

  const trade = TRADES[index];
  return (
    <section ref={sec} id="crew" className="site-sec crew" aria-labelledby="crew-title" style={{ '--trades': TRADES.length } as React.CSSProperties}>
      <div className="crew-stick">
        <div ref={stage} className="crew-stage">
          <div className="crew-head" key={trade.title} data-in={open}>
            <h2 id="crew-title" className="sec-title crew-title" aria-label={trade.title}>
              {/* written out by the pen, its outline first, then the ink filling it */}
              <svg className="crew-ink" aria-hidden="true">
                <text x="50%" y="0.92em" textAnchor="middle">
                  {[...trade.title].map((ch, i) => (
                    <tspan key={i} style={{ '--i': i } as React.CSSProperties}>
                      {ch === ' ' ? '\u00a0' : ch}
                    </tspan>
                  ))}
                </text>
              </svg>
            </h2>
            {/* and underlined, edge to edge, with a flourish */}
            <RibbonRule />
            <p className="lead">{trade.line}</p>
          </div>
          {/* where you are: a dot for each trade, the one you're on drawn long */}
          <div className="crew-dots" aria-hidden="true">
            {TRADES.map((t, i) => (
              <i key={t.title} data-on={i === index} />
            ))}
          </div>
          <canvas ref={cv} className="crew-canvas" aria-hidden="true" />
          {trade.crew.map((c) => (
            <button
              key={`${trade.title}-${c.name}`}
              type="button"
              className="crew-mate"
              data-mate={c.name}
              aria-label={`${c.name}: ${c.what} Make it fly.`}
              onPointerEnter={(e) => {
                sfx.play('tick');
                const m = mates.current.find((x) => x.name === c.name);
                if (m && e.pointerType === 'mouse') m.hover = true;
              }}
              onPointerLeave={() => {
                const m = mates.current.find((x) => x.name === c.name);
                if (m) m.hover = false;
              }}
              onFocus={() => {
                const m = mates.current.find((x) => x.name === c.name);
                if (m) m.hover = true;
              }}
              onBlur={() => {
                const m = mates.current.find((x) => x.name === c.name);
                if (m) m.hover = false;
              }}
              onPointerDown={grab(c.name)}
              onKeyDown={(e) => {
                if (e.key !== 'Enter' && e.key !== ' ') return;
                e.preventDefault();
                const m = mates.current.find((x) => x.name === c.name);
                if (m) fly(m);
              }}
            >
              <span className="crew-tag" aria-hidden="true">
                <span className="crew-name">{c.name}</span>
                <span className="crew-what">
                  <span>{c.what}</span>
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
