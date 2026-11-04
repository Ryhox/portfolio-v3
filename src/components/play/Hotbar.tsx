'use client';

import { useMemo } from 'react';
import type { WeaponId } from '@/scene/arms';
import { caseIconURL, plainIconURL, skinById, skinIconURL } from '@/scene/loot';
import { goldKnife } from '@/site/eggs';
import { useForest, useWallet } from './stores';

const SLOTS: { key: number; weapon: WeaponId; name: string }[] = [
  { key: 1, weapon: 'rifle', name: 'Rifle' },
  { key: 2, weapon: 'shotgun', name: 'Shotgun' },
  { key: 3, weapon: 'knife', name: 'Knife' },
];

/** A weapon's picture as it is now: in the skin it wears, or as it came. */
export function useWeaponIcon(weapon: WeaponId) {
  const w = useWallet();
  const uid = w.equipped[weapon];
  return useMemo(() => {
    const it = uid ? w.skins.find((s) => s.uid === uid) : undefined;
    const sk = it && skinById(it.skin);
    if (it && sk) return { url: skinIconURL(sk, it.seed, it.wear), skin: sk.name };
    return { url: plainIconURL(weapon, weapon === 'knife' && goldKnife()), skin: null };
  }, [uid, w.skins, weapon]);
}

function Slot({ k, weapon, name, active, ammo }: { k: number; weapon: WeaponId; name: string; active: boolean; ammo?: string }) {
  const icon = useWeaponIcon(weapon);
  return (
    <button type="button" className="hot-slot" data-active={active} onClick={() => window.dispatchEvent(new CustomEvent('play-slot', { detail: k }))} aria-label={`${k}: ${name}`}>
      <kbd>{k}</kbd>
      <img src={icon.url} alt="" width={64} height={24} />
      <span className="hot-name">{icon.skin ?? name}</span>
      {ammo && <span className="hot-ammo">{ammo}</span>}
    </button>
  );
}

/** Along the bottom: the three weapons on 1, 2, 3 (the one in hand raised), and your cases on 4. */
export default function Hotbar() {
  const st = useForest();
  const w = useWallet();
  const cases = w.cases.length;
  return (
    <div className="hotbar">
      {SLOTS.map((s) => (
        <Slot key={s.key} k={s.key} weapon={s.weapon} name={s.name} active={st.weapon === s.weapon} ammo={s.weapon === 'knife' ? undefined : `${st.ammo[s.weapon]}`} />
      ))}
      <button type="button" className="hot-slot hot-cases" data-active={st.panel === 'cases'} onClick={() => window.dispatchEvent(new CustomEvent('play-slot', { detail: 4 }))} aria-label={`4: your cases (${cases})`}>
        <kbd>4</kbd>
        <img src={caseIconURL('meadow')} alt="" width={40} height={30} />
        <span className="hot-name">Cases</span>
        <span className="hot-ammo" data-some={cases > 0}>
          {cases}
        </span>
      </button>
    </div>
  );
}
