/**
 * Corner snap by REAL drags (Vic 2026-08-29):
 *   "The snap on feature of the objects doesn't align horizontally flush to
 *    the wall, only vertical and therefore you can't align an object in the
 *    corner."
 *
 * Reproduced on the dev server with the realistic gesture — bring the
 * item's CURRENT EDGE to ~0.2 m of the wall — 24/64 desktop drags failed,
 * always on the two walls perpendicular to the item's long axis. The fix
 * engages the snap on the object's current extent. These drags are the
 * regression: a landscape treadmill to the left wall, the right wall, a
 * corner, and a quarter-turn IN the corner that must stay in the corner.
 *
 * Needs the DEV geom bridge:
 *   PPW_E2E_BASE_URL=http://127.0.0.1:5188 npx playwright test snap-edge-drag
 */

import { test, expect } from '@playwright/test';
import {
  allStoredItems,
  clickWorld,
  dragWorld,
  oneRoomFixture,
  requireGeomBridgeGenerous,
  seedSimsProperty,
  waitForGeom,
} from './sims-world-helpers';

const GEOM_SKIP = 'DEV geom bridge not present (production build) — run against `npm run dev`';
// k1-nordictrack-2450: 205 × 95 cm. Landscape at rotation 0.
const TREADMILL = 'k1-nordictrack-2450';
const L = 2.05;
const W = 0.95;
const FACE = 0.05; // inner wall face (WALL_HALF_M)

function seeded(rotation: number) {
  // Mid-room, long side along X at rotation 0.
  const w = rotation % 180 === 0 ? L : W;
  const h = rotation % 180 === 0 ? W : L;
  return oneRoomFixture([
    { instanceId: 'tm', productId: TREADMILL, x: 2.5 - w / 2, y: 2 - h / 2, rotation },
  ]);
}

/** Current AABB centre of the seeded item from the store. */
async function centreOf(page: import('@playwright/test').Page) {
  const [it] = await allStoredItems(page);
  const w = it.rotation % 180 === 0 ? L : W;
  const h = it.rotation % 180 === 0 ? W : L;
  return { x: it.x + w / 2, y: it.y + h / 2, w, h, rotation: it.rotation };
}

test.describe('Wall snap engages on the object as dragged', () => {
  test.use({ viewport: { width: 1366, height: 768 } });

  test.beforeEach(async ({ page }) => {
    await seedSimsProperty(page, seeded(0));
    await page.goto('/designer');
    await page.waitForSelector('.konvajs-content canvas', { state: 'attached' });
    test.skip(!(await requireGeomBridgeGenerous(page)), GEOM_SKIP);
    await waitForGeom(page);
  });

  test('a landscape item dragged so its LEFT edge is 0.2 m off the left wall flushes to x = 0.05', async ({
    page,
  }) => {
    const c = await centreOf(page);
    // Release with the item's left edge 0.2 m from the wall line: centre
    // x = 0.2 + L/2. Before the fix this landed at x = 0 (in the wall band).
    await dragWorld(page, { x: c.x, y: c.y }, { x: 0.2 + L / 2, y: c.y }, 12);
    await expect.poll(async () => (await allStoredItems(page))[0].x).toBeCloseTo(FACE, 3);
    const after = await centreOf(page);
    // Turned to face into the room (a quarter turn), flush on the wall.
    expect(after.rotation % 180).toBe(90);
  });

  test('… the RIGHT wall flushes to the far inner face', async ({ page }) => {
    const c = await centreOf(page);
    await dragWorld(page, { x: c.x, y: c.y }, { x: 5 - 0.2 - L / 2, y: c.y }, 12);
    await expect
      .poll(async () => {
        const a = await centreOf(page);
        return a.x + a.w / 2;
      })
      .toBeCloseTo(5 - FACE, 3);
  });

  test('a corner drop flushes BOTH faces, and R in the corner keeps it in the corner', async ({ page }) => {
    const c = await centreOf(page);
    // Top-left corner: edges 0.2 m off both walls.
    await dragWorld(page, { x: c.x, y: c.y }, { x: 0.2 + L / 2, y: 0.2 + W / 2 }, 12);
    await expect.poll(async () => (await allStoredItems(page))[0].x).toBeCloseTo(FACE, 3);
    let it = (await allStoredItems(page))[0];
    expect(it.y).toBeCloseTo(FACE, 3);
    // Facing kept: it was landscape (rotation 0) and the top wall is the
    // one it faces — the corner must not spin it.
    expect(it.rotation).toBe(0);

    // Quarter turn IN the corner: stays flush on both faces at the new
    // footprint (0.95 wide, 2.05 tall). Before the fix it popped 5 cm into
    // the top wall and 0.55 m off the left wall.
    await clickWorld(page, it.x + 0.3, it.y + 0.3);
    await page.keyboard.press('r');
    await expect.poll(async () => (await allStoredItems(page))[0].rotation % 180).toBe(90);
    it = (await allStoredItems(page))[0];
    expect(it.x).toBeCloseTo(FACE, 3);
    expect(it.y).toBeCloseTo(FACE, 3);
  });

  test('a free-standing drop near the far wall is kept inside the room instead of bouncing', async ({
    page,
  }) => {
    const c = await centreOf(page);
    // Right edge 0.7 m from the right wall: beyond the engage distance, so
    // free-standing. The 0.5 m grid position (x = 2.5 → right edge 4.55)
    // is inside; push a touch further so the grid would overrun.
    await dragWorld(page, { x: c.x, y: c.y }, { x: 5 - 0.5 - L / 2 + 0.2, y: c.y }, 12);
    const it = (await allStoredItems(page))[0];
    const w = it.rotation % 180 === 0 ? L : W;
    expect(it.x + w).toBeLessThanOrEqual(5 - FACE + 1e-3);
    expect(it.x).toBeGreaterThanOrEqual(FACE - 1e-3);
  });
});
