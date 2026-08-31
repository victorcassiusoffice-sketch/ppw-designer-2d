/**
 * openings — pure geometry for DOORS, DOORWAYS and WINDOWS hosted on a wall.
 *
 * Vic 2026-08-28: "what if I wanted to add a door going into the second room.
 * We need to facilitate this properly."
 *
 * Sits on top of `wallEdges.ts` (which makes a room's walls addressable) and,
 * like it, is PURE — no store, no Konva, no side effects.
 *
 * THE MODEL (this is the convention every floor-plan tool converges on, and
 * it is what The Sims does too)
 * ---------------------------------------------------------------------------
 * An opening is not an object placed in space. It is a WALL-HOSTED CHILD with
 * a parametric position along its host:
 *
 *     (roomId, edgeIndex, offsetM, widthM)
 *
 * `offsetM` is the distance from the edge's START vertex to the opening's
 * CENTRE, stored ABSOLUTE rather than normalised. A normalised parameter
 * rescales the door's position when the wall is resized, walking it away from
 * the corner it has to clear — which is exactly the clearance a fitter cares
 * about. Absolute + clamp is the behaviour people expect.
 *
 * Everything then reduces to 1-D interval maths along the wall: rendering,
 * hit-testing and validation are all "does this span fit, and what is left".
 *
 * Two booleans rather than a swing enum give all four real door hands, which
 * is how Revit, Floorplanner and HomeByMe each model it independently:
 *   flipFacing — which SIDE of the wall the door swings toward
 *   flipHand   — which END of the opening the hinge sits at
 *
 * One record serves doors AND windows, discriminated by `sillM` (> 0 makes it
 * a window). That halves the geometry and hit-testing code.
 */

import type { Polygon, Vertex } from '../lib/geometry';
import { pointAlongEdge, type RoomEdge, type Span } from './wallEdges';

export type OpeningKind = 'door' | 'doorway' | 'window';

export interface Opening {
  id: string;
  /** Index of the host edge in the room's polygon. */
  edgeIndex: number;
  /** Distance along the edge from its start vertex to the opening's CENTRE, metres. */
  offsetM: number;
  /** Clear structural width, metres. */
  widthM: number;
  kind: OpeningKind;
  /** Which side of the wall the leaf swings toward. */
  flipFacing: boolean;
  /** Which end of the opening the hinge sits at. */
  flipHand: boolean;
  /** Sill height, metres. 0 (or absent) = a door; > 0 = a window. */
  sillM?: number;
}

/**
 * Trade door widths in metres (UK/EU leaf sizes).
 * 0.838 is the accessibility size — surfaced with that label in the UI.
 */
export const DOOR_WIDTHS_M = [0.686, 0.762, 0.838, 0.914, 1.219] as const;
export const DEFAULT_DOOR_WIDTH_M = 0.838;
export const DEFAULT_WINDOW_WIDTH_M = 1.2;

/**
 * Minimum solid wall left at each end of a wall, metres.
 *
 * A door hard against a corner cannot be built — the frame needs something to
 * fix to — so this is a real constraint, not a cosmetic one.
 */
export const JAMB_MARGIN_M = 0.1;

/** The interval an opening occupies along its host edge. */
export function openingSpan(o: Pick<Opening, 'offsetM' | 'widthM'>): Span {
  const half = o.widthM / 2;
  return { t0: o.offsetM - half, t1: o.offsetM + half };
}

/** True when the wall is long enough to host an opening of this width at all. */
export function edgeCanHost(edgeLengthM: number, widthM: number): boolean {
  return edgeLengthM >= widthM + JAMB_MARGIN_M * 2;
}

/**
 * Pull a proposed centre offset into the legal range for its wall, so dragging
 * a door along a wall stops at the jamb margin instead of sliding off the end.
 * Returns null when the wall is too short to host the opening at all.
 */
