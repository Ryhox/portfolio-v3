import Link from 'next/link';
import { Suspense } from 'react';
import Forest from '@/components/Forest';
import Later from '@/components/Later';
import Loader from '@/components/Loader';
import { About, Crew, Dive, PlayUI, SiteFx, Socials, Work } from '@/components/Parts';
import Intro from '@/components/site/Intro';
import Nav from '@/components/site/Nav';
import { homeGraph, ld } from '@/content/schema';
import { site } from '@/content/site';

/**
 * The page: the name on white, bursting into the evening (who); the crew (what with); then a drawing of the
 * clearing that comes alive into the wood itself, where the computer is (work), and the walk on to the cat's
 * hollow (footer). The canvas behind follows the scroll.
 *
 * Each part is its own Suspense boundary, so React brings them to life one by one in separate tasks. The parts further
 * down (`Later`) are there as HTML from the first paint but come alive only as you near them: the first seconds are
 * the name's alone.
 */
export default function Home() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ld(homeGraph()) }} />
      <Suspense>
        <Forest />
      </Suspense>
      <Suspense>
        <Nav />
      </Suspense>
      <Loader />
      <main>
        <div className="site">
          <Suspense>
            <Intro />
          </Suspense>
          <Later id="about" near="#hello" margin="50%" touched>
            <About />
          </Later>
          <Later id="crew" near="#crew">
            <Crew />
          </Later>
        </div>
        {/* one boundary for both: the clearing's stage overlaps the drawing's (`.dive + .work`) */}
        <Later id="work" near="#work-intro" margin="200%">
          <Dive />
          <Work />
        </Later>
        <div className="walk walk-out" aria-hidden="true" />
      </main>
      <footer className="end" data-stage="end">
        <div className="end-inner">
          <p className="end-title">Thanks for wandering in.</p>
          <a className="end-mail" href={`mailto:${site.email}`}>
            {site.email}
          </a>
          <Later id="end" near="footer.end">
            <Socials className="socials end-socials" pixel />
          </Later>
          <p className="end-small">
            <span>© {new Date().getFullYear()} Ryhox</span>
            <Link href="/imprint">Imprint</Link>
            <Link href="/privacy">Privacy</Link>
          </p>
        </div>
      </footer>
      <Later id="play" play>
        <PlayUI />
      </Later>
      <Later id="fx" touched near="#hello" margin="50%">
        <SiteFx />
      </Later>
    </>
  );
}
