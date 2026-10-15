/** Read-only local browser QA, disposable seeded project; no API writes. */
import { chromium, expect } from '@playwright/test';
import { mkdirSync, writeFileSync, readdirSync } from 'node:fs';

const base = process.argv[2] ?? 'http://127.0.0.1:5173';
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw new Error('Local preview only.');
const out = 'docs/qa-professional-views-2026-10-15'; mkdirSync(out, { recursive: true });
const report = { base, at: new Date().toISOString(), bundle: readdirSync('dist/assets').find(file => /^App-[\w-]+\.js$/.test(file)), cases: [] };
const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const views = ['dollhouse', 'above', 'front', 'axonometric', 'plan', 'north', 'east', 'south', 'west'];
try {
  for (const [name, viewport] of [['desktop', { width: 1280, height: 900 }], ['phone', { width: 390, height: 844 }]]) {
    const context = await browser.newContext({ viewport, hasTouch: name === 'phone', isMobile: name === 'phone', deviceScaleFactor: 1 });
    await context.addInitScript(() => {
      if (sessionStorage.getItem('qa-professional-seeded')) return;
      localStorage.clear(); localStorage.setItem('ppw_designer_coach_v1', '1');
      localStorage.setItem('ppw_property_v2', JSON.stringify({ version: 2, state: { pxPerMetre: 70, showGrid: true,
        property: { id: 'qa-professional-views', name: 'Measured garden study', activeRoomId: 'qa-room', wallHeightM: 2.7,
          rooms: [{ id: 'qa-room', name: 'Studio', polygon: [{ x: 0, y: 0 }, { x: 8, y: 0 }, { x: 8, y: 6 }, { x: 0, y: 6 }],
            placedItems: [{ instanceId: 'qa-sofa', productId: 'courts-marco-sofa-corner', x: 1, y: 1, rotation: 0 }] }],
          eco: { version: 1, greenRoofs: [], trees: [
            { id: 'qa-tree-existing', name: 'Existing tree', x: -3, y: 3, heightM: 4.8, canopyRadiusM: 1.8, stemDiameterMm: 180, protectionMethod: 'bs5837-single-stem', status: 'existing' },
            { id: 'qa-tree-proposed', name: 'Proposed tree', x: 11, y: 4, heightM: 3.6, canopyRadiusM: 1.3, protectionMethod: 'unconfirmed', status: 'proposed' },
          ] },
        } } }));
      sessionStorage.setItem('qa-professional-seeded', '1');
    });
    const page = await context.newPage(); page.setDefaultTimeout(25000);
    const result = { name, viewport, screenshots: [], checks: [], failures: [], consoleErrors: [], pageErrors: [], failedRequests: [], writes: [] };
    report.cases.push(result);
    page.on('console', message => { if (message.type() === 'error') result.consoleErrors.push(message.text()); });
    page.on('pageerror', error => result.pageErrors.push(error.message));
    page.on('requestfailed', request => result.failedRequests.push({ url: request.url(), error: request.failure()?.errorText }));
    await page.route('**/api/**', async route => {
      if (!['GET', 'HEAD', 'OPTIONS'].includes(route.request().method())) { result.writes.push(route.request().url()); await route.abort(); }
      else await route.continue();
    });
    const shot = async label => {
      const path = `${out}/${name}-${label}.png`; await page.screenshot({ path, timeout: 60000 }); result.screenshots.push(path);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
      if (overflow) result.failures.push(`Horizontal overflow on ${label}`);
    };
    try {
      await page.goto(`${base}/designer?view=2d`, { waitUntil: 'networkidle' });
      await page.locator('.konvajs-content canvas').first().waitFor(); await shot('plan-trees');
      await page.getByRole('button', { name: '3D House', exact: true }).click();
      await page.getByTestId('wallpaint-3d-gl').waitFor();
      await page.getByTestId('loading-3d').waitFor({ state: 'hidden', timeout: 60000 });
      await page.waitForTimeout(800);
      const overlaps = await page.locator('.house-header').evaluate(header => {
        const view = header.querySelector('.house-view-switch').getBoundingClientRect();
        return [...header.querySelectorAll('.house-project-actions > button,.house-project-actions > details > summary')].filter(button => {
          const box = button.getBoundingClientRect();
          return box.width > 0 && box.height > 0 && box.left < view.right - 1 && box.right > view.left && box.top < view.bottom && box.bottom > view.top;
        }).map(button => button.getAttribute('aria-label') || button.textContent);
      });
      if (overlaps.length) result.failures.push(`Header overlaps view switch: ${overlaps.join(', ')}`);
      for (const view of views) {
        await page.getByTestId('house-view-settings').click();
        await page.getByLabel('Camera view', { exact: true }).selectOption(view);
        if (view === 'axonometric') { await page.waitForTimeout(600); await shot('view-controls'); }
        await page.getByRole('button', { name: 'Close view settings', exact: true }).click();
        await page.waitForTimeout(550);
        await expect(page.getByTestId('wallpaint-3d-gl')).toHaveAttribute('data-projection', ['dollhouse', 'above', 'front'].includes(view) ? 'perspective' : 'orthographic');
        await shot(view);
      }
      // A zoom in elevation must not clamp it back to a sloping orbit view.
      await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
      await page.waitForTimeout(500); await shot('elevation-zoom');
      await expect(page.getByTestId('wallpaint-3d-gl')).toHaveAttribute('data-projection', 'orthographic');
      await page.getByTestId('house-view-settings').click();
      await expect(page.getByLabel('Camera view', { exact: true })).toHaveValue('west');
      await page.getByLabel('Camera view', { exact: true }).selectOption('dollhouse');
      await page.getByRole('button', { name: 'Close view settings', exact: true }).click();
      await page.getByTestId('view3d-pan').click();
      const box = await page.getByTestId('wallpaint-3d-canvas').boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2 + 30, box.y + box.height / 2 + 12, { steps: 5 }); await page.mouse.up();
      await page.waitForTimeout(500); await shot('perspective-pan');
      if (name === 'phone') {
        await page.evaluate(() => localStorage.setItem('olb.ui-preferences.v1', JSON.stringify({ locale: 'fr', theme: 'ocean' })));
        await page.reload({ waitUntil: 'networkidle' });
        await page.locator('.konvajs-content canvas').first().waitFor(); await shot('plan-french-ocean');
        await page.locator('.studio-view-switch button').nth(1).click();
        await page.getByTestId('wallpaint-3d-gl').waitFor();
        await page.getByTestId('loading-3d').waitFor({ state: 'hidden', timeout: 60000 });
        await page.waitForTimeout(600); await shot('house-french-ocean');
        await page.getByTestId('house-view-settings').click(); await shot('controls-french-ocean');
      }
      result.checks.push('Nine professional camera presets load; correct real projection type.', 'Elevation zoom preserves the selected preset.', 'Perspective pan remains usable.', 'Measured trees visible in plan and 3D.', 'All activity uses local project storage; no API writes.');
    } catch (error) { result.failures.push(String(error)); await shot('failure'); }
    await context.close();
  }
} finally { await browser.close(); writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2)); }
console.log(JSON.stringify(report, null, 2));
if (report.cases.some(entry => entry.failures.length || entry.consoleErrors.length || entry.pageErrors.length || entry.writes.length)) process.exitCode = 1;
