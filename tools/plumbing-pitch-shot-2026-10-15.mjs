/** Local preview-only screenshots. Does not launch the demo iframe, send forms or write APIs. */
import { chromium, expect } from '@playwright/test';
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';

const base = process.argv[2] ?? 'http://127.0.0.1:5173';
if (!['127.0.0.1', 'localhost'].includes(new URL(base).hostname)) throw new Error('Local preview only.');
const out = 'docs/qa-plumbing-pitch-2026-10-15';
mkdirSync(out, { recursive: true });
const report = { date: '2026-10-15', base, bundle: readdirSync('dist/assets').find(f => /^App-[\w-]+\.js$/.test(f)), cases: [] };
const browser = await chromium.launch({ headless: true });
try {
  for (const [name, viewport] of [['desktop', { width: 1280, height: 900 }], ['phone', { width: 390, height: 844 }]]) {
    const context = await browser.newContext({ viewport, hasTouch: name === 'phone', isMobile: name === 'phone', deviceScaleFactor: 1 });
    const page = await context.newPage();
    page.setDefaultTimeout(30000);
    const result = { viewport: name, shots: [], checks: [], consoleErrors: [], pageErrors: [], writes: [], failures: [] };
    report.cases.push(result);
    page.on('console', m => { if (m.type() === 'error') result.consoleErrors.push(m.text()); });
    page.on('pageerror', e => result.pageErrors.push(e.message));
    await page.route('**/*', async route => {
      if (!['GET', 'HEAD', 'OPTIONS'].includes(route.request().method())) {
        result.writes.push(route.request().url());
        await route.abort();
      } else await route.continue();
    });
    try {
      await page.goto(`${base}/pitch/plumbing`, { waitUntil: 'networkidle', timeout: 60000 });
      await expect(page.getByRole('heading', { name: 'A clearer picture. Before the quote.' })).toBeVisible();
      await expect(page.locator('iframe')).toHaveCount(0);
      result.checks.push('Actual pitch route renders; interactive embed stays unloaded until requested.');
      const chapters = [['The opportunity', 'opportunity'], ['Try the tools', 'tools'], ['Your catalogue', 'catalogue'], ['Your website', 'installation'], ['Work together', 'coordination']];
      for (const [title, slug] of chapters) {
        await page.getByRole('tab', { name: new RegExp(title) }).click();
        await expect(page.getByRole('tab', { name: new RegExp(title) })).toHaveAttribute('aria-selected', 'true');
        await page.evaluate(() => document.fonts.ready);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
        expect(overflow).toBeLessThanOrEqual(1);
        await expect.poll(() => page.locator('img').evaluateAll(nodes => nodes.filter(img => !img.complete || img.naturalWidth === 0).map(img => img.getAttribute('src')))).toEqual([]);
        if (slug === 'tools') await expect(page.getByText('Connect in 2D or 3D', { exact: true })).toBeVisible();
        if (slug === 'installation') await expect(page.getByRole('link', { name: 'Open services → 3D edit' })).toHaveAttribute('href', '/demo?view=3d&panel=services&pitch=1');
        if (slug === 'coordination') await expect(page.getByRole('link', { name: 'Try foundation planning' })).toHaveAttribute('href', '/demo?view=2d&panel=foundation&pitch=1');
        const path = `${out}/${name}-${slug}.png`;
        await page.screenshot({ path, fullPage: true });
        result.shots.push(path);
        result.checks.push(`${title}: selected chapter, no horizontal overflow, images loaded.`);
      }
      await page.goto(`${base}/demo?view=2d&panel=foundation&pitch=1`, { waitUntil: 'networkidle', timeout: 60000 });
      await expect(page.getByRole('dialog', { name: 'Foundation design' })).toBeVisible();
      const foundation = await page.evaluate(() => {
        const box = selector => { const r = document.querySelector(selector).getBoundingClientRect(); return { top: r.top, bottom: r.bottom, height: r.height }; };
        return { drawing: box('.foundation-drawing'), svg: box('.foundation-drawing > svg'), totals: box('.foundation-totals'), details: box('.foundation-details') };
      });
      expect(foundation.totals.bottom).toBeLessThanOrEqual(foundation.drawing.bottom + 1);
      if (name === 'phone') {
        expect(foundation.svg.height).toBeGreaterThanOrEqual(240);
        expect(foundation.details.top).toBeGreaterThanOrEqual(foundation.totals.bottom - 1);
      }
      result.checks.push({ name: 'Cold foundation demo link opens after initial demo load; totals are not clipped', foundation });
      const foundationShot = `${out}/${name}-foundation-deep-link.png`;
      await page.screenshot({ path: foundationShot });
      result.shots.push(foundationShot);
      expect(result.consoleErrors).toEqual([]);
      expect(result.pageErrors).toEqual([]);
      expect(result.writes).toEqual([]);
    } catch (e) {
      result.failures.push(e.message);
      await page.screenshot({ path: `${out}/${name}-failure.png`, fullPage: true });
    } finally { await context.close(); }
  }
} finally {
  await browser.close();
  writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2));
}
console.log(JSON.stringify(report, null, 2));
if (report.cases.some(c => c.failures.length)) process.exitCode = 1;
