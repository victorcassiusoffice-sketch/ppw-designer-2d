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
  // The 3D-first shell (2026-09-23) opens furnished plans straight in 3D; a
  // click on the Plan-bar switch under the overlay is intercepted, so only
  // switch when Plan is showing.
  const overlay = page.locator('[data-testid="wallpaint-3d-overlay"]');
  if (!(await overlay.isVisible())) await page.locator('[data-testid="view-mode-3d"]').click();
  await expect(overlay).toBeVisible();
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

  test('a drag rectangle on the floor lays many tiles (Sims stroke)', async ({ page }) => {
    await seed(page);
    await open3DWithFloor(page);
    await page.locator('[data-testid="floor-paint-outdoor-1m"]').click();
    await page.locator('[data-testid="floor-paint-scope-tile"]').click();

    const a = await page.evaluate(() =>
      (window as unknown as { __ppwRoomView3d: Bridge }).__ppwRoomView3d.floorScreenPoint(0.6, 0.6),
    );
    const b = await page.evaluate(() =>
      (window as unknown as { __ppwRoomView3d: Bridge }).__ppwRoomView3d.floorScreenPoint(3.2, 2.8),
    );
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    await page.mouse.move(a!.x, a!.y);
    await page.mouse.down();
    for (let i = 1; i <= 6; i++) {
      await page.mouse.move(a!.x + ((b!.x - a!.x) * i) / 6, a!.y + ((b!.y - a!.y) * i) / 6);
    }
    // Live preview caption while dragging.
    await expect(page.locator('[data-testid="wallpaint-3d-caption"]')).toContainText(/tile/i);
    await page.mouse.up();

    await expect.poll(async () => {
      const zones = await floorTiles(page);
      if (!zones[0]) return 0;
      const runs: number[] = zones[0].runs ?? [];
      let n = 0;
      for (let i = 0; i + 2 < runs.length; i += 3) n += runs[i + 2];
      return n;
    }).toBeGreaterThan(1);
  });
});
