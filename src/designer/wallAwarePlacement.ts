/**
 * Sims-style wall-aware placement (2026-08-23, reworked 2026-08-29).
 *
 * The Sims build-mode placement contract this module reproduces:
 *   1. Objects have a FRONT. Dropped near a wall, an object auto-rotates
 *      so its back is against that wall and its front faces INTO the room.
 *   2. Wall-adjacent objects sit FLUSH against the wall's INNER FACE. The
 *      wall band is WALL_THICKNESS_M thick and stroked CENTRED on the
 *      polygon edge, so the face is WALL_HALF_M inside the edge — flushing
 *      to the edge itself left every item overlapping the wall band.
 *   3. Along the wall the object grid-snaps, but is clamped to the wall's
 *      span so a coarse grid step can never push it past the room end.
 *   4. Near TWO perpendicular walls the object is pulled into the corner,
 *      touching both faces (previously only one wall was ever snapped, so
 *      corners were reachable only by grid coincidence).
 *   5. Dropped mid-room, an object keeps its current facing (a dragged item
 *      no longer resets to 0°); a fresh drop faces the viewer (0°).
 *   6. Free-standing walls (open runs) are snap targets on BOTH sides and
 *      obstacles for everything else.
 *
 * Convention: at rotation 0 the top-down product image FACES the bottom
 * of the image (+Y, toward the viewer). Its BACK is the top edge. A
 * product can override with `front_edge` in the catalog when its art
 * breaks the convention. Konva rotation is clockwise in screen space
 * (y-down), so rotating the front vector (0,1) by θ gives (−sinθ, cosθ).
 *
 * Pure functions only — consumed by RoomCanvas (ghost preview, commit,
 * drag-end), attachmentPlacement (wall items) and unit-tested in
 * __tests__/wallAwarePlacement.test.ts.
 */

import { pointInPolygon, polygonBounds, rotatedFootprint, snapToGrid } from '../lib/geometry';
import type { FootprintM, PlacedRect, Polygon, Vertex } from '../lib/geometry';

export type FrontEdge = 'top' | 'bottom' | 'left' | 'right';

/**
 * Max gap (metres) between an object's back edge and a wall for the
 * wall-snap + auto-orient to engage. Just under one 0.5 m tile, so a
 * drop "roughly by the wall" catches, but a drop a full tile away
 * stays free-standing.
 */
export const WALL_SNAP_GAP_M = 0.45;

/**
 * Real wall thickness in world metres (2026-08-29). Walls are stroked CENTRED
 * on the room polygon edge, so the inner face sits WALL_THICKNESS_M / 2 inside
 * the polygon. Items flush to that inner face, never to the edge itself.
 */
export const WALL_THICKNESS_M = 0.1;
export const WALL_HALF_M = WALL_THICKNESS_M / 2;

/**
 * Axis-alignment tolerance (metres). Vertices are rounded to 4 dp elsewhere,
 * so a straight wall can be off-axis by up to 1e-4; the old 1e-9 read such
 * edges as slanted and silently refused to snap.
 */
export const AXIS_ALIGN_TOL_M = 1e-4;

/** Slack for threshold and tie comparisons — floating drift only. */
const EPS = 1e-9;

/** Angle (deg) of the front vector at rotation 0 for each front_edge. */
const FRONT_EDGE_ANGLE: Record<FrontEdge, number> = {
  bottom: 0, // (0, 1)
  left: 90, // (−1, 0) — rotate (0,1) by 90° CW (screen coords)
  top: 180, // (0, −1)
  right: 270, // (1, 0)
};

/**
 * A free-standing wall (open run) in world metres. Two-sided: its
 * "inward" normal for a query point is whichever side the point is on.
 */
export interface FreeWallLike {
  a: Vertex;
  b: Vertex;
  /** Wall thickness (m). Absent → WALL_THICKNESS_M. */
  thicknessM?: number;
}

export type WallAlignment = 'horizontal' | 'vertical' | 'slanted';

export interface NearestEdge {
  a: Vertex;
  b: Vertex;
  /** Distance from the query point to the closest point on the edge (m). */
  distance: number;
  /** Unit normal on the ROOM side of the edge. */
  inwardNormal: Vertex;
  /** Axis alignment — flush-positioning only supports axis-aligned walls. */
  alignment: WallAlignment;
}

