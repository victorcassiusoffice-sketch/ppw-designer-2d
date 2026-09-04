/**
 * Deployed smoke for the eco / solar round (2026-09-04) — runs against the
 * BRANCH PREVIEW, where the DEV geom bridge does not exist, so canvas points
 * are mapped through the live `window.Konva.stages[0]` transform instead
 * (the convention from earlier rounds).
 *
 * Proves on the deployed build: the Eco tab and its eight WebP thumbnails,
 * the Roof button, arming a panel popping the roof with a real slab, a panel
 * landing on the slab, the energy chip + panel numbers, and a consumers-only
 * plan reading short. Prints measured facts + console errors.
 *
 *   node tools/eco-solar-preview-smoke-2026-09-04.mjs [baseUrl]
 */
import { chromium } from '@playwright/test';

const BASE = process.argv[2] ?? 'https://ppw-designer-2d-git-feat-sims-world-2026-08-29-victor-ppw.vercel.app';
const PANEL = 'emcar-jinko-475';

function fixture(items = []) {
  return {
    id: 'prop-eco-smoke',
    name: 'Eco Smoke',
    activeRoomId: 'r1',
    rooms: [{ id: 'r1', name: 'Gym', polygon: [{ x: 0, y: 0 }, { x: 6, y: 0 }, { x: 6, y: 4 }, { x: 0, y: 4 }], placedItems: items }],
  };
}

async function open(browser, vp, prop) {
  const ctx = await browser.newContext({ viewport: vp, hasTouch: vp.width < 600, isMobile: vp.width < 600 });
  await ctx.addInitScript((p) => {
    localStorage.clear();
    localStorage.setItem('ppw_designer_coach_v1', '1');
    localStorage.setItem('ppw_property_v2', JSON.stringify({ state: { property: p, showGrid: true, pxPerMetre: 100 }, version: 2 }));
  }, prop);
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  page.__errors = errors;
  // networkidle never settles on the deployed app (background polling).
  await page.goto(`${BASE}/designer`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.konvajs-content canvas', { state: 'attached', timeout: 45_000 });
  await page.waitForTimeout(2500);
  return page;
}

/** World metres -> page px through the LIVE Konva stage (no dev bridge on the preview). */
async function world(page, xM, yM) {
  const pt = await page.evaluate(([x, y]) => {
    const K = window.Konva;
    if (!K || !K.stages || !K.stages.length) return null;
    const s = K.stages.find((st) => st.container().isConnected);
    if (!s) return null;
    const r = s.container().getBoundingClientRect();
    // pxPerMetre is 100 in the persisted envelope; the stage carries pan+zoom.
    const p = s.getAbsoluteTransform().point({ x: x * 100, y: y * 100 });
    return { x: r.left + p.x, y: r.top + p.y };
  }, [xM, yM]);
  if (!pt) throw new Error('Konva stage not reachable on the deployed build');
  return pt;
}

async function clickWorld(page, x, y) {
  const p = await world(page, x, y);
  await page.mouse.move(p.x, p.y, { steps: 4 });
  await page.mouse.click(p.x, p.y);
  await page.waitForTimeout(250);
}

const stored = (page) => page.evaluate(() => {
  const raw = localStorage.getItem('ppw_property_v2');
  return raw ? JSON.parse(raw).state.property : null;
});

const text = async (page, id) => {
  const el = page.locator(`[data-testid="${id}"]`);
  return (await el.count()) ? (await el.first().textContent())?.trim() : null;
};

const facts = {};
const browser = await chromium.launch();
try {
  // 1. Eco tab + assets served by the CDN.
  const page = await open(browser, { width: 1366, height: 800 }, fixture());
  const types = [];
  page.on('response', (r) => { if (r.url().includes('/products/') && r.url().endsWith('.webp')) types.push(r.headers()['content-type']); });
  await page.locator('[data-testid="dock-cat-eco"]').click();
  await page.waitForTimeout(1200);
  facts.ecoTiles = await page.locator('[data-testid="dock-strip"] [data-product-id]').count();
  facts.ecoThumbsDecoded = await page.evaluate(() =>
    Array.from(document.querySelectorAll('[data-testid="dock-strip"] img')).filter((i) => i.naturalWidth > 0).length);
  facts.webpContentTypes = Array.from(new Set(types));

  // 2. Roof button.
  await page.locator('[data-testid="roof-toggle"]').click();
  await page.waitForTimeout(700);
  facts.levelAfterRoofButton = await text(page, 'level-readout');
  const afterRoof = await stored(page);
  const slab0 = afterRoof.rooms.find((r) => r.kind === 'roof');
  facts.slabPolygon = slab0 ? slab0.polygon : null;
  facts.roofLevel = (afterRoof.levels ?? []).find((l) => l.id === 'roof') ?? null;

  // 3. Arm a panel and drop it on the slab.
  await page.locator(`[data-product-id="${PANEL}"]`).first().click();
  await page.waitForTimeout(400);
  await clickWorld(page, 1.2, 0.8);
  const placed = await stored(page);
  const slab = placed.rooms.find((r) => r.kind === 'roof');
  facts.panelsOnSlab = slab ? slab.placedItems.length : 0;
  facts.panelPosition = slab && slab.placedItems[0] ? [slab.placedItems[0].x, slab.placedItems[0].y] : null;

  // 4. Energy chip + panel.
  facts.chip = await text(page, 'energy-readout');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  await page.locator('[data-testid="energy-readout"]').click();
  await page.waitForTimeout(500);
  facts.generation = await text(page, 'energy-generation');
  facts.assumptions = (await text(page, 'energy-assumptions'))?.slice(0, 90);
  facts.errorsA = page.__errors.slice();
  await page.context().close();

  // 5. Consumers with no panels read short, with the hint.
  const page2 = await open(browser, { width: 1366, height: 800 }, fixture([
    { instanceId: 'tm1', productId: 'k1-nordictrack-2450', x: 0.05, y: 0.05, rotation: 0 },
    { instanceId: 'lamp1', productId: 'demo-floor-lamp', x: 4.5, y: 3, rotation: 0 },
  ]));
  facts.chipConsumers = await text(page2, 'energy-readout');
  facts.chipStatus = await page2.locator('[data-testid="energy-readout"]').getAttribute('data-status').catch(() => null);
  await page2.keyboard.press('Escape');
  await page2.locator('[data-testid="energy-readout"]').click();
  await page2.waitForTimeout(500);
  facts.hint = await text(page2, 'energy-hint');
  facts.itemRows = await page2.locator('[data-testid="energy-items"] li').count();
  facts.errorsB = page2.__errors.slice();
  await page2.context().close();
} finally {
  await browser.close();
}
console.log(JSON.stringify(facts, null, 1));
