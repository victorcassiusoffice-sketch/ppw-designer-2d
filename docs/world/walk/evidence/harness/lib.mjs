// Shared harness for the PR #51 fix-round-2 retest (read-only). Copied from the PR #50 harness; OUT + TARGETS changed, brightness/load helpers added in separate files.
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const require = createRequire('C:/Users/Victor/Documents/PPW-Code/ppw-tutorial-studio/package.json');
export const { chromium } = require('playwright');

export const OUT = 'C:/Users/Victor/Documents/Codex/2026-10-27/x20-instructions-are-in-c-users/work/world-harness/results';
mkdirSync(OUT, { recursive: true });

export const TARGETS = {
  walk: 'https://ppw-designer-2d-git-gpt-olb-walk-mode-2026-10-27-victor-ppw.vercel.app',
  site: 'https://ppw-designer-2d-git-gpt-olb-site-map-2026-10-27-victor-ppw.vercel.app',
  prod: 'https://onelivebuild.com',                                  // fc0b111 (tree == PR head dfb235f)
  prodppw: 'https://designer.ppwellness.co',                         // fc0b111
  old: 'https://ppw-designer-2d-n0nhhj9si-victor-ppw.vercel.app',    // fcefc73 (production before the merge)
  head: 'https://ppw-designer-2d-p3wzfxur3-victor-ppw.vercel.app',   // dfb235f (PR head preview)
  app: 'https://ppw-designer-2d-88jw8km36-victor-ppw.vercel.app',    // a71ac23 (GPT's pinned app preview)
  pr51: 'https://ppw-designer-2d-git-gpt-olb-fix-round-2-2026-10-25-victor-ppw.vercel.app', // 5a5f4a2 (PR #51 head, branch alias)
};
const PIN = Object.values(TARGETS).filter(u => u.includes('vercel.app')).map(u => `MAP ${new URL(u).hostname} 216.198.79.3`).join(',');

export const DEVICES = {
  desktop: { viewport: { width: 1280, height: 800 } },
  phone: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
  small: { viewport: { width: 360, height: 652 }, isMobile: true, hasTouch: true },
};

