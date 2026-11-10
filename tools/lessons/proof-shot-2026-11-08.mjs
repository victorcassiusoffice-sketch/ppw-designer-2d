// Proof sheet captures for the lessons (game programme part 2, 8 Nov 2026):
// six tool cards on desktop (1280 x 800) and phone (390 x 844), the quest
// offer and list, the Lessons list, a tooltip, a loading tip, the 313 x 567
// phone, and a recording of the first-build quest from an empty plan to the
// walk (cut to about 20 s). Needs the dev server (DEV-only geometry bridge).
// Every non-GET request is blocked. Console errors are counted per page.
//   node tools/lessons/proof-shot-2026-11-08.mjs <devBase> <outDir>
import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import { CLEAN_DESIGNER, cleanContext, waitClean, dirtyText } from './demo-clean-2026-11-08.mjs';

const base = process.argv[2] ?? 'http://127.0.0.1:5181';
const out = path.resolve(process.argv[3] ?? 'proof');
await fs.mkdir(out, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const report = { base, at: new Date().toISOString(), shots: [], consoleErrors: [], failedRequests: [], blockedWrites: 0, dirty: [] };

const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });

async function context(device, extra = {}) {
  const phone = device !== 'desktop';
  const size = device === 'desktop' ? { width: 1280, height: 800 } : device === 'phone' ? { width: 390, height: 844 } : { width: 313, height: 567 };
  const ctx = await browser.newContext({ viewport: size, hasTouch: phone, isMobile: phone, deviceScaleFactor: phone ? 2 : 1, ...extra });
  await cleanContext(ctx);
  await ctx.route('**/*', (route) => {
    if (route.request().method() === 'GET') return route.continue();
    report.blockedWrites += 1;
    return route.abort();
  });
  const page = await ctx.newPage();
  page.on('console', (m) => {
    if (m.type() === 'error') report.consoleErrors.push({ device, url: page.url(), text: m.text().slice(0, 300) });
  });
  page.on('requestfailed', (r) => {
    if (r.request().method() === 'GET') report.failedRequests.push({ device, url: r.url().slice(0, 200), error: r.failure()?.errorText });
  });
  return { ctx, page, phone };
}
async function open(page) {
  await page.goto(`${base}${CLEAN_DESIGNER}`, { waitUntil: 'domcontentloaded' });
  await page.locator('.konvajs-content canvas').first().waitFor({ timeout: 60000 });
  await waitClean(page);
  await page.locator('[data-lessons-quest]').first().waitFor({ timeout: 20000 });
  await sleep(400);
}
async function tapOrClick(locator, phone) {
  if (phone) await locator.tap();
  else await locator.click();
}
async function shot(page, name, device) {
  await sleep(700);
  const file = path.join(out, `${name}.png`);
  await page.screenshot({ path: file });
  const overflowX = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  const dirty = await dirtyText(page);
  if (dirty.length) report.dirty.push({ name, dirty });
  report.shots.push({ name, device, overflowX, clean: dirty.length === 0 });
}

const CARDS = [
  { id: 'walls', cat: 'Build', testid: 'wall-tool-toggle' },
  { id: 'door', cat: 'Build', testid: 'door-tool-toggle' },
  { id: 'floor', cat: 'Finish', testid: 'floor-paint-toggle' },
  { id: 'wallpaint', cat: 'Finish', testid: 'wallpaint-tool-toggle' },
  { id: 'furnish', furnish: true },
  { id: 'view3d', view3d: true },
];

