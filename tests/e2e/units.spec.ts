/**
 * Selectable snap units — P2 acceptance (Vic 2026-08-28).
 *
 * This is the gate that proves the FEATURE exists rather than the store.
 * P1 widened `PRECISION_STEP_M`, but a build that widened the table and
 * never threaded the step into the snap call sites would still draw on the
 * old half-metre lattice and every unit test would stay green.
 *
 * Both assertions below are chosen to be FALSIFIABLE against exactly that
 * build:
 *
 *  • The room vertex lands on an off-grid metre value (x = 3.47) that a
 *    0.5 m build rounds to 3.50. Note the naive assertion "every vertex is
 *    a whole number of centimetres" would have passed on an UNTOUCHED
 *    build, because 0.5 is itself an exact multiple of 0.01 — that is
 *    blocker A3 in the brief, and why this spec asserts a value instead.
 *
 *  • The wall segment's length in mm is deliberately NOT a multiple of
 *    500. If the wall tool were still snapping to WALL_SNAP_MM both
 *    endpoints would sit on the 500 mm lattice and their difference would
 *    be a multiple of 500 — so the modulo check cannot pass by luck.
 *
 * Run against a local dev server (playwright.config.ts defaults BASE_URL to
 * PRODUCTION, which cannot contain an unbuilt feature):
 *   PPW_E2E_BASE_URL=http://localhost:5187 npx playwright test units
 */

import { test, expect, type Page } from '@playwright/test';
import { storedProperty, worldToScreen, type SeedProperty } from './multiroom-helpers';

/** One on-grid 5 × 4 m room. The new room is drawn clear to its east. */
const ONE_ROOM_FIXTURE: SeedProperty = {
  id: 'prop-units',
  name: 'Units Property',
  activeRoomId: 'r1',
  rooms: [
    {
      id: 'r1',
      name: 'Room 1',
      polygon: [
        { x: 0, y: 0 },
        { x: 5, y: 0 },
        { x: 5, y: 4 },
        { x: 0, y: 4 },
      ],
      placedItems: [],
    },
  ],
};

/**
 * Seed the property AND the unit preference together.
 *
 * `ppw_designer_ui_v1` is the store's own persist key (units brief D1); the
 * property key is deliberately left at `version: 2` with no schema change.
 */
async function seedWithUnit(
  page: Page,
  prop: SeedProperty | null,
  precision: string,
): Promise<void> {
  await page.addInitScript(
    ([p, unit]) => {
      localStorage.clear();
      localStorage.setItem('ppw_designer_coach_v1', '1');
      localStorage.setItem(
        'ppw_designer_ui_v1',
        JSON.stringify({ state: { precision: unit, lastPrecision: 'full' }, version: 1 }),
      );
      if (p) {
        localStorage.setItem(
          'ppw_property_v2',
          JSON.stringify({
            state: { property: p, showGrid: true, pxPerMetre: 100 },
            version: 2,
          }),
        );
      }
    },
    [prop, precision] as [SeedProperty | null, string],
  );
}

/**
 * Live pixels-per-world-metre, read from the canvas's own Konva transform.
 *
 * Never assume 100: the auto-centre fit clamps scale to the union size, so a
 * hardcoded constant silently mis-aims every click on a differently-sized
 * fixture and the spec then asserts against the wrong coordinate frame.
 */
async function livePxPerMetre(page: Page): Promise<number> {
  const a = await worldToScreen(page, 0, 0);
  const b = await worldToScreen(page, 1, 0);
  if (!a || !b) throw new Error('geom bridge unavailable — run against a DEV server');
  return b.x - a.x;
}

async function clickWorld(page: Page, xM: number, yM: number): Promise<void> {
  const pt = await worldToScreen(page, xM, yM);
  if (!pt) throw new Error('geom bridge unavailable');
  await page.mouse.move(pt.x, pt.y, { steps: 4 });
  await page.mouse.click(pt.x, pt.y);
}

