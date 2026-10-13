/**
 * Demo-clean screenshots: /demo in 2D and 3D at 1280 + 390, plus the Paint
 * panel and the products list open. Evidence for the PR, not a test.
 *
 *   node tools/demo-clean/shots.mjs <base-url> <out-dir>
 */
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const BASE = (process.argv[2] ?? 'http://localhost:5173').replace(/\/+$/, '');
const OUT = process.argv[3] ?? 'demo-clean-shots';
mkdirSync(OUT, { recursive: true });

const RESOLVE = process.env.DEMO_CLEAN_RESOLVE ? [`--host-resolver-rules=MAP ${new URL(BASE).hostname} ${process.env.DEMO_CLEAN_RESOLVE}`] : [];
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', ...RESOLVE] });
const errors = [];
for (const vp of [{ name: '1280', viewport: { width: 1280, height: 800 }, mobile: false }, { name: '390', viewport: { width: 390, height: 844 }, mobile: true }]) {
  const ctx = await browser.newContext({ viewport: vp.viewport, isMobile: vp.mobile, hasTouch: vp.mobile });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`${vp.name}: ${m.text().slice(0, 160)}`); });
  page.on('pageerror', (e) => errors.push(`${vp.name}: ${String(e).slice(0, 160)}`));
  const shot = (name) => page.screenshot({ path: join(OUT, `${vp.name}-${name}.png`), timeout: 60000, animations: 'disabled' }).catch((e) => console.log(`skip ${vp.name}-${name}: ${e.message.split('\n')[0]}`));
  const mounted = () => page.waitForFunction(() => document.querySelectorAll('button').length >= 8, null, { timeout: 90000 }).then(() => page.waitForTimeout(4000));
  await page.goto(`${BASE}/demo`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await mounted();
  await shot('3d');
  await page.goto(`${BASE}/demo?view=2d`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await mounted();
  await shot('2d');
  const clickTestId = (id) => page.evaluate((t) => { const el = [...document.querySelectorAll(`[data-testid="${t}"]`)].find((e) => e.getBoundingClientRect().width > 0); if (el) { el.click(); return true; } return false; }, id);
  // Paint lives under the Finish group.
  await page.evaluate(() => { const el = [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Finish' && b.getBoundingClientRect().width > 0); el?.click(); });
  await page.waitForTimeout(800);
  if (await clickTestId('wallpaint-tool-toggle')) { await page.waitForTimeout(1500); await shot('2d-paint'); await page.keyboard.press('Escape'); await clickTestId('wallpaint-tool-toggle'); }
  if (await clickTestId('cart-pill')) { await page.waitForTimeout(1200); await shot('2d-products'); }
  await ctx.close();
}
await browser.close();
console.log(`console errors: ${errors.length}`);
for (const e of errors) console.log(e);
