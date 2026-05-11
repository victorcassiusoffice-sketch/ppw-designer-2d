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

import { useEffect, useState } from 'react';
import { useDesignStore } from '../store/designStore';
import { CATEGORY_LABELS, getProductById } from '../data/products';
import {
  rotateSelected,
  duplicateSelected,
  deleteSelected,
  deselect,
} from '../lib/placementActions';

export function DetailsPanel() {
  const placedItems = useDesignStore((s) => s.placedItems);
  const selectedInstanceId = useDesignStore((s) => s.selectedInstanceId);
  const clearDesign = useDesignStore((s) => s.clearDesign);
  const roomDimensions = useDesignStore((s) => s.roomDimensions);

  const selected = placedItems.find((i) => i.instanceId === selectedInstanceId);
  const selectedProduct = selected ? getProductById(selected.productId) : undefined;

  const [confirmingDelete, setConfirmingDelete] = useState(false);

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
            onClick={deselect}
            className="md:hidden rounded-md border border-ppw-stone bg-white px-2 py-0.5 text-xs text-ppw-slate"
          >
            Close
          </button>
        )}
      </div>

      <div className="scroll-pane flex-1 overflow-y-auto px-4 py-4">
        {selected && selectedProduct ? (
          <div className="space-y-4">
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
        ) : (
          <DesignSummary
            roomLengthM={roomDimensions.lengthM}
            roomWidthM={roomDimensions.widthM}
            itemCount={placedItems.length}
            onClear={clearDesign}
          />
        )}
      </div>

      <div className="border-t border-ppw-stone bg-ppw-sand px-4 py-2 text-[10px] leading-snug text-ppw-slate">
        Week 2 · drag-drop, collision, save/load · cart Week 3.
      </div>
    </>
  );

  return (
    <>
      <aside className="hidden md:flex h-full w-80 flex-col border-l border-ppw-stone bg-white">
        {body}
      </aside>

      {selected && (
        <>
          <div
            className="md:hidden fixed inset-0 z-40 bg-black/30"
            onClick={deselect}
          />
          <aside className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex max-h-[85vh] flex-col rounded-t-2xl border-t border-ppw-stone bg-white shadow-2xl">
            {body}
          </aside>
        </>
      )}
    </>
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
