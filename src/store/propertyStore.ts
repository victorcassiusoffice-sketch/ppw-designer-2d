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
// Per-tile floor painting (floor-painting brief 2026-08-28).
import {
  pruneZone,
  runsToSet,
  setToRuns,
  zoneForMaterial,
  tilesCoveringPolygon,
  type FloorZone,
} from '../designer/floorTiles';
import { findFloorMaterialById } from '../data/floorMaterials';
import { nextRoomName } from '../designer/roomNaming';
// Sims world (2026-08-29) — storeys, outdoor rooms, free walls and the land
// plot all ride INSIDE `property`, so history, autosave, pages and the server
// (which stores property as opaque JSON) pick them up with no new plumbing.
import {
  GROUND_LEVEL_ID,
  activeLevelIdOf,
  groundLevel,
  isLevelLike,
  isOutdoorRoom,
  levelsOf,
  nextLevelIndex,
  nextLevelName,
  roomLevelId,
  sortLevels,
  type Level,
} from '../designer/levels';
import {
  MIN_FREE_WALL_LENGTH_M,
  freeWallLengthM,
  fromLegacyWallSegments,
  isFreeWallLike,
  wallsOnLevel,
  type FreeWall,
} from '../designer/freeWalls';

export interface PlacedItem {
  instanceId: string;
  productId: string;
  x: number;
  y: number;
  rotation: number;
  /**
   * Surface slots (2026-08-24) — set on `placement: 'surface'` items:
   * the instanceId of the surface (table/console) they sit on. Children
   * move with their parent (see updateItem) and are removed with it
   * (see removeItem). Optional → absent on every pre-existing save.
   */
  parentInstanceId?: string;
  /**
   * Lighting (2026-08-29) — whether a light-emitting product is switched on.
   * Absent reads as ON (a lamp you just bought is lit), so only an explicit
   * `false` darkens it. Read through `itemLightOn()`.
   */
  lightOn?: boolean;
}

/**
 * The land plot (2026-08-29, Vic's brief #5). Locks the scale of the plan and
 * the maximum footprint. World metres; `originM` is the plot's top-left in the
 * same frame as the room polygons. `null`/absent = no plot, unbounded canvas.
 */
export interface Site {
  widthM: number;
  depthM: number;
  originM: Vertex;
}

/** Plot side lengths are clamped to this range by `setSite`. */
export const SITE_MIN_M = 1;
export const SITE_MAX_M = 500;

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
   * A single floor finish covering the WHOLE room (2026-08-28).
   *
   * Still the right model for sheet goods: the EPDM roll is 10 x 1.25 m of
   * material laid in continuous runs, so it has no tile count and is priced
   * by area. It is also what every design saved before per-tile painting
   * shipped carries, and those must keep opening and rendering unchanged.
   *
   * `materialId` is a `FLOOR_MATERIALS` id; absent/null = bare floor.
   *
   * SUPERSEDED for tileable materials by `floorTiles` below. The two are
   * mutually exclusive per room; `floorTiles` wins when present.
   */
  floorFinish?: { materialId: string } | null;
  /**
   * Per-tile floor painting (floor-painting brief 2026-08-28).
   *
   * Vic asked for The Sims' flooring workflow: click a tile, drag a
   * rectangle, fill a room. That needs the floor to be a set of TILES
   * rather than one material id, because the customer buys whole tiles and
   * a part-painted room is a legitimate design.
   *
   * One zone per material, so a room can mix finishes. Optional, because
   * every property saved before this shipped lacks it.
   *
   * Nested on Room exactly as `openings` is: `historyStore` snapshots
   * `property` whole so undo covers painting for free, and the API stores
   * `property` as opaque JSON so no endpoint or migration is needed. The
   * persist key stays `ppw_property_v2` at version 2.
   */
  floorTiles?: FloorZone[];
  /**
   * Storey this room sits on (2026-08-29). ABSENT MEANS GROUND — that is the
   * canonical form, not a fallback, so a single-storey design saved today is
   * byte-identical to one saved before levels existed. Read it through
   * `roomLevelId(room)`; never compare against 'ground' directly.
   */
  levelId?: string;
  /**
   * `'outdoor'` marks the one-per-level container for items placed outside
   * every room polygon (gardens, terraces, the space between buildings). Its
   * polygon stays `[]` — it is unbounded, or bounded by the site. Absent =
   * a normal room. Read through `isOutdoorRoom(room)`.
   */
  kind?: 'room' | 'outdoor';
}

