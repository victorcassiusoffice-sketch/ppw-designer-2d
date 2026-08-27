/**
 * multiroom before/after capture — 2026-08-26.
 *
 * Seeds TWO_ROOM_FIXTURE (two rooms sharing the x = 5 m wall) into the
 * zustand persist envelope and screenshots /designer. On `main` this
 * shows ONE room (the bug); after Phase 3 it shows both.
 *
 * Usage:
 *   node tools/multiroom-shot-2026-08-26.mjs <outPath> [width] [height]
 *
 * Reads PPW_E2E_BASE_URL (default http://localhost:5187).
 */
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const BASE = process.env.PPW_E2E_BASE_URL ?? 'http://localhost:5187';
const out = process.argv[2];
const width = Number(process.argv[3] ?? 1920);
const height = Number(process.argv[4] ?? 1080);

if (!out) {
  console.error('usage: node tools/multiroom-shot-2026-08-26.mjs <outPath> [w] [h]');
  process.exit(2);
}

const PROPERTY = {
  id: 'prop-e2e',
  name: 'E2E Property',
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

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width, height } });

const breadcrumbs = [];
page.on('console', (m) => {
  const t = m.text();
  if (t.includes('[multi-room]')) breadcrumbs.push(t);
});
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));

await page.addInitScript((p) => {
  localStorage.clear();
  localStorage.setItem('ppw_designer_coach_v1', '1');
  localStorage.setItem(
    'ppw_property_v2',
    JSON.stringify({ state: { property: p, showGrid: true, pxPerMetre: 100 }, version: 2 }),
  );
}, PROPERTY);

await page.goto(`${BASE}/designer`, { waitUntil: 'commit' });
await page.waitForSelector('.konvajs-content canvas', { state: 'attached', timeout: 30_000 });
// Let product art + the auto-centre fit settle before the shot.
await page.waitForTimeout(2500);

await mkdir(path.dirname(out), { recursive: true });
await page.screenshot({ path: out, fullPage: false });

console.log('shot:', out, `${width}x${height}`);
console.log('breadcrumbs:', breadcrumbs.length ? breadcrumbs.join(' | ') : '(none)');
console.log('pageerrors:', errors.length ? errors.join(' | ') : '(none)');

await browser.close();
