import { projects } from '@/content/projects';
import { site } from '@/content/site';
import { forest } from '@/scene/store';

/** The parts of the walk, top to bottom, and what the tab says while the middle of the screen is in one. */
const PARTS: [selector: string, title: string | null][] = [
  ['.landing', null],
  ['#hello', 'About'],
  ['#crew', 'Tech stack'],
  ['[data-stage="dive"]', 'Projects'],
  ['[data-stage="work"]', 'Projects'],
  ['.walk-out', 'Thanks for wandering in'],
  ['[data-stage="end"]', 'Thanks for wandering in'],
];

/** What the tab says while you're in another one. */
const AWAY = 'The wood misses you…';

const named = (t: string) => `${t} | ${site.name}`;

/**
 * The tab's title follows the walk: the part of the page you're in, the project on the screen, pill mode, and a
 * note when you tab away. (The page's own title, for search engines and links, is the landing's.)
 */
export function watchTitle() {
  const base = document.title || site.title;
  let last = base;

  const now = () => {
    if (document.hidden) return AWAY;
    const st = forest.get();
    if (st.playing) return named('Pill mode');
    // the project on the monitor, once its disc is in (or you've dived into the glass)
    const on = st.full ? st.selected : st.loaded !== null && st.loaded === st.selected ? st.loaded : null;
    if (on !== null && projects[on]) return named(projects[on].title);
    const mid = window.innerHeight / 2;
    for (const [sel, title] of PARTS) {
      const r = document.querySelector(sel)?.getBoundingClientRect();
      if (r && r.top <= mid && r.bottom > mid) return title ? named(title) : base;
    }
    return window.scrollY < mid ? base : last;
  };

  let raf = 0;
  const update = () => {
    raf = 0;
    const t = now();
    if (t === last) return;
    last = t;
    document.title = t;
  };
  const soon = () => {
    if (!raf) raf = requestAnimationFrame(update);
  };

  update();
  window.addEventListener('scroll', soon, { passive: true });
  window.addEventListener('resize', soon);
  // a hidden tab gets no frames, so its title is set at once
  document.addEventListener('visibilitychange', update);
  const unsub = forest.subscribe(soon);

  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener('scroll', soon);
    window.removeEventListener('resize', soon);
    document.removeEventListener('visibilitychange', update);
    unsub();
    // leave the next page's own title alone if it has already set one
    if (document.title === last) document.title = base;
  };
}
