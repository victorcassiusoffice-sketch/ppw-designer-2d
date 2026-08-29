/**
 * Proves the dev geometry bridge is a valid replacement for the wall
 * pixel-scan as the e2e coordinate basis.
 *
 * The two methods are completely independent — one reads the Konva Stage's
 * transform matrix, the other counts near-black pixels on a canvas — so
 * agreement between them is real evidence, not a tautology. Once this passes,
 * later render work (floor materials, door symbols, light pools, greenery)
 * can no longer silently shift the coordinate frame out from under every
 * other spec.
 *
 * Paper theme (2026-08-29): walls are CHARCOAL (`WALL_INK` #2A2926 → r,g,b
 * all < 50) on cream paper. The scan below spells that predicate out
 * literally — it is deliberately NOT the shared helper, so the comparison
 * stays independent of `roomOrigin()`'s own fallback code path. The numbers
 * mirror `blueprintTheme.ROOM_BORDER_SCAN` (max 50, minAlpha 200, inset 5).
 */
import { test, expect } from '@playwright/test';
import {
  TWO_ROOM_FIXTURE,
  seedProperty,
  roomOrigin,
  worldToScreen,
  geomRooms,
  renderedRoomCount,
  PX_PER_M,
  requireGeomBridge,
  GEOM_BRIDGE_SKIP,
} from './multiroom-helpers';

test.use({ viewport: { width: 1920, height: 1080 } });

test('geom bridge agrees with the charcoal wall pixel-scan on world (0,0)', async ({ page }) => {
  await seedProperty(page, TWO_ROOM_FIXTURE);
  await page.goto('/designer');
  await page.waitForSelector('.konvajs-content canvas', { state: 'attached' });
  // The bridge is installed from a dynamic import in main.tsx. With six
  // workers hammering one vite dev server that import can take longer than
  // the helper's 5 s probe, which then reads as "no bridge" and SKIPS the one
  // spec whose whole job is to prove the bridge. Give it a generous head
  // start first; the helper's own probe (and its skip message) still decide.
  await page
    .waitForFunction(() => Boolean((window as unknown as { __ppwGeom?: unknown }).__ppwGeom), undefined, {
      timeout: 20_000,
    })
    .catch(() => undefined);
  test.skip(!(await requireGeomBridge(page)), GEOM_BRIDGE_SKIP);

  // Let the auto-centre effect settle before measuring either way.
  await expect.poll(() => renderedRoomCount(page), { timeout: 15_000 }).toBe(2);

  const viaGeom = await worldToScreen(page, 0, 0);
  expect(viaGeom, 'the dev bridge must be installed on the dev server').not.toBeNull();

  // Force the legacy path by asking for it directly on the page, so we compare
  // like for like rather than re-entering roomOrigin (which now prefers geom).
  const viaScan = await page.evaluate(() => {
    const c = document.querySelector('.konvajs-content canvas') as HTMLCanvasElement | null;
    if (!c) return null;
    const ctx = c.getContext('2d');
    if (!ctx) return null;
    const img = ctx.getImageData(0, 0, c.width, c.height).data;
    let minX = Infinity;
    let minY = Infinity;
    for (let y = 0; y < c.height; y += 2) {
      for (let x = 0; x < c.width; x += 2) {
        const i = (y * c.width + x) * 4;
        // Charcoal wall ink: opaque and every channel below 50. The cream
        // ground, the paper floor, the grid (ink at <= 0.12 opacity) and the
        // wall's own soft shadow (0.38 alpha at most) never get there.
        if (img[i + 3] > 200 && img[i] < 50 && img[i + 1] < 50 && img[i + 2] < 50) {
          if (x < minX) minX = x;
          if (y < minY) minY = y;
        }
      }
    }
    if (!Number.isFinite(minX)) return null;
    const rect = c.getBoundingClientRect();
    const scale = c.width / rect.width;
    // The 10 px stroke is centred on the polygon edge: step half a stroke
    // (5 px) inward from the outermost ink pixel to reach the wall line.
    return { x: rect.x + minX / scale + 5, y: rect.y + minY / scale + 5 };
  });
  expect(viaScan, 'the legacy scan should still find a charcoal wall today').not.toBeNull();

  // Antialiasing on a 10 px stroke plus the 2 px scan stride: a few px of slack
  // is expected. Anything larger means the two disagree about where world
  // (0,0) is, which is exactly what this test exists to catch.
  expect(Math.abs(viaGeom!.x - viaScan!.x)).toBeLessThanOrEqual(4);
  expect(Math.abs(viaGeom!.y - viaScan!.y)).toBeLessThanOrEqual(4);

  // roomOrigin() must now return the geometry answer.
  const origin = await roomOrigin(page);
  expect(Math.abs(origin.x - viaGeom!.x)).toBeLessThanOrEqual(0.01);

  // And the bridge's world model must match the seeded fixture.
  const rooms = await geomRooms(page);
  expect(rooms.map((r) => r.id)).toEqual(['r1', 'r2']);
  expect(rooms[0]).toMatchObject({ minX: 0, minY: 0, maxX: 5, maxY: 4 });
  expect(rooms[1]).toMatchObject({ minX: 5, minY: 0, maxX: 9, maxY: 4 });

  // Scale is clamped to 1 for this fixture, so one metre must be PX_PER_M page
  // pixels — the assumption every click helper in the suite is built on.
  const oneMetre = await worldToScreen(page, 1, 0);
  expect(Math.abs(oneMetre!.x - viaGeom!.x)).toBeCloseTo(PX_PER_M, 0);

  console.log('GEOM_BRIDGE=true', JSON.stringify({ viaGeom, viaScan }));
});
