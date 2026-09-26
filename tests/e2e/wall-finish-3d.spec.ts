/**
 * Same wall colour, two finishes. Matt stays a flat diffuse hex; gloss puts
 * a clear coat on that hex (lower roughness, a sheen the bridge can read).
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

async function material(page: Page, edgeIndex: number) {
  return page.evaluate((e) => {
    const b = (window as unknown as {
      __ppwRoomView3d: {
        wallMaterial: (h: unknown) => { finish: string | null; roughness: number; sheen: number; baseHex: string } | null;
      };
    }).__ppwRoomView3d;
    return b.wallMaterial({ kind: 'edge', roomId: 'r1', edgeIndex: e });
  }, edgeIndex);
}

test.describe('Paint finish on a wall', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('matt then gloss on the same colour changes roughness and sheen; the quote still prices', async ({ page }) => {
    await seed(page);
    await page.goto('/designer');
    await page.waitForSelector('.konvajs-content canvas', { state: 'attached' });
    await expect(page.locator('[data-testid="wall-height-hud"]')).toBeVisible();
    await page.locator('[data-testid="view-mode-3d"]').click();
    await expect(page.locator('[data-testid="wallpaint-3d-overlay"]')).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => (window as unknown as { __ppwRoomView3d: { faceCount: () => number } }).__ppwRoomView3d.faceCount()))
      .toBeGreaterThan(0);
    // The House Studio shell (2026-09-26): the plan toolbar is inert under the
    // overlay, so the brush is armed from the rail's Paint mode.
    await page.locator('[data-testid="wallpaint-3d-overlay"] [data-testid="house-mode-paint"]').click();
    await page.waitForSelector('[data-testid="wallpaint-palette"]');
    await page.locator('[data-testid="wallpaint-colour-sofap-alc-bronze"]').click();

    const pt = await page.evaluate(() =>
      (window as unknown as { __ppwRoomView3d: { wallScreenPoint: (h: unknown) => { x: number; y: number } | null } }).__ppwRoomView3d.wallScreenPoint({
        kind: 'edge',
        roomId: 'r1',
        edgeIndex: 0,
      }),
    );
    expect(pt).not.toBeNull();
    await page.mouse.click(pt!.x, pt!.y);
    await page.mouse.move(pt!.x, pt!.y - 280);
    const matt = await material(page, 0);
    expect(matt?.finish).toBe('matt');
    expect(matt?.sheen).toBe(0);
    expect(matt?.baseHex.toLowerCase()).toBe('#4c493f');

    await page.locator('[data-testid="wallpaint-more-lines"]').click();
    await page.locator('[data-testid="wallpaint-permoglaze-aqua-gloss"]').click();
    await expect(page.locator('[data-testid="wallpaint-colour-name"]')).toHaveText('Bronze');
    await page.mouse.click(pt!.x, pt!.y);
    await page.mouse.move(pt!.x, pt!.y - 280);
    const gloss = await material(page, 0);
    expect(gloss?.finish).toBe('gloss');
    expect(gloss?.baseHex.toLowerCase()).toBe('#4c493f');
    expect(gloss!.roughness).toBeLessThan(matt!.roughness);
    expect(gloss!.sheen).toBeGreaterThan(0.8);
    await expect(page.locator('[data-testid="wallpaint-live"]')).toContainText('m²');
    await expect(page.locator('[data-testid="wallpaint-live"]')).toContainText('L');

    // Back to the plan through the house header's view switch (the old
    // `wallpaint-3d-close` button went with the House Studio shell).
    await page.locator('[data-testid="wallpaint-3d-overlay"]').getByRole('button', { name: '2D Plan', exact: true }).click();
    await expect(page.locator('[data-testid="wallpaint-3d-overlay"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="wall-height-readout"]')).toHaveText('2.7 m');
    await page.locator('[data-testid="wall-height-up"]').click();
    await expect(page.locator('[data-testid="wall-height-readout"]')).toHaveText('2.8 m');
  });
});
