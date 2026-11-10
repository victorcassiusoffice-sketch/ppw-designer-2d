/**
 * Lessons (One Live Build game programme, part 2, 8 Nov 2026).
 *
 * Runs against the dev server (it needs the DEV-only window.__ppwGeom bridge
 * to click real wall positions):
 *   PPW_E2E_BASE_URL=http://127.0.0.1:5173 npx playwright test tests/e2e/lessons-quest.spec.ts
 *
 * Pins:
 *  1. the first-build quest, from an empty plan to the walk, at 1280 and 390;
 *  2. a drag on the canvas draws while a card is open (the card never takes it);
 *  3. Esc closes the card;
 *  4. reduced motion: the card shows the poster, no clip plays;
 *  5. on a 360 phone at 115 % text (313 x 567) the card covers neither the
 *     tool row nor the tool's card.
 * Every non-GET request is blocked: nothing is written anywhere.
 */
import { test, expect, type Page } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

type Pt = { x: number; y: number };
interface GeomRoom {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  vertices: number;
}

async function blockWrites(page: Page): Promise<void> {
  await page.route('**/*', (route) => (route.request().method() === 'GET' ? route.continue() : route.abort()));
}

async function openBlank(page: Page): Promise<void> {
  await blockWrites(page);
  await page.goto('/designer');
  await page.waitForSelector('.konvajs-content canvas', { state: 'attached' });
  await page.waitForFunction(() => !!(window as unknown as { __ppwGeom?: { ready: () => boolean } }).__ppwGeom?.ready());
}

async function toScreen(page: Page, x: number, y: number): Promise<Pt> {
  return page.evaluate(
    ([wx, wy]) => (window as unknown as { __ppwGeom: { worldToScreen: (a: number, b: number) => Pt } }).__ppwGeom.worldToScreen(wx, wy),
    [x, y],
  );
}

async function toWorld(page: Page, x: number, y: number): Promise<Pt> {
  return page.evaluate(
    ([sx, sy]) => (window as unknown as { __ppwGeom: { screenToWorld: (a: number, b: number) => Pt } }).__ppwGeom.screenToWorld(sx, sy),
    [x, y],
  );
}

async function drawnRoom(page: Page): Promise<GeomRoom | null> {
  return page.evaluate(() => {
    const g = (window as unknown as { __ppwGeom: { rooms: () => GeomRoom[] } }).__ppwGeom;
    return g.rooms().find((r) => r.vertices >= 3) ?? null;
  });
}

async function questTicks(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    try {
      return JSON.parse(localStorage.getItem('olb.lessons.v1') || '{}').quest?.ticks ?? [];
    } catch {
      return [];
    }
  });
}

async function press(page: Page, p: Pt, touch: boolean): Promise<void> {
  if (touch) await page.touchscreen.tap(p.x, p.y);
  else await page.mouse.click(p.x, p.y);
}

/** Open the quest panel (it folds to a chip when the canvas is pressed) and press Show me. */
async function showMe(page: Page, touch: boolean): Promise<void> {
  const chip = page.locator('[data-lessons-quest="chip"]');
  if (await chip.isVisible().catch(() => false)) {
    if (touch) await chip.tap();
    else await chip.click();
  }
  const show = page.locator('[data-lessons-quest="panel"] .lessons-quest__show');
  await expect(show).toBeVisible();
  if (touch) await show.tap();
  else await show.click();
}

async function expectTick(page: Page, step: string): Promise<void> {
  await expect.poll(() => questTicks(page), { timeout: 20_000 }).toContain(step);
}

