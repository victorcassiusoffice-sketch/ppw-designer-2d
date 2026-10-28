/**
 * Real preview/PDF regression, explicitly invoked during a browser QA window.
 * node scripts/qa/site-print.mjs --origin URL --sha FULL_SHA --out NEW_DIRECTORY
 *   [--pin-ip IP] [--python PATH] [--pdftoppm PATH]
 * Requires existing Playwright Chromium, pdfplumber and Poppler QA tools.
 * Nothing is installed and no environment configuration is changed.
 * Each page is text/geometry checked and rendered; all rendered pages still
 * require human/model visual inspection before the print gate is called passed.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { chromium } from '@playwright/test';
import { inspectSiteReportPdf } from './site-print-pdf.mjs';

const args = new Map();
for (let i = 2; i < process.argv.length; i += 2) args.set(process.argv[i], process.argv[i + 1]);
const origin = args.get('--origin'), expectedSha = args.get('--sha'), output = args.get('--out');
if (!origin || !/^[a-f0-9]{40}$/.test(expectedSha || '') || !output) throw Error('Supply --origin, full --sha and a new --out directory.');
await fs.mkdir(output, { recursive: false }); // Never overwrite a failed campaign.
const run = promisify(execFile);
const browser = await chromium.launch({ headless: true, args: args.has('--pin-ip') ? [`--host-resolver-rules=MAP ${new URL(origin).hostname} ${args.get('--pin-ip')}`] : [] });
const result = { at: new Date().toISOString(), origin, expectedSha,
  note: 'Offline Site on the normal preview. Desktop and touch viewport emulation, not a physical phone. All attempted writes are blocked. Actual PDFs are checked page by page; rendered pages require a separate recorded visual inspection.',
  visualInspection: 'Pending: inspect every rendered page.', rows: [] };
const modes = [{ name: 'laptop', viewport: { width: 1280, height: 800 } }, { name: 'phone', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }];
try {
  for (const { name, ...device } of modes) {
    const context = await browser.newContext({ ...device, serviceWorkers: 'block' });
    const row = { device: name, viewport: device.viewport, pageErrors: [], consoleErrors: [], httpErrors: [], providerRequests: [], blockedWrites: [] };
    result.rows.push(row);
    await context.route('**/*', async route => {
      const request = route.request();
      if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method())) {
        row.blockedWrites.push({ method: request.method(), url: request.url() });
        await route.abort('blockedbyclient');
      } else await route.continue();
    });
    await context.addInitScript(() => localStorage.setItem('ppw_designer_coach_v1', '1'));
    const page = await context.newPage();
    page.on('pageerror', error => row.pageErrors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') row.consoleErrors.push(message.text()); });
    page.on('response', response => { if (response.status() >= 400) row.httpErrors.push({ url: response.url(), status: response.status() }); });
    page.on('request', request => { if (/\/api\/site(?:\/|\?)|openfreemap\.org|photon\.komoot\.io|overpass-api\.de|re\.jrc\.ec\.europa\.eu|elevation-tiles-prod/.test(request.url())) row.providerRequests.push(request.url()); });
    try {
      const health = await page.goto(`${origin}/api/healthcheck`, { timeout: 30000 });
      row.healthcheck = await health.json();
      if (row.healthcheck.env !== 'preview' || !JSON.stringify(row.healthcheck).includes(expectedSha)) throw Error('Preview health does not match the required environment and commit.');
      await page.goto(`${origin}/demo?view=2d&pitch=1&site=1`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.getByRole('button', { name: 'Site from the map', exact: true }).click({ timeout: 45000 });
      await page.locator('.site-workspace').waitFor({ timeout: 30000 });
      await page.getByRole('button', { name: '3. Report', exact: true }).click();
      const screenState = () => page.locator('.site-report-print-footer').evaluate(element => {
        const style = getComputedStyle(element);
        return { text: element.textContent, position: style.position, margin: style.margin, padding: style.padding, fontSize: style.fontSize,
          bannerCount: element.closest('.site-report').querySelectorAll('.site-banner').length,
          overflowPx: Math.max(0, document.documentElement.scrollWidth - innerWidth) };
      });
      row.screenBefore = await screenState();
      await page.screenshot({ path: path.join(output, `screen-${name}.jpg`), type: 'jpeg', quality: 72 });
      await page.evaluate(() => { window.print = () => { window.__sitePrintActive = document.body.classList.contains('printing-site'); }; });
      await page.getByRole('button', { name: 'Print / save PDF', exact: true }).click();
      row.printButtonLifecycle = await page.evaluate(() => window.__sitePrintActive === true && !document.body.classList.contains('printing-site'));
      await page.evaluate(() => document.body.classList.add('printing-site'));
      const pdf = path.join(output, `report-${name}-a4.pdf`);
      try { await page.pdf({ path: pdf, format: 'A4', preferCSSPageSize: true, printBackground: true }); }
      finally { await page.evaluate(() => document.body.classList.remove('printing-site')); }
      row.screenAfter = await screenState();
      row.screenUnchanged = JSON.stringify(row.screenBefore) === JSON.stringify(row.screenAfter) && row.screenBefore.position === 'static' && row.screenBefore.bannerCount === 2 && row.screenBefore.overflowPx === 0;
      row.pdf = await inspectSiteReportPdf(pdf, row.screenBefore.text, args.get('--python'));
      await page.emulateMedia({ media: 'print' });
      row.inactivePageName = await page.locator('.site-backdrop').evaluate(element => getComputedStyle(element).page);
      await page.emulateMedia({ media: 'screen' });
      const prefix = path.join(output, `page-${name}`);
      const { stderr } = await run(args.get('--pdftoppm') || 'pdftoppm', ['-scale-to', '1400', '-png', pdf, prefix], { maxBuffer: 4 * 1024 * 1024 });
      row.renderWarnings = stderr.trim();
      row.renderedPages = (await fs.readdir(output)).filter(file => file.startsWith(`page-${name}-`) && file.endsWith('.png')).sort();
      row.passed = row.printButtonLifecycle && row.screenUnchanged && row.inactivePageName === 'auto' && row.pdf.passed && row.pdf.pages.length > 1 && row.renderedPages.length === row.pdf.pages.length && row.pageErrors.length === 0 && row.consoleErrors.length === 0 && row.httpErrors.length === 0 && row.providerRequests.length === 0 && row.blockedWrites.length === 0;
    } catch (error) { row.error = String(error); row.passed = false; }
    finally { await context.close(); }
  }
} catch (error) { result.error = String(error); }
finally {
  await browser.close();
  result.automatedPassed = !result.error && result.rows.length === 2 && result.rows.every(row => row.passed);
  await fs.writeFile(path.join(output, 'print-check.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result, null, 2));
  if (!result.automatedPassed) process.exitCode = 1;
}
