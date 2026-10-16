/** Transient authoring controller shared by plan and 3D pointer adapters. */
import { create } from 'zustand';
import type { Vertex } from '../lib/geometry';
import { polygonBounds } from '../lib/geometry';
import { sampleMeasuredPath, type MeasuredPath, type MeasuredPathSegment } from '../designer/measuredPath';
import { activeLevelIdOf, GROUND_LEVEL_ID } from '../designer/levels';
import type { GardenSurfaceKind } from '../designer/garden';
import { usePropertyStore } from './propertyStore';
import { useDesignerUIStore } from './designerUIStore';

export type MeasuredPathTarget = 'wall' | 'roof' | 'garden';
export interface MeasuredPathToolState {
  target: MeasuredPathTarget | null;
  propertyId: string | null;
  levelId: string | null;
  start: Vertex | null;
  segments: MeasuredPathSegment[];
  pendingEnd: Vertex | null;
  hover: Vertex | null;
  segmentKind: 'line' | 'quadratic';
  surfaceKind: GardenSurfaceKind;
  thicknessM: number;
  error: string | null;
  startTool: (target: MeasuredPathTarget, propertyId: string, levelId: string, options?: { segmentKind?: 'line' | 'quadratic'; surfaceKind?: GardenSurfaceKind }) => void;
  setSegmentKind: (kind: 'line' | 'quadratic') => void;
  setHover: (point: Vertex | null) => void;
  tap: (point: Vertex) => boolean;
  back: () => void;
  cancel: () => void;
  finish: () => boolean;
}
const empty = { target: null, propertyId: null, levelId: null, start: null, segments: [], pendingEnd: null, hover: null, error: null } as const;
const finite = (point: Vertex) => Number.isFinite(point.x) && Number.isFinite(point.y);
function segmentFromBend(from: Vertex, to: Vertex, bend: Vertex): MeasuredPathSegment {
  // A third tap lies ON the curve at t=.5, not on an invisible control handle.
  return { kind: 'quadratic', to: { ...to }, control: { x: 2 * bend.x - (from.x + to.x) / 2, y: 2 * bend.y - (from.y + to.y) / 2 } };
}
function pathFor(state: Pick<MeasuredPathToolState, 'start' | 'segments'>, closed = false): MeasuredPath | null {
  return state.start && state.segments.length ? { start: state.start, segments: state.segments, ...(closed ? { closed: true } : {}) } : null;
}

export function measuredToolPreview(state: MeasuredPathToolState) {
  if (!state.start) return null;
  const from = state.segments[state.segments.length - 1]?.to ?? state.start;
  const next = state.pendingEnd && state.hover ? segmentFromBend(from, state.pendingEnd, state.hover)
    : state.hover && Math.hypot(state.hover.x - from.x, state.hover.y - from.y) > 1e-7 ? { kind: 'line' as const, to: state.hover } : null;
  const path = pathFor({ start: state.start, segments: [...state.segments, ...(next ? [next] : [])] });
  return path ? sampleMeasuredPath(path) : null;
}

export const useMeasuredPathToolStore = create<MeasuredPathToolState>()((set, get) => ({
  ...empty, segments: [], segmentKind: 'quadratic', surfaceKind: 'lawn', thicknessM: .12,
  startTool: (target, propertyId, levelId, options) => {
    const store = usePropertyStore.getState();
    if (propertyId !== store.property.id) return;
    if (target === 'roof') levelId = store.ensureRoofLevel();
    if (target === 'garden') { store.setActiveLevel(GROUND_LEVEL_ID); levelId = GROUND_LEVEL_ID; }
    set({ ...empty, segments: [], target, propertyId, levelId, segmentKind: options?.segmentKind ?? (target === 'wall' ? 'quadratic' : 'line'), surfaceKind: options?.surfaceKind ?? 'lawn' });
  },
  setSegmentKind: segmentKind => set({ segmentKind, pendingEnd: null, hover: null, error: null }),
  setHover: hover => set({ hover: hover && finite(hover) ? hover : null }),
  cancel: () => set({ ...empty, segments: [] }),
  back: () => {
    const s = get();
    if (s.pendingEnd) set({ pendingEnd: null, error: null });
    else if (s.segments.length) set({ segments: s.segments.slice(0, -1), error: null });
    else set({ start: null, hover: null, error: null });
  },
  tap: point => {
    const s = get(), property = usePropertyStore.getState().property;
    if (!s.target || !finite(point)) return false;
    if (s.propertyId !== property.id || s.levelId !== activeLevelIdOf(property)) { get().cancel(); return false; }
    if (!s.start) { set({ start: { ...point }, error: null }); return true; }
    const from = s.segments[s.segments.length - 1]?.to ?? s.start;
    if (!s.pendingEnd && Math.hypot(point.x - from.x, point.y - from.y) < .05) { set({ error: 'Choose an end at least 5 cm away.' }); return true; }
    if (s.segmentKind === 'quadratic' && !s.pendingEnd) { set({ pendingEnd: { ...point }, hover: null, error: null }); return true; }
    const segment = s.pendingEnd ? segmentFromBend(from, s.pendingEnd, point) : { kind: 'line' as const, to: { ...point } };
    const segments = [...s.segments, segment], path = { start: s.start, segments };
    if (!sampleMeasuredPath(path)) { set({ error: 'This path crosses itself or is too complex. Move the bend or undo the last point.' }); return true; }
    if (s.target === 'wall') {
      const ids = usePropertyStore.getState().addWallPath(path, s.levelId ?? undefined, s.thicknessM, useDesignerUIStore.getState().wallPaintDraft);
      if (!ids.length) { set({ error: 'Wall could not be placed. Keep the curve within the plot and use a building floor.' }); return true; }
      set({ start: segment.to, segments: [], pendingEnd: null, hover: null, error: null });
    } else set({ segments, pendingEnd: null, hover: null, error: null });
    return true;
  },
  finish: () => {
    const s = get(), store = usePropertyStore.getState();
    if (s.target === 'wall') { get().cancel(); return true; }
    if (!s.target || s.propertyId !== store.property.id || s.levelId !== activeLevelIdOf(store.property)) { get().cancel(); return false; }
    if (s.pendingEnd) { set({ error: 'Place the bend first, or undo this unfinished curve.' }); return false; }
    const path = pathFor(s, true), sample = path && sampleMeasuredPath(path);
    if (!path || !sample) { set({ error: 'Draw a simple outline with at least three points. Edges must not cross.' }); return false; }
    if (s.target === 'roof') {
      if (!store.setRoofOutline(path)) { set({ error: 'Keep all roof objects inside the outline. Separate existing roof finishes cannot be combined; remove those finishes or use Undo.' }); return false; }
    } else {
      const bounds = polygonBounds(sample.vertices);
      if (!store.addGardenSurface({ kind: s.surfaceKind, x: bounds.minX, y: bounds.minY, widthM: bounds.maxX - bounds.minX, depthM: bounds.maxY - bounds.minY, outline: sample.vertices, elevationM: 0 })) {
        set({ error: 'This outdoor outline is invalid. Pools require a rectangular footprint.' }); return false;
      }
    }
    get().cancel(); return true;
  },
}));
