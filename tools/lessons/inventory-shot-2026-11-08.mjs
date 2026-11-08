// Lessons inventory (8 Nov 2026): where each tool and mode is picked today,
// at 1280 x 800 and 390 x 844, one screenshot per pick. Read-only: every
// non-GET request is blocked. Usage:
//   node tools/lessons/inventory-shot-2026-11-08.mjs <base> <outDir>
import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import { CLEAN_DESIGNER, cleanContext, waitClean, dirtyText } from './demo-clean-2026-11-08.mjs';

const base = process.argv[2] ?? 'http://127.0.0.1:5181';
const out = process.argv[3] ?? 'docs/lessons/inventory';
const only = process.argv[4] ? new Set(process.argv[4].split(',')) : null;
await fs.mkdir(out, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});

/** One row per pick. `cat` = the plan tool shelf category; `room` = draw a 5 x 4 m room first. */
const PICKS = [
  { id: 'select', cat: 'Build', testid: 'select-tool-toggle', room: true },
  { id: 'walls', cat: 'Build', testid: 'wall-tool-toggle', room: true },
  { id: 'room-box', cat: 'Build', name: 'Room — Box', room: true },
  { id: 'door', cat: 'Build', testid: 'door-tool-toggle', room: true },
  { id: 'floor', cat: 'Finish', testid: 'floor-paint-toggle', room: true },
  { id: 'wallpaint', cat: 'Finish', testid: 'wallpaint-tool-toggle', room: true },
  { id: 'cladding', cat: 'Finish', testid: 'cladding-tool-toggle', room: true },
  { id: 'measure', cat: 'Arrange', testid: 'measure-tool-toggle', room: true },
  { id: 'remove', cat: 'Arrange', testid: 'remove-tool-toggle', room: true },
  { id: 'eyedropper', key: 'e', room: true },
  { id: 'garden', cat: 'Build', testid: 'plan-garden-toggle', room: true },
  { id: 'furnish', furnish: true, room: true },
  { id: 'view3d', view3d: true, room: true },
  { id: 'walk', walk: true, room: true },
  { id: 'help', help: true, room: true },
];

const report = { base, at: new Date().toISOString(), rows: [], errors: [] };

for (const [width, height, phone] of [
  [1280, 800, false],
  [390, 844, true],
]) {
  const device = phone ? 'phone' : 'desktop';
  for (const pick of PICKS) {
    if (only && !only.has(`${phone ? 'phone' : 'desktop'}-${pick.id}`)) continue;
    const ctx = await browser.newContext({ viewport: { width, height }, hasTouch: phone, isMobile: phone, deviceScaleFactor: 1 });
    await cleanContext(ctx);
    await ctx.route('**/*', (route) => (route.request().method() === 'GET' ? route.continue() : route.abort()));
    const page = await ctx.newPage();
    page.on('pageerror', (e) => report.errors.push({ device, pick: pick.id, message: e.message }));
    const row = { device, id: pick.id, title: null, note: null, ok: true, dirty: [] };
    try {
      await page.goto(`${base}${CLEAN_DESIGNER}`, { waitUntil: 'domcontentloaded' });
      await page.locator('.konvajs-content canvas').first().waitFor({ timeout: 60000 });
      await waitClean(page);
      await page.waitForTimeout(600);
      if (pick.room) {
        await page.getByTestId('start-quick-rectangle').first().click();
        await page.waitForTimeout(500);
      }
      if (pick.cat) {
        await page.getByRole('button', { name: pick.cat, exact: true }).first().click();
        await page.waitForTimeout(250);
        const button = pick.testid
          ? page.getByTestId(pick.testid).first()
          : page.getByRole('button', { name: pick.name, exact: true }).first();
        row.title = await button.getAttribute('title');
        await button.click();
      } else if (pick.key) {
        await page.locator('.konvajs-content').first().hover();
        await page.keyboard.press(pick.key);
        row.note = `key ${pick.key.toUpperCase()}`;
      } else if (pick.furnish) {
        await page.getByTestId(phone ? 'sims-catalog-open' : 'dock-catalog-open').first().click();
      } else if (pick.view3d || pick.walk) {
        const button = page.getByRole('button', { name: '3D House', exact: true }).first();
        row.title = await button.getAttribute('title');
        await button.click();
        await page.locator('[data-first-picture-ms]').first().waitFor({ timeout: 90000 }).catch(() => { row.note = 'no first picture in 90 s'; });
        await page.waitForTimeout(800);
        if (pick.walk) {
          const walk = page.getByRole('button', { name: 'Open Walk mode' }).first();
          await walk.waitFor({ timeout: 60000 });
          await walk.click();
          await page.getByTestId('walk-chooser').waitFor({ timeout: 60000 });
        }
      } else if (pick.help) {
        await page.getByRole('button', { name: 'Open keyboard shortcuts help' }).first().click();
      }
      await page.waitForTimeout(700);
      const ui = await page.evaluate(() => {
        const tool = document.querySelector('[data-testid="plan-active-tool"]');
        return { activeTool: tool?.textContent?.trim() ?? null, overflowX: document.documentElement.scrollWidth > innerWidth };
      });
      Object.assign(row, ui);
    } catch (error) {
      row.ok = false;
      row.note = String(error.message).split('\n')[0];
    }
    row.dirty = await dirtyText(page);
    if (row.dirty.length) row.ok = false;
    await page.screenshot({ path: path.join(out, `${device}-${pick.id}.jpg`), type: 'jpeg', quality: 62 });
    report.rows.push(row);
    await ctx.close();
  }
}
await browser.close();
await fs.writeFile(path.join(out, only ? 'inventory-report-rerun.json' : 'inventory-report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report.rows.map((r) => `${r.device} ${r.id} ok=${r.ok} active=${r.activeTool} ${r.note ?? ''}${r.dirty.length ? ` DIRTY ${r.dirty.join(' | ')}` : ''}`), null, 1));
console.log('errors', report.errors.length);
