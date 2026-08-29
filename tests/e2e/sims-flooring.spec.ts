/**
 * Sims flooring + floor cost (Vic 2026-08-29, follow-ups to the Sims world).
 *
 *   "flooring of 'The Sims' game functions different it allows to drag and
 *    duplicate the flooring which fits tight next to each other."
 *   "when adding the floor including selecting full room floor cover option
 *    already in the designer, it does not calculate the cost and the cart
 *    currently is unaffected"
 *
 * Three contracts, each asserted on VALUES from the persisted store and the
 * rendered cart, never on "something happened":
 *   1. a painted whole-room floor is a cart with a price before any product
 *   2. the room's Floor finish picker (the "full room cover" option) is too
 *   3. flooring PRODUCTS snap to their own tile lattice: drop, Duplicate and
 *      Fill floor all land edge to edge at the tile pitch, never on the
 *      0.5 m furniture grid
 *
 * Run against a DEV server (the geom bridge is dev-only):
 *   PPW_E2E_BASE_URL=http://127.0.0.1:5188 npx playwright test sims-flooring
 */

import { test, expect, type Page } from '@playwright/test';
import {
  allStoredItems,
  armAndClickWorld,
  clickWorld,
  oneRoomFixture,
  requireGeomBridgeGenerous,
  screenAt,
  seedSimsProperty,
  waitForGeom,
} from './sims-world-helpers';

const GEOM_SKIP = 'DEV geom bridge not present (production build) — run against `npm run dev`';

/** The on-canvas cost badge as a number (e.g. "12,750 MUR" → 12750). */
async function costReadout(page: Page): Promise<number> {
  const txt = (await page.locator('[data-testid="cost-readout"]').textContent()) ?? '';
  const digits = txt.replace(/[^\d.]/g, '');
  return digits ? Number(digits) : 0;
}

/** Shift-drag a single point: the floor tool's "fill the whole room" gesture. */
async function shiftFillRoomAt(page: Page, xM: number, yM: number): Promise<void> {
  const a = await screenAt(page, xM, yM);
  await page.keyboard.down('Shift');
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(a.x + 2, a.y + 2);
  await page.mouse.up();
  await page.keyboard.up('Shift');
}

async function open(page: Page): Promise<void> {
  await seedSimsProperty(page, oneRoomFixture());
  await page.goto('/designer');
  await page.waitForSelector('.konvajs-content canvas', { state: 'attached' });
  test.skip(!(await requireGeomBridgeGenerous(page)), GEOM_SKIP);
  await waitForGeom(page);
}

