/**
 * MobileProductPopup — Phase 3 of the mobile Sims rebuild.
 *
 * Opens when a thumbnail in SimsBottomToolbar is tapped. Shows a bigger
 * product image, name, price, dimensions, eco badge and description, with
 * two CTAs:
 *   • "+ Add to room" — primary; auto-places the product at the centre of
 *     the visible canvas (via placementIntentStore) then closes.
 *   • "Cancel"        — closes without placing.
 *
 * The image is also draggable straight onto the canvas (Phase 3.2): a
 * drag releases at the drop point and closes the popup. While dragging,
 * the popup fades + goes pointer-transparent so the release lands on the
 * floor beneath it.
 */
import { useState } from 'react';
import type { Product } from '../../data/products.schema';
import { productImageUrl } from '../../data/products';
import { useDragToPlace } from './useDragToPlace';

const NAVY = '#232C3B';
const CREAM = '#F5EBD7';

function formatPrice(p: Product): string {
  const { value, currency } = p.price;
  return `${value.toLocaleString('en-MU', { maximumFractionDigits: 0 })} ${currency}`;
}

function formatDims(p: Product): string {
  const { length, width, height } = p.dimensions_cm;
  return `${length} × ${width} × ${height} cm`;
}

const DESC_LIMIT = 200;

export interface MobileProductPopupProps {
  product: Product;
  /** "+ Add to room" — place at the centre of the visible canvas. */
  onAdd: (productId: string) => void;
  /** Drag-release placement at an exact screen point. */
  onDragPlace: (productId: string, clientX: number, clientY: number) => void;
  onClose: () => void;
}

export function MobileProductPopup({
  product,
  onAdd,
  onDragPlace,
  onClose,
}: MobileProductPopupProps) {
  const [expanded, setExpanded] = useState(false);
  const imgUrl = productImageUrl(product);
  const desc = product.notes?.trim() ?? '';
  const truncated = desc.length > DESC_LIMIT;
  const shownDesc = expanded || !truncated ? desc : `${desc.slice(0, DESC_LIMIT).trimEnd()}…`;

  const { start, dragging, ghost } = useDragToPlace({
    mode: 'immediate',
    onDrop: (productId, x, y) => {
      onDragPlace(productId, x, y);
      onClose();
    },
  });

  return (
    <>
      <div
        data-testid="mobile-product-popup"
        role="dialog"
        aria-modal="true"
        aria-label={`${product.name} details`}
        className="fixed inset-0 flex items-center justify-center px-4"
        style={{
          // z above the Gaming Layer floating toolbars (ModeStrip 700,
          // EngineToggle 720) so the modal + its CTAs are never obscured.
          zIndex: 1000,
          background: dragging ? 'transparent' : 'rgba(14,14,16,0.55)',
          pointerEvents: dragging ? 'none' : 'auto',
          opacity: dragging ? 0.25 : 1,
          transition: 'opacity 120ms ease',
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div
          className="flex w-full max-w-[340px] flex-col overflow-hidden rounded-2xl shadow-2xl"
          style={{ background: '#fff', border: `1px solid ${NAVY}22` }}
        >
          {/* Bigger image — also the drag handle. */}
          <div
            className="ppw-no-callout relative flex items-center justify-center"
            style={{ background: '#F8F5EF', height: 200, touchAction: 'none' }}
            onPointerDown={(e) => start(e, product.id, imgUrl)}
            // Bug 1 (2026-05-28) — drag the popup image onto the floor; don't
            // let a long-press open the native "Save image" callout instead.
            onContextMenu={(e) => e.preventDefault()}
          >
            <img
              src={imgUrl}
              alt={product.name}
              draggable={false}
              style={{ maxHeight: 180, maxWidth: '90%', objectFit: 'contain' }}
            />
            {product.eco_certified && (
              <span
                className="absolute left-3 top-3 rounded-full px-2 py-0.5 text-[10px] font-bold"
                style={{ background: '#10653620', color: '#0b5a2e', border: '1px solid #0b5a2e55' }}
              >
                ✓ Eco-certified
              </span>
            )}
            <span className="absolute bottom-2 right-3 text-[10px] text-ppw-slate/70">
              drag onto the floor ↘
            </span>
          </div>

          <div className="flex flex-col gap-2 px-4 py-3">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-base font-semibold leading-tight" style={{ color: NAVY }}>
                {product.name}
              </h3>
              <span className="shrink-0 text-sm font-bold" style={{ color: '#0F766E' }}>
                {formatPrice(product)}
              </span>
            </div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-ppw-slate">
              {formatDims(product)} · {product.supplier}
            </p>
            {desc && (
              <p className="text-xs leading-snug text-ppw-slate">
                {shownDesc}
                {truncated && (
                  <button
                    type="button"
                    onClick={() => setExpanded((v) => !v)}
                    className="ml-1 font-semibold text-ppw-teal underline"
                  >
                    {expanded ? 'less' : 'more'}
                  </button>
                )}
              </p>
            )}

            <div className="mt-1 flex gap-2">
              <button
                type="button"
                data-testid="popup-add-to-room"
                onClick={() => onAdd(product.id)}
                className="flex-1 rounded-lg px-3 py-2.5 text-sm font-bold"
                style={{ background: NAVY, color: CREAM }}
              >
                + Add to room
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg px-3 py-2.5 text-sm font-semibold"
                style={{ background: CREAM, color: NAVY, border: `1px solid ${NAVY}33` }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
      {ghost}
    </>
  );
}
