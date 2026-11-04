'use client';

import { useEffect, useRef } from 'react';
import PokeCat from './PokeCat';
import AboutVine from './Vine';

const TITLE = 'I build playful, tactile things for the web.';
/** A phrase picked out with the marker; `i` is its turn as the strokes draw in, one after another. */
const Hl = ({ i, children }: { i: number; children: React.ReactNode }) => (
  <mark className="hl" style={{ '--i': i } as React.CSSProperties}>
    {children}
  </mark>
);

/** A few words, skimmable: what matters picked out with a marker, and the invitation underlined in red pen. */
const LEAD = (
  <>
    I’m a <Hl i={0}>student in South Tyrol</Hl>, and for the last few years I’ve been teaching myself to build for the web.
    Mostly <Hl i={1}>real-time 3D worlds</Hl> and <Hl i={2}>apps people use every day</Hl>, and now and then an experiment
    that turns into a toy. I like leaving <Hl i={3}>small secrets</Hl> in my work for whoever goes looking. If you have
    something in mind, <span className="pen">I’d be glad to hear about it</span>.
  </>
);

/**
 * Who this is, in the evening that flooded out of the name: one big line whose letters stand up in 3D as you read
 * down, and under it a few words, and the black cat asleep on her cushion.
 */
export default function About() {
  const sec = useRef<HTMLElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const lead = useRef<HTMLParagraphElement>(null);

  // the marker sweeps over the words once they've come into focus, and wipes off when you scroll back above them
  // (a gap between the two, so it doesn't flicker on the edge)
  useEffect(() => {
    const p = lead.current;
    if (!p) return;
    let on: boolean | null = null;
    let raf = 0;
    const frame = () => {
      raf = requestAnimationFrame(frame);
      const top = p.getBoundingClientRect().top;
      const vh = window.innerHeight;
      const next = top < vh * 0.7 ? true : top > vh * 0.92 ? false : on;
      if (next === null || next === on) return;
      on = next;
      p.dataset.in = String(on);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  // the letters of the big line stand up off their baseline one after another as the scroll passes them, swelling
  // from a hairline to their weight as they rise (Fraunces is a variable font)
  useEffect(() => {
    const s = sec.current;
    const h = title.current;
    if (!s || !h) return;
    const chars = [...h.querySelectorAll<HTMLElement>('.ch')];
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf = 0;
    let last = -1;
    const frame = () => {
      raf = requestAnimationFrame(frame);
      const r = h.getBoundingClientRect();
      const vh = window.innerHeight;
      if (r.bottom < -vh || r.top > vh * 2) return;
      // from the line's top at 95% of the screen to its bottom at half way
      const k = reduced ? 1 : Math.max(0, Math.min(1, (vh * 0.95 - r.top) / (vh * 0.45 + r.height)));
      if (Math.abs(k - last) < 0.0004) return;
      last = k;
      const n = chars.length;
      const span = 9;
      chars.forEach((c, i) => {
        const a = Math.max(0, Math.min(1, (k * (n + span) - i) / span));
        c.style.setProperty('--c', (a < 0.5 ? 4 * a * a * a : 1 - (-2 * a + 2) ** 3 / 2).toFixed(3));
      });
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <section ref={sec} id="hello" className="site-sec about" aria-labelledby="hello-title">
      {/* a vine growing down through the dusk as you read */}
      <AboutVine />
      {/* petals drifting down through the dusk */}
      <div className="about-petals" aria-hidden="true">
        {Array.from({ length: 7 }, (_, i) => (
          <i key={i} style={{ '--k': i } as React.CSSProperties} />
        ))}
      </div>
      <div className="about-inner">
        <h2 ref={title} id="hello-title" className="about-title" aria-label={TITLE}>
          {TITLE.split(' ').map((w, wi, all) => (
            <span key={wi} className="w" aria-hidden="true">
              {[...w].map((ch, i) => (
                <span key={i} className="ch">
                  {ch}
                </span>
              ))}
              {wi < all.length - 1 ? ' ' : null}
            </span>
          ))}
        </h2>
        <div className="about-cols">
          <p ref={lead} className="lead" data-reveal>
            {LEAD}
          </p>
          <PokeCat data-reveal />
        </div>
      </div>
    </section>
  );
}
