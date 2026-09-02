/**
 * SimsBottomToolbar — Phase 2 + 4 of the mobile Sims rebuild.
 *
 * The persistent catalog. Replaces the old mobile bottom-sheet + floating
 * "Catalog" button. Sticky to the bottom of the viewport on screens
 * < 1024 px (the desktop 3-column layout is unchanged at ≥ 1024 px).
 *
 * Layout, left → right (per Vic's Sims-3 screenshot):
 *   • category icons (macro groups), active = ink on a mint tint (shop skin)
 *   • a double-row, horizontally-scrollable thumbnail strip filtered by
 *     the active category
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
import { getAllProducts, productImageUrl } from '../../data/products';
import { fetchApiProducts } from '../../data/apiCatalogAdapter';
import type { Product } from '../../data/products.schema';
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
import {
  MACRO_CATEGORY_ORDER,
  MACRO_CATEGORY_LABEL,
  macroOf,
  type MacroCategory,
} from './catalogMacros';
import { MacroIcon } from './MacroIcon';
import { MobileProductPopup } from './MobileProductPopup';
import { useDragToPlace } from './useDragToPlace';
// Toolbar pass (2026-08-29): the phone toolbar wears the SAME PPWellness
// Shop skin as the desktop SimsDock — warm off-white ground, hairline rims,
// dark warm ink, mint accent. The navy/gold constants it used to carry were
// the one place the two docks disagreed.
import {
  DOCK_ACCENT,
  DOCK_BG,
  DOCK_BG_RAISED,
  DOCK_BORDER,
  DOCK_TEXT,
} from '../../designer/blueprintTheme';

/** Cream photo plate behind every thumbnail — unchanged (product art is shot on it). */
const THUMB_PLATE = '#F5EBD7';

/**
 * Shared control chrome: 120 ms colour transition (none under
 * reduced-motion) + the mint focus ring. Same string the desktop dock uses.
 */
const DOCK_CONTROL =
  'transition-colors duration-[120ms] ease-out motion-reduce:transition-none focus:outline-none focus-visible:ring-[3px] focus-visible:ring-[rgba(121,199,173,0.45)]';

