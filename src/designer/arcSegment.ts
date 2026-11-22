/**
 * A wall segment that is straight or a true circular arc (design format, version 2).
 *
 * A segment runs from `a` to `b`. Its curve is ONE number, the `bulge`: the tangent of a quarter of the angle the
 * arc turns through. Absent or 0 is a straight wall; 1 is a half circle; the sign says to which side it bows.
 * It is the bulge of a DXF polyline, so a drawing's arcs come in and go out without a sum.
 *
 * Why this and not a centre with a radius: the bulge is tied to the two ends. A program that moves an end and
 * knows nothing of arcs still leaves a sound arc (the same turn, on the new ends). A stored centre or radius would
 * then no longer fit the ends.
 *
 * The exact definition, in the stored numbers and free of any "which way is up":
 *
 *   the middle point of the arc is  m = (a + b) / 2 + (bulge / 2) * (b.y - a.y, -(b.x - a.x))
 *
 * and the wall is the circular arc from `a` through `m` to `b`. In a frame where y grows upward a positive bulge
 * turns counter-clockwise from `a` to `b` (the DXF rule). On this app's plan y grows downward, so there a positive
 * bulge is seen to turn clockwise. Turning a segment round (b to a) or mirroring it changes the sign; moving,
 * turning or scaling the plan as a whole does not change the number.
 *
 * Everything else (centre, radius, angles, length) is worked out from the two ends and the bulge, here, so that
 * every reader works it out the same way. This module imports nothing.
 */

export interface XY {
  x: number;
  y: number;
}

/** Below this a bulge is a straight wall: the arc would stand off its chord by less than a millionth of its length. */
export const BULGE_STRAIGHT_BELOW = 1e-6;
/** The largest bulge kept: an arc that turns through about 348 degrees. A whole circle is two half circles. */
export const BULGE_MAX = 20;

/** A bulge as stored: a finite number within the range, or nothing (a straight wall). */
export function cleanBulge(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  if (Math.abs(value) < BULGE_STRAIGHT_BELOW || Math.abs(value) > BULGE_MAX) return undefined;
  return value;
}

export interface ArcGeometry {
  centre: XY;
  radiusM: number;
  /** The angle of `a` seen from the centre, in radians, as `Math.atan2(y, x)` gives it. */
  startAngle: number;
  /** The turn from `a` to `b`, in radians: its sign is the bulge's, its size is below a full turn. */
  sweep: number;
  /** The length along the arc, in metres. */
  lengthM: number;
  /** The middle point of the arc. */
  middle: XY;
  /** How far the middle of the arc stands off the middle of the chord, in metres (never negative). */
  sagittaM: number;
}

/** The straight distance between the two ends. */
export const chordLengthM = (a: XY, b: XY): number => Math.hypot(b.x - a.x, b.y - a.y);

/**
 * The arc's centre, radius, angles and length. Nothing for a straight segment (a bulge that is absent, too small
 * or out of range) and for two ends that are one point.
 */
export function arcGeometry(a: XY, b: XY, bulge: number | undefined): ArcGeometry | undefined {
  const k = cleanBulge(bulge);
  const chord = chordLengthM(a, b);
  if (k === undefined || !(chord > 0) || !Number.isFinite(chord)) return undefined;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  // The side on which a positive bulge bows: (dy, -dx).
  const middle = { x: mid.x + (k / 2) * dy, y: mid.y - (k / 2) * dx };
  const towardCentre = (k * k - 1) / (4 * k);
  const centre = { x: mid.x + towardCentre * dy, y: mid.y - towardCentre * dx };
  const radiusM = (chord * (1 + k * k)) / (4 * Math.abs(k));
  const sweep = 4 * Math.atan(k);
  return {
    centre,
    radiusM,
    startAngle: Math.atan2(a.y - centre.y, a.x - centre.x),
    sweep,
    lengthM: radiusM * Math.abs(sweep),
    middle,
    sagittaM: (Math.abs(k) * chord) / 2,
  };
}

/** The length of a segment along the wall: the arc's length, or the chord of a straight wall. */
export function segmentLengthM(a: XY, b: XY, bulge?: number): number {
  return arcGeometry(a, b, bulge)?.lengthM ?? chordLengthM(a, b);
}

/** The point at the share `t` of the way along the wall, 0 at `a` and 1 at `b`. */
export function pointOnSegment(a: XY, b: XY, bulge: number | undefined, t: number): XY {
  const arc = arcGeometry(a, b, bulge);
  if (!arc) return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
  const angle = arc.startAngle + arc.sweep * t;
  return {
    x: arc.centre.x + arc.radiusM * Math.cos(angle),
    y: arc.centre.y + arc.radiusM * Math.sin(angle),
  };
}

/**
 * The wall as a run of straight pieces, for a reader that can only draw lines: the points from `a` to `b`, both
 * included. No piece stands off the true arc by more than `toleranceM`. A straight wall is its two ends.
 */
