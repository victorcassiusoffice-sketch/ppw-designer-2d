// Site seven-case preview campaign (ported from GPT's work/site-qa/finish-preview.mjs).
// Usage: node tools/world/site-preview.mjs [target] --expected=<40-hex sha> --label=<unique>
import fs from 'node:fs/promises';
import { TARGETS, OUTPUT, PIN_IP, acquireRun } from './run-config.mjs';
import { chromium } from './lib.mjs';

const target = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'site';
const origin = TARGETS[target];
const expectedSha = process.argv.find(a => a.startsWith('--expected='))?.slice(11);
if (!/^[a-f0-9]{40}$/.test(expectedSha ?? '')) throw new Error('Pass --expected=<exact published 40-character SHA>.');
const output = OUTPUT;
await fs.mkdir(output, { recursive: true });
acquireRun('site-preview');
const browser = await chromium.launch({ headless: true, args: [`--host-resolver-rules=MAP ${new URL(origin).hostname} ${PIN_IP}`] });
const result = { at: new Date().toISOString(), origin, expectedSha, note: 'Normal preview with no access code. Headless desktop/touch viewport on laptop, not a physical phone. All non-GET/HEAD/OPTIONS network requests are intercepted and blocked; service workers are disabled. Live provider responses are not substituted. One separately labelled production-env negative test substitutes only healthcheck JSON. Two labelled initial-focus cases deliberately delay the SiteEntry JavaScript response.', rows: [] };
const guards = new WeakMap(), allGuards = [];
const modes = [{ name: 'laptop', viewport: { width: 1280, height: 800 } }, { name: 'phone', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }];
const providerPattern = /\/api\/site(?:\/|\?)|openfreemap\.org|photon\.komoot\.io|overpass-api\.de|re\.jrc\.ec\.europa\.eu|elevation-tiles-prod/;
const implementationPattern = /\/(?:SiteEntry|SiteMap|hydration|maplibre-gl-worker)-/;
function observe(page, row) {
  row.pageErrors = []; row.consoleErrors = []; row.httpErrors = []; row.providerRequests = []; row.implementationRequests = [];
  page.on('pageerror', error => row.pageErrors.push(error.message));
  page.on('console', msg => { if (msg.type() === 'error') row.consoleErrors.push(msg.text()); });
  page.on('response', response => { if (response.status() >= 400) row.httpErrors.push({ url: response.url(), status: response.status() }); });
  page.on('request', request => {
    if (providerPattern.test(request.url())) row.providerRequests.push(request.url());
    if (implementationPattern.test(request.url())) row.implementationRequests.push(request.url());
  });
}
async function contextFor(device, seed) {
  const { name, ...options } = device;
  const context = await browser.newContext({ ...options, serviceWorkers: 'block' });
  const guard = { attempted: [], blocked: [] };
  guards.set(context, guard); allGuards.push(guard);
  context.on('request', request => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method()))
      guard.attempted.push({ method: request.method(), url: request.url() });
  });
  await context.route('**/*', async route => {
    const request = route.request();
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method())) {
      guard.blocked.push({ method: request.method(), url: request.url() });
      await route.abort('blockedbyclient');
    } else await route.continue();
  });
  await context.addInitScript(storage => {
    for (const [key, value] of Object.entries(storage || {})) localStorage.setItem(key, value);
    localStorage.setItem('ppw_designer_coach_v1', '1');
  }, seed);
  return context;
}
async function closeContext(context, row) {
  await context.close();
  const guard = guards.get(context);
  row.networkWrites = { attemptedCount: guard.attempted.length, blockedCount: guard.blocked.length, transmittedCount: guard.attempted.length-guard.blocked.length, attempted: guard.attempted };
  row.passed = row.passed && row.networkWrites.attemptedCount === 0;
  console.log(JSON.stringify({ case: row.case, device: row.device, passed: row.passed, writes: row.networkWrites.attemptedCount, error: row.error }));
}
async function geometry(page, selector) {
  return page.locator(selector).evaluateAll(elements => elements.map(element => {
    const r = element.getBoundingClientRect();
    const clip = element.closest('.site-scroll')?.getBoundingClientRect();
    return { text: element.textContent, href: element.getAttribute('href'), x: r.x, y: r.y, width: r.width, height: r.height, visible: r.width > 0 && r.height > 0 && r.left >= 0 && r.right <= innerWidth && r.top >= (clip?.top || 0) && r.bottom <= Math.min(innerHeight, clip?.bottom || innerHeight) };
  }));
}
async function open(page, query) {
  await page.goto(`${origin}/demo?view=2d&pitch=1&site=1${query}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.getByRole('button', { name: 'Site from the map', exact: true }).click({ timeout: 45000 });
  await page.locator('.site-workspace').waitFor({ timeout: 30000 });
}
async function checkedReport(page) {
  return page.locator('.site-report').evaluate(report => {
    const metrics = [...report.querySelectorAll('.site-metric')].map(metric => ({
      label: metric.querySelector('dt')?.textContent,
      value: metric.querySelector('dd')?.textContent,
      source: metric.querySelector('.site-source')?.textContent,
    }));
    return {
      metrics,
      everyNumberTagged: metrics.length >= 20 && metrics.every(metric => ['drawn','typed what-if','public data','survey','unavailable'].includes(metric.source)),
      banners: [...report.querySelectorAll('.site-banner')].map(banner => banner.textContent),
      overflowPx: Math.max(0, document.documentElement.scrollWidth-innerWidth),
    };
  });
}
async function cornerValues(page) {
  return page.locator('.site-coordinate-row').evaluateAll(rows => rows.map(row => [...row.querySelectorAll('input')].map(input => input.value)));
}
try {
  const healthContext = await contextFor(modes[0]);
  const healthPage = await healthContext.newPage();
  const response = await healthPage.goto(`${origin}/api/healthcheck`, { timeout: 30000 });
  result.healthcheck = await response.json();
  if (result.healthcheck.env !== 'preview' || !JSON.stringify(result.healthcheck).includes(expectedSha)) throw Error('Preview healthcheck does not match the requested commit/environment.');
  await healthContext.close();
  for (const device of modes) {
    const context = await contextFor(device), page = await context.newPage();
    const row = { case: 'delayed-initial-entry-focus', device: device.name, viewport: device.viewport, note: 'SiteEntry JavaScript is deliberately held until after Escape; app state is read only. Diagnostic keyboard listener records propagation without editing the design.' };
    result.rows.push(row); observe(page, row);
    let release;
    const held = new Promise(resolve => { release = resolve; });
    row.delayedEntryRequests = 0;
    await page.route('**/assets/SiteEntry-*.js', async route => {
      row.delayedEntryRequests++;
      await held;
      await route.continue();
    });
    try {
      await page.goto(`${origin}/demo?view=2d&pitch=1&site=1&live=1`, { waitUntil: 'networkidle', timeout: 60000 });
      const snapshot = await page.evaluate(() => {
        window.__siteQaBackgroundKeys = 0;
        document.addEventListener('keydown', () => { window.__siteQaBackgroundKeys++; });
        return { view: document.querySelector('.designer-app')?.getAttribute('data-view'), rooms: JSON.stringify(JSON.parse(localStorage.getItem('ppw_property_v2')).state.property.rooms) };
      });
      await page.getByRole('button', { name: 'Site from the map', exact: true }).click();
      const waiting = page.getByRole('dialog', { name: 'Opening Site', exact: true });
      await waiting.waitFor();
      row.dialogBox = await waiting.boundingBox();
      row.loadingMessage = await waiting.innerText();
      row.focusedCancel = await page.evaluate(() => document.activeElement?.textContent === 'Cancel');
      row.backgroundInert = await page.locator('#root').evaluate(node => node.hasAttribute('inert'));
      const control = page.locator('button[aria-label="3D House"]').first();
      const box = await control.boundingBox();
      row.backgroundClickAttempted = !!box;
      if (box) {
        if (device.hasTouch) await page.touchscreen.tap(box.x+box.width/2, box.y+box.height/2);
        else await page.mouse.click(box.x+box.width/2, box.y+box.height/2);
      }
      await page.keyboard.press('Delete');
      row.backgroundKeysReceived = await page.evaluate(() => window.__siteQaBackgroundKeys);
      row.backgroundUnchanged = await page.evaluate(snapshot => snapshot.view === document.querySelector('.designer-app')?.getAttribute('data-view') && snapshot.rooms === JSON.stringify(JSON.parse(localStorage.getItem('ppw_property_v2')).state.property.rooms), snapshot);
      await page.screenshot({ path: `${output}/loading-${device.name}.jpg`, type: 'jpeg', quality: 72 });
      await page.keyboard.press('Escape');
      row.closedOnEscape = await waiting.count() === 0;
      row.inertRestored = await page.locator('#root').evaluate(node => !node.hasAttribute('inert'));
      row.focusRestored = await page.evaluate(() => document.activeElement?.getAttribute('aria-label') === 'Site from the map');
      release();
      await page.waitForTimeout(500);
      row.workspaceAfterCancel = await page.locator('.site-workspace').count();
      row.passed = row.delayedEntryRequests > 0 && row.dialogBox?.width > 0 && row.dialogBox?.height > 0 && row.focusedCancel && row.backgroundInert && row.backgroundKeysReceived === 0 && row.backgroundUnchanged && row.closedOnEscape && row.inertRestored && row.focusRestored && row.workspaceAfterCancel === 0 && row.providerRequests.length === 0 && row.pageErrors.length === 0;
    } catch(error) { row.error = String(error); row.passed = false; }
    finally { release(); await closeContext(context, row); }
  }
  for (const device of modes) {
    const context = await contextFor(device), page = await context.newPage();
    const row = { case: 'live-map', device: device.name, viewport: device.viewport };
    result.rows.push(row); observe(page, row);
    try {
      await open(page, '&live=1');
      await page.locator('.maplibregl-canvas').waitFor({ timeout: 30000 });
      await page.waitForTimeout(2500);
      row.previewModeNote = await page.locator('.site-sample-note').allTextContents();
      row.searchRequestsBeforeTyping = row.providerRequests.filter(u => /\/api\/site\/search/.test(u)).length;
      await page.getByRole('textbox', { name: 'Find a place', exact: true }).fill('Tamarin Mauritius');
      await page.waitForTimeout(300);
      row.searchRequestsBeforeSubmit = row.providerRequests.filter(u => /\/api\/site\/search/.test(u)).length;
      await page.getByRole('button', { name: 'Search', exact: true }).click();
      try { await page.waitForFunction(() => document.querySelector('.site-search-results button') || document.querySelector('.site-error') || document.querySelector('.site-success'), undefined, { timeout: 20000 }); } catch { row.searchTimeout = true; }
      row.searchResults = await page.locator('.site-search-results button').allTextContents();
      if (row.searchResults.length) await page.locator('.site-search-results button').first().click();
      row.searchError = await page.locator('.site-error').allTextContents();
      row.searchRequestsAfterSubmit = row.providerRequests.filter(u => /\/api\/site\/search/.test(u)).length;
      row.searchPassed = row.searchResults.length > 0 && row.searchError.length === 0 && !row.searchTimeout && row.searchRequestsAfterSubmit === 1;
      if (!row.searchPassed) row.providerUnavailable = 'Live search did not return a usable result; the G search gate does not pass.';
      await page.waitForTimeout(700);
      // Put map and its always-visible adjacent credit fully inside the scroll viewport.
      await page.locator('.site-map-shell').evaluate(element => element.scrollIntoView({ block: 'start' }));
      row.attribution = await geometry(page, '.site-attribution a');
      row.mapBox = await page.locator('.site-map').boundingBox();
      const map = page.locator('.site-map');
      const box = row.mapBox;
      for (const [x, y] of [[.35,.35],[.65,.35],[.65,.65],[.35,.65]]) {
        if (device.hasTouch) await page.touchscreen.tap(box.x + box.width*x, box.y + box.height*y);
        else await map.click({ position: { x: box.width*x, y: box.height*y } });
      }
      await page.waitForFunction(() => document.querySelectorAll('.site-corner').length === 4, undefined, { timeout: 20000 });
      row.cornerCount = await page.locator('.site-corner').count();
      await page.getByRole('button', { name: 'Close & check boundary', exact: true }).click();
      row.boundaryCheck = await page.locator('.site-success').allTextContents();
      row.boundaryError = await page.locator('.site-error').allTextContents();
      await page.locator('.site-map-shell').evaluate(element => element.scrollIntoView({ block: 'start' }));
      await page.screenshot({ path: `${output}/live-${device.name}.jpg`, type: 'jpeg', quality: 72 });
      row.mapErrors = await page.locator('.site-map-error').allTextContents();
      if (row.mapErrors.length) row.providerUnavailable = 'The map reported a provider or rendering error; the live-map gate does not pass.';
      await page.locator('.site-editor details summary').click();
      row.cornersBeforeEdit = await cornerValues(page);
      await page.getByRole('spinbutton', { name: 'Corner 1 longitude', exact: true }).fill(String(Number(row.cornersBeforeEdit[0][0]) + .00001));
      row.cornersAfterEdit = await cornerValues(page);
      row.applyDisabledDuringEdit = await page.getByRole('button', { name:'Apply site to plan', exact:true }).isDisabled();
      await page.getByRole('button', { name: 'Undo boundary change', exact:true }).focus();
      await page.keyboard.press('Enter');
      row.cornersAfterKeyboardUndo = await cornerValues(page);
      row.editUndoPassed = JSON.stringify(row.cornersBeforeEdit) !== JSON.stringify(row.cornersAfterEdit) && JSON.stringify(row.cornersBeforeEdit) === JSON.stringify(row.cornersAfterKeyboardUndo) && row.applyDisabledDuringEdit && await page.getByRole('button', { name:'Apply site to plan', exact:true }).isEnabled();
      await page.getByRole('button', { name:'Remove corner 3', exact:true }).click();
      row.cornersAfterRemoval = await cornerValues(page);
      await page.getByRole('button', { name:'Undo boundary change', exact:true }).click();
      row.removeUndoPassed = row.cornersAfterRemoval.length === 3 && JSON.stringify(row.cornersBeforeEdit) === JSON.stringify(await cornerValues(page));
      await page.getByRole('button', { name:'Clear boundary', exact:true }).click();
      row.cornersAfterClear = await cornerValues(page);
      await page.getByRole('button', { name:'Undo boundary change', exact:true }).click();
      row.clearUndoPassed = row.cornersAfterClear.length === 0 && JSON.stringify(row.cornersBeforeEdit) === JSON.stringify(await cornerValues(page));
      await page.getByRole('button', { name: '3. Report', exact: true }).click();
      row.report = await page.locator('.site-report').innerText();
      row.reportChecks = await checkedReport(page);
      row.documentOverflowPx = await page.evaluate(() => Math.max(0, document.documentElement.scrollWidth-innerWidth));
      row.mapRequested = row.providerRequests.some(u => /tiles\.openfreemap\.org/.test(u));
      row.passed = row.pageErrors.length === 0 && row.mapRequested && row.mapErrors.length === 0 && row.searchPassed && row.cornerCount === 4 && row.attribution.length === 3 && row.attribution.every(a=>a.visible) && row.searchRequestsBeforeTyping === 0 && row.searchRequestsBeforeSubmit === 0 && row.boundaryCheck.length > 0 && row.boundaryError.length === 0 && row.documentOverflowPx === 0 && row.editUndoPassed && row.removeUndoPassed && row.clearUndoPassed && row.reportChecks.everyNumberTagged && row.reportChecks.banners.length === 2;
    } catch (error) { row.error = String(error); row.passed = false; }
    await closeContext(context, row);
  }
  for (const device of modes) {
    const context = await contextFor(device), page = await context.newPage();
    const row = { case: 'offline', device: device.name, viewport: device.viewport };
    result.rows.push(row); observe(page, row);
    try {
      await open(page, '');
      row.hint = await page.locator('.site-hint').innerText();
      row.mapCanvasCount = await page.locator('.maplibregl-canvas').count();
      await page.getByRole('button', { name: '3. Report', exact: true }).click();
      row.mapCreditCount = await page.locator('a[href="https://openfreemap.org/"],a[href="https://openmaptiles.org/"],a[href="https://www.openstreetmap.org/copyright"]').count();
      row.sampleReports = [];
      for (const sampleIndex of [0,1,2]) {
        await page.getByRole('button', {name:'1. Boundary',exact:true}).click();
        await page.getByRole('combobox', {name:'Sample location',exact:true}).selectOption(String(sampleIndex));
        await page.getByRole('button', {name:'3. Report',exact:true}).click();
        row.sampleReports.push({ name:await page.locator('.site-report h2').innerText(), ...await checkedReport(page) });
      }
      await page.getByRole('button', {name:'1. Boundary',exact:true}).click();
      await page.getByRole('combobox', {name:'Sample location',exact:true}).selectOption('0');
      await page.getByRole('button', {name:'3. Report',exact:true}).click();
      await page.screenshot({path:`${output}/report-${device.name}.jpg`,type:'jpeg',quality:72});
      // Verify the actual print button's lifecycle, then capture the same print CSS via Chromium PDF.
      await page.evaluate(() => { window.print = () => { window.__sitePrintActive = document.body.classList.contains('printing-site'); }; });
      await page.getByRole('button', {name:'Print / save PDF',exact:true}).click();
      row.printButtonOwnsClass = await page.evaluate(() => window.__sitePrintActive && !document.body.classList.contains('printing-site'));
      await page.evaluate(() => document.body.classList.add('printing-site'));
      await page.pdf({path:`${output}/report-${device.name}-a4.pdf`,format:'A4',preferCSSPageSize:true,printBackground:true});
      await page.evaluate(() => document.body.classList.remove('printing-site'));
      row.pdf = `report-${device.name}-a4.pdf`;
      await page.getByRole('button', {name:'1. Boundary',exact:true}).click();
      await page.getByRole('button', {name:'From the surveyor’s plan',exact:true}).click();
      await page.getByRole('textbox', {name:'First corner: longitude, latitude',exact:true}).fill('57.3776792, -20.3292161');
      await page.getByRole('textbox', {name:'Each line: length in metres, bearing',exact:true}).fill('25,90\n20,S 0 E\n25,270\n20,N 0 E');
      await page.getByRole('button', {name:'Close traverse & check',exact:true}).click();
      row.traverseErrors = await page.locator('.site-error').allTextContents();
      await page.getByRole('button', {name:'3. Report',exact:true}).click();
      row.traverseReport = await checkedReport(page);
      row.closure = row.traverseReport.metrics.find(metric=>metric.label==='Traverse closure error');
      row.passed = row.hint.includes('Practice outline; the demo has no map') && row.mapCanvasCount === 0 && row.mapCreditCount === 0 && row.providerRequests.length === 0 && row.pageErrors.length === 0 && row.sampleReports.every(report=>report.everyNumberTagged && report.overflowPx===0 && report.banners.length===2) && row.printButtonOwnsClass && row.traverseErrors.length===0 && row.closure?.value.includes('0.0000 m') && row.traverseReport.everyNumberTagged && row.traverseReport.overflowPx===0;
    } catch (error) { row.error=String(error); row.passed=false; }
    await closeContext(context, row);
  }
  {
    const context = await contextFor(modes[1]), page = await context.newPage();
    const row = { case: 'production-env-negative-simulation', device: 'phone', note: 'Only healthcheck is deliberately mocked to production; this is not a claim that the unmerged code runs on production.' };
    result.rows.push(row); observe(page,row);
    await page.route('**/api/healthcheck', route=>route.fulfill({ status:200, contentType:'application/json', body:JSON.stringify({env:'production',commit:expectedSha}) }));
    try {
      await open(page,'&live=1');
      row.hint=await page.locator('.site-hint').innerText();
      row.mapCanvasCount=await page.locator('.maplibregl-canvas').count();
      row.passed=row.hint.includes('Practice outline; the demo has no map') && row.mapCanvasCount===0 && row.providerRequests.length===0 && row.pageErrors.length===0;
    } catch(error) { row.error=String(error); row.passed=false; }
    await closeContext(context, row);
  }
} catch(error) { result.error=String(error); }
finally {
  await browser.close();
  result.networkWrites = { attemptedCount: allGuards.reduce((n,g)=>n+g.attempted.length,0), blockedCount: allGuards.reduce((n,g)=>n+g.blocked.length,0), transmittedCount: allGuards.reduce((n,g)=>n+g.attempted.length-g.blocked.length,0) };
  result.passed=!result.error && result.rows.length===7 && result.rows.every(r=>r.passed) && result.networkWrites.attemptedCount===0;
  await fs.writeFile(`${output}/preview-smoke.json`,JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify(result,null,2));
  if(!result.passed) process.exitCode=1;
}