export function SimsBottomToolbar() {
  const [activeCategory, setActiveCategory] = useState<MacroCategory>('all');
  const [minimized, setMinimized] = useState(false);
  const [selected, setSelected] = useState<Product | null>(null);
  const [apiProducts, setApiProducts] = useState<Product[]>([]);

  const placeAtCenter = usePlacementIntentStore((s) => s.placeAtCenter);
  const placeAt = usePlacementIntentStore((s) => s.placeAt);
  const sectionRef = useRef<HTMLElement>(null);

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
  useEffect(() => {
    let cancelled = false;
    fetchApiProducts().then((rows) => {
      if (!cancelled) setApiProducts(rows);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const allProducts = useMemo(
    () => [...apiProducts, ...getAllProducts()],
    [apiProducts],
  );

  const filtered = useMemo(() => {
    if (activeCategory === 'all') return allProducts;
    return allProducts.filter((p) => macroOf(p) === activeCategory);
  }, [allProducts, activeCategory]);

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
        aria-label="Product catalog"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-30 flex flex-col"
        style={{
          background: DOCK_BG,
          borderTop: `2px solid ${DOCK_ACCENT}`,
          maxHeight: '30vh',
          paddingBottom: 'env(safe-area-inset-bottom)',
          boxShadow: '0 -8px 24px rgba(42,41,38,0.18)',
        }}
      >
        {/* Category bar + minimize chevron */}
        <div className="flex items-center gap-2 px-2 py-1" style={{ borderBottom: `1px solid ${DOCK_BORDER}` }}>
          <div
            role="tablist"
            aria-label="Product category"
            className="flex flex-1 gap-1 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {MACRO_CATEGORY_ORDER.map((mc) => {
              const active = activeCategory === mc;
              return (
                <button
                  key={mc}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  data-testid={`sims-cat-${mc}`}
                  onClick={() => {
                    setActiveCategory(mc);
                    setMinimized(false);
                  }}
                  className={`flex h-11 min-w-[60px] shrink-0 flex-col items-center justify-center gap-1 rounded-lg px-1.5 ${DOCK_CONTROL} ${
                    active ? '' : 'hover:bg-[#faf9f5]'
                  }`}
                  style={{
                    // Shop selected style: dark ink on a mint tint with a
                    // mint rim — never mint (or gold) TEXT, which fails
                    // contrast on the light ground.
                    color: DOCK_TEXT,
                    background: active ? 'rgba(121,199,173,0.20)' : 'transparent',
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
          <button
            type="button"
            data-testid="sims-toolbar-minimize"
            aria-label={minimized ? 'Expand catalog' : 'Minimize catalog'}
            aria-expanded={!minimized}
            onClick={() => setMinimized((v) => !v)}
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg hover:bg-[#f3f1ec] active:shadow-[inset_0_1px_2px_rgba(42,41,38,0.18)] ${DOCK_CONTROL}`}
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

        {/* Double-row thumbnail strip */}
        {!minimized && (
          <div
            data-testid="sims-thumb-strip"
            className="overflow-x-auto overflow-y-hidden px-2 py-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {filtered.length === 0 ? (
              <p className="px-2 py-4 text-center text-[12px] font-medium" style={{ color: DOCK_TEXT }}>
                No products in this category yet.
              </p>
            ) : (
              <div
                className="grid"
                style={{
                  gridTemplateRows: 'repeat(2, 64px)',
                  gridAutoFlow: 'column',
                  gridAutoColumns: '64px',
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
                        className={`ppw-no-callout relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-lg ${DOCK_CONTROL}`}
                        style={{
                          background: THUMB_PLATE,
                          boxShadow: isOn
                            ? `inset 0 0 0 2px ${DOCK_ACCENT}, 0 0 0 3px rgba(121,199,173,0.35)`
                            : `inset 0 0 0 1px ${DOCK_BORDER}`,
                        }}
                      >
                        <ThumbImage src={productImageUrl(p)} />
                        <span
                          aria-hidden="true"
                          className="pointer-events-none absolute bottom-0 left-0 right-0 flex h-[16px] items-center justify-center text-[11px] font-semibold uppercase leading-none tracking-[0.06em]"
                          style={{
                            background: 'rgba(250,249,245,0.92)',
                            color: DOCK_TEXT,
                            borderTop: `1px solid ${DOCK_BORDER}`,
                          }}
                        >
                          Floor
                        </span>
                      </button>
                    );
                  }
                  return (
                  <button
                    key={p.id}
                    type="button"
                    data-testid="sims-thumb"
                    data-product-id={p.id}
                    title={p.name}
                    aria-label={`${p.name} — tap for details, hold to drag onto the floor`}
                    onPointerDown={(e) => start(e, p.id, productImageUrl(p))}
                    // Bug 1 (2026-05-28) — long-press should drag, not pop the
                    // browser "Save image" menu over the catalog thumbnail.
                    onContextMenu={(e) => e.preventDefault()}
                    className={`ppw-no-callout relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-lg ${DOCK_CONTROL}`}
                    style={{ background: THUMB_PLATE, boxShadow: `inset 0 0 0 1px ${DOCK_BORDER}` }}
                  >
                    {/* Polish (2026-05-29) — brand shimmer skeleton while the
                        thumbnail hydrates; fades out on load (or on error,
                        leaving the cream tile). Reduced-motion handled inside. */}
                    <ThumbImage src={productImageUrl(p)} />
                  </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
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
function ThumbImage({ src }: { src: string }) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);
  const showSkeleton = !loaded && !errored;
  return (
    <>
      {showSkeleton && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 animate-pulse motion-reduce:animate-none"
          style={{
            // Cream plate with a soft mint sheen (the dock accent). Subtle
            // (low-contrast) so it never looks like an error.
            background: `linear-gradient(110deg, ${THUMB_PLATE} 0%, ${DOCK_ACCENT}55 45%, ${THUMB_PLATE} 90%)`,
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
          padding: 4,
          position: 'relative',
          opacity: loaded ? 1 : 0,
          transition: 'opacity 200ms ease',
        }}
      />
    </>
  );
}
