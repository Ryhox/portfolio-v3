/**
 * The black cat, curled up asleep on a plump cushion, drawn like the ink drawing of the clearing: pale paper inside
 * dark pen outlines, the cushion's underside cross-hatched, its seam stitched, two buttons tufting it with creases
 * pulled in round them and a tassel at each corner; the cat solid ink, her fur picked out in pale hatch strokes so
 * she reads on the dark page. She breathes; her tail stirs; poked (`stirred`), she startles and settles again.
 */
const INK = '#120d0b';
const PAPER = '#ece4cf';
const PALE = '#e6dcc4';

export function CatOnPillow({ stirred = false }: { stirred?: boolean }) {
  // the cushion's outline, used for its fill, its shading and its line
  const cushion = 'M20 96c-4-20 6-30 26-32 28-3 56-4 84-4s56 1 84 4c20 2 30 12 26 32-2 14-6 24-26 28-28 5-56 6-84 6s-56-1-84-6c-20-4-24-14-26-28z';
  const cat = 'M14 57c-6-12-3-26 7-32l-1-15 10 10c3-1 7-1 10 0l7-10v15c15-8 46-7 60 5 12 10 11 24 2 28-8 3-24 4-46 4-23 0-40-1-49-5z';
  return (
    <svg className="cat-pillow" viewBox="0 0 260 150" data-stirred={stirred} aria-hidden="true">
      <defs>
        <pattern id="hatch-a" width="4.2" height="4.2" patternUnits="userSpaceOnUse" patternTransform="rotate(-38)">
          <line x1="0" y1="0" x2="0" y2="4.2" stroke={INK} strokeWidth="0.9" />
        </pattern>
        <pattern id="hatch-b" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(52)">
          <line x1="0" y1="0" x2="0" y2="5" stroke={INK} strokeWidth="0.7" />
        </pattern>
        <linearGradient id="shade-a" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0.45" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#fff" stopOpacity="1" />
        </linearGradient>
        <linearGradient id="shade-b" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0.72" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#fff" stopOpacity="1" />
        </linearGradient>
        <mask id="m-a">
          <rect width="260" height="150" fill="url(#shade-a)" />
        </mask>
        <mask id="m-b">
          <rect width="260" height="150" fill="url(#shade-b)" />
        </mask>
        <clipPath id="c-cushion">
          <path d={cushion} />
        </clipPath>
        {/* the pen's line is never quite ruler-true */}
        <filter id="pen" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="4" />
          <feDisplacementMap in="SourceGraphic" scale="1.3" />
        </filter>
      </defs>

      {/* its shadow on the floor, hatched */}
      <ellipse cx="130" cy="137" rx="114" ry="9" fill="#000" opacity="0.28" />

      <g className="pillow" filter="url(#pen)">
        {/* tassels at the corners: a knot, and the threads fanning out */}
        <g stroke={INK} strokeWidth="1.3" strokeLinecap="round" fill="none">
          <path d="M22 110c-5 2-9 3-13 2M22 110c-4 4-7 7-11 8M22 110c-3 5-4 9-7 12M22 110c-1 5-1 9-2 13" />
          <path d="M238 110c5 2 9 3 13 2M238 110c4 4 7 7 11 8M238 110c3 5 4 9 7 12M238 110c1 5 1 9 2 13" />
          <path d="M24 76c-5-2-9-5-11-9M24 76c-6 0-10-2-13-5M24 76c-6 2-10 2-14 1" />
          <path d="M236 76c5-2 9-5 11-9M236 76c6 0 10-2 13-5M236 76c6 2 10 2 14 1" />
        </g>
        <path d={cushion} fill={PAPER} />
        <g clipPath="url(#c-cushion)">
          {/* the underside in shade: hatched, and cross-hatched where it's deepest */}
          <rect width="260" height="150" fill="url(#hatch-a)" mask="url(#m-a)" opacity="0.85" />
          <rect width="260" height="150" fill="url(#hatch-b)" mask="url(#m-b)" opacity="0.75" />
          {/* creases pulled in round the buttons */}
          <g stroke={INK} strokeWidth="0.9" fill="none" strokeLinecap="round" opacity="0.8">
            <path d="M74 96c-8-5-16-6-24-5M74 96c-6-8-8-14-8-20M74 96c8-6 14-10 22-11M74 96c6 6 9 11 10 17M74 96c-7 5-12 9-14 15" />
            <path d="M186 96c8-5 16-6 24-5M186 96c6-8 8-14 8-20M186 96c-8-6-14-10-22-11M186 96c-6 6-9 11-10 17M186 96c7 5 12 9 14 15" />
          </g>
          {/* the top's rounded fold, a few strokes along it */}
          <path d="M34 80c26-6 60-8 96-8s70 2 96 8" stroke={INK} strokeWidth="0.8" fill="none" opacity="0.55" />
        </g>
        {/* the seam, piped and stitched */}
        <path d="M22 100c30 10 186 10 216 0" stroke={INK} strokeWidth="1.1" strokeDasharray="2.6 3.2" strokeLinecap="round" fill="none" />
        <path d={cushion} fill="none" stroke={INK} strokeWidth="2.2" strokeLinejoin="round" />
        {/* the buttons */}
        <g fill={PALE} stroke={INK} strokeWidth="1.3">
          <circle cx="74" cy="96" r="3.4" />
          <circle cx="186" cy="96" r="3.4" />
        </g>
        <g fill={INK}>
          <circle cx="73.2" cy="95.4" r="0.8" />
          <circle cx="185.2" cy="95.4" r="0.8" />
        </g>
      </g>

      {/* the cat, curled on it */}
      <g className="cat" transform="translate(64 20) scale(1.08)" filter="url(#pen)">
        <path className="cat-tail" d="M106 55c-10 8-46 9-74 4" fill="none" stroke={INK} strokeWidth="7.5" strokeLinecap="round" />
        <path className="cat-tail" d="M100 58c-14 5-40 6-62 3" fill="none" stroke={PALE} strokeWidth="0.8" strokeLinecap="round" opacity="0.55" />
        <path className="cat-body" d={cat} fill={INK} stroke="#000" strokeWidth="1.4" strokeLinejoin="round" />
        <g className="cat-body" fill="none" stroke={PALE} strokeLinecap="round">
          {/* the light along her back, and her fur in short strokes */}
          <path d="M47 24c14-6 40-5 54 4" strokeWidth="1" opacity="0.75" />
          <path d="M52 29l3-4M60 27l3-4M68 26l3-4M76 26l3-4M84 28l3-3M91 31l3-3M97 35l3-2" strokeWidth="0.85" opacity="0.6" />
          <path d="M58 36l3-3M68 34l3-3M78 34l3-3M88 37l3-3" strokeWidth="0.75" opacity="0.35" />
          <path d="M9 44c0-6 3-12 8-16" strokeWidth="0.9" opacity="0.6" />
          {/* inside the ears */}
          <path d="M21.5 14.5l2.5 5M45 14l-2 5.5" strokeWidth="1.2" opacity="0.7" />
          {/* eyes shut, and whiskers */}
          <path d="M21 39q3 2.4 6 0" strokeWidth="1.5" />
          <path className="cat-lid" d="M32 39q3 2.4 6 0" strokeWidth="1.5" />
          <path d="M18 46c-6 0-11 1-15 3M18 48c-6 2-10 4-13 7M40 46c6 0 11 1 15 3M40 48c6 2 10 4 13 7" strokeWidth="0.7" opacity="0.7" />
        </g>
        {/* poked, she opens one eye to see who it is, then goes back to sleep */}
        <g className="cat-eye">
          <path d="M31.6 39.4q3.4-3.6 6.8 0q-3.4 2.6-6.8 0z" fill="#d9b13c" stroke={PALE} strokeWidth="0.9" strokeLinejoin="round" />
          <ellipse cx="35.1" cy="39" rx="0.75" ry="1.45" fill={INK} />
        </g>
        <path d="M28 45l1.6 1.4 1.6-1.4" fill="none" stroke="#d48f98" strokeWidth="1.3" strokeLinecap="round" />
      </g>
    </svg>
  );
}
