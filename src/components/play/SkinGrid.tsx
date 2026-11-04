'use client';

import { useState } from 'react';
import type { WeaponId } from '@/scene/arms';
import { RARITY, sellPrice, skinById, skinIconURL, WEAPON_NAME, wearName } from '@/scene/loot';
import { purse } from '@/scene/wallet';
import { sfx } from '@/sound/sfx';
import { useWallet } from './stores';

const FILTERS: (WeaponId | 'all')[] = ['all', 'rifle', 'shotgun', 'knife'];
const FILTER_NAME = { all: 'All', rifle: 'Rifle', shotgun: 'Shotgun', knife: 'Knife' };

/** Your skins: which weapon, how rare, how worn; put one on (or take it off), or sell it back to Mira. */
export default function SkinGrid({ empty }: { empty: string }) {
  const w = useWallet();
  const [filter, setFilter] = useState<WeaponId | 'all'>('all');
  const [selling, setSelling] = useState<string | null>(null);
  const list = w.skins.filter((it) => {
    const sk = skinById(it.skin);
    return sk && (filter === 'all' || sk.weapon === filter);
  });
  return (
    <div className="skins">
      <div className="chips" role="tablist">
        {FILTERS.map((f) => (
          <button key={f} type="button" role="tab" aria-selected={filter === f} className="chip" onClick={() => (setFilter(f), sfx.play('ui'))}>
            {FILTER_NAME[f]}
          </button>
        ))}
      </div>
      {list.length === 0 ? (
        <p className="panel-empty">{empty}</p>
      ) : (
        <ul className="skin-grid">
          {list.map((it) => {
            const sk = skinById(it.skin)!;
            const on = w.equipped[sk.weapon] === it.uid;
            const price = sellPrice(sk, it.wear);
            return (
              <li key={it.uid} className="skin-tile" data-on={on} style={{ ['--rar' as string]: RARITY[sk.rarity].color }}>
                <img src={skinIconURL(sk, it.seed, it.wear)} alt="" width={128} height={48} />
                <p className="skin-name">{sk.name}</p>
                <p className="skin-meta">
                  {WEAPON_NAME[sk.weapon]} · <span className="rar">{RARITY[sk.rarity].name}</span>
                </p>
                <p className="skin-meta">
                  {wearName(it.wear)} <span className="float">{it.wear.toFixed(3)}</span>
                </p>
                <div className="skin-actions">
                  {on ? (
                    <button type="button" className="ink-btn solid" onClick={() => (purse.unequip(sk.weapon), sfx.play('ui'))}>
                      Take off
                    </button>
                  ) : (
                    <button type="button" className="ink-btn solid" onClick={() => (purse.equip(it.uid), sfx.play('equip'))}>
                      Equip
                    </button>
                  )}
                  <button
                    type="button"
                    className="ink-btn"
                    onClick={() => {
                      if (selling !== it.uid) {
                        setSelling(it.uid);
                        sfx.play('ui');
                        return;
                      }
                      purse.sell(it.uid);
                      setSelling(null);
                      sfx.play('sell');
                    }}
                  >
                    {selling === it.uid ? `Sure? +${price}` : `Sell ${price}`}
                  </button>
                </div>
                {on && <span className="skin-on">Equipped</span>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
