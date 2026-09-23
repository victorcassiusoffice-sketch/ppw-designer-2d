/**
 * SimsBottomToolbar — Phase 2 + 4 of the mobile Sims rebuild.
 *
 * The persistent catalog. Replaces the old mobile bottom-sheet + floating
 * "Catalog" button. Sticky to the bottom of the viewport on screens
 * < 1024 px, with SimsDock handling the desktop catalog.
 *
 * Layout, left → right (per Vic's Sims-3 screenshot):
 *   • category icons (macro groups), active = ink on a mint tint (shop skin)
 *   • search and sorting above a horizontal strip of named product cards
 *   • a minimize chevron that collapses the strip (icons stay visible)
 *
 * Interactions:
 *   • tap a thumbnail        → MobileProductPopup (bigger image + desc + "+")
 *   • long-press + drag      → drag ghost; release on the floor places it
 *   • popup "+ Add to room"  → auto-place at the centre of the canvas
 *
 * Placement is published to placementIntentStore; RoomCanvas runs the
 * validated placement. No engine change — Konva stable-lock untouched.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { productImageUrl, thumbnailFor } from '../../data/products';
import { useMerchantCatalog } from '../../lib/useMerchantCatalog';
import { CatalogConnectionNotice } from '../CatalogConnectionNotice';
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
  visibleMacroCategories,
  MACRO_CATEGORY_LABEL,
  macroOf,
  type MacroCategory,
} from './catalogMacros';
import { MacroIcon } from './MacroIcon';
import { MobileProductPopup } from './MobileProductPopup';
import { useDragToPlace } from './useDragToPlace';
import { CATALOG_CHROME, catalogPrice, catalogRequestCategory, filterCatalog, handleCatalogCategoryKey, type CatalogSort } from '../catalogPresentation';
import '../catalogChrome.css';

const { DOCK_ACCENT, DOCK_BG, DOCK_BG_RAISED, DOCK_BORDER, DOCK_TEXT } = CATALOG_CHROME;

/** Cream photo plate behind every thumbnail — unchanged (product art is shot on it). */
const THUMB_PLATE = '#F5EBD7';

/**
 * Shared control chrome: 120 ms colour transition (none under
 * reduced-motion) + the mint focus ring. Same string the desktop dock uses.
 */
const DOCK_CONTROL =
  'transition-colors duration-[120ms] ease-out motion-reduce:transition-none focus:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--catalog-focus)]';

