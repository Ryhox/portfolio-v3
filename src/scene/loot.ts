/**
 * Pill mode's loot: the skins for the rifle, the shotgun and the butterfly knife, the cases Mira sells them in,
 * the odds (a case works the way they do on the servers: mostly common, now and then something rare, once in a
 * long while a ★ knife), how worn a skin comes out, and the paint itself: every pattern is a small tile painted
 * in code, wrapped round the 3D weapon and laid into the pixel icons the shop and the reel show.
 */
import type { WeaponId } from './arms';
import { hash2, hex, mix, Pix, ramp, shade, type Ramp } from './pix';

export type Rarity = 'blue' | 'purple' | 'pink' | 'red' | 'gold';
export const RARITIES: Rarity[] = ['blue', 'purple', 'pink', 'red', 'gold'];
export const RARITY: Record<Rarity, { name: string; color: string; sell: number }> = {
  blue: { name: 'Sapling', color: '#5b78e6', sell: 40 },
  purple: { name: 'Bramble', color: '#8d5be0', sell: 160 },
  pink: { name: 'Bloom', color: '#c552d4', sell: 600 },
  red: { name: 'Elder', color: '#d9534a', sell: 2000 },
  gold: { name: 'Mythic ★', color: '#e0a83a', sell: 6000 },
};

/** Where on a weapon a paint goes: its wood (or polymer), its metal, the scope, the knife's blade and handles. */
export type Role = 'body' | 'metal' | 'scope' | 'blade' | 'handle';

type PatKind =
  | 'camo' | 'stripes' | 'fade' | 'hex' | 'marble' | 'solid' | 'flowers' | 'leaves' | 'gold' | 'scales' | 'check'
  | 'aurora' | 'birch' | 'dots' | 'feather' | 'speckle' | 'damascus' | 'ripple' | 'crystal' | 'lichen';
export type Pat = { k: PatKind; c: string[] };

export type Skin = { id: string; name: string; weapon: WeaponId; rarity: Rarity; paint: Partial<Record<Role, Pat>>; blurb: string };

const P = (k: PatKind, ...c: string[]): Pat => ({ k, c });

