// Repro (verify workflow, phone journey P1): on a 390 px phone, tapping the
// Jinko panel tile in the Eco tab switches to the Roof but "no panel renders".
import { chromium } from 'playwright';
const base = process.argv[2] ?? 'http://127.0.0.1:5188';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.addInitScript(() => {
  localStorage.clear(); localStorage.setItem('ppw_designer_coach_v1', '1');
  const p = { id: 'p', name: 'Main Room', activeRoomId: 'r1', rooms: [{ id: 'r1', name: 'Main Room', polygon: [{ x: 0, y: 0 }, { x: 6, y: 0 }, { x: 6, y: 4 }, { x: 0, y: 4 }], placedItems: [] }] };
  localStorage.setItem('ppw_property_v2', JSON.stringify({ state: { property: p, showGrid: true, pxPerMetre: 100 }, version: 2 }));
});
await page.goto(`${base}/designer`, { waitUntil: 'networkidle' });
await page.waitForSelector('.konvajs-content canvas', { state: 'attached' });
await page.waitForTimeout(1500);
const eco = page.locator('[data-testid="sims-cat-eco"]').first();
await eco.click();
await page.waitForTimeout(600);
const tile = page.locator('[data-testid="sims-bottom-toolbar"] [data-product-id="emcar-jinko-475"]').first();
await tile.scrollIntoViewIfNeeded();
await tile.click();
await page.waitForTimeout(500);
// The phone flow: tile tap opens the product popup; "+ Add to room" auto-places.
const addBtn = page.locator('[data-testid="popup-add-to-room"]');
if (await addBtn.count()) { await addBtn.click(); } else { console.log('no popup; popups on page:', await page.locator('[data-testid="mobile-product-popup"]').count()); }
await page.waitForTimeout(900);
const s1 = await page.evaluate(() => { const p = JSON.parse(localStorage.getItem('ppw_property_v2')).state.property; return { activeLevelId: p.activeLevelId, levels: p.levels, rooms: p.rooms.map((r) => ({ id: r.id, kind: r.kind, levelId: r.levelId, items: r.placedItems.map((i) => [i.productId, i.x, i.y]) })) }; });
const armed = await page.evaluate(() => document.querySelector('[data-armed="true"], [data-testid="sims-bottom-toolbar"] [aria-pressed="true"]')?.getAttribute('data-product-id') ?? null);
await page.screenshot({ path: 'docs/pitch-page-2026-09-07/live/repro-phone-solar-1.png' });
// Now tap the canvas centre (the placement gesture) and look again.
const box = await page.locator('.konvajs-content').boundingBox();
await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height * 0.35);
await page.waitForTimeout(900);
const s2 = await page.evaluate(() => { const p = JSON.parse(localStorage.getItem('ppw_property_v2')).state.property; return { activeLevelId: p.activeLevelId, rooms: p.rooms.map((r) => ({ id: r.id, kind: r.kind, levelId: r.levelId, items: r.placedItems.map((i) => i.productId) })) }; });
const hint = await page.locator('text=Your room is empty').count();
const toasts = await page.locator('[role="status"], [data-testid^="toast"]').allTextContents().catch(() => []);
await page.screenshot({ path: 'docs/pitch-page-2026-09-07/live/repro-phone-solar-2.png' });
console.log(JSON.stringify({ afterTileTap: s1, armedProduct: armed, afterCanvasTap: s2, emptyHint: hint, toasts, errors }, null, 1));
await b.close();
