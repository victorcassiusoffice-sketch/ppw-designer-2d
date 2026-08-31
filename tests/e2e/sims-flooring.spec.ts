/**
 * Sims flooring + floor cost (Vic 2026-08-29, follow-ups to the Sims world).
 *
 *   "flooring of 'The Sims' game functions different it allows to drag and
 *    duplicate the flooring which fits tight next to each other."
 *   "when adding the floor including selecting full room floor cover option
 *    already in the designer, it does not calculate the cost and the cart
 *    currently is unaffected"
 *
 * Four contracts, each asserted on VALUES from the persisted store and the
 * rendered cart, never on "something happened" (Floor tool, 2026-08-30 — ONE
 * tool named Floor; the Paint brush, the Finish picker and the tile SKUs
 * placed as items are gone):
 *   1. a whole-room floor (Shift) is a cart with a price before any product
 *   2. the Room scope chip fills the active room and Clear floor empties it
 *   3. a K1 tile SKU's catalog card arms the Floor tool on that material
 *      (it is a FLOOR card, not a placeable item)
 *   4. loose-mat flooring PRODUCTS still snap to their own tile lattice:
 *      drop, Duplicate and Fill floor all land edge to edge at the tile
 *      pitch, never on the 0.5 m furniture grid
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

  test('1. a whole-room floor (Shift) is a priced cart line before any product is placed', async ({ page }) => {
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

    // Done closes the docked Floor panel (it sits over the cart pill's corner).
    await page.locator('[data-testid="floor-paint-done"]').click();
    await expect(page.locator('[data-testid="floor-paint-palette"]')).toBeHidden();
    await pill.click();
    const sheet = page.locator('[data-testid="cart-sheet"]');
    await expect(sheet).toBeVisible();
    const line = sheet.locator('[data-testid="cart-floor-line"]');
    await expect(line).toHaveCount(1);
    await expect(line).toContainText(/20 tiles/);
    await expect(sheet.locator('[data-testid="cart-floor-units"]')).toHaveText('20');
  });

  test('2. the Room scope chip fills the active room, and Clear floor empties the cart again', async ({ page }) => {
    await open(page);
    await expect(page.locator('[data-testid="cart-pill"]')).toHaveCount(0);

    await page.locator('[data-testid="floor-paint-toggle"]').click();
    await expect(page.locator('[data-testid="floor-paint-palette"]')).toBeVisible();
    await page.locator('[data-testid="floor-paint-outdoor-1m"]').click();
    // The Room chip is an ACTION: pressing it fills the active room at once.
    await page.locator('[data-testid="floor-paint-scope-room"]').click();

    const pill = page.locator('[data-testid="cart-pill"]');
    await expect(pill).toBeVisible();
    await expect(pill).toContainText('20');
    await expect.poll(() => costReadout(page)).toBeGreaterThan(0);

    // Done closes the docked Floor panel (it sits over the cart pill's corner).
    await page.locator('[data-testid="floor-paint-done"]').click();
    await expect(page.locator('[data-testid="floor-paint-palette"]')).toBeHidden();
    await pill.click();
    const line = page.locator('[data-testid="cart-sheet"] [data-testid="cart-floor-line"]');
    await expect(line).toHaveCount(1);
    await expect(line).toContainText(/20 tiles/);

    // Clear floor empties the cart again — the line is DERIVED, not stuck.
    await page.locator('[data-testid="cart-sheet"]').getByRole('button', { name: /^close$/i }).click();
    await expect(page.locator('[data-testid="cart-sheet"]')).toHaveCount(0);
    await page.locator('[data-testid="floor-paint-toggle"]').click();
    await expect(page.locator('[data-testid="floor-paint-palette"]')).toBeVisible();
    const clear = page.locator('[data-testid="floor-paint-clear"]');
    await expect(clear).toBeEnabled();
    await clear.click();
    await expect(page.locator('[data-testid="cart-pill"]')).toHaveCount(0);
    await expect.poll(() => costReadout(page)).toBe(0);
  });

  test('3. a K1 tile SKU card in the dock arms the Floor tool on that material', async ({ page }) => {
    await open(page);
    await page.locator('[data-testid="dock-cat-flooring"]').click();

    // The EVA combat mat IS a Floor-tool material (same SKU). Its card is a
    // FLOOR card: clicking it opens the Floor panel on that material and
    // arms NOTHING for placement.
    const card = page.locator('[data-product-id="k1-floor-eva-combat"]').first();
    await expect(card).toBeVisible();
    await expect(card).toHaveAttribute('title', 'Laid with the Floor tool');
    await card.click();
    await expect(page.locator('[data-armed="true"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="floor-paint-palette"]')).toBeVisible();
    await expect(page.locator('[data-testid="floor-paint-eva-combat"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(card).toHaveAttribute('aria-pressed', 'true');

    // ...and the Room chip lays it: 1 m tiles over the 5 x 4 m room = 20.
    await page.locator('[data-testid="floor-paint-scope-room"]').click();
    const pill = page.locator('[data-testid="cart-pill"]');
    await expect(pill).toBeVisible();
    await expect(pill).toContainText('20');
    await expect.poll(async () => (await allStoredItems(page)).length).toBe(0);
  });

  test('4. loose-mat flooring tiles drop, Duplicate and Fill floor edge to edge on the tile lattice', async ({ page }) => {
    await open(page);
    await page.locator('[data-testid="dock-cat-flooring"]').click();

    // The 0.5 x 0.5 m EVA kids mat has NO Floor-tool material row, so it stays
    // a loose placeable item. The lattice with no tile yet starts at the
    // room's inner corner (0.05, 0.05); a drop centred at (1.6, 1.6) → top-left
    // (1.35, 1.35) → nearest 0.5 m cell (1.55, 1.55). NOT (1.5, 1.5) — the
    // 0.5 m furniture grid would put a tile over the wall band.
    await armAndClickWorld(page, 'k1-floor-eva-kids', 1.6, 1.6);
    await expect.poll(async () => (await allStoredItems(page)).length).toBe(1);
    let items = await allStoredItems(page);
    expect(items[0].x).toBeCloseTo(1.55, 4);
    expect(items[0].y).toBeCloseTo(1.55, 4);

    // Duplicate (D) lays the copy EXACTLY one tile to the right.
    await clickWorld(page, 1.8, 1.8);
    await page.keyboard.press('d');
    await expect.poll(async () => (await allStoredItems(page)).length).toBe(2);
    items = await allStoredItems(page);
    const second = items.find((i) => i.x > 1.8)!;
    expect(second.x).toBeCloseTo(2.05, 4);
    expect(second.y).toBeCloseTo(1.55, 4);

    // A THIRD tile dropped roughly next to the second snaps onto the same
    // lattice — no half-tile gap, no overlap. Centre (3.4, 1.7) → top-left
    // (3.15, 1.45) → cell (3.05, 1.55).
    await page.keyboard.press('Escape');
    await armAndClickWorld(page, 'k1-floor-eva-kids', 3.4, 1.7);
    await expect.poll(async () => (await allStoredItems(page)).length).toBe(3);
    items = await allStoredItems(page);
    const xs = items.map((i) => i.x).sort((a, b) => a - b);
    expect(xs.map((x) => Number(x.toFixed(4)))).toEqual([1.55, 2.05, 3.05]);
    for (const it of items) expect(it.y).toBeCloseTo(1.55, 4);

    // Fill floor: every whole cell of the lattice inside the room. Inner
    // 4.9 x 3.9 m at 0.5 m pitch from (0.05, 0.05) → 9 columns x 7 rows =
    // 63 tiles, 60 of them new.
    await clickWorld(page, 1.8, 1.8);
    const fill = page.locator('[data-testid="details-fill-floor"]');
    await expect(fill).toBeVisible();
    await fill.click();
    await expect.poll(async () => (await allStoredItems(page)).length).toBe(63);
    items = await allStoredItems(page);
    for (const it of items) {
      expect(it.productId).toBe('k1-floor-eva-kids');
      // On the lattice: an integer number of tiles from the first one.
      expect(Math.abs((it.x - 1.55) / 0.5 - Math.round((it.x - 1.55) / 0.5))).toBeLessThan(1e-4);
      expect(Math.abs((it.y - 1.55) / 0.5 - Math.round((it.y - 1.55) / 0.5))).toBeLessThan(1e-4);
      // And WHOLLY inside the inner face of the walls.
      expect(it.x).toBeGreaterThanOrEqual(0.05 - 1e-4);
      expect(it.x + 0.5).toBeLessThanOrEqual(4.95 + 1e-4);
      expect(it.y).toBeGreaterThanOrEqual(0.05 - 1e-4);
      expect(it.y + 0.5).toBeLessThanOrEqual(3.95 + 1e-4);
    }
    // No two tiles share a cell.
    const keys = new Set(items.map((i) => `${i.x.toFixed(3)},${i.y.toFixed(3)}`));
    expect(keys.size).toBe(63);

    // Loose mats are products: 63 in the cart, priced.
    await expect(page.locator('[data-testid="cart-pill"]')).toContainText('63');
    await expect.poll(() => costReadout(page)).toBeGreaterThan(0);
  });
});
