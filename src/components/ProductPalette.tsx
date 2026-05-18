/**
 * ProductPalette — left sidebar (desktop) / collapsible bottom sheet
 * (mobile, < 768 px) listing all products from the catalog as draggable
 * cards.
 *
 * Week 2 additions:
 *   - Region <select> (Mauritius default, persisted to localStorage)
 *   - Responsive 768 px breakpoint (Tailwind classes only)
 *
 * fix/mobile-ux-v1 (May 2026):
 *   - `mobileOpen`/`setMobileOpen` lifted to App.tsx so TopBar's
 *     hamburger menu can open the Catalog directly.
 *   - "Place on floor" button (mobile-only) on each product card. Taps
 *     arm `pendingProductId` (lifted to App.tsx) and close the bottom
 *     sheet so the user can see the floor; the next tap on the canvas
 *     drops the product there. HTML5 drag-and-drop doesn't bridge a
 *     bottom-sheet → canvas on touch devices, so this is the only path
 *     that actually places products on Android/iOS Chrome.
 *   - Safe-area-inset on the floating Catalog bubble + bottom-sheet
 *     padding so the Android nav bar doesn't clip them.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  CATEGORY_LABELS,
  REGION_GROUPS,
  filterByRegion,
  getAllProducts,
  getCategories,
  thumbnailFor,
} from '../data/products';
import { fetchApiProducts } from '../data/apiCatalogAdapter';
import type { RegionGroup } from '../data/products';
import type { Product, ProductCategory } from '../data/products.schema';

const DRAG_MIME = 'application/x-ppw-product-id';
const REGION_LS_KEY = 'ppw_region_filter_v1';
const DEFAULT_REGION: RegionGroup = 'Mauritius';

function formatPrice(p: Product): string {
  const { value, currency } = p.price;
  const formatted = value.toLocaleString('en-MU', { maximumFractionDigits: 0 });
  return `${formatted} ${currency}`;
}

function formatFootprint(p: Product): string {
  const { length, width, height } = p.dimensions_cm;
  return `${length}×${width}×${height} cm`;
}

function readRegionLs(): RegionGroup {
  try {
    const v = localStorage.getItem(REGION_LS_KEY);
    if (v && (REGION_GROUPS as string[]).includes(v)) return v as RegionGroup;
  } catch {
    // ignore
  }
  return DEFAULT_REGION;
}

export interface ProductPaletteProps {
  /** Mobile UX (fix/mobile-ux-v1): drawer state lifted to App.tsx. */
  mobileOpen?: boolean;
  setMobileOpen?: (v: boolean) => void;
  /** Tap-to-place fallback for touch devices. */
  pendingProductId?: string | null;
  setPendingProductId?: (id: string | null) => void;
}

