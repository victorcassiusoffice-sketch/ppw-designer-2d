import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const base = process.env.OLB_QA_URL || 'http://127.0.0.1:5174';
const out = new URL('../docs/outdoor-qa-2026-10-16/', import.meta.url);
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errors = [], reports = [];
for (const width of [1280, 390]) {
  const page = await browser.newPage({ viewport: { width, height: width === 390 ? 844 : 900 }, deviceScaleFactor: 1 });
  page.on('pageerror', e => errors.push(`${width}: ${e.message}`));
  page.on('console', msg => { if (msg.type() === 'error') errors.push(`${width}: ${msg.text()}`); });
  await page.goto(`${base}/demo?view=3d&pitch=1`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.evaluate(async () => {
    const moduleUrl = performance.getEntriesByType('resource').map(r => r.name).filter(n => new URL(n).pathname === '/src/store/propertyStore.ts').at(-1) ?? '/src/store/propertyStore.ts';
    const { usePropertyStore } = await import(moduleUrl);
    const store = usePropertyStore.getState(); store.resetToDefault();
    const surfaces = [
      { id: 'qa-paving', kind: 'path', x: -1, y: 6, widthM: 6, depthM: 3, elevationM: 0, pavingProductId: 'em-ubp-rusclaord001', subBaseDepthM: .15 },
      { id: 'qa-pool', kind: 'pool', x: 6, y: 1, widthM: 6, depthM: 3, elevationM: 0, pool: { shellDepthM: 1.5, waterDepthM: 1.35, wallThicknessM: .2, baseThicknessM: .2, excavationMarginM: .3, stage: 'filled' } },
      { id: 'qa-drive', kind: 'tarmac', x: 5, y: 6, widthM: 7, depthM: 3, elevationM: 0, thicknessM: .07, subBaseDepthM: .2 },
    ];
    store.loadProperty({ ...usePropertyStore.getState().property, garden: { surfaces, fences: [] }, site: { originM: { x: -3, y: -3 }, widthM: 18, depthM: 15 } });
  });
  await page.waitForTimeout(2500);
  const fit = page.getByRole('button', { name: /^Fit$/ }).last();
  if (await fit.count()) await fit.click({ timeout: 3000 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: new URL(`outdoor-filled-3d-${width}.png`, out).pathname.replace(/^\/(\w:)/, '$1'), fullPage: true });
  await page.evaluate(async () => {
    const moduleUrl = performance.getEntriesByType('resource').map(r => r.name).filter(n => new URL(n).pathname === '/src/store/propertyStore.ts').at(-1) ?? '/src/store/propertyStore.ts';
    const { usePropertyStore } = await import(moduleUrl);
    const store = usePropertyStore.getState(), pool = store.property.garden.surfaces.find(s => s.id === 'qa-pool');
    store.updateGardenSurface(pool.id, { pool: { ...pool.pool, stage: 'excavation' } });
  });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: new URL(`outdoor-excavation-3d-${width}.png`, out).pathname.replace(/^\/(\w:)/, '$1'), fullPage: true });
  await page.evaluate(async () => {
    const moduleUrl = performance.getEntriesByType('resource').map(r => r.name).filter(n => new URL(n).pathname === '/src/store/designerUIStore.ts').at(-1) ?? '/src/store/designerUIStore.ts';
    const { useDesignerUIStore } = await import(moduleUrl);
    useDesignerUIStore.getState().setViewMode('plan');
  });
  await page.waitForTimeout(1500);
  await page.evaluate(async () => {
    window.dispatchEvent(new CustomEvent('ppw:open-garden'));
    const moduleUrl = performance.getEntriesByType('resource').map(r => r.name).filter(n => new URL(n).pathname === '/src/store/gardenEditorStore.ts').at(-1) ?? '/src/store/gardenEditorStore.ts';
    const { useGardenEditorStore } = await import(moduleUrl);
    useGardenEditorStore.getState().select('qa-pool');
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: new URL(`outdoor-tools-2d-${width}.png`, out).pathname.replace(/^\/(\w:)/, '$1'), fullPage: true });
  await page.locator('[aria-label="Pool construction stage"]').selectOption('shell');
  const waterDepth = page.locator('[aria-label="Water depth in metres"]');
  await waterDepth.fill('1.2'); await waterDepth.press('Tab');
  await page.locator('[data-testid="pool-quantities"]').scrollIntoViewIfNeeded();
  await page.screenshot({ path: new URL(`outdoor-pool-details-${width}.png`, out).pathname.replace(/^\/(\w:)/, '$1'), fullPage: true });
  const waterText = await page.locator('[data-testid="pool-quantities"]').textContent();
  if (!waterText.includes('21.60')) throw new Error(`Water depth UI did not update measured volume: ${waterText}`);
  await page.locator('[aria-label="Landscape element"]').selectOption('qa-drive');
  await page.locator('[data-testid="outdoor-layer-quantities"]').scrollIntoViewIfNeeded();
  await page.screenshot({ path: new URL(`outdoor-layer-details-${width}.png`, out).pathname.replace(/^\/(\w:)/, '$1'), fullPage: true });
  reports.push({ width, overflow: await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), canvasCount: await page.locator('canvas').count() });
  await page.close();
}
await writeFile(new URL('report.json', out), JSON.stringify({ base, errors, reports }, null, 2));
await browser.close();
console.log(JSON.stringify({ errors, reports }));
if (errors.length) process.exitCode = 1;
