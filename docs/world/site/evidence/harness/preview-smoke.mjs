import fs from 'node:fs/promises';
import { chromium } from '@playwright/test';

const origin = 'https://ppw-designer-2d-git-gpt-olb-site-map-2026-10-27-victor-ppw.vercel.app';
const output = 'docs/world/site/evidence/preview-smoke.json';
const browser = await chromium.launch({ headless: true, args: [`--host-resolver-rules=MAP ${new URL(origin).hostname} 216.198.79.3`] });
const result = { checkedAt: new Date().toISOString(), origin, viewport: { width: 390, height: 844 }, note: 'Headless touch viewport on laptop, not a physical device. Normal branch preview; no API/provider requests intercepted or substituted.', rows: [] };
try {
  for (const sample of [false, true]) {
    const context = await browser.newContext({ viewport: result.viewport, isMobile: true, hasTouch: true });
    await context.addInitScript(() => localStorage.setItem('ppw_designer_coach_v1', '1'));
    const page = await context.newPage();
    const row = { url: origin + `/demo?view=2d&pitch=1${sample ? '&site=1' : ''}`, pageErrors: [], consoleErrors: [], httpErrors: [], providerRequests: [], mapResources: [] };
    result.rows.push(row);
    page.on('pageerror', error => row.pageErrors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') row.consoleErrors.push(message.text()); });
    page.on('response', response => { if (response.status() >= 400) row.httpErrors.push({ url: response.url(), status: response.status() }); });
    page.on('request', request => {
      const url = request.url();
      if (/\/api\/site(?:\/|\?)|openfreemap\.org|photon\.komoot\.io|overpass-api\.de|re\.jrc\.ec\.europa\.eu|elevation-tiles-prod/.test(url)) row.providerRequests.push(url);
      if (/SiteMap-|maplibre-gl-worker/.test(url)) row.mapResources.push(url);
    });
    await page.goto(row.url, { waitUntil: 'networkidle', timeout: 60000 });
    row.title = await page.title();
    const entry = page.getByRole('button', { name: 'Site from the map', exact: true });
    row.siteEntryCount = await entry.count();
    if (sample) {
      await entry.click();
      await page.getByRole('button', { name: '3. Report', exact: true }).click();
      const text = await page.locator('.site-report').innerText();
      row.reportVisible = await page.locator('.site-report').isVisible();
      row.bannerPresent = text.includes('Estimates from public data for planning a conversation, not a survey and not an approval.');
      row.boundaryLabelPresent = text.includes('Boundary drawn by you; not a cadastral survey.');
      row.unavailablePresent = text.includes('Unavailable');
      row.areaPresent = text.includes('500.00 m²');
      row.closeVisible = await page.getByRole('button', { name: 'Close Site', exact: true }).isVisible();
      row.reportOverflowPx = await page.locator('.site-report').evaluate(element => Math.max(0, element.scrollWidth - element.clientWidth));
    }
    row.documentOverflowPx = await page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - innerWidth));
    row.passed = row.pageErrors.length === 0 && row.consoleErrors.length === 0 && row.httpErrors.length === 0 && row.providerRequests.length === 0 && row.mapResources.length === 0 && row.documentOverflowPx === 0 && (sample ? row.siteEntryCount === 1 && row.reportVisible && row.bannerPresent && row.boundaryLabelPresent && row.unavailablePresent && row.areaPresent && row.closeVisible && row.reportOverflowPx === 0 : row.siteEntryCount === 0);
    await context.close();
  }
} catch (error) { result.error = String(error); }
finally {
  await browser.close();
  result.passed = !result.error && result.rows.length === 2 && result.rows.every(row => row.passed);
  await fs.writeFile(output, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
  if (!result.passed) process.exitCode = 1;
}
