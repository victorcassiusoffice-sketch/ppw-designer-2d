// Explicit browser lease only. Native Site entry and plan drawing; no store/pose
// injection. Later contexts seed only the resulting local saved demo fixture.
import fs from 'node:fs/promises';
import path from 'node:path';
import { TARGETS, OUTPUT, PIN_IP, acquireRun } from './run-config.mjs';
import { chromium } from './lib.mjs';
const expectedSha = process.argv.find(x => x.startsWith('--expected='))?.slice(11);
if (!/^[a-f0-9]{40}$/.test(expectedSha || '')) throw Error('Supply --expected=full-published-SHA.');
await fs.mkdir(OUTPUT, { recursive: false });
acquireRun('site-plan-functional');
const origin = TARGETS.site;
const result = { at: new Date().toISOString(), expectedSha, origin,
  note: 'Functional desktop and touch-viewport emulation, not physical-phone or performance evidence. Concave survey fixture is entered and applied through normal controls. Native plan clicks/taps check notch rejection and inside acceptance. Only local browser storage is seeded for the subsequent saved-data test. Its hydration response is deliberately held/released. Canvas fillText observation forwards the original call unchanged and is used only to observe the actual geographic label; every screenshot still requires visual north-arrow review. All non-GET/HEAD/OPTIONS writes blocked, including hosting writes.',
  visualInspection: 'Pending: inspect every plan screenshot.', rows: [] };
