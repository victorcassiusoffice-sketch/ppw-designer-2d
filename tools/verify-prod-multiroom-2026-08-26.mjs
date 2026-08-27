/**
 * P7 step 2 — LIVE verification of attached multi-room against
 * https://designer.ppwellness.co.
 *
 *   node tools/verify-prod-multiroom-2026-08-26.mjs [url]
 *
 * Load strategy is inherited from `verify-prod-2026-08-25.mjs`, which
 * documents WHY: never `networkidle` (prod polls, so it never settles), and
 * not `domcontentloaded` either — index.html carries a render-blocking
 * third-party stylesheet (`https://rsms.me/inter/inter.css`) that can stall
 * the document's load milestones for many seconds. `commit` +
 * `waitForSelector` is strictly stronger evidence anyway: the selector only
 * exists once the bundle downloaded, React mounted and the tree rendered.
 *
 * Exits non-zero on any failure.
 */
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const URL = process.argv[2] ?? 'https://designer.ppwellness.co';
const OUT = resolve(process.cwd(), 'docs/multiroom-2026-08-26/after');
mkdirSync(OUT, { recursive: true });

const PX_PER_M = 100;
const SCAN = { rMin: 200, gMin: 120, gMax: 190, bMax: 90, inset: 5 };

const TWO_ROOM_FIXTURE = {
  id: 'prod-verify',
  name: 'Prod Verify',
  activeRoomId: 'r1',
  rooms: [
    {
      id: 'r1',
      name: 'Room 1',
      polygon: [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 4 }, { x: 0, y: 4 }],
      placedItems: [],
    },
    {
      id: 'r2',
      name: 'Room 2',
      polygon: [{ x: 5, y: 0 }, { x: 9, y: 0 }, { x: 9, y: 4 }, { x: 5, y: 4 }],
      placedItems: [],
    },
  ],
};