export const SKINS: Skin[] = [
  // --- the rifle -----------------------------------------------------------------------------------------
  { id: 'r-birch', name: 'Birch Bark', weapon: 'rifle', rarity: 'blue', paint: { body: P('birch', '#e8e2d4', '#2a2622', '#b8b2a4') }, blurb: 'Peeled from a fallen birch, the papery kind.' },
  { id: 'r-moss', name: 'Moss Camo', weapon: 'rifle', rarity: 'blue', paint: { body: P('camo', '#2f3f22', '#4a5e2c', '#6e7f3a', '#9aa35a'), metal: P('camo', '#262c22', '#36402c', '#4a5634', '#5e6a40') }, blurb: 'Lie still in the moss and you are the moss.' },
  { id: 'r-pond', name: 'Pond Ripple', weapon: 'rifle', rarity: 'blue', paint: { body: P('ripple', '#2c4a52', '#5f8e94', '#a8ccc8') }, blurb: 'Rings on still water, set in lacquer.' },
  { id: 'r-owl', name: 'Owl Feather', weapon: 'rifle', rarity: 'blue', paint: { body: P('feather', '#8a6a48', '#3e2c1e', '#c8ad84') }, blurb: 'Barred like a tawny owl. Just as quiet.' },
  { id: 'r-gingham', name: 'Picnic Gingham', weapon: 'rifle', rarity: 'purple', paint: { body: P('check', '#f2e8d8', '#d88a80', '#b0423a') }, blurb: 'Packed with the sandwiches by mistake.' },
  { id: 'r-foxfire', name: 'Foxfire', weapon: 'rifle', rarity: 'purple', paint: { body: P('stripes', '#d8702c', '#3a1a0e', '#f0a050'), metal: P('solid', '#2a1a14', '#3a241a', '#5a3a28') }, blurb: 'Fox orange with the stripes of something hungrier.' },
  { id: 'r-honey', name: 'Honeycomb', weapon: 'rifle', rarity: 'purple', paint: { body: P('hex', '#e0a030', '#b8761c', '#5a3410'), metal: P('solid', '#3a2a10', '#4a3614', '#6a4e20') }, blurb: 'Wax-sealed. Smells faintly of clover.' },
  { id: 'r-wildflower', name: 'Wildflower', weapon: 'rifle', rarity: 'pink', paint: { body: P('flowers', '#efe6d0', '#7fa157', '#e07a9a', '#f2c24a'), metal: P('solid', '#e8dcc4', '#d4c6aa', '#fff6e2') }, blurb: 'Hand painted on a long afternoon in the meadow.' },
  { id: 'r-kingfisher', name: 'Kingfisher', weapon: 'rifle', rarity: 'pink', paint: { body: P('fade', '#1a7a8a', '#3ab0c0', '#e88a3a', '#f4b060'), metal: P('fade', '#10505a', '#1a7a8a', '#3ab0c0', '#e88a3a') }, blurb: 'A flash of blue over the river, then orange.' },
  { id: 'r-aurora', name: 'Aurora', weapon: 'rifle', rarity: 'red', paint: { body: P('aurora', '#0e1426', '#3ad0a0', '#9a6ae0', '#fffbea'), metal: P('aurora', '#0a0e1a', '#2aa080', '#7a50c0', '#e8f0ff'), scope: P('solid', '#141a2c', '#1c243a', '#3a4a6a') }, blurb: 'The northern lights, caught over the hollow one winter.' },
  { id: 'r-ember', name: 'Ember Wyrm', weapon: 'rifle', rarity: 'red', paint: { body: P('scales', '#a82a1c', '#e8602a', '#f6c050'), metal: P('scales', '#3a1410', '#6a2014', '#a83a1c'), scope: P('gold', '#6a4a10', '#c89a28', '#f8e080') }, blurb: 'Scale by scale, still warm to the touch.' },
  // --- the shotgun ---------------------------------------------------------------------------------------
  { id: 's-slicker', name: 'Rain Slicker', weapon: 'shotgun', rarity: 'blue', paint: { body: P('solid', '#e0b830', '#c89a20', '#f6dc70') }, blurb: 'Bright yellow, for the wet days.' },
  { id: 's-river', name: 'Riverstone', weapon: 'shotgun', rarity: 'blue', paint: { body: P('speckle', '#7a7e7a', '#4a4e4c', '#b8bab4'), metal: P('speckle', '#4a4e4c', '#2e3230', '#7a7e7a') }, blurb: 'Smoothed by a thousand years of water.' },
  { id: 's-bramble', name: 'Bramble', weapon: 'shotgun', rarity: 'blue', paint: { body: P('camo', '#2a2018', '#3e3020', '#4e5a2a', '#6a2a3a') }, blurb: 'Thorny, tangled, full of blackberries.' },
  { id: 's-beetle', name: 'Bark Beetle', weapon: 'shotgun', rarity: 'blue', paint: { body: P('damascus', '#5a4030', '#2e2018', '#8a6a4a') }, blurb: 'The little tunnels under the bark.' },
  { id: 's-toadstool', name: 'Toadstool', weapon: 'shotgun', rarity: 'purple', paint: { body: P('dots', '#c0302a', '#fff4e2', '#8a1c18') }, blurb: 'Do not eat. Do admire.' },
  { id: 's-mallard', name: 'Mallard', weapon: 'shotgun', rarity: 'purple', paint: { body: P('fade', '#1e5a3a', '#2a8a5a', '#4ab07a', '#2a8a5a'), metal: P('solid', '#3a3a3e', '#4e4e54', '#6e6e76') }, blurb: 'That green on a drake\'s head, in the sun.' },
  { id: 's-lichen', name: 'Lichen', weapon: 'shotgun', rarity: 'purple', paint: { body: P('lichen', '#6a7064', '#a8b07a', '#d8d098'), metal: P('lichen', '#3a3e3a', '#6a7064', '#a8b07a') }, blurb: 'Grows on anything that sits still long enough.' },
  { id: 's-blossom', name: 'Cherry Blossom', weapon: 'shotgun', rarity: 'pink', paint: { body: P('flowers', '#2a1c22', '#4a2c34', '#f0b0c4', '#fff0f4'), metal: P('solid', '#1e1418', '#2a1c22', '#4a2c34') }, blurb: 'A wild cherry in white blossom, after dark.' },
  { id: 's-copper', name: 'Copper Leaf', weapon: 'shotgun', rarity: 'pink', paint: { body: P('leaves', '#3a2414', '#c86624', '#e48c38', '#dcc54a'), metal: P('solid', '#5a3018', '#7a4220', '#b06a34') }, blurb: 'October under the beeches.' },
  { id: 's-midsummer', name: 'Midsummer', weapon: 'shotgun', rarity: 'red', paint: { body: P('fade', '#f2c24a', '#e8805a', '#c0507a', '#5a3a8a'), metal: P('fade', '#c0507a', '#5a3a8a', '#2a1e4a', '#5a3a8a') }, blurb: 'The longest evening of the year, all of it.' },
  { id: 's-frost', name: 'Frostbite', weapon: 'shotgun', rarity: 'red', paint: { body: P('crystal', '#a8d4ec', '#5a9ac8', '#ffffff'), metal: P('crystal', '#5a7a94', '#3a5a74', '#c8e4f4') }, blurb: 'The lake froze round it overnight.' },
  // --- the butterfly knife (★) ------------------------------------------------------------------------------
  { id: 'k-dusk', name: 'Dusk Fade', weapon: 'knife', rarity: 'gold', paint: { blade: P('fade', '#f2c24a', '#e86a8a', '#7a4ac8', '#3a3ab0'), handle: P('solid', '#1a1420', '#2a2030', '#4a3a5a') }, blurb: 'Sunset run down a blade.' },
  { id: 'k-gilded', name: 'Gilded', weapon: 'knife', rarity: 'gold', paint: { blade: P('gold', '#6a4a10', '#c89a28', '#fff4c0'), handle: P('gold', '#4a3008', '#9a7018', '#e8c448') }, blurb: 'Solid gold, top to bottom. Heavy.' },
  { id: 'k-moon', name: 'Moonstone', weapon: 'knife', rarity: 'gold', paint: { blade: P('marble', '#e8eef4', '#a8b8d0', '#7a8aa8', '#4a5a7a'), handle: P('marble', '#2a2e3a', '#4a5064', '#7a84a0', '#1a1e28') }, blurb: 'Pale as the pond at midnight.' },
  { id: 'k-moth', name: 'Night Moth', weapon: 'knife', rarity: 'gold', paint: { blade: P('feather', '#2a2030', '#120c18', '#7a5aa0'), handle: P('dots', '#1a1420', '#c8a0f0', '#0c0810') }, blurb: 'Soft wings, round the lantern.' },
  { id: 'k-fern', name: 'Fern Damascus', weapon: 'knife', rarity: 'gold', paint: { blade: P('damascus', '#a4acb2', '#5a6066', '#eef2f4'), handle: P('leaves', '#1e3a22', '#4a8a3a', '#7fb04a', '#a8d86a') }, blurb: 'Folded steel, folded fronds.' },
  { id: 'k-sapphire', name: 'Kingfisher Sapphire', weapon: 'knife', rarity: 'gold', paint: { blade: P('crystal', '#1a3aa0', '#0a1a6a', '#8ab0ff'), handle: P('solid', '#0a1030', '#141c48', '#2a3a80') }, blurb: 'Deep blue all the way through. Very rare.' },
];
export const skinById = (id: string) => SKINS.find((s) => s.id === id);

