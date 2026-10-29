import type { Metadata } from 'next';
import LegalPage from '@/components/LegalPage';
import { site } from '@/content/site';

export const metadata: Metadata = {
  title: 'Imprint',
  description: 'Who runs ryhox.dev, and the credits.',
  alternates: { canonical: '/imprint' },
};

/** Legal notice and credits. A personal site run from Italy: no company details to list. */
export default function Imprint() {
  return (
    <LegalPage title="Imprint" lead="Who runs this site, and the credits." updated="October 2026">
      <section>
        <h2>Who runs this site</h2>
        <p>
          Ryhox, a personal portfolio. Contact: <a href={`mailto:${site.email}`}>{site.email}</a>
        </p>
        <p>
          This is a personal, non-commercial website: it doesn’t sell anything or provide paid services online, so it isn’t an
          information society service under Italian law (D.Lgs. 70/2003) and has no company details to list.
        </p>
      </section>
      <section>
        <h2>Credits</h2>
        <ul>
          <li>Fonts: Fraunces, Instrument Sans and Caveat, SIL Open Font License 1.1.</li>
          <li>Everything else (design, code, every pixel of the forest, the portrait, project videos) is my own work.</li>
        </ul>
      </section>
      <section>
        <h2>Trademarks</h2>
        <p>Ryhox is a person and has nothing to do with the RYHOX mutual fund ticker.</p>
      </section>
      <section>
        <h2>Liability</h2>
        <p>
          I keep this site accurate as best I can, but can’t promise it’s complete or up to date. Links to other sites are checked
          when added; what’s on them is up to whoever runs them.
        </p>
      </section>
    </LegalPage>
  );
}
