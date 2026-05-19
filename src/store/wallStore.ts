/**
 * Sims-Parity M2 — wallStore.
 *
 * Per `06-Roadmap/skills/ppw-gaming-walls.md` and
 * `protocol-03-walls.md`: per-segment wall data + a two-click polyline
 * draw FSM. Coordinates are stored in millimetres; everything else in
 * the designer is metres or pixels so the rendering layers convert at
 * the edge.
 *
 * Distinct from `RoomDrawMode` (closed-polygon room editor). RoomDraw
 * commits one *whole polygon* per gesture; walls commit *one segment*
 * per click and chain endpoint-to-anchor. The two tools share the same
 * Stage but never wire at the same time (mode strip is exclusive).
 *
 * Persisted to localStorage (`ppw_walls_v1`) so a refresh keeps the
 * sketch. Storage size is bounded by humans clicking — at 100 walls
 * × ~200 bytes per segment the payload stays under 25 kB.
 */

import { create } from 'zustand';

export const WALLS_LS_KEY = 'ppw_walls_v1';
export const WALL_SNAP_MM = 500; // 50 cm grid per V-GAME-3
export const DEFAULT_THICKNESS_MM = 100;
export const DEFAULT_HEIGHT_MM = 2700;
export const ENDPOINT_TOLERANCE_MM = WALL_SNAP_MM / 2;

export type WallType = 'full' | 'half-short' | 'half-medium' | 'half-tall' | 'fence';

export interface WallSegment {
  id: string;
  start: { x_mm: number; y_mm: number };
  end: { x_mm: number; y_mm: number };
  thickness_mm: number;
  height_mm: number;
  type: WallType;
}

export type WallDrawState =
  | { phase: 'idle' }
  | { phase: 'armed' }
  | { phase: 'drawing'; anchor: { x_mm: number; y_mm: number } };

export interface WallStore {
  walls: WallSegment[];
  draw: WallDrawState;
  addWall: (segment: Omit<WallSegment, 'id'> & { id?: string }) => string;
  removeWall: (id: string) => void;
  undoLast: () => void;
  clearWalls: () => void;
  setDraw: (next: WallDrawState) => void;
  /** Force-hydrate from a snapshot (used by tests + ?fresh=1 reset). */
  replace: (next: WallSegment[]) => void;
}

export function snapMm(value: number, step: number = WALL_SNAP_MM): number {
  return Math.round(value / step) * step;
}

function readLs(): WallSegment[] {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(WALLS_LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isWallSegment);
  } catch {
    return [];
  }
}

function writeLs(walls: WallSegment[]): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(WALLS_LS_KEY, JSON.stringify(walls));
  } catch {
    // ignore quota errors — the tool degrades to in-memory state.
  }
}

function isWallSegment(x: unknown): x is WallSegment {
  if (!x || typeof x !== 'object') return false;
  const w = x as Record<string, unknown>;
  return (
    typeof w.id === 'string' &&
    typeof w.start === 'object' && w.start !== null &&
    typeof w.end === 'object' && w.end !== null &&
    typeof (w.start as Record<string, unknown>).x_mm === 'number' &&
    typeof (w.start as Record<string, unknown>).y_mm === 'number' &&
    typeof (w.end as Record<string, unknown>).x_mm === 'number' &&
    typeof (w.end as Record<string, unknown>).y_mm === 'number' &&
    typeof w.thickness_mm === 'number' &&
    typeof w.height_mm === 'number' &&
    typeof w.type === 'string'
  );
}

