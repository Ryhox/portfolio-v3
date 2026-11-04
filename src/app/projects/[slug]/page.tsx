import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import Chevron from '@/components/site/Chevron';
import { FlourishPaths } from '@/components/site/Flourish';
import { ProjectKeys, ProjectVideo } from '@/components/site/ProjectBits';
import { projects } from '@/content/projects';
import { ld, projectGraph } from '@/content/schema';
import { site } from '@/content/site';

type Props = { params: Promise<{ slug: string }> };

/** One page per project, made at build time; any other name is a 404. */
export const dynamicParams = false;
export function generateStaticParams() {
  return projects.map((p) => ({ slug: p.slug }));
}

const find = async (params: Props['params']) => {
  const { slug } = await params;
  return projects.findIndex((p) => p.slug === slug);
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = projects[await find(params)];
  if (!p) return {};
  const title = `${p.title}: ${p.kicker}`;
  const description = `${p.description} A project by Ryhox, web developer and Three.js engineer from ${site.location.region}.`;
  const image = { url: `/og/${p.slug}.jpg`, width: 1200, height: 630, alt: `${p.title}, a project by Ryhox` };
  return {
    title,
    description,
    alternates: { canonical: `/projects/${p.slug}` },
    openGraph: { type: 'article', url: `/projects/${p.slug}`, title, description, images: [image] },
    twitter: { card: 'summary_large_image', title, description, images: [image] },
  };
}

/**
 * A project on its own page, looking just as it does on the old monitor once you've dived into the glass: the title
 * with its flourish along the top, the film left and what it is right, the neighbours and its links along the bottom,
 * Leave in the corner (back to the forest). What search engines and assistants need is in it too: who made it (and a
 * link to who that is), where to find it, and the neighbouring projects as real links.
 */
export default async function ProjectPage({ params }: Props) {
  const i = await find(params);
  const p = projects[i];
  if (!p) notFound();
  const prev = projects[(i - 1 + projects.length) % projects.length];
  const next = projects[(i + 1) % projects.length];
  const others = projects.filter((o) => o.slug !== p.slug);
  const bare = (href: string) => href.replace(/^https:\/\//, '');
  return (
    <main key={p.slug} className="project-page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ld(projectGraph(p)) }} />
      <ProjectKeys prev={`/projects/${prev.slug}`} next={`/projects/${next.slug}`} />

      {/* the first screen: the monitor's page, just as it is once you've dived in */}
      <section className="project-screen" aria-labelledby="project-title">
      <header className="sp-top">
        <div className="sp-head">
          <h1 id="project-title" className="sp-title">
            {p.title}
          </h1>
          <svg className="sp-flourish" viewBox="0 4 360 34" aria-hidden="true">
            <FlourishPaths />
          </svg>
        </div>
        <Link href="/" className="pixel-btn sp-leave" aria-label="Leave, back to the forest">
          Leave
        </Link>
      </header>

      <div className="sp-mid">
        <div className="sp-media">
          <ProjectVideo slug={p.slug} title={p.title} />
        </div>
        <div className="sp-text">
          <p className="sp-kicker">{p.kicker}</p>
          <p className="sp-desc">{p.description}</p>
          <ul className="sp-tags" aria-label="Made with">
            {p.stack.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
          <p className="sp-by">
            Made by <Link href="/about">Ryhox</Link>, a web developer and Three.js engineer from {site.location.region}.
          </p>
        </div>
      </div>

      <nav className="sp-nav" aria-label="Projects">
        <Link href={`/projects/${prev.slug}`} className="pixel-btn sp-arrow" aria-label={`Previous project: ${prev.title}`} title={prev.title}>
          <Chevron />
        </Link>
        {p.links.map((l) => (
          <a key={l.href} href={l.href} target="_blank" rel="noreferrer" className="pixel-btn" aria-label={`${p.title}: ${l.label} (${bare(l.href)})`} title={bare(l.href)}>
            {l.label}
          </a>
        ))}
        <Link href={`/projects/${next.slug}`} className="pixel-btn sp-arrow" aria-label={`Next project: ${next.title}`} title={next.title}>
          <Chevron flip />
        </Link>
      </nav>
      </section>

      {/* below it, on the same paper: everything else about the project, in words */}
      <section className="project-more" aria-label={`More about ${p.title}`}>
        <svg className="pm-flourish" viewBox="0 4 360 34" aria-hidden="true">
          <FlourishPaths />
        </svg>
        <div className="pm-cols">
          <div>
            <h2>Made with</h2>
            <ul>
              {p.stack.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </div>
          <div>
            <h2>Where to find it</h2>
            <ul>
              {p.links.map((l) => (
                <li key={l.href}>
                  {l.label}: <a href={l.href}>{bare(l.href)}</a>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2>Who made it</h2>
            <p>
              {p.title} is by Ryhox. {site.bio} <Link href="/about">Who is Ryhox?</Link>
            </p>
          </div>
        </div>
        <div className="pm-more">
          <h2>More work</h2>
          <ul className="pm-list">
            {others.map((o) => (
              <li key={o.slug}>
                <Link href={`/projects/${o.slug}`}>
                  <b>{o.title}</b>
                  <span>{o.kicker}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  );
}
