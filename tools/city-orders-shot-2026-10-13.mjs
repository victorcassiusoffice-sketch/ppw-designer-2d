/** Local headless QA only. No publishing, cloud writes, provider calls or emails. */
import { chromium, expect } from '@playwright/test';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
const base = process.argv[2] ?? 'http://127.0.0.1:5173';
if (!['127.0.0.1', 'localhost'].includes(new URL(base).hostname)) throw new Error('Local preview only.');
const out = 'docs/qa-city-2026-10-13'; mkdirSync(out, { recursive: true });
const report = { date: '2026-10-13', base, appBundle: readdirSync('dist/assets').find(name => /^App-[\w-]+\.js$/.test(name)), cases: [] };
const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  for (const [name, viewport] of [['desktop', { width: 1280, height: 900 }], ['phone', { width: 390, height: 844 }]]) {
    const context = await browser.newContext({ viewport, isMobile: name === 'phone', hasTouch: name === 'phone', deviceScaleFactor: 1, acceptDownloads: true });
    await context.addInitScript(() => {
      if (sessionStorage.getItem('qa-city-orders')) return;
      localStorage.clear(); localStorage.setItem('ppw_designer_coach_v1', '1');
      localStorage.setItem('ppw_property_v2', JSON.stringify({ version: 2, state: { pxPerMetre: 70, showGrid: true, property: { id: 'qa-city-orders', name: 'City procurement study', activeRoomId: 'qa-room', wallHeightM: 2.7, rooms: [{ id: 'qa-room', name: 'Ground room', polygon: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 8 }, { x: 0, y: 8 }], placedItems: [] }] } } }));
      sessionStorage.setItem('qa-city-orders', '1');
    });
    const page = await context.newPage(); page.setDefaultTimeout(60000);
    const entry = { viewport: name, dimensions: viewport, consoleErrors: [], pageErrors: [], failedRequests: [], httpErrors: [], captures: [], checks: [], defects: [], writeRequests: [] }; report.cases.push(entry);
    page.on('console', message => { if (message.type() === 'error') entry.consoleErrors.push(message.text()); });
    page.on('pageerror', error => entry.pageErrors.push(error.message));
    page.on('requestfailed', request => entry.failedRequests.push({ url: request.url(), failure: request.failure()?.errorText }));
    page.on('response', response => { if (response.status() >= 400) entry.httpErrors.push({ url: response.url(), status: response.status() }); });
    await page.route('**/api/**', async route => {
      if (!['GET', 'HEAD', 'OPTIONS'].includes(route.request().method())) { entry.writeRequests.push(route.request().url()); await route.abort(); return; }
      await route.continue();
    });
    async function placeAtTop(locator) {
      await locator.evaluate(element => { const pane = element.closest('.city-page'); if (pane) pane.scrollTop += element.getBoundingClientRect().top - pane.getBoundingClientRect().top - 18; });
    }
    async function shot(suffix) {
      await page.waitForTimeout(150); const file = `${out}/orders-${name}-${suffix}.png`;
      await page.screenshot({ path: file, timeout: 60000 }); entry.captures.push(file);
      const overflow = await page.evaluate(() => ({ viewport: innerWidth, pageWidth: document.documentElement.scrollWidth, panelWidth: document.querySelector('.city-page')?.clientWidth, panelScrollWidth: document.querySelector('.city-page')?.scrollWidth }));
      entry.checks.push({ screen: suffix, ...overflow });
      if (overflow.pageWidth > overflow.viewport + 1 || overflow.panelScrollWidth > overflow.panelWidth + 1) entry.defects.push({ screen: suffix, overflow });
    }
    try {
      await page.goto(`${base}/demo?view=2d&panel=city`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForFunction(() => JSON.parse(localStorage.getItem('ppw_property_v2')).state.property.id !== 'qa-city-orders', null, { timeout: 60000 });
      await expect(page.getByRole('dialog', { name: 'City Build workspace' })).toBeVisible({ timeout: 60000 });
      entry.checks.push({ action: 'City deep link survives demo bootstrap', passed: true });
      await page.getByRole('button', { name: 'Orders', exact: true }).click();
      await expect(page.getByRole('region', { name: 'City equipment and ordering' })).toBeVisible();
      await shot('empty');
      await page.getByRole('button', { name: '+ Add draft', exact: true }).click();
      await page.getByLabel('Category', { exact: true }).fill('Solar lighting');
      await page.getByRole('button', { name: '+ Add equipment', exact: true }).click();
      await page.getByLabel('Equipment 1 quantity').fill('12');
      await placeAtTop(page.locator('.city-orders-editor')); await shot('equipment');
      await page.getByLabel('Order date', { exact: true }).fill('2026-11-10');
      await page.getByLabel('Invoice date', { exact: true }).fill('2026-11-08');
      await page.getByLabel('Delivery date', { exact: true }).fill('2026-11-18');
      await page.getByLabel('Order recipient email', { exact: true }).fill('incomplete@');
      await page.getByRole('navigation', { name: 'City sections' }).getByRole('button', { name: 'Plan', exact: true }).click();
      await expect(page.getByRole('region', { name: 'City equipment and ordering' })).toBeVisible();
      await expect(page.getByLabel('Order recipient email', { exact: true })).toHaveValue('incomplete@');
      await page.getByRole('button', { name: 'Back to building', exact: true }).click();
      await expect(page.getByRole('dialog', { name: 'City Build workspace' })).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog', { name: 'City Build workspace' })).toBeVisible();
      await expect(page.getByLabel('Order recipient email', { exact: true })).toHaveValue('incomplete@');
      entry.checks.push({ action: 'Unsaved edits survive parent section, Back and Escape attempts', passed: true });
      await page.getByLabel('Order recipient email', { exact: true }).fill('orders@example.com');
      await page.getByLabel('Invoice recipient email', { exact: true }).fill('accounts@example.com');
      await placeAtTop(page.getByRole('group', { name: 'Target dates · Mauritius time', exact: true })); await shot('dates-recipients');
      await page.getByLabel('I reviewed quantities, dates and recipients. This remains a draft for supplier approval.').check();
      await page.getByRole('button', { name: 'Save package', exact: true }).click();
      await expect(page.locator('.city-orders [role=status]')).toContainText('Package saved on this device');
      await expect(page.getByText('Save the supplier package or discard its edits before leaving Orders. Your entries are still here.', { exact: true })).toHaveCount(0);
      const saved = await page.evaluate(() => {
        const projectId = JSON.parse(localStorage.getItem('ppw_property_v2')).state.property.id;
        return JSON.parse(localStorage.getItem('ppw_city_procurement_v1')).state.plans[`demo:${projectId}`.slice(0, 100)];
      });
      expect(saved.packages[0]).toMatchObject({ state: 'reviewed', recipientEmail: 'orders@example.com', orderOn: '2026-11-10', invoiceOn: '2026-11-08', deliveryOn: '2026-11-18', lines: [{ quantity: 12, unit: 'each' }] });
      entry.checks.push({ action: 'Package persisted locally', quantity: 12, state: 'reviewed', dateTimezone: saved.timezone });
      await page.getByRole('button', { name: 'Timeline', exact: true }).click();
      await page.locator('.city-page').evaluate(element => { element.scrollTop = 0; });
      await expect(page.locator('.city-orders-timeline')).toContainText('8 Nov 2026'); await shot('timeline');
      const waitDownload = page.waitForEvent('download'); await page.getByRole('button', { name: 'Download CSV', exact: true }).click();
      const download = await waitDownload; const csvFile = `${out}/orders-${name}-draft.csv`; await download.saveAs(csvFile);
      const csv = readFileSync(csvFile, 'utf8'); expect(csv).not.toContain('orders@example.com'); expect(csv).not.toContain('accounts@example.com'); expect(csv).toContain('manual-review-required');
      entry.checks.push({ action: 'CSV downloaded without recipients', file: csvFile });
      await page.getByRole('button', { name: 'Connection', exact: true }).click(); await page.locator('.city-page').evaluate(element => { element.scrollTop = 0; });
      await expect(page.locator('.city-orders')).toContainText('Cloud writes, orders and email dispatch are disabled'); await shot('connection');
      // The main Designer additionally exposes real supplier fields and a sign-in-gated connection form.
      await page.goto(`${base}/designer?panel=city`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await expect(page.getByRole('dialog', { name: 'City Build workspace' })).toBeVisible({ timeout: 60000 });
      await page.getByRole('navigation', { name: 'City sections' }).getByRole('button', { name: 'Orders', exact: true }).click();
      await page.getByRole('button', { name: '+ Add draft', exact: true }).click();
      await page.getByLabel('Supplier', { exact: true }).fill('Example supplier');
      await page.getByLabel('Category', { exact: true }).fill('Water infrastructure');
      await page.getByRole('button', { name: '+ Add equipment', exact: true }).click();
      await page.getByLabel('Equipment 1 description').fill('Measured water pipe route');
      await page.getByLabel('Equipment 1 supplier reference').fill('DRAFT-PIPE-01');
      await page.getByLabel('Equipment 1 quantity').fill('120.5');
      await page.getByLabel('Equipment 1 unit').selectOption('m');
      await placeAtTop(page.locator('.city-orders-editor')); await shot('supplier-fields');
      await page.getByRole('button', { name: 'Save package', exact: true }).click();
      await expect(page.locator('.city-orders [role=status]')).toContainText('Package saved on this device');
      await page.getByRole('button', { name: 'Connection', exact: true }).click(); await page.locator('.city-page').evaluate(element => { element.scrollTop = 0; });
      await page.getByLabel('Merchant identifier', { exact: true }).fill('example-merchant');
      await expect(page.getByRole('button', { name: 'Save draft securely', exact: true })).toBeDisabled();
      await expect(page.getByRole('button', { name: 'Load saved revision', exact: true })).toBeDisabled();
      await shot('merchant-connection');
      entry.checks.push({ action: 'Main Designer supplier fields and unauthenticated cloud actions', passed: true });
      expect(entry.writeRequests).toHaveLength(0); entry.checks.push({ action: 'No API write requests', passed: true });
    } catch (error) { entry.defects.push({ error: error.message }); await page.screenshot({ path: `${out}/orders-${name}-failure.png`, timeout: 60000 }).catch(() => {}); }
    finally { await context.close(); }
  }
} finally { await browser.close(); writeFileSync(`${out}/orders-browser-results.json`, JSON.stringify(report, null, 2)); }
const failed = report.cases.some(entry => entry.defects.length || entry.consoleErrors.length || entry.pageErrors.length || entry.writeRequests.length);
console.log(JSON.stringify({ screenshots: report.cases.reduce((n, entry) => n + entry.captures.length, 0), cases: report.cases.map(entry => ({ viewport: entry.viewport, consoleErrors: entry.consoleErrors.length, pageErrors: entry.pageErrors.length, defects: entry.defects, writeRequests: entry.writeRequests.length })), failed }, null, 2));
if (failed) process.exitCode = 1;
