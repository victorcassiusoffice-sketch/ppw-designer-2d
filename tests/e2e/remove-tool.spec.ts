/**
 * Remove tool (Vic 2026-08-31: "I can't remove walls ... I can't delete
 * anything"). The sledgehammer demolish tool existed but was reachable only
 * by the J key — no button, nothing on mobile. This pins the visible Remove
 * tool: activate it, then a click on a free wall OR a placed object deletes
 * it; Done/Esc returns to Select.
 *
 * DEV geom bridge only:
 *   PPW_E2E_BASE_URL=http://127.0.0.1:5188 npx playwright test remove-tool
 */
import { test, expect, type Page } from '@playwright/test';
import {
  allStoredItems,
  clickWorld,
  oneRoomFixture,
  requireGeomBridgeGenerous,
  seedSimsProperty,
  waitForGeom,
  type SimsSeedProperty,
} from './sims-world-helpers';

const GEOM_SKIP = 'DEV geom bridge not present — run against `npm run dev`';

/** oneRoomFixture + a free wall east of the room + one placed object. */
function populated(): SimsSeedProperty {
  const p = oneRoomFixture([
    { instanceId: 'i1', productId: 'k1-nordictrack-2450', x: 0.3, y: 0.3, rotation: 0 },
  ]);
  p.walls = [{ id: 'fw1', a: { x: 6, y: 1 }, b: { x: 8, y: 1 }, thicknessM: 0.1, levelId: 'ground' }];
  return p;
}

async function storedWallCount(page: Page): Promise<number> {
  return page.evaluate(() => {
    const raw = localStorage.getItem('ppw_property_v2');
    if (!raw) return -1;
    try {
      return (JSON.parse(raw).state?.property?.walls ?? []).length as number;
    } catch {
      return -1;
    }
  });
}

test.describe('Remove tool — the visible sledgehammer', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test.beforeEach(async ({ page }) => {
    await seedSimsProperty(page, populated());
    await page.goto('/designer');
    await page.waitForSelector('.konvajs-content canvas', { state: 'attached' });
    test.skip(!(await requireGeomBridgeGenerous(page)), GEOM_SKIP);
    await waitForGeom(page);
  });

  test('activate Remove, then click a free wall to delete it and an object to delete it', async ({
    page,
  }) => {
    expect(await storedWallCount(page)).toBe(1);
    expect((await allStoredItems(page)).length).toBe(1);

    const remove = page.locator('[data-testid="remove-tool-toggle"]');
    await expect(remove).toHaveCount(1);
    await remove.click();
    // The banner makes it obvious clicks now delete.
    await expect(page.locator('[data-testid="remove-hud"]')).toBeVisible();

    // Click the free wall (mid-span) → gone.
    await clickWorld(page, 7, 1);
    await expect.poll(() => storedWallCount(page)).toBe(0);
    // The object is still there…
    expect((await allStoredItems(page)).length).toBe(1);

    // …click it → gone.
    await clickWorld(page, 1.3, 0.8);
    await expect.poll(async () => (await allStoredItems(page)).length).toBe(0);

    // Done exits back to Select.
    await page.locator('[data-testid="remove-done"]').click();
    await expect(page.locator('[data-testid="remove-hud"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="select-tool-toggle"]')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  test('Esc exits the Remove tool', async ({ page }) => {
    await page.locator('[data-testid="remove-tool-toggle"]').click();
    await expect(page.locator('[data-testid="remove-hud"]')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-testid="remove-hud"]')).toHaveCount(0);
  });

  test('the phone menu sheet carries a single Remove row', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('button[aria-label="Open menu"]').click();
    await expect(page.locator('[data-testid="remove-tool-toggle-mobile"]')).toHaveCount(1);
  });
});
