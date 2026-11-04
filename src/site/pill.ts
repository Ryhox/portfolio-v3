import { forest } from '@/scene/store';

/** Asks for the mouse, so pill mode can look round with it straight away (a click is what allows it). */
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

const say = (bold: string, rest: string) => console.log(`%c${bold} %c${rest}`, 'font-weight:700;color:#4f7a3a', 'color:inherit');

/**
 * Pill mode is a secret: the only way in is `Enter.PillMode()` in the console. Typed there, the page has no click
 * to take the mouse with, so you land on the pause screen and its button lets you into the wood.
 */
function enterPillMode() {
  const root = document.documentElement;
  if (root.dataset.forest === 'failed') return say('Hm.', "The wood couldn't grow in this browser.");
  if (root.dataset.forest !== 'ready') return say('Not yet.', 'The wood is still growing. Try again in a moment.');
  if (forest.get().playing) return say('Already there.', "You're in the wood.");
  forest.set({ playing: true, paused: false, full: false });
  say('Gulp.', window.matchMedia('(pointer: coarse)').matches ? 'Into the wood.' : 'Click "Keep exploring" to look round with the mouse.');
}

/**
 * The console's secrets: puts `Enter.PillMode()` on the window and leaves a note for whoever opens DevTools,
 * listing the secret commands. The points cheat (`pill.points`) is left off on purpose: that one is for finding.
 */
let told = false;
export function installSecrets() {
  Object.assign(window, { Enter: { PillMode: enterPillMode } });
  if (told) return;
  told = true;
  console.log(
    '%cPsst. %cA few secret commands, for whoever looks in here:\n\n' +
      '  Enter.PillMode()   take the pill and wander the wood\n' +
      "  pill.cases(3)      a few Meadow Cases for Mira's stall\n" +
      '  pill.reset()       empty your pockets and start over',
    'font-weight:700;color:#4f7a3a',
    'color:inherit',
  );
}