const devices = [{ name: 'laptop', viewport: { width: 1280, height: 800 } }, { name: 'phone', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }];
const browser = await chromium.launch({ headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', `--host-resolver-rules=MAP ${new URL(origin).hostname} ${PIN_IP}`] });
const must = (condition, message) => { if (!condition) throw Error(message); };
const name = 'SITE-R3-CONCAVE';
async function contextFor(device, row, seed, hold = false) {
  const { name: ignored, ...options } = device;
  const context = await browser.newContext({ ...options, serviceWorkers: 'block' });
  row.attemptedWrites = []; row.blockedWrites = []; row.pageErrors = []; row.consoleErrors = []; row.httpErrors = []; row.providerRequests = []; row.implementationRequests = [];
  let release;
  const paused = new Promise(resolve => { release = resolve; });
  let signal;
  const requested = new Promise(resolve => { signal = resolve; });
  context.on('request', request => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method())) row.attemptedWrites.push({ method: request.method(), url: request.url() });
    if (/\/(?:hydration|SiteEntry|SiteMap|maplibre-gl-worker)-/.test(request.url())) row.implementationRequests.push(request.url());
    if (/\/api\/site(?:\/|\?)|openfreemap\.org|photon\.komoot\.io|overpass-api\.de|re\.jrc\.ec\.europa\.eu|elevation-tiles-prod/.test(request.url())) row.providerRequests.push(request.url());
  });
  await context.route('**/*', async route => {
    const request = route.request();
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method())) {
      row.blockedWrites.push({ method: request.method(), url: request.url() });
      return route.abort('blockedbyclient');
    }
    if (hold && /\/hydration-[^/]+\.js(?:\?|$)/.test(request.url())) {
      row.heldHydrationUrl = request.url();
      signal();
      await paused;
    }
    return route.continue();
  });
  await context.addInitScript(seed => {
    for (const [key, value] of Object.entries(seed || {})) localStorage.setItem(key, value);
    localStorage.setItem('ppw_designer_coach_v1', '1');
    window.__sitePlanText = [];
    window.__sitePlanObserveText = true;
    const fill = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (...args) {
      if (window.__sitePlanObserveText && window.__sitePlanText.length < 20000) window.__sitePlanText.push(String(args[0]));
      return Reflect.apply(fill, this, args);
    };
  }, seed);
  const page = await context.newPage();
  page.on('pageerror', error => row.pageErrors.push(String(error)));
  page.on('console', message => { if (message.type() === 'error') row.consoleErrors.push(message.text()); });
  page.on('response', response => { if (response.status() >= 400) row.httpErrors.push({ url: response.url(), status: response.status() }); });
  return { context, page, release, requested };
}
async function activate(locator, device) {
  await locator.scrollIntoViewIfNeeded();
  if (device.hasTouch) await locator.tap(); else await locator.click();
}
async function showPlanTools(page, device) {
  const toggle = page.getByTestId('canvas-chrome-toggle');
  if (await toggle.getAttribute('aria-expanded') !== 'true') await activate(toggle, device);
}
async function health(page) {
  const response = await page.goto(`${origin}/api/healthcheck`, { timeout: 30000 });
  const value = await response.json();
  must(value.env === 'preview' && JSON.stringify(value).includes(expectedSha), 'Exact preview health mismatch.');
  return value;
}
async function property(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('ppw_property_v2')).state.property);
}
async function storage(page) {
  return page.evaluate(() => Object.fromEntries(['ppw_property_v2', 'ppw_properties_v2'].map(key => [key, localStorage.getItem(key)]).filter(([, value]) => value)));
}
async function planEvidence(page) {
  return page.evaluate(() => ({
    capacity: document.querySelector('[data-testid="plot-capacity"]')?.textContent ?? null,
    transform: document.querySelector('[data-testid="plan-drawing-viewport"]')?.getAttribute('data-view-transform'),
    labelDrawCalls: window.__sitePlanText,
    saved: JSON.parse(localStorage.getItem('ppw_property_v2')).state.property.site,
  }));
}
async function drawRoom(page, device, points) {
  const pen = page.getByTestId('wall-tool-toggle');
  if (await pen.getAttribute('aria-pressed') !== 'true') {
    // The phone shelf starts collapsed. Open its visible Build category before
    // selecting Walls, exactly as a user would; never click a hidden control.
    if (!(await pen.isVisible())) {
      await activate(page.getByRole('group', { name: 'Plan tool categories', exact: true })
        .getByRole('button', { name: 'Build', exact: true }), device);
    }
    await activate(pen, device);
  }
  await page.getByTestId('room-draw-close').waitFor({ state: 'visible' });
  // Let the visible drawing dock finish layout before reading screen coordinates;
  // this is functional UI setup, never an input-latency settling period.
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const taps = [];
  for (const point of points) {
    const screen = await page.getByTestId('plan-drawing-viewport').evaluate((element, p) => {
      const rect = element.getBoundingClientRect();
      const { viewport, pxPerMetre } = JSON.parse(element.getAttribute('data-view-transform'));
      return { x: rect.left + viewport.x + p.x * pxPerMetre * viewport.scale, y: rect.top + viewport.y + p.y * pxPerMetre * viewport.scale, rect: { x: rect.left, y: rect.top, width: rect.width, height: rect.height } };
    }, point);
    must(screen.x >= screen.rect.x && screen.x <= screen.rect.x + screen.rect.width && screen.y >= screen.rect.y && screen.y <= screen.rect.y + screen.rect.height, 'Native draw point is outside the visible drawing viewport.');
    taps.push({ world: point, screen });
    if (device.hasTouch) await page.touchscreen.tap(screen.x, screen.y); else await page.mouse.click(screen.x, screen.y);
  }
  must(await page.getByTestId('room-draw-close').isEnabled(), 'Native corner entry did not enable Make room.');
  await activate(page.getByTestId('room-draw-close'), device);
  return taps;
}
async function close(context, row) {
  await context.close();
  row.networkWrites = { attemptedCount: row.attemptedWrites.length, blockedCount: row.blockedWrites.length, transmittedCount: row.attemptedWrites.length - row.blockedWrites.length };
  row.passed = row.passed && row.networkWrites.attemptedCount === 0 && row.pageErrors.length === 0 && row.consoleErrors.length === 0 && row.httpErrors.length === 0 && row.providerRequests.length === 0;
  await fs.writeFile(path.join(OUTPUT, 'plan-projection.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify({ case: row.case, device: row.device, passed: row.passed, error: row.error, networkWrites: row.networkWrites }));
}
try {
  for (const device of devices) {
    const row = { case: 'native-concave-plan', device: device.name, viewport: device.viewport };
    result.rows.push(row);
    const { context, page } = await contextFor(device, row);
    let savedSeed;
    try {
      row.healthBefore = await health(page);
      await page.goto(`${origin}/demo?view=2d&pitch=1&site=1`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.getByRole('button', { name: 'Site from the map', exact: true }).waitFor({ timeout: 45000 });
      row.roomsBefore = JSON.stringify((await property(page)).rooms);
      await activate(page.getByRole('button', { name: 'Site from the map', exact: true }), device);
      await page.locator('.site-workspace').waitFor();
      await page.getByRole('textbox', { name: 'Site name', exact: true }).fill(name);
      await activate(page.getByRole('button', { name: 'From the surveyor’s plan', exact: true }), device);
      await page.getByRole('textbox', { name: 'First corner: longitude, latitude', exact: true }).fill('57.3776792, -20.3292161');
      await page.getByRole('textbox', { name: 'Each line: length in metres, bearing', exact: true }).fill('10,90\n4,180\n6,270\n6,180\n4,270\n10,0');
      await page.getByRole('spinbutton', { name: 'Anchor x (m)', exact: true }).fill('50');
      await page.getByRole('spinbutton', { name: 'Anchor y (m)', exact: true }).fill('50');
      await activate(page.getByRole('button', { name: 'Close traverse & check', exact: true }), device);
      row.siteErrors = await page.locator('.site-error').allTextContents();
      must(row.siteErrors.length === 0, 'Survey traverse validation failed.');
      await page.evaluate(() => { window.__sitePlanText = []; window.__sitePlanObserveText = true; });
      await activate(page.getByRole('button', { name: 'Apply site to plan', exact: true }), device);
      await activate(page.getByRole('button', { name: 'Close Site', exact: true }), device);
      await showPlanTools(page, device);
      await page.getByTestId('plot-capacity').filter({ hasText: 'Plot 64 m²' }).waitFor();
      const fit = page.getByRole('button', { name: 'Fit to view', exact: true });
      if (await fit.isVisible()) await activate(fit, device);
      await page.waitForFunction(name => window.__sitePlanText.join('').includes(name), name);
      row.applied = await planEvidence(page);
      row.roomsUnchangedOnApply = JSON.stringify((await property(page)).rooms) === row.roomsBefore;
      savedSeed = await storage(page);
      must(row.roomsUnchangedOnApply, 'Applying the site moved/changed existing rooms.');
      must(row.applied.saved.world.polygon.length === 6 && row.applied.capacity.includes('Plot 64 m²'), 'Applied canonical concave site/area missing.');
      await page.screenshot({ path: path.join(OUTPUT, `plan-${device.name}.jpg`), type: 'jpeg', quality: 78 });
      const before = await property(page);
      row.outsideTaps = await drawRoom(page, device, [{ x: 57, y: 57 }, { x: 59, y: 57 }, { x: 59, y: 59 }, { x: 57, y: 59 }]);
      await page.getByText('Keep the room inside the plot — or enlarge the land.', { exact: true }).waitFor({ timeout: 8000 });
      row.outsideRejected = JSON.stringify((await property(page)).rooms) === JSON.stringify(before.rooms);
      must(row.outsideRejected, 'The concave notch accepted an off-plot room.');
      row.insideTaps = await drawRoom(page, device, [{ x: 51, y: 51 }, { x: 53, y: 51 }, { x: 53, y: 53 }, { x: 51, y: 53 }]);
      await page.waitForFunction(count => JSON.parse(localStorage.getItem('ppw_property_v2')).state.property.rooms.length > count, before.rooms.length, { timeout: 8000 });
      row.insideAccepted = (await property(page)).rooms.length === before.rooms.length + 1;
      must(row.insideAccepted, 'A valid interior room was not accepted.');
      row.after = await planEvidence(page);
      await page.screenshot({ path: path.join(OUTPUT, `plan-room-${device.name}.jpg`), type: 'jpeg', quality: 78 });
      row.healthAfter = await health(page);
      row.passed = true;
    } catch (error) { row.error = String(error); row.passed = false; }
    finally { await close(context, row); }

    if (!savedSeed) continue;
    for (const key of Object.keys(savedSeed)) {
      const value = JSON.parse(savedSeed[key]);
      const properties = key === 'ppw_property_v2' ? [value.state.property] : Object.values(value.state.designs).map(item => item.property);
      for (const property of properties) property.site = { ...structuredClone(row.applied.saved), world: { ...structuredClone(row.applied.saved.world), round3OpaqueCanary: 'remove only after validation' } };
      savedSeed[key] = JSON.stringify(value);
    }
    const pending = { case: 'saved-world-held-hydration', device: device.name, viewport: device.viewport };
    result.rows.push(pending);
    const held = await contextFor(device, pending, savedSeed, true);
    try {
      pending.healthBefore = await health(held.page);
      await held.page.goto(`${origin}/demo?view=2d&pitch=1`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      let requestTimeout;
      try {
        await Promise.race([held.requested, new Promise((_, reject) => { requestTimeout = setTimeout(() => reject(Error('No deferred hydration request observed within 30 seconds.')), 30000); })]);
      } finally { clearTimeout(requestTimeout); }
      await held.page.getByTestId('plan-drawing-viewport').waitFor({ state: 'visible' });
      await showPlanTools(held.page, device);
      pending.beforeRelease = await planEvidence(held.page);
      must(pending.beforeRelease.capacity === null && pending.beforeRelease.saved.world.round3OpaqueCanary !== undefined, 'Pending world displayed a capacity or was prematurely validated.');
      must(!pending.beforeRelease.labelDrawCalls.join('').includes(name), 'Pending world drew a geographic label.');
      await held.page.screenshot({ path: path.join(OUTPUT, `pending-${device.name}.jpg`), type: 'jpeg', quality: 72 });
      await held.page.evaluate(() => { window.__sitePlanText = []; window.__sitePlanObserveText = true; });
      held.release();
      await held.page.waitForFunction(() => document.querySelector('[data-testid="plot-capacity"]')?.textContent.includes('Plot 64 m²') && JSON.parse(localStorage.getItem('ppw_property_v2')).state.property.site.world.round3OpaqueCanary === undefined, undefined, { timeout: 20000 });
      await held.page.waitForFunction(name => window.__sitePlanText.join('').includes(name), name);
      await held.page.getByTestId('plot-capacity').filter({ hasText: 'Plot 64 m²' }).waitFor();
      pending.afterRelease = await planEvidence(held.page);
      pending.roomsUnchanged = JSON.stringify((await property(held.page)).rooms) === row.roomsBefore;
      must(pending.roomsUnchanged, 'Hydration changed the existing room geometry.');
      await held.page.screenshot({ path: path.join(OUTPUT, `hydrated-${device.name}.jpg`), type: 'jpeg', quality: 78 });
      pending.healthAfter = await health(held.page);
      pending.passed = true;
    } catch (error) { pending.error = String(error); pending.passed = false; }
    finally { held.release(); await close(held.context, pending); }
  }
} catch (error) { result.error = String(error); }
finally {
  await browser.close();
  result.processesClosed = true;
  result.passed = !result.error && result.rows.length === 4 && result.rows.every(row => row.passed);
  await fs.writeFile(path.join(OUTPUT, 'plan-projection.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify({ output: OUTPUT, cases: result.rows.length, passed: result.passed, visualInspection: result.visualInspection }));
  if (!result.passed) process.exitCode = 1;
}
