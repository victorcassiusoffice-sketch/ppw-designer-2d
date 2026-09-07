/**
 * Does the wall pen's PRIMARY button make a room? (Vic 2026-09-08: "the wall
 * draw feature doesn't work properly".) Draws a rectangle and presses the ink
 * button, then reports whether the plan gained a ROOM or only loose walls.
 *
 *   node tools/wall-done-trap-2026-09-08.mjs <base> [button-testid]
 */
import { chromium } from '@playwright/test';

const [base, testid = 'room-draw-finish-walls'] = process.argv.slice(2);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1366, height: 800 } });
await page.addInitScript(() => {
  try { localStorage.clear(); sessionStorage.clear(); localStorage.setItem('ppw_designer_coach_v1', '1'); } catch {}
});
await page.goto(base + '/designer', { waitUntil: 'networkidle' });
await page.waitForSelector('.konvajs-content canvas', { state: 'attached' });
await page.waitForTimeout(800);

// The pen is armed on a blank plan (2026-09-08). Only reach for a control
// when the HUD is NOT already up — pressing Walls then would stand it down.
if (!(await page.locator('[data-testid="room-draw-hud"]').isVisible().catch(() => false))) {
  const start = page.locator('[data-testid="start-draw-room"]');
  if (await start.isVisible().catch(() => false)) await start.click();
  else await page.locator('[data-testid="wall-tool-toggle"]').click();
  await page.waitForTimeout(500);
}

const box = await page.locator('.konvajs-content').boundingBox();
const cx = box.x + box.width / 2;
const cy = box.y + box.height / 2;
for (const [dx, dy] of [[-110, -110], [110, -110], [110, 110], [-110, 110]]) {
  await page.mouse.move(cx + dx, cy + dy, { steps: 5 });
  await page.mouse.click(cx + dx, cy + dy);
  await page.waitForTimeout(280);
}

const btn = page.locator(`[data-testid="${testid}"]`);
const label = (await btn.textContent().catch(() => ''))?.trim();
await btn.click();
await page.waitForTimeout(900);

const after = await page.evaluate(() => {
  const raw = JSON.parse(localStorage.getItem('ppw_property_v2') || '{}');
  const p = raw.state?.property ?? {};
  return {
    drawnRooms: (p.rooms || []).filter((r) => (r.polygon || []).length >= 3).map((r) => ({ id: r.id, name: r.name, pts: r.polygon.length })),
    freeWalls: (p.walls || []).length,
  };
});
const toast = await page.locator('[data-testid="toast"], [role="status"]').allTextContents().catch(() => []);
console.log(JSON.stringify({ pressed: testid, label, after, toast: toast.slice(0, 3) }, null, 1));
await browser.close();
