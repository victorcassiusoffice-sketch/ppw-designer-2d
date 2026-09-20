/**
 * Designer 3-Bug Fix — real-phone regressions (Vic 2026-05-28).
 *
 * Three bugs found on Vic's iPhone against the In-Room Render Fix build:
 *   1. Long-press on a product/canvas popped the native "Save image" menu
 *      and hijacked drag-drop.
 *   2. Items refused to fit a room with plenty of space (every mobile
 *      "+ Add to room" tap stacked at the same room centre → collision).
 *   3. "Clear" emptied the item state but the Konva canvas kept rendering
 *      the items (layer never repainted on empty).
 *
 * Deterministic: seeds state via localStorage (synthetic Konva canvas
 * clicks are flaky). Runs against PPW_E2E_BASE_URL (defaults to prod):
 *   PPW_E2E_BASE_URL=http://localhost:5173 npx playwright test designer-3bug-fix
 * Each test skips gracefully against a build that predates the fix.
 */
import { test, expect, type Page } from '@playwright/test';

const roomPolygon = [
  { x: 0, y: 0 },
  { x: 5, y: 0 },
  { x: 5, y: 4 },
  { x: 0, y: 4 },
];

async function seedProperty(page: Page, placedItems: unknown[]) {
  await page.addInitScript(
    ([poly, items]) => {
      try {
        localStorage.setItem(
          'ppw_property_v2',
          JSON.stringify({
            state: {
              property: {
                id: 'p1',
                name: '3Bug-Test',
                activeRoomId: 'r1',
                rooms: [{ id: 'r1', name: 'Main', polygon: poly, placedItems: items }],
              },
              showGrid: true,
              pxPerMetre: 100,
            },
            version: 2,
          }),
        );
        localStorage.setItem('ppw_designer_coach_v1', '1');
      } catch {
        /* storage may be blocked in some embeds */
      }
    },
    [roomPolygon, placedItems] as const,
  );
}

/** Opaque-pixel count of the placed-items Konva layer (the 2nd canvas). */
function itemsLayerPixels(page: Page) {
  return page.evaluate(() => {
    const canvases = Array.from(document.querySelectorAll('canvas'));
    const c = canvases[1];
    if (!c) return -1;
    const ctx = c.getContext('2d');
    if (!ctx) return -1;
    const data = ctx.getImageData(0, 0, c.width, c.height).data;
    let opaque = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i] > 10) opaque++;
    return opaque;
  });
}

test('Bug 3 — Clear repaints the canvas (no ghost items)', async ({ page }) => {
  await seedProperty(page, [
    { instanceId: 'i1', productId: 'k1-nordictrack-2450', x: 1, y: 1, rotation: 0 },
    { instanceId: 'i2', productId: 'k1-nordictrack-tour-de-france', x: 3, y: 2, rotation: 0 },
  ]);
  await page.goto('/designer');
  await page.waitForSelector('header', { timeout: 15_000 });

  await expect(page.getByTestId('items-placed')).toHaveText('2');
  // Items must actually be painted on the layer canvas before we clear.
  await expect.poll(() => itemsLayerPixels(page)).toBeGreaterThan(0);

  // Clear moved to the canvas sticky ClearControls (2026-06-09) — "Clear
  // all" wipes products + room and is always visible.
  const clearBtn = page.getByTestId('clear-all-button');
  test.skip(
    !(await clearBtn.isVisible({ timeout: 5000 }).catch(() => false)),
    'Clear button not present in this build',
  );
  await clearBtn.click();
  await page.getByTestId('clear-controls-confirm').click();

  await expect(page.getByTestId('items-placed')).toHaveText('0');
  // The regression: state cleared but canvas still showed pixels. After the
  // fix the placed-items layer repaints empty.
  await expect.poll(() => itemsLayerPixels(page)).toBe(0);
});

