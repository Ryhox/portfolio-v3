import type { Metadata, Viewport } from 'next';
import { Caveat, Fraunces, Instrument_Sans, Pixelify_Sans } from 'next/font/google';
import { absoluteUrl, site } from '@/content/site';
import './globals.css';

const display = Fraunces({
  subsets: ['latin'],
  axes: ['SOFT', 'WONK', 'opsz'],
  variable: '--font-display',
  display: 'swap',
});

const hand = Caveat({
  subsets: ['latin'],
  variable: '--font-hand',
  display: 'swap',
});

const pixel = Pixelify_Sans({
  subsets: ['latin'],
  variable: '--font-pixel',
  display: 'swap',
});

const text = Instrument_Sans({
  subsets: ['latin'],
  variable: '--font-text',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: { default: site.title, template: '%s | Ryhox' },
  description: site.description,
  applicationName: 'Ryhox',
  authors: [{ name: site.name, url: site.url }],
  creator: site.name,
  keywords: ['Ryhox', 'Ryhox developer', 'Ryhox portfolio', 'creative developer', 'Three.js developer', 'WebGL developer', 'pixel art'],
  openGraph: { type: 'website', siteName: 'Ryhox', locale: 'en_US', title: site.title, description: site.description },
  twitter: { card: 'summary_large_image', title: site.title, description: site.description },
  robots: { index: true, follow: true },
  alternates: { canonical: '/' },
  formatDetection: { telephone: false, email: false, address: false },
};

export const viewport: Viewport = {
  themeColor: '#59684c',
  colorScheme: 'light',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

const person = {
  '@context': 'https://schema.org',
  '@type': 'Person',
  '@id': absoluteUrl('/#ryhox'),
  name: site.name,
  url: absoluteUrl('/'),
  jobTitle: site.jobTitle,
  description: site.description,
  disambiguatingDescription: site.disambiguation,
  email: `mailto:${site.email}`,
  knowsAbout: site.knowsAbout,
  sameAs: site.socials.map((s) => s.href),
};

const PIXEL_SIZE = `(function(){var d=document.documentElement,r=Math.min(window.devicePixelRatio||1,3),w=Math.round(innerWidth*r),h=Math.round(innerHeight*r),s=Math.max(1,Math.round(Math.min(w,h)/250));d.style.setProperty('--px',s/r+'px');d.dataset.shape=Math.ceil(w/s)/Math.ceil(h/s)>1.15?'wide':'tall';})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${text.variable} ${hand.variable} ${pixel.variable}`} suppressHydrationWarning>
      <head>
        {/* before first paint: the game-pixel size and screen shape, so the snapshot of the forest lands exactly */}
        <script dangerouslySetInnerHTML={{ __html: PIXEL_SIZE }} />
      </head>
      <body>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(person).replace(/</g, '\\u003c') }} />
        {children}
      </body>
    </html>
  );
}
