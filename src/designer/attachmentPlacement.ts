/**
 * Surface slots + wall-mounted items (2026-08-24) — the second half of
 * the Sims placement contract:
 *
 *   • `placement: 'wall'` products (shelves, mirrors) can ONLY live on a
 *     wall: the ghost snaps to the nearest wall within range, flush,
 *     auto-rotated back-to-wall. They ignore floor collision (they hang
 *     above it) and collide only with other wall items.
 *   • `placement: 'surface'` products (diffusers, small plants) can ONLY
 *     sit on a placed item whose product has `is_surface: true` (tables,
 *     consoles). They clamp fully inside the surface's footprint on a
 *     fine 0.1 m sub-grid and collide only with siblings on the SAME
 *     surface. They move with their parent (propertyStore shifts
 *     children on parent x/y updates) and are removed with it.
 *   • Everything else is `'floor'` — the existing wall-aware path.
 *
 * Pure functions; consumed by RoomCanvas + placementActions and tested
 * in __tests__/attachmentPlacement.test.ts.
 */

import { rotatedFootprint } from '../lib/geometry';
import type { FootprintM, Polygon, Vertex } from '../lib/geometry';
import type { Product } from '../data/products.schema';
import { autoOrientDeg, nearestEdge } from './wallAwarePlacement';
import type { FrontEdge } from './wallAwarePlacement';

export type PlacementKind = 'floor' | 'surface' | 'wall';

/** Which placement rules a product follows (absent metadata → floor). */
export function placementKind(p: Pick<Product, 'placement'> | undefined): PlacementKind {
  return p?.placement ?? 'floor';
}

/** Max cursor distance from a wall for a wall item's ghost to engage. */
export const WALL_ITEM_RANGE_M = 1.5;

/** Fine sub-grid for items on a surface (a 0.5 m tile is bigger than most tabletops). */
export const SURFACE_SUB_GRID_M = 0.1;

export interface WallItemResult {
  ok: boolean;
  x: number;
  y: number;
  rotationDeg: number;
}

/**
 * Snap a wall-mounted item to the nearest axis-aligned wall: flush on
 * the wall axis, grid-snapped along it, back to the wall / face into
 * the room. `ok:false` when no wall is in range (slanted walls too —
 * the AABB model can't hang on them).
 */
export function resolveWallItemPlacement(input: {
  centreXm: number;
  centreYm: number;
  fp: FootprintM;
  polygon: Polygon;
  snapStep: number;
  frontEdge?: FrontEdge;
}): WallItemResult {
  const { fp, polygon, snapStep, frontEdge } = input;
  const centre: Vertex = { x: input.centreXm, y: input.centreYm };
  const edge = nearestEdge(polygon, centre);
  if (!edge || edge.alignment === 'slanted' || edge.distance > WALL_ITEM_RANGE_M) {
    return { ok: false, x: centre.x, y: centre.y, rotationDeg: 0 };
  }
  const rotationDeg = autoOrientDeg(edge.inwardNormal, frontEdge);
  const { w, h } = rotatedFootprint(fp, rotationDeg);
  const snap = (v: number) => Math.round(v / snapStep) * snapStep;
  const n = edge.inwardNormal;
  if (edge.alignment === 'horizontal') {
    const wallY = edge.a.y;
    return {
      ok: true,
      x: snap(centre.x - w / 2),
      y: n.y > 0 ? wallY : wallY - h,
      rotationDeg,
    };
  }
  const wallX = edge.a.x;
  return {
    ok: true,
    x: n.x > 0 ? wallX : wallX - w,
    y: snap(centre.y - h / 2),
    rotationDeg,
  };
}

export interface SurfaceRect {
  instanceId: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The surface (if any) whose footprint contains the given point. */
export function findSurfaceUnder(point: Vertex, surfaces: SurfaceRect[]): SurfaceRect | null {
  // Last match wins — later items render on top, so they catch the drop.
  let hit: SurfaceRect | null = null;
  for (const s of surfaces) {
    if (point.x >= s.x && point.x <= s.x + s.w && point.y >= s.y && point.y <= s.y + s.h) {
      hit = s;
    }
  }
  return hit;
}

export interface SurfaceItemResult {
  ok: boolean;
  x: number;
  y: number;
  parentInstanceId: string;
}

/**
 * Seat a surface item on a table: clamp its footprint fully inside the
 * surface rect, snapped to a 0.1 m sub-grid relative to the surface's
 * own origin (so items line up on the table, not the room grid).
 * `ok:false` when the item is bigger than the surface.
 */
export function resolveSurfaceItemPlacement(input: {
  centreXm: number;
  centreYm: number;
  fp: FootprintM;
  rotationDeg: number;
  surface: SurfaceRect;
}): SurfaceItemResult {
  const { fp, rotationDeg, surface } = input;
  const { w, h } = rotatedFootprint(fp, rotationDeg);
  if (w > surface.w + 1e-9 || h > surface.h + 1e-9) {
    return { ok: false, x: surface.x, y: surface.y, parentInstanceId: surface.instanceId };
  }
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  const g = SURFACE_SUB_GRID_M;
  const relX = Math.round((input.centreXm - w / 2 - surface.x) / g) * g;
  const relY = Math.round((input.centreYm - h / 2 - surface.y) / g) * g;
  return {
    ok: true,
    x: surface.x + clamp(relX, 0, surface.w - w),
    y: surface.y + clamp(relY, 0, surface.h - h),
    parentInstanceId: surface.instanceId,
  };
}