test.describe('Sims flooring + floor cost', () => {
  test.use({ viewport: { width: 1920, height: 1080 } });

  test('1. painting the whole room is a priced cart line before any product is placed', async ({ page }) => {
    await open(page);

    // Nothing in the cart yet: no pill, badge reads 0.
    await expect(page.locator('[data-testid="cart-pill"]')).toHaveCount(0);
    expect(await costReadout(page)).toBe(0);

    await page.locator('[data-testid="floor-paint-toggle"]').click();
    await page.waitForSelector('[data-testid="floor-paint-palette"]');
    // 1 m tiles divide the 5 x 4 m fixture exactly: 20 tiles, no cut edge.
    await page.locator('[data-testid="floor-paint-outdoor-1m"]').click();
    await waitForGeom(page);
    await shiftFillRoomAt(page, 1.5, 1.5);

    // THE fix: the cart strip used to hide itself until the first PRODUCT
    // landed, so a floor-only design read as "the floor costs nothing".
    const pill = page.locator('[data-testid="cart-pill"]');
    await expect(pill).toBeVisible();
    await expect(pill).toContainText('20');
    await expect.poll(() => costReadout(page)).toBeGreaterThan(0);

    await pill.click();
    const sheet = page.locator('[data-testid="cart-sheet"]');
    await expect(sheet).toBeVisible();
    const line = sheet.locator('[data-testid="cart-floor-line"]');
    await expect(line).toHaveCount(1);
    await expect(line).toContainText(/20 tiles/);
    await expect(sheet.locator('[data-testid="cart-floor-units"]')).toHaveText('20');
  });

  test('2. the room Floor finish picker ("full room cover") prices the whole floor too', async ({ page }) => {
    await open(page);
    await expect(page.locator('[data-testid="cart-pill"]')).toHaveCount(0);

    await page.locator('[data-testid="floor-tool-toggle"]').click();
    await expect(page.locator('[data-testid="floor-picker"]')).toBeVisible();
    await page.locator('[data-testid="floor-material-outdoor-1m"]').click();

    const pill = page.locator('[data-testid="cart-pill"]');
    await expect(pill).toBeVisible();
    await expect(pill).toContainText('20');
    await expect.poll(() => costReadout(page)).toBeGreaterThan(0);

    await pill.click();
    const line = page.locator('[data-testid="cart-sheet"] [data-testid="cart-floor-line"]');
    await expect(line).toHaveCount(1);
    await expect(line).toContainText(/20 tiles/);

    // Clearing the finish empties the cart again — the line is DERIVED, not stuck.
    await page.locator('[data-testid="cart-sheet"]').getByRole('button', { name: /^close$/i }).click();
    await expect(page.locator('[data-testid="cart-sheet"]')).toHaveCount(0);
    await page.locator('[data-testid="floor-tool-toggle"]').click();
    await page.locator('[data-testid="floor-none"]').click();
    await expect(page.locator('[data-testid="cart-pill"]')).toHaveCount(0);
    await expect.poll(() => costReadout(page)).toBe(0);
  });

  test('3. flooring tiles drop, Duplicate and Fill floor edge to edge on the tile lattice', async ({ page }) => {
    await open(page);
    await page.locator('[data-testid="dock-cat-flooring"]').click();

    // A 1 x 1 m EVA tile. The lattice with no tile yet starts at the room's
    // inner corner (0.05, 0.05); a drop centred at (1.6, 1.6) → top-left
    // (1.1, 1.1) → nearest cell (1.05, 1.05). NOT (1.0, 1.0) — the 0.5 m
    // furniture grid would put a tile over the wall band.
    await armAndClickWorld(page, 'k1-floor-eva-combat', 1.6, 1.6);
    await expect.poll(async () => (await allStoredItems(page)).length).toBe(1);
    let items = await allStoredItems(page);
    expect(items[0].x).toBeCloseTo(1.05, 4);
    expect(items[0].y).toBeCloseTo(1.05, 4);

    // Duplicate (D) lays the copy EXACTLY one tile to the right.
    await clickWorld(page, 1.55, 1.55);
    await page.keyboard.press('d');
    await expect.poll(async () => (await allStoredItems(page)).length).toBe(2);
    items = await allStoredItems(page);
    const second = items.find((i) => i.x > 1.5)!;
    expect(second.x).toBeCloseTo(2.05, 4);
    expect(second.y).toBeCloseTo(1.05, 4);

    // A THIRD tile dropped roughly next to the second snaps onto the same
    // lattice — no half-tile gap, no overlap.
    await page.keyboard.press('Escape');
    await armAndClickWorld(page, 'k1-floor-eva-combat', 3.4, 1.7);
    await expect.poll(async () => (await allStoredItems(page)).length).toBe(3);
    items = await allStoredItems(page);
    const xs = items.map((i) => i.x).sort((a, b) => a - b);
    expect(xs.map((x) => Number(x.toFixed(4)))).toEqual([1.05, 2.05, 3.05]);
    for (const it of items) expect(it.y).toBeCloseTo(1.05, 4);

    // Fill floor: every whole cell of the lattice inside the room. Inner
    // 4.9 x 3.9 m at 1 m pitch from (1.05, 1.05) → columns 0.05/1.05/2.05/
    // 3.05 and rows 0.05/1.05/2.05 = 12 tiles, 9 of them new.
    await clickWorld(page, 1.55, 1.55);
    const fill = page.locator('[data-testid="details-fill-floor"]');
    await expect(fill).toBeVisible();
    await fill.click();
    await expect.poll(async () => (await allStoredItems(page)).length).toBe(12);
    items = await allStoredItems(page);
    for (const it of items) {
      expect(it.productId).toBe('k1-floor-eva-combat');
      // On the lattice: an integer number of tiles from the first one.
      expect(Math.abs((it.x - 1.05) - Math.round(it.x - 1.05))).toBeLessThan(1e-4);
      expect(Math.abs((it.y - 1.05) - Math.round(it.y - 1.05))).toBeLessThan(1e-4);
      // And WHOLLY inside the inner face of the walls.
      expect(it.x).toBeGreaterThanOrEqual(0.05 - 1e-4);
      expect(it.x + 1).toBeLessThanOrEqual(4.95 + 1e-4);
      expect(it.y).toBeGreaterThanOrEqual(0.05 - 1e-4);
      expect(it.y + 1).toBeLessThanOrEqual(3.95 + 1e-4);
    }
    // No two tiles share a cell.
    const keys = new Set(items.map((i) => `${i.x.toFixed(3)},${i.y.toFixed(3)}`));
    expect(keys.size).toBe(12);

    // Tiles are products: 12 in the cart, priced.
    await expect(page.locator('[data-testid="cart-pill"]')).toContainText('12');
    await expect.poll(() => costReadout(page)).toBeGreaterThan(0);
  });
});
