// The share images (Open Graph: what a link to the site shows in chats, search and social):
//   src/app/opengraph-image.png  the landing as it opens: the name with its posies, and a line under it
//   public/og/<slug>.jpg         a project: a frame of its video, and its title on the page's paper (like the monitor's page)
// Run with the site running:  npm run og [url] [slug,slug]   (slugs given: only those projects, not the landing)
import puppeteer from 'puppeteer-core';
import { existsSync } from 'node:fs';
import { mkdir, readFile } from 'node:fs/promises';

const url = process.argv[2] ?? 'http://localhost:3000';
const only = process.argv[3]?.split(',');
// where in its video a project's frame is taken (a share of the way through); the rest take a frame near the start
const frameAt = { pokyh: 0.62 };
const browsers = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
].filter(Boolean);
const executablePath = browsers.find((b) => existsSync(b));
if (!executablePath) throw new Error('No Chrome or Edge found: set CHROME_PATH');

// the projects, read from the content file (slug, title, kicker), so this needs no build step
const src = await readFile(new URL('../src/content/projects.ts', import.meta.url), 'utf8');
const projects = [...src.matchAll(/slug: '([^']+)',\s*title: '([^']+)',\s*kicker: '([^']+)'/g)].map(([, slug, title, kicker]) => ({ slug, title, kicker }));

const size = { width: 1200, height: 630, deviceScaleFactor: 1 };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath, headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });

try {
  // the landing, once the pen has written the name and the posies are out; the bar, the scroll hint and the dev badge
  // stepped aside, and a line of who under the name
  const page = only ? null : await browser.newPage();
  if (page) {
  await page.setViewport(size);
  await page.goto(url, { waitUntil: 'load', timeout: 120000 });
  await page.waitForSelector('html[data-forest="ready"]', { timeout: 120000 }).catch(() => {});
  await sleep(6000);
  await page.addStyleTag({
    content: `.nav, .scroll-hint, nextjs-portal { display: none !important; }
      .og-line { position: fixed; left: 0; right: 0; top: 76%; text-align: center; font-family: var(--text); font-size: 22px;
        letter-spacing: 0.04em; color: #3d4f3a; z-index: 10; }
      .og-line b { font-family: var(--display); font-weight: 400; font-style: italic; color: #1c2a1d; }`,
  });
  await page.evaluate(() => {
    const p = document.createElement('p');
    p.className = 'og-line';
    p.innerHTML = 'Web developer &amp; Three.js engineer · <b>South Tyrol</b> · ryhox.dev';
    document.body.append(p);
  });
  await sleep(400);
  await page.screenshot({ path: 'src/app/opengraph-image.png' });
  console.log('src/app/opengraph-image.png');
  await page.close();
  }

  // the projects
  await mkdir('public/og', { recursive: true });
  for (const p of projects.filter((x) => !only || only.includes(x.slug))) {
    const card = await browser.newPage();
    await card.setViewport(size);
    await card.setContent(
      `<!doctype html><html><head><meta charset="utf-8">
      <link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;1,9..144,400&family=Instrument+Sans:wght@500&display=block" rel="stylesheet">
      <style>
        html, body { margin: 0; width: 1200px; height: 630px; overflow: hidden; background: #efe8d4; }
        body { display: grid; grid-template-columns: 700px 1fr; }
        video { width: 700px; height: 630px; object-fit: cover; display: block; background: #111a13; }
        .words { padding: 64px 56px 52px 52px; display: flex; flex-direction: column; color: #1c2a1d; }
        .kicker { font: 500 15px 'Instrument Sans', sans-serif; letter-spacing: 0.14em; text-transform: uppercase; color: #9c4a36; margin: 0 0 18px; }
        h1 { font: 400 64px/1 'Fraunces', serif; font-variation-settings: 'SOFT' 100, 'opsz' 144; letter-spacing: -0.02em; margin: 0; }
        .by { margin-top: auto; font: 400 24px 'Fraunces', serif; font-style: italic; color: #3d4f3a; }
        .by span { display: block; font: 500 15px 'Instrument Sans', sans-serif; font-style: normal; letter-spacing: 0.08em; color: #6b6a55; margin-top: 6px; }
      </style></head><body>
      <video muted playsinline preload="auto" src="${url}/work/${p.slug}.mp4"></video>
      <div class="words"><p class="kicker">${p.kicker}</p><h1>${p.title}</h1><p class="by">by Ryhox<span>ryhox.dev</span></p></div>
      </body></html>`,
      { waitUntil: 'networkidle0', timeout: 120000 },
    );
    // a frame a little way in, once the fonts are there
    await card.evaluate(async (at) => {
      await document.fonts.ready;
      const v = document.querySelector('video');
      if (v.readyState < 1) await new Promise((r) => v.addEventListener('loadedmetadata', r, { once: true }));
      const d = v.duration || 4;
      v.currentTime = at ? d * at : Math.min(2, d * 0.3);
      await new Promise((r) => v.addEventListener('seeked', r, { once: true }));
    }, frameAt[p.slug] ?? 0);
    await sleep(300);
    await card.screenshot({ path: `public/og/${p.slug}.jpg`, type: 'jpeg', quality: 86 });
    console.log(`public/og/${p.slug}.jpg`);
    await card.close();
  }
} finally {
  await browser.close();
}
