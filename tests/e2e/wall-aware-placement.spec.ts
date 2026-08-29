/**
 * Sims-style wall-aware placement (2026-08-23; inner-face flush + corner
 * snap 2026-08-29) — real-browser acceptance.
 *
 * Drives the actual pointer-FSM with CDP mouse events (never synthetic
 * DragEvent — see placement-fsm.spec.ts) and asserts the COMMITTED store
 * state (`ppw_property_v2` in localStorage): an object dropped near each
 * wall must land FLUSH against that wall's INNER FACE and ROTATED to face
 * into the room; a drop near a corner must touch BOTH walls; a mid-room
 * drop must keep the default facing and stay on the grid.
 *
 * WALL THICKNESS (Sims world, FINDINGS section 1.1): the wall band is
 * `WALL_THICKNESS_M` = 0.1 m and is stroked CENTRED on the room polygon
 * edge, so its inner face sits `WALL_HALF_M` = 0.05 m inside the edge. An
 * item flush on the top wall therefore has y = 0.05 (not 0), one flush on
 * the right wall has x = 5 - 0.05 - depth, and so on. Flushing to the edge
 * itself — the pre-2026-08-29 contract this spec used to pin — left every
 * item overlapping the inner 5 cm of the wall band.
 *
 * Run against a local dev server:
 *   PPW_E2E_BASE_URL=http://localhost:5187 npx playwright test wall-aware-placement
 */

import { test, expect, type Page } from '@playwright/test';
import { WALL_HALF_M } from '../../src/designer/wallAwarePlacement';
// Room origin via the DEV geometry bridge (`window.__ppwGeom`, exact by
// construction), falling back to the charcoal wall pixel-scan that shares
// `blueprintTheme.ROOM_BORDER_SCAN` with the theme it tracks. Both live in
// the shared helper so this spec can never drift onto a stale palette.
import { PX_PER_M, roomOrigin } from './multiroom-helpers';

// Treadmill seed: 205 x 95 cm footprint (length along X at rotation 0).
const PRODUCT_ID = 'k1-nordictrack-2450';
const LEN = 2.05; // footprint length (m) along X at rotation 0
const WID = 0.95; // footprint depth (m)

/** Quick 5 x 4 m rectangle room the `start-quick-rectangle` button seeds. */
const ROOM_W = 5;
const ROOM_H = 4;

interface StoredItem {
  productId: string;
  x: number;
  y: number;
  rotation: number;
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
  // The 5x4 m quick room is 500x400 px at scale 1 — a 1280-wide window's
  // stage (minus catalog + details rails) clips the right wall, so clicks
  // there would land on DOM chrome. A desktop-large viewport keeps every
  // wall of the room on the actual Konva stage.
  test.use({ viewport: { width: 1920, height: 1080 } });

