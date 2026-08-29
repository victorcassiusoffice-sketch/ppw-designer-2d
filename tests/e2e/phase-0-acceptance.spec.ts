/**
 * Phase 0 acceptance — M1/M2/M3/M5+M5.b live on designer.ppwellness.co.
 *
 * Bundles brutal-status acceptance criteria c/d/e/f from
 * `_handoff/MEGA-GOAL-DEPLOY-IMAGEBLASTER-SIMS-2026-05-21.md` and
 * writes screenshots to `_handoff/preview/prod-deploy-2026-05-21/`
 * (criterion g).
 *
 * Uses `addInitScript` to set the CoachMark seen-flag BEFORE any page
 * load — the production designer pops a tutorial dialog on first visit
 * that intercepts pointer events and blocks every test click.
 */
import { test, expect } from '@playwright/test';
import * as path from 'node:path';

const SHOT_DIR =
  process.env.PPW_PHASE0_SHOT_DIR ??
  path.resolve(
    process.cwd(),
    '..',
    'PPW-Second-Brain',
    '06-Roadmap',
    '_handoff',
    'preview',
    'prod-deploy-2026-05-21',
  );

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try {
      window.localStorage.setItem('ppw_designer_coach_v1', '1');
      window.localStorage.removeItem('ppw_walls_v1');
      window.localStorage.removeItem('ppw_merchant_session_v1');
    } catch {
      // ignore
    }
  });
});

test('c) M1 — click catalog card + click canvas → ITEMS PLACED = 1', async ({ page }) => {
  await page.goto('/designer?fresh=1');
  const itemsPlaced = page.locator('[data-testid="items-placed"]');
  await expect(itemsPlaced).toBeVisible({ timeout: 15_000 });

  // Blank-canvas-on-open (Vic 2026-06-09, hardened 2026-08-25 - see
  // propertyStore.makeBlankRoom): a fresh designer has no DRAWN room, so a
  // placement click is correctly refused with "Drop it inside a room". Seed
  // the room via the app's own one-click affordance, then assert the start
  // prompt is gone - that is the room actually existing.
  await page.locator('[data-testid="start-quick-rectangle"]').click();
  await expect(page.locator('[data-testid="start-room-prompt"]')).toHaveCount(0);

  const card = page.locator('[data-product-id]').first();
  await expect(card).toBeVisible();
  await card.click();

  const stage = page.locator('.konva-stage').first();
  const box = await stage.boundingBox();
  if (!box) throw new Error('Stage has no layout box');
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy, { steps: 8 });
  await page.mouse.down();
  await page.mouse.up();

  await expect(itemsPlaced).toHaveText('1', { timeout: 10_000 });
  await page.screenshot({ path: path.join(SHOT_DIR, 'c-m1-placement.png'), fullPage: true });
});

test('d) M5+M5.b — /merchant/demo-supplier-cn renders sign-in form (not designer)', async ({ page, request }) => {
  await page.goto('/merchant/demo-supplier-cn');

  // The sign-in form is the only fallback when no merchant session exists.
  // Specific tells: the "Merchant sign-in" heading, an email input, a
  // submit button calling /api/merchants/.../magic-link.
  await expect(page.locator('[data-testid="merchant-auth-loading"]')).toHaveCount(0, { timeout: 10_000 });
  const heading = page.getByRole('heading', { name: /merchant sign.?in|sign in|merchant access/i }).first();
  const emailInput = page.locator('input[type="email"]').first();
  await expect(emailInput).toBeVisible({ timeout: 10_000 });
  await expect(heading).toBeVisible();

  // The brutal-status sentinel: konva-stage is the designer fall-through.
  await expect(page.locator('.konva-stage')).toHaveCount(0);

  // Magic-link endpoint should be reachable and return a 2xx without secret leak.
  const mlRes = await request.post('/api/merchants/demo-supplier-cn/magic-link', {
    data: { email: 'phase-0-acceptance@ppwellness.co' },
  });
  expect(mlRes.status()).toBeLessThan(500);

  await page.screenshot({ path: path.join(SHOT_DIR, 'd-m5b-signin.png'), fullPage: true });
});