export type CaseKind = 'meadow' | 'deepwood' | 'hollow';
export type CaseDef = { id: CaseKind; name: string; price: number; color: string; dark: string; blurb: string; odds: Record<Rarity, number>; pool: string[] };
export const CASES: Record<CaseKind, CaseDef> = {
  meadow: {
    id: 'meadow', name: 'Meadow Case', price: 300, color: '#8fb85e', dark: '#4a6a2e', blurb: 'Picked fresh by the lake.',
    odds: { blue: 0.7, purple: 0.2, pink: 0.07, red: 0.024, gold: 0.006 },
    pool: ['r-birch', 'r-pond', 's-slicker', 's-river', 'r-gingham', 's-toadstool', 'r-wildflower', 's-blossom', 's-midsummer', 'k-dusk', 'k-gilded'],
  },
  deepwood: {
    id: 'deepwood', name: 'Deepwood Case', price: 900, color: '#c8803a', dark: '#6a3a14', blurb: 'From under the old trees.',
    odds: { blue: 0.62, purple: 0.25, pink: 0.09, red: 0.03, gold: 0.01 },
    pool: ['r-moss', 'r-owl', 's-bramble', 's-beetle', 'r-foxfire', 's-mallard', 's-lichen', 'r-kingfisher', 's-copper', 'r-ember', 's-frost', 'k-moon', 'k-fern'],
  },
  hollow: {
    id: 'hollow', name: 'Hollow Case', price: 2500, color: '#7a6ab8', dark: '#2e2650', blurb: 'The cat keeps the good ones down here.',
    odds: { blue: 0.45, purple: 0.3, pink: 0.15, red: 0.075, gold: 0.025 },
    pool: ['r-owl', 's-beetle', 's-river', 'r-honey', 's-lichen', 'r-foxfire', 'r-kingfisher', 's-blossom', 'r-wildflower', 'r-aurora', 's-frost', 'r-ember', 'k-moth', 'k-sapphire', 'k-dusk', 'k-gilded', 'k-moon', 'k-fern'],
  },
};
export const CASE_KINDS: CaseKind[] = ['meadow', 'deepwood', 'hollow'];
/** The free case Mira gives on your first visit leans lucky. */
const LUCKY: Record<Rarity, number> = { blue: 0, purple: 0, pink: 0.72, red: 0.23, gold: 0.05 };

const poolOf = (kind: CaseKind, r: Rarity) => CASES[kind].pool.filter((id) => skinById(id)?.rarity === r);

