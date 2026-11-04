/**
 * Identity, SEO and contact details. Change the values here; metadata, JSON-LD, llms.txt and the pages read from this
 * file.
 */
export const site = {
  name: 'Ryhox',
  /**
   * Production origin, no trailing slash: www, because that's where the host sends ryhox.dev (a canonical that
   * redirects is a mixed signal). NEXT_PUBLIC_SITE_URL in the hosting env overrides it, so keep that on www too.
   */
  url: (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.ryhox.dev').replace(/\/$/, ''),
  /** The bare domain, as people write it. */
  domain: 'ryhox.dev',
  title: 'Ryhox | Web Developer & Three.js Engineer',
  jobTitle: 'Web Developer & Three.js Engineer',
  description:
    'Ryhox is a web developer and Three.js engineer from South Tyrol, making real-time 3D worlds and everyday apps. The official Ryhox portfolio.',
  /** One plain answer to "who is Ryhox?", for llms.txt, the Who page and structured data. */
  bio:
    'Ryhox is a web developer and Three.js engineer from South Tyrol, Italy. A student and self-taught developer, Ryhox has been building for the web for a few years: mostly real-time 3D worlds that run in the browser, and apps people use every day.',
  /** Used by schema.org to separate the person from the unrelated fund ticker of the same letters. */
  disambiguation:
    'Ryhox is a web developer and Three.js engineer from South Tyrol, Italy. Not the RYHOX mutual fund ticker (Rydex NASDAQ-100 Fund, Class H).',
  location: {
    region: 'South Tyrol',
    /** The same place in German and Italian, as people search for it. */
    regionNames: ['Südtirol', 'Alto Adige'],
    country: 'Italy',
    countryCode: 'IT',
  },
  email: 'contact@ryhox.dev',
  /** Discord has no public profile URL, so the handle is copied to the clipboard. */
  discord: 'ryhox',
  locale: 'en',
  socials: [
    { label: 'GitHub', href: 'https://github.com/Ryhox' },
    { label: 'Modrinth', href: 'https://modrinth.com/user/Ryhox' },
  ],
  /** Kept in step with the tech stack on the page (components/site/Crew.tsx). */
  knowsAbout: [
    'Web development',
    'Creative development',
    'Real-time 3D',
    'Three.js',
    'GSAP',
    'JavaScript',
    'TypeScript',
    'React',
    'Next.js',
    'Flutter',
    'Node.js',
    'PostgreSQL',
    'MySQL',
    'Java',
    'C#',
    'Arduino',
    'Minecraft modding',
    'Pixel art',
  ],
  /** The tech stack in words, for the Who page and llms.txt. */
  stack:
    'Three.js, GSAP and Lenis for 3D and motion; JavaScript, TypeScript, React, Next.js and Flutter for apps; Node.js, PostgreSQL and MySQL on the server; Java, C# and Arduino for mods and hardware.',
  /** When the words on the site last changed (the sitemap and the pages' "last updated"). */
  updated: '2026-11-04',
} as const;

export const absoluteUrl = (path = '/') => `${site.url}${path.startsWith('/') ? path : `/${path}`}`;

/** Crawlers for AI search and assistants, welcomed by name in robots.txt (everyone else is welcome too). */
export const aiCrawlers = [
  'GPTBot',
  'OAI-SearchBot',
  'ChatGPT-User',
  'ClaudeBot',
  'Claude-SearchBot',
  'Claude-User',
  'anthropic-ai',
  'PerplexityBot',
  'Perplexity-User',
  'Google-Extended',
  'Applebot',
  'Applebot-Extended',
  'Bingbot',
  'DuckAssistBot',
  'meta-externalagent',
  'MistralAI-User',
  'cohere-ai',
  'YouBot',
  'CCBot',
];
