/**
 * Vic 2026-09-08: "it used to be as you click and hold, and you drag the line,
 * it draws the wall, and you can clearly see the measurements in real time...
 * And now you've switched it to click click, and you can't even delete one of
 * the walls you've just drawn."
 *
 * Establishes the CURRENT behaviour of three things before any change:
 *   A. does a press-drag-release draw a wall?
 *   B. do measurements show live while the pointer moves?
 *   C. can a wall you just drew be deleted — mid-run, and after committing?
 *
 *   node tools/wall-drag-delete-probe-2026-09-08.mjs <base> <outDir>
 */
import { chromium } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';

const [base, outDir] = process.argv.slice(2);
if (!base || !outDir) throw new Error('usage: base outDir');
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1366, height: 800 } });
const draw = [];
page.on('console', (m) => {
  const t = m.text();
  if (/\[draw-mode\]|\[draw-close\]/.test(t)) draw.push(t.slice(0, 120));
});
await page.addInitScript(() => {
  try { localStorage.clear(); sessionStorage.clear(); localStorage.setItem('ppw_designer_coach_v1', '1'); } catch {}
});
await page.goto(base + '/designer', { waitUntil: 'networkidle' });
await page.waitForSelector('.konvajs-content canvas', { state: 'attached' });
await page.waitForTimeout(900);

const box = await page.locator('.konvajs-content').boundingBox();
const ox = box.x + 260;
const oy = box.y + 200;

const state = async () => page.evaluate(() => {
  const q = (s) => document.querySelector(s);
  let walls = 0, rooms = 0;
  try {
    const p = JSON.parse(localStorage.getItem('ppw_property_v2') || '{}').state?.property ?? {};
    walls = (p.walls || []).length;
    rooms = (p.rooms || []).filter((r) => (r.polygon || []).length >= 3).length;
  } catch {}
  return {
    vertices: q('[data-testid="room-draw-vertices-count"]')?.textContent?.trim() ?? null,
    hud: !!q('[data-testid="room-draw-hud"]'),
    walls, rooms,
  };
});

const report = {};

// --- A. press, drag, release: does a wall appear? -------------------------
await page.mouse.move(ox, oy, { steps: 3 });
await page.mouse.down();
for (let i = 1; i <= 8; i++) {
  await page.mouse.move(ox + i * 25, oy, { steps: 2 });
  await page.waitForTimeout(40);
}
// B. capture what the canvas shows MID-DRAG (live measurement?)
await page.screenshot({ path: path.join(outDir, 'A-mid-drag.png') });
report.midDrag = await state();
await page.mouse.up();
await page.waitForTimeout(400);
report.afterDrag = await state();
await page.screenshot({ path: path.join(outDir, 'A-after-drag-release.png') });

// --- C1. click-click, then Undo: does the last wall go? -------------------
for (const [dx, dy] of [[0, 0], [200, 0], [200, 150]]) {
  await page.mouse.move(ox + dx, oy + dy, { steps: 4 });
  await page.mouse.click(ox + dx, oy + dy);
  await page.waitForTimeout(220);
}
report.afterThreeClicks = await state();
const undo = page.locator('[data-testid="room-draw-undo"]');
report.undoVisible = await undo.isVisible().catch(() => false);
report.undoEnabled = report.undoVisible ? await undo.isEnabled() : null;
if (report.undoEnabled) { await undo.click(); await page.waitForTimeout(350); }
report.afterUndo = await state();

// --- C2. commit as open walls, then try to delete one --------------------
const keep = page.locator('[data-testid="room-draw-finish-walls"]');
await keep.click();
await page.waitForTimeout(700);
report.afterKeepWalls = await state();
await page.screenshot({ path: path.join(outDir, 'C-walls-committed.png') });

// Is there any way to delete a wall without leaving the pen? Look for a
// remove control, then try the Remove tool on the wall we just drew.
const removeToggle = page.locator('[data-testid="remove-tool-toggle"]');
report.removeToolVisible = await removeToggle.isVisible().catch(() => false);
if (report.removeToolVisible) {
  await removeToggle.click();
  await page.waitForTimeout(400);
  // click the middle of the first wall segment we drew
  await page.mouse.move(ox + 100, oy, { steps: 4 });
  await page.mouse.click(ox + 100, oy);
  await page.waitForTimeout(600);
  report.afterRemoveClick = await state();
  await page.screenshot({ path: path.join(outDir, 'C-after-remove-click.png') });
}

// --- D. is there a zoom control anywhere? --------------------------------
report.zoomControls = await page.evaluate(() => {
  const hits = [];
  for (const b of document.querySelectorAll('button')) {
    const label = (b.getAttribute('aria-label') || b.getAttribute('title') || b.textContent || '').trim();
    if (/zoom|\bfit\b|\+|−|-/i.test(label) && label.length < 40) hits.push(label);
  }
  return [...new Set(hits)];
});

console.log(JSON.stringify({ report, drawLog: draw.slice(-14) }, null, 1));
await browser.close();