export function pickRarity(odds: Record<Rarity, number>, rnd: () => number): Rarity {
  let x = rnd();
  for (const r of RARITIES) {
    x -= odds[r];
    if (x < 0) return r;
  }
  return 'blue';
}

export type Drop = { skin: string; wear: number; seed: number };
/** What comes out of a case. */
export function roll(kind: CaseKind, lucky = false, rnd: () => number = Math.random): Drop {
  let r = pickRarity(lucky ? LUCKY : CASES[kind].odds, rnd);
  let pool = poolOf(kind, r);
  while (!pool.length) {
    r = RARITIES[Math.max(0, RARITIES.indexOf(r) - 1)];
    pool = poolOf(kind, r);
  }
  const skin = pool[Math.floor(rnd() * pool.length)];
  return { skin, wear: Math.round(Math.min(0.99, Math.pow(rnd(), 1.45)) * 1000) / 1000, seed: Math.floor(rnd() * 1000) };
}

/** The reel's filler: what a case usually gives, shuffled past the marker before the real one. */
export function filler(kind: CaseKind, n: number): string[] {
  return Array.from({ length: n }, () => {
    const r = pickRarity(CASES[kind].odds, Math.random);
    const pool = poolOf(kind, r);
    const list = pool.length ? pool : poolOf(kind, 'blue');
    return list[Math.floor(Math.random() * list.length)];
  });
}

export function wearName(w: number) {
  return w < 0.07 ? 'Fresh Cut' : w < 0.15 ? 'Barely Scuffed' : w < 0.38 ? 'Field-Tested' : w < 0.45 ? 'Well-Worn' : 'Weather-Beaten';
}
export function sellPrice(skin: Skin, wear: number) {
  return Math.max(5, Math.round((RARITY[skin.rarity].sell * (1.15 - wear * 0.5)) / 5) * 5);
}
export const WEAPON_NAME: Record<WeaponId, string> = { rifle: 'Rifle', shotgun: 'Shotgun', knife: '★ Butterfly Knife' };

// --- the paint ---------------------------------------------------------------------------------------------
export const TILE = 32;
const TAU = Math.PI * 2;
const wrap = (v: number, n: number) => ((v % n) + n) % n;
/** Value noise that tiles every `period` lattice cells. */
function pnoise(x: number, y: number, period: number, seed: number) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const fx = x - xi;
  const fy = y - yi;
  const h = (i: number, j: number) => hash2(wrap(i, period), wrap(j, period), seed);
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const a = h(xi, yi) + (h(xi + 1, yi) - h(xi, yi)) * sx;
  const b = h(xi, yi + 1) + (h(xi + 1, yi + 1) - h(xi, yi + 1)) * sx;
  return a + (b - a) * sy;
}
/** Tiling fbm over a TILE-pixel square. */
const fbm = (x: number, y: number, seed: number) => pnoise(x / 8, y / 8, 4, seed) * 0.6 + pnoise(x / 4, y / 4, 8, seed + 1) * 0.3 + pnoise(x / 2, y / 2, 16, seed + 2) * 0.1;
const BAY = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const bayer = (x: number, y: number) => (BAY[(x & 3) + (y & 3) * 4] + 0.5) / 16;
/** A ramp through colours, picked with a dither, so gradients step like pixel art. */
const grad = (cs: number[], t: number, x: number, y: number) => cs[Math.max(0, Math.min(cs.length - 1, Math.floor(t * (cs.length - 1) + bayer(x, y))))];

const LEAF = ['.##.', '####', '####', '.##.', '..#.'];

