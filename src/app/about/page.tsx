import type { Metadata } from 'next';
import Link from 'next/link';
import LegalPage from '@/components/LegalPage';
import { faq } from '@/content/about';
import { projects } from '@/content/projects';
import { aboutGraph, ld } from '@/content/schema';
import { site } from '@/content/site';

export const metadata: Metadata = {
  title: 'Who is Ryhox?',
  description: `${site.bio.split('. ')[0]}. Who Ryhox is, what Ryhox builds, and how to get in touch.`,
  alternates: { canonical: '/about' },
  // its own openGraph replaces the site's, so the share image is named again here
  openGraph: { type: 'profile', url: '/about', title: 'Who is Ryhox?', description: site.bio, images: [{ url: '/opengraph-image.png', width: 1200, height: 630 }] },
  twitter: { card: 'summary_large_image', title: 'Who is Ryhox?', description: site.bio, images: ['/opengraph-image.png'] },
};

/**
 * Who is Ryhox, in plain questions and answers, for people and for search engines and assistants (it's the page they
 * quote). Not linked from the forest's own pages on request; the sitemap, llms.txt and the project pages lead here.
 */
export default function About() {
  return (
    <LegalPage title="Who is Ryhox?" lead={`The person behind ${site.domain}, in a few plain answers.`}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ld(aboutGraph()) }} />
      {faq.map((f) => (
        <section key={f.q} id={f.more === 'projects' ? 'work' : undefined}>
          <h2>{f.q}</h2>
          <p>{f.a}</p>
          {f.more === 'projects' ? (
            <ul>
              {projects.map((p) => (
                <li key={p.slug}>
                  <Link href={`/projects/${p.slug}`}>{p.title}</Link>: {p.kicker}.
                </li>
              ))}
            </ul>
          ) : null}
          {f.more === 'contact' ? (
            <ul>
              <li>
                Email: <a href={`mailto:${site.email}`}>{site.email}</a>
              </li>
              {site.socials.map((s) => (
                <li key={s.href}>
                  {s.label}:{' '}
                  <a href={s.href} rel="me">
                    {s.href.replace(/^https:\/\//, '')}
                  </a>
                </li>
              ))}
              <li>Discord: {site.discord}</li>
            </ul>
          ) : null}
        </section>
      ))}
    </LegalPage>
  );
}
