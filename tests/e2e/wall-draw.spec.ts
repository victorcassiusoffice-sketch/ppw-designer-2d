/**
 * Wall pen — free-standing walls acceptance (Sims world, 2026-08-29).
 *
 * The M2 interior-wall tool (`wallStore`, millimetres, `ppw_walls_v1`,
 * `wall-draw-hud` / `wall-count` / `room-area`) is RETIRED. "+ Walls"
 * (`wall-tool-toggle`) now opens the SAME pen as the room "Draw" segment
 * (`room-draw-hud`), and the pen has two ways out:
 *
 *   • a run that CLOSES (click the first point / Enter with >= 3 points)
 *     commits a ROOM, exactly as before;
 *   • a run that stays OPEN is kept as FREE WALLS via the HUD's
 *     `room-draw-finish-walls` button or Alt+Enter — walls no longer have
 *     to join. They live on the property:
 *       localStorage ppw_property_v2 -> state.property.walls
 *         = [{ id, a:{x,y}, b:{x,y}, thicknessM, levelId }]   (metres)
 *
 * Every click coordinate comes from the DEV geometry bridge
 * (`window.__ppwGeom.worldToScreen`), so the spec cannot run against a
 * production build — it skips there with the command that does run it:
 *
 *   PPW_E2E_BASE_URL=http://localhost:5187 npx playwright test wall-draw
 */

import { test, expect, type Page } from '@playwright/test';
import {
  drawVertexCount,
  requireGeomBridge,
  GEOM_BRIDGE_SKIP,
  storedProperty,
  worldToScreen,
  type SeedProperty,
} from './multiroom-helpers';

/** One on-grid 5 × 4 m room; every wall below is drawn clear to its east. */
const ONE_ROOM_FIXTURE: SeedProperty = {
  id: 'prop-wall-pen',
  name: 'Wall Pen Property',
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

interface StoredFreeWall {
  id: string;
  a: { x: number; y: number };
  b: { x: number; y: number };
  thicknessM: number;
  levelId?: string;
}

/**
 * First-load-only seed. `seedProperty` from the helpers re-runs on EVERY
 * navigation (it is an addInitScript), so a reload inside a persistence
 * test would silently re-seed and wipe the very walls it is checking.
 */
async function seedOnce(page: Page, prop: SeedProperty): Promise<void> {
  await page.addInitScript((p) => {
    try {
      if (localStorage.getItem('__ppw_seeded') === '1') return;
      localStorage.clear();
      localStorage.setItem('__ppw_seeded', '1');
      localStorage.setItem('ppw_designer_coach_v1', '1');
      localStorage.setItem(
        'ppw_property_v2',
        JSON.stringify({
          state: { property: p, showGrid: true, pxPerMetre: 100 },
          version: 2,
        }),
      );
    } catch {
      /* private mode — ignore */
    }
  }, prop);
}

/** Free walls straight out of the persisted property. */
async function storedFreeWalls(page: Page): Promise<StoredFreeWall[]> {
  return page.evaluate(() => {
    try {
      const raw = localStorage.getItem('ppw_property_v2');
      if (!raw) return [];
      const parsed = JSON.parse(raw) as { state?: { property?: { walls?: unknown } } };
      const walls = parsed.state?.property?.walls;
      return (Array.isArray(walls) ? walls : []) as never;
    } catch {
      return [];
    }
  });
}

/** MOUNTED `free-wall` Konva groups — the render side of the same contract. */
async function renderedFreeWallCount(page: Page): Promise<number> {
  return page.evaluate(() => {
    const stage = window.Konva?.stages?.[0];
    if (!stage) return -1;
    return stage.find('.free-wall').length;
  });
}

async function waitForGeom(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const g = (window as unknown as { __ppwGeom?: { ready: () => boolean } }).__ppwGeom;
      return !!g && g.ready();
    },
    undefined,
    { timeout: 15_000 },
  );
}

/**
 * Whether the DEV geometry bridge can be expected on this target.
 *
 * `requireGeomBridge` in the helpers gives the bridge 5 s. Under a loaded
 * dev server the bridge's dynamic import can land later than that, and the
 * spec would then SKIP — silently dropping coverage on the very branch it
 * exists to guard. So decide on a deterministic tell instead: a vite dev
 * server injects `/@vite/client` into the page and a production build never
 * does. On a dev server the bridge is then given a real wait; on anything
 * else the spec skips at once with the command that does run it.
 */
async function geomBridgeExpected(page: Page): Promise<boolean> {
  const isViteDev = await page.evaluate(
    () => document.querySelector('script[src*="@vite/client"]') !== null,
  );
  if (!isViteDev) return false;
  return requireGeomBridge(page).then(async (fast) => {
    if (fast) return true;
    return page
      .waitForFunction(
        () => Boolean((window as unknown as { __ppwGeom?: unknown }).__ppwGeom),
        undefined,
        { timeout: 30_000 },
      )
      .then(() => true)
      .catch(() => false);
  });
}

async function clickWorld(page: Page, xM: number, yM: number): Promise<void> {
  const pt = await worldToScreen(page, xM, yM);
  if (!pt) throw new Error('geom bridge unavailable');
  await page.mouse.move(pt.x, pt.y, { steps: 4 });
  await page.mouse.click(pt.x, pt.y);
}