/** One tile of a pattern, TILE × TILE, seamless; `wear` chips it, `seed` shifts it (every skin's pattern is its own). */
export function paintPattern(pat: Pat, seed = 0, wear = 0, chip = '#8c9494'): Pix {
  const p = new Pix(TILE, TILE, true);
  const c = pat.c.map(hex);
  const s = seed % 97;
  const ox = s % TILE;
  const oy = (s * 7) % TILE;
  for (let yy = 0; yy < TILE; yy++)
    for (let xx = 0; xx < TILE; xx++) {
      const x = wrap(xx + ox, TILE);
      const y = wrap(yy + oy, TILE);
      const n = fbm(x, y, 300 + s);
      const hh = hash2(x, y, 41 + s);
      let col = c[0];
      switch (pat.k) {
        case 'camo':
          col = n < 0.36 ? c[0] : n < 0.48 ? c[1] : n < 0.6 ? c[2] : c[3] ?? c[2];
          break;
        case 'stripes': {
          const v = wrap(x + y * 0.5 + (fbm(x, y, 77) - 0.5) * 9, 8);
          col = v < 2.4 ? c[1] : v < 3 && hh < 0.5 ? c[2] : c[0];
          break;
        }
        case 'fade': {
          const d = wrap(x + y, TILE) / TILE;
          col = grad(c, 1 - Math.abs(2 * d - 1), x, y);
          break;
        }
        case 'hex': {
          const row = Math.floor(y / 8);
          const cx = wrap(x + (row % 2 ? 4 : 0), 8);
          const cy = y % 8;
          const edge = cy === 0 || cx === 0 || (cy === 1 && (cx === 1 || cx === 7));
          const cell = hash2(Math.floor((x + (row % 2 ? 4 : 0)) / 8), row, 5 + s);
          col = edge ? c[2] : cy < 3 ? c[0] : cell < 0.3 ? c[1] : c[0];
          if (!edge && cy >= 6) col = c[1];
          break;
        }
        case 'marble': {
          const v = Math.sin(((x + y) / TILE) * TAU + n * 7);
          col = Math.abs(v) < 0.09 ? c[3] ?? c[2] : grad(c.slice(0, 3), v * 0.5 + 0.5, x, y);
          break;
        }
        case 'solid':
          col = hh < 0.08 ? c[1] : hh > 0.97 ? c[2] : c[0];
          if (y % 16 === 0) col = c[1];
          break;
        case 'flowers': {
          col = hh < 0.06 ? c[1] : c[0];
          for (let k = 0; k < 4; k++) {
            const fx = (k % 2) * 16 + 4 + Math.floor(hash2(k, 1, 9 + s) * 8);
            const fy = Math.floor(k / 2) * 16 + 4 + Math.floor(hash2(k, 2, 9 + s) * 8);
            const dx = Math.abs(wrap(x - fx + 16, TILE) - 16);
            const dy = Math.abs(wrap(y - fy + 16, TILE) - 16);
            if (dx + dy === 0) col = c[3];
            else if (dx + dy === 1 || (dx === 1 && dy === 1 && hh < 0.4)) col = c[2];
            else if (dx === 0 && dy > 1 && dy < 4 && y > fy) col = c[1];
          }
          break;
        }
        case 'leaves': {
          col = c[0];
          for (let k = 0; k < 6; k++) {
            const lx = Math.floor(hash2(k, 3, 13 + s) * TILE);
            const ly = Math.floor(hash2(k, 4, 13 + s) * TILE);
            const dx = wrap(x - lx, TILE);
            const dy = wrap(y - ly, TILE);
            if (dy < LEAF.length && dx < 4 && LEAF[dy][dx] === '#') col = dy === 0 ? c[3] ?? c[2] : k % 2 ? c[1] : c[2];
          }
          break;
        }
        case 'gold':
          col = grad(c, n * 1.2 - 0.1, x, y);
          if (hh > 0.985) col = hex('#fffbea');
          break;
        case 'scales': {
          const row = Math.floor(y / 8);
          const cx = wrap(x + (row % 2 ? 4 : 0), 8) - 3.5;
          const cy = (y % 8) - 1;
          const r = Math.hypot(cx, cy);
          col = r > 3.9 ? c[0] : r > 3.1 ? c[2] : grad([c[1], c[0]], cy / 7 + 0.3, x, y);
          break;
        }
        case 'check': {
          const a = Math.floor(x / 4) % 2 === 0;
          const b = Math.floor(y / 4) % 2 === 0;
          col = a && b ? c[2] : a || b ? c[1] : c[0];
          break;
        }
        case 'aurora': {
          const band = 13 + Math.sin((x / TILE) * TAU + s) * 6 + (n - 0.5) * 6;
          const d = Math.abs(y - band);
          col = d < 1.2 ? c[1] : d < 3 ? (bayer(x, y) < 0.55 ? c[2] : c[1]) : d < 5 && bayer(x, y) < 0.25 ? c[2] : c[0];
          if (d >= 5 && hh > 0.975) col = c[3];
          break;
        }
        case 'birch': {
          col = hh < 0.1 ? c[2] : c[0];
          const mark = hash2(Math.floor(x / 6), y, 17 + s);
          if (mark > 0.9 && y % 5 === 0) col = c[1];
          if (hash2(Math.floor(x / 9), Math.floor(y / 11), 19 + s) > 0.82 && y % 11 < 2) col = c[1];
          break;
        }
        case 'dots': {
          const row = Math.floor(y / 8);
          const dx = wrap(x + (row % 2 ? 4 : 0), 8) - 3.5;
          const dy = (y % 8) - 3.5;
          const r = Math.hypot(dx, dy);
          col = r < 1.6 ? c[1] : r < 2.3 ? (hh < 0.5 ? c[1] : c[0]) : hh < 0.05 ? c[2] : c[0];
          break;
        }
        case 'feather': {
          const v = wrap(y + 2 * Math.sin((x / 16) * TAU), 8);
          col = v < 1.6 ? c[1] : v < 2.4 ? c[2] : hh < 0.07 ? c[1] : c[0];
          break;
        }
        case 'speckle':
          col = hh < 0.12 ? c[1] : hh > 0.9 ? c[2] : n > 0.62 ? c[1] : c[0];
          break;
        case 'damascus': {
          const v = wrap(x + Math.sin((y / TILE) * TAU) * 5 + (n - 0.5) * 6, 8);
          col = v < 1 ? c[1] : v < 2 ? c[2] : c[0];
          break;
        }
        case 'ripple': {
          const v = (n * 5) % 1;
          col = v < 0.14 ? c[2] : v < 0.32 ? c[1] : c[0];
          break;
        }
        case 'crystal': {
          col = grad([c[1], c[0]], n, x, y);
          const cell = hash2(Math.floor(x / 8), Math.floor(y / 8), 23 + s);
          if (cell > 0.45 && (wrap(x + y, 8) === 0 || wrap(x - y, 8) === 0)) col = c[2];
          if (hh > 0.985) col = c[2];
          break;
        }
        case 'lichen':
          col = n > 0.66 ? c[2] : n > 0.55 ? c[1] : hh < 0.06 ? c[1] : c[0];
          break;
      }
      // wear: paint chipped off to what's under it, more of it the more worn
      if (wear > 0 && hash2(x, y, 911 + s) < wear * 0.26) col = mix(col, hex(chip), 0.7);
      else if (wear > 0.3 && hash2(x, y, 913 + s) < wear * 0.2) col = mix(col, 0xff000000, 0.25);
      p.set(xx, yy, col);
    }
  return p;
}

