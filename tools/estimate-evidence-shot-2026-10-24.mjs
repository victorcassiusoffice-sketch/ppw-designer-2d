import { chromium, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
const base = process.argv[2] ?? 'http://127.0.0.1:5176';
if (!['127.0.0.1', 'localhost'].includes(new URL(base).hostname)) throw new Error('Local QA only');
const out = 'docs/qa-sims-parity-fix-2026-10-24/estimate-evidence'; mkdirSync(out, { recursive: true });
const report = { base, cases: [] }, browser = await chromium.launch({ headless: true });
try {
  for (const [device, viewport] of [['desktop', { width: 1280, height: 800 }], ['phone', { width: 390, height: 844 }]]) {
    const context = await browser.newContext({ viewport, isMobile: device === 'phone', hasTouch: device === 'phone' });
    await context.addInitScript(() => { localStorage.clear(); localStorage.setItem('ppw_designer_coach_v1', '1'); });
    const page = await context.newPage(); page.setDefaultTimeout(20000);
    const row = { device, errors: [], failures: [], writes: [], checks: [], shots: [] }; report.cases.push(row);
    page.on('console', message => { if (message.type() === 'error') row.errors.push(message.text()); });
    page.on('pageerror', error => row.errors.push(error.message));
    await page.route('**/api/**', async route => { if (!['GET', 'HEAD', 'OPTIONS'].includes(route.request().method())) { row.writes.push(route.request().url()); return route.abort(); } await route.continue(); });
    const shot = async name => { const path = `${out}/${device}-${name}.png`; await page.screenshot({ path }); row.shots.push(path); expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1); };
    try {
      await page.goto(`${base}/demo?view=2d&panel=materials&pitch=1`, { waitUntil: 'networkidle' });
      const panel = page.getByTestId('estimate-evidence'); await expect(panel).toBeVisible();
      await expect(page.locator('.analysis-cart-summary')).toHaveText('Products');
      await expect(page.locator('.analysis-cart-summary svg')).toBeVisible();
      expect(await panel.getAttribute('open')).toBeNull();
      await panel.locator(':scope > summary').click();
      await panel.locator('.estimate-evidence-stat').scrollIntoViewIfNeeded();
      await shot('input-presence');
      await expect(panel).toContainText('Presence only');
      await expect(panel).toContainText('Independent validation · not available');
      const text = await panel.innerText();
      expect(text).not.toMatch(/\bMUR\b|\bRs\b|Courts Mammouth|Espace Maison|\d+\s*%/);
      await panel.locator('.estimate-engine-inventory > summary').click();
      expect(await panel.locator('.estimate-engine').count()).toBe(11);
      await panel.locator('.estimate-engine').nth(1).locator('summary').click();
      await panel.locator('.estimate-engine').nth(1).scrollIntoViewIfNeeded();
      await shot('engine-scope');
      await expect(panel).toContainText('Mix ratios do not certify strength');
      row.checks.push('Collapsed panel expands through real pointer clicks; 11 distinct module entries');
      row.checks.push('Presence count clearly separated from unavailable invoice validation and engineering approval');
      row.checks.push('No prices, currency, retailer names, fabricated percentages or horizontal overflow');
      expect(row.errors).toEqual([]); expect(row.writes).toEqual([]);
    } catch (error) { row.failures.push(String(error)); await page.screenshot({ path: `${out}/${device}-failure.png` }); }
    await context.close(); writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2));
  }
} finally { await browser.close(); writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2)); }
console.log(JSON.stringify(report, null, 2));
if (report.cases.some(row => row.errors.length || row.failures.length || row.writes.length)) process.exitCode = 1;
