/**
 * Surface slots + wall-mounted items (2026-08-24) — real-browser
 * acceptance. Drives the pointer-FSM with CDP mouse events and asserts
 * the committed `ppw_property_v2` store:
 *   • a console table placed mid-room (floor path),
 *   • a diffuser dropped ONTO the table → parented + inside its rect,
 *   • a shelf near the top wall → flush y=0, rotation 0,
 *   • a mirror near the right wall → flush right, rotation 90,
 *   • dragging the table carries the diffuser with it.
 *
 * Run: PPW_E2E_BASE_URL=http://localhost:5187 npx playwright test surface-wall-items
 */

import { test, expect, type Page } from '@playwright/test';

const PX_PER_M = 100;

interface StoredItem {
  instanceId: string;
  productId: string;
  x: number;
  y: number;
  rotation: number;
  parentInstanceId?: string;
}

/** Empirical room origin: pixel-scan the room-layer canvas for the dark border. */
async function roomOrigin(page: Page): Promise<{ x: number; y: number }> {
  const found = await page.evaluate(() => {
    const c = document.querySelector('.konvajs-content canvas') as HTMLCanvasElement | null;
    if (!c) return null;
    const ctx = c.getContext('2d');
    if (!ctx) return null;
    const img = ctx.getImageData(0, 0, c.width, c.height).data;
    let minX = Infinity;
    let minY = Infinity;
    for (let y = 0; y < c.height; y += 2) {
      for (let x = 0; x < c.width; x += 2) {
        const i = (y * c.width + x) * 4;
        if (img[i + 3] > 200 && img[i] < 40 && img[i + 1] < 50 && img[i + 2] < 50) {
          if (x < minX) minX = x;
          if (y < minY) minY = y;
        }
      }
    }
    if (!Number.isFinite(minX)) return null;
    const rect = c.getBoundingClientRect();
    const scale = c.width / rect.width;
    return { x: rect.x + minX / scale + 3, y: rect.y + minY / scale + 3 };
  });
  if (!found) throw new Error('Room border not found on the Konva layer canvas');
  return found;
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

    // Shelf: flush on the top wall, facing into the room.
    expect(shelf.rotation).toBe(0);
    expect(shelf.y).toBeCloseTo(0, 5);

    // Mirror: flush on the right wall, rotated 90 (0.05 deep at 90°).
    expect(mirror.rotation).toBe(90);
    expect(mirror.x).toBeCloseTo(5 - 0.05, 5);

    // 5 — drag the table +1 m right, +1 m down: the diffuser rides along.
    const origin = await roomOrigin(page);
    const grabX = origin.x + 2.9 * PX_PER_M; // on the table, clear of the diffuser
    const grabY = origin.y + 2.3 * PX_PER_M;
    await page.mouse.move(grabX, grabY, { steps: 4 });
    await page.mouse.down();
    await page.mouse.move(grabX + 1.0 * PX_PER_M, grabY + 1.0 * PX_PER_M, { steps: 12 });
    await page.mouse.up();

    items = await storedItems(page);
    const movedTable = items.find((i) => i.productId === 'demo-console-table')!;
    const movedDiffuser = items.find((i) => i.productId === 'demo-aroma-diffuser')!;
    expect(movedTable.x).toBeCloseTo(3.0, 5);
    expect(movedTable.y).toBeCloseTo(3.0, 5);
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
