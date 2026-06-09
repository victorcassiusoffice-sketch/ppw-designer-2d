/**
 * DetailsPanel — right rail (desktop) / bottom modal (mobile, < 768 px).
 *
 * Week 2 build:
 *   - Full product info (dimensions, price, supplier, commission %,
 *     delivery regions, source URL).
 *   - Manipulation controls: rotate ±90°, duplicate, delete (inline confirm).
 *   - All actions go through `placementActions.ts` so collision checks
 *     run consistently with the keyboard shortcuts.
 *   - Responsive: above 768 px is the right-hand panel; below 768 px
 *     becomes a slide-up modal that only appears when an item is selected.
 */

import { useEffect, useMemo, useState } from 'react';
import { useDesignStore } from '../store/designStore';
import { useDesignerUIStore } from '../store/designerUIStore';
import { CATEGORY_LABELS, getProductById, productImageUrl } from '../data/products';
import type { Product } from '../data/products.schema';
import {
  rotateSelected,
  duplicateSelected,
  deleteSelected,
} from '../lib/placementActions';

/**
 * P0-ε — Pattern C attribution: stable per-browser sessionId so the
 * outbound `/api/k1/redirect` can reconstruct which design generated
 * the click during monthly commission reconciliation.
 */
const SESSION_LS_KEY = 'ppw_designer_session_v1';
function getOrMintSessionId(): string {
  if (typeof window === 'undefined') return 'ssr';
  try {
    const existing = window.localStorage.getItem(SESSION_LS_KEY);
    if (existing) return existing;
    const next = `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    window.localStorage.setItem(SESSION_LS_KEY, next);
    return next;
  } catch {
    return `s-${Date.now().toString(36)}`;
  }
}

/**
 * P0-ε — Build the outbound URL. Routes through `/api/k1/redirect`
 * (M7 commission attribution) so the server logs the click before
 * 302-ing to k1-sport.com — `ref=ppw&design=<sessionId>&sku=<sku>`
 * propagates per the Pattern C spec.
 */
function buildBuyUrl(args: {
  productId: string;
  productSku: string;
  productName: string;
  productPriceMinor: number;
  productCurrency: string;
  designId: string;
}): string {
  const q = new URLSearchParams({
    slug: 'k1-sport',
    productId: args.productId,
    productSku: args.productSku,
    productName: args.productName,
    productPriceMinor: String(args.productPriceMinor),
    productCurrency: args.productCurrency,
    designId: args.designId,
    sessionId: args.designId,
  });
  return `/api/k1/redirect?${q.toString()}`;
}

export interface DetailsPanelProps {
  /**
   * Real-image detail (2026-06-09) — the product the customer just clicked
   * in the catalog (armed for placement). When set and nothing is selected
   * on the canvas, the panel shows that product's real photo + description
   * so "click a product → see its detail" works before placement too.
   */
  armedProductId?: string | null;
}

export function DetailsPanel({ armedProductId }: DetailsPanelProps = {}) {
  const placedItems = useDesignStore((s) => s.placedItems);
  const selectedInstanceId = useDesignStore((s) => s.selectedInstanceId);
  const clearDesign = useDesignStore((s) => s.clearDesign);
  const roomDimensions = useDesignStore((s) => s.roomDimensions);

  const selected = placedItems.find((i) => i.instanceId === selectedInstanceId);
  const selectedProduct = selected ? getProductById(selected.productId) : undefined;
  const armedProduct =
    !selected && armedProductId ? getProductById(armedProductId) : undefined;

  // Flagship fix — the mobile slide-up is no longer the rotation surface.
  // It opens only when the user taps ⓘ in the on-canvas FloatingCluster
  // (infoOpen), so selecting an item shows the inline cluster instead of a
  // full-screen modal. Reset when the selection clears.
  const infoOpen = useDesignerUIStore((s) => s.infoOpen);
  const setInfoOpen = useDesignerUIStore((s) => s.setInfoOpen);
  useEffect(() => {
    if (!selectedInstanceId) setInfoOpen(false);
  }, [selectedInstanceId, setInfoOpen]);

  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const sessionId = useMemo(getOrMintSessionId, []);
  // P0-ε — Pattern C BUY routes K1-* SKUs to the merchant storefront via the
  // M7 /api/k1/redirect attribution endpoint. Other merchants get the
  // generic source_url path (rendered below as the "Source" link).
  const isK1Product = !!selectedProduct?.sku?.startsWith('K1-');

  useEffect(() => {
    setConfirmingDelete(false);
  }, [selectedInstanceId]);

  const body = (
    <>
      <div className="border-b border-ppw-stone px-4 py-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ppw-slate">Details</h2>
        {selected && (
          <button
            type="button"
            onClick={() => setInfoOpen(false)}
            className="md:hidden rounded-md border border-ppw-stone bg-white px-2 py-0.5 text-xs text-ppw-slate"
          >
            Close
          </button>
        )}
      </div>

      <div className="scroll-pane flex-1 overflow-y-auto px-4 py-4">
        {selected && selectedProduct ? (
          <div className="space-y-4">
            <ProductHero product={selectedProduct} />
            <div>
              <p className="text-[10px] uppercase tracking-wide text-ppw-slate">Selected item</p>
              <h3 className="mt-0.5 text-base font-semibold text-ppw-ink">{selectedProduct.name}</h3>
              <p className="mt-0.5 text-xs text-ppw-slate">
                {CATEGORY_LABELS[selectedProduct.category]} · SKU {selectedProduct.sku}
              </p>
            </div>

            <Stat
              label="Footprint"
              value={`${selectedProduct.dimensions_cm.length} × ${selectedProduct.dimensions_cm.width} cm`}
            />
            <Stat label="Height" value={`${selectedProduct.dimensions_cm.height} cm`} />
            <Stat label="Weight" value={`${selectedProduct.weight_kg} kg`} />
            <Stat
              label="Position"
              value={`${selected.x.toFixed(2)} m, ${selected.y.toFixed(2)} m · ${selected.rotation}°`}
            />
            <Stat
              label="Price"
              value={`${selectedProduct.price.value.toLocaleString('en-MU')} ${selectedProduct.price.currency}`}
            />
            <Stat label="Commission" value={`${(selectedProduct.commission_pct * 100).toFixed(1)} %`} />
            <Stat label="Supplier" value={selectedProduct.supplier} />
            <Stat
              label="Ships to"
              value={selectedProduct.delivery_regions.join(', ')}
            />
            {selectedProduct.source_url && (
              <div>
                <p className="text-[10px] uppercase tracking-wide text-ppw-slate">Source</p>
                <a
                  href={selectedProduct.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-0.5 block truncate text-xs font-medium text-ppw-teal underline hover:text-ppw-ink"
                >
                  {selectedProduct.source_url}
                </a>
              </div>
            )}
            <Stat
              label="Notes"
              value={selectedProduct.notes}
              multiline
            />

            {isK1Product && (
              <a
                data-testid="buy-from-k1-sport"
                href={buildBuyUrl({
                  productId: selectedProduct.id,
                  productSku: selectedProduct.sku,
                  productName: selectedProduct.name,
                  productPriceMinor: Math.round((selectedProduct.price?.value ?? 0) * 100),
                  productCurrency: selectedProduct.price?.currency ?? 'MUR',
                  designId: sessionId,
                })}
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-md bg-ppw-coral px-3 py-2.5 text-center text-sm font-semibold text-white shadow-sm hover:bg-ppw-coral/90"
                style={{ background: '#FFBB58', color: '#232C3B' }}
              >
                Buy from K1-Sport →
              </a>
            )}

            <div className="rounded-md border border-ppw-stone bg-ppw-sand px-3 py-3">
              <p className="text-[10px] uppercase tracking-wide text-ppw-slate mb-2">Controls</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => rotateSelected(-90)}
                  className="rounded-md border border-ppw-stone bg-white px-2 py-1.5 text-xs font-medium text-ppw-ink hover:border-ppw-teal hover:text-ppw-teal"
                  title="Rotate 90° counter-clockwise (Shift+R)"
                >
                  ↺ 90° CCW
                </button>
                <button
                  type="button"
                  onClick={() => rotateSelected(90)}
                  className="rounded-md border border-ppw-stone bg-white px-2 py-1.5 text-xs font-medium text-ppw-ink hover:border-ppw-teal hover:text-ppw-teal"
                  title="Rotate 90° clockwise (R)"
                >
                  ↻ 90° CW
                </button>
                <button
                  type="button"
                  onClick={duplicateSelected}
                  className="col-span-2 rounded-md border border-ppw-stone bg-white px-2 py-1.5 text-xs font-medium text-ppw-ink hover:border-ppw-teal hover:text-ppw-teal"
                  title="Duplicate selected item (D)"
                >
                  Duplicate (+0.5 m offset)
                </button>
              </div>

              {!confirmingDelete ? (
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(true)}
                  className="mt-3 w-full rounded-md border border-ppw-coral bg-white px-3 py-1.5 text-sm font-medium text-ppw-coral hover:bg-ppw-coral hover:text-white"
                  title="Delete selected item (Del)"
                >
                  Delete
                </button>
              ) : (
                <div className="mt-3 rounded-md border border-ppw-coral bg-ppw-coral/10 p-2">
                  <p className="text-xs text-ppw-ink">Delete this item?</p>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        deleteSelected();
                        setConfirmingDelete(false);
                      }}
                      className="flex-1 rounded-md bg-ppw-coral px-2 py-1 text-xs font-semibold text-white hover:bg-ppw-coral/90"
                    >
                      Yes, delete
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmingDelete(false)}
                      className="flex-1 rounded-md border border-ppw-stone bg-white px-2 py-1 text-xs font-semibold text-ppw-slate hover:border-ppw-ink"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              <p className="mt-2 text-[10px] leading-snug text-ppw-slate">
                Keys: <kbd>R</kbd> rotate · <kbd>Shift+R</kbd> CCW · <kbd>D</kbd> duplicate · <kbd>Del</kbd> delete · <kbd>Esc</kbd> deselect
              </p>
            </div>
          </div>
        ) : armedProduct ? (
          <ArmedProductDetails product={armedProduct} />
        ) : (
          <DesignSummary
            roomLengthM={roomDimensions.lengthM}
            roomWidthM={roomDimensions.widthM}
            itemCount={placedItems.length}
            onClear={clearDesign}
          />
        )}
      </div>
      {/* P2-1: removed the "Week 2 · drag-drop, collision, save/load · cart
          Week 3" developer build-status footer that was visible to customers. */}
    </>
  );

  return (
    <>
      <aside className="hidden md:flex h-full w-80 flex-col border-l border-ppw-stone bg-white">
        {body}
      </aside>

      {selected && infoOpen && (
        <>
          <div
            className="md:hidden fixed inset-0 z-40 bg-black/30"
            onClick={() => setInfoOpen(false)}
          />
          <aside className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex max-h-[85vh] flex-col rounded-t-2xl border-t border-ppw-stone bg-white shadow-2xl">
            {body}
          </aside>
        </>
      )}
    </>
  );
}

/**
 * Real product photo block (2026-06-09) shown at the top of a product's
 * detail. Uses the catalog resolver (real photo → top-down → …) and falls
 * back to a neutral tile on a load error so it never shows a broken image.
 */
function ProductHero({ product }: { product: Product }) {
  const [errored, setErrored] = useState(false);
  const src = productImageUrl(product);
  return (
    <div
      className="flex items-center justify-center overflow-hidden rounded-lg border border-ppw-stone"
      style={{ background: '#F8F5EF', height: 160 }}
    >
      {!errored && src ? (
        <img
          src={src}
          alt={product.name}
          draggable={false}
          onError={() => setErrored(true)}
          style={{ maxHeight: 150, maxWidth: '92%', objectFit: 'contain' }}
        />
      ) : (
        <span className="text-xs text-ppw-slate">No image</span>
      )}
    </div>
  );
}

/**
 * Armed-product detail (2026-06-09) — shown in the right rail when the
 * customer has clicked a catalog product (but not yet placed it). Mirrors
 * the placed-item detail: real photo + name + specs + the real description.
 */
function ArmedProductDetails({ product }: { product: Product }) {
  return (
    <div className="space-y-4">
      <ProductHero product={product} />
      <div>
        <p className="text-[10px] uppercase tracking-wide text-ppw-slate">Placing</p>
        <h3 className="mt-0.5 text-base font-semibold text-ppw-ink">{product.name}</h3>
        <p className="mt-0.5 text-xs text-ppw-slate">
          {CATEGORY_LABELS[product.category]} · SKU {product.sku}
        </p>
      </div>
      <Stat
        label="Footprint"
        value={`${product.dimensions_cm.length} × ${product.dimensions_cm.width} cm`}
      />
      <Stat
        label="Price"
        value={`${product.price.value.toLocaleString('en-MU')} ${product.price.currency}`}
      />
      <Stat label="Supplier" value={product.supplier} />
      {product.notes?.trim() && <Stat label="About" value={product.notes.trim()} multiline />}
      <div className="rounded-md border border-dashed border-ppw-teal/50 bg-ppw-teal/5 px-3 py-2.5 text-[11px] leading-snug text-ppw-slate">
        Click an empty spot on the floor to place this product. Press <kbd>Esc</kbd> to cancel.
      </div>
    </div>
  );
}

function Stat({ label, value, multiline = false }: { label: string; value: string; multiline?: boolean }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-ppw-slate">{label}</p>
      <p className={`mt-0.5 text-sm font-medium text-ppw-ink ${multiline ? 'leading-snug' : ''}`}>
        {value}
      </p>
    </div>
  );
}

function DesignSummary({
  roomLengthM,
  roomWidthM,
  itemCount,
  onClear,
}: {
  roomLengthM: number;
  roomWidthM: number;
  itemCount: number;
  onClear: () => void;
}) {
  const areaM2 = roomLengthM * roomWidthM;
  // Blank-canvas-on-open (2026-06-09): an un-drawn room projects to a
  // ~0 m² bounding box. Show a friendly "draw your room" summary rather
  // than a confusing "0.00 m²" readout.
  const hasRoom = areaM2 > 0.01;
  if (!hasRoom) {
    return (
      <div className="space-y-4">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-ppw-slate">Design summary</p>
          <h3 className="mt-0.5 text-base font-semibold text-ppw-ink">No room yet</h3>
        </div>
        <div className="rounded-md border border-dashed border-ppw-stone bg-ppw-mist px-3 py-2.5 text-[11px] leading-snug text-ppw-slate">
          Your canvas is blank. Use <span className="font-semibold">Draw</span> in the top bar
          (or the “Draw room” button on the canvas) to sketch your space, then drag products in.
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <div>
        <p className="text-[10px] uppercase tracking-wide text-ppw-slate">Design summary</p>
        <h3 className="mt-0.5 text-base font-semibold text-ppw-ink">Wellness Room</h3>
      </div>
      <Stat label="Room dimensions" value={`${roomLengthM} m × ${roomWidthM} m`} />
      <Stat label="Floor area" value={`${areaM2.toFixed(2)} m²`} />
      <Stat label="Items placed" value={`${itemCount}`} />
      {itemCount > 0 && (
        <button
          type="button"
          onClick={onClear}
          className="w-full rounded-md border border-ppw-stone bg-white px-3 py-1.5 text-sm font-medium text-ppw-slate hover:border-ppw-coral hover:text-ppw-coral"
        >
          Clear all items
        </button>
      )}
      <div className="rounded-md border border-dashed border-ppw-stone bg-ppw-mist px-3 py-2.5 text-[11px] leading-snug text-ppw-slate">
        Drag a product from the catalog onto the canvas. Selecting a placed item shows its details + controls here.
      </div>
    </div>
  );
}