// RETIRED (2026-08-28): the 3D preview toggle still EXISTS in TopBar.tsx
// (~:632) but renders only when a `setThreeDPreview` prop is supplied, and
// App.tsx no longer supplies one - so the control is unwired at the call site
// and `design-tweak-1-phase-a0.spec.ts` now asserts it has count 0 (Tweak 06,
// deliberate). Skipped rather than deleted: the Babylon path is dormant, not
// removed, so this acceptance criterion is recoverable the moment the toggle
// is wired back up. Un-skip then; do not weaken it.
test.skip('e) M3 — place 1 item in 2D, switch to BABYLON → 1 product mesh', async ({ page }) => {
  await page.goto('/designer?fresh=1');
  const card = page.locator('[data-product-id]').first();
  await expect(card).toBeVisible({ timeout: 15_000 });
  await card.click();
  const stage = page.locator('.konva-stage').first();
  const box = await stage.boundingBox();
  if (!box) throw new Error('Stage missing layout box');
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy, { steps: 8 });
  await page.mouse.click(cx, cy);
  await expect(page.locator('[data-testid="items-placed"]')).toHaveText('1');
  // (Babylon 3D mirror probe removed with the 3D viewer — P1-1 2026-06-04.)
});

test('f) M2 — legacy ppw_walls_v1 walls migrate onto property.walls on mount and survive a reload', async ({ page }) => {
  // Sims world (2026-08-29): the M2 interior-wall tool (`wallStore`, mm,
  // `ppw_walls_v1`, the `wall-draw-hud` / `wall-count` / `room-area` HUD) is
  // RETIRED. "+ Walls" is now the room pen. What remains of the M2 contract
  // is the DATA: anything a customer drew with the old tool must not be lost,
  // so on app mount every legacy mm segment is folded onto the property as a
  // free wall in METRES —
  //   ppw_property_v2 -> state.property.walls[{ a:{x,y}, b:{x,y}, thicknessM }]
  // — and `ppw_walls_v1` is emptied so nothing renders twice.
  const fourWalls = [
    { id: 'w1', start: { x_mm: 0, y_mm: 0 }, end: { x_mm: 4000, y_mm: 0 }, thickness_mm: 100, height_mm: 2700, type: 'full' },
    { id: 'w2', start: { x_mm: 4000, y_mm: 0 }, end: { x_mm: 4000, y_mm: 3000 }, thickness_mm: 100, height_mm: 2700, type: 'full' },
    { id: 'w3', start: { x_mm: 4000, y_mm: 3000 }, end: { x_mm: 0, y_mm: 3000 }, thickness_mm: 100, height_mm: 2700, type: 'full' },
    { id: 'w4', start: { x_mm: 0, y_mm: 3000 }, end: { x_mm: 0, y_mm: 0 }, thickness_mm: 100, height_mm: 2700, type: 'full' },
  ];
  // FIRST-LOAD-ONLY seed. addInitScript re-runs on every navigation, so an
  // unguarded seed would re-plant the legacy store on the reload below and
  // the "ppw_walls_v1 is empty afterwards" assertion would be testing the
  // seed, not the migration.
  await page.addInitScript((walls) => {
    try {
      if (window.localStorage.getItem('__ppw_phase0_walls_seeded') === '1') return;
      window.localStorage.setItem('__ppw_phase0_walls_seeded', '1');
      window.localStorage.setItem('ppw_walls_v1', JSON.stringify(walls));
    } catch { /* ignore */ }
  }, fourWalls);

  const readWalls = () =>
    page.evaluate(() => {
      let walls: Array<{ a: { x: number; y: number }; b: { x: number; y: number }; thicknessM: number }> = [];
      let legacy = -1;
      try {
        const parsed = JSON.parse(window.localStorage.getItem('ppw_property_v2') ?? '{}');
        const w = parsed?.state?.property?.walls;
        walls = Array.isArray(w) ? w : [];
      } catch { /* ignore */ }
      try {
        const raw = window.localStorage.getItem('ppw_walls_v1');
        const parsed = raw ? JSON.parse(raw) : [];
        legacy = Array.isArray(parsed) ? parsed.length : -1;
      } catch { /* ignore */ }
      return { walls, legacy };
    });
  const EXPECTED_EDGES = [
    [0, 0, 4, 0],
    [4, 0, 4, 3],
    [4, 3, 0, 3],
    [0, 3, 0, 0],
  ];
  const asEdges = (walls: Awaited<ReturnType<typeof readWalls>>['walls']) =>
    walls.map((w) => [w.a.x, w.a.y, w.b.x, w.b.y]);

  await page.goto('/designer');
  await page.waitForSelector('[data-testid="items-placed"]', { timeout: 15_000 });

  // Migrated on mount: 4 walls in metres, in the legacy order, 100 mm → 0.1 m.
  await expect.poll(async () => (await readWalls()).walls.length).toBe(4);
  const migrated = await readWalls();
  expect(asEdges(migrated.walls)).toEqual(EXPECTED_EDGES);
  for (const w of migrated.walls) expect(w.thicknessM).toBeCloseTo(0.1, 6);
  // ...and the legacy store was emptied, not merely copied.
  expect(migrated.legacy).toBe(0);

  // Persistence — reload; the property store re-hydrates the 4 walls and the
  // legacy store STAYS empty (the seed above does not re-run).
  await page.reload();
  await page.waitForSelector('[data-testid="items-placed"]', { timeout: 15_000 });
  await expect.poll(async () => (await readWalls()).walls.length).toBe(4);
  const reloaded = await readWalls();
  expect(asEdges(reloaded.walls)).toEqual(EXPECTED_EDGES);
  expect(reloaded.legacy).toBe(0);

  await page.screenshot({ path: path.join(SHOT_DIR, 'f-m2-walls.png'), fullPage: true });
});

