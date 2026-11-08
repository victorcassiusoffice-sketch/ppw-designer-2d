// Quick look at the lessons layer while building it: the quest offer on an
// empty plan, then a first tool pick, at a given size. Writes PNGs and prints
// the card and protected-area rectangles. Every non-GET request is blocked.
//   node tools/lessons/look-2026-11-08.mjs <base> <outDir> <w> <h> <touch 0|1> [tool testid] [category]
import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

const [base = 'http://127.0.0.1:5181', out = 'tmp-look', w = '1280', h = '800', touch = '0', tool = 'door-tool-toggle', cat = 'Build'] = process.argv.slice(2);
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: +w, height: +h }, hasTouch: touch === '1', isMobile: touch === '1' });
await ctx.route('**/*', (r) => (r.request().method() === 'GET' ? r.continue() : r.abort()));
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(`pageerror ${e.message}`));
await page.goto(`${base}/designer`, { waitUntil: 'domcontentloaded' });
await page.locator('.konvajs-content canvas').first().waitFor({ timeout: 60000 });
await page.locator('[data-lessons-quest]').first().waitFor({ timeout: 20000 }).catch(() => {});
await page.waitForTimeout(600);
await page.screenshot({ path: path.join(out, `${w}x${h}-1-offer.png`) });
await page.getByTestId('start-quick-rectangle').first().click();
await page.waitForTimeout(500);
await page.getByRole('button', { name: cat, exact: true }).first().click();
await page.getByTestId(tool).first().click();
await page.locator('[data-lesson-card]').first().waitFor({ timeout: 10000 }).catch(() => {});
await page.waitForTimeout(900);
await page.screenshot({ path: path.join(out, `${w}x${h}-2-card-${tool}.png`) });
const rects = await page.evaluate(() => {
  const r = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.width), Math.round(b.height)]; };
  return {
    card: r(document.querySelector('[data-lesson-card]')),
    quest: r(document.querySelector('[data-lessons-quest]')),
    huds: [...document.querySelectorAll('[data-testid$="-hud"], [data-testid="sims-bottom-toolbar"], [data-testid="sims-dock"]')].map((el) => [el.getAttribute('data-testid'), r(el)]).filter((x) => x[1] && x[1][2] > 0),
  };
});
console.log(JSON.stringify(rects));
console.log('errors', JSON.stringify(errors.slice(0, 5)));
await browser.close();
