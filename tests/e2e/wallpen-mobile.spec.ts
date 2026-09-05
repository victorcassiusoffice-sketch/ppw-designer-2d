/**
 * The wall pen on a phone (Vic 2026-09-05).
 *
 * "While still on the draw wall feature on the mobile version I needed to
 * zoom out and move over but the wall draw was still active and made me draw
 * random walls. When I pressed select tool i could not select the walls to
 * delete. Select toolbar should still be available on main screen rather than
 * only burger menu. Wall pen toolbar at the bottom has some space underneath,
 * all toolbar should minimise space to maximise canvas."
 *
 * Reproduced before the fix at 390 x 844 with real touch: a two-finger pinch
 * planted a vertex (0 -> 1 pts), a one-finger drag planted another (1 -> 2)
 * and did not move the view at all, a free wall could not be picked with
 * Select, there was no Select on the phone strip, and 68 px of dead band sat
 * under the pen card. Each is pinned below.
 *
 * Multi-touch needs raw CDP (`Input.dispatchTouchEvent`): Playwright's
 * `touchscreen` is single-point, so a pinch cannot be expressed with it.
 *
 * Run against a local dev server:
 *   PPW_E2E_BASE_URL=http://127.0.0.1:5188 npx playwright test wallpen-mobile
 */
import { test, expect, type CDPSession, type Page } from '@playwright/test';
import { GEOM_BRIDGE_SKIP } from './multiroom-helpers';
import {
  oneRoomFixture,
  requireGeomBridgeGenerous,
  seedSimsProperty,
  storedSimsProperty,
  waitForGeom,
} from './sims-world-helpers';

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

async function openPen(page: Page): Promise<{ cdp: CDPSession; cx: number; cy: number }> {
  await seedSimsProperty(page, oneRoomFixture());
  await page.goto('/designer');
  await page.waitForSelector('.konvajs-content canvas', { state: 'attached', timeout: 30_000 });
  if (!(await requireGeomBridgeGenerous(page))) test.skip(true, GEOM_BRIDGE_SKIP);
  await waitForGeom(page);
  await page.waitForTimeout(400);
  await page.locator('[data-testid="room-draw-toggle"]').click();
  await expect(page.locator('[data-testid="room-draw-hud"]')).toBeVisible();
  const cdp = await page.context().newCDPSession(page);
  const box = (await page.locator('.konvajs-content').boundingBox())!;
  return { cdp, cx: box.x + box.width / 2, cy: box.y + box.height / 2 };
}

async function touch(cdp: CDPSession, type: string, points: Array<{ x: number; y: number }>): Promise<void> {
  await cdp.send('Input.dispatchTouchEvent', {
    type: type as 'touchStart' | 'touchMove' | 'touchEnd',
    touchPoints: points.map((p, i) => ({ x: p.x, y: p.y, id: i, radiusX: 12, radiusY: 12, force: 1 })),
  });
}

const pts = (page: Page) => page.locator('[data-testid="room-draw-vertices-count"]').textContent();

const view = (page: Page) =>
  page.evaluate(() => {
    const K = (window as unknown as { Konva?: { stages: Array<{ container: () => HTMLElement; x: () => number; y: () => number; scaleX: () => number }> } }).Konva;
    const s = K?.stages?.find((st) => st.container().isConnected);
    return s ? { x: Math.round(s.x()), y: Math.round(s.y()), scale: Number(s.scaleX().toFixed(3)) } : null;
  });

test.describe('Wall pen — phone gestures', () => {
  test('1. a two-finger pinch zooms and plants NO vertex', async ({ page }) => {
    const { cdp, cx, cy } = await openPen(page);
    const before = await view(page);
    expect(await pts(page)).toContain('0');

    await touch(cdp, 'touchStart', [{ x: cx - 60, y: cy - 60 }, { x: cx + 60, y: cy + 60 }]);
    for (let i = 1; i <= 6; i++) {
      const d = 60 - i * 7;
      await touch(cdp, 'touchMove', [{ x: cx - d, y: cy - d }, { x: cx + d, y: cy + d }]);
      await page.waitForTimeout(30);
    }
    await touch(cdp, 'touchEnd', []);
    await page.waitForTimeout(300);

    const after = await view(page);
    expect(after!.scale, 'the pinch must actually zoom').toBeLessThan(before!.scale);
    expect(await pts(page), 'a pinch must never drop a wall point').toContain('0');
  });

  test('2. a one-finger drag PANS the plan and plants NO vertex', async ({ page }) => {
    const { cdp, cx, cy } = await openPen(page);
    const before = await view(page);

    await touch(cdp, 'touchStart', [{ x: cx - 80, y: cy + 40 }]);
    for (let i = 1; i <= 8; i++) {
      await touch(cdp, 'touchMove', [{ x: cx - 80 + i * 14, y: cy + 40 - i * 6 }]);
      await page.waitForTimeout(25);
    }
    await touch(cdp, 'touchEnd', []);
    await page.waitForTimeout(300);

    const after = await view(page);
    expect(after!.x, 'the drag must move the view').not.toBe(before!.x);
    expect(after!.scale, 'a pan must not change the zoom').toBe(before!.scale);
    expect(await pts(page), 'a pan must never drop a wall point').toContain('0');
  });

  test('3. a plain tap still drops exactly one point per tap', async ({ page }) => {
    const { cx, cy } = await openPen(page);
    for (const p of [{ x: cx - 60, y: cy - 40 }, { x: cx + 50, y: cy - 40 }, { x: cx + 50, y: cy + 50 }]) {
      await page.touchscreen.tap(p.x, p.y);
      await page.waitForTimeout(200);
    }
    expect(await pts(page)).toContain('3');
  });

  test('4. the pen card sits ON the toolbar — no dead band under it', async ({ page }) => {
    await openPen(page);
    const gap = await page.evaluate(() => {
      const hud = document.querySelector('[data-testid="room-draw-hud"]')!.getBoundingClientRect();
      const bar = document.querySelector('[data-testid="sims-bottom-toolbar"]')!.getBoundingClientRect();
      return Math.round(bar.top - hud.bottom);
    });
    // Was 68 px (a hard-coded 56 px band for a Clear row that App hides while
    // drawing, plus the margin). Now just the safe-area margin.
    expect(gap).toBeGreaterThanOrEqual(0);
    expect(gap).toBeLessThanOrEqual(16);
  });
});

