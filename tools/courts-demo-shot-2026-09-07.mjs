// Courts show home — render check (2026-09-07).
// Opens /designer?demo=courts on a dev server or the branch preview, waits
// for the canvas, screenshots desktop + phone, counts placed items on the
// canvas via the persisted property, reads the cart total and the energy
// chip, and lists console errors.
//
//   node tools/courts-demo-shot-2026-09-07.mjs [baseUrl] [outDir]
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const base = process.argv[2] ?? 'http://127.0.0.1:5188';
const out = process.argv[3] ?? path.resolve('docs/sims-world-2026-08-29/courts-mammouth-2026-09-05/captures');
fs.mkdirSync(out, { recursive: true });

async function shoot(name, viewport, mobile) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.addInitScript(() => { try { localStorage.clear(); sessionStorage.clear(); localStorage.setItem('ppw_designer_coach_v1', '1'); } catch { /* fresh profile */ } });
  await page.goto(`${base}/designer?demo=courts`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.konvajs-content canvas', { state: 'attached', timeout: 60_000 });
  await page.waitForTimeout(2500);
  const stored = await page.evaluate(() => {
    const raw = localStorage.getItem('ppw_property_v2');
    const p = raw ? JSON.parse(raw).state.property : null;
    return p ? { name: p.name, rooms: p.rooms.map((r) => ({ id: r.id, items: r.placedItems.length, openings: (r.openings ?? []).length })) } : null;
  });
  const pill = await page.locator('[data-testid="demo-pill"]').first().textContent().catch(() => null);
  const cart = await page.locator('[data-testid="cart-pill"]').first().textContent().catch(() => null);
  const energy = await page.locator('[data-testid="energy-readout"]').first().textContent().catch(() => null);
  const tabs = await page.locator('[data-testid^="dock-cat-"]').allTextContents().catch(() => []);
  const tiles = await page.locator('[data-product-id^="courts-"]').count().catch(() => 0);
  await page.screenshot({ path: path.join(out, `${name}.png`), fullPage: false });
  // Zoom to fit is the default; also capture the plan alone at 1.0 scale for the docs.
  await browser.close();
  return { name, stored, pill, cart, energy, tabs, courtsTiles: tiles, errors };
}

const desktop = await shoot('courts-desktop-1366', { width: 1366, height: 768 }, false);
const phone = await shoot('courts-phone-390', { width: 390, height: 844 }, true);
const report = { base, at: new Date().toISOString(), desktop, phone };
fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
