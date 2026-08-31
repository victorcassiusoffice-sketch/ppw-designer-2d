/**
 * Floor tool — Sims-style per-tile flooring (Vic 2026-08-28; ONE tool named
 * "Floor" with a docked panel, 2026-08-30).
 *
 * Vic asked for The Sims' flooring build workflow. The gestures researched
 * and adopted: click lays a tile, drag lays the rectangle between anchor
 * and cursor, Shift fills the room, Ctrl erases — and a whole stroke is ONE
 * undo, not one per tile.
 *
 * The commercial half is what a game never has to get right: a laid tile
 * is a tile the customer BUYS, so coverage is by INTERSECTION (the floor
 * reaches the walls and boundary tiles are cut) rather than by tile centre,
 * which would leave a bare margin and quote the room short.
 *
 * Run against a local dev server:
 *   PPW_E2E_BASE_URL=http://localhost:5187 npx playwright test floor-paint
 */

import { test, expect, type Page } from '@playwright/test';
import { TWO_ROOM_FIXTURE, worldToScreen, type SeedProperty } from './multiroom-helpers';

interface Zone {
  materialId: string;
  tileWm: number;
  tileHm: number;
  originM: { x: number; y: number };
  runs: number[];
}

async function seed(page: Page, prop: SeedProperty): Promise<void> {
  await page.addInitScript((pp) => {
    // addInitScript re-runs on EVERY navigation, so an unguarded seed makes a
    // reload silently re-write the very state a persistence test is checking.
    if (localStorage.getItem('__ppw_seeded') === '1') return;
    localStorage.clear();
    localStorage.setItem('__ppw_seeded', '1');
    localStorage.setItem('ppw_designer_coach_v1', '1');
    localStorage.setItem(
      'ppw_property_v2',
      JSON.stringify({
        state: { property: pp, showGrid: true, pxPerMetre: 100 },
        version: 2,
      }),
    );
  }, prop);
}

async function zones(page: Page, roomIndex = 0): Promise<Zone[]> {
  return page.evaluate((i) => {
    const raw = localStorage.getItem('ppw_property_v2');
    if (!raw) return [];
    return JSON.parse(raw).state.property.rooms[i].floorTiles ?? [];
  }, roomIndex);
}

