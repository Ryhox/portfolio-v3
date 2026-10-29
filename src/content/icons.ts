/**
 * Little pixel icons for the social buttons, 16 × 16: each brand's own mark in cream, cut from a dark disc
 * the colour of the button's outline, flat and two-toned so it reads at a glance.
 * Each character is a colour from its legend; '.' is empty.
 */
export type IconKey = 'github' | 'modrinth' | 'email' | 'discord';

export const ICON_SIZE = 16;

const DISC = '#2b1e16';
const MARK = '#fffbea';

export const ICONS: Record<IconKey, { rows: string[]; colors: Record<string, string> }> = {
  // the octocat: ears, round head, the neck running out of the disc and the tail curling in from the left
  github: {
    rows: [
      '.....oooooo.....',
      '...oooooooooo...',
      '..oooooooooooo..',
      '.ooowoooooowooo.',
      '.ooowwwwwwwwooo.',
      'ooowwwwwwwwwwooo',
      'ooowwwwwwwwwwooo',
      'ooowwwwwwwwwwooo',
      'ooowwwwwwwwwwooo',
      'oooowwwwwwwwoooo',
      'ooooowwwwwwooooo',
      '.owooowwwwooooo.',
      '.oowwwwwwwooooo.',
      '..oooowwwwoooo..',
      '...ooowwwwooo...',
      '.....owwwwo.....',
    ],
    colors: { o: DISC, w: MARK },
  },
  // the ring, broken twice on the right, and the road that runs in from the left and up to the top break
  modrinth: {
    rows: [
      '.....oooooo.....',
      '...oooooooooo...',
      '..ooowwwwwoooo..',
      '.ooowwooooowooo.',
      '.oowoooooooowoo.',
      'oowwoooowwoowwoo',
      'oowoooowooooowoo',
      'oowooowoooooowoo',
      'oowooowooowwowoo',
      'oowwwwwwwwooowoo',
      'oowwwwwooooowwoo',
      '.oowooooooooooo.',
      '.ooowwoooowoooo.',
      '..ooowwwwwwooo..',
      '...oooooooooo...',
      '.....oooooo.....',
    ],
    colors: { o: DISC, w: MARK },
  },
  // an envelope, its flap folded down to a point
  email: {
    rows: [
      '.....oooooo.....',
      '...oooooooooo...',
      '..oooooooooooo..',
      '.oooooooooooooo.',
      '.owwwwwwwwwwwwo.',
      'oowowwwwwwwwowoo',
      'oowwoowwwwoowwoo',
      'oowwwwowwowwwwoo',
      'oowwwwwoowwwwwoo',
      'oowwwwwwwwwwwwoo',
      'oowwwwwwwwwwwwoo',
      '.owwwwwwwwwwwwo.',
      '.oooooooooooooo.',
      '..oooooooooooo..',
      '...oooooooooo...',
      '.....oooooo.....',
    ],
    colors: { o: DISC, w: MARK },
  },
  // the controller face: flat brow, two tall eyes, its feet at the corners
  discord: {
    rows: [
      '.....oooooo.....',
      '...oooooooooo...',
      '..oooooooooooo..',
      '.oooooooooooooo.',
      '.ooowwwwwwwwooo.',
      'ooowwwwwwwwwwooo',
      'ooowwwwwwwwwwooo',
      'oowwwoowwoowwwoo',
      'oowwwoowwoowwwoo',
      'oowwwoowwoowwwoo',
      'oowwwwwwwwwwwwoo',
      '.ooowwoooowwooo.',
      '.oooooooooooooo.',
      '..oooooooooooo..',
      '...oooooooooo...',
      '.....oooooo.....',
    ],
    colors: { o: DISC, w: MARK },
  },
};

/** The same icon as SVG path data, one path per colour, for the page's own buttons. */
export function iconSvg(key: IconKey) {
  const { rows, colors } = ICONS[key];
  const paths: Record<string, string> = {};
  rows.forEach((row, y) =>
    row.split('').forEach((ch, x) => {
      if (ch === '.' || !colors[ch]) return;
      paths[ch] = (paths[ch] ?? '') + `M${x} ${y}h1v1h-1z`;
    }),
  );
  return Object.entries(paths).map(([ch, d]) => ({ d, fill: colors[ch] }));
}
