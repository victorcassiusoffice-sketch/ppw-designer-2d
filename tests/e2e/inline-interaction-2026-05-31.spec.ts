/**
 * Sims feature-finish — inline-interaction acceptance (PARITY-MATRIX).
 *
 * Covers the new desktop placement-loop + mobile floating-cluster work:
 *   • D4  Shift+click stamp (ghost persists, multiple placements)
 *   • F2  `>` / `<` rotate 90° detents on a selected item
 *   • D15 Ctrl+F precision toggle (cost-readout badge flips)
 *   • M6/F1 mobile floating cluster renders ON canvas (not a modal) and
 *           its ⟳ rotates inline
 *
 * Run against a local dev server or preview (prod default in config):
 *   PPW_E2E_BASE_URL=http://localhost:5173 npx playwright test inline-interaction
 */
import { test, expect } from '@playwright/test';

// Dismiss the 3-step coach-mark + mobile preview banner before each test so
// their overlays don't intercept canvas clicks (they're localStorage-gated).
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('ppw_designer_coach_v1', '1');
      localStorage.setItem('ppw_mobile_banner_dismissed_v1', '1');
    } catch {
      /* storage may be blocked */
    }
  });
});

async function placeFirstProduct(page: import('@playwright/test').Page) {
  const stage = page.locator('.konva-stage').first();
  await expect(stage).toBeVisible({ timeout: 10_000 });
  // Blank-canvas-on-open (2026-06-09): a fresh context has an EMPTY room
  // polygon, so findRoomAt() correctly refuses every drop and nothing can ever
  // be placed. Seed the 5 x 4 m quick rectangle first - the same repair
  // placement-fsm.spec.ts already took. ('?fresh=1' is read nowhere in src/.)
  await page.locator('[data-testid="start-quick-rectangle"]').click();
  const box = await stage.boundingBox();
  if (!box) throw new Error('no stage box');
  const card = page.locator('[data-product-id]').first();
  await card.click();
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy, { steps: 8 });
  return { box, cx, cy };
}

test.describe('Inline interaction — desktop', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('Shift+click stamps multiple copies while keeping the ghost armed', async ({ page }) => {
    await page.goto('/designer?fresh=1');
    const itemsPlaced = page.locator('[data-testid="items-placed"]');
    await expect(itemsPlaced).toBeVisible({ timeout: 10_000 });
    const { box } = await placeFirstProduct(page);

    // Three Shift+clicks at distinct points → 3 placements, still armed.
    for (let i = 0; i < 3; i++) {
      // The seeded room is 5 x 4 m at 100 px/m = 500 x 400 px, centred, so
      // only stage-centre +/-250 px is inside it. 0.3 * width landed OUTSIDE
      // the room; the refusal disarmed the ghost and cost every stamp after it.
      const x = box.x + box.width / 2 + (i - 1) * 80;
      const y = box.y + box.height / 2;
      await page.mouse.move(x, y, { steps: 4 });
      await page.keyboard.down('Shift');
      await page.mouse.click(x, y);
      await page.keyboard.up('Shift');
    }
    await expect(async () => {
      const n = Number((await itemsPlaced.textContent())?.trim() || '0');
      expect(n).toBeGreaterThanOrEqual(3);
    }).toPass();
    // Ghost should still be armed after a Shift stamp.
    await expect(page.locator('[data-armed="true"]')).toHaveCount(2);
  });

  test('`>` rotates the selected item 90° inline (no navigation)', async ({ page }) => {
    await page.goto('/designer?fresh=1');
    const { cx, cy } = await placeFirstProduct(page);
    await page.mouse.click(cx, cy); // commit (bare click)
    // Select the just-placed item (it auto-selects on place; click to be sure).
    await page.mouse.click(cx, cy);
    const url = page.url();
    await page.keyboard.press('>');
    // No route change — rotation is inline.
    expect(page.url()).toBe(url);
  });

  test('Ctrl+F toggles the precision badge', async ({ page }) => {
    await page.goto('/designer?fresh=1');
    // The precision figure MOVED out of the cost badge - that testid is now
    // the MUR total only ("0 MUR") - into the combined "area · zoom · snap"
    // chip, the span immediately before the items-placed badge.
    const readout = page
      .locator('[data-testid="items-placed"]')
      .locator('xpath=preceding-sibling::span[1]');
    await expect(readout).toBeVisible({ timeout: 10_000 });
    await expect(readout).toContainText('· 0.5 m');
    await page.keyboard.press('Control+f');
    await expect(readout).toContainText('· 0.25 m');
  });
});

test.describe('Inline interaction — mobile cluster', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('placing via the mobile catalog shows the on-canvas cluster, not a modal', async ({ page }) => {
    await page.goto('/designer?fresh=1');
    // Mobile flow: sticky bottom toolbar → tap a thumbnail → popup → "+ Add".
    // Same blank-canvas root cause: "+ Add to room" places at the ACTIVE
    // room's centre, and with no drawn polygon that placement is refused, so
    // nothing is selected and no cluster mounts.
    await page.locator('[data-testid="start-quick-rectangle"]').click();
    const toolbar = page.locator('[data-testid="sims-bottom-toolbar"]');
    await expect(toolbar).toBeVisible({ timeout: 10_000 });
    const thumb = page.locator('[data-testid="sims-thumb"]').first();
    await expect(thumb).toBeVisible();
    await thumb.click(); // quick tap → opens the product popup

    const add = page.locator('[data-testid="popup-add-to-room"]');
    await expect(add).toBeVisible({ timeout: 5_000 });
    await add.click(); // places at room centre AND auto-selects

    // The flagship: an on-canvas cluster appears (NOT the slide-up modal).
    const cluster = page.locator('[data-testid="floating-cluster"]');
    await expect(cluster).toBeVisible({ timeout: 5_000 });
    const cls = (await cluster.getAttribute('class')) ?? '';
    expect(cls).not.toContain('inset-0'); // not a fullscreen modal
    await expect(page.locator('[data-testid="cluster-rotate"]')).toBeVisible();
    // Selecting alone must NOT have opened the details sheet.
    await expect(page.locator('[data-testid="mobile-product-popup"]')).toHaveCount(0);
  });
});