/** A skin's tiles, by where they go on the weapon. */
export function skinTiles(skin: Skin, seed: number, wear: number): Partial<Record<Role, Pix>> {
  const out: Partial<Record<Role, Pix>> = {};
  for (const [role, pat] of Object.entries(skin.paint) as [Role, Pat][]) out[role] = paintPattern(pat, seed, wear, role === 'body' || role === 'handle' ? '#4a3a2c' : '#9aa2a4');
  return out;
}

// --- the icons -----------------------------------------------------------------------------------------------
export const ICON_W = 64;
export const ICON_H = 24;
const ROLE_ID: Record<Role | 'trim', number> = { body: 1, metal: 2, scope: 3, blade: 4, handle: 5, trim: 6 };
const WOOD = ramp('#4a2612', '#69381a', '#8a4e24', '#a8682e', '#c4853c');
const METAL = ramp('#211e1a', '#302c26', '#433e36', '#5c554a', '#7e7566');
const SCOPE = ramp('#1a1714', '#25211c', '#332e27', '#463f35', '#605747');
const STEEL = ramp('#6a665c', '#8c877a', '#aea898', '#cdc6b4', '#ece6d4');
const HANDLE = ramp('#241a14', '#36281e', '#4a3828', '#624a34', '#7a5e44');
const GOLD = ramp('#6a4a10', '#9a7018', '#c89a28', '#e8c448', '#f8e080');

