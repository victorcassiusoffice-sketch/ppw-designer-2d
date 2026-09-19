/**
 * THE SIMS PAINT TOOL IN 3D (2026-09-17) — Vic: "The Paint tool cannot paint
 * the wall properly like in the game, it needs to function the same as the
 * 2D back end etc but the front end like The Sims 1 but with more realistic
 * identical images."
 *
 * Pins (all through the ONE 2D back end — `ppw_property_v2` wallPaint):
 *   1. the hovered wall previews the BRUSH colour (not a glow) and, once
 *      clicked, keeps it: the material is the brush hex and the rendered
 *      pixel is that colour, lit (no filmic remap) — a visible paint;
 *   2. bare plaster is not white: the default white brush is a visible step;
 *   3. a mouse drag along two walls paints both; Shift-click paints the
 *      whole room; Ctrl-click strips one wall;
 *   4. what is under the cursor is what gets hit: a body in front of a
 *      wall blocks the brush;
 *   5. Walls Up stands the near walls (no stubs); Walls Down cuts them all;
 *   6. a merchant-catalog product (API id `m-…`, the production path)
 *      wears its 3D body — the box bug Vic saw on production.
 *
 * Runs on a dev server (the bridge is DEV-only): PPW_E2E_BASE_URL=http://127.0.0.1:5199
 */
import { test, expect, type Page } from '@playwright/test';

const ROOM = {
  id: 'r1',
  name: 'Room 1',
  polygon: [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 4 }, { x: 0, y: 4 }],
  openings: [],
  placedItems: [] as Array<{ instanceId: string; productId: string; x: number; y: number; rotation: number }>,
};

type Hit = { kind: 'edge'; roomId: string; edgeIndex: number };
type Pt = { x: number; y: number } | null;
interface Bridge {
  backend: () => string;
  faceCount: () => number;
  faces: () => Array<{ key: string; holes: number }>;
  wallScreenPoint: (h: Hit) => Pt;
  hitAt: (x: number, y: number) => Hit | null;
  itemScreenPoint: (id: string) => Pt;
  wallMaterial: (h: Hit) => { hex: string; baseHex: string; finish: string | null; roughness: number; show: string } | null;
  samplePixel: (x: number, y: number) => { r: number; g: number; b: number } | null;
}
// Inside page.evaluate only what the page has exists — spell the bridge out each time.

async function seed(page: Page, room: typeof ROOM = ROOM, ui: Record<string, unknown> = {}): Promise<void> {
  await page.addInitScript(
    ({ p, ui }) => {
      if (localStorage.getItem('__ppw_seeded') === '1') return;
      localStorage.clear();
      localStorage.setItem('__ppw_seeded', '1');
      localStorage.setItem('ppw_designer_coach_v1', '1');
      localStorage.setItem('ppw_property_v2', JSON.stringify({ state: { property: p, showGrid: true, pxPerMetre: 100 }, version: 2 }));
      if (Object.keys(ui).length) localStorage.setItem('ppw_designer_ui_v2', JSON.stringify({ state: ui, version: 2 }));
    },
    { p: { id: 'p', name: 'Vic', activeRoomId: 'r1', rooms: [room], wallHeightM: 2.7 }, ui },
  );
}

async function open3DWithPaint(page: Page): Promise<void> {
  await page.goto('/designer');
  await page.waitForSelector('.konvajs-content canvas', { state: 'attached' });
  await page.locator('[data-testid="view-mode-3d"]').click();
  await expect(page.locator('[data-testid="wallpaint-3d-overlay"]')).toBeVisible();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __ppwRoomView3d: Bridge }).__ppwRoomView3d.faceCount()), { timeout: 20_000 }).toBeGreaterThan(0);
  expect(await page.evaluate(() => (window as unknown as { __ppwRoomView3d: Bridge }).__ppwRoomView3d.backend())).toBe('gl');
  await page.locator('[data-testid="wallpaint-tool-toggle"]').click();
  await page.waitForSelector('[data-testid="wallpaint-palette"]');
}

const wallPoint = (page: Page, edgeIndex: number) => page.evaluate((e) => (window as unknown as { __ppwRoomView3d: Bridge }).__ppwRoomView3d.wallScreenPoint({ kind: 'edge', roomId: 'r1', edgeIndex: e }), edgeIndex);
const material = (page: Page, edgeIndex: number) => page.evaluate((e) => (window as unknown as { __ppwRoomView3d: Bridge }).__ppwRoomView3d.wallMaterial({ kind: 'edge', roomId: 'r1', edgeIndex: e }), edgeIndex);
const pixel = (page: Page, x: number, y: number) => page.evaluate(([a, b]) => (window as unknown as { __ppwRoomView3d: Bridge }).__ppwRoomView3d.samplePixel(a, b), [x, y] as [number, number]);
const paintedEdges = (page: Page) =>
  page.evaluate(() => (JSON.parse(localStorage.getItem('ppw_property_v2')!).state.property.rooms[0].wallPaint ?? []).map((e: { edgeIndex: number }) => e.edgeIndex).sort());

