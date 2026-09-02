/**
 * Wall paint — Sofap (Permoglaze) tins from painted wall area (Vic
 * 2026-09-02: "add walls and wall paint calculating cubic to size, pull
 * something from Sofap in Mauritius … a selection of 5 different paint
 * products … it automatically goes a bit more 3d … only when they select
 * walls, any other feature goes back to the 2d").
 *
 * Pins:
 *   1. the 5-product Sofap palette + wall-height input in the docked panel;
 *   2. click-a-wall paints it and the live line quotes m² · L · money;
 *   3. the 2.5D wall elevation shows ONLY while a wall tool is armed —
 *      Select drops the plan back to flat 2D;
 *   4. Room scope paints every wall in one press; Erase + Room strips them;
 *   5. wall height drives the litres (repricing on change);
 *   6. the full algorithm to money, seeded: length × height − door opening
 *      → litres (× coats ÷ coverage) → whole tins → cart + checkout lines;
 *   7. a wall-paint-only design is NOT an "empty cart";
 *   8. phone: the sheet row arms the tool and the HUD card appears.
 *
 * Run against a local dev server:
 *   PPW_E2E_BASE_URL=http://127.0.0.1:5188 npx playwright test wallpaint
 */

import { test, expect, type Page } from '@playwright/test';
import { worldToScreen } from './multiroom-helpers';

type Seed = Record<string, unknown>;

const ROOM: Seed = {
  id: 'r1',
  name: 'Room 1',
  polygon: [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 4 }, { x: 0, y: 4 }],
  openings: [],
  placedItems: [],
};

async function seed(page: Page, propertyExtra: Seed = {}, rooms: Seed[] = [ROOM]): Promise<void> {
  const property = { id: 'p', name: 'Vic', activeRoomId: 'r1', rooms, ...propertyExtra };
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

async function openDesigner(page: Page): Promise<void> {
  await page.goto('/designer');
  await page.waitForSelector('.konvajs-content canvas', { state: 'attached' });
  await waitForGeom(page);
  await page.waitForTimeout(400);
}

/** Count of 2.5D wall-elevation groups on the Konva stage (0 = flat 2D). */
async function wallFaceGroups(page: Page): Promise<number> {
  return page.evaluate(() => {
    const K = (window as unknown as { Konva?: { stages: Array<{ find: (s: string) => unknown[] }> } })
      .Konva;
    if (!K || !K.stages.length) return -1;
    return K.stages[0].find('.wall-faces').length;
  });
}

async function clickWorld(page: Page, x: number, y: number): Promise<void> {
  const p = await worldToScreen(page, x, y);
  if (!p) throw new Error('geom bridge unavailable');
  await page.mouse.click(p.x, p.y);
  await page.waitForTimeout(300);
}

async function paintedEdges(page: Page): Promise<number> {
  return page.evaluate(() => {
    const raw = localStorage.getItem('ppw_property_v2');
    if (!raw) return -1;
    return (JSON.parse(raw).state.property.rooms[0].wallPaint ?? []).length;
  });
}

test.describe('Wall paint — desktop panel + canvas', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('panel shows 5 Sofap paints; clicking a wall paints it; 2.5D only with wall tools', async ({
    page,
  }) => {
    await seed(page);
    await openDesigner(page);

    // Flat 2D before any wall tool.
    expect(await wallFaceGroups(page)).toBe(0);

    await page.locator('[data-testid="wallpaint-tool-toggle"]').click();
    await page.waitForSelector('[data-testid="wallpaint-palette"]');

    // The five real Sofap (Permoglaze) products.
    for (const id of [
      'permoglaze-matt-emulsion',
      'permoglaze-soft-feel',
      'permoglaze-xtreme-white',
      'permoglaze-aquashield',
      'permoglaze-anti-fungus',
    ]) {
      await expect(page.locator(`[data-testid="wallpaint-${id}"]`)).toBeVisible();
    }
    await expect(page.locator('[data-testid="wallpaint-height"]')).toHaveValue('2.7');
    await expect(page.locator('[data-testid="wallpaint-live"]')).toHaveText('No walls painted yet');

    // Arming the wall tool lifts the plan to 2.5D.
    expect(await wallFaceGroups(page)).toBe(1);

    // Click the TOP wall's midpoint — one edge painted, live line prices it.
    await clickWorld(page, 2.5, 0);
    expect(await paintedEdges(page)).toBe(1);
    await expect(page.locator('[data-testid="wallpaint-live"]')).toContainText('m²');
    await expect(page.locator('[data-testid="wallpaint-live"]')).not.toHaveText(
      'No walls painted yet',
    );

    // Any non-wall tool drops back to flat 2D (the objects stay top-down).
    await page.locator('[data-testid="select-tool-toggle"]').click();
    expect(await wallFaceGroups(page)).toBe(0);
    await expect(page.locator('[data-testid="wallpaint-palette"]')).toHaveCount(0);
  });

  test('Room scope paints every wall; Erase + Room strips them again', async ({ page }) => {
    await seed(page);
    await openDesigner(page);
    await page.locator('[data-testid="wallpaint-tool-toggle"]').click();
    await page.waitForSelector('[data-testid="wallpaint-palette"]');

    // Room IS the action: all 4 edges of the active room in one press.
    await page.locator('[data-testid="wallpaint-scope-room"]').click();
    await page.waitForTimeout(300);
    expect(await paintedEdges(page)).toBe(4);
    await expect(page.locator('[data-testid="wallpaint-live"]')).toContainText('m²');

    // Erase + Room strips the room.
    await page.locator('[data-testid="wallpaint-erase"]').click();
    await page.locator('[data-testid="wallpaint-scope-room"]').click();
    await page.waitForTimeout(300);
    expect(await paintedEdges(page)).toBe(0);
    await expect(page.locator('[data-testid="wallpaint-live"]')).toHaveText('No walls painted yet');
  });

  test('wall height drives the litres — raising it reprices the live line', async ({ page }) => {
    await seed(page);
    await openDesigner(page);
    await page.locator('[data-testid="wallpaint-tool-toggle"]').click();
    await page.waitForSelector('[data-testid="wallpaint-palette"]');
    await page.locator('[data-testid="wallpaint-scope-room"]').click();
    await page.waitForTimeout(300);

    const before = await page.locator('[data-testid="wallpaint-live"]').textContent();
    await page.locator('[data-testid="wallpaint-height"]').fill('4');
    await page.waitForTimeout(300);
    const after = await page.locator('[data-testid="wallpaint-live"]').textContent();
    expect(before).toBeTruthy();
    expect(after).toBeTruthy();
    expect(after).not.toBe(before);
    // 18 m of room walls × 4 m — the area line must now read 72.0 m².
    await expect(page.locator('[data-testid="wallpaint-live"]')).toContainText('72.0 m²');
  });
});