export function ProductPalette({
  mobileOpen: mobileOpenProp,
  setMobileOpen: setMobileOpenProp,
  pendingProductId,
  setPendingProductId,
}: ProductPaletteProps = {}) {
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<ProductCategory | 'all'>('all');
  const [region, setRegion] = useState<RegionGroup>(() => readRegionLs());
  const [mobileOpenLocal, setMobileOpenLocal] = useState(false);
  const mobileOpen = mobileOpenProp ?? mobileOpenLocal;
  const setMobileOpen = setMobileOpenProp ?? setMobileOpenLocal;

  // PCF-1 (K1 meeting 2026-05-19) — fetch merchant-supplied products
  // from /api/products on mount and blend with the bundled seeds.
  // Empty array = degrade-silently to bundled-only.
  const [apiProducts, setApiProducts] = useState<Product[]>([]);
  useEffect(() => {
    let cancelled = false;
    fetchApiProducts().then((rows) => {
      if (!cancelled) setApiProducts(rows);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(REGION_LS_KEY, region);
    } catch {
      // ignore
    }
  }, [region]);

  const allProducts = useMemo(() => {
    // Merchant products first so they're the top of the catalog grid —
    // K1 demo path: open catalog, see Matrix/NordicTrack-style items
    // immediately above the bundled wellness seeds.
    return [...apiProducts, ...getAllProducts()];
  }, [apiProducts]);

  function searchAll(q: string): Product[] {
    const needle = q.trim().toLowerCase();
    if (!needle) return allProducts;
    return allProducts.filter((p) => {
      return (
        p.name.toLowerCase().includes(needle)
        || p.sku.toLowerCase().includes(needle)
        || p.category.toLowerCase().includes(needle)
        || p.supplier.toLowerCase().includes(needle)
        || (p.notes ?? '').toLowerCase().includes(needle)
      );
    });
  }

  const categories = useMemo(() => {
    const set = new Set<ProductCategory>(getCategories());
    for (const p of apiProducts) set.add(p.category);
    return [...set];
  }, [apiProducts]);
  const filtered = useMemo(() => {
    let base = query ? searchAll(query) : allProducts;
    base = filterByRegion(base, region);
    if (activeCategory !== 'all') {
      base = base.filter((p) => p.category === activeCategory);
    }
    return base;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, activeCategory, region, allProducts]);

  function handleDragStart(e: React.DragEvent<HTMLDivElement>, product: Product) {
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData(DRAG_MIME, product.id);
    e.dataTransfer.setData('text/plain', product.id);
  }

  const body = (
    <>
      <div className="border-b border-ppw-stone px-4 py-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ppw-slate">Catalog</h2>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="md:hidden min-h-[36px] rounded-md border border-ppw-stone bg-white px-2.5 text-xs text-ppw-slate"
            aria-label="Close catalog"
          >
            Close
          </button>
        </div>
        <p className="mt-0.5 text-[11px] text-ppw-slate">
          {filtered.length} of {allProducts.length} products · ships to {region}
        </p>
        <input
          type="search"
          value={query}
          placeholder="Search products…"
          onChange={(e) => setQuery(e.target.value)}
          className="mt-3 w-full rounded-md border border-ppw-stone bg-ppw-sand px-2.5 py-2 text-sm placeholder:text-ppw-slate/70 focus:border-ppw-teal focus:outline-none focus:ring-1 focus:ring-ppw-teal"
        />
        <label className="mt-2 block text-[10px] uppercase tracking-wide text-ppw-slate">
          Delivery region
        </label>
        <select
          value={region}
          onChange={(e) => setRegion(e.target.value as RegionGroup)}
          className="mt-1 w-full rounded-md border border-ppw-stone bg-white px-2 py-2 text-sm text-ppw-ink focus:border-ppw-teal focus:outline-none focus:ring-1 focus:ring-ppw-teal"
        >
          {REGION_GROUPS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap gap-1.5 border-b border-ppw-stone px-3 py-2.5">
        <CategoryChip
          label="All"
          active={activeCategory === 'all'}
          onClick={() => setActiveCategory('all')}
        />
        {categories.map((c) => (
          <CategoryChip
            key={c}
            label={CATEGORY_LABELS[c]}
            active={activeCategory === c}
            onClick={() => setActiveCategory(c)}
          />
        ))}
      </div>

      <div className="scroll-pane flex-1 overflow-y-auto px-3 py-3">
        {filtered.length === 0 ? (
          <p className="px-1 py-6 text-center text-xs text-ppw-slate">
            No products match — try changing the region or category filter.
          </p>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {filtered.map((p) => {
              const isPending = pendingProductId === p.id;
              return (
                <li key={p.id}>
                  <div
                    draggable
                    onDragStart={(e) => handleDragStart(e, p)}
                    className={`group flex cursor-grab gap-3 rounded-lg border bg-white p-2.5 transition hover:border-ppw-teal hover:shadow-sm active:cursor-grabbing ${
                      isPending ? 'border-ppw-teal ring-2 ring-ppw-teal/40' : 'border-ppw-stone'
                    }`}
                    data-product-id={p.id}
                    data-category={p.category}
                  >
                    <div
                      className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md bg-ppw-sand"
                      dangerouslySetInnerHTML={{ __html: thumbnailFor(p.category) }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ppw-ink">{p.name}</p>
                      <p className="mt-0.5 text-[11px] uppercase tracking-wide text-ppw-slate">
                        {CATEGORY_LABELS[p.category]}
                      </p>
                      <div className="mt-1 flex items-baseline justify-between gap-2">
                        <span className="text-xs font-semibold text-ppw-teal">
                          {formatPrice(p)}
                        </span>
                        <span className="truncate text-[10px] text-ppw-slate">
                          {formatFootprint(p)}
                        </span>
                      </div>
                      {setPendingProductId && (
                        <button
                          type="button"
                          onClick={() => {
                            if (isPending) {
                              setPendingProductId(null);
                            } else {
                              setPendingProductId(p.id);
                              setMobileOpen(false);
                            }
                          }}
                          className={`mt-2 min-h-[40px] w-full rounded-md border px-3 text-xs font-semibold transition md:hidden ${
                            isPending
                              ? 'border-ppw-coral bg-white text-ppw-coral hover:bg-ppw-coral hover:text-white'
                              : 'border-ppw-teal bg-ppw-teal text-white hover:bg-ppw-teal/90'
                          }`}
                          aria-pressed={isPending}
                        >
                          {isPending ? 'Cancel' : 'Place on floor'}
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="border-t border-ppw-stone bg-ppw-sand px-3 py-2 text-[10px] leading-snug text-ppw-slate">
        Drag a card onto the canvas (or tap "Place on floor" on mobile). Click a placed item to edit. Region filter is remembered.
      </div>
    </>
  );

  return (
    <>
      <aside className="hidden md:flex h-full w-72 flex-col border-r border-ppw-stone bg-white">
        {body}
      </aside>

      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className={`md:hidden fixed left-4 z-30 min-h-[44px] rounded-full bg-ppw-teal px-4 py-2.5 text-sm font-semibold text-white shadow-lg ${
          mobileOpen ? 'hidden' : ''
        }`}
        style={{ bottom: 'max(1rem, env(safe-area-inset-bottom))' }}
      >
        Catalog ({filtered.length})
      </button>

      {mobileOpen && (
        <>
          <div
            className="md:hidden fixed inset-0 z-40 bg-black/30"
            onClick={() => setMobileOpen(false)}
          />
          <aside
            className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex h-[80vh] flex-col rounded-t-2xl border-t border-ppw-stone bg-white shadow-2xl"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
          >
            {body}
          </aside>
        </>
      )}
    </>
  );
}

function CategoryChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-[32px] rounded-full px-2.5 text-[11px] font-medium ring-1 transition ${
        active
          ? 'bg-ppw-teal text-white ring-ppw-teal'
          : 'bg-white text-ppw-slate ring-ppw-stone hover:bg-ppw-mist'
      }`}
    >
      {label}
    </button>
  );
}
