/**
 * Floor must reach the cart AND the checkout (Vic 2026-08-31: "the floor is
 * not included as a product and doesn't show" at checkout).
 *
 * The /checkout page already rendered floor lines; the /cart review page did
 * NOT (it mapped cart.lines only) and its empty-check ignored floors, so a
 * floor-only design read as "cart is empty". This pins both pages showing the
 * floor for tiles, a roll finish, and a floor-only design.
 *
 * No geom bridge needed — /cart and /checkout derive from the persisted
 * property, so we seed it and navigate.
 */
import { test, expect, type Page } from '@playwright/test';

type Seed = Record<string, unknown>;

function room(extra: Seed): Seed {
  return {
    id: 'r1',
    name: 'Room 1',
    polygon: [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 4 }, { x: 0, y: 4 }],
    openings: [],
    placedItems: [],
    ...extra,
  };
}
const FLOOR_TILES = {
  floorTiles: [
    { materialId: 'eva-combat', tileWm: 1, tileHm: 1, originM: { x: 0.05, y: 0.05 }, runs: [0, 0, 5, 1, 0, 5, 2, 0, 5, 3, 0, 5] },
  ],
};

async function seed(page: Page, rooms: Seed[]): Promise<void> {
  const property = { id: 'p', name: 'Vic', activeRoomId: 'r1', rooms };
  await page.addInitScript((p) => {
    localStorage.clear();
    localStorage.setItem('ppw_designer_coach_v1', '1');
    localStorage.setItem(
      'ppw_property_v2',
      JSON.stringify({ state: { property: p, showGrid: true, pxPerMetre: 100 }, version: 2 }),
    );
  }, property);
}

test.describe('Floor carries to the cart and checkout', () => {
  test('a floor + a product: both show on /cart and /checkout', async ({ page }) => {
    await seed(page, [room({ placedItems: [{ instanceId: 'i1', productId: 'k1-nordictrack-2450', x: 0.3, y: 0.3, rotation: 0 }], ...FLOOR_TILES })]);

    await page.goto('/cart');
    await expect(page.locator('[data-testid="cart-floor-line"]')).toHaveCount(1);
    await expect(page.locator('[data-testid="cart-page-floor-subtotal-label"]')).toBeVisible();
    await expect(page.locator('[data-testid="cart-floor-line"]')).toContainText(/EVA Combat/);

    await page.goto('/checkout');
    expect(page.url()).toContain('checkout');
    await expect(page.locator('[data-testid="checkout-floor-line"]')).toHaveCount(1);
  });

  test('a whole-room roll finish (no products) shows on /cart and /checkout', async ({ page }) => {
    await seed(page, [room({ floorFinish: { materialId: 'epdm-roll' } })]);

    await page.goto('/cart');
    await expect(page.locator('text=cart is empty')).toHaveCount(0);
    await expect(page.locator('[data-testid="cart-floor-line"]')).toHaveCount(1);

    await page.goto('/checkout');
    expect(page.url()).toContain('checkout');
    await expect(page.locator('[data-testid="checkout-floor-line"]')).toHaveCount(1);
  });

  test('a floor-only design is NOT an empty cart', async ({ page }) => {
    await seed(page, [room({ ...FLOOR_TILES })]);
    await page.goto('/cart');
    await expect(page.locator('text=cart is empty')).toHaveCount(0);
    await expect(page.locator('[data-testid="cart-floor-line"]')).toHaveCount(1);
  });
});
