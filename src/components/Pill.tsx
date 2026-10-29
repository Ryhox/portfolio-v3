'use client';

import { forest } from '@/scene/store';

/** Asks for the mouse, so pill mode can look round with it straight away (the click is what allows it). */
export function lockPointer() {
  if (window.matchMedia('(pointer: coarse)').matches) return;
  const c = document.querySelector<HTMLCanvasElement>('canvas.forest');
  try {
    const r = c?.requestPointerLock() as unknown as Promise<void> | undefined;
    r?.catch?.(() => {});
  } catch {
    /* not allowed just now: the pause screen offers it again */
  }
}

/**
 * The cat's offer at the end of the walk: a line over the pill on her paw and a Take button under it.
 * The forest moves both onto the paw every frame and shows them once she's holding it out.
 */
export default function Pill() {
  return (
    <>
      <p id="pill-say" className="pill-say" data-show="false" aria-hidden="true">
        <span>Stay a while?</span>
      </p>
      <button
        id="pill-take"
        type="button"
        className="pixel-btn pill-take"
        data-show="false"
        aria-label="Take the pill and wander the wood"
        onClick={() => {
          forest.set({ playing: true, paused: false });
          lockPointer();
        }}
      >
        Take
      </button>
    </>
  );
}
