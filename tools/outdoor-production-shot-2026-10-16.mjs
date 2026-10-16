/** Production-bundle QA: a normal saved project, then visible controls only.
 * No /src imports, debug stores, custom events, backend writes or external orders. */
import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const base = process.env.QA_BASE_URL ?? 'http://127.0.0.1:5173';
const out = new URL('../docs/outdoor-production-qa-2026-10-16/', import.meta.url);
await mkdir(out, { recursive: true });
const fixture = {
  id: 'qa-outdoor-production', name: 'Outdoor planning study', activeRoomId: 'qa-room', activeLevelId: 'ground', wallHeightM: 2.7,
  rooms: [{ id: 'qa-room', name: 'Outdoor study', polygon: [], placedItems: [] }],
  site: { originM: { x: -3, y: -3 }, widthM: 18, depthM: 15 },
  garden: { surfaces: [
    { id: 'qa-paving', kind: 'path', x: -1, y: 6, widthM: 6, depthM: 3, elevationM: 0, pavingProductId: 'em-ubp-rusclaord001', subBaseDepthM: .15 },
    { id: 'qa-pool', kind: 'pool', x: 6, y: 1, widthM: 6, depthM: 3, elevationM: 0, pool: { shellDepthM: 1.5, waterDepthM: 1.35, wallThicknessM: .2, baseThicknessM: .2, excavationMarginM: .3, stage: 'filled' } },
    { id: 'qa-drive', kind: 'tarmac', x: 5, y: 6, widthM: 7, depthM: 3, elevationM: 0, thicknessM: .07, subBaseDepthM: .2 },
  ], fences: [] },
};
const report = { base, bundle: 'production preview', cases: [] };
const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  for (const width of [1280, 390]) {
    const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 900 }, deviceScaleFactor: 1, isMobile: width === 390, hasTouch: width === 390 });
    await context.addInitScript(property => {
      if (sessionStorage.getItem('olb-outdoor-production-fixture')) return;
      localStorage.clear();
      localStorage.setItem('ppw_designer_coach_v1', '1');
      localStorage.setItem('ppw_property_v2', JSON.stringify({ version: 2, state: { property, pxPerMetre: 50, showGrid: true } }));
      sessionStorage.setItem('olb-outdoor-production-fixture', '1');
    }, fixture);
    const page = await context.newPage();
    page.setDefaultTimeout(30000);
    const result = { width, shots: [], consoleErrors: [], pageErrors: [], blockedWrites: [], failures: [], checks: [] };
    report.cases.push(result);
    page.on('pageerror', e => result.pageErrors.push(e.message));
    page.on('console', msg => { if (msg.type() === 'error') result.consoleErrors.push(msg.text()); });
    await page.route('**/api/**', async route => {
      if (!['GET', 'HEAD', 'OPTIONS'].includes(route.request().method())) { result.blockedWrites.push(route.request().url()); await route.abort(); }
      else await route.continue();
    });
    const shot = async name => {
      await page.waitForTimeout(400);
      const path = fileURLToPath(new URL(`${name}-${width}.png`, out));
      await page.screenshot({ path, fullPage: true, timeout: 60000 });
      result.shots.push(path);
      if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)) result.failures.push(`Horizontal overflow: ${name}`);
      if (width === 390 && await page.locator('.plan-garden-workspace').isVisible()) {
        const panel = await page.locator('.plan-garden-workspace').boundingBox();
        const catalog = await page.getByTestId('sims-bottom-toolbar').boundingBox();
        if (panel && catalog && panel.y + panel.height > catalog.y) result.failures.push(`Garden scrollport overlaps Furnish: ${name}`);
      }
    };
    const storedSurface = id => page.evaluate(id => JSON.parse(localStorage.getItem('ppw_property_v2')).state.property.garden.surfaces.find(s => s.id === id), id);
    try {
      await page.goto(`${base}/designer?view=2d&pitch=1`, { waitUntil: 'networkidle' });
      await page.locator('.konvajs-content canvas').first().waitFor();
      expect((await storedSurface('qa-pool')).pool.stage).toBe('filled');
      await page.locator('.studio-view-switch button').nth(1).click();
      await expect(page.getByTestId('wallpaint-3d-gl')).toBeVisible();
      await page.getByTestId('loading-3d').waitFor({ state: 'hidden', timeout: 60000 });
      await page.getByTestId('wallpaint-3d-fit').click();
      await page.waitForTimeout(900);
      await shot('outdoor-filled-3d');

      // Open the actual 3D garden inspector, select a saved pool and change its view.
      await page.getByTestId('house-mode-garden').click();
      await page.getByLabel('Landscape element', { exact: true }).selectOption('qa-pool');
      const quantities = await page.getByTestId('pool-quantities').textContent();
      await page.getByLabel('Pool construction stage', { exact: true }).selectOption('excavation');
      expect(await page.getByTestId('pool-quantities').textContent()).toBe(quantities);
      expect((await storedSurface('qa-pool')).pool.stage).toBe('excavation');
      result.checks.push('Construction-stage control persists and leaves planned quantities unchanged');
      await page.getByTestId('garden-panel').getByRole('button', { name: 'Done', exact: true }).click();
      await expect(page.locator('.house-inspector.is-open')).toHaveCount(0);
      result.checks.push('Garden Done fully closes the inspector without opening Build details');
      await page.waitForTimeout(500);
      await shot('outdoor-excavation-3d');

      await page.getByRole('button', { name: '2D Plan', exact: true }).click();
      await page.locator('.konvajs-content canvas').first().waitFor();
      // The phone deliberately collapses the active tool shelf after leaving 3D.
      if (!await page.getByTestId('plan-garden-toggle').isVisible()) await page.getByRole('group', { name: 'Plan tool categories', exact: true }).getByRole('button', { name: 'Build', exact: true }).click();
      await page.getByTestId('plan-garden-toggle').click();
      await page.getByLabel('Landscape element', { exact: true }).selectOption('qa-pool');
      await shot('outdoor-tools-2d');

      await page.getByLabel('Pool construction stage', { exact: true }).selectOption('shell');
      const waterDepth = page.getByLabel('Water depth in metres', { exact: true });
      await waterDepth.fill('1.2'); await waterDepth.press('Tab');
      await expect(page.getByTestId('pool-quantities')).toContainText('Water 21.60 m³');
      expect((await storedSurface('qa-pool')).pool.waterDepthM).toBe(1.2);
      result.checks.push('Water-depth input recalculates 18 m² × 1.2 m = 21.60 m³ and persists');
      await page.getByTestId('pool-quantities').scrollIntoViewIfNeeded();
      await shot('outdoor-pool-details');

      await page.getByLabel('Landscape element', { exact: true }).selectOption('qa-drive');
      await expect(page.getByTestId('outdoor-layer-quantities')).toContainText('Material 1.470 m³');
      await expect(page.getByTestId('outdoor-layer-quantities')).toContainText('Sub-base 4.200 m³');
      await page.getByTestId('outdoor-layer-quantities').scrollIntoViewIfNeeded();
      await shot('outdoor-layer-details');
      result.checks.push('Tarmac layer quantities remain 21 m² × 0.07 m and 21 m² × 0.2 m');
    } catch (error) {
      result.failures.push(String(error));
      await shot('failure').catch(error => result.failures.push(`Failure screenshot: ${error}`));
    } finally { await context.close(); }
  }
} finally {
  await browser.close();
  await writeFile(new URL('report.json', out), JSON.stringify(report, null, 2));
}
console.log(JSON.stringify(report, null, 2));
if (report.cases.some(c => c.failures.length || c.consoleErrors.length || c.pageErrors.length || c.blockedWrites.length)) process.exitCode = 1;
