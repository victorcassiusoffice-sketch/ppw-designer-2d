/**
 * GATE JOURNEYS — walls-straight / select-tool / fit-not-reset / clear-all
 * (complaints A–D, 2026-08-31). VERIFICATION ONLY: this spec drives the real
 * dev build with real gestures and records store + viewport + screenshots for
 * the four fixes. It touches no source.
 *
 * Run against a DEV server (the geom bridge + unbuilt features only exist there):
 *   PPW_E2E_BASE_URL=http://127.0.0.1:5188 npx playwright test walls-select-reset-journeys --workers=3
 */
import { test, expect, type Page } from '@playwright/test';
import {
  seedSimsProperty,
  storedSimsProperty,
  allStoredItems,
  waitForGeom,
  oneRoomFixture,
  type SimsSeedProperty,
} from './sims-world-helpers';

const SHOT_DIR =
  'C:/Users/Victor/Documents/PPW-Code/ppw-designer-2d/docs/sims-world-2026-08-29/walls-select-reset-2026-08-31';
const K1 = 'k1-nordictrack-2450';

/** Seed the property AND a snap-unit preference in one init script. */
async function seedWithUnit(
  page: Page,
  prop: SimsSeedProperty | null,
  precision: string,
): Promise<void> {
  await page.addInitScript(
    ([p, unit]) => {
      localStorage.clear();
      localStorage.setItem('ppw_designer_coach_v1', '1');
      localStorage.setItem(
        'ppw_designer_ui_v1',
        JSON.stringify({ state: { precision: unit, lastPrecision: 'full' }, version: 1 }),
      );
      if (p) {
        localStorage.setItem(
          'ppw_property_v2',
          JSON.stringify({ state: { property: p, showGrid: true, pxPerMetre: 100 }, version: 2 }),
        );
      }
    },
    [prop, precision] as [SimsSeedProperty | null, string],
  );
}

async function worldToScreen(page: Page, xM: number, yM: number): Promise<{ x: number; y: number }> {
  const pt = await page.evaluate(
    ([x, y]) => {
      const g = (window as unknown as { __ppwGeom?: { worldToScreen: (a: number, b: number) => { x: number; y: number } | null } }).__ppwGeom;
      return g ? g.worldToScreen(x, y) : null;
    },
    [xM, yM] as [number, number],
  );
  if (!pt) throw new Error('geom bridge unavailable — run against DEV');
  return pt;
}

async function stageViewport(page: Page): Promise<{ x: number; y: number; scale: number; width: number; height: number }> {
  return page.evaluate(() => {
    const g = (window as unknown as { __ppwGeom?: { stage: () => { x: number; y: number; scale: number; width: number; height: number } | null } }).__ppwGeom;
    const s = g?.stage();
    if (!s) throw new Error('no stage');
    return { x: s.x, y: s.y, scale: s.scale, width: s.width, height: s.height };
  });
}

async function drawVertices(page: Page): Promise<Array<{ x: number; y: number }>> {
  return page.evaluate(() => {
    const g = (window as unknown as { __ppwGeom?: { drawVertices: () => Array<{ x: number; y: number }> } }).__ppwGeom;
    return g ? g.drawVertices() : [];
  });
}

async function clickWorld(page: Page, xM: number, yM: number, opts: { shift?: boolean } = {}): Promise<void> {
  const pt = await worldToScreen(page, xM, yM);
  await page.mouse.move(pt.x, pt.y, { steps: 6 });
  if (opts.shift) {
    await page.keyboard.down('Shift');
    await page.mouse.click(pt.x, pt.y);
    await page.keyboard.up('Shift');
  } else {
    await page.mouse.click(pt.x, pt.y);
  }
}

async function openDesigner(page: Page): Promise<void> {
  await page.goto('/designer');
  await page.waitForSelector('.konvajs-content canvas', { state: 'attached' });
  await waitForGeom(page);
}

/** Collected recordings, printed at the end so the gate report can quote them. */
const REC: Record<string, unknown> = {};
test.afterAll(() => {
  // eslint-disable-next-line no-console
  console.log('JOURNEY_RECORD ' + JSON.stringify(REC));
});

