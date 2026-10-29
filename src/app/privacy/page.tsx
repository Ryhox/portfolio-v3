import type { Metadata } from 'next';
import Link from 'next/link';
import LegalPage from '@/components/LegalPage';
import { site } from '@/content/site';

export const metadata: Metadata = {
  title: 'Privacy',
  description: 'What ryhox.dev does with your data: very little. No cookies, no tracking, no analytics.',
  alternates: { canonical: '/privacy' },
};

/** Privacy policy (GDPR). */
export default function Privacy() {
  return (
    <LegalPage title="Privacy" lead="No cookies, no tracking, no analytics. Here’s the little that does happen." updated="October 2026">
      <section>
        <h2>Who’s responsible</h2>
        <p>
          Ryhox, who runs this site (see <Link href="/imprint">Imprint</Link>). Questions about your data:{' '}
          <a href={`mailto:${site.email}`}>{site.email}</a>
        </p>
      </section>
      <section>
        <h2>Visiting the site</h2>
        <p>
          The site is hosted by Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, USA. Like every web server, it logs
          technical data about each request (IP address, time, page, browser) to deliver the site and keep it secure. Legal basis:
          legitimate interest, Art. 6 (1)(f) GDPR. The logs are deleted after a short time. Vercel may process this data outside
          the EU under the safeguards of its data processing agreement.{' '}
          <a href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noreferrer">
            Vercel’s privacy policy
          </a>
        </p>
        <p>Fonts, pictures and videos are all served from this site itself. Nothing is loaded from Google or anyone else.</p>
      </section>
      <section>
        <h2>Stored in your browser</h2>
        <p>Nothing. No cookies, no local storage.</p>
      </section>
      <section>
        <h2>Links and contact</h2>
        <p>
          Links to other sites (GitHub, Modrinth, project demos) only take you there when you click them, where their own privacy
          policies apply. If you email me, your address and message are used only to reply. The Discord button just copies my
          username.
        </p>
      </section>
      <section>
        <h2>Your rights</h2>
        <p>
          You can ask for access to your data, have it corrected or deleted, restrict or object to its processing, and take it with
          you (Art. 15 to 21 GDPR). You can also complain to the{' '}
          <a href="https://www.garanteprivacy.it" target="_blank" rel="noreferrer">
            Garante per la protezione dei dati personali
          </a>
          .
        </p>
      </section>
    </LegalPage>
  );
}
