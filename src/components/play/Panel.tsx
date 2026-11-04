'use client';

import type { ReactNode } from 'react';
import { Paper, Squiggle } from './Doodle';
import { useWallet } from './stores';

/** Your points, as Mira counts them. */
export function Points() {
  const w = useWallet();
  return (
    <p className="panel-points" aria-label={`${w.points} points`}>
      <span className="coin" aria-hidden="true" />
      {w.points.toLocaleString('en-US')}
      <small>pts</small>
    </p>
  );
}

/** A page over the wood: a sheet of paper with a title in pen, your points, and the way back. */
export default function Panel({ title, say, children, onClose, closeKey = 'Esc' }: { title: string; say?: ReactNode; children: ReactNode; onClose: () => void; closeKey?: string }) {
  return (
    <div className="play-panel-wrap">
      <Paper className="sheet wide">
        <header className="panel-head">
          <h2 className="panel-title">
            {title}
            <Squiggle />
          </h2>
          <Points />
          <button type="button" className="ink-btn panel-close" onClick={onClose}>
            Back to the wood <kbd>{closeKey}</kbd>
          </button>
        </header>
        {say && <p className="panel-say">{say}</p>}
        <div className="panel-body">{children}</div>
      </Paper>
    </div>
  );
}
