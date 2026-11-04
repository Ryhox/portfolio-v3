'use client';

import { useState, useSyncExternalStore, type ReactNode } from 'react';
import { CROSS_COLORS, settings, type CrossColor, type Settings } from '@/scene/settings';
import { wallet } from '@/scene/wallet';
import { sfx } from '@/sound/sfx';
import { lockPointer } from '../Pill';
import { Loop, Paper, Squiggle, Tick } from './Doodle';
import { Points } from './Panel';
import SkinGrid from './SkinGrid';
import { useSettings, useWallet } from './stores';

type View = 'main' | 'skins' | 'settings' | 'controls';

function Row({ label, children, note }: { label: string; children: ReactNode; note?: string }) {
  return (
    <div className="set-row">
      <span className="set-label">
        {label}
        {note && <small>{note}</small>}
      </span>
      <span className="set-control">{children}</span>
    </div>
  );
}

function Slider({ k, min, max, step, show }: { k: keyof Settings; min: number; max: number; step: number; show: (v: number) => string }) {
  const s = useSettings();
  const v = s[k] as number;
  return (
    <>
      <input type="range" className="px-range" min={min} max={max} step={step} value={v} style={{ ['--fill' as string]: `${((v - min) / (max - min)) * 100}%` }} onChange={(e) => settings.set({ [k]: Number(e.target.value) } as Partial<Settings>)} aria-label={k} />
      <output>{show(v)}</output>
    </>
  );
}

function Toggle({ on, set, label }: { on: boolean; set: (v: boolean) => void; label: string }) {
  return (
    <button type="button" className="tick-btn" aria-pressed={on} aria-label={label} onClick={() => (set(!on), sfx.play('ui', { rate: on ? 0.8 : 1.2 }))}>
      <Tick on={on} />
      <span>{on ? 'On' : 'Off'}</span>
    </button>
  );
}

function SettingsView() {
  const s = useSettings();
  const muted = useSyncExternalStore(
    (f) => sfx.subscribe(f),
    () => sfx.muted,
    () => false,
  );
  const [reset, setReset] = useState(false);
  return (
    <div className="settings">
      <h3 className="set-head">Mouse</h3>
      <Row label="Sensitivity">
        <Slider k="sens" min={0.2} max={3} step={0.05} show={(v) => v.toFixed(2)} />
      </Row>
      <Row label="Scope & sights" note="extra, while aiming">
        <Slider k="scopeSens" min={0.2} max={2} step={0.05} show={(v) => v.toFixed(2)} />
      </Row>
      <Row label="Invert looking up and down">
        <Toggle on={s.invertY} set={(v) => settings.set({ invertY: v })} label="Invert Y" />
      </Row>
      <Row label="Right mouse aims" note="hold it down, or click once">
        <div className="segmented">
          {(['Hold', 'Toggle'] as const).map((m) => {
            const on = (m === 'Toggle') === s.toggleAim;
            return (
              <button key={m} type="button" aria-pressed={on} onClick={() => (settings.set({ toggleAim: m === 'Toggle' }), sfx.play('ui'))}>
                {m}
                {on && <Loop />}
              </button>
            );
          })}
        </div>
      </Row>
      <h3 className="set-head">Sound</h3>
      <Row label="Volume">
        <Slider k="volume" min={0} max={1} step={0.05} show={(v) => `${Math.round(v * 100)}%`} />
      </Row>
      <Row label="Sound">
        <Toggle
          on={!muted}
          set={(v) => {
            sfx.unlock();
            sfx.setMuted(!v);
          }}
          label="Sound"
        />
      </Row>
      <h3 className="set-head">Screen</h3>
      <Row label="Pixels" note="fine is crisper far off; chunky is the wood’s own">
        <div className="segmented">
          {(['chunky', 'fine'] as const).map((m) => {
            const on = s.pixels === m;
            return (
              <button key={m} type="button" aria-pressed={on} onClick={() => (settings.set({ pixels: m }), sfx.play('ui'))}>
                {m === 'chunky' ? 'Chunky' : 'Fine'}
                {on && <Loop />}
              </button>
            );
          })}
        </div>
      </Row>
      <Row label="Crosshair colour">
        <div className="swatches">
          {(Object.keys(CROSS_COLORS) as CrossColor[]).map((c) => (
            <button key={c} type="button" aria-pressed={s.crosshair === c} aria-label={c} style={{ ['--sw' as string]: CROSS_COLORS[c] }} onClick={() => (settings.set({ crosshair: c }), sfx.play('ui'))}>
              {s.crosshair === c && <Loop />}
            </button>
          ))}
        </div>
      </Row>
      <Row label="Key hints" note="under the scope, by the ammo">
        <Toggle on={s.hints} set={(v) => settings.set({ hints: v })} label="Key hints" />
      </Row>
      <Row label="Bunny-hop speed">
        <Toggle on={s.speedo} set={(v) => settings.set({ speedo: v })} label="Speed" />
      </Row>
      <h3 className="set-head">Progress</h3>
      <Row label="Points, cases and skins" note="kept in this browser">
        <button
          type="button"
          className="ink-btn"
          onClick={() => {
            if (!reset) return setReset(true);
            wallet.reset();
            setReset(false);
            sfx.play('deny');
          }}
        >
          {reset ? 'Sure? It all goes' : 'Start over'}
        </button>
      </Row>
      <Row label="Settings">
        <button type="button" className="ink-btn" onClick={() => (settings.reset(), sfx.play('ui'))}>
          Back to defaults
        </button>
      </Row>
    </div>
  );
}

