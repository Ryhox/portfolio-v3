import { useSyncExternalStore } from 'react';
import { pickSeason, type Season } from '@/scene/season';

/**
 * The season the visit is in, shared by the page and the wood: the calendar's by default, or the one picked in
 * "A year in the valley". The page's colours follow `html[data-season]` (set before first paint by the head script).
 */
let cur: Season | null = null;
const subs = new Set<() => void>();

export const seasonStore = {
  get(): Season {
    return (cur ??= pickSeason());
  },
  /** On the server the season isn't known (the page is built once): the client fills it in. */
  server(): Season {
    return 'summer';
  },
  set(s: Season) {
    if (s === seasonStore.get()) return;
    cur = s;
    try {
      window.sessionStorage.setItem('season', s);
    } catch {
      /* storage blocked: it holds for this page only */
    }
    document.documentElement.dataset.season = s;
    subs.forEach((f) => f());
  },
  subscribe(f: () => void) {
    subs.add(f);
    return () => {
      subs.delete(f);
    };
  },
};

export function useSeason() {
  return useSyncExternalStore(seasonStore.subscribe, seasonStore.get, seasonStore.server);
}

/** True once the page is running in the browser (after hydration). */
const noop = () => () => {};
export function useMounted() {
  return useSyncExternalStore(noop, () => true, () => false);
}
