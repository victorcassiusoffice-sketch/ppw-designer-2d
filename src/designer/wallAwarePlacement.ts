/**
 * Sims-style wall-aware placement (2026-08-23).
 *
 * The Sims build-mode placement contract this module reproduces:
 *   1. Objects have a FRONT. Dropped near a wall, an object auto-rotates
 *      so its back is against that wall and its front faces INTO the room.
 *   2. Wall-adjacent objects sit FLUSH against the wall (no half-tile gap)
 *      while still grid-snapping ALONG the wall.
 *   3. Dropped mid-room, an object keeps its default facing (toward the
 *      viewer — image-bottom) or whatever the user manually rotated to.
 *
 * Convention: at rotation 0 the top-down product image FACES the bottom
 * of the image (+Y, toward the viewer). Its BACK is the top edge. A
 * product can override with `front_edge` in the catalog when its art
 * breaks the convention. Konva rotation is clockwise in screen space
 * (y-down), so rotating the front vector (0,1) by θ gives (−sinθ, cosθ).
 *
 * Pure functions only — consumed by RoomCanvas (ghost preview, commit,
 * drag-end) and unit-tested in __tests__/wallAwarePlacement.test.ts.
 */

import { pointInPolygon, rotatedFootprint, snapToGrid } from '../lib/geometry';
import type { FootprintM, Polygon, Vertex } from '../lib/geometry';

export type FrontEdge = 'top' | 'bottom' | 'left' | 'right';

/**
 * Max gap (metres) between an object's back edge and a wall for the
 * wall-snap + auto-orient to engage. Just under one 0.5 m tile, so a
 * drop "roughly by the wall" catches, but a drop a full tile away
 * stays free-standing.
 */
export const WALL_SNAP_GAP_M = 0.45;

/** Angle (deg) of the front vector at rotation 0 for each front_edge. */
const FRONT_EDGE_ANGLE: Record<FrontEdge, number> = {
  bottom: 0, // (0, 1)
  left: 90, // (−1, 0) — rotate (0,1) by 90° CW (screen coords)
  top: 180, // (0, −1)
  right: 270, // (1, 0)
};

export interface NearestEdge {
  a: Vertex;
  b: Vertex;
  /** Distance from the query point to the closest point on the edge (m). */
  distance: number;
  /** Unit normal on the ROOM side of the edge. */
  inwardNormal: Vertex;
  /** Axis alignment — flush-positioning only supports axis-aligned walls. */
  alignment: 'horizontal' | 'vertical' | 'slanted';
}

function mod360(d: number): number {
  return ((d % 360) + 360) % 360;
}

/**
 * True for 0/90/180/270 rotations. A free-rotated item (Shift on the
 * rotate handle) is a deliberate user choice — auto-orientation never
 * stomps it.
 */
export function isCardinalRotation(deg: number): boolean {
  return mod360(deg) % 90 === 0;
}

/** Nearest polygon edge to a point, with its room-side normal. */
export function nearestEdge(polygon: Polygon, p: Vertex): NearestEdge | null {
  if (polygon.length < 3) return null;
  let best: NearestEdge | null = null;
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lenSq = dx * dx + dy * dy;
    if (lenSq < 1e-12) continue;
    let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    const cx = a.x + t * dx;
    const cy = a.y + t * dy;
    const dist = Math.hypot(p.x - cx, p.y - cy);
    if (best && dist >= best.distance) continue;
    const len = Math.sqrt(lenSq);
    // Candidate normal; flip to whichever side is inside the room.
    let nx = -dy / len;
    let ny = dx / len;
    const midX = (a.x + b.x) / 2;
    const midY = (a.y + b.y) / 2;
    const probe = { x: midX + nx * 0.01, y: midY + ny * 0.01 };
    if (!pointInPolygon(probe, polygon)) {
      nx = -nx;
      ny = -ny;
    }
    const alignment: NearestEdge['alignment'] =
      Math.abs(dy) < 1e-9 ? 'horizontal' : Math.abs(dx) < 1e-9 ? 'vertical' : 'slanted';
    best = { a, b, distance: dist, inwardNormal: { x: nx, y: ny }, alignment };
  }
  return best;
}

