/**
 * Attached multi-room — P3 RENDER acceptance (Vic 2026-08-26).
 *
 * The single question this spec answers: does the canvas draw EVERY room,
 * or still just the active one? Every assertion is machine-checkable —
 * Konva text has no DOM, so label legibility is judged from the saved
 * screenshot in the handoff. That shot is evidence, not a gate.
 *
 * Run against a local dev server:
 *   PPW_E2E_BASE_URL=http://localhost:5187 npx playwright test multiroom-render
 */

import { test, expect } from '@playwright/test';
import {
  PX_PER_M,
  TWO_ROOM_FIXTURE,
  cloneFixture,
  collectRenderedCounts,
  goldSpanPx,
  seedProperty,
  waitForRenderedCount,
} from './multiroom-helpers';

/**
 * Union of the two-room fixture: x 0 → 9 m = 900 px at scale 1.
 *
 * `goldSpanPx` (the name is historical — it now scans for the CHARCOAL wall
 * ink of the 2026-08-29 paper theme via `ROOM_BORDER_SCAN`) measures between
 * the outermost ink pixels and trims `inset` (half the 0.1 m / 10 px wall
 * band) off each side, so the number it returns is wall-LINE to wall-line.
 * Verified 2026-08-29 at 898 px — the scan strides 2 px, so each end is
 * quantised by up to 1 px; well inside the tolerance below.
 */
const UNION_SPAN_PX = 9 * PX_PER_M;
/** A single-room render spans ~500 px, so this tolerance cannot pass one. */
const SPAN_TOLERANCE_PX = 12;

test.describe('Attached multi-room — render', () => {
  test.use({ viewport: { width: 1920, height: 1080 } });

  test('draws every room on one canvas', async ({ page }) => {
    // Listener BEFORE goto — the breadcrumb fires on mount.
    const rendered = collectRenderedCounts(page);

    const fixture = cloneFixture(TWO_ROOM_FIXTURE);
    fixture.rooms[0].placedItems = [
      { instanceId: 'seed-a', productId: 'k1-schwinn-700ic', x: 1, y: 1, rotation: 0 },
    ];
    fixture.rooms[1].placedItems = [
      { instanceId: 'seed-b', productId: 'k1-schwinn-700ic', x: 6, y: 1, rotation: 0 },
    ];
    await seedProperty(page, fixture);
    await page.goto('/designer');
    await page.waitForSelector('.konvajs-content canvas', { state: 'attached' });

    // 1 — MOUNTED Konva node count, not a store count. A store-side check
    //     would go green even if the canvas still rendered one room.
    await waitForRenderedCount(page, rendered, 2);
    expect(rendered).toContain(2);

    // 2 — wall-ink pixels must span the whole two-room union. One room
    //     spans ~500 px; both span 900.
    const span = await goldSpanPx(page);
    expect(span).not.toBeNull();
    expect(Math.abs((span as number) - UNION_SPAN_PX)).toBeLessThanOrEqual(SPAN_TOLERANCE_PX);

    // 3 — the badge aggregates across ALL rooms (1 seeded in each).
    await expect(page.locator('[data-testid="items-placed"]')).toHaveText('2');

    // 5 — evidence shot for the handoff.
    await page.screenshot({
      path: 'docs/multiroom-2026-08-26/after/render-two-rooms.png',
      fullPage: false,
    });

    console.log('MULTIROOM_RENDER=true', JSON.stringify({ spanPx: span }));
  });

  test('start prompt stays hidden when a BLANK room is active beside drawn rooms', async ({
    page,
  }) => {
    // 4 — the falsifiable variant. The OLD active-room-only `hasRoom` test
    //     ( polygon.length >= 3 on the ACTIVE room ) puts the start prompt
    //     over a two-room plan on exactly this payload; the new
    //     property-wide test hides it.
    const fixture = cloneFixture(TWO_ROOM_FIXTURE);
    fixture.rooms.push({ id: 'r3', name: 'Room 3', polygon: [], placedItems: [] });
    fixture.activeRoomId = 'r3';

    await seedProperty(page, fixture);
    await page.goto('/designer');
    await page.waitForSelector('.konvajs-content canvas', { state: 'attached' });
    // Settle: the prompt is a plain DOM node, so give React a beat to
    // mount it if the regression is present.
    await page.waitForTimeout(1200);

    await expect(page.locator('[data-testid="start-room-prompt"]')).toHaveCount(0);
    // The two drawn rooms are still on the canvas (wall-ink span, see above).
    const span = await goldSpanPx(page);
    expect(span).not.toBeNull();
    expect(Math.abs((span as number) - UNION_SPAN_PX)).toBeLessThanOrEqual(SPAN_TOLERANCE_PX);
  });
});