test.describe('Selectable snap units', () => {
  test.use({ viewport: { width: 1920, height: 1080 } });

  test('the room tool draws on the selected unit, not the half-metre lattice', async ({
    page,
  }) => {
    await seedWithUnit(page, JSON.parse(JSON.stringify(ONE_ROOM_FIXTURE)), 'cm1');
    await page.goto('/designer');
    await page.waitForSelector('.konvajs-content canvas', { state: 'attached' });

    const seeded = await storedProperty(page);
    expect(seeded!.rooms).toHaveLength(1);

    await page.locator('[data-testid="room-draw-toggle"]').click();

    // Drawn well clear of the seeded room's x = 5 east wall. At cm1 the
    // wall magnet is wallSnapTolM(0.01) = 0.05 m (the clamp floor), so
    // 6.47 is ~29 tolerances away and cannot be pulled onto the wall —
    // the vertex can only be where the GRID snap put it.
    await clickWorld(page, 6.47, 0.31);
    await clickWorld(page, 9.23, 0.31);
    await clickWorld(page, 9.23, 3.77);
    await clickWorld(page, 6.47, 3.77);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(400);

    const after = await storedProperty(page);
    expect(after!.rooms).toHaveLength(2);

    const drawn = after!.rooms[1];
    const westX = Math.min(...drawn.polygon.map((v) => v.x));
    const northY = Math.min(...drawn.polygon.map((v) => v.y));

    // THE assertion. A build that widened the store but left
    // RoomDrawMode on its own GRID_STEP_M = 0.5 lands these on 6.50 / 0.50.
    expect(westX).toBeCloseTo(6.47, 6);
    expect(northY).toBeCloseTo(0.31, 6);
  });

  test('the wall tool commits endpoints finer than the 500 mm lattice', async ({ page }) => {
    await seedWithUnit(page, null, 'cm1');
    await page.goto('/designer?fresh=1');
    await page.locator('[data-testid="start-quick-rectangle"]').click();
    await page.waitForSelector('[data-testid="items-placed"]', { timeout: 15_000 });

    const pxPerM = await livePxPerMetre(page);
    expect(pxPerM).toBeGreaterThan(1);

    await page.locator('[data-testid="wall-tool-toggle"]').click();
    await expect(page.locator('[data-testid="wall-draw-hud"]')).toBeVisible();

    // One segment, 1.37 m long BY CONSTRUCTION. 1370 is not a multiple of
    // 500, so if the wall tool were still snapping to WALL_SNAP_MM both
    // endpoints would land on the 500 lattice and the difference would be
    // 1000 or 1500 — the modulo below cannot pass by accident.
    const start = await worldToScreen(page, 1.5, 1.5);
    if (!start) throw new Error('geom bridge unavailable');
    await page.mouse.click(start.x, start.y);
    await page.mouse.click(start.x + 1.37 * pxPerM, start.y);
    await page.waitForTimeout(300);

    const walls = await page.evaluate(() => {
      try {
        return JSON.parse(localStorage.getItem('ppw_walls_v1') ?? '[]') as Array<{
          start: { x_mm: number; y_mm: number };
          end: { x_mm: number; y_mm: number };
        }>;
      } catch {
        return [];
      }
    });
    expect(walls.length).toBeGreaterThan(0);

    const w = walls[0];
    const coords = [w.start.x_mm, w.start.y_mm, w.end.x_mm, w.end.y_mm];

    // Every endpoint is a whole number of centimetres — the integer-mm
    // invariant the ladder guarantees, which detectClosedRoomVertices
    // depends on for its exact `${x_mm},${y_mm}` endpoint matching.
    for (const c of coords) {
      expect(Math.abs(c % 10)).toBeLessThan(1e-9);
    }

    // And the segment is finer than the old lattice.
    const dx = Math.abs(w.end.x_mm - w.start.x_mm);
    expect(dx).toBeGreaterThan(0);
    expect(dx % 500).not.toBe(0);
  });
});
