/**
 * 3D MODE (2026-09-17) — the whole designer as a Sims-style room view.
 *
 * Vic: "make the whole designer have a 3D Mode, with a 3D mode switch, a
 * super realistic 3D version of the 2D." Pins:
 *   1. the switch is on the bar (desktop) and in the sheet (phone); the
 *      three chunk is fetched only once the mode opens;
 *   2. the room renders on the GL stage (not the canvas fallback), with
 *      every wall, floor and item the plan holds;
 *   3. tools still work inside the mode: arm Wall paint from the bar while
 *      the room shows, click a wall in 3D, the plan is painted;
 *   4. Plan returns.
 *
 * Runs on a dev server (the bridge is DEV-only): PPW_E2E_BASE_URL=http://127.0.0.1:5199
 */
import { test, expect, type Page } from '@playwright/test';

const ROOM = {
  id: 'r1',
  name: 'Room 1',
  polygon: [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 4 }, { x: 0, y: 4 }],
  openings: [{ id: 'd1', edgeIndex: 0, offsetM: 1, widthM: 0.838, kind: 'door', flipFacing: false, flipHand: false }],
  placedItems: [{ instanceId: 'i1', productId: 'k1-nordictrack-2450', x: 0.3, y: 0.3, rotation: 90 }],
};

async function seed(page: Page): Promise<void> {
  await page.addInitScript((p) => {
    if (localStorage.getItem('__ppw_seeded') === '1') return;
    localStorage.clear();
    localStorage.setItem('__ppw_seeded', '1');
    localStorage.setItem('ppw_designer_coach_v1', '1');
    localStorage.setItem('ppw_property_v2', JSON.stringify({ state: { property: p, showGrid: true, pxPerMetre: 100 }, version: 2 }));
  }, { id: 'p', name: 'Vic', activeRoomId: 'r1', rooms: [ROOM], wallHeightM: 2.7 });
}

async function bridge(page: Page) {
  return page.evaluate(() => {
    const b = (window as unknown as { __ppwRoomView3d?: { backend: () => string; faceCount: () => number; faces: () => Array<{ key: string; holes: number }> } }).__ppwRoomView3d;
    return b ? { backend: b.backend(), faces: b.faceCount(), keys: b.faces().map((f) => f.key) } : null;
  });
}

test.describe('3D Mode — desktop', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('the switch opens the room on the GL stage, fetches three only then, keeps the bar, and Plan returns', async ({ page }) => {
    await seed(page);
    // The page's own resource timeline: what the browser actually fetched.
    const threeLoads = () =>
      page.evaluate(() => performance.getEntriesByType('resource').map((e) => e.name).filter((n) => /three|ThreeStage/i.test(n)));
    await page.goto('/designer');
    await page.waitForSelector('.konvajs-content canvas', { state: 'attached' });
    await page.waitForTimeout(500);
    expect(await threeLoads(), 'three must not load with the 2D designer').toHaveLength(0);

    await page.locator('[data-testid="view-mode-3d"]').click();
    const overlay = page.locator('[data-testid="wallpaint-3d-overlay"]');
    await expect(overlay).toBeVisible();
    await expect(page.locator('[data-testid="view-mode-3d"]')).toHaveAttribute('aria-pressed', 'true');
    // The bar stays above the room.
    const bar = (await page.locator('header').first().boundingBox())!;
    const box = (await overlay.boundingBox())!;
    expect(box.y).toBeGreaterThanOrEqual(bar.y + bar.height - 1);
    await expect.poll(async () => (await threeLoads()).length, { timeout: 15_000 }).toBeGreaterThan(0);

    // The GL stage draws it: walls, the floor and the item are all there.
    await expect.poll(async () => (await bridge(page))?.backend, { timeout: 15_000 }).toBe('gl');
    const b = (await bridge(page))!;
    expect(b.faces).toBeGreaterThan(0);
    expect(b.keys).toContain('floor-r1');
    expect(b.keys).toContain('item-i1');
    expect(b.keys.filter((k) => k.startsWith('wall-r1-') || k.startsWith('stub-r1-'))).toHaveLength(4);
    // The door is a hole in its wall.
    const north = (await page.evaluate(() => (window as unknown as { __ppwRoomView3d: { faces: () => Array<{ key: string; holes: number }> } }).__ppwRoomView3d.faces()))
      .find((f) => f.key === 'wall-r1-0' || f.key === 'stub-r1-0');
    expect(north).toBeDefined();
    if (north!.key === 'wall-r1-0') expect(north!.holes).toBe(1);

    // No paint armed → view only: the caption says so and the panel is not there.
    await expect(page.locator('[data-testid="wallpaint-3d-overlay"] [data-testid="wallpaint-3d-caption"]')).not.toContainText('paint');
    await expect(page.locator('[data-testid="wallpaint-palette"]')).toHaveCount(0);

    await page.locator('[data-testid="wallpaint-3d-close"]').click();
    await expect(overlay).toHaveCount(0);
    await expect(page.locator('[data-testid="view-mode-3d"]')).toHaveAttribute('aria-pressed', 'false');
  });

  test('a tool works inside the mode: arm Wall paint from the bar, click a wall in 3D, the plan is painted', async ({ page }) => {
    await seed(page);
    await page.goto('/designer');
    await page.waitForSelector('.konvajs-content canvas', { state: 'attached' });
    await page.locator('[data-testid="view-mode-3d"]').click();
    await expect(page.locator('[data-testid="wallpaint-3d-overlay"]')).toBeVisible();
    await expect.poll(async () => (await bridge(page))?.backend, { timeout: 15_000 }).toBe('gl');
    await page.locator('[data-testid="wallpaint-tool-toggle"]').click();
    await page.waitForSelector('[data-testid="wallpaint-palette"]');
    // The panel's card and the overlay both carry a caption — read the overlay's.
    await expect(page.locator('[data-testid="wallpaint-3d-overlay"] [data-testid="wallpaint-3d-caption"]')).toContainText('paint');
    // The default camera looks from the south-west: the north wall (edge 0) is a far wall.
    const pt = await page.evaluate(() =>
      (window as unknown as { __ppwRoomView3d: { wallScreenPoint: (h: unknown) => { x: number; y: number } | null } }).__ppwRoomView3d.wallScreenPoint({ kind: 'edge', roomId: 'r1', edgeIndex: 0 }),
    );
    expect(pt).not.toBeNull();
    await page.mouse.click(pt!.x, pt!.y);
    await expect
      .poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('ppw_property_v2')!).state.property.rooms[0].wallPaint?.map((e: { edgeIndex: number }) => e.edgeIndex) ?? []))
      .toEqual([0]);
  });
});

test.describe('3D Mode — phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('the sheet row opens the room edge to edge under the header; Plan returns', async ({ page }) => {
    await seed(page);
    await page.goto('/designer');
    await page.waitForSelector('.konvajs-content canvas', { state: 'attached' });
    await page.getByRole('button', { name: 'Open menu' }).tap();
    await page.locator('[data-testid="view-mode-3d-mobile"]').tap();
    const overlay = page.locator('[data-testid="wallpaint-3d-overlay"]');
    await expect(overlay).toBeVisible();
    const box = (await overlay.boundingBox())!;
    expect(box.width).toBe(390);
    expect(box.y).toBeGreaterThan(40); // under the 56 px strip
    await expect.poll(async () => (await bridge(page))?.backend, { timeout: 15_000 }).toBe('gl');
    await page.locator('[data-testid="wallpaint-3d-close"]').tap();
    await expect(overlay).toHaveCount(0);
  });
});
