/**
 * Catalogue helpers for the e2e specs (collapsed catalogue, 2026-09-26).
 *
 * Not a spec — the filename does not match Playwright's testMatch, so it is
 * imported, never collected. Standalone on purpose: `multiroom-helpers.ts`
 * and `sims-world-helpers.ts` import THIS file, so it must not import them.
 *
 * WHY THIS EXISTS. The catalogue now starts COLLAPSED at every width (Vic:
 * a Sims-like catalogue that stays out of the way until products are
 * wanted). In the plan view it is a small "Furnish" launcher pill:
 *   desktop (>= 1024 px)  [data-testid="dock-catalog-open"]  → SimsDock
 *   phone                 [data-testid="sims-catalog-open"]  → SimsBottomToolbar
 * In the 3D view there is no pill at all: the catalogue opens from the
 * house rail's Furnish mode ([data-testid="house-mode-furnish"]) as a
 * home-store page of category tiles (`<prefix>-cat-<category>`), and the
 * product strip appears once a category is picked.
 *
 * Every spec that touches dock-strip / sims-thumb-strip / [data-product-id]
 * / <prefix>-cat-* / <prefix>-search therefore calls `openCatalog(page)`
 * first. It is idempotent (a no-op when the strip is already showing), so
 * shared helpers that pick products call it on every pick — the catalogue
 * re-collapses on a view change, when a tool folds it on the phone, and
 * whenever the app itself closes it.
 */

import { expect, type Locator, type Page } from '@playwright/test';
import type { MacroCategory } from '../../src/components/mobile/catalogMacros';

const DOCK_STRIP = '[data-testid="dock-strip"]';
const SIMS_STRIP = '[data-testid="sims-thumb-strip"]';
/** Either product strip — whichever the viewport width renders. */
const ANY_STRIP = `${DOCK_STRIP}, ${SIMS_STRIP}`;
const DOCK_LAUNCHER = '[data-testid="dock-catalog-open"]';
const SIMS_LAUNCHER = '[data-testid="sims-catalog-open"]';
const FURNISH = '[data-testid="house-mode-furnish"]';
/** Anything that proves the designer has mounted far enough to reach the catalogue. */
const ANY_CATALOG_ENTRY = `${ANY_STRIP}, [data-testid="dock-cat-all"], [data-testid="sims-cat-all"], ${DOCK_LAUNCHER}, ${SIMS_LAUNCHER}, ${FURNISH}`;

/** `isVisible` never waits and never throws: a hidden / absent / detached element reads false. */
async function shows(locator: Locator): Promise<boolean> {
  return locator.first().isVisible().catch(() => false);
}

/** The visible product strip, or null when the catalogue is closed (or on the 3D home page). */
async function visibleStrip(page: Page): Promise<Locator | null> {
  for (const selector of [DOCK_STRIP, SIMS_STRIP]) {
    const strip = page.locator(selector);
    if (await shows(strip)) return strip;
  }
  return null;
}

/**
 * The category control for `category` that this width actually renders:
 * the desktop dock's tab / home tile (`dock-cat-*`) or the phone strip's
 * (`sims-cat-*`). Both are mounted at every width (the other is
 * `display:none`), so the VISIBLE one is the one a person can press.
 */
function categoryControl(page: Page, category: MacroCategory): Locator {
  return page
    .locator(`[data-testid="dock-cat-${category}"], [data-testid="sims-cat-${category}"]`)
    .filter({ visible: true })
    .first();
}

async function waitForStrip(page: Page): Promise<Locator> {
  const strip = page.locator(ANY_STRIP).filter({ visible: true }).first();
  await expect(strip, 'the product strip opens').toBeVisible({ timeout: 10_000 });
  return strip;
}