test.describe('Wall pen — free-standing walls', () => {
  test.use({ viewport: { width: 1920, height: 1080 } });

  test.beforeEach(async ({ page }) => {
    await seedOnce(page, JSON.parse(JSON.stringify(ONE_ROOM_FIXTURE)));
    await page.goto('/designer');
    await page.waitForSelector('.konvajs-content canvas', { state: 'attached' });
    test.skip(!(await geomBridgeExpected(page)), GEOM_BRIDGE_SKIP);
    await waitForGeom(page);
    expect((await storedProperty(page))!.rooms).toHaveLength(1);
  });

  test('"+ Walls" opens the pen; three points + Finish walls store two free walls that survive a reload', async ({
    page,
  }) => {
    const toggle = page.locator('[data-testid="wall-tool-toggle"]');
    await toggle.click();

    // ONE pen: the walls toggle shows the room-draw HUD, not a HUD of its own.
    const hud = page.locator('[data-testid="room-draw-hud"]');
    await expect(hud).toBeVisible();
    await expect(hud).toContainText(/wall pen/i);
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('[data-testid="wall-draw-hud"]')).toHaveCount(0);

    // Three points: an open L to the east of the seeded room. At the 0.5 m
    // unit every point is on the lattice, so what comes back is exactly what
    // went in — the assertion is on the VALUES, not on "something was stored".
    await clickWorld(page, 6, 1);
    await clickWorld(page, 8, 1);
    await clickWorld(page, 8, 3);
    await expect.poll(() => drawVertexCount(page)).toBe(3);

    // Finish walls — no room is closed, the run is kept as walls.
    const finish = page.locator('[data-testid="room-draw-finish-walls"]');
    await expect(finish).toBeEnabled();
    await finish.click();
    await expect(hud).toHaveCount(0);
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');

    await expect.poll(async () => (await storedFreeWalls(page)).length).toBe(2);
    const walls = await storedFreeWalls(page);
    const asEdge = (w: StoredFreeWall) => [w.a.x, w.a.y, w.b.x, w.b.y];
    expect(walls.map(asEdge)).toEqual([
      [6, 1, 8, 1],
      [8, 1, 8, 3],
    ]);
    for (const w of walls) {
      expect(w.id).toBeTruthy();
      // WALL_THICKNESS_M — the same 0.1 m band the room outlines are stroked at.
      expect(w.thicknessM).toBeCloseTo(0.1, 6);
      // Drawn on the ground floor: either stamped 'ground' or left absent.
      expect(w.levelId === undefined || w.levelId === 'ground').toBe(true);
    }

    // No room was committed for an open run.
    const afterDraw = await storedProperty(page);
    expect(afterDraw!.rooms).toHaveLength(1);

    // And the walls are MOUNTED, not just persisted.
    await expect.poll(() => renderedFreeWallCount(page)).toBe(2);

    // Persistence — the seed is first-load-only, so this is the real store.
    await page.reload();
    await page.waitForSelector('.konvajs-content canvas', { state: 'attached' });
    await waitForGeom(page);
    await expect.poll(async () => (await storedFreeWalls(page)).length).toBe(2);
    expect((await storedFreeWalls(page)).map(asEdge)).toEqual([
      [6, 1, 8, 1],
      [8, 1, 8, 3],
    ]);
    await expect.poll(() => renderedFreeWallCount(page)).toBe(2);
    expect((await storedProperty(page))!.rooms).toHaveLength(1);
  });

  test('one point then Esc stores nothing and closes the pen', async ({ page }) => {
    const toggle = page.locator('[data-testid="wall-tool-toggle"]');
    await toggle.click();
    const hud = page.locator('[data-testid="room-draw-hud"]');
    await expect(hud).toBeVisible();

    await clickWorld(page, 6, 1);
    await expect.poll(() => drawVertexCount(page)).toBe(1);

    await page.keyboard.press('Escape');

    // The pen is gone, the in-flight point with it, and nothing reached the store.
    await expect(hud).toHaveCount(0);
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await expect.poll(() => drawVertexCount(page)).toBe(0);
    expect(await storedFreeWalls(page)).toEqual([]);
    expect((await storedProperty(page))!.rooms).toHaveLength(1);
    expect(await renderedFreeWallCount(page)).toBe(0);
  });

  test('a run that closes on its first point still commits a room, not walls', async ({ page }) => {
    await page.locator('[data-testid="wall-tool-toggle"]').click();
    const hud = page.locator('[data-testid="room-draw-hud"]');
    await expect(hud).toBeVisible();

    // Three points, then the fourth click lands back on the first — the
    // close gesture. Same pen, same gesture, same result as the room tool.
    await clickWorld(page, 6, 0.5);
    await clickWorld(page, 8, 0.5);
    await clickWorld(page, 8, 2.5);
    await expect.poll(() => drawVertexCount(page)).toBe(3);
    await clickWorld(page, 6, 0.5);

    // Closing lifts the pen.
    await expect(hud).toHaveCount(0);
    await expect.poll(() => drawVertexCount(page)).toBe(0);

    // rooms +1, walls unchanged (none).
    await expect.poll(async () => (await storedProperty(page))!.rooms.length).toBe(2);
    const after = await storedProperty(page);
    const drawn = after!.rooms[1];
    expect(drawn.polygon).toHaveLength(3);
    expect(drawn.polygon.map((v) => [v.x, v.y])).toEqual([
      [6, 0.5],
      [8, 0.5],
      [8, 2.5],
    ]);
    expect(await storedFreeWalls(page)).toEqual([]);
    expect(await renderedFreeWallCount(page)).toBe(0);
  });
});
