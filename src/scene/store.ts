import type { WeaponId } from './arms';

/** The little bit of state the page and the forest share. */
export type ForestState = {
  /** The disc that was picked, and the one under the pointer. */
  selected: number | null;
  hovered: number | null;
  /** The disc that is actually in the drive (after its little trip). */
  loaded: number | null;
  /** The monitor's screen blown up to fill the window, showing the picked project (prev/next, its links, Leave). */
  full: boolean;
  /** Pill mode: walking about in the wood. Paused while the mouse is let go (Esc). */
  playing: boolean;
  paused: boolean;
  /** What E does where you stand in pill mode (put a floppy in, take it out, talk to Mira), if anything. */
  prompt: string | null;
  /** A page open over pill mode: Mira's shop, or your cases (4). */
  panel: 'shop' | 'cases' | null;
  /** What's in your hands, its rounds, and whether you're looking down the scope or the sights. */
  weapon: WeaponId;
  ammo: { rifle: number; shotgun: number };
  aiming: boolean;
};

const initial: ForestState = { selected: null, hovered: null, loaded: null, full: false, playing: false, paused: false, prompt: null, panel: null, weapon: 'rifle', ammo: { rifle: 5, shotgun: 6 }, aiming: false };
let state = initial;
const listeners = new Set<() => void>();

export const forest = {
  get: () => state,
  /**
   * What the server rendered with. A part of the page that comes alive later (`Later`: pill mode's UI wakes only once
   * you've taken the pill) hydrates from this, not from where things stand by then, or React finds the server's HTML
   * doesn't match and throws (#418); it then catches up with the real state at once.
   */
  server: () => initial,
  set(patch: Partial<ForestState>) {
    state = { ...state, ...patch };
    listeners.forEach((l) => l());
  },
  subscribe(l: () => void) {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  },
};

/** Seconds since the forest started, shared so the page can stamp events on the same clock. */
const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
export const forestNow = () => (performance.now() - t0) / 1000;
