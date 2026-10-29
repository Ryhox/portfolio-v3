// Measures how long until the forest is ready, and frame times while scrolling the whole walk.
// Run with the site running:  node scripts/perf.mjs [url] [width] [height] [dpr]
import puppeteer from 'puppeteer-core';

const url = process.argv[2] ?? 'http://localhost:3333';
const width = Number(process.argv[3] ?? 1440);
const height = Number(process.argv[4] ?? 900);
const dpr = Number(process.argv[5] ?? 2);
const chrome = process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--disable-gpu-vsync', '--disable-frame-rate-limit'] });
try {
  const page = await browser.newPage();
  await page.setViewport({ width, height, deviceScaleFactor: dpr });
  const t0 = Date.now();
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  const firstPaint = Date.now() - t0;
  await page.waitForSelector('html[data-forest="ready"]', { timeout: 60000 });
  const ready = Date.now() - t0;
  await new Promise((r) => setTimeout(r, 1500));
  // scroll straight away, as a visitor would
  const frames = await page.evaluate(async () => {
    const max = document.documentElement.scrollHeight - innerHeight;
    const times = [];
    let last = performance.now();
    const start = last;
    await new Promise((done) => {
      const step = (now) => {
        times.push(now - last);
        last = now;
        const k = (now - start) / 8000;
        window.scrollTo(0, Math.min(1, k) * max);
        if (k < 1) requestAnimationFrame(step);
        else done();
      };
      requestAnimationFrame(step);
    });
    times.sort((a, b) => a - b);
    const pct = (p) => times[Math.floor(times.length * p)].toFixed(1);
    return { frames: times.length, median: pct(0.5), p95: pct(0.95), worst: times[times.length - 1].toFixed(1), slow: window.__slowFrames };
  });
  console.log(JSON.stringify({ size: `${width}x${height}@${dpr}`, domContentLoadedMs: firstPaint, forestReadyMs: ready, frameMs: frames }));
} finally {
  await browser.close();
}
