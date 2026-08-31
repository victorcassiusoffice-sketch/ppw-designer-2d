/**
 * Doors on TOUCH (390 px phone) — pins for the two P0s in
 * docs/sims-world-2026-08-29/doors-2026-08-31/00-FINDINGS.md:
 *
 *  1. A real tap used to fire `commitDoorAt` 4× (Konva onTap + onClick, each
 *     doubled by the browser's compat mouse events); commits 2/4 hit the
 *     REMOVE branch on the opening just placed, so every tap toasted
 *     "Door added" then "Opening removed" and the store stayed EMPTY.
 *     The pin here is EXACTLY ONE stored door after a settled tap.
 *  2. Below md there was NO door tool at all (md:-only rail + sub-bar, no
 *     sheet row). The pin is the menu sheet's Door row arming the tool and
 *     the on-canvas HUD card carrying the kind/flip/Done chips.
 *
 * Coordination contract (testids only): TopBar owns `door-toggle-mobile`
 * (the sheet row, D3); RoomCanvas owns the phone HUD card —
 *   door-hud · door-kind-mobile-door|doorway|window ·
 *   door-flip-facing-mobile · door-flip-hand-mobile · door-done-mobile
 * — all reading the SAME designerUIStore doorDraft as the desktop sub-bar.
 *
 * Needs the DEV geometry bridge:
 *   PPW_E2E_BASE_URL=http://127.0.0.1:5188 npx playwright test door-touch
 */
import { test, expect, type Page } from '@playwright/test';
import { GEOM_BRIDGE_SKIP } from './multiroom-helpers';
import {
  oneRoomFixture,
  seedSimsProperty,
  requireGeomBridgeGenerous,
  waitForGeom,
  screenAt,
  assertOnStage,
} from './sims-world-helpers';
import { DEFAULT_WINDOW_WIDTH_M } from '../../src/designer/openings';

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

interface StoredOpening {
  id: string;
  edgeIndex: number;
  offsetM: number;
  widthM: number;
  kind: 'door' | 'doorway' | 'window';
}

/** Openings persisted on room `id`, straight out of localStorage. */
async function openingsOf(page: Page, roomId: string): Promise<StoredOpening[]> {
  return page.evaluate((id) => {
    const raw = localStorage.getItem('ppw_property_v2');
    if (!raw) return [];
    try {
      const env = JSON.parse(raw) as {
        state?: { property?: { rooms?: Array<{ id: string; openings?: unknown[] }> } };
      };
      const room = env.state?.property?.rooms?.find((r) => r.id === id);
      return (room?.openings ?? []) as never;
    } catch {
      return [];
    }
  }, roomId);
}

/** Open the phone menu sheet and tap its Door row; the sheet must close. */
async function armDoorFromSheet(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Open menu' }).tap();
  const row = page.getByTestId('door-toggle-mobile');
  await expect(row, 'the menu sheet must carry a Door row (P0: no door tool below md)').toBeVisible();
  await expect(row).toHaveAttribute('aria-pressed', 'false');
  await row.tap();
  await expect(page.locator('#ppw-sheet')).toHaveCount(0);
  // Let the arm-time canvas re-fit settle so tap coordinates read after this
  // are mapped through the LIVE transform (findings item 3).
  await page.waitForTimeout(1100);
}

test.describe('Door tool on a 390 px touch phone', () => {
  test.beforeEach(async ({ page }) => {
    await seedSimsProperty(page, oneRoomFixture());
    await page.goto('/designer');
    await page.waitForSelector('.konvajs-content canvas', { state: 'attached' });
    test.skip(!(await requireGeomBridgeGenerous(page)), GEOM_BRIDGE_SKIP);
    await waitForGeom(page);
  });

  test('the sheet Door row arms; ONE tap places EXACTLY one door; tapping it again removes it', async ({
    page,
  }) => {
    await armDoorFromSheet(page);

    // Tap the middle of the bottom wall (world y = 4 on the 5 × 4 room).
    const pt = await screenAt(page, 2.5, 4);
    await assertOnStage(page, pt, 'bottom wall midpoint');
    await page.touchscreen.tap(pt.x, pt.y);

    // Let every event of the gesture (touch + any synthetic mouse compat
    // events) drain, THEN count. The old bug placed and immediately removed:
    // net ZERO. One and only one door may exist.
    await page.waitForTimeout(700);
    const after = await openingsOf(page, 'r1');
    expect(
      after.length,
      'a single tap must net EXACTLY one stored door — 0 means the duplicate commit '
        + 'hit the remove branch on its own placement (P0, findings item 1); '
        + '2+ means the dedupe is gone the other way',
    ).toBe(1);
    expect(after[0].kind).toBe('door');

    // A deliberate second tap on the placed door is a REMOVE.
    const centre = await screenAt(page, 2.5, 4);
    await page.touchscreen.tap(centre.x, centre.y);
    await page.waitForTimeout(700);
    expect(
      (await openingsOf(page, 'r1')).length,
      'tapping an existing door must remove it (and only it)',
    ).toBe(0);
  });

  test('the HUD chips are reachable at 390 and the Window chip taps a 1.2 m window', async ({
    page,
  }) => {
    await armDoorFromSheet(page);

    // The on-canvas HUD card is the phone home of the kind/flip controls.
    const hud = page.getByTestId('door-hud');
    await expect(hud, 'the door HUD card must mount while the tool is armed').toBeVisible();

    const chipIds = [
      'door-kind-mobile-door',
      'door-kind-mobile-doorway',
      'door-kind-mobile-window',
      'door-flip-facing-mobile',
      'door-flip-hand-mobile',
      'door-done-mobile',
    ];
    for (const id of chipIds) {
      const chip = page.getByTestId(id);
      await expect(chip, `${id} must be visible on the HUD`).toBeVisible();
      const box = (await chip.boundingBox())!;
      expect(box.height, `${id} must be a >= 44 px phone target`).toBeGreaterThanOrEqual(40);
      expect(box.x, `${id} must not hang off the left edge`).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width, `${id} must not hang off the right edge`).toBeLessThanOrEqual(390);
    }

    // Window via the HUD chip → a 1.2 m window in the store (defect 8 through
    // the SHARED doorDraft, not just the desktop sub-bar).
    await page.getByTestId('door-kind-mobile-window').tap();
    const pt = await screenAt(page, 2.5, 4);
    await page.touchscreen.tap(pt.x, pt.y);
    await page.waitForTimeout(700);
    const openings = await openingsOf(page, 'r1');
    expect(openings.length).toBe(1);
    expect(openings[0].kind).toBe('window');
    expect(openings[0].widthM).toBeCloseTo(DEFAULT_WINDOW_WIDTH_M, 6);

    // Done puts the tool away and unmounts the card.
    await page.getByTestId('door-done-mobile').tap();
    await expect(hud).toHaveCount(0);
  });
});
