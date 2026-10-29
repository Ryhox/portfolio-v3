'use client';

import { useState } from 'react';
import { iconSvg, type IconKey } from '@/content/icons';
import { site } from '@/content/site';

/** A social's pixel icon, drawn from the same grid the forest paints its buttons with. */
function Icon({ name }: { name: IconKey }) {
  return (
    <svg className="px-icon" viewBox="0 0 16 16" width="32" height="32" shapeRendering="crispEdges" aria-hidden="true">
      {iconSvg(name).map((p) => (
        <path key={p.fill} d={p.d} fill={p.fill} />
      ))}
    </svg>
  );
}

/**
 * GitHub, Modrinth, Email and Discord (whose handle goes to the clipboard).
 * `pin` hands the links to the forest, which paints them and lays them over its painting;
 * `pixel` draws them as the cosy pixel buttons themselves, each with its icon.
 */
export default function Socials({ className, pin, pixel }: { className?: string; pin?: string; pixel?: boolean }) {
  const p = (id: string) => (pin ? { 'data-pin': `${pin}-${id}`, 'data-show': 'false' } : {});
  const [copied, setCopied] = useState(false);
  const cls = pixel ? 'pixel-btn' : undefined;
  return (
    <ul className={className}>
      {site.socials.map((s) => (
        <li key={s.label}>
          <a href={s.href} target="_blank" rel="noreferrer" className={cls} {...p(s.label.toLowerCase())}>
            {pixel && <Icon name={s.label.toLowerCase() as IconKey} />}
            {s.label}
          </a>
        </li>
      ))}
      <li>
        <a href={`mailto:${site.email}`} className={cls} {...p('email')}>
          {pixel && <Icon name="email" />}
          Email
        </a>
      </li>
      <li>
        <button
          type="button"
          className={cls}
          {...p('discord')}
          data-copied={copied}
          aria-label={copied ? `Copied ${site.discord}` : `Copy the Discord handle ${site.discord}`}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(site.discord);
              setCopied(true);
              setTimeout(() => setCopied(false), 1600);
            } catch {
              /* clipboard blocked: nothing to do */
            }
          }}
        >
          {pixel && <Icon name="discord" />}
          {copied ? 'Copied' : 'Discord'}
        </button>
      </li>
    </ul>
  );
}
