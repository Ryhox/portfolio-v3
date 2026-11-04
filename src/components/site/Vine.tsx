'use client';

import { useEffect, useRef, useState } from 'react';

type Leaf = { x: number; y: number; a: number; s: number; flip: boolean };
type Flower = { x: number; y: number; s: number };
type Branch = { d: string; y: number; run: number };
/** `reach[i]` is how much of the stem's length lies above y = 4i - 6 (so it can be drawn down to a height). */
type Geo = { w: number; h: number; top: number; stem: string; reach: Float32Array; branches: Branch[]; leaves: Leaf[]; flowers: Flower[] };

/** A small seeded random, so the vine grows the same for everyone. */
function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const f1 = (v: number) => v.toFixed(1);

/** A leaf with its base at 0,0, pointing along +x, `s` times its plain size. */
const leafPath = (s: number) => `M0 0C${f1(3 * s)} ${f1(-4.6 * s)} ${f1(9 * s)} ${f1(-6.2 * s)} ${f1(14 * s)} ${f1(-3 * s)}C${f1(9.5 * s)} ${f1(1.6 * s)} ${f1(4 * s)} ${f1(2.2 * s)} 0 0Z`;

/**
 * Lays the vine out for a box `w` × `h` whose first `top` pixels hang over the end of the landing (all evening): there
 * it sways wide and sends out branches into the empty dusk; below, it keeps to the right edge, clear of the words.
 */
function grow(w: number, h: number, top: number): Geo {
  const rnd = seeded(4127);
  const edge = w - Math.min(64, Math.max(18, w * 0.04));
  const wide = w * 0.64;
  // from wide (over the empty dusk) to the edge (beside the words), over a few hundred pixels
  const mix = (y: number) => Math.min(1, Math.max(0, (y - top * 0.8) / 340));
  const stemX = (y: number) => {
    const m = mix(y);
    const swayWide = wide + Math.sin(y / 170 + 0.6) * w * 0.12 + Math.sin(y / 61) * 8;
    const swayEdge = edge + Math.sin(y / 64 + 1.1) * 11 + Math.sin(y / 23) * 2;
    return swayWide * (1 - m) + swayEdge * m;
  };
  let stem = '';
  const along: number[] = [];
  let len = 0;
  let px = stemX(-6);
  for (let y = -6; y <= h; y += 4) {
    const x = stemX(y);
    len += along.length ? Math.hypot(x - px, 4) : 0;
    along.push(len);
    px = x;
    stem += `${stem ? 'L' : 'M'}${f1(x)} ${f1(y)}`;
  }
  const reach = Float32Array.from(along, (l) => l / Math.max(1, len));

  const leaves: Leaf[] = [];
  const flowers: Flower[] = [];
  // leaves all down the stem, side by side in turn, bigger up in the dusk
  let side = 1;
  for (let y = 22; y < h - 10; y += (y < top ? 40 : 54) + rnd() * 16) {
    const big = y < top ? 1.75 : 1;
    const x = stemX(y);
    const a = side > 0 ? -28 + rnd() * 22 : 208 - rnd() * 22;
    leaves.push({ x, y, a, s: (0.85 + rnd() * 0.45) * big, flip: side < 0 });
    if (rnd() < (y < top ? 0.4 : 0.2)) flowers.push({ x: x + side * (7 + rnd() * 8) * big, y: y + 8, s: (0.9 + rnd() * 0.5) * big });
    side = -side;
  }

  // branches reaching out into the empty dusk at the start, each curling up at its tip with a flower on it
  const branches: Branch[] = [];
  // (where it goes: the share of the dusk down the stem it leaves from, how far it reaches as a share of the width,
  // which way it bows, and which way it reaches: -1 left, 1 right)
  for (const [at, reach, lift, dir] of [
    [0.08, 0.46, -1, -1],
    [0.26, 0.26, 1, 1],
    [0.42, 0.4, 1, -1],
    [0.6, 0.24, -1, 1],
    [0.76, 0.44, -1, -1],
  ] as const) {
    const y0 = top * at;
    const x0 = stemX(y0);
    // never past the screen's edge
    const len = Math.min(w * reach, dir > 0 ? w - 30 - x0 : x0 - 30);
    if (len < 40) continue;
    const pts: [number, number][] = [];
    for (let t = 0; t <= 1.0001; t += 0.02) pts.push([x0 + dir * len * t, y0 + Math.sin(t * Math.PI) * 40 * lift + t * 54]);
    // the curl at the tip
    const [ex, ey] = pts[pts.length - 1];
    const r0 = 16;
    for (let k = 1; k <= 30; k++) {
      const q = k / 30;
      const ang = Math.PI + q * Math.PI * 2.3;
      const r = r0 * (1 - q * 0.75);
      pts.push([ex - dir * (Math.cos(ang) * r + r0), ey + Math.sin(ang) * r * lift]);
    }
    branches.push({ d: pts.map(([x, y], i) => `${i ? 'L' : 'M'}${f1(x)} ${f1(y)}`).join(''), y: y0, run: 200 });
    // leaves along it, and a flower where it starts to curl
    for (let t = 0.14; t < 0.95; t += 0.16 + rnd() * 0.05) {
      const i = Math.round(t * 50);
      const [x, y] = pts[i];
      const [px, py] = pts[i + 1];
      const ang = (Math.atan2(py - y, px - x) * 180) / Math.PI;
      const up = (i / 2) % 2 === 0 ? 1 : -1;
      leaves.push({ x, y, a: ang + up * (55 + rnd() * 20), s: 1.3 + rnd() * 0.5, flip: up < 0 });
    }
    flowers.push({ x: ex, y: ey, s: 2 });
  }
  return { w, h, top, stem, reach, branches, leaves, flowers };
}

