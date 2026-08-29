/**
 * Sims-world journey probe (2026-08-29) — drives the REAL app in Chromium
 * against a dev server and prints what the store holds after each gesture.
 * Not a test harness: a fast ground-truth check for the integrator.
 *
 *   node tools/sims-world-probe-2026-08-29.mjs [baseUrl]
 */
import { chromium } from '@playwright/test';

const BASE = process.argv[2] ?? process.env.PPW_E2E_BASE_URL ?? 'http://127.0.0.1:5188';

const ROOM = {
  id: 'prop-probe',
  name: 'Probe',
  activeRoomId: 'r1',
  rooms: [
    {
      id: 'r1',
      name: 'Studio',
      polygon: [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 4 }, { x: 0, y: 4 }],
      placedItems: [],
    },
  ],
};

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
await ctx.addInitScript((p) => {
  localStorage.clear();
  localStorage.setItem('ppw_designer_coach_v1', '1');
  localStorage.setItem(
    'ppw_property_v2',
    JSON.stringify({ state: { property: p, showGrid: true, pxPerMetre: 100 }, version: 2 }),
  );
}, ROOM);
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));
const toasts = [];
page.on('console', (m) => { const t = m.text(); if (t.startsWith('[place]') || t.startsWith('[drag-place]') || t.startsWith('[draw-close]')) toasts.push(t); });

const w2s = (x, y) => page.evaluate(([a, b]) => window.__ppwGeom.worldToScreen(a, b), [x, y]);
const store = () => page.evaluate(() => JSON.parse(localStorage.getItem('ppw_property_v2')).state.property);
const items = async () => (await store()).rooms.flatMap((r) => r.placedItems.map((i) => ({ room: r.name, kind: r.kind ?? 'room', id: i.productId, x: +i.x.toFixed(3), y: +i.y.toFixed(3), rot: i.rotation, light: i.lightOn })));
const arm = async (id) => { await page.locator(`[data-product-id="${id}"]`).first().click(); await page.waitForFunction(() => document.querySelectorAll('[data-armed="true"]').length === 2); };
const dropAt = async (x, y) => { const p = await w2s(x, y); await page.mouse.move(p.x, p.y, { steps: 6 }); await page.mouse.click(p.x, p.y); await page.waitForTimeout(150); await page.keyboard.press('Escape'); };

await page.goto(`${BASE}/designer`);
await page.waitForSelector('[data-testid="items-placed"]');
await page.waitForFunction(() => window.__ppwGeom && window.__ppwGeom.ready());
console.log('loaded; errors', errors.length);

// 1. Corner drop (treadmill 2.05 x 0.95) near the top-left corner.
await arm('k1-nordictrack-2450');
await dropAt(0.4, 0.3);
console.log('1 corner   ', JSON.stringify((await items()).at(-1)), '→ expect x≈0.05 y≈0.05 rot 0');

// 2. Right wall drop (vertical wall) mid-height.
await arm('k1-schwinn-700ic');
await dropAt(4.6, 2.2);
console.log('2 right    ', JSON.stringify((await items()).at(-1)), '→ expect x≈5-0.05-w, rot 90');

// 3. Bottom wall, near the right end: along-wall clamp keeps it inside.
await arm('k1-proform-carbon-tl');
await dropAt(4.7, 3.6);
console.log('3 bottom-end', JSON.stringify((await items()).at(-1)), '→ expect y≈4-0.05-0.85, x+w<=4.95, rot 180');

// 4. Outdoor drop (bench outside the room).
await arm('demo-outdoor-bench');
await dropAt(7, 1);
console.log('4 outdoor  ', JSON.stringify((await items()).at(-1)), '→ expect kind outdoor');

// 5. Outdoor drop flush to the OUTSIDE of the right wall.
await arm('demo-outdoor-bench');
await dropAt(5.35, 2.5);
console.log('5 outside-wall', JSON.stringify((await items()).at(-1)), '→ expect x≈5.05 rot 270');

// 6. Drag keeps rotation: drag the bike (rot 90) 1 m left into mid-room.
{
  const bike = (await items()).find((i) => i.id === 'k1-schwinn-700ic');
  const from = await w2s(bike.x + 0.275, bike.y + 0.6);
  const to = await w2s(bike.x - 1.4 + 0.275, bike.y + 0.6);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(200);
  await page.keyboard.press('Escape');
  console.log('6 drag-rot ', JSON.stringify((await items()).find((i) => i.id === 'k1-schwinn-700ic')), '→ expect rot still 90, x moved');
}

