/**
 * Eco / solar captures (2026-09-04) — roof level, panels on the slab, the
 * energy chip + panel, the Eco tab, the phone sheet's Energy section.
 *
 * Drives the feature end to end against a DEV server and shoots the
 * evidence; prints console errors + measured facts so the capture doubles as
 * a smoke:
 *   1. Eco tab open on the dock (desktop 1366)
 *   2. arm a panel → the roof pops (level readout "Roof", slab with area label)
 *   3. four panels laid edge to edge on the slab + the energy chip
 *   4. Energy panel open (docked), consumers listed with switches
 *   5. ground floor with a treadmill + lamp: chip reads short → add panels → covered
 *   6. phone: Eco tab tiles, Energy section of the sheet (mobile 390)
 *
 *   node tools/eco-solar-shot-2026-09-04.mjs <outDir> [baseUrl]
 */
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const OUT = resolve(process.cwd(), process.argv[2] ?? 'docs/sims-world-2026-08-29/eco-solar-2026-09-04');
const BASE = process.argv[3] ?? process.env.PPW_E2E_BASE_URL ?? 'http://127.0.0.1:5188';
mkdirSync(OUT, { recursive: true });

const PANEL = 'emcar-jinko-475';

function fixture(items = []) {
  return {
    id: 'prop-eco',
    name: 'Eco Demo',
    activeRoomId: 'r1',
    rooms: [
      {
        id: 'r1',
        name: 'Gym',
        polygon: [{ x: 0, y: 0 }, { x: 6, y: 0 }, { x: 6, y: 4 }, { x: 0, y: 4 }],
        placedItems: items,
      },
    ],
  };
}

