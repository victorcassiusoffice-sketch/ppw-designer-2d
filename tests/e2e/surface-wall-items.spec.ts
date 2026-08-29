/**
 * Surface slots + wall-mounted items (2026-08-24; inner-face flush
 * 2026-08-29) — real-browser acceptance. Drives the pointer-FSM with CDP
 * mouse events and asserts the committed `ppw_property_v2` store:
 *   • a console table placed mid-room (floor path),
 *   • a diffuser dropped ONTO the table → parented + inside its rect,
 *   • a shelf near the top wall → flush on the wall's inner face (y = 0.05),
 *     rotation 0,
 *   • a mirror near the right wall → flush on the inner face, rotation 90,
 *   • dragging the table carries the diffuser with it.
 *
 * Walls are 0.1 m thick and stroked centred on the polygon edge, so a
 * wall-mounted item hangs on the INNER FACE 0.05 m (`WALL_HALF_M`) inside
 * the edge — the same contract wall-aware-placement.spec pins for floor
 * items.
 *
 * Run: PPW_E2E_BASE_URL=http://localhost:5187 npx playwright test surface-wall-items
 */

import { test, expect, type Page } from '@playwright/test';
import { WALL_HALF_M } from '../../src/designer/wallAwarePlacement';
// Room origin via the DEV geometry bridge, falling back to the charcoal
// wall pixel-scan driven by `blueprintTheme.ROOM_BORDER_SCAN`. The scan
// this spec used to inline looked for the pre-reskin `r < 40` border — the
// paper theme's wall is (42, 41, 38), so that predicate finds nothing.
import { PX_PER_M, roomOrigin } from './multiroom-helpers';

interface StoredItem {
  instanceId: string;
  productId: string;
  x: number;
  y: number;
  rotation: number;
  parentInstanceId?: string;
}

async function placeAt(page: Page, productId: string, xM: number, yM: number) {
  const card = page.locator(`[data-product-id="${productId}"]:visible`).first();
  await expect(card).toBeVisible();
  await card.click();
  await expect(page.locator('[data-armed="true"]')).toHaveCount(2);
  const origin = await roomOrigin(page);
  const sx = origin.x + xM * PX_PER_M;
  const sy = origin.y + yM * PX_PER_M;
  await page.mouse.move(sx, sy, { steps: 8 });
  await page.mouse.click(sx, sy);
  await expect(page.locator('[data-armed="true"]')).toHaveCount(0);
  await page.keyboard.press('Escape'); // deselect: no stray handles under later clicks
}

async function storedItems(page: Page): Promise<StoredItem[]> {
  return page.evaluate(() => {
    const raw = localStorage.getItem('ppw_property_v2');
    if (!raw) return [];
    const parsed = JSON.parse(raw) as {
      state?: { property?: { rooms?: Array<{ placedItems?: StoredItem[] }> } };
    };
    return (parsed.state?.property?.rooms ?? []).flatMap((r) => r.placedItems ?? []);
  });
}

