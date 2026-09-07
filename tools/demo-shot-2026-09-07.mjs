// Opens /designer?demo=<slug> on a dev server or deploy, waits for the plan,
// arms the Paint tool so the tin line shows, and saves desktop + phone frames.
//   node tools/demo-shot-2026-09-07.mjs <base> <slug> <outDir>
import { chromium, devices } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';
const [base, slug, outDir] = process.argv.slice(2);
if (!base || !slug || !outDir) throw new Error('usage: base slug outDir');
fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch();
async function shot(ctxOpts, name) {
  const ctx = await browser.newContext(ctxOpts);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 160)); });
  await page.addInitScript(() => { try { sessionStorage.clear(); localStorage.setItem('ppw_designer_coach_v1', '1'); } catch {} });
  await page.goto(`${base}/designer?demo=${slug}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.konvajs-content canvas', { state: 'attached', timeout: 30_000 });
  await page.waitForTimeout(1500);
  const pill = await page.locator('[data-testid="demo-pill"]').textContent().catch(() => null);
  const items = await page.locator('[data-testid="items-placed"]').textContent().catch(() => null);
  const rooms = await page.evaluate(() => { try { const s = JSON.parse(localStorage.getItem('ppw_property_v2') || '{}'); return (s.state?.property?.rooms || []).map((r) => ({ id: r.id, paint: (r.wallPaint || []).length, items: (r.placedItems || []).length })); } catch { return null; } });
  await page.screenshot({ path: path.join(outDir, `${slug}-${name}-plan.png`), fullPage: false });
  // Arm the Paint tool (desktop toolbar button "Wall paint") so the panel + litres line show.
  const paintBtn = page.getByRole('button', { name: /wall paint/i }).first();
  if (await paintBtn.isVisible().catch(() => false)) {
    await paintBtn.click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(outDir, `${slug}-${name}-paint.png`), fullPage: false });
  }
  const paintText = await page.locator('[data-testid^="wallpaint"], [data-testid*="paint"]').allTextContents().catch(() => []);
  await ctx.close();
  return { name, pill, items, rooms, errors, paintText: paintText.slice(0, 6) };
}
const desktop = await shot({ viewport: { width: 1366, height: 800 } }, 'desktop-1366');
const phone = await shot({ ...devices['iPhone 12'], viewport: { width: 390, height: 844 } }, 'phone-390');
console.log(JSON.stringify({ desktop, phone }, null, 1));
await browser.close();
