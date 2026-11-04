// The crew's bodies: every logo in assets/logos (SVG) drawn in a browser, trimmed to its shape and saved as a
// transparent WEBP in public/logos. Line-art marks (the llama, the cup, the infinity) get their insides filled
// white, so each reads as one body to put eyes on.
// Run:  node scripts/logos.mjs        (CHROME_PATH picks the browser; any Chromium will do)
import puppeteer from 'puppeteer-core';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';

const SRC = 'assets/logos';
const OUT = 'public/logos';
const SIZE = 480;
const FILL = new Set(['ollama', 'java', 'arduino']);
const chrome = process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';

await mkdir(OUT, { recursive: true });
const browser = await puppeteer.launch({ executablePath: chrome, headless: true });
try {
  const page = await browser.newPage();
  await page.setContent('<!doctype html><body></body>');
  for (const file of (await readdir(SRC)).filter((f) => f.endsWith('.svg'))) {
    const name = file.replace(/\.svg$/, '');
    const svg = await readFile(`${SRC}/${file}`, 'utf8');
    const data = await page.evaluate(
      async (svg, size, fill) => {
        const img = new Image();
        img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
        await img.decode();
        const c = document.createElement('canvas');
        c.width = c.height = size;
        const g = c.getContext('2d', { willReadFrequently: true });
        g.drawImage(img, 0, 0, size, size);
        const im = g.getImageData(0, 0, size, size);
        const d = im.data;
        if (fill) {
          // whatever the outside can't reach is inside the drawing: paint it white under the lines
          const out = new Uint8Array(size * size);
          const stack = [];
          for (let i = 0; i < size; i++) stack.push(i, (size - 1) * size + i, i * size, i * size + size - 1);
          while (stack.length) {
            const k = stack.pop();
            if (out[k] || d[k * 4 + 3] > 60) continue;
            out[k] = 1;
            const x = k % size;
            if (x > 0) stack.push(k - 1);
            if (x < size - 1) stack.push(k + 1);
            if (k >= size) stack.push(k - size);
            if (k < size * (size - 1)) stack.push(k + size);
          }
          for (let k = 0; k < size * size; k++) {
            if (out[k]) continue;
            const a = d[k * 4 + 3] / 255;
            for (let j = 0; j < 3; j++) d[k * 4 + j] = Math.round(d[k * 4 + j] * a + 255 * (1 - a));
            d[k * 4 + 3] = 255;
          }
          g.putImageData(im, 0, 0);
        }
        // trimmed to the shape, with a little room
        let x0 = size, y0 = size, x1 = 0, y1 = 0;
        for (let y = 0; y < size; y++)
          for (let x = 0; x < size; x++)
            if (d[(y * size + x) * 4 + 3] > 8) {
              x0 = Math.min(x0, x);
              x1 = Math.max(x1, x);
              y0 = Math.min(y0, y);
              y1 = Math.max(y1, y);
            }
        const pad = 6;
        const t = document.createElement('canvas');
        t.width = x1 - x0 + 1 + pad * 2;
        t.height = y1 - y0 + 1 + pad * 2;
        t.getContext('2d').drawImage(c, x0 - pad, y0 - pad, t.width, t.height, 0, 0, t.width, t.height);
        return t.toDataURL('image/webp', 0.92);
      },
      svg,
      SIZE,
      FILL.has(name),
    );
    await writeFile(`${OUT}/${name}.webp`, Buffer.from(data.split(',')[1], 'base64'));
    console.log(`${OUT}/${name}.webp`);
  }
} finally {
  await browser.close();
}
