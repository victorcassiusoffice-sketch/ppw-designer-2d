/**
 * Sims-style wall-aware placement (2026-08-23) — real-browser acceptance.
 *
 * Drives the actual pointer-FSM with CDP mouse events (never synthetic
 * DragEvent — see placement-fsm.spec.ts) and asserts the COMMITTED store
 * state (`ppw_property_v2` in localStorage): an object dropped near each
 * wall must land FLUSH against it and ROTATED to face into the room;
 * a mid-room drop must keep the default facing and stay on the grid.
 *
 * Run against a local dev server:
 *   PPW_E2E_BASE_URL=http://localhost:5187 npx playwright test wall-aware-placement
 */

import { test, expect, type Page } from '@playwright/test';

// Treadmill seed: 205 × 95 cm footprint (length along X at rotation 0).
const PRODUCT_ID = 'k1-nordictrack-2450';
const WID = 0.95; // footprint depth (m); length is 2.05 m along X at rotation 0
const PX_PER_M = 100; // propertyStore default; fresh session never zooms.

interface StoredItem {
  productId: string;
  x: number;
  y: number;
  rotation: number;
}

/**
 * Find the room's on-screen origin EMPIRICALLY: scan the first Konva
 * layer canvas (room polygon + grid — items live on a later layer) for
 * the dark #0E1B1F room border and return its top-left in page pixels.
 * Immune to the app's viewport-centring races — recomputed per placement.
 */
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
    // The 6px border stroke is centred on the polygon path → +3px inward.
    return { x: rect.x + minX / scale + 3, y: rect.y + minY / scale + 3 };
  });
  if (!found) throw new Error('Room border not found on the Konva layer canvas');
  return found;
}

async function placeAt(page: Page, xM: number, yM: number) {
  const card = page.locator(`[data-product-id="${PRODUCT_ID}"]`).first();
  await expect(card).toBeVisible();
  await card.click();
  await expect(page.locator('[data-armed="true"]')).toHaveCount(2);
  // Origin re-read per placement — UI panels opening can re-centre the
  // Konva viewport between placements.
  const origin = await roomOrigin(page);
  const sx = origin.x + xM * PX_PER_M;
  const sy = origin.y + yM * PX_PER_M;
  await page.mouse.move(sx, sy, { steps: 8 });
  await page.mouse.click(sx, sy);
  await expect(page.locator('[data-armed="true"]')).toHaveCount(0);
  // Deselect the just-placed item so its selection handles never sit
  // under a later click, and the details rail state stays constant.
  await page.keyboard.press('Escape');
}

async function storedItems(page: Page): Promise<StoredItem[]> {
  return page.evaluate(() => {
    const raw = localStorage.getItem('ppw_property_v2');
    if (!raw) return [];
    const parsed = JSON.parse(raw) as {
      state?: { property?: { rooms?: Array<{ placedItems?: StoredItem[] }> } };
    };
    const rooms = parsed.state?.property?.rooms ?? [];
    return rooms.flatMap((r) => r.placedItems ?? []);
  });
}

test.describe('Sims wall-aware placement', () => {
  // The 5×4 m quick room is 500×400 px at scale 1 — a 1280-wide window's
  // stage (minus catalog + details rails) clips the right wall, so clicks
  // there would land on DOM chrome. A desktop-large viewport keeps every
  // wall of the room on the actual Konva stage.
  test.use({ viewport: { width: 1920, height: 1080 } });

  test('drops near each wall auto-orient into the room and sit flush', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.clear();
      // First-visit coach-marks dialog intercepts canvas clicks — mark seen.
      localStorage.setItem('ppw_designer_coach_v1', '1');
    });
    await page.goto('/designer');

    // Fresh canvas → give it the quick 5×4 m rectangle room.
    await page.locator('[data-testid="start-quick-rectangle"]').click();
    await expect(page.locator('[data-testid="items-placed"]')).toHaveText('0');

    // 1 — near the TOP wall → rotation 0 (faces down/into room), flush y=0.
    await placeAt(page, 2.5, 0.6);
    // 2 — near the RIGHT wall → rotation 90 (faces left), flush right.
    await placeAt(page, 4.5, 2.0);
    // 3 — near the BOTTOM wall → rotation 180 (faces up), flush bottom.
    await placeAt(page, 2.5, 3.5);
    // 4 — mid-room → default facing 0, plain grid snap, no wall pull.
    await placeAt(page, 1.5, 2.0);

    await expect(page.locator('[data-testid="items-placed"]')).toHaveText('4');

    const items = await storedItems(page);
    expect(items).toHaveLength(4);
    const [top, right, bottom, mid] = items;

    expect(top.rotation).toBe(0);
    expect(top.y).toBeCloseTo(0, 5); // flush against the top wall

    expect(right.rotation).toBe(90);
    // At 90° the footprint is WID wide; flush → x = 5 − WID.
    expect(right.x).toBeCloseTo(5 - WID, 5);

    expect(bottom.rotation).toBe(180);
    expect(bottom.y).toBeCloseTo(4 - WID, 5); // flush against the bottom wall

    expect(mid.rotation).toBe(0);
    // Plain 0.5 m grid snap of (1.5 − LEN/2, 2.0 − WID/2).
    expect(mid.x).toBeCloseTo(0.5, 5);
    expect(mid.y).toBeCloseTo(1.5, 5);

    await page.screenshot({
      path: 'test-results/wall-aware-placement.png',
      fullPage: false,
    });
  });

  test('manual R rotation during armed phase overrides auto-orientation', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.clear();
      // First-visit coach-marks dialog intercepts canvas clicks — mark seen.
      localStorage.setItem('ppw_designer_coach_v1', '1');
    });
    await page.goto('/designer');
    await page.locator('[data-testid="start-quick-rectangle"]').click();

    const origin = await roomOrigin(page);
    const card = page.locator(`[data-product-id="${PRODUCT_ID}"]`).first();
    await card.click();
    await expect(page.locator('[data-armed="true"]')).toHaveCount(2);

    // Rotate twice (90° per press → 180) then drop near the TOP wall:
    // the user's facing must win over the wall's auto-orientation (0),
    // but the flush wall snap still applies.
    const sx = origin.x + 2.5 * PX_PER_M;
    const sy = origin.y + 0.6 * PX_PER_M;
    await page.mouse.move(sx, sy, { steps: 8 });
    await page.keyboard.press('r');
    await page.keyboard.press('r');
    await page.mouse.click(sx, sy);
    await expect(page.locator('[data-armed="true"]')).toHaveCount(0);

    const items = await storedItems(page);
    expect(items).toHaveLength(1);
    expect(items[0].rotation).toBe(180);
    expect(items[0].y).toBeCloseTo(0, 5);
  });
});