test.describe('Wall pen — Select and delete a wall on a phone', () => {
  test('5. Select is on the main strip, picks a wall, shows its length and deletes it', async ({ page }) => {
    const { cx, cy } = await openPen(page);

    // Draw an L of two walls with taps, then keep them.
    for (const p of [{ x: cx - 60, y: cy - 40 }, { x: cx + 50, y: cy - 40 }, { x: cx + 50, y: cy + 50 }]) {
      await page.touchscreen.tap(p.x, p.y);
      await page.waitForTimeout(200);
    }
    await page.locator('[data-testid="room-draw-finish-walls"]').click();
    await page.waitForTimeout(500);
    const seeded = await storedSimsProperty(page);
    expect(seeded!.walls!.length).toBe(2);

    // Vic's ask: Select on the MAIN screen, not buried in the burger menu.
    const select = page.locator('[data-testid="select-tool-toggle-phone"]');
    await expect(select).toBeVisible();
    await select.click();
    await expect(select).toHaveAttribute('aria-pressed', 'true');

    // Tap the first wall's midpoint.
    const mid = await page.evaluate(() => {
      const raw = localStorage.getItem('ppw_property_v2');
      const p = raw ? JSON.parse(raw).state.property : null;
      const w = p?.walls?.[0];
      if (!w) return null;
      const g = (window as unknown as { __ppwGeom?: { worldToScreen: (x: number, y: number) => { x: number; y: number } | null } }).__ppwGeom;
      return g ? g.worldToScreen((w.a.x + w.b.x) / 2, (w.a.y + w.b.y) / 2) : null;
    });
    expect(mid).not.toBeNull();
    await page.touchscreen.tap(mid!.x, mid!.y);

    const card = page.locator('[data-testid="wall-selected-card"]');
    await expect(card).toBeVisible();
    await expect(page.locator('[data-testid="wall-selected-length"]')).toContainText('m');

    await page.locator('[data-testid="wall-selected-delete"]').click();
    await page.waitForTimeout(400);
    const after = await storedSimsProperty(page);
    expect(after!.walls!.length).toBe(1);
    await expect(card).toHaveCount(0);
  });

  test('6. tapping empty canvas clears the pick; the card never outlives the wall', async ({ page }) => {
    const { cx, cy } = await openPen(page);
    for (const p of [{ x: cx - 60, y: cy - 40 }, { x: cx + 50, y: cy - 40 }]) {
      await page.touchscreen.tap(p.x, p.y);
      await page.waitForTimeout(200);
    }
    await page.locator('[data-testid="room-draw-finish-walls"]').click();
    await page.waitForTimeout(500);
    await page.locator('[data-testid="select-tool-toggle-phone"]').click();

    const mid = await page.evaluate(() => {
      const raw = localStorage.getItem('ppw_property_v2');
      const p = raw ? JSON.parse(raw).state.property : null;
      const w = p?.walls?.[0];
      const g = (window as unknown as { __ppwGeom?: { worldToScreen: (x: number, y: number) => { x: number; y: number } | null } }).__ppwGeom;
      return w && g ? g.worldToScreen((w.a.x + w.b.x) / 2, (w.a.y + w.b.y) / 2) : null;
    });
    await page.touchscreen.tap(mid!.x, mid!.y);
    await expect(page.locator('[data-testid="wall-selected-card"]')).toBeVisible();

    // An empty patch of canvas, well away from the wall and the cards.
    await page.touchscreen.tap(cx + 120, cy - 200);
    await page.waitForTimeout(300);
    await expect(page.locator('[data-testid="wall-selected-card"]')).toHaveCount(0);
  });
});