// Phone pass 2026-09-16 + P3 2026-09-20: the strip opens FOLDED to its
// category row and the popup answers real pointer events (it used to close
// itself on the tap's own compatibility click). Synthetic `dispatchEvent`
// taps no longer reach it, so this test drives the phone the way a thumb
// does — a real category tap, a real thumbnail tap, a real "+ Add to room".
test.describe('Bug 2 — two "+ Add to room" taps both land (no false "won\'t fit")', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  test('both items land inside the room, at different spots', async ({ page }) => {
    await seedProperty(page, []);
    await page.goto('/designer?demo=off');
    await page.waitForSelector('header', { timeout: 15_000 });

    const toolbar = page.getByTestId('sims-bottom-toolbar');
    test.skip(
      !(await toolbar.isVisible({ timeout: 5000 }).catch(() => false)),
      'Sims mobile toolbar not present in this build',
    );

    const placed = () =>
      page.evaluate(() => {
        try {
          return (JSON.parse(localStorage.getItem('ppw_property_v2') || '{}')?.state?.property?.rooms?.[0]?.placedItems ?? []) as Array<{ x: number; y: number }>;
        } catch {
          return [] as Array<{ x: number; y: number }>;
        }
      });
    const addOnce = async () => {
      if ((await page.locator('[data-testid="sims-thumb-strip"]').count()) === 0) await page.locator('[data-testid="sims-cat-cardio"]').tap();
      await expect(page.locator('[data-testid="sims-thumb-strip"]')).toBeVisible();
      // By id on dev, by NAME on a deployed build (there /api/products returns
      // this SKU under a merchant id and mergeCatalog drops the bundled twin).
      const thumbs = page.locator('[data-testid="sims-thumb"]:visible');
      const byId = thumbs.filter({ has: page.locator('[data-product-id="k1-nordictrack-tour-de-france"]') });
      const thumb = (await byId.count()) ? byId.first() : thumbs.first();
      await thumb.tap();
      await expect(page.locator('[data-testid="mobile-product-popup"]')).toBeVisible();
      await page.locator('[data-testid="popup-add-to-room"]').tap();
      await expect(page.locator('[data-testid="mobile-product-popup"]')).toHaveCount(0);
    };
    await addOnce();
    await expect.poll(async () => (await placed()).length).toBe(1);
    await addOnce();
    await expect.poll(async () => (await placed()).length).toBe(2);
    const result = { items: await placed(), count: 2 };
    // Not stacked at the same spot — the bug was every tap landing at the room centre and colliding.
    expect(result.items[0].x !== result.items[1].x || result.items[0].y !== result.items[1].y).toBe(true);
    // Both items inside the 5×4 m room.
    for (const it of result.items) {
      expect(it.x).toBeGreaterThanOrEqual(0);
      expect(it.y).toBeGreaterThanOrEqual(0);
      expect(it.x).toBeLessThanOrEqual(5);
      expect(it.y).toBeLessThanOrEqual(4);
    }
  });
});

test('Bug 1 — long-press context menu is suppressed on canvas + catalog tile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seedProperty(page, [{ instanceId: 'i1', productId: 'k1-nordictrack-2450', x: 1, y: 1, rotation: 0 }]);
  await page.goto('/designer');
  await page.waitForSelector('header', { timeout: 15_000 });

  const res = await page.evaluate(() => {
    const out: Record<string, boolean | string> = {};
    const canvas = document.querySelector('.konva-stage canvas');
    if (canvas) {
      const ev = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
      canvas.dispatchEvent(ev);
      out.canvasPrevented = ev.defaultPrevented;
    } else {
      out.canvasPrevented = 'no-canvas';
    }
    const thumb = document.querySelector('[data-testid="sims-thumb"]');
    if (thumb) {
      const ev = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
      thumb.dispatchEvent(ev);
      out.thumbPrevented = ev.defaultPrevented;
    } else {
      out.thumbPrevented = 'no-thumb';
    }
    return out;
  });

  expect(res.canvasPrevented).toBe(true);
  // Thumb is mobile-only; assert when present, else it's not a target here.
  if (res.thumbPrevented !== 'no-thumb') expect(res.thumbPrevented).toBe(true);
});