export async function launch() {
  return chromium.launch({ headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', `--host-resolver-rules=${PIN}`] });
}

export const stamp = () => new Date().toISOString();

/** New context: writes blocked (any non-GET/HEAD/OPTIONS request is aborted and logged), coach skipped. */
export async function newCtx(browser, device, opts = {}) {
  const d = DEVICES[device];
  const context = await browser.newContext({ ...d, ...(opts.ctx || {}) });
  const log = { blockedWrites: [] };
  await context.route('**/*', route => {
    const r = route.request();
    if (!['GET', 'HEAD', 'OPTIONS'].includes(r.method())) {
      log.blockedWrites.push({ method: r.method(), url: r.url().slice(0, 160) });
      return route.abort('blockedbyclient');
    }
    return route.continue();
  });
  await context.addInitScript(({ textZoom }) => {
    try { localStorage.setItem('ppw_designer_coach_v1', '1'); } catch {}
    if (textZoom) {
      const apply = () => { document.documentElement.style.fontSize = `${textZoom * 100}%`; };
      if (document.documentElement) apply();
      document.addEventListener('DOMContentLoaded', apply);
    }
  }, { textZoom: opts.textZoom || 0 });
  return { context, log };
}

export function watch(page, row) {
  row.consoleErrors ??= []; row.pageErrors ??= []; row.httpErrors ??= []; row.failedRequests ??= [];
  page.on('console', m => { if (m.type() === 'error') row.consoleErrors.push(m.text().slice(0, 300)); });
  page.on('pageerror', e => row.pageErrors.push(String(e).slice(0, 300)));
  page.on('response', r => { if (r.status() >= 400) row.httpErrors.push({ status: r.status(), url: r.url().slice(0, 160) }); });
  page.on('requestfailed', r => { const t = r.failure()?.errorText || ''; if (!/BLOCKED_BY_CLIENT|blockedbyclient/i.test(t)) row.failedRequests.push({ url: r.url().slice(0, 160), error: t }); });
}

export async function shot(page, row, name) {
  const path = join(OUT, `${name}.png`).replace(/\\/g, '/');
  await page.screenshot({ path });
  (row.shots ??= []).push(path);
  return path;
}

export async function check(row, name, fn) {
  const t0 = Date.now();
  try { const detail = await fn(); row.checks.push({ name, pass: true, ms: Date.now() - t0, detail }); return detail; }
  catch (e) { row.checks.push({ name, pass: false, ms: Date.now() - t0, error: String(e).slice(0, 600) }); return undefined; }
}

export function save(file, data) { writeFileSync(join(OUT, file), JSON.stringify(data, null, 1)); }

export const overflow = page => page.evaluate(() => document.documentElement.scrollWidth - innerWidth);

export async function prop(page) {
  return page.evaluate(() => { try { return JSON.parse(localStorage.getItem('ppw_property_v2')).state.property; } catch { return null; } });
}
export async function items(page) {
  const p = await prop(page);
  if (!p) return [];
  return p.rooms.flatMap(r => (r.placedItems || []).map(i => ({ ...i, room: r.name, roomId: r.id })));
}

export async function wait3D(page, timeout = 90000) {
  await page.getByTestId('wallpaint-3d-gl').waitFor({ timeout });
  await page.getByTestId('loading-3d').waitFor({ state: 'hidden', timeout });
}

export const itemPt = (page, id) => page.evaluate(id => window.__ppwRoomView3d?.itemScreenPoint(id) ?? null, id);
export const floorPt = (page, x, y) => page.evaluate(([x, y]) => window.__ppwRoomView3d?.floorScreenPoint(x, y) ?? null, [x, y]);
export const ghost = page => page.evaluate(() => { const a = document.querySelector('[data-testid="wallpaint-3d"]')?.getAttribute('data-catalog-preview'); return a ? JSON.parse(a) : null; });

/** Bounding boxes of the 3D surfaces. */
export async function boxes3d(page) {
  return page.evaluate(() => {
    const b = sel => { const e = document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; };
    return { wallpaint3d: b('[data-testid="wallpaint-3d"]'), canvasBox: b('[data-testid="wallpaint-3d-canvas"]'), glCanvas: b('[data-testid="wallpaint-3d-gl"] canvas') ?? b('[data-testid="wallpaint-3d-gl"]') };
  });
}

/** Touch helpers through CDP (real touch events, not mouse emulation). */
export async function touch(page, cdpHolder) {
  if (!cdpHolder.cdp) cdpHolder.cdp = await page.context().newCDPSession(page);
  const cdp = cdpHolder.cdp;
  const pt = (x, y) => ({ x, y, radiusX: 3, radiusY: 3, force: 1, id: 1 });
  return {
    async tap(x, y) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [pt(x, y)] }); await page.waitForTimeout(60); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); },
    async drag(x0, y0, x1, y1, steps = 14, hold = 80) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [pt(x0, y0)] });
      await page.waitForTimeout(hold);
      for (let i = 1; i <= steps; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [pt(x0 + (x1 - x0) * i / steps, y0 + (y1 - y0) * i / steps)] }); await page.waitForTimeout(16); }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    },
    async arc(cx, cy, x0, y0, deg, steps = 12) {
      const start = Math.atan2(y0 - cy, x0 - cx), r = Math.hypot(x0 - cx, y0 - cy);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [pt(x0, y0)] });
      await page.waitForTimeout(60);
      for (let i = 1; i <= steps; i++) { const a = start + (deg * Math.PI / 180) * i / steps; await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [pt(cx + Math.cos(a) * r, cy + Math.sin(a) * r)] }); await page.waitForTimeout(16); }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    },
  };
}

/** Text guard for /demo: price, currency, retailer/client names. */
export const CURRENCY = /\b(?:MUR|MURs|Rs\.?|USD|EUR|GBP|CNY|RMB)\b|[€£$¥]/;
export const NAMES = /\b(?:Courts(?:\s+Mammouth)?|Espace\s+Maison|John\s+Lewis|TintEX|Cap\s+Tamarin|Trimetys|Spa\s+Concept)\b/i;
export const SUPPLIERS = /\b(?:K1(?:[- ]Sport)?|Emcar|Duraco|Sofap)\b/i;
export async function guard(page) {
  const text = await page.locator('body').innerText();
  const cur = text.match(CURRENCY); const nm = text.match(NAMES); const sp = text.match(SUPPLIERS);
  const ctx = (m) => m ? text.slice(Math.max(0, m.index - 50), m.index + 60).replace(/\s+/g, ' ') : null;
  const pill = await page.locator('[data-testid="cart-pill"]').count() ? await page.locator('[data-testid="cart-pill"]').first().evaluate(e => ({ text: e.innerText, label: e.getAttribute('aria-label') })) : null;
  return { currency: cur ? cur[0] : null, currencyContext: ctx(cur), name: nm ? nm[0] : null, nameContext: ctx(nm), supplier: sp ? sp[0] : null, supplierContext: ctx(sp), pill };
}

