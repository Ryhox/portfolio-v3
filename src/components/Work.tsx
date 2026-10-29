'use client';

import { useEffect, useRef, useSyncExternalStore } from 'react';
import { projects } from '@/content/projects';
import { forest } from '@/scene/store';

const subscribe = forest.subscribe;
const get = forest.get;

/**
 * The clearing. The discs, the computer and the man are drawn by the forest; this is everything laid
 * over them (moved into place every frame): buttons on the discs with their labels, the project video
 * on the monitor's glass, the photo the man wears as a mask, and the words (or, on phones, only the links).
 */
export default function Work() {
  const state = useSyncExternalStore(subscribe, get, get);
  const shown = state.selected === null ? null : projects[state.selected];
  const playing = state.loaded === null ? null : projects[state.loaded];
  const video = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = video.current;
    if (!v) return;
    if (playing) v.play().catch(() => {});
    else v.pause();
  }, [playing]);

  return (
    <section className="work" data-stage="work" aria-labelledby="work-title">
      <div className="work-stick">
        <div className="work-text" aria-live="polite">
          {shown ? (

            <article key={shown.slug} className="project">
              <h2 id="work-title">{shown.title}</h2>
              <p className="kicker">{shown.kicker}</p>
              <p className="desc">{shown.description}</p>
              <p className="stack">{shown.stack.join(' · ')}</p>
              <p className="links">
                {shown.links.map((l, i) => (
                  <a key={l.href} href={l.href} target="_blank" rel="noreferrer" data-pin={`work-link${i}`} data-show="false">
                    {l.label}
                  </a>
                ))}
              </p>
            </article>
          ) : (
            <div className="intro">
              <h2 id="work-title">Selected work</h2>
              <p>Pick up a disc to load it.</p>
            </div>
          )}
        </div>
      </div>

      {/* where there's no room for the notice board (phones, squarish windows): just the links, at the bottom */}
      <p id="work-bar" className="work-bar" data-show="false">
        {shown?.links.map((l) => (
          <a key={l.href} href={l.href} target="_blank" rel="noreferrer" className="pixel-btn" aria-label={`${shown.title}: ${l.label}`}>
            {l.label}
          </a>
        ))}
      </p>

      <div id="discs" className="discs" data-active="false">
        {projects.map((p, i) => (
          <button
            key={p.slug}
            type="button"
            data-disc={i}
            aria-pressed={state.selected === i}
            aria-label={`${p.title}: load the disc`}
            onPointerEnter={() => forest.set({ hovered: i })}
            onPointerLeave={() => forest.get().hovered === i && forest.set({ hovered: null })}
            onFocus={() => forest.set({ hovered: i })}
            onBlur={() => forest.get().hovered === i && forest.set({ hovered: null })}
            onClick={() => forest.set({ selected: state.selected === i ? null : i })}
          >
          </button>
        ))}
      </div>

      <div id="pin-screen" className="pin pin-screen" data-show="false" aria-hidden="true">
        <video
          ref={video}
          key={playing?.slug ?? 'none'}
          src={playing ? `/work/${playing.slug}.mp4` : undefined}
          muted
          loop
          playsInline
          autoPlay
          preload="none"
        />
      </div>

    </section>
  );
}
