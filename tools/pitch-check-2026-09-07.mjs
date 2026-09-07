import { chromium } from 'playwright';
import { pathToFileURL } from 'node:url';
const dist = process.argv[2];
const b = await chromium.launch();
for (const [name, vp, mobile] of [['local-desktop', { width: 1366, height: 768 }, false], ['local-phone', { width: 390, height: 844 }, true]]) {
  const ctx = await b.newContext({ viewport: vp, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(/^https?:/.test(dist) ? dist : pathToFileURL(dist + '/index.html').href, { waitUntil: 'load' });
  await page.waitForTimeout(600);
  await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 500) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)); } window.scrollTo(0, 0); });
  await page.waitForTimeout(1500);
  const vals = await page.evaluate(() => ({ paint: document.querySelector('#p-out').textContent, tiles: document.querySelector('#t-out').textContent, solar: document.querySelector('#s-out').textContent, scale: document.querySelector('#sc-read').textContent, imgs: [...document.images].map((i) => [i.getAttribute('src'), i.naturalWidth]) }));
  await page.screenshot({ path: `${process.argv[3] ?? dist}/${name}.png`, fullPage: true });
  console.log(name, JSON.stringify({ errors, ...vals }));
  await ctx.close();
}
await b.close();