async function newPage(browser, vp, prop) {
  const ctx = await browser.newContext({ viewport: vp, hasTouch: vp.width < 600, isMobile: vp.width < 600 });
  await ctx.addInitScript((p) => {
    localStorage.clear();
    localStorage.setItem('ppw_designer_coach_v1', '1');
    localStorage.setItem(
      'ppw_property_v2',
      JSON.stringify({ state: { property: p, showGrid: true, pxPerMetre: 100 }, version: 2 }),
    );
  }, prop);
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

async function stored(page) {
  return page.evaluate(() => {
    const raw = localStorage.getItem('ppw_property_v2');
    return raw ? JSON.parse(raw).state.property : null;
  });
}

async function text(page, testid) {
  const el = page.locator(`[data-testid="${testid}"]`);
  return (await el.count()) ? (await el.first().textContent())?.trim() : null;
}

/** Deselect (Esc + a click on empty canvas) so the Details panel does not sit over the readout row. */
async function deselect(page) {
  await page.keyboard.press('Escape');
  await page.waitForTimeout(120);
  const sel = page.locator('[data-testid="details-overlay"]');
  if (await sel.count()) {
    const close = sel.locator('button[aria-label="Deselect"], button:has-text("Close"), button[title*="eselect"]').first();
    if (await close.count()) await close.click().catch(() => {});
  }
  await page.waitForTimeout(150);
}

async function armAndDrop(page, productId, x, y) {
  const card = page.locator(`[data-product-id="${productId}"]`).first();
  await card.scrollIntoViewIfNeeded();
  await card.click();
  await page.waitForTimeout(150);
  await clickWorld(page, x, y);
  await page.waitForTimeout(150);
}

const facts = {};
const browser = await chromium.launch();
try {
  // ---- desktop 1366 ---------------------------------------------------------
  let page = await newPage(browser, { width: 1366, height: 800 }, fixture());
  await page.locator('[data-testid="dock-cat-eco"]').click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: resolve(OUT, 'eco-tab-desktop-1366.png') });
  facts.ecoTiles = await page.locator('[data-testid="dock-strip"] [data-product-id]').count();

  // Arm a panel → roof pops.
  const card = page.locator(`[data-product-id="${PANEL}"]`).first();
  await card.click();
  await page.waitForTimeout(500);
  facts.levelAfterArm = await text(page, 'level-readout');
  await page.screenshot({ path: resolve(OUT, 'roof-pops-on-arm-desktop-1366.png') });

  // Lay four panels edge to edge (the ghost is armed; each drop re-arms).
  await clickWorld(page, 1.0, 0.7);
  await page.waitForTimeout(200);
  await armAndDrop(page, PANEL, 3.0, 0.7);
  await armAndDrop(page, PANEL, 1.0, 1.9);
  await armAndDrop(page, PANEL, 3.0, 1.9);
  const p1 = await stored(page);
  const slab = p1.rooms.find((r) => r.kind === 'roof');
  facts.panelsOnSlab = slab ? slab.placedItems.length : 0;
  facts.panelPositions = slab ? slab.placedItems.map((i) => [i.x, i.y, i.rotation]) : [];
  facts.chip = await text(page, 'energy-readout');
  await page.waitForTimeout(300);
  await page.screenshot({ path: resolve(OUT, 'panels-on-roof-desktop-1366.png') });

  // Energy panel open.
  await deselect(page);
  await page.locator('[data-testid="energy-readout"]').click();
  await page.waitForTimeout(400);
  facts.panelGeneration = await text(page, 'energy-generation');
  facts.panelStatus = await text(page, 'energy-status');
  await page.screenshot({ path: resolve(OUT, 'energy-panel-desktop-1366.png') });
  await page.locator('[data-testid="energy-done"]').click();
  facts.desktopErrors = page.__errors.slice();
  await page.context().close();

  // ---- desktop: consumers first, then panels --------------------------------
  page = await newPage(browser, { width: 1366, height: 800 }, fixture([
    { instanceId: 'tm1', productId: 'k1-nordictrack-2450', x: 0.05, y: 0.05, rotation: 0 },
    { instanceId: 'lamp1', productId: 'demo-floor-lamp', x: 4.5, y: 3.0, rotation: 0 },
    { instanceId: 'bike1', productId: 'k1-nordictrack-tour-de-france', x: 3.0, y: 0.05, rotation: 0 },
  ]));
  await page.waitForTimeout(400);
  facts.chipConsumersOnly = await text(page, 'energy-readout');
  facts.chipStatusConsumersOnly = await page.locator('[data-testid="energy-readout"]').getAttribute('data-status').catch(() => null);
  await page.screenshot({ path: resolve(OUT, 'consumers-short-desktop-1366.png') });
  await deselect(page);
  await page.locator('[data-testid="energy-readout"]').click().catch(() => {});
  await page.waitForTimeout(400);
  facts.hint = await text(page, 'energy-hint');
  facts.items = await page.locator('[data-testid="energy-items"] li').count().catch(() => 0);
  await page.screenshot({ path: resolve(OUT, 'energy-panel-short-desktop-1366.png') });
  await page.locator('[data-testid="energy-done"]').click().catch(() => {});
  // Go to the roof and add panels until covered.
  await page.locator('[data-testid="dock-cat-eco"]').click();
  await page.waitForTimeout(300);
  for (const [x, y] of [[1.0, 0.7], [3.0, 0.7], [5.0, 0.7], [1.0, 1.9], [3.0, 1.9], [5.0, 1.9]]) {
    await armAndDrop(page, PANEL, x, y);
  }
  facts.chipAfterPanels = await text(page, 'energy-readout');
  facts.chipStatusAfterPanels = await page.locator('[data-testid="energy-readout"]').getAttribute('data-status').catch(() => null);
  await page.screenshot({ path: resolve(OUT, 'consumers-covered-desktop-1366.png') });
  await deselect(page);
  await page.locator('[data-testid="energy-readout"]').click().catch(() => {});
  await page.waitForTimeout(400);
  await page.screenshot({ path: resolve(OUT, 'energy-panel-covered-desktop-1366.png') });
  facts.desktop2Errors = page.__errors.slice();
  await page.context().close();

  // ---- mobile 390 -------------------------------------------------------------
  page = await newPage(browser, { width: 390, height: 844 }, fixture([
    { instanceId: 'tm1', productId: 'k1-nordictrack-2450', x: 0.05, y: 0.05, rotation: 0 },
  ]));
  const ecoTab = page.locator('[data-testid="sims-cat-eco"]');
  await ecoTab.scrollIntoViewIfNeeded();
  await ecoTab.click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: resolve(OUT, 'eco-tab-mobile-390.png') });
  facts.mobileChip = await text(page, 'energy-readout');
  await deselect(page);
  await page.locator('[data-testid="energy-readout"]').click().catch(() => {});
  await page.waitForTimeout(600);
  facts.mobileSheetEnergy = await page.locator('[data-testid="energy-mobile"]').count();
  await page.screenshot({ path: resolve(OUT, 'energy-sheet-mobile-390.png') });
  facts.mobileErrors = page.__errors.slice();
  await page.context().close();
} finally {
  await browser.close();
}
console.log(JSON.stringify(facts, null, 1));
