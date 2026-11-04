'use client';

import { useEffect, useState } from 'react';
import { CASE_KINDS, CASES, caseIconURL, mysteryIconURL, RARITIES, RARITY, skinById, skinIconURL, type CaseKind } from '@/scene/loot';
import { purse } from '@/scene/wallet';
import { sfx } from '@/sound/sfx';
import Opening, { openCase, type Open } from './Opening';
import Panel from './Panel';
import SkinGrid from './SkinGrid';
import { closePanel, useWallet } from './stores';

const HELLO = [
  'Back again? I kept the shiny ones under the counter.',
  'Points in your pocket? Let’s see what the wood gives up.',
  'Every case packed by hand. Mostly by me.',
  'The deer have been talking about you, you know.',
];
const pick = (l: string[]) => l[Math.floor(Math.random() * l.length)];

const pct = (v: number) => `${v * 100 < 1 ? (v * 100).toFixed(1) : Math.round(v * 100)}%`;

/** One of Mira's cases on the counter: what it is, what's in it and how likely, its price, and buying it. */
function CaseCard({ kind, onBuy, onOpen }: { kind: CaseKind; onBuy: (open: boolean) => void; onOpen: (uid: string) => void }) {
  const w = useWallet();
  const c = CASES[kind];
  const mine = w.cases.filter((x) => x.kind === kind);
  const short = c.price - w.points;
  const best = c.pool.map((id) => skinById(id)!).filter((s) => s.rarity === 'red' || s.rarity === 'pink');
  const knives = c.pool.filter((id) => skinById(id)?.rarity === 'gold').length;
  return (
    <li className="case-card" style={{ ['--case' as string]: c.color }}>
      <img className="case-icon" src={caseIconURL(kind)} alt="" width={120} height={90} />
      <h3 className="case-name">{c.name}</h3>
      <p className="case-blurb">{c.blurb}</p>
      <ul className="case-odds" aria-label="Odds">
        {RARITIES.map((r) => (
          <li key={r} style={{ ['--rar' as string]: RARITY[r].color }}>
            <span />
            {RARITY[r].name} {pct(c.odds[r])}
          </li>
        ))}
      </ul>
      <div className="case-best">
        {best.map((s) => (
          <img key={s.id} src={skinIconURL(s)} alt={s.name} title={`${s.name} (${RARITY[s.rarity].name})`} width={64} height={24} style={{ ['--rar' as string]: RARITY[s.rarity].color }} />
        ))}
        <img src={mysteryIconURL()} alt={`${knives} knives`} title={`${knives} ★ knives`} width={64} height={24} style={{ ['--rar' as string]: RARITY.gold.color }} />
      </div>
      <p className="case-price">
        <span className="coin" aria-hidden="true" />
        {c.price.toLocaleString('en-US')}
      </p>
      <div className="case-actions">
        <button type="button" className="ink-btn solid" aria-disabled={short > 0} onClick={() => onBuy(true)}>
          {short > 0 ? `Need ${short.toLocaleString('en-US')} more` : 'Buy & open'}
        </button>
        {short <= 0 && (
          <button type="button" className="ink-btn" onClick={() => onBuy(false)}>
            Buy
          </button>
        )}
        {mine.length > 0 && (
          <button type="button" className="ink-btn solid" onClick={() => onOpen(mine[0].uid)}>
            Open yours ({mine.length})
          </button>
        )}
      </div>
    </li>
  );
}

/** Mira's shop: her cases on the counter, and the skins you have, to wear or to sell back to her. */
export default function Shop() {
  const w = useWallet();
  const [tab, setTab] = useState<'cases' | 'skins'>('cases');
  const [say, setSay] = useState(() => pick(HELLO));
  const [open, setOpen] = useState<Open | null>(null);
  // the first time: a case on the house
  useEffect(() => {
    const gift = purse.meet();
    if (gift) {
      setSay('First time here? This one’s on me. Go on, open it, I want to see!');
      sfx.play('chime');
    }
  }, []);
  const buy = (kind: CaseKind, andOpen: boolean) => {
    const c = CASES[kind];
    if (w.points < c.price) {
      setSay(`That one’s ${c.price.toLocaleString('en-US')}. The wood’s full of rabbits, hunter.`);
      sfx.play('deny');
      return;
    }
    const item = purse.buy(kind);
    if (!item) return;
    sfx.play('buy');
    window.dispatchEvent(new Event('mira-cheer'));
    if (andOpen) setOpen(openCase(item.uid));
    else setSay('Lovely. Open it whenever you like, press 4 out there.');
  };
  return (
    <Panel title="Mira’s Cases" say={<>“{say}”</>} onClose={closePanel}>
      {open ? (
        <Opening
          open={open}
          setOpen={setOpen}
          onBack={() => {
            setOpen(null);
            setSay(pick(['Ooh. Suits you.', 'Another? I won’t tell anyone.', 'That’s a good one, keep it safe.']));
          }}
        />
      ) : (
        <>
          <div className="tabs" role="tablist">
            <button type="button" role="tab" aria-selected={tab === 'cases'} className="tab" onClick={() => (setTab('cases'), sfx.play('ui'))}>
              Cases
            </button>
            <button type="button" role="tab" aria-selected={tab === 'skins'} className="tab" onClick={() => (setTab('skins'), sfx.play('ui'))}>
              Your skins <span className="count">{w.skins.length}</span>
            </button>
          </div>
          {tab === 'cases' ? (
            <>
              <ul className="case-row">
                {CASE_KINDS.map((k) => (
                  <CaseCard key={k} kind={k} onBuy={(o) => buy(k, o)} onOpen={(uid) => setOpen(openCase(uid))} />
                ))}
              </ul>
              <p className="panel-note">Points come from the hunt. Every skin is for the rifle, the shotgun or (★, rarely) the butterfly knife.</p>
            </>
          ) : (
            <SkinGrid empty="Nothing yet. Open a case and come back here to put it on." />
          )}
        </>
      )}
    </Panel>
  );
}