test('a/b) capture API health screenshots', async ({ page, baseURL }) => {
  // vite dev does not run Vercel functions - it serves api/*.ts as raw source,
  // so /api/agent-chat returns TypeScript, not JSON. These are PRODUCTION
  // acceptance criteria; route them rather than weakening them, so a localhost
  // run reports "skipped for lack of an API" instead of a false failure.
  test.skip(
    /localhost|127\.0\.0\.1/.test(baseURL ?? ''),
    'API acceptance needs a deployed target (PPW_E2E_BASE_URL=https://designer.ppwellness.co)',
  );
  // Acceptance a — /api/agent-chat
  const agentRes = await page.request.get('/api/agent-chat');
  expect(agentRes.status()).toBe(200);
  const agentJson = await agentRes.json();
  expect(agentJson.openrouterConfigured).toBe(true);
  expect(agentJson.models).toBeTruthy();
  await page.goto('data:application/json,' + encodeURIComponent(JSON.stringify(agentJson, null, 2)));
  await page.screenshot({ path: path.join(SHOT_DIR, 'a-m4-agent-chat.png'), fullPage: true });

  // Acceptance b — /api/products?limit=50
  const prodRes = await page.request.get('/api/products?limit=50');
  expect(prodRes.status()).toBe(200);
  const prodJson = await prodRes.json();
  const k1Count = (prodJson.products ?? []).filter((p: { sku?: string }) => p.sku?.startsWith('K1-')).length;
  expect(k1Count).toBeGreaterThanOrEqual(14);
  await page.goto(
    'data:application/json,' +
      encodeURIComponent(
        JSON.stringify(
          {
            total: prodJson.total,
            k1_count: k1Count,
            first_k1: (prodJson.products ?? []).find((p: { sku?: string }) => p.sku?.startsWith('K1-')),
          },
          null,
          2,
        ),
      ),
  );
  await page.screenshot({ path: path.join(SHOT_DIR, 'b-m6-products.png'), fullPage: true });
});
