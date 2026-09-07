/**
 * Phone: "+ Add to room" on a solar panel lands it ON THE ROOF (2026-09-07).
 *
 * Verify pass, fresh-eyes phone journey, P1: tapping the Jinko tile in the
 * Eco tab and pressing "+ Add to room" switched the view to the Roof and
 * placed nothing — an empty-looking roof with a "your room is empty" hint.
 * The click path can ask the customer to tap a slab; the popup cannot, so
 * the intent now pops the roof and places on the slab that mirrors the
 * storey. Pinned here end to end on a 390 px touch phone.
 *
 * Run: PPW_E2E_BASE_URL=http://127.0.0.1:5188 npx playwright test eco-phone-add
 */
import { test, expect } from '@playwright/test';
import { GEOM_BRIDGE_SKIP } from './multiroom-helpers';
import { oneRoomFixture, requireGeomBridgeGenerous, seedSimsProperty, storedSimsProperty, waitForGeom } from './sims-world-helpers';

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

test('Eco tab → panel tile → "+ Add to room" places the panel on the roof slab', async ({ page }) => {
  await seedSimsProperty(page, oneRoomFixture());
  await page.goto('/designer');
  await page.waitForSelector('.konvajs-content canvas', { state: 'attached', timeout: 30_000 });
  if (!(await requireGeomBridgeGenerous(page))) test.skip(true, GEOM_BRIDGE_SKIP);
  await waitForGeom(page);

  await page.locator('[data-testid="sims-cat-eco"]').click();
  const tile = page.locator('[data-testid="sims-bottom-toolbar"] [data-product-id="emcar-jinko-475"]').first();
  await expect(tile).toBeVisible();
  await tile.click();
  const add = page.locator('[data-testid="popup-add-to-room"]');
  await expect(add).toBeVisible();
  await add.click();
  await page.waitForTimeout(700);

  const prop = await storedSimsProperty(page);
  expect(prop, 'property persisted').not.toBeNull();
  expect(prop!.activeLevelId, 'the view moved to the roof').toBe('roof');
  const roof = prop!.rooms.find((r) => r.kind === 'roof');
  expect(roof, 'a roof slab exists').toBeTruthy();
  expect(roof!.placedItems.map((i) => i.productId), 'the panel is ON the slab, not lost').toEqual(['emcar-jinko-475']);
  expect(prop!.rooms.find((r) => r.id === 'r1')!.placedItems, 'nothing landed on the storey').toHaveLength(0);
  await expect(page.locator('text=Your room is empty')).toHaveCount(0);
  // The energy chip now has a generator to report.
  await expect(page.locator('[data-testid="energy-readout"]')).toBeVisible();
});