/** A wall an object may flush against: a room polygon edge or a free wall. */
export interface WallCandidate extends NearestEdge {
  source: 'polygon' | 'free';
  /** Index into the polygon (edge i = vertex i → i+1) or the freeWalls array. */
  index: number;
  /** The inner face sits this far inside the edge line (half thickness). */
  insetM: number;
  /**
   * Axis-aligned walls only: coordinate of the edge line on its fixed axis
   * (y for horizontal, x for vertical) and the segment's span along the
   * other axis.
   */
  lineCoord: number;
  spanMin: number;
  spanMax: number;
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

interface SegmentProbe {
  distance: number;
  /** Unit normal (−dy, dx)/len — the segment's left-hand side in y-down space. */
  nx: number;
  ny: number;
  alignment: WallAlignment;
}

/** Distance from p to segment ab (clamped to the segment) plus its raw normal. */
function probeSegment(a: Vertex, b: Vertex, p: Vertex, axisTol: number): SegmentProbe | null {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 1e-12) return null;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq));
  const distance = Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
  const len = Math.sqrt(lenSq);
  // `<=`: an edge exactly AXIS_ALIGN_TOL_M off-axis is still axis-aligned
  // (a strict `<` classed it slanted and refused every drop on that wall).
  const alignment: WallAlignment =
    Math.abs(dy) <= axisTol ? 'horizontal' : Math.abs(dx) <= axisTol ? 'vertical' : 'slanted';
  return { distance, nx: -dy / len, ny: dx / len, alignment };
}

/** Flip the raw normal to whichever side of the edge is inside the room. */
function roomSideNormal(a: Vertex, b: Vertex, s: SegmentProbe, polygon: Polygon): Vertex {
  const probe = { x: (a.x + b.x) / 2 + s.nx * 0.01, y: (a.y + b.y) / 2 + s.ny * 0.01 };
  return pointInPolygon(probe, polygon) ? { x: s.nx, y: s.ny } : { x: -s.nx, y: -s.ny };
}

/** Nearest polygon edge to a point, with its room-side normal. */
export function nearestEdge(
  polygon: Polygon,
  p: Vertex,
  axisTol: number = AXIS_ALIGN_TOL_M,
): NearestEdge | null {
  if (polygon.length < 3) return null;
  let best: NearestEdge | null = null;
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    const s = probeSegment(a, b, p, axisTol);
    if (!s) continue;
    if (best && s.distance >= best.distance) continue;
    best = {
      a,
      b,
      distance: s.distance,
      inwardNormal: roomSideNormal(a, b, s, polygon),
      alignment: s.alignment,
    };
  }
  return best;
}

function toCandidate(
  a: Vertex,
  b: Vertex,
  s: SegmentProbe,
  inwardNormal: Vertex,
  source: WallCandidate['source'],
  index: number,
  insetM: number,
): WallCandidate {
  const horizontal = s.alignment === 'horizontal';
  return {
    a,
    b,
    distance: s.distance,
    inwardNormal,
    alignment: s.alignment,
    source,
    index,
    insetM,
    lineCoord: horizontal ? (a.y + b.y) / 2 : (a.x + b.x) / 2,
    spanMin: horizontal ? Math.min(a.x, b.x) : Math.min(a.y, b.y),
    spanMax: horizontal ? Math.max(a.x, b.x) : Math.max(a.y, b.y),
  };
}

/**
 * Every wall an object at `centre` could flush against: all polygon edges
 * (normal into the room, inset `wallInsetM`) plus every free wall (normal
 * toward the centre, inset half its own thickness). Polygon edges come
 * first, in polygon order — the tie-break order for snapping.
 */
export function collectWallCandidates(input: {
  polygon: Polygon;
  centre: Vertex;
  freeWalls?: readonly FreeWallLike[];
  wallInsetM?: number;
  axisTol?: number;
}): WallCandidate[] {
  const { polygon, centre } = input;
  const inset = input.wallInsetM ?? WALL_HALF_M;
  const axisTol = input.axisTol ?? AXIS_ALIGN_TOL_M;
  const out: WallCandidate[] = [];
  if (polygon.length >= 3) {
    for (let i = 0; i < polygon.length; i++) {
      const a = polygon[i];
      const b = polygon[(i + 1) % polygon.length];
      const s = probeSegment(a, b, centre, axisTol);
      if (!s) continue;
      out.push(toCandidate(a, b, s, roomSideNormal(a, b, s, polygon), 'polygon', i, inset));
    }
  }
  const walls = input.freeWalls ?? [];
  for (let i = 0; i < walls.length; i++) {
    const wall = walls[i];
    const s = probeSegment(wall.a, wall.b, centre, axisTol);
    if (!s) continue;
    // Two-sided: "inward" is whichever side the query point is on.
    const side = s.nx * (centre.x - wall.a.x) + s.ny * (centre.y - wall.a.y);
    const n = side < 0 ? { x: -s.nx, y: -s.ny } : { x: s.nx, y: s.ny };
    out.push(toCandidate(wall.a, wall.b, s, n, 'free', i, (wall.thicknessM ?? WALL_THICKNESS_M) / 2));
  }
  return out;
}

