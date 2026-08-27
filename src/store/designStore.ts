/**
 * designStore - Week 2.5: now a thin facade over `propertyStore`.
 *
 * Before Week 2.5, this was a standalone Zustand store holding a single
 * room. With the move to a multi-room Property model (Model A), the
 * source of truth is `usePropertyStore`. To avoid rewriting every call
 * site (RoomCanvas, DetailsPanel, placementActions, useAutoSave,
 * keyboard shortcuts), this file re-exposes the same API surface and
 * proxies into the active room of the active property.
 *
 * Anything that needs the multi-room awareness (e.g. RoomList sidebar)
 * imports from `propertyStore.ts` directly.
 *
 * Types `RoomDimensions` and `PlacedItem` retained for backwards type
 * compatibility - they are now thin re-exports.
 */
import { create } from 'zustand';
import {
  usePropertyStore,
  selectActiveRoom,
  type PlacedItem,
  type Room,
} from './propertyStore';
import { rectToPolygon, polygonBounds } from '../lib/geometry';
import type { Polygon, RoomDims } from '../lib/geometry';
// Attached multi-room (2026-08-26) — resizing a room must not teleport it
// to the origin or eat its neighbour.
import { isDrawnPolygon, strictPolygonsOverlap, translatePolygon } from '../designer/roomLayout';
import { useToastStore } from './toastStore';

export type RoomDimensions = RoomDims;
export type { PlacedItem };

/**
 * Blank start (Vic 2026-08-25). When there is no active room, the façade
 * projects an EMPTY polygon — never a 5×4 m rectangle. `RoomCanvas` guards
 * on `polygon.length >= 3`, so an empty polygon renders a truly blank
 * canvas and the start-state prompt takes over. Frozen module singletons
 * so identity is stable across renders (no spurious re-subscribes).
 */
// `Object.freeze` widens an array to a readonly tuple type that TS will not
// assign back to the mutable `Polygon` alias; the double assertion is the
// standard escape and is safe here — the value is empty and never mutated.
export const EMPTY_POLYGON: Polygon = Object.freeze([]) as unknown as Polygon;
export const EMPTY_ROOM_DIMENSIONS: RoomDimensions = Object.freeze({
  lengthM: 0,
  widthM: 0,
});

export interface DesignState {
  roomDimensions: RoomDimensions;
  polygon: Polygon;
  placedItems: PlacedItem[];
  selectedInstanceId: string | null;
  showGrid: boolean;
  pxPerMetre: number;

  setRoomDimensions: (dims: RoomDimensions) => void;
  addItem: (item: Omit<PlacedItem, 'instanceId'>) => string;
  removeItem: (instanceId: string) => void;
  updateItem: (instanceId: string, patch: Partial<Omit<PlacedItem, 'instanceId'>>) => void;
  selectItem: (instanceId: string | null) => void;
  clearDesign: () => void;
  toggleGrid: () => void;
  setPxPerMetre: (px: number) => void;
  loadSnapshot: (snapshot: { roomDimensions: RoomDimensions; placedItems: PlacedItem[] }) => void;
}

function projectFromProperty(): {
  roomDimensions: RoomDimensions;
  polygon: Polygon;
  placedItems: PlacedItem[];
  selectedInstanceId: string | null;
  showGrid: boolean;
  pxPerMetre: number;
} {
  const ps = usePropertyStore.getState();
  const active: Room | undefined = selectActiveRoom(ps);
  if (!active) {
    // Blank start (Vic 2026-08-25, complaint 1): with no active room the
    // canvas must render NOTHING. The old 5×4 m fallback drew a room the
    // user never created. `polygonBounds([])` is all-zero, so the L/W
    // readout reports 0 and TopBar shows its "Draw a room →" hint.
    return {
      roomDimensions: EMPTY_ROOM_DIMENSIONS,
      polygon: EMPTY_POLYGON,
      placedItems: [],
      selectedInstanceId: null,
      showGrid: ps.showGrid,
      pxPerMetre: ps.pxPerMetre,
    };
  }
  const b = polygonBounds(active.polygon);
  return {
    roomDimensions: {
      lengthM: Math.max(0.01, b.maxX - b.minX),
      widthM: Math.max(0.01, b.maxY - b.minY),
    },
    polygon: active.polygon,
    placedItems: active.placedItems,
    selectedInstanceId: ps.selectedInstanceId,
    showGrid: ps.showGrid,
    pxPerMetre: ps.pxPerMetre,
  };
}

/**
 * The active room is "rectangle-shaped" iff its polygon is exactly 4
 * vertices and matches an axis-aligned bounding box. Used by the
 * TopBar L/W inputs which only edit rect rooms.
 */
