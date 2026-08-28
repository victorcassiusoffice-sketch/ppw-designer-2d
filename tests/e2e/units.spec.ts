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
      // addInitScript re-runs on EVERY navigation, so an unguarded seed makes
      // a reload silently re-write the very preference a persistence test is
      // trying to observe. The sentinel makes the seed first-load-only.
      if (localStorage.getItem('__ppw_seeded') === '1') return;
      localStorage.clear();
      localStorage.setItem('__ppw_seeded', '1');
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
  test('the picker selects a unit, labels it explicitly, and survives a reload', async ({
    page,
  }) => {
    await seedWithUnit(page, JSON.parse(JSON.stringify(ONE_ROOM_FIXTURE)), 'full');
    await page.goto('/designer');
    await page.waitForSelector('.konvajs-content canvas', { state: 'attached' });

    const toggle = page.locator('[data-testid="snap-unit-toggle"]');
    await expect(toggle).toHaveText('Snap 0.5 m');

    await toggle.click();
    await page.locator('[data-testid="snap-unit-cm1"]').click();

    // A DERIVED label would render this as "Snap 0.01 m". The explicit
    // SNAP_UNIT_LABEL table is what makes it read as a unit a human picked.
    await expect(toggle).toHaveText('Snap 1 cm');

    // Both halves of the Ctrl+F pair must persist. Storing only `precision`
    // means a reload on 1 cm then Ctrl+F swaps to the module default rather
    // than the unit the user was actually alternating with.
    const persisted = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('ppw_designer_ui_v1') ?? 'null'),
    );
    expect(persisted).toEqual({
      state: { precision: 'cm1', lastPrecision: 'full' },
      version: 1,
    });

    // Catches a store that was widened but never wrapped in persist.
    await page.reload();
    await page.waitForSelector('.konvajs-content canvas', { state: 'attached' });
    await expect(page.locator('[data-testid="snap-unit-toggle"]')).toHaveText('Snap 1 cm');
  });

  test('a fine unit unblocks the typed room dimensions', async ({ page }) => {
    await seedWithUnit(page, JSON.parse(JSON.stringify(ONE_ROOM_FIXTURE)), 'cm10');
    await page.goto('/designer');
    await page.waitForSelector('.konvajs-content canvas', { state: 'attached' });

    // Vic Q3: the floor was 1 m at BOTH layers - the input`s min AND the
    // designStore clamp - so a sub-metre room was impossible to type.
    const lengthInput = page.locator('input[type="number"]').first();
    await expect(lengthInput).toHaveAttribute('min', '0.1');
    await expect(lengthInput).toHaveAttribute('step', '0.1');
  });
  test('the drawn grid steps up so a fine unit cannot flood the canvas', async ({
    page,
  }) => {
    // A 12 x 8 m room. At 1920x1080 that union is 1200 x 800 px, so the
    // auto-centre fit clamps the scale to exactly 1 - which the assertion
    // below pins, so the line count can never drift silently if the fit
    // changes.
    //
    // At the 1 cm SNAP unit the DRAWN grid must step up to the 0.1 m tier
    // (1 cm would be 1 screen px, under the 8 px floor): 121 vertical +
    // 81 horizontal = 202 lines. Every wrong build lands elsewhere:
    //   - ignoring the tier entirely (0.5 m)    ->  25 +  17 =   42
    //   - one line per snap step (1 cm)         -> 1201 + 801 = 2002
    const BIG_ROOM = {
      id: 'prop-grid',
      name: 'Grid Property',
      activeRoomId: 'r1',
      rooms: [
        {
          id: 'r1',
          name: 'Hall',
          polygon: [
            { x: 0, y: 0 },
            { x: 12, y: 0 },
            { x: 12, y: 8 },
            { x: 0, y: 8 },
          ],
          placedItems: [],
        },
      ],
    };

    await seedWithUnit(page, BIG_ROOM, 'cm1');
    await page.goto('/designer');
    await page.waitForSelector('.konvajs-content canvas', { state: 'attached' });
    await page.waitForTimeout(800);

    const pxPerM = await livePxPerMetre(page);
    expect(pxPerM).toBeCloseTo(100, 3);

    // Count MOUNTED Konva nodes, not store arithmetic: a tier computed
    // correctly but never threaded into the render would still pass a
    // store-side assertion.
    const lineCount = await page.evaluate(() => {
      const stage = window.Konva?.stages?.[0];
      if (!stage) return -1;
      return stage.find('.room-grid').reduce((n, g) => n + g.getChildren().length, 0);
    });
    expect(lineCount).toBe(202);
  });
});
