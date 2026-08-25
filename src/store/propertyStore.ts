/**
 * propertyStore — Week 2.5 multi-room model (Model A — separate
 * canvases per room, RoomSketcher-style). One Property contains many
 * Rooms; each Room is a polygon + a list of placed items.
 *
 * Wire shape:
 *   Property
 *    ├── id          (nanoid)
 *    ├── name        (user-editable, "Wellness Suite")
 *    ├── activeRoomId
 *    └── rooms[]
 *         ├── id     (nanoid)
 *         ├── name   ("Main", "Cold Plunge", …)
 *         ├── polygon: Vertex[]  (metres, no repeated end point)
 *         └── placedItems: PlacedItem[]
 *
 * Persistence: `ppw_property_v2` in localStorage. On first load, if
 * v2 is empty BUT a v1 `ppw_design_v1` payload is present, we hydrate
 * a single-room property from the legacy rectangle save and migrate
 * the rectangle to a 4-vertex polygon. See MIGRATION-NOTES.md.
 *
 * The legacy `useDesignStore` keeps its public API working via the
 * façade in `designStore.ts`; this store is the new source of truth.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { nanoid } from 'nanoid';
import type { Polygon, RoomDims, Vertex } from '../lib/geometry';
import { rectToPolygon } from '../lib/geometry';

export interface PlacedItem {
  instanceId: string;
  productId: string;
  x: number;
  y: number;
  rotation: number;
}

export interface Room {
  id: string;
  name: string;
  /** Closed polygon in metres (no repeated end vertex). */
  polygon: Polygon;
  placedItems: PlacedItem[];
}

export interface Property {
  id: string;
  name: string;
  activeRoomId: string;
  rooms: Room[];
}

const PROPERTY_KEY = 'ppw_property_v2';
const LEGACY_KEY = 'ppw_design_v1';

const DEFAULT_ROOM_DIMS: RoomDims = { lengthM: 5, widthM: 4 };

/**
 * Blank-canvas-on-open (2026-06-09, Vic; hardened 2026-08-25): the ONLY
 * room factory. A FRESH start, "New", "Clear all", the last-room-deleted
 * re-seed and the zero-rooms load repair ALL open onto an EMPTY room — no
 * polygon, no items — so the customer draws their own room first, Sims
 * build-mode style. An empty polygon (`[]`) renders nothing on the canvas
 * (the Konva layer guards `polygon.length >= 3`) and is safe across every
 * geometry helper (`polygonBounds([])` / `polygonArea([])` return zero).
 *
 * The 5×4 m rectangle used to be a "defensive" re-seed here. It was the
 * source of Vic's complaint 1 (2026-08-25): a room the user never drew
 * appearing on the canvas. The ONLY way a rectangle now appears without
 * drawing is the explicit "Quick 5 × 4 m room" button on the start prompt
 * (`data-testid="start-quick-rectangle"`) or the Add-room rectangle mode.
 */
function makeBlankRoom(name = 'Main Room'): Room {
  return {
    id: nanoid(8),
    name,
    polygon: [],
    placedItems: [],
  };
}

function makeDefaultProperty(): Property {
  const room = makeBlankRoom();
  return {
    id: nanoid(8),
    name: 'Wellness Property',
    activeRoomId: room.id,
    rooms: [room],
  };
}

/**
 * One-shot legacy-load: if `ppw_property_v2` is empty but the Week 1/2
 * `ppw_design_v1` payload exists, hydrate the new shape from it.
 * Returns `null` if no legacy data is present (caller starts fresh).
 */
function tryHydrateFromLegacy(): Property | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const state = parsed?.state ?? parsed;
    const roomDimensions: RoomDims = state?.roomDimensions ?? DEFAULT_ROOM_DIMS;
    const placedItems: PlacedItem[] = Array.isArray(state?.placedItems) ? state.placedItems : [];
    const room: Room = {
      id: nanoid(8),
      name: 'Main Room',
      polygon: rectToPolygon(roomDimensions),
      placedItems,
    };
    return {
      id: nanoid(8),
      name: 'Wellness Property',
      activeRoomId: room.id,
      rooms: [room],
    };
  } catch {
    return null;
  }
}

export interface PropertyState {
  property: Property;
  /** UI: which placed item (within the active room) is selected. */
  selectedInstanceId: string | null;
  // ---- view ----
  showGrid: boolean;
  pxPerMetre: number;

  // ---- property-level actions ----
  renameProperty: (name: string) => void;

  // ---- room-level actions ----
  addRoom: (room?: Partial<Pick<Room, 'name' | 'polygon'>>) => string;
  /** Add a rectangle room (helper used by TopBar quick-mode). */
  addRectangleRoom: (name: string, dims: RoomDims) => string;
  removeRoom: (roomId: string) => void;
  renameRoom: (roomId: string, name: string) => void;
  setActiveRoom: (roomId: string) => void;
  setRoomPolygon: (roomId: string, polygon: Polygon) => void;

