/**
 * How pill mode is played here: with fingers (two thumbs on the glass) or with the mouse (taken with pointer lock,
 * behind the pause screen's "Keep exploring").
 *
 * Not `(pointer: coarse)` alone: Chrome on many touchscreen laptops calls the primary pointer coarse with a mouse or
 * touchpad right there, and pill mode then took them for a phone (no pause screen, the mouse never taken, no way to
 * move). So it's fingers only when nothing fine is attached, and the hand actually used settles it: a mouse moving over
 * the page means the mouse, a finger landing on the glass means fingers.
 */
type Kind = 'touch' | 'mouse';

let kind: Kind | null = null;
const subs = new Set<() => void>();

function set(k: Kind) {
  if (k === kind) return;
  kind = k;
  subs.forEach((f) => f());
}

if (typeof window !== 'undefined') {
  const seen = (e: PointerEvent) => {
    if (e.pointerType === 'mouse') set('mouse');
    // a finger counts when it lands (never while the mouse is taken)
    else if (e.pointerType === 'touch' && e.type === 'pointerdown' && !document.pointerLockElement) set('touch');
  };
  window.addEventListener('pointermove', seen, { capture: true, passive: true });
  window.addEventListener('pointerdown', seen, { capture: true, passive: true });
}

export const hand = {
  /** Fingers, not the mouse. */
  touch(): boolean {
    if (typeof window === 'undefined') return false;
    kind ??= window.matchMedia('(pointer: coarse)').matches && !window.matchMedia('(any-pointer: fine)').matches ? 'touch' : 'mouse';
    return kind === 'touch';
  },
  subscribe(f: () => void) {
    subs.add(f);
    return () => {
      subs.delete(f);
    };
  },
};
