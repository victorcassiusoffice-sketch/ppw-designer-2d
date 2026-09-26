/**
 * 3D MODE (2026-09-17) — the whole designer as a Sims-style room view.
 *
 * Vic: "make the whole designer have a 3D Mode, with a 3D mode switch, a
 * super realistic 3D version of the 2D." Pins:
 *   1. the switch is on the bar (desktop) and in the sheet (phone); the
 *      three chunk is fetched only once the mode opens;
 *   2. the room renders on the GL stage (not the canvas fallback), with
 *      every wall, floor and item the plan holds;
 *   3. tools still work inside the mode: arm Wall paint from the bar while
 *      the room shows, click a wall in 3D, the plan is painted;
 *   4. Plan returns.
 *
 * Sims build mode in 3D (Vic 2026-09-17: "it should reflect what's done on
 * the 2D and vice versa … functioning exactly like The Sims"):
 *   5. a tap on a body selects it — the plan's selection — and R turns it;
 *   6. a drag across the floor moves it, landing through the plan's own
 *      drop rules (the grid here);
 *   7. a dock tile armed while the room shows + a tap on the floor places
 *      the product there, and the tile disarms.
 *
 * Runs on a dev server (the bridge is DEV-only): PPW_E2E_BASE_URL=http://127.0.0.1:5199
 */
import { test, expect, type Page } from '@playwright/test';
import { openCatalog } from './catalog-helpers';

const ROOM = {
  id: 'r1',
  name: 'Room 1',
  polygon: [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 4 }, { x: 0, y: 4 }],
  openings: [{ id: 'd1', edgeIndex: 0, offsetM: 1, widthM: 0.838, kind: 'door', flipFacing: false, flipHand: false }],
  placedItems: [{ instanceId: 'i1', productId: 'k1-nordictrack-2450', x: 0.3, y: 0.3, rotation: 90 }],
};

async function seed(page: Page, room: typeof ROOM = ROOM): Promise<void> {
  await page.addInitScript((p) => {
    if (localStorage.getItem('__ppw_seeded') === '1') return;
    localStorage.clear();
    localStorage.setItem('__ppw_seeded', '1');
    localStorage.setItem('ppw_designer_coach_v1', '1');
    localStorage.setItem('ppw_property_v2', JSON.stringify({ state: { property: p, showGrid: true, pxPerMetre: 100 }, version: 2 }));
  }, { id: 'p', name: 'Vic', activeRoomId: 'r1', rooms: [room], wallHeightM: 2.7 });
}

type Pt = { x: number; y: number } | null;
interface Bridge {
  itemScreenPoint: (id: string) => Pt;
  floorScreenPoint: (x: number, y: number) => Pt;
  floorAt: (x: number, y: number) => Pt;
}
// Each runs INSIDE the page (a Node-side helper is not visible to page.evaluate).
const itemPoint = (page: Page, id: string) => page.evaluate((i) => (window as unknown as { __ppwRoomView3d: Bridge }).__ppwRoomView3d.itemScreenPoint(i), id);
const floorPoint = (page: Page, x: number, y: number) =>
  page.evaluate(([a, b]) => (window as unknown as { __ppwRoomView3d: Bridge }).__ppwRoomView3d.floorScreenPoint(a, b), [x, y] as [number, number]);
const floorAt = (page: Page, x: number, y: number) =>
  page.evaluate(([a, b]) => (window as unknown as { __ppwRoomView3d: Bridge }).__ppwRoomView3d.floorAt(a, b), [x, y] as [number, number]);

/** The persisted plan's items in room 1. */
async function items(page: Page): Promise<Array<{ instanceId: string; productId: string; x: number; y: number; rotation: number }>> {
  return page.evaluate(() => JSON.parse(localStorage.getItem('ppw_property_v2')!).state.property.rooms[0].placedItems);
}

async function bridge(page: Page) {
  return page.evaluate(() => {
    const b = (window as unknown as { __ppwRoomView3d?: { backend: () => string; faceCount: () => number; faces: () => Array<{ key: string; holes: number }> } }).__ppwRoomView3d;
    return b ? { backend: b.backend(), faces: b.faceCount(), keys: b.faces().map((f) => f.key) } : null;
  });
}

/**
 * `backend` reads 'gl' from the first render — the lazy stage arrives and
 * builds its parts a moment later. Wait for the parts, and for GL to have
 * kept the job (the painter takes over only if WebGL refused to start).
 */
async function awaitStage(page: Page): Promise<void> {
  await expect.poll(async () => (await bridge(page))?.faces ?? 0, { timeout: 20_000 }).toBeGreaterThan(0);
  expect((await bridge(page))?.backend).toBe('gl');
}

/**
 * Switch to 3D unless the room is already showing. The 3D-first shell
 * (2026-09-23) opens furnished plans straight in 3D, and a click on the
 * Plan-bar switch while the overlay is up is intercepted by the overlay.
 */
