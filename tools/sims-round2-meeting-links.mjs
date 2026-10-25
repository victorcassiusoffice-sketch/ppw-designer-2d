import { chromium, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// Read-only link inspection: no navigation to the booking service or form submission.
const [origin, label = 'after'] = process.argv.slice(2);
if (!origin) throw new Error('Usage: node tools/sims-round2-meeting-links.mjs <origin> <before|after>');
const expected = 'https://calendly.com/victorcassius-office/ppw-online-face-to-face-meeting-1-hour';
const out = 'docs/qa-sims-fix-round-2-2026-10-25/meeting-links';
mkdirSync(out, { recursive: true });
const report = { origin, label, at: new Date().toISOString(), cases: [] };
const browser = await chromium.launch({ headless: true });
try {
  for (const [device, viewport] of [['desktop', { width: 1280, height: 800 }], ['phone', { width: 390, height: 844 }]]) {
    const context = await browser.newContext({ viewport, isMobile: device === 'phone', hasTouch: device === 'phone' });
    const row = { device, links: [], consoleErrors: [], pageErrors: [], httpErrors: [], blockedWrites: [], screenshots: [] };
    report.cases.push(row);
    await context.route('**/*', route => {
      if (!['GET', 'HEAD', 'OPTIONS'].includes(route.request().method())) {
        row.blockedWrites.push(route.request().url());
        return route.abort();
      }
      return route.continue();
    });
    const page = await context.newPage();
    page.on('console', msg => { if (msg.type() === 'error') row.consoleErrors.push(msg.text()); });
    page.on('pageerror', error => row.pageErrors.push(String(error)));
    page.on('response', response => { if (response.status() >= 400) row.httpErrors.push({ url: response.url(), status: response.status() }); });
    await page.goto(`${origin}/pitch/plumbing#Next%20step`, { waitUntil: 'networkidle' });
    const meeting = page.getByRole('link', { name: /^Book a 1-hour meeting/ });
    await expect(meeting).toBeVisible();
    await meeting.scrollIntoViewIfNeeded();
    const links = await page.locator('a[href*="calendly.com"]').evaluateAll(nodes => nodes.map(node => ({ text: node.textContent.trim(), href: node.href })));
    if (label !== 'before') for (const link of links) expect(link.href).toBe(expected);
    row.links = links.map(link => ({ text: link.text, canonical: link.href === expected, href: link.href === expected ? expected : 'Retired target (production baseline)' }));
    const shot = join(out, `${label}-${device}-plumbing-meeting.png`);
    await page.screenshot({ path: shot });
    row.screenshots.push(shot);
    row.overflowPx = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    // Production already calls this retired exchange-rate endpoint on pitch pages.
    // Keep the observed error in evidence; it is unrelated to link replacement.
    row.knownExternalRateErrors = row.httpErrors.filter(error => error.status === 401 && error.url.startsWith('https://api.exchangerate.host/latest?'));
    if (label !== 'before') {
      expect(row.httpErrors.filter(error => !row.knownExternalRateErrors.includes(error))).toEqual([]);
      expect(row.consoleErrors.filter(error => !(row.knownExternalRateErrors.length && /status of 401/.test(error)))).toEqual([]);
    }
    expect(row.pageErrors).toEqual([]);
    expect(row.blockedWrites).toEqual([]);
    expect(row.overflowPx).toBeLessThanOrEqual(1);
    await context.close();
  }
} finally {
  await browser.close();
  writeFileSync(join(out, `${label}.json`), JSON.stringify(report, null, 2));
}
console.log(JSON.stringify(report, null, 2));