// ---- Production has no DEV bridge: project plan points with the page's own camera (data-render-camera). ----
import { readFileSync } from 'node:fs';
const courts = JSON.parse(readFileSync('C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/src/demo/courts/products.json', 'utf8'));
export const DIMS = Object.fromEntries((courts.products || courts).map(p => [p.id, p.dimensions_cm]));
export async function projectPlan(page, pts) {
  return page.evaluate((pts) => {
    const el = document.querySelector('[data-testid="wallpaint-3d-canvas"]');
    if (!el) return null;
    const cam = JSON.parse(el.getAttribute('data-render-camera') || el.getAttribute('data-camera'));
    const proj = document.querySelector('[data-testid="wallpaint-3d-gl"]')?.getAttribute('data-projection') || 'perspective';
    const r = el.getBoundingClientRect();
    const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
    const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
    const cross = (a, b) => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
    const norm = a => { const l = Math.hypot(a.x, a.y, a.z) || 1; return { x: a.x / l, y: a.y / l, z: a.z / l }; };
    const c = Math.cos(cam.elevationRad);
    const pos = { x: cam.target.x + cam.distanceM * c * Math.sin(cam.azimuthRad), y: cam.target.y + cam.distanceM * c * Math.cos(cam.azimuthRad), z: cam.target.z + cam.distanceM * Math.sin(cam.elevationRad) };
    const forward = norm(sub(cam.target, pos)); const right = norm(cross({ x: 0, y: 0, z: 1 }, forward)); const up = cross(forward, right);
    return pts.map(p => {
      if (proj === 'perspective') {
        const v = sub(p, pos); const depth = dot(v, forward); if (depth <= 0.05) return null;
        const f = r.height / 2 / Math.tan(cam.fovRad / 2);
        return { x: r.left + r.width / 2 + (dot(v, right) / depth) * f, y: r.top + r.height / 2 - (dot(v, up) / depth) * f };
      }
      const d = sub(p, cam.target); const scale = r.height / (2 * cam.distanceM * Math.tan(cam.fovRad / 2));
      return { x: r.left + r.width / 2 + dot(d, right) * scale, y: r.top + r.height / 2 - dot(d, up) * scale };
    });
  }, pts);
}
export const DIM_BY_NAME = { celosia: 'courts-stellar-celosia-chair', gessica: 'courts-gessica-dining-6', mika: 'courts-mika-bed-160', aurum: 'courts-aurum-tv-cabinet', beluga: 'courts-beluga-wardrobe-4', comfy: 'courts-comfy-3-seater-dove', marco: 'courts-marco-sofa-corner', hisense: 'courts-hisense-65a6h-tv', lavis: 'courts-lavis-sideboard', perera: 'courts-perera-coffee-table' };
export function itemCentre(item, zFrac = 0.55, dimsKey) {
  const d = DIMS[item.productId] || (dimsKey && DIMS[dimsKey]) || { length: 60, width: 60, height: 90 };
  const L = d.length / 100, W = d.width / 100, H = d.height / 100, a = (item.rotation || 0) * Math.PI / 180;
  const aw = L * Math.abs(Math.cos(a)) + W * Math.abs(Math.sin(a)), ah = L * Math.abs(Math.sin(a)) + W * Math.abs(Math.cos(a));
  return { x: item.x + aw / 2, y: item.y + ah / 2, z: (item.z || 0) + H * zFrac };
}
export async function itemScreen(page, item, zFrac, dimsKey) { if (!item) return null; const c = itemCentre(item, zFrac, dimsKey); const r = await projectPlan(page, [c]); return r ? r[0] : null; }
export async function floorScreen(page, x, y) { const r = await projectPlan(page, [{ x, y, z: 0 }]); return r ? r[0] : null; }
