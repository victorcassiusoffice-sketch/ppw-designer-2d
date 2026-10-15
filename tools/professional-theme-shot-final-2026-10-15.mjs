/** Final theme-only recapture; engine sweep recorded separately. Local UI only. */
import { chromium, expect } from '@playwright/test';
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
const base = 'http://127.0.0.1:5173', out = 'docs/qa-professional-views-2026-10-15';
mkdirSync(out, { recursive: true });
const report = { at: new Date().toISOString(), base, bundle: readdirSync('dist/assets').find(file => /^App-[\w-]+\.js$/.test(file)), scope: 'French/ocean contrast, translated camera controls, header overlap and price-free pitch captures', cases: [] };
const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  for (const [name, viewport] of [['phone', { width: 390, height: 844 }], ['desktop', { width: 1280, height: 900 }]]) {
    const context = await browser.newContext({ viewport, hasTouch: name === 'phone', isMobile: name === 'phone', deviceScaleFactor: 1 });
    await context.addInitScript(() => {
      if (sessionStorage.getItem('qa-theme-seeded')) return;
      localStorage.clear(); localStorage.setItem('ppw_designer_coach_v1', '1');
      localStorage.setItem('olb.ui-preferences.v1', JSON.stringify({ locale: 'fr', theme: 'ocean' }));
      localStorage.setItem('ppw_property_v2', JSON.stringify({ version: 2, state: { pxPerMetre: 70, showGrid: true,
        property: { id: 'qa-professional-theme', name: 'Measured garden study', activeRoomId: 'qa-room', wallHeightM: 2.7,
          rooms: [{ id: 'qa-room', name: 'Studio', polygon: [{ x: 0, y: 0 }, { x: 8, y: 0 }, { x: 8, y: 6 }, { x: 0, y: 6 }],
            placedItems: [{ instanceId: 'qa-sofa', productId: 'courts-marco-sofa-corner', x: 1, y: 1, rotation: 0 }] }],
          eco: { version: 1, greenRoofs: [], trees: [
            { id: 'qa-tree-existing', name: 'Existing tree', x: -3, y: 3, heightM: 4.8, canopyRadiusM: 1.8, stemDiameterMm: 180, protectionMethod: 'bs5837-single-stem', status: 'existing' },
            { id: 'qa-tree-proposed', name: 'Proposed tree', x: 11, y: 4, heightM: 3.6, canopyRadiusM: 1.3, protectionMethod: 'unconfirmed', status: 'proposed' },
          ] },
        } } })); sessionStorage.setItem('qa-theme-seeded', '1');
    });
    const page = await context.newPage(); page.setDefaultTimeout(25000);
    const result = { name, viewport, captures: [], failures: [], consoleErrors: [], pageErrors: [], failedRequests: [], writes: [], cameraOptions: [] };
    report.cases.push(result);
    page.on('console', message => { if (message.type() === 'error') result.consoleErrors.push(message.text()); });
    page.on('pageerror', error => result.pageErrors.push(error.message));
    page.on('requestfailed', request => result.failedRequests.push({ url: request.url(), error: request.failure()?.errorText }));
    await page.route('**/api/**', async route => {
      if (!['GET', 'HEAD', 'OPTIONS'].includes(route.request().method())) { result.writes.push(route.request().url()); await route.abort(); }
      else await route.continue();
    });
    const shot = async label => {
      const path = `${out}/${name}-final-${label}.png`;
      await page.screenshot({ path, timeout: 60000 }); result.captures.push(path);
      if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)) result.failures.push(`Horizontal overflow: ${label}`);
      const text = await page.locator('body').innerText();
      if (/[£€$]\s*[\d,.]+|[\d,.]+\s*MUR/.test(text)) result.failures.push(`Displayed price in pitch capture: ${label}`);
    };
    try {
      await page.goto(`${base}/designer?pitch=1`, { waitUntil: 'networkidle' });
      await page.locator('.konvajs-content canvas').first().waitFor();
      await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
      await expect(page.locator('html')).toHaveAttribute('data-ui-theme', 'ocean');
      await shot('plan-french-ocean-pitch');
      await page.locator('.studio-view-switch button').nth(1).click();
      await page.getByTestId('wallpaint-3d-gl').waitFor();
      await page.getByTestId('loading-3d').waitFor({ state: 'hidden', timeout: 60000 });
      await page.waitForTimeout(700);
      result.headerOverlaps = await page.locator('.house-header').evaluate(header => {
        const view = header.querySelector('.house-view-switch').getBoundingClientRect();
        return [...header.querySelectorAll('.house-project-actions > button,.house-project-actions > details > summary')].filter(button => {
          const box = button.getBoundingClientRect();
          return box.width > 0 && box.height > 0 && box.left < view.right - 1 && box.right > view.left && box.top < view.bottom && box.bottom > view.top;
        }).map(button => button.getAttribute('aria-label') || button.textContent);
      });
      if (result.headerOverlaps.length) result.failures.push(`Header overlaps: ${result.headerOverlaps.join(', ')}`);
      await shot('house-french-ocean-pitch');
      result.controlColours = await page.locator('.house-rail button,.house-camera-row button,.house-project-actions [data-testid="clear-all-button"]').evaluateAll(nodes => nodes.map(node => ({ label: node.getAttribute('aria-label') || node.textContent, foreground: getComputedStyle(node).color, background: getComputedStyle(node).backgroundColor })));
      await page.getByTestId('house-view-settings').click();
      const select = page.getByTestId('view3d-camera-view');
      result.cameraOptions = await select.locator('option').allTextContents();
      await select.selectOption('north'); await page.waitForTimeout(700);
      await expect(page.getByTestId('wallpaint-3d-gl')).toHaveAttribute('data-projection', 'orthographic');
      await shot('controls-french-ocean-pitch');
      await page.getByTestId('house-view-options').locator('.house-view-options-heading button').click();
      await page.waitForTimeout(500); await shot('north-french-ocean-pitch');
    } catch (error) { result.failures.push(String(error)); await shot('failure'); }
    await context.close();
  }
} finally { await browser.close(); writeFileSync(`${out}/theme-final-report.json`, JSON.stringify(report, null, 2)); }
console.log(JSON.stringify(report, null, 2));
if (report.cases.some(result => result.failures.length || result.consoleErrors.length || result.pageErrors.length || result.writes.length)) process.exitCode = 1;
