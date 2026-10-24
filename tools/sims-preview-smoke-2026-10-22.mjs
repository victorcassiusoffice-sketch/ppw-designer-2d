import { chromium, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const base = process.argv[2];
if (!base?.startsWith('https://')) throw new Error('Provide the unique HTTPS preview URL');
const out = process.argv[3] || 'docs/qa-sims-parity-2026-10-22/preview-smoke';
mkdirSync(out, { recursive: true });
const report = { base, checkedAt: new Date().toISOString(), routes: [], cases: [], failures: [] };
const browser = await chromium.launch({ headless: true, args: ['--use-angle=d3d11', ...(process.env.PREVIEW_PIN ? [`--host-resolver-rules=MAP ${new URL(base).hostname} ${process.env.PREVIEW_PIN}`] : [])] });
try {
  for (const [device, viewport] of [['desktop', { width: 1280, height: 900 }], ['phone', { width: 390, height: 844 }]]) {
    const context = await browser.newContext({ viewport, hasTouch: device === 'phone', isMobile: device === 'phone' });
    const row = { device, consoleErrors: [], pageErrors: [], httpErrors: [], writes: [], shots: [] };
    report.cases.push(row);
    await context.addInitScript(() => localStorage.setItem('ppw_designer_coach_v1', '1'));
    await context.route('**/*', route => {
      if (!['GET', 'HEAD', 'OPTIONS'].includes(route.request().method())) {
        row.writes.push({ url: route.request().url(), method: route.request().method() });
        return route.abort();
      }
      return route.continue();
    });
    const page = await context.newPage();
    page.setDefaultTimeout(45000);
    page.on('console', m => { if (m.type() === 'error') row.consoleErrors.push(m.text()); });
    page.on('pageerror', e => row.pageErrors.push(String(e)));
    page.on('response', r => { if (r.status() >= 400) row.httpErrors.push({ url: r.url(), status: r.status() }); });
    for (const view of ['2d', '3d']) {
      const response = await page.goto(`${base}/demo?view=${view}&pitch=1`, { waitUntil: 'networkidle' });
      expect(response.status()).toBe(200);
      if (view === '2d') await page.getByTestId('plan-drawing-viewport').waitFor();
      else {
        if (!await page.getByTestId('wallpaint-3d-gl').isVisible()) {
          await page.getByRole('button', { name: /^(3D|3D House)$/ }).click();
        }
        await page.getByTestId('wallpaint-3d-gl').waitFor();
        await page.getByTestId('loading-3d').waitFor({ state: 'hidden' });
      }
      await page.waitForTimeout(1500);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
      const shot = join(out, `${device}-${view}.png`);
      await page.screenshot({ path: shot }); row.shots.push(shot);
    }
    await page.goto(`${base}/showcase/sims-parity-2026-10-22/graphics-comparison.html`, { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: 'One Live Build · graphics evidence' })).toBeVisible();
    await expect(page.locator('.pair')).toHaveCount(8);
    expect(await page.locator('img').evaluateAll(imgs => imgs.every(img => img.complete && img.naturalWidth > 0))).toBe(true);
    await page.getByRole('button', { name: 'Phone', exact: true }).click();
    await expect(page.locator('.pair:visible')).toHaveCount(4);
    expect(row.consoleErrors).toEqual([]); expect(row.pageErrors).toEqual([]); expect(row.httpErrors).toEqual([]); expect(row.writes).toEqual([]);
    await context.close();
  }
  const context = await browser.newContext();
  for (const path of ['/designer', '/designer?demo=tintex', '/demo?view=2d&pitch=1', '/demo?view=3d&pitch=1', '/showcase/sims-parity-2026-10-22/graphics-comparison.html']) {
    const page = await context.newPage();
    const response = await page.goto(`${base}${path}`, { waitUntil: 'domcontentloaded' });
    const gatePresent = await page.locator('input[name="code"]').count() > 0;
    report.routes.push({ path, status: response.status(), gatePresent });
    expect(response.status()).toBe(200);
    if (path.startsWith('/designer')) expect(gatePresent).toBe(true);
    await page.close();
  }
  await context.close();
} catch (error) {
  report.failures.push(String(error)); process.exitCode = 1;
} finally {
  await browser.close();
  writeFileSync(join(out, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}