export function isActiveRoomRectangle(): boolean {
  const ps = usePropertyStore.getState();
  const active = selectActiveRoom(ps);
  if (!active || active.polygon.length !== 4) return false;
  const p = active.polygon;
  const b = polygonBounds(p);
  const corners = [
    { x: b.minX, y: b.minY },
    { x: b.maxX, y: b.minY },
    { x: b.maxX, y: b.maxY },
    { x: b.minX, y: b.maxY },
  ];
  const eps = 1e-3;
  return p.every((v) =>
    corners.some((c) => Math.abs(c.x - v.x) < eps && Math.abs(c.y - v.y) < eps),
  );
}

/**
 * Unsubscriber for the propertyStore→designStore mirror subscription.
 * The store is a module singleton so the subscription lives for the app
 * lifetime in production; the handle exists so tests / HMR teardown can
 * detach it instead of stacking duplicate listeners (same pattern as
 * historyStore's uninstallHistorySubscriptions).
 */
let _unsubscribeMirror: (() => void) | null = null;

export function uninstallDesignStoreMirror(): void {
  _unsubscribeMirror?.();
  _unsubscribeMirror = null;
}

export const useDesignStore = create<DesignState>((set) => {
  const initial = projectFromProperty();

  _unsubscribeMirror = usePropertyStore.subscribe((ps) => {
    const active = selectActiveRoom(ps);
    const polygon = active?.polygon ?? EMPTY_POLYGON;
    const b = polygonBounds(polygon);
    set({
      polygon,
      roomDimensions: {
        lengthM: Math.max(0.01, b.maxX - b.minX),
        widthM: Math.max(0.01, b.maxY - b.minY),
      },
      placedItems: active?.placedItems ?? [],
      selectedInstanceId: ps.selectedInstanceId,
      showGrid: ps.showGrid,
      pxPerMetre: ps.pxPerMetre,
    });
  });

  return {
    ...initial,

    setRoomDimensions: (dims) => {
      const clamped = {
        lengthM: Math.max(1, Math.min(50, dims.lengthM)),
        widthM: Math.max(1, Math.min(50, dims.widthM)),
      };
      if (!isActiveRoomRectangle()) return;
      const ps = usePropertyStore.getState();
      const active = selectActiveRoom(ps);
      if (!active) return;
      // D7a — rebuild AT THE ROOM'S CURRENT CORNER. `rectToPolygon` always
      // pins at the origin, which used to teleport an attached room across
      // the plan (and straight through its neighbours) on every L/W edit.
      const b = polygonBounds(active.polygon);
      const next = translatePolygon(rectToPolygon(clamped), b.minX, b.minY);
      // D7b — a resize that would eat a neighbour is refused outright, so
      // the no-overlap invariant holds no matter which surface edits the
      // room. Toast + no state change: nothing silently half-applies.
      const clash = ps.property.rooms.some(
        (r) => r.id !== active.id && isDrawnPolygon(r.polygon) && strictPolygonsOverlap(next, r.polygon),
      );
      if (clash) {
        useToastStore
          .getState()
          .push("That size would overlap another room — walls can be shared, not crossed.", 'warn');
        return;
      }
      ps.setRoomPolygon(active.id, next);
    },

    addItem: (item) => usePropertyStore.getState().addItem(item),
    removeItem: (instanceId) => usePropertyStore.getState().removeItem(instanceId),
    updateItem: (instanceId, patch) => usePropertyStore.getState().updateItem(instanceId, patch),
    selectItem: (instanceId) => usePropertyStore.getState().selectItem(instanceId),

    clearDesign: () => usePropertyStore.getState().clearActiveRoomItems(),
    toggleGrid: () => usePropertyStore.getState().toggleGrid(),
    setPxPerMetre: (px) => usePropertyStore.getState().setPxPerMetre(px),

    loadSnapshot: (snapshot) => {
      const ps = usePropertyStore.getState();
      // D7c — loadSnapshot is the single-room legacy path: it flattens the
      // property to one rectangle + one item list. Against a multi-room
      // plan that is silent data loss, so it refuses.
      if (ps.property.rooms.filter((r) => isDrawnPolygon(r.polygon)).length > 1) {
        console.warn('[loadSnapshot] multi-room property — refusing legacy flatten');
        return;
      }
      const active = selectActiveRoom(ps);
      if (!active) return;
      ps.setRoomPolygon(active.id, rectToPolygon(snapshot.roomDimensions));
      ps.clearActiveRoomItems();
      for (const it of snapshot.placedItems) {
        ps.addItem({
          productId: it.productId,
          x: it.x,
          y: it.y,
          rotation: it.rotation,
        });
      }
      ps.selectItem(null);
    },
  };
});
