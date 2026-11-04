'use client';

import { useState } from 'react';
import { CASE_KINDS, CASES, caseIconURL } from '@/scene/loot';
import { sfx } from '@/sound/sfx';
import Opening, { openCase, type Open } from './Opening';
import Panel from './Panel';
import SkinGrid from './SkinGrid';
import { closePanel, useWallet } from './stores';

/** Your cases (on 4, anywhere in the wood): open them here, and put on what comes out. */
export default function CasesPanel() {
  const w = useWallet();
  const [tab, setTab] = useState<'cases' | 'skins'>('cases');
  const [open, setOpen] = useState<Open | null>(null);
  const groups = CASE_KINDS.map((k) => ({ k, list: w.cases.filter((c) => c.kind === k) })).filter((g) => g.list.length);
  return (
    <Panel title="Your cases" onClose={closePanel} closeKey="4">
      {open ? (
        <Opening open={open} setOpen={setOpen} onBack={() => setOpen(null)} />
      ) : (
        <>
          <div className="tabs" role="tablist">
            <button type="button" role="tab" aria-selected={tab === 'cases'} className="tab" onClick={() => (setTab('cases'), sfx.play('ui'))}>
              Cases <span className="count">{w.cases.length}</span>
            </button>
            <button type="button" role="tab" aria-selected={tab === 'skins'} className="tab" onClick={() => (setTab('skins'), sfx.play('ui'))}>
              Skins <span className="count">{w.skins.length}</span>
            </button>
          </div>
          {tab === 'skins' ? (
            <SkinGrid empty="No skins yet. Open a case to get one." />
          ) : groups.length === 0 ? (
            <p className="panel-empty">No cases yet. Mira sells them at her cottage across the lake, behind where you woke up. Hunt for points first.</p>
          ) : (
            <ul className="case-row">
              {groups.map(({ k, list }) => (
                <li key={k} className="case-card" style={{ ['--case' as string]: CASES[k].color }}>
                  <img className="case-icon" src={caseIconURL(k)} alt="" width={120} height={90} />
                  <h3 className="case-name">
                    {CASES[k].name} <span className="count">×{list.length}</span>
                  </h3>
                  <p className="case-blurb">{list.some((c) => c.lucky) ? 'A gift from Mira. It feels lucky.' : CASES[k].blurb}</p>
                  <div className="case-actions">
                    <button type="button" className="ink-btn solid" onClick={() => setOpen(openCase((list.find((c) => c.lucky) ?? list[0]).uid))}>
                      Open
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </Panel>
  );
}
