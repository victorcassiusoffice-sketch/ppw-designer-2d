/**
 * Mobile Sims rebuild — Phase 6 E2E (Phases 2-4 surface).
 *
 * Runs at a 390×844 mobile viewport against the deploy under test
 * (PPW_E2E_BASE_URL, default prod). The Sims toolbar ships on the
 * feat/mobile-sims-engine-unify branch; until it's live each spec
 * `test.skip()`s cleanly when the toolbar isn't in the build, so the
 * suite stays green against the current prod — matching the repo's
 * pre-merge skip convention (see wellness-designer-app-phase-a.spec.ts).
 *
 * Run:
 *   PPW_E2E_BASE_URL=<preview-url> npx playwright test tests/e2e/mobile-sims-toolbar.spec.ts
 */
import { test, expect, type Page } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

async function toolbarOrSkip(page: Page) {
  // Returning-user state: dismiss the first-visit onboarding overlays
  // (coach mark + mobile preview banner) so they don't intercept taps.
  // These specs verify the toolbar, not onboarding.
  await page.addInitScript(() => {
    window.localStorage.setItem('ppw_designer_coach_v1', '1');
    window.localStorage.setItem('ppw_mobile_banner_dismissed_v1', '1');
  });
  await page.goto('/designer');
  const toolbar = page.locator('[data-testid="sims-bottom-toolbar"]');
  if ((await toolbar.count()) === 0) {
    test.skip(true, 'Sims toolbar not in this build yet (pre-merge).');
  }
  await expect(toolbar).toBeVisible({ timeout: 15_000 });
  return toolbar;
}

test.describe('Mobile Sims toolbar', () => {
  test('M.S.1 — sticky toolbar is visible at the bottom on mobile', async ({ page }) => {
    const toolbar = await toolbarOrSkip(page);
    const box = await toolbar.boundingBox();
    expect(box).not.toBeNull();
    // Anchored to the bottom of the viewport.
    if (box) expect(box.y + box.height).toBeGreaterThan(844 - 4);
    // Product tabs HIDE while they are empty (verify pass 2026-09-07): the
    // wellness seed has no Furniture / Appliances products and a first-time
    // customer's natural first tap used to open a dead tab. A merchant range
    // brings them back. So the rendered set is read from the toolbar and
    // checked for the invariants rather than pinned to a fixed list. The tab
    // row scrolls horizontally at 390 px, so each tab is scrolled into view
    // before the visibility check rather than asserted at rest.
    const rendered = await page
      .locator('[data-testid^="sims-cat-"]')
      .evaluateAll((els) => els.map((el) => (el.getAttribute('data-testid') ?? '').replace('sims-cat-', '')));
    // Always-on (All + the two tool tabs) and every macro the seed populates.
    for (const must of ['all', 'flooring', 'walls', 'cardio', 'decor', 'lighting', 'outdoor', 'eco']) {
      expect(rendered, `the ${must} tab renders`).toContain(must);
    }
    // Empty in the wellness seed — a dead tab must not render.
    for (const empty of ['furniture', 'appliances']) {
      expect(rendered, `the empty ${empty} tab hides`).not.toContain(empty);
    }
    for (const cat of rendered) {
      const tab = page.locator(`[data-testid="sims-cat-${cat}"]`);
      await tab.scrollIntoViewIfNeeded();
      await expect(tab).toBeVisible();
    }
  });

  test('M.S.2 — tap a thumbnail opens the product popup, "+" places it', async ({ page }) => {
    await toolbarOrSkip(page);
    // The designer opens on a BLANK canvas (416080c, 2026-06-09): there is no
    // room until the user makes one, and "+ Add to room" then correctly
    // refuses to place outside the plan. Lay the starter room so this spec
    // still pins what it was written to pin - that "+" PLACES.
    await page.locator('[data-testid="start-quick-rectangle"]').click();
    await expect(page.locator('[data-testid="start-room-prompt"]')).toBeHidden();
    const placedBefore = Number((await page.locator('[data-testid="items-placed"]').first().textContent()) ?? '0');
    await page.locator('[data-testid="sims-thumb"]').first().click();
    const popup = page.locator('[data-testid="mobile-product-popup"]');
    await expect(popup).toBeVisible();
    await expect(page.locator('[data-testid="popup-add-to-room"]')).toBeVisible();
    await page.locator('[data-testid="popup-add-to-room"]').click();
    await expect(popup).toBeHidden();
    await expect
      .poll(async () =>
        Number((await page.locator('[data-testid="items-placed"]').first().textContent()) ?? '0'),
      )
      .toBe(placedBefore + 1);
  });

  test('M.S.3 — minimize chevron collapses the thumbnail strip', async ({ page }) => {
    await toolbarOrSkip(page);
    // A blank plan opens with the wall pen armed (2026-09-08) and the strip
    // auto-folds for it. Lay the starter room — which puts the pen away —
    // so this spec pins what it was written to pin: the CHEVRON.
    await page.locator('[data-testid="start-quick-rectangle"]').click();
    await expect(page.locator('[data-testid="sims-thumb-strip"]')).toBeVisible();
    const minBtn = page.locator('[data-testid="sims-toolbar-minimize"]');
    await expect(minBtn).toHaveAttribute('aria-expanded', 'true');
    await minBtn.click();
    await expect(page.locator('[data-testid="sims-thumb-strip"]')).toBeHidden();
    await expect(minBtn).toHaveAttribute('aria-expanded', 'false');
  });

  test('M.S.4 — Cancel in the popup closes without placing', async ({ page }) => {
    await toolbarOrSkip(page);
    // Same as M.S.3: put the auto-armed pen away first (2026-09-08).
    await page.locator('[data-testid="start-quick-rectangle"]').click();
    const placedBefore = Number((await page.locator('[data-testid="items-placed"]').first().textContent()) ?? '0');
    await page.locator('[data-testid="sims-thumb"]').first().click();
    const popup = page.locator('[data-testid="mobile-product-popup"]');
    await expect(popup).toBeVisible();
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(popup).toBeHidden();
    const placedAfter = Number((await page.locator('[data-testid="items-placed"]').first().textContent()) ?? '0');
    expect(placedAfter).toBe(placedBefore);
  });
});
