/**
 * freeWalls — free-standing walls, Sims world 2026-08-29.
 *
 * A room polygon must close; a free wall does not. This is the model for
 * "walls can stop where they want" (Vic's brief #2): an open run drawn with
 * the pen becomes a chain of FreeWalls on the property, in the same world-
 * metre frame as the room polygons, on one level.
 *
 * It REPLACES the mm-based `wallStore` (`ppw_walls_v1`), which was a global
 * singleton — never saved to the server, invisible to placement and to
 * pages. `fromLegacyWallSegments` is the one-shot bridge for anything still
 * sitting in that store or in an old page bundle.
 *
 * Pure helpers only; the store owns ids and mutation.
 */

import type { Vertex } from '../lib/geometry';
import { WALL_THICKNESS_M } from './wallAwarePlacement';
import { GROUND_LEVEL_ID, roomLevelId } from './levels';

export interface FreeWall {
  id: string;
  /** Endpoints in world metres. */
  a: Vertex;
  b: Vertex;
  thicknessM: number;
  /** Absent means ground — same rule as `Room.levelId`. */
  levelId?: string;
  /** Wall paint (2026-09-02): a WALL_PAINTS id. Absent = bare plaster. */
  paintId?: string;
}

/** A wall shorter than this is a click, not a wall, and is dropped. */
export const MIN_FREE_WALL_LENGTH_M = 1e-4;

export function wallsOnLevel<T extends { levelId?: string }>(
  walls: readonly T[],
  levelId: string,
): T[] {
  return walls.filter((w) => roomLevelId(w) === levelId);
}

export function freeWallLengthM(w: Pick<FreeWall, 'a' | 'b'>): number {
  return Math.hypot(w.b.x - w.a.x, w.b.y - w.a.y);
}

function isFiniteVertex(v: unknown): v is Vertex {
  if (!v || typeof v !== 'object') return false;
  const p = v as Record<string, unknown>;
  return typeof p.x === 'number' && Number.isFinite(p.x)
    && typeof p.y === 'number' && Number.isFinite(p.y);
}

/**
 * An open polyline → one wall per consecutive pair. Zero-length pairs (a
 * double click on the same vertex) are dropped rather than stored as
 * degenerate walls that would break normal computation downstream.
 */
export function runToFreeWalls(
  vertices: Vertex[],
  levelId: string,
  thicknessM: number = WALL_THICKNESS_M,
): Omit<FreeWall, 'id'>[] {
  const out: Omit<FreeWall, 'id'>[] = [];
  for (let i = 0; i + 1 < vertices.length; i++) {
    const a = vertices[i];
    const b = vertices[i + 1];
    if (!isFiniteVertex(a) || !isFiniteVertex(b)) continue;
    const wall = { a: { x: a.x, y: a.y }, b: { x: b.x, y: b.y }, thicknessM, levelId };
    if (freeWallLengthM(wall) < MIN_FREE_WALL_LENGTH_M) continue;
    out.push(wall);
  }
  return out;
}

/** 4 dp in metres = 0.1 mm, the same rounding the room vertices use. */
function round4(n: number): number {
  return Math.round(n * 1e4) / 1e4;
}

/**
 * Legacy `wallStore` segments (millimetres) → free walls (metres, ground
 * level). Thickness falls back to the world constant when the segment has
 * none or an unusable one; zero-length and non-finite segments are dropped.
 */
export function fromLegacyWallSegments(
  segments: Array<{
    start: { x_mm: number; y_mm: number };
    end: { x_mm: number; y_mm: number };
    thickness_mm?: number;
  }>,
): Omit<FreeWall, 'id'>[] {
  const out: Omit<FreeWall, 'id'>[] = [];
  for (const s of segments) {
    if (!s || !s.start || !s.end) continue;
    const a = { x: round4(s.start.x_mm / 1000), y: round4(s.start.y_mm / 1000) };
    const b = { x: round4(s.end.x_mm / 1000), y: round4(s.end.y_mm / 1000) };
    if (!isFiniteVertex(a) || !isFiniteVertex(b)) continue;
    const thicknessM =
      typeof s.thickness_mm === 'number' && Number.isFinite(s.thickness_mm) && s.thickness_mm > 0
        ? round4(s.thickness_mm / 1000)
        : WALL_THICKNESS_M;
    const wall = { a, b, thicknessM, levelId: GROUND_LEVEL_ID };
    if (freeWallLengthM(wall) < MIN_FREE_WALL_LENGTH_M) continue;
    out.push(wall);
  }
  return out;
}

/**
 * Validator for persisted payloads. Structural only — a degenerate (zero
 * length) wall passes here and is dropped by the store's normaliser, so the
 * two checks stay single-purpose.
 */
export function isFreeWallLike(x: unknown): x is FreeWall {
  if (!x || typeof x !== 'object') return false;
  const w = x as Record<string, unknown>;
  return (
    typeof w.id === 'string'
    && w.id.length > 0
    && isFiniteVertex(w.a)
    && isFiniteVertex(w.b)
    && typeof w.thicknessM === 'number'
    && Number.isFinite(w.thicknessM)
    && w.thicknessM > 0
    && (w.levelId === undefined || typeof w.levelId === 'string')
  );
}
