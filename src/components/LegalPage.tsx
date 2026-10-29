import Link from 'next/link';

/** A plain reading page for the legal bits: a way back, the title, the text. */
export default function LegalPage({ title, lead, updated, children }: { title: string; lead: string; updated: string; children: React.ReactNode }) {
  return (
    <main className="legal">
      <Link href="/" className="legal-back">
        ← Back to the forest
      </Link>
      <h1>{title}</h1>
      <p className="legal-lead">{lead}</p>
      {children}
      <p className="legal-updated">Last updated {updated}</p>
    </main>
  );
}
