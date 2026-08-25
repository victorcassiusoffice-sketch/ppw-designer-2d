/**
 * P3 gate shot — draw mode with 2 committed vertices and a live third
 * segment, so all three measurement chips are on screen at once:
 * two midpoint callouts and the running length at the cursor.
 *
 * Shot at 100 % AND at 50 % zoom, because the whole point of the fix is
 * that the numbers do NOT shrink with the stage transform.
 *
 *   node tools/shoot-draw-measure.mjs [baseUrl]
 */
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const BASE = process.argv[2] ?? process.env.PPW_E2E_BASE_URL ?? 'http://localhost:5187';
const OUT = resolve(process.cwd(), 'docs/ui-modernize-2026-08-25/after');
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
await ctx.addInitScript(() => {
  localStorage.clear();
  localStorage.setItem('ppw_designer_coach_v1', '1');
});
const page = await ctx.newPage();
await page.goto(`${BASE}/designer`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.konvajs-content canvas', { timeout: 20000 });

await page.locator('[data-testid="room-draw-toggle"]').first().click();
await page.waitForTimeout(300);

const box = await page.locator('.konvajs-content canvas').first().boundingBox();
const P = (fx, fy) => [box.x + box.width * fx, box.y + box.height * fy];

// Two committed vertices, then hover to a third so the live segment shows.
await page.mouse.click(...P(0.34, 0.34));
await page.mouse.click(...P(0.58, 0.34));
await page.mouse.move(...P(0.58, 0.62), { steps: 10 });
await page.waitForTimeout(500);

await page.evaluate(() => document.fonts?.ready).catch(() => {});
await page.screenshot({ path: `${OUT}/draw-measure.png`, timeout: 30000, animations: 'disabled' });

// Same state at ~50 % zoom — the chips must be the SAME on-screen size.
// Wheel until the readout actually reports <= 50 %, rather than guessing a
// step count (the zoom curve is multiplicative, see lib/zoom).
for (let i = 0; i < 24; i++) {
  const pct = await page.evaluate(() => {
    const m = document.body.innerText.match(/(\d+)%/);
    return m ? Number(m[1]) : 100;
  });
  if (pct <= 50) break;
  await page.mouse.wheel(0, 240);
  await page.waitForTimeout(70);
}
await page.mouse.move(...P(0.58, 0.62), { steps: 6 });
await page.waitForTimeout(500);
const zoom = await page.evaluate(() => {
  const t = document.body.innerText.match(/(\d+)%/);
  return t ? t[1] : '?';
});
await page.screenshot({
  path: `${OUT}/draw-measure-zoomed-out.png`,
  timeout: 30000,
  animations: 'disabled',
});
console.log(`saved draw-measure.png (100%) and draw-measure-zoomed-out.png (${zoom}%)`);

await browser.close();
