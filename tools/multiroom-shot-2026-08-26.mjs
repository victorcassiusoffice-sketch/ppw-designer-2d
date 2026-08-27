/**
 * multiroom before/after capture — 2026-08-26.
 *
 * Modes:
 *   fixture   seed TWO_ROOM_FIXTURE and shoot /designer. On `main` this
 *             shows ONE room (the bug); after Phase 3 it shows both.
 *   placement seed the fixture, then arm a product and drop it INSIDE the
 *             non-active room — the P4 routing result.
 *   attach    seed ONE off-grid room, enter draw mode, draw an attached
 *             room against its east wall and commit — the P5 result.
 *
 * Usage:
 *   node tools/multiroom-shot-2026-08-26.mjs <outPath> [width] [height] [mode]
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
const mode = process.argv[5] ?? 'fixture';

if (!out) {
  console.error('usage: node tools/multiroom-shot-2026-08-26.mjs <outPath> [w] [h] [mode]');
  process.exit(2);
}

const PX_PER_M = 100;
const SCAN = { rMin: 200, gMin: 120, gMax: 190, bMax: 90, inset: 5 };

const TWO_ROOM = {
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

const OFF_GRID = {
  id: 'prop-attach',
  name: 'Attach Property',
  activeRoomId: 'r1',
  rooms: [
    {
      id: 'r1',
      name: 'Room 1',
      polygon: [{ x: 0, y: 0 }, { x: 5.13, y: 0 }, { x: 5.13, y: 4 }, { x: 0, y: 4 }],
      placedItems: [
        { instanceId: 'seed-a', productId: 'k1-schwinn-700ic', x: 1, y: 1, rotation: 0 },
      ],
    },
  ],
};

/**
 * Origin AND viewport scale, self-calibrated from the gold wall pixels.
 *
 * At 390 px wide the whole-plan fit clamps the viewport BELOW scale 1, so a
 * fixed `origin + world * PX_PER_M` mapping (which silently assumes 1)
 * lands the clicks in the wrong place. Measuring the on-screen span of a
 * known world width recovers the real scale, so the same code drives both
 * the desktop and the mobile capture.
 */
async function roomOrigin(page, knownSpanM) {
  const found = await page.evaluate((s) => {
    const c = document.querySelector('.konvajs-content canvas');
    if (!c) return null;
    const ctx = c.getContext('2d');
    const img = ctx.getImageData(0, 0, c.width, c.height).data;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    for (let y = 0; y < c.height; y += 2) {
      for (let x = 0; x < c.width; x += 2) {
        const i = (y * c.width + x) * 4;
        if (img[i + 3] > 200 && img[i] > s.rMin && img[i + 1] >= s.gMin
            && img[i + 1] <= s.gMax && img[i + 2] < s.bMax) {
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
        }
      }
    }
    if (!Number.isFinite(minX)) return null;
    const rect = c.getBoundingClientRect();
    const dpr = c.width / rect.width;
    return {
      x: rect.x + minX / dpr,
      y: rect.y + minY / dpr,
      spanRawPx: (maxX - minX) / dpr,
    };
  }, SCAN);
  if (!found) throw new Error('Room border not found');
  // The scanned span includes half a stroke of overhang on EACH side.
  const scale = (found.spanRawPx - SCAN.inset * 2) / (knownSpanM * PX_PER_M);
  return {
    x: found.x + SCAN.inset * scale,
    y: found.y + SCAN.inset * scale,
    scale,
  };
}

/** The catalog tile that is actually VISIBLE at this viewport width. */
async function visibleProductCard(page, productId) {
  const all = page.locator(`[data-product-id="${productId}"]`);
  const n = await all.count();
  for (let i = 0; i < n; i++) {
    if (await all.nth(i).isVisible()) return all.nth(i);
  }
  throw new Error(`No visible catalog tile for ${productId}`);
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width, height } });

const breadcrumbs = [];
page.on('console', (m) => {
  const t = m.text();
  if (t.includes('[multi-room]')) breadcrumbs.push(t);
});
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));

const seed = mode === 'attach' ? OFF_GRID : TWO_ROOM;
await page.addInitScript((p) => {
  localStorage.clear();
  localStorage.setItem('ppw_designer_coach_v1', '1');
  localStorage.setItem(
    'ppw_property_v2',
    JSON.stringify({ state: { property: p, showGrid: true, pxPerMetre: 100 }, version: 2 }),
  );
}, seed);

