/**
 * Attached multi-room — P4 PLACEMENT ROUTING acceptance (Vic 2026-08-26;
 * Sims world 2026-08-29).
 *
 * With room r1 active, a product armed and clicked at a world point inside
 * r2 must land in r2 — not in the active room, and not nowhere. Focus must
 * follow it (D5) or the Sims loop (place → rotate / delete) is dead outside
 * the active room.
 *
 * A drop outside every room used to be rejected ("outside the plan"). Since
 * the Sims world it lands in the level's OUTDOORS container — a room with
 * `kind: 'outdoor'` and an empty polygon, created on demand — and the walled
 * rooms are left untouched. (An off-PLOT drop is still refused, but only once
 * a land plot is locked; that lives in the Sims-world specs.)
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
  type SeedRoom,
} from './multiroom-helpers';

const PRODUCT_ID = 'k1-schwinn-700ic';
/** Schwinn seed: 120 x 55 cm footprint. */
const LEN = 1.2;
const WID = 0.55;

/** The persisted room shape is wider than the seed: outdoor containers carry `kind`. */
type StoredRoom = SeedRoom & { kind?: 'room' | 'outdoor' };

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

  test('a drop inside a NON-active room lands in that room and moves focus; an off-room drop lands outdoors', async ({
    page,
  }) => {
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
    // No outdoor container exists until something is dropped outside.
    expect((afterFirst!.rooms as StoredRoom[]).some((r) => r.kind === 'outdoor')).toBe(false);

    // Escape first: deselect + close the DetailsPanel before the next drop
    // (the wall-aware spec's pattern).
    await page.keyboard.press('Escape');

    // Now drop OUTSIDE every room — world (-1, -1.2) is on-stage under the
    // centred fit and clear of both the toast and the panel. Sims world:
    // that is the garden, not an error.
    await armAndClickAt(page, -1, -1.2);

    // Total went up by one: the drop landed, in the level's Outdoors
    // container, and neither walled room gained or lost anything.
    await expect(page.locator('[data-testid="items-placed"]')).toHaveText('2');
    const afterSecond = await storedProperty(page);
    const roomsB = afterSecond!.rooms as StoredRoom[];
    const total = roomsB.reduce((n, r) => n + r.placedItems.length, 0);
    expect(total).toBe(2);
    expect(roomsB.find((r) => r.id === 'r1')!.placedItems).toHaveLength(0);
    expect(roomsB.find((r) => r.id === 'r2')!.placedItems).toHaveLength(1);
    const outdoors = roomsB.filter((r) => r.kind === 'outdoor');
    expect(outdoors).toHaveLength(1);
    expect(outdoors[0].polygon).toEqual([]);
    expect(outdoors[0].placedItems).toHaveLength(1);
    // Free-standing in the garden (the nearest building wall is > 1.5 m
    // away): a plain 0.5 m grid snap of the footprint's top-left,
    // (-1 - LEN/2, -1.2 - WID/2) → (-1.5, -1.5).
    const snap = (v: number) => Math.round(v / 0.5) * 0.5;
    const garden = outdoors[0].placedItems[0];
    expect(garden.productId).toBe(PRODUCT_ID);
    expect(garden.rotation).toBe(0);
    expect(garden.x).toBeCloseTo(snap(-1 - LEN / 2), 5);
    expect(garden.y).toBeCloseTo(snap(-1.2 - WID / 2), 5);
    // The old "outside the plan" refusal must not fire any more.
    await expect(page.getByText(/outside the plan/i)).toHaveCount(0);

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