/**
 * Rotation (deg, 90°-snapped) that points the object's front along the
 * given inward normal — i.e. back to the wall, front into the room.
 */
export function autoOrientDeg(inwardNormal: Vertex, frontEdge: FrontEdge = 'bottom'): number {
  // θ such that R(θ)·(0,1) = n, with R clockwise in y-down screen space:
  // (−sinθ, cosθ) = (nx, ny) → θ = atan2(−nx, ny).
  const raw = (Math.atan2(-inwardNormal.x, inwardNormal.y) * 180) / Math.PI;
  const snapped = Math.round(raw / 90) * 90;
  return mod360(snapped - FRONT_EDGE_ANGLE[frontEdge]);
}

export interface WallAwareInput {
  /** Desired object CENTRE in room metres (cursor / drop point). */
  centreXm: number;
  centreYm: number;
  /** Unrotated product footprint. */
  fp: FootprintM;
  polygon: Polygon;
  /** Grid step in metres (0.5 or 0.25). */
  snapStep: number;
  /**
   * A rotation the user chose explicitly (armed-ghost R key, or an
   * existing item's rotation with Shift held on drag). null/undefined →
   * auto-orient is allowed.
   */
  userRotationDeg?: number | null;
  frontEdge?: FrontEdge;
}

export interface WallAwareResult {
  /** AABB top-left in room metres, grid-snapped (flush on the wall axis). */
  x: number;
  y: number;
  rotationDeg: number;
  /** True when the object was pulled flush against a wall. */
  wallSnapped: boolean;
}

/**
 * The single placement resolver: grid-snap + wall-snap + auto-orient.
 * Callers still run validatePlacement / findFreeSlot on the result.
 */
export function resolveWallAwarePlacement(input: WallAwareInput): WallAwareResult {
  const { fp, polygon, snapStep, frontEdge } = input;
  const userRot = input.userRotationDeg ?? null;
  const centre = { x: input.centreXm, y: input.centreYm };

  const plain = (rotationDeg: number): WallAwareResult => {
    const { w, h } = rotatedFootprint(fp, rotationDeg);
    return {
      x: snapToGrid(centre.x - w / 2, snapStep),
      y: snapToGrid(centre.y - h / 2, snapStep),
      rotationDeg,
      wallSnapped: false,
    };
  };

  const edge = nearestEdge(polygon, centre);
  if (!edge) return plain(userRot ?? 0);

  // Tentative rotation: the user's explicit choice wins; otherwise face
  // away from the nearest wall.
  const rotation = userRot ?? autoOrientDeg(edge.inwardNormal, frontEdge);
  const { w, h } = rotatedFootprint(fp, rotation);

  // Extent of the footprint along the wall normal, to measure the gap
  // between the object's back edge and the wall.
  const normalExtent =
    edge.alignment === 'horizontal' ? h : edge.alignment === 'vertical' ? w : Math.min(w, h);
  const backGap = edge.distance - normalExtent / 2;
  if (backGap > WALL_SNAP_GAP_M || edge.alignment === 'slanted') {
    // Free-standing (or a slanted wall the AABB can't sit flush on):
    // mid-room default facing is "toward the viewer" (rotation 0).
    return plain(userRot ?? 0);
  }

  // Flush the wall axis; grid-snap along the wall.
  const n = edge.inwardNormal;
  if (edge.alignment === 'horizontal') {
    const wallY = edge.a.y;
    const y = n.y > 0 ? wallY : wallY - h;
    return { x: snapToGrid(centre.x - w / 2, snapStep), y, rotationDeg: rotation, wallSnapped: true };
  }
  const wallX = edge.a.x;
  const x = n.x > 0 ? wallX : wallX - w;
  return { x, y: snapToGrid(centre.y - h / 2, snapStep), rotationDeg: rotation, wallSnapped: true };
}