export function SimsBottomToolbar() {
  const viewMode = useDesignerUIStore((s) => s.viewMode);
  const [activeCategory, setActiveCategory] = useState<MacroCategory>('all');
  const [minimized, setMinimized] = useState(false);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<CatalogSort>('catalog');
  const [selected, setSelected] = useState<Product | null>(null);
  const apiProducts = useMerchantCatalog();

  const placeAtCenter = usePlacementIntentStore((s) => s.placeAtCenter);
  const placeAt = usePlacementIntentStore((s) => s.placeAt);
  const sectionRef = useRef<HTMLElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (viewMode === '3d') setMinimized(true); }, [viewMode]);
  useEffect(() => {
    let focusFrame: number | undefined;
    const open = (event: Event) => {
      if (window.innerWidth >= 1024) return;
      const category = catalogRequestCategory(event);
      setActiveCategory(category ?? 'all');
      setQuery('');
      setMinimized(false);
      setSelected(null);
      if (focusFrame !== undefined) cancelAnimationFrame(focusFrame);
      focusFrame = requestAnimationFrame(() => {
        // Focus a category without opening the phone keyboard over the scene.
        const target = sectionRef.current?.querySelector<HTMLButtonElement>(`[data-testid="sims-cat-${category ?? 'all'}"]`);
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

  const filtered = useMemo(() => filterCatalog(allProducts, activeCategory, query, sort), [allProducts, activeCategory, query, sort]);
  useEffect(() => { if (stripRef.current) stripRef.current.scrollLeft = 0; }, [activeCategory, query, sort]);

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

  // Long-press a thumbnail → drag; tap → open the popup.
  const { start, ghost } = useDragToPlace({
    mode: 'longpress',
    onDrop: (productId, x, y) => placeAt(productId, x, y),
    onTap: (productId) => {
      const p = allProducts.find((x) => x.id === productId);
      if (p) setSelected(p);
    },
  });

  return (
    <>
      <section
        ref={sectionRef}
        data-testid="sims-bottom-toolbar"
        data-catalog-mode={viewMode}
        aria-label="Product catalog"
        className="sims-catalog lg:hidden fixed bottom-0 left-0 right-0 z-30 flex flex-col"
        style={{
          background: DOCK_BG,
          borderTop: `1px solid ${DOCK_BORDER}`,
          maxHeight: 'min(44dvh, 300px)',
          paddingBottom: 'env(safe-area-inset-bottom)',
          boxShadow: '0 -6px 20px rgba(42,41,38,0.12)',
        }}
      >
        <CatalogConnectionNotice />
        {/* Category bar + minimize chevron */}
        <div className="flex shrink-0 items-center gap-1 px-2 py-1" style={{ borderBottom: `1px solid ${DOCK_BORDER}` }}>
          <div
            role="tablist"
            aria-label="Product category"
            className="flex flex-1 gap-1 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {visibleMacroCategories(allProducts).map((mc) => {
              const active = activeCategory === mc;
              return (
                <button
                  key={mc}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  tabIndex={active ? 0 : -1}
                  onKeyDown={handleCatalogCategoryKey}
                  data-testid={`sims-cat-${mc}`}
                  onClick={() => {
                    setActiveCategory(mc);
                    setMinimized(false);
                  }}
                  className={`flex h-11 min-w-[60px] shrink-0 flex-col items-center justify-center gap-1 rounded-lg px-2 ${DOCK_CONTROL} ${
                    active ? '' : 'hover:bg-[var(--catalog-hover)]'
                  }`}
                  style={{
                    // Shop selected style: dark ink on a mint tint with a
                    // mint rim — never mint (or gold) TEXT, which fails
                    // contrast on the light ground.
                    color: active ? 'var(--catalog-selected-text)' : DOCK_TEXT,
                    background: active ? 'var(--catalog-selected)' : 'transparent',
                    boxShadow: active ? `inset 0 0 0 1px ${DOCK_ACCENT}` : 'none',
                  }}
                >
                  <MacroIcon macro={mc} size={20} />
                  {/* Caption: 11/600 uppercase, .06em — the contract floor
                      (was 9 px). */}
                  <span className="text-[11px] font-semibold uppercase leading-none tracking-[0.06em]">
                    {MACRO_CATEGORY_LABEL[mc]}
                  </span>
                </button>
              );
            })}
          </div>
          <button type="button" aria-label="Search catalog" data-testid="sims-search-open"
            onClick={() => { setMinimized(false); requestAnimationFrame(() => searchRef.current?.focus()); }}
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${DOCK_CONTROL}`} style={{ color: DOCK_TEXT }}>
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5" /><path d="m13 13 4 4" /></svg>
          </button>
          <button
            type="button"
            data-testid="sims-toolbar-minimize"
            aria-label={minimized ? 'Expand catalog' : 'Minimize catalog'}
            aria-expanded={!minimized}
            aria-controls="mobile-catalog-products"
            onClick={() => setMinimized((v) => !v)}
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg hover:bg-[var(--catalog-hover)] active:shadow-[inset_0_1px_2px_rgba(42,41,38,0.18)] ${DOCK_CONTROL}`}
            style={{
              color: DOCK_TEXT,
              background: DOCK_BG_RAISED,
              boxShadow: `inset 0 0 0 1px ${DOCK_BORDER}`,
            }}
          >
            <svg
              viewBox="0 0 24 24"
              width={20}
              height={20}
              fill="none"
              stroke="currentColor"
              strokeWidth={2.2}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className="motion-reduce:transition-none"
              style={{ transform: minimized ? 'rotate(180deg)' : 'none', transition: 'transform 120ms ease-out' }}
            >
              <path d="M6 15l6-6 6 6" />
            </svg>
          </button>
        </div>

        {!minimized && <div className="flex shrink-0 items-center gap-2 px-2 pt-2">
          <label className="catalog-field flex h-11 min-w-0 flex-1 items-center rounded-lg border px-2.5 focus-within:ring-2 focus-within:ring-[var(--catalog-focus)]" style={{ borderColor: DOCK_BORDER }}>
            <input ref={searchRef} type="search" value={query} data-testid="sims-search" aria-label="Search product catalog"
              placeholder={activeCategory === 'all' ? 'Search products or brands' : `Search ${MACRO_CATEGORY_LABEL[activeCategory].toLowerCase()}`}
              onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { event.stopPropagation(); if (event.key === 'Escape') setQuery(''); }} className="catalog-field min-w-0 flex-1 text-[16px] outline-none placeholder:text-[12px]" />
          </label>
          <select value={sort} data-testid="sims-sort" aria-label="Sort products" onChange={(event) => setSort(event.target.value as CatalogSort)}
            className={`catalog-field h-11 w-[116px] shrink-0 rounded-lg border px-2 text-[12px] ${DOCK_CONTROL}`} style={{ borderColor: DOCK_BORDER, color: DOCK_TEXT }}>
            <option value="catalog">Catalog order</option><option value="name">Name A–Z</option><option value="footprint">Smallest first</option>
          </select>
        </div>}

        {/* One named row keeps products recognizable and leaves the plan visible. */}
        {!minimized && (
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
                  gridTemplateRows: '96px',
                  gridAutoFlow: 'column',
                  gridAutoColumns: '104px',
                  gap: 8,
                }}
              >
                {filtered.map((p) => {
                  const floorMat = floorMaterialForProduct(p);
                  if (floorMat) {
                    // FLOOR card: a tap arms the Floor tool on this material
                    // (the HUD card in RoomCanvas takes over); no long-press
                    // drag, no popup — the tile is laid by the tool, never
                    // dropped as a loose item.
                    const isOn = tool === 'floor' && floorMaterialId === floorMat.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        data-testid="sims-thumb"
                        data-product-id={p.id}
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
                        <span aria-hidden="true" className="catalog-muted block w-full truncate text-[11px] tabular-nums">{catalogPrice(p)}</span>
                      </button>
                    );
                  }
                  return (
                  <button
                    key={p.id}
                    type="button"
                    data-testid="sims-thumb"
                    data-product-id={p.id}
                    data-category={p.category}
                    data-macro={macroOf(p)}
                    title={p.name}
                    aria-label={`${p.name} — tap for details, hold to drag onto the floor`}
                    onPointerDown={(e) => start(e, p.id, productImageUrl(p))}
                    onClick={(event) => { if (event.detail === 0) setSelected(p); }}
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
                    <span aria-hidden="true" className="catalog-muted block w-full truncate text-[11px] tabular-nums">{catalogPrice(p)}</span>
                  </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
        {!minimized && <div className="catalog-muted flex shrink-0 items-center justify-between gap-2 px-3 pb-1 text-[11px]">
          <span role="status" aria-live="polite">{filtered.length} {filtered.length === 1 ? 'product' : 'products'}</span>
          <span>Tap for details · hold to place</span>
        </div>}
      </section>

      {selected && (
        <MobileProductPopup
          product={selected}
          onAdd={(productId) => {
            placeAtCenter(productId);
            setSelected(null);
          }}
          onDragPlace={(productId, x, y) => placeAt(productId, x, y)}
          onClose={() => setSelected(null)}
        />
      )}
      {ghost}
    </>
  );
}

/**
 * Polish (2026-05-29) — catalog thumbnail with a brand-styled loading
 * skeleton. While the <img> is hydrating, a cream→mint→cream shimmer fills
 * the tile so it reads as "loading" rather than an empty cream square;
 * the shimmer fades the moment the image loads. On error the shimmer is
 * removed and the cream tile (set on the parent button) shows through,
 * preserving the existing graceful fallback. Reduced-motion users get a
 * static brand tint with no pulse (CSS `motion-reduce` variant). No deps,
 * no teal, no layout/geometry change.
 */
function ThumbImage({ product }: { product: Product }) {
  const src = productImageUrl(product);
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);
  const showSkeleton = !loaded && !errored;
  if (errored || !src) return <span className="flex h-full w-full items-center justify-center rounded-md [&>svg]:h-11 [&>svg]:w-11" style={{ background: THUMB_PLATE }} dangerouslySetInnerHTML={{ __html: thumbnailFor(product.category) }} />;
  return (
    <>
      {showSkeleton && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 animate-pulse motion-reduce:animate-none"
          style={{
            // Cream plate with a soft mint sheen (the dock accent). Subtle
            // (low-contrast) so it never looks like an error.
            background: `linear-gradient(110deg, ${THUMB_PLATE} 0%, #79c7ad55 45%, ${THUMB_PLATE} 90%)`,
          }}
        />
      )}
      <img
        src={src}
        alt=""
        draggable={false}
        onLoad={() => setLoaded(true)}
        onError={() => setErrored(true)}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          background: THUMB_PLATE,
          borderRadius: 6,
          padding: 4,
          position: 'relative',
          opacity: loaded ? 1 : 0,
          transition: 'opacity 200ms ease',
        }}
      />
    </>
  );
}
