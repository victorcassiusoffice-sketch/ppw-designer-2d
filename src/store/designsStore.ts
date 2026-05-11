/**
 * designsStore - Week 2.5 v2: named saved Properties (multi-room).
 *
 * Before Week 2.5 this stored named SavedDesign rows (a single room
 * with a rectangle + placedItems). The schema bumps to v2: each row
 * now holds a full Property (id, name, rooms[]). Legacy v1 rows are
 * migrated on load (each becomes a 1-room Property whose room polygon
 * is the rectangle).
 *
 * The special `__draft__` slot remains the live auto-save, written on
 * every Property mutation via `useAutoSave`.
 *
 * localStorage key: `ppw_properties_v2`. v1 was `ppw_designs_v1`.
 *
 * Back-compat: legacy `saveAs(name, snapshot)` + read of `roomDimensions`/
 * `placedItems` from a SavedDesign still works (we synthesise a single-
 * room property under the hood).
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { nanoid } from 'nanoid';
import type { RoomDims } from '../lib/geometry';
import { rectToPolygon } from '../lib/geometry';
import { normaliseLoadedProperty, type Property, type PlacedItem } from './propertyStore';

export interface SavedDesign {
  id: string;
  name: string;
  savedAt: string;
  /** v2 payload - the whole Property (multi-room). */
  property: Property;
  /** v1 mirror - derived from `property.rooms[0]`. */
  roomDimensions: RoomDims;
  placedItems: PlacedItem[];
}

export const DRAFT_ID = '__draft__';

interface DesignsState {
  designs: Record<string, SavedDesign>;
  currentId: string | null;

  savePropertyAs: (name: string, property: Property) => string;
  savePropertyDraft: (property: Property) => void;

  saveAs: (name: string, snapshot: { roomDimensions: RoomDims; placedItems: PlacedItem[] }) => string;
  saveDraft: (snapshot: { roomDimensions: RoomDims; placedItems: PlacedItem[] }) => void;

  remove: (id: string) => void;
  rename: (id: string, name: string) => void;
  setCurrent: (id: string | null) => void;
  list: () => SavedDesign[];
  getDraft: () => SavedDesign | undefined;
}

function makeId(): string {
  return nanoid(10);
}

function snapshotToProperty(
  name: string,
  snapshot: { roomDimensions: RoomDims; placedItems: PlacedItem[] },
): Property {
  const roomId = nanoid(8);
  return {
    id: nanoid(8),
    name,
    activeRoomId: roomId,
    rooms: [
      {
        id: roomId,
        name: 'Main Room',
        polygon: rectToPolygon(snapshot.roomDimensions),
        placedItems: snapshot.placedItems,
      },
    ],
  };
}

function projectToV1(property: Property): { roomDimensions: RoomDims; placedItems: PlacedItem[] } {
  const room0 = property.rooms[0];
  if (!room0) {
    return { roomDimensions: { lengthM: 5, widthM: 4 }, placedItems: [] };
  }
  const xs = room0.polygon.map((v) => v.x);
  const ys = room0.polygon.map((v) => v.y);
  const lengthM = Math.max(...xs) - Math.min(...xs);
  const widthM = Math.max(...ys) - Math.min(...ys);
  return {
    roomDimensions: { lengthM, widthM },
    placedItems: room0.placedItems,
  };
}

function makeSavedDesign(name: string, property: Property): SavedDesign {
  return {
    id: makeId(),
    name,
    savedAt: new Date().toISOString(),
    property,
    ...projectToV1(property),
  };
}

interface OldSavedDesign {
  id?: string;
  name?: string;
  savedAt?: string;
  roomDimensions?: RoomDims;
  placedItems?: PlacedItem[];
  property?: Property;
}

export const useDesignsStore = create<DesignsState>()(
  persist(
    (set, get) => ({
      designs: {},
      currentId: null,

      savePropertyAs: (name, property) => {
        const saved = makeSavedDesign(name, normaliseLoadedProperty(property));
        set((s) => ({
          designs: { ...s.designs, [saved.id]: saved },
          currentId: saved.id,
        }));
        return saved.id;
      },

      savePropertyDraft: (property) => {
        const proj = projectToV1(property);
        const draft: SavedDesign = {
          id: DRAFT_ID,
          name: '(unsaved draft)',
          savedAt: new Date().toISOString(),
          property,
          ...proj,
        };
        set((s) => ({ designs: { ...s.designs, [DRAFT_ID]: draft } }));
      },

      saveAs: (name, snapshot) => {
        const property = snapshotToProperty(name, snapshot);
        return get().savePropertyAs(name, property);
      },
      saveDraft: (snapshot) => {
        const property = snapshotToProperty('(unsaved draft)', snapshot);
        get().savePropertyDraft(property);
      },

      remove: (id) =>
        set((s) => {
          const next = { ...s.designs };
          delete next[id];
          return {
            designs: next,
            currentId: s.currentId === id ? null : s.currentId,
          };
        }),

      rename: (id, name) =>
        set((s) => {
          const d = s.designs[id];
          if (!d) return s;
          return { designs: { ...s.designs, [id]: { ...d, name, property: { ...d.property, name } } } };
        }),

      setCurrent: (id) => set(() => ({ currentId: id })),

      list: () =>
        Object.values(get().designs)
          .filter((d) => d.id !== DRAFT_ID)
          .sort((a, b) => (a.savedAt < b.savedAt ? 1 : -1)),

      getDraft: () => get().designs[DRAFT_ID],
    }),
    {
      name: 'ppw_properties_v2',
      storage: createJSONStorage(() => localStorage),
      version: 2,
      partialize: (state) => ({ designs: state.designs, currentId: state.currentId }),
      migrate: (persisted, version): unknown => {
        if (version >= 2 && persisted) return persisted;
        try {
          if (!persisted || typeof persisted !== 'object') return persisted;
          const p = persisted as { designs?: Record<string, OldSavedDesign>; currentId?: string | null };
          if (!p.designs) return persisted;
          const migratedDesigns: Record<string, SavedDesign> = {};
          for (const [id, oldD] of Object.entries(p.designs)) {
            if (!oldD) continue;
            const name = oldD.name ?? 'Untitled';
            const property =
              oldD.property ??
              snapshotToProperty(name, {
                roomDimensions: oldD.roomDimensions ?? { lengthM: 5, widthM: 4 },
                placedItems: oldD.placedItems ?? [],
              });
            migratedDesigns[id] = {
              id,
              name,
              savedAt: oldD.savedAt ?? new Date().toISOString(),
              property: normaliseLoadedProperty(property),
              ...projectToV1(property),
            };
          }
          return { designs: migratedDesigns, currentId: p.currentId ?? null };
        } catch {
          return persisted;
        }
      },
    },
  ),
);
