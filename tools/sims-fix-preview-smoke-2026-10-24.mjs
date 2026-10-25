import { chromium, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// Run only after the new immutable branch deployment exists. No source imports,
// fixture injection, access-code submission, checkout or destructive clicks.
const supplied = process.argv[2];
if (!supplied) throw new Error('Provide the unique HTTPS Vercel preview origin and optional output folder.');
const url = new URL(supplied);
if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || !['', '/'].includes(url.pathname)
  || !url.hostname.endsWith('.vercel.app') || url.hostname.includes('-git-')) {
  throw new Error('Use a unique HTTPS Vercel deployment origin, not production, a branch alias or a path.');
}
const base = url.origin;
const out = process.argv[3] || 'docs/qa-sims-parity-fix-2026-10-24/preview-smoke';
mkdirSync(out, { recursive: true });
const report = { base, checkedAt: new Date().toISOString(), fixtureInjection: false, routes: [], cases: [], failures: [] };
const save = () => writeFileSync(join(out, 'report.json'), JSON.stringify(report, null, 2));
const browser = await chromium.launch({ headless: true, args: ['--use-angle=d3d11', ...(process.env.PREVIEW_PIN ? [`--host-resolver-rules=MAP ${url.hostname} ${process.env.PREVIEW_PIN}`] : [])] });
const currency = /\b(?:MUR|MURs|Rs\.?|USD|EUR|GBP|CNY|RMB)\b|[€£$¥￥]/i;
const privateNames = /\b(?:Courts(?:\s+Mammouth)?|Espace\s+Maison|John\s+Lewis|TintEX)\b/i;
const readMethods = new Set(['GET', 'HEAD', 'OPTIONS']);
function recordPage(page, row) {
  page.on('console', message => { if (message.type() === 'error') row.consoleErrors.push(message.text()); });
  page.on('pageerror', error => row.pageErrors.push(String(error)));
  page.on('response', response => { if (response.status() >= 400) row.httpErrors.push({ url: response.url(), status: response.status() }); });
  page.on('requestfailed', request => row.failedRequests.push({ url: request.url(), method: request.method(), error: request.failure()?.errorText ?? 'unknown' }));
}
async function prohibitWrites(context, row) {
  await context.route('**/*', route => {
    const request = route.request();
    if (!readMethods.has(request.method())) {
      row.blockedWrites.push({ url: request.url(), method: request.method(), api: new URL(request.url()).pathname.startsWith('/api/') });
      return route.abort('blockedbyclient');
    }
    return route.continue();
  });
}
async function publicBoundary(page, row, label) {
  const text = await page.locator('body').innerText();
  const currencyMatch = text.match(currency)?.[0] ?? null;
  const privateNameMatch = text.match(privateNames)?.[0] ?? null;
  const products = await page.locator('button:visible').evaluateAll(buttons => buttons
    .filter(button => /cart|products/i.test(`${button.getAttribute('aria-label') ?? ''} ${button.getAttribute('title') ?? ''} ${button.innerText}`))
    .map(button => ({ text: button.innerText.trim(), label: button.getAttribute('aria-label'), title: button.getAttribute('title') })));
  const countLabels = products.filter(button => /\d/.test(`${button.text} ${button.label ?? ''} ${button.title ?? ''}`));
  const badges = await page.locator('[data-testid*="cart-count"]:visible,[data-testid*="cart-units"]:visible,[data-testid="cart-floor-units"]:visible,[data-testid="cart-paint-tins"]:visible,[data-testid="cart-cladding-packs"]:visible,.cart-count:visible,.cart-badge:visible').count();
  const overflowPx = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  row.boundaries.push({ label, currencyMatch, privateNameMatch, productControls: products, countLabels, badges, overflowPx });
  expect(currencyMatch, `${label}: visible currency`).toBeNull();
  expect(privateNameMatch, `${label}: retailer/client name`).toBeNull();
  expect(countLabels, `${label}: product/cart control includes a count`).toEqual([]);
  expect(badges, `${label}: cart count badge`).toBe(0);
  expect(overflowPx, `${label}: horizontal overflow`).toBeLessThanOrEqual(1);
}
async function check(row, name, action, page, device) {
  try { await action(); row.checks.push({ name, pass: true }); }
  catch (error) {
    row.checks.push({ name, pass: false, error: String(error) });
    const path = join(out, `${device}-FAILED-${name.replace(/[^a-z0-9-]/gi, '-')}.png`);
    try { await page.screenshot({ path }); row.shots.push(path); } catch { /* Preserve the original failure. */ }
  }
  save();
}
try {
  for (const [device, viewport] of [['desktop', { width: 1280, height: 800 }], ['phone', { width: 390, height: 844 }]]) {
    const context = await browser.newContext({ viewport, hasTouch: device === 'phone', isMobile: device === 'phone', reducedMotion: 'reduce' });
    const row = { device, viewport, consoleErrors: [], pageErrors: [], httpErrors: [], failedRequests: [], blockedWrites: [], boundaries: [], checks: [], shots: [] };
    report.cases.push(row);
    await context.addInitScript(() => localStorage.setItem('ppw_designer_coach_v1', '1'));
    await prohibitWrites(context, row);
    const page = await context.newPage();
    page.setDefaultTimeout(45000);
    recordPage(page, row);
    const shot = async name => { const path = join(out, `${device}-${name}.png`); await page.screenshot({ path }); row.shots.push(path); };
    try {
      for (const view of ['2d', '3d']) await check(row, `${view}-render-remove-boundary`, async () => {
        const route = `/demo?view=${view}&pitch=1`;
        const began = Date.now();
        const response = await page.goto(`${base}${route}`, { waitUntil: 'networkidle' });
        report.routes.push({ device, path: route, status: response?.status() ?? null });
        expect(response?.status()).toBe(200);
        if (view === '2d') await page.getByTestId('plan-drawing-viewport').waitFor();
        else {
          if (!await page.getByTestId('wallpaint-3d-gl').isVisible()) await page.getByRole('button', { name: /^(3D|3D House)$/ }).click();
          await page.getByTestId('wallpaint-3d-gl').waitFor();
          await page.getByTestId('loading-3d').waitFor({ state: 'hidden', timeout: 90000 });
          row.first3DReadyMs = Date.now() - began;
        }
        await page.waitForTimeout(1000);
        await publicBoundary(page, row, `${view}-render`);
        await shot(view);
        if (view === '2d') {
          await page.getByRole('button', { name: 'Arrange', exact: true }).click();
          await page.getByTestId('remove-tool-toggle').click();
          await expect(page.getByTestId('remove-hud')).toBeVisible();
          await shot('2d-remove-ready');
          await page.getByTestId('remove-done').click();
          await expect(page.getByTestId('remove-hud')).toBeHidden();
        } else {
          const remove = page.getByTestId('remove-tool-3d');
          if (!await remove.isVisible()) await page.getByRole('button', { name: 'Build tools', exact: true }).click();
          await remove.click();
          const hud = page.getByTestId('remove-3d-hud');
          await expect(hud).toBeVisible();
          await shot('3d-remove-ready');
          await hud.getByRole('button', { name: 'Done', exact: true }).click();
          await expect(hud).toBeHidden();
        }
        await publicBoundary(page, row, `${view}-remove-closed`);
      }, page, device);
      await check(row, 'materials-evidence-11-modules-and-cart-icon', async () => {
        const path = '/demo?view=2d&panel=materials&pitch=1';
        const response = await page.goto(`${base}${path}`, { waitUntil: 'networkidle' });
        report.routes.push({ device, path, status: response?.status() ?? null });
        expect(response?.status()).toBe(200);
        const evidence = page.getByTestId('estimate-evidence');
        await expect(evidence).toBeVisible();
        expect(await evidence.getAttribute('open')).toBeNull();
        const cart = page.locator('.analysis-cart-summary');
        await expect(cart).toHaveText('Products');
        await expect(cart.getByRole('button', { name: 'Open products', exact: true })).toBeVisible();
        const svg = cart.locator('svg.studio-icon');
        await expect(svg).toBeVisible();
        const paths = await svg.locator('path').evaluateAll(nodes => nodes.map(node => node.getAttribute('d')));
        row.productsIconPaths = paths;
        expect(paths.some(path => path?.includes('M3 4h3l3 12') && path.includes('M10 20') && path.includes('M18 20')), 'Products uses the trolley silhouette and two wheels, not the old cube').toBe(true);
        await publicBoundary(page, row, 'materials-collapsed');
        await shot('materials-collapsed-products-icon');
        await evidence.locator(':scope > summary').click();
        await evidence.locator('.estimate-evidence-stat').scrollIntoViewIfNeeded();
        await expect(evidence).toContainText('Presence only');
        await expect(evidence).toContainText('Independent validation · not available');
        await shot('materials-input-evidence');
        await evidence.locator('.estimate-engine-inventory > summary').click();
        await expect(evidence.locator('.estimate-engine')).toHaveCount(11);
        await evidence.locator('.estimate-engine').nth(1).locator('summary').click();
        await evidence.locator('.estimate-engine').nth(1).scrollIntoViewIfNeeded();
        await expect(evidence).toContainText('Mix ratios do not certify strength');
        await publicBoundary(page, row, 'materials-expanded');
        await shot('materials-engine-scope');
      }, page, device);
      await check(row, 'no-runtime-http-or-write-errors', async () => {
        expect(row.consoleErrors).toEqual([]); expect(row.pageErrors).toEqual([]);
        expect(row.httpErrors).toEqual([]); expect(row.failedRequests).toEqual([]); expect(row.blockedWrites).toEqual([]);
      }, page, device);
    } finally { await context.close(); save(); }
  }
  const gateRow = { device: 'protected-routes', consoleErrors: [], pageErrors: [], httpErrors: [], failedRequests: [], blockedWrites: [], checks: [], shots: [] };
  report.cases.push(gateRow);
  for (const path of ['/designer', '/designer?demo=tintex']) {
    // A separate context ensures each protected route is checked without an
    // access cookie from another route. No access code is entered.
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    await prohibitWrites(context, gateRow);
    const page = await context.newPage(); page.setDefaultTimeout(45000); recordPage(page, gateRow);
    await check(gateRow, path.includes('tintex') ? 'legacy-tintex-gated' : 'designer-gated', async () => {
      const response = await page.goto(`${base}${path}`, { waitUntil: 'domcontentloaded' });
      expect(response?.status()).toBe(200);
      await expect(page.locator('input[name="code"]')).toBeVisible();
      const gatePresent = await page.locator('input[name="code"]').isVisible();
      report.routes.push({ path, status: response?.status() ?? null, gatePresent });
      const shot = join(out, path.includes('tintex') ? 'gate-legacy-tintex.png' : 'gate-designer.png');
      await page.screenshot({ path: shot }); gateRow.shots.push(shot);
    }, page, 'protected');
    await context.close(); save();
  }
} catch (error) { report.failures.push(String(error)); }
finally {
  await browser.close();
  if (report.failures.length || report.cases.some(row => row.checks.some(check => !check.pass) || row.consoleErrors.length || row.pageErrors.length || row.httpErrors.length || row.failedRequests.length || row.blockedWrites.length)) process.exitCode = 1;
  save(); console.log(JSON.stringify(report, null, 2));
}
