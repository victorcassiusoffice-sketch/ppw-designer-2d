/**
 * SimsBottomToolbar — Phase 2 + 4 of the mobile Sims rebuild.
 *
 * The persistent catalog. Replaces the old mobile bottom-sheet + floating
 * "Catalog" button. Sticky to the bottom of the viewport on screens
 * < 1024 px (the desktop 3-column layout is unchanged at ≥ 1024 px).
 *
 * Layout, left → right (per Vic's Sims-3 screenshot):
 *   • category icons (macro groups), active highlighted gold
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
import {
  MACRO_CATEGORY_ORDER,
  MACRO_CATEGORY_LABEL,
  macroOf,
  type MacroCategory,
} from './catalogMacros';
import { MacroIcon } from './MacroIcon';
import { MobileProductPopup } from './MobileProductPopup';
import { useDragToPlace } from './useDragToPlace';

const NAVY = '#232C3B';
const NAVY_2 = '#2C3849';
const CREAM = '#F5EBD7';
const GOLD = '#FFBB58';

export function SimsBottomToolbar() {
  const [activeCategory, setActiveCategory] = useState<MacroCategory>('all');
  const [minimized, setMinimized] = useState(false);
  const [selected, setSelected] = useState<Product | null>(null);
  const [apiProducts, setApiProducts] = useState<Product[]>([]);

  const placeAtCenter = usePlacementIntentStore((s) => s.placeAtCenter);
  const placeAt = usePlacementIntentStore((s) => s.placeAt);
  const sectionRef = useRef<HTMLElement>(null);

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
          background: NAVY,
          borderTop: `2px solid ${GOLD}`,
          maxHeight: '30vh',
          paddingBottom: 'env(safe-area-inset-bottom)',
          boxShadow: '0 -6px 20px rgba(14,14,16,0.35)',
        }}
      >
        {/* Category bar + minimize chevron */}
        <div className="flex items-center gap-1 px-1.5 py-1.5" style={{ borderBottom: `1px solid ${NAVY_2}` }}>
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
                  className="flex min-w-[52px] shrink-0 flex-col items-center gap-0.5 rounded-md px-1.5 py-1 transition"
                  style={{
                    color: active ? GOLD : CREAM,
                    background: active ? '#FFBB5818' : 'transparent',
                  }}
                >
                  <MacroIcon macro={mc} />
                  <span className="text-[9px] font-semibold leading-none">
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
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md"
            style={{ color: CREAM, background: NAVY_2 }}
          >
            <svg
              viewBox="0 0 24 24"
              width={18}
              height={18}
              fill="none"
              stroke="currentColor"
              strokeWidth={2.2}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              style={{ transform: minimized ? 'rotate(180deg)' : 'none', transition: 'transform 150ms' }}
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
              <p className="px-2 py-4 text-center text-xs" style={{ color: `${CREAM}aa` }}>
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
                {filtered.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    data-testid="sims-thumb"
                    data-product-id={p.id}
                    title={p.name}
                    aria-label={`${p.name} — tap for details, hold to drag onto the floor`}
                    onPointerDown={(e) => start(e, p.id, productImageUrl(p))}
                    className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-lg"
                    style={{ background: CREAM, border: `1px solid ${NAVY_2}` }}
                  >
                    <img
                      src={productImageUrl(p)}
                      alt=""
                      draggable={false}
                      style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 4 }}
                    />
                  </button>
                ))}
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
