import { chromium, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
const base = process.argv[2] ?? 'http://127.0.0.1:5176';
if (!['127.0.0.1', 'localhost', 'onelivebuild.com'].includes(new URL(base).hostname)) throw new Error('Expected approved local or production read-only target');
const out = 'docs/qa-sims-fix-round-2-2026-10-25/catalogue-and-baskets/after';
mkdirSync(out, { recursive: true });
const report = { base, cases: [] };
const browser = await chromium.launch({ headless: true, args: ['--use-angle=d3d11'] });
try {
  for (const [device, viewport] of [['desktop', { width: 1280, height: 800 }], ['phone', { width: 390, height: 844 }]]) {
    const context = await browser.newContext({ viewport, isMobile: device === 'phone', hasTouch: device === 'phone' });
    await context.addInitScript(() => { localStorage.clear(); localStorage.setItem('ppw_designer_coach_v1', '1'); });
    const page = await context.newPage(); page.setDefaultTimeout(20000);
    const errors = [], writes = [], placeholders = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('request', request => { if (/placehold\.co/i.test(request.url())) placeholders.push(request.url()); });
    await page.route('**/api/**', async route => { if (!['GET', 'HEAD', 'OPTIONS'].includes(route.request().method())) { writes.push(route.request().url()); return route.abort(); } await route.continue(); });
    for (const view of ['2d', '3d']) {
      const row = { device, view, errors, writes, placeholders, failures: [] }; report.cases.push(row);
      try {
        await page.goto(`${base}/demo?view=${view}&pitch=1`, { waitUntil: 'domcontentloaded' });
        await page.getByTestId(view === '2d' ? 'plan-drawing-viewport' : 'wallpaint-3d-gl').waitFor();
        if (view === '3d') await page.getByTestId('loading-3d').waitFor({ state: 'hidden', timeout: 90000 });
        if (view === '2d') await page.getByTestId('cart-pill').click();
        else await page.locator('button[aria-label="Products in this design"]:visible').first().click();
        const basket = view === '2d' ? page.getByTestId('cart-sheet') : page.locator('section[aria-label="Products and finishes in your design"]');
        const scroller = view === '2d' ? basket.locator('.scroll-pane') : page.locator('.house-inspector-content');
        const finalPicture = basket.locator('.basket-product-picture').last();
        const item = finalPicture.locator(view === '2d' ? 'xpath=ancestor::tr[1]' : 'xpath=ancestor::li[1]');
        const box = await scroller.boundingBox();
        await page.mouse.move(box.x + box.width / 2, box.y + Math.min(box.height / 2, 80));
        await page.mouse.wheel(0, 15000);
        await page.waitForTimeout(250);
        row.endShot = `${out}/${device}-${view}-basket-end.png`; await page.screenshot({ path: row.endShot });
        // Finish rows follow products. Scroll the last product back into the
        // middle rather than mistaking that ordinary list order for occlusion.
        const current = await item.boundingBox();
        await page.mouse.wheel(0, current.y - (box.y + (box.height - current.height) / 2));
        await expect.poll(() => finalPicture.locator('img').evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);
        await expect.poll(() => item.evaluate(element => { const r = element.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; })).toBe(true);
        await expect.poll(() => item.evaluate(element => { const r = element.querySelector('.basket-product-picture').getBoundingClientRect(); const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return Boolean(hit && element.contains(hit)); })).toBe(true);
        row.geometry = await item.evaluate(element => {
          const r = element.getBoundingClientRect(), picture = element.querySelector('.basket-product-picture').getBoundingClientRect();
          const hit = document.elementFromPoint(picture.x + picture.width / 2, picture.y + picture.height / 2);
          const rail = document.querySelector('.house-rail')?.getBoundingClientRect();
          return { top: r.top, bottom: r.bottom, height: innerHeight, pictureNotCovered: Boolean(hit && element.contains(hit)), bottomToolsTop: rail?.top, name: element.textContent.trim() };
        });
        expect(row.geometry.pictureNotCovered).toBe(true);
        if (device === 'phone' && view === '3d') expect(row.geometry.bottom).toBeLessThanOrEqual(row.geometry.bottomToolsTop + 1);
        expect(errors).toEqual([]); expect(writes).toEqual([]); expect(placeholders).toEqual([]);
        row.shot = `${out}/${device}-${view}-basket-last.png`; await page.screenshot({ path: row.shot });
      } catch (error) { row.failures.push(String(error)); await page.screenshot({ path: `${out}/${device}-${view}-scroll-failure.png` }); }
    }
    await context.close();
  }
} finally { await browser.close(); writeFileSync(`${out}/scroll-report.json`, JSON.stringify(report, null, 2)); }
console.log(JSON.stringify(report, null, 2));
if (report.cases.some(row => row.failures.length || row.errors.length || row.writes.length || row.placeholders.length)) process.exitCode = 1;