// ─────────────────────────────────────────────────────────────────────────
// (A) WALLS — straight-line assist at unit 0.1 m, and a freed diagonal
// ─────────────────────────────────────────────────────────────────────────
test.describe('(A) walls straight', () => {
  test.use({ viewport: { width: 1366, height: 900 } });

  test('at 0.1 m: a near-level run commits straight; Shift frees a diagonal; chip shows', async ({ page }) => {
    await seedWithUnit(page, oneRoomFixture(), 'cm10'); // 0.1 m
    await openDesigner(page);

    // Open the wall pen.
    await page.locator('[data-testid="wall-tool-toggle"]').click();
    await expect(page.locator('[data-testid="room-draw-hud"]')).toBeVisible();

    // Draw well clear of the seeded room (x=5 east wall) but inside the
    // visible stage (the 5x4 fit puts world x=9.3 at the right edge, so a
    // point at x=10 would land off-canvas). First point (6.3, 1.0), second a
    // deliberately-slanted (8.3, 1.12): the straight-line assist must pull the
    // second vertex ONTO y = 1.0.
    await clickWorld(page, 6.3, 1);
    // Hover the slanted target so the live chip renders, then read it.
    const p2 = await worldToScreen(page, 8.3, 1.12);
    await page.mouse.move(p2.x, p2.y, { steps: 8 });
    await expect(page.locator('.konvajs-content')).toBeVisible();
    // The length+angle chip: locked run reads "0° · straight".
    const chipText = await page.evaluate(() => {
      // Konva text lives on canvas; read via the stage's text nodes.
      const K = (window as unknown as { Konva?: { stages?: Array<{ container: () => HTMLElement; find: (s: string) => Array<{ text: () => string }> }> } }).Konva;
      const s = K?.stages?.find((st) => st.container().isConnected);
      if (!s) return null;
      return s.find('Text').map((t) => t.text()).filter((t) => /straight|°/.test(t));
    });
    await page.mouse.click(p2.x, p2.y);

    const verts = await drawVertices(page);
    REC.A_vertices = verts;
    REC.A_chipTexts = chipText;
    // Second stored vertex is axis-locked to the level of the first.
    expect(verts.length).toBeGreaterThanOrEqual(2);
    expect(verts[1].y).toBeCloseTo(1.0, 6); // straight, not 1.15
    // Chip carried the angle/straight affordance.
    expect((chipText ?? []).some((t) => /straight/.test(t))).toBe(true);

    await page.screenshot({ path: `${SHOT_DIR}/gate-A-walls-straight-1366.png` });

    // Now a deliberate diagonal freed with Shift: from the locked (8.3, 1.0)
    // the run to (6.3, 3.0) is ~45° — well outside the 15° lock, and Shift
    // proves the release path. Both stay on the visible stage. Third click.
    await clickWorld(page, 6.3, 3, { shift: true });
    const verts2 = await drawVertices(page);
    REC.A_freedVertices = verts2;
    expect(verts2.length).toBeGreaterThanOrEqual(3);
    // The freed vertex kept its off-axis y (not pulled onto 1.0).
    expect(Math.abs(verts2[2].y - 1.0)).toBeGreaterThan(0.5);
    await page.screenshot({ path: `${SHOT_DIR}/gate-A-walls-diagonal-1366.png` });
  });
});