/**
 * AABB start coordinate on the candidate's fixed axis (y for a horizontal
 * wall, x for a vertical one) that puts an object `extent` deep flush
 * against the wall's inner face. Axis-aligned candidates only.
 */
export function wallFlushOrigin(c: WallCandidate, extent: number): number {
  const n = c.alignment === 'horizontal' ? c.inwardNormal.y : c.inwardNormal.x;
  const face = c.lineCoord + (n >= 0 ? c.insetM : -c.insetM);
  return n >= 0 ? face : face - extent;
}

/**
 * True when `rect` sits inside the room's INNER wall faces — the polygon's
 * bounding box shrunk by the wall inset on every side. `isRectInsidePolygon`
 * accepts an edge-touching rect, which is 5 cm inside the drawn wall band;
 * placement paths that bypass the wall snap (rotate, nudge, grid fallback)
 * use this so nothing is ever seated in the wall. Bounding-box based, so
 * it is exact for rectangular rooms and conservative-only on L-shapes.
 */
export function insideInnerFaces(
  rect: PlacedRect,
  polygon: Polygon,
  insetM: number = WALL_HALF_M,
  tol: number = 1e-6,
): boolean {
  if (polygon.length < 3) return true;
  const b = polygonBounds(polygon);
  return (
    rect.x >= b.minX + insetM - tol &&
    rect.y >= b.minY + insetM - tol &&
    rect.x + rect.w <= b.maxX - insetM + tol &&
    rect.y + rect.h <= b.maxY - insetM + tol
  );
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
  /** Grid step in metres (0.01 … 10). */
  snapStep: number;
  /**
   * A rotation the user chose explicitly (armed-ghost R key, or an
   * existing item's rotation with Shift held on drag). null/undefined →
   * auto-orient is allowed.
   */
  userRotationDeg?: number | null;
  frontEdge?: FrontEdge;
  /** Distance from a polygon edge to its wall's inner face. Default WALL_HALF_M. */
  wallInsetM?: number;
  /**
   * An EXISTING item's rotation. Used when the item ends up free-standing
   * and userRotationDeg is null, so a mid-room drag keeps its facing
   * instead of resetting to 0. New drops pass undefined (= 0).
   */
  currentRotationDeg?: number | null;
  /** Free-standing walls on the same level — snap targets on both sides. */
  freeWalls?: readonly FreeWallLike[];
  /** Keep the object within the primary wall's span (default true). */
  clampAlongWall?: boolean;
}

export interface WallAwareResult {
  /** AABB top-left in room metres, grid-snapped (flush on the wall axis). */
  x: number;
  y: number;
  rotationDeg: number;
  /** True when the object was pulled flush against at least one wall. */
  wallSnapped: boolean;
  /** 0 free-standing, 1 flush on one wall, 2 in a corner. */
  snappedEdges: number;
  cornerSnapped: boolean;
  /** The axis free to slide along the primary wall; null when free-standing. */
  primaryAxis: 'x' | 'y' | null;
}

interface ScoredCandidate {
  c: WallCandidate;
  rotationDeg: number;
  /** Gap between the object's back edge and the wall edge line (m). */
  backGap: number;
  /**
   * Gap measured with the object's CURRENT footprint as well (min of the
   * two) — the reach test. Absent = same as backGap.
   */
  engageGap?: number;
}

/** Smallest backGap; ties → smaller distance; then earliest (polygon order). */
function pickClosest(scored: ScoredCandidate[]): ScoredCandidate | null {
  let best: ScoredCandidate | null = null;
  for (const s of scored) {
    if (
      !best ||
      s.backGap < best.backGap - EPS ||
      (Math.abs(s.backGap - best.backGap) <= EPS && s.c.distance < best.c.distance - EPS)
    ) {
      best = s;
    }
  }
  return best;
}

/**
 * The single placement resolver: grid-snap + wall-snap (one or two walls)
 * + auto-orient. Callers still run validatePlacement on the result and,
 * when blocked, findFreeSlotAlongWall before falling back to findFreeSlot.
 */
