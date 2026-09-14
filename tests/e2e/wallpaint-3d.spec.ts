/**
 * Wall paint — the Sims-style 3D room view + tints (2026-09-14).
 *
 * Vic: "it's not quite like The Sims … a more 3D option needs to be
 * available when you add paint to the wall … pull up some more variations
 * in their paint products."
 *
 * Pins:
 *   1. arming the tool shows the 3D room view card in the panel, with faces;
 *   2. clicking a wall IN THE 3D VIEW paints that wall (same brush as the plan);
 *   3. a Sofap tint on the brush is stored on the wall and split into its
 *      own cart line (a tinted tin serves one colour);
 *   4. ⤢ opens the big view; Esc closes it; putting the tool away closes it;
 *   5. phone: the HUD's 3D chip opens the big view, Close returns.
 *
 * Needs the DEV bridge (`window.__ppwRoomView3d`), so it runs on a dev
 * server only: PPW_E2E_BASE_URL=http://127.0.0.1:5199 npx playwright test wallpaint-3d
 */

import { test, expect, type Page } from '@playwright/test';

type Seed = Record<string, unknown>;

const ROOM: Seed = {
  id: 'r1',
  name: 'Room 1',
  polygon: [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 4 }, { x: 0, y: 4 }],
  openings: [
    { id: 'd1', edgeIndex: 0, offsetM: 1, widthM: 0.838, kind: 'door', flipFacing: false, flipHand: false },
  ],
  placedItems: [],
};

async function seed(page: Page, propertyExtra: Seed = {}, rooms: Seed[] = [ROOM]): Promise<void> {
  const property = { id: 'p', name: 'Vic', activeRoomId: 'r1', rooms, wallHeightM: 2.7, ...propertyExtra };
  await page.addInitScript((p) => {
    if (localStorage.getItem('__ppw_seeded') === '1') return;
    localStorage.clear();
    localStorage.setItem('__ppw_seeded', '1');
    localStorage.setItem('ppw_designer_coach_v1', '1');
    localStorage.setItem(
      'ppw_property_v2',
      JSON.stringify({ state: { property: p, showGrid: true, pxPerMetre: 100 }, version: 2 }),
    );
  }, property);
}

async function openDesigner(page: Page): Promise<void> {
  await page.goto('/designer');
  await page.waitForSelector('.konvajs-content canvas', { state: 'attached' });
  await page.waitForTimeout(500);
}

async function bridgeReady(page: Page): Promise<boolean> {
  try {
    await page.waitForFunction(() => {
      const b = (window as unknown as { __ppwRoomView3d?: { faceCount: () => number } }).__ppwRoomView3d;
      return !!b && b.faceCount() > 0;
    }, undefined, { timeout: 8000 });
    return true;
  } catch {
    return false;
  }
}

async function clickWallIn3D(page: Page, roomId: string, edgeIndex: number): Promise<void> {
  const pt = await page.evaluate(
    ({ roomId, edgeIndex }) =>
      (window as unknown as { __ppwRoomView3d: { wallScreenPoint: (h: unknown) => { x: number; y: number } | null } })
        .__ppwRoomView3d.wallScreenPoint({ kind: 'edge', roomId, edgeIndex }),
    { roomId, edgeIndex },
  );
  if (!pt) throw new Error(`wall ${roomId}/${edgeIndex} is not on screen in the 3D view`);
  await page.mouse.click(pt.x, pt.y);
  await page.waitForTimeout(250);
}

async function paintedEdges(page: Page): Promise<Array<{ edgeIndex: number; paintId: string; colourHex?: string; colourName?: string }>> {
  return page.evaluate(() => {
    const raw = localStorage.getItem('ppw_property_v2');
    if (!raw) return [];
    return JSON.parse(raw).state.property.rooms[0].wallPaint ?? [];
  });
}

