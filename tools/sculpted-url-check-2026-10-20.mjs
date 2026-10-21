/** Read-only route/gate evidence. Deliberately separate from the main UI report. */
import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const base = process.argv[2] ?? 'https://ppw-designer-2d-n63iyqjhs-victor-ppw.vercel.app';
const commit = process.argv[3] ?? '27d875c556754d9ce1e63479b22deacf38023046';
if (!/^https:\/\/ppw-designer-2d-[a-z0-9-]+\.vercel\.app$/.test(base) || !/^[a-f0-9]{40}$/.test(commit)) throw new Error('Expected feature preview and full commit');
const out = 'docs/qa-sculpted-live-2026-10-20'; mkdirSync(out, { recursive: true });
const directory = readFileSync('docs/ECO-CITY-BUILD-LINKS-2026-10-19.md', 'utf8');
const paths = [...new Set([...directory.matchAll(/\]\((https:\/\/ppw-designer-2d-[^\s)]+\.vercel\.app[^\s)]*)\)/g)].map(match => {
  const url = new URL(match[1]); return url.pathname + url.search;
}).filter(path => /^\/(demo|designer|pitch|embed|studio)(\/|\?|$)/.test(path)).concat(['/designer', '/designer?demo=tintex']))];
const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', `--host-resolver-rules=MAP ${new URL(base).hostname} 216.198.79.3`] });
const report = { base, commit, at: new Date().toISOString(), scope: 'Document HTTP and route-render smoke; four protected-entry gate screenshots. No authentication or form submissions.', transport: 'Chromium process-only DNS mapping; original HTTPS hostname/TLS retained', urls: [], gates: [] };
const persist = () => writeFileSync(`${out}/urls.json`, JSON.stringify(report, null, 2));
try {
  for (const path of paths) {
    const expectedAccessGate = /^\/(designer|studio)(\/|\?|$)/.test(path);
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await context.addInitScript(() => localStorage.setItem('ppw_designer_coach_v1', '1'));
    const page = await context.newPage();
    const row = { path, requestedUrl: base + path, expectedAccessGate, documents: [], errors: [], blockedWrites: [] }; report.urls.push(row);
    page.on('pageerror', error => row.errors.push(error.message));
    page.on('response', response => {
      if (response.request().isNavigationRequest() && response.request().frame() === page.mainFrame()) row.documents.push({ url: response.url(), status: response.status() });
    });
    await page.route('**/*', async route => {
      if (!['GET', 'HEAD', 'OPTIONS'].includes(route.request().method())) { row.blockedWrites.push(route.request().url()); await route.abort(); }
      else await route.continue();
    });
    try {
      const response = await page.goto(base + path, { waitUntil: 'domcontentloaded', timeout: 60000 });
      row.finalHttpStatus = response.status();
      await page.waitForFunction(() => document.querySelector('input[type=password]') || (document.querySelector('#root')?.textContent?.trim().length ?? 0) > 100, { timeout: 30000 });
      row.accessGateVisible = await page.locator('input[type=password]').first().isVisible();
      row.finalUrl = page.url();
      row.heading = (await page.locator('h1,h2').first().textContent().catch(() => null))?.trim().slice(0, 140) ?? null;
      row.rendered = row.accessGateVisible || await page.locator('#root').evaluate(element => element.textContent.trim().length > 100);
      row.passed = row.finalHttpStatus === 200 && row.rendered && row.accessGateVisible === expectedAccessGate && row.errors.length === 0 && row.blockedWrites.length === 0;
    } catch (error) { row.errors.push(String(error)); row.passed = false; }
    await context.close(); persist(); console.log(JSON.stringify({ path, status: row.finalHttpStatus, gate: row.accessGateVisible, passed: row.passed }));
  }
  for (const [device, viewport] of [['desktop', { width: 1280, height: 900 }], ['phone', { width: 390, height: 844 }]]) {
    for (const [name, path] of [['designer', '/designer'], ['tintex', '/designer?demo=tintex']]) {
      const context = await browser.newContext({ viewport, isMobile: device === 'phone', hasTouch: device === 'phone', deviceScaleFactor: 1 });
      const page = await context.newPage();
      const row = { device, name, path, blockedWrites: [], errors: [] }; report.gates.push(row);
      page.on('pageerror', error => row.errors.push(error.message));
      await page.route('**/*', async route => { if (!['GET', 'HEAD', 'OPTIONS'].includes(route.request().method())) { row.blockedWrites.push(route.request().url()); await route.abort(); } else await route.continue(); });
      try {
        const response = await page.goto(base + path, { waitUntil: 'networkidle', timeout: 60000 });
        await page.locator('input[type=password]').first().waitFor({ state: 'visible' });
        await page.evaluate(() => document.fonts.ready);
        row.status = response.status(); row.finalUrl = page.url(); row.accessGateVisible = true;
        row.overflow = await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth);
        row.screenshot = `${out}/${device}-${name}-access-gate.png`; await page.screenshot({ path: row.screenshot });
        row.passed = row.status === 200 && row.overflow <= 1 && !row.errors.length && !row.blockedWrites.length;
      } catch (error) { row.errors.push(String(error)); row.passed = false; }
      await context.close(); persist();
    }
  }
} finally { await browser.close(); persist(); }
console.log(JSON.stringify({ urls: report.urls.length, gates: report.gates.length, failed: [...report.urls, ...report.gates].filter(row => !row.passed).length }));
if ([...report.urls, ...report.gates].some(row => !row.passed)) process.exitCode = 1;
