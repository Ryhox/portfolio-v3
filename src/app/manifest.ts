import type { MetadataRoute } from 'next';
import { site } from '@/content/site';

/** The site's name and icon, for browsers and for anything that wants to know what this site is called. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${site.name}: ${site.jobTitle}`,
    short_name: site.name,
    description: site.description,
    start_url: '/',
    display: 'browser',
    background_color: '#efe8d4',
    theme_color: '#efe8d4',
    icons: [
      { src: '/icon.svg', type: 'image/svg+xml', sizes: 'any' },
      { src: '/apple-icon.png', type: 'image/png', sizes: '180x180' },
    ],
  };
}
