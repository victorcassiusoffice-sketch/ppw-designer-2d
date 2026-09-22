/**
 * Wall height after the walls exist — a raise/lower on the plan and in 3D,
 * the same store field as the paint panel (`wallpaint-height`).
 */
import { test, expect, type Page } from '@playwright/test';

const ROOM = {
  id: 'r1',
  name: 'Room 1',
  polygon: [
    { x: 0, y: 0 },
    { x: 5, y: 0 },
    { x: 5, y: 4 },
    { x: 0, y: 4 },
  ],
  openings: [],
  placedItems: [] as unknown[],
};

async function seed(page: Page, wallHeightM = 2.7, rooms = [ROOM]): Promise<void> {
  await page.addInitScript(
    ({ p }) => {
      if (localStorage.getItem('__ppw_seeded') === '1') return;
      localStorage.clear();
      localStorage.setItem('__ppw_seeded', '1');
      localStorage.setItem('ppw_designer_coach_v1', '1');
      localStorage.setItem(
        'ppw_property_v2',
        JSON.stringify({ state: { property: p, showGrid: true, pxPerMetre: 100 }, version: 2 }),
      );
    },
    { p: { id: 'p', name: 'Vic', activeRoomId: rooms[0]?.id ?? 'r1', rooms, wallHeightM } },
  );
}

async function storedHeight(page: Page): Promise<number> {
  return page.evaluate(() => {
    const raw = localStorage.getItem('ppw_property_v2');
    return raw ? JSON.parse(raw).state.property.wallHeightM : null;
  });
}

test.describe('Wall height on the plan', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('raise and lower without opening paint, and the paint field stays in step', async ({ page }) => {
    await seed(page);
    await page.goto('/designer');
    await page.waitForSelector('.konvajs-content canvas', { state: 'attached' });

    const hud = page.locator('[data-testid="wall-height-hud"]');
    await expect(hud).toBeVisible();
    await expect(hud).toHaveAttribute('data-placement', 'left');
    await expect(page.locator('[data-testid="wall-height-hud-label"]')).toBeVisible();
    await expect(page.locator('[data-testid="wall-height-readout"]')).toHaveText('2.7 m');
    await expect(page.locator('[data-testid="wallpaint-palette"]')).toHaveCount(0);

    await page.locator('[data-testid="wall-height-up"]').click();
    await expect(page.locator('[data-testid="wall-height-readout"]')).toHaveText('2.8 m');
    await expect.poll(() => storedHeight(page)).toBe(2.8);

    await page.locator('[data-testid="wallpaint-tool-toggle"]').click();
    await expect(page.locator('[data-testid="wallpaint-height"]')).toHaveValue('2.8');
    await page.locator('[data-testid="wallpaint-height"]').fill('3');
    await expect(page.locator('[data-testid="wall-height-readout"]')).toHaveText('3 m');

    await page.locator('[data-testid="view-mode-3d"]').click();
    await expect(page.locator('[data-testid="view3d-wall-height-readout"]')).toHaveText('3 m');
    await page.locator('[data-testid="view3d-wall-height-up"]').click();
    await expect(page.locator('[data-testid="view3d-wall-height-readout"]')).toHaveText('3.1 m');
    await expect.poll(() => storedHeight(page)).toBe(3.1);
    await page.locator('[data-testid="wallpaint-3d-close"]').click();
    await expect(page.locator('[data-testid="wallpaint-height"]')).toHaveValue('3.1');
  });

  test('a blank plan has no height card', async ({ page }) => {
    await seed(page, 2.7, [{ ...ROOM, polygon: [] }]);
    await page.goto('/designer');
    await page.waitForSelector('.konvajs-content canvas', { state: 'attached' });
    await expect(page.locator('[data-testid="wall-height-hud"]')).toHaveCount(0);
  });
});

test.describe('Wall height on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('a slim bar docks left and +/− steps 0.1 m', async ({ page }) => {
    await seed(page);
    await page.goto('/designer');
    await page.waitForSelector('.konvajs-content canvas', { state: 'attached' });
    const hud = page.locator('[data-testid="wall-height-hud"]');
    await expect(hud).toBeVisible();
    await expect(page.locator('[data-testid="wall-height-hud-label"]')).toBeHidden();
    const place = await page.evaluate(() => {
      const card = document.querySelector('[data-testid="wall-height-hud"]') as HTMLElement;
      const bar = document.querySelector('[data-testid="sims-bottom-toolbar"]')!.getBoundingClientRect();
      const r = card.getBoundingClientRect();
      return {
        placement: card.getAttribute('data-placement'),
        leftish: r.left < window.innerWidth * 0.45,
        clearsBottom: r.bottom < bar.top - 24,
        // Flush to the screen edge, a small vertical rail — not a floating card.
        flush: r.left < 2,
        narrow: r.width < 56,
        compact: r.height < 140,
      };
    });
    expect(place.placement).toBe('left');
    expect(place.leftish).toBe(true);
    expect(place.clearsBottom).toBe(true);
    expect(place.flush).toBe(true);
    expect(place.narrow).toBe(true);
    expect(place.compact).toBe(true);

    await page.locator('[data-testid="wall-height-up"]').tap();
    await expect(page.locator('[data-testid="wall-height-readout"]')).toHaveText('2.8 m');
    await expect.poll(() => storedHeight(page)).toBe(2.8);
    await page.locator('[data-testid="wall-height-down"]').tap();
    await expect(page.locator('[data-testid="wall-height-readout"]')).toHaveText('2.7 m');
    await expect.poll(() => storedHeight(page)).toBe(2.7);
  });
});
