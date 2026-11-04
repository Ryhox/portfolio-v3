/**
 * What you have in pill mode: the points the hunt earns (they're the money at Mira's), the cases you've bought
 * and not opened, the skins you've unboxed and which one each weapon wears. Remembered between visits.
 */
import type { WeaponId } from './arms';
import { CASES, roll, sellPrice, skinById, type CaseKind, type Drop } from './loot';
import { persisted } from './persist';

export type SkinItem = Drop & { uid: string; at: number };
export type CaseItem = { uid: string; kind: CaseKind; lucky?: boolean };
export type WalletState = {
  points: number;
  kills: number;
  best: number;
  opened: number;
  cases: CaseItem[];
  skins: SkinItem[];
  equipped: Partial<Record<WeaponId, string>>;
  /** Mira has met you (and given you the first case) */
  met: boolean;
};

export const wallet = persisted<WalletState>('pill-wallet', { points: 0, kills: 0, best: 0, opened: 0, cases: [], skins: [], equipped: {}, met: false });

const uid = () => `${Date.now().toString(36)}${Math.floor(Math.random() * 1e9).toString(36)}`;

export const purse = {
  earn(points: number) {
    wallet.set((s) => ({ points: s.points + points, kills: s.kills + 1 }));
  },
  streak(n: number) {
    if (n > wallet.get().best) wallet.set({ best: n });
  },
  /** Buys a case: false if you can't afford it. */
  buy(kind: CaseKind): CaseItem | null {
    const price = CASES[kind].price;
    const s = wallet.get();
    if (s.points < price) return null;
    const item = { uid: uid(), kind };
    wallet.set({ points: s.points - price, cases: [...s.cases, item] });
    return item;
  },
  /** The first visit: a case on the house. */
  meet() {
    const s = wallet.get();
    if (s.met) return null;
    const item: CaseItem = { uid: uid(), kind: 'meadow', lucky: true };
    wallet.set({ met: true, cases: [...s.cases, item] });
    return item;
  },
  /** Opens a case you have: what came out is yours at once (the reel only shows it). */
  open(caseUid: string): SkinItem | null {
    const s = wallet.get();
    const c = s.cases.find((x) => x.uid === caseUid);
    if (!c) return null;
    const drop = roll(c.kind, !!c.lucky);
    const item: SkinItem = { ...drop, uid: uid(), at: Date.now() };
    wallet.set({ cases: s.cases.filter((x) => x.uid !== caseUid), skins: [item, ...s.skins], opened: s.opened + 1 });
    return item;
  },
  equip(skinUid: string) {
    const s = wallet.get();
    const it = s.skins.find((x) => x.uid === skinUid);
    const sk = it && skinById(it.skin);
    if (!sk) return;
    wallet.set({ equipped: { ...s.equipped, [sk.weapon]: skinUid } });
  },
  unequip(weapon: WeaponId) {
    const e = { ...wallet.get().equipped };
    delete e[weapon];
    wallet.set({ equipped: e });
  },
  sell(skinUid: string) {
    const s = wallet.get();
    const it = s.skins.find((x) => x.uid === skinUid);
    const sk = it && skinById(it.skin);
    if (!it || !sk) return 0;
    const price = sellPrice(sk, it.wear);
    const equipped = { ...s.equipped };
    for (const k of Object.keys(equipped) as WeaponId[]) if (equipped[k] === skinUid) delete equipped[k];
    wallet.set({ points: s.points + price, skins: s.skins.filter((x) => x.uid !== skinUid), equipped });
    return price;
  },
  /** A cheat, for the console: `pill.points(10000)`. */
  cheat(points: number) {
    wallet.set((s) => ({ points: Math.max(0, s.points + Math.round(points)) }));
    return wallet.get().points;
  },
  /** The skin a weapon wears, if any. */
  worn(weapon: WeaponId): SkinItem | undefined {
    const s = wallet.get();
    const u = s.equipped[weapon];
    return u ? s.skins.find((x) => x.uid === u) : undefined;
  },
};

// the console's cheats: `pill.points(10000)` for points, `pill.cases(3)` for Meadow Cases, `pill.reset()` to start over
if (typeof window !== 'undefined') {
  Object.assign(window, {
    pill: {
      points: (n = 10000) => {
        const total = purse.cheat(n);
        console.log(`%cCaught ya, cheater! %cBut it's fine. You've got ${total.toLocaleString('en-US')} points now.`, 'font-weight:700;color:#c0503a', 'color:inherit');
        return total;
      },
      cases: (n = 1) => {
        for (let i = 0; i < n; i++) wallet.set((s) => ({ cases: [...s.cases, { uid: uid(), kind: 'meadow' as const }] }));
        return wallet.get().cases.length;
      },
      reset: () => wallet.reset(),
      ...(process.env.NODE_ENV !== 'production' ? { _wallet: wallet, _purse: purse } : {}),
    },
  });
}
