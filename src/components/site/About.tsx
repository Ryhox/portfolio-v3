'use client';

import { useEffect, useRef, useState } from 'react';
import { sfx } from '@/sound/sfx';
import { CatOnPillow } from './Ink';

const TITLE = 'I build playful, tactile things for the web.';

/**
 * Who this is, in the evening that flooded out of the name: one big line whose letters stand up in 3D as you read
 * down, and under it a few words, and the black cat asleep on her cushion.
 */
export default function About() {
  const sec = useRef<HTMLElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const [poked, setPoked] = useState(0);

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
          <p className="lead" data-reveal>
            Ryhox is a web developer and Three.js engineer. Real-time 3D worlds, everyday apps, private AI and Minecraft mods, all built by hand.
          </p>
          <button
            type="button"
            className="about-cat"
            aria-label="The black cat, asleep on her cushion. Pet her."
            data-reveal
            onClick={() => {
              setPoked((n) => n + 1);
              sfx.play('meow', { rate: 0.9 + Math.random() * 0.3 });
            }}
          >
            <CatOnPillow key={poked} stirred={poked > 0} />
            <span className="about-z" aria-hidden="true">
              <i>z</i>
              <i>z</i>
              <i>z</i>
            </span>
          </button>
        </div>
      </div>
    </section>
  );
}
