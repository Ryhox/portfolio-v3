import { useSyncExternalStore } from 'react';

/**
 * The toadstool hunt: three toadstools hidden about the page (one in the parlour, one in the garden, one by the
 * way into the wood). Find them all and the butterfly knife in pill mode turns gold. Remembered on this device.
 */
export const SPOTS = ['stube', 'garden', 'dive'] as const;
export type Spot = (typeof SPOTS)[number];

let have: Set<string> | null = null;
const subs = new Set<() => void>();
const load = () => {
  if (have) return have;
  have = new Set();
  try {
    for (const s of (window.localStorage.getItem('mushrooms') ?? '').split(',')) if ((SPOTS as readonly string[]).includes(s)) have.add(s);
  } catch {
    /* storage blocked */
  }
  return have;
};

let snap = -1;
/** Whether `spot`'s toadstool has been found; with `mark`, finds it. */
export function found(spot: Spot, mark = false) {
  if (typeof window === 'undefined') return false;
  const h = load();
  if (mark && !h.has(spot)) {
    h.add(spot);
    try {
      window.localStorage.setItem('mushrooms', [...h].join(','));
    } catch {
      /* storage blocked */
    }
    snap = h.size;
    subs.forEach((f) => f());
  }
  return h.has(spot);
}

export const goldKnife = () => (typeof window === 'undefined' ? false : load().size >= SPOTS.length);
export function useMushrooms() {
  return useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => subs.delete(f);
    },
    () => (snap < 0 ? (snap = load().size) : snap),
    () => 0,
  );
}
