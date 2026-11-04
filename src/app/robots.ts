import type { MetadataRoute } from 'next';
import { absoluteUrl, aiCrawlers, site } from '@/content/site';

/**
 * Everyone may read everything: search engines, and the crawlers of AI search and assistants by name, so "who is
 * Ryhox?" has an answer there. The sitemap lists every page; llms.txt is the short version for language models.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*', allow: '/' },
      { userAgent: aiCrawlers, allow: ['/', '/llms.txt', '/llms-full.txt'] },
    ],
    sitemap: absoluteUrl('/sitemap.xml'),
    host: site.url,
  };
}