for (const device of ['desktop', 'phone']) {
  for (const card of CARDS) {
    const { ctx, page, phone } = await context(device);
    await open(page);
    await tapOrClick(page.getByTestId('start-quick-rectangle').first(), phone);
    await sleep(400);
    if (card.cat) {
      await tapOrClick(page.getByRole('button', { name: card.cat, exact: true }).first(), phone);
      await tapOrClick(page.getByTestId(card.testid).first(), phone);
    } else if (card.furnish) {
      await tapOrClick(page.getByTestId(phone ? 'sims-catalog-open' : 'dock-catalog-open').first(), phone);
    } else if (card.view3d) {
      await tapOrClick(page.getByRole('button', { name: '3D House', exact: true }).first(), phone);
      await page.locator('[data-first-picture-ms]').first().waitFor({ timeout: 90000 });
    }
    await tapOrClick(page.locator(`[data-lesson-chip="${card.id}"]`), phone);
    await page.locator(`[data-lesson-card="${card.id}"]`).waitFor({ timeout: 20000 });
    await sleep(card.view3d ? 1500 : 900);
    await shot(page, `${device}-card-${card.id}`, device);
    await ctx.close();
  }
  // The quest offer, the quest list, the Lessons list.
  {
    const { ctx, page, phone } = await context(device);
    await open(page);
    await tapOrClick(page.locator('[data-lessons-quest="offer-chip"]'), phone);
    await shot(page, `${device}-quest-offer`, device);
    await tapOrClick(page.locator('[data-lessons-quest="offer"]').getByRole('button', { name: 'Start', exact: true }), phone);
    await shot(page, `${device}-quest-list`, device);
    await tapOrClick(page.locator('[data-lessons-quest="panel"]').getByRole('button', { name: 'Hide', exact: true }), phone);
    // On a phone the ? button hides while the wall pen is open (an empty plan):
    // a room puts the pen away.
    if (phone) {
      await tapOrClick(page.getByTestId('start-quick-rectangle').first(), phone);
      await sleep(600);
    }
    await tapOrClick(page.getByRole('button', { name: 'Open keyboard shortcuts help' }).first(), phone);
    await page.locator('[data-lessons-list]').waitFor({ timeout: 20000 });
    await shot(page, `${device}-lessons-list`, device);
    await ctx.close();
  }
}

// A tooltip (desktop hover) and a loading tip (a 3D load after the lessons are in).
{
  const { ctx, page } = await context('desktop');
  await open(page);
  await page.getByTestId('start-quick-rectangle').first().click();
  await page.getByRole('button', { name: 'Arrange', exact: true }).first().click();
  await page.getByTestId('measure-tool-toggle').first().hover();
  await page.locator('[data-lessons-tooltip]').waitFor({ timeout: 5000 });
  await shot(page, 'desktop-tooltip-measure', 'desktop');
  await page.mouse.move(640, 600);
  // The 3D module: assets/ThreeStage-*.js in a build, src/components/three/ThreeStage.tsx on the dev server.
  await page.route('**/*ThreeStage*', async (route) => {
    await sleep(2500);
    await route.continue();
  });
  await page.getByRole('button', { name: '3D House', exact: true }).first().click();
  await page.locator('[data-lessons-loading-tip]').waitFor({ timeout: 15000 }).catch(() => {});
  await shot(page, 'desktop-loading-tip', 'desktop');
  await ctx.close();
}

// The 360 phone at 115 % text: Floor and Wall paint.
for (const [cat, testid, id] of [
  ['Finish', 'floor-paint-toggle', 'floor'],
  ['Finish', 'wallpaint-tool-toggle', 'wallpaint'],
]) {
  const { ctx, page } = await context('small');
  await open(page);
  await page.getByTestId('start-quick-rectangle').first().tap();
  await page.getByRole('button', { name: cat, exact: true }).first().tap();
  await page.getByTestId(testid).first().tap();
  await page.locator(`[data-lesson-chip="${id}"]`).tap();
  await page.locator(`[data-lesson-card="${id}"]`).waitFor({ timeout: 20000 });
  await shot(page, `small-card-${id}`, 'small');
  await ctx.close();
}

await fs.writeFile(path.join(out, 'proof-report.json'), JSON.stringify(report, null, 2));
await browser.close();
console.log(`${report.shots.length} shots · console errors ${report.consoleErrors.length} · failed GETs ${report.failedRequests.length} · blocked writes ${report.blockedWrites} · shots with a price or shop name ${report.dirty.length}`);
for (const d of report.dirty) console.log('dirty', d.name, d.dirty.join(' | '));
for (const e of report.consoleErrors.slice(0, 6)) console.log('error', e.device, e.text);
for (const f of report.failedRequests.slice(0, 6)) console.log('failed', f.device, f.url, f.error);
