/**
 * SimsDock — the DESKTOP build-mode catalog (Vic 2026-08-25, complaints
 * 2 + 4).
 *
 * Replaces the 288 px left `ProductPalette` column. Together with dropping
 * the 224 px `RoomList` rail and un-pinning the 320 px `DetailsPanel`, this
 * takes the drawing surface from 56.7 % of the viewport width to full
 * width — the whole point of complaint 2.
 *
 * Search, category tabs and sorting stay visible above a compact product
 * strip. Collapsing the strip returns its height to the drawing surface.
 *
 * PLACEMENT IS UNCHANGED. Clicking a tile arms `pendingProductId` exactly
 * as the old ProductPalette card did (same toggle-off-on-second-click, same
 * `data-armed` / `data-product-id` / `data-macro` attributes the e2e suite
 * asserts on), and `RoomCanvas`'s pointer-FSM commits it. No new store, no
 * new intent path, no touch of the Konva stable-lock.
 *
 * PPWellness Shop tokens, visible product names and prices, and the shared
 * CHROME_FOCUS_RING keep the desktop and phone catalogs consistent.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { productImageUrl, thumbnailFor } from '../../data/products';
import { useMerchantCatalog } from '../../lib/useMerchantCatalog';
import { CatalogConnectionNotice } from '../CatalogConnectionNotice';
import type { Product } from '../../data/products.schema';
import { mergeCatalog } from '../../data/mergeCatalog';
import {
  visibleMacroCategories,
  MACRO_CATEGORY_LABEL,
  macroOf,
  type MacroCategory,
} from '../mobile/catalogMacros';
import { MacroIcon } from '../mobile/MacroIcon';
// Sims drag-drop (2026-08-28, D-B1) - the SAME pointer hook the mobile
// surfaces use. One mechanism for mouse and touch; two would drift.
import { useDragToPlace } from '../mobile/useDragToPlace';
import { useDragPointerStore } from '../../store/dragPointerStore';
import { DetailCard } from '../../designer/DetailCard';
// Floor tool (2026-08-30): the six K1 tile/roll SKUs are FLOOR cards. Their
// card arms the Floor tool with that material instead of placing a loose
// item, so the catalog and the Floor panel are one path, not two.
import { floorMaterialForProduct } from '../../data/floorMaterials';
import { useDesignerUIStore } from '../../store/designerUIStore';
import { CATALOG_CHROME, catalogPrice, catalogRequestCategory, filterCatalog, handleCatalogCategoryKey, type CatalogSort } from '../catalogPresentation';
import '../catalogChrome.css';

const { CHROME_TEXT_2, DOCK_ACCENT, DOCK_BG, DOCK_BG_RAISED, DOCK_BORDER, DOCK_TEXT } = CATALOG_CHROME;

/**
 * Toolbar contract (2026-08-29): the ONE motion + focus recipe every dock
 * control shares. 120 ms ease-out, none under reduced-motion, 3 px
 * `CHROME_FOCUS_RING` (rgba(121,199,173,.45)) on focus-visible. Tailwind
 * arbitrary values because the ring colour has no utility of its own.
 */
const DOCK_CONTROL =
  'transition-colors duration-[120ms] ease-out motion-reduce:transition-none focus:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--catalog-focus)]';

export interface SimsDockProps {
  pendingProductId?: string | null;
  setPendingProductId?: (id: string | null) => void;
}

interface HoverState {
  product: Product;
  anchorXPx: number;
  anchorYPx: number;
}

