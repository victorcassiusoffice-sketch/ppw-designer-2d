/**
 * DetailsPanel — right-side OVERLAY (desktop) / bottom sheet (mobile).
 *
 * 2026-08-25 (Vic complaint 2): the permanent 320 px right rail is gone.
 * The panel now slides in over the canvas ONLY while a placed item is
 * selected and closes on deselect (Esc / click empty floor) or its X. It
 * costs the drawing surface nothing when nothing is selected — which is
 * most of the time, including the entire first-run experience.
 *
 * 2026-08-29 toolbar contract (audit defect 18): the desktop overlay used
 * to stop exactly at the dock, which put its "Buy from K1-Sport" CTA under
 * the dock's top rim and its notes under the cart pill. It now stops
 * ABOVE the cart pill — `--sims-dock-h + --sims-toolbar-h + 72 px` — the
 * body scrolls, and the CTA lives in a footer pinned to the panel bottom
 * so it is always on screen and always clickable. Chrome tokens
 * throughout: paper ground, hairline rim, charcoal ink; 40 px controls
 * (44 px in the mobile sheet), radius 8; ink for the active light toggle;
 * gold ONLY for the buy CTA; terracotta rim (never small terracotta text)
 * for Delete.
 *
 * Week 2 build:
 *   - Full product info (dimensions, price, supplier, commission %,
 *     delivery regions, source URL).
 *   - Manipulation controls: rotate ±90°, duplicate, delete (inline confirm).
 *   - All actions go through `placementActions.ts` so collision checks
 *     run consistently with the keyboard shortcuts.
 *   - Responsive: above 768 px is the right-hand panel; below 768 px
 *     becomes a slide-up sheet that only appears when an item is selected.
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
  toggleSelectedLight,
  fillFloorWithSelected,
} from '../lib/placementActions';
import { emitsLight } from '../designer/lighting';
import { isFlooringProduct } from '../designer/flooringLattice';
// Floor tool (2026-08-30): tile SKUs that ARE a Floor-tool material are laid
// by the tool, so "Fill floor" only shows for loose mats placed as items.
import { floorMaterialForProduct } from '../data/floorMaterials';

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

// ---------------------------------------------------------------------------
// Chrome recipe (toolbar contract 2026-08-29). One string per state so every
// control in the panel is the same control. 44 px rows in the mobile sheet,
// 40 px on desktop; radius 8; 120 ms ease-out, none under reduced motion;
// 3 px mint focus ring; pressed = inset shadow; disabled = opacity .4.
// ---------------------------------------------------------------------------
const CTRL_BASE =
  'inline-flex h-11 md:h-10 items-center justify-center rounded-lg px-3 text-[12px] font-medium leading-none ' +
  'transition-colors duration-[120ms] ease-out motion-reduce:transition-none ' +
  'focus:outline-none focus-visible:ring-[3px] focus-visible:ring-[rgba(121,199,173,0.45)] ' +
  'active:shadow-[inset_0_1px_2px_rgba(42,41,38,0.18)] disabled:opacity-40';
/** Rest: chrome ground + rim; hover: CHROME_HOVER_BG + darker rim. */
const CTRL_REST =
  `${CTRL_BASE} border border-ppw-rim bg-ppw-chrome text-ppw-charcoal ` +
  'hover:bg-[#f3f1ec] hover:border-[rgba(42,41,38,0.35)]';
/** Active / tool-on: ink fill, paper text. */
const CTRL_ACTIVE = `${CTRL_BASE} border border-ppw-inkDeep bg-ppw-inkDeep text-ppw-paper`;
/** Destructive: terracotta icon + rim; hover fills terracotta with white text. */
const CTRL_DANGER =
  `${CTRL_BASE} border border-ppw-clay bg-ppw-chrome text-ppw-charcoal ` +
  'hover:bg-ppw-clay hover:text-white';
/** Caption: 11/600 uppercase .06em — the smallest text the contract allows. */
const CAPTION = 'text-[11px] font-semibold uppercase tracking-[0.06em] text-ppw-charcoal';

/** 16 px trash glyph for the Delete control (terracotta at rest, white on hover). */
function TrashIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={16}
      height={16}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
    </svg>
  );
}

