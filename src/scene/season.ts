/**
 * The four seasons as they run in South Tyrol, and which one the wood is in. Plain data, no DOM at import, so the
 * painters (workers) can read it too.
 *
 * By default the wood follows the real calendar (meteorological seasons: the valleys bloom in March, the larches and
 * beeches turn in September, the first proper snow is a December thing). `?season=` or the picker on the page
 * override it for the visit.
 */
export type Season = 'spring' | 'summer' | 'autumn' | 'winter';
export const SEASONS: Season[] = ['spring', 'summer', 'autumn', 'winter'];

export function realSeason(d = new Date()): Season {
  const m = d.getMonth();
  if (m === 11 || m <= 1) return 'winter';
  if (m <= 4) return 'spring';
  if (m <= 7) return 'summer';
  return 'autumn';
}

export const isSeason = (s: unknown): s is Season => typeof s === 'string' && (SEASONS as string[]).includes(s);

/** The season for this visit: the address, then what was picked on the page this visit, then the calendar. */
export function pickSeason(): Season {
  if (typeof window === 'undefined') return realSeason();
  try {
    const q = new URLSearchParams(window.location.search).get('season');
    if (isSeason(q)) return q;
    const s = window.sessionStorage.getItem('season');
    if (isSeason(s)) return s;
  } catch {
    /* storage blocked: the calendar it is */
  }
  return realSeason();
}

/** What each season is like here, for the page's words. */
export const SEASON_TEXT: Record<Season, { name: string; months: string; line: string }> = {
  spring: { name: 'Spring', months: 'March to May', line: 'Apple blossom down the valleys, crocus in the meadows, the first frogs at the pond.' },
  summer: { name: 'Summer', months: 'June to August', line: 'Deep green shade, foxgloves and wild strawberries, butterflies over the clearing.' },
  autumn: { name: 'Autumn', months: 'September to November', line: 'Copper beeches and golden birches, chestnuts in the leaves, mushrooms everywhere.' },
  winter: { name: 'Winter', months: 'December to February', line: 'Bare branches under snow, white hares and foxes, paw prints leading to the cat.' },
};
