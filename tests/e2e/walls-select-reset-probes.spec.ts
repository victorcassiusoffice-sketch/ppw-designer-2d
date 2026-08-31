/**
 * GATE PROBES (complaints A–D, 2026-08-31). Verification only — no source.
 * Confirms: single testids, control hit-sizes, text legibility + contrast on
 * the new controls, and ZERO console errors on the designer route.
 */
import { test, expect, type Page } from '@playwright/test';
import { seedSimsProperty, waitForGeom, oneRoomFixture } from './sims-world-helpers';

const PROBE: Record<string, unknown> = {};
test.afterAll(() => {
  // eslint-disable-next-line no-console
  console.log('PROBE_RECORD ' + JSON.stringify(PROBE));
});

async function openDesigner(page: Page): Promise<void> {
  await page.goto('/designer');
  await page.waitForSelector('.konvajs-content canvas', { state: 'attached' });
  await waitForGeom(page);
}

/** sRGB relative luminance + WCAG contrast ratio between two "rgb(...)" strings. */
function contrast(fg: string, bg: string): number {
  const parse = (s: string): [number, number, number] => {
    const m = s.match(/rgba?\(([^)]+)\)/);
    if (!m) return [0, 0, 0];
    const [r, g, b] = m[1].split(',').map((v) => parseFloat(v));
    return [r, g, b];
  };
  const lum = ([r, g, b]: [number, number, number]): number => {
    const f = (c: number) => {
      const s = c / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const L1 = lum(parse(fg));
  const L2 = lum(parse(bg));
  const [hi, lo] = L1 >= L2 ? [L1, L2] : [L2, L1];
  return (hi + 0.05) / (lo + 0.05);
}

test.describe('gate probes', () => {
  test('desktop: single testids, hit-sizes >= 40px, text >= 11px, contrast >= 4.5, 0 console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    page.on('pageerror', (e) => errors.push(String(e)));

    await page.setViewportSize({ width: 1366, height: 900 });
    await seedSimsProperty(page, oneRoomFixture());
    await openDesigner(page);

    // Single testids for the new + relabeled controls.
    await expect(page.locator('[data-testid="select-tool-toggle"]')).toHaveCount(1);
    await expect(page.getByTestId('clear-all-button')).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'Fit to view' })).toHaveCount(1);

    // No duplicate data-testid anywhere in the DOM, EXCEPT the documented
    // intentional list-item testids that legitimately repeat once per catalog
    // row (pre-existing, owned by SimsBottomToolbar; simsToolbar.test.tsx
    // asserts many). None of them belong to complaints A–D.
    const INTENTIONAL_LIST_TESTIDS = ['sims-thumb'];
    const dupes = await page.evaluate((allowed) => {
      const counts: Record<string, number> = {};
      document.querySelectorAll('[data-testid]').forEach((el) => {
        const id = el.getAttribute('data-testid')!;
        counts[id] = (counts[id] ?? 0) + 1;
      });
      return Object.entries(counts)
        .filter(([id, n]) => n > 1 && !allowed.includes(id))
        .map(([id, n]) => `${id}:${n}`);
    }, INTENTIONAL_LIST_TESTIDS);
    PROBE.duplicateTestids = dupes;
    expect(dupes).toEqual([]);

    // Hit-size + text-size on Select and Clear-all.
    const measure = async (testid: string) => {
      return page.evaluate((id) => {
        const el = document.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
        if (!el) return null;
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        return { h: r.height, w: r.width, fontSize: parseFloat(cs.fontSize), color: cs.color, bg: cs.backgroundColor };
      }, testid);
    };
    const sel = await measure('select-tool-toggle');
    const clr = await measure('clear-all-button');
    PROBE.selectMetrics = sel;
    PROBE.clearAllMetrics = clr;
    expect(sel!.h).toBeGreaterThanOrEqual(40 - 0.5);
    expect(clr!.h).toBeGreaterThanOrEqual(40 - 0.5);
    expect(sel!.fontSize).toBeGreaterThanOrEqual(11);
    expect(clr!.fontSize).toBeGreaterThanOrEqual(11);

    // Contrast of each label against the surface it actually sits on. A
    // segmented control flips between paper chrome (inactive) and ink fill
    // (active) — the Select toggle renders ACTIVE on open (default select
    // tool), so its true ground is the dark ink fill, not paper. Measure
    // against the element's own opaque background; fall back to the canvas
    // paper only when the button paints no opaque fill of its own.
    const PAPER = 'rgb(245,243,238)';
    const groundFor = (bg: string): string => {
      const m = bg.match(/rgba?\(([^)]+)\)/);
      if (!m) return PAPER;
      const parts = m[1].split(',').map((v) => parseFloat(v));
      const alpha = parts.length >= 4 ? parts[3] : 1;
      return alpha > 0 ? `rgb(${parts[0]}, ${parts[1]}, ${parts[2]})` : PAPER;
    };

    const clrContrast = contrast(clr!.color as string, groundFor(clr!.bg as string));
    PROBE.clearAllContrast = Number(clrContrast.toFixed(2));
    expect(clrContrast).toBeGreaterThanOrEqual(4.5);

    const selContrast = contrast(sel!.color as string, groundFor(sel!.bg as string));
    PROBE.selectContrast = Number(selContrast.toFixed(2));
    expect(selContrast).toBeGreaterThanOrEqual(4.5);

    PROBE.consoleErrors = errors;
    expect(errors).toEqual([]);
  });

  test('phone 390: select-tool-toggle-mobile single, hit-size >= 44px', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await seedSimsProperty(page, oneRoomFixture());
    await openDesigner(page);
    await page.locator('button[aria-label="Open menu"]').click();
    const selM = page.locator('[data-testid="select-tool-toggle-mobile"]');
    await expect(selM).toHaveCount(1);
    const h = await selM.evaluate((el) => el.getBoundingClientRect().height);
    PROBE.selectMobileHeight = h;
    expect(h).toBeGreaterThanOrEqual(44 - 0.5);
    // Clear-all on the phone is 44px (h-11).
    const clrH = await page.getByTestId('clear-all-button').evaluate((el) => el.getBoundingClientRect().height);
    PROBE.clearAllMobileHeight = clrH;
    expect(clrH).toBeGreaterThanOrEqual(44 - 0.5);
  });
});
