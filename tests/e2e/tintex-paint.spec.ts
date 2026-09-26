/**
 * TINTEX PAINTS (2026-09-19) — Vic: "add 5 different paint products from
 * tintex in mauritius, make sure the texture etc is super accurate."
 *
 * Pins:
 *   1. `/designer?demo=tintex` opens the painted show flat with the panel on
 *      TintEX only: five lines (VIP Satin, Mastertop, Cashmere, True White
 *      Matt, Trade Pro), no Sofap row, the brand card naming its Tint Match
 *      system and the 2021 price date, the assumptions line saying VAT is
 *      unconfirmed and where the prices came from;
 *   2. the lines say what they are: Cashmere's spread rate is "(est.)"
 *      because TintEX publishes none; Trade Pro takes no tint;
 *   3. the chart is RAL Classic — 216 coded shades on demand — and a RAL
 *      shade goes on the brush by name;
 *   4. the finish is real on the 3D stage: VIP Satin paints a SATIN
 *      material (sheen, lower roughness), True White a MATT one, both
 *      through the ONE 2D back end (`ppw_property_v2` wallPaint);
 *   5. with no demo the panel offers BOTH brands as chips and switching
 *      swaps the lines and the chart name.
 *
 * Runs on a dev server (the 3D bridge is DEV-only): PPW_E2E_BASE_URL=http://127.0.0.1:5199
 *
 * Patience: on the runner's software GPU (SwiftShader) the show flat's first
 * frame compiles a shader variant per finish (matt / silk / satin walls, the
 * floors, nine decor bodies) and blocks the page for 20–30 s — the trace of
 * the first run shows the second `faceCount()` evaluate returning after the
 * 30 s default timeout. A real GPU does it in a frame. Hence the long
 * timeouts here; they are not slack in the product.
 */
import { test, expect, type Page } from '@playwright/test';

test.describe.configure({ timeout: 180_000 });
const STAGE_TIMEOUT = 90_000;

type Hit = { kind: 'edge'; roomId: string; edgeIndex: number };
type Pt = { x: number; y: number } | null;
interface Bridge {
  backend: () => string;
  faceCount: () => number;
  wallScreenPoint: (h: Hit) => Pt;
  hitAt: (x: number, y: number) => Hit | null;
  wallMaterial: (h: Hit) => { hex: string; baseHex: string; finish: string | null; roughness: number; show: string } | null;
}
// Inside page.evaluate only what the page has exists — spell the bridge out each time.

const ROOM = {
  id: 'r1',
  name: 'Room 1',
  polygon: [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 4 }, { x: 0, y: 4 }],
  openings: [],
  placedItems: [],
};

async function seed(page: Page): Promise<void> {
  await page.addInitScript(
    (p) => {
      if (localStorage.getItem('__ppw_seeded') === '1') return;
      localStorage.clear();
      localStorage.setItem('__ppw_seeded', '1');
      localStorage.setItem('ppw_designer_coach_v1', '1');
      localStorage.setItem('ppw_property_v2', JSON.stringify({ state: { property: p, showGrid: true, pxPerMetre: 100 }, version: 2 }));
    },
    { id: 'p', name: 'Vic', activeRoomId: 'r1', rooms: [ROOM], wallHeightM: 2.7 },
  );
}

async function armPaintIn3D(page: Page): Promise<void> {
  await page.waitForSelector('.konvajs-content canvas', { state: 'attached', timeout: 30_000 });
  // The 3D-first shell (2026-09-23) opens furnished / demo plans straight in
  // 3D; a click on the Plan-bar switch under the overlay is intercepted, so
  // only switch when Plan is showing.
  const overlay = page.locator('[data-testid="wallpaint-3d-overlay"]');
  if (!(await overlay.isVisible())) await page.locator('[data-testid="view-mode-3d"]').click();
  await expect(overlay).toBeVisible();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __ppwRoomView3d: Bridge }).__ppwRoomView3d.faceCount()), { timeout: STAGE_TIMEOUT }).toBeGreaterThan(0);
  expect(await page.evaluate(() => (window as unknown as { __ppwRoomView3d: Bridge }).__ppwRoomView3d.backend())).toBe('gl');
  // The House Studio shell (2026-09-26): the plan toolbar and its
  // `wallpaint-tool-toggle` are inert under the overlay; the brush is armed
  // from the rail's Paint mode. The rail button toggles, so it is pressed
  // only while the palette is closed.
  const palette = page.locator('[data-testid="wallpaint-palette"]');
  if (!(await palette.isVisible())) await overlay.locator('[data-testid="house-mode-paint"]').click();
  await expect(palette).toBeVisible();
}