export interface Property {
  id: string;
  name: string;
  activeRoomId: string;
  rooms: Room[];
  /** Storeys (2026-08-29). Absent/empty = a lone ground floor. See `levelsOf`. */
  levels?: Level[];
  /** Storey in focus. Absent = ground. See `activeLevelIdOf`. */
  activeLevelId?: string;
  /** Free-standing walls, world metres, per level. Absent = none. */
  walls?: FreeWall[];
  /** Land plot. Absent/null = no plot. */
  site?: Site | null;
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
function makeBlankRoom(name = 'Main Room', levelId: string = GROUND_LEVEL_ID): Room {
  return {
    id: nanoid(8),
    name,
    polygon: [],
    placedItems: [],
    ...levelStamp(levelId),
  };
}

/**
 * The `levelId` field to spread onto a new room: nothing for ground, so the
 * ground floor's rooms stay in the pre-levels shape (see `Room.levelId`).
 */
function levelStamp(levelId: string): { levelId?: string } {
  return levelId === GROUND_LEVEL_ID ? {} : { levelId };
}

/** `Room.levelId` in canonical form (ground = absent). */
function canonicalLevelId(levelId: unknown): string | undefined {
  return typeof levelId === 'string' && levelId.length > 0 && levelId !== GROUND_LEVEL_ID
    ? levelId
    : undefined;
}

/** Non-outdoor rooms on a level — the ones the draw tool and focus care about. */
function realRoomsOnLevel(rooms: readonly Room[], levelId: string): Room[] {
  return rooms.filter((r) => roomLevelId(r) === levelId && !isOutdoorRoom(r));
}

/**
 * Focus a room, and follow it onto its level. `activeLevelId` is only written
 * when it actually changes so a single-storey property's JSON stays untouched.
 */
function focusRoom(property: Property, roomId: string): Property {
  const room = property.rooms.find((r) => r.id === roomId);
  const level = room ? roomLevelId(room) : activeLevelIdOf(property);
  const next: Property = { ...property, activeRoomId: roomId };
  if (level !== activeLevelIdOf(property)) next.activeLevelId = level;
  return next;
}

/**
 * Make the first real room on `levelId` active, seeding a blank one when the
 * level has none. Every storey in focus holds at least one non-outdoor room —
 * the same invariant `removeRoom` keeps — so the draw tool, the TopBar L/W
 * readout and the start prompt always have a room to talk about.
 */
function focusFirstRoomOnLevel(property: Property, levelId: string): Property {
  const real = realRoomsOnLevel(property.rooms, levelId);
  if (real.length > 0) return { ...property, activeRoomId: real[0].id };
  const fresh = makeBlankRoom(nextRoomName(property.rooms), levelId);
  return { ...property, rooms: [...property.rooms, fresh], activeRoomId: fresh.id };
}

/**
 * Validate + clamp a plot. Sides must be finite and positive (anything else is
 * a typo, not a request) and are clamped to `SITE_MIN_M..SITE_MAX_M`; a
 * missing or non-finite origin falls back to the world origin. Returns
 * undefined when the shape is unusable.
 */
export function normaliseSite(site: unknown): Site | undefined {
  if (!site || typeof site !== 'object') return undefined;
  const s = site as Record<string, unknown>;
  const clamp = (n: unknown): number | undefined =>
    typeof n === 'number' && Number.isFinite(n) && n > 0
      ? Math.min(SITE_MAX_M, Math.max(SITE_MIN_M, n))
      : undefined;
  const widthM = clamp(s.widthM);
  const depthM = clamp(s.depthM);
  if (widthM === undefined || depthM === undefined) return undefined;
  const o = s.originM as Record<string, unknown> | undefined;
  const originM =
    o && typeof o === 'object'
      && typeof o.x === 'number' && Number.isFinite(o.x)
      && typeof o.y === 'number' && Number.isFinite(o.y)
      ? { x: o.x, y: o.y }
      : { x: 0, y: 0 };
  return { widthM, depthM, originM };
}

/** Whether a light-emitting item is lit. Absent = on (see `PlacedItem.lightOn`). */
export function itemLightOn(item: Pick<PlacedItem, 'lightOn'>): boolean {
  return item.lightOn !== false;
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
  /** Commit one floor-paint stroke as a single undo frame. */
  paintFloorTiles: (
    roomId: string,
    zone: FloorZone,
    keys: string[],
    erase?: boolean,
  ) => void;
  removeItem: (instanceId: string) => void;
  /** Move an item to another room, keeping its instanceId. */
  moveItemToRoom: (
    instanceId: string,
    toRoomId: string,
    x: number,
    y: number,
    rotation?: number,
  ) => void;
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

  // ---- levels (storeys) — Sims world 2026-08-29 ----
  /**
   * Add a storey above the highest one (index = max + 1), make it active, and
   * seed it with one blank room which becomes the active room — so the draw
   * tool has somewhere to put its first polygon. Returns the level id.
   */
  addLevel: (name?: string) => string;
  renameLevel: (id: string, name: string) => void;
  /**
   * Delete a storey. Refuses (returns false, changes nothing) for the ground
   * floor and for any level that still holds a drawn room, a placed item or a
   * free wall — deleting work must be an explicit act on that work. Otherwise
   * its (blank) rooms and walls go with it and focus returns to ground.
   */
  removeLevel: (id: string) => boolean;
  /**
   * Focus a storey. The active room becomes the first non-outdoor room on it,
   * created blank if there is none. Unknown ids are ignored.
   */
  setActiveLevel: (id: string) => void;

  // ---- site (land plot) ----
  /** Set or clear the plot. Non-finite / non-positive sides are ignored; sides clamp to 1..500 m. */
  setSite: (site: Site | null) => void;

  // ---- free-standing walls ----
  /**
   * Append walls (ids minted here). A wall with no `levelId` lands on the
   * active level; zero-length walls are dropped. Returns the ids added, in order.
   */
  addFreeWalls: (walls: Omit<FreeWall, 'id'>[]) => string[];
  removeFreeWall: (id: string) => void;
  /** Remove every free wall, or only those on one level. */
  clearFreeWalls: (levelId?: string) => void;
  /**
   * One-shot bridge from the mm `wallStore`. Adds the converted walls ONLY
   * when the property has none of its own, so it is safe to call on every app
   * mount and on every page apply. Returns true iff walls were added.
   */
  importLegacyWalls: (
    segments: Array<{
      start: { x_mm: number; y_mm: number };
      end: { x_mm: number; y_mm: number };
      thickness_mm?: number;
    }>,
  ) => boolean;

  // ---- outdoor room ----
  /**
   * The id of the level's outdoor room, creating it if the level has none.
   * Idempotent per level. Does NOT change focus — an outdoor drop routes
   * through `addItem(item, roomId)` and the pointer's room stays active.
   */
  ensureOutdoorRoom: (levelId?: string) => string;

  // ---- lighting ----
  setItemLight: (instanceId: string, on: boolean) => void;

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
          // A new room is drawn on the storey the user is looking at.
          ...levelStamp(activeLevelIdOf(get().property)),
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
              {
                id,
                name: name.trim() || nextRoomName(s.property.rooms),
                polygon,
                placedItems: [],
                ...levelStamp(activeLevelIdOf(s.property)),
              },
            ],
            activeRoomId: id,
          },
          selectedInstanceId: null,
        }));
        return id;
      },

      removeRoom: (roomId) =>
        set((s) => {
          if (!s.property.rooms.some((r) => r.id === roomId)) return s;
          const remaining = s.property.rooms.filter((r) => r.id !== roomId);
          const level = activeLevelIdOf(s.property);
          // Never let the storey in focus run out of real rooms — re-seed
          // BLANK so the canvas never shows a room the user did not draw. An
          // outdoor container does not count: it has no walls, so with only
          // that left the draw tool would have nowhere to put a polygon.
          const real = realRoomsOnLevel(remaining, level);
          if (real.length === 0) {
            const fresh = makeBlankRoom(undefined, level);
            return {
              property: { ...s.property, rooms: [...remaining, fresh], activeRoomId: fresh.id },
              selectedInstanceId: null,
            };
          }
          const activeRoomId =
            s.property.activeRoomId === roomId ? real[0].id : s.property.activeRoomId;
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
          // Focus follows the room onto its storey — a focused room on a
          // hidden level would be editable but invisible.
          return { property: focusRoom(s.property, roomId), selectedInstanceId: null };
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
                  // Floor tiles are polygon-coupled exactly as openings are:
                  // shrink a room and the tiles outside it are no longer real.
                  // Without this they persist invisibly AND stay in the quote.
                  ? {
                    ...r,
                    polygon: clean,
                    openings: pruneOpenings(r.openings, clean),
                    floorTiles: decodeFloorZones(r.floorTiles, clean),
                  }
                  : r,
              ),
            },
          };
        }),

      /**
       * Commit ONE floor-paint stroke (floor-painting brief).
       *
       * A whole stroke - a click, a drag rectangle, or a room fill - is one
       * call and therefore ONE undo frame, which is what The Sims does and
       * what anyone who has used a paint tool expects. Committing per tile
       * would make Ctrl+Z walk backwards one tile at a time.
       */
      paintFloorTiles: (roomId, zone, keys, erase = false) =>
        set((s) => {
          const room = s.property.rooms.find((r) => r.id === roomId);
          if (!room || keys.length === 0) return s;

          const existing = room.floorTiles ? room.floorTiles.map((z) => ({ ...z })) : [];
          // Lazy conversion: the first stroke in a room that already has a
          // whole-room finish seeds a zone covering the room in that same
          // material, so the user paints ON TOP of the floor they had
          // rather than watching it vanish.
          const seeded =
            existing.length === 0 && room.floorFinish
              ? seedZoneFromWholeRoom(room)
              : existing;

          const target = new Set(keys);
          const next: FloorZone[] = [];
          let placed = false;

          for (const z of seeded) {
            const tiles = runsToSet(z.runs);
            // A tile can only carry ONE material, so painting removes it
            // from every other zone before adding it to this one.
            for (const k of target) tiles.delete(k);
            if (
              !erase
              && z.materialId === zone.materialId
              && z.tileWm === zone.tileWm
              && z.tileHm === zone.tileHm
              && z.originM.x === zone.originM.x
              && z.originM.y === zone.originM.y
            ) {
              for (const k of target) tiles.add(k);
              placed = true;
            }
            const runs = setToRuns(tiles);
            if (runs.length > 0) next.push({ ...z, runs });
          }
          if (!erase && !placed) next.push({ ...zone, runs: setToRuns(target) });

          return {
            property: {
              ...s.property,
              rooms: s.property.rooms.map((r) =>
                r.id === roomId
                  ? {
                    ...r,
                    floorTiles: next.length > 0 ? next : undefined,
                    // Once a room is painted per tile the whole-room finish
                    // is no longer the truth about its floor. Cleared rather
                    // than left to shadow it in the price calculator.
                    floorFinish: null,
                  }
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
          // Surface slots — deleting a table also deletes what sits on it
          // (Sims build-mode behaviour: the surface carries its contents).
          const doomed = (i: PlacedItem) =>
            i.instanceId === instanceId || i.parentInstanceId === instanceId;
          return {
            property: {
              ...s.property,
              rooms: s.property.rooms.map((r) =>
                r.id === owner.id
                  ? { ...r, placedItems: r.placedItems.filter((i) => !doomed(i)) }
                  : r,
              ),
            },
            selectedInstanceId:
              s.selectedInstanceId &&
              owner.placedItems.some(
                (i) => i.instanceId === s.selectedInstanceId && doomed(i),
              )
                ? null
                : s.selectedInstanceId,
          };
        }),

      /**
       * Move an existing item into another room, PRESERVING its instanceId
       * (Sims drag-drop 2026-08-28, D-B15).
       *
       * A single set(), and deliberately not a remove-then-add: `addItem`
       * mints a fresh id, so that composition would silently orphan the
       * selection, any history reference and the cart line item that point
       * at the old id. Identity is the whole point of a MOVE.
       *
       * A no-op when the item is already in the target room, so a same-room
       * drag keeps using updateItem and costs no extra work.
       */
      moveItemToRoom: (instanceId, toRoomId, x, y, rotation) =>
        set((s) => {
          const owner = findRoomByInstanceId(s.property, instanceId);
          if (!owner || owner.id === toRoomId) return s;
          const target = s.property.rooms.find((r) => r.id === toRoomId);
          if (!target) return s;
          const moving = owner.placedItems.find((i) => i.instanceId === instanceId);
          if (!moving) return s;
          const moved: PlacedItem = {
            ...moving,
            x,
            y,
            rotation: rotation ?? moving.rotation,
          };
          return {
            property: {
              // The item follows the pointer into the room it was dropped in,
              // so focus follows it too - otherwise the Sims loop (place ->
              // rotate -> delete) is dead the moment it crosses a wall.
              ...focusRoom(s.property, toRoomId),
              rooms: s.property.rooms.map((r) => {
                if (r.id === owner.id) {
                  return {
                    ...r,
                    placedItems: r.placedItems.filter((i) => i.instanceId !== instanceId),
                  };
                }
                if (r.id === toRoomId) {
                  return { ...r, placedItems: [...r.placedItems, moved] };
                }
                return r;
              }),
            },
            selectedInstanceId: instanceId,
          };
        }),

      updateItem: (instanceId, patch) =>
        set((s) => {
          const owner = findRoomByInstanceId(s.property, instanceId);
          if (!owner) return s;
          // Surface slots — moving a table carries the items sitting on it
          // (Sims behaviour). Delta computed from the parent's old position.
          const target = owner.placedItems.find((i) => i.instanceId === instanceId);
          const dx = target && typeof patch.x === 'number' ? patch.x - target.x : 0;
          const dy = target && typeof patch.y === 'number' ? patch.y - target.y : 0;
          const shiftChildren = dx !== 0 || dy !== 0;
          return {
            property: {
              ...s.property,
              rooms: s.property.rooms.map((r) =>
                r.id === owner.id
                  ? {
                      ...r,
                      placedItems: r.placedItems.map((i) => {
                        if (i.instanceId === instanceId) return { ...i, ...patch };
                        if (shiftChildren && i.parentInstanceId === instanceId) {
                          return { ...i, x: i.x + dx, y: i.y + dy };
                        }
                        return i;
                      }),
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
            property: focusRoom(s.property, owner.id),
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

      // ---- levels (storeys) ----------------------------------------------

      addLevel: (name) => {
        const id = nanoid(8);
        set((s) => {
          // Materialise the ground floor the first time a second storey
          // appears; until then `levels` stays absent (pre-levels shape).
          const levels = levelsOf(s.property);
          const level: Level = {
            id,
            name: name?.trim() || nextLevelName(levels),
            index: nextLevelIndex(levels),
          };
          const room = makeBlankRoom(nextRoomName(s.property.rooms), id);
          return {
            property: {
              ...s.property,
              levels: sortLevels([...levels, level]),
              activeLevelId: id,
              rooms: [...s.property.rooms, room],
              activeRoomId: room.id,
            },
            selectedInstanceId: null,
          };
        });
        return id;
      },

      renameLevel: (id, name) =>
        set((s) => {
          const clean = name.trim();
          if (!clean) return s;
          const levels = levelsOf(s.property);
          if (!levels.some((l) => l.id === id)) return s;
          return {
            property: {
              ...s.property,
              levels: levels.map((l) => (l.id === id ? { ...l, name: clean } : l)),
            },
          };
        }),

      removeLevel: (id) => {
        const s = get();
        if (id === GROUND_LEVEL_ID) return false;
        const levels = levelsOf(s.property);
        if (!levels.some((l) => l.id === id)) return false;
        const rooms = s.property.rooms.filter((r) => roomLevelId(r) === id);
        const hasWork =
          rooms.some((r) => r.polygon.length >= 3 || r.placedItems.length > 0)
          || wallsOnLevel(s.property.walls ?? [], id).length > 0;
        if (hasWork) return false;

        set((st) => {
          const remainingRooms = st.property.rooms.filter((r) => roomLevelId(r) !== id);
          const remainingWalls = (st.property.walls ?? []).filter((w) => roomLevelId(w) !== id);
          const next: Property = {
            ...st.property,
            levels: levelsOf(st.property).filter((l) => l.id !== id),
            activeLevelId: GROUND_LEVEL_ID,
            rooms: remainingRooms,
          };
          // Canonical form: no walls means no `walls` field.
          if (remainingWalls.length > 0) next.walls = remainingWalls;
          else delete next.walls;
          return { property: focusFirstRoomOnLevel(next, GROUND_LEVEL_ID), selectedInstanceId: null };
        });
        return true;
      },

      setActiveLevel: (id) =>
        set((s) => {
          if (!levelsOf(s.property).some((l) => l.id === id)) return s;
          const next: Property = { ...s.property, activeLevelId: id };
          return { property: focusFirstRoomOnLevel(next, id), selectedInstanceId: null };
        }),

      // ---- site --------------------------------------------------------------

      setSite: (site) =>
        set((s) => {
          if (site === null) {
            if (s.property.site == null) return s;
            const next = { ...s.property };
            delete next.site;
            return { property: next };
          }
          const clean = normaliseSite(site);
          if (!clean) return s;
          return { property: { ...s.property, site: clean } };
        }),

      // ---- free walls --------------------------------------------------------

      addFreeWalls: (walls) => {
        const ids: string[] = [];
        set((s) => {
          const level = activeLevelIdOf(s.property);
          const added: FreeWall[] = [];
          for (const w of walls) {
            if (!(w.thicknessM > 0) || freeWallLengthM(w) < MIN_FREE_WALL_LENGTH_M) continue;
            const id = nanoid(10);
            ids.push(id);
            added.push({
              id,
              a: { x: w.a.x, y: w.a.y },
              b: { x: w.b.x, y: w.b.y },
              thicknessM: w.thicknessM,
              levelId: w.levelId || level,
            });
          }
          if (added.length === 0) return s;
          return { property: { ...s.property, walls: [...(s.property.walls ?? []), ...added] } };
        });
        return ids;
      },

      removeFreeWall: (id) =>
        set((s) => {
          const walls = s.property.walls ?? [];
          if (!walls.some((w) => w.id === id)) return s;
          return { property: { ...s.property, walls: walls.filter((w) => w.id !== id) } };
        }),

      clearFreeWalls: (levelId) =>
        set((s) => {
          const walls = s.property.walls ?? [];
          if (walls.length === 0) return s;
          const kept = levelId === undefined ? [] : walls.filter((w) => roomLevelId(w) !== levelId);
          if (kept.length === walls.length) return s;
          return { property: { ...s.property, walls: kept } };
        }),

      importLegacyWalls: (segments) => {
        if ((get().property.walls?.length ?? 0) > 0) return false;
        const converted = fromLegacyWallSegments(segments);
        if (converted.length === 0) return false;
        return get().addFreeWalls(converted).length > 0;
      },

      // ---- outdoor room ------------------------------------------------------

      ensureOutdoorRoom: (levelId) => {
        const level = levelId ?? activeLevelIdOf(get().property);
        const existing = get().property.rooms.find(
          (r) => isOutdoorRoom(r) && roomLevelId(r) === level,
        );
        if (existing) return existing.id;
        const room: Room = {
          id: nanoid(8),
          name: 'Outdoors',
          polygon: [],
          placedItems: [],
          kind: 'outdoor',
          ...levelStamp(level),
        };
        set((s) => ({ property: { ...s.property, rooms: [...s.property.rooms, room] } }));
        return room.id;
      },

      // ---- lighting ----------------------------------------------------------

      setItemLight: (instanceId, on) =>
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
                      i.instanceId === instanceId ? { ...i, lightOn: on } : i,
                    ),
                  }
                  : r,
              ),
            },
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
  // Levels first: rooms and walls are validated AGAINST the level set, so a
  // room stranded on a level that no longer exists drops to ground rather
  // than becoming invisible forever.
  const levels = normaliseLevels(property.levels);
  const levelIds = new Set((levels ?? [groundLevel()]).map((l) => l.id));
  const onKnownLevel = <T extends { levelId?: string }>(x: T): T => {
    if (x.levelId === undefined || levelIds.has(x.levelId)) return x;
    const rest = { ...x };
    delete rest.levelId;
    return rest;
  };

  const rooms: Room[] = (property.rooms ?? []).map((r) => onKnownLevel(normaliseLoadedRoom(r)));
  if (rooms.length === 0) {
    rooms.push(makeBlankRoom());
  }
  const activeRoomId =
    property.activeRoomId && rooms.some((r) => r.id === property.activeRoomId)
      ? property.activeRoomId
      : rooms[0].id;

  const out: Property = {
    id: property.id ?? nanoid(8),
    name: property.name ?? 'Wellness Property',
    activeRoomId,
    rooms,
  };
  // Every field below is OPTIONAL and only written when it carries something,
  // so a property saved before the Sims world round-trips byte-identical.
  if (levels) out.levels = levels;
  const activeRoom = rooms.find((r) => r.id === activeRoomId)!;
  const roomLevel = roomLevelId(activeRoom);
  const storedLevel =
    typeof property.activeLevelId === 'string' && levelIds.has(property.activeLevelId)
      ? property.activeLevelId
      : undefined;
  // The focused room wins a disagreement — it is the older, more-tested
  // field and the one every manipulation surface resolves through.
  const activeLevelId = storedLevel && storedLevel === roomLevel ? storedLevel : roomLevel;
  if (activeLevelId !== GROUND_LEVEL_ID) out.activeLevelId = activeLevelId;
  const walls = normaliseFreeWalls(property.walls).map(onKnownLevel);
  if (walls.length > 0) out.walls = walls;
  const site = normaliseSite(property.site);
  if (site) out.site = site;
  return out;
}

/**
 * Persisted levels → validated, de-duplicated, sorted, and always including
 * ground (rooms with no `levelId` live there, so it can never be missing).
 * Returns undefined for absent/empty so the field stays off single-storey
 * saves.
 */
export function normaliseLevels(levels: unknown): Level[] | undefined {
  if (!Array.isArray(levels) || levels.length === 0) return undefined;
  const seen = new Set<string>();
  const out: Level[] = [];
  for (const l of levels) {
    if (!isLevelLike(l) || seen.has(l.id)) continue;
    seen.add(l.id);
    out.push({ id: l.id, name: l.name.trim() || `Level ${l.index}`, index: l.index });
  }
  if (out.length === 0) return undefined;
  if (!seen.has(GROUND_LEVEL_ID)) out.push(groundLevel());
  return sortLevels(out);
}

/**
 * Persisted free walls → validated copies holding only the whitelisted
 * fields. Zero-length walls (structurally valid, geometrically nothing) are
 * dropped here; `levelId` is kept as stored and checked against the level
 * set by the caller.
 */
export function normaliseFreeWalls(walls: unknown): FreeWall[] {
  if (!Array.isArray(walls)) return [];
  const seen = new Set<string>();
  const out: FreeWall[] = [];
  for (const w of walls) {
    if (!isFreeWallLike(w) || seen.has(w.id)) continue;
    if (freeWallLengthM(w) < MIN_FREE_WALL_LENGTH_M) continue;
    seen.add(w.id);
    const clean: FreeWall = {
      id: w.id,
      a: { x: w.a.x, y: w.a.y },
      b: { x: w.b.x, y: w.b.y },
      thicknessM: w.thicknessM,
    };
    if (w.levelId) clean.levelId = w.levelId;
    out.push(clean);
  }
  return out;
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
  floorTiles?: FloorZone[];
  levelId?: unknown;
  kind?: unknown;
}

interface RawProperty {
  id?: string;
  name?: string;
  activeRoomId?: string;
  rooms?: RawRoom[];
  levels?: unknown;
  activeLevelId?: unknown;
  walls?: unknown;
  site?: unknown;
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
  // Same whitelist trap as every optional field below: leave these out and
  // a first-floor room silently falls to ground, and an outdoor container
  // turns into a wall-less "room", on the first save/load round trip.
  // Ground is canonicalised to ABSENT; an unknown `kind` is dropped.
  const levelId = canonicalLevelId(r.levelId);
  const kind = r.kind === 'outdoor' || r.kind === 'room' ? r.kind : undefined;
  return {
    id: r.id ?? nanoid(8),
    name: r.name ?? 'Room',
    polygon: clean,
    placedItems: Array.isArray(r.placedItems) ? r.placedItems : [],
    ...(levelId ? { levelId } : {}),
    ...(kind ? { kind } : {}),
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
    // Same whitelist trap again: omit this and a painted floor silently
    // vanishes on the first save/load round trip. Validated field by field
    // rather than passed through, because a malformed zone from a
    // hand-edited payload would otherwise reach the renderer AND the price
    // calculator. Pruned against the CLEANED polygon.
    floorTiles: decodeFloorZones(r.floorTiles, clean),
  };
}

/** Validate and prune persisted floor zones. Unknown shapes are dropped. */
export function decodeFloorZones(
  zones: FloorZone[] | undefined,
  polygon: Polygon,
): FloorZone[] | undefined {
  if (!Array.isArray(zones) || zones.length === 0) return undefined;
  const out: FloorZone[] = [];
  for (const z of zones) {
    if (!z || typeof z.materialId !== 'string') continue;
    if (typeof z.tileWm !== 'number' || typeof z.tileHm !== 'number') continue;
    if (!(z.tileWm > 0) || !(z.tileHm > 0)) continue;
    if (!z.originM || typeof z.originM.x !== 'number' || typeof z.originM.y !== 'number') {
      continue;
    }
    if (!Array.isArray(z.runs) || z.runs.length % 3 !== 0) continue;
    if (!z.runs.every((n) => Number.isFinite(n))) continue;
    const pruned = pruneZone(
      {
        materialId: z.materialId,
        tileWm: z.tileWm,
        tileHm: z.tileHm,
        originM: { x: z.originM.x, y: z.originM.y },
        runs: z.runs,
      },
      polygon,
    );
    if (pruned.runs.length > 0) out.push(pruned);
  }
  return out.length > 0 ? out : undefined;
}

/**
 * Seed a full-room zone from an existing whole-room finish.
 *
 * The first paint stroke in a room that already has a floor should ADD to
 * that floor, not replace it with a single tile. Returns [] when the
 * material has no tile size (a roll), so sheet goods never acquire a fake
 * tile count.
 */
function seedZoneFromWholeRoom(room: Room): FloorZone[] {
  const mat = room.floorFinish
    ? findFloorMaterialById(room.floorFinish.materialId)
    : undefined;
  if (!mat || mat.tile_w_m === null || mat.tile_h_m === null) return [];
  const zone = zoneForMaterial(mat.id, mat.tile_w_m, mat.tile_h_m, room.polygon);
  const keys = tilesCoveringPolygon(zone, room.polygon).map(
    (t) => String(t.row) + Q + String(t.col),
  );
  return [{ ...zone, runs: setToRuns(new Set(keys)) }];
}

/** Tile-key separator. Kept in one place so the codec cannot drift. */
const Q = ',';

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
// Re-exported so consumers of the store need not know which designer module
// owns the shape.
export type { Level, FreeWall };
