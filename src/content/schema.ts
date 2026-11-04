import { faq } from './about';
import { projects, type Project } from './projects';
import { absoluteUrl, site } from './site';

/**
 * Structured data (schema.org JSON-LD) so search engines and assistants know who Ryhox is: one Person and one
 * WebSite, referred to by id from every page, so it all adds up to the same person (not the fund).
 */
export const ids = {
  person: absoluteUrl('/#ryhox'),
  website: absoluteUrl('/#website'),
};

const image = absoluteUrl('/opengraph-image.png');

const place = {
  '@type': 'Place',
  name: `${site.location.region}, ${site.location.country}`,
  alternateName: site.location.regionNames,
  address: { '@type': 'PostalAddress', addressRegion: site.location.region, addressCountry: site.location.countryCode },
};

export const person = {
  '@type': 'Person',
  '@id': ids.person,
  name: site.name,
  url: absoluteUrl('/'),
  image,
  jobTitle: site.jobTitle,
  description: site.bio,
  disambiguatingDescription: site.disambiguation,
  email: `mailto:${site.email}`,
  homeLocation: place,
  knowsAbout: site.knowsAbout,
  knowsLanguage: ['en', 'de', 'it'],
  hasOccupation: {
    '@type': 'Occupation',
    name: 'Web developer',
    occupationLocation: { '@type': 'AdministrativeArea', name: site.location.region },
    skills: site.knowsAbout.join(', '),
  },
  sameAs: site.socials.map((s) => s.href),
  mainEntityOfPage: absoluteUrl('/about'),
};

export const website = {
  '@type': 'WebSite',
  '@id': ids.website,
  url: absoluteUrl('/'),
  name: site.name,
  alternateName: [site.domain, 'Ryhox portfolio'],
  description: site.description,
  inLanguage: site.locale,
  author: { '@id': ids.person },
  publisher: { '@id': ids.person },
  copyrightHolder: { '@id': ids.person },
};

/** A project, as a piece of software Ryhox made (with its source where there is one). */
export function projectNode(p: Project) {
  const visit = p.links.find((l) => l.label !== 'Source');
  const source = p.links.find((l) => l.label === 'Source');
  return {
    '@type': 'CreativeWork',
    '@id': absoluteUrl(`/projects/${p.slug}#work`),
    name: p.title,
    headline: p.kicker,
    description: p.description,
    url: absoluteUrl(`/projects/${p.slug}`),
    ...(visit ? { sameAs: visit.href } : {}),
    ...(source ? { codeRepository: source.href } : {}),
    keywords: p.stack.join(', '),
    image: absoluteUrl(`/og/${p.slug}.jpg`),
    video: { '@type': 'VideoObject', name: `${p.title}: a look at it`, description: p.description, contentUrl: absoluteUrl(`/work/${p.slug}.mp4`), thumbnailUrl: absoluteUrl(`/og/${p.slug}.jpg`), uploadDate: site.updated },
    author: { '@id': ids.person },
    creator: { '@id': ids.person },
    inLanguage: site.locale,
  };
}

const crumbs = (trail: { name: string; path: string }[]) => ({
  '@type': 'BreadcrumbList',
  itemListElement: trail.map((t, i) => ({ '@type': 'ListItem', position: i + 1, name: t.name, item: absoluteUrl(t.path) })),
});

/** Everything on every page: who and which site. */
export const siteGraph = () => ({ '@context': 'https://schema.org', '@graph': [person, website] });

/** The landing: the portfolio is a profile of Ryhox, with the projects on it. */
export const homeGraph = () => ({
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'ProfilePage',
      '@id': absoluteUrl('/#page'),
      url: absoluteUrl('/'),
      name: site.title,
      description: site.description,
      isPartOf: { '@id': ids.website },
      mainEntity: { '@id': ids.person },
      about: { '@id': ids.person },
      dateModified: site.updated,
      primaryImageOfPage: image,
      hasPart: { '@id': absoluteUrl('/#work') },
    },
    {
      '@type': 'ItemList',
      '@id': absoluteUrl('/#work'),
      name: 'Selected work by Ryhox',
      itemListElement: projects.map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: absoluteUrl(`/projects/${p.slug}`), name: p.title })),
    },
  ],
});

/** The Who page: about Ryhox, and the same questions as an FAQ. */
export const aboutGraph = () => ({
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': ['AboutPage', 'ProfilePage'],
      '@id': absoluteUrl('/about#page'),
      url: absoluteUrl('/about'),
      name: 'Who is Ryhox?',
      isPartOf: { '@id': ids.website },
      mainEntity: { '@id': ids.person },
      about: { '@id': ids.person },
      dateModified: site.updated,
    },
    {
      '@type': 'FAQPage',
      '@id': absoluteUrl('/about#faq'),
      url: absoluteUrl('/about'),
      isPartOf: { '@id': ids.website },
      mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
    },
    crumbs([
      { name: site.name, path: '/' },
      { name: 'Who is Ryhox?', path: '/about' },
    ]),
  ],
});

/** A project's page. */
export const projectGraph = (p: Project) => ({
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebPage',
      '@id': absoluteUrl(`/projects/${p.slug}#page`),
      url: absoluteUrl(`/projects/${p.slug}`),
      name: `${p.title} by Ryhox`,
      description: p.description,
      isPartOf: { '@id': ids.website },
      mainEntity: { '@id': absoluteUrl(`/projects/${p.slug}#work`) },
      author: { '@id': ids.person },
    },
    projectNode(p),
    crumbs([
      { name: site.name, path: '/' },
      { name: p.title, path: `/projects/${p.slug}` },
    ]),
  ],
});

/** For a `<script type="application/ld+json">`, safe inside HTML. */
export const ld = (data: object) => JSON.stringify(data).replace(/</g, '\\u003c');