async function enter3D(page: Page): Promise<void> {
  const overlay = page.locator('[data-testid="wallpaint-3d-overlay"]');
  if (!(await overlay.isVisible())) await page.locator('[data-testid="view-mode-3d"]').click();
  await expect(overlay).toBeVisible();
}

test.describe('3D Mode — desktop', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('the switch opens the room on the GL stage, fetches three only then, keeps the bar, and Plan returns', async ({ page }) => {
    await seed(page);
    // The page's own resource timeline: what the browser actually fetched.
    const threeLoads = () =>
      page.evaluate(() => performance.getEntriesByType('resource').map((e) => e.name).filter((n) => /three|ThreeStage/i.test(n)));
    await page.goto('/designer');
    await page.waitForSelector('.konvajs-content canvas', { state: 'attached' });
    await page.waitForTimeout(500);
    expect(await threeLoads(), 'three must not load with the 2D designer').toHaveLength(0);

    await enter3D(page);
    const overlay = page.locator('[data-testid="wallpaint-3d-overlay"]');
    await expect(page.locator('[data-testid="view-mode-3d"]')).toHaveAttribute('aria-pressed', 'true');
    // The bar stays above the room.
    const bar = (await page.locator('header').first().boundingBox())!;
    const box = (await overlay.boundingBox())!;
    expect(box.y).toBeGreaterThanOrEqual(bar.y + bar.height - 1);
    await expect.poll(async () => (await threeLoads()).length, { timeout: 15_000 }).toBeGreaterThan(0);

    // The GL stage draws it: walls, the floor and the item are all there.
    await awaitStage(page);
    const b = (await bridge(page))!;
    expect(b.faces).toBeGreaterThan(0);
    expect(b.keys).toContain('floor-r1');
    expect(b.keys).toContain('item-i1');
    expect(b.keys.filter((k) => k.startsWith('wall-r1-') || k.startsWith('stub-r1-'))).toHaveLength(4);
    // The door is a hole in its wall.
    const north = (await page.evaluate(() => (window as unknown as { __ppwRoomView3d: { faces: () => Array<{ key: string; holes: number }> } }).__ppwRoomView3d.faces()))
      .find((f) => f.key === 'wall-r1-0' || f.key === 'stub-r1-0');
    expect(north).toBeDefined();
    if (north!.key === 'wall-r1-0') expect(north!.holes).toBe(1);

    // No paint armed → view only: the caption says so and the panel is not there.
    await expect(page.locator('[data-testid="wallpaint-3d-overlay"] [data-testid="wallpaint-3d-caption"]')).not.toContainText('paint');
    await expect(page.locator('[data-testid="wallpaint-palette"]')).toHaveCount(0);

    await page.locator('[data-testid="wallpaint-3d-close"]').click();
    await expect(overlay).toHaveCount(0);
    await expect(page.locator('[data-testid="view-mode-3d"]')).toHaveAttribute('aria-pressed', 'false');
  });

  test('a tool works inside the mode: arm Wall paint from the bar, click a wall in 3D, the plan is painted', async ({ page }) => {
    await seed(page);
    await page.goto('/designer');
    await page.waitForSelector('.konvajs-content canvas', { state: 'attached' });
    await enter3D(page);
    await awaitStage(page);
    await page.locator('[data-testid="wallpaint-tool-toggle"]').click();
    await page.waitForSelector('[data-testid="wallpaint-palette"]');
    // The panel's card and the overlay both carry a caption — read the overlay's.
    await expect(page.locator('[data-testid="wallpaint-3d-overlay"] [data-testid="wallpaint-3d-caption"]')).toContainText('paint');
    // The default camera looks from the south-west: the north wall (edge 0) is a far wall.
    const pt = await page.evaluate(() =>
      (window as unknown as { __ppwRoomView3d: { wallScreenPoint: (h: unknown) => { x: number; y: number } | null } }).__ppwRoomView3d.wallScreenPoint({ kind: 'edge', roomId: 'r1', edgeIndex: 0 }),
    );
    expect(pt).not.toBeNull();
    await page.mouse.click(pt!.x, pt!.y);
    await expect
      .poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('ppw_property_v2')!).state.property.rooms[0].wallPaint?.map((e: { edgeIndex: number }) => e.edgeIndex) ?? []))
      .toEqual([0]);
  });

  test('Sims build mode: tap selects, R turns, a drag moves through the plan rules, a dock tile + floor tap places', async ({ page }) => {
    // The treadmill mid-room (a box body: no manifest model), room to turn and to slide.
    await seed(page, { ...ROOM, placedItems: [{ instanceId: 'i1', productId: 'k1-nordictrack-2450', x: 1.5, y: 1.5, rotation: 0 }] });
    await page.goto('/designer');
    await page.waitForSelector('.konvajs-content canvas', { state: 'attached' });
    await enter3D(page);
    await awaitStage(page);
    await expect(page.locator('[data-testid="view3d-selection"]')).toHaveCount(0);

    // 5. Tap the body → selected in the plan; the card names it; Turn ↻
    //    and R both write the SAME plan rotation (Sims build mode).
    const on = await itemPoint(page, 'i1');
    expect(on).not.toBeNull();
    await page.mouse.click(on!.x, on!.y);
    await expect(page.locator('[data-testid="view3d-selection"]')).toContainText('NordicTrack');
    await expect(page.locator('[data-testid="view3d-rotation"]')).toHaveText('0°');
    await page.locator('[data-testid="view3d-rotate"]').click();
    await expect.poll(async () => (await items(page))[0].rotation).toBe(90);
    await expect(page.locator('[data-testid="view3d-rotation"]')).toHaveText('90°');
    await page.locator('[data-testid="view3d-rotate-ccw"]').click();
    await expect.poll(async () => (await items(page))[0].rotation).toBe(0);
    await page.keyboard.press('r');
    await expect.poll(async () => (await items(page))[0].rotation).toBe(90);

    // 6. Drag it 1 m east across the floor: the move lands through the plan's
    //    resolver, on the grid — so x is exactly +1 (the seed is on the grid).
    const before = (await items(page))[0];
    const start = (await itemPoint(page, 'i1'))!;
    const startFloor = (await floorAt(page, start.x, start.y))!;
    expect(startFloor).not.toBeNull();
    const end = (await floorPoint(page, startFloor.x + 1, startFloor.y))!;
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    for (let i = 1; i <= 8; i++) await page.mouse.move(start.x + ((end.x - start.x) * i) / 8, start.y + ((end.y - start.y) * i) / 8);
    await page.mouse.up();
    await expect.poll(async () => (await items(page))[0].x).toBeCloseTo(before.x + 1, 5);
    expect((await items(page))[0].y).toBeCloseTo(before.y, 5);
    // The camera did not orbit for a carry: the item is still where it was aimed.
    await expect(page.locator('[data-testid="view3d-selection"]')).toContainText('NordicTrack');

    // 7. Arm a product from the dock under the room, tap the floor: placed there.
    //    The catalogue starts collapsed: in 3D it opens from the Furnish mode.
    await openCatalog(page);
    const tile = page.locator('[data-testid="dock-strip"] [data-product-id="demo-floor-lamp"]');
    await tile.scrollIntoViewIfNeeded();
    await tile.click();
    await expect(tile).toHaveAttribute('data-armed', 'true');
    await expect(page.locator('[data-testid="wallpaint-3d-overlay"] [data-testid="wallpaint-3d-caption"]')).toContainText('Tap the floor');
    const spot = (await floorPoint(page, 4.0, 3.0))!;
    await page.mouse.click(spot.x, spot.y);
    await expect.poll(async () => (await items(page)).filter((i) => i.productId === 'demo-floor-lamp').length).toBe(1);
    const lamp = (await items(page)).find((i) => i.productId === 'demo-floor-lamp')!;
    // Centred on the tap (0.4 m base), within a grid step.
    expect(Math.abs(lamp.x + 0.2 - 4.0)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(lamp.y + 0.2 - 3.0)).toBeLessThanOrEqual(0.5);
    await expect(tile).toHaveAttribute('data-armed', 'false');
    // The new body is on the stage.
    await expect.poll(async () => (await bridge(page))?.keys.some((k) => k.startsWith('item-') && k !== 'item-i1')).toBe(true);
  });
});