export function SimsDock({ pendingProductId, setPendingProductId }: SimsDockProps = {}) {
  const viewMode = useDesignerUIStore((s) => s.viewMode);
  const [activeCategory, setActiveCategory] = useState<MacroCategory>('all');
  const [collapsed, setCollapsed] = useState(false);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<CatalogSort>('catalog');
  const apiProducts = useMerchantCatalog();
  const [hover, setHover] = useState<HoverState | null>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const stripRef = useRef<HTMLUListElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setCollapsed(viewMode === '3d'); setHover(null); }, [viewMode]);
  useEffect(() => {
    let focusFrame: number | undefined;
    const open = (event: Event) => {
      if (window.innerWidth < 1024) return;
      const category = catalogRequestCategory(event);
      setActiveCategory(category ?? 'all');
      setQuery('');
      setCollapsed(false);
      setHover(null);
      if (focusFrame !== undefined) cancelAnimationFrame(focusFrame);
      focusFrame = requestAnimationFrame(() => {
        const target = category
          ? sectionRef.current?.querySelector<HTMLButtonElement>(`[data-testid="dock-cat-${category}"]`)
          : searchRef.current;
        (target ?? searchRef.current)?.focus({ preventScroll: true });
        target?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
      });
    };
    window.addEventListener('ppw:open-catalog', open);
    return () => {
      window.removeEventListener('ppw:open-catalog', open);
      if (focusFrame !== undefined) cancelAnimationFrame(focusFrame);
    };
  }, []);

  // Publish the dock's live height as `--sims-dock-h` so the DetailsPanel
  // overlay can stop exactly above it instead of covering the toolbar.
  // Below 1024 px the dock is `display:none` → offsetHeight 0 → the var is
  // 0 px and the mobile layout is untouched. Mirrors the same trick
  // SimsBottomToolbar plays with `--sims-toolbar-h`.
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const root = document.documentElement;
    const apply = () => root.style.setProperty('--sims-dock-h', `${el.offsetHeight}px`);
    apply();
    // ResizeObserver is absent in jsdom — degrade to the one-shot apply.
    if (typeof ResizeObserver === 'undefined') {
      return () => root.style.setProperty('--sims-dock-h', '0px');
    }
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => {
      ro.disconnect();
      root.style.setProperty('--sims-dock-h', '0px');
    };
  }, []);

  // Same blend + SKU-dedup as the old ProductPalette so a merchant product
  // still resolves through getProductById on the canvas side, and the 14 K1
  // SKUs that exist in BOTH /api/products and the bundled seed show once.

  const allProducts = useMemo(() => mergeCatalog(apiProducts), [apiProducts]);

  const filtered = useMemo(() => filterCatalog(allProducts, activeCategory, query, sort), [allProducts, activeCategory, query, sort]);
  useEffect(() => { if (stripRef.current) stripRef.current.scrollLeft = 0; }, [activeCategory, query, sort]);
  useEffect(() => () => { if (hoverTimer.current) clearTimeout(hoverTimer.current); }, []);

  function armHover(product: Product, rect: DOMRect): void {
    if (hoverTimer.current) {
      clearTimeout(hoverTimer.current);
      hoverTimer.current = null;
    }
    setHover({
      product,
      // Anchor ABOVE the tile — the dock sits at the bottom of the screen,
      // so the card has to open upward or it lands off-viewport.
      anchorXPx: rect.left + rect.width / 2,
      anchorYPx: rect.top,
    });
  }

  function disarmHover(): void {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => setHover(null), 80);
  }

  /**
   * Arm WITHOUT toggling off (Sims drag-drop, D-B9).
   *
   * `toggleArm` disarms when the tile is already armed. On pointerdown that
   * is wrong for a drag: pressing an armed tile to drag it would drop the
   * `data-armed="true"` count from 2 to 1 mid-gesture and race every count
   * assertion in five e2e specs. Pointerdown arms idempotently; the
   * toggle-off is deferred to a release that never became a drag.
   */
  function armOnly(p: Product): void {
    if (!setPendingProductId) return;
    if (pendingProductId !== p.id) setPendingProductId(p.id);
  }

  /**
   * Desktop drag. `mode: immediate` is mandatory - in longpress mode any
   * pre-arm movement cancels the gesture as a strip scroll, so a quick
   * mouse press-drag would silently do nothing. `liftPx: 0` because the 56 px
   * anti-occlusion lift is a finger affordance. 14 px threshold so a
   * trackpad wobble does not promote a click into a drag.
   */
  const dragPointer = useDragPointerStore();
  /**
   * Was this tile ALREADY armed when the press started?
   *
   * Pointerdown arms idempotently, so without this a release that never
   * became a drag would immediately disarm the product the same press just
   * armed - a wobble on an unarmed tile would leave nothing in hand.
   * Toggle-off is only correct when the user pressed a tile that was
   * already armed.
   */
  const armedBeforePress = useRef(false);
  // Scalar selector: subscribing to the whole store object would re-render
  // the dock on every pointer move.
  const overCanvas = useDragPointerStore((st) => st.overCanvas);
  const dockDrag = useDragToPlace({
    mode: 'immediate',
    liftPx: 0,
    moveThresholdPx: 14,
    onDragStart: (productId, x, y) => {
      const p = allProducts.find((q: Product) => q.id === productId);
      if (p) armOnly(p);
      disarmHover();
      dragPointer.begin(productId, x, y);
    },
    onDragMove: (productId, x, y) => dragPointer.move(productId, x, y),
    onDrop: (_productId, _x, _y, shiftKey) => dragPointer.release(shiftKey),
    onCancel: () => dragPointer.cancel(),
  });

  function toggleArm(p: Product): void {
    if (!setPendingProductId) return;
    setPendingProductId(pendingProductId === p.id ? null : p.id);
  }

  // Floor tool state — a floor card reads as "on" while the tool is open on
  // its material. Scalar selectors: the dock must not re-render per draft
  // patch it does not show.
  const tool = useDesignerUIStore((s) => s.tool);
  const floorMaterialId = useDesignerUIStore((s) => s.floorDraft.materialId);
  const setFloorDraft = useDesignerUIStore((s) => s.setFloorDraft);
  const setTool = useDesignerUIStore((s) => s.setTool);

  /**
   * Arm the Floor tool with this card's material. Idempotent (no toggle-off:
   * the panel's Done / Esc closes the tool) and it drops any armed product,
   * so a click never leaves both a ghost and a floor stroke in hand.
   */
  function armFloor(materialId: string): void {
    setFloorDraft({ materialId, erase: false });
    setTool('floor');
    if (setPendingProductId && pendingProductId) setPendingProductId(null);
    setHover(null);
  }

  const emptyLabel = MACRO_CATEGORY_LABEL[activeCategory];

  return (
    <>
      <section
        ref={sectionRef}
        data-testid="sims-dock"
        data-catalog-mode={viewMode}
        aria-label="Build catalog"
        // Desktop only — below 1024 px the mobile SimsBottomToolbar is the
        // catalog. `shrink-0` keeps the dock OUT of the canvas's flex grow
        // so the measured stage height is honest: the canvas really is the
        // remaining height, rather than being overlapped by a floating bar
        // and only appearing to be full-height.
        className="sims-catalog hidden min-w-0 shrink-0 flex-col gap-2 px-3 py-2 lg:flex"
        style={{
          background: DOCK_BG,
          borderTop: `1px solid ${DOCK_BORDER}`,
          boxShadow: '0 -6px 20px rgba(42,41,38,0.10)',
        }}
      >
        <CatalogConnectionNotice />
        {/* The DOM thumbnail ghost shows only while the pointer is OUTSIDE
            the canvas. Over the canvas the Konva footprint ghost is the
            single truth, so exactly one preview is ever visible. */}
        {!overCanvas && dockDrag.ghost}

        <div className="flex min-w-0 items-center gap-2">
          {viewMode === '3d' && <span className="mr-1 hidden shrink-0 text-[11px] font-semibold uppercase tracking-[.16em] xl:block" style={{ color: DOCK_ACCENT }}>Furnish</span>}
          <label className="catalog-field flex h-10 w-[210px] shrink-0 items-center gap-2 rounded-xl border px-2.5 focus-within:ring-2 focus-within:ring-[var(--catalog-focus)] xl:w-[250px]" style={{ borderColor: DOCK_BORDER }}>
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5" /><path d="m13 13 4 4" /></svg>
            <input ref={searchRef} type="search" value={query} data-testid="dock-search" aria-label="Search product catalog" placeholder="Search products or brands"
              onChange={(event) => { setQuery(event.target.value); setCollapsed(false); setHover(null); }}
              onKeyDown={(event) => { event.stopPropagation(); if (event.key === 'Escape') setQuery(''); }}
              className="catalog-field min-w-0 flex-1 text-[12px] outline-none" />
          </label>
        <div
          role="tablist"
          aria-label="Product category"
          className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto py-1 [scrollbar-width:thin]"
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
                data-testid={`dock-cat-${mc}`}
                onClick={() => {
                  setActiveCategory(mc);
                  setCollapsed(false);
                }}
                className={`flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg px-2.5 ${DOCK_CONTROL} ${
                  active ? '' : 'hover:bg-[var(--catalog-hover)]'
                }`}
                style={{
                  // Shop soft-neumorphic selected style: dark ink on a mint
                  // tint with a mint rim (NOT mint text, which is illegible
                  // on the light dock). Matches the shop side-item.
                  color: active ? 'var(--catalog-selected-text)' : DOCK_TEXT,
                  background: active ? 'var(--catalog-selected)' : undefined,
                  boxShadow: active ? `inset 0 0 0 1px ${DOCK_ACCENT}` : 'none',
                }}
                title={`${MACRO_CATEGORY_LABEL[mc]} — show this category`}
              >
                <MacroIcon macro={mc} size={17} />
                {/* Caption: 11/600 uppercase, .06em — the contract floor.
                    (Was 9 px, below the 11 px minimum.) */}
                <span className="text-[12px] font-medium leading-none">
                  {MACRO_CATEGORY_LABEL[mc]}
                </span>
              </button>
            );
          })}
        </div>
          <select data-testid="dock-sort" aria-label="Sort products" value={sort} onChange={(event) => { setSort(event.target.value as CatalogSort); setCollapsed(false); }}
            className={`catalog-field h-10 w-[124px] shrink-0 rounded-lg border px-2 text-[12px] ${DOCK_CONTROL}`} style={{ borderColor: DOCK_BORDER, color: DOCK_TEXT }}>
            <option value="catalog">Catalog order</option><option value="name">Name A–Z</option><option value="footprint">Smallest first</option>
          </select>
          <button type="button" data-testid="dock-collapse" aria-label={collapsed ? 'Show product strip' : 'Hide product strip'} aria-expanded={!collapsed} aria-controls="desktop-catalog-products"
            onClick={() => { setCollapsed((value) => !value); setHover(null); }} title={collapsed ? 'Show product strip' : 'Hide product strip'}
            className={`catalog-field flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${DOCK_CONTROL}`} style={{ borderColor: DOCK_BORDER, color: DOCK_TEXT }}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ transform: collapsed ? 'none' : 'rotate(180deg)' }}><path d="m6 14 6-6 6 6" /></svg>
          </button>
        </div>

        {/* Product strip — horizontally scrollable, one row of tiles. */}
        {!collapsed && <div className="flex min-w-0 items-stretch gap-3">
          <div className="flex w-[76px] shrink-0 flex-col justify-center gap-1 border-r pr-2 text-[11px]" style={{ borderColor: DOCK_BORDER, color: CHROME_TEXT_2 }}>
            <span className="font-semibold" style={{ color: DOCK_TEXT }}>{emptyLabel}</span>
            <span role="status" aria-live="polite">{filtered.length} {filtered.length === 1 ? 'product' : 'products'}</span>
            <span className="mt-1 leading-snug">Drag into your design</span>
          </div>
          <ul
            ref={stripRef}
            id="desktop-catalog-products"
            data-testid="dock-strip"
            aria-label={`${emptyLabel} products`}
            className="scroll-pane flex min-w-0 flex-1 items-center gap-2 overflow-x-auto overflow-y-hidden px-1 py-1 [scrollbar-width:thin]"
          >
            {filtered.length === 0 ? (
              <li className="px-3 text-[12px] font-medium" style={{ color: CHROME_TEXT_2 }}>
                <span>{query.trim() ? `No matches for “${query.trim()}” in ${emptyLabel}.` : `No products in ${emptyLabel} yet.`}</span>
                {query.trim() && <button type="button" className={`ml-3 min-h-10 rounded-lg px-2 font-semibold underline ${DOCK_CONTROL}`} onClick={() => setQuery('')}>Clear search</button>}
              </li>
            ) : (
              filtered.map((p) => {
                const isPending = pendingProductId === p.id;
                const floorMat = floorMaterialForProduct(p);
                if (floorMat) {
                  // FLOOR card: no placement, no drag. Click arms the Floor
                  // tool on this material; the docked Floor panel is the
                  // indicator. `data-armed` stays false so the e2e armed
                  // counts (dock tile + canvas = 2) are untouched.
                  const isOn = tool === 'floor' && floorMaterialId === floorMat.id;
                  return (
                    <li key={p.id} className="shrink-0">
                      <div
                        role="button"
                        tabIndex={0}
                        aria-pressed={isOn}
                        aria-label={`Lay ${p.name} floor — ${catalogPrice(p)}`}
                        title="Laid with the Floor tool"
                        onClick={() => armFloor(floorMat.id)}
                        onKeyDown={(e) => {
                          if (e.key !== 'Enter' && e.key !== ' ') return;
                          e.preventDefault();
                          armFloor(floorMat.id);
                        }}
                        onPointerEnter={(e) =>
                          armHover(p, (e.currentTarget as HTMLElement).getBoundingClientRect())
                        }
                        onPointerLeave={disarmHover}
                        onFocus={(e) =>
                          armHover(p, (e.currentTarget as HTMLElement).getBoundingClientRect())
                        }
                        onBlur={disarmHover}
                        data-product-id={p.id}
                        data-category={p.category}
                        data-macro={macroOf(p)}
                        data-armed="false"
                        data-floor-material={floorMat.id}
                        className={`ppw-no-callout relative flex h-[92px] w-[112px] cursor-pointer flex-col items-center justify-start overflow-hidden rounded-xl px-2 pb-1 pt-1 ${DOCK_CONTROL}`}
                        style={{
                          background: DOCK_BG_RAISED,
                          boxShadow: isOn
                            ? `inset 0 0 0 2px ${DOCK_ACCENT}, 0 0 0 3px var(--catalog-armed-glow)`
                            : `inset 0 0 0 1px ${DOCK_BORDER}, 0 3px 8px var(--catalog-card-shadow)`,
                        }}
                      >
                        <DockThumb product={p} />
                        <FloorBadge />
                        <span className="mt-0.5 block w-full truncate text-center text-[11px] font-medium" aria-hidden="true">{p.name}</span>
                        <span className="catalog-muted block w-full truncate text-center text-[11px] tabular-nums" aria-hidden="true">{catalogPrice(p)}</span>
                      </div>
                    </li>
                  );
                }
                return (
                  <li key={p.id} className="shrink-0">
                    <div
                      role="button"
                      tabIndex={0}
                      aria-pressed={isPending}
                      aria-label={`Place ${p.name} — ${catalogPrice(p)}`}
                      title={`${p.name} · ${catalogPrice(p)}`}
                      // Same pointer-down arm as the retired ProductPalette
                      // card — the placement FSM is untouched.
                      onPointerDown={(e) => {
                        if (e.button !== 0) return;
                        // Arm immediately so the ghost and data-armed are live
                        // from the first pixel of movement; the drag hook takes
                        // over from here.
                        armedBeforePress.current = pendingProductId === p.id;
                        armOnly(p);
                        dockDrag.start(e, p.id, productImageUrl(p));
                      }}
                      onPointerUp={() => {
                        // A press that never became a drag is still a click, and
                        // clicking an armed tile should disarm it.
                        if (
                          !dockDrag.dragging &&
                          armedBeforePress.current &&
                          pendingProductId === p.id
                        ) {
                          toggleArm(p);
                        }
                        armedBeforePress.current = false;
                      }}
                      onKeyDown={(e) => {
                        if (e.key !== 'Enter' && e.key !== ' ') return;
                        e.preventDefault();
                        toggleArm(p);
                      }}
                      onPointerEnter={(e) =>
                        armHover(p, (e.currentTarget as HTMLElement).getBoundingClientRect())
                      }
                      onPointerLeave={disarmHover}
                      onFocus={(e) =>
                        armHover(p, (e.currentTarget as HTMLElement).getBoundingClientRect())
                      }
                      onBlur={disarmHover}
                      data-product-id={p.id}
                      data-category={p.category}
                      data-macro={macroOf(p)}
                      data-armed={isPending ? 'true' : 'false'}
                      className={`ppw-no-callout relative flex h-[92px] w-[112px] cursor-pointer touch-none flex-col items-center justify-start overflow-hidden rounded-xl px-2 pb-1 pt-1 ${DOCK_CONTROL}`}
                      style={{
                        background: DOCK_BG_RAISED,
                        // Raised soft-neumorphic tile (shop --raise-sm dual
                        // light) at rest; mint ring + halo when armed (the
                        // ONE place mint is an active state — Vic's
                        // shop-match decision).
                        boxShadow: isPending
                          ? `inset 0 0 0 2px ${DOCK_ACCENT}, 0 0 0 3px var(--catalog-armed-glow)`
                          : `inset 0 0 0 1px ${DOCK_BORDER}, 0 3px 8px var(--catalog-card-shadow)`,
                      }}
                    >
                      <DockThumb product={p} />
                      <span className="mt-0.5 block w-full truncate text-center text-[11px] font-medium" aria-hidden="true">{p.name}</span>
                      <span className="catalog-muted block w-full truncate text-center text-[11px] tabular-nums" aria-hidden="true">{catalogPrice(p)}</span>
                    </div>
                  </li>
                );
              })
            )}
          </ul>
        </div>}

      </section>

      {/* Sims-style floating detail card on hover. Carries the same testid
          the P0-zeta e2e asserts on — the card moved from the sidebar to the
          dock, it did not disappear. */}
      {/* The hover detail card is suppressed while a drag is in flight - it
          is a browsing affordance, and during a drag it is just clutter over
          the plan the user is aiming at. */}
      {/* Also hidden while a product is ARMED: the card used to stay open
          after the arming click and swallowed the placement click on the
          canvas beneath it (bottom-right corner drops never landed). */}
      {hover && !dockDrag.dragging && !pendingProductId && (
        <div
          data-testid="product-hover-card"
          className="hidden lg:block"
          onPointerEnter={() => {
            if (hoverTimer.current) clearTimeout(hoverTimer.current);
          }}
          onPointerLeave={disarmHover}
        >
          <DetailCard
            anchorXPx={hover.anchorXPx}
            anchorYPx={hover.anchorYPx}
            canvasWidthPx={typeof window !== 'undefined' ? window.innerWidth : 1280}
            canvasHeightPx={typeof window !== 'undefined' ? window.innerHeight : 720}
            thumbUrl={productImageUrl(hover.product)}
            name={hover.product.name}
            priceMur={Math.round(hover.product.price?.value ?? 0)}
            description={
              hover.product.notes?.trim()
                ? `${hover.product.notes.trim()}\n${hover.product.dimensions_cm.length}×${hover.product.dimensions_cm.width}×${hover.product.dimensions_cm.height} cm · ${hover.product.supplier}`
                : `${hover.product.dimensions_cm.length}×${hover.product.dimensions_cm.width}×${hover.product.dimensions_cm.height} cm · ${hover.product.supplier}`
            }
            actions={
              floorMaterialForProduct(hover.product)
                ? [
                    {
                      id: 'lay-floor',
                      label: 'Lay this floor',
                      onClick: () => armFloor(floorMaterialForProduct(hover.product)!.id),
                    },
                  ]
                : setPendingProductId
                  ? [
                      {
                        id: 'place',
                        label: 'Place on floor',
                        onClick: () => {
                          setPendingProductId(hover.product.id);
                          setHover(null);
                        },
                      },
                    ]
                  : []
            }
            onDismiss={() => setHover(null)}
          />
        </div>
      )}
    </>
  );
}

