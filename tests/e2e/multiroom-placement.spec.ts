/**
 * Attached multi-room — P4 PLACEMENT ROUTING acceptance (Vic 2026-08-26).
 *
 * With room r1 active, a product armed and clicked at a world point inside
 * r2 must land in r2 — not in the active room, and not nowhere. Focus must
 * follow it (D5) or the Sims loop (place → rotate / delete) is dead outside
 * the active room. A drop outside every room must be rejected.
 *
 * Run against a local dev server:
 *   PPW_E2E_BASE_URL=http://localhost:5187 npx playwright test multiroom-placement
 */

import { test, expect, type Page } from '@playwright/test';
import {
  PX_PER_M,
  TWO_ROOM_FIXTURE,
  cloneFixture,
  roomOrigin,
  seedProperty,
  storedProperty,
} from './multiroom-helpers';

const PRODUCT_ID = 'k1-schwinn-700ic';

/** Arm the catalog card, then click at a WORLD point. */
async function armAndClickAt(page: Page, xM: number, yM: number): Promise<void> {
  const card = page.locator(`[data-product-id="${PRODUCT_ID}"]`).first();
  await expect(card).toBeVisible();
  await card.click();
  await expect(page.locator('[data-armed="true"]')).toHaveCount(2);
  // Re-read the origin per placement — panels opening can re-centre the
  // Konva viewport between clicks.
  const origin = await roomOrigin(page);
  const sx = origin.x + xM * PX_PER_M;
  const sy = origin.y + yM * PX_PER_M;
  await page.mouse.move(sx, sy, { steps: 8 });
  await page.mouse.click(sx, sy);
  await expect(page.locator('[data-armed="true"]')).toHaveCount(0);
}

test.describe('Attached multi-room — placement routing', () => {
  test.use({ viewport: { width: 1920, height: 1080 } });

  test('a drop inside a NON-active room lands in that room and moves focus', async ({ page }) => {
    await seedProperty(page, cloneFixture(TWO_ROOM_FIXTURE));
    await page.goto('/designer');
    await page.waitForSelector('.konvajs-content canvas', { state: 'attached' });
    await expect(page.locator('[data-testid="items-placed"]')).toHaveText('0');

    // r1 is ACTIVE; drop deep inside r2 (world x 7, y 2).
    await armAndClickAt(page, 7, 2);

    // Assert the r2 delta from the persisted store IMMEDIATELY, before the
    // 5 s success toast (with its pointer-events Undo button, bottom-centre)
    // or the DetailsPanel (right edge) can be in the way of anything.
    await expect(page.locator('[data-testid="items-placed"]')).toHaveText('1');
    const afterFirst = await storedProperty(page);
    expect(afterFirst).not.toBeNull();
    const r1a = afterFirst!.rooms.find((r) => r.id === 'r1')!;
    const r2a = afterFirst!.rooms.find((r) => r.id === 'r2')!;
    expect(r2a.placedItems).toHaveLength(1);
    expect(r1a.placedItems).toHaveLength(0);
    // D5 — selection moved focus to the room the item actually landed in.
    expect(afterFirst!.activeRoomId).toBe('r2');
    // And it landed inside r2's walls (x 5 → 9).
    expect(r2a.placedItems[0].x).toBeGreaterThanOrEqual(5);
    expect(r2a.placedItems[0].x).toBeLessThanOrEqual(9);

    // Escape first: deselect + close the DetailsPanel before the next drop
    // (the wall-aware spec's pattern).
    await page.keyboard.press('Escape');

    // Now drop OUTSIDE every room — world (-1, -1) is on-stage under the
    // centred fit and clear of both the toast and the panel.
    await armAndClickAt(page, -1, -1);

    // Total unchanged: the drop was rejected, not silently re-homed.
    await expect(page.locator('[data-testid="items-placed"]')).toHaveText('1');
    const afterSecond = await storedProperty(page);
    const total = afterSecond!.rooms.reduce((n, r) => n + r.placedItems.length, 0);
    expect(total).toBe(1);
    // And the user was told why.
    await expect(page.getByText(/outside the plan/i).first()).toBeVisible();

    console.log('ROOM_ROUTE=true');
  });

  test('a drop inside the ACTIVE room still lands there (single-room path unchanged)', async ({
    page,
  }) => {
    await seedProperty(page, cloneFixture(TWO_ROOM_FIXTURE));
    await page.goto('/designer');
    await page.waitForSelector('.konvajs-content canvas', { state: 'attached' });

    await armAndClickAt(page, 2, 2);

    const stored = await storedProperty(page);
    const r1 = stored!.rooms.find((r) => r.id === 'r1')!;
    expect(r1.placedItems).toHaveLength(1);
    expect(stored!.rooms.find((r) => r.id === 'r2')!.placedItems).toHaveLength(0);
    expect(stored!.activeRoomId).toBe('r1');
  });
});
