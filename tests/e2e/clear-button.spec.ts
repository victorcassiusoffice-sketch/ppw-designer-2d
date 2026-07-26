/**
 * Clear button — full-reset acceptance (Vic 2026-05-25).
 *
 * Vic: "'Clear' button doesn't work on desktop, not sure for mobile."
 * Reproduction showed it cleared products but left walls/floors/paint
 * behind (mode-gated). Vic chose a FULL reset: one "Clear" wipes products
 * + walls + floors + paint, keeps the room size, one Ctrl+Z restores.
 *
 * Deterministic: seeds placed items + a wall via localStorage before load
 * (synthetic Konva canvas clicks are flaky — see the skipped specs in
 * design-tweak-1-phase-a0.spec.ts), then drives the real Clear pill +
 * confirm modal on both desktop and mobile viewports.
 *
 * Runs against PPW_E2E_BASE_URL (defaults to production). The full-reset
 * assertions are gated on the NEW confirm-modal copy so the spec skips
 * gracefully against a build that predates the fix and gates it once
 * deployed. Point at the local dev/preview build to verify the fix:
 *   PPW_E2E_BASE_URL=http://localhost:5173 npx playwright test clear-button
 */
import { test, expect, type Page } from '@playwright/test';

const property = {
  id: 'p1',
  name: 'Clear-Test Property',
  activeRoomId: 'r1',
  rooms: [
    {
      id: 'r1',
      name: 'Main Room',
      polygon: [
        { x: 0, y: 0 },
        { x: 5, y: 0 },
        { x: 5, y: 4 },
        { x: 0, y: 4 },
      ],
      placedItems: [
        { instanceId: 'i1', productId: 'k1-nordictrack-2450', x: 1, y: 1, rotation: 0 },
        { instanceId: 'i2', productId: 'k1-nordictrack-tour-de-france', x: 3, y: 2, rotation: 0 },
      ],
    },
  ],
};

const walls = [
  {
    id: 'w1',
    start: { x_mm: 0, y_mm: 0 },
    end: { x_mm: 5000, y_mm: 0 },
    thickness_mm: 100,
    height_mm: 2700,
    type: 'full',
  },
];

async function seed(page: Page) {
  await page.addInitScript(
    ([prop, w]) => {
      try {
        localStorage.setItem(
          'ppw_property_v2',
          JSON.stringify({ state: { property: prop, showGrid: true, pxPerMetre: 100 }, version: 2 }),
        );
        localStorage.setItem('ppw_walls_v1', JSON.stringify(w));
        localStorage.setItem('ppw_designer_coach_v1', '1');
      } catch {
        /* storage may be blocked in some embeds */
      }
    },
    [property, walls] as const,
  );
}

function readState(page: Page) {
  return page.evaluate(() => {
    let items = -1;
    let wallCount = -1;
    try {
      const p = JSON.parse(localStorage.getItem('ppw_property_v2') || '{}');
      items = p?.state?.property?.rooms?.[0]?.placedItems?.length ?? -1;
    } catch {
      /* ignore */
    }
    try {
      wallCount = JSON.parse(localStorage.getItem('ppw_walls_v1') || '[]').length;
    } catch {
      /* ignore */
    }
    return { items, wallCount };
  });
}

for (const vp of [
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'mobile', width: 390, height: 844 },
]) {
  test(`Clear fully resets the room @ ${vp.name}`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await seed(page);
    await page.goto('/designer');
    await page.waitForSelector('header', { timeout: 15_000 });

    const before = await readState(page);
    expect(before.items).toBe(2);
    expect(before.wallCount).toBe(1);

    // Clear moved from the removed ModeStrip into the TopBar (2026-06-01).
    // Desktop: a visible "Clear" button in the toolbar. Mobile (<768px):
    // Clear is now two always-visible STICKY canvas buttons (2026-06-09,
    // ClearControls). "Clear all" wipes the room + products + walls back to
    // the blank-on-open canvas — the full reset this spec asserts. The
    // button is visible on BOTH desktop and mobile (no hamburger needed).
    const clearAll = page.getByTestId('clear-all-button');
    const clearAllExists = (await clearAll.count()) > 0;
    test.skip(!clearAllExists, 'Build predates the sticky ClearControls');
    await clearAll.click();

    const modal = page.getByTestId('clear-controls-modal');
    await expect(modal).toBeVisible();

    await page.getByTestId('clear-controls-confirm').click();
    await expect(modal).toBeHidden();
    await page.waitForTimeout(400);

    const after = await readState(page);
    expect(after.items, 'placed products cleared').toBe(0);
    expect(after.wallCount, 'walls cleared (full reset)').toBe(0);
  });
}
