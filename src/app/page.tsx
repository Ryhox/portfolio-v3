import Link from 'next/link';
import Forest from '@/components/Forest';
import Loader from '@/components/Loader';
import PlayUI from '@/components/PlayUI';
import Socials from '@/components/Socials';
import Work from '@/components/Work';
import About from '@/components/site/About';
import Dive from '@/components/site/Dive';
import Crew from '@/components/site/Crew';
import Intro from '@/components/site/Intro';
import Nav from '@/components/site/Nav';
import SiteFx from '@/components/site/SiteFx';
import { homeGraph, ld } from '@/content/schema';
import { site } from '@/content/site';

/**
 * The page: the name on white, bursting into the evening (who); the crew (what with); then a drawing of the
 * clearing that comes alive into the wood itself, where the computer is (work), and the walk on to the cat's
 * hollow (footer). The canvas behind follows the scroll.
 */
export default function Home() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ld(homeGraph()) }} />
      <Forest />
      <Nav />
      <Loader />
      <main>
        <div className="site">
          <Intro />
          <About />
          <Crew />
        </div>
        <Dive />
        <Work />
        <div className="walk walk-out" aria-hidden="true" />
      </main>
      <footer className="end" data-stage="end">
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
      <SiteFx />
    </>
  );
}
