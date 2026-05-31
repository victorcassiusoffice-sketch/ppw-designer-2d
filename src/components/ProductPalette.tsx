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

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  REGION_GROUPS,
  filterByRegion,
  getAllProducts,
  productImageUrl,
  thumbnailFor,
} from '../data/products';
import { fetchApiProducts } from '../data/apiCatalogAdapter';
import { DetailCard } from '../designer/DetailCard';
import type { RegionGroup } from '../data/products';
import type { Product, ProductCategory } from '../data/products.schema';

// P0-ζ — Sims-style floating hover card state for catalog cards.
interface HoverState {
  product: Product;
  anchorXPx: number;
  anchorYPx: number;
}

const REGION_LS_KEY = 'ppw_region_filter_v1';
const DEFAULT_REGION: RegionGroup = 'Mauritius';

// Tweak 05 (Phase A) — macro category tabs (Furniture · Cardio · Recovery
// · Sauna · Flooring · Walls · Decor). The granular `ProductCategory`
// enum stays the per-product source of truth; this mapping groups them
// into the Sims-style tabs Vic asked for. Flooring + Walls are
// placeholders here so the tabs show — they populate when Tweaks 02/03
// add the supporting catalog entries.
type MacroCategory =
  | 'all'
  | 'furniture'
  | 'cardio'
  | 'recovery'
  | 'sauna'
  | 'flooring'
  | 'walls'
  | 'decor';

const MACRO_CATEGORY_ORDER: MacroCategory[] = [
  'all',
  'furniture',
  'cardio',
  'recovery',
  'sauna',
  'flooring',
  'walls',
  'decor',
];

const MACRO_CATEGORY_LABEL: Record<MacroCategory, string> = {
  all: 'All',
  furniture: 'Furniture',
  cardio: 'Cardio',
  recovery: 'Recovery',
  sauna: 'Sauna',
  flooring: 'Flooring',
  walls: 'Walls',
  decor: 'Decor',
};

const PRODUCT_TO_MACRO: Record<ProductCategory, MacroCategory> = {
  'ergo-chair': 'furniture',
  'eco-office-kit': 'furniture',
  fitness: 'cardio',
  'ice-bath': 'recovery',
  massage: 'recovery',
  'sleep-pod': 'recovery',
  sauna: 'sauna',
  plant: 'decor',
  // Wellness-Designer-App (e) — engineering-side plumbing.
  // Products with ProductCategory 'flooring' / 'walls' / 'decor' now
  // route to the matching macro tab. Data side (which products?)
  // pends Vic-decision #WDA-5.
  flooring: 'flooring',
  walls: 'walls',
  decor: 'decor',
  other: 'decor',
};

function macroOf(p: Product): MacroCategory {
  return PRODUCT_TO_MACRO[p.category] ?? 'decor';
}

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
  /**
   * Desktop hover "Place on floor" arms tap-to-place. The mobile catalog
   * is now the SimsBottomToolbar (< 1024 px); this sidebar renders only
   * at ≥ 1024 px (`lg:`), so the old mobile drawer props were removed.
   */
  pendingProductId?: string | null;
  setPendingProductId?: (id: string | null) => void;
}

