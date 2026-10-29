import { CAT } from '@/scene/art/props';

/** The cat's colours, as in the hollow (fur, the faint rim, eyes). */
const FUR = '#0a0b0a';
const RIM = '#20241e';
const EYE = '#e2bd3a';
const EYE_LIT = '#f8e17c';
const GRASS = ['#1c301f', '#273f26', '#355330', '#466a3a'];

/** A few blades of grass for the cat to sit in, as [x, height, shade]. */
const BLADES: [number, number, number][] = [
  [1, 3, 2], [2, 2, 1], [4, 4, 3], [5, 2, 2], [7, 3, 1], [19, 3, 2], [20, 4, 3], [22, 2, 1], [23, 3, 2], [25, 2, 3],
];

/**
 * Shown the instant the page arrives, until the forest is painted: the black cat from the end of the walk,
 * sitting in the grass, blinking and flicking its tail, over a pixel progress bar that fills as the forest arrives.
 * Drawn as pixels in SVG and CSS, so it needs nothing to load.
 */
export default function Loader() {
  const w = CAT[0].length;
  const h = CAT.length;
  const fur: string[] = [];
  const tail: string[] = [];
  const eyes: string[] = [];
  const solid = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && CAT[y][x] !== '.';
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ch = CAT[y][x];
      if (ch === '.') continue;
      const rect = `M${x + 1} ${y}h1v1h-1z`;
      if (ch === 'Y' || ch === 'y') {
        fur.push(rect);
        eyes.push(`<path d="${rect}" fill="${ch === 'Y' ? EYE_LIT : EYE}"/>`);
      } else if (ch === 't') tail.push(rect);
      else fur.push(rect);
    }
  }
  const rim = CAT.flatMap((row, y) =>
    row.split('').flatMap((ch, x) => (ch !== '.' && !solid(x, y - 1) ? [`M${x + 1} ${y}h1v1h-1z`] : [])),
  );
  const grass = BLADES.map(([x, hh, s]) => `<path d="M${x} ${h + 1 - hh}h1v${hh}h-1z" fill="${GRASS[s]}"/>`).join('');
  const svg = `
    <path d="${fur.join('')}" fill="${FUR}"/>
    <path d="${rim.join('')}" fill="${RIM}"/>
    <g class="loader-tail"><path d="${tail.join('')}" fill="${FUR}"/></g>
    <g class="loader-eyes">${eyes.join('')}</g>
    <path d="M0 ${h}h${w + 2}v1h-${w + 2}z" fill="${GRASS[1]}"/>
    ${grass}`;
  return (
    <div className="loader">
      <svg aria-hidden="true" viewBox={`0 0 ${w + 2} ${h + 1}`} width={(w + 2) * 5} height={(h + 1) * 5} shapeRendering="crispEdges" dangerouslySetInnerHTML={{ __html: svg }} />
      <div className="loader-bar" role="progressbar" aria-label="Loading the forest">
        <i />
      </div>
    </div>
  );
}
