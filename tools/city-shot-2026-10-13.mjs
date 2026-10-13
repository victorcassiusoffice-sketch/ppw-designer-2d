/** Local headless City Build visual/interaction QA. Never publishes or releases orders.
 * npm run build; npm run preview -- --host 127.0.0.1; node tools/city-shot-2026-10-13.mjs
 * Fresh disposable browser storage per viewport. All city edits use real UI controls.
 */
import { chromium, expect } from '@playwright/test';
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';

const base = process.argv[2] ?? 'http://127.0.0.1:5173';
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw new Error('Local preview only.');
const out = 'docs/qa-city-2026-10-13';
mkdirSync(out, { recursive: true });
const report = {
  date: '2026-10-13', base,
  appBundle: readdirSync('dist/assets').find((file) => /^App-[\w-]+\.js$/.test(file)),
  scope: 'Local City Build screens, dimensions, routes, scenario, reference links and building return. Supplier orders covered separately.',
  cases: [],
};
const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });

async function pixelChange(before, after) {
  const a = await sharp(before).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const b = await sharp(after).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  if (a.info.width !== b.info.width || a.info.height !== b.info.height) return 1;
  let changed = 0;
  for (let i = 0; i < a.data.length; i += 3)
    if (Math.abs(a.data[i] - b.data[i]) + Math.abs(a.data[i + 1] - b.data[i + 1]) + Math.abs(a.data[i + 2] - b.data[i + 2]) > 60) changed++;
  return changed / (a.info.width * a.info.height);
}

