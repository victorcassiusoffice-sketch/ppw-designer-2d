/**
 * SimsBottomToolbar — Phase 2 + 4 of the mobile Sims rebuild.
 *
 * A compact Furnish / Search launcher opens the Plan catalog on demand.
 * Sticky to the bottom of the viewport on screens < 1024 px, with SimsDock
 * handling the desktop catalog. House mode keeps its existing store browser.
 *
 * Layout, left → right (per Vic's Sims-3 screenshot):
 *   • category icons (macro groups), active = ink on a mint tint (shop skin)
 *   • search and sorting above a horizontal strip of named product cards
 *   • a close control that returns to the small launcher
 *
 * Interactions:
 *   • tap a thumbnail        → choose a position on the floor
 *   • tap its info button    → docked product details
 *   • long-press + drag      → drag ghost; release on the floor places it
 *   • details Choose position → arm exact placement on the next floor tap
 *
 * Placement is published to placementIntentStore; RoomCanvas runs the
 * validated placement. No engine change — Konva stable-lock untouched.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMerchantCatalog } from '../../lib/useMerchantCatalog';
import type { Product } from '../../data/products.schema';
import { mergeCatalog } from '../../data/mergeCatalog';
import { usePlacementIntentStore } from '../../store/placementIntentStore';
// Polish (2026-08-29): the toolbar folds to its category row while the wall
// pen is open (the phone needs the canvas back), and unfolds on exit.
import { useDrawProgressStore } from '../../store/drawProgressStore';
// Floor tool (2026-08-30): the six K1 tile/roll SKUs are FLOOR cards — a
// tap arms the Floor tool on that material instead of placing a loose item.
// The strip also folds for the Floor tool exactly as it does for the pen —
// the phone HUD card + a full thumbnail strip would leave no floor to tap.
import { floorMaterialForProduct } from '../../data/floorMaterials';
import { useDesignerUIStore } from '../../store/designerUIStore';
// Phone pass (2026-09-16): fold to the category row when a furnished plan
// arrives (a merchant demo, a saved page, a tab switch).
import { useDesignsStore } from '../../store/designsStore';
import { usePropertyStore } from '../../store/propertyStore';
import { useBelowMd } from '../../lib/useBelowMd';
import {
  MACRO_CATEGORY_LABEL,
  macroOf,
  type MacroCategory,
} from './catalogMacros';
import { MobileProductPopup } from './MobileProductPopup';
import { useDragToPlace } from './useDragToPlace';
import { CATALOG_CHROME, catalogRequestCategory, filterCatalog, type CatalogSort } from '../catalogPresentation';
import '../catalogChrome.css';
import { CatalogShelfHeader, CatalogHome } from '../CatalogHome';
import { useCatalogDismissal } from '../useCatalogDismissal';
import { PlanCatalogLauncher } from '../PlanCatalogLauncher';
import { CatalogProductImage, CatalogSwatches } from '../CatalogProductExtras';
import { catalogDragImageUrl, type CatalogBrowse } from '../catalogMetadata';

const { DOCK_ACCENT, DOCK_BG, DOCK_BG_RAISED, DOCK_BORDER, DOCK_TEXT } = CATALOG_CHROME;

/** Cream photo plate behind every thumbnail — unchanged (product art is shot on it). */

/**
 * Shared control chrome: 120 ms colour transition (none under
 * reduced-motion) + the mint focus ring. Same string the desktop dock uses.
 */
const DOCK_CONTROL =
  'transition-colors duration-[120ms] ease-out motion-reduce:transition-none focus:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--catalog-focus)]';

