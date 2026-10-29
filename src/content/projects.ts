/**
 * The discs in the clearing, one per project, in the order they lie in the grass.
 * `disc` is the colour of the floppy and its label stripe; `screen` is the picture the old monitor shows
 * (made from assets/work by `npm run screens`).
 */
export type Project = {
  slug: string;
  title: string;
  kicker: string;
  description: string;
  stack: string[];
  links: { label: string; href: string }[];
  disc: { body: string; stripe: string };
};

export const projects: Project[] = [
  {
    slug: 'stargazer',
    title: 'Stargazer Islands',
    kicker: 'An island for every star',
    description: 'An explorable Three.js island world. Star the repo and you get your own island in it.',
    stack: ['Three.js', 'React Three Fiber', 'GLSL'],
    links: [
      { label: 'Visit', href: 'https://threejs.ryhox.dev' },
      { label: 'Source', href: 'https://github.com/Ryhox/Stargazer-Islands' },
    ],
    disc: { body: '#26324a', stripe: '#d9b44a' },
  },
  {
    slug: 'wieland',
    title: 'Wieland AI',
    kicker: 'A private assistant on your own machine',
    description: 'A locally hosted AI assistant running on Ollama. Private, fast, no cloud required.',
    stack: ['JavaScript', 'Ollama'],
    links: [
      { label: 'Visit', href: 'https://ai.ryhox.dev' },
      { label: 'Source', href: 'https://github.com/Ryhox/Wieland-AI' },
    ],
    disc: { body: '#2c2c2f', stripe: '#8fb3c9' },
  },
  {
    slug: 'pokyh',
    title: 'Pokyh',
    kicker: 'WebUntis, reimagined',
    description: 'Timetable, grades and the cafeteria menu in one installable app, with push notifications that actually arrive.',
    stack: ['Next.js', 'PWA', 'Push notifications'],
    links: [
      { label: 'Visit', href: 'https://pokyh.com' },
      { label: 'Source', href: 'https://github.com/bedchem/pokyh-frontend' },
    ],
    disc: { body: '#2d5752', stripe: '#e0a25a' },
  },
  {
    slug: 'flylab',
    title: 'Fly Lab',
    kicker: 'A fruit fly with a gambling problem',
    description: 'A real fruit-fly connectome, a stubborn little gambler, and a slot machine that never pays.',
    stack: ['Connectome simulation', 'WebGL'],
    links: [
      { label: 'Visit', href: 'https://fly.pokyh.com' },
      { label: 'Source', href: 'https://github.com/bedchem/fruit-fly-slot-machine' },
    ],
    disc: { body: '#7a3428', stripe: '#e6d39a' },
  },
  {
    slug: 'projectile',
    title: 'Projectile Preview',
    kicker: 'See where it lands before you let go',
    description: 'A client-side Fabric mod for Minecraft that shows where your projectiles will land before you shoot or throw.',
    stack: ['Java', 'Fabric', 'Minecraft'],
    links: [
      { label: 'Modrinth', href: 'https://modrinth.com/mod/projectile.preview' },
      { label: 'Source', href: 'https://github.com/Ryhox/ProjectilePreview-Mod' },
    ],
    disc: { body: '#34502f', stripe: '#c9d36a' },
  },
  {
    slug: 'elsewhere',
    title: 'Little Elsewhere',
    kicker: 'A whole world from one spring',
    description: 'A cozy pixel-art idle game about growing a tiny world from a single spring. Every sprite and sound is made in code.',
    stack: ['TypeScript', 'React', 'Canvas 2D'],
    links: [
      { label: 'Visit', href: 'https://elsewhere.ryhox.dev' },
      { label: 'Source', href: 'https://github.com/Ryhox/little-elsewhere' },
    ],
    disc: { body: '#94742c', stripe: '#3d5c3a' },
  },
];
