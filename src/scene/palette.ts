import { ramp, type Ramp } from './pix';
import type { Season } from './season';

/**
 * Every pixel in the forest comes from these ramps (dark → light).
 * The edge of the wood is hazy and warm, the inside gets deeper and greener, the cat's hollow is darkest.
 *
 * The wood changes with the season: `setPalette` swaps the living colours (leaves, grass, moss, the sun on the
 * clearing's floor) in place, so every painter that reads `PAL.x.y` when it paints gets that season's. Bark, stone,
 * the computer and the cat never change.
 */
type Kind = 'oak' | 'beech' | 'birch' | 'young' | 'ancient' | 'bush';

const summer = {
  edge: {
    leaf: ramp('#142217', '#1c2f1f', '#273f28', '#345231', '#46683b', '#62824b', '#93a96c'),
    bark: ramp('#1b1712', '#28231c', '#373027', '#4a4134', '#615645'),
    moss: ramp('#1c301b', '#28411f', '#365727', '#486d30', '#5e853a', '#7c9c4b', '#a3b866'),
    grass: ramp('#1b2c1b', '#253c22', '#324f2a', '#436433', '#5a7c40', '#7b9655', '#a9b97b'),
  },
  mid: {
    leaf: ramp('#15261a', '#1d3622', '#294a2a', '#3a6032', '#50793b', '#729649'),
    bark: ramp('#1c1915', '#2a2520', '#3a332a', '#4f4537', '#665a47'),
    moss: ramp('#18291a', '#22391e', '#2f4c25', '#3f612d', '#537837', '#6e9045'),
    grass: ramp('#18291b', '#223a23', '#2f4f2b', '#406834', '#588342', '#7aa055'),
  },
  deep: {
    leaf: ramp('#0e1a12', '#132518', '#1b321e', '#254426', '#33582e', '#466e37'),
    bark: ramp('#131210', '#1c1a16', '#28241e', '#363027', '#463e32'),
    moss: ramp('#22381d', '#304b24', '#42622c'),
    grass: ramp('#101d14', '#172919', '#203820', '#2c4a28', '#3b6032'),
  },
  clearing: {
    grass: ramp('#10301c', '#173f22', '#1f5128', '#2a652e', '#387b35', '#4b913b', '#64a640'),
    sun: ramp('#4f8a34', '#6c9e3c', '#8cb247', '#abc55a', '#c8d679', '#dfe3a3'),
    leaf: ramp('#0c1d13', '#122a18', '#1a3a1f', '#244c26', '#30602e', '#417436'),
    bark: ramp('#121310', '#1b1c17', '#272720', '#35342a', '#454333'),
    rock: ramp('#3d443f', '#59605a', '#7c837c', '#a3a8a0', '#c8cbc2'),
  },
  hollow: {
    wall: ramp('#0d150e', '#131d14', '#19271a', '#213322', '#2b422b', '#385536', '#4a6b44', '#63854f', '#7f9d62'),
    bark: ramp('#2c201c', '#432f27', '#5c4133', '#775641', '#8f6c51', '#a6825f'),
    rings: ramp('#6a4b38', '#87644a', '#a5805e', '#c09d77', '#d8bc94'),
    moss: ramp('#2f4824', '#43622d', '#5b7d38', '#789949', '#9bb662'),
    grass: ramp('#14231a', '#1c301f', '#273f26', '#355330', '#466a3a', '#5f8549', '#86a764'),
    cat: ramp('#0a0b0a', '#141614', '#20241e', '#2f352b'),
    eye: ramp('#a8831c', '#e2bd3a', '#f8e17c'),
    cap: ramp('#4a2a1f', '#6c3e2a', '#91593a', '#b47a50', '#d29c6c'),
    stem: ramp('#8f866d', '#b8ad8f', '#d9d0b4'),
  },
  computer: {
    shell: ramp('#3b372f', '#5e584b', '#857c68', '#a99f86', '#c8bea2', '#ddd4ba', '#ece5cf'),
    dark: ramp('#141712', '#1f241d', '#2c3229'),
    screen: ramp('#0b130e', '#0f1a13', '#16241a'),
    glass: ramp('#9fd18a', '#c9eab0'),
    key: ramp('#6f6857', '#9b927b', '#bdb49b', '#d7cfb6'),
  },
  disc: {
    metal: ramp('#585e60', '#82898a', '#aab0af', '#d0d4d0'),
    label: ramp('#bdb49c', '#ddd5bd', '#efe9d6'),
    ink: ramp('#3c3a35', '#5c584f'),
  },
  /** The leaves each kind of tree wears, and a second ramp some of its clumps take (late green in autumn). */
  leaves: {} as Record<Kind, Ramp>,
  leaves2: {} as Record<Kind, Ramp>,
  /** How many of a crown's clumps take the second ramp, and how full the crowns are (0 bare … 1 full). */
  mix: 0,
  fullness: 1,
  /** Moss cushions on things (the computer). */
  cushion: ramp('#1c301b', '#28411f', '#365727', '#486d30', '#5e853a', '#7c9c4b', '#a3b866'),
  /** Ivy and creeper. */
  vine: ramp('#122a18', '#1a3a1f', '#244c26', '#30602e', '#417436'),
  snow: ramp('#56677a', '#7a8c9e', '#9eaebd', '#c2ced8', '#dde5ea', '#f1f4f4', '#ffffff'),
  /** Dry grass and stalks: winter's straw poking out of the snow, autumn's seed heads. */
  straw: ramp('#3e3220', '#5a4a30', '#7a6844', '#9b885c', '#bba878', '#d6c69a'),
  /** 0..1: snow lying on every top edge. */
  snowy: 0,
};
summer.leaves = { oak: summer.mid.leaf, beech: summer.mid.leaf, birch: summer.edge.leaf, young: summer.edge.leaf, ancient: summer.deep.leaf, bush: summer.mid.leaf };
summer.leaves2 = summer.leaves;

