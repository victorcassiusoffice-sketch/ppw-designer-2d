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
// Attached multi-room (2026-08-26) — every room lives in ONE shared world
// frame, so a new rectangle needs an anchor and a legacy all-at-origin
// save needs un-stacking. Both are pure helpers.
import { translatePolygon, unstackLegacyRooms } from '../designer/roomLayout';
// Wall-hosted openings (2026-08-28) — doors/doorways/windows live on the Room
// so history and persistence pick them up with no extra plumbing.
import type { Opening } from '../designer/openings';
import { openingSpan, validateOpening } from '../designer/openings';
import { roomEdges } from '../designer/wallEdges';
import { nextRoomName } from '../designer/roomNaming';

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
  /**
   * Doors, doorways and windows cut into this room's walls (2026-08-28).
   *
   * Hosted PARAMETRICALLY on a polygon edge — `{ edgeIndex, offsetM, widthM }`
   * — never in free space, so an opening cannot drift off its wall. Nested on
   * the Room rather than kept in a side store on purpose: `historyStore`
   * snapshots `property` whole, so undo/redo covers openings for free, and the
   * API stores `property` as opaque JSON so no endpoint or migration is needed.
   *
   * Optional because every property persisted before this shipped lacks it.
   * Read it through `roomOpenings(room)`, never `room.openings!`.
   */
  openings?: Opening[];
  /**
   * The floor finish covering this room (2026-08-28).
   *
   * PER-ROOM, not per-tile. Every consumer floor planner converges on
   * "click a room, pick a material, it fills the polygon" — per-tile painting
   * is a game mechanic that buys nothing when the output is a shopping list.
   * `materialId` is a `FLOOR_MATERIALS` id; absent/null = bare floor.
   *
   * Nested on Room for the same reason openings are: undo and persistence
   * come free, and no API change is needed.
   */
  floorFinish?: { materialId: string } | null;
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
  /**
   * Add a rectangle room (helper used by TopBar quick-mode).
   *
   * Attached multi-room (2026-08-26): `anchor` translates the rectangle in
   * the shared world frame. Omitted → (0, 0), i.e. exactly the pre-2026-08-26
   * behaviour, which is what keeps the fresh-canvas e2e flows byte-compatible.
   */
  addRectangleRoom: (name: string, dims: RoomDims, anchor?: Vertex) => string;
  removeRoom: (roomId: string) => void;
  renameRoom: (roomId: string, name: string) => void;
  setActiveRoom: (roomId: string) => void;
  setRoomPolygon: (roomId: string, polygon: Polygon) => void;

  // ---- placed-item actions ----
  /**
   * Add an item. `roomId` omitted → the ACTIVE room (every pre-2026-08-26
   * call site compiles and behaves unchanged). The attached-multi-room
   * canvas passes the room the pointer was actually over.
   */
  addItem: (item: Omit<PlacedItem, 'instanceId'>, roomId?: string) => string;
  /** Removes by instanceId from WHICHEVER room owns it (ids are global). */
  removeItem: (instanceId: string) => void;
  /** Patches by instanceId in WHICHEVER room owns it (ids are global). */
  updateItem: (instanceId: string, patch: Partial<Omit<PlacedItem, 'instanceId'>>) => void;
  selectItem: (instanceId: string | null) => void;
  /**
   * Select an item in ANY room and move focus to its room in ONE atomic
   * set. Two separate sets would race `setActiveRoom`'s selection-nulling.
   */
  selectItemAcrossRooms: (instanceId: string | null) => void;
  clearActiveRoomItems: () => void;

  // ---- opening (door / doorway / window) actions ----
  /**
   * Cut an opening into a room's wall. Returns the new opening's id, or null
   * if the placement is illegal (wall too short, past the jamb margin, or
   * overlapping an opening already on that wall) — callers surface the reason
   * from `validateOpening` rather than silently dropping it.
   */
  /** Set (or clear, with null) a room's floor finish. */
  setRoomFloor: (roomId: string, materialId: string | null) => void;

  addOpening: (roomId: string, opening: Omit<Opening, 'id'> & { id?: string }) => string | null;
  /** Removes by opening id from WHICHEVER room owns it (ids are global). */
  removeOpening: (openingId: string) => void;
  /**
   * Patches by opening id in WHICHEVER room owns it. Re-validates against the
   * host wall and returns false (changing nothing) if the patch is illegal, so
   * dragging a door past its jamb cannot corrupt the plan.
   */
  updateOpening: (openingId: string, patch: Partial<Omit<Opening, 'id'>>) => boolean;
  /** D8 — one-shot legacy un-stack; safe to call on every app mount. */
  unstackIfLegacy: () => boolean;

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

