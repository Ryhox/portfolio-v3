/** The little bit of state the page and the forest share. */
export type ForestState = {
  /** The disc that was picked, and the one under the pointer. */
  selected: number | null;
  hovered: number | null;
  /** The disc that is actually in the drive (after its little trip). */
  loaded: number | null;
};

let state: ForestState = { selected: null, hovered: null, loaded: null };
const listeners = new Set<() => void>();

export const forest = {
  get: () => state,
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
