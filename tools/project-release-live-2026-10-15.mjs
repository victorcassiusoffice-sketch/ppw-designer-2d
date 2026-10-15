/** Read-only deployment smoke checks. No credentials, customer records or server writes. */
import { chromium, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
const base = process.argv[2], commit = process.argv[3];
if (!base || !/^https:\/\/ppw-designer-2d-[a-z0-9-]+\.vercel\.app$/.test(base) || !/^[a-f0-9]{40}$/.test(commit ?? '')) throw new Error('Pass unique Vercel preview origin and expected full commit.');
const mapped = process.argv.includes('--map-edge');
const out = 'docs/qa-project-live-2026-10-15'; mkdirSync(out, { recursive: true });
const report = { base, commit, at: new Date().toISOString(), transport: mapped ? 'Process-only resolver, original host and TLS' : 'Normal DNS/TLS', cases: [] };
const args = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
if (mapped) args.push(`--host-resolver-rules=MAP ${new URL(base).hostname} 216.198.79.3`);
const browser = await chromium.launch({ headless: true, args });
try {
  const healthPage = await browser.newPage();
  const response = await healthPage.goto(`${base}/api/healthcheck?cb=${Date.now()}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  const health = await response.json();
  report.health = { status: response.status(), ok: health.ok, env: health.env, commit: health.commit };
  expect(response.status()).toBe(200); expect(health.env).toBe('preview'); expect(health.commit).toBe(commit); await healthPage.close();
  const routes = [
    ['plan', '/demo?view=2d&pitch=1'], ['house', '/demo?view=3d&pitch=1'],
    ...['developers', 'merchants', 'construction', 'plumbing', 'landscape', 'city'].map(c => [`project-${c}`, `/demo?panel=project&company=${c}&pitch=1`]),
    ...['developers', 'merchants', 'construction', 'plumbing'].map(c => [`pitch-${c}`, `/pitch/${c}`]),
    ['designer-access', '/designer'], ['studio-access', '/studio'],
  ];
  for (const [device, viewport] of [['desktop', { width: 1280, height: 900 }], ['phone', { width: 390, height: 844 }]]) {
    for (const [name, path] of routes) {
      const context = await browser.newContext({ viewport, isMobile: device === 'phone', hasTouch: device === 'phone', deviceScaleFactor: 1 });
      await context.addInitScript(() => localStorage.setItem('ppw_designer_coach_v1', '1'));
      const page = await context.newPage(); page.setDefaultTimeout(45000);
      const row = { device, name, path, consoleErrors: [], pageErrors: [], failedRequests: [], httpErrors: [], writes: [], defects: [] }; report.cases.push(row);
      page.on('console', m => { if (m.type() === 'error') row.consoleErrors.push(m.text()); });
      page.on('pageerror', e => row.pageErrors.push(e.message));
      page.on('requestfailed', r => row.failedRequests.push({ url: r.url(), error: r.failure()?.errorText }));
      page.on('response', r => { if (r.status() >= 400) row.httpErrors.push({ url: r.url(), status: r.status() }); });
      await page.route('**/*', async route => {
        if (!['GET', 'HEAD', 'OPTIONS'].includes(route.request().method())) { row.writes.push(route.request().url()); await route.abort(); } else await route.continue();
      });
      try {
        const response = await page.goto(`${base}${path}${path.includes('?') ? '&' : '?'}cb=${Date.now()}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
        row.status = response.status(); expect(row.status).toBe(200);
        if (name.startsWith('project-')) {
          const hub = page.getByTestId('project-workspace'); await expect(hub).toBeVisible();
          await expect(hub.locator('.project-nav>label').first().locator('select')).toHaveValue(name.replace('project-', ''));
          await expect(hub.locator('h1')).toHaveText('Overview');
        } else if (name === 'plan') await page.locator('.konvajs-content canvas').first().waitFor();
        else if (name === 'house') {
          await page.getByTestId('wallpaint-3d-gl').waitFor(); await page.getByTestId('loading-3d').waitFor({ state: 'hidden', timeout: 60000 });
        } else if (name.startsWith('pitch-')) await expect(page.locator('h1').first()).toBeVisible();
        else { await expect(page.locator('input[type=password]').first()).toBeVisible(); row.accessGate = true; }
        await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(800);
        row.overflow = await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth);
        if (row.overflow > 1) row.defects.push('Horizontal overflow');
        row.bundle = await page.evaluate(() => performance.getEntriesByType('resource').map(r => r.name).find(n => /\/App-[\w-]+\.js/.test(n))?.split('/').pop() ?? null);
        row.screenshot = `${out}/${device}-${name}.png`; await page.screenshot({ path: row.screenshot, timeout: 60000 });
      } catch (error) { row.defects.push(String(error)); }
      await context.close(); writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2));
      console.log(JSON.stringify({ device, name, status: row.status, errors: row.consoleErrors.length + row.pageErrors.length, failed: row.failedRequests.length, writes: row.writes.length, defects: row.defects }));
    }
  }
} finally { await browser.close(); writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2)); }
if (report.cases.some(r => r.consoleErrors.length || r.pageErrors.length || r.failedRequests.length || r.httpErrors.length || r.writes.length || r.defects.length)) process.exitCode = 1;