  // ---- active-room (placed-item) actions ----
  addItem: (item: Omit<PlacedItem, 'instanceId'>) => string;
  removeItem: (instanceId: string) => void;
  updateItem: (instanceId: string, patch: Partial<Omit<PlacedItem, 'instanceId'>>) => void;
  selectItem: (instanceId: string | null) => void;
  clearActiveRoomItems: () => void;

  // ---- view ----
  toggleGrid: () => void;
  setPxPerMetre: (px: number) => void;

  /** Replace the entire property (used by Load). */
  loadProperty: (property: Property) => void;

  /** Test-only: reset to a fresh single-room property. */
  resetToDefault: () => void;
}

function makeInstanceId(): string {
  return nanoid(10);
}

/**
 * Active room helper — returns reference into state for inline mutation.
 */
function getActiveRoom(property: Property): Room | undefined {
  return property.rooms.find((r) => r.id === property.activeRoomId);
}

export const usePropertyStore = create<PropertyState>()(
  persist(
    (set, get) => ({
      property: tryHydrateFromLegacy() ?? makeDefaultProperty(),
      selectedInstanceId: null,
      showGrid: true,
      pxPerMetre: 100,

      renameProperty: (name) =>
        set((s) => ({ property: { ...s.property, name: name.trim() || 'Untitled Property' } })),

      addRoom: (partial) => {
        const newRoom: Room = {
          id: nanoid(8),
          name: partial?.name ?? `Room ${get().property.rooms.length + 1}`,
          polygon: partial?.polygon ?? [],
          placedItems: [],
        };
        set((s) => ({
          property: {
            ...s.property,
            rooms: [...s.property.rooms, newRoom],
            activeRoomId: newRoom.id,
          },
          selectedInstanceId: null,
        }));
        return newRoom.id;
      },

      addRectangleRoom: (name, dims) => {
        const id = nanoid(8);
        const polygon = rectToPolygon(dims);
        set((s) => ({
          property: {
            ...s.property,
            rooms: [
              ...s.property.rooms,
              { id, name: name.trim() || `Room ${s.property.rooms.length + 1}`, polygon, placedItems: [] },
            ],
            activeRoomId: id,
          },
          selectedInstanceId: null,
        }));
        return id;
      },

      removeRoom: (roomId) =>
        set((s) => {
          const remaining = s.property.rooms.filter((r) => r.id !== roomId);
          // Never let a property have zero rooms — re-seed BLANK so the
          // canvas never shows a room the user did not draw.
          if (remaining.length === 0) {
            const fresh = makeBlankRoom();
            return {
              property: { ...s.property, rooms: [fresh], activeRoomId: fresh.id },
              selectedInstanceId: null,
            };
          }
          const activeRoomId =
            s.property.activeRoomId === roomId ? remaining[0].id : s.property.activeRoomId;
          return {
            property: { ...s.property, rooms: remaining, activeRoomId },
            selectedInstanceId: null,
          };
        }),

      renameRoom: (roomId, name) =>
        set((s) => ({
          property: {
            ...s.property,
            rooms: s.property.rooms.map((r) =>
              r.id === roomId ? { ...r, name: name.trim() || r.name } : r,
            ),
          },
        })),

      setActiveRoom: (roomId) =>
        set((s) => {
          if (!s.property.rooms.some((r) => r.id === roomId)) return s;
          return { property: { ...s.property, activeRoomId: roomId }, selectedInstanceId: null };
        }),

      setRoomPolygon: (roomId, polygon) =>
        set((s) => ({
          property: {
            ...s.property,
            rooms: s.property.rooms.map((r) =>
              r.id === roomId ? { ...r, polygon: cleanPolygon(polygon) } : r,
            ),
          },
        })),

      addItem: (item) => {
        const instanceId = makeInstanceId();
        set((s) => {
          const active = getActiveRoom(s.property);
          if (!active) return s;
          const newItem: PlacedItem = { ...item, instanceId };
          return {
            property: {
              ...s.property,
              rooms: s.property.rooms.map((r) =>
                r.id === active.id ? { ...r, placedItems: [...r.placedItems, newItem] } : r,
              ),
            },
            selectedInstanceId: instanceId,
          };
        });
        return instanceId;
      },

      removeItem: (instanceId) =>
        set((s) => {
          const active = getActiveRoom(s.property);
          if (!active) return s;
          return {
            property: {
              ...s.property,
              rooms: s.property.rooms.map((r) =>
                r.id === active.id
                  ? { ...r, placedItems: r.placedItems.filter((i) => i.instanceId !== instanceId) }
                  : r,
              ),
            },
            selectedInstanceId:
              s.selectedInstanceId === instanceId ? null : s.selectedInstanceId,
          };
        }),

      updateItem: (instanceId, patch) =>
        set((s) => {
          const active = getActiveRoom(s.property);
          if (!active) return s;
          return {
            property: {
              ...s.property,
              rooms: s.property.rooms.map((r) =>
                r.id === active.id
                  ? {
                      ...r,
                      placedItems: r.placedItems.map((i) =>
                        i.instanceId === instanceId ? { ...i, ...patch } : i,
                      ),
                    }
                  : r,
              ),
            },
          };
        }),

      selectItem: (instanceId) => set(() => ({ selectedInstanceId: instanceId })),

      clearActiveRoomItems: () =>
        set((s) => {
          const active = getActiveRoom(s.property);
          if (!active) return s;
          return {
            property: {
              ...s.property,
              rooms: s.property.rooms.map((r) =>
                r.id === active.id ? { ...r, placedItems: [] } : r,
              ),
            },
            selectedInstanceId: null,
          };
        }),

      toggleGrid: () => set((s) => ({ showGrid: !s.showGrid })),
      setPxPerMetre: (px) => set(() => ({ pxPerMetre: Math.max(20, Math.min(400, px)) })),

      loadProperty: (property) =>
        set(() => ({
          property: normaliseLoadedProperty(property),
          selectedInstanceId: null,
        })),

      resetToDefault: () =>
        set(() => ({
          property: makeDefaultProperty(),
          selectedInstanceId: null,
        })),
    }),
    {
      name: PROPERTY_KEY,
      storage: createJSONStorage(() => localStorage),
      version: 2,
      partialize: (state) => ({
        property: state.property,
        showGrid: state.showGrid,
        pxPerMetre: state.pxPerMetre,
      }),
      // If a v1 payload is sitting in localStorage and v2 hasn't been
      // written yet, the in-store default already used `tryHydrateFromLegacy`.
      // The migrator below covers a hypothetical future v1→v2 of THIS key.
      migrate: (persisted, version): unknown => {
        if (version >= 2) return persisted;
        // Defensive — if a v1 of this key ever existed, normalise.
        if (persisted && typeof persisted === 'object' && 'property' in (persisted as object)) {
          const p = (persisted as { property: Property }).property;
          return {
            ...(persisted as object),
            property: normaliseLoadedProperty(p),
          };
        }
        return persisted;
      },
    },
  ),
);

