/**
 * RoomList — Week 2.5 multi-room sidebar (Model A — separate
 * canvases per room, RoomSketcher-style).
 *
 * Each row shows: room name (inline-rename), area (m²), placed-item
 * count, active indicator, delete button (with confirm).
 *
 * 2026-08-25 (Vic complaint 2): the permanent 224 px desktop rail is GONE.
 * At EVERY viewport width this is now a compact dropdown hung off the
 * TopBar's Rooms trigger — same rows, same store calls (setActiveRoom /
 * renameRoom / removeRoom / renameProperty), same live draw counters. The
 * rail was the single biggest fixed cost on the drawing surface and its
 * content is glanced at, not worked in.
 *
 * fix/mobile-ux-v1 (May 2026): the mobile trigger button used to live
 * here as an absolute `left-2 top-2 z-30` element. That overlapped the
 * TopBar currency picker on small viewports. The trigger now lives
 * INSIDE TopBar; this component receives `mobileOpen`/`setMobileOpen`
 * via props from App.tsx so the drawer overlay still renders here.
 * Falls back to local state if the props are absent (backwards compat).
 */

import { useMemo, useState } from 'react';
import { usePropertyStore } from '../store/propertyStore';
import { polygonArea, polygonPerimeter } from '../lib/geometry';
import { useToastStore } from '../store/toastStore';
// Fix 2.5 + 2.6 (Vic 2026-05-22): ROOM VALUE chip relocated from
// floating right-side StatusCard into per-row stats. Sum item prices
// + flooring contribution from the global floor-zone store (active
// room receives all zones today since zones aren't yet roomId-scoped).
import { getProductById } from '../data/products';
import { useFloorZoneStore, type FloorZone } from '../store/floorZoneStore';
import { isDrawnPolygon } from '../designer/roomLayout';
import { findFlooringById } from '../data/paintPalette';
import type { PlacedItem } from '../store/propertyStore';
// Batch 3 Fix 3.2 — live draw-mode counters (vertex / perim / area)
// piggy-back the active-room row instead of the deleted floating HUD.
import { useDrawProgressStore } from '../store/drawProgressStore';

/**
 * Sum the MUR value of items + (active-room only) floor zones.
 * Floor zones aren't yet roomId-scoped — until they are, only the
 * active room sees the zone total so we don't double-count.
 */
function computeRoomValueMur(
  items: PlacedItem[],
  zones: FloorZone[],
  isActive: boolean,
): number {
  let total = 0;
  for (const it of items) {
    const p = getProductById(it.productId);
    if (p && p.price.currency === 'MUR') total += p.price.value;
  }
  if (isActive) {
    for (const z of zones) {
      const mat = findFlooringById(z.material_id);
      if (!mat) continue;
      // Polygon vertices are in mm — shoelace area is mm² ÷ 1e6 → m².
      let s = 0;
      for (let i = 0; i < z.polygon.length; i++) {
        const a = z.polygon[i];
        const b = z.polygon[(i + 1) % z.polygon.length];
        s += a.x_mm * b.y_mm - b.x_mm * a.y_mm;
      }
      const areaM2 = Math.abs(s) / 2 / 1_000_000;
      total += areaM2 * mat.price_per_m2_mur;
    }
  }
  return Math.round(total);
}

export interface RoomListProps {
  /** Called when the user clicks "+ Add room" — parent opens the chooser. */
  onRequestAddRoom: () => void;
  /** Mobile UX (fix/mobile-ux-v1): drawer open state lifted to App.tsx. */
  mobileOpen?: boolean;
  setMobileOpen?: (v: boolean) => void;
}

