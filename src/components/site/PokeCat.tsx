'use client';

import { useEffect, useRef, useState } from 'react';
import { sfx } from '@/sound/sfx';
import { CatOnPillow } from './Ink';

/**
 * The black cat asleep on her cushion, as a button: poked, she hops, a "!" pops over her head and she opens one eye,
 * then she goes back to sleep. (The About's cat, and the one under the 404's signpost.)
 * She only breathes while she's on screen: drawn with the pen's wobble, every breath repaints her, so out of sight
 * she holds still (nobody can see it, and the page scrolls lighter).
 */
export default function PokeCat({ className = '', ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { 'data-reveal'?: boolean }) {
  const [poked, setPoked] = useState(0);
  const btn = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const b = btn.current;
    if (!b) return;
    const io = new IntersectionObserver(([e]) => (b.dataset.seen = String(e.isIntersecting)));
    io.observe(b);
    return () => io.disconnect();
  }, []);
  return (
    <button
      ref={btn}
      type="button"
      className={`about-cat ${className}`.trim()}
      aria-label="The black cat, asleep on her cushion. Pet her."
      {...rest}
      onClick={() => {
        setPoked((n) => n + 1);
        sfx.play('meow', { rate: 0.9 + Math.random() * 0.3 });
      }}
    >
      {/* a fresh key per poke restarts her animations (each child its own key, or React keeps the old ones) */}
      <CatOnPillow key={`cat-${poked}`} stirred={poked > 0} />
      {poked > 0 ? (
        <span key={`bang-${poked}`} className="about-bang" aria-hidden="true">
          !
        </span>
      ) : null}
    </button>
  );
}