// 7. Light: place a lamp, select it, press L.
await arm('demo-floor-lamp');
await dropAt(2.5, 2.5);
{
  const lamp = (await items()).find((i) => i.id === 'demo-floor-lamp');
  const c = await w2s(lamp.x + 0.2, lamp.y + 0.2);
  await page.mouse.click(c.x, c.y);
  await page.waitForTimeout(150);
  await page.keyboard.press('l');
  await page.waitForTimeout(150);
  const after = (await items()).find((i) => i.id === 'demo-floor-lamp');
  const pools = await page.evaluate(() => window.Konva ? window.Konva.stages[0].find('.light-pool').length : -1);
  console.log('7 light    ', JSON.stringify(after), 'pools', pools, '→ expect light false, pools 0');
  await page.keyboard.press('l');
  await page.waitForTimeout(150);
  console.log('7b light   ', JSON.stringify((await items()).find((i) => i.id === 'demo-floor-lamp')), '→ expect light true');
  await page.keyboard.press('Escape');
}

// 8. Free walls: wall pen, 3 points, Finish walls; then unit stepper.
await page.locator('[data-testid="wall-tool-toggle"]').click();
await page.locator('[data-testid="room-draw-hud"]').waitFor({ state: 'attached' });
await page.keyboard.press('+');
const unitAfterPlus = await page.locator('[data-testid="snap-unit-current"]').first().textContent();
for (const [x, y] of [[6, 1], [8, 1], [8, 3]]) { const p = await w2s(x, y); await page.mouse.click(p.x, p.y); await page.waitForTimeout(80); }
await page.locator('[data-testid="room-draw-finish-walls"]').click();
await page.waitForTimeout(200);
console.log('8 walls    ', JSON.stringify((await store()).walls), 'unit after +:', unitAfterPlus, '→ expect 2 walls (6,1)-(8,1),(8,1)-(8,3), unit 0.25 m');

// 9. Levels: add a floor, draw a room on it, switch back.
await page.locator('[data-testid="levels-toggle"]').click();
await page.locator('[data-testid="level-add"]').click();
await page.waitForTimeout(200);
console.log('9 level    ', await page.locator('[data-testid="level-readout"]').textContent(), 'active', (await store()).activeLevelId);
await page.locator('[data-testid="room-draw-toggle"]').click();
await page.locator('[data-testid="room-draw-hud"]').waitFor({ state: 'attached' });
for (const [x, y] of [[0, 0], [3, 0], [3, 3], [0, 3]]) { const p = await w2s(x, y); await page.mouse.click(p.x, p.y); await page.waitForTimeout(80); }
{ const p = await w2s(0, 0); await page.mouse.click(p.x, p.y); }
await page.waitForTimeout(250);
console.log('9b rooms   ', JSON.stringify((await store()).rooms.map((r) => ({ n: r.name, lvl: r.levelId ?? 'ground', v: r.polygon.length, kind: r.kind }))));
await page.keyboard.press('PageDown');
await page.waitForTimeout(200);
console.log('9c pagedown', (await store()).activeLevelId, 'rendered rooms', await page.evaluate(() => window.__ppwGeom.renderedRoomCount()));

// 10. Land: lock 8x6, then an off-plot drop is refused.
await page.locator('[data-testid="land-toggle"]').click();
await page.fill('[data-testid="land-width"]', '8');
await page.fill('[data-testid="land-depth"]', '6');
await page.locator('[data-testid="land-apply"]').click();
await page.waitForTimeout(300);
const before = (await items()).length;
await arm('demo-garden-tree');
await dropAt(12, 2);
console.log('10 land    ', JSON.stringify((await store()).site), 'items before/after off-plot drop', before, (await items()).length, '→ expect unchanged');

console.log('\nconsole errors:', errors.length, errors.slice(0, 5));
console.log('breadcrumbs:', toasts.slice(-8).join('\n  '));
await page.screenshot({ path: 'docs/sims-world-2026-08-29/after/probe-end.png' });
await browser.close();
