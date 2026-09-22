/**
 * Floor tool in 3D Mode (2026-09-22) — TintEX / Vic: "3D flooring input
 * missing". Pins that Floor armed in 3D lays through the ONE property store
 * (same path as plan Room fill), via the GL floor hit + applyFloorPaintBrush.
 *
 * Runs on a dev server: PPW_E2E_BASE_URL=http://127.0.0.1:5199
 */
import { test, expect, type Page } from '@playwright/test';

const ROOM = {
  id: 'r1',
  name: 'Room 1',
  polygon: [
    { x: 0, y: 0 },
    { x: 5, y: 0 },
    { x: 5, y: 4 },
    { x: 0, y: 4 },
  ],
  openings: [],
  placedItems: [] as Array<{ instanceId: string; productId: string; x: number; y: number; rotation: number }>,
};

type Bridge = {
  backend: () => string;
  faceCount: () => number;
  floorScreenPoint: (x: number, y: number) => { x: number; y: number } | null;
  dressing: () => { floors: Array<{ key: string; kind: string }> } | null;
};

async function seed(page: Page): Promise<void> {
  await page.addInitScript(
    ({ p }) => {
      if (localStorage.getItem('__ppw_seeded') === '1') return;
      localStorage.clear();
      localStorage.setItem('__ppw_seeded', '1');
      localStorage.setItem('ppw_designer_coach_v1', '1');
      localStorage.setItem(
        'ppw_property_v2',
        JSON.stringify({ state: { property: p, showGrid: true, pxPerMetre: 100 }, version: 2 }),
      );
    },
    { p: { id: 'p', name: 'Vic', activeRoomId: 'r1', rooms: [ROOM], wallHeightM: 2.7 } },
  );
}

async function open3DWithFloor(page: Page): Promise<void> {
  await page.goto('/designer');
  await page.waitForSelector('.konvajs-content canvas', { state: 'attached' });
  await page.locator('[data-testid="view-mode-3d"]').click();
  await expect(page.locator('[data-testid="wallpaint-3d-overlay"]')).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { __ppwRoomView3d: Bridge }).__ppwRoomView3d.faceCount()), {
      timeout: 20_000,
    })
    .toBeGreaterThan(0);
  expect(await page.evaluate(() => (window as unknown as { __ppwRoomView3d: Bridge }).__ppwRoomView3d.backend())).toBe(
    'gl',
  );
  await page.locator('[data-testid="floor-paint-toggle"]').click();
  await page.waitForSelector('[data-testid="floor-paint-palette"]');
}

function floorTiles(page: Page) {
  return page.evaluate(() => {
    const raw = localStorage.getItem('ppw_property_v2');
    if (!raw) return [];
    return JSON.parse(raw).state.property.rooms[0].floorTiles ?? [];
  });
}

test.describe('Floor tool in 3D — desktop', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('Plan|3D radios exist on the Floor panel; Room fill lays tiles in 3D', async ({ page }) => {
    await seed(page);
    await open3DWithFloor(page);

    await expect(page.locator('[data-testid="floor-paint-view"]')).toBeVisible();
    await expect(page.locator('[data-testid="floor-paint-view-3d"]')).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator('[data-testid="floor-paint-3d-card-note"]')).toBeVisible();

    await page.locator('[data-testid="floor-paint-outdoor-1m"]').click();
    await page.locator('[data-testid="floor-paint-scope-room"]').click();

    await expect.poll(() => floorTiles(page)).not.toEqual([]);
    const zones = await floorTiles(page);
    expect(zones[0].materialId).toBe('outdoor-1m');

    // The GL stage dresses the floor with the laid kind (not a dead end).
    await expect
      .poll(async () => {
        const d = await page.evaluate(
          () => (window as unknown as { __ppwRoomView3d: Bridge }).__ppwRoomView3d.dressing()?.floors ?? [],
        );
        return d.length;
      })
      .toBeGreaterThan(0);
  });

  test('a tap on the floor in 3D lays the brush (tile scope)', async ({ page }) => {
    await seed(page);
    await open3DWithFloor(page);
    await page.locator('[data-testid="floor-paint-outdoor-1m"]').click();
    await page.locator('[data-testid="floor-paint-scope-tile"]').click();

    const pt = await page.evaluate(() =>
      (window as unknown as { __ppwRoomView3d: Bridge }).__ppwRoomView3d.floorScreenPoint(2.5, 2),
    );
    expect(pt).not.toBeNull();
    await page.mouse.click(pt!.x, pt!.y);

    await expect.poll(() => floorTiles(page)).not.toEqual([]);
    expect((await floorTiles(page))[0].materialId).toBe('outdoor-1m');
  });
});