/**
 * Open the product catalogue, whatever view the designer is in, and leave
 * the product strip on screen.
 *
 *  - Plan view: press the Furnish launcher (`dock-catalog-open` at >= 1024
 *    px, else `sims-catalog-open`). The category tabs and the strip appear
 *    together. With `category`, the matching tab is pressed too.
 *  - 3D view: press the rail's Furnish mode, which shows the home-store
 *    category tiles; then press the `category` tile (default `all`) so the
 *    strip appears. If the catalogue is already on a strip page and a
 *    different category is wanted, "← Categories" is pressed first.
 *  - Already open: a no-op (with `category`, the tab / tile is still
 *    pressed, which is idempotent).
 *
 * Throws with a plain message when nothing on screen can open the
 * catalogue — a silent no-op here would turn every later locator timeout
 * into a mystery.
 */
export async function openCatalog(page: Page, category?: MacroCategory): Promise<void> {
  // 0. Let the designer mount. A spec may call this straight after
  //    `page.goto`, before React has painted the bar: the checks below never
  //    wait, so give the first catalogue control up to 15 s to appear. (A
  //    strip / launcher / rail that never comes is then reported below.)
  await page
    .locator(ANY_CATALOG_ENTRY)
    .filter({ visible: true })
    .first()
    .waitFor({ state: 'visible', timeout: 15_000 })
    .catch(() => undefined);

  // 1. Already showing products?
  if (await visibleStrip(page)) {
    if (category) await pickCategory(page, category);
    return;
  }

  // 2. The 3D home-store page is already up (tiles, no strip yet).
  if (await shows(categoryControl(page, 'all'))) {
    await categoryControl(page, category ?? 'all').click();
    await waitForStrip(page);
    return;
  }

  // 3. Plan view: the Furnish launcher pill.
  for (const [launcher, strip] of [
    [DOCK_LAUNCHER, DOCK_STRIP],
    [SIMS_LAUNCHER, SIMS_STRIP],
  ] as const) {
    const pill = page.locator(launcher);
    if (await shows(pill)) {
      await pill.click();
      await expect(page.locator(strip), `${launcher} opens the catalogue`).toBeVisible({ timeout: 10_000 });
      if (category) await pickCategory(page, category);
      return;
    }
  }

  // 4. 3D view: the house rail's Furnish mode → home store → a category tile.
  const furnish = page.locator(FURNISH);
  if (await shows(furnish)) {
    await furnish.click();
    await expect(categoryControl(page, 'all'), 'Furnish opens the home store').toBeVisible({ timeout: 10_000 });
    await categoryControl(page, category ?? 'all').click();
    await waitForStrip(page);
    return;
  }

  throw new Error(
    'openCatalog: nothing on screen opens the catalogue — expected dock-catalog-open / sims-catalog-open '
      + '(plan view) or house-mode-furnish (3D view). Is the designer mounted at this viewport?',
  );
}

/** Press a category on an OPEN catalogue: a plan tab, or a 3D home tile (going back to the tiles first if needed). */
async function pickCategory(page: Page, category: MacroCategory): Promise<void> {
  const control = categoryControl(page, category);
  if (!(await shows(control))) {
    // 3D strip page: the tiles live behind "← Categories".
    const back = page.locator('.catalog-browser-back').filter({ visible: true }).first();
    if (await shows(back)) await back.click();
  }
  await expect(control, `the ${category} category is offered`).toBeVisible({ timeout: 10_000 });
  await control.click();
  await waitForStrip(page);
}

/**
 * Close the catalogue if it is open: the plan dock's "Close ×", the phone
 * strip's close button, or the 3D home store's "Close". A no-op when it is
 * already closed. Resolves once no product strip is showing.
 */
export async function closeCatalog(page: Page): Promise<void> {
  for (const selector of [
    '[data-testid="dock-collapse"]',
    '[data-testid="sims-toolbar-minimize"]',
    '.catalog-browser-close',
  ]) {
    const button = page.locator(selector).filter({ visible: true }).first();
    if (await shows(button)) {
      await button.click();
      break;
    }
  }
  await expect(page.locator(ANY_STRIP).filter({ visible: true })).toHaveCount(0, { timeout: 10_000 });
}