export function clampOpeningOffset(
  edgeLengthM: number,
  widthM: number,
  offsetM: number,
): number | null {
  if (!edgeCanHost(edgeLengthM, widthM)) return null;
  const half = widthM / 2;
  const lo = JAMB_MARGIN_M + half;
  const hi = edgeLengthM - JAMB_MARGIN_M - half;
  return Math.max(lo, Math.min(hi, offsetM));
}

export type OpeningRejection =
  | 'wall-too-short'
  | 'past-jamb-margin'
  | 'overlaps-another-opening';

export interface OpeningValidation {
  ok: boolean;
  reason?: OpeningRejection;
  /** Human-facing, ready for a toast. */
  message?: string;
}

const MESSAGES: Record<OpeningRejection, string> = {
  'wall-too-short': 'That wall is too short for this opening.',
  'past-jamb-margin': 'An opening needs a little wall left at each end.',
  'overlaps-another-opening': 'Openings on the same wall can’t overlap.',
};

/**
 * Hard constraints, enforced as a refusal rather than an override.
 *
 * `others` is every OTHER opening already hosted on the same edge.
 */
export function validateOpening(
  edgeLengthM: number,
  candidate: Pick<Opening, 'offsetM' | 'widthM'>,
  others: readonly Pick<Opening, 'offsetM' | 'widthM'>[] = [],
): OpeningValidation {
  if (!edgeCanHost(edgeLengthM, candidate.widthM)) {
    return { ok: false, reason: 'wall-too-short', message: MESSAGES['wall-too-short'] };
  }
  const { t0, t1 } = openingSpan(candidate);
  if (t0 < JAMB_MARGIN_M - 1e-9 || t1 > edgeLengthM - JAMB_MARGIN_M + 1e-9) {
    return { ok: false, reason: 'past-jamb-margin', message: MESSAGES['past-jamb-margin'] };
  }
  for (const o of others) {
    const s = openingSpan(o);
    // Touching end-to-end is legal; genuinely sharing length is not.
    if (t0 < s.t1 - 1e-9 && s.t0 < t1 - 1e-9) {
      return {
        ok: false,
        reason: 'overlaps-another-opening',
        message: MESSAGES['overlaps-another-opening'],
      };
    }
  }
  return { ok: true };
}

/**
 * The unit normal of a wall, pointing to one side or the other.
 * `flipFacing` picks the side the door swings toward.
 */
export function edgeNormal(edge: RoomEdge, flipFacing: boolean): { nx: number; ny: number } {
  return flipFacing ? { nx: edge.dy, ny: -edge.dx } : { nx: -edge.dy, ny: edge.dx };
}

// ---------------------------------------------------------------------------
// Polygon winding canonicalisation (doors round 2026-08-31, defect 4)
// ---------------------------------------------------------------------------

/**
 * Vertices closer than this (in BOTH axes) are the same point. Matches the
 * tolerance `propertyStore.cleanPolygon` has always used for the trailing
 * duplicate vertex.
 */
export const DUPLICATE_VERTEX_EPS_M = 1e-6;

/**
 * Shoelace area, SIGNED. In this app's y-DOWN screen space a positive value
 * means the polygon winds CLOCKWISE as drawn on screen — which is the
 * canonical winding every stored room polygon is normalised to.
 */
export function signedPolygonAreaM2(polygon: Polygon): number {
  if (polygon.length < 3) return 0;
  let s = 0;
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    s += a.x * b.y - b.x * a.y;
  }
  return s / 2;
}

/** True when the polygon winds clockwise in y-down screen space (canonical). */
export function isClockwisePolygon(polygon: Polygon): boolean {
  return signedPolygonAreaM2(polygon) > 0;
}

export interface CanonicalRoomGeometry {
  polygon: Polygon;
  openings: Opening[];
  /** True when the polygon was deduped and/or reversed. */
  changed: boolean;
}