await page.goto(`${BASE}/designer`, { waitUntil: 'commit' });
await page.waitForSelector('.konvajs-content canvas', { state: 'attached', timeout: 30_000 });
await page.waitForTimeout(2500);

// Below 1024 px the app swaps to its mobile surfaces, and BOTH interaction
// modes below change shape with it. Captured honestly rather than forced.
const isMobile = width < 1024;

if (mode === 'placement' && !isMobile) {
  // Desktop: arm a product and drop it into the NON-active room (r2).
  const card = await visibleProductCard(page, 'k1-schwinn-700ic');
  await card.click();
  await page.locator('[data-armed="true"]').first().waitFor();
  const origin = await roomOrigin(page, 9);
  const sx = origin.x + 7 * PX_PER_M * origin.scale;
  const sy = origin.y + 2 * PX_PER_M * origin.scale;
  await page.mouse.move(sx, sy, { steps: 8 });
  await page.mouse.click(sx, sy);
  await page.waitForTimeout(1200);
} else if (mode === 'placement' && isMobile) {
  // Mobile has NO pointer ghost: tapping a catalog tile opens
  // `mobile-product-popup`, whose "+ Add to room" publishes a placement
  // INTENT. Per D4 that intent routes to the ACTIVE room's centre by
  // design — cross-room hit-test routing is a desktop-pointer flow only.
  const card = await visibleProductCard(page, 'k1-schwinn-700ic');
  await card.click();
  await page.locator('[data-testid="popup-add-to-room"]').waitFor();
  await page.locator('[data-testid="popup-add-to-room"]').click();
  await page.waitForTimeout(1200);
} else if (mode === 'attach' && !isMobile) {
  // Desktop: draw a room attached to the x = 5.13 east wall.
  await page.locator('[data-testid="room-draw-toggle"]').click();
  await page.waitForTimeout(400);
  const origin = await roomOrigin(page, 5.13);
  for (const p of [
    { x: 5.2, y: 0.05 }, { x: 9, y: 0.05 }, { x: 9, y: 4 }, { x: 5.2, y: 4 },
  ]) {
    const sx = origin.x + p.x * PX_PER_M * origin.scale;
    const sy = origin.y + p.y * PX_PER_M * origin.scale;
    await page.mouse.move(sx, sy, { steps: 4 });
    await page.mouse.click(sx, sy);
  }
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1500);
} else if (mode === 'attach' && isMobile) {
  // Mobile: enter draw mode and drop the two vertices that share the
  // existing room's south-east corner and south wall, so the snap ring and
  // the intact plan are both visible.
  //
  // The COMMIT is deliberately not driven here. At 390x844 the viewport
  // auto-fits the EXISTING plan, and the fixed catalog toolbar
  // (`lg:hidden fixed bottom-0`, top = 636 px) covers the lower canvas, so
  // the drawable band is roughly 70 px tall below the room — a new room
  // large enough to be useful lands off-screen. Reaching it needs pan/zoom
  // INSIDE draw mode, which D9 lists as out of scope for v1. See the
  // handoff: this is a reportable v1 mobile limitation, not a defect, and
  // it is not faked here.
  await page.locator('[data-testid="room-draw-toggle"]').click();
  await page.waitForTimeout(400);
  const origin = await roomOrigin(page, 5.13);
  for (const p of [{ x: 5.13, y: 4 }, { x: 2.5, y: 4 }]) {
    const sx = origin.x + p.x * PX_PER_M * origin.scale;
    const sy = origin.y + p.y * PX_PER_M * origin.scale;
    await page.mouse.move(sx, sy, { steps: 4 });
    await page.mouse.click(sx, sy);
  }
  await page.waitForTimeout(600);
}

await mkdir(path.dirname(out), { recursive: true });
await page.screenshot({ path: out, fullPage: false });

const rooms = await page.evaluate(() => {
  const raw = localStorage.getItem('ppw_property_v2');
  if (!raw) return null;
  const p = JSON.parse(raw);
  return (p.state?.property?.rooms ?? []).map((r) => ({
    name: r.name,
    minX: Math.min(...r.polygon.map((v) => v.x)),
    items: r.placedItems.length,
  }));
});

console.log('shot:', out, `${width}x${height}`, `mode=${mode}`);
console.log('rooms:', JSON.stringify(rooms));
console.log('breadcrumbs:', breadcrumbs.length ? breadcrumbs.join(' | ') : '(none)');
console.log('pageerrors:', errors.length ? errors.join(' | ') : '(none)');

await browser.close();
