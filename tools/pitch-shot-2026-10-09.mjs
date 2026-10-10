/** Local, read-only pitch QA. No authentication bypass, forms, orders or publishing.
 * Usage: node tools/pitch-shot-2026-10-09.mjs [http://127.0.0.1:5173]
 */
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const origin = process.argv[2] ?? 'http://127.0.0.1:5173';
const url = new URL(origin);
if (!['127.0.0.1', 'localhost'].includes(url.hostname)) throw new Error('This audit only runs against a local preview.');
const destination = path.resolve('docs/qa-2026-10-09');
const auditDate = '2026-10-10';
await fs.mkdir(destination, { recursive: true });
const routes = [
  { key: 'plumbing', path: '/pitch/plumbing', tabs: ['Your catalogue', 'Work together'] },
  { key: 'construction', path: '/pitch/construction', sections: ['foundation', 'plumbing'] },
  { key: 'merchants', path: '/pitch/merchants' },
  { key: 'developers', path: '/pitch/developers' },
  { key: 'employees', path: '/studio/sales', tabs: ['Demo lab', 'All links'] },
];
const results = [];
const browser = await chromium.launch({ headless: true });
try {
  for (const size of [{ key: 'desktop', width: 1280, height: 900 }, { key: 'phone', width: 390, height: 844 }]) {
    for (const route of routes) {
      const context = await browser.newContext({ viewport: { width: size.width, height: size.height }, deviceScaleFactor: 1,
        isMobile: size.key === 'phone', hasTouch: size.key === 'phone', reducedMotion: 'reduce' });
      const page = await context.newPage();
      const entry = { route: route.path, viewport: size, consoleErrors: [], pageErrors: [], requestFailures: [], httpFailures: [], screenshotRetries: [], shots: [], checks: [], authGate: false };
      page.on('console', message => { if (message.type() === 'error') entry.consoleErrors.push(message.text()); });
      page.on('pageerror', error => entry.pageErrors.push(error.message));
      page.on('requestfailed', request => entry.requestFailures.push({ url: request.url(), error: request.failure()?.errorText }));
      page.on('response', response => { if (response.status() >= 400) entry.httpFailures.push({ url: response.url(), status: response.status() }); });
      const capture = async name => {
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(350);
        const file = `pitch-${route.key}-${size.key}-${name}.png`;
        try {
          await page.screenshot({ path: path.join(destination, file), animations: 'disabled', timeout: 30000 });
        } catch (error) {
          if (error.name !== 'TimeoutError') throw error;
          entry.screenshotRetries.push({ state: name, error: String(error) });
          await page.screenshot({ path: path.join(destination, file), animations: 'disabled', timeout: 60000 });
        }
        entry.shots.push(file);
        entry.checks.push({ state: name, ...await page.evaluate(() => ({
          horizontalOverflowPx: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
          title: document.title,
          headings: [...document.querySelectorAll('h1,h2')].filter(element => element.getBoundingClientRect().height > 0).map(element => element.textContent?.trim()),
          brokenImages: [...document.images].filter(image => image.complete && image.naturalWidth === 0).map(image => image.getAttribute('src')),
          visibleDialogs: [...document.querySelectorAll('[role="dialog"]')].filter(element => element.getBoundingClientRect().height > 0).map(element => element.textContent?.slice(0, 120)),
        })) });
      };
      try {
        await page.goto(new URL(route.path, origin).href, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.locator('body').waitFor({ state: 'visible' });
        await page.waitForTimeout(1600);
        entry.authGate = await page.getByText('Studio access code', { exact: false }).count() > 0;
        await capture(entry.authGate ? 'access-gate' : 'overview');
        if (!entry.authGate) {
          for (const tab of route.tabs ?? []) {
            await page.getByRole('tab', { name: tab, exact: false }).click();
            await capture(tab.toLowerCase().replaceAll(' ', '-'));
          }
          for (const section of route.sections ?? []) {
            const locator = page.locator(`#${section}`);
            await locator.scrollIntoViewIfNeeded();
            // Capture the section beginning using a real viewport scroll, not DOM/CSS changes.
            await page.evaluate(id => { const node = document.getElementById(id); if (node) window.scrollTo(0, node.getBoundingClientRect().top + window.scrollY); }, section);
            await capture(section);
          }
        }
      } catch (error) {
        entry.auditError = String(error);
        await capture('audit-error').catch(() => {});
      } finally {
        results.push(entry);
        await context.close();
      }
      console.log(`${route.key} ${size.width}px: ${entry.shots.length} captures; ${entry.consoleErrors.length} console errors; ${entry.pageErrors.length} page errors; gate=${entry.authGate}`);
    }
  }
} finally { await browser.close(); }
await fs.writeFile(path.join(destination, 'pitch-browser-results.json'), JSON.stringify({ date: auditDate, capturedAt: new Date().toISOString(), origin, results }, null, 2));
const rows = results.map(entry => `| ${entry.route} | ${entry.viewport.width} | ${entry.authGate ? 'Access gate; not bypassed' : entry.auditError ? 'Audit error' : 'Loaded'} | ${Math.max(0, ...entry.checks.map(check => check.horizontalOverflowPx))} | ${entry.consoleErrors.length} | ${entry.pageErrors.length} | ${entry.httpFailures.length} |`).join('\n');
const issues = results.flatMap(entry => [
  ...(entry.auditError ? [`- ${entry.route} ${entry.viewport.width}px: ${entry.auditError}`] : []),
  ...entry.pageErrors.map(error => `- ${entry.route} ${entry.viewport.width}px page error: ${error}`),
  ...entry.consoleErrors.map(error => `- ${entry.route} ${entry.viewport.width}px console error: ${error}`),
  ...entry.httpFailures.map(failure => `- ${entry.route} ${entry.viewport.width}px HTTP ${failure.status}: ${failure.url}`),
  ...entry.screenshotRetries.map(retry => `- ${entry.route} ${entry.viewport.width}px ${retry.state}: initial screenshot timed out; a longer capture retry was attempted. See JSON for capture diagnostics.`),
]);
await fs.writeFile(path.join(destination, 'PITCH-QA.md'), `# Local pitch visual QA — 10 October 2026\n\nLocal preview: ${origin}. These are built-app screenshots, not proof of a live deployment. No authentication bypass, form submission, order or publishing action was performed. A local preview does not validate deployed middleware or backend availability.\n\n| Route | Width | Outcome | Horizontal overflow px | Console errors | Page errors | HTTP failures |\n|---|---:|---|---:|---:|---:|---:|\n${rows}\n\n## Captures\n\n${results.flatMap(entry => entry.shots.map(file => `- [${file}](./${file}) - Room Designer: ${entry.route.includes('plumbing') ? 'plumbing suppliers and installers' : entry.route.includes('construction') ? 'construction companies and estimators' : entry.route.includes('merchants') ? 'merchants and retailers' : entry.route.includes('developers') ? 'property developers' : 'employee training and sales'}.`)).join('\n')}\n\n## Browser findings\n\n${issues.length ? issues.join('\n') : 'No page errors, console errors or HTTP failures were recorded.'}\n\nVisual inspection notes are recorded separately after inspecting the PNGs.\n`);
