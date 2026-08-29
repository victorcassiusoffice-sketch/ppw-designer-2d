/**
 * Attached multi-room — P5 DRAW-ATTACH acceptance (Vic 2026-08-26).
 *
 * The riskiest phase's proof. Entering draw mode must destroy nothing, a
 * drawn room must ATTACH to the existing one on an exact shared wall, undo
 * must take back exactly the new room, and draw mode must leave no phantom
 * history frame behind.
 *
 * Run against a local dev server:
 *   PPW_E2E_BASE_URL=http://localhost:5187 npx playwright test multiroom-attach
 */

import { test, expect, type Page } from '@playwright/test';
import {
  PX_PER_M,
  canvasOrigin,
  historyFrameCount,
  roomOrigin,
  seedCoachFlagOnly,
  seedProperty,
  storedProperty,
  storedWallCount,
  type SeedProperty,
} from './multiroom-helpers';

/**
 * ONE drawn room, deliberately OFF-GRID on its east wall (x = 5.13).
 *
 * That 5.13 is what makes the snap assertion falsifiable: on an on-grid
 * seed, plain 0.5 m grid-snapping produces the identical coordinate and a
 * snap-less build passes by accident.
 */
const OFF_GRID_FIXTURE: SeedProperty = {
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

const EAST_WALL_X = 5.13;

/**
 * Free-standing walls on the persisted property (`property.walls`, world
 * metres). `SeedProperty` predates the field, so read it through a cast.
 */
function freeWalls(prop: SeedProperty | null): unknown[] {
  const walls = (prop as (SeedProperty & { walls?: unknown }) | null)?.walls;
  return Array.isArray(walls) ? walls : [];
}

async function enterDrawMode(page: Page): Promise<void> {
  await page.locator('[data-testid="room-draw-toggle"]').click();
}

/**
 * Click a sequence of WORLD points on the canvas, resolving the origin once.
 *
 * `blank: true` uses the canvas corner instead of the gold-wall scan — the
 * scan cannot find a wall when no room is drawn yet.
 */
async function clickWorldPoints(
  page: Page,
  pts: Array<{ x: number; y: number }>,
  opts: { blank?: boolean } = {},
): Promise<void> {
  const origin = opts.blank ? await canvasOrigin(page) : await roomOrigin(page);
  for (const p of pts) {
    const sx = origin.x + p.x * PX_PER_M;
    const sy = origin.y + p.y * PX_PER_M;
    await page.mouse.move(sx, sy, { steps: 4 });
    await page.mouse.click(sx, sy);
  }
}

test.describe('Attached multi-room — draw-attach', () => {
  test.use({ viewport: { width: 1920, height: 1080 } });

  test('a drawn room attaches on an exact shared wall and destroys nothing', async ({ page }) => {
    await seedProperty(page, JSON.parse(JSON.stringify(OFF_GRID_FIXTURE)));
    await page.goto('/designer');
    await page.waitForSelector('.konvajs-content canvas', { state: 'attached' });

    // 1 — the seed is one room + one item, and no free walls exist.
    await expect(page.locator('[data-testid="items-placed"]')).toHaveText('1');
    const seeded = await storedProperty(page);
    expect(seeded!.rooms).toHaveLength(1);
    // Free walls live in `property.walls` (Sims world, 2026-08-29); the seed
    // carries none. The legacy `ppw_walls_v1` wallStore is retired and is
    // emptied on mount after its segments migrate — so BOTH must read empty,
    // and a wall appearing later can only have come from the app itself.
    expect(freeWalls(seeded)).toHaveLength(0);
    expect(await storedWallCount(page)).toBe(0);

    const framesBeforeDraw = await historyFrameCount(page);

    // 2 — entering draw mode changes NOTHING. (The old build wiped the
    //     items here, and the commit loop then deleted the room.)
    await enterDrawMode(page);
    await expect(page.locator('[data-testid="items-placed"]')).toHaveText('1');
    const duringDraw = await storedProperty(page);
    expect(duringDraw!.rooms).toHaveLength(1);
    expect(duringDraw!.rooms[0].placedItems).toHaveLength(1);

    // 3 — draw a rectangle whose LEFT edge sits within SNAP_TOL_M (0.25 m)
    //     of the x = 5.13 wall, then close with Enter.
    await clickWorldPoints(page, [
      { x: 5.2, y: 0.05 },
      { x: 9, y: 0.05 },
      { x: 9, y: 4 },
      { x: 5.2, y: 4 },
    ]);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(400);

    const afterDraw = await storedProperty(page);
    expect(afterDraw!.rooms).toHaveLength(2);
    const newRoom = afterDraw!.rooms[1];
    // The west edge landed EXACTLY on the existing wall. A snap-less build
    // grid-snaps to 5.0, which opens a 0.13 m overlap strip that
    // strictPolygonsOverlap rejects — leaving rooms.length at 1.
    const westX = Math.min(...newRoom.polygon.map((v) => v.x));
    expect(westX).toBeCloseTo(EAST_WALL_X, 6);
    // Room 1 is byte-identical, polygon AND items.
    expect(afterDraw!.rooms[0].polygon).toEqual(OFF_GRID_FIXTURE.rooms[0].polygon);
    expect(afterDraw!.rooms[0].placedItems).toEqual(OFF_GRID_FIXTURE.rooms[0].placedItems);
    // A CLOSED run commits a room and nothing else. The wall pen keeps an
    // OPEN run as free walls (`room-draw-finish-walls` / Alt+Enter); a closed
    // one must not leave a stray free-wall copy of its edges behind.
    expect(freeWalls(afterDraw)).toHaveLength(0);

    // 4 — ONE Ctrl+Z undoes exactly the new room. RoomDrawMode's own Ctrl+Z
    //     interceptor yields when there are no vertices left, so this
    //     reaches the global handler and pops the single committed frame.
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(400);
    const afterUndo = await storedProperty(page);
    expect(afterUndo!.rooms).toHaveLength(1);
    expect(afterUndo!.rooms[0].placedItems).toHaveLength(1);

    // 5a — phantom-frame check, session mirror. Enter draw, Esc out, and the
    //      frame count must be exactly what it was before.
    const framesBeforeEsc = await historyFrameCount(page);
    await enterDrawMode(page);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    expect(await historyFrameCount(page)).toBe(framesBeforeEsc);
    expect(framesBeforeDraw).toBeGreaterThanOrEqual(0);

    console.log('DRAW_ATTACH=true');
  });

  test('phantom-frame check, behavioural: a visit to draw mode does not eat a Ctrl+Z', async ({
    page,
  }) => {
    // 5b — the assertion that a session-mirror bug could not fake. Place an
    //      extra item (badge 2), visit draw mode and Esc out, then ONE
    //      Ctrl+Z must still take the item back to 1. A leftover phantom
    //      frame makes that Ctrl+Z a no-op and the badge stays 2.
    await seedProperty(page, JSON.parse(JSON.stringify(OFF_GRID_FIXTURE)));
    await page.goto('/designer');
    await page.waitForSelector('.konvajs-content canvas', { state: 'attached' });

    const card = page.locator('[data-product-id="k1-schwinn-700ic"]').first();
    await card.click();
    await expect(page.locator('[data-armed="true"]')).toHaveCount(2);
    const origin = await roomOrigin(page);
    await page.mouse.move(origin.x + 3 * PX_PER_M, origin.y + 3 * PX_PER_M, { steps: 8 });
    await page.mouse.click(origin.x + 3 * PX_PER_M, origin.y + 3 * PX_PER_M);
    await expect(page.locator('[data-testid="items-placed"]')).toHaveText('2');
    // Escape BEFORE re-entering draw: closes the DetailsPanel + deselects.
    await page.keyboard.press('Escape');

    await enterDrawMode(page);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    await page.keyboard.press('Control+z');
    await page.waitForTimeout(400);
    await expect(page.locator('[data-testid="items-placed"]')).toHaveText('1');
  });

  test('an OVERLAPPING draw is rejected and the plan is untouched', async ({ page }) => {
    // 6 — draw a rectangle straight through the existing room.
    await seedProperty(page, JSON.parse(JSON.stringify(OFF_GRID_FIXTURE)));
    await page.goto('/designer');
    await page.waitForSelector('.konvajs-content canvas', { state: 'attached' });

    await enterDrawMode(page);
    await clickWorldPoints(page, [
      { x: 2, y: 1 },
      { x: 8, y: 1 },
      { x: 8, y: 3 },
      { x: 2, y: 3 },
    ]);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(400);

    const after = await storedProperty(page);
    expect(after!.rooms).toHaveLength(1);
    expect(after!.rooms[0].polygon).toEqual(OFF_GRID_FIXTURE.rooms[0].polygon);
    await expect(page.getByText(/can't overlap/i).first()).toBeVisible();
  });

  test('the FIRST draw on a fresh blank canvas fills the seed room', async ({ page }) => {
    // 7 — a separate test() with NO fixture seed. `addInitScript` re-runs on
    //     every navigation, so "clear storage + reload" inside a seeded test
    //     would just re-seed.
    await seedCoachFlagOnly(page);
    await page.goto('/designer');
    await page.waitForSelector('.konvajs-content canvas', { state: 'attached' });

    await page.locator('[data-testid="start-draw-room"]').click();
    // Inset from the canvas corner: with no room drawn the viewport is the
    // identity transform, so world (0,0) IS the canvas corner and clicking
    // exactly there sits on the element edge.
    await clickWorldPoints(
      page,
      [
        { x: 1, y: 1 },
        { x: 5, y: 1 },
        { x: 5, y: 4 },
        { x: 1, y: 4 },
      ],
      { blank: true },
    );
    await page.keyboard.press('Enter');
    await page.waitForTimeout(400);

    const after = await storedProperty(page);
    // The blank seed room was FILLED, not orphaned beside a new one.
    expect(after!.rooms).toHaveLength(1);
    expect(after!.rooms[0].polygon.length).toBeGreaterThanOrEqual(3);
  });
});