function hexToRgb(hex: string): [number, number, number] {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}

test.describe('The Sims paint tool in 3D — desktop', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('hover previews the brush on the wall; the click keeps it; the pixel IS the colour; plaster is a visible step', async ({ page }) => {
    await seed(page);
    await open3DWithPaint(page);
    // Bronze on the brush (Sofap à la carte).
    await page.locator('[data-testid="wallpaint-colour-sofap-alc-bronze"]').click();
    await expect(page.locator('[data-testid="wallpaint-colour-name"]')).toHaveText('Bronze');
    const bronze = '#4C493F';

    const before = await material(page, 0);
    expect(before?.baseHex).not.toBe(bronze);
    const plaster = before!.baseHex;
    // 2. Bare plaster is a visible step below every white paint.
    expect(hexToRgb(plaster)[0]).toBeLessThan(0xe0);

    // 1. Hover: the material shows the brush, the store is untouched.
    const pt = (await wallPoint(page, 0))!;
    await page.mouse.move(pt.x, pt.y);
    await page.waitForTimeout(150);
    expect((await material(page, 0))?.hex).toBe(bronze);
    expect(await paintedEdges(page)).toEqual([]);
    // Leave: the wall is plaster again.
    await page.mouse.move(pt.x, pt.y - 400);
    await page.waitForTimeout(150);
    expect((await material(page, 0))?.hex).toBe(plaster);

    // Click: painted in the ONE store, and the rendered pixel is Bronze, lit.
    await page.mouse.click(pt.x, pt.y);
    await expect.poll(() => paintedEdges(page)).toEqual([0]);
    // The caption names what happened, for a moment.
    await expect(page.locator('[data-testid="wallpaint-3d-overlay"] [data-testid="wallpaint-3d-caption"]')).toContainText('Bronze');
    await page.mouse.move(pt.x, pt.y - 400);
    await page.waitForTimeout(200);
    const m = (await material(page, 0))!;
    expect(m.baseHex).toBe(bronze);
    expect(m.hex).toBe(bronze);
    expect(m.finish).toBe('matt');
    const px = (await pixel(page, pt.x, pt.y))!;
    const [r, g, b] = hexToRgb(bronze);
    // No tone mapping: the wall renders its hex times the light on it (0.8–1.0), hue intact.
    for (const [got, want] of [[px.r, r], [px.g, g], [px.b, b]] as Array<[number, number]>) {
      expect(got).toBeGreaterThanOrEqual(Math.floor(want * 0.78));
      expect(got).toBeLessThanOrEqual(Math.ceil(want * 1.04) + 3);
    }
  });

  test('a drag along two walls paints both; Shift-click paints the room; Ctrl-click strips one', async ({ page }) => {
    await seed(page);
    await open3DWithPaint(page);
    // 3a. Drag from the north wall (edge 0) to the east wall (edge 1) — both far walls.
    const a = (await wallPoint(page, 0))!;
    const b = (await wallPoint(page, 1))!;
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    for (let i = 1; i <= 10; i++) await page.mouse.move(a.x + ((b.x - a.x) * i) / 10, a.y + ((b.y - a.y) * i) / 10);
    await page.mouse.up();
    await expect.poll(() => paintedEdges(page)).toEqual([0, 1]);
    // 3b. Ctrl-click strips the east wall; the Erase chip stays off.
    await page.keyboard.down('Control');
    await page.mouse.click(b.x, b.y);
    await page.keyboard.up('Control');
    await expect.poll(() => paintedEdges(page)).toEqual([0]);
    await expect(page.locator('[data-testid="wallpaint-erase"]')).toHaveAttribute('aria-pressed', 'false');
    // 3c. Shift-click paints every wall; the scope chip stays on Wall.
    await page.keyboard.down('Shift');
    await page.mouse.click(a.x, a.y);
    await page.keyboard.up('Shift');
    await expect.poll(() => paintedEdges(page)).toEqual([0, 1, 2, 3]);
  });

  test('a body in front of a wall blocks the brush; Walls Up stands the near walls; Walls Down cuts them all', async ({ page }) => {
    // A tall Smith machine against the north wall, mid-wall.
    await seed(page, { ...ROOM, placedItems: [{ instanceId: 'i1', productId: 'k1-vision-smith', x: 1.4, y: 0.1, rotation: 0 }] });
    await open3DWithPaint(page);
    // Let the body arrive (its GLB), then aim at its centre.
    await page.waitForTimeout(2500);
    const on = (await page.evaluate(() => (window as unknown as { __ppwRoomView3d: Bridge }).__ppwRoomView3d.itemScreenPoint('i1')))!;
    const box = (await page.locator('[data-testid="wallpaint-3d-overlay"] [data-testid="wallpaint-3d"]').boundingBox())!;
    expect(on.y).toBeGreaterThan(box.y);
    // 4. The brush over the body finds no wall.
    expect(await page.evaluate(([x, y]) => (window as unknown as { __ppwRoomView3d: Bridge }).__ppwRoomView3d.hitAt(x, y), [on.x, on.y] as [number, number])).toBeNull();
    await page.mouse.click(on.x, on.y);
    await page.waitForTimeout(300);
    expect(await paintedEdges(page)).toEqual([]);

    // 5. Default cutaway: the two near walls are stubs.
    const keys = async () => (await page.evaluate(() => (window as unknown as { __ppwRoomView3d: Bridge }).__ppwRoomView3d.faces())).map((f) => f.key);
    expect((await keys()).filter((k) => k.startsWith('stub-r1-'))).toHaveLength(2);
    await page.locator('[data-testid="view3d-walls-up"]').click();
    await page.waitForTimeout(200);
    expect((await keys()).filter((k) => k.startsWith('stub-r1-'))).toHaveLength(0);
    expect((await keys()).filter((k) => k.startsWith('wall-r1-'))).toHaveLength(4);
    await expect(page.locator('[data-testid="view3d-walls-up"]')).toHaveAttribute('aria-pressed', 'true');
    // The near wall can now be painted like any other.
    const near = (await wallPoint(page, 2))!;
    await page.mouse.click(near.x, near.y);
    await expect.poll(() => paintedEdges(page)).toEqual([2]);
    await page.locator('[data-testid="view3d-walls-down"]').click();
    await page.waitForTimeout(200);
    expect((await keys()).filter((k) => k.startsWith('stub-r1-'))).toHaveLength(4);
    await page.locator('[data-testid="view3d-walls-cutaway"]').click();
    await page.waitForTimeout(200);
    expect((await keys()).filter((k) => k.startsWith('stub-r1-'))).toHaveLength(2);
  });

  test('a merchant-catalog product (API id) placed from the dock wears its 3D body — the production box bug', async ({ page }) => {
    // The production catalog: /api/products delivers the K1 range under
    // merchant ids and the bundled twin is hidden by SKU. Mock ONE row.
    await page.route('**/api/products*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          total: 1,
          products: [
            {
              id: 6,
              sku: 'K1-CDIO-NT2450',
              name: 'NordicTrack Commercial 2450 Treadmill',
              category: 'fitness',
              description: null,
              widthMm: 2050,
              depthMm: 950,
              heightMm: 1650,
              weightG: 0,
              priceMinor: 100000,
              currency: 'MUR',
              imageUrl: null,
              topdownImageUrl: '/products/topdown/k1-nordictrack-2450.webp',
              region: 'MU',
            },
          ],
        }),
      }),
    );
    await seed(page);
    await page.goto('/designer');
    await page.waitForSelector('.konvajs-content canvas', { state: 'attached' });
    const tile = page.locator('[data-testid="dock-strip"] [data-product-id="m-6"]');
    await expect(tile).toBeVisible();
    await expect(page.locator('[data-testid="dock-strip"] [data-product-id="k1-nordictrack-2450"]')).toHaveCount(0);
    // Arm it and place it in the room through the plan (the user's path).
    await tile.click();
    await expect(tile).toHaveAttribute('data-armed', 'true');
    const canvas = (await page.locator('.konvajs-content').boundingBox())!;
    await page.mouse.move(canvas.x + canvas.width / 2, canvas.y + canvas.height / 2, { steps: 6 });
    await page.mouse.click(canvas.x + canvas.width / 2, canvas.y + canvas.height / 2);
    await expect
      .poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('ppw_property_v2')!).state.property.rooms[0].placedItems.map((i: { productId: string }) => i.productId)))
      .toEqual(['m-6']);
    // 6. In 3D the body is fetched and drawn — not a box. (A request
    // listener, not the resource timeline: a dev server's module flood
    // fills that buffer long before the GLB.)
    const glb = page.waitForRequest((req) => /\/models\/k1-nordictrack-2450\.glb/.test(req.url()), { timeout: 20_000 });
    await page.locator('[data-testid="view-mode-3d"]').click();
    await expect(page.locator('[data-testid="wallpaint-3d-overlay"]')).toBeVisible();
    await glb;
    await expect.poll(() => page.evaluate(() => (window as unknown as { __ppwRoomView3d: Bridge }).__ppwRoomView3d.faceCount()), { timeout: 20_000 }).toBeGreaterThan(0);
    // The stage drew the body, not the box: a body carries thousands of triangles.
    await expect
      .poll(() => page.evaluate(() => Number((/tris=(\d+)/.exec((window as unknown as { __ppwRoomView3d: { debug: () => { renderer: string } } }).__ppwRoomView3d.debug().renderer) ?? [])[1] ?? 0)), { timeout: 20_000 })
      .toBeGreaterThan(5000);
  });
});