/**
 * Dock tile art. Real product photo (the shop's selling surface — the brief
 * is explicit that product art stays PHOTOREAL), falling back to the inline
 * category SVG so a 404 never leaves an empty tile. The pale plate behind
 * the photo is deliberate: catalog photography is shot on white, so on the
 * dark dock it needs its own ground or it reads as a floating smudge.
 */
function DockThumb({ product }: { product: Product }) {
  const [errored, setErrored] = useState(false);
  const src = productImageUrl(product);
  if (errored || !src) {
    return (
      <div
        className="flex h-[50px] w-[72px] shrink-0 items-center justify-center rounded-md"
        style={{ background: '#f5f3ed' }}
        dangerouslySetInnerHTML={{ __html: thumbnailFor(product.category) }}
      />
    );
  }
  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      draggable={false}
      onError={() => setErrored(true)}
      className="h-[50px] w-[88px] shrink-0 rounded-md object-contain"
      style={{ background: '#f5f3ed', padding: 2 }}
    />
  );
}

/**
 * "Floor" caption on a floor card (Floor tool, 2026-08-30). 11/600 uppercase
 * — the contract floor — on a chrome plate so it stays >= 4.5:1 over any
 * product photo. Purely visual; the card's title carries the explanation.
 */
function FloorBadge() {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute left-1 top-1 rounded px-1 py-0.5 text-[11px] font-semibold leading-none"
      style={{ background: DOCK_BG_RAISED, color: DOCK_TEXT, border: `1px solid ${DOCK_BORDER}` }}
    >
      Floor
    </span>
  );
}
