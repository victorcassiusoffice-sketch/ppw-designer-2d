// Measures the free canvas band between the top chrome and the bottom HUD/bar
// on a phone, per tool. Usage: node tools/lessons/measure-phone-band.mjs <base>
import { chromium } from '@playwright/test';
const base = process.argv[2] ?? 'http://127.0.0.1:5181';
const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
for (const [w, h] of [[390, 844], [313, 567]]) {
  for (const tool of [null, ['Finish', 'floor-paint-toggle'], ['Build', 'door-tool-toggle'], ['Finish', 'wallpaint-tool-toggle']]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true });
    await ctx.route('**/*', (r) => (r.request().method() === 'GET' ? r.continue() : r.abort()));
    const page = await ctx.newPage();
    await page.goto(`${base}/designer`, { waitUntil: 'domcontentloaded' });
    await page.locator('.konvajs-content canvas').first().waitFor({ timeout: 60000 });
    await page.waitForTimeout(500);
    await page.getByTestId('start-quick-rectangle').first().click();
    await page.waitForTimeout(400);
    if (tool) { await page.getByRole('button', { name: tool[0], exact: true }).first().click(); await page.getByTestId(tool[1]).first().click(); await page.waitForTimeout(500); }
    const m = await page.evaluate(() => {
      const canvas = document.querySelector('.konvajs-content')?.getBoundingClientRect();
      const sel = ['floor-paint-hud', 'cladding-hud', 'wallpaint-hud', 'door-hud', 'remove-hud', 'sims-bottom-toolbar'];
      const bottoms = sel.map((id) => { const el = document.querySelector(`[data-testid="${id}"]`); const r = el?.getBoundingClientRect(); return r && r.height > 0 ? [id, Math.round(r.top), Math.round(r.bottom)] : null; }).filter(Boolean);
      const header = document.querySelector('.plan-topbar, header')?.getBoundingClientRect();
      return { canvasTop: Math.round(canvas?.top ?? -1), canvasBottom: Math.round(canvas?.bottom ?? -1), headerBottom: Math.round(header?.bottom ?? -1), bottoms, vh: innerHeight };
    });
    console.log(w, h, tool?.[1] ?? 'none', JSON.stringify(m));
    await ctx.close();
  }
}
await browser.close();
