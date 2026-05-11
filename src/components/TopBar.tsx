/**
 * TopBar - Week 3 build (was Week 2.5).
 *
 * Additions vs Week 2.5:
 *   - CurrencySwitcher (MUR / USD / EUR / GBP) in the right cluster.
 *   - Cart badge is a Link to /cart.
 *
 * Carryover from W2.5:
 *   - Property name (inline rename) on the left.
 *   - Mode toggle (Rectangle / Draw) for the canvas.
 *   - L/W inputs only edit the active room AND only when polygon is rectangular.
 *   - Save/Load v2 - properties (multi-room) saved under `ppw_properties_v2`.
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useDesignStore, isActiveRoomRectangle } from '../store/designStore';
import { usePropertyStore } from '../store/propertyStore';
import { useDesignsStore } from '../store/designsStore';
import { useToastStore } from '../store/toastStore';
import { useCart } from '../store/cartStore';
import { CurrencySwitcher } from './CurrencySwitcher';

export interface TopBarProps {
  drawMode: boolean;
  setDrawMode: (v: boolean) => void;
}

export function TopBar({ drawMode, setDrawMode }: TopBarProps) {
  const room = useDesignStore((s) => s.roomDimensions);
  const setRoom = useDesignStore((s) => s.setRoomDimensions);
  const showGrid = useDesignStore((s) => s.showGrid);
  const toggleGrid = useDesignStore((s) => s.toggleGrid);
  const placedItems = useDesignStore((s) => s.placedItems);

  const property = usePropertyStore((s) => s.property);
  const renameProperty = usePropertyStore((s) => s.renameProperty);
  const resetToDefault = usePropertyStore((s) => s.resetToDefault);
  const loadProperty = usePropertyStore((s) => s.loadProperty);

  const designs = useDesignsStore((s) => s.designs);
  const currentId = useDesignsStore((s) => s.currentId);
  const savePropertyAs = useDesignsStore((s) => s.savePropertyAs);
  const setCurrent = useDesignsStore((s) => s.setCurrent);
  const removeSavedDesign = useDesignsStore((s) => s.remove);

  const pushToast = useToastStore((s) => s.push);

  const cart = useCart();
  const activeRoomIsRect = isActiveRoomRectangle();

  const [showHelp, setShowHelp] = useState(false);
  const [showLoad, setShowLoad] = useState(false);
  const [confirmingNew, setConfirmingNew] = useState(false);
  const [editingProperty, setEditingProperty] = useState(false);
  const [propertyDraft, setPropertyDraft] = useState(property.name);

  const savedList = Object.values(designs)
    .filter((d) => d.id !== '__draft__')
    .sort((a, b) => (a.savedAt < b.savedAt ? 1 : -1));

  function handleSaveAs() {
    const defaultName =
      currentId && designs[currentId] ? designs[currentId].name : property.name || 'Untitled Property';
    const name = window.prompt('Save property as...', defaultName);
    if (!name || !name.trim()) return;
    const id = savePropertyAs(name.trim(), property);
    pushToast(`Saved "${name.trim()}"`, 'success');
    setCurrent(id);
  }

  function handleLoad(id: string) {
    const d = designs[id];
    if (!d || !d.property) {
      pushToast('Saved entry is missing property data.', 'error');
      return;
    }
    loadProperty(d.property);
    setCurrent(id);
    pushToast(`Loaded "${d.name}"`, 'success');
    setShowLoad(false);
  }

  function handleNew() {
    if (placedItems.length > 0 || property.rooms.length > 1) {
      setConfirmingNew(true);
      return;
    }
    resetToDefault();
    setCurrent(null);
  }

  function confirmNew() {
    resetToDefault();
    setCurrent(null);
    setConfirmingNew(false);
    pushToast('New property started.', 'info');
  }

  function commitPropertyRename() {
    renameProperty(propertyDraft);
    setEditingProperty(false);
  }

  return (
    <header className="relative z-20 flex h-14 shrink-0 items-center justify-between border-b border-ppw-stone bg-white px-3 md:px-4">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-ppw-teal">
          <svg viewBox="0 0 24 24" className="h-5 w-5 text-white" aria-hidden="true">
            <path d="M5 18 L12 5 L19 18 Z" fill="currentColor" />
            <circle cx="12" cy="14" r="1.6" fill="#0F766E" />
          </svg>
        </div>
        <div className="leading-tight min-w-0">
          <p className="truncate text-sm font-semibold text-ppw-ink">Wellness Room Designer</p>
          {editingProperty ? (
            <input
              autoFocus
              type="text"
              value={propertyDraft}
              onChange={(e) => setPropertyDraft(e.target.value)}
              onBlur={commitPropertyRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitPropertyRename();
                if (e.key === 'Escape') {
                  setPropertyDraft(property.name);
                  setEditingProperty(false);
                }
              }}
              className="hidden md:block w-44 rounded-sm border-b border-ppw-teal bg-transparent text-[11px] text-ppw-slate focus:outline-none"
            />
          ) : (
            <button
              type="button"
              onClick={() => {
                setPropertyDraft(property.name);
                setEditingProperty(true);
              }}
              className="hidden md:block truncate text-[11px] text-ppw-slate hover:text-ppw-teal"
              title="Rename property"
            >
              {property.name} - {property.rooms.length} room{property.rooms.length === 1 ? '' : 's'}
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 md:gap-2 text-xs">
        <div className="hidden md:flex items-center gap-1.5 rounded-md border border-ppw-stone bg-ppw-sand px-2 py-1">
          {activeRoomIsRect ? (
            <>
              <label className="text-[11px] uppercase tracking-wide text-ppw-slate">L</label>
              <input
                type="number"
                min={1}
                max={50}
                step={0.5}
                value={room.lengthM}
                onChange={(e) =>
                  setRoom({ lengthM: Number(e.target.value) || room.lengthM, widthM: room.widthM })
                }
                className="w-14 bg-transparent text-right text-sm font-medium text-ppw-ink focus:outline-none"
              />
              <span className="text-[11px] text-ppw-slate">m</span>
              <span className="px-1 text-ppw-stone">.</span>
              <label className="text-[11px] uppercase tracking-wide text-ppw-slate">W</label>
              <input
                type="number"
                min={1}
                max={50}
                step={0.5}
                value={room.widthM}
                onChange={(e) =>
                  setRoom({ lengthM: room.lengthM, widthM: Number(e.target.value) || room.widthM })
                }
                className="w-14 bg-transparent text-right text-sm font-medium text-ppw-ink focus:outline-none"
              />
              <span className="text-[11px] text-ppw-slate">m</span>
            </>
          ) : (
            <span className="text-[11px] italic text-ppw-slate">(polygon)</span>
          )}
        </div>

        <div className="hidden md:flex overflow-hidden rounded-md border border-ppw-stone bg-white">
          <button
            type="button"
            onClick={() => setDrawMode(false)}
            className={`px-2.5 py-1 text-xs font-medium ${!drawMode ? 'bg-ppw-teal text-white' : 'text-ppw-slate hover:text-ppw-teal'}`}
            title="Rectangle / place-items mode"
          >
            Rect
          </button>
          <button
            type="button"
            onClick={() => setDrawMode(true)}
            className={`px-2.5 py-1 text-xs font-medium ${drawMode ? 'bg-ppw-teal text-white' : 'text-ppw-slate hover:text-ppw-teal'}`}
            title="Draw polygon room"
          >
            Draw
          </button>
        </div>

        <button
          type="button"
          onClick={toggleGrid}
          className={`hidden md:inline-block rounded-md border px-2.5 py-1 text-xs font-medium transition ${showGrid ? 'border-ppw-teal bg-ppw-teal text-white' : 'border-ppw-stone bg-white text-ppw-slate hover:border-ppw-teal'}`}
          title="Toggle 0.5 m grid overlay"
        >
          Grid 0.5 m
        </button>

        <CurrencySwitcher compact />

        <Link
          to="/cart"
          className="hidden sm:flex items-center gap-1.5 rounded-md border border-ppw-stone bg-white px-2.5 py-1 text-xs hover:border-ppw-teal"
          title={`Cart: ${cart.uniqueProductCount} unique products`}
        >
          <span className="text-ppw-slate">Cart</span>
          <span className="rounded-full bg-ppw-teal px-1.5 py-[1px] text-[10px] font-bold text-white">
            {cart.uniqueProductCount}
          </span>
        </Link>

        <button
          type="button"
          onClick={handleNew}
          className="rounded-md border border-ppw-stone bg-white px-2.5 py-1 text-xs font-medium text-ppw-slate hover:border-ppw-teal"
          title="New property"
        >
          New
        </button>

        <button
          type="button"
          onClick={handleSaveAs}
          className="rounded-md border border-ppw-stone bg-white px-2.5 py-1 text-xs font-medium text-ppw-slate hover:border-ppw-teal"
          title="Save the current property under a name"
        >
          Save as...
        </button>

        <button
          type="button"
          onClick={() => setShowLoad((v) => !v)}
          className="rounded-md border border-ppw-stone bg-white px-2.5 py-1 text-xs font-medium text-ppw-slate hover:border-ppw-teal"
          title="Load a saved property"
        >
          Load ({savedList.length})
        </button>

        <button
          type="button"
          onClick={() => setShowHelp((v) => !v)}
          className="flex h-7 w-7 items-center justify-center rounded-full border border-ppw-stone bg-white text-sm font-bold text-ppw-slate hover:border-ppw-teal hover:text-ppw-teal"
          title="Help"
          aria-label="Help"
        >
          ?
        </button>
      </div>

      {showHelp && (
        <div className="absolute right-4 top-full mt-1 w-80 rounded-lg border border-ppw-stone bg-white p-4 text-xs leading-snug text-ppw-slate shadow-lg">
          <p className="mb-1 font-semibold text-ppw-ink">Quick start</p>
          <ol className="ml-4 list-decimal space-y-1">
            <li>Set room L x W (top bar), or switch to <em>Draw</em> mode to sketch a polygon.</li>
            <li>Drag a product from the left palette onto the canvas.</li>
            <li>Scroll-wheel zoom; drag empty floor to pan.</li>
            <li>Click a placed item to edit on the right.</li>
            <li>Use the room list to switch rooms within this property.</li>
            <li><em>Save as...</em> stores the whole property (all rooms + items).</li>
          </ol>
          <p className="mt-2 text-[10px] text-ppw-slate">
            Keys: R rotate; D duplicate; Del delete; Esc deselect; Ctrl+Z undo last wall (draw mode).
          </p>
        </div>
      )}

      {showLoad && (
        <div className="absolute right-4 top-full mt-1 w-80 max-h-96 overflow-y-auto rounded-lg border border-ppw-stone bg-white p-3 text-xs shadow-lg">
          <p className="font-semibold text-ppw-ink mb-2">Saved properties</p>
          {savedList.length === 0 ? (
            <p className="text-ppw-slate py-2">No saved properties yet. Use <em>Save as...</em></p>
          ) : (
            <ul className="space-y-1.5">
              {savedList.map((d) => {
                const itemCount = (d.property?.rooms ?? []).reduce(
                  (acc, r) => acc + (r.placedItems?.length ?? 0),
                  0,
                );
                const roomCount = d.property?.rooms?.length ?? 0;
                return (
                  <li key={d.id} className="flex items-center justify-between gap-2 rounded-md border border-ppw-stone bg-white p-2">
                    <button
                      type="button"
                      onClick={() => handleLoad(d.id)}
                      className="flex-1 text-left"
                    >
                      <p className={`text-sm font-medium ${currentId === d.id ? 'text-ppw-teal' : 'text-ppw-ink'}`}>
                        {d.name}{currentId === d.id ? ' (current)' : ''}
                      </p>
                      <p className="text-[10px] text-ppw-slate">
                        {roomCount} room{roomCount === 1 ? '' : 's'} - {itemCount} item{itemCount === 1 ? '' : 's'} - {new Date(d.savedAt).toLocaleString()}
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(`Delete saved property "${d.name}"?`)) {
                          removeSavedDesign(d.id);
                          pushToast(`Deleted "${d.name}"`, 'info');
                        }
                      }}
                      className="rounded-md border border-ppw-stone bg-white px-1.5 py-0.5 text-[10px] text-ppw-slate hover:border-ppw-coral hover:text-ppw-coral"
                      title="Delete saved property"
                    >
                      x
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {confirmingNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-80 rounded-lg bg-white p-5 shadow-2xl">
            <p className="text-sm font-semibold text-ppw-ink">Start a new property?</p>
            <p className="mt-1 text-xs text-ppw-slate">
              Current property has {property.rooms.length} room{property.rooms.length === 1 ? '' : 's'} and {cart.totalItemCount} placed item{cart.totalItemCount === 1 ? '' : 's'}. The auto-draft is kept, but un-named work will be lost. Save as... first if you want to keep it.
            </p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={confirmNew}
                className="flex-1 rounded-md bg-ppw-coral px-3 py-1.5 text-sm font-semibold text-white hover:bg-ppw-coral/90"
              >
                Yes, start new
              </button>
              <button
                type="button"
                onClick={() => setConfirmingNew(false)}
                className="flex-1 rounded-md border border-ppw-stone bg-white px-3 py-1.5 text-sm font-semibold text-ppw-slate hover:border-ppw-ink"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