const KEYS: [string[], string][] = [
  [['W', 'A', 'S', 'D'], 'Walk'],
  [['Shift'], 'Run · hold your breath behind the scope'],
  [['Space'], 'Jump · hold it to keep hopping'],
  [['LMB'], 'Shoot · slash with the knife, click on for a combo'],
  [['RMB'], 'Scope · iron sights · stab with the knife'],
  [['R'], 'Reload'],
  [['F'], 'Inspect, or flip the knife'],
  [['1', '2', '3'], 'Rifle · shotgun · knife'],
  [['Q'], 'The weapon you had before'],
  [['4'], 'Your cases'],
  [['E'], 'Use · talk · put a floppy in'],
  [['Esc'], 'This menu'],
];

/** The pause: a sheet of paper with what you've done, and the way back in, to your skins, the settings, the keys, or out. */
export default function PauseMenu({ wake }: { wake: () => void }) {
  const [view, setView] = useState<View>('main');
  const w = useWallet();
  const go = (v: View) => () => {
    setView(v);
    sfx.play('ui');
  };
  const title = view === 'skins' ? 'Your skins' : view === 'settings' ? 'Settings' : 'Controls';
  return (
    <div className="play-pause">
      <Paper className={`sheet${view === 'main' ? ' menu' : ' wide'}`}>
        {view === 'main' ? (
          <>
            <h2 className="menu-title">
              The wood goes on
              <Squiggle />
            </h2>
            <dl className="play-stats">
              {[
                ['Points', w.points.toLocaleString('en-US')],
                ['Animals', String(w.kills)],
                ['Best streak', String(w.best)],
                ['Cases opened', String(w.opened)],
              ].map(([k, v]) => (
                <div key={k}>
                  <dd>{v}</dd>
                  <dt>{k}</dt>
                </div>
              ))}
            </dl>
            <nav className="menu-list" aria-label="Pause">
              <button type="button" className="menu-item lead" onClick={lockPointer}>
                Keep exploring
              </button>
              <button type="button" className="menu-item" onClick={go('skins')}>
                Skins <span className="count">{w.skins.length}</span>
              </button>
              <button type="button" className="menu-item" onClick={go('settings')}>
                Settings
              </button>
              <button type="button" className="menu-item" onClick={go('controls')}>
                Controls
              </button>
              <button type="button" className="menu-item quiet" onClick={wake}>
                Wake up
              </button>
            </nav>
          </>
        ) : (
          <>
            <header className="panel-head">
              <button type="button" className="ink-btn back" onClick={go('main')} aria-label="Back">
                ←
              </button>
              <h2 className="panel-title">
                {title}
                <Squiggle />
              </h2>
              {view === 'skins' && <Points />}
            </header>
            <div className="panel-body">
              {view === 'skins' && <SkinGrid empty="No skins yet. Open a case to get one." />}
              {view === 'settings' && <SettingsView />}
              {view === 'controls' && (
                <dl className="keys">
                  {KEYS.map(([ks, v]) => (
                    <div key={v}>
                      <dt>
                        {ks.map((k) => (
                          <kbd key={k}>{k}</kbd>
                        ))}
                      </dt>
                      <dd>{v}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          </>
        )}
      </Paper>
    </div>
  );
}