/**
 * A vine growing down through the dusk as you scroll: it starts as the evening has flooded out of the name (over the
 * last screen of the landing, which was all brown), its tip running from the top of the screen to near the bottom as
 * the About goes by, and ends just above where the crew's paper comes up. Pen-drawn like the page's flourishes:
 * a cream line, leaves unfurling as it reaches them, a few flowers in the season's bloom.
 */
export default function AboutVine() {
  const ref = useRef<SVGSVGElement>(null);
  const [geo, setGeo] = useState<Geo | null>(null);
  const geoNow = useRef<Geo | null>(null);
  geoNow.current = geo;

  useEffect(() => {
    const svg = ref.current;
    if (!svg) return;
    const build = () => {
      const w = Math.round(svg.clientWidth);
      const h = Math.round(svg.clientHeight);
      // how much of it hangs above the About, over the landing's last screen
      const above = (svg.parentElement?.getBoundingClientRect().top ?? 0) - svg.getBoundingClientRect().top;
      if (w > 0 && h > 0) setGeo(grow(w, h, Math.max(0, above)));
    };
    const ro = new ResizeObserver(build);
    ro.observe(svg);
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf = 0;
    let last = '';
    const frame = () => {
      raf = requestAnimationFrame(frame);
      const r = svg.getBoundingClientRect();
      const vh = window.innerHeight;
      if (r.top > vh * 1.2 || r.bottom < -vh * 0.5) return;
      // the tip runs out ahead fast once its top reaches the top of the screen (the dusk fills within half a screen
      // of scrolling), then keeps 85% of the way down the screen as it grows on down to its end
      const gone = -r.top;
      const tip = reduced ? r.height : Math.max(0, Math.min(r.height, gone + vh * 0.85 * Math.min(1, Math.max(0, gone) / (vh * 0.45))));
      const key = String(Math.round(tip));
      if (key === last) return;
      last = key;
      // the stem is drawn down to the tip's height (not its share of the length: it sways, so they differ)
      const reach = geoNow.current?.reach;
      const p = reach ? reach[Math.max(0, Math.min(reach.length - 1, Math.round((tip + 6) / 4)))] : tip / Math.max(1, r.height);
      svg.style.setProperty('--p', p.toFixed(4));
      svg.style.setProperty('--tip', key);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <svg ref={ref} className="about-vine" viewBox={geo ? `0 0 ${geo.w} ${geo.h}` : undefined} preserveAspectRatio="none" aria-hidden="true">
      {geo && (
        <>
          <path className="vine-stem" pathLength={1} d={geo.stem} />
          {geo.branches.map((b, i) => (
            <path key={i} className="vine-branch" pathLength={1} d={b.d} style={{ '--y': b.y, '--run': b.run } as React.CSSProperties} />
          ))}
          {geo.leaves.map((l, i) => (
            <g key={i} transform={`translate(${f1(l.x)} ${f1(l.y)}) rotate(${f1(l.a)})${l.flip ? ' scale(1 -1)' : ''}`}>
              <path className="vine-leaf" d={leafPath(l.s)} style={{ '--y': Math.round(l.y) } as React.CSSProperties} />
            </g>
          ))}
          {geo.flowers.map((f, i) => (
            <g key={i} transform={`translate(${f1(f.x)} ${f1(f.y)})`}>
              <g className="vine-flower" style={{ '--y': Math.round(f.y) } as React.CSSProperties}>
                {[0, 1, 2, 3, 4].map((k) => {
                  const a = (k / 5) * Math.PI * 2 - Math.PI / 2;
                  return <circle key={k} cx={f1(Math.cos(a) * 2.7 * f.s)} cy={f1(Math.sin(a) * 2.7 * f.s)} r={f1(2.1 * f.s)} />;
                })}
                <circle className="eye" r={f1(1.5 * f.s)} />
              </g>
            </g>
          ))}
        </>
      )}
    </svg>
  );
}
