/**
 * UI-modernize capture harness (2026-08-25).
 *
 * Shoots the 3 designer states × 2 viewports into a target folder and
 * prints the measured stage box so the P2 layout gate is verifiable.
 *
 *   node tools/shoot-ui-modernize.mjs <before|after> [baseUrl]
 */
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const phase = process.argv[2] ?? 'before';
const BASE = process.argv[3] ?? process.env.PPW_E2E_BASE_URL ?? 'http://localhost:5187';
const OUT = resolve(process.cwd(), 'docs/ui-modernize-2026-08-25', phase);
mkdirSync(OUT, { recursive: true });

const VIEWPORTS = [
  { name: 'desktop-1920', width: 1920, height: 1080 },
  { name: 'mobile-390', width: 390, height: 844 },
];

const PRODUCT_ID = 'k1-nordictrack-2450';

async function newPage(browser, vp) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  await ctx.addInitScript(() => {
    localStorage.clear();
    // First-visit coach dialog swallows canvas clicks — mark it seen.
    localStorage.setItem('ppw_designer_coach_v1', '1');
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  page.__errors = errors;
  return page;
}

/** Measured layout numbers used by the P2 exit gate. */
async function measure(page, vp) {
  return page.evaluate(({ w, h }) => {
    const c = document.querySelector('.konvajs-content canvas');
    const box = c ? c.getBoundingClientRect() : null;
    const topbar = document.querySelector('header')?.getBoundingClientRect() ?? null;
    return {
      stage: box ? { width: Math.round(box.width), height: Math.round(box.height) } : null,
      widthRatio: box ? +(box.width / w).toFixed(4) : null,
      heightRatio: box ? +(box.height / h).toFixed(4) : null,
      topbarH: topbar ? Math.round(topbar.height) : null,
      // Visible-control density probe (ref-difference method).
      visibleControls: Array.from(
        document.querySelectorAll('button, a[href], input, select, [role="button"], [role="tab"]'),
      ).filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < h && r.right > 0 && r.left < w;
      }).length,
    };
  }, { w: vp.width, h: vp.height });
}


/**
 * Resilient screenshot. Playwright blocks on `document.fonts.ready`; the
 * designer keeps a webfont request in flight after interaction, which can
 * hang that wait. Nudge fonts.ready ourselves, then retry once longer.
 */
async function shoot(page, path) {
  await page.evaluate(() => document.fonts?.ready).catch(() => {});
  try {
    await page.screenshot({ path, timeout: 20000, animations: 'disabled' });
  } catch {
    await page.screenshot({ path, timeout: 60000, animations: 'disabled', caret: 'initial' });
  }
}

const results = [];

const browser = await chromium.launch();
for (const vp of VIEWPORTS) {
  // ---- state 1: fresh / blank ----
  let page = await newPage(browser, vp);
  await page.goto(`${BASE}/designer`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.konvajs-content canvas', { timeout: 20000 });
  await page.waitForTimeout(2500); // product art hydrates async
  await shoot(page, `${OUT}/fresh-${vp.name}.png`);
  results.push({ state: 'fresh', vp: vp.name, ...(await measure(page, vp)), consoleErrors: page.__errors.slice() });

  // ---- state 2: draw mode with 2 vertices ----
  const canvas = page.locator('.konvajs-content canvas').first();
  const cb = await canvas.boundingBox();
  const drawBtn = page.locator('button', { hasText: /^Custom shape$/ }).first();
  if (await drawBtn.count()) {
    await drawBtn.click();
    await page.waitForTimeout(300);
    await page.mouse.click(cb.x + cb.width * 0.32, cb.y + cb.height * 0.34);
    await page.mouse.click(cb.x + cb.width * 0.62, cb.y + cb.height * 0.34);
    await page.mouse.move(cb.x + cb.width * 0.62, cb.y + cb.height * 0.62, { steps: 6 });
    await page.waitForTimeout(400);
  }
  await shoot(page, `${OUT}/draw-measure-${vp.name}.png`);
  results.push({ state: 'draw', vp: vp.name, ...(await measure(page, vp)), consoleErrors: page.__errors.slice() });
  await page.context().close();

  // ---- state 3: 3 items placed in a quick 5×4 room ----
  page = await newPage(browser, vp);
  await page.goto(`${BASE}/designer`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid="start-quick-rectangle"]', { timeout: 20000 });
  await page.locator('[data-testid="start-quick-rectangle"]').click();
  await page.waitForTimeout(600);
  const wide = vp.width >= 1024;
  const spots = [[1.2, 1.0], [3.6, 1.0], [1.2, 3.0]];
  for (const [xm, ym] of spots) {
    if (wide) {
      // Desktop: catalog card arms `pendingProductId`; a floor click commits.
      const card = page.locator(`[data-product-id="${PRODUCT_ID}"]:visible`).first();
      if (!(await card.count())) break;
      await card.click();
      await page.waitForTimeout(150);
      const o = await roomOrigin(page);
      if (!o) break;
      await page.mouse.move(o.x + xm * 100, o.y + ym * 100, { steps: 6 });
      await page.mouse.click(o.x + xm * 100, o.y + ym * 100);
    } else {
      // Mobile: sims thumb → popup → "+ Add to room" (places at room centre).
      const thumb = page.locator(`[data-testid="sims-thumb"][data-product-id="${PRODUCT_ID}"]`).first();
      if (!(await thumb.count())) break;
      await thumb.click();
      await page.locator('[data-testid="popup-add-to-room"]').click();
    }
    await page.keyboard.press('Escape');
    await page.waitForTimeout(250);
  }
  await page.waitForTimeout(2000);
  await shoot(page, `${OUT}/placed-${vp.name}.png`);
  const placedCount = await page.locator('[data-testid="items-placed"]').innerText().catch(() => '?');
  results.push({ state: 'placed', vp: vp.name, placedCount, ...(await measure(page, vp)), consoleErrors: page.__errors.slice() });
  await page.context().close();
}
await browser.close();

console.log(JSON.stringify(results, null, 2));

/**
 * Empirical room origin — scans the first Konva canvas for the room
 * border. Matches the e2e helper (gold after the P4 reskin, dark before).
 */
async function roomOrigin(page) {
  return page.evaluate(() => {
    const c = document.querySelector('.konvajs-content canvas');
    if (!c) return null;
    const ctx = c.getContext('2d');
    if (!ctx) return null;
    const img = ctx.getImageData(0, 0, c.width, c.height).data;
    let minX = Infinity, minY = Infinity;
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
    const scale = c.width / rect.width;
    return { x: rect.x + minX / scale + 3, y: rect.y + minY / scale + 3 };
  });
}
