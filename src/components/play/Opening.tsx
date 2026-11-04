'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { CASES, filler, mysteryIconURL, RARITIES, RARITY, sellPrice, skinById, skinIconURL, WEAPON_NAME, wearName, type CaseKind } from '@/scene/loot';
import { purse, wallet, type SkinItem } from '@/scene/wallet';
import { sfx } from '@/sound/sfx';
import { useWallet } from './stores';

export type Open = { kind: CaseKind; item: SkinItem; landed: boolean };

/** Opens one of your cases: what's in it is decided (and yours) now; the reel only shows it. */
export function openCase(uid: string): Open | null {
  const c = wallet.get().cases.find((x) => x.uid === uid);
  if (!c) return null;
  const item = purse.open(uid);
  if (!item) return null;
  sfx.play('unlock');
  return { kind: c.kind, item, landed: false };
}

const CARD = 226;
const COUNT = 58;
const WIN = 50;

/**
 * The reel, the way the servers do it: a long strip of what the case could give rushes past a marker and slows,
 * ticking at every item, until it stops on what you got. A ★ shows as a gold star until it lands. Space skips.
 */
function Reel({ kind, item, onDone }: { kind: CaseKind; item: SkinItem; onDone: () => void }) {
  const strip = useRef<HTMLDivElement>(null);
  const view = useRef<HTMLDivElement>(null);
  const skip = useRef(false);
  const [landed, setLanded] = useState(false);
  const cards = useMemo(() => {
    const list = filler(kind, COUNT);
    list[WIN] = item.skin;
    return list;
  }, [kind, item]);
  useEffect(() => {
    const el = strip.current;
    const vw = view.current;
    if (!el || !vw) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const centre = vw.clientWidth / 2;
    // somewhere on the winning card, not always its middle
    const target = WIN * CARD + CARD * (0.12 + Math.random() * 0.76) - centre;
    const dur = reduced ? 1400 : 6400;
    const t0 = performance.now();
    let raf = 0;
    let last = -1;
    let timer = 0;
    const ease = (t: number) => 1 - Math.pow(1 - t, 4.6);
    const frame = (now: number) => {
      const t = skip.current ? 1 : Math.min(1, (now - t0) / dur);
      const x = target * ease(t);
      el.style.transform = `translate3d(${-Math.round(x)}px, 0, 0)`;
      const at = Math.floor((x + centre) / CARD);
      if (at !== last) {
        if (last >= 0) sfx.play('reel', { rate: 0.85 + Math.random() * 0.08 + (1 - t) * 0.25 });
        last = at;
      }
      if (t < 1) raf = requestAnimationFrame(frame);
      else {
        setLanded(true);
        timer = window.setTimeout(onDone, skip.current ? 300 : 900);
      }
    };
    raf = requestAnimationFrame(frame);
    const key = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        skip.current = true;
      }
    };
    window.addEventListener('keydown', key);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
      window.removeEventListener('keydown', key);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="opening">
      <p className="opening-title">Opening {CASES[kind].name}…</p>
      <div className="reel" ref={view}>
        <div className="reel-strip" ref={strip}>
          {cards.map((id, i) => {
            const sk = skinById(id)!;
            const hidden = sk.rarity === 'gold' && !(landed && i === WIN);
            return (
              <div key={i} className="reel-card" data-win={landed && i === WIN} style={{ ['--rar' as string]: RARITY[sk.rarity].color }}>
                <img src={hidden ? mysteryIconURL() : skinIconURL(sk)} alt="" width={192} height={72} />
                <span>{hidden ? '★ Rare special item' : sk.name}</span>
              </div>
            );
          })}
        </div>
        <div className="reel-marker" aria-hidden="true" />
      </div>
      <button type="button" className="ink-btn" onClick={() => (skip.current = true)}>
        Skip <kbd>Space</kbd>
      </button>
    </div>
  );
}

/** What came out: big, its name and rarity, how worn, a line about it, and what to do with it. */
function Result({ open, onAgain, onBack }: { open: Open; onAgain: (() => void) | null; onBack: () => void }) {
  const w = useWallet();
  const it = open.item;
  const sk = skinById(it.skin)!;
  const tier = RARITIES.indexOf(sk.rarity) + 1;
  const owned = w.skins.some((s) => s.uid === it.uid);
  const on = w.equipped[sk.weapon] === it.uid;
  useEffect(() => {
    sfx.play('reveal', { rate: tier });
    if (tier >= 3) window.dispatchEvent(new Event('mira-cheer'));
  }, [tier]);
  return (
    <div className="result" style={{ ['--rar' as string]: RARITY[sk.rarity].color }} data-tier={tier}>
      <p className="result-rar">{RARITY[sk.rarity].name}</p>
      <img className="result-icon" src={skinIconURL(sk, it.seed, it.wear)} alt="" width={256} height={96} />
      <p className="result-name">
        {WEAPON_NAME[sk.weapon]} <span>|</span> {sk.name}
      </p>
      <p className="result-wear">
        {wearName(it.wear)} · wear {it.wear.toFixed(3)} · pattern {it.seed}
      </p>
      <p className="result-blurb">{sk.blurb}</p>
      <div className="result-actions">
        {owned && (
          <button type="button" className="ink-btn solid" disabled={on} onClick={() => (purse.equip(it.uid), sfx.play('equip'))}>
            {on ? 'Equipped' : 'Equip it'}
          </button>
        )}
        {owned && !on && (
          <button type="button" className="ink-btn" onClick={() => (purse.sell(it.uid), sfx.play('sell'), onBack())}>
            Sell for {sellPrice(sk, it.wear)}
          </button>
        )}
        {onAgain && (
          <button type="button" className="ink-btn solid" onClick={onAgain}>
            Open another
          </button>
        )}
        <button type="button" className="ink-btn" onClick={onBack}>
          Done
        </button>
      </div>
    </div>
  );
}

/** A case being opened: the reel, then what came out (and another of the same, if you have one). */
export default function Opening({ open, setOpen, onBack }: { open: Open; setOpen: (o: Open | null) => void; onBack: () => void }) {
  const w = useWallet();
  if (!open.landed) return <Reel key={open.item.uid} kind={open.kind} item={open.item} onDone={() => setOpen({ ...open, landed: true })} />;
  const next = w.cases.find((c) => c.kind === open.kind);
  return <Result open={open} onBack={onBack} onAgain={next ? () => setOpen(openCase(next.uid)) : null} />;
}
