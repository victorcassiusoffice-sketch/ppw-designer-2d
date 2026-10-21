/** Compiled/live read-only checks for the sculpted UI and generated product release. */
import { chromium, expect as baseExpect } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
const expect = baseExpect.configure({ timeout: 60000 });
const base = process.argv[2] ?? 'http://127.0.0.1:5173';
const live = new URL(base).protocol === 'https:';
const commit = process.argv[3];
if (live && (!/^https:\/\/ppw-designer-2d-[a-z0-9-]+\.vercel\.app$/.test(base) || !/^[a-f0-9]{40}$/.test(commit ?? ''))) throw new Error('Live checks need a feature preview and full expected commit.');
if (!live && !['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw new Error('Unexpected local origin.');
const out = `docs/qa-sculpted-${live ? 'live' : 'compiled'}-2026-10-20`;
mkdirSync(out, { recursive: true });
const args = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
if (live && process.argv.includes('--map-edge')) args.push(`--host-resolver-rules=MAP ${new URL(base).hostname} 216.198.79.3`);
const browser = await chromium.launch({ headless: true, args });
const report = { base, commit, at: new Date().toISOString(), cases: [] };
const failed = row => ['consoleErrors', 'pageErrors', 'httpErrors', 'failedRequests', 'writes', 'defects'].some(key => row[key]?.length);
let retryKeys;
if (process.argv.includes('--retry-failures')) {
  const previous = JSON.parse(readFileSync(`${out}/report.json`, 'utf8'));
  if (previous.base !== base || previous.commit !== commit) throw new Error('Retry requires a report for this exact release.');
  writeFileSync(`${out}/report-network-attempt.json`, JSON.stringify(previous, null, 2));
  retryKeys = new Set(previous.cases.filter(row => !failed(row)).map(row => `${row.device}/${row.name}`));
  report.cases = previous.cases.filter(row => !failed(row));
  report.retryScope = [];
}
try {
  if (live) {
    const page = await browser.newPage();
    const response = await page.goto(`${base}/api/healthcheck?cb=${Date.now()}`, { timeout: 60000 });
    const health = await response.json();
    report.health = { status: response.status(), env: health.env, commit: health.commit };
    expect(report.health).toEqual({ status: 200, env: 'preview', commit });
    await page.close();
  }
  for (const [device, viewport] of [['desktop', { width: 1280, height: 900 }], ['phone', { width: 390, height: 844 }]]) {
    for (const [name, path, ready] of [
      ['plan', '/demo?view=2d&pitch=1', '[data-testid=plan-drawing-viewport]'],
      ['house', '/demo?view=3d&pitch=1', '[data-testid=wallpaint-3d-gl]'],
      ['project', '/demo?panel=project&pitch=1', '.project-workspace'],
      ['shared', '/demo?panel=shared&pitch=1', '.shared-workspace'],
      ['catalogue', '/demo?view=2d&pitch=1', '[data-testid=plan-drawing-viewport]'],
      ['city', '/demo?panel=city&pitch=1', '[data-testid=city-workspace]'],
      ['services', '/demo?view=2d&panel=services&pitch=1', '.services-workspace'],
      ['materials', '/demo?view=2d&panel=materials&pitch=1', '[data-testid=materials-panel]'],
      ['coordination', '/demo?panel=shared&pitch=1', '.shared-workspace'],
    ]) {
      if (retryKeys?.has(`${device}/${name}`)) continue;
      if (retryKeys) report.retryScope.push(`${device}/${name}`);
      const context = await browser.newContext({ viewport, isMobile: device === 'phone', hasTouch: device === 'phone', deviceScaleFactor: 1 });
      await context.addInitScript(() => localStorage.setItem('ppw_designer_coach_v1', '1'));
      const page = await context.newPage(); page.setDefaultTimeout(60000);
      const row = { device, name, consoleErrors: [], pageErrors: [], httpErrors: [], failedRequests: [], writes: [], defects: [] };
      report.cases.push(row);
      page.on('console', msg => { if (msg.type() === 'error') row.consoleErrors.push(msg.text()); });
      page.on('pageerror', err => row.pageErrors.push(err.message));
      page.on('response', r => { if (r.status() >= 400) row.httpErrors.push({ status: r.status(), url: r.url() }); });
      page.on('requestfailed', r => row.failedRequests.push({ url: r.url(), error: r.failure()?.errorText }));
      await page.route('**/*', async route => {
        if (!['GET', 'HEAD', 'OPTIONS'].includes(route.request().method())) { row.writes.push(route.request().url()); await route.abort(); }
        else await route.continue();
      });
      try {
        const response = await page.goto(base + path, { waitUntil: 'networkidle', timeout: 90000 });
        row.status = response.status(); expect(row.status).toBe(200);
        await expect(page.locator(ready)).toBeVisible();
        if (name === 'house') await page.getByTestId('loading-3d').waitFor({ state: 'hidden' });
        // Body snapshots are computed once. Wait for software-GPU completion in QA;
        // no wall-clock claim is made for real phone hardware.
        if (name === 'plan' || name === 'materials') await page.waitForTimeout(40000);
        if (name === 'city') {
          await page.getByRole('button', { name: 'Try an eco district', exact: true }).click();
          await page.waitForTimeout(1200);
        }
        if (name === 'catalogue') {
          await page.getByRole('button', { name: /Furnish.*Products/ }).first().click();
          await page.getByPlaceholder('Search products or brands').fill('DuraStyle');
          await expect(page.getByText(/DuraStyle cabinet washbasin/).first()).toBeVisible();
        }
        if (name === 'coordination') {
          await page.locator('.shared-nav nav').getByRole('button', { name: 'Team & logistics', exact: true }).click();
          await expect(page.getByRole('heading', { name: 'One project. Clear handoffs.', exact: true })).toBeVisible();
        }
        if (['shared', 'project'].includes(name)) {
          const prefs = page.locator(`${ready} .locale-theme-controls`);
          await prefs.locator('summary').click();
          await expect(prefs).toHaveAttribute('open', '');
          await page.keyboard.press('Escape');
          await expect(prefs).not.toHaveAttribute('open', '');
          await expect(page.locator(ready)).toBeVisible();
        }
        const toast = page.getByRole('button', { name: 'Dismiss notification', exact: true });
        if (await toast.count()) await toast.click();
        row.theme = await page.evaluate(() => document.documentElement.dataset.uiTheme);
        expect(row.theme).toBe('ocean');
        row.overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
        expect(row.overflow).toBeLessThanOrEqual(1);
        row.screenshot = `${out}/${device}-${name}.png`;
        await page.screenshot({ path: row.screenshot });
        if (['shared', 'project'].includes(name)) { await page.keyboard.press('Escape'); await expect(page.locator(ready)).toBeHidden(); }
      } catch (error) { row.defects.push(String(error)); }
      await context.close();
      writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2));
      console.log(JSON.stringify(row));
    }
  }
} finally { await browser.close(); writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2)); }
if (report.cases.some(r => r.consoleErrors.length + r.pageErrors.length + r.httpErrors.length + r.failedRequests.length + r.writes.length + r.defects.length)) process.exitCode = 1;
