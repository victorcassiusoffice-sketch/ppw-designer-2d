/**
 * Sample cladding (not Spa Concept). Arms Clad in 3D, clicks a wall, and
 * checks the plan stores a demo product plus a non-zero board/pack quote.
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
  placedItems: [] as unknown[],
};

async function seed(page: Page): Promise<void> {
  await page.addInitScript((p) => {
    if (localStorage.getItem('__ppw_seeded') === '1') return;
    localStorage.clear();
    localStorage.setItem('__ppw_seeded', '1');
    localStorage.setItem('ppw_designer_coach_v1', '1');
    localStorage.setItem(
      'ppw_property_v2',
      JSON.stringify({ state: { property: p, showGrid: true, pxPerMetre: 100 }, version: 2 }),
    );
  }, { id: 'p', name: 'Vic', activeRoomId: 'r1', rooms: [ROOM], wallHeightM: 2.7 });
}

test.describe('Sample cladding in 3D', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('clicking a wall stores demo cladding and a pack quote', async ({ page }) => {
    await seed(page);
    await page.goto('/designer');
    await page.waitForSelector('.konvajs-content canvas', { state: 'attached' });
    await page.locator('[data-testid="view-mode-3d"]').click();
    await expect(page.locator('[data-testid="wallpaint-3d-overlay"]')).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => (window as unknown as { __ppwRoomView3d: { faceCount: () => number } }).__ppwRoomView3d.faceCount()))
      .toBeGreaterThan(0);
    await page.locator('[data-testid="cladding-tool-toggle"]').click();
    await expect(page.locator('[data-testid="cladding-palette"]')).toBeVisible();
    await expect(page.locator('[data-testid="cladding-disclaimer"]')).toContainText(/sample/i);
    await page.locator('[data-testid="cladding-demo-clad-cedar-140"]').click();

    const pt = await page.evaluate(() =>
      (window as unknown as { __ppwRoomView3d: { wallScreenPoint: (h: unknown) => { x: number; y: number } | null } }).__ppwRoomView3d.wallScreenPoint({
        kind: 'edge',
        roomId: 'r1',
        edgeIndex: 0,
      }),
    );
    expect(pt).not.toBeNull();
    await page.mouse.click(pt!.x, pt!.y);

    await expect.poll(async () => {
      const raw = await page.evaluate(() => localStorage.getItem('ppw_property_v2'));
      const clad = raw ? JSON.parse(raw).state.property.rooms[0].wallCladding : null;
      return clad?.[0]?.productId ?? '';
    }).toBe('demo-clad-cedar-140');

    await expect(page.locator('[data-testid="cladding-live"]')).toContainText(/board/i);
    await expect(page.locator('[data-testid="cladding-live"]')).toContainText(/pack/i);
  });
});