const material = (page: Page, roomId: string, edgeIndex: number) =>
  page.evaluate(([r, e]) => (window as unknown as { __ppwRoomView3d: Bridge }).__ppwRoomView3d.wallMaterial({ kind: 'edge', roomId: r, edgeIndex: e }), [roomId, edgeIndex] as [string, number]);

/**
 * A screen point on a FULL-height wall of the room whose hit test lands on
 * THAT wall (the first such edge, `skip` excluded). Cutaway stubs and shared
 * walls whose other face wins the ray are passed over: in the show flat the
 * living room's far wall has a window at its centroid, its bottom wall is
 * hidden behind the bedroom's face and its left wall is a near-camera stub —
 * a click on a stub can land on the full wall behind it while the stage is
 * still settling, which is a test hazard, not a paint-tool fault.
 */
async function paintableWall(page: Page, roomId: string, skip: number[] = []): Promise<{ edgeIndex: number; x: number; y: number }> {
  for (let edgeIndex = 0; edgeIndex < 4; edgeIndex++) {
    if (skip.includes(edgeIndex)) continue;
    const found = await page.evaluate(
      ([r, e]) => {
        const b = (window as unknown as { __ppwRoomView3d: Bridge }).__ppwRoomView3d;
        const hit0 = { kind: 'edge' as const, roomId: r, edgeIndex: e };
        if (b.wallMaterial(hit0)?.show !== 'full') return null;
        const pt = b.wallScreenPoint(hit0);
        if (!pt) return null;
        const hit = b.hitAt(pt.x, pt.y);
        return hit && hit.kind === 'edge' && hit.roomId === r && hit.edgeIndex === e ? pt : null;
      },
      [roomId, edgeIndex] as [string, number],
    );
    if (found) return { edgeIndex, ...found };
  }
  throw new Error(`no paintable full wall in ${roomId}`);
}

/** Hover first (the brush preview settles), then click — what a person does. */
async function clickWall(page: Page, at: { x: number; y: number }): Promise<void> {
  await page.mouse.move(at.x, at.y);
  await page.waitForTimeout(150);
  await page.mouse.click(at.x, at.y);
}

const wallPaintOf = (page: Page, roomId: string, edgeIndex: number) =>
  page.evaluate(
    ([r, e]) => {
      const rooms = JSON.parse(localStorage.getItem('ppw_property_v2')!).state.property.rooms as Array<{ id: string; wallPaint?: Array<{ edgeIndex: number; paintId: string; colourHex?: string; colourName?: string }> }>;
      return rooms.find((x) => x.id === r)?.wallPaint?.find((w) => w.edgeIndex === e) ?? null;
    },
    [roomId, edgeIndex] as [string, number],
  );

