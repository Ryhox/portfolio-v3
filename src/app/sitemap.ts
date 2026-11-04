import type { MetadataRoute } from 'next';
import { projects } from '@/content/projects';
import { absoluteUrl, site } from '@/content/site';

/** Every page there is: the forest, who Ryhox is, a page per project, and the legal bits. */
export default function sitemap(): MetadataRoute.Sitemap {
  const at = new Date(site.updated);
  return [
    { url: absoluteUrl('/'), lastModified: at, changeFrequency: 'monthly', priority: 1, images: [absoluteUrl('/opengraph-image.png')] },
    { url: absoluteUrl('/about'), lastModified: at, changeFrequency: 'monthly', priority: 0.9 },
    ...projects.map((p) => ({
      url: absoluteUrl(`/projects/${p.slug}`),
      lastModified: at,
      changeFrequency: 'yearly' as const,
      priority: 0.7,
      images: [absoluteUrl(`/og/${p.slug}.jpg`)],
      videos: [
        {
          title: p.title,
          description: p.description,
          thumbnail_loc: absoluteUrl(`/og/${p.slug}.jpg`),
          content_loc: absoluteUrl(`/work/${p.slug}.mp4`),
        },
      ],
    })),
    { url: absoluteUrl('/imprint'), lastModified: at, changeFrequency: 'yearly', priority: 0.2 },
    { url: absoluteUrl('/privacy'), lastModified: at, changeFrequency: 'yearly', priority: 0.2 },
  ];
}
