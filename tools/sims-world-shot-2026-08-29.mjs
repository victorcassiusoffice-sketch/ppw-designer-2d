/**
 * Sims-world capture harness (2026-08-29).
 *
 * Seeds a plan that exercises every new surface — two attached rooms, an
 * open free-wall run, a locked plot, a floor lamp (lit), a pendant, a
 * console table flush to a wall, a treadmill in a corner, a garden tree and
 * bench OUTDOORS, a first floor with one room — and shoots it at three
 * viewports in three states (plan · wall pen · first floor). Prints console
 * errors and a few measured facts so the capture doubles as a smoke test.
 *
 *   node tools/sims-world-shot-2026-08-29.mjs <outDir> [baseUrl]
 */
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const OUT = resolve(process.cwd(), process.argv[2] ?? 'docs/sims-world-2026-08-29/after');
const BASE = process.argv[3] ?? process.env.PPW_E2E_BASE_URL ?? 'http://127.0.0.1:5188';
mkdirSync(OUT, { recursive: true });

const VIEWPORTS = [
  { name: 'desktop-1920', width: 1920, height: 1080 },
  { name: 'desktop-1366', width: 1366, height: 768 },
  { name: 'mobile-390', width: 390, height: 844 },
];

/** World metres. Plot 16 x 12; building 9 x 4 at (2,2); garden around it. */
const PROPERTY = {
  id: 'prop-sims',
  name: 'Sims World Demo',
  activeRoomId: 'r1',
  levels: [
    { id: 'ground', name: 'Ground floor', index: 0 },
    { id: 'lvl1', name: 'First floor', index: 1 },
  ],
  activeLevelId: 'ground',
  site: { widthM: 16, depthM: 12, originM: { x: 0, y: 0 } },
  walls: [
    // An open L-shaped run in the garden (a low garden wall), ground level.
    { id: 'fw1', a: { x: 12.5, y: 2 }, b: { x: 15, y: 2 }, thicknessM: 0.1, levelId: 'ground' },
    { id: 'fw2', a: { x: 15, y: 2 }, b: { x: 15, y: 6 }, thicknessM: 0.1, levelId: 'ground' },
  ],
  rooms: [
    {
      id: 'r1',
      name: 'Treatment Room',
      polygon: [{ x: 2, y: 2 }, { x: 7, y: 2 }, { x: 7, y: 6 }, { x: 2, y: 6 }],
      placedItems: [
        // Treadmill tucked into the top-left corner: 2.05 x 0.95 at rotation 0
        // → x = 2.05 (inner face), y = 2.05 (inner face).
        { instanceId: 'tm', productId: 'k1-nordictrack-2450', x: 2.05, y: 2.05, rotation: 0 },
        // Console table flush to the bottom wall, facing in (rotation 180).
        { instanceId: 'ct', productId: 'demo-console-table', x: 4.2, y: 5.55, rotation: 180 },
        // Floor lamp, lit, mid-room right.
        { instanceId: 'lamp', productId: 'demo-floor-lamp', x: 6.3, y: 4.8, rotation: 0 },
        // Pendant over the middle.
        { instanceId: 'pend', productId: 'demo-pendant-light', x: 4.3, y: 3.8, rotation: 0 },
      ],
      floorFinish: null,
    },
    {
      id: 'r2',
      name: 'Sauna',
      polygon: [{ x: 7, y: 2 }, { x: 11, y: 2 }, { x: 11, y: 6 }, { x: 7, y: 6 }],
      placedItems: [
        { instanceId: 'bike', productId: 'k1-schwinn-700ic', x: 9.4, y: 2.05, rotation: 0 },
        { instanceId: 'sc', productId: 'demo-wall-sconce', x: 10.83, y: 3.5, rotation: 90 },
      ],
      openings: [
        { id: 'd1', edgeIndex: 3, offsetM: 2, widthM: 0.838, kind: 'door', flipFacing: false, flipHand: false },
      ],
    },
    {
      id: 'out-g',
      name: 'Outdoors',
      kind: 'outdoor',
      polygon: [],
      placedItems: [
        { instanceId: 'tree1', productId: 'demo-garden-tree', x: 1.5, y: 8, rotation: 0 },
        { instanceId: 'tree2', productId: 'demo-garden-tree', x: 12.2, y: 7.6, rotation: 0 },
        { instanceId: 'hedge', productId: 'demo-hedge', x: 4.5, y: 9.2, rotation: 0 },
        { instanceId: 'bench', productId: 'demo-outdoor-bench', x: 8, y: 8.2, rotation: 0 },
        // Bench flush to the OUTSIDE face of the building's bottom wall.
        { instanceId: 'bench2', productId: 'demo-outdoor-bench', x: 3, y: 6.05, rotation: 0 },
      ],
    },
    {
      id: 'r-up',
      name: 'Studio',
      levelId: 'lvl1',
      polygon: [{ x: 2, y: 2 }, { x: 7, y: 2 }, { x: 7, y: 6 }, { x: 2, y: 6 }],
      placedItems: [{ instanceId: 'mat', productId: 'k1-floor-eva-combat', x: 2.5, y: 2.5, rotation: 0 }],
    },
  ],
};