test.describe('TintEX paints — desktop', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('the TintEX show flat: five lines, no Sofap, the card and the caveats say what they are', async ({ page }) => {
    await page.goto('/designer?demo=tintex');
    await page.waitForSelector('.konvajs-content canvas', { state: 'attached', timeout: 30_000 });
    await page.waitForTimeout(800);
    await armPaintIn3D(page);

    // One brand in a paint company's pitch → no chips; the card names it.
    await expect(page.locator('[data-testid="wallpaint-brands"]')).toHaveCount(0);
    const card = page.locator('[data-testid="wallpaint-brand-card"]');
    await expect(card).toContainText('TintEX');
    await expect(card).toContainText('RAL K7');
    await expect(card).toContainText('prices 2021-11-27');

    // The five lines, and not one Permoglaze row.
    for (const id of ['tintex-vip-satin', 'tintex-mastertop', 'tintex-cashmere', 'tintex-true-white-matt', 'tintex-trade-pro']) {
      await expect(page.locator(`[data-testid="wallpaint-${id}"]`)).toBeVisible();
    }
    await expect(page.locator('[data-testid^="wallpaint-permoglaze-"]')).toHaveCount(0);
    // The pitch opens with the brand's first line on the brush.
    await expect(page.locator('[data-testid="wallpaint-tintex-vip-satin"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('[data-testid="wallpaint-tintex-vip-satin"]')).toContainText('satin · 11 m²/L');
    await expect(page.locator('[data-testid="wallpaint-tintex-cashmere"]')).toContainText('10 m²/L (est.)');
    await expect(page.locator('[data-testid="wallpaint-tintex-true-white-matt"]')).toContainText('matt · 8.5 m²/L');

    // Caveats: VAT unstated, prices from the Wayback capture.
    const assumptions = page.locator('[data-testid="wallpaint-assumptions"]');
    await expect(assumptions).toContainText('VAT status not confirmed');
    await expect(assumptions).toContainText('Wayback');

    // The chart is RAL Classic, 216 coded shades.
    const toggle = page.locator('[data-testid="wallpaint-chart-toggle"]');
    await expect(toggle).toHaveText(/All RAL Classic shades/);
    await toggle.click();
    await expect(page.locator('[data-testid="wallpaint-chart-grid"] [data-testid^="wallpaint-colour-ral-"]')).toHaveCount(216);
    await page.locator('[data-testid="wallpaint-chart-grid"] [data-testid="wallpaint-colour-ral-7035"]').click();
    await expect(page.locator('[data-testid="wallpaint-colour-name"]')).toHaveText('Light grey');

    // Trade Pro takes no tint.
    await page.locator('[data-testid="wallpaint-tintex-trade-pro"]').click();
    await expect(page.locator('[data-testid="wallpaint-colours-none"]')).toBeVisible();
    await page.locator('[data-testid="wallpaint-tintex-vip-satin"]').click();
  });

  test('VIP Satin paints a satin wall, True White a matt one — on the stage, through the 2D store', async ({ page }) => {
    await page.goto('/designer?demo=tintex');
    await page.waitForSelector('.konvajs-content canvas', { state: 'attached', timeout: 30_000 });
    await page.waitForTimeout(800);
    await armPaintIn3D(page);

    // The show flat already wears its lines on the stage: living = VIP Satin
    // (satin), bedroom = Cashmere (silk), kitchen = Mastertop (silk).
    expect((await material(page, 'living', 0))?.finish).toBe('satin');
    expect((await material(page, 'kitchen', 0))?.finish).toBe('silk');
    const wallA = await paintableWall(page, 'bedroom');
    const before = (await material(page, 'bedroom', wallA.edgeIndex))!;
    expect(before.finish).toBe('silk');

    // Brush: VIP Satin in RAL 7035 Light grey → that bedroom wall is the grey, satin.
    await page.locator('[data-testid="wallpaint-tintex-vip-satin"]').click();
    await page.locator('[data-testid="wallpaint-colour-ral-7035"]').click();
    await expect(page.locator('[data-testid="wallpaint-colour-name"]')).toHaveText('Light grey');
    await clickWall(page, wallA);
    await expect.poll(() => wallPaintOf(page, 'bedroom', wallA.edgeIndex)).toMatchObject({ paintId: 'tintex-vip-satin', colourName: 'Light grey' });
    const stored = (await wallPaintOf(page, 'bedroom', wallA.edgeIndex))!;
    expect(stored.colourHex).toMatch(/^#[0-9A-F]{6}$/);
    await page.mouse.move(wallA.x, wallA.y - 400);
    await page.waitForTimeout(200);
    const satin = (await material(page, 'bedroom', wallA.edgeIndex))!;
    expect(satin.baseHex).toBe(stored.colourHex);
    expect(satin.finish).toBe('satin');
    // The breakdown prices that wall on TintEX's Pastel Shades band (estimated from the depth:
    // TintEX names no band per colour) and shows the 2021 white for the untinted walls.
    await page.locator('[data-testid="wallpaint-breakdown-toggle"]').click();
    const body = page.locator('[data-testid="wallpaint-breakdown-body"]');
    await expect(body).toContainText('Light grey');
    await expect(body).toContainText('Pastel Shades (estimated from the colour depth)');
    await expect(body).toContainText('11 m²/L');
    await page.locator('[data-testid="wallpaint-breakdown-toggle"]').click();

    // True White Matt on the next bedroom wall → a matt material, rougher than the satin.
    await page.locator('[data-testid="wallpaint-tintex-true-white-matt"]').click();
    const wallB = await paintableWall(page, 'bedroom', [wallA.edgeIndex]);
    await clickWall(page, wallB);
    await expect.poll(() => wallPaintOf(page, 'bedroom', wallB.edgeIndex)).toMatchObject({ paintId: 'tintex-true-white-matt' });
    await page.mouse.move(wallB.x, wallB.y - 400);
    await page.waitForTimeout(200);
    const matt = (await material(page, 'bedroom', wallB.edgeIndex))!;
    expect(matt.finish).toBe('matt');
    expect(matt.roughness).toBeGreaterThan(satin.roughness);
    expect(satin.roughness).toBeLessThan(0.8);
    expect(matt.roughness).toBeGreaterThanOrEqual(0.9);
    // The caption named the line.
    await expect(page.locator('[data-testid="wallpaint-3d-overlay"] [data-testid="wallpaint-3d-caption"]')).toContainText('True White');
  });

  test('no demo: both brands as chips; TintEX swaps the lines and the chart name', async ({ page }) => {
    await seed(page);
    await page.goto('/designer');
    await armPaintIn3D(page);
    const sofap = page.locator('[data-testid="wallpaint-brand-sofap"]');
    const tintex = page.locator('[data-testid="wallpaint-brand-tintex"]');
    await expect(sofap).toHaveAttribute('aria-checked', 'true');
    await expect(tintex).toHaveAttribute('aria-checked', 'false');
    await expect(page.locator('[data-testid="wallpaint-chart-toggle"]')).toHaveText(/All Colour Match shades/);
    await expect(page.locator('[data-testid="wallpaint-permoglaze-matt-emulsion"]')).toBeVisible();

    await tintex.click();
    await expect(tintex).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator('[data-testid="wallpaint-tintex-vip-satin"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('[data-testid^="wallpaint-permoglaze-"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="wallpaint-chart-toggle"]')).toHaveText(/All RAL Classic shades/);
    await expect(page.locator('[data-testid="wallpaint-brand-card"]')).toContainText('TintEX');
    // The brush follows the brand: the next wall is VIP Satin.
    const wall = await paintableWall(page, 'r1');
    await clickWall(page, wall);
    await expect.poll(() => wallPaintOf(page, 'r1', wall.edgeIndex)).toMatchObject({ paintId: 'tintex-vip-satin' });
    expect((await material(page, 'r1', wall.edgeIndex))?.finish).toBe('satin');

    await sofap.click();
    await expect(page.locator('[data-testid="wallpaint-permoglaze-matt-emulsion"]')).toBeVisible();
    await expect(page.locator('[data-testid="wallpaint-chart-toggle"]')).toHaveText(/All Colour Match shades/);
  });
});

test.describe('TintEX paints — phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('the phone sheet lists the five TintEX lines in the TintEX show flat, and the HUD carries RAL chips', async ({ page }) => {
    // The phone sheet and the paint HUD belong to the PLAN experience; a demo
    // opens in 3D by default (2026-09-26), so the URL asks for the plan.
    await page.goto('/designer?demo=tintex&view=2d');
    await page.waitForSelector('.konvajs-content canvas', { state: 'attached', timeout: 30_000 });
    await page.waitForTimeout(800);
    await page.getByRole('button', { name: 'Open menu' }).tap();
    await expect(page.locator('[data-testid="wallpaint-mobile-tintex-vip-satin"]')).toBeVisible();
    await expect(page.locator('[data-testid="wallpaint-mobile-tintex-trade-pro"]')).toBeVisible();
    await expect(page.locator('[data-testid^="wallpaint-mobile-permoglaze-"]')).toHaveCount(0);
    await page.locator('[data-testid="wallpaint-mobile-tintex-cashmere"]').tap();
    const hud = page.locator('[data-testid="wallpaint-hud"]');
    await expect(hud).toBeVisible();
    await expect(hud).toContainText('Cashmere');
    await page.locator('[data-testid="wallpaint-hud-colour-ral-9010"]').tap();
    await expect(page.locator('[data-testid="wallpaint-hud-colour"]')).toHaveText('Pure white');
  });
});
