// Pitch-page captures (2026-09-07): real frames of the designer for the public
// sales page — a furnished room (hero), the wall pen mid-draw, an item with
// its dimensions, the floor tool laying tiles, the wall-paint tool with its
// tin count, the roof with panels and the energy readout, and a phone frame.
//
//   node tools/pitch-captures-2026-09-07.mjs [baseUrl] [outDir]
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const base = process.argv[2] ?? 'http://127.0.0.1:5188';
const out = process.argv[3] ?? path.resolve('docs/pitch-page-2026-09-07/captures');
fs.mkdirSync(out, { recursive: true });

// A furnished wellness room from the seed catalog, world metres, top-left of
// each footprint. Room 6 x 4.5 m.
const ROOM = { id: 'r1', name: 'Wellness room', polygon: [{ x: 0, y: 0 }, { x: 6, y: 0 }, { x: 6, y: 4.5 }, { x: 0, y: 4.5 }], placedItems: [] };
const ITEMS = [
  { instanceId: 'i-tread', productId: 'k1-nordictrack-2450', x: 0.15, y: 0.15, rotation: 90 },
  { instanceId: 'i-bike', productId: 'k1-schwinn-700ic', x: 1.3, y: 0.2, rotation: 0 },
  { instanceId: 'i-bench', productId: 'k1-bench-adjustable-fid', x: 3.0, y: 0.3, rotation: 0 },
  { instanceId: 'i-smith', productId: 'k1-vision-smith', x: 3.6, y: 2.6, rotation: 0 },
  { instanceId: 'i-console', productId: 'demo-console-table', x: 1.2, y: 4.0, rotation: 0 },
  { instanceId: 'i-lamp', productId: 'demo-floor-lamp', x: 5.4, y: 0.2, rotation: 0 },
  { instanceId: 'i-plant', productId: 'demo-potted-plant', x: 1.3, y: 4.05, rotation: 0, parentInstanceId: 'i-console' },
];
const PROPERTY = (items) => ({ id: 'pitch', name: 'Wellness room', activeRoomId: 'r1', rooms: [{ ...ROOM, placedItems: items }] });

async function open(viewport, mobile, property, seedUI = {}) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, isMobile: mobile, hasTouch: mobile });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.addInitScript(({ p, ui }) => {
    try {
      localStorage.clear();
      sessionStorage.clear();
      localStorage.setItem('ppw_designer_coach_v1', '1');
      localStorage.setItem('ppw_property_v2', JSON.stringify({ state: { property: p, showGrid: true, pxPerMetre: 100 }, version: 2 }));
      localStorage.setItem('ppw_currency_v1', 'MUR');
      for (const [k, v] of Object.entries(ui)) localStorage.setItem(k, v);
    } catch { /* fresh profile */ }
  }, { p: property, ui: seedUI });
  await page.goto(`${base}/designer`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.konvajs-content canvas', { state: 'attached', timeout: 60_000 });
  // Let the lazy top-down art decode before the shot.
  await page.waitForTimeout(3000);
  return { browser, page, errors };
}

const shots = [];
async function snap(page, name, clip) {
  const file = path.join(out, `${name}.png`);
  await page.screenshot({ path: file, clip });
  shots.push(name);
  console.log('shot', name);
}

// 1. Hero: the furnished room at 1366.
{
  const { browser, page } = await open({ width: 1366, height: 768 }, false, PROPERTY(ITEMS));
  await page.locator('[data-testid="cart-pill"], [data-testid="cart-strip"]').first().waitFor({ timeout: 10_000 }).catch(() => {});
  await snap(page, 'hero-desktop');
  await browser.close();
}