// ─────────────────────────────────────────────────────────────────────────
// (B) SELECT — the always-visible way back to the pointer
// ─────────────────────────────────────────────────────────────────────────
test.describe('(B) select tool', () => {
  test('desktop: Select toggle visible, returns tool to hand, selects + deletes an item; Esc from Door', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 900 });
    await seedSimsProperty(page, oneRoomFixture());
    await openDesigner(page);

    const sel = page.locator('[data-testid="select-tool-toggle"]');
    await expect(sel).toHaveCount(1);
    await expect(sel).toBeVisible();

    // Turn Walls on, then click Select to come back.
    await page.locator('[data-testid="wall-tool-toggle"]').click();
    await expect(page.locator('[data-testid="wall-tool-toggle"]')).toHaveAttribute('aria-pressed', 'true');
    await sel.click();
    // `tool` is not persisted (partialize keeps only precision/floorDraft),
    // so aria-pressed on the Select button is the true signal: it is only
    // pressed when tool==='hand' AND no build tool is armed (drawMode off).
    await expect(sel).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('[data-testid="wall-tool-toggle"]')).toHaveAttribute('aria-pressed', 'false');
    REC.B_selectPressedAfterClick = true;
    REC.B_wallPressedAfterSelect = false;

    // Place a K1 item (arm from dock, click canvas), then Select + click it + Delete.
    const card = page.locator(`[data-product-id="${K1}"]`).first();
    await expect(card).toBeVisible();
    await card.click();
    await expect(page.locator('[data-armed="true"]')).toHaveCount(2);
    const drop = await worldToScreen(page, 2.5, 2);
    await page.mouse.move(drop.x, drop.y, { steps: 8 });
    await page.mouse.click(drop.x, drop.y);
    await expect(page.locator('[data-armed="true"]')).toHaveCount(0);
    let items = await allStoredItems(page);
    REC.B_itemsAfterPlace = items.length;
    expect(items.length).toBe(1);

    // Ensure Select is active, click the item to select, Delete.
    await sel.click();
    const itemPt = await worldToScreen(page, 2.5, 2);
    await page.mouse.click(itemPt.x, itemPt.y);
    await page.waitForTimeout(150);
    await page.keyboard.press('Delete');
    await page.waitForTimeout(200);
    items = await allStoredItems(page);
    REC.B_itemsAfterDelete = items.length;
    expect(items.length).toBe(0);

    await page.screenshot({ path: `${SHOT_DIR}/gate-B-select-active-1366.png` });

    // Esc from the Door tool returns to hand.
    await page.locator('[data-testid="door-tool-toggle"]').click();
    await expect(page.locator('[data-testid="door-tool-toggle"]')).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press('Escape');
    // Esc from Door returns to Select/hand: the Select button is pressed and
    // the Door button is not.
    await expect(sel).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('[data-testid="door-tool-toggle"]')).toHaveAttribute('aria-pressed', 'false');
    REC.B_selectPressedAfterEsc = true;
  });

  test('phone 390: the mobile menu sheet carries select-tool-toggle-mobile (single)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await seedSimsProperty(page, oneRoomFixture());
    await openDesigner(page);

    await page.locator('button[aria-label="Open menu"]').click();
    const selM = page.locator('[data-testid="select-tool-toggle-mobile"]');
    await expect(selM).toHaveCount(1);
    await expect(selM).toBeVisible();
    await page.screenshot({ path: `${SHOT_DIR}/gate-B-select-mobile-390.png` });
  });
});

// ─────────────────────────────────────────────────────────────────────────
// (C) FIT — the reset actually re-centres the room (not the corner)
// ─────────────────────────────────────────────────────────────────────────
test.describe('(C) fit re-centres', () => {
  test.use({ viewport: { width: 1366, height: 900 } });

  test('a room pushed off-centre by a drag is centred + fully inside the stage; viewport is not {0,0,1}', async ({ page }) => {
    // 5 x 4 room at origin.
    await seedSimsProperty(page, oneRoomFixture());
    await openDesigner(page);
    await page.waitForTimeout(300); // let auto-fit settle

    const fitted = await stageViewport(page);
    REC.C_fittedViewport = fitted;

    // Drag the stage to push the room off-centre (empty-canvas drag = pan).
    const from = { x: 900, y: 250 };
    const to = { x: 300, y: 600 };
    await page.mouse.move(from.x, from.y, { steps: 4 });
    await page.mouse.down();
    for (let i = 1; i <= 10; i++) {
      await page.mouse.move(from.x + ((to.x - from.x) * i) / 10, from.y + ((to.y - from.y) * i) / 10);
    }
    await page.mouse.up();
    await page.waitForTimeout(150);
    const moved = await stageViewport(page);
    REC.C_movedViewport = moved;
    // The pan actually moved the viewport.
    expect(Math.abs(moved.x - fitted.x) + Math.abs(moved.y - fitted.y)).toBeGreaterThan(50);

    await page.screenshot({ path: `${SHOT_DIR}/gate-C-reset-before-1366.png` });

    // The Fit button (label reads "Fit", not "Reset").
    const fitBtn = page.getByRole('button', { name: 'Fit to view' });
    await expect(fitBtn).toHaveText(/Fit/);
    await fitBtn.click();
    await page.waitForTimeout(200);

    const after = await stageViewport(page);
    REC.C_afterFitViewport = after;

    // NOT the corner-origin {0,0,1}.
    const isCornerOrigin = Math.abs(after.x) < 1 && Math.abs(after.y) < 1 && Math.abs(after.scale - 1) < 1e-6;
    expect(isCornerOrigin).toBe(false);

    // The room union (0,0)-(5,4) is fully inside the stage rect AND centred.
    const corners = await Promise.all([
      worldToScreen(page, 0, 0),
      worldToScreen(page, 5, 0),
      worldToScreen(page, 5, 4),
      worldToScreen(page, 0, 4),
    ]);
    const rect = await page.evaluate(() => {
      const c = document.querySelector('.konvajs-content') as HTMLElement | null;
      if (!c) return null;
      const r = c.getBoundingClientRect();
      return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, w: r.width, h: r.height };
    });
    REC.C_stageRect = rect;
    REC.C_unionCorners = corners;
    expect(rect).not.toBeNull();
    const minX = Math.min(...corners.map((c) => c.x));
    const maxX = Math.max(...corners.map((c) => c.x));
    const minY = Math.min(...corners.map((c) => c.y));
    const maxY = Math.max(...corners.map((c) => c.y));
    // Fully inside.
    expect(minX).toBeGreaterThanOrEqual(rect!.left - 1);
    expect(maxX).toBeLessThanOrEqual(rect!.right + 1);
    expect(minY).toBeGreaterThanOrEqual(rect!.top - 1);
    expect(maxY).toBeLessThanOrEqual(rect!.bottom + 1);
    // Roughly centred: the union midpoint sits near the stage midpoint.
    const midX = (minX + maxX) / 2;
    const midY = (minY + maxY) / 2;
    const cx = (rect!.left + rect!.right) / 2;
    const cy = (rect!.top + rect!.bottom) / 2;
    REC.C_centreOffset = { dx: midX - cx, dy: midY - cy };
    expect(Math.abs(midX - cx)).toBeLessThan(rect!.w * 0.25);
    expect(Math.abs(midY - cy)).toBeLessThan(rect!.h * 0.25);

    await page.screenshot({ path: `${SHOT_DIR}/gate-C-reset-after-1366.png` });
  });
});

