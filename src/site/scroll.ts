/** The smooth scroll, shared: the page's links scroll through it so the walk stays smooth. */
type Scroller = { scrollTo: (to: number | HTMLElement, o?: { duration?: number; offset?: number; immediate?: boolean }) => void } | null;
let lenis: Scroller = null;
export const setScroller = (l: Scroller) => (lenis = l);
export function scrollToEl(el: HTMLElement | null, offset = 0) {
  if (!el) return;
  if (lenis) lenis.scrollTo(el, { duration: 1.6, offset });
  else window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY + offset, behavior: 'smooth' });
}

/**
 * How far through an element the page is (0 when its top reaches the top of the screen, 1 when its end does). Give
 * `screen` (a sticky stage's height) to measure by that instead of the window, which grows as a phone's bar slides away.
 */
export function progress(el: HTMLElement, screen = window.innerHeight) {
  const r = el.getBoundingClientRect();
  const span = Math.max(1, el.offsetHeight - screen);
  return Math.max(0, Math.min(1, -r.top / span));
}