/**
 * Canonicalise a room polygon — the fix for "CCW-drawn rooms swing every door
 * outward" (doors analysis 2026-08-31, defect 4).
 *
 * `edgeNormal` above is the FIXED left normal of an edge; it only points into
 * the room when the polygon winds clockwise (in y-down screen space). Nothing
 * used to normalise winding, so a hand-drawn counter-clockwise room reversed
 * every door's default swing and made "Flip side" read backwards. The durable
 * fix is at the DATA level: every stored polygon is canonicalised to CW here,
 * at both draw-commit and load.
 *
 * Two steps, both index-mapping-aware so openings hosted on the polygon are
 * remapped EXACTLY (same world-space gap, same world-space swing):
 *
 *  1. DEDUPE — consecutive duplicate vertices (and a trailing duplicate of
 *     the first) are dropped. A duplicate produces a zero-length edge, which
 *     `roomEdges` skips; any consumer indexing edges positionally would then
 *     shift every later opening one wall around (latent defect 9).
 *  2. WINDING — a counter-clockwise polygon (negative shoelace area) is
 *     reversed KEEPING the first vertex: [p0, p(n-1), …, p1]. Old edge i
 *     (p_i → p_{i+1}) becomes new edge (n-1-i) traversed backwards, so an
 *     opening remaps as:
 *       edgeIndex' = n - 1 - edgeIndex
 *       offsetM'   = edgeLength - offsetM   (measured from the other end)
 *       flipFacing' = !flipFacing           (the left normal flips with the
 *       flipHand'   = !flipHand              direction; both toggle so the
 *                                            WORLD-space leaf/arc is identical)
 *
 * Malformed opening records (non-numeric or out-of-range indices) pass
 * through untouched — `pruneOpenings` owns dropping those.
 *
 * Pure and idempotent: running it on its own output reports `changed: false`
 * and returns the inputs by reference.
 */
export function canonicaliseRoomGeometry(
  polygon: Polygon,
  openings: readonly Opening[] = [],
): CanonicalRoomGeometry {
  const n = polygon.length;
  if (n < 3) return { polygon, openings: [...openings], changed: false };

  // -- 1. dedupe, tracking where each OLD vertex index lands ----------------
  const eps = DUPLICATE_VERTEX_EPS_M;
  const same = (a: Vertex, b: Vertex) =>
    Math.abs(a.x - b.x) < eps && Math.abs(a.y - b.y) < eps;

  const kept: Vertex[] = [];
  const newIndexForOld: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const v = polygon[i];
    const last = kept[kept.length - 1];
    if (last && same(v, last)) {
      // Collapses onto the previous kept vertex — same world point, so an
      // opening measured from it keeps its offset.
      newIndexForOld[i] = kept.length - 1;
    } else {
      newIndexForOld[i] = kept.length;
      kept.push(v);
    }
  }
  if (kept.length > 1 && same(kept[0], kept[kept.length - 1])) {
    const popped = kept.length - 1;
    kept.pop();
    for (let i = 0; i < n; i++) {
      if (newIndexForOld[i] === popped) newIndexForOld[i] = 0;
    }
  }

  const deduped = kept.length !== n;
  if (kept.length < 3) {
    // Degenerate after cleanup — nothing can host an opening.
    return { polygon: kept, openings: [], changed: true };
  }

  const validIndex = (o: Opening, len: number) =>
    !!o
    && typeof o.edgeIndex === 'number'
    && Number.isInteger(o.edgeIndex)
    && o.edgeIndex >= 0
    && o.edgeIndex < len
    && typeof o.offsetM === 'number';

  let outOpenings: Opening[] = deduped
    ? openings.map((o) =>
      validIndex(o, n) ? { ...o, edgeIndex: newIndexForOld[o.edgeIndex] } : o,
    )
    : [...openings];

  // -- 2. winding -----------------------------------------------------------
  const ccw = signedPolygonAreaM2(kept) < 0;
  if (!ccw) {
    return deduped
      ? { polygon: kept, openings: outOpenings, changed: true }
      : { polygon, openings: [...openings], changed: false };
  }

  const m = kept.length;
  const reversed: Polygon = [kept[0], ...kept.slice(1).reverse()];
  const edgeLen = (i: number) => {
    const a = kept[i];
    const b = kept[(i + 1) % m];
    return Math.hypot(b.x - a.x, b.y - a.y);
  };
  outOpenings = outOpenings.map((o) => {
    if (!validIndex(o, m)) return o;
    return {
      ...o,
      edgeIndex: m - 1 - o.edgeIndex,
      offsetM: edgeLen(o.edgeIndex) - o.offsetM,
      flipFacing: !o.flipFacing,
      flipHand: !o.flipHand,
    };
  });
  return { polygon: reversed, openings: outOpenings, changed: true };
}

