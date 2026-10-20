/** Fresh public demo route smoke test: no property seed, no external writes. */
import { chromium, expect } from '@playwright/test';
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
const base = process.argv[2] ?? 'http://127.0.0.1:5173';
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw new Error('Local preview only.');
const out = 'docs/qa-services-spatial-2026-10-15'; mkdirSync(out, { recursive: true });
const report = { date: '2026-10-15', base, bundle: readdirSync('dist/assets').find(f => /^App-[\w-]+\.js$/.test(f)), cases: [] };
const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  for (const [name, viewport] of [['desktop', { width: 1280, height: 900 }], ['phone', { width: 390, height: 844 }]]) {
    for (const view of ['2d', '3d']) {
      const context = await browser.newContext({ viewport, hasTouch: name === 'phone', isMobile: name === 'phone', deviceScaleFactor: 1 });
      const page = await context.newPage(); page.setDefaultTimeout(45000);
      const result = { viewport: name, view, route: `/demo?panel=services&view=${view}`, consoleErrors: [], pageErrors: [], writes: [], failures: [] }; report.cases.push(result);
      page.on('console', m => { if (m.type() === 'error') result.consoleErrors.push(m.text()); });
      page.on('pageerror', error => result.pageErrors.push(error.message));
      await page.route('**/api/**', async route => {
        if (!['GET', 'HEAD', 'OPTIONS'].includes(route.request().method())) { result.writes.push(route.request().url()); await route.abort(); }
        else await route.continue();
      });
      try {
        await page.goto(`${base}${result.route}`, { waitUntil: 'networkidle' });
        await expect(page.getByRole('dialog', { name: 'Building services' })).toBeVisible();
        await expect(page.getByRole('button', { name: view === '3d' ? '3D edit' : '2D plan', exact: true })).toHaveAttribute('aria-pressed', 'true');
        if (view === '3d') await expect(page.locator('.services-three canvas')).toBeVisible();
        else await expect(page.locator('.services-plan')).toBeVisible();
        await page.waitForTimeout(1200);
        await expect(page.getByRole('dialog', { name: 'Building services' })).toBeVisible();
        result.property = await page.evaluate(() => JSON.parse(localStorage.getItem('ppw_property_v2')).state.property.id);
        expect(result.property).toBe('generic-demo-home');
        result.overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
        expect(result.overflow).toBeLessThanOrEqual(1);
        result.screenshot = `${out}/${name}-public-demo-${view}.png`;
        await page.screenshot({ path: result.screenshot });
      } catch (error) { result.failures.push(error.message); }
      await context.close();
    }
  }
} finally { await browser.close(); writeFileSync(`${out}/entry-report.json`, JSON.stringify(report, null, 2)); }
console.log(JSON.stringify(report, null, 2));
if (report.cases.some(c => c.failures.length || c.consoleErrors.length || c.pageErrors.length || c.writes.length)) process.exitCode = 1;