async function runQuest(page: Page, touch: boolean): Promise<void> {
  await openBlank(page);
  // The offer only expands when the user opens First build.
  const invitation = page.locator('[data-lessons-quest="offer-chip"]');
  await expect(invitation).toBeVisible({ timeout: 20_000 });
  const offer = page.locator('[data-lessons-quest="offer"]');
  await expect(offer).toHaveCount(0);
  if (touch) await invitation.tap();
  else await invitation.click();
  await expect(offer).toBeVisible({ timeout: 20_000 });
  const start = offer.getByRole('button', { name: 'Start', exact: true });
  if (touch) await start.tap();
  else await start.click();
  await expect(page.locator('[data-lessons-quest="panel"]')).toBeVisible();

  // 1 · Build a room: the walls card shows; the room is drawn corner by corner.
  await showMe(page, touch);
  await expect(page.locator('[data-lesson-card="walls"]')).toBeVisible();
  // The visible part of the plan: below the top chrome, above the bottom bar.
  const stage = (await page.locator('.konvajs-content').first().boundingBox())!;
  const viewport = page.viewportSize()!;
  const bottomBar = await page
    .locator(touch ? '[data-testid="sims-bottom-toolbar"]' : '[data-testid="sims-dock"]')
    .first()
    .boundingBox();
  const visibleTop = Math.max(stage.y, 0);
  const visibleBottom = Math.min(stage.y + stage.height, bottomBar ? bottomBar.y : viewport.height) - 20;
  const centre = await toWorld(page, stage.x + stage.width / 2, (visibleTop + visibleBottom) / 2);
  const pxPerM = (await toScreen(page, centre.x + 1, centre.y)).x - (await toScreen(page, centre.x, centre.y)).x;
  // A room that fits the visible band with a margin (whole metres, on the snap grid).
  const halfW = Math.max(1.5, Math.min(2, Math.floor(((stage.width * 0.42) / pxPerM) * 2) / 2));
  const halfH = Math.max(1, Math.min(1.5, Math.floor(((visibleBottom - visibleTop) * 0.35) / pxPerM * 2) / 2));
  const cx = Math.round(centre.x);
  const cy = Math.round(centre.y);
  const corners = [
    [cx - halfW, cy - halfH],
    [cx + halfW, cy - halfH],
    [cx + halfW, cy + halfH],
    [cx - halfW, cy + halfH],
    [cx - halfW, cy - halfH],
  ];
  for (const [x, y] of corners) {
    await press(page, await toScreen(page, x, y), touch);
    await page.waitForTimeout(150);
  }
  await expect.poll(() => drawnRoom(page)).not.toBeNull();
  await expectTick(page, 'room');
  const room = (await drawnRoom(page))!;

  // 2 · A door and a window.
  await showMe(page, touch);
  await expect(page.locator('[data-lesson-card="door"]')).toBeVisible();
  await press(page, await toScreen(page, (room.minX + room.maxX) / 2, room.minY), touch);
  await page.waitForTimeout(300);
  await page.locator(touch ? '[data-testid="door-kind-mobile-window"]' : '[data-testid="door-kind-window"]').first().click();
  await press(page, await toScreen(page, room.maxX, (room.minY + room.maxY) / 2), touch);
  await expectTick(page, 'openings');

  // 3 · Paint a wall.
  await showMe(page, touch);
  await expect(page.locator('[data-lesson-card="wallpaint"]')).toBeVisible();
  await press(page, await toScreen(page, room.minX, (room.minY + room.maxY) / 2), touch);
  await expectTick(page, 'paint');

  // 4 · Lay a floor.
  await showMe(page, touch);
  await expect(page.locator('[data-lesson-card="floor"]')).toBeVisible();
  if (touch) await page.getByTestId('floor-paint-scope-mobile-room').tap(); // the phone card's "Fill room"
  else await press(page, await toScreen(page, room.minX + 1.25, room.minY + 1.25), touch);
  await expectTick(page, 'floor');

  // 5 · Place three products.
  await showMe(page, touch);
  await expect(page.locator('[data-lesson-card="furnish"]')).toBeVisible();
  // Small pieces (decor), so three fit in a small room.
  const decor = page.locator(touch ? '[data-testid="sims-cat-decor"]' : '[data-testid="dock-cat-decor"]').first();
  if (touch) await decor.tap();
  else await decor.click();
  const tiles = page.locator(
    touch
      ? '[data-testid="sims-thumb"]:not([data-floor-material])'
      : '[data-testid="dock-strip"] [data-product-id][data-armed]:not([data-floor-material])',
  );
  const spots: Array<[number, number]> = [
    [room.minX + 0.9, room.minY + 0.9],
    [room.maxX - 0.9, room.minY + 0.9],
    [room.minX + 0.9, room.maxY - 0.9],
  ];
  for (const [x, y] of spots) {
    const tile = tiles.first();
    if (touch && !(await tile.isVisible().catch(() => false))) {
      // The phone catalogue folds after each placement: open it again, as a person would.
      await page.getByTestId('sims-catalog-open').first().tap();
      await page.locator('[data-testid="sims-cat-decor"]').first().tap();
    }
    await expect(tile).toBeVisible();
    if (touch) await tile.tap();
    else await tile.click();
    await press(page, await toScreen(page, x, y), touch);
    await page.waitForTimeout(400);
  }
  await expectTick(page, 'products');

  // 6 · Look at it in 3D.
  await showMe(page, touch);
  await page.locator('[data-first-picture-ms]').first().waitFor({ timeout: 90_000 });
  await expectTick(page, 'view3d');

  // 7 · Walk through it: Show me points at the Walk button; the person starts the walk.
  await showMe(page, touch);
  await expect(page.locator('[data-lesson-card="walk"]')).toBeVisible({ timeout: 30_000 });
  const walk = page.getByRole('button', { name: 'Open Walk mode' }).first();
  if (touch) await walk.tap();
  else await walk.click();
  await page.getByRole('button', { name: 'Start walk' }).click();
  await page.locator('[data-testid="world-walk"][data-status]').waitFor({ timeout: 90_000 });
  await expectTick(page, 'walk');
  await page.getByRole('button', { name: /Exit walk/ }).click();
  await expect(page.locator('.lessons-quest--finale')).toContainText('First build done!');
}

