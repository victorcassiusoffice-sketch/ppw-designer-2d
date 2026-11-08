// Smoke of the lessons on a deployed build (preview or production), at
// 1280 x 800 and 390 x 844: the plan demo and the 3D demo open without the
// studio code; the lessons load after the first picture; a first tool pick
// shows its card; the ? panel opens on its Lessons tab. Counts console
// errors, page errors, failed GET requests and blocked writes (every non-GET
// request is blocked). *.vercel.app hosts are pinned to 216.198.79.3.
//   node tools/lessons/preview-smoke-2026-11-08.mjs <base> <outDir>
import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

const base = (process.argv[2] ?? '').replace(/\/$/, '');
const out = path.resolve(process.argv[3] ?? 'smoke');
if (!/^(https:\/\/|http:\/\/127\.0\.0\.1:)/.test(base)) throw new Error('Give the https base URL of a deployed build (or http://127.0.0.1:<port> for a local check)');
await fs.mkdir(out, { recursive: true });
const host = new URL(base).hostname;
const pin = host.endsWith('.vercel.app') ? [`--host-resolver-rules=MAP ${host} 216.198.79.3`] : [];
const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', ...pin] });
const report = { base, at: new Date().toISOString(), runs: [] };

for (const device of ['desktop', 'phone']) {
  const phone = device === 'phone';
  const ctx = await browser.newContext({
    viewport: phone ? { width: 390, height: 844 } : { width: 1280, height: 800 },
    hasTouch: phone,
    isMobile: phone,
  });
  const run = { device, consoleErrors: [], pageErrors: [], failedRequests: [], httpErrors: [], blockedWrites: 0, checks: {} };
  await ctx.route('**/*', (route) => {
    if (route.request().method() === 'GET' || route.request().method() === 'HEAD') return route.continue();
    run.blockedWrites += 1;
    return route.abort('blockedbyclient');
  });
  const page = await ctx.newPage();
  page.on('console', (m) => {
    if (m.type() === 'error') run.consoleErrors.push(m.text().slice(0, 300));
  });
  page.on('pageerror', (e) => run.pageErrors.push(String(e).slice(0, 300)));
  page.on('requestfailed', (r) => {
    if (['GET', 'HEAD'].includes(r.request().method())) run.failedRequests.push(`${r.url().slice(0, 160)} ${r.failure()?.errorText}`);
  });
  page.on('response', (r) => {
    if (r.status() >= 400) run.httpErrors.push(`${r.status()} ${r.url().slice(0, 160)}`);
    // A clip or poster must come back as a video or a picture, never as the code page.
    if (r.url().includes('/lessons/')) {
      const type = r.headers()['content-type'] ?? '';
      run.lessonFiles = (run.lessonFiles ?? 0) + 1;
      if (!/^(video|image)\//.test(type)) run.httpErrors.push(`not a clip (${type}) ${r.url().slice(0, 160)}`);
    }
  });
  const tap = (locator) => (phone ? locator.tap() : locator.click());
  try {
    // Plan demo: the lessons load after the first picture.
    await page.goto(`${base}/demo?view=2d&pitch=1`, { waitUntil: 'domcontentloaded' });
    await page.locator('.konvajs-content canvas').first().waitFor({ timeout: 60000 });
    await page.locator('[data-lessons-live]').waitFor({ state: 'attached', timeout: 30000 });
    run.checks.lessonsLoaded = true;
    await tap(page.getByRole('button', { name: 'Finish', exact: true }).first());
    await tap(page.getByTestId('floor-paint-toggle').first());
    await page.locator('[data-lesson-card="floor"]').waitFor({ timeout: 15000 });
    run.checks.floorCard = true;
    await page.waitForTimeout(800);
    // The clip plays (desktop) or its poster shows (phone, compact card: no media).
    run.checks.clip = await page.evaluate(() => {
      const media = document.querySelector('[data-lesson-card="floor"] .lessons-card__media');
      if (!media) return 'no media in this card size';
      if (media instanceof HTMLVideoElement) return media.readyState >= 2 ? 'playing' : `readyState ${media.readyState}`;
      return media instanceof HTMLImageElement && media.naturalWidth > 0 ? 'poster' : 'poster missing';
    });
    await page.screenshot({ path: path.join(out, `${device}-plan-floor-card.png`) });
    await tap(page.locator('[data-lesson-card="floor"]').getByRole('button', { name: 'Got it' }));
    await tap(page.getByRole('button', { name: 'Done', exact: true }).first()).catch(() => page.keyboard.press('Escape'));
    await page.waitForTimeout(400);
    const help = page.getByRole('button', { name: 'Open keyboard shortcuts help' }).first();
    if (await help.isVisible().catch(() => false)) {
      await tap(help);
      await page.locator('[data-lessons-list]').waitFor({ timeout: 15000 });
      run.checks.lessonsList = true;
      await page.screenshot({ path: path.join(out, `${device}-lessons-list.png`) });
      await page.keyboard.press('Escape');
    } else {
      run.checks.lessonsList = 'help button hidden in this state';
    }
    // 3D demo: first picture, then the lessons.
    await page.goto(`${base}/demo?view=3d&pitch=1`, { waitUntil: 'domcontentloaded' });
    await page.locator('[data-first-picture-ms]').first().waitFor({ timeout: 90000 });
    await page.locator('[data-lessons-live]').waitFor({ state: 'attached', timeout: 30000 });
    run.checks.threeD = true;
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(out, `${device}-3d.png`) });
    run.overflowX = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  } catch (error) {
    run.fatal = String(error.message).split('\n')[0];
  }
  report.runs.push(run);
  await ctx.close();
}
await browser.close();
await fs.writeFile(path.join(out, 'smoke-report.json'), JSON.stringify(report, null, 2));
for (const r of report.runs) {
  console.log(
    `${r.device}: checks ${JSON.stringify(r.checks)} · lesson files ${r.lessonFiles ?? 0} · console errors ${r.consoleErrors.length} · page errors ${r.pageErrors.length} · failed GETs ${r.failedRequests.length} · http>=400 ${r.httpErrors.length} · blocked writes ${r.blockedWrites}${r.fatal ? ` · FATAL ${r.fatal}` : ''}`,
  );
  for (const e of [...r.consoleErrors, ...r.pageErrors, ...r.failedRequests, ...r.httpErrors].slice(0, 5)) console.log('  ', e);
}