/**
 * Ensure a loaded property has at least one room and each room has a
 * polygon (migrate legacy `{lengthM, widthM}` shape if found).
 */
export function normaliseLoadedProperty(property: Property | RawProperty): Property {
  const rooms: Room[] = (property.rooms ?? []).map((r) => normaliseLoadedRoom(r));
  if (rooms.length === 0) {
    rooms.push(makeBlankRoom());
  }
  const activeRoomId =
    property.activeRoomId && rooms.some((r) => r.id === property.activeRoomId)
      ? property.activeRoomId
      : rooms[0].id;
  return {
    id: property.id ?? nanoid(8),
    name: property.name ?? 'Wellness Property',
    activeRoomId,
    rooms,
  };
}

/**
 * Permissive shape for legacy / migrated room payloads. Either has a
 * polygon (Week 2.5+) or rectangle fields (Week 1/2). Either way we
 * end up with a Polygon.
 */
interface RawRoom {
  id?: string;
  name?: string;
  polygon?: Polygon;
  vertices?: Polygon;
  lengthM?: number;
  widthM?: number;
  roomDimensions?: RoomDims;
  placedItems?: PlacedItem[];
}

interface RawProperty {
  id?: string;
  name?: string;
  activeRoomId?: string;
  rooms?: RawRoom[];
}

export function normaliseLoadedRoom(r: RawRoom): Room {
  // A room that carries Week 1/2 rectangle fields is a LEGACY payload and
  // is migrated to a polygon. A room with neither a polygon nor rect
  // fields is a BLANK room (Vic 2026-08-25) — it must stay blank, not
  // silently acquire a 5×4 m rectangle the user never drew.
  const hasLegacyRect =
    typeof r.lengthM === 'number'
    || typeof r.widthM === 'number'
    || typeof r.roomDimensions?.lengthM === 'number'
    || typeof r.roomDimensions?.widthM === 'number';
  const polygon: Polygon =
    (r.polygon && r.polygon.length >= 3 && r.polygon)
    || (r.vertices && r.vertices.length >= 3 && r.vertices)
    || (hasLegacyRect
      ? rectToPolygon({
        lengthM: r.lengthM ?? r.roomDimensions?.lengthM ?? DEFAULT_ROOM_DIMS.lengthM,
        widthM: r.widthM ?? r.roomDimensions?.widthM ?? DEFAULT_ROOM_DIMS.widthM,
      })
      : []);
  return {
    id: r.id ?? nanoid(8),
    name: r.name ?? 'Room',
    polygon: cleanPolygon(polygon),
    placedItems: Array.isArray(r.placedItems) ? r.placedItems : [],
  };
}

/**
 * Sanity-clean a polygon — drop a trailing duplicate-of-first vertex
 * if present (some encoders emit them). Returns at least the input
 * unchanged if no cleanup needed.
 */
export function cleanPolygon(polygon: Polygon): Polygon {
  if (polygon.length < 2) return polygon;
  const first = polygon[0];
  const last = polygon[polygon.length - 1];
  if (Math.abs(first.x - last.x) < 1e-6 && Math.abs(first.y - last.y) < 1e-6) {
    return polygon.slice(0, -1);
  }
  return polygon;
}

/** Convenience selectors. */
export function selectActiveRoom(s: PropertyState): Room | undefined {
  return s.property.rooms.find((r) => r.id === s.property.activeRoomId);
}

export type { Vertex };