function tileCount(zs: Zone[]): number {
  let n = 0;
  for (const z of zs) for (let i = 2; i < z.runs.length; i += 3) n += z.runs[i];
  return n;
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

async function openWithFloorTool(page: Page): Promise<void> {
  await seed(page, JSON.parse(JSON.stringify(TWO_ROOM_FIXTURE)));
  await page.goto('/designer');
  await page.waitForSelector('.konvajs-content canvas', { state: 'attached' });
  await waitForGeom(page);
  await page.waitForTimeout(500);
  await page.locator('[data-testid="floor-paint-toggle"]').click();
  // The docked Floor panel (NOT a popover over the room) is the tool's
  // indicator; the material rows live in it.
  await page.waitForSelector('[data-testid="floor-paint-palette"]');
  // 1 m tiles divide the 5 x 4 m fixture room exactly, so the counts below are
  // unambiguous rather than depending on how the boundary is cut.
  await page.locator('[data-testid="floor-paint-outdoor-1m"]').click();
  await waitForGeom(page);
}

async function dragWorld(
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
  mods: { shift?: boolean; ctrl?: boolean } = {},
): Promise<void> {
  const a = await worldToScreen(page, from.x, from.y);
  const b = await worldToScreen(page, to.x, to.y);
  if (!a || !b) throw new Error('geom bridge unavailable');
  if (mods.shift) await page.keyboard.down('Shift');
  if (mods.ctrl) await page.keyboard.down('Control');
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  for (let i = 1; i <= 5; i++) {
    await page.mouse.move(a.x + (b.x - a.x) * (i / 5), a.y + (b.y - a.y) * (i / 5));
  }
  await page.mouse.up();
  if (mods.shift) await page.keyboard.up('Shift');
  if (mods.ctrl) await page.keyboard.up('Control');
  await page.waitForTimeout(350);
}

test.describe('Floor tool', () => {
  test.use({ viewport: { width: 1920, height: 1080 } });

  test('a drag lays the rectangle between anchor and cursor', async ({ page }) => {
    const logs: string[] = [];
    page.on('console', (m) => logs.push(m.text()));

    await openWithFloorTool(page);
    expect(await zones(page)).toHaveLength(0);

    // World (0.5,0.5) to (2.5,2.5) is a 3 x 3 block of 1 m tiles.
    await dragWorld(page, { x: 0.5, y: 0.5 }, { x: 2.5, y: 2.5 });

    const zs = await zones(page);
    expect(zs).toHaveLength(1);
    expect(zs[0].materialId).toBe('outdoor-1m');
    expect(tileCount(zs)).toBe(9);
    expect(logs.some((l) => l.includes('[floor-paint]'))).toBe(true);
  });

  test('Shift fills the whole room, wall to wall', async ({ page }) => {
    await openWithFloorTool(page);

    await dragWorld(page, { x: 1.5, y: 1.5 }, { x: 1.5, y: 1.5 }, { shift: true });

    // THE commercial assertion. The 5 x 4 m room takes exactly 20 one-metre
    // tiles. A centre-inside coverage rule paints fewer and leaves a bare
    // margin against the walls, which would quote the customer short of a
    // floor that actually fits the room.
    expect(tileCount(await zones(page))).toBe(20);
  });

  test('Ctrl erases, and a whole stroke is one undo', async ({ page }) => {
    await openWithFloorTool(page);
    await dragWorld(page, { x: 1.5, y: 1.5 }, { x: 1.5, y: 1.5 }, { shift: true });
    expect(tileCount(await zones(page))).toBe(20);

    // Erase a 2 x 2 corner.
    await dragWorld(page, { x: 0.5, y: 0.5 }, { x: 1.5, y: 1.5 }, { ctrl: true });
    expect(tileCount(await zones(page))).toBe(16);

    // ONE undo restores the whole erase stroke, not one tile of it. Painting
    // per tile would make this take four presses.
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(500);
    expect(tileCount(await zones(page))).toBe(20);
  });

  test('a stroke does not leak into the neighbouring room', async ({ page }) => {
    await openWithFloorTool(page);

    // Drag from inside room 1 well past the shared x = 5 wall into room 2.
    await dragWorld(page, { x: 0.5, y: 0.5 }, { x: 8, y: 3.5 });

    // Room 1 is filled; room 2 is untouched, because every stroke is clipped
    // to the polygon of the room it started in.
    expect(tileCount(await zones(page, 0))).toBe(20);
    expect(tileCount(await zones(page, 1))).toBe(0);
  });

  test('laid tiles survive a reload', async ({ page }) => {
    await openWithFloorTool(page);
    await dragWorld(page, { x: 1.5, y: 1.5 }, { x: 1.5, y: 1.5 }, { shift: true });
    expect(tileCount(await zones(page))).toBe(20);

    await page.reload();
    await page.waitForSelector('.konvajs-content canvas', { state: 'attached' });
    await page.waitForTimeout(600);

    // The whitelist trap: omit floorTiles from normaliseLoadedRoom and a
    // laid floor vanishes on the first save/load round trip.
    expect(tileCount(await zones(page))).toBe(20);
  });

  test('the floor renders as ONE batched node per material, not one per tile', async ({
    page,
  }) => {
    await openWithFloorTool(page);
    await dragWorld(page, { x: 1.5, y: 1.5 }, { x: 1.5, y: 1.5 }, { shift: true });

    const counts = await page.evaluate(() => {
      const stage = (window as unknown as { Konva?: { stages?: unknown[] } }).Konva?.stages?.[0] as
        | { find: (s: string) => unknown[] }
        | undefined;
      if (!stage) return { tiles: -1, clip: -1 };
      return {
        tiles: stage.find('.room-floor-tiles').length,
        clip: stage.find('.room-floor-clip').length,
      };
    });
    // 20 tiles, ONE node. One node per tile is the mistake the adaptive-grid
    // work just fixed for grid lines; repeating it here would be worse,
    // because a floor can cover the entire plan.
    expect(counts.tiles).toBe(1);
    // And the clip lives on a Group — clipFunc is silently ignored on a Shape,
    // which would let boundary tiles render out over the walls.
    expect(counts.clip).toBe(1);
  });
});
