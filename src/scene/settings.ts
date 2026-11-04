import { persisted } from './persist';

/** Pill mode's settings (the Esc menu), remembered between visits. */
export type Settings = {
  /** mouse (or thumb) sensitivity, and an extra factor behind the scope or the sights */
  sens: number;
  scopeSens: number;
  invertY: boolean;
  /** right-click toggles the scope instead of holding it */
  toggleAim: boolean;
  volume: number;
  crosshair: CrossColor;
  /** the key hints along the bottom and under the scope */
  hints: boolean;
  /** the speed shown while bunny hopping */
  speedo: boolean;
  /** pill mode's pixels: chunky (the wood's own, about 250 to the short side) or fine (about 360, crisper far off) */
  pixels: 'chunky' | 'fine';
};

/** How many game pixels to the screen's short side, for each choice. */
export const PIXELS = { chunky: 250, fine: 360 };

export type CrossColor = 'cream' | 'leaf' | 'rose' | 'sky' | 'gold';
export const CROSS_COLORS: Record<CrossColor, string> = { cream: '#f1ebd6', leaf: '#a6cd83', rose: '#f08a7a', sky: '#8ac4e8', gold: '#f2c24a' };

export const settings = persisted<Settings>('pill-settings', {
  sens: 1,
  scopeSens: 1,
  invertY: false,
  toggleAim: false,
  volume: 1,
  crosshair: 'cream',
  hints: true,
  speedo: true,
  pixels: 'fine',
});