try {
  for (const [name, viewport] of [['desktop', { width: 1280, height: 900 }], ['phone', { width: 390, height: 844 }]]) {
    const context = await browser.newContext({ viewport, isMobile: name === 'phone', hasTouch: name === 'phone', deviceScaleFactor: 1 });
    await context.addInitScript(() => {
      if (sessionStorage.getItem('qa-city-seeded')) return;
      localStorage.clear();
      localStorage.setItem('ppw_designer_coach_v1', '1');
      localStorage.setItem('ppw_property_v2', JSON.stringify({ version: 2, state: { pxPerMetre: 70, showGrid: true,
        property: { id: 'qa-city-2026-10-13', name: 'City Build QA', activeRoomId: 'qa-room', wallHeightM: 2.7,
          rooms: [{ id: 'qa-room', name: 'Ground room', polygon: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 8 }, { x: 0, y: 8 }], placedItems: [] }] } } }));
      sessionStorage.setItem('qa-city-seeded', '1');
    });
    const page = await context.newPage(); page.setDefaultTimeout(20000);
    const entry = { viewport: name, dimensions: viewport, captures: [], checks: [], defects: [], consoleErrors: [], pageErrors: [], httpErrors: [], failedRequests: [], writeRequests: [] };
    report.cases.push(entry);
    page.on('console', (message) => { if (message.type() === 'error') entry.consoleErrors.push(message.text()); });
    page.on('pageerror', (error) => entry.pageErrors.push(error.message));
    page.on('response', (response) => { if (response.status() >= 400) entry.httpErrors.push({ url: response.url(), status: response.status() }); });
    page.on('requestfailed', (request) => entry.failedRequests.push({ url: request.url(), failure: request.failure()?.errorText }));
    await page.route('**/api/**', async (route) => {
      if (!['GET', 'HEAD', 'OPTIONS'].includes(route.request().method())) {
        entry.writeRequests.push(route.request().url()); await route.abort(); return;
      }
      await route.continue();
    });
    const city = () => page.getByRole('dialog', { name: 'City Build workspace', exact: true });
    const tab = (label) => city().getByRole('navigation', { name: 'City sections' }).getByRole('button', { name: label, exact: true });
    const snapshot = () => page.evaluate(() => JSON.parse(localStorage.getItem('ppw_property_v2')).state.property);
    const number = async (label, value) => { const field = city().getByLabel(label, { exact: true }); await field.fill(String(value)); await field.press('Tab'); };
    const inspectorTop = () => page.locator('.city-inspector').evaluate((element) => { element.scrollTop = 0; });
    const pageTop = () => page.locator('.city-page').evaluate((element) => { element.scrollTop = 0; });
    const dismissMessage = async () => { const button = city().getByRole('button', { name: 'Dismiss city message' }); if (await button.count()) await button.click(); };
    async function shot(suffix) {
      await page.waitForTimeout(200);
      const file = `${out}/city-${name}-${suffix}.png`;
      await page.screenshot({ path: file, timeout: 60000 }); entry.captures.push(file);
      const layout = await page.evaluate(() => {
        const root = document.querySelector('.city-workspace');
        const panes = [...document.querySelectorAll('.city-page,.city-inspector,.city-viewport')].map((element) => ({ name: element.className, width: element.clientWidth, scrollWidth: element.scrollWidth, height: element.clientHeight, scrollHeight: element.scrollHeight }));
        const headerClips = [...document.querySelectorAll('.city-header button,.city-tabs button,.city-tools button')].filter((element) => { const b = element.getBoundingClientRect(); return b.width > 0 && (b.left < -1 || b.right > innerWidth + 1); }).map((element) => element.textContent.trim());
        const canvasPane = document.querySelector('.city-viewport')?.getBoundingClientRect();
        const sceneCaptionClips = [...document.querySelectorAll('.city-three-view__label,.city-three-view__help')].filter((element) => { const b = element.getBoundingClientRect(); return b.width > 0 && canvasPane && (b.top < canvasPane.top || b.bottom > canvasPane.bottom); }).map((element) => element.textContent.trim());
        return { width: innerWidth, pageWidth: document.documentElement.scrollWidth, workspaceWidth: root?.scrollWidth, panes, headerClips, sceneCaptionClips };
      });
      entry.checks.push({ screen: suffix, layout });
      if (layout.pageWidth > layout.width + 1 || layout.workspaceWidth > layout.width + 1 || layout.headerClips.length || layout.sceneCaptionClips.length || layout.panes.some((pane) => pane.scrollWidth > pane.width + 1 || (pane.name === 'city-viewport' && pane.scrollHeight > pane.height + 1))) entry.defects.push({ screen: suffix, viewportOverflow: layout });
    }
    async function world(x, y) {
      const point = await page.getByTestId('city-plan').evaluate((svg, value) => { const p = new DOMPoint(value.x, value.y).matrixTransform(svg.getScreenCTM()); return { x: p.x, y: p.y }; }, { x, y });
      if (name === 'phone') await page.touchscreen.tap(point.x, point.y); else await page.mouse.click(point.x, point.y);
    }
    async function selectElement(label) {
      const summary = city().getByText('Site elements', { exact: true });
      if (!(await summary.locator('..').getAttribute('open'))) {
        const opened = await summary.locator('..').evaluate((element) => element.open);
        if (!opened) await summary.click();
      }
      await page.locator('.city-element-list').getByRole('button', { name: label, exact: true }).click();
      await inspectorTop();
    }
    try {
      await page.goto(`${base}/designer?panel=city`, { waitUntil: 'networkidle' });
      await expect(city()).toBeVisible(); await shot('entry');
      await city().getByRole('button', { name: 'Try an eco district', exact: true }).click();
      await shot('sample-message');
      await dismissMessage(); await inspectorTop(); await shot('plan-2d');
      expect((await snapshot()).city.assets.length).toBeGreaterThanOrEqual(8);

      await city().getByRole('button', { name: '3D', exact: true }).click();
      const canvas = page.getByTestId('city-three-view').locator('canvas');
      await expect(canvas).toBeVisible(); await page.waitForTimeout(800); await shot('plan-3d');
      await city().getByRole('button', { name: 'Select / pan', exact: true }).click();
      await expect(canvas).toBeVisible();
      entry.checks.push({ action: 'Select / pan stays in 3D', passed: true });
      const box = await canvas.boundingBox();
      const beforeGesture = await canvas.screenshot();
      if (name === 'phone') {
        const cdp = await context.newCDPSession(page), x = box.x + box.width * .5, y = box.y + box.height * .5;
        const contacts = (spread, dx) => [{ x: x - spread + dx, y, id: 1 }, { x: x + spread + dx, y, id: 2 }];
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: contacts(28, 0) });
        for (let i = 1; i <= 8; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: contacts(28 + i * 6, i * 2) });
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await cdp.detach();
      } else {
        await page.mouse.move(box.x + box.width * .5, box.y + box.height * .5);
        await page.mouse.wheel(0, -450);
        await page.mouse.move(box.x + box.width * .55, box.y + box.height * .5); await page.mouse.down({ button: 'right' });
        await page.mouse.move(box.x + box.width * .61, box.y + box.height * .53, { steps: 8 }); await page.mouse.up({ button: 'right' });
      }
      await page.waitForTimeout(700);
      const beforeSelection = await canvas.screenshot();
      const gestureChange = await pixelChange(beforeGesture, beforeSelection);
      expect(gestureChange).toBeGreaterThan(.02);
      entry.checks.push({ action: 'Zoom/pan visibly changes the scene', changedPixelFraction: gestureChange });
      await selectElement('PV field — planning envelope'); await page.waitForTimeout(500);
      const selectionChange = await pixelChange(beforeSelection, await canvas.screenshot());
      expect(selectionChange).toBeLessThan(.08);
      entry.checks.push({ action: 'Zoomed/panned 3D view survives element selection', changedPixelFraction: selectionChange, method: name === 'phone' ? 'Two-finger pinch/pan through Chromium touch events' : 'Wheel zoom and right-drag pan' });
      await shot('3d-selected');
      const beforeModel = await canvas.screenshot();
      await number('Array capacity (kWp)', 36); await page.waitForTimeout(400);
      const modelChange = await pixelChange(beforeModel, await canvas.screenshot());
      expect(modelChange).toBeLessThan(.02);
      entry.checks.push({ action: '3D camera survives non-geometric model update', changedPixelFraction: modelChange });
      // Sky click outside all measured envelopes clears the inspector without moving the camera.
      await canvas.click({ position: { x: 12, y: 55 } });
      await expect(city().getByLabel('City item name', { exact: true })).toHaveCount(0);
      entry.checks.push({ action: 'Empty-space click dismisses selection', passed: true });
      await page.waitForTimeout(250);
      const beforeTabs = await canvas.screenshot();
      await canvas.evaluate((element) => { element.dataset.qaCityInstance = 'camera-retained'; });
      await tab('Infrastructure').click(); await tab('Overview').click(); await tab('Plan').click();
      await expect(canvas).toBeVisible();
      await expect(canvas).toHaveAttribute('data-qa-city-instance', 'camera-retained');
      await page.waitForTimeout(450);
      const tabsChange = await pixelChange(beforeTabs, await canvas.screenshot());
      expect(tabsChange).toBeLessThan(.02);
      entry.checks.push({ action: 'Infrastructure and Overview navigation preserve the existing 3D canvas and camera', changedPixelFraction: tabsChange });
      await shot('3d-return-from-sections');
      await city().getByRole('button', { name: 'Fit city', exact: true }).click();

      await city().getByRole('button', { name: '2D', exact: true }).click();
      await city().getByRole('button', { name: 'Draw road', exact: true }).click();
      await world(-10, 155); await world(55, 155);
      await city().getByRole('button', { name: 'Finish route', exact: true }).click();
      await number('Road width (m)', 4); await number('Surface depth (m)', .08); await number('Base depth (m)', .25);
      await inspectorTop(); await shot('road-section');
      const drawnRoad = (await snapshot()).city.roads.at(-1);
      expect(drawnRoad).toMatchObject({ widthM: 4, surfaceDepthM: .08, baseDepthM: .25, points: [{ x: -10, y: 155 }, { x: 55, y: 155 }] });
      entry.checks.push({ action: 'Two-point road drawn and measured section persisted', road: drawnRoad });

      await city().getByRole('button', { name: 'Draw utility', exact: true }).click();
      await city().getByLabel('Utility system', { exact: true }).selectOption('water');
      await world(-10, 100); await world(60, 100);
      await city().getByRole('button', { name: 'Finish route', exact: true }).click();
      await number('Outside diameter (mm)', 110); await number('Trench depth (m)', 1.6);
      const routeDetails = city().locator('details').filter({ hasText: 'Route coordinates & elevations' });
      await routeDetails.locator('summary').click();
      await number('Point 1 elevation', -.6); await number('Point 2 elevation', -1.1);
      await inspectorTop(); await shot('utility-route');
      await routeDetails.scrollIntoViewIfNeeded(); await shot('utility-elevations');
      const drawnNetwork = (await snapshot()).city.networks.at(-1);
      expect(drawnNetwork.diameterMm).toBe(110); expect(drawnNetwork.points[0].z).toBe(-.6); expect(drawnNetwork.points[1].z).toBe(-1.1);
      entry.checks.push({ action: 'Utility route retains physical diameter and surveyed elevations', network: drawnNetwork, routeLengthM: Math.hypot(70, .5) });

      await tab('Data centre').click();
      for (const [label, value] of [['Racks', 20], ['kW per rack', 5], ['IT utilisation (%)', 50], ['PUE target', 1.4], ['Operating hours / year', 8760], ['Dedicated PV (kWp)', 60], ['PV yield (kWh/kWp/year)', 1400], ['Dedicated battery (kWh)', 100], ['Usable battery (%)', 80]]) await number(label, value);
      await city().getByLabel('Include specified water-use intensity', { exact: true }).check();
      await number('WUE (L per IT kWh)', .5); await city().getByRole('button', { name: 'Save scenario', exact: true }).click();
      await pageTop(); await shot('data-centre-inputs');
      const data = (await snapshot()).city.dataCentre;
      expect(data).toMatchObject({ racks: 20, kWPerRack: 5, utilisation: .5, pue: 1.4, annualHours: 8760, pvKWp: 60, yieldKWhPerKWp: 1400, batteryKWh: 100, batteryUsableFraction: .8, wueLPerKWh: .5 });
      const metrics = page.locator('.city-data-layout .city-metrics');
      await expect(metrics).toContainText('70 kW'); await expect(metrics).toContainText('613.2 MWh'); await expect(metrics).toContainText('84 MWh'); await expect(metrics).toContainText('219 m³/year');
      await metrics.scrollIntoViewIfNeeded(); await shot('data-centre-results');
      entry.checks.push({ action: 'Scenario values agree with independent arithmetic', averageItKW: 50, averageFacilityKW: 70, annualFacilityMWh: 613.2, annualPVMWh: 84, annualWaterM3: 219, autonomyHours: 80 / 70 });

      await tab('Plan').click(); await selectElement('PV field — planning envelope');
      const beforeRef = (await snapshot()).city.assets.find((asset) => asset.id === 'city-solar');
      await city().getByRole('button', { name: '3D', exact: true }).click(); await expect(canvas).toBeVisible(); await page.waitForTimeout(450);
      await tab('Infrastructure').click(); await city().getByLabel('Infrastructure category', { exact: true }).selectOption('solar');
      await pageTop(); await shot('infrastructure-solar');
      const referenceCard = page.locator('.city-catalog article').filter({ has: page.getByRole('heading', { name: 'Hybrid solar PV and storage', exact: true }) });
      await expect(referenceCard.getByRole('link', { name: 'Supplier source ↗' })).toHaveAttribute('href', 'https://reneworld.mu/solar-power-solutions/');
      await referenceCard.getByRole('button', { name: 'Link selected item', exact: true }).click();
      const afterRef = (await snapshot()).city.assets.find((asset) => asset.id === 'city-solar');
      expect(afterRef).toEqual({ ...beforeRef, supplierRef: 'reneworld-hybrid-pv' });
      await expect(canvas).toBeVisible(); await shot('supplier-message-3d');
      await dismissMessage(); await inspectorTop(); await shot('supplier-linked');
      entry.checks.push({ action: 'Verified reference attaches without changing measured envelope', supplierRef: afterRef.supplierRef, widthM: afterRef.widthM, lengthM: afterRef.lengthM, heightM: afterRef.heightM });

      await tab('Overview').click(); await pageTop(); await shot('overview');
      await city().getByRole('heading', { name: 'Design review', exact: true }).scrollIntoViewIfNeeded(); await shot('overview-review');
      await city().getByRole('button', { name: 'Back to building', exact: true }).click();
      await expect(city()).toHaveCount(0); await shot('back-to-building');
      const saved = await snapshot(); expect(saved.rooms[0].polygon).toHaveLength(4); expect(saved.city.roads).toHaveLength(3);
      await page.getByRole('button', { name: 'City Build', exact: true }).first().click();
      await expect(city()).toBeVisible(); expect((await snapshot()).city.assets.find((asset) => asset.id === 'city-solar').supplierRef).toBe('reneworld-hybrid-pv');
      await shot('reopened');
      expect(entry.writeRequests).toHaveLength(0);
      entry.checks.push({ action: 'Building return/re-entry preserves room and city; no API writes', passed: true });
    } catch (error) {
      entry.defects.push({ exception: error.message });
      await page.screenshot({ path: `${out}/city-${name}-failure.png`, timeout: 60000 }).catch(() => {});
    } finally {
      await context.close();
      writeFileSync(`${out}/city-browser-results.json`, JSON.stringify(report, null, 2));
    }
  }
} finally { await browser.close(); }
report.pass = report.cases.every((test) => !test.defects.length && !test.consoleErrors.length && !test.pageErrors.length && !test.writeRequests.length);
writeFileSync(`${out}/city-browser-results.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ pass: report.pass, cases: report.cases.map((test) => ({ viewport: test.viewport, screenshots: test.captures.length, defects: test.defects, consoleErrors: test.consoleErrors, pageErrors: test.pageErrors, httpErrors: test.httpErrors, failedRequests: test.failedRequests, writeRequests: test.writeRequests })) }, null, 2));
if (!report.pass) process.exitCode = 1;