export function resolveWallAwarePlacement(input: WallAwareInput): WallAwareResult {
  const { fp, polygon, snapStep, frontEdge } = input;
  const wallInsetM = input.wallInsetM ?? WALL_HALF_M;
  const userRot = input.userRotationDeg ?? null;
  const centre = { x: input.centreXm, y: input.centreYm };

  // Slanted walls can't take a flush AABB, so they are never candidates.
  const candidates = collectWallCandidates({
    polygon,
    centre,
    freeWalls: input.freeWalls,
    wallInsetM,
  }).filter((c) => c.alignment !== 'slanted');

  // Each wall would induce its own auto-orient rotation, hence its own
  // footprint depth along that wall's normal — score them individually.
  //
  // Vic 2026-08-29 ("doesn't align horizontally flush to the wall, only
  // vertically, so you can't align an object in the corner"): the ENGAGE
  // test used to measure the gap with the depth the object would have
  // AFTER auto-orient (its short side), while the user drags the object
  // at its CURRENT facing. A landscape treadmill (2.05 × 0.95) pushed
  // against the left wall had backGap = 1.225 − 0.475 = 0.75 m > 0.45 →
  // never engaged, while the same push on the top wall engaged at touch.
  // The gap the user sees is the object's current edge to the wall, so
  // engage on min(current-extent gap, oriented gap); the flush POSITION
  // still uses the oriented depth below.
  const currentRot = input.currentRotationDeg ?? userRot ?? 0;
  const currentFp = rotatedFootprint(fp, currentRot);
  const scored: ScoredCandidate[] = candidates.map((c) => {
    const rotationDeg = userRot ?? autoOrientDeg(c.inwardNormal, frontEdge);
    const { w, h } = rotatedFootprint(fp, rotationDeg);
    const horizontal = c.alignment === 'horizontal';
    const orientedGap = c.distance - (horizontal ? h : w) / 2;
    const currentGap = c.distance - (horizontal ? currentFp.h : currentFp.w) / 2;
    // backGap (oriented) keeps ORDERING exactly as before — the nearest
    // wall by its flush depth is still primary; engageGap only decides
    // whether the wall is within reach at all.
    return { c, rotationDeg, backGap: orientedGap, engageGap: Math.min(orientedGap, currentGap) };
  });
  const within = scored.filter((s) => (s.engageGap ?? s.backGap) <= WALL_SNAP_GAP_M + EPS);
  // An EXISTING item pushed into a corner has both walls within reach;
  // which one is PRIMARY decides the facing. Prefer the wall it already
  // faces so the corner never spins it — the user rotates, the corner does
  // not. Fresh drops keep "nearest wall decides"; free rotations never match.
  const facing =
    userRot == null && input.currentRotationDeg != null && within.length > 1
      ? pickClosest(within.filter((s) => s.rotationDeg === mod360(currentRot)))
      : null;
  const primary = facing ?? pickClosest(within);

  if (!primary) {
    // Free-standing: keep an existing item's facing; a new drop faces the viewer.
    const rotationDeg = userRot ?? input.currentRotationDeg ?? 0;
    const { w, h } = rotatedFootprint(fp, rotationDeg);
    let x = snapToGrid(centre.x - w / 2, snapStep);
    let y = snapToGrid(centre.y - h / 2, snapStep);
    // Never inside the wall band, never past the far wall: clamp to the
    // room's inner faces (bounding box). A grid position of x = 0 sat 5 cm
    // into the wall; one near the far wall bounced with "Out of room
    // bounds." Callers still validate against the true polygon.
    if (polygon.length >= 3) {
      const b = polygonBounds(polygon);
      const lo = { x: b.minX + wallInsetM, y: b.minY + wallInsetM };
      const hi = { x: b.maxX - wallInsetM - w, y: b.maxY - wallInsetM - h };
      if (hi.x >= lo.x - EPS) x = Math.min(hi.x, Math.max(lo.x, x));
      if (hi.y >= lo.y - EPS) y = Math.min(hi.y, Math.max(lo.y, y));
    }
    return {
      x: Number(x.toFixed(6)),
      y: Number(y.toFixed(6)),
      rotationDeg,
      wallSnapped: false,
      snappedEdges: 0,
      cornerSnapped: false,
      primaryAxis: null,
    };
  }

  const { rotationDeg } = primary;
  const { w, h } = rotatedFootprint(fp, rotationDeg);
  const horizontal = primary.c.alignment === 'horizontal';
  // Object size across the wall (depth) and along it (length).
  const depth = horizontal ? h : w;
  const length = horizontal ? w : h;
  const fixed = wallFlushOrigin(primary.c, depth);

  // A perpendicular wall within the gap makes it a corner: flush both faces.
  const secondary = pickClosest(
    candidates
      .filter((c) => c.alignment !== primary.c.alignment)
      .map((c) => ({ c, rotationDeg, backGap: c.distance - length / 2 })),
  );

  let along: number;
  let corner = false;
  if (secondary && secondary.backGap <= WALL_SNAP_GAP_M + EPS) {
    along = wallFlushOrigin(secondary.c, length);
    corner = true;
  } else {
    along = snapToGrid((horizontal ? centre.x : centre.y) - length / 2, snapStep);
    if (input.clampAlongWall ?? true) {
      // The perpendicular walls at the span ends have inner faces too, so
      // the usable span shrinks by the inset at both ends.
      const lo = primary.c.spanMin + wallInsetM;
      const hi = primary.c.spanMax - wallInsetM;
      along =
        hi - lo < length ? (lo + hi) / 2 - length / 2 : Math.min(hi - length, Math.max(lo, along));
    }
  }

  return {
    x: horizontal ? along : fixed,
    y: horizontal ? fixed : along,
    rotationDeg,
    wallSnapped: true,
    snappedEdges: corner ? 2 : 1,
    cornerSnapped: corner,
    primaryAxis: horizontal ? 'x' : 'y',
  };
}

