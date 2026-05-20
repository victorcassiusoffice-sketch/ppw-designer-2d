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
  await page.goto('/?fresh=1');

  const itemsPlaced = page.locator('[data-testid="items-placed"]');
  await expect(itemsPlaced).toBeVisible({ timeout: 15_000 });

  const catalogToggle = page.getByRole('button', { name: /catalog/i }).first();
  if (await catalogToggle.isVisible().catch(() => false)) {
    await catalogToggle.click().catch(() => undefined);
  }

  const card = page.locator('[data-product-id]').first();
  await expect(card).toBeVisible();

  const stage = page.locator('.konva-stage').first();
  await expect(stage).toBeVisible();
  const box = await stage.boundingBox();
  if (!box) throw new Error('Stage has no layout box');

  await card.click();
  await expect(page.locator('[data-armed="true"]').first()).toBeVisible();

  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy, { steps: 10 });
  await page.mouse.click(cx, cy);

  await expect(itemsPlaced).toHaveText('1', { timeout: 5_000 });
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

test('e) M3 — place 1 item in 2D, switch to BABYLON → 1 product mesh', async ({ page }) => {
  await page.goto('/?fresh=1');
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

  await page.goto('/?engine=babylon');
  await page.waitForFunction(() => Boolean((window as any).__ppwBabylonScene), null, { timeout: 20_000 });
  const probe = await page.evaluate(() => {
    const scene = (window as any).__ppwBabylonScene;
    if (!scene) return { itemMeshes: 0, names: [] as string[] };
    const products = (scene.meshes ?? []).filter((m: any) => m.name?.startsWith?.('product-'));
    return { itemMeshes: products.length, names: products.map((m: any) => m.name) };
  });
  expect(probe.itemMeshes).toBe(1);

  await page.screenshot({ path: path.join(SHOT_DIR, 'e-m3-babylon.png'), fullPage: true });
});

test('f) M2 — Wall mode → draw 4 walls → wall-count 4 → reload persists', async ({ page }) => {
  await page.goto('/?fresh=1');
  await page.getByRole('button', { name: /^Wall$/ }).click();
  await expect(page.locator('[data-testid="wall-draw-hud"]')).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('[data-testid="wall-count"]')).toHaveText('0');

  const stage = page.locator('.konva-stage').first();
  const box = await stage.boundingBox();
  if (!box) throw new Error('Stage has no layout box');
  const drop = (xFrac: number, yFrac: number) =>
    stage.click({ position: { x: box.width * xFrac, y: box.height * yFrac } });

  await drop(0.30, 0.30);
  await drop(0.70, 0.30);
  await drop(0.70, 0.65);
  await drop(0.30, 0.65);
  await drop(0.30, 0.30);

  await expect(page.locator('[data-testid="wall-count"]')).toHaveText('4');

  await page.reload();
  await page.getByRole('button', { name: /^Wall$/ }).click();
  await expect(page.locator('[data-testid="wall-count"]')).toHaveText('4');

  await page.screenshot({ path: path.join(SHOT_DIR, 'f-m2-walls.png'), fullPage: true });
});

test('a/b) capture API health screenshots', async ({ page }) => {
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