export type Palette = typeof summer;
const clone = (p: Palette): Palette => JSON.parse(JSON.stringify(p));
const base = clone(summer);

/** What each season changes, over summer's base. */
const SEASONAL: Record<Season, (p: Palette) => void> = {
  summer: () => {},
  spring: (p) => {
    p.edge.leaf = ramp('#15251a', '#1f3a22', '#2d5229', '#3f6e30', '#5a8c38', '#82ad47', '#b7d26f');
    p.mid.leaf = ramp('#16291c', '#203d24', '#2e562b', '#417333', '#5b913c', '#82b04c');
    p.deep.leaf = ramp('#0f1c13', '#15291a', '#1e3a20', '#2a4f29', '#3a6632', '#4f7e3b');
    p.clearing.leaf = ramp('#0e2014', '#15301a', '#1e4322', '#29582a', '#386f32', '#4c863b');
    p.edge.grass = ramp('#1b2d1a', '#253f21', '#335629', '#447233', '#5b8e3d', '#7fac4e', '#aecb73');
    p.mid.grass = ramp('#18291a', '#213c22', '#2e542a', '#3f6f33', '#578c3f', '#78aa52');
    p.clearing.grass = ramp('#113119', '#18421f', '#215626', '#2c6c2d', '#3b8434', '#509c3b', '#6ab345');
    p.clearing.sun = ramp('#548e33', '#72a33b', '#93b846', '#b2cb5a', '#cedb7a', '#e4e8a6');
    p.edge.moss = ramp('#1c311a', '#29441f', '#385b27', '#4a7230', '#618b3b', '#80a34c', '#a8bf69');
    // young beech leaves are the brightest green of the year; birch catkins; a wild cherry in white blossom
    p.leaves = { oak: p.mid.leaf, beech: ramp('#18301b', '#244a24', '#356a2c', '#4a8a34', '#68a83e', '#92c652', '#c2e07a'), birch: p.edge.leaf, young: ramp('#8a6a6e', '#b89aa0', '#d8c0c4', '#ecdcdc', '#f6eeec', '#fdfaf6'), ancient: p.deep.leaf, bush: p.mid.leaf };
    p.leaves2 = { ...p.leaves, young: p.edge.leaf, bush: ramp('#6a4a52', '#9a7680', '#c49ea6', '#e0c2c6', '#f2e0e0') };
    p.mix = 0.3;
    p.fullness = 0.8;
  },
  autumn: (p) => {
    p.edge.leaf = ramp('#1e1a10', '#2e2714', '#433818', '#5c4b1c', '#7a6224', '#9c7f32', '#c3a556');
    p.mid.leaf = ramp('#1d170f', '#2c2213', '#3f3017', '#56411c', '#705523', '#8f6e30');
    p.deep.leaf = ramp('#15120c', '#211b10', '#2e2513', '#3e3218', '#51421e', '#685526');
    p.clearing.leaf = ramp('#1a120c', '#2a1a10', '#3d2414', '#553018', '#6e3e1d', '#8a5026');
    p.edge.grass = ramp('#252717', '#33361d', '#444623', '#58582b', '#6f6b35', '#8b8344', '#ada163');
    // under the beeches the floor is a carpet of their leaves, copper going brown
    p.mid.grass = ramp('#2a1a10', '#3c2414', '#52321a', '#6a4220', '#845428', '#a06a34');
    p.deep.grass = ramp('#1e140c', '#2c1c10', '#3c2614', '#4e3218', '#62401e');
    p.clearing.grass = ramp('#1b2914', '#26381a', '#334a20', '#425c27', '#526f2e', '#678236', '#82973f');
    p.clearing.sun = ramp('#7d7a30', '#988f36', '#b3a440', '#c9b54e', '#dbc66a', '#ead894');
    p.hollow.grass = ramp('#1a140e', '#251c12', '#322616', '#40301a', '#503c20', '#644c28', '#7c5e32');
    p.hollow.wall = ramp('#140f0b', '#1d150f', '#271c12', '#332415', '#423019', '#553f1e', '#6c5024', '#86642c', '#a07a36');
    p.edge.moss = ramp('#232a16', '#313a1b', '#424c20', '#566126', '#6a742e', '#83883a', '#a1a24d');
    p.mid.moss = ramp('#1f2717', '#2b351b', '#394520', '#4a5726', '#5d6a2d', '#747f38');
    p.cushion = p.edge.moss;
    // Virginia creeper on the computer turns red, the first thing to go
    p.vine = ramp('#2a0e0c', '#4a1612', '#721f16', '#9a2c1c', '#c04424');
    p.leaves = {
      oak: ramp('#231c10', '#372c15', '#50401b', '#6a5522', '#866b2c', '#a3843a', '#c0a158'),
      beech: ramp('#2a130b', '#461f0e', '#6b3113', '#904518', '#b55e21', '#d48033', '#e9a751'),
      birch: ramp('#2c2410', '#4a3c14', '#6f5a18', '#97801f', '#bfa52e', '#dcc54a', '#f0e07c'),
      young: ramp('#2a0f0b', '#4a1711', '#702015', '#982c19', '#bb4421', '#d9682e', '#ec9446'),
      ancient: ramp('#1f1a0f', '#342c14', '#4e4019', '#69551e', '#876d27', '#a5883b'),
      bush: ramp('#2b1b0e', '#462c12', '#673f19', '#875521', '#a86c2c', '#c48a41'),
    };
    // some clumps still green (oaks turn last), some already rust
    p.leaves2 = { oak: summer.mid.leaf, beech: ramp('#2a1a0c', '#46290f', '#6e3e14', '#94551a', '#b97024', '#d79034'), birch: ramp('#263010', '#3c4614', '#566018', '#737a1e', '#949428', '#b6ad3e'), young: ramp('#2e140b', '#4e2010', '#7a3214', '#a2481a', '#c86624', '#e48c38'), ancient: summer.deep.leaf, bush: ramp('#3a1410', '#5e1d14', '#862817', '#ac391d', '#c85428') };
    p.mix = 0.28;
    p.fullness = 0.82;
  },
  winter: (p) => {
    // under the snow: what's left of the green is dark and cold
    p.edge.leaf = ramp('#151b18', '#1e2622', '#2a332c', '#384337', '#4a5546', '#626d5b', '#8a947f');
    p.mid.leaf = ramp('#141a17', '#1c2420', '#27302a', '#343e35', '#454f43', '#5b6556');
    p.deep.leaf = ramp('#0f1412', '#161d19', '#1f2822', '#2a342c', '#384236', '#4a5446');
    p.clearing.leaf = ramp('#121815', '#1a221e', '#243029', '#303d33', '#3e4c40', '#4f5d4f');
    // the floor is snow: lit, in the shade of the wood, in its deep blue dark, and in the clearing's sun
    p.edge.grass = ramp('#c2ccd6', '#ccd5dd', '#d6dde4', '#dfe5ea', '#e8ecf0', '#f0f3f5', '#f8fafa');
    p.mid.grass = ramp('#b4c0cc', '#c0cad4', '#cad3db', '#d4dbe2', '#dde3e8', '#e8ecef');
    p.deep.grass = ramp('#a6b2c0', '#b0bbc8', '#bac4cf', '#c4cdd6', '#ced6dd');
    p.clearing.grass = ramp('#bcc7d2', '#c6d0d9', '#d0d8df', '#d9e0e6', '#e2e7ec', '#eaeef1', '#f2f5f6');
    p.clearing.sun = ramp('#d6d6cc', '#e2e0d2', '#ece8d8', '#f4f0e0', '#faf6e8', '#fffcf0');
    p.hollow.grass = ramp('#6e7e90', '#78889a', '#8292a3', '#8c9cad', '#96a6b6', '#a2b1c0', '#aebcc9');
    p.hollow.wall = ramp('#0c1113', '#121a1c', '#182224', '#202c2e', '#2a3739', '#36454a', '#465659', '#5b6c70', '#7a8a8e');
    p.edge.moss = ramp('#1a221c', '#232e25', '#2e3b2f', '#3b4a3a', '#4a5a47', '#5c6c57', '#76846c');
    p.mid.moss = ramp('#171e19', '#1f2821', '#29342a', '#344235', '#425141', '#53624f');
    p.cushion = p.edge.moss;
    p.vine = ramp('#2a2018', '#3e2f22', '#54402c', '#6c5438', '#856a48');
    // bare: beeches and young oaks keep a few dry leaves through the winter
    const dry = ramp('#3a2817', '#573d22', '#77552f', '#966f3f', '#b28a55', '#cba673');
    p.leaves = { oak: dry, beech: dry, birch: dry, young: dry, ancient: dry, bush: dry };
    p.leaves2 = p.leaves;
    p.mix = 0;
    p.fullness = 0;
    p.snowy = 1;
  },
};

/** The palette in use: one object, changed in place by `setPalette`. */
export const PAL: Palette = clone(base);
export let SEASON: Season = 'summer';

/** Switches every living colour to `season`'s. Painters read PAL when they paint, so call this first. */
export function setPalette(season: Season) {
  SEASON = season;
  const next = clone(base);
  SEASONAL[season](next);
  // the per-kind leaves point at the zone ramps in summer; keep those links after the swap
  if (season === 'summer') {
    next.leaves = { oak: next.mid.leaf, beech: next.mid.leaf, birch: next.edge.leaf, young: next.edge.leaf, ancient: next.deep.leaf, bush: next.mid.leaf };
    next.leaves2 = next.leaves;
  }
  for (const k of Object.keys(next) as (keyof Palette)[]) {
    const v = next[k];
    if (v && typeof v === 'object' && !Array.isArray(v)) Object.assign(PAL[k] as object, v);
    else (PAL as Record<string, unknown>)[k] = v;
  }
}