export interface DoorSymbol {
  /** Hinge point, world metres. */
  hinge: Vertex;
  /** The far jamb (the end the leaf swings away from). */
  farJamb: Vertex;
  /** Tip of the open leaf, world metres. */
  leafEnd: Vertex;
  /** Quarter-circle swing arc as a flat [x0,y0,x1,y1,...] world-metre polyline. */
  arc: number[];
}

/**
 * The architectural door symbol: a leaf line at 90 degrees from the hinge plus
 * a quarter-circle swing arc of radius = the door width.
 *
 * This is the part a top-down GAME does not give you — The Sims renders 3D
 * geometry seen from above and has no symbolic plan language. A floor plan is
 * read by a merchant or a fitter, so it uses the drawing convention instead:
 * it says at a glance which way the door opens and how much floor it sweeps.
 *
 * The arc is emitted as a polyline rather than a Konva Arc so the maths stays
 * pure and unit-testable, and so it needs no special handling under stage zoom.
 */
export function doorSymbol(edge: RoomEdge, o: Opening, segments = 12): DoorSymbol {
  const { t0, t1 } = openingSpan(o);
  const hingeT = o.flipHand ? t1 : t0;
  const farT = o.flipHand ? t0 : t1;

  const hinge = pointAlongEdge(edge, hingeT);
  const farJamb = pointAlongEdge(edge, farT);

  // Along-wall direction, hinge -> far jamb.
  const sign = farT >= hingeT ? 1 : -1;
  const ax = edge.dx * sign;
  const ay = edge.dy * sign;

  const { nx, ny } = edgeNormal(edge, o.flipFacing);
  const radius = o.widthM;

  const start = Math.atan2(ay, ax);
  const end = Math.atan2(ny, nx);
  // Shortest sweep — always the 90 degrees between the wall and the normal.
  let delta = end - start;
  while (delta > Math.PI) delta -= 2 * Math.PI;
  while (delta < -Math.PI) delta += 2 * Math.PI;

  const arc: number[] = [];
  for (let i = 0; i <= segments; i++) {
    const th = start + (delta * i) / segments;
    arc.push(hinge.x + radius * Math.cos(th), hinge.y + radius * Math.sin(th));
  }

  return {
    hinge,
    farJamb,
    leafEnd: { x: hinge.x + nx * radius, y: hinge.y + ny * radius },
    arc,
  };
}

/**
 * Where the jamb ticks go — the two short marks across the wall that keep an
 * opening legible when it is too small to read at low zoom.
 * `halfThicknessM` is how far the tick extends either side of the wall line.
 */
export function jambTicks(
  edge: RoomEdge,
  o: Opening,
  halfThicknessM: number,
): Array<[Vertex, Vertex]> {
  const { t0, t1 } = openingSpan(o);
  const { nx, ny } = edgeNormal(edge, false);
  return [t0, t1].map((t) => {
    const p = pointAlongEdge(edge, t);
    return [
      { x: p.x - nx * halfThicknessM, y: p.y - ny * halfThicknessM },
      { x: p.x + nx * halfThicknessM, y: p.y + ny * halfThicknessM },
    ] as [Vertex, Vertex];
  });
}
