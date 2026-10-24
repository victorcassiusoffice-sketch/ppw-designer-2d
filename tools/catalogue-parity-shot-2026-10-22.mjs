import { chromium, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
const base = process.argv[2] ?? 'http://127.0.0.1:5176';
if (!['127.0.0.1', 'localhost'].includes(new URL(base).hostname)) throw new Error('Local QA only');
const out = 'docs/qa-sims-parity-2026-10-22/catalogue-after'; mkdirSync(out, { recursive: true });
const report = { base, cases: [] };
const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  for (const [name, viewport] of [['desktop', { width: 1280, height: 900 }], ['phone', { width: 390, height: 844 }]]) {
    const context = await browser.newContext({ viewport, isMobile: name === 'phone', hasTouch: name === 'phone', deviceScaleFactor: 1 });
    await context.addInitScript(() => { localStorage.clear(); localStorage.setItem('ppw_designer_coach_v1', '1'); });
    const page = await context.newPage(); page.setDefaultTimeout(20000);
    let priceRoute = false;
    const row = { name, errors: [], normalDesignerFxErrors: [], failures: [], httpFailures: [], writes: [], screenshots: [], checks: [] }; report.cases.push(row);
    page.on('pageerror', error => row.errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') {
      const url = message.location().url ?? ''; const text = `${message.text()} ${url}`;
      // Preserve the existing authenticated FX dependency failure on the priced route;
      // it is reported separately, not counted as a clean whole-app console run.
      if (priceRoute && url.startsWith('https://api.exchangerate.host/')) row.normalDesignerFxErrors.push(text);
      else row.errors.push(text);
    } });
    page.on('response', response => { if (response.status() >= 400) row.httpFailures.push({ url: response.url(), status: response.status() }); });
    await page.route('**/api/**', async route => { if (!['GET', 'HEAD', 'OPTIONS'].includes(route.request().method())) { row.writes.push(route.request().url()); return route.abort(); } await route.continue(); });
    const prefix = name === 'phone' ? 'sims' : 'dock';
    const catalog = page.getByTestId(name === 'phone' ? 'sims-bottom-toolbar' : 'sims-dock');
    const cards = () => catalog.locator('[data-product-id]');
    const shot = async label => {
      await page.getByTestId('toast').waitFor({ state: 'hidden', timeout: 8000 }).catch(() => {});
      await page.waitForTimeout(250);
      const target = `${out}/${name}-${label}.png`; await page.screenshot({ path: target }); row.screenshots.push(target);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    };
    try {
      await page.goto(`${base}/demo?view=2d&pitch=1`, { waitUntil: 'domcontentloaded' });
      await page.getByTestId('plan-drawing-viewport').waitFor();
      await page.getByTestId(`${prefix}-catalog-open`).click();
      await catalog.getByRole('tab', { name: 'By function', exact: true }).click();
      await catalog.getByRole('tab', { name: 'Fitness', exact: true }).click();
      expect(await cards().count()).toBeGreaterThan(0);
      expect(await cards().evaluateAll(nodes => nodes.every(node => node.getAttribute('data-category') === 'fitness'))).toBe(true);
      expect(await catalog.locator('option[value^="price-"]').count()).toBe(0);
      await page.getByTestId(`${prefix}-search`).fill('NordicTrack');
      await page.getByTestId(`${prefix}-sort`).selectOption('name');
      expect(await cards().count()).toBeGreaterThan(0);
      await expect(cards().first().locator('img')).toHaveAttribute('src', /^\/products\/catalog-models\//);
      await expect.poll(() => cards().first().locator('img').evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);
      row.checks.push('Function filter, search, name sort, baked model image and price-free demo');
      await shot('2d-fitness');
      await catalog.getByRole('button', { name: /^Details for / }).first().click();
      await expect(catalog.getByTestId('mobile-product-popup')).toBeVisible();
      await expect(catalog.getByTestId('catalog-availability')).toHaveText('Ask supplier');
      await expect(catalog.getByTestId('mobile-product-popup')).toContainText('cm');
      await expect(catalog.getByTestId('mobile-product-popup')).toContainText('Supplier:');
      await expect(catalog.getByTestId('mobile-product-popup')).toContainText('supplier last told us');
      await shot('2d-details');
      await catalog.getByRole('button', { name: '← Products', exact: true }).click();
      await catalog.getByRole('tab', { name: 'By room', exact: true }).click();
      await catalog.getByRole('tab', { name: 'Bathroom', exact: true }).click();
      expect(await cards().count()).toBeGreaterThan(0);
      await shot('2d-bathroom'); row.checks.push('Room filter and explicit details/back, dimensions and honest stock');
      await catalog.getByRole('tab', { name: 'By function', exact: true }).click();
      await catalog.getByRole('tab', { name: 'Surfaces', exact: true }).click();
      const floorCard = catalog.locator('[data-floor-material]').first();
      await floorCard.locator('..').getByRole('button', { name: /^Details for / }).click();
      await expect(catalog.getByTestId('popup-lay-floor')).toBeVisible();
      await shot('2d-floor-details');
      row.checks.push('Floor product details remain separate from laying the floor');
      await page.keyboard.press('Escape');
      await page.getByRole('button', { name: '3D House', exact: true }).click();
      await page.getByTestId('wallpaint-3d-gl').waitFor(); await page.getByTestId('loading-3d').waitFor({ state: 'hidden', timeout: 60000 });
      await page.getByTestId('house-mode-furnish').click();
      await catalog.getByRole('tab', { name: 'By function', exact: true }).click();
      await catalog.getByRole('tab', { name: 'Fitness', exact: true }).click();
      await page.getByTestId(`${prefix}-search`).fill('NordicTrack');
      await shot('3d-fitness');
      await catalog.getByRole('button', { name: /^Details for / }).first().click();
      await expect(catalog.getByTestId('mobile-product-popup')).toBeVisible();
      await shot('3d-details');
      await catalog.getByRole('button', { name: /Close home store/ }).click();
      await expect(catalog).toHaveAttribute('data-catalog-open', 'false');
      row.checks.push('3D uses the same catalogue and closes details without placing');
      // Non-demo local route is permitted to show the prices already in this app.
      expect(row.errors).toEqual([]);
      priceRoute = true;
      await page.goto(`${base}/designer?view=2d`, { waitUntil: 'domcontentloaded' });
      await page.getByTestId('plan-drawing-viewport').waitFor();
      await page.getByTestId(`${prefix}-catalog-open`).click();
      await page.getByTestId(`${prefix}-sort`).selectOption('price-asc');
      row.checks.push('Price sort is available only on the normal Designer route');
      await shot('designer-price-sort');
      expect(row.errors).toEqual([]); expect(row.writes).toEqual([]);
    } catch (error) { row.failures.push(String(error)); await page.screenshot({ path: `${out}/${name}-failure.png` }); }
    await context.close(); writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2));
  }
} finally { await browser.close(); writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2)); }
console.log(JSON.stringify(report, null, 2));
if (report.cases.some(row => row.failures.length || row.errors.length)) process.exitCode = 1;