test.describe('surface slots + wall-mounted items', () => {
  test.use({ viewport: { width: 1920, height: 1080 } });

  test('table hosts a diffuser; shelf + mirror hang on walls; moving the table carries its items', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      localStorage.clear();
      localStorage.setItem('ppw_designer_coach_v1', '1');
    });
    await page.goto('/designer');
    await page.locator('[data-testid="start-quick-rectangle"]').click();

    // 1 — console table mid-room (floor item, 1.2×0.4 → lands at 2.0, 2.0).
    await placeAt(page, 'demo-console-table', 2.5, 2.0);
    // 2 — diffuser ONTO the table.
    await placeAt(page, 'demo-aroma-diffuser', 2.3, 2.15);
    // 3 — shelf near the top wall.
    await placeAt(page, 'demo-wall-shelf', 2.0, 0.5);
    // 4 — mirror near the right wall.
    await placeAt(page, 'demo-wall-mirror', 4.6, 2.0);

    await expect(page.locator('[data-testid="items-placed"]')).toHaveText('4');

    let items = await storedItems(page);
    const table = items.find((i) => i.productId === 'demo-console-table')!;
    const diffuser = items.find((i) => i.productId === 'demo-aroma-diffuser')!;
    const shelf = items.find((i) => i.productId === 'demo-wall-shelf')!;
    const mirror = items.find((i) => i.productId === 'demo-wall-mirror')!;

    // Table: plain mid-room grid snap, no wall pull.
    expect(table.x).toBeCloseTo(2.0, 5);
    expect(table.y).toBeCloseTo(2.0, 5);
    expect(table.rotation).toBe(0);

    // Diffuser: parented to the table, fully inside its 1.2×0.4 footprint.
    expect(diffuser.parentInstanceId).toBe(table.instanceId);
    expect(diffuser.x).toBeGreaterThanOrEqual(table.x - 1e-9);
    expect(diffuser.x + 0.15).toBeLessThanOrEqual(table.x + 1.2 + 1e-9);
    expect(diffuser.y).toBeGreaterThanOrEqual(table.y - 1e-9);
    expect(diffuser.y + 0.15).toBeLessThanOrEqual(table.y + 0.4 + 1e-9);

    // Shelf (0.8×0.2): back on the top wall's inner face, facing into the
    // room, grid-snapped along the wall.
    expect(shelf.rotation).toBe(0);
    expect(shelf.y).toBeCloseTo(WALL_HALF_M, 5);
    expect(shelf.x).toBeCloseTo(1.5, 5);

    // Mirror (1.2×0.05): on the right wall's inner face, rotated 90 so it is
    // 0.05 deep → x = 5 − 0.05 − 0.05.
    expect(mirror.rotation).toBe(90);
    expect(mirror.x).toBeCloseTo(5 - WALL_HALF_M - 0.05, 5);
    expect(mirror.y).toBeCloseTo(1.5, 5);

    // 5 — drag the table +1 m right, +1 m down: the diffuser rides along.
    const origin = await roomOrigin(page);
    const grabX = origin.x + 2.9 * PX_PER_M; // on the table, clear of the diffuser
    const grabY = origin.y + 2.3 * PX_PER_M;
    await page.mouse.move(grabX, grabY, { steps: 4 });
    await page.mouse.down();
    await page.mouse.move(grabX + 1.0 * PX_PER_M, grabY + 1.0 * PX_PER_M, { steps: 12 });
    await page.mouse.up();

    // Poll the persisted store for the drag-end commit rather than reading
    // it on the very next tick — load-proof, and no weaker.
    await expect
      .poll(
        async () =>
          (await storedItems(page)).find((i) => i.productId === 'demo-console-table')?.x ?? null,
        { timeout: 10_000 },
      )
      .not.toBe(table.x);

    items = await storedItems(page);
    const movedTable = items.find((i) => i.productId === 'demo-console-table')!;
    const movedDiffuser = items.find((i) => i.productId === 'demo-aroma-diffuser')!;
    expect(movedTable.x).toBeCloseTo(3.0, 5);
    expect(movedTable.y).toBeCloseTo(3.0, 5);
    // Mid-room drag keeps the facing (no reset to 0 — it already was 0).
    expect(movedTable.rotation).toBe(0);
    expect(movedDiffuser.x - diffuser.x).toBeCloseTo(movedTable.x - table.x, 5);
    expect(movedDiffuser.y - diffuser.y).toBeCloseTo(movedTable.y - table.y, 5);

    await page.screenshot({ path: 'test-results/surface-wall-items.png' });
  });

  test('a surface item refuses to land on the bare floor', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.clear();
      localStorage.setItem('ppw_designer_coach_v1', '1');
    });
    await page.goto('/designer');
    await page.locator('[data-testid="start-quick-rectangle"]').click();

    const card = page.locator('[data-product-id="demo-aroma-diffuser"]:visible').first();
    await card.click();
    await expect(page.locator('[data-armed="true"]')).toHaveCount(2);
    const origin = await roomOrigin(page);
    await page.mouse.move(origin.x + 2.5 * PX_PER_M, origin.y + 2.0 * PX_PER_M, { steps: 8 });
    await page.mouse.click(origin.x + 2.5 * PX_PER_M, origin.y + 2.0 * PX_PER_M);

    // Commit refused → nothing stored.
    expect(await storedItems(page)).toHaveLength(0);
    await expect(page.locator('[data-testid="items-placed"]')).toHaveText('0');
  });
});
