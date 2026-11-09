'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { CASES } from '@/scene/loot';
import { forest } from '@/scene/store';
import { hand } from '@/site/hand';
import CasesPanel from './play/CasesPanel';
import Hotbar from './play/Hotbar';
import PauseMenu from './play/PauseMenu';
import Shop from './play/Shop';
import { useForest, useWallet } from './play/stores';

/** What Mira says over her stall as you come up, by how things stand with you. */
function miraLine(met: boolean, points: number) {
  if (!met) return 'Oh, a visitor! Come and see, the first case is on me.';
  if (points >= CASES.hollow.price) return 'Now that’s a lot of points. The Hollow Case?';
  if (points >= CASES.meadow.price) return 'Points burning a hole? I’ve got cases.';
  return 'Bring me points from the hunt and I’ll find you something shiny.';
}

/**
 * Everything pill mode puts on the page over the wood: the hotbar along the bottom with the key hints over it,
 * what E does where you stand, Mira's line over her stall, the arrow to her shop, and when the mouse is let go,
 * the shop, your cases, or the pause menu. Touch screens get Zoom and Use buttons and a Wake up button.
 */
export default function PlayUI() {
  const st = useForest();
  const w = useWallet();
  const touch = useSyncExternalStore(hand.subscribe, hand.touch, () => false);
  // Esc puts a page away (the pause menu is under it: the mouse can't be taken back on Esc)
  useEffect(() => {
    if (!st.panel) return;
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') forest.set({ panel: null });
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [st.panel]);
  if (!st.playing) return null;
  const wake = () => {
    if (document.pointerLockElement) document.exitPointerLock();
    forest.set({ playing: false, paused: false, panel: null });
  };
  const send = (name: string) => () => window.dispatchEvent(new Event(name));
  const paused = st.paused && !touch;
  const busy = paused || !!st.panel;
  return (
    <div className="play-ui" data-busy={busy}>
      {touch && (
        <>
          <button type="button" className="pixel-btn play-wake" onClick={wake}>
            Wake up
          </button>
          <div className="play-touch">
            {st.prompt && (
              <button type="button" className="pixel-btn" onClick={send('play-use')}>
                Use
              </button>
            )}
            <button type="button" className="pixel-btn" onClick={send('play-zoom')}>
              Zoom
            </button>
          </div>
        </>
      )}
      <p id="mira-say" className="mira-say" data-show="false" aria-hidden="true">
        <span>{miraLine(w.met, w.points)}</span>
      </p>
      {st.prompt && !busy && (
        <p className="play-prompt">
          {!touch && <kbd>E</kbd>}
          {st.prompt}
        </p>
      )}
      {!busy && (
        <div className="play-bottom">
          <Hotbar />
        </div>
      )}
      {st.panel === 'shop' && <Shop />}
      {st.panel === 'cases' && <CasesPanel />}
      {paused && !st.panel && <PauseMenu wake={wake} />}
    </div>
  );
}
