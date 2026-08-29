/**
 * Sims world (2026-08-29) — real-browser acceptance for the new coverage:
 *
 *   1. corner + inner-face wall snap
 *   2. dragging a rotated item mid-room keeps its rotation
 *   3. items outside every room land Outdoors; a locked plot refuses off-plot drops
 *   4. an open wall run is kept as free walls (and one undo removes them)
 *   5. the snap-unit stepper: +/- mid-draw, HUD buttons, [ / ] at any time
 *   6. storeys: add a floor, draw on it, switch back; per-level rendering
 *   7. lights: L toggles the selected light and its rendered pool
 *
 * Every test here FAILS on the pre-Sims-world build (`main` @ 040a9f6):
 * the old resolver flushed to the polygon edge (y = 0, never 0.05) and
 * snapped ONE wall (no corner), a mid-room drag reset rotation to 0, a drop
 * outside every room was refused, an open wall run was discarded, the draw
 * HUD had no stepper, and neither levels nor lights existed.
 *
 * Coordinates come from the DEV geometry bridge (`window.__ppwGeom`), so
 * the whole file skips against a production build. Run it with:
 *   npm run dev -- --port 5187 && \
 *   PPW_E2E_BASE_URL=http://localhost:5187 npx playwright test sims-world
 */

import { test, expect, type Page } from '@playwright/test';
import { GEOM_BRIDGE_SKIP, renderedRoomCount } from './multiroom-helpers';
import {
  allStoredItems,
  armAndClickWorld,
  clickWorld,
  dragWorld,
  installToastLog,
  konvaNodeCount,
  oneRoomFixture,
  requireGeomBridgeGenerous,
  seedSimsProperty,
  storedPrecision,
  storedSimsProperty,
  toastLog,
  waitForGeom,
} from './sims-world-helpers';

/** Treadmill seed: 205 x 95 cm; length along X at rotation 0. */
const TREADMILL = 'k1-nordictrack-2450';
const TREADMILL_LEN = 2.05;
const TREADMILL_WID = 0.95;
/** Inner-face inset: walls are 0.1 m thick, stroked centred on the edge. */
const WALL_HALF_M = 0.05;

async function openSeeded(page: Page): Promise<void> {
  await page.goto('/designer');
  await page.waitForSelector('.konvajs-content canvas', { state: 'attached', timeout: 30_000 });
  if (!(await requireGeomBridgeGenerous(page))) test.skip(true, GEOM_BRIDGE_SKIP);
  await waitForGeom(page);
  // The auto-centre fit runs a frame or more after the first paint; every
  // screen point below is read fresh, but let the first fit settle.
  await page.waitForTimeout(500);
}