/**
 * When a wall-snapped position is blocked, slide ALONG the primary wall
 * (flush coordinate fixed, nearest first, ±step increments up to
 * maxSlideM) and return the first candidate `fits` accepts. The generic
 * findFreeSlot re-snaps both axes and loses the flush coordinate — this
 * keeps the item on the wall. Null when free-standing or nothing fits.
 */
export function findFreeSlotAlongWall(input: {
  resolved: WallAwareResult;
  w: number;
  h: number;
  step: number;
  maxSlideM?: number;
  fits: (rect: PlacedRect) => boolean;
}): { x: number; y: number } | null {
  const { resolved, w, h, step, fits } = input;
  if (!resolved.wallSnapped || !resolved.primaryAxis || !(step > 0)) return null;
  const maxSlide = input.maxSlideM ?? 6;
  const alongX = resolved.primaryAxis === 'x';
  const base = alongX ? resolved.x : resolved.y;
  const tryAt = (v: number): { x: number; y: number } | null => {
    const rect: PlacedRect = alongX
      ? { x: v, y: resolved.y, w, h }
      : { x: resolved.x, y: v, w, h };
    return fits(rect) ? { x: rect.x, y: rect.y } : null;
  };
  const steps = Math.floor(maxSlide / step + EPS);
  for (let k = 0; k <= steps; k++) {
    const hit = tryAt(base + k * step) ?? (k > 0 ? tryAt(base - k * step) : null);
    if (hit) return hit;
  }
  return null;
}

/**
 * Free walls as collision obstacles. Axis-aligned walls become the wall
 * band (segment ± thickness/2 across, exact span along); slanted walls use
 * their bounding box grown by thickness/2. instanceId = 'wall:<index>'.
 * Callers append these to the collision `others` list.
 */
export function freeWallObstacleRects(
  walls: readonly FreeWallLike[],
  defaultThicknessM: number = WALL_THICKNESS_M,
): Array<PlacedRect & { instanceId: string }> {
  const out: Array<PlacedRect & { instanceId: string }> = [];
  walls.forEach((wall, index) => {
    const dx = wall.b.x - wall.a.x;
    const dy = wall.b.y - wall.a.y;
    // A zero-length wall would still register as a collision (rectsOverlap
    // accepts zero-width rects), so it must not become an obstacle at all.
    if (dx * dx + dy * dy < 1e-12) return;
    const half = (wall.thicknessM ?? defaultThicknessM) / 2;
    const instanceId = `wall:${index}`;
    const minX = Math.min(wall.a.x, wall.b.x);
    const minY = Math.min(wall.a.y, wall.b.y);
    if (Math.abs(dy) < AXIS_ALIGN_TOL_M) {
      out.push({ x: minX, y: wall.a.y - half, w: Math.abs(dx), h: 2 * half, instanceId });
    } else if (Math.abs(dx) < AXIS_ALIGN_TOL_M) {
      out.push({ x: wall.a.x - half, y: minY, w: 2 * half, h: Math.abs(dy), instanceId });
    } else {
      out.push({
        x: minX - half,
        y: minY - half,
        w: Math.abs(dx) + 2 * half,
        h: Math.abs(dy) + 2 * half,
        instanceId,
      });
    }
  });
  return out;
}
