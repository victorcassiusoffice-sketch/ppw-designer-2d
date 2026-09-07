/**
 * Straight to draw, and a primary button that makes the room (Vic 2026-09-08:
 * "the wall draw feature doesn't work properly it needs to be user friendly.
 * don't give the option at the beginning also to select draw or the sample
 * room, just straight to draw").
 *
 * Two things this pins, because both were customer-visible failures:
 *
 *  1. A BLANK plan opens with the wall pen already in hand. The centred card
 *     that made the customer choose "Draw walls" or "Quick 5 x 4 m room"
 *     before anything could happen is gone, and so is the coach modal that
 *     sat on top of it — two gates in front of the first click.
 *
 *  2. The pen's ink button MAKES A ROOM. It used to be "Done", which keeps
 *     the run as loose walls: four corners and one press of the obvious
 *     button produced three free-standing walls and no room — no floor, no
 *     area, nothing to paint or furnish. Keeping walls open is still one tap
 *     away, it is just not what the big button does.
 */
import { test, expect, type Page } from '@playwright/test';
import { seedCoachFlagOnly, canvasOrigin, PX_PER_M } from './multiroom-helpers';

test.use({ viewport: { width: 1366, height: 800 } });

interface StoredRoom {
  id: string;
  polygon: Array<{ x: number; y: number }>;
}

async function storedPlan(page: Page): Promise<{ rooms: StoredRoom[]; walls: number }> {
  return page.evaluate(() => {
    try {
      const raw = JSON.parse(localStorage.getItem('ppw_property_v2') || '{}');
      const p = raw.state?.property ?? {};
      return {
        rooms: (p.rooms ?? []).map((r: StoredRoom) => ({ id: r.id, polygon: r.polygon ?? [] })),
        walls: (p.walls ?? []).length,
      };
    } catch {
      return { rooms: [], walls: 0 };
    }
  });
}

async function openBlank(page: Page): Promise<void> {
  await seedCoachFlagOnly(page);
  await page.goto('/designer');
  await page.waitForSelector('.konvajs-content canvas', { state: 'attached' });
  await page.waitForTimeout(600);
}

/** Drop four corners of a 3 x 2 m rectangle from the canvas origin. */
async function drawFourCorners(page: Page): Promise<void> {
  const o = await canvasOrigin(page);
  for (const [xM, yM] of [[1, 1], [4, 1], [4, 3], [1, 3]] as const) {
    const x = o.x + xM * PX_PER_M;
    const y = o.y + yM * PX_PER_M;
    await page.mouse.move(x, y, { steps: 4 });
    await page.mouse.click(x, y);
    await page.waitForTimeout(220);
  }
}

test.describe('Wall pen — straight to draw', () => {
  test('a blank plan opens IN the pen: no choice card, no coach modal, HUD up', async ({ page }) => {
    await openBlank(page);

    // The pen is in hand…
    await expect(page.locator('[data-testid="room-draw-hud"]')).toBeVisible();
    await expect(page.locator('[data-testid="wall-tool-toggle"]')).toHaveAttribute('aria-pressed', 'true');
    // …so the start-choice card is not on screen at all.
    await expect(page.locator('[data-testid="start-room-prompt"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="start-draw-room"]')).toHaveCount(0);
    // …and nothing else is asking to be dismissed first.
    await expect(page.getByRole('button', { name: /^Skip$/ })).toHaveCount(0);
    // The hint says the one next thing to do.
    await expect(page.locator('[data-testid="room-draw-hint"]')).toContainText(/corner/i);
    // Help is still reachable while the pen is open (it is the default state
    // now, and the onboarding cards live behind it).
    await expect(page.getByRole('button', { name: /open keyboard shortcuts help/i })).toBeVisible();
  });

  test('the first click lands a wall point — no button press first', async ({ page }) => {
    await openBlank(page);
    const o = await canvasOrigin(page);
    await page.mouse.move(o.x + 2 * PX_PER_M, o.y + 2 * PX_PER_M, { steps: 4 });
    await page.mouse.click(o.x + 2 * PX_PER_M, o.y + 2 * PX_PER_M);
    await expect(page.locator('[data-testid="room-draw-vertices-count"]')).toContainText('1');
  });

  test('four corners + the ink button = a ROOM, not loose walls', async ({ page }) => {
    await openBlank(page);
    await drawFourCorners(page);

    // The primary IS "Make room" once a room is possible.
    const makeRoom = page.locator('[data-testid="room-draw-close"]');
    await expect(makeRoom).toBeEnabled();
    await expect(makeRoom).toHaveText(/make room/i);
    await makeRoom.click();
    await page.waitForTimeout(600);

    const plan = await storedPlan(page);
    const drawn = plan.rooms.filter((r) => r.polygon.length >= 3);
    expect(drawn, 'a room was created').toHaveLength(1);
    expect(drawn[0].polygon).toHaveLength(4);
    expect(plan.walls, 'no loose walls were left behind').toBe(0);
    // The pen stands down once the room exists.
    await expect(page.locator('[data-testid="room-draw-hud"]')).toHaveCount(0);
  });

  test('keeping the run OPEN is still one tap away, and says so', async ({ page }) => {
    await openBlank(page);
    await drawFourCorners(page);

    const keep = page.locator('[data-testid="room-draw-finish-walls"]');
    await expect(keep).toHaveText(/keep walls/i);
    await keep.click();
    await page.waitForTimeout(600);

    const plan = await storedPlan(page);
    expect(plan.rooms.filter((r) => r.polygon.length >= 3), 'deliberately not a room').toHaveLength(0);
    expect(plan.walls, 'four corners drawn open leave three walls').toBe(3);
  });

  test('the 5 x 4 m shortcut lives in the pen, and putting it down leaves the pen', async ({ page }) => {
    await openBlank(page);
    const quick = page.locator('[data-testid="start-quick-rectangle"]');
    await expect(quick).toBeVisible();
    await quick.click();
    await page.waitForTimeout(600);

    const plan = await storedPlan(page);
    expect(plan.rooms.filter((r) => r.polygon.length >= 3)).toHaveLength(1);
    // The pen is put away, so the next canvas click places a product rather
    // than dropping a wall point onto the room it just laid.
    await expect(page.locator('[data-testid="room-draw-hud"]')).toHaveCount(0);
    // …and the shortcut is not offered once a room exists.
    await expect(page.locator('[data-testid="start-quick-rectangle"]')).toHaveCount(0);
  });
});
