/**
 * Verify pass 2026-09-07 — the phone strip showed every K1 product twice on
 * a deployed build (API row + bundled twin). Counts the strip's tiles at
 * 390 px and screenshots the Cardio tab so the fix has a before/after.
 *
 *   node tools/phone-strip-dupes-2026-09-07.mjs <baseUrl> <outPng>
 */
import { chromium, devices } from '@playwright/test';

const [base, out] = process.argv.slice(2);
if (!base || !out) throw new Error('usage: baseUrl outPng');
const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['iPhone 12'], viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.addInitScript(() => { localStorage.clear(); localStorage.setItem('ppw_designer_coach_v1', '1'); });
await page.goto(base + '/designer', { waitUntil: 'networkidle' });
await page.locator('[data-testid="start-quick-rectangle"]').click().catch(() => undefined);
const toolbar = page.locator('[data-testid="sims-bottom-toolbar"]');
await toolbar.locator('[data-testid="sims-cat-cardio"]').click();
await page.waitForTimeout(1200);
const report = await page.evaluate(() => {
  const strip = document.querySelector('[data-testid="sims-thumb-strip"]');
  const tiles = [...(strip?.querySelectorAll('[data-product-id]') ?? [])];
  const names = tiles.map((t) => (t.getAttribute('title') || t.getAttribute('aria-label') || '').split(' — ')[0].split(' · ')[0]);
  const dupNames = [...new Set(names.filter((n, i) => names.indexOf(n) !== i))];
  return { tiles: tiles.length, distinctNames: new Set(names).size, dupNames: dupNames.slice(0, 20), ids: tiles.map((t) => t.getAttribute('data-product-id')).slice(0, 40) };
});
await page.screenshot({ path: out, fullPage: false });
const health = await page.evaluate(async () => { try { const r = await fetch('/api/healthcheck?cb=' + Math.random()); return await r.json(); } catch { return null; } });
console.log(JSON.stringify({ base, commit: health?.commit?.slice(0, 7) ?? null, env: health?.env ?? null, ...report, pageErrors: errors }, null, 1));
await browser.close();