// 2. Wall pen mid-draw (three points down, HUD showing length + angle).
{
  const { browser, page } = await open({ width: 1366, height: 768 }, false, { id: 'pitch-empty', name: 'New plan', activeRoomId: 'r1', rooms: [{ id: 'r1', name: 'Room 1', polygon: [], placedItems: [] }] });
  await page.locator('[data-testid="room-draw-toggle"]').click();
  await page.waitForTimeout(400);
  const box = await page.locator('.konvajs-content').boundingBox();
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  for (const p of [{ x: cx - 260, y: cy - 140 }, { x: cx + 200, y: cy - 140 }, { x: cx + 200, y: cy + 120 }]) {
    await page.mouse.click(p.x, p.y);
    await page.waitForTimeout(250);
  }
  await page.mouse.move(cx - 80, cy + 120);
  await page.waitForTimeout(400);
  await snap(page, 'wt-1-draw');
  await browser.close();
}

// 3. To scale: the treadmill selected, details panel showing its dimensions.
{
  const { browser, page } = await open({ width: 1366, height: 768 }, false, PROPERTY(ITEMS));
  await page.evaluate(() => {
    const g = window.__ppwGeom;
    return g ? g.worldToScreen(0.15 + 0.475, 0.15 + 1.025) : null;
  }).then(async (pt) => {
    if (pt) await page.mouse.click(pt.x, pt.y);
  });
  await page.waitForTimeout(700);
  await snap(page, 'wt-2-scale');
  await browser.close();
}

// 4. Floor tool: lay the room in Gym Interlock and show the live count.
{
  const { browser, page } = await open({ width: 1366, height: 768 }, false, PROPERTY(ITEMS));
  await page.locator('[data-testid="floor-paint-toggle"]').click();
  await page.waitForTimeout(500);
  await page.locator('[data-testid="floor-paint-gym-interlock"]').first().click().catch(() => {});
  await page.waitForTimeout(300);
  await page.locator('[data-testid="floor-paint-scope-room"]').click().catch(() => {});
  await page.waitForTimeout(300);
  await page.locator('[data-testid="floor-paint-room"]').click().catch(() => {});
  await page.waitForTimeout(900);
  await snap(page, 'wt-3-tiles');
  await browser.close();
}

// 5. Wall paint: paint the room and show the tin count.
{
  const { browser, page } = await open({ width: 1366, height: 768 }, false, PROPERTY(ITEMS));
  await page.locator('[data-testid="wallpaint-tool-toggle"]').click();
  await page.waitForTimeout(500);
  await page.locator('[data-testid="wallpaint-permoglaze-soft-feel"]').first().click().catch(() => {});
  await page.waitForTimeout(300);
  await page.locator('[data-testid="wallpaint-room"]').click().catch(() => {});
  await page.waitForTimeout(900);
  await snap(page, 'wt-4-paint');
  await browser.close();
}

// 6. Solar: roof with four panels and the energy readout open.
{
  const roofItems = [];
  for (let i = 0; i < 4; i++) roofItems.push({ instanceId: `pv-${i}`, productId: 'emcar-jinko-475', x: 0.3 + i * 1.134, y: 0.4, rotation: 0 });
  const prop = {
    id: 'pitch-solar', name: 'Wellness room', activeRoomId: 'r1', activeLevelId: 'roof',
    levels: [{ id: 'ground', name: 'Ground', index: 0 }, { id: 'roof', name: 'Roof', index: 1, kind: 'roof' }],
    rooms: [
      { ...ROOM, placedItems: ITEMS.filter((i) => !i.parentInstanceId) },
      { id: 'roof-r1', name: 'Roof', kind: 'roof', levelId: 'roof', polygon: ROOM.polygon, placedItems: roofItems },
    ],
  };
  const { browser, page } = await open({ width: 1366, height: 768 }, false, prop);
  await page.locator('[data-testid="energy-readout"]').click().catch(() => {});
  await page.waitForTimeout(700);
  await snap(page, 'wt-5-solar');
  await browser.close();
}

// 7. Phone frame of the furnished room.
{
  const { browser, page } = await open({ width: 390, height: 844 }, true, PROPERTY(ITEMS));
  await snap(page, 'phone-390');
  await browser.close();
}

fs.writeFileSync(path.join(out, 'shots.json'), JSON.stringify({ base, at: new Date().toISOString(), shots }, null, 2));
console.log('done', shots.length, 'shots ->', out);