export function RoomList({
  onRequestAddRoom,
  mobileOpen: mobileOpenProp,
  setMobileOpen: setMobileOpenProp,
}: RoomListProps) {
  const property = usePropertyStore((s) => s.property);
  const setActiveRoom = usePropertyStore((s) => s.setActiveRoom);
  const removeRoom = usePropertyStore((s) => s.removeRoom);
  const renameRoom = usePropertyStore((s) => s.renameRoom);
  const renameProperty = usePropertyStore((s) => s.renameProperty);
  const floorZones = useFloorZoneStore((s) => s.zones);
  // Batch 3 Fix 3.2 — vertex / perim / area counters under the active
  // room while the user is in draw mode. Reads the shared draw-progress
  // store so RoomCanvas remains the owner of the mutation surface.
  const drawEnabled = useDrawProgressStore((s) => s.enabled);
  const drawVertices = useDrawProgressStore((s) => s.vertices);
  const drawPerim = useMemo(() => polygonPerimeter(drawVertices), [drawVertices]);
  const drawArea = useMemo(() => polygonArea(drawVertices), [drawVertices]);

  const pushToast = useToastStore((s) => s.push);
  const drawnRoomCount = property.rooms.filter((r) => isDrawnPolygon(r.polygon)).length;

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [editingProperty, setEditingProperty] = useState(false);
  const [propertyDraft, setPropertyDraft] = useState(property.name);
  const [mobileOpenLocal, setMobileOpenLocal] = useState(false);
  const mobileOpen = mobileOpenProp ?? mobileOpenLocal;
  const setMobileOpen = setMobileOpenProp ?? setMobileOpenLocal;

  function startRename(id: string, current: string) {
    setEditingId(id);
    setDraftName(current);
  }

  function commitRename() {
    if (editingId) {
      renameRoom(editingId, draftName);
    }
    setEditingId(null);
    setDraftName('');
  }

  function commitPropertyRename() {
    renameProperty(propertyDraft);
    setEditingProperty(false);
  }

  function handleDelete(id: string, name: string) {
    if (property.rooms.length <= 1) {
      pushToast("A property must have at least one room.", 'warn');
      setConfirmingDeleteId(null);
      return;
    }
    removeRoom(id);
    pushToast(`Deleted "${name}"`, 'info');
    setConfirmingDeleteId(null);
  }

  const body = (
    <>
      <div className="border-b border-ppw-stone px-3 py-3">
        <p className="text-[10px] uppercase tracking-wide text-ppw-slate">Property</p>
        {editingProperty ? (
          <div className="mt-1 flex gap-1">
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
              className="flex-1 rounded-md border border-ppw-teal bg-white px-2 py-1 text-sm font-semibold text-ppw-ink focus:outline-none"
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              setPropertyDraft(property.name);
              setEditingProperty(true);
            }}
            className="mt-0.5 block w-full truncate text-left text-sm font-semibold text-ppw-ink hover:text-ppw-teal"
            title="Rename property"
          >
            {property.name}
          </button>
        )}
        <p className="mt-0.5 text-[10px] text-ppw-slate">
          {/* DRAWN rooms only. A fresh canvas always holds one blank seed room
              so the model never has zero, but reporting "1 room" over an empty
              plan is simply wrong. */}
          {drawnRoomCount} room{drawnRoomCount === 1 ? '' : 's'}
        </p>
      </div>

      <div className="scroll-pane flex-1 overflow-y-auto px-2 py-2">
        <ul className="flex flex-col gap-1.5">
          {property.rooms.map((room) => {
            const isActive = room.id === property.activeRoomId;
            const area = polygonArea(room.polygon);
            const items = room.placedItems.length;
            const isEditing = editingId === room.id;
            const isConfirming = confirmingDeleteId === room.id;
            return (
              <li
                key={room.id}
                className={`group rounded-md border p-2 transition ${
                  isActive
                    ? 'border-ppw-teal bg-ppw-teal/5'
                    : 'border-ppw-stone bg-white hover:border-ppw-teal'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  {isEditing ? (
                    <input
                      autoFocus
                      type="text"
                      value={draftName}
                      onChange={(e) => setDraftName(e.target.value)}
                      onBlur={commitRename}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitRename();
                        if (e.key === 'Escape') {
                          setEditingId(null);
                          setDraftName('');
                        }
                      }}
                      className="flex-1 rounded-md border border-ppw-teal bg-white px-1.5 py-0.5 text-sm font-medium text-ppw-ink focus:outline-none"
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setActiveRoom(room.id);
                        setMobileOpen(false);
                      }}
                      onDoubleClick={() => startRename(room.id, room.name)}
                      className="min-w-0 flex-1 text-left"
                      title="Click to activate · double-click to rename"
                    >
                      <p
                        className={`truncate text-sm font-medium ${
                          isActive ? 'text-ppw-teal' : 'text-ppw-ink'
                        }`}
                      >
                        {room.name}
                        {isActive && (
                          <span className="ml-1.5 rounded-sm bg-ppw-teal px-1 py-[1px] text-[9px] font-semibold uppercase text-white">
                            Active
                          </span>
                        )}
                      </p>
                      <p className="mt-0.5 text-[10px] text-ppw-slate">
                        {area.toFixed(2)} m² · {items} item{items === 1 ? '' : 's'}
                      </p>
                      <p className="mt-0.5 text-[10px] font-medium text-ppw-teal">
                        Room value Rs {computeRoomValueMur(room.placedItems, floorZones, isActive).toLocaleString('en-MU')}
                      </p>
                      {isActive && drawEnabled && (
                        <p
                          className="mt-1 rounded-sm border border-ppw-teal/40 bg-ppw-teal/10 px-1.5 py-0.5 text-[10px] font-medium leading-tight text-ppw-teal"
                          data-testid="room-draw-live-counters"
                        >
                          <span>{drawVertices.length} vert</span>
                          {' · '}
                          <span>perim {drawPerim.toFixed(2)} m</span>
                          {' · '}
                          <span>area {drawArea.toFixed(2)} m²</span>
                          <span className="ml-1 text-[9px] uppercase tracking-wide text-ppw-slate">
                            Enter to close · Esc cancel
                          </span>
                        </p>
                      )}
                    </button>
                  )}
                  {!isEditing && (
                    <div className="flex shrink-0 gap-1">
                      <button
                        type="button"
                        onClick={() => startRename(room.id, room.name)}
                        className="min-h-[32px] min-w-[32px] rounded-md border border-ppw-stone bg-white px-1.5 text-[10px] text-ppw-slate hover:border-ppw-teal hover:text-ppw-teal"
                        title="Rename room"
                      >
                        ✎
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmingDeleteId(room.id)}
                        className="min-h-[32px] min-w-[32px] rounded-md border border-ppw-stone bg-white px-1.5 text-[10px] text-ppw-slate hover:border-ppw-coral hover:text-ppw-coral"
                        title="Delete room"
                      >
                        ×
                      </button>
                    </div>
                  )}
                </div>

                {isConfirming && (
                  <div className="mt-2 rounded-md border border-ppw-coral bg-ppw-coral/10 p-2 text-[11px]">
                    <p className="text-ppw-ink">Delete "{room.name}" and its items?</p>
                    <div className="mt-1.5 flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleDelete(room.id, room.name)}
                        className="min-h-[36px] flex-1 rounded-md bg-ppw-coral px-2 text-[11px] font-semibold text-white hover:bg-ppw-coral/90"
                      >
                        Delete
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmingDeleteId(null)}
                        className="min-h-[36px] flex-1 rounded-md border border-ppw-stone bg-white px-2 text-[11px] font-semibold text-ppw-slate hover:border-ppw-ink"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        <button
          type="button"
          onClick={() => {
            onRequestAddRoom();
            setMobileOpen(false);
          }}
          className="mt-3 min-h-[44px] w-full rounded-md border-2 border-dashed border-ppw-stone bg-white px-3 text-xs font-semibold text-ppw-slate hover:border-ppw-teal hover:text-ppw-teal"
          title="Add a new room (rectangle quick mode or draw polygon)"
        >
          + Add room
        </button>
      </div>

      <div className="border-t border-ppw-stone bg-ppw-sand px-3 py-2 text-[10px] leading-snug text-ppw-slate">
        Click a room to switch · ✎ rename · × delete
      </div>
    </>
  );

  // The TopBar hosts the trigger (at every width since 2026-08-25) and
  // tells us when to open via `mobileOpen`. Nothing is rendered until then
  // — no rail, no reserved space, zero cost to the canvas.
  if (!mobileOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/30"
        onClick={() => setMobileOpen(false)}
        data-testid="rooms-dropdown-scrim"
      />
      <aside
        data-testid="rooms-dropdown"
        // Full-bleed on a phone; a compact 320 px dropdown anchored under
        // the TopBar trigger on desktop.
        className="fixed left-0 right-0 top-14 z-40 mx-2 flex max-h-[70vh] flex-col rounded-lg border border-ppw-stone bg-white shadow-2xl sm:right-auto sm:w-[320px] sm:max-h-[76vh]"
      >
        {body}
      </aside>
    </>
  );
}
