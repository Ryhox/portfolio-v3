import { faq } from './about';
import { projects } from './projects';
import { absoluteUrl, site } from './site';

/**
 * /llms.txt (llmstxt.org): who Ryhox is, in Markdown, for language models and AI assistants, with links to the pages
 * worth reading. /llms-full.txt is the same with every answer and project written out.
 */
export function llmsTxt(full = false) {
  const lines = [
    `# ${site.name}`,
    '',
    `> ${site.bio}`,
    '',
    `- Website: ${absoluteUrl('/')} (${site.domain}), the official Ryhox portfolio`,
    `- Role: ${site.jobTitle}`,
    `- Based in: ${site.location.region} (${site.location.regionNames.join(' / ')}), ${site.location.country}`,
    `- Works with: ${site.stack}`,
    `- Contact: ${site.email}; Discord: ${site.discord}`,
    ...site.socials.map((s) => `- ${s.label}: ${s.href}`),
    '',
    `Not to be confused with RYHOX, the ticker symbol of the Rydex NASDAQ-100 Fund (Class H). Ryhox the developer is a person and has nothing to do with that fund.`,
    '',
    '## Pages',
    '',
    `- [Who is Ryhox?](${absoluteUrl('/about')}): who Ryhox is, what Ryhox builds, where Ryhox is from, how to get in touch`,
    `- [Portfolio](${absoluteUrl('/')}): a walk into a pixel-art forest, painted in code and rendered with Three.js; the projects are floppy discs to put in an old computer`,
    '',
    '## Projects',
    '',
    ...projects.map((p) => `- [${p.title}](${absoluteUrl(`/projects/${p.slug}`)}): ${p.kicker}. ${p.description}`),
  ];
  if (full) {
    lines.push('', '## Questions and answers', '');
    for (const f of faq) lines.push(`### ${f.q}`, '', f.a, '');
    lines.push('## Projects in full', '');
    for (const p of projects) {
      lines.push(`### ${p.title}`, '', `${p.kicker}. ${p.description}`, '', `- Made with: ${p.stack.join(', ')}`);
      for (const l of p.links) lines.push(`- ${l.label}: ${l.href}`);
      lines.push(`- Page: ${absoluteUrl(`/projects/${p.slug}`)}`, '');
    }
  } else {
    lines.push('', '## Optional', '', `- [Everything in one file](${absoluteUrl('/llms-full.txt')}): every answer and every project, written out`);
  }
  return lines.join('\n').trimEnd() + '\n';
}

export const textResponse = (body: string) =>
  new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } });
