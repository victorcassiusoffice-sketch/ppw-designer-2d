/**
 * `/designer?demo=<slug>` — open the designer inside a merchant's pitch
 * (Courts Mammouth push, 2026-09-05).
 *
 * What it does, in order:
 *   1. Registers every bundled demo and activates the one in the URL
 *      (`?demo=off` leaves demo mode). This runs DURING App's first render,
 *      so the dock / toolbar catalogs mount already showing the range.
 *   2. Once, after mount, puts the merchant's pre-built show home on the
 *      canvas as its own PAGE — the customer's current plan is promoted to a
 *      tab first, so nothing they drew is lost, and the show home is a normal
 *      page afterwards: undo, autosave, tabs and the cart all work on it.
 *
 * Re-opening the same demo URL finds the existing page and switches to it
 * instead of stamping a second copy. `?demo=off` only drops the RANGE from the
 * catalog; the page stays (its products still resolve — see `demoProductById`).
 */
import { useEffect, useState } from 'react';
import { registerAllDemos } from './index';
import { activeDemo, setActiveDemo, type DemoDefinition } from './demoCatalog';
import { useDesignsStore, DRAFT_ID } from '../store/designsStore';
import { usePropertyStore } from '../store/propertyStore';
import { useHistoryStore } from '../store/historyStore';
import { useToastStore } from '../store/toastStore';
import { useCurrencyStore } from '../store/currencyStore';
import { applyPage, currentPageId, flushCurrentPage, promoteDraftToPage, switchToPage } from '../lib/pages';
import { useDesignerUIStore } from '../store/designerUIStore';
import { brandIdOfPaint, findWallPaintById, paintsForBrand } from '../data/wallPaints';
import { demoRoute } from './demoRoute';

/**
 * A paint company's pitch opens with ITS first line on the brush (TintEX,
 * 2026-09-19): the panel only shows that brand, so a brush still carrying
 * another brand's paint would paint what the panel cannot show.
 */
export function ensureDemoPaintBrush(demo: DemoDefinition): void {
  const brands = demo.paintBrandIds;
  if (!brands || brands.length === 0) return;
  const ui = useDesignerUIStore.getState();
  const current = findWallPaintById(ui.wallPaintDraft.paintId);
  if (current && brands.includes(brandIdOfPaint(current))) return;
  const first = brands.map((b) => paintsForBrand(b)[0]).find(Boolean);
  if (first) ui.setWallPaintDraft({ paintId: first.id, colourHex: undefined, colourName: undefined, erase: false });
}

/** The `demo` query value, lower-cased, or null. `'off'` is meaningful. */
export function readDemoParam(search: string): string | null {
  try {
    const v = new URLSearchParams(search).get('demo');
    const slug = v?.trim().toLowerCase();
    return slug ? slug : null;
  } catch {
    return null;
  }
}

/**
 * Register + activate from the URL. Returns the active demo (which may have
 * been activated on an earlier navigation in this tab — sessionStorage).
 */
export function activateDemoFromUrl(search: string, pathname = '/designer'): DemoDefinition | null {
  registerAllDemos();
  const route = demoRoute(pathname, search);
  if (route) { setActiveDemo(`demo-${route.scene}`); return activeDemo(); }
  const slug = readDemoParam(search);
  if (slug === 'off') setActiveDemo(null);
  else if (slug) setActiveDemo(slug); // an unknown slug is ignored, not an error
  return activeDemo();
}

export type DemoPageOutcome = 'loaded' | 'switched' | 'current';

/** Make the demo's show home the page on the canvas. Pure store work; no React. */
export function ensureDemoPage(demo: DemoDefinition): DemoPageOutcome {
  // A Mauritian merchant's pitch opens in rupees, whatever the store's default.
  if (demo.currency) useCurrencyStore.getState().setCurrency(demo.currency);
  ensureDemoPaintBrush(demo);
  const designs = useDesignsStore.getState();
  const existing = Object.values(designs.designs).find(
    (d) => d.id !== DRAFT_ID && (demo.propertyId ? d.property.id === demo.propertyId : d.name === demo.pageName),
  );
  if (existing) {
    const isCurrent = currentPageId() === existing.id;
    const existingName = isCurrent ? usePropertyStore.getState().property.name : existing.property.name;
    if (demo.legacyPageNames?.includes(existing.name) && demo.legacyPageNames.includes(existingName)) {
      if (isCurrent) flushCurrentPage();
      designs.rename(existing.id, demo.pageName);
      if (isCurrent) usePropertyStore.getState().renameProperty(demo.pageName);
    }
    if (currentPageId() === existing.id) return 'current';
    promoteDraftToPage();
    switchToPage(existing.id);
    return 'switched';
  }
  // Keep whatever the customer had on screen reachable before we replace it.
  promoteDraftToPage();
  flushCurrentPage();
  const property = demo.buildProperty();
  const bundle = { property, walls: [], floorZones: [], wallTreatments: {} };
  const id = designs.savePropertyAs(demo.pageName, property);
  designs.savePageBundle(id, bundle);
  designs.setCurrent(id);
  applyPage(bundle);
  useHistoryStore.getState().reset();
  return 'loaded';
}

export function useDemoMode(): DemoDefinition | null {
  // useState's initialiser runs synchronously in the FIRST render, before any
  // child mounts — the one moment early enough for the catalogs (see header).
  const [demo] = useState<DemoDefinition | null>(() =>
    typeof window === 'undefined' ? null : activateDemoFromUrl(window.location.search, window.location.pathname),
  );
  const pushToast = useToastStore((s) => s.push);
  useEffect(() => {
    if (!demo) return;
    const outcome = ensureDemoPage(demo);
    const route = demoRoute(window.location.pathname, window.location.search);
    if (route) useDesignerUIStore.getState().setViewMode(route.view === '2d' ? 'plan' : '3d');
    if (outcome !== 'current') {
      pushToast(
        'Demo — edit rooms, products and finishes. Preview only; no orders.',
        'success',
      );
    }
  }, [demo, pushToast]);
  return demo;
}
