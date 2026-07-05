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

export type RoomDimensions = RoomDims;
export type { PlacedItem };

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
    return {
      roomDimensions: { lengthM: 5, widthM: 4 },
      polygon: rectToPolygon({ lengthM: 5, widthM: 4 }),
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
    const polygon = active?.polygon ?? rectToPolygon({ lengthM: 5, widthM: 4 });
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
      ps.setRoomPolygon(active.id, rectToPolygon(clamped));
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
