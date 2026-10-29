'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { forest } from '@/scene/store';
import { lockPointer } from './Pill';
import WoodSign from './WoodSign';

const subscribe = forest.subscribe;
const get = forest.get;

/**
 * The few words pill mode needs over the wood: how to move (fading after a moment), what E does where you
 * stand, and while the mouse is let go, a pause with the way back in and the way out. Touch screens get
 * Zoom and Use buttons and a Wake up button in the corner.
 */
export default function PlayUI() {
  const st = useSyncExternalStore(subscribe, get, get);
  const [touch, setTouch] = useState(false);
  useEffect(() => setTouch(window.matchMedia('(pointer: coarse)').matches), []);
  if (!st.playing) return null;
  const wake = () => {
    if (document.pointerLockElement) document.exitPointerLock();
    forest.set({ playing: false, paused: false });
  };
  const send = (name: string) => () => window.dispatchEvent(new Event(name));
  const paused = st.paused && !touch;
  return (
    <div className="play-ui">
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
      {st.prompt && !paused && (
        <p className="play-prompt">
          {!touch && <kbd>E</kbd>}
          {st.prompt}
        </p>
      )}
      {paused ? (
        <div className="play-pause">
          <WoodSign className="play-sign">
            <p className="play-title">The wood goes on</p>
            <p className="play-keys">WASD walk · Shift run · Space hop · Click shoot · Right-click zoom · E use</p>
            <div className="play-actions">
              <button type="button" className="wood-btn" onClick={lockPointer}>
                Keep exploring
              </button>
              <button type="button" className="wood-btn" onClick={wake}>
                Wake up
              </button>
            </div>
          </WoodSign>
        </div>
      ) : (
        <p className="play-hint">{touch ? 'Left thumb walks · right thumb looks · tap to shoot' : 'WASD to walk · Click to shoot · Right-click to zoom · E to use · Esc to pause'}</p>
      )}
    </div>
  );
}