export function SimsBottomToolbar() {
  const viewMode = useDesignerUIStore((s) => s.viewMode);
  const [activeCategory, setActiveCategory] = useState<MacroCategory>('all');
  const [minimized, setMinimized] = useState(true);
  const [categoryHome, setCategoryHome] = useState(true);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<CatalogSort>('catalog');
  const [browse, setBrowse] = useState<CatalogBrowse>({ mode: 'category', value: 'all' });
  const [variants, setVariants] = useState<Record<string, Product>>({});
  const [selected, setSelected] = useState<Product | null>(null);
  const apiProducts = useMerchantCatalog();

  const placeAt = usePlacementIntentStore((s) => s.placeAt);
  const sectionRef = useRef<HTMLElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setMinimized(true); setSelected(null); }, [viewMode]);
  useEffect(() => {
    let focusFrame: number | undefined;
    const open = (event: Event) => {
      if (window.innerWidth >= 1024) return;
      const category = catalogRequestCategory(event);
      setActiveCategory(category ?? 'all');
      setBrowse({ mode: 'category', value: 'all' });
      setCategoryHome(category === undefined);
      setQuery('');
      // An explicit request to open wins over the fold a tool put on the strip
      // (lessons 2026-11-08: Floor on, then "Show me" Furnish — the restore of
      // the pre-tool state used to fold the strip straight back).
      minimizedBeforePenRef.current = null;
      setMinimized(false);
      setSelected(null);
      if (focusFrame !== undefined) cancelAnimationFrame(focusFrame);
      focusFrame = requestAnimationFrame(() => {
        // Focus a category without opening the phone keyboard over the scene.
        const target = sectionRef.current?.querySelector<HTMLButtonElement>(category ? '.catalog-browser-back' : '[data-testid="sims-cat-all"]');
        target?.focus({ preventScroll: true });
        target?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
      });
    };
    window.addEventListener('ppw:open-catalog', open);
    return () => {
      window.removeEventListener('ppw:open-catalog', open);
      if (focusFrame !== undefined) cancelAnimationFrame(focusFrame);
    };
  }, []);

  // Polish (2026-08-29): while the wall pen is open on a phone the thumbnail
  // strip (~150 px) plus the HUD card left ~190 px of drawable canvas. The
  // strip auto-MINIMISES for the pen (the category row + chevron stay, so a
  // thumb can still unfold it) and the previous state comes back on exit.
  // The user's own chevron taps mid-draw are respected until the pen closes.
  const penOpen = useDrawProgressStore((s) => s.enabled);
  const floorToolOn = useDesignerUIStore((s) => s.tool === 'floor' || s.tool === 'wallpaint');
  const foldForTool = penOpen || floorToolOn;
  const minimizedBeforePenRef = useRef<boolean | null>(null);
  useEffect(() => {
    if (foldForTool) {
      setMinimized((v) => {
        minimizedBeforePenRef.current = v;
        return true;
      });
      return;
    }
    const prev = minimizedBeforePenRef.current;
    if (prev !== null) {
      minimizedBeforePenRef.current = null;
      setMinimized(prev);
    }
  }, [foldForTool]);

  // Phone pass (2026-09-16): a plan that arrives FURNISHED — a merchant
  // demo's show home, a saved page, a tab switch — opens with the strip
  // folded to its category row, so the room gets back the ~150 px the
  // thumbnails were taking on a 390 px phone (Vic, Sofap demo: "I can't see
  // the screen"). A category tap unfolds it (that handler already does) and
  // the chevron still works. A blank plan is untouched: the pen owns it.
  const currentPageId = useDesignsStore((s) => s.currentId);
  const belowMd = useBelowMd();
  useEffect(() => {
    if (!belowMd) return;
    const furnished = usePropertyStore.getState().property.rooms.some((r) => r.polygon.length >= 3);
    if (furnished) setMinimized(true);
  }, [currentPageId, belowMd]);

  // Publish the toolbar's live height as a CSS var so other bottom-anchored
  // overlays (ModeStrip, CartStrip) can sit above it. When the toolbar is
  // display:none (desktop ≥ 1024 px) offsetHeight is 0, so desktop layout
  // is untouched.
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const root = document.documentElement;
    const apply = () => root.style.setProperty('--sims-toolbar-h', `${el.offsetHeight}px`);
    apply();
    // ResizeObserver is absent in jsdom (unit tests) — degrade to the
    // one-shot apply above; real browsers always have it.
    if (typeof ResizeObserver === 'undefined') {
      return () => root.style.setProperty('--sims-toolbar-h', '0px');
    }
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => {
      ro.disconnect();
      root.style.setProperty('--sims-toolbar-h', '0px');
    };
  }, []);

  // Same blend + cache-population path as ProductPalette so a placed
  // merchant product resolves via getProductById on the canvas side.

  // SKU-deduped like the desktop dock: the 14 K1 SKUs arrive from BOTH the
  // API and the bundled seed, and this strip used to show each twice.
  const allProducts = useMemo(() => mergeCatalog(apiProducts), [apiProducts]);

  const filtered = useMemo(() => filterCatalog(allProducts, activeCategory, query, sort, browse), [allProducts, activeCategory, query, sort, browse]);
  useEffect(() => { if (stripRef.current) stripRef.current.scrollLeft = 0; }, [activeCategory, browse, query, sort]);

  // Floor tool state for the floor cards (scalar selectors — the strip must
  // not re-render for draft fields it does not show).
  const tool = useDesignerUIStore((s) => s.tool);
  const floorMaterialId = useDesignerUIStore((s) => s.floorDraft.materialId);
  const setFloorDraft = useDesignerUIStore((s) => s.setFloorDraft);
  const setTool = useDesignerUIStore((s) => s.setTool);
  function armFloor(materialId: string): void {
    setFloorDraft({ materialId, erase: false });
    setTool('floor');
  }

  function choosePosition(productId: string) {
    useDesignerUIStore.getState().setTool('hand');
    usePlacementIntentStore.getState().setArmed(productId);
    setSelected(null);
    setMinimized(true);
  }
  // A tap arms an exact position; a held drag commits directly on release.
  const { start, ghost, dragging } = useDragToPlace({
    mode: 'longpress',
    onDrop: (productId, x, y) => placeAt(productId, x, y),
    onTap: choosePosition,
  });

  function backToProducts() {
    setSelected(null);
    requestAnimationFrame(() => {
      const buttons = sectionRef.current?.querySelectorAll<HTMLButtonElement>('[data-detail-id]');
      Array.from(buttons ?? []).find(button => button.dataset.detailId === selected?.id)?.focus({ preventScroll: true });
    });
  }

  const closeCatalog = useCallback(() => { setMinimized(true); setSelected(null); }, []);
  useCatalogDismissal({ viewMode, open: !minimized, desktop: false, close: closeCatalog, placing: dragging });

  const productDetails = selected && <MobileProductPopup product={variants[selected.id] ?? selected} embedded onDismiss={closeCatalog}
          swatches={<CatalogSwatches product={selected} selectedSku={(variants[selected.id] ?? selected).sku} products={allProducts}
            onSelect={value => setVariants(current => ({ ...current, [selected.id]: value }))} />}
    onAdd={choosePosition}
    onDragPlace={(productId, x, y) => placeAt(productId, x, y)} onClose={backToProducts} />;

  return (
    <>
      <section
        ref={sectionRef}
        data-testid="sims-bottom-toolbar"
        data-catalog-mode={viewMode}
        data-catalog-open={!minimized}
        aria-label="Product catalog"
        onKeyDownCapture={event => { if (viewMode === 'plan' && event.key === 'Escape' && !minimized) { event.preventDefault(); event.stopPropagation(); closeCatalog(); requestAnimationFrame(() => sectionRef.current?.querySelector<HTMLButtonElement>('[data-testid="sims-catalog-open"]')?.focus()); } }}
        className="sims-catalog lg:hidden fixed bottom-0 left-0 right-0 z-30 flex flex-col"
        style={{
          background: DOCK_BG,
          borderTop: `1px solid ${DOCK_BORDER}`,
          paddingBottom: 'env(safe-area-inset-bottom)',
          boxShadow: '0 -6px 20px rgba(42,41,38,0.12)',
        }}
      >
        {viewMode === 'plan' && minimized && <PlanCatalogLauncher prefix="sims"
          onOpen={() => { setMinimized(false); requestAnimationFrame(() => sectionRef.current?.querySelector<HTMLSelectElement>('[data-testid="sims-filter"]')?.focus()); }}
          onSearch={() => { setMinimized(false); requestAnimationFrame(() => searchRef.current?.focus()); }} />}
        {!minimized && !selected && <CatalogShelfHeader prefix="sims" house={viewMode === '3d'} home={viewMode === '3d' && categoryHome}
          category={activeCategory} products={allProducts} browse={browse} query={query} sort={sort} searchRef={searchRef}
          onFilter={(category, group) => { setActiveCategory(category); setBrowse(group); setCategoryHome(false); setQuery(''); }}
          onSearch={value => { setQuery(value); setCategoryHome(false); }} onSort={setSort}
          onBack={() => { setCategoryHome(true); setActiveCategory('all'); setBrowse({ mode: 'category', value: 'all' }); setQuery(''); }}
          onClose={closeCatalog} />}
        {viewMode === '3d' && categoryHome && !minimized && !selected && <CatalogHome prefix="sims" products={allProducts}
          onCategory={category => { setActiveCategory(category); setCategoryHome(false); setQuery(''); }} />}
        {/* One named row keeps products recognizable and leaves the plan visible. */}
        {!minimized && !selected && (viewMode !== '3d' || !categoryHome) && (
          <div
            ref={stripRef}
            id="mobile-catalog-products"
            data-testid="sims-thumb-strip"
            aria-label={`${MACRO_CATEGORY_LABEL[activeCategory]} products`}
            className="min-h-0 overflow-x-auto overflow-y-hidden px-2 pb-2 pt-1 [scrollbar-width:thin]"
          >
            {filtered.length === 0 ? (
              <p className="px-2 py-4 text-center text-[12px] font-medium" style={{ color: DOCK_TEXT }}>
                {query.trim() ? `No matches for “${query.trim()}”.` : 'No products in this category yet.'}
                {query.trim() && <button type="button" className={`ml-2 min-h-11 rounded-lg px-2 font-semibold underline ${DOCK_CONTROL}`} onClick={() => setQuery('')}>Clear search</button>}
              </p>
            ) : (
              <div
                className="grid py-1"
                style={{
                  gridAutoFlow: 'column',
                  gridAutoColumns: 'var(--catalog-card-width)',
                  gap: 8,
                }}
              >
                {filtered.map((original) => {
                  const p = variants[original.id] ?? original;
                  const floorMat = floorMaterialForProduct(p);
                  if (floorMat) {
                    // FLOOR card: a tap arms the Floor tool on this material
                    // (the HUD card in RoomCanvas takes over). Details are
                    // separate; floor products are never dropped as loose items.
                    const isOn = tool === 'floor' && floorMaterialId === floorMat.id;
                    return (
                      <div key={original.id} className="catalog-product-tile"><button
                        type="button"
                        data-testid="sims-thumb"
                        data-product-id={p.id}
                        data-category={p.category}
                        data-macro={macroOf(p)}
                        data-floor-material={floorMat.id}
                        title="Laid with the Floor tool"
                        aria-label={`${p.name} — tap to lay this floor`}
                        aria-pressed={isOn}
                        onClick={() => armFloor(floorMat.id)}
                        onContextMenu={(e) => e.preventDefault()}
                        className={`ppw-no-callout relative flex h-24 w-[104px] flex-col items-center justify-start overflow-hidden rounded-xl px-1.5 pb-1 pt-1 ${DOCK_CONTROL}`}
                        style={{
                          background: DOCK_BG_RAISED,
                          boxShadow: isOn
                            ? `inset 0 0 0 2px ${DOCK_ACCENT}, 0 0 0 3px var(--catalog-armed-glow)`
                            : `inset 0 0 0 1px ${DOCK_BORDER}, 0 3px 8px var(--catalog-card-shadow)`,
                        }}
                      >
                        <span className="relative block h-[52px] w-full shrink-0"><ThumbImage product={p} /></span>
                        <span
                          aria-hidden="true"
                          className="pointer-events-none absolute left-1 top-1 rounded px-1 py-0.5 text-[11px] font-semibold leading-none"
                          style={{
                            background: DOCK_BG_RAISED,
                            color: DOCK_TEXT,
                            border: `1px solid ${DOCK_BORDER}`,
                          }}
                        >
                          Floor
                        </span>
                        <span aria-hidden="true" className="mt-1 block w-full truncate text-[11px] font-medium" style={{ color: DOCK_TEXT }}>{p.name}</span>
                      </button>
                      <button type="button" data-detail-id={original.id} className="catalog-tile-details" title={`Details for ${p.name}`} aria-label={`Details for ${p.name}`} onClick={() => setSelected(original)}><span aria-hidden="true">ⓘ</span></button>
                      </div>
                    );
                  }
                  return (
                  <div key={original.id} className="catalog-product-tile">
                  <button
                    type="button"
                    data-testid="sims-thumb"
                    data-product-id={p.id}
                    data-category={p.category}
                    data-macro={macroOf(p)}
                    title={p.name}
                    aria-label={`${p.name} — choose position, or hold and drag onto the floor`}
                    onPointerDown={(e) => start(e, p.id, catalogDragImageUrl(p))}
                    onClick={(event) => { if (event.detail === 0) choosePosition(p.id); }}
                    // Bug 1 (2026-05-28) — long-press should drag, not pop the
                    // browser "Save image" menu over the catalog thumbnail.
                    onContextMenu={(e) => e.preventDefault()}
                    className={`ppw-no-callout relative flex h-24 w-[104px] flex-col items-center justify-start overflow-hidden rounded-xl px-1.5 pb-1 pt-1 ${DOCK_CONTROL}`}
                    style={{ background: DOCK_BG_RAISED, boxShadow: `inset 0 0 0 1px ${DOCK_BORDER}, 0 3px 8px var(--catalog-card-shadow)` }}
                  >
                    {/* Polish (2026-05-29) — brand shimmer skeleton while the
                        thumbnail hydrates; fades out on load (or on error,
                        leaving the cream tile). Reduced-motion handled inside. */}
                    <span className="relative block h-[52px] w-full shrink-0"><ThumbImage product={p} /></span>
                    <span aria-hidden="true" className="mt-1 block w-full truncate text-[11px] font-medium" style={{ color: DOCK_TEXT }}>{p.name}</span>
                  </button>
                  <button type="button" data-detail-id={original.id} className="catalog-tile-details" title={`Details for ${p.name}`} aria-label={`Details for ${p.name}`} onClick={() => setSelected(original)}><span aria-hidden="true">ⓘ</span></button>
                  </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
        {!minimized && !selected && (viewMode !== '3d' || !categoryHome) && <div className="sr-only">
          <span role="status" aria-live="polite">{filtered.length} {filtered.length === 1 ? 'product' : 'products'}</span>

        </div>}
        {!minimized && productDetails}
      </section>

      {ghost}
    </>
  );
}

/** Existing-model PNG, real source photo, then category symbol. */
function ThumbImage({ product }: { product: Product }) {
  return <CatalogProductImage product={product} />;
}
