/**
 * SimsDock — the DESKTOP build-mode catalog (Vic 2026-08-25, complaints
 * 2 + 4).
 *
 * Replaces the 288 px left `ProductPalette` column. Together with dropping
 * the 224 px `RoomList` rail and un-pinning the 320 px `DetailsPanel`, this
 * takes the drawing surface from 56.7 % of the viewport width to full
 * width — the whole point of complaint 2.
 *
 * Shape (adapted from the mobile `SimsBottomToolbar` Vic already approved,
 * per the brief — presentation only, the placement flow is NOT forked):
 *
 *   [ category macro icons | ─── horizontal product strip ─── | chevron ]
 *
 * ONE row, ~88 px tall, so the canvas keeps ~88 % of the viewport height.
 * The mobile toolbar stacks its categories ABOVE a double-row strip because
 * a phone has no horizontal room; a 1920 px desktop does, so the same parts
 * lie down in a single row and cost half the height.
 *
 * PLACEMENT IS UNCHANGED. Clicking a tile arms `pendingProductId` exactly
 * as the old ProductPalette card did (same toggle-off-on-second-click, same
 * `data-armed` / `data-product-id` / `data-macro` attributes the e2e suite
 * asserts on), and `RoomCanvas`'s pointer-FSM commits it. No new store, no
 * new intent path, no touch of the Konva stable-lock.
 *
 * Register: DARK (blueprint) — this is build-mode chrome sitting against
 * the blueprint canvas. Everything outside the designer keeps cream/navy.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { getAllProducts, productImageUrl, thumbnailFor } from '../../data/products';
import { fetchApiProducts } from '../../data/apiCatalogAdapter';
import type { Product } from '../../data/products.schema';
import {
  MACRO_CATEGORY_ORDER,
  MACRO_CATEGORY_LABEL,
  macroOf,
  type MacroCategory,
} from '../mobile/catalogMacros';
import { MacroIcon } from '../mobile/MacroIcon';
import { DetailCard } from '../../designer/DetailCard';
import {
  DOCK_ACCENT,
  DOCK_BG,
  DOCK_BG_RAISED,
  DOCK_BORDER,
  DOCK_TEXT,
  DOCK_TEXT_MUTED,
} from '../../designer/blueprintTheme';

export interface SimsDockProps {
  pendingProductId?: string | null;
  setPendingProductId?: (id: string | null) => void;
}

interface HoverState {
  product: Product;
  anchorXPx: number;
  anchorYPx: number;
}

function formatPrice(p: Product): string {
  const v = p.price.value.toLocaleString('en-MU', { maximumFractionDigits: 0 });
  return `${v} ${p.price.currency}`;
}

export function SimsDock({ pendingProductId, setPendingProductId }: SimsDockProps = {}) {
  const [activeCategory, setActiveCategory] = useState<MacroCategory>('all');
  const [collapsed, setCollapsed] = useState(false);
  const [apiProducts, setApiProducts] = useState<Product[]>([]);
  const [hover, setHover] = useState<HoverState | null>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sectionRef = useRef<HTMLElement>(null);

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
  useEffect(() => {
    let cancelled = false;
    fetchApiProducts().then((rows) => {
      if (!cancelled) setApiProducts(rows);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const allProducts = useMemo(() => {
    const merged = [...apiProducts, ...getAllProducts()];
    const seen = new Set<string>();
    const out: Product[] = [];
    for (const p of merged) {
      const key = p.sku || p.id;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(p);
    }
    return out;
  }, [apiProducts]);

  const filtered = useMemo(() => {
    if (activeCategory === 'all') return allProducts;
    return allProducts.filter((p) => macroOf(p) === activeCategory);
  }, [allProducts, activeCategory]);

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

  function toggleArm(p: Product): void {
    if (!setPendingProductId) return;
    setPendingProductId(pendingProductId === p.id ? null : p.id);
  }

  const emptyLabel = MACRO_CATEGORY_LABEL[activeCategory];

  return (
    <>
      <section
        ref={sectionRef}
        data-testid="sims-dock"
        aria-label="Build catalog"
        // Desktop only — below 1024 px the mobile SimsBottomToolbar is the
        // catalog. `shrink-0` keeps the dock OUT of the canvas's flex grow
        // so the measured stage height is honest: the canvas really is the
        // remaining height, rather than being overlapped by a floating bar
        // and only appearing to be full-height.
        className="hidden lg:flex shrink-0 items-stretch gap-2 px-2"
        style={{
          background: DOCK_BG,
          borderTop: `2px solid ${DOCK_ACCENT}`,
          boxShadow: '0 -8px 24px rgba(0,0,0,0.35)',
          paddingTop: 6,
          paddingBottom: 6,
        }}
      >
        {/* Category macro icons — the Sims build-mode "what am I placing"
            rail. Left of the row (not stacked above it) so the dock costs
            one row of height instead of two. */}
        <div
          role="tablist"
          aria-label="Product category"
          className="flex shrink-0 items-center gap-1 pr-2"
          style={{ borderRight: `1px solid ${DOCK_BORDER}` }}
        >
          {MACRO_CATEGORY_ORDER.map((mc) => {
            const active = activeCategory === mc;
            return (
              <button
                key={mc}
                type="button"
                role="tab"
                aria-selected={active}
                data-testid={`dock-cat-${mc}`}
                onClick={() => {
                  setActiveCategory(mc);
                  setCollapsed(false);
                }}
                className="flex min-h-[56px] min-w-[58px] flex-col items-center justify-center gap-0.5 rounded-md px-1 transition"
                style={{
                  color: active ? DOCK_ACCENT : DOCK_TEXT,
                  background: active ? 'rgba(255,187,88,0.13)' : 'transparent',
                  boxShadow: active ? `inset 0 0 0 1px ${DOCK_ACCENT}55` : 'none',
                }}
                title={`${MACRO_CATEGORY_LABEL[mc]} — show this category`}
              >
                <MacroIcon macro={mc} />
                <span className="text-[9px] font-semibold uppercase leading-none tracking-wide">
                  {MACRO_CATEGORY_LABEL[mc]}
                </span>
              </button>
            );
          })}
        </div>

        {/* Product strip — horizontally scrollable, one row of tiles. */}
        {collapsed ? (
          <div
            className="flex flex-1 items-center px-2 text-[11px]"
            style={{ color: DOCK_TEXT_MUTED }}
          >
            Catalog hidden. Click a category or the chevron to reopen.
          </div>
        ) : (
          <ul
            data-testid="dock-strip"
            className="scroll-pane flex flex-1 items-center gap-2 overflow-x-auto overflow-y-hidden"
          >
            {filtered.length === 0 ? (
              <li className="px-3 text-[11px]" style={{ color: DOCK_TEXT_MUTED }}>
                No products in {emptyLabel} yet.
              </li>
            ) : (
              filtered.map((p) => {
                const isPending = pendingProductId === p.id;
                return (
                  <li key={p.id} className="shrink-0">
                    <div
                      role="button"
                      tabIndex={0}
                      aria-pressed={isPending}
                      aria-label={`Place ${p.name} — ${formatPrice(p)}`}
                      title={`${p.name} · ${formatPrice(p)}`}
                      // Same pointer-down arm as the retired ProductPalette
                      // card — the placement FSM is untouched.
                      onPointerDown={(e) => {
                        if (e.button !== 0) return;
                        toggleArm(p);
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
                      className="ppw-no-callout flex h-[68px] w-[68px] cursor-pointer items-center justify-center rounded-lg transition focus-visible:outline focus-visible:outline-2"
                      style={{
                        background: DOCK_BG_RAISED,
                        boxShadow: isPending
                          ? `inset 0 0 0 2px ${DOCK_ACCENT}, 0 0 0 3px rgba(255,187,88,0.25)`
                          : `inset 0 0 0 1px ${DOCK_BORDER}`,
                        outlineColor: DOCK_ACCENT,
                      }}
                    >
                      <DockThumb product={p} />
                    </div>
                  </li>
                );
              })
            )}
          </ul>
        )}

        <button
          type="button"
          data-testid="dock-collapse"
          // Deliberately NOT "…catalog": placement-fsm.spec.ts opens the
          // mobile catalog with getByRole('button', {name: /catalog/i}),
          // which would otherwise match this chevron on desktop and
          // collapse the strip out from under the test.
          aria-label={collapsed ? 'Show product strip' : 'Hide product strip'}
          aria-expanded={!collapsed}
          onClick={() => setCollapsed((v) => !v)}
          className="flex min-h-[56px] w-9 shrink-0 items-center justify-center self-center rounded-md"
          style={{ color: DOCK_TEXT, background: DOCK_BG_RAISED }}
          title={collapsed ? 'Show the product strip' : 'Hide the product strip (more canvas)'}
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
            style={{
              transform: collapsed ? 'rotate(180deg)' : 'none',
              transition: 'transform 150ms',
            }}
          >
            <path d="M6 15l6-6 6 6" />
          </svg>
        </button>
      </section>

      {/* Sims-style floating detail card on hover. Carries the same testid
          the P0-zeta e2e asserts on — the card moved from the sidebar to the
          dock, it did not disappear. */}
      {hover && (
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
        className="flex h-[52px] w-[52px] items-center justify-center rounded-md"
        style={{ background: '#F5EBD7' }}
        dangerouslySetInnerHTML={{ __html: thumbnailFor(product.category) }}
      />
    );
  }
  return (
    <img
      src={src}
      alt={product.name}
      loading="lazy"
      draggable={false}
      onError={() => setErrored(true)}
      className="h-[52px] w-[52px] rounded-md object-contain"
      style={{ background: '#F5EBD7', padding: 2 }}
    />
  );
}
