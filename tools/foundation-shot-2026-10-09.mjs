/** Local release QA. No publishing, checkout, merchant writes or paid calls.
 * node tools/foundation-shot-2026-10-09.mjs [http://127.0.0.1:5173]
 * A small measured house is seeded; excavation, fill and service routes are
 * created through actual UI clicks and inputs, never directly in the store.
 */
import { chromium, expect } from '@playwright/test';
import { mkdirSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
const BASE = process.argv[2] ?? 'http://127.0.0.1:5173';
if (!['127.0.0.1', 'localhost'].includes(new URL(BASE).hostname)) throw new Error('Local preview only.');
const OUT = 'docs/qa-2026-10-09'; mkdirSync(OUT, { recursive: true });
const build = readFileSync('tools/_scratch/build-oct9-final.log', 'utf8');
if (!build.includes('built in')) throw new Error('The latest production build has not completed successfully.');
const report = { date: '2026-10-09', completedDate: new Intl.DateTimeFormat('en-CA', { timeZone: 'Indian/Mauritius' }).format(new Date()), base: BASE, build: 'npm run build completed before capture', appBundle: readdirSync('dist/assets').find(name => /^App-[\w-]+\.js$/.test(name)), seed: '10 × 8 m ground room; all foundation/service changes made through UI', cases: [] };
const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  for (const [name, viewport] of [['desktop', { width: 1280, height: 900 }], ['phone', { width: 390, height: 844 }]]) {
    const context = await browser.newContext({ viewport, hasTouch: name === 'phone', isMobile: name === 'phone', deviceScaleFactor: 1 });
    await context.addInitScript(() => {
      if (sessionStorage.getItem('qa-foundation-seeded')) return;
      localStorage.clear(); localStorage.setItem('ppw_designer_coach_v1', '1');
      localStorage.setItem('ppw_property_v2', JSON.stringify({ version: 2, state: { pxPerMetre: 70, showGrid: true,
        property: { id: 'qa-foundation-2026-10-09', name: 'Foundation & services study', activeRoomId: 'qa-room', wallHeightM: 2.7,
          rooms: [{ id: 'qa-room', name: 'Ground room', polygon: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 8 }, { x: 0, y: 8 }], placedItems: [] }] } } }));
      sessionStorage.setItem('qa-foundation-seeded', '1');
    });
    const page = await context.newPage(); page.setDefaultTimeout(15000);
    const entry = { viewport: name, dimensions: viewport, consoleErrors: [], pageErrors: [], failedRequests: [], httpErrors: [], captures: [], checks: [], defects: [] };
    report.cases.push(entry);
    page.on('console', message => { if (message.type() === 'error') entry.consoleErrors.push(message.text()); });
    page.on('pageerror', error => entry.pageErrors.push(error.message));
    page.on('requestfailed', request => entry.failedRequests.push({ url: request.url(), failure: request.failure()?.errorText }));
    page.on('response', response => { if (response.status() >= 400) entry.httpErrors.push({ url: response.url(), status: response.status() }); });
    const snapshot = () => page.evaluate(() => JSON.parse(localStorage.getItem('ppw_property_v2')).state.property);
    const shot = async (suffix) => {
      await page.waitForTimeout(350);
      const file = `${OUT}/${name}-${suffix}.png`; await page.screenshot({ path: file }); entry.captures.push(file);
      const overflow = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth,
        headerClips: [...document.querySelectorAll('.foundation-header button,.foundation-header select,.services-header button,.services-header select')]
          .map(el => ({ text: el.getAttribute('aria-label') ?? el.textContent.trim(), box: el.getBoundingClientRect() }))
          .filter(item => item.box.width > 0 && (item.box.left < -1 || item.box.right > innerWidth + 1)).map(item => item.text) }));
      const priceFree = !/(?:£\s*\d|\d[\d,.]*\s*MUR)/.test(await page.locator('body').innerText());
      entry.checks.push({ screen: suffix, horizontalOverflow: overflow.scrollWidth > overflow.width + 1, clippedHeaderControls: overflow.headerClips, priceFree });
      if (overflow.scrollWidth > overflow.width + 1 || overflow.headerClips.length) entry.defects.push({ screen: suffix, overflow });
      if (!priceFree) entry.defects.push({ screen: suffix, priceFree });
    };
    const world = async (selector, x, y) => {
      const point = await page.locator(selector).evaluate((svg, xy) => {
        const p = new DOMPoint(xy.x, xy.y).matrixTransform(svg.getScreenCTM()); return { x: p.x, y: p.y };
      }, { x, y });
      if (name === 'phone') await page.touchscreen.tap(point.x, point.y); else await page.mouse.click(point.x, point.y);
    };
    const dimension = async (label, value) => { const field = page.getByLabel(label, { exact: true }); await field.fill(String(value)); await field.press('Tab'); };
    const showFoundationSection = async (target) => {
      await target.evaluate(element => {
        const pane = element.closest('.foundation-details');
        pane.scrollTop += element.getBoundingClientRect().top - pane.getBoundingClientRect().top - 14;
      });
    };
    try {
      await page.goto(`${BASE}/designer?panel=foundation&pitch=1`, { waitUntil: 'networkidle' });
      await expect(page.getByRole('dialog', { name: 'Foundation design' })).toBeVisible();
      await page.getByRole('button', { name: 'Slab / raft', exact: true }).click();
      await world('[aria-label="Scaled foundation plan"]', 0, 0); await world('[aria-label="Scaled foundation plan"]', 10, 8);
      await dimension('Excavation depth m', 1.5); await dimension('Concrete depth m', .3);
      await page.getByLabel('Concrete product reference').selectOption('premix-classics');
      await expect(page.locator('.foundation-pending')).toContainText('24 m³');
      const hole = (await snapshot()).foundation.elements[0];
      expect(hole.excavation.stage).toBe('excavated'); expect(hole.topElevationM).toBeCloseTo(-1.2);
      entry.checks.push({ action: 'Draw hole and set measured dimensions', excavationM3: hole.lengthM * hole.widthM * hole.excavation.depthM, plannedConcreteM3: hole.lengthM * hole.widthM * hole.depthM });
      await page.locator('.foundation-details').evaluate(el => { el.scrollTop = 0; }); await shot('foundation-hole');
      await page.getByRole('button', { name: '3D foundation', exact: true }).click();
      await expect(page.getByTestId('wallpaint-3d-overlay')).toBeVisible();
      await page.getByRole('button', { name: 'Fit', exact: true }).last().click();
      await page.waitForTimeout(1400); await shot('foundation-hole-3d');
      entry.checks.push({ action: '3D renderer', canvases: await page.locator('canvas[data-shading]').evaluateAll(els => els.map(el => ({ shading: el.dataset.shading, width: el.width, height: el.height }))) });
      await page.locator('.house-rail .foundation-launch').click();
      await page.getByRole('button', { name: 'Add concrete', exact: true }).click();
      expect((await snapshot()).foundation.elements[0].excavation.stage).toBe('filled');
      await expect(page.locator('.foundation-pending')).toHaveCount(0); await shot('foundation-filled');
      const rebarSummary = page.getByText('Rebar schedule', { exact: true });
      await rebarSummary.click(); await showFoundationSection(rebarSummary); await shot('foundation-rebar');
      if (name === 'phone') {
        await showFoundationSection(page.getByLabel('Bar diameter mm').locator('..'));
        await shot('foundation-rebar-dimensions');
      }
      await showFoundationSection(page.getByLabel('Supply method').locator('..'));
      await shot('foundation-concrete-reference');
      await page.getByLabel('Supply method').selectOption('site-mix');
      await dimension('Sand parts', 2.5);
      expect((await snapshot()).materials.concrete.sand).toBe(2.5);
      expect((await snapshot()).foundation.elements[0].depthM).toBe(.3);
      await showFoundationSection(page.getByText('Loose dry-volume parts;', { exact: false }));
      await shot('foundation-concrete-ratio');
      entry.checks.push({ action: 'Concrete ratio input persisted without changing measured foundation thickness', sandParts: 2.5, depthM: .3 });
      await page.getByLabel('Supply method').selectOption('ready-mix');
      await page.getByRole('button', { name: '3D foundation', exact: true }).click();
      await expect(page.getByTestId('wallpaint-3d-overlay')).toBeVisible(); await page.waitForTimeout(1100); await shot('foundation-filled-3d');
      await page.locator('.house-rail .foundation-launch').click();
      await page.getByLabel('Return to floor', { exact: true }).selectOption('ground');
      await expect(page.getByRole('dialog', { name: 'Foundation design' })).toHaveCount(0);
      await expect(page.getByTestId('wallpaint-3d-overlay')).toBeVisible(); await shot('foundation-floor-exit');
      entry.checks.push({ action: 'Same-floor exit from Foundation restores 3D', passed: true });

      await page.locator('.house-floor-picker').getByRole('button', { name: 'Plumbing & Electric', exact: true }).click();
      await expect(page.getByRole('dialog', { name: 'Plumbing & Electric', exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'Mains tap', exact: true }).click(); await world('[aria-label="Scaled services floor plan"]', 1, 1);
      await page.getByRole('button', { name: 'Sink', exact: true }).click(); await world('[aria-label="Scaled services floor plan"]', 8, 6);
      await page.getByRole('button', { name: 'Electrical board', exact: true }).click(); await world('[aria-label="Scaled services floor plan"]', 1, 6);
      const fixtures = (await snapshot()).services.fixtures, mains = fixtures.find(f => f.kind === 'mains-tap'), sink = fixtures.find(f => f.kind === 'sink');
      await page.getByRole('button', { name: 'Cold water', exact: true }).click();
      await page.locator(`[data-fixture-id="${mains.id}"][data-service-port="cold-water"]`).click();
      await world('[aria-label="Scaled services floor plan"]', 4, 1);
      await page.locator(`[data-fixture-id="${sink.id}"][data-service-port="cold-water"]`).click();
      await page.getByRole('button', { name: 'Finish run', exact: true }).click();
      const run = (await snapshot()).services.runs[0];
      expect(run.startConnection.fixtureId).toBe(mains.id); expect(run.endConnection.fixtureId).toBe(sink.id);
      entry.checks.push({ action: 'Draw mains-to-sink route via actual port clicks', start: run.startConnection, end: run.endConnection, points: run.points });
      await shot('services-route');
      await page.getByLabel('Services tools').getByRole('button', { name: 'Select', exact: true }).click();
      await page.locator('.services-products > summary').click();
      await page.locator('.services-products article').first().scrollIntoViewIfNeeded(); await shot('services-products');
      entry.checks.push({ action: 'Measured product cards available', count: await page.locator('.services-products article').count() });
      await page.getByLabel('Return to floor', { exact: true }).selectOption('ground');
      await expect(page.getByRole('dialog')).toHaveCount(0); await expect(page.getByTestId('wallpaint-3d-overlay')).toBeVisible();
      await shot('services-floor-exit'); entry.checks.push({ action: 'Same-floor exit from Services restores 3D', passed: true });
    } catch (error) {
      entry.defects.push({ exception: error.message });
      await page.screenshot({ path: `${OUT}/${name}-foundation-services-failure.png` });
    }
    entry.consoleErrorCount = entry.consoleErrors.length; entry.pageErrorCount = entry.pageErrors.length;
    await context.close();
    writeFileSync(`${OUT}/foundation-services-report.json`, JSON.stringify(report, null, 2));
  }
} finally { await browser.close(); }
report.pass = report.cases.every(test => !test.defects.length && !test.consoleErrors.length && !test.pageErrors.length);
writeFileSync(`${OUT}/foundation-services-report.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ pass: report.pass, cases: report.cases.map(test => ({ viewport: test.viewport, captures: test.captures.length, defects: test.defects, consoleErrors: test.consoleErrors, pageErrors: test.pageErrors, networkFailures: test.failedRequests.length, httpErrors: test.httpErrors.length })) }, null, 2));
process.exitCode = report.pass ? 0 : 1;
