/** Local-only, disposable browser QA. No cloud mutation, order, invoice or email. */
import { chromium, expect } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
const base = process.argv[2] ?? 'http://127.0.0.1:5174';
if (!['127.0.0.1', 'localhost'].includes(new URL(base).hostname)) throw new Error('Local QA only');
const out = 'docs/qa-coordination-2026-10-19'; mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const report = { base, cases: [] };
try { for (const [name, viewport] of [['desktop', { width: 1280, height: 900 }], ['phone', { width: 390, height: 844 }]]) {
  const context = await browser.newContext({ viewport, hasTouch: name === 'phone', isMobile: name === 'phone', deviceScaleFactor: 1, acceptDownloads: true });
  await context.addInitScript(() => {
    if (sessionStorage.getItem('coordination-seeded')) return;
    localStorage.setItem('ppw_designer_coach_v1', '1');
    localStorage.setItem('ppw_property_v2', JSON.stringify({ version: 2, state: { pxPerMetre: 70, showGrid: true, property: { id: 'qa-coordination', name: 'Eco district coordination', wallHeightM: 2.7, activeRoomId: 'house', rooms: [{ id: 'house', name: 'Linked house', polygon: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 8 }, { x: 0, y: 8 }], placedItems: [] }] } } }));
    sessionStorage.setItem('coordination-seeded', '1');
  });
  const page = await context.newPage(); page.setDefaultTimeout(25000);
  const row = { name, shots: [], checks: [], errors: [], writes: [], failures: [] }; report.cases.push(row);
  page.on('console', m => { if (m.type() === 'error') row.errors.push(m.text()); }); page.on('pageerror', e => row.errors.push(e.message));
  await page.route('**/api/**', async route => { if (!['GET', 'HEAD', 'OPTIONS'].includes(route.request().method())) { row.writes.push(route.request().url()); await route.abort(); } else await route.continue(); });
  const shared = () => page.getByTestId('shared-project-workspace');
  const tab = async title => shared().locator('.shared-nav nav').getByRole('button', { name: title, exact: true }).click();
  const register = () => page.evaluate(() => JSON.parse(localStorage.getItem('olb-shared-pilot-v1')).state.pilots['qa-coordination'].record);
  const shot = async label => { await page.waitForTimeout(180); const path = `${out}/${name}-${label}.png`; await page.screenshot({ path }); row.shots.push(path); const layout = await page.evaluate(() => { const root = document.querySelector('.shared-workspace'), content = document.querySelector('.shared-content'); return { page: document.documentElement.scrollWidth, width: innerWidth, root: root?.scrollWidth, contentWidth: content?.clientWidth, contentScroll: content?.scrollWidth }; }); expect(layout.page).toBeLessThanOrEqual(layout.width + 1); if (layout.contentWidth) expect(layout.contentScroll).toBeLessThanOrEqual(layout.contentWidth + 1); row.checks.push({ label, layout }); };
  try {
    await page.goto(`${base}/designer?view=2d&panel=city&pitch=1`, { waitUntil: 'networkidle' });
    const city = page.getByTestId('city-workspace'); await expect(city).toBeVisible();
    await city.getByRole('button', { name: 'Try an eco district', exact: true }).click();
    await city.getByRole('button', { name: 'Refresh building envelope', exact: true }).click();
    const linkedId = await page.evaluate(() => JSON.parse(localStorage.getItem('ppw_property_v2')).state.property.city.assets.find(a => a.buildingLink === 'current').id);
    await page.goto(`${base}/designer?view=2d&panel=shared&pitch=1`, { waitUntil: 'networkidle' });
    await expect(shared()).toBeVisible();
    await expect.poll(async () => (await register()).project.components.filter(c => c.id.startsWith('city:')).length).toBe(16);
    const original = await register(); const source = original.project.components;
    expect(source.find(c => c.id === 'city:roads:surface').quantity).toBeCloseTo(124.2);
    expect(source.find(c => c.id === 'city:roads:base').quantity).toBeCloseTo(496.8);
    expect(source.find(c => c.id === `city:asset:${linkedId}`)).toBeUndefined();
    expect(source.find(c => c.id === 'floor:ground').quantity).toBe(80);
    expect(source.filter(c => c.id.includes('data-centre')).length).toBe(1);
    row.checks.push({ cityPackages: 16, houseCountedOnce: true, originalRoadVolume: 124.2, separateDataCentreEnvelope: true });
    await tab('Team & logistics'); await shot('team-overview');
    const downloadPromise = page.waitForEvent('download'); await shared().getByRole('button', { name: 'Export team handoff', exact: true }).click();
    const download = await downloadPromise; const exportFile = `${out}/${name}-team-handoff.json`; await download.saveAs(exportFile);
    const payload = JSON.parse(readFileSync(exportFile, 'utf8'));
    expect(payload.format).toBe('one-live-build-coordination-v1'); expect(payload.scope).toBe('local'); expect(payload.sourceBuildId).toBe('qa-coordination');
    expect(payload.components).toEqual(source); expect(payload.reviews.length).toBe(8);
    expect(new Set(payload.components.map(c => c.id)).size).toBe(source.length);
    row.checks.push('Export parsed: canonical component IDs, revision, local scope, separate delivery references');
    // Set a real local supplier assignment, date and component note through the editor.
    await tab('Components'); await shared().locator('.shared-component-list > button').filter({ hasText: 'City roads · union surface material' }).click();
    const editor = shared().getByRole('form', { name: 'Edit component specification' });
    await editor.getByLabel('Material / product').fill('Pervious concrete — planning reference');
    await editor.getByLabel('Responsible organisation').fill('Pilot site team');
    await editor.getByLabel('Assigned project member').selectOption('user_localsupplier');
    await editor.getByLabel('Required delivery date').fill('2026-12-01');
    await editor.getByLabel('Source URLs').fill('https://premix.mu/produit/nos-produits-beton-beton-decoratif-drainant/');
    await editor.getByLabel('Coordination notes').fill('Pilot handoff: confirm this mix and site delivery before procurement.');
    await editor.getByRole('button', { name: 'Save new version' }).click(); await expect(editor).toHaveCount(0);
    for (const role of ['owner', 'architect', 'engineer', 'supplier', 'contractor', 'client']) {
      await page.getByLabel('Rehearse a stakeholder role').selectOption(role); await tab('Team & logistics');
      await shared().getByRole('heading', { name: 'My next actions', exact: true }).scrollIntoViewIfNeeded();
      const actions = shared().locator('.shared-action');
      if (role === 'supplier') { await expect(actions).toHaveCount(1); await expect(actions.first()).toContainText('City roads'); }
      else expect(await actions.count()).toBeGreaterThan(0);
      await shot(`${role}-actions`);
    }
    await page.getByLabel('Rehearse a stakeholder role').selectOption('owner');
    const labels = ['Define the brief', 'Coordinate the design', 'Specify materials', 'Review the design', 'Confirm supply', 'Plan delivery & site work', 'Record the decision', 'Coordinate release'];
    const stages = ['brief', 'geometry', 'materials', 'engineering', 'supplier', 'logistics', 'client', 'release'];
    for (let i = 0; i < labels.length; i++) {
      await tab('Team & logistics'); await shared().locator('.shared-handoff-flow').getByRole('button', { name: new RegExp(labels[i].replace(/[&]/g, '\\&')) }).click();
      await shared().locator('.shared-handoff-detail').getByRole('button', { name: `Open ${labels[i].toLowerCase()} review`, exact: true }).click();
      await expect(shared().locator(`[data-review-stage="${stages[i]}"]`)).toBeVisible();
      await expect(shared().locator('.shared-nav nav').getByRole('button', { name: 'Pilot workflow', exact: true })).toHaveAttribute('aria-current', 'page');
    }
    await shot('contextual-review'); row.checks.push('All eight handoff nodes navigate to their existing review');
    // Change a measured city road using the actual city inspector, then reopen the register.
    await page.goto(`${base}/designer?view=2d&panel=city&pitch=1`, { waitUntil: 'networkidle' });
    await city.getByText('Site elements', { exact: true }).click();
    await city.locator('.city-element-list').getByRole('button', { name: 'Main access — edit section', exact: true }).click();
    await city.getByLabel('Road width (m)', { exact: true }).fill('8'); await city.getByLabel('Road width (m)', { exact: true }).press('Tab');
    await page.goto(`${base}/designer?view=2d&panel=shared&pitch=1`, { waitUntil: 'networkidle' });
    await expect.poll(async () => (await register()).project.components.find(c => c.id === 'city:roads:surface').quantity).toBeCloseTo(146.1);
    const updated = await register(); expect(updated.project.components).toHaveLength(source.length); expect(updated.project.specRevision).toBeGreaterThan(original.project.specRevision);
    expect(updated.project.components.find(c => c.id === 'city:roads:surface')).toMatchObject({ assigneeUserId: 'user_localsupplier', deliveryDate: '2026-12-01', responsibleParty: 'Pilot site team' });
    const version = updated.revision; await page.reload({ waitUntil: 'networkidle' }); await expect(shared()).toBeVisible(); expect((await register()).revision).toBe(version);
    row.checks.push({ changedRoadVolume: 146.1, noDuplicatePackages: true, metadataPreserved: true, reopenDoesNotCreateRevision: version });
    await tab('Team & logistics'); await shared().getByRole('heading', { name: 'Delivery coordination', exact: true }).scrollIntoViewIfNeeded(); await shot('delivery-coordination');
    await shared().getByRole('button', { name: '← Build', exact: true }).click(); await expect(shared()).toBeHidden();
    expect(row.errors).toEqual([]); expect(row.writes).toEqual([]);
  } catch (e) { row.failures.push(String(e)); await page.screenshot({ path: `${out}/${name}-failure.png` }); }
  await context.close(); writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2)); console.log(JSON.stringify(row));
} } finally { await browser.close(); writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2)); }
if (report.cases.some(c => c.errors.length || c.writes.length || c.failures.length)) process.exitCode = 1;