test.describe('lessons: the first-build quest', () => {
  test.setTimeout(240_000);

  test('desktop 1280: an empty plan to the walk', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await runQuest(page, false);
  });

  test.describe('phone 390', () => {
    test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    test('an empty plan to the walk', async ({ page }) => {
      await runQuest(page, true);
    });
  });
});

test.describe('lessons: never in the way', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  /** Pick Walls, then explicitly open the lesson. */
  async function wallsCardOpen(page: Page, keyboard = false): Promise<void> {
    await openBlank(page);
    await page.locator('[data-lessons-quest="offer-chip"]').waitFor({ timeout: 20_000 });
    await page.getByTestId('start-quick-rectangle').first().click();
    await expect.poll(() => drawnRoom(page)).not.toBeNull();
    await page.getByRole('button', { name: 'Build', exact: true }).first().click();
    await page.getByTestId('wall-tool-toggle').first().click();
    const tip = page.locator('[data-lesson-chip="walls"]');
    await expect(tip).toBeVisible();
    await expect(page.locator('[data-lesson-card="walls"]')).toHaveCount(0);
    if (keyboard) {
      await tip.focus();
      await expect(tip).toBeFocused();
      await page.keyboard.press('Enter');
    } else await tip.click();
    await expect(page.locator('[data-lesson-card="walls"]')).toBeVisible();
  }

  test('a drag on the canvas draws a wall while the card is open', async ({ page }) => {
    await wallsCardOpen(page);
    const card = (await page.locator('[data-lesson-card="walls"]').boundingBox())!;
    const room = (await drawnRoom(page))!;
    // Start the drag ON the card (its body lets presses through) and end on the plan.
    const from = { x: card.x + card.width / 2, y: card.y + card.height * 0.4 };
    const end = await toScreen(page, room.maxX + 2.5, room.maxY + 1.5);
    const before = await page.evaluate(() => {
      const p = JSON.parse(localStorage.getItem('ppw_property_v2') || '{}').state?.property;
      return (p?.walls?.length ?? 0) + (p?.rooms?.filter((r: { polygon: unknown[] }) => r.polygon.length >= 3).length ?? 0);
    });
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    for (let i = 1; i <= 20; i++) await page.mouse.move(from.x + ((end.x - from.x) * i) / 20, from.y + ((end.y - from.y) * i) / 20);
    await page.mouse.up();
    // The press went to the canvas: the card folded to its chip.
    await expect(page.locator('[data-lesson-chip="walls"]')).toBeVisible();
    // ...and the drag drew: the pen holds a run, or a wall was kept.
    await expect
      .poll(async () =>
        page.evaluate(
          () => (window as unknown as { __ppwGeom: { drawVertexCount: () => number } }).__ppwGeom.drawVertexCount(),
        ),
      )
      .toBeGreaterThan(0)
      .catch(async () => {
        const after = await page.evaluate(() => {
          const p = JSON.parse(localStorage.getItem('ppw_property_v2') || '{}').state?.property;
          return (p?.walls?.length ?? 0) + (p?.rooms?.filter((r: { polygon: unknown[] }) => r.polygon.length >= 3).length ?? 0);
        });
        expect(after).toBeGreaterThan(before);
      });
  });

  test('Esc closes the card', async ({ page }) => {
    await wallsCardOpen(page);
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-lesson-card]')).toHaveCount(0);
  });

  test('Tab reaches the card buttons; the card text is read politely', async ({ page }) => {
    await wallsCardOpen(page, true);
    await expect(page.locator('[data-lesson-card="walls"]')).toBeFocused();
    await expect(page.locator('[data-lessons-live]')).toContainText('Walls');
    const gotIt = page.locator('[data-lesson-card="walls"]').getByRole('button', { name: 'Got it' });
    let reached = false;
    for (let i = 0; i < 80 && !reached; i++) {
      await page.keyboard.press('Tab');
      reached = await gotIt.evaluate((el) => el === document.activeElement);
    }
    expect(reached).toBe(true);
  });
});

