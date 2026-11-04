import { projects } from './projects';
import { site } from './site';

/**
 * "Who is Ryhox?" in plain questions and answers: shown on /about and given to search engines and assistants as an
 * FAQ (the structured data must say what the page says, so both read from here). No pronouns: it says "Ryhox".
 */
export type Faq = { q: string; a: string; /** a list shown under the answer on the page */ more?: 'projects' | 'contact' };

const names = projects.map((p) => p.title);
const list = `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;

export const faq: Faq[] = [
  {
    q: 'Who is Ryhox?',
    a: `${site.bio} This site, ${site.domain}, is the official Ryhox portfolio.`,
  },
  {
    q: 'What does Ryhox build?',
    a: `Real-time 3D on the web with Three.js, everyday apps with Next.js, React and Flutter, and experiments that turn into toys, usually with a few small secrets hidden in them for whoever goes looking. Selected projects: ${list}.`,
    more: 'projects',
  },
  {
    q: 'Where is Ryhox from?',
    a: `${site.location.region} (${site.location.regionNames.join(', ')}), in the north of ${site.location.country}.`,
  },
  {
    q: 'Is Ryhox the RYHOX fund?',
    a: 'No. RYHOX is also the ticker symbol of a mutual fund, the Rydex NASDAQ-100 Fund (Class H). Ryhox the developer has nothing to do with it: this Ryhox is a person who builds websites, 3D worlds and apps.',
  },
  {
    q: 'What does Ryhox work with?',
    a: site.stack,
  },
  {
    q: 'Who made this site?',
    a: `Ryhox did. ${site.domain} is a walk into a pixel-art forest: every sprite is painted in code and rendered with Three.js on Next.js, and a few things are hidden in it.`,
  },
  {
    q: 'How can I contact Ryhox?',
    a: `By email at ${site.email}, on GitHub (github.com/Ryhox), on Modrinth (modrinth.com/user/Ryhox), or on Discord as ${site.discord}.`,
    more: 'contact',
  },
];