async function newPage(browser, vp, property) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  await ctx.addInitScript((p) => {
    localStorage.clear();
    localStorage.setItem('ppw_designer_coach_v1', '1');
    localStorage.setItem(
      'ppw_property_v2',
      JSON.stringify({ state: { property: p, showGrid: true, pxPerMetre: 100 }, version: 2 }),
    );
  }, property);
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  page.__errors = errors;
  return page;
}

async function facts(page) {
  return page.evaluate(() => {
    const raw = localStorage.getItem('ppw_property_v2');
    const p = raw ? JSON.parse(raw).state.property : null;
    const stage = document.querySelector('.konvajs-content canvas');
    return {
      rooms: p ? p.rooms.length : -1,
      walls: p ? (p.walls ?? []).length : -1,
      levels: p ? (p.levels ?? []).length : -1,
      activeLevel: p ? p.activeLevelId : null,
      stage: stage ? { w: Math.round(stage.getBoundingClientRect().width), h: Math.round(stage.getBoundingClientRect().height) } : null,
      items: document.querySelector('[data-testid="items-placed"]')?.textContent ?? null,
      capacity: document.querySelector('[data-testid="plot-capacity"]')?.textContent ?? null,
      levelReadout: document.querySelector('[data-testid="level-readout"]')?.textContent ?? null,
    };
  });
}

const browser = await chromium.launch();
try {
  for (const vp of VIEWPORTS) {
    // 1. Plan view (ground).
    let page = await newPage(browser, vp, PROPERTY);
    await page.goto(`${BASE}/designer`);
    await page.waitForSelector('[data-testid="items-placed"]', { timeout: 20_000 });
    await page.waitForTimeout(900);
    await page.screenshot({ path: resolve(OUT, `plan-${vp.name}.png`) });
    console.log(vp.name, 'plan', JSON.stringify(await facts(page)), 'errors:', page.__errors.length);
    if (page.__errors.length) console.log('  ', page.__errors.slice(0, 5));

    // 2. Wall pen with three points dropped (open run) and the unit stepped.
    const toggle = vp.width >= 768 ? '[data-testid="wall-tool-toggle"]' : null;
    if (toggle) {
      await page.locator(toggle).click();
      await page.locator('[data-testid="room-draw-hud"]').waitFor({ state: 'attached' });
      await page.keyboard.press('+');
      const stage = page.locator('.konva-stage').first();
      const box = await stage.boundingBox();
      await page.mouse.click(box.x + box.width * 0.78, box.y + box.height * 0.62);
      await page.mouse.click(box.x + box.width * 0.86, box.y + box.height * 0.62);
      await page.mouse.move(box.x + box.width * 0.86, box.y + box.height * 0.74, { steps: 6 });
      await page.waitForTimeout(300);
      await page.screenshot({ path: resolve(OUT, `wall-pen-${vp.name}.png`) });
      const unit = await page.locator('[data-testid="snap-unit-current"]').first().textContent();
      console.log(vp.name, 'wall-pen unit after + =', unit, 'errors:', page.__errors.length);
      await page.keyboard.press('Escape');
    }
    await page.context().close();

    // 3. First floor.
    const upstairs = { ...PROPERTY, activeLevelId: 'lvl1', activeRoomId: 'r-up' };
    page = await newPage(browser, vp, upstairs);
    await page.goto(`${BASE}/designer`);
    await page.waitForSelector('[data-testid="items-placed"]', { timeout: 20_000 });
    await page.waitForTimeout(700);
    await page.screenshot({ path: resolve(OUT, `first-floor-${vp.name}.png`) });
    console.log(vp.name, 'first-floor', JSON.stringify(await facts(page)), 'errors:', page.__errors.length);
    if (page.__errors.length) console.log('  ', page.__errors.slice(0, 5));
    await page.context().close();
  }
} finally {
  await browser.close();
}
