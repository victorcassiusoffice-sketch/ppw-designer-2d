#!/usr/bin/env node
/**
 * walk-shots — a product seen in Walk mode, first person and third person, on a laptop (1280×800)
 * and a phone (390×844), on the dev server. Seeds a plain room with the product, opens 3D, opens
 * Walk mode, poses the walker 2.2 m in front of the product through the DEV test-pose hook, and
 * screenshots. `--bodies <tool>` shows that tool's test candidates (`?bodies=`), none = the catalogue.
 *
 *   node scripts/product-engine/walk-shots.mjs --only k1-nordictrack-2450 --bodies tripo --run test-2026-11-08
 *
 * Read-only against the app: same-origin GET only, nothing written by the page. $0.
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { loadCatalogue } from './lib/catalog.mjs';
import { openBrowser, startDevServer } from './lib/browser.mjs';
import { ROOT, runDir } from './lib/paths.mjs';

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const only = (opt('--only', '') || '').split(',').map((s) => s.trim()).filter(Boolean);
const bodies = opt('--bodies', null);
const label = opt('--label', bodies ?? 'catalogue');
const RUN_DIR = runDir(opt('--run', `${new Date().toISOString().slice(0, 10)}-walk`));
const gpu = opt('--gpu', 'swiftshader');
if (!only.length) { console.error('--only <product ids>'); process.exit(2); }

const cat = loadCatalogue();
const server = await startDevServer({ log: console.log, port: Number(opt('--port', '5179')) });
const b = await openBrowser(server.base, { gpu });
const results = [];
try {
  for (const id of only) {
    const product = cat.all.find((r) => r.id === id);
    if (!product) { results.push({ id, error: 'unknown product' }); continue; }
    const L = product.dimensions_cm.length / 100;
    const W = product.dimensions_cm.width / 100;
    // A plain 7 × 6 m room, the product 1.5 m in from the north-west corner, a door on the south wall.
    const room = {
      id: 'r1', name: 'Walk shot', polygon: [{ x: 0, y: 0 }, { x: 7, y: 0 }, { x: 7, y: 6 }, { x: 0, y: 6 }],
      openings: [{ id: 'd1', edgeIndex: 2, offsetM: 3, widthM: 0.9, kind: 'door', flipFacing: false, flipHand: false }],
      placedItems: [{ instanceId: 'i1', productId: id, x: 1.5, y: 1.2, rotation: 0 }],
    };
    for (const device of [{ name: 'laptop', viewport: { width: 1280, height: 800 }, touch: false }, { name: 'phone', viewport: { width: 390, height: 844 }, touch: true }]) {
      const page = await b.browser.newPage({ viewport: device.viewport, hasTouch: device.touch, isMobile: device.touch, deviceScaleFactor: 1 });
      const errors = [];
      const blocked = [];
      page.on('pageerror', (e) => errors.push(String(e)));
      page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
      await page.route('**/*', (route) => {
        const req = route.request();
        const url = new URL(req.url());
        if (url.origin !== new URL(server.base).origin || !['GET', 'HEAD'].includes(req.method())) { blocked.push(`${req.method()} ${url.href}`); return route.abort(); }
        return route.continue();
      });
      const shots = {};
      try {
        await page.addInitScript((p) => {
          localStorage.clear();
          localStorage.setItem('ppw_designer_coach_v1', '1');
          localStorage.setItem('ppw_property_v2', JSON.stringify({ state: { property: p, showGrid: true, pxPerMetre: 100 }, version: 2 }));
        }, { id: 'p', name: 'Walk shot', activeRoomId: 'r1', rooms: [room], wallHeightM: 2.7 });
        await page.goto(`${server.base}/designer${bodies ? `?bodies=${encodeURIComponent(bodies)}` : ''}`, { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('.konvajs-content canvas', { state: 'attached', timeout: 60000 });
        await page.waitForTimeout(500);
        const overlay = page.locator('[data-testid="wallpaint-3d-overlay"]');
        if (!(await overlay.isVisible())) {
          // The top bar's visible "3D House" pill; the `view-mode-3d` test id is a hidden twin on this layout.
          const house = page.getByRole('button', { name: /^3D House$/ }).filter({ visible: true }).first();
          if (await house.count()) { if (device.touch) await house.tap(); else await house.click(); } else await page.locator('[data-testid="view-mode-3d"]').click({ force: true });
        }
        await overlay.waitFor({ state: 'visible', timeout: 60000 });
        await page.waitForFunction(() => Number(document.querySelector('[data-testid="wallpaint-3d-gl"]')?.getAttribute('data-first-picture-ms')) > 0, undefined, { timeout: 120000 });
        await page.waitForTimeout(800);
        const open = page.getByRole('button', { name: 'Open Walk mode', exact: true });
        if (device.touch) await open.tap(); else await open.click();
        const start = page.getByRole('button', { name: 'Start walk', exact: true });
        await start.waitFor({ state: 'visible', timeout: 30000 });
        if (device.touch) await start.tap(); else await start.click();
        await page.waitForFunction(() => document.querySelector('[data-world-walk]')?.getAttribute('data-status'), undefined, { timeout: 90000 });
        await page.waitForTimeout(600);
        // Stand 2.2 m south of the product, facing north (−z): the walk's forward is (−sin yaw, 0, −cos yaw), so yaw 0 looks at −z.
        const pose = { position: [1.5 + L / 2, 0, 1.2 + W + 2.2], yaw: 0 };
        const posed = await page.evaluate(async (detail) => {
          const canvas = document.querySelector('[data-world-walk] canvas');
          if (!canvas) return { accepted: false, reason: 'no walk canvas' };
          return new Promise((resolve) => {
            const done = (e) => { canvas.removeEventListener('world-walk-test-pose-ready', done); resolve(e.detail ?? JSON.parse(canvas.getAttribute('data-walk-test-pose') || '{}')); };
            canvas.addEventListener('world-walk-test-pose-ready', done);
            canvas.dispatchEvent(new CustomEvent('world-walk-test-pose', { detail }));
            // The hook answers only when it refuses; a pose it takes leaves no attribute behind.
            setTimeout(() => { const a = canvas.getAttribute('data-walk-test-pose'); resolve(a ? JSON.parse(a) : { accepted: true, note: 'no refusal from the hook' }); }, 1500);
          });
        }, pose);
        await page.waitForTimeout(900);
        const dir = path.join(RUN_DIR, 'walk', id);
        fs.mkdirSync(dir, { recursive: true });
        shots.third = path.join(dir, `${label}-${device.name}-third.png`);
        await page.screenshot({ path: shots.third });
        // First person: V on a keyboard; on the phone the toolbar's view button.
        if (device.touch) {
          const view = page.locator('.world-walk-toolbar button').filter({ hasText: /view|first|third/i }).first();
          if (await view.count()) await view.tap(); else await page.keyboard.press('KeyV');
        } else await page.keyboard.press('KeyV');
        await page.waitForTimeout(900);
        shots.first = path.join(dir, `${label}-${device.name}-first.png`);
        await page.screenshot({ path: shots.first });
        results.push({ id, device: device.name, bodies: label, posed, errors, blocked, shots: Object.fromEntries(Object.entries(shots).map(([k, v]) => [k, path.relative(ROOT, v).split(path.sep).join('/')])) });
        console.log(`✓ ${id} ${device.name} ${label}: pose ${JSON.stringify(posed)} · ${errors.length} console error(s)`);
      } catch (e) {
        results.push({ id, device: device.name, bodies: label, error: String(e).slice(0, 400), errors, blocked });
        console.log(`✗ ${id} ${device.name} ${label}: ${String(e).slice(0, 200)}`);
        try { fs.mkdirSync(path.join(RUN_DIR, 'walk', id), { recursive: true }); await page.screenshot({ path: path.join(RUN_DIR, 'walk', id, `${label}-${device.name}-FAILED.png`) }); } catch { /* nothing to save */ }
      } finally {
        await page.close();
      }
    }
  }
} finally {
  await b.close();
  server.stop();
}
fs.mkdirSync(RUN_DIR, { recursive: true });
const file = path.join(RUN_DIR, `walk-shots-${label}.json`);
fs.writeFileSync(file, `${JSON.stringify({ at: new Date().toISOString(), bodies: label, results }, null, 2)}\n`);
console.log(`→ ${path.relative(ROOT, file)}`);