test.describe('lessons: reduced motion', () => {
  test.use({ viewport: { width: 1280, height: 800 }, contextOptions: { reducedMotion: 'reduce' } });
  test('the card shows the poster and plays no clip', async ({ page }) => {
    await openBlank(page);
    await page.locator('[data-lessons-quest="offer-chip"]').waitFor({ timeout: 20_000 });
    await page.getByTestId('start-quick-rectangle').first().click();
    await page.getByRole('button', { name: 'Finish', exact: true }).first().click();
    await page.getByTestId('floor-paint-toggle').first().click();
    await page.locator('[data-lesson-chip="floor"]').click();
    const card = page.locator('[data-lesson-card="floor"]');
    await expect(card).toBeVisible();
    await expect(card.locator('video')).toHaveCount(0);
    await expect(card.locator('img.lessons-card__media')).toHaveAttribute('src', '/lessons/floor.webp');
  });
});

test.describe('lessons: a 360 phone at 115 % text', () => {
  test.use({ viewport: { width: 313, height: 567 }, hasTouch: true, isMobile: true });
  for (const [category, testid, hud] of [
    ['Finish', 'floor-paint-toggle', 'floor-paint-hud'],
    ['Finish', 'wallpaint-tool-toggle', 'wallpaint-hud'],
    ['Build', 'door-tool-toggle', 'door-hud'],
  ] as const) {
    test(`${testid}: the card fits on screen and covers neither the tool row nor ${hud}`, async ({ page }) => {
      await openBlank(page);
      await page.locator('[data-lessons-quest="offer-chip"]').waitFor({ timeout: 20_000 });
      await page.getByTestId('start-quick-rectangle').first().tap();
      await page.getByRole('button', { name: category, exact: true }).first().tap();
      await page.getByTestId(testid).first().tap();
      await page.locator('[data-lesson-chip]').tap();
      const card = page.locator('[data-lesson-card]');
      await expect(card).toBeVisible();
      await page.waitForTimeout(900);
      const c = (await card.boundingBox())!;
      expect(c.y).toBeGreaterThanOrEqual(0);
      expect(c.y + c.height).toBeLessThanOrEqual(567);
      for (const sel of ['.plan-build-tools', `[data-testid="${hud}"]`]) {
        const r = await page.locator(sel).first().boundingBox();
        if (!r) continue;
        const overlapW = Math.min(c.x + c.width, r.x + r.width) - Math.max(c.x, r.x);
        const overlapH = Math.min(c.y + c.height, r.y + r.height) - Math.max(c.y, r.y);
        // Placement uses whole CSS pixels. Responsive HUD borders can land
        // on fractional pixels (e.g. 269.875 beside a card ending at 270).
        expect(overlapW >= 1 && overlapH >= 1, `card over ${sel} by ${overlapW} × ${overlapH}px`).toBe(false);
      }
    });
  }
});