const failures = [];
const log = [];
function check(label, ok, detail) {
  log.push(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  — ${detail}` : ''}`);
  if (!ok) failures.push(label);
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
await ctx.addInitScript((p) => {
  localStorage.clear();
  localStorage.setItem('ppw_designer_coach_v1', '1');
  localStorage.setItem(
    'ppw_property_v2',
    JSON.stringify({ state: { property: p, showGrid: true, pxPerMetre: 100 }, version: 2 }),
  );
}, TWO_ROOM_FIXTURE);
const page = await ctx.newPage();

const consoleErrors = [];
const breadcrumbs = [];
page.on('console', (m) => {
  if (m.type() === 'error') consoleErrors.push(m.text());
  const t = m.text();
  const mm = /\[multi-room\]\s+rendered=(\d+)/.exec(t);
  if (mm) breadcrumbs.push(Number(mm[1]));
});
page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${String(e)}`));

const resp = await page.goto(`${URL}/designer`, { waitUntil: 'commit', timeout: 60000 });
check('HTTP ok', !!resp && resp.status() < 400, `status ${resp?.status()}`);

await page.waitForSelector('.konvajs-content canvas', { state: 'attached', timeout: 60000 });
await page.waitForSelector('.konvajs-content canvas', { state: 'visible', timeout: 60000 });
check('canvas mounted', true);

const rootChildren = await page.evaluate(() => document.getElementById('root')?.childElementCount ?? 0);
check('#root has children (render gate)', rootChildren > 0, `childElementCount=${rootChildren}`);

// Give product art + the auto-centre fit time to settle.
await page.waitForTimeout(3000);

// 1 — the breadcrumb counts MOUNTED Konva room nodes, not store rooms.
const deadline = Date.now() + 20000;
while (Date.now() < deadline && !breadcrumbs.includes(2)) {
  await page.waitForTimeout(250);
}
check('[multi-room] rendered=2', breadcrumbs.includes(2), `saw [${breadcrumbs.join(', ')}]`);

// 2 — both rooms actually drawn: gold wall span across the 9 m union.
const span = await page.evaluate((s) => {
  const c = document.querySelector('.konvajs-content canvas');
  if (!c) return null;
  const ctx2 = c.getContext('2d');
  const img = ctx2.getImageData(0, 0, c.width, c.height).data;
  let minX = Infinity;
  let maxX = -Infinity;
  for (let y = 0; y < c.height; y += 2) {
    for (let x = 0; x < c.width; x += 2) {
      const i = (y * c.width + x) * 4;
      if (img[i + 3] > 200 && img[i] > s.rMin && img[i + 1] >= s.gMin
          && img[i + 1] <= s.gMax && img[i + 2] < s.bMax) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
      }
    }
  }
  if (!Number.isFinite(minX)) return null;
  const rect = c.getBoundingClientRect();
  const dpr = c.width / rect.width;
  return { minX: minX / dpr, maxX: maxX / dpr, x: rect.x, y: rect.y };
}, SCAN);
check('gold wall pixels found', !!span);
const spanM = span ? (span.maxX - span.minX - SCAN.inset * 2) / PX_PER_M : 0;
check('two-room union span ~9 m', Math.abs(spanM - 9) < 0.2, `${spanM.toFixed(2)} m`);

// 3 — place ONE item end to end INTO THE NON-ACTIVE ROOM (r2 at world 7,2).
const origin = span ? { x: span.x + span.minX + SCAN.inset, y: 0 } : null;
const originY = await page.evaluate((s) => {
  const c = document.querySelector('.konvajs-content canvas');
  const ctx2 = c.getContext('2d');
  const img = ctx2.getImageData(0, 0, c.width, c.height).data;
  let minY = Infinity;
  for (let y = 0; y < c.height; y += 2) {
    for (let x = 0; x < c.width; x += 2) {
      const i = (y * c.width + x) * 4;
      if (img[i + 3] > 200 && img[i] > s.rMin && img[i + 1] >= s.gMin
          && img[i + 1] <= s.gMax && img[i + 2] < s.bMax) {
        if (y < minY) minY = y;
      }
    }
  }
  const rect = c.getBoundingClientRect();
  const dpr = c.width / rect.width;
  return rect.y + minY / dpr + s.inset;
}, SCAN);

const card = page.locator('[data-product-id="k1-schwinn-700ic"]').first();
await card.waitFor({ state: 'visible', timeout: 30000 });
await card.click();
await page.locator('[data-armed="true"]').first().waitFor({ timeout: 15000 });

const sx = origin.x + 7 * PX_PER_M;
const sy = originY + 2 * PX_PER_M;
await page.mouse.move(sx, sy, { steps: 8 });
await page.mouse.click(sx, sy);
await page.waitForTimeout(2000);

const stored = await page.evaluate(() => {
  const raw = localStorage.getItem('ppw_property_v2');
  if (!raw) return null;
  const p = JSON.parse(raw);
  const rooms = p.state?.property?.rooms ?? [];
  return {
    activeRoomId: p.state?.property?.activeRoomId,
    r1: rooms.find((r) => r.id === 'r1')?.placedItems.length ?? -1,
    r2: rooms.find((r) => r.id === 'r2')?.placedItems.length ?? -1,
  };
});
check('item landed in the NON-active room r2', stored?.r2 === 1, JSON.stringify(stored));
check('active room r1 untouched', stored?.r1 === 0, JSON.stringify(stored));
check('focus followed the item to r2', stored?.activeRoomId === 'r2', `activeRoomId=${stored?.activeRoomId}`);

// 4 — zero console errors.
check('zero console errors', consoleErrors.length === 0, consoleErrors.join(' | ') || 'none');

const shot = resolve(OUT, 'prod-verify-1920x1080.png');
await page.screenshot({ path: shot, fullPage: false });

console.log('\n=== LIVE VERIFICATION ===');
console.log('url        :', `${URL}/designer`);
for (const l of log) console.log(l);
console.log('screenshot :', shot);
console.log(failures.length === 0 ? '\nALL CHECKS PASSED' : `\nFAILED: ${failures.join(', ')}`);

await browser.close();
process.exit(failures.length === 0 ? 0 : 1);
