/**
 * Vic: "during mid drawing a line, the undo button doesn't work properly."
 *
 * This drives the exact gesture he described — the BUTTON, mid-draw — and
 * asserts it steps back one vertex, the same as Ctrl+Z. Before the fix the
 * button reached straight into the history store with no draw-transaction
 * guard, so mid-draw it did nothing useful while the keyboard worked.
 */
import { test, expect } from '@playwright/test';
import { seedCoachFlagOnly, canvasOrigin, drawVertexCount, PX_PER_M } from './multiroom-helpers';

test.use({ viewport: { width: 1600, height: 900 } });

// In-flight vertices come from the dev geometry bridge rather than the DOM:
// the only DOM surface for them is inside the RoomList dropdown, which is not
// open during a draw.
const vertexCount = drawVertexCount;

test('the undo BUTTON steps back one vertex mid-draw, like Ctrl+Z', async ({ page }) => {
  await seedCoachFlagOnly(page);
  await page.goto('/designer');
  await page.waitForSelector('.konvajs-content canvas', { state: 'attached' });

  // Enter draw mode from the blank-canvas prompt.
  await page.locator('[data-testid="start-draw-room"]').click();

  const o = await canvasOrigin(page);
  const at = (xM: number, yM: number) => ({ x: o.x + xM * PX_PER_M, y: o.y + yM * PX_PER_M });

  // Drop three vertices.
  for (const [x, y] of [[1, 1], [4, 1], [4, 3]] as const) {
    const p = at(x, y);
    await page.mouse.move(p.x, p.y);
    await page.mouse.click(p.x, p.y);
    await page.waitForTimeout(80);
  }

  const undoBtn = page.getByRole('button', { name: /Undo \(Ctrl\+Z\)/ });
  await expect(undoBtn, 'the undo button must be live mid-draw').toBeEnabled();

  const before = await vertexCount(page);
  if (before < 0) test.skip(true, 'no vertex counter surfaced in the DOM');
  expect(before).toBe(3);

  // THE GESTURE Vic described.
  await undoBtn.click();
  await expect.poll(() => vertexCount(page), { timeout: 5_000 }).toBe(2);

  // And again, to show it is a real ladder rather than a one-shot.
  await undoBtn.click();
  await expect.poll(() => vertexCount(page), { timeout: 5_000 }).toBe(1);

  // Ctrl+Z must agree with the button — one behaviour, two controls.
  await page.keyboard.press('Control+z');
  await expect.poll(() => vertexCount(page), { timeout: 5_000 }).toBe(0);

  console.log('UNDO_MID_DRAW=true');
});
