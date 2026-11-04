import type { Metadata, Viewport } from 'next';
import { Caveat, Fraunces, Instrument_Sans, Pixelify_Sans } from 'next/font/google';
import { ld, siteGraph } from '@/content/schema';
import { site } from '@/content/site';
import './globals.css';
import './site.css';
import './play.css';

const display = Fraunces({
  subsets: ['latin'],
  style: ['normal', 'italic'],
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
  publisher: site.name,
  category: 'technology',
  keywords: [
    'Ryhox',
    'who is Ryhox',
    'Ryhox developer',
    'Ryhox portfolio',
    'Ryhox web developer',
    'Ryhox Three.js',
    'Ryhox South Tyrol',
    'Ryhox Südtirol',
    'web developer South Tyrol',
    'Three.js developer',
    'creative developer',
    'pixel art portfolio',
  ],
  openGraph: { type: 'website', siteName: 'Ryhox', locale: 'en_US', url: '/', title: site.title, description: site.description },
  twitter: { card: 'summary_large_image', title: site.title, description: site.description },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1, 'max-video-preview': -1 } },
  alternates: { canonical: '/' },
  formatDetection: { telephone: false, email: false, address: false },
  // Search Console / Bing Webmaster Tools: put their verification codes in the hosting env (only the code, not the tag)
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION || undefined,
    other: process.env.BING_SITE_VERIFICATION ? { 'msvalidate.01': process.env.BING_SITE_VERIFICATION } : undefined,
  },
};

export const viewport: Viewport = {
  themeColor: '#efe8d4',
  colorScheme: 'light',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

const PIXEL_SIZE = `(function(){var d=document.documentElement,r=Math.min(window.devicePixelRatio||1,3),w=Math.round(innerWidth*r),h=Math.round(innerHeight*r),s=Math.max(1,Math.round(Math.min(w,h)/250));d.style.setProperty('--px',s/r+'px');d.dataset.shape=Math.ceil(w/s)/Math.ceil(h/s)>1.15?'wide':'tall';var q=null;try{q=new URLSearchParams(location.search).get('season')||sessionStorage.getItem('season')}catch(e){}var m=new Date().getMonth();d.dataset.season=/^(spring|summer|autumn|winter)$/.test(q||'')?q:m==11||m<2?'winter':m<5?'spring':m<8?'summer':'autumn';})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${text.variable} ${hand.variable} ${pixel.variable}`} suppressHydrationWarning>
      <head>
        {/* before first paint: the art-pixel size, the screen's shape and the season, so the page is painted right at once */}
        <script dangerouslySetInnerHTML={{ __html: PIXEL_SIZE }} />
      </head>
      <body>
        {/* who Ryhox is and which site this is, on every page (the pages add their own part, pointing at these) */}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ld(siteGraph()) }} />
        {children}
      </body>
    </html>
  );
}