function newWallId(): string {
  return `wall_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

const INITIAL_WALLS = readLs();

export const useWallStore = create<WallStore>((set) => ({
  walls: INITIAL_WALLS,
  draw: { phase: 'idle' },
  addWall: (input) => {
    const segment: WallSegment = {
      id: input.id ?? newWallId(),
      start: input.start,
      end: input.end,
      thickness_mm: input.thickness_mm,
      height_mm: input.height_mm,
      type: input.type,
    };
    set((s) => {
      const next = [...s.walls, segment];
      writeLs(next);
      return { walls: next };
    });
    return segment.id;
  },
  removeWall: (id) => {
    set((s) => {
      const next = s.walls.filter((w) => w.id !== id);
      writeLs(next);
      return { walls: next };
    });
  },
  undoLast: () => {
    set((s) => {
      if (s.walls.length === 0) return s;
      const next = s.walls.slice(0, -1);
      writeLs(next);
      return { walls: next };
    });
  },
  clearWalls: () => {
    writeLs([]);
    set({ walls: [], draw: { phase: 'idle' } });
  },
  setDraw: (next) => set({ draw: next }),
  replace: (next) => {
    writeLs(next);
    set({ walls: next });
  },
}));

/**
 * Snap an input point to an existing wall endpoint when within the
 * 50% snap tolerance — enables clean polygon closure. Falls back to
 * pure grid-snap otherwise.
 */
export function snapToWallEndpointOrGrid(
  point: { x_mm: number; y_mm: number },
  walls: WallSegment[],
): { x_mm: number; y_mm: number; snappedTo?: 'endpoint' } {
  const gx = snapMm(point.x_mm);
  const gy = snapMm(point.y_mm);
  for (const w of walls) {
    for (const ep of [w.start, w.end]) {
      const dx = ep.x_mm - point.x_mm;
      const dy = ep.y_mm - point.y_mm;
      if (Math.hypot(dx, dy) <= ENDPOINT_TOLERANCE_MM) {
        return { x_mm: ep.x_mm, y_mm: ep.y_mm, snappedTo: 'endpoint' };
      }
    }
  }
  return { x_mm: gx, y_mm: gy };
}

/**
 * Cycle-detect: walk the wall graph (endpoints are nodes) and return
 * the largest simple cycle's vertices, or null if no cycle yet exists.
 * Used by the HUD to display room area as soon as a polygon closes.
 *
 * Simplifying assumption: walls are stored with grid-snapped endpoints,
 * so endpoint equality reduces to numeric equality (no fuzz needed).
 */
export function detectClosedRoomVertices(
  walls: WallSegment[],
): Array<{ x_mm: number; y_mm: number }> | null {
  if (walls.length < 3) return null;
  const key = (p: { x_mm: number; y_mm: number }) => `${p.x_mm},${p.y_mm}`;
  const adj = new Map<string, Array<{ key: string; point: { x_mm: number; y_mm: number }; wallId: string }>>();
  const nodePoints = new Map<string, { x_mm: number; y_mm: number }>();
  for (const w of walls) {
    const ka = key(w.start);
    const kb = key(w.end);
    nodePoints.set(ka, w.start);
    nodePoints.set(kb, w.end);
    if (!adj.has(ka)) adj.set(ka, []);
    if (!adj.has(kb)) adj.set(kb, []);
    adj.get(ka)!.push({ key: kb, point: w.end, wallId: w.id });
    adj.get(kb)!.push({ key: ka, point: w.start, wallId: w.id });
  }
  // DFS from each node, looking for back-edges that close a cycle of >= 3 nodes.
  let bestPath: string[] = [];
  for (const startKey of adj.keys()) {
    const stack: Array<{ node: string; path: string[]; usedWalls: Set<string> }> = [
      { node: startKey, path: [startKey], usedWalls: new Set() },
    ];
    while (stack.length) {
      const { node, path, usedWalls } = stack.pop()!;
      for (const next of adj.get(node) ?? []) {
        if (usedWalls.has(next.wallId)) continue;
        if (next.key === startKey && path.length >= 3) {
          if (path.length > bestPath.length) bestPath = path.slice();
          continue;
        }
        if (path.includes(next.key)) continue;
        stack.push({
          node: next.key,
          path: [...path, next.key],
          usedWalls: new Set([...usedWalls, next.wallId]),
        });
      }
    }
    if (bestPath.length > 0) break;
  }
  if (bestPath.length === 0) return null;
  return bestPath.map((k) => nodePoints.get(k)!);
}

/**
 * Shoelace area in m². Returns 0 if the polygon is degenerate.
 */
export function polygonAreaM2(vertices: Array<{ x_mm: number; y_mm: number }>): number {
  if (vertices.length < 3) return 0;
  let twoA = 0;
  for (let i = 0; i < vertices.length; i++) {
    const a = vertices[i];
    const b = vertices[(i + 1) % vertices.length];
    twoA += a.x_mm * b.y_mm - b.x_mm * a.y_mm;
  }
  return Math.abs(twoA) / 2 / 1_000_000;
}
