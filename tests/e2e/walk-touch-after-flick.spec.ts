/**
 * Walk mode on a phone viewport: a tap must still work right after a quick look
 * or thumb-pad swipe. Round-4 evidence (docs/world/ROUNDS.md, 31 Oct 2026): a
 * swipe that lifts while still moving made Chromium start a fling the overlay
 * cannot scroll, and every tap for about a second was swallowed as a fling stop
 * (trusted pointerdown/pointerup, no click). The look surface and the pad now
 * own their touch contacts, and the door button acts on the completed tap.
 *
 * Needs a served build with 3D (software GL is enabled by the project):
 *   PPW_E2E_BASE_URL=http://127.0.0.1:5183 npx playwright test walk-touch-after-flick
 */
import { test, expect, type Page } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

async function startWalk(page: Page): Promise<void> {
  await page.addInitScript(() => localStorage.setItem('ppw_designer_coach_v1', '1'));
  await page.goto('/demo?view=3d&pitch=1', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Number(document.querySelector('[data-testid="wallpaint-3d-gl"]')?.getAttribute('data-first-picture-ms')) > 0, undefined, { timeout: 120000 });
  await page.getByRole('button', { name: 'Open Walk mode', exact: true }).tap();
  await page.getByRole('button', { name: 'Start walk', exact: true }).tap();
  await page.waitForFunction(() => document.querySelector('[data-world-walk]')?.getAttribute('data-status'), undefined, { timeout: 60000 });
  await page.waitForTimeout(300);
}

async function flick(page: Page, from: { x: number; y: number }, to: { x: number; y: number }): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: from.x, y: from.y, id: 1 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: to.x, y: to.y, id: 1 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
}

test('a tap on a Walk control still acts right after a look flick', async ({ page }) => {
  await startWalk(page);
  await flick(page, { x: 230, y: 400 }, { x: 270, y: 400 });
  await page.waitForTimeout(100);
  await page.getByRole('button', { name: 'Controls', exact: true }).tap();
  await expect(page.getByRole('button', { name: 'Got it', exact: true })).toBeVisible({ timeout: 2000 });
});

test('a tap on a Walk control still acts right after a thumb-pad flick', async ({ page }) => {
  await startWalk(page);
  const pad = (await page.locator('.world-walk-stick').boundingBox())!;
  const centre = { x: pad.x + pad.width / 2, y: pad.y + pad.height / 2 };
  await flick(page, centre, { x: centre.x, y: centre.y - 40 });
  await page.waitForTimeout(100);
  await page.getByRole('button', { name: 'Controls', exact: true }).tap();
  await expect(page.getByRole('button', { name: 'Got it', exact: true })).toBeVisible({ timeout: 2000 });
});

test('the saved design and the camera are untouched by the flicks and taps', async ({ page }) => {
  await startWalk(page);
  const before = await page.evaluate(() => localStorage.getItem('ppw_property_v2'));
  await flick(page, { x: 230, y: 400 }, { x: 270, y: 400 });
  await page.getByRole('button', { name: 'Controls', exact: true }).tap();
  await page.getByRole('button', { name: 'Got it', exact: true }).tap();
  await page.getByRole('button', { name: 'Exit walk', exact: true }).tap();
  await expect(page.getByTestId('world-walk')).toBeHidden();
  expect(await page.evaluate(() => localStorage.getItem('ppw_property_v2'))).toBe(before);
});
