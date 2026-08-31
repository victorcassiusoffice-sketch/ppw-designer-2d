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
 *
 * Chrome register (toolbar contract 2026-08-29): a chrome card (CHROME_BG +
 * CHROME_RIM, radius 12, popover shadow) carrying the SAME control recipes
 * as CartStrip / DetailsPanel — primary = ink fill + paper, Cancel = chrome
 * + rim — so the sheet is one control set with the rest of the designer.
 */
import { useState } from 'react';
import type { Product } from '../../data/products.schema';
import { productImageUrl } from '../../data/products';
import { CHROME_BG, CHROME_RIM, CHROME_TEXT } from '../../designer/blueprintTheme';
import { useDragToPlace } from './useDragToPlace';
// Floor tool (2026-08-30): a product that IS a Floor-tool material is laid by
// the tool — the popup offers "Lay this floor" and no placement/drag.
import { floorMaterialForProduct } from '../../data/floorMaterials';
import { useDesignerUIStore } from '../../store/designerUIStore';

// ---------------------------------------------------------------------------
// Chrome recipe (toolbar contract 2026-08-29) — same strings as CartStrip /
// DetailsPanel. h-11 = the 44 px phone control height.
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
/** Ink primary: the sheet's main action. */
const CTRL_INK = `${CTRL_BASE} border border-ppw-inkDeep bg-ppw-inkDeep font-semibold text-ppw-paper hover:brightness-110`;
/** Caption: 11/600 uppercase .06em — the smallest text the contract allows. */
const CAPTION = 'text-[11px] font-semibold uppercase tracking-[0.06em] text-ppw-charcoal';

/** Popover shadow from the contract (12 px blur, ink at 18 %). */
const POPOVER_SHADOW = '0 12px 32px rgba(42,41,38,0.18)';

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
  const floorMat = floorMaterialForProduct(product);
  const setFloorDraft = useDesignerUIStore((s) => s.setFloorDraft);
  const setTool = useDesignerUIStore((s) => s.setTool);
  function layFloor(): void {
    if (!floorMat) return;
    setFloorDraft({ materialId: floorMat.id, erase: false });
    setTool('floor');
    onClose();
  }
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
          // Ink scrim (the paper theme's charcoal, not the old near-black).
          background: dragging ? 'transparent' : 'rgba(42,41,38,0.45)',
          pointerEvents: dragging ? 'none' : 'auto',
          opacity: dragging ? 0.25 : 1,
          transition: 'opacity 120ms ease',
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div
          className="flex w-full max-w-[340px] flex-col overflow-hidden rounded-xl"
          style={{
            background: CHROME_BG,
            border: `1px solid ${CHROME_RIM}`,
            boxShadow: POPOVER_SHADOW,
          }}
        >
          {/* Bigger image — also the drag handle. Paper ground under the
              product so a white-background photo still reads as a card. */}
          <div
            className="ppw-no-callout relative flex items-center justify-center border-b border-ppw-rim bg-ppw-paper"
            style={{ height: 200, touchAction: floorMat ? undefined : 'none' }}
            onPointerDown={floorMat ? undefined : (e) => start(e, product.id, imgUrl)}
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
                className={`absolute left-3 top-3 rounded-full border border-ppw-rim bg-ppw-chrome px-2 py-0.5 ${CAPTION}`}
              >
                ✓ Eco-certified
              </span>
            )}
            <span className={`absolute bottom-2 right-3 ${CAPTION}`}>
              {floorMat ? 'laid with the Floor tool' : 'drag onto the floor ↘'}
            </span>
          </div>

          <div className="flex flex-col gap-2 px-4 py-3">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-base font-semibold leading-tight" style={{ color: CHROME_TEXT }}>
                {product.name}
              </h3>
              <span className="shrink-0 text-[14px] font-semibold" style={{ color: CHROME_TEXT }}>
                {formatPrice(product)}
              </span>
            </div>
            <p className={CAPTION}>
              {formatDims(product)} · {product.supplier}
            </p>
            {desc && (
              <p className="text-xs leading-snug text-ppw-charcoal">
                {shownDesc}
                {truncated && (
                  <button
                    type="button"
                    onClick={() => setExpanded((v) => !v)}
                    className="ml-1 font-semibold text-ppw-inkDeep underline"
                  >
                    {expanded ? 'less' : 'more'}
                  </button>
                )}
              </p>
            )}

            <div className="mt-1 flex gap-2">
              {floorMat ? (
                <button
                  type="button"
                  data-testid="popup-lay-floor"
                  onClick={layFloor}
                  className={`flex-1 ${CTRL_INK}`}
                  title="Laid with the Floor tool"
                >
                  Lay this floor
                </button>
              ) : (
                <button
                  type="button"
                  data-testid="popup-add-to-room"
                  onClick={() => onAdd(product.id)}
                  className={`flex-1 ${CTRL_INK}`}
                >
                  + Add to room
                </button>
              )}
              <button type="button" onClick={onClose} className={CTRL_REST}>
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