/** 16 px close glyph (X) for the desktop header. */
function CloseIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={16}
      height={16}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
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
  const selectItem = useDesignStore((s) => s.selectItem);
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

  const lightOn = selected?.lightOn ?? true;

  const body = (
    <>
      <div className="flex shrink-0 items-center justify-between border-b border-ppw-rim px-4 py-2">
        <h2 className={CAPTION}>Details</h2>
        {selected && (
          <>
            <button
              type="button"
              onClick={() => setInfoOpen(false)}
              className={`md:hidden ${CTRL_REST}`}
            >
              Close
            </button>
            {/* Desktop: the panel IS the selection, so its X deselects.
                (Mobile keeps the sheet-only Close above so the on-canvas
                FloatingCluster survives.) */}
            <button
              type="button"
              data-testid="details-overlay-close"
              onClick={() => selectItem(null)}
              aria-label="Close details"
              title="Close details (Esc also deselects)"
              className={`hidden md:inline-flex w-10 !px-0 ${CTRL_REST}`}
            >
              <CloseIcon />
            </button>
          </>
        )}
      </div>

      <div className="scroll-pane min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {selected && selectedProduct ? (
          <div className="space-y-4">
            <ProductHero product={selectedProduct} />
            <div>
              <p className={CAPTION}>Selected item</p>
              <h3 className="mt-1 text-base font-semibold text-ppw-inkDeep">{selectedProduct.name}</h3>
              <p className="mt-1 text-[12px] font-medium text-ppw-charcoal">
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
                <p className={CAPTION}>Source</p>
                {/* Gate repair 2026-08-29: this was an 18 px text link — the
                    one control in the panel under the 40 / 44 px floor. It
                    is now the same chrome control as every other row
                    (CTRL_REST), left-aligned, with the URL truncating
                    inside it. Same href, same target, same rel. */}
                <a
                  href={selectedProduct.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={selectedProduct.source_url}
                  className={`mt-1 w-full min-w-0 !justify-start ${CTRL_REST}`}
                >
                  <span className="min-w-0 flex-1 truncate underline underline-offset-2">
                    {selectedProduct.source_url}
                  </span>
                </a>
              </div>
            )}
            <Stat
              label="Notes"
              value={selectedProduct.notes}
              multiline
            />

            <div className="rounded-lg border border-ppw-rim bg-ppw-rail px-3 py-3">
              <p className={`${CAPTION} mb-2`}>Controls</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => rotateSelected(-90)}
                  className={CTRL_REST}
                  title="Rotate 90° counter-clockwise (Shift+R)"
                >
                  ↺ 90° CCW
                </button>
                <button
                  type="button"
                  onClick={() => rotateSelected(90)}
                  className={CTRL_REST}
                  title="Rotate 90° clockwise (R)"
                >
                  ↻ 90° CW
                </button>
                <button
                  type="button"
                  onClick={duplicateSelected}
                  className={`col-span-2 ${CTRL_REST}`}
                  title="Duplicate selected item (D)"
                >
                  Duplicate (+0.5 m offset)
                </button>
                {/* Sims flooring (2026-08-29): lay this tile over the whole
                    room, edge to edge. Duplicate (D) lays ONE next to it.
                    Only for LOOSE mats — a material the Floor tool lays has
                    its own fill (the Room scope), not a copy of this one. */}
                {isFlooringProduct(selectedProduct) && !floorMaterialForProduct(selectedProduct) && (
                  <button
                    type="button"
                    onClick={fillFloorWithSelected}
                    data-testid="details-fill-floor"
                    className={`col-span-2 ${CTRL_REST}`}
                    title="Lay copies of this tile over every free part of the room"
                  >
                    Fill floor with this tile
                  </button>
                )}
                {/* Sims world (2026-08-29): lights cast a pool on the plan;
                    this is the switch. Only shown for products that emit.
                    ON is the one pressed / tool-on state: ink fill, paper text. */}
                {emitsLight(selectedProduct) && (
                  <button
                    type="button"
                    onClick={toggleSelectedLight}
                    data-testid="details-light-toggle"
                    aria-pressed={lightOn}
                    className={`col-span-2 ${lightOn ? CTRL_ACTIVE : CTRL_REST}`}
                    title="Switch this light on or off (L)"
                  >
                    {lightOn ? 'Light on — tap to switch off' : 'Light off — tap to switch on'}
                  </button>
                )}
              </div>

              {!confirmingDelete ? (
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(true)}
                  className={`group mt-3 w-full gap-2 ${CTRL_DANGER}`}
                  title="Delete selected item (Del)"
                >
                  <span className="text-ppw-clay group-hover:text-white">
                    <TrashIcon />
                  </span>
                  Delete
                </button>
              ) : (
                <div className="mt-3 rounded-lg border border-ppw-clay bg-ppw-chrome p-2">
                  <p className="text-[12px] font-medium text-ppw-inkDeep">Delete this item?</p>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        deleteSelected();
                        setConfirmingDelete(false);
                      }}
                      className={`flex-1 ${CTRL_BASE} border border-ppw-clay bg-ppw-clay font-semibold text-white hover:brightness-95`}
                    >
                      Yes, delete
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmingDelete(false)}
                      className={`flex-1 ${CTRL_REST}`}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              <p className="mt-3 text-[11px] font-medium leading-snug text-ppw-charcoal">
                Keys: <kbd>R</kbd> rotate 90° · <kbd>Shift+R</kbd> 15° · <kbd>Alt+R</kbd> CCW · <kbd>D</kbd> duplicate · <kbd>L</kbd> light · <kbd>Del</kbd> delete · <kbd>Esc</kbd> deselect
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

  // Footer: the ONE gold CTA in the panel, pinned below the scrolling body
  // so it is never scrolled off and never under the dock or the cart pill
  // (audit defect 18). Same attribution URL as before — presentation moved,
  // the P0-ε redirect did not.
  const footer =
    selected && selectedProduct && isK1Product ? (
      <div className="shrink-0 border-t border-ppw-rim bg-ppw-chrome px-4 py-3">
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
          className={`w-full ${CTRL_ACTIVE} text-[13px] hover:brightness-110`}
        >
          Buy from K1-Sport →
        </a>
      </div>
    ) : null;

  return (
    <>
      {/* Desktop overlay. `absolute` inside <main>'s relative-positioned
          flex row would need a positioned ancestor; the panel is instead
          pinned to the canvas region with `fixed` + the dock height, so it
          never covers the build toolbar. Pointer events stay on the panel
          only, so the canvas underneath keeps panning/zooming. */}
      {selected && (
        <aside
          data-testid="details-overlay"
          className="hidden md:flex fixed right-0 top-14 z-30 w-80 flex-col border-l border-ppw-rim bg-ppw-chrome"
          style={{
            // Sits between the TopBar and the cart pill. `--sims-dock-h` /
            // `--sims-toolbar-h` are published by SimsDock /
            // SimsBottomToolbar (0 px until they mount); the 72 px clears
            // the cart pill (16 px inset + 44 px pill + 12 px breathing
            // room) so neither the CTA nor the notes sit under it.
            bottom: 'calc(var(--sims-dock-h, 0px) + var(--sims-toolbar-h, 0px) + 72px)',
            boxShadow: '0 12px 32px rgba(42,41,38,0.18)',
            animation: 'ppw-details-in 120ms ease-out',
          }}
        >
          {body}
          {footer}
        </aside>
      )}

      {selected && infoOpen && (
        <>
          <div
            className="md:hidden fixed inset-0 z-40 bg-black/30"
            onClick={() => setInfoOpen(false)}
          />
          <aside
            className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex max-h-[85vh] flex-col rounded-t-xl border-t border-ppw-rim bg-ppw-chrome"
            style={{
              paddingBottom: 'env(safe-area-inset-bottom)',
              boxShadow: '0 -12px 32px rgba(42,41,38,0.18)',
            }}
          >
            {body}
            {footer}
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
      className="flex items-center justify-center overflow-hidden rounded-lg border border-ppw-rim bg-ppw-paper"
      style={{ height: 160 }}
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
        <span className="text-[12px] font-medium text-ppw-charcoal">No image</span>
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
        <p className={CAPTION}>Placing</p>
        <h3 className="mt-1 text-base font-semibold text-ppw-inkDeep">{product.name}</h3>
        <p className="mt-1 text-[12px] font-medium text-ppw-charcoal">
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
      <div className="rounded-lg border border-dashed border-ppw-rim bg-ppw-rail px-3 py-2.5 text-[12px] font-medium leading-snug text-ppw-charcoal">
        Click an empty spot on the floor to place this product. Press <kbd>Esc</kbd> to cancel.
      </div>
    </div>
  );
}

function Stat({ label, value, multiline = false }: { label: string; value: string; multiline?: boolean }) {
  return (
    <div>
      <p className={CAPTION}>{label}</p>
      <p className={`mt-1 text-sm font-medium text-ppw-inkDeep ${multiline ? 'leading-snug' : ''}`}>
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
          <p className={CAPTION}>Design summary</p>
          <h3 className="mt-1 text-base font-semibold text-ppw-inkDeep">No room yet</h3>
        </div>
        <div className="rounded-lg border border-dashed border-ppw-rim bg-ppw-rail px-3 py-2.5 text-[12px] font-medium leading-snug text-ppw-charcoal">
          Your canvas is blank. Use <span className="font-semibold">Walls</span> in the top bar
          (or the “Draw room” button on the canvas) to sketch your space, then drag products in.
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <div>
        <p className={CAPTION}>Design summary</p>
        <h3 className="mt-1 text-base font-semibold text-ppw-inkDeep">Wellness Room</h3>
      </div>
      <Stat label="Room dimensions" value={`${roomLengthM} m × ${roomWidthM} m`} />
      <Stat label="Floor area" value={`${areaM2.toFixed(2)} m²`} />
      <Stat label="Items placed" value={`${itemCount}`} />
      {itemCount > 0 && (
        <button
          type="button"
          onClick={onClear}
          className={`w-full ${CTRL_DANGER}`}
        >
          Clear all items
        </button>
      )}
      <div className="rounded-lg border border-dashed border-ppw-rim bg-ppw-rail px-3 py-2.5 text-[12px] font-medium leading-snug text-ppw-charcoal">
        Drag a product from the catalog onto the canvas. Selecting a placed item shows its details + controls here.
      </div>
    </div>
  );
}