test.describe('3D Mode — phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('the strip button opens the room without the menu; Plan returns', async ({ page }) => {
    await seed(page);
    await page.goto('/designer');
    await page.waitForSelector('.konvajs-content canvas', { state: 'attached' });
    const enter = page.locator('[data-testid="view-mode-3d-phone"]');
    await expect(enter).toBeVisible();
    await expect(enter).toContainText('3D');
    await enter.tap();
    const overlay = page.locator('[data-testid="wallpaint-3d-overlay"]');
    await expect(overlay).toBeVisible();
    const box = (await overlay.boundingBox())!;
    expect(box.width).toBe(390);
    expect(box.y).toBeGreaterThan(40);
    await awaitStage(page);
    await expect(enter).toContainText('Plan');
    await enter.tap();
    await expect(overlay).toHaveCount(0);
  });

  test('the sheet row opens the room edge to edge under the header; Plan returns', async ({ page }) => {
    await seed(page);
    await page.goto('/designer');
    await page.waitForSelector('.konvajs-content canvas', { state: 'attached' });
    await page.getByRole('button', { name: 'Open menu' }).tap();
    await page.locator('[data-testid="view-mode-3d-mobile"]').tap();
    const overlay = page.locator('[data-testid="wallpaint-3d-overlay"]');
    await expect(overlay).toBeVisible();
    const box = (await overlay.boundingBox())!;
    expect(box.width).toBe(390);
    expect(box.y).toBeGreaterThan(40); // under the 56 px strip
    await awaitStage(page);
    await page.locator('[data-testid="wallpaint-3d-close"]').tap();
    await expect(overlay).toHaveCount(0);
  });
});
