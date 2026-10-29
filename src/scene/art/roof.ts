import { CLEARING, ROOF, SUN } from '../config';
import { hash2, noise2, Pix } from '../pix';

/** Where a point lit by the sun would have to see the sky through the roof of leaves. */
export function holeAbove(x: number, y: number, z: number): [number, number] {
  const s = (ROOF.y - y) / -SUN[1];
  return [x - SUN[0] * s, z - SUN[2] * s];
}

/**
 * The roof of leaves over the wood. Never drawn: it only casts shadows, so the floor lies in shade
 * except where gaps let the sun through, and those gaps are what make the shafts in the fog.
 * Alpha only: opaque = leaves, clear = sky.
 */
export function roofMask(): Pix {
  const { w, h, x0, x1, z0, z1 } = ROOF;
  const p = new Pix(w, h);
  // one gap in the whole roof: the beam onto the computer
  const holes: [number, number, number][] = [[...holeAbove(CLEARING.computer.x + 0.1, 0.5, CLEARING.computer.z + 0.3), 1.7]];
  // solid leaves everywhere, then only the cells near the gap are worked out
  p.data.fill(0xff000000);
  for (const [hx, hz, rad] of holes) {
    const i0 = Math.max(0, Math.floor(((hx - rad * 1.6 - x0) / (x1 - x0)) * w));
    const i1 = Math.min(w - 1, Math.ceil(((hx + rad * 1.6 - x0) / (x1 - x0)) * w));
    const j0 = Math.max(0, Math.floor(((z0 - (hz + rad * 1.6)) / (z0 - z1)) * h));
    const j1 = Math.min(h - 1, Math.ceil(((z0 - (hz - rad * 1.6)) / (z0 - z1)) * h));
    for (let j = j0; j <= j1; j++) {
      const z = z0 + ((z1 - z0) * (j + 0.5)) / h;
      for (let i = i0; i <= i1; i++) {
        const x = x0 + ((x1 - x0) * (i + 0.5)) / w;
        const n = noise2(x * 0.55, z * 0.55, 11) * 0.7 + noise2(x * 2.1, z * 2.1, 12) * 0.3;
        const dx = (x - hx) / rad;
        const dz = (z - hz) / rad;
        const hole = 1 - (dx * dx + dz * dz);
        // a leafy ragged edge
        if (hole > 0 && hole > 0.12 + (n - 0.5) * 0.5 + (hash2(i, j, 13) - 0.5) * 0.1) p.data[j * w + i] = 0;
      }
    }
  }
  return p;
}