test.describe('Wall paint — the algorithm to money (seeded)', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('length × height − door → litres → whole tins → cart + checkout', async ({ page }) => {
    // 5×4 m room at 2.7 m: painted edges 0 (with an 0.838 m door) and 2,
    // plus a 2 m free wall.
    //   area  = (5×2.7 − 0.838×2.04) + 5×2.7 + 2×2.7 = 30.69 m²
    //   litres = ceil(30.69 × 2 coats ÷ 9 m²/L × 10)/10 = 6.9 L
    //   tins   = 1× 5 L + 2× 1 L (Rs 760 + 2×201.25 = Rs 1,162.50)
    await seed(
      page,
      {
        wallHeightM: 2.7,
        walls: [
          {
            id: 'w1',
            a: { x: 6, y: 1 },
            b: { x: 8, y: 1 },
            thicknessM: 0.15,
            paintId: 'permoglaze-matt-emulsion',
          },
        ],
      },
      [
        {
          ...ROOM,
          openings: [
            {
              id: 'd1',
              edgeIndex: 0,
              offsetM: 1,
              widthM: 0.838,
              kind: 'door',
              flipFacing: false,
              flipHand: false,
            },
          ],
          wallPaint: [
            { edgeIndex: 0, paintId: 'permoglaze-matt-emulsion' },
            { edgeIndex: 2, paintId: 'permoglaze-matt-emulsion' },
          ],
        },
      ],
    );

    await page.goto('/cart');
    const line = page.locator('[data-testid="cart-wallpaint-line"]');
    await expect(line).toHaveCount(1);
    await expect(line).toContainText('Permoglaze Matt Emulsion');
    await expect(line).toContainText('30.7 m²');
    await expect(line).toContainText('needs 6.9 L');
    await expect(line).toContainText('1× 5 L + 2× 1 L');
    await expect(page.locator('[data-testid="cart-page-wallpaint-subtotal-label"]')).toBeVisible();

    await page.goto('/checkout');
    expect(page.url()).toContain('checkout');
    await expect(page.locator('[data-testid="checkout-wallpaint-line"]')).toHaveCount(1);
  });

  test('a wall-paint-only design is NOT an empty cart', async ({ page }) => {
    await seed(page, { wallHeightM: 2.7 }, [
      { ...ROOM, wallPaint: [{ edgeIndex: 1, paintId: 'permoglaze-soft-feel' }] },
    ]);
    await page.goto('/cart');
    await expect(page.locator('text=cart is empty')).toHaveCount(0);
    await expect(page.locator('[data-testid="cart-wallpaint-line"]')).toHaveCount(1);
  });
});

test.describe('Wall paint — phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('sheet row arms the tool; HUD card appears; Done stands it down', async ({ page }) => {
    await seed(page);
    await openDesigner(page);

    await page.getByRole('button', { name: 'Open menu' }).click();
    await page.waitForSelector('[data-testid="wallpaint-toggle-mobile"]');
    // A paint row arms the tool WITH that paint and closes the sheet.
    await page.locator('[data-testid="wallpaint-mobile-permoglaze-soft-feel"]').click();

    const hud = page.locator('[data-testid="wallpaint-hud"]');
    await expect(hud).toBeVisible();
    await expect(hud).toContainText('Soft Feel');
    // 2.5D on the phone too while the tool is armed.
    expect(await wallFaceGroups(page)).toBe(1);

    await page.locator('[data-testid="wallpaint-done-mobile"]').click();
    await expect(hud).toHaveCount(0);
    expect(await wallFaceGroups(page)).toBe(0);
  });
});