/** The weapons in profile, muzzle to the right, as which part each pixel is. */
function silhouette(weapon: WeaponId): Uint8Array {
  const m = new Uint8Array(ICON_W * ICON_H);
  const put = (x: number, y: number, r: number) => x >= 0 && y >= 0 && x < ICON_W && y < ICON_H && (m[y * ICON_W + x] = r);
  const rect = (x0: number, y0: number, x1: number, y1: number, role: Role | 'trim') => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) put(x, y, ROLE_ID[role]);
  };
  const poly = (pts: [number, number][], role: Role | 'trim') => {
    for (let y = 0; y < ICON_H; y++)
      for (let x = 0; x < ICON_W; x++) {
        let inside = false;
        for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
          const [xi, yi] = pts[i];
          const [xj, yj] = pts[j];
          if (yi > y + 0.5 !== yj > y + 0.5 && x + 0.5 < ((xj - xi) * (y + 0.5 - yi)) / (yj - yi) + xi) inside = !inside;
        }
        if (inside) put(x, y, ROLE_ID[role]);
      }
  };
  if (weapon === 'rifle') {
    poly([[1, 9], [5, 8], [19, 10], [24, 10], [24, 14], [20, 14], [16, 18], [8, 19], [1, 19]], 'body');
    poly([[19, 13], [23, 13], [22, 20], [19, 20]], 'body');
    rect(0, 9, 1, 19, 'trim');
    rect(24, 10, 35, 14, 'metal');
    rect(24, 15, 29, 16, 'trim');
    rect(26, 14, 26, 15, 'trim');
    rect(29, 14, 32, 17, 'metal');
    poly([[35, 11], [47, 11], [47, 14], [35, 15]], 'body');
    rect(35, 10, 61, 11, 'metal');
    rect(60, 9, 62, 12, 'trim');
    rect(57, 8, 58, 9, 'trim');
    rect(33, 13, 34, 14, 'trim');
    rect(35, 15, 36, 16, 'trim');
    rect(25, 4, 41, 6, 'scope');
    rect(41, 3, 45, 7, 'scope');
    rect(21, 3, 24, 7, 'scope');
    rect(28, 7, 29, 9, 'scope');
    rect(37, 7, 38, 9, 'scope');
    rect(32, 2, 33, 3, 'scope');
  } else if (weapon === 'shotgun') {
    poly([[1, 10], [4, 9], [17, 11], [22, 11], [22, 15], [18, 15], [14, 18], [7, 19], [1, 19]], 'body');
    rect(0, 10, 1, 19, 'trim');
    rect(22, 9, 34, 15, 'metal');
    rect(25, 11, 30, 11, 'trim');
    rect(23, 16, 28, 17, 'trim');
    rect(25, 15, 25, 16, 'trim');
    rect(34, 9, 61, 11, 'metal');
    rect(34, 12, 55, 13, 'metal');
    rect(37, 11, 49, 15, 'body');
    for (const x of [39, 42, 45, 48]) rect(x, 11, x, 15, 'trim');
    rect(60, 8, 60, 8, 'trim');
  } else {
    rect(6, 11, 29, 15, 'handle');
    for (const x of [9, 13, 17, 21, 25]) rect(x, 13, x + 1, 13, 'trim');
    rect(3, 12, 5, 14, 'trim');
    rect(29, 12, 30, 14, 'trim');
    poly([[31, 10], [50, 10], [58, 12], [53, 15], [31, 15]], 'blade');
  }
  return m;
}

/** A weapon's pixel picture in a skin (or as it comes), outlined, lit from above. */
export function weaponIcon(weapon: WeaponId, skin?: Skin, seed = 0, wear = 0, goldKnife = false): Pix {
  const mask = silhouette(weapon);
  const tiles = skin ? skinTiles(skin, seed, wear) : {};
  const plain: Record<number, Ramp> = { 1: WOOD, 2: METAL, 3: SCOPE, 4: goldKnife ? GOLD : STEEL, 5: goldKnife ? GOLD : HANDLE, 6: METAL };
  const p = new Pix(ICON_W, ICON_H);
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= ICON_W || y >= ICON_H ? 0 : mask[y * ICON_W + x]);
  for (let y = 0; y < ICON_H; y++)
    for (let x = 0; x < ICON_W; x++) {
      const r = at(x, y);
      if (!r) continue;
      const role = (Object.keys(ROLE_ID) as (Role | 'trim')[]).find((k) => ROLE_ID[k] === r)!;
      const tile = role !== 'trim' ? tiles[role] : undefined;
      let col = tile ? tile.get(wrap(x, TILE), wrap(y, TILE)) : shade(plain[r], 0.45 + (hash2(x, y, r) - 0.5) * 0.12 + (r === 1 && (y + Math.round(Math.sin(x * 0.3) * 1.5)) % 4 === 0 ? -0.18 : 0));
      // light from above: the top edge of every part lit, the bottom edge in shade
      if (at(x, y - 1) !== r) col = mix(col, 0xffffffff, 0.28);
      else if (at(x, y + 1) !== r) col = mix(col, 0xff000000, 0.3);
      p.set(x, y, col);
    }
  // the outline: dark ink all round
  const ink = hex('#1a1410');
  const out = new Pix(ICON_W, ICON_H);
  for (let y = 0; y < ICON_H; y++)
    for (let x = 0; x < ICON_W; x++) {
      if (at(x, y)) out.set(x, y, p.get(x, y));
      else if (at(x - 1, y) || at(x + 1, y) || at(x, y - 1) || at(x, y + 1)) out.set(x, y, ink);
    }
  return out;
}

/** The ★ the reel shows for a knife, the way the servers hide theirs until it lands. */
export function mysteryIcon(): Pix {
  const p = new Pix(ICON_W, ICON_H);
  const cx = ICON_W / 2;
  const cy = ICON_H / 2;
  for (let y = 0; y < ICON_H; y++)
    for (let x = 0; x < ICON_W; x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const a = Math.atan2(dy, dx) + Math.PI / 2;
      const r = Math.hypot(dx, dy);
      const lim = 6 + 4.5 * Math.pow(Math.abs(Math.cos((a * 5) / 2)), 3);
      if (r < lim) p.set(x, y, shade(GOLD, 0.95 - (dy + 10) / 26 + (hash2(x, y, 3) - 0.5) * 0.1));
    }
  const ink = hex('#1a1410');
  const out = new Pix(ICON_W, ICON_H);
  for (let y = 0; y < ICON_H; y++)
    for (let x = 0; x < ICON_W; x++) {
      const on = (i: number, j: number) => p.get(i, j) >>> 24 > 0;
      if (on(x, y)) out.set(x, y, p.get(x, y));
      else if (on(x - 1, y) || on(x + 1, y) || on(x, y - 1) || on(x, y + 1)) out.set(x, y, ink);
    }
  return out;
}