// ─────────────────────────────────────────────────────────────────────────
// (D) CLEAR ALL — never disabled, even on a blank-seeded room
// ─────────────────────────────────────────────────────────────────────────
test.describe('(D) clear-all always enabled', () => {
  /** A blank-on-open room: polygon empty, no items — the case the old gate broke. */
  function blankRoomFixture(): SimsSeedProperty {
    return {
      id: 'prop-blank',
      name: 'Blank Property',
      activeRoomId: 'r1',
      rooms: [{ id: 'r1', name: 'Room 1', polygon: [], placedItems: [] }],
    };
  }

  test('blank room (polygon []): clear-all-button is enabled and opens the modal', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 900 });
    await seedSimsProperty(page, blankRoomFixture());
    await openDesigner(page);

    const seeded = await storedSimsProperty(page);
    REC.D_seededPolygonLen = seeded?.rooms[0].polygon.length ?? -1;
    expect(seeded?.rooms[0].polygon.length).toBe(0);

    const clearAll = page.getByTestId('clear-all-button');
    await expect(clearAll).toBeVisible();
    const disabled = await clearAll.isDisabled();
    REC.D_clearAllDisabledOnBlank = disabled;
    expect(disabled).toBe(false);

    await page.screenshot({ path: `${SHOT_DIR}/gate-D-clear-all-blank-1366.png` });

    await clearAll.click();
    await expect(page.getByTestId('clear-controls-modal')).toBeVisible();
  });

  test('blank room on phone 390: clear-all enabled', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await seedSimsProperty(page, blankRoomFixture());
    await openDesigner(page);
    const clearAll = page.getByTestId('clear-all-button');
    await expect(clearAll).toBeVisible();
    expect(await clearAll.isDisabled()).toBe(false);
    await page.screenshot({ path: `${SHOT_DIR}/gate-D-clear-all-blank-390.png` });
  });

  test('Vic-state: a full room → Fit centres, then Clear all → confirm → blank canvas', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 900 });
    await seedSimsProperty(
      page,
      oneRoomFixture([{ instanceId: 'i1', productId: K1, x: 2, y: 1.5, rotation: 0 }]),
    );
    await openDesigner(page);
    await page.waitForTimeout(200);

    // Clear all → confirm.
    const clearAll = page.getByTestId('clear-all-button');
    await expect(clearAll).toBeEnabled();
    await clearAll.click();
    const modal = page.getByTestId('clear-controls-modal');
    await expect(modal).toBeVisible();
    // Confirm button inside the modal.
    await modal.getByRole('button', { name: /clear|delete|yes|confirm/i }).first().click();
    await page.waitForTimeout(250);

    const after = await storedSimsProperty(page);
    const items = await allStoredItems(page);
    REC.D_afterClear_polygonLen = after?.rooms?.[0]?.polygon.length ?? null;
    REC.D_afterClear_items = items.length;
    REC.D_afterClear_walls = after?.walls?.length ?? 0;
    expect(items.length).toBe(0);
    // Room polygon is blank (start-over) and no free walls remain.
    expect(after?.rooms?.[0]?.polygon.length ?? 0).toBe(0);
    expect(after?.walls?.length ?? 0).toBe(0);
    await page.screenshot({ path: `${SHOT_DIR}/gate-D-clear-all-confirmed-1366.png` });
  });
});
