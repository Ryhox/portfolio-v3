// Screenshots of the three stops (meadow, clearing, hollow) at several screen sizes, for checking layouts.
// Run with the site running:  node scripts/shots.mjs [url] [outDir] [phone,tablet,...]
import puppeteer from 'puppeteer-core';
import { mkdir } from 'node:fs/promises';

const url = process.argv[2] ?? 'http://localhost:3333';
const out = process.argv[3] ?? 'shots';
const only = process.argv[4]?.split(',');
const chrome = process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const sizes = [
  { name: 'phone', width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
  { name: 'tablet', width: 820, height: 1180, deviceScaleFactor: 2 },
  { name: 'laptop', width: 1440, height: 900, deviceScaleFactor: 2 },
  { name: 'desktop', width: 1920, height: 1080, deviceScaleFactor: 1 },
  { name: 'ultrawide', width: 2560, height: 1080, deviceScaleFactor: 1 },
];

await mkdir(out, { recursive: true });
const browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ['--use-angle=d3d11', '--enable-gpu'] });
try {
  for (const s of sizes.filter((z) => !only || only.includes(z.name))) {
    const page = await browser.newPage();
    await page.setViewport(s);
    await page.goto(url, { waitUntil: 'networkidle0' });
    await page.waitForSelector('html[data-forest="ready"]', { timeout: 40000 });
    await new Promise((r) => setTimeout(r, 4000));
    const stops = await page.evaluate(() => {
      const work = document.querySelector('[data-stage="work"]');
      const vh = window.innerHeight;
      return { hero: 0, clearing: work.offsetTop + (work.offsetHeight - vh) / 2, hollow: document.documentElement.scrollHeight - vh };
    });
    for (const [stop, y] of Object.entries(stops)) {
      await page.evaluate((top) => window.scrollTo(0, top), y);
      await new Promise((r) => setTimeout(r, 2500));
      if (stop === 'clearing') {
        await page.evaluate(() => document.querySelector('[data-disc="4"]')?.click());
        await new Promise((r) => setTimeout(r, 2500));
      }
      await page.screenshot({ path: `${out}/${s.name}-${stop}.png` });
      console.log(`${out}/${s.name}-${stop}.png`);
    }
    await page.close();
  }
} finally {
  await browser.close();
}
