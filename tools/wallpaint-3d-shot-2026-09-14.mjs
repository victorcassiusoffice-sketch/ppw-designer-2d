/**
 * Wall paint — Sims-style 3D view + tints (2026-09-14) captures.
 *
 *   node tools/wallpaint-3d-shot-2026-09-14.mjs <base> <outDir>
 *   e.g. node tools/wallpaint-3d-shot-2026-09-14.mjs http://127.0.0.1:5199 docs/wallpaint-3d-2026-09-14/after
 *
 * Frames: the Sofap demo with the paint tool armed (desktop 1366 — panel with
 * the 3D card, colours, breakdown), the big 3D view, a tinted wall in 3D,
 * the phone HUD + 3D overlay, and the cart with two tint lines.
 */
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const BASE = process.argv[2] ?? 'http://127.0.0.1:5199';
const OUT = process.argv[3] ?? 'docs/wallpaint-3d-2026-09-14/after';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();

async function waitDesigner(page) {
  await page.waitForSelector('.konvajs-content canvas', { state: 'attached' });
  await page.waitForTimeout(900);
}

// ---- desktop 1366 ---------------------------------------------------------
{
  const page = await browser.newPage({ viewport: { width: 1366, height: 850 } });
  await page.goto(`${BASE}/designer?demo=sofap`);
  await waitDesigner(page);
  await page.screenshot({ path: `${OUT}/desktop-1366-sofap-plan.png` });
  await page.locator('[data-testid="wallpaint-tool-toggle"]').click();
  await page.waitForSelector('[data-testid="wallpaint-palette"]');
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${OUT}/desktop-1366-paint-panel-3d-card.png` });

  // Tint the living room Soft Feel walls a Sofap à la carte colour via the 3D view.
  await page.locator('[data-testid="wallpaint-permoglaze-soft-feel"]').click();
  await page.locator('[data-testid="wallpaint-colour-sofap-alc-morning-haze"]').click().catch(() => {});
  const chartToggle = page.locator('[data-testid="wallpaint-chart-toggle"]');
  if (await chartToggle.count()) {
    await chartToggle.click();
    await page.waitForSelector('[data-testid="wallpaint-chart-grid"] button', { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${OUT}/desktop-1366-colour-match-chart.png` });
    // Pick a mid-depth teal from the chart for the showcase.
    const teal = page.locator('[data-testid="wallpaint-chart-grid"] button[title*="Jamaican"], [data-testid="wallpaint-chart-grid"] button').nth(300);
    await teal.click().catch(() => {});
  }
  await page.locator('[data-testid="wallpaint-scope-room"]').click();
  await page.waitForTimeout(600);
  await page.locator('[data-testid="wallpaint-breakdown-toggle"]').click().catch(() => {});
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/desktop-1366-tinted-room-breakdown.png` });

  await page.locator('[data-testid="wallpaint-3d-expand"]').click();
  await page.waitForSelector('[data-testid="wallpaint-3d-overlay"]');
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${OUT}/desktop-1366-3d-overlay.png` });
  // Orbit a little for a second angle.
  await page.locator('[data-testid="wallpaint-3d-overlay"] [data-testid="wallpaint-3d-rotate-right"]').click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/desktop-1366-3d-overlay-rotated.png` });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  await page.goto(`${BASE}/cart`);
  await page.waitForSelector('[data-testid="cart-wallpaint-line"]', { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/desktop-1366-cart-tint-lines.png`, fullPage: true });
  await page.close();
}

// ---- phone 390 ------------------------------------------------------------
{
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  await page.goto(`${BASE}/designer?demo=sofap`);
  await waitDesigner(page);
  await page.getByRole('button', { name: 'Open menu' }).click();
  await page.waitForSelector('[data-testid="wallpaint-toggle-mobile"]');
  await page.locator('[data-testid="wallpaint-mobile-permoglaze-soft-feel"]').click();
  await page.waitForSelector('[data-testid="wallpaint-hud"]');
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/phone-390-paint-hud.png` });
  await page.locator('[data-testid="wallpaint-3d-mobile"]').click();
  await page.waitForSelector('[data-testid="wallpaint-3d-overlay"]');
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${OUT}/phone-390-3d-overlay.png` });
  await page.locator('[data-testid="wallpaint-3d-close"]').click();
  await page.getByRole('button', { name: 'Open menu' }).click();
  await page.waitForSelector('[data-testid="wallpaint-colours-mobile"]');
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/phone-390-sheet-colours.png` });
  await page.close();
}

await browser.close();
console.log('captures in', OUT);
