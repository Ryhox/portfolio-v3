'use client';

import { useSyncExternalStore } from 'react';
import { settings } from '@/scene/settings';
import { forest } from '@/scene/store';
import { wallet } from '@/scene/wallet';
import { lockPointer } from '../Pill';

export const useForest = () => useSyncExternalStore(forest.subscribe, forest.get, forest.get);
export const useWallet = () => useSyncExternalStore(wallet.subscribe, wallet.get, wallet.get);
export const useSettings = () => useSyncExternalStore(settings.subscribe, settings.get, settings.get);

/** Puts a page over pill mode away and goes back to the wood (the click is what lets the mouse be taken again). */
export function closePanel() {
  forest.set({ panel: null });
  lockPointer();
}

export const touchScreen = () => typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;