test.describe('Sims world', () => {
  // A 5 x 4 m room is 500 x 400 px at scale 1 — a 1920-wide stage keeps every
  // wall (and the garden to its east) on the actual Konva canvas.
  test.use({ viewport: { width: 1920, height: 1080 } });
  // These run against a SHARED vite dev server; a cold transform or a
  // parallel run can push one page load past the 30 s default (serial,
  // unloaded: every test here finishes in 1.5-3.5 s; six workers beside
  // other suites: up to ~60 s). Nothing waits on a fixed sleep, so the
  // headroom only matters under load.
  test.describe.configure({ timeout: 90_000 });

  test('1. a drop near a corner flushes to BOTH inner faces; a wall drop flushes to the inner face', async ({
    page,
  }) => {
    await seedSimsProperty(page, oneRoomFixture());
    await openSeeded(page);
    await expect(page.locator('[data-testid="items-placed"]')).toHaveText('0');

    // Near the top-left corner: the top wall is the primary (closer along
    // the depth), the left wall is within the gap → corner snap. Both faces
    // sit 0.05 m INSIDE the polygon edge.
    await armAndClickWorld(page, TREADMILL, 0.4, 0.3);
    await expect.poll(() => allStoredItems(page).then((i) => i.length)).toBe(1);
    const [corner] = await allStoredItems(page);
    expect(corner.rotation).toBe(0);
    expect(corner.x).toBeCloseTo(WALL_HALF_M, 3);
    expect(corner.y).toBeCloseTo(WALL_HALF_M, 3);

    // Deselect so the selection handles never sit under the next click.
    await page.keyboard.press('Escape');

    // Mid top wall, well clear of both side walls → one-wall flush on the
    // inner face, auto-oriented to face into the room.
    await armAndClickWorld(page, TREADMILL, 2.5, 0.6);
    await expect.poll(() => allStoredItems(page).then((i) => i.length)).toBe(2);
    const items = await allStoredItems(page);
    const top = items[1];
    expect(top.rotation).toBe(0);
    expect(top.y).toBeCloseTo(WALL_HALF_M, 3);
    // Still inside the room's inner faces along the wall, and not on top
    // of the corner item (the blocked slot slides ALONG the wall, never off it).
    expect(top.x).toBeGreaterThanOrEqual(corner.x + TREADMILL_LEN - 1e-6);
    expect(top.x + TREADMILL_LEN).toBeLessThanOrEqual(5 - WALL_HALF_M + 1e-6);

    await page.screenshot({ path: 'test-results/sims-world-corner.png', fullPage: false });
  });

  test('2. dragging a rotated item mid-room keeps its rotation', async ({ page }) => {
    // Rotated 90°: footprint 0.95 wide x 2.05 deep, top-left (2, 1) → centre (2.475, 2.025).
    await seedSimsProperty(
      page,
      oneRoomFixture([{ instanceId: 'tm-1', productId: TREADMILL, x: 2, y: 1, rotation: 90 }]),
    );
    await openSeeded(page);
    const [before] = await allStoredItems(page);
    expect(before.rotation).toBe(90);

    const cx = 2 + TREADMILL_WID / 2;
    const cy = 1 + TREADMILL_LEN / 2;
    // One metre east: the new centre is > 1 m from every wall (no wall pull),
    // so the resolver's free-standing branch decides the rotation.
    await dragWorld(page, { x: cx, y: cy }, { x: cx + 1, y: cy });

    await expect.poll(() => allStoredItems(page).then((i) => i[0]?.x)).toBeCloseTo(3, 3);
    const [after] = await allStoredItems(page);
    expect(after.instanceId).toBe('tm-1');
    // THE assertion: the pre-2026-08-29 drag handler committed the resolver's
    // `plain(0)` rotation, so a 90° item came back at 0°.
    expect(after.rotation).toBe(90);
    expect(after.x).toBeCloseTo(3, 3);
    expect(after.y).toBeCloseTo(1, 3);
  });

  test('3. a drop outside every room lands Outdoors; a locked plot refuses off-plot drops', async ({
    page,
  }) => {
    await seedSimsProperty(page, oneRoomFixture());
    await openSeeded(page);
    // Toasts auto-dismiss after 2.4 s; record them so the refusal checks
    // below cannot race the dismissal on a slow run.
    await installToastLog(page);

    // The new Outdoor dock tab (absent on the old build).
    await page.locator('[data-testid="dock-cat-outdoor"]').click();
    await armAndClickWorld(page, 'demo-outdoor-bench', 7, 2);

    await expect.poll(() => allStoredItems(page).then((i) => i.length)).toBe(1);
    // No "outside the plan" / "off the plot" refusal was shown — the drop is legal.
    expect((await toastLog(page)).filter((t) => /outside the plan|off the plot/i.test(t))).toEqual([]);
    const prop1 = await storedSimsProperty(page);
    const outdoors = prop1!.rooms.filter((r) => r.kind === 'outdoor');
    expect(outdoors).toHaveLength(1);
    expect(outdoors[0].placedItems).toHaveLength(1);
    expect(outdoors[0].placedItems[0].productId).toBe('demo-outdoor-bench');
    expect(outdoors[0].polygon).toEqual([]);
    // The bench really is outside the 5 x 4 room.
    expect(outdoors[0].placedItems[0].x).toBeGreaterThanOrEqual(5);
    // The room itself is untouched.
    expect(prop1!.rooms.find((r) => r.id === 'r1')!.placedItems).toHaveLength(0);

    await page.keyboard.press('Escape');

    // Lock the land plot at 8 x 6 m.
    await page.locator('[data-testid="land-toggle"]').click();
    await expect(page.locator('[data-testid="land-picker"]')).toBeVisible();
    await page.locator('[data-testid="land-width"]').fill('8');
    await page.locator('[data-testid="land-depth"]').fill('6');
    await page.locator('[data-testid="land-apply"]').click();
    await expect(page.locator('[data-testid="plot-capacity"]')).toBeVisible();
    await expect.poll(() => storedSimsProperty(page).then((p) => p?.site?.widthM)).toBe(8);
    await expect.poll(() => storedSimsProperty(page).then((p) => p?.site?.depthM)).toBe(6);
    // The fit re-centres on the plot — let it settle before reading points.
    await page.waitForTimeout(400);

    // World (12, 2) is east of the 8 m plot → refused, count unchanged.
    await armAndClickWorld(page, 'demo-outdoor-bench', 12, 2, { expectDisarm: false });
    await expect
      .poll(() => toastLog(page).then((l) => l.filter((t) => /off the plot/i.test(t)).length))
      .toBe(1);
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-armed="true"]')).toHaveCount(0);
    await page.waitForTimeout(300);
    expect(await allStoredItems(page)).toHaveLength(1);
    expect((await storedSimsProperty(page))!.rooms.filter((r) => r.kind === 'outdoor')).toHaveLength(1);

    await page.screenshot({ path: 'test-results/sims-world-outdoors.png', fullPage: false });
  });

  test('4. an open wall run becomes free walls, and one undo removes them', async ({ page }) => {
    await seedSimsProperty(page, oneRoomFixture());
    await openSeeded(page);

    // "+ Walls" is the same pen as Draw: the room-draw HUD, not the retired
    // interior-wall HUD.
    await page.locator('[data-testid="wall-tool-toggle"]').click();
    await expect(page.locator('[data-testid="room-draw-hud"]')).toBeVisible();
    await expect(page.locator('[data-testid="wall-draw-hud"]')).toHaveCount(0);

    // An L-shaped OPEN run east of the room: (6,1) → (8,1) → (8,3).
    await clickWorld(page, 6, 1);
    await clickWorld(page, 8, 1);
    await clickWorld(page, 8, 3);
    await expect(page.locator('[data-testid="room-draw-vertices-count"]')).toContainText('3');

    const finish = page.locator('[data-testid="room-draw-finish-walls"]');
    await expect(finish).toBeEnabled();
    await finish.click();

    await expect.poll(() => storedSimsProperty(page).then((p) => p?.walls?.length ?? 0)).toBe(2);
    const prop = await storedSimsProperty(page);
    const walls = prop!.walls!;
    const near = (v: { x: number; y: number }, x: number, y: number) => {
      expect(v.x).toBeCloseTo(x, 1);
      expect(v.y).toBeCloseTo(y, 1);
      expect(Math.abs(v.x - x)).toBeLessThanOrEqual(0.05);
      expect(Math.abs(v.y - y)).toBeLessThanOrEqual(0.05);
    };
    near(walls[0].a, 6, 1);
    near(walls[0].b, 8, 1);
    near(walls[1].a, 8, 1);
    near(walls[1].b, 8, 3);
    for (const w of walls) {
      expect(typeof w.id).toBe('string');
      expect(w.thicknessM).toBeGreaterThan(0);
    }
    // No room was committed for an open run, and the legacy wall store is empty.
    expect(prop!.rooms.filter((r) => r.polygon.length >= 3)).toHaveLength(1);
    expect(await page.evaluate(() => localStorage.getItem('ppw_walls_v1'))).toBeNull();
    // Draw mode has exited.
    await expect(page.locator('[data-testid="room-draw-hud"]')).toHaveCount(0);

    await page.screenshot({ path: 'test-results/sims-world-free-walls.png', fullPage: false });

    // Undo covers free walls: one Ctrl+Z, the run is gone.
    await page.waitForTimeout(500);
    await page.keyboard.press('Control+z');
    await expect.poll(() => storedSimsProperty(page).then((p) => p?.walls?.length ?? 0)).toBe(0);
    expect((await storedSimsProperty(page))!.rooms.filter((r) => r.polygon.length >= 3)).toHaveLength(1);
  });

  test('5. the snap unit steps with + / - mid-draw, the HUD stepper, and [ / ] any time', async ({
    page,
  }) => {
    await seedSimsProperty(page, oneRoomFixture());
    await openSeeded(page);

    await page.locator('[data-testid="room-draw-toggle"]').click();
    const hud = page.locator('[data-testid="room-draw-hud"]');
    await expect(hud).toBeVisible();
    // The stepper is rendered twice (desktop HUD + the mobile draw strip,
    // which is display:none at this width) — scope to the HUD's copy.
    const stepper = hud.locator('[data-testid="snap-unit-stepper"]');
    await expect(stepper).toBeVisible();
    const current = hud.locator('[data-testid="snap-unit-current"]');
    await expect(current).toHaveText('0.5 m');

    // "+1" twice: 0.5 m → 0.25 m → 10 cm. Outside a draw + is zoom; in a
    // draw it owns the unit.
    await page.keyboard.press('+');
    await expect(current).toHaveText('0.25 m');
    await page.keyboard.press('+');
    await expect(current).toHaveText('10 cm');
    await expect.poll(() => storedPrecision(page)).toBe('cm10');

    // The HUD button steps the same ladder.
    await hud.locator('[data-testid="snap-unit-coarser"]').click();
    await expect(current).toHaveText('0.25 m');
    await expect.poll(() => storedPrecision(page)).toBe('quarter');

    // Leave draw mode; ] steps finer at any time.
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-testid="room-draw-hud"]')).toHaveCount(0);
    await page.keyboard.press(']');
    await expect.poll(() => storedPrecision(page)).toBe('cm10');
    await page.keyboard.press('[');
    await expect.poll(() => storedPrecision(page)).toBe('quarter');
  });

  test('6. a floor above: draw a room on it, switch back, each floor renders only its own rooms', async ({
    page,
  }) => {
    await seedSimsProperty(page, oneRoomFixture());
    await openSeeded(page);
    // Single storey: no readout yet.
    await expect(page.locator('[data-testid="level-readout"]')).toHaveCount(0);

    await page.locator('[data-testid="levels-toggle"]').click();
    await expect(page.locator('[data-testid="levels-picker"]')).toBeVisible();
    await page.locator('[data-testid="level-add"]').click();
    await expect(page.locator('[data-testid="level-readout"]')).toContainText('First floor');

    const afterAdd = await storedSimsProperty(page);
    expect(afterAdd!.levels).toHaveLength(2);
    const upper = afterAdd!.levels!.find((l) => l.index === 1)!;
    expect(upper.name).toBe('First floor');
    expect(afterAdd!.activeLevelId).toBe(upper.id);
    // The ground room is not drawn on the first floor; its outline shows as a ghost.
    expect(await renderedRoomCount(page)).toBe(0);
    const ghostsUp = await konvaNodeCount(page, 'room-below');
    if (ghostsUp >= 0) expect(ghostsUp).toBe(1);

    // Draw a 3 x 3 m room on the first floor, closing on the first point.
    await page.locator('[data-testid="room-draw-toggle"]').click();
    await expect(page.locator('[data-testid="room-draw-hud"]')).toBeVisible();
    await clickWorld(page, 0.5, 0.5);
    await clickWorld(page, 3.5, 0.5);
    await clickWorld(page, 3.5, 3.5);
    await clickWorld(page, 0.5, 3.5);
    await clickWorld(page, 0.5, 0.5);
    await expect(page.locator('[data-testid="room-draw-hud"]')).toHaveCount(0);

    await expect
      .poll(() => storedSimsProperty(page).then((p) => p!.rooms.filter((r) => r.polygon.length >= 3).length))
      .toBe(2);
    const drawn = await storedSimsProperty(page);
    const ground = drawn!.rooms.find((r) => r.id === 'r1')!;
    expect(ground.levelId).toBeUndefined();
    expect(ground.polygon).toEqual(oneRoomFixture().rooms[0].polygon);
    const upperRooms = drawn!.rooms.filter((r) => r.levelId === upper.id && r.polygon.length >= 3);
    expect(upperRooms).toHaveLength(1);
    const xs = upperRooms[0].polygon.map((v) => v.x);
    const ys = upperRooms[0].polygon.map((v) => v.y);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(3, 3);
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(3, 3);
    // On the first floor exactly ONE room renders (its own), though two exist.
    await expect.poll(() => renderedRoomCount(page)).toBe(1);

    // PageDown → ground floor: readout flips, and again ONE room renders —
    // the first-floor room is not drawn on the ground.
    await page.keyboard.press('PageDown');
    await expect(page.locator('[data-testid="level-readout"]')).toContainText('Ground floor');
    await expect.poll(() => storedSimsProperty(page).then((p) => p?.activeLevelId ?? 'ground')).toBe('ground');
    await expect.poll(() => renderedRoomCount(page)).toBe(1);
    const ghostsDown = await konvaNodeCount(page, 'room-below');
    if (ghostsDown >= 0) expect(ghostsDown).toBe(0);
    // Store still holds both drawn rooms — the mismatch IS the per-level render.
    expect((await storedSimsProperty(page))!.rooms.filter((r) => r.polygon.length >= 3)).toHaveLength(2);

    await page.screenshot({ path: 'test-results/sims-world-levels.png', fullPage: false });
  });

  test('7. L toggles the selected light off and on, with its rendered pool', async ({ page }) => {
    // 40 x 40 cm floor lamp at (2, 2) → centre (2.2, 2.2). lightOn absent = on.
    await seedSimsProperty(
      page,
      oneRoomFixture([{ instanceId: 'lamp-1', productId: 'demo-floor-lamp', x: 2, y: 2, rotation: 0 }]),
    );
    await openSeeded(page);

    const pools = () => konvaNodeCount(page, 'light-pool');
    const konvaExposed = (await pools()) >= 0;
    if (!konvaExposed) {
      console.log('[sims-world] window.Konva not exposed — asserting the light via the store only');
    } else {
      await expect.poll(pools).toBe(1);
    }

    // Select the lamp by clicking its hit rect.
    await clickWorld(page, 2.2, 2.2);
    await expect(page.locator('[data-testid="details-light-toggle"]')).toBeVisible();

    await page.keyboard.press('l');
    await expect.poll(() => allStoredItems(page).then((i) => i[0]?.lightOn)).toBe(false);
    if (konvaExposed) await expect.poll(pools).toBe(0);

    await page.keyboard.press('l');
    await expect.poll(() => allStoredItems(page).then((i) => i[0]?.lightOn)).toBe(true);
    if (konvaExposed) await expect.poll(pools).toBe(1);

    await page.screenshot({ path: 'test-results/sims-world-light.png', fullPage: false });
  });
});
