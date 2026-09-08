/**
 * Does the Remove tool actually delete a free wall? The first probe clicked a
 * fixed screen point and the wall survived — but the canvas re-fits after a
 * commit, so that click may simply have missed. This one asks the DEV geometry
 * bridge where the wall really is, then clicks its midpoint.
 *
 *   node tools/wall-remove-check-2026-09-08.mjs <base>
 */
import { chromium } from '@playwright/test';

const base = process.argv[2] || 'http://localhost:5177';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1366, height: 800 } });
const log = [];
page.on('console', (m) => { const t = m.text(); if (/\[draw/.test(t)) log.push(t.slice(0, 110)); });
await page.addInitScript(() => {
  try { localStorage.clear(); sessionStorage.clear(); localStorage.setItem('ppw_designer_coach_v1', '1'); } catch {}
});
await page.goto(base + '/designer', { waitUntil: 'networkidle' });
await page.waitForSelector('.konvajs-content canvas', { state: 'attached' });
await page.waitForTimeout(800);

const hasBridge = await page.evaluate(() => typeof window.__ppwGeom !== 'undefined');
if (!hasBridge) { console.log(JSON.stringify({ skipped: 'no dev geometry bridge on this build' })); await browser.close(); process.exit(0); }

const box = await page.locator('.konvajs-content').boundingBox();
// Draw two walls with clicks.
for (const [dx, dy] of [[220, 180], [520, 180], [520, 380]]) {
  await page.mouse.move(box.x + dx, box.y + dy, { steps: 4 });
  await page.mouse.click(box.x + dx, box.y + dy);
  await page.waitForTimeout(200);
}
await page.locator('[data-testid="room-draw-finish-walls"]').click();
await page.waitForTimeout(900);

const walls = () => page.evaluate(() => {
  try {
    const p = JSON.parse(localStorage.getItem('ppw_property_v2') || '{}').state?.property ?? {};
    return (p.walls || []).map((w) => ({ id: w.id, a: w.a, b: w.b }));
  } catch { return []; }
});
const before = await walls();

// Where is the first wall NOW, on screen?
const mid = await page.evaluate((w) => {
  const g = window.__ppwGeom;
  if (!g || !g.ready()) return null;
  const a = g.worldToScreen(w.a.x, w.a.y);
  const b = g.worldToScreen(w.b.x, w.b.y);
  return a && b ? { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } : null;
}, before[0]);

await page.locator('[data-testid="remove-tool-toggle"]').click();
await page.waitForTimeout(300);
await page.mouse.move(mid.x, mid.y, { steps: 4 });
await page.mouse.click(mid.x, mid.y);
await page.waitForTimeout(700);
const after = await walls();

console.log(JSON.stringify({
  wallsBefore: before.length,
  wallMidpointOnScreen: mid,
  wallsAfterRemoveClick: after.length,
  removeWorks: after.length === before.length - 1,
}, null, 1));
await browser.close();
