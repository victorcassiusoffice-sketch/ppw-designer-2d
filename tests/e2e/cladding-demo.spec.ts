/**
 * Sample cladding (not Spa Concept). Arms Clad in 3D, clicks a wall, and
 * checks the plan stores a demo product plus a non-zero board/pack quote.
 */
import { test, expect, type Page } from '@playwright/test';

// The first 3D frame compiles a shader variant per finish and can block 20–70 s on software GL; same budget as the other 3D specs.
test.describe.configure({ timeout: 180_000 });

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
    // The House Studio shell (2026-09-26) has no Cladding mode on its rail and
    // the plan toolbar is inert under the 3D overlay, so the sample boards are
    // armed in the plan first and the room is opened from the Cladding panel's
    // own "3D room" radio — the panel stays docked beside the house view.
    await page.locator('[data-testid="cladding-tool-toggle"]').click();
    await expect(page.locator('[data-testid="cladding-palette"]')).toBeVisible();
    await expect(page.locator('[data-testid="cladding-disclaimer"]')).toContainText(/sample/i);
    await page.locator('[data-testid="cladding-view-3d"]').click();
    await expect(page.locator('[data-testid="wallpaint-3d-overlay"]')).toBeVisible();
    await expect(page.locator('[data-testid="cladding-view-3d"]')).toHaveAttribute('aria-checked', 'true');
    await expect
      .poll(() => page.evaluate(() => (window as unknown as { __ppwRoomView3d: { faceCount: () => number } }).__ppwRoomView3d.faceCount()), { timeout: 90_000 })
      .toBeGreaterThan(0);
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

test.describe('Sample cladding on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('left HUD stays off the bottom and a 3D tap stores demo cladding', async ({ page }) => {
    await seed(page);
    await page.goto('/designer');
    await page.waitForSelector('.konvajs-content canvas', { state: 'attached' });
    await page.getByRole('button', { name: 'Open menu' }).click();
    await page.locator('[data-testid="cladding-mobile-demo-clad-cedar-140"]').click();

    const hud = page.locator('[data-testid="cladding-hud"]');
    await expect(hud).toBeVisible();
    await expect(hud).toHaveAttribute('data-placement', 'left');
    await expect(page.locator('[data-testid="cladding-hud-sample"]')).toContainText(/sample/i);
    const place = await page.evaluate(() => {
      const card = document.querySelector('[data-testid="cladding-hud"]') as HTMLElement;
      const bar = document.querySelector('[data-testid="sims-bottom-toolbar"]')!.getBoundingClientRect();
      const r = card.getBoundingClientRect();
      return {
        leftish: r.left < window.innerWidth * 0.45,
        clearsBottom: r.bottom < bar.top - 24,
        gap: Math.round(bar.top - r.bottom),
      };
    });
    expect(place.leftish).toBe(true);
    expect(place.clearsBottom).toBe(true);
    expect(place.gap).toBeGreaterThan(24);

    await page.locator('[data-testid="cladding-hud-3d"]').click();
    await expect(page.locator('[data-testid="wallpaint-3d-overlay"]')).toBeVisible();
    await expect(page.locator('[data-testid="cladding-3d-brush-strip"]')).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => (window as unknown as { __ppwRoomView3d: { faceCount: () => number } }).__ppwRoomView3d.faceCount()), { timeout: 90_000 })
      .toBeGreaterThan(0);

    const pt = await page.evaluate(() =>
      (window as unknown as { __ppwRoomView3d: { wallScreenPoint: (h: unknown) => { x: number; y: number } | null } }).__ppwRoomView3d.wallScreenPoint({
        kind: 'edge',
        roomId: 'r1',
        edgeIndex: 0,
      }),
    );
    expect(pt).not.toBeNull();
    await page.touchscreen.tap(pt!.x, pt!.y);

    await expect.poll(async () => {
      const raw = await page.evaluate(() => localStorage.getItem('ppw_property_v2'));
      const clad = raw ? JSON.parse(raw).state.property.rooms[0].wallCladding : null;
      return clad?.[0]?.productId ?? '';
    }).toBe('demo-clad-cedar-140');

    const footer = page.locator('[data-testid="wallpaint-3d-overlay"] [data-testid="wallpaint-3d-footer"]');
    await expect(footer).toContainText(/board/i);
    await expect(footer).toContainText(/pack/i);
  });
});