export function segmentPoints(a: XY, b: XY, bulge?: number, toleranceM = 0.005): XY[] {
  const arc = arcGeometry(a, b, bulge);
  if (!arc) return [{ ...a }, { ...b }];
  const tolerance = Math.min(Math.max(toleranceM, 1e-5), arc.radiusM);
  // A chord over the angle 2h stands off its arc by r (1 - cos h).
  const half = Math.acos(1 - tolerance / arc.radiusM);
  const pieces = Math.min(256, Math.max(2, Math.ceil(Math.abs(arc.sweep) / (2 * half))));
  const points: XY[] = [{ ...a }];
  for (let i = 1; i < pieces; i++) points.push(pointOnSegment(a, b, bulge, i / pieces));
  points.push({ ...b });
  return points;
}

/**
 * The bulge of the arc from `a` to `b` that passes through `through`. Nothing when the three points lie on one
 * line or two of them are one point (that is a straight wall), or when the arc would be out of range.
 */
export function bulgeThrough(a: XY, through: XY, b: XY): number | undefined {
  const chord = chordLengthM(a, b);
  const ua = { x: a.x - through.x, y: a.y - through.y };
  const ub = { x: b.x - through.x, y: b.y - through.y };
  const la = Math.hypot(ua.x, ua.y);
  const lb = Math.hypot(ub.x, ub.y);
  if (!(chord > 0) || !(la > 0) || !(lb > 0)) return undefined;
  // The angle at `through` between the two ends: the arc turns through 2 (pi - that angle).
  const cross = ua.x * ub.y - ua.y * ub.x;
  const dot = ua.x * ub.x + ua.y * ub.y;
  const inscribed = Math.atan2(Math.abs(cross), dot);
  if (!(inscribed > 0)) return undefined;
  const size = Math.tan((Math.PI - inscribed) / 2);
  // The side of the chord `through` lies on: the same sign as the bulge that bows there.
  const side = (through.x - a.x) * (b.y - a.y) - (through.y - a.y) * (b.x - a.x);
  if (side === 0) return undefined;
  return cleanBulge(side > 0 ? size : -size);
}

/**
 * The bulge of an arc of a given radius on a chord of a given length. `side` is the sign of the bulge; `large`
 * asks for the arc that turns through more than a half circle. Nothing when the radius is shorter than half the
 * chord (no such circle).
 */
export function bulgeFromRadius(
  chordM: number,
  radiusM: number,
  side: 1 | -1 = 1,
  large = false,
): number | undefined {
  if (!(chordM > 0) || !(radiusM > 0) || !Number.isFinite(chordM) || !Number.isFinite(radiusM)) {
    return undefined;
  }
  const ratio = chordM / (2 * radiusM);
  if (ratio > 1 + 1e-12) return undefined;
  const small = 2 * Math.asin(Math.min(1, ratio));
  const turn = large ? 2 * Math.PI - small : small;
  return cleanBulge(side * Math.tan(turn / 4));
}

/** One curved edge of a room's outline: the edge from corner `edgeIndex` to the next corner, and its bulge. */
export interface WallArc {
  edgeIndex: number;
  bulge: number;
}

/** A room has at most this many curved edges kept (an outline has at most 2000 corners in a design file). */
export const WALL_ARC_LIMIT = 2000;

/**
 * A room's curved edges as stored, cleaned: whole edge numbers of the outline, one entry per edge (the first
 * wins), a bulge within the range. `edgeMap` and `reversed` carry them across a clean-up of the outline, as the
 * paint and the doors are carried: an edge that is gone loses its arc, and an outline that was turned round keeps
 * each arc on the same wall, bowing to the same side (its sign changes, because the edge now runs the other way).
 * Nothing when no arc is left.
 */
export function cleanWallArcs(
  raw: unknown,
  edgeCount: number,
  edgeMap?: readonly number[],
  reversed = false,
): WallArc[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0 || edgeCount < 3) return undefined;
  const seen = new Set<number>();
  const out: WallArc[] = [];
  for (const entry of raw.slice(0, WALL_ARC_LIMIT)) {
    if (!entry || typeof entry !== 'object') continue;
    const { edgeIndex, bulge } = entry as { edgeIndex?: unknown; bulge?: unknown };
    if (typeof edgeIndex !== 'number' || !Number.isInteger(edgeIndex) || edgeIndex < 0) continue;
    if (edgeMap && edgeIndex >= edgeMap.length) continue;
    const index = edgeMap ? edgeMap[edgeIndex] : edgeIndex;
    const clean = cleanBulge(bulge);
    if (clean === undefined || index < 0 || index >= edgeCount || seen.has(index)) continue;
    seen.add(index);
    out.push({ edgeIndex: index, bulge: reversed ? -clean : clean });
  }
  return out.length > 0 ? out : undefined;
}
