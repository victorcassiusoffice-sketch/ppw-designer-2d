import { chromium, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
const base = process.argv[2] ?? 'http://127.0.0.1:5176';
const phase = process.argv[3] ?? 'after';
if (!['127.0.0.1', 'localhost'].includes(new URL(base).hostname) || !['before', 'after'].includes(phase)) throw new Error('Local before/after QA only');
const out = `docs/qa-sims-parity-fix-2026-10-24/catalogue-${phase}`;
mkdirSync(out, { recursive: true });
const report = { base, phase, cases: [] };
const browser = await chromium.launch({ headless: true, args: ['--use-angle=d3d11'] });
try {
  for (const [device, viewport] of [['desktop', { width: 1280, height: 800 }], ['phone', { width: 390, height: 844 }]]) {
    const context = await browser.newContext({ viewport, isMobile: device === 'phone', hasTouch: device === 'phone' });
    await context.addInitScript(() => { localStorage.clear(); localStorage.setItem('ppw_designer_coach_v1', '1'); });
    const row = { device, errors: [], failures: [], writes: [], checks: [], shots: [], observations: [] }; report.cases.push(row);
    const page = await context.newPage(); page.setDefaultTimeout(20000);
    page.on('pageerror', error => row.errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') row.errors.push(message.text()); });
    await page.route('**/api/**', async route => { if (!['GET', 'HEAD', 'OPTIONS'].includes(route.request().method())) { row.writes.push(route.request().url()); return route.abort(); } await route.continue(); });
    const catalog = page.getByTestId(device === 'phone' ? 'sims-bottom-toolbar' : 'sims-dock');
    const prefix = device === 'phone' ? 'sims' : 'dock';
    const cards = () => catalog.locator('[data-product-id]');
    const shot = async name => { await page.waitForTimeout(250); const path = `${out}/${device}-${name}.png`; await page.screenshot({ path }); row.shots.push(path); expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1); };
    try {
      await page.goto(`${base}/demo?view=2d&pitch=1`, { waitUntil: 'networkidle' });
      await page.getByTestId('plan-drawing-viewport').waitFor();
      await page.getByTestId(`${prefix}-catalog-open`).click();
      for (const view of ['2d', '3d']) {
        if (view === '3d') {
          await page.keyboard.press('Escape');
          await page.getByRole('button', { name: '3D House', exact: true }).click();
          await page.getByTestId('wallpaint-3d-gl').waitFor();
          await page.getByTestId('loading-3d').waitFor({ state: 'hidden', timeout: 60000 });
          await page.getByTestId('house-mode-furnish').click();
        }
        await catalog.getByRole('tab', { name: 'By function', exact: true }).click();
        await catalog.getByRole('tab', { name: 'Fitness', exact: true }).click();
        await page.getByTestId(`${prefix}-search`).fill('NordicTrack');
        await page.getByTestId(`${prefix}-sort`).selectOption('name');
        await expect.poll(() => cards().first().locator('img').evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);
        const image = await cards().first().locator('img').getAttribute('src');
        row.observations.push({ view, firstFitnessImage: image });
        if (phase === 'after') expect(image).toMatch(/\/products\/photos\//);
        await shot(`${view}-supplier-photo`);
        await page.getByTestId(`${prefix}-search`).fill('');
        await page.getByTestId(`${prefix}-sort`).selectOption('catalog');
        await catalog.getByRole('tab', { name: 'By room', exact: true }).click();
        await catalog.getByRole('tab', { name: 'Bathroom', exact: true }).click();
        const leadingIds = await cards().evaluateAll(nodes => nodes.slice(0, 5).map(node => ({ id: node.getAttribute('data-product-id'), name: node.getAttribute('title') ?? node.textContent })));
        row.observations.push({ view, leadingBathroom: leadingIds });
        if (phase === 'after') expect(leadingIds[0].name).toMatch(/basin|toilet|bidet|shower|sink|bath/i);
        expect(await catalog.locator('option[value^="price-"]').count()).toBe(0);
        expect(await catalog.innerText()).not.toMatch(/Courts Mammouth|Espace Maison|John Lewis|\bMUR\b|\bRs\b|€|£|\$/i);
        await shot(`${view}-bathroom`);
        row.checks.push(`${view}: photo selection, Bathroom ordering, price-free unnamed-supplier demo and no horizontal overflow`);
      }
      expect(row.errors).toEqual([]); expect(row.writes).toEqual([]);
    } catch (error) { row.failures.push(String(error)); await page.screenshot({ path: `${out}/${device}-failure.png` }); }
    await context.close(); writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2));
  }
} finally { await browser.close(); writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2)); }
console.log(JSON.stringify(report, null, 2));
if (report.cases.some(row => row.errors.length || row.failures.length || row.writes.length)) process.exitCode = 1;