/**
 * Locate the room that owns a placed item. `instanceId` is `nanoid(10)`
 * and globally unique across the whole property, so the first hit is THE
 * hit. Attached multi-room (2026-08-26) — before this, item mutations went
 * through `getActiveRoom` only and an item in a non-active room was
 * visible but un-editable.
 */
function findRoomByInstanceId(property: Property, instanceId: string): Room | undefined {
  return property.rooms.find((r) => r.placedItems.some((i) => i.instanceId === instanceId));
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
          name: partial?.name ?? nextRoomName(get().property.rooms),
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

      addRectangleRoom: (name, dims, anchor) => {
        const id = nanoid(8);
        // rectToPolygon always pins at the origin; the anchor moves the
        // whole rectangle into place in the shared world frame.
        const polygon = anchor
          ? translatePolygon(rectToPolygon(dims), anchor.x, anchor.y)
          : rectToPolygon(dims);
        set((s) => ({
          property: {
            ...s.property,
            rooms: [
              ...s.property.rooms,
              { id, name: name.trim() || nextRoomName(s.property.rooms), polygon, placedItems: [] },
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
        set((s) => {
          const clean = cleanPolygon(polygon);
          return {
            property: {
              ...s.property,
              rooms: s.property.rooms.map((r) =>
                r.id === roomId
                  // Reshaping a room can delete a wall or shorten it below the
                  // door it was hosting. An opening has no independent
                  // existence — it is a hole in a wall — so it cascades with
                  // its host, in the SAME set() and therefore the same undo
                  // frame. Leaving it behind would render a swing arc floating
                  // in space with no wall under it.
                  ? { ...r, polygon: clean, openings: pruneOpenings(r.openings, clean) }
                  : r,
              ),
            },
          };
        }),

      addItem: (item, roomId) => {
        const instanceId = makeInstanceId();
        set((s) => {
          // Attached multi-room: an explicit roomId routes the item into
          // whichever room the pointer was over. No roomId → active room,
          // exactly as before.
          const target = roomId
            ? s.property.rooms.find((r) => r.id === roomId)
            : getActiveRoom(s.property);
          if (!target) return s;
          const newItem: PlacedItem = { ...item, instanceId };
          return {
            property: {
              ...s.property,
              rooms: s.property.rooms.map((r) =>
                r.id === target.id ? { ...r, placedItems: [...r.placedItems, newItem] } : r,
              ),
            },
            selectedInstanceId: instanceId,
          };
        });
        return instanceId;
      },

      // removeItem / updateItem scan EVERY room for the instanceId rather
      // than only the active one. instanceIds are nanoid(10) and globally
      // unique, so the scan is unambiguous — and without it an item in a
      // non-active room could be seen but never edited or deleted.
      removeItem: (instanceId) =>
        set((s) => {
          const owner = findRoomByInstanceId(s.property, instanceId);
          if (!owner) return s;
          return {
            property: {
              ...s.property,
              rooms: s.property.rooms.map((r) =>
                r.id === owner.id
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
          const owner = findRoomByInstanceId(s.property, instanceId);
          if (!owner) return s;
          return {
            property: {
              ...s.property,
              rooms: s.property.rooms.map((r) =>
                r.id === owner.id
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

      selectItemAcrossRooms: (instanceId) =>
        set((s) => {
          // null → plain deselect. activeRoomId is deliberately UNTOUCHED:
          // the Stage deselect paths pass null through on every empty-space
          // click and must not yank the user's focus to another room.
          if (instanceId === null) return { selectedInstanceId: null };
          const owner = findRoomByInstanceId(s.property, instanceId);
          if (!owner) return { selectedInstanceId: instanceId };
          if (owner.id === s.property.activeRoomId) {
            return { selectedInstanceId: instanceId };
          }
          // ONE atomic set — splitting this into setActiveRoom + selectItem
          // would let setActiveRoom's selection-nulling win the race.
          return {
            property: { ...s.property, activeRoomId: owner.id },
            selectedInstanceId: instanceId,
          };
        }),

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

      setRoomFloor: (roomId, materialId) =>
        set((s) => ({
          property: {
            ...s.property,
            rooms: s.property.rooms.map((r) =>
              r.id === roomId
                ? { ...r, floorFinish: materialId ? { materialId } : null }
                : r,
            ),
          },
        })),

      // ---- openings ----------------------------------------------------

      addOpening: (roomId, opening) => {
        const s = get();
        const room = s.property.rooms.find((r) => r.id === roomId);
        if (!room) return null;
        const edge = roomEdges(room)[opening.edgeIndex];
        if (!edge) return null;

        const others = roomOpenings(room).filter((o) => o.edgeIndex === opening.edgeIndex);
        if (!validateOpening(edge.lengthM, opening, others).ok) return null;

        const id = opening.id ?? nanoid(10);
        const next: Opening = { ...opening, id };
        set((st) => ({
          property: {
            ...st.property,
            rooms: st.property.rooms.map((r) =>
              r.id === roomId ? { ...r, openings: [...roomOpenings(r), next] } : r,
            ),
          },
        }));
        return id;
      },

      removeOpening: (openingId) =>
        set((s) => ({
          property: {
            ...s.property,
            rooms: s.property.rooms.map((r) => {
              const existing = roomOpenings(r);
              if (!existing.some((o) => o.id === openingId)) return r;
              return { ...r, openings: existing.filter((o) => o.id !== openingId) };
            }),
          },
        })),

      updateOpening: (openingId, patch) => {
        const s = get();
        const room = s.property.rooms.find((r) =>
          roomOpenings(r).some((o) => o.id === openingId),
        );
        if (!room) return false;

        const current = roomOpenings(room).find((o) => o.id === openingId)!;
        const merged: Opening = { ...current, ...patch, id: current.id };
        const edge = roomEdges(room)[merged.edgeIndex];
        if (!edge) return false;

        // Re-validate against the (possibly new) host wall, excluding itself,
        // so a drag past the jamb margin is refused rather than committed.
        const others = roomOpenings(room).filter(
          (o) => o.id !== openingId && o.edgeIndex === merged.edgeIndex,
        );
        if (!validateOpening(edge.lengthM, merged, others).ok) return false;

        set((st) => ({
          property: {
            ...st.property,
            rooms: st.property.rooms.map((r) =>
              r.id === room.id
                ? { ...r, openings: roomOpenings(r).map((o) => (o.id === openingId ? merged : o)) }
                : r,
            ),
          },
        }));
        return true;
      },

      /**
       * D8 — legacy un-stack. Every rectangle-authored room before
       * 2026-08-26 was pinned at the origin by `rectToPolygon`, so a legacy
       * multi-room save has its rooms STACKED. Single-room rendering hid
       * that; the attached canvas would draw them on top of each other.
       *
       * `normaliseLoadedProperty` can NOT do this — it does not run on a
       * normal reload (the persist `migrate()` early-returns for version
       * >= 2), which is why this hangs off app mount instead.
       *
       * Returns true iff the property changed. The caller owns the toast.
       */
      unstackIfLegacy: () => {
        const current = get().property;
        const next = unstackLegacyRooms(current);
        if (next === current) return false;
        set(() => ({ property: next }));
        return true;
      },

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
  openings?: Opening[];
  floorFinish?: { materialId: string } | null;
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
  const clean = cleanPolygon(polygon);
  return {
    id: r.id ?? nanoid(8),
    name: r.name ?? 'Room',
    polygon: clean,
    placedItems: Array.isArray(r.placedItems) ? r.placedItems : [],
    // This function WHITELISTS fields — anything not named here is dropped on
    // every Save/Load round trip. Openings survive a reload without this (the
    // persist blob is restored verbatim) but would silently vanish the first
    // time a design was saved and re-loaded, which is the nastiest possible
    // shape for a data-loss bug. Pruned against the CLEANED polygon so a
    // migrated room can never carry an opening hosted on an edge that no
    // longer exists.
    openings: pruneOpenings(r.openings, clean),
    // Same whitelist trap as `openings`: omit this and a room's floor silently
    // disappears on the first save/load round trip.
    floorFinish:
      r.floorFinish && typeof r.floorFinish.materialId === 'string'
        ? { materialId: r.floorFinish.materialId }
        : null,
  };
}

/**
 * Openings whose host wall still exists and can still hold them.
 *
 * Used both on load and after any polygon edit. An opening on an edge that has
 * been removed, or on a wall that has become too short, is DROPPED rather than
 * kept in an invalid state — a door hanging off a wall that is no longer there
 * would render as a stray arc floating in space.
 */
export function pruneOpenings(
  openings: Opening[] | undefined,
  polygon: Polygon,
): Opening[] {
  if (!Array.isArray(openings) || openings.length === 0) return [];
  const edges = roomEdges({ id: '_', polygon });
  return openings.filter((o) => {
    if (!o || typeof o.edgeIndex !== 'number' || typeof o.offsetM !== 'number') return false;
    const edge = edges[o.edgeIndex];
    if (!edge) return false;
    const { t0, t1 } = openingSpan(o);
    return t0 >= -1e-9 && t1 <= edge.lengthM + 1e-9;
  });
}

/** Openings on a room, tolerating properties persisted before openings existed. */
export function roomOpenings(room: Pick<Room, 'openings'>): Opening[] {
  return room.openings ?? [];
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
