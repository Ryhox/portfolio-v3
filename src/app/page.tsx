import Link from 'next/link';
import Forest from '@/components/Forest';
import Loader from '@/components/Loader';
import Pill from '@/components/Pill';
import PlayUI from '@/components/PlayUI';
import Socials from '@/components/Socials';
import Work from '@/components/Work';
import { site } from '@/content/site';

/**
 * One long walk: the edge of the wood (hero), the trees, the clearing with the computer (work),
 * and the cat's hollow (footer). The canvas behind follows the scroll.
 */
export default function Home() {
  return (
    <>
      <Loader />
      <Forest />
      <main>
        <section className="hero" data-stage="hero">
          {/* the name you see floats in the forest; this one is for readers and search */}
          <h1 className="sr-only">Ryhox, {site.jobTitle.toLowerCase()}</h1>
          <Socials className="socials hero-socials" pin="socials" />
        </section>
        <div className="walk" aria-hidden="true" />
        <Work />
        <div className="walk walk-out" aria-hidden="true" />
      </main>
      <footer className="end" data-stage="end">
        <Pill />
        <div className="end-inner">
          <p className="end-title">Thanks for wandering in.</p>
          <a className="end-mail" href={`mailto:${site.email}`}>
            {site.email}
          </a>
          <Socials className="socials end-socials" pixel />
          <p className="end-small">
            <span>© {new Date().getFullYear()} Ryhox</span>
            <Link href="/imprint">Imprint</Link>
            <Link href="/privacy">Privacy</Link>
          </p>
        </div>
      </footer>
      <PlayUI />
    </>
  );
}
