import type { WeaponId } from './arms';
import type { Species } from './fauna';

/**
 * The score in pill mode: every animal is worth 100, times what you did to get it. Each trick is a medal with a
 * multiplier, and the weapon matters: a long shot is ordinary for the rifle and a feat with the shotgun; a
 * noscope is the rifle's great trick and merely hip fire for the shotgun. Medals stack (multiply), so a 360
 * noscope off a bunny hop across the lake is worth a great deal.
 */
export type Shot = {
  weapon: WeaponId;
  /** how far up the scope (or the sights) was, 0..1, and how long it had been all the way up */
  aim: number;
  scopedFor: number;
  /** metres to the animal */
  metres: number;
  airborne: boolean;
  /** your speed over your running speed (bunny hopping gets you past 1.3) */
  speed: number;
  wading: boolean;
  headshot: boolean;
  backstab: boolean;
  /** the animal was in the air (a bird flying off) */
  flying: boolean;
  species: Species;
  /** how far you've turned in the last second and a bit, and in the last 0.15 s (radians) */
  spun: number;
  flick: number;
  /** other kills by this same bullet */
  collateral: number;
  /** kills in the last couple of seconds before this one */
  chain: number;
  /** hits in a row without a miss, counting this one */
  streak: number;
  breath: boolean;
  first: boolean;
  /** shot from inside the dark hollow */
  dark: boolean;
  /** the knife: how many swings into a combo, and whether it was the spinning finisher */
  combo?: number;
  finisher?: boolean;
};

export type Medal = { name: string; mult: number; tone: 'gold' | 'leaf' | 'rose' | 'sky' | 'cream' };

export function medals(s: Shot): Medal[] {
  const m: Medal[] = [];
  const add = (name: string, mult: number, tone: Medal['tone'] = 'cream') => m.push({ name, mult, tone });
  const rifle = s.weapon === 'rifle';
  const shotgun = s.weapon === 'shotgun';
  const knife = s.weapon === 'knife';
  if (s.first) add('FIRST BLOOD', 1.5, 'rose');
  if (knife) {
    add('KNIFE', 2, 'leaf');
    if (s.backstab) add('BACKSTAB', 1.5, 'rose');
    if (s.species === 'butterfly') add('BUTTERFLY EFFECT', 5, 'gold');
    if (s.finisher) add('FINISHER', 2.5, 'gold');
    else if ((s.combo ?? 0) >= 2) add('COMBO', 1 + Math.min(4, s.combo ?? 0) * 0.2, 'leaf');
  }
  // the scope, or not
  if (rifle && s.aim < 0.3) add(s.spun >= Math.PI * 2 ? '360 NOSCOPE' : 'NOSCOPE', s.spun >= Math.PI * 2 ? 6 : 2.5, 'gold');
  else if (shotgun && s.aim < 0.3) add('HIP FIRE', 1.15);
  else if (s.spun >= Math.PI * 2) add('360', 3, 'gold');
  if (rifle && s.aim > 0.9 && s.scopedFor < 0.35) add('QUICKSCOPE', 2, 'gold');
  // distance: what is far depends on what you're holding
  if (rifle) {
    if (s.metres >= 90) add('MARKSMAN', 2, 'sky');
    else if (s.metres >= 45) add('LONG SHOT', 1.4, 'sky');
    if (s.metres <= 3) add('POINT BLANK', 1.8, 'rose');
  } else if (shotgun) {
    if (s.metres >= 22) add('LONG BARREL', 3, 'sky');
    else if (s.metres >= 13) add('LONG SHOT', 2, 'sky');
    if (s.metres <= 2) add('POINT BLANK', 1.2);
  } else if (s.metres >= 2.6) add('LUNGE', 1.3, 'leaf');
  if (s.headshot && !knife) add('HEADSHOT', 1.5, 'rose');
  if (s.flying) add(shotgun ? 'SKEET' : 'BIRDWATCHER', shotgun ? 2.5 : 3, 'sky');
  // how you were moving
  if (s.airborne) add(knife ? 'FLYING KNIFE' : 'AIRBORNE', knife ? 2 : rifle ? 1.8 : 1.4, 'sky');
  if (s.speed > 1.3) add('BHOP', s.speed > 1.8 ? 2 : 1.5, 'leaf');
  if (s.flick > 0.9) add('FLICK', 1.4);
  if (s.wading) add('WET FEET', 1.2, 'sky');
  if (s.breath && rifle) add('STEADY', 1.2, 'leaf');
  if (s.dark) add('IN THE DARK', 1.3);
  // one bullet, several animals; several animals in a moment; no misses in a while
  if (s.collateral > 0) add(s.collateral > 1 ? 'TRIPLE COLLATERAL' : 'COLLATERAL', s.collateral > 1 ? 4 : 2, 'gold');
  if (s.chain === 1) add('DOUBLE KILL', 1.5, 'rose');
  else if (s.chain === 2) add('TRIPLE KILL', 2, 'rose');
  else if (s.chain >= 3) add('MULTI KILL', 3, 'rose');
  if (s.streak === 10) add('LEGENDARY', 2, 'gold');
  else if (s.streak >= 6 && s.streak % 3 === 0) add('UNSTOPPABLE', 1.6, 'gold');
  else if (s.streak === 3) add('ON A ROLL', 1.3, 'leaf');
  return m;
}

export const BASE = 100;
export function points(ms: Medal[]) {
  const mult = Math.min(99, ms.reduce((k, m) => k * m.mult, 1));
  return { mult, points: Math.round(BASE * mult) };
}
