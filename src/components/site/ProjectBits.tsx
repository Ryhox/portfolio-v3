'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';

/** The project's film in the screen page's frame, its shape taken from the video once it knows it. */
export function ProjectVideo({ slug, title }: { slug: string; title: string }) {
  const video = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = video.current;
    if (!v) return;
    // the metadata may have come before this ran (the page is drawn on the server)
    const fit = () => v.videoWidth && v.parentElement?.style.setProperty('--ar', (v.videoWidth / v.videoHeight).toFixed(4));
    if (v.readyState >= 1) fit();
    v.addEventListener('loadedmetadata', fit);
    return () => v.removeEventListener('loadedmetadata', fit);
  }, [slug]);
  return (
    <div className="sp-frame">
      <video ref={video} src={`/work/${slug}.mp4`} muted loop playsInline autoPlay preload="auto" aria-label={`${title}, in motion`} />
    </div>
  );
}

/** The keys the monitor's page has: ← and → flip to the neighbours, Esc leaves for the forest. */
export function ProjectKeys({ prev, next }: { prev: string; next: string }) {
  const router = useRouter();
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || (e.target as HTMLElement)?.closest?.('input, textarea')) return;
      if (e.key === 'ArrowLeft') router.push(prev);
      else if (e.key === 'ArrowRight') router.push(next);
      else if (e.key === 'Escape') router.push('/');
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [router, prev, next]);
  return null;
}
