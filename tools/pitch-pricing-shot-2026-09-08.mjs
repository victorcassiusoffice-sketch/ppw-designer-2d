import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const page_url = process.argv[2];
const out = process.argv[3] || 'docs/pitch-page-2026-09-07/pricing-2026-09-08';
fs.mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
for (const [name, w, h] of [['desktop-1366', 1366, 900], ['phone-390', 390, 844]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  const errs = [];
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto(page_url, { waitUntil: 'networkidle' });
  await p.evaluate(() => document.querySelectorAll('.reveal').forEach(e => e.classList.add('in')));
  await p.locator('#pricing').scrollIntoViewIfNeeded();
  await p.waitForTimeout(800);
  await p.locator('#pricing').screenshot({ path: path.join(out, `pricing-${name}.png`) });
  const overflow = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  const amounts = await p.evaluate(() => [...document.querySelectorAll('#pricing .amt, #pricing .setup, #pricing .care')].map(e => e.textContent.replace(/\s+/g, ' ').trim()));
  console.log(name, '| h-overflow', overflow, '| console errors', errs.length);
  console.log('  ', JSON.stringify(amounts));
  await ctx.close();
}
await browser.close();
