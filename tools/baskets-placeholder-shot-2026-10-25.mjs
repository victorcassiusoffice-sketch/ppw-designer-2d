import { chromium, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
const base = process.argv[2] ?? 'http://127.0.0.1:5176';
const phase = process.argv[3] ?? 'after';
if (!['127.0.0.1', 'localhost', 'onelivebuild.com', 'designer.ppwellness.co'].includes(new URL(base).hostname) || !['before', 'after'].includes(phase)) throw new Error('Expected approved local or production read-only target');
const out = `docs/qa-sims-fix-round-2-2026-10-25/catalogue-and-baskets/${phase}`;
mkdirSync(out, { recursive: true });
const report = { base, phase, cases: [] };
const browser = await chromium.launch({ headless: true, args: ['--use-angle=d3d11'] });
try {
  for (const [device, viewport] of [['desktop', { width: 1280, height: 800 }], ['phone', { width: 390, height: 844 }]]) {
    const context = await browser.newContext({ viewport, isMobile: device === 'phone', hasTouch: device === 'phone' });
    await context.addInitScript(() => { localStorage.clear(); localStorage.setItem('ppw_designer_coach_v1', '1'); });
    const page = await context.newPage(); page.setDefaultTimeout(20000);
    const row = { device, errors: [], failures: [], writes: [], placeholders: [], checks: [], shots: [], observations: [] }; report.cases.push(row);
    page.on('pageerror', error => row.errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') row.errors.push(message.text()); });
    page.on('request', request => { if (/placehold\.co/i.test(request.url())) row.placeholders.push(request.url()); });
    await page.route('**/api/**', async route => { if (!['GET', 'HEAD', 'OPTIONS'].includes(route.request().method())) { row.writes.push(route.request().url()); return route.abort(); } await route.continue(); });
    const shot = async name => { const path = `${out}/${device}-${name}.png`; await page.screenshot({ path }); row.shots.push(path); expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1); };
    const guard = async scope => { expect(await scope.innerText()).not.toMatch(/Courts Mammouth|Espace Maison|John Lewis|\bMUR\b|\bRs\b|€|£|\$/i); };
    try {
      for (const view of ['2d', '3d']) {
        await page.goto(`${base}/demo?view=${view}&pitch=1`, { waitUntil: 'domcontentloaded' });
        await page.getByTestId(view === '2d' ? 'plan-drawing-viewport' : 'wallpaint-3d-gl').waitFor();
        if (view === '3d') await page.getByTestId('loading-3d').waitFor({ state: 'hidden', timeout: 90000 });
        if (view === '2d') await page.getByTestId('cart-pill').click();
        else await page.locator('button[aria-label="Products in this design"]:visible').first().click();
        const basket = view === '2d' ? page.getByTestId('cart-sheet') : page.locator('section[aria-label="Products and finishes in your design"]');
        await basket.waitFor(); await guard(basket);
        if (phase === 'after') {
          await expect.poll(() => basket.locator('.basket-product-picture img').count()).toBeGreaterThan(0);
          await expect.poll(() => basket.locator('.basket-product-picture img').evaluateAll(images => images.filter(image => image.getBoundingClientRect().bottom > 0 && image.getBoundingClientRect().top < innerHeight).every(image => image.complete && image.naturalWidth > 0))).toBe(true);
          expect(await basket.innerText()).not.toMatch(/\bQty\b|\d+ unique|\d+ placed|\b\d+ × /);
          expect(await basket.locator('[data-image-kind="plan"]').count()).toBeGreaterThan(0);
        }
        row.observations.push({ view, images: await basket.locator('img').count(), drawings: await basket.locator('[data-image-kind="plan"]').count() });
        await shot(`${view}-basket`); row.checks.push(phase === 'after' ? `${view} basket: image column, demo text guard, no horizontal overflow` : `${view} baseline basket image count recorded; demo text guard and no horizontal overflow`);
        if (view === '2d') await basket.getByRole('button', { name: 'Close', exact: true }).click();
        else await page.locator('button[aria-label="Products in this design"]:visible').first().click();
        if (view === '2d') await page.getByTestId(device === 'phone' ? 'sims-catalog-open' : 'dock-catalog-open').click();
        else await page.getByTestId('house-mode-furnish').click();
        const catalog = page.getByTestId(device === 'phone' ? 'sims-bottom-toolbar' : 'sims-dock'), prefix = device === 'phone' ? 'sims' : 'dock';
        await catalog.getByRole('tab', { name: 'Categories', exact: true }).click();
        await page.getByTestId(`${prefix}-cat-all`).click();
        for (const search of ['Console', 'Rubber', 'NordicTrack']) {
          await page.getByTestId(`${prefix}-search`).fill(search);
          const cards = catalog.locator('[data-product-id]');
          await expect.poll(() => cards.count()).toBeGreaterThan(0);
          await page.waitForTimeout(500);
          if (phase === 'after') await expect.poll(() => cards.locator('img').evaluateAll(images => images.filter(image => { const r = image.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth; }).every(image => image.complete && image.naturalWidth > 0))).toBe(true);
          const images = await cards.evaluateAll(nodes => nodes.map(node => ({ id: node.getAttribute('data-product-id'), kind: node.querySelector('[data-image-kind]')?.getAttribute('data-image-kind'), source: node.querySelector('img')?.getAttribute('src'), loaded: Boolean(node.querySelector('img')?.complete && node.querySelector('img')?.naturalWidth) })));
          if (phase === 'after') {
            expect(images.every(image => !/placehold\.co/i.test(image.source ?? ''))).toBe(true);
            if (search === 'NordicTrack') expect(images.some(image => image.kind === 'photo' && image.source.includes('/products/photos/'))).toBe(true);
            else expect(images.some(image => image.kind === 'plan')).toBe(true);
          }
          row.observations.push({ view, search, images }); await guard(catalog); await shot(`${view}-${search.toLowerCase()}`);
        }
        row.checks.push(phase === 'after' ? `${view} catalogue: existing photos and labelled drawings, no placeholder URLs` : `${view} baseline catalogue image sources and network requests recorded`);
      }
      expect(row.errors).toEqual([]); expect(row.writes).toEqual([]);
      if (phase === 'after') expect(row.placeholders).toEqual([]);
    } catch (error) { row.failures.push(String(error)); await page.screenshot({ path: `${out}/${device}-failure.png` }); }
    await context.close(); writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2));
  }
} finally { await browser.close(); writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2)); }
console.log(JSON.stringify(report, null, 2));
if (report.cases.some(row => row.errors.length || row.failures.length || row.writes.length)) process.exitCode = 1;
