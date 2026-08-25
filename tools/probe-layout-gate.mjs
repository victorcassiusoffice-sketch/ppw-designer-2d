/**
 * P2 exit gate — canvas dominance + no-regression probe (2026-08-25).
 *
 *   node tools/probe-layout-gate.mjs [baseUrl]
 *
 * Asserts, at 1920 x 1080:
 *   1. stage.width  / 1920 >= 0.80
 *   2. stage.height / 1080 >= 0.85
 *   3. `items-placed`, `share-render` and `start-quick-rectangle` are all
 *      still VISIBLE (the layout rebuild moved chrome; it must not have
 *      dropped any e2e hook)
 *   4. the place-an-item flow still works end to end: click a dock card ->
 *      click the floor -> `items-placed` reads 1
 *
 * Exits non-zero on any failure so the gate cannot be "passed" by reading
 * past a red line.
 */
import { chromium } from '@playwright/test';

const BASE = process.argv[2] ?? process.env.PPW_E2E_BASE_URL ?? 'http://localhost:5187';
const VW = 1920;
const VH = 1080;
const PRODUCT_ID = 'k1-nordictrack-2450';

const failures = [];
const lines = [];
function check(label, ok, detail) {
  lines.push(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  ${detail}` : ''}`);
  if (!ok) failures.push(label);
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: VW, height: VH } });
await ctx.addInitScript(() => {
  localStorage.clear();
  localStorage.setItem('ppw_designer_coach_v1', '1');
});
const page = await ctx.newPage();
const consoleErrors = [];
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', (e) => consoleErrors.push(String(e)));

await page.goto(`${BASE}/designer`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('[data-testid="start-quick-rectangle"]', { timeout: 20000 });
await page.waitForTimeout(1200);

// --- 3: the hooks the rest of the suite depends on are still on screen ---
for (const id of ['share-render', 'start-quick-rectangle']) {
  const vis = await page.locator(`[data-testid="${id}"]`).first().isVisible().catch(() => false);
  check(`testid visible (blank state): ${id}`, vis);
}

// --- 1 + 2: canvas dominance, measured on the real Konva stage ---
await page.locator('[data-testid="start-quick-rectangle"]').click();
await page.waitForTimeout(800);

const m = await page.evaluate(() => {
  const c = document.querySelector('.konvajs-content canvas');
  const b = c.getBoundingClientRect();
  const el = (sel) => document.querySelector(sel)?.getBoundingClientRect() ?? null;
  return {
    stage: { width: Math.round(b.width), height: Math.round(b.height) },
    topbar: el('header') ? Math.round(el('header').height) : null,
    dock: el('[data-testid="sims-dock"]') ? Math.round(el('[data-testid="sims-dock"]').height) : null,
  };
});
const widthRatio = +(m.stage.width / VW).toFixed(4);
const heightRatio = +(m.stage.height / VH).toFixed(4);

lines.push(`stage ${m.stage.width} x ${m.stage.height}   topbar ${m.topbar}px   dock ${m.dock}px`);
check('stageBox.width / 1920 >= 0.8', widthRatio >= 0.8, `= ${widthRatio}`);
check('stageBox.height / 1080 >= 0.85', heightRatio >= 0.85, `= ${heightRatio}`);

const itemsVisible = await page.locator('[data-testid="items-placed"]').first().isVisible();
check('testid visible (room state): items-placed', itemsVisible);
check('items-placed starts at 0', (await page.locator('[data-testid="items-placed"]').innerText()) === '0');

// --- 4: place-an-item still works through the new dock ---
const card = page.locator(`[data-product-id="${PRODUCT_ID}"]:visible`).first();
const cardVisible = await card.count().then((n) => n > 0);
check('dock exposes the product card', cardVisible);

if (cardVisible) {
  await card.click();
  const armedCount = await page.locator('[data-armed="true"]').count();
  check('arming sets data-armed on canvas + card', armedCount === 2, `count = ${armedCount}`);

  const origin = await page.evaluate(() => {
    const c = document.querySelector('.konvajs-content canvas');
    const ctx2 = c.getContext('2d');
    const img = ctx2.getImageData(0, 0, c.width, c.height).data;
    let minX = Infinity, minY = Infinity;
    // Accepts BOTH borders so the same harness can shoot before/ (dark
    // stroke on cream) and after/ (blueprint gold on dark). Kept in sync
    // with blueprintTheme.ROOM_BORDER_SCAN.
    const isBorder = (r, g, b) =>
      (r < 40 && g < 50 && b < 50) || (r > 200 && g >= 120 && g <= 190 && b < 90);
    for (let y = 0; y < c.height; y += 2) {
      for (let x = 0; x < c.width; x += 2) {
        const i = (y * c.width + x) * 4;
        if (img[i + 3] > 200 && isBorder(img[i], img[i + 1], img[i + 2])) {
          if (x < minX) minX = x;
          if (y < minY) minY = y;
        }
      }
    }
    if (!Number.isFinite(minX)) return null;
    const rect = c.getBoundingClientRect();
    const sc = c.width / rect.width;
    return { x: rect.x + minX / sc + 3, y: rect.y + minY / sc + 3 };
  });
  check('room origin found by canvas pixel-scan', !!origin);

  if (origin) {
    const sx = origin.x + 2.0 * 100;
    const sy = origin.y + 2.0 * 100;
    await page.mouse.move(sx, sy, { steps: 8 });
    await page.mouse.click(sx, sy);
    await page.waitForTimeout(400);
    const placed = await page.locator('[data-testid="items-placed"]').innerText();
    check('click card -> click floor -> items-placed = 1', placed === '1', `got "${placed}"`);
  }
}

check('zero console errors', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '));

await browser.close();

console.log(lines.join('\n'));
console.log(
  `\nGATE: stageBox.width/1920 >= 0.8 && stageBox.height/1080 >= 0.85  ->  ${
    widthRatio >= 0.8 && heightRatio >= 0.85
  }`,
);
console.log(failures.length ? `\n${failures.length} FAILURE(S)` : '\nALL CHECKS PASSED');
process.exit(failures.length ? 1 : 0);
