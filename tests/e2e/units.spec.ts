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
import {
  historyFrameCount,
  storedProperty,
  worldToScreen,
  TWO_ROOM_FIXTURE,
  type SeedProperty,
} from './multiroom-helpers';

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

/**
 * Wait for the DEV geom bridge to report ready.
 *
 * `worldToScreen` returns null until the Konva stage is mounted AND the
 * bridge has been wired to it. Calling it too early yields a null that reads
 * as "bridge unavailable" when the truth is "not yet".
 */
async function waitForGeom(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const g = (window as unknown as { __ppwGeom?: { ready: () => boolean } }).__ppwGeom;
    return !!g && g.ready();
  }, undefined, { timeout: 15_000 });
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
  test('a typed length places the next vertex without committing the room', async ({
    page,
  }) => {
    // At the 1 cm unit a typed 3.25 is exactly representable. The coarse-unit
    // behaviour - the typed value quantising to the chosen step - is pinned by
    // its own test below.
    await seedWithUnit(page, JSON.parse(JSON.stringify(ONE_ROOM_FIXTURE)), 'cm1');
    await page.goto('/designer');
    await page.waitForSelector('.konvajs-content canvas', { state: 'attached' });

    const before = await storedProperty(page);
    expect(before.rooms).toHaveLength(1);

    await page.locator('[data-testid="room-draw-toggle"]').click();

    // THREE vertices, deliberately. At two the capture handler takes the
    // "<3" branch, toasts "Need at least 3 walls" and returns WITHOUT
    // stopping propagation - so the event still reaches the field and the
    // collision stays invisible. At three, a build without the arbitration
    // early return COMMITS THE ROOM on Enter.
    await clickWorld(page, 7, 1);
    await clickWorld(page, 9, 1);
    await clickWorld(page, 9, 3);

    // Point the cursor to give a direction, then type the magnitude.
    const dir = await worldToScreen(page, 6, 3);
    if (!dir) throw new Error('geom bridge unavailable');
    await page.mouse.move(dir.x, dir.y, { steps: 4 });

    const field = page.locator('[data-testid="draw-segment-length"]');
    await expect(field).toBeEnabled();
    await field.click();
    await field.fill('3.25');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);

    // 1 - a fourth vertex exists.
    const verts = await page.evaluate(() => {
      const g = window.__ppwGeom;
      return g && g.ready() ? g.drawVertices() : null;
    });
    expect(verts).not.toBeNull();
    expect(verts).toHaveLength(4);

    // 2 - it is exactly 3.25 m from the third, along the cursor direction.
    const d = Math.hypot(verts[3].x - verts[2].x, verts[3].y - verts[2].y);
    expect(d).toBeCloseTo(3.25, 6);

    // 3 - and the room was NOT committed. This is the assertion that fails
    //     loudly on a build missing the capture-phase early return.
    const after = await storedProperty(page);
    expect(after.rooms).toHaveLength(1);
  });
  test('a typed length quantises to the chosen unit', async ({ page }) => {
    await seedWithUnit(page, JSON.parse(JSON.stringify(ONE_ROOM_FIXTURE)), 'full');
    await page.goto('/designer');
    await page.waitForSelector('.konvajs-content canvas', { state: 'attached' });

    await page.locator('[data-testid="room-draw-toggle"]').click();
    await clickWorld(page, 7, 1);
    await clickWorld(page, 9, 1);
    await clickWorld(page, 9, 3);

    const dir = await worldToScreen(page, 6, 3);
    if (!dir) throw new Error('geom bridge unavailable');
    await page.mouse.move(dir.x, dir.y, { steps: 4 });

    const field = page.locator('[data-testid="draw-segment-length"]');
    await field.click();
    await field.fill('3.25');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);

    // At the 0.5 m unit, 3.25 is off-lattice and snaps to 3.5. That is the
    // contract: the field types a length IN the active unit, it does not
    // escape it. Typing 3.25 at 1 cm gives exactly 3.25 (test above).
    const verts = await page.evaluate(() => {
      const g = window.__ppwGeom;
      return g && g.ready() ? g.drawVertices() : null;
    });
    expect(verts).toHaveLength(4);
    const d = Math.hypot(verts[3].x - verts[2].x, verts[3].y - verts[2].y);
    expect(d).toBeCloseTo(3.5, 6);
  });
  test('retyping a shared wall moves both rooms and costs exactly one undo', async ({
    page,
  }) => {
    await seedWithUnit(page, JSON.parse(JSON.stringify(TWO_ROOM_FIXTURE)), 'full');
    await page.goto('/designer');
    await page.waitForSelector('.konvajs-content canvas', { state: 'attached' });
    await page.waitForTimeout(600);

    const seeded = await storedProperty(page);
    expect(seeded.rooms).toHaveLength(2);
    const framesBefore = await historyFrameCount(page);

    await page.locator('[data-testid="measure-tool-toggle"]').click();
    // AFTER the toggle: switching tools re-renders the canvas, so a bridge
    // that was ready a moment ago can briefly report no live stage.
    await waitForGeom(page);

    // The shared wall is r1 edge 1: (5,0)->(5,4). Click its midpoint.
    const mid = await worldToScreen(page, 5, 2);
    if (!mid) throw new Error('geom bridge unavailable');
    await page.mouse.click(mid.x, mid.y);

    const input = page.locator('[data-testid="edge-length-input"]');
    await expect(input).toBeVisible();
    await input.fill('3');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    // 1 - the shared corner moved to IDENTICAL coordinates in both rooms.
    const after = await storedProperty(page);
    const r1 = after.rooms.find((r) => r.id === 'r1');
    const r2 = after.rooms.find((r) => r.id === 'r2');
    // Both rooms carry the shared wall at x = 5, so the click may land on
    // either room's hit line - and it must not matter. What matters is that
    // the wall is now 3 m long and that BOTH rooms describe it identically.
    const onWall = (poly) =>
      poly
        .filter((v) => Math.abs(v.x - 5) < 1e-9)
        .map((v) => v.y)
        .sort((a, b) => a - b);

    const w1 = onWall(r1.polygon);
    const w2 = onWall(r2.polygon);
    expect(w1).toHaveLength(2);
    // Identical in both rooms - if only the clicked room moved, the two have
    // silently stopped sharing the wall and a gap or overlap now exists.
    expect(w2).toEqual(w1);
    // And it is exactly the typed length.
    expect(Math.abs(w1[1] - w1[0])).toBeCloseTo(3, 6);
    // The seed was 4 m, so this cannot pass on a no-op.
    expect(Math.abs(w1[1] - w1[0])).not.toBeCloseTo(4, 6);

    // 2 - ONE Ctrl+Z restores both polygons byte-identically.
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(500);
    const undone = await storedProperty(page);
    expect(undone.rooms[0].polygon).toEqual(seeded.rooms[0].polygon);
    expect(undone.rooms[1].polygon).toEqual(seeded.rooms[1].polygon);

    // 3 - and the frame count is back where it started. THIS is the one that
    //     catches a phantom duplicate frame: an implementation that calls
    //     recordSnapshot AND lets the subscription coalesce pushes two
    //     identical frames, and assertion 2 still passes because both hold
    //     the same state. Only the count exposes it.
    expect(await historyFrameCount(page)).toBe(framesBefore);
  });
  test('Shift+Enter closes the room and keeps drawing', async ({ page }) => {
    await seedWithUnit(page, JSON.parse(JSON.stringify(ONE_ROOM_FIXTURE)), 'full');
    await page.goto('/designer');
    await page.waitForSelector('.konvajs-content canvas', { state: 'attached' });
    await waitForGeom(page);

    await page.locator('[data-testid="room-draw-toggle"]').click();
    await clickWorld(page, 6.5, 0.5);
    await clickWorld(page, 9, 0.5);
    await clickWorld(page, 9, 3);
    await clickWorld(page, 6.5, 3);
    await page.keyboard.press('Shift+Enter');
    await page.waitForTimeout(600);

    // The room committed...
    const after = await storedProperty(page);
    expect(after.rooms).toHaveLength(2);

    // ...the in-flight polygon is empty...
    const count = await page.evaluate(() => {
      const g = window.__ppwGeom;
      return g && g.ready() ? g.drawVertexCount() : -1;
    });
    expect(count).toBe(0);

    // ...and draw mode is STILL live, so the next click starts room three
    // rather than being swallowed. This is the assertion that fails if the
    // re-arm effect never runs.
    await clickWorld(page, 11, 0.5);
    await page.waitForTimeout(200);
    const after2 = await page.evaluate(() => {
      const g = window.__ppwGeom;
      return g && g.ready() ? g.drawVertexCount() : -1;
    });
    expect(after2).toBe(1);
  });
});
