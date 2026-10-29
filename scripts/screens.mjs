// Shrinks each project picture in assets/work to the old monitor's glass (39 × 26), saved to public/screens.
import sharp from 'sharp';
import { readdir } from 'node:fs/promises';

const W = 39;
const H = 26;
for (const f of await readdir('assets/work')) {
  if (!f.endsWith('.webp')) continue;
  const slug = f.replace(/\.webp$/, '');
  await sharp(`assets/work/${f}`).resize(W, H, { fit: 'cover', kernel: 'lanczos3' }).png({ palette: true, colours: 48 }).toFile(`public/screens/${slug}.png`);
  console.log(slug);
}
