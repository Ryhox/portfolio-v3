/**
 * A small store that remembers itself in the browser (pill mode's points, skins, cases and settings). Storage
 * may be blocked (private windows, previews): then it simply lives for the visit.
 */
export function persisted<T extends object>(key: string, defaults: T) {
  let state: T = { ...defaults };
  if (typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw) state = { ...defaults, ...(JSON.parse(raw) as Partial<T>) };
    } catch {
      /* storage blocked or broken: start fresh */
    }
  }
  const listeners = new Set<() => void>();
  let timer = 0;
  const save = () => {
    if (typeof window === 'undefined') return;
    clearTimeout(timer);
    timer = window.setTimeout(() => {
      try {
        window.localStorage.setItem(key, JSON.stringify(state));
      } catch {
        /* storage blocked */
      }
    }, 120);
  };
  return {
    get: () => state,
    set(patch: Partial<T> | ((s: T) => Partial<T>)) {
      const p = typeof patch === 'function' ? patch(state) : patch;
      state = { ...state, ...p };
      save();
      listeners.forEach((l) => l());
    },
    reset() {
      state = { ...defaults };
      save();
      listeners.forEach((l) => l());
    },
    subscribe(l: () => void) {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
  };
}
