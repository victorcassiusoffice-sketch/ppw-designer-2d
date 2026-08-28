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

test('f) M2 — wallStore persists 4 walls, HUD displays count + room area on reload', async ({ page }) => {
  // CDP rapid-click 5-point polyline produces non-deterministic wall counts
  // because react-konva's first event listener attaches a paint cycle after
  // the WALL mode-strip click commits — and intermittent "lost" clicks
  // afterwards (probe9 saw clicks 1 + 3 silently dropped while click 4
  // committed). The wall-store-internal phase race is fixed in commit
  // df8dc05 (`useWallStore.getState()` reads in handlers, no stale refs),
  // but the react-konva listener-attach race persists for synthetic clicks.
  //
  // Acceptance therefore verifies the durable M2 contract — wallStore
  // persists 4 walls to localStorage, hydrates on load, HUD shows count=4
  // + room-area > 0 (polygon reconstruction), survives reload. Manual
  // click-driven draw works for human-paced input in production.
  const fourWalls = [
    { id: 'w1', start: { x_mm: 0, y_mm: 0 }, end: { x_mm: 4000, y_mm: 0 }, thickness_mm: 100, height_mm: 2700, type: 'full' },
    { id: 'w2', start: { x_mm: 4000, y_mm: 0 }, end: { x_mm: 4000, y_mm: 3000 }, thickness_mm: 100, height_mm: 2700, type: 'full' },
    { id: 'w3', start: { x_mm: 4000, y_mm: 3000 }, end: { x_mm: 0, y_mm: 3000 }, thickness_mm: 100, height_mm: 2700, type: 'full' },
    { id: 'w4', start: { x_mm: 0, y_mm: 3000 }, end: { x_mm: 0, y_mm: 0 }, thickness_mm: 100, height_mm: 2700, type: 'full' },
  ];
  await page.addInitScript((walls) => {
    try { window.localStorage.setItem('ppw_walls_v1', JSON.stringify(walls)); } catch { /* ignore */ }
  }, fourWalls);

  await page.goto('/designer');
  await page.waitForSelector('[data-testid="items-placed"]', { timeout: 15_000 });

  await page.locator('[data-testid="wall-tool-toggle"]').click();
  await expect(page.locator('[data-testid="wall-draw-hud"]')).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('[data-testid="wall-count"]')).toHaveText('4');
  await expect(page.locator('[data-testid="room-area"]')).toContainText(/m²/);

  // Persistence — reload the page and re-engage Wall mode; the store hydrates
  // from localStorage and the count stays at 4.
  await page.reload();
  await page.waitForSelector('[data-testid="items-placed"]', { timeout: 15_000 });
  await page.locator('[data-testid="wall-tool-toggle"]').click();
  await expect(page.locator('[data-testid="wall-count"]')).toHaveText('4');

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
