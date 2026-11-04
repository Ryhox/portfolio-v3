import type { Metadata } from 'next';
import Link from 'next/link';
import { FlourishPaths } from '@/components/site/Flourish';
import LostTrees from '@/components/site/LostTrees';

export const metadata: Metadata = {
  title: 'Lost in the wood',
  description: 'There’s no page here. Back to the forest?',
};

const RED = '#b8452f';
const OCHRE = '#d9a53a';
const PALE = '#f6f1e2';

/** A flower on a thin stem: five round petals round a dot. */
function Flower({ x, y, c, h = 14 }: { x: number; y: number; c: string; h?: number }) {
  const petals = [0, 72, 144, 216, 288].map((a) => [Math.cos((a * Math.PI) / 180) * 3.2, Math.sin((a * Math.PI) / 180) * 3.2 - h]);
  return (
    <g transform={`translate(${x} ${y})`}>
      <path d={`M0 0c1-${h * 0.4} -1-${h * 0.7} 0-${h}`} strokeWidth="1.1" />
      <path d={`M0-${h * 0.45}c3-3 6-3 8-1-3 2-6 2-8 1z`} fill="var(--paper)" strokeWidth="0.9" />
      {petals.map(([px, py], i) => (
        <circle key={i} cx={px.toFixed(1)} cy={py.toFixed(1)} r="2.4" fill={c} strokeWidth="0.8" />
      ))}
      <circle cx="0" cy={-h} r="1.3" fill="currentColor" stroke="none" />
    </g>
  );
}

/** A toadstool: a red cap with pale spots on a pale stem. */
function Mushroom({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M-3.5-9c0 4 0 7-1 9h9c-1-2-1-5-1-9" fill={PALE} />
      <path d="M-11-9c0-9 22-9 22 0z" fill={RED} />
      <circle cx="-4" cy="-12" r="1.4" fill={PALE} strokeWidth="0.6" />
      <circle cx="3" cy="-14" r="1.1" fill={PALE} strokeWidth="0.6" />
      <circle cx="6" cy="-10.5" r="0.9" fill={PALE} strokeWidth="0.6" />
    </g>
  );
}

const tuft = (x: number, y = 268) => `M${x} ${y}l3-9 2 9 3-12 2 12 3-7 2 7`;

/**
 * Lost: the page's doodle of a fork in the wood, in pen on its paper: a wooden signpost with "404" on it, the trees
 * of the wood either side (its own pixel trees), and doodled grass, flowers and toadstools, two birds. Then the way
 * back.
 */
export default function NotFound() {
  return (
    <main className="nf">
      <div className="nf-scene">
        {/* the wood's own pixel trees either side, behind the ink */}
        <LostTrees />
        <svg viewBox="0 0 720 320" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <defs>
            <filter id="nf-pen" x="-5%" y="-5%" width="110%" height="110%">
              <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" />
              <feDisplacementMap in="SourceGraphic" scale="1.4" />
            </filter>
          </defs>

          <g filter="url(#nf-pen)">
            {/* two birds, far off */}
            <path d="M520 58c4-4 8-4 10 0 2-4 6-4 10 0M556 76c3-3 6-3 8 0 2-3 5-3 8 0" strokeWidth="1.4" />

            {/* the ground, and the path going on into the wood */}
            <path d="M30 268c40-3 80 2 120 0s90-4 130-1 70 3 110 1 80-3 120-1 80 2 180 1" />
            <path d="M272 320c34-14 56-32 68-52M452 320c-34-14-56-32-68-52" />
            <path d="M334 304c6-2 12-1 16-2M378 292c5 1 9 0 12 1M352 282c4 0 7 0 10-1" strokeWidth="1.1" opacity="0.6" />

            {/* the signpost: its post, shaded on one side, and two planks */}
            <path d="M354 270V102M366 270V100M354 102c2-5 10-5 12-2" />
            <path d="M360 116l5-4M360 132l5-4M360 196l5-4M360 212l5-4M360 228l5-4M360 244l5-4M360 260l5-4" strokeWidth="1" />
            <path d="M268 110h132l-2 36H268l-20-18z" fill="var(--paper)" />
            <path d="M362 117c8-1 14 0 22-1M266 139c8 1 14 0 20 0M400 166c8-1 14 0 20-1" strokeWidth="0.9" opacity="0.5" />
            <circle cx="390" cy="119" r="1.6" fill="currentColor" stroke="none" />
            <circle cx="390" cy="137" r="1.6" fill="currentColor" stroke="none" />
            <path d="M318 158h118l20 15-20 15H318z" fill="var(--paper)" />
            <circle cx="326" cy="166" r="1.4" fill="currentColor" stroke="none" />
            <circle cx="326" cy="180" r="1.4" fill="currentColor" stroke="none" />
          </g>
          <text x="322" y="140" textAnchor="middle" className="nf-sign-big" fill="currentColor" stroke="none">
            404
          </text>
          <text x="388" y="179" textAnchor="middle" className="nf-sign" fill="currentColor" stroke="none">
            page not found
          </text>

          <g filter="url(#nf-pen)">
            {/* grass, flowers and toadstools along the edge of the path */}
            <path d={[50, 82, 150, 176, 232, 262, 300, 342, 412, 448, 486, 560, 650, 684].map((x) => tuft(x)).join('')} strokeWidth="1.2" />
            <Flower x={70} y={268} c={RED} />
            <Flower x={140} y={268} c={OCHRE} h={11} />
            <Flower x={246} y={268} c={PALE} h={16} />
            <Flower x={286} y={268} c={RED} h={10} />
            <Flower x={470} y={268} c={OCHRE} h={15} />
            <Flower x={574} y={268} c={RED} h={12} />
            <Flower x={670} y={268} c={PALE} h={14} />
            <Mushroom x={210} y={268} />
            <Mushroom x={224} y={268} s={0.7} />
            <Mushroom x={500} y={268} s={0.85} />
            <Mushroom x={344} y={268} s={0.6} />
          </g>
        </svg>
      </div>

      <h1 className="nf-title">Lost in the wood</h1>
      <svg className="pm-flourish nf-flourish" viewBox="0 4 360 34" aria-hidden="true">
        <FlourishPaths />
      </svg>
      <p className="nf-lead">There’s no page here. Maybe it was never planted, or the path has grown over.</p>
      <Link href="/" className="pixel-btn">
        Back to the forest
      </Link>
    </main>
  );
}