export function ProductPalette({
  pendingProductId,
  setPendingProductId,
}: ProductPaletteProps = {}) {
  const [query, setQuery] = useState('');
  // Tweak 05 (Phase A): activeCategory is now a macro group, not a raw
  // ProductCategory. The legacy CategoryChip strip is replaced with the
  // tab bar across the top.
  const [activeCategory, setActiveCategory] = useState<MacroCategory>('all');
  const [region, setRegion] = useState<RegionGroup>(() => readRegionLs());
  // Wellness-Designer-App (h) — eco-only catalog filter chip.
  // Default OFF (soft-flag) per chain Vic-Y #WDA-1 ("hard-filter vs
  // soft-flag" — soft is the safe shipping default until Vic flips and
  // products are eco-tagged). When ON, hides products whose
  // `eco_certified !== true`. Once Sustainability charter signs off K1
  // SKUs + Vic flips #WDA-1 to hard-filter, change `useState(false)` to
  // `useState(true)` (one-line flip).
  const [ecoOnly, setEcoOnly] = useState(false);
  // P0-ζ — Sims-style floating hover card (only on devices with a real
  // pointer; touch devices skip it because the catalog is a bottom-sheet
  // and the floating overlay would block the place-on-floor tap).
  const [hover, setHover] = useState<HoverState | null>(null);
  const hoverDismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function armHover(product: Product, rect: DOMRect): void {
    if (hoverDismissTimer.current) {
      clearTimeout(hoverDismissTimer.current);
      hoverDismissTimer.current = null;
    }
    if (window.matchMedia?.('(pointer: coarse)').matches) return; // skip on touch
    setHover({
      product,
      anchorXPx: rect.left + rect.width / 2,
      anchorYPx: rect.top + rect.height / 2,
    });
  }
  function disarmHover(): void {
    if (hoverDismissTimer.current) clearTimeout(hoverDismissTimer.current);
    hoverDismissTimer.current = setTimeout(() => setHover(null), 80);
  }

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

  // Macro tabs render the full `MACRO_CATEGORY_ORDER` whether or not
  // products exist in each (Flooring + Walls are intentionally
  // visible-but-empty until Tweaks 02/03 land).
  const filtered = useMemo(() => {
    let base = query ? searchAll(query) : allProducts;
    base = filterByRegion(base, region);
    if (activeCategory !== 'all') {
      base = base.filter((p) => macroOf(p) === activeCategory);
    }
    // Wellness-Designer-App (h) — eco-only hard-filter when chip is ON.
    // Undefined eco_certified is treated as `false` per the schema
    // comment ("missing flag never sneaks into the eco-only view").
    if (ecoOnly) {
      base = base.filter((p) => p.eco_certified === true);
    }
    return base;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, activeCategory, region, ecoOnly, allProducts]);

  // M3 (Customer-UI fix 2026-05-31) — the HTML5 DragEvent path is retired on
  // catalog cards. Placement is unified on Pointer Events (onPointerDown →
  // arm pendingProductId → tap the floor to commit), the only path that works
  // on touch. The legacy handleDragStart + DRAG_MIME were removed (nothing
  // listened to the DataTransfer payload on the live canvas).

  const body = (
    <>
      <div className="border-b border-ppw-stone px-4 py-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ppw-slate">Catalog</h2>
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
        {/* Wellness-Designer-App (h) — eco-only filter chip. Default OFF
            (soft-flag) per Vic-decision #WDA-1; flip to default ON when
            Vic confirms hard-filter mode + Sustainability charter has
            tagged K1 SKUs. */}
        <div className="mt-2 flex items-center gap-2">
          <button
            type="button"
            role="switch"
            aria-checked={ecoOnly}
            onClick={() => setEcoOnly((v) => !v)}
            data-testid="catalog-eco-filter"
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${
              ecoOnly
                ? 'border-emerald-700 bg-emerald-100 text-emerald-900'
                : 'border-ppw-stone bg-white text-ppw-slate hover:border-emerald-500/50'
            }`}
            title="Show only products that pass the eco-certified filter"
          >
            <span aria-hidden="true">{ecoOnly ? '✓' : '○'}</span>
            <span>Eco-only</span>
          </button>
          {ecoOnly && (
            <span className="text-[10px] text-ppw-slate">
              {filtered.length === 0 ? 'No eco-tagged products yet' : ''}
            </span>
          )}
        </div>
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

      {/* Tweak 05 (Phase A) — category tab bar. Replaces the legacy
          CategoryChip strip. Tabs reflect Sims-style macro groups
          (Furniture · Cardio · Recovery · Sauna · Flooring · Walls ·
          Decor). Horizontally scrollable on narrow viewports so all
          seven fit on a 320 px drawer without wrapping. */}
      <div
        role="tablist"
        aria-label="Product category"
        className="flex gap-1 overflow-x-auto border-b border-ppw-stone px-2 py-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {MACRO_CATEGORY_ORDER.map((mc) => (
          <CategoryChip
            key={mc}
            label={MACRO_CATEGORY_LABEL[mc]}
            active={activeCategory === mc}
            onClick={() => setActiveCategory(mc)}
          />
        ))}
      </div>

      <div className="scroll-pane flex-1 overflow-y-auto px-3 py-3">
        {filtered.length === 0 ? (
          <p className="px-1 py-6 text-center text-xs text-ppw-slate">
            No products match — try changing the region or category filter.
          </p>
        ) : (
          /* Tweak 05 (Phase A) — Sims-style tile grid. 96×96 desktop /
             80×80 mobile, ≥4 columns at 320 px drawer width. The
             previous list cards (name + price below the thumb) move
             into the hover DetailCard so the grid stays dense. The
             "Place on floor" button is collapsed into a single tap —
             the existing pointer-down FSM still arms `pendingProductId`
             and closes the mobile sheet. */
          <ul
            className="grid gap-1.5"
            style={{
              gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
            }}
          >
            {filtered.map((p) => {
              const isPending = pendingProductId === p.id;
              return (
                <li key={p.id}>
                  <div
                    role="button"
                    tabIndex={0}
                    aria-pressed={isPending}
                    aria-label={`Place ${p.name} — ${formatPrice(p)} — ${isPending ? 'armed, click on the floor to drop' : 'click to arm placement'}`}
                    title={`${p.name} · ${formatPrice(p)} · ${formatFootprint(p)}`}
                    onPointerDown={(e) => {
                      if (!setPendingProductId) return;
                      if (e.button !== 0) return;
                      setPendingProductId(isPending ? null : p.id);
                    }}
                    onKeyDown={(e) => {
                      if (!setPendingProductId) return;
                      if (e.key !== 'Enter' && e.key !== ' ') return;
                      e.preventDefault();
                      setPendingProductId(isPending ? null : p.id);
                    }}
                    className={`group flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-md border bg-white p-1 transition hover:border-ppw-teal hover:shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-ppw-teal active:bg-ppw-mist ${
                      isPending ? 'border-ppw-teal ring-2 ring-ppw-teal/40' : 'border-ppw-stone'
                    }`}
                    data-product-id={p.id}
                    data-category={p.category}
                    data-macro={macroOf(p)}
                    data-armed={isPending ? 'true' : 'false'}
                    onPointerEnter={(e) => armHover(p, (e.currentTarget as HTMLElement).getBoundingClientRect())}
                    onPointerLeave={disarmHover}
                    onFocus={(e) => armHover(p, (e.currentTarget as HTMLElement).getBoundingClientRect())}
                    onBlur={disarmHover}
                    style={{ minHeight: 80 }}
                  >
                    <div
                      className="flex h-12 w-12 shrink-0 items-center justify-center"
                      dangerouslySetInnerHTML={{ __html: thumbnailFor(p.category) }}
                    />
                    <p className="line-clamp-2 px-1 text-center text-[10px] leading-tight text-ppw-slate">
                      {p.name}
                    </p>
                    {/* Minor 13 (Customer-UI fix 2026-05-31) — show price on
                        the card face (footprint stays in the title tooltip). */}
                    <p className="px-1 text-center text-[9px] font-semibold leading-tight text-ppw-teal">
                      {formatPrice(p)}
                    </p>
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
      {/* Desktop catalog sidebar — ≥ 1024 px only. Below that the
          SimsBottomToolbar is the catalog (mobile/tablet Sims mode). */}
      <aside className="hidden lg:flex h-full w-72 flex-col border-r border-ppw-stone bg-white">
        {body}
      </aside>
      {hover && (
        <div
          data-testid="product-hover-card"
          onPointerEnter={() => {
            if (hoverDismissTimer.current) clearTimeout(hoverDismissTimer.current);
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
            description={`${hover.product.dimensions_cm.length}×${hover.product.dimensions_cm.width}×${hover.product.dimensions_cm.height} cm · ${hover.product.supplier}`}
            actions={
              setPendingProductId
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
