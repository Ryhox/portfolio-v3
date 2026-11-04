/**
 * The page before the work, in ink on the page's paper: "Projects" in big letters and a line from Emerson under it.
 * Painted on a transparent canvas (the paper is the shader's); the wood's own pixel trees stand in front of it and
 * part to show it.
 */

export const QUOTE = { text: '“The creation of a thousand forests is in one acorn.”', by: 'Ralph Waldo Emerson, History' };

const INK = '#1a1d16';

export function paintProjects(c: HTMLCanvasElement, W: number, H: number, dpr: number) {
  c.width = Math.round(W * dpr);
  c.height = Math.round(H * dpr);
  const g = c.getContext('2d')!;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, W, H);
  const narrow = W < 700;
  // the words: the title big in the middle, the line from Emerson under it
  const root = getComputedStyle(document.documentElement);
  const display = root.getPropertyValue('--font-display').trim() || 'Georgia, serif';
  const big = Math.min(W * (narrow ? 0.2 : 0.15), H * 0.22);
  g.fillStyle = INK;
  g.textAlign = 'center';
  g.textBaseline = 'alphabetic';
  g.font = `380 ${big}px ${display}`;
  g.letterSpacing = `${-big * 0.03}px`;
  const ty = H * 0.46;
  g.fillText('Projects', W / 2, ty);
  g.letterSpacing = '0px';
  const qs = Math.max(15, Math.min(26, W * 0.018, big * 0.2));
  g.font = `400 ${qs}px ${display}`;
  g.fillStyle = INK;
  const lines = wrap(g, QUOTE.text, Math.min(W * 0.62, qs * 30));
  lines.forEach((l, i) => g.fillText(l, W / 2, ty + big * 0.42 + i * qs * 1.4));
  g.font = `400 ${qs * 0.62}px ${display}`;
  g.fillStyle = '#9c4a36';
  g.letterSpacing = `${qs * 0.04}px`;
  g.fillText(`— ${QUOTE.by}`, W / 2, ty + big * 0.42 + lines.length * qs * 1.4 + qs * 0.55);
  g.letterSpacing = '0px';
}

function wrap(g: CanvasRenderingContext2D, s: string, max: number) {
  const out: string[] = [];
  let line = '';
  for (const w of s.split(' ')) {
    const next = line ? `${line} ${w}` : w;
    if (g.measureText(next).width > max && line) {
      out.push(line);
      line = w;
    } else line = next;
  }
  if (line) out.push(line);
  return out;
}