  test('drops near each wall, a corner and mid-room land flush on the inner face, facing in', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      localStorage.clear();
      // First-visit coach-marks dialog intercepts canvas clicks — mark seen.
      localStorage.setItem('ppw_designer_coach_v1', '1');
    });
    await page.goto('/designer');

    // Fresh canvas → give it the quick 5x4 m rectangle room.
    await page.locator('[data-testid="start-quick-rectangle"]').click();
    await expect(page.locator('[data-testid="items-placed"]')).toHaveText('0');

    // Six drops, laid out so no two footprints overlap (a collision would
    // trigger the free-slot relocation and hide what the resolver did).
    // Every drop point keeps >= 0.1 m of margin from a grid-snap boundary
    // and from the 0.45 m WALL_SNAP_GAP_M threshold, so a half-pixel of
    // pointer rounding can never flip an outcome.
    //
    // 1 — near the TOP wall → rotation 0 (faces down/into room), flush y.
    //     Along-wall snap of (3.4 - LEN/2) = 2.5 keeps it clear of the
    //     corner item (x 0.05 → 2.1) placed last.
    await placeAt(page, 3.4, 0.6);
    // 2 — near the RIGHT wall → rotation 90 (faces left), flush right.
    await placeAt(page, 4.5, 2.4);
    // 3 — near the BOTTOM wall → rotation 180 (faces up), flush bottom.
    await placeAt(page, 2.5, 3.5);
    // 4 — mid-room → default facing 0, plain grid snap, no wall pull.
    await placeAt(page, 2.5, 2.0);
    // 5 — near the LEFT wall → rotation 270 (faces right), flush left.
    await placeAt(page, 0.5, 2.4);
    // 6 — near the TOP-LEFT CORNER → flush on BOTH faces at once. The top
    //     wall is the closer one (0.55 vs 0.7), so it decides the facing.
    await placeAt(page, 0.7, 0.55);

    await expect(page.locator('[data-testid="items-placed"]')).toHaveText('6');

    const items = await storedItems(page);
    expect(items).toHaveLength(6);
    const [top, right, bottom, mid, left, corner] = items;

    // Top wall: back on the inner face (y = 0.05), grid-snapped along x.
    expect(top.rotation).toBe(0);
    expect(top.y).toBeCloseTo(WALL_HALF_M, 5);
    expect(top.x).toBeCloseTo(2.5, 5);

    // Right wall: at 90 deg the footprint is WID wide; flush → x = 5 - 0.05 - WID.
    expect(right.rotation).toBe(90);
    expect(right.x).toBeCloseTo(ROOM_W - WALL_HALF_M - WID, 5);
    expect(right.y).toBeCloseTo(1.5, 5);

    // Bottom wall: flush → y = 4 - 0.05 - WID.
    expect(bottom.rotation).toBe(180);
    expect(bottom.y).toBeCloseTo(ROOM_H - WALL_HALF_M - WID, 5);
    expect(bottom.x).toBeCloseTo(1.5, 5);

    // Mid-room: plain 0.5 m grid snap of (2.5 - LEN/2, 2.0 - WID/2), no wall pull.
    expect(mid.rotation).toBe(0);
    expect(mid.x).toBeCloseTo(1.5, 5);
    expect(mid.y).toBeCloseTo(1.5, 5);

    // Left wall: at 270 deg the footprint is WID wide; flush → x = 0.05.
    expect(left.rotation).toBe(270);
    expect(left.x).toBeCloseTo(WALL_HALF_M, 5);
    expect(left.y).toBeCloseTo(1.5, 5);

    // Corner: touches the top face AND the left face — the two-wall snap
    // that used to be reachable only when the grid happened to line up.
    expect(corner.rotation).toBe(0);
    expect(corner.x).toBeCloseTo(WALL_HALF_M, 5);
    expect(corner.y).toBeCloseTo(WALL_HALF_M, 5);

    // Nothing may sit inside the wall band or outside the room.
    for (const it of items) {
      expect(it.x).toBeGreaterThanOrEqual(WALL_HALF_M - 1e-6);
      expect(it.y).toBeGreaterThanOrEqual(WALL_HALF_M - 1e-6);
      const w = it.rotation % 180 === 0 ? LEN : WID;
      const h = it.rotation % 180 === 0 ? WID : LEN;
      expect(it.x + w).toBeLessThanOrEqual(ROOM_W - WALL_HALF_M + 1e-6);
      expect(it.y + h).toBeLessThanOrEqual(ROOM_H - WALL_HALF_M + 1e-6);
    }

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

    const card = page.locator(`[data-product-id="${PRODUCT_ID}"]`).first();
    await card.click();
    await expect(page.locator('[data-armed="true"]')).toHaveCount(2);
    // Origin read AFTER arming — the same "re-read before every click
    // sequence" rule `placeAt` above already follows, and for the same
    // reason: the auto-centre effect runs a frame or more AFTER the room
    // polygon first paints. Reading it immediately after
    // `start-quick-rectangle` catches the room at its UN-CENTRED position
    // (origin ~{5, 61} instead of ~{711, 327}) whenever the machine is
    // busy — reproducible with 2+ prior page loads in the same browser,
    // which is exactly what happens when this file runs alongside others.
    //
    // This was a latent bug in the test, not the app: it reproduces
    // identically on the pre-2026-08-26 build. It stayed invisible because
    // the old placement path fed EVERY click through the active room's
    // polygon, so `findFreeSlot` silently rescued the out-of-room point and
    // dumped the item at the room's top-left corner — which happens to
    // satisfy a "flush on the top wall" assertion. Attached multi-room
    // routes a drop to the room actually under the pointer (and since the
    // Sims world, an off-room drop lands OUTDOORS), so the stale origin now
    // surfaces instead of being papered over. With the origin read here,
    // `y = 0.05` verifies a real WALL SNAP (the item lands at x = 1.5,
    // positioned by the click) rather than a corner dump at x = 0.
    const origin = await roomOrigin(page);

    // Rotate twice (90 deg per press → 180) then drop near the TOP wall:
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
    // Flush on the top wall's INNER FACE, at the click's along-wall snap.
    expect(items[0].y).toBeCloseTo(WALL_HALF_M, 5);
    expect(items[0].x).toBeCloseTo(1.5, 5);
  });
});
