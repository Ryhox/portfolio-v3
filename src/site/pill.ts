import { forest } from '@/scene/store';
import { hand } from './hand';

/** Asks for the mouse, so pill mode can look round with it straight away (a click is what allows it). */
export function lockPointer() {
  if (hand.touch()) return;
  const c = document.querySelector<HTMLCanvasElement>('canvas.forest');
  try {
    const r = c?.requestPointerLock() as unknown as Promise<void> | undefined;
    r?.catch?.(() => {});
  } catch {
    /* not allowed just now: the pause screen offers it again */
  }
}

const say = (bold: string, rest: string) => console.log(`%c${bold} %c${rest}`, 'font-weight:700;color:#4f7a3a', 'color:inherit');

/**
 * Pill mode is a secret: the only way in is `pill.enter()` in the console. Typed there, the page has no click
 * to take the mouse with, so you land on the pause screen and its button lets you into the wood.
 */
function enterPillMode() {
  const root = document.documentElement;
  if (root.dataset.forest === 'failed') return say('Hm.', "The wood couldn't grow in this browser.");
  if (root.dataset.forest !== 'ready') {
    // the wood only starts growing once you do something on the page: this counts
    window.dispatchEvent(new Event('forest-wake'));
    return say('Not yet.', 'The wood is still growing. Try again in a moment.');
  }
  if (forest.get().playing) return say('Already there.', "You're in the wood.");
  forest.set({ playing: true, paused: false, full: false });
  say('Gulp.', hand.touch() ? 'Into the wood.' : 'Click "Keep exploring" to look round with the mouse.');
}

/**
 * The console's secrets: puts `pill.enter()` on the window (beside the wallet's cheats on `pill`) and leaves a note
 * for whoever opens DevTools, listing the secret commands. The cheats (`pill.points`, `pill.cases`) are left off on
 * purpose: those are for finding.
 */
let told = false;
export function installSecrets() {
  const w = window as unknown as { pill?: object };
  w.pill = Object.assign(w.pill ?? {}, { enter: enterPillMode });
  if (told) return;
  told = true;
  console.log(
    '%cPsst. %cA few secret commands, for whoever looks in here:\n\n' +
      '  pill.enter()   take the pill and wander the wood\n' +
      '  pill.reset()   empty your pockets and start over',
    'font-weight:700;color:#4f7a3a',
    'color:inherit',
  );
}