test.describe('Wall paint — 3D room view (desktop)', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('the panel shows the room in 3D; clicking a wall there paints it', async ({ page }) => {
    await seed(page);
    await openDesigner(page);
    await page.locator('[data-testid="wallpaint-tool-toggle"]').click();
    await page.waitForSelector('[data-testid="wallpaint-palette"]');
    await expect(page.locator('[data-testid="wallpaint-3d"]')).toBeVisible();
    test.skip(!(await bridgeReady(page)), 'DEV bridge absent — deployed build');

    // The default camera looks from the south-west: the north wall (edge 0) is a far wall.
    await clickWallIn3D(page, 'r1', 0);
    const painted = await paintedEdges(page);
    expect(painted.map((e) => e.edgeIndex)).toEqual([0]);
    expect(painted[0].paintId).toBe('permoglaze-matt-emulsion');
    expect(painted[0].colourHex).toBeUndefined();
    await expect(page.locator('[data-testid="wallpaint-live"]')).toContainText('m²');
  });

  test('a Sofap tint on the brush is stored on the wall and gets its own cart line', async ({ page }) => {
    await seed(page);
    await openDesigner(page);
    await page.locator('[data-testid="wallpaint-tool-toggle"]').click();
    await page.waitForSelector('[data-testid="wallpaint-palette"]');
    test.skip(!(await bridgeReady(page)), 'DEV bridge absent — deployed build');

    // Base white on the north wall, then Morning Haze (Sofap à la carte,
    // official hex #EDEBDF, Pastel base) on the east wall.
    await clickWallIn3D(page, 'r1', 0);
    await page.locator('[data-testid="wallpaint-colour-sofap-alc-morning-haze"]').click();
    await expect(page.locator('[data-testid="wallpaint-colour-name"]')).toHaveText('Morning Haze');
    await clickWallIn3D(page, 'r1', 1);
    const painted = await paintedEdges(page);
    expect(painted.find((e) => e.edgeIndex === 1)).toMatchObject({
      paintId: 'permoglaze-matt-emulsion',
      colourHex: '#EDEBDF',
      colourName: 'Morning Haze',
    });
    // The breakdown lists both walls; the orders are two (base + tint).
    await page.locator('[data-testid="wallpaint-breakdown-toggle"]').click();
    await expect(page.locator('[data-testid="wallpaint-breakdown-row"]')).toHaveCount(2);
    await expect(page.locator('[data-testid="wallpaint-breakdown-order"]')).toHaveCount(2);
    // The tinted order is priced on Sofap's own Pastel base (EP SKU), not estimated.
    const tinted = page.locator('[data-testid="wallpaint-breakdown-order"]', { hasText: 'Morning Haze' });
    await expect(tinted).toHaveCount(1);
    await expect(tinted).toContainText('Pastel base');
    await expect(tinted).not.toContainText('estimated');

    await page.goto('/cart');
    const lines = page.locator('[data-testid="cart-wallpaint-line"]');
    await expect(lines).toHaveCount(2);
    await expect(page.locator('[data-testid="cart-page-wallpaint-lines"]')).toContainText('Morning Haze');
  });

  test('the big view opens from the card, closes on Esc, and goes away with the tool', async ({ page }) => {
    await seed(page);
    await openDesigner(page);
    await page.locator('[data-testid="wallpaint-tool-toggle"]').click();
    await page.waitForSelector('[data-testid="wallpaint-palette"]');
    await page.locator('[data-testid="wallpaint-3d-expand"]').click();
    const overlay = page.locator('[data-testid="wallpaint-3d-overlay"]');
    await expect(overlay).toBeVisible();
    // The docked panel stays usable beside it.
    await expect(page.locator('[data-testid="wallpaint-palette"]')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(overlay).toHaveCount(0);
    // Still in the tool after Esc closed the overlay.
    await expect(page.locator('[data-testid="wallpaint-palette"]')).toBeVisible();
    await page.locator('[data-testid="wallpaint-3d-expand"]').click();
    await expect(overlay).toBeVisible();
    await page.locator('[data-testid="wallpaint-done"]').click();
    await expect(overlay).toHaveCount(0);
    await expect(page.locator('[data-testid="wallpaint-palette"]')).toHaveCount(0);
  });

  test('a white-only line offers no tints; Xtreme White drops the tint from the brush', async ({ page }) => {
    await seed(page);
    await openDesigner(page);
    await page.locator('[data-testid="wallpaint-tool-toggle"]').click();
    await page.waitForSelector('[data-testid="wallpaint-palette"]');
    await page.locator('[data-testid="wallpaint-colour-sofap-alc-morning-haze"]').click();
    await page.locator('[data-testid="wallpaint-permoglaze-xtreme-white"]').click();
    await expect(page.locator('[data-testid="wallpaint-colours-none"]')).toBeVisible();
    await page.locator('[data-testid="wallpaint-scope-room"]').click();
    await page.waitForTimeout(250);
    const painted = await paintedEdges(page);
    expect(painted).toHaveLength(4);
    expect(painted.every((e) => e.paintId === 'permoglaze-xtreme-white' && !e.colourHex)).toBe(true);
  });
});

test.describe('Wall paint — 3D room view (phone)', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('the HUD 3D chip opens the big view; Close returns to the plan', async ({ page }) => {
    await seed(page);
    await openDesigner(page);
    await page.getByRole('button', { name: 'Open menu' }).click();
    await page.waitForSelector('[data-testid="wallpaint-toggle-mobile"]');
    await page.locator('[data-testid="wallpaint-mobile-permoglaze-soft-feel"]').click();
    const hud = page.locator('[data-testid="wallpaint-hud"]');
    await expect(hud).toBeVisible();
    await page.locator('[data-testid="wallpaint-3d-mobile"]').click();
    const overlay = page.locator('[data-testid="wallpaint-3d-overlay"]');
    await expect(overlay).toBeVisible();
    await page.locator('[data-testid="wallpaint-3d-close"]').click();
    await expect(overlay).toHaveCount(0);
    await expect(hud).toBeVisible();
  });
});