/** A case: a little chest in its colour, brass corners and latch, a handle, and its sign on the front. */
export function caseIcon(kind: CaseKind): Pix {
  const W = 40;
  const H = 30;
  const p = new Pix(W, H);
  const d = CASES[kind];
  const body = ramp(d.dark, mixHex(d.dark, d.color, 0.5), d.color, mixHex(d.color, '#fffbea', 0.35));
  const brass = ramp('#6e4f1c', '#9a7430', '#c9a04a', '#e8c873');
  const ink = hex('#1a1410');
  // the handle on top
  for (let x = 15; x <= 24; x++) p.set(x, 3, shade(brass, 0.4));
  for (let y = 3; y <= 6; y++) {
    p.set(15, y, shade(brass, 0.3));
    p.set(24, y, shade(brass, 0.3));
  }
  // lid and body
  for (let y = 7; y < 27; y++)
    for (let x = 3; x < 37; x++) {
      const lid = y < 12;
      let t = lid ? 0.85 : 0.55 - (y - 12) * 0.02;
      if (y === 12) t = 0.05;
      if (hash2(x, y, 7) < 0.05) t -= 0.15;
      p.set(x, y, shade(body, t));
    }
  // corners and latch
  for (const [x0, y0] of [[3, 7], [33, 7], [3, 23], [33, 23]]) for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) if (x === 0 || y === (y0 < 12 ? 0 : 3) || (x < 2 && y < 2)) p.set(x0 + x, y0 + y, shade(brass, y === 0 ? 0.9 : 0.5));
  for (let y = 10; y < 16; y++) for (let x = 18; x < 22; x++) p.set(x, y, shade(brass, y === 10 ? 0.95 : 0.55));
  p.set(19, 13, ink);
  p.set(20, 13, ink);
  // its sign, cream on the front: a flower, a tree, a moon
  const cream = hex('#f6efdc');
  const sign: Record<CaseKind, string[]> = {
    meadow: ['..#..', '.#.#.', '#.#.#', '.#.#.', '..#..'],
    deepwood: ['..#..', '.###.', '#####', '..#..', '..#..'],
    hollow: ['.##..', '#....', '#....', '#....', '.##..'],
  };
  sign[kind].forEach((row, j) => [...row].forEach((ch, i) => ch === '#' && p.set(18 + i, 19 + j, cream)));
  // outline
  const out = new Pix(W, H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const on = (i: number, j: number) => p.get(i, j) >>> 24 > 0;
      if (on(x, y)) out.set(x, y, p.get(x, y));
      else if (on(x - 1, y) || on(x + 1, y) || on(x, y - 1) || on(x, y + 1)) out.set(x, y, ink);
    }
  return out;
}

function mixHex(a: string, b: string, t: number) {
  const c = mix(hex(a), hex(b), t);
  return `#${[c & 255, (c >>> 8) & 255, (c >>> 16) & 255].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

/** A Pix as an image the page can show (cached, since the shop and the reel show the same ones a lot). */
const urls = new Map<string, string>();
export function pixURL(key: string, make: () => Pix): string {
  const have = urls.get(key);
  if (have) return have;
  if (typeof document === 'undefined') return '';
  const p = make();
  const c = document.createElement('canvas');
  c.width = p.w;
  c.height = p.h;
  const g = c.getContext('2d')!;
  const img = g.createImageData(p.w, p.h);
  new Uint32Array(img.data.buffer).set(p.data);
  g.putImageData(img, 0, 0);
  const url = c.toDataURL();
  urls.set(key, url);
  return url;
}

export const skinIconURL = (skin: Skin, seed = 0, wear = 0) => pixURL(`s:${skin.id}:${seed}:${Math.round(wear * 20)}`, () => weaponIcon(skin.weapon, skin, seed, wear));
export const plainIconURL = (weapon: WeaponId, gold = false) => pixURL(`w:${weapon}:${gold}`, () => weaponIcon(weapon, undefined, 0, 0, gold));
export const caseIconURL = (kind: CaseKind) => pixURL(`c:${kind}`, () => caseIcon(kind));
export const mysteryIconURL = () => pixURL('mystery', mysteryIcon);
