/**
 * Sims-Parity DT-10 — capture flow happy-path Playwright smoke.
 *
 * Mocks getUserMedia via a fixture-driven canvas-stream so this spec
 * runs without a real camera. The merchant flow is exercised
 * end-to-end:
 *   1. open the agent → "Add a product" → CaptureModal opens at step `prepare`.
 *   2. click "I've printed it" → camera step → injected stream renders.
 *   3. click shutter → captured frame propagates to calibrate step.
 *   4. confirm corners → dimensions step.
 *   5. type W/D/H → next → side-back → review → Submit.
 *   6. expect 200 from /api/merchants/:slug/capture/calibrate + green check.
 *
 * Skipped on CI until Vic provides:
 *   • PPW_E2E_ADMIN_TOKEN — admin token for merchant approve setup.
 *   • PPW_E2E_MERCHANT_SLUG — approved merchant slug to target.
 *
 * Vic's manual smoke (real camera) is in the Phase A scaffold at
 * `06-Roadmap/user-testing/phase-a/CAPTURE.merchant.md`.
 */

import { test, expect } from '@playwright/test';

test.describe('Sims-Parity DT-10 — capture flow happy path', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(
      !process.env.PPW_E2E_MERCHANT_SLUG,
      'PPW_E2E_MERCHANT_SLUG required to target an approved merchant slug.',
    );

    // Inject a fake getUserMedia + canvas-derived MediaStream so the
    // CameraStage receives bytes deterministically.
    await page.addInitScript(() => {
      const canvas = document.createElement('canvas');
      canvas.width = 1280;
      canvas.height = 1810;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Light-grey background.
        ctx.fillStyle = '#cccccc';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        // White A4-rect placeholder at the centre.
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(100, 200, 1080, 1390);
        // Gold corner crosshairs.
        ctx.strokeStyle = '#C0A67E';
        ctx.lineWidth = 6;
        for (const [x, y] of [[100, 200], [1180, 200], [100, 1590], [1180, 1590]]) {
          ctx.beginPath();
          ctx.moveTo(x - 30, y); ctx.lineTo(x + 30, y);
          ctx.moveTo(x, y - 30); ctx.lineTo(x, y + 30);
          ctx.stroke();
        }
      }
      // Polyfill — replace navigator.mediaDevices.getUserMedia.
      const captureStream = (canvas as HTMLCanvasElement & { captureStream?: (fps: number) => MediaStream }).captureStream;
      const stream = captureStream ? captureStream.call(canvas, 30) : null;
      if (stream) {
        Object.defineProperty(navigator, 'mediaDevices', {
          configurable: true,
          value: {
            getUserMedia: async () => stream,
            enumerateDevices: async () => [],
          },
        });
      }
    });
  });

  test('full Path-1: prepare → camera → calibrate → dims → review → submit', async ({ page }) => {
    const slug = process.env.PPW_E2E_MERCHANT_SLUG!;
    await page.goto(`/merchant/${slug}/agent`);

    // 1. Add product → opens CaptureModal at 'prepare'.
    await page.getByRole('button', { name: /add a product/i }).click();
    await expect(page.getByRole('dialog', { name: /capture product photo/i })).toBeVisible();

    // 2. prepare → camera.
    await page.getByRole('button', { name: /i've printed it/i }).click();
    await expect(page.getByLabel(/camera capture stage/i)).toBeVisible();

    // 3. camera → calibrate (click shutter).
    await page.getByRole('button', { name: /capture photo/i }).click();
    await expect(page.getByRole('img', { name: /draggable corner pins/i })).toBeVisible();

    // 4. calibrate → dimensions (confirm corners — accept default positions).
    await page.getByRole('button', { name: /confirm corners/i }).click();

    // 5. dimensions → side-back → review.
    await page.getByLabel(/width/i).fill('800');
    await page.getByLabel(/depth/i).fill('600');
    await page.getByLabel(/height/i).fill('450');
    await page.getByRole('button', { name: /^next$/i }).click(); // dims → side-back
    await page.getByRole('button', { name: /^skip$/i }).click(); // side-back → review

    // 6. review → submit → expect green-check banner.
    await page.getByRole('button', { name: /submit/i }).click();
    await expect(page.getByText(/scale-lock minted/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: /^done$/i })).toBeEnabled();
  });

  test('reconciliation modal opens at ≥15% width Δ', async ({ page }) => {
    const slug = process.env.PPW_E2E_MERCHANT_SLUG!;
    await page.goto(`/merchant/${slug}/agent`);
    await page.getByRole('button', { name: /add a product/i }).click();
    await page.getByRole('button', { name: /i've printed it/i }).click();
    await page.getByRole('button', { name: /capture photo/i }).click();
    await page.getByRole('button', { name: /confirm corners/i }).click();

    // Type a width far from the calibrated value to trigger reconciliation.
    await page.getByLabel(/width/i).fill('1500');
    await page.getByLabel(/depth/i).fill('600');
    await page.getByLabel(/height/i).fill('450');
    await page.getByRole('button', { name: /^next$/i }).click();

    await expect(page.getByRole('dialog', { name: /reconcile measured vs typed width/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /accept my typed value/i })).toBeDisabled();
    await page.getByPlaceholder(/tape-measured/i).fill('measured with a ruler');
    await expect(page.getByRole('button', { name: /accept my typed value/i })).toBeEnabled();
  });
});
