/**
 * Sims flooring + wall-pen follow-up captures (2026-08-29).
 *
 * Drives the three follow-ups end to end against a DEV server and shoots
 * the evidence:
 *   1. wall pen: two points + Esc → the wall is KEPT (desktop 1366)
 *   2. tiles: drop → D → drop → Fill floor → 12 tiles edge to edge, cart
 *      sheet open with the 12 priced tiles (desktop 1366)
 *   3. painted whole room → cart pill + floor line (desktop 1366)
 *   4. the phone menu with the new Paint floor row (mobile 390)
 * Prints console errors + measured facts so the capture doubles as a smoke.
 *
 *   node tools/sims-flooring-shot-2026-08-29.mjs <outDir> [baseUrl]
 */
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const OUT = resolve(process.cwd(), process.argv[2] ?? 'docs/sims-world-2026-08-29/after-followups');
const BASE = process.argv[3] ?? process.env.PPW_E2E_BASE_URL ?? 'http://127.0.0.1:5188';
mkdirSync(OUT, { recursive: true });

const ONE_ROOM = {
  id: 'prop-flooring',
  name: 'Flooring Demo',
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

async function newPage(browser, vp) {
  const ctx = await browser.newContext({ viewport: vp, hasTouch: vp.width < 600, isMobile: vp.width < 600 });
  await ctx.addInitScript((p) => {
    localStorage.clear();
    localStorage.setItem('ppw_designer_coach_v1', '1');
    localStorage.setItem(
      'ppw_property_v2',
      JSON.stringify({ state: { property: p, showGrid: true, pxPerMetre: 100 }, version: 2 }),
    );
  }, ONE_ROOM);
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  page.__errors = errors;
  await page.goto(`${BASE}/designer`);
  await page.waitForSelector('.konvajs-content canvas', { state: 'attached' });
  await page.waitForFunction(() => {
    const g = window.__ppwGeom;
    return !!g && g.ready();
  }, undefined, { timeout: 20_000 });
  await page.waitForTimeout(400);
  return page;
}

async function world(page, x, y) {
  const pt = await page.evaluate(([xx, yy]) => window.__ppwGeom.worldToScreen(xx, yy), [x, y]);
  if (!pt) throw new Error('geom bridge unavailable');
  return pt;
}

async function clickWorld(page, x, y) {
  const p = await world(page, x, y);
  await page.mouse.move(p.x, p.y, { steps: 4 });
  await page.mouse.click(p.x, p.y);
}

async function items(page) {
  return page.evaluate(() => {
    const raw = localStorage.getItem('ppw_property_v2');
    const p = raw ? JSON.parse(raw).state.property : null;
    return p ? p.rooms.flatMap((r) => r.placedItems ?? []) : [];
  });
}

async function walls(page) {
  return page.evaluate(() => {
    const raw = localStorage.getItem('ppw_property_v2');
    const p = raw ? JSON.parse(raw).state.property : null;
    return p ? p.walls ?? [] : [];
  });
}

async function text(page, testid) {
  return page.evaluate((t) => document.querySelector(`[data-testid="${t}"]`)?.textContent ?? null, testid);
}

const browser = await chromium.launch();
const report = {};

// 1. Wall pen: two points + Esc keeps the wall.
{
  const page = await newPage(browser, { width: 1366, height: 768 });
  await page.locator('[data-testid="wall-tool-toggle"]').click();
  await page.waitForSelector('[data-testid="room-draw-hud"]');
  await clickWorld(page, 6, 1);
  await clickWorld(page, 8, 1);
  await page.screenshot({ path: resolve(OUT, 'wallpen-two-points-desktop-1366.png') });
  await page.keyboard.press('Escape');
  await page.waitForSelector('[data-testid="room-draw-hud"]', { state: 'detached' });
  await page.waitForTimeout(300);
  await page.screenshot({ path: resolve(OUT, 'wallpen-esc-keeps-wall-desktop-1366.png') });
  report.wallPen = { wallsAfterEsc: (await walls(page)).map((w) => [w.a.x, w.a.y, w.b.x, w.b.y]), errors: page.__errors };
  await page.context().close();
}

// 2. Tiles: drop, D, drop, Fill floor; cart open.
{
  const page = await newPage(browser, { width: 1366, height: 768 });
  await page.locator('[data-testid="dock-cat-flooring"]').click();
  const arm = async (x, y) => {
    await page.locator('[data-product-id="k1-floor-eva-combat"]').first().click();
    await page.waitForSelector('[data-armed="true"]');
    const p = await world(page, x, y);
    await page.mouse.move(p.x, p.y, { steps: 6 });
    await page.mouse.click(p.x, p.y);
    await page.waitForFunction(() => document.querySelectorAll('[data-armed="true"]').length === 0);
  };
  await arm(1.6, 1.6);
  await clickWorld(page, 1.55, 1.55);
  await page.keyboard.press('d');
  await page.keyboard.press('Escape');
  await arm(3.4, 1.7);
  await page.waitForTimeout(200);
  await page.screenshot({ path: resolve(OUT, 'tiles-three-in-a-row-desktop-1366.png') });
  await clickWorld(page, 1.55, 1.55);
  await page.locator('[data-testid="details-fill-floor"]').click();
  await page.waitForTimeout(300);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  await page.screenshot({ path: resolve(OUT, 'tiles-fill-floor-desktop-1366.png') });
  await page.locator('[data-testid="cart-pill"]').click();
  await page.waitForSelector('[data-testid="cart-sheet"]');
  await page.waitForTimeout(200);
  await page.screenshot({ path: resolve(OUT, 'tiles-cart-desktop-1366.png') });
  const its = await items(page);
  report.tiles = {
    count: its.length,
    xs: [...new Set(its.map((i) => i.x))].sort((a, b) => a - b),
    ys: [...new Set(its.map((i) => i.y))].sort((a, b) => a - b),
    costReadout: await text(page, 'cost-readout'),
    cartPill: await text(page, 'cart-pill'),
    errors: page.__errors,
  };
  await page.context().close();
}

// 3. Painted whole room → priced cart.
{
  const page = await newPage(browser, { width: 1366, height: 768 });
  await page.locator('[data-testid="floor-paint-toggle"]').click();
  await page.waitForSelector('[data-testid="floor-paint-palette"]');
  await page.locator('[data-testid="floor-paint-outdoor-1m"]').click();
  await page.waitForTimeout(200);
  const a = await world(page, 1.5, 1.5);
  await page.keyboard.down('Shift');
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(a.x + 2, a.y + 2);
  await page.mouse.up();
  await page.keyboard.up('Shift');
  await page.waitForSelector('[data-testid="cart-pill"]');
  await page.locator('[data-testid="cart-pill"]').click();
  await page.waitForSelector('[data-testid="cart-sheet"]');
  await page.waitForTimeout(200);
  await page.screenshot({ path: resolve(OUT, 'painted-floor-cart-desktop-1366.png') });
  report.painted = {
    costReadout: await text(page, 'cost-readout'),
    floorLine: await text(page, 'cart-floor-line'),
    floorUnits: await text(page, 'cart-floor-units'),
    errors: page.__errors,
  };
  await page.context().close();
}

// 4. Mobile menu with Paint floor.
{
  const page = await newPage(browser, { width: 390, height: 844 });
  await page.locator('button[aria-label="Open menu"]').click();
  await page.waitForSelector('[data-testid="floor-paint-mobile"]');
  await page.locator('[data-testid="floor-paint-mobile"]').scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  await page.screenshot({ path: resolve(OUT, 'menu-paint-floor-mobile-390.png') });
  await page.locator('[data-testid="floor-paint-mobile-outdoor-1m"]').click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: resolve(OUT, 'paint-floor-armed-mobile-390.png') });
  // Re-open the menu: the toggle's aria-pressed is the ground truth that
  // picking a material armed the brush (the tool is not persisted).
  await page.locator('button[aria-label="Open menu"]').click();
  await page.waitForSelector('[data-testid="floor-paint-toggle-mobile"]');
  report.mobile = {
    paintPressedAfterPick: await page.getAttribute('[data-testid="floor-paint-toggle-mobile"]', 'aria-pressed'),
    paintHud: await text(page, 'floor-paint-hud'),
    errors: page.__errors,
  };
  await page.screenshot({ path: resolve(OUT, 'menu-paint-floor-on-mobile-390.png') });
  await page.context().close();
}

await browser.close();
console.log(JSON.stringify(report, null, 2));
