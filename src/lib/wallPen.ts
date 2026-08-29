/**
 * wallPen — what happens to an OPEN run of wall points when the pen stops
 * (Vic 2026-08-29: "free walls that don't need to connect to anything —
 * the draw is currently forcing a full circuit").
 *
 * The Sims contract this enforces: walls you drew are REAL the moment you
 * stop drawing. Esc, Done, switching tool, tapping Rectangle — every exit
 * keeps the run as free-standing walls. Only an explicit Discard throws it
 * away, and a run that closes on its own first point still becomes a room
 * (that path lives in RoomCanvas.handleDrawCommit).
 *
 * Pure store logic — no Konva, no React — so App.tsx's mode toggle and the
 * keyboard hook can call it without dragging the canvas into node tests.
 */
import type { Polygon } from './geometry';
import { pointInPolygon } from './geometry';
import { usePropertyStore } from '../store/propertyStore';
import { useToastStore } from '../store/toastStore';
import { activeLevelIdOf } from '../designer/levels';
import { runToFreeWalls } from '../designer/freeWalls';

export interface KeepRunResult {
  /** Walls actually added. 0 when there was nothing to keep. */
  added: number;
  reason: 'kept' | 'too-few-points' | 'off-plot' | 'degenerate';
}

/** The locked land plot as a polygon, or null when the land is unlimited. */
function sitePolygonOf(): Polygon | null {
  const site = usePropertyStore.getState().property.site;
  if (!site) return null;
  const ox = site.originM?.x ?? 0;
  const oy = site.originM?.y ?? 0;
  return [
    { x: ox, y: oy },
    { x: ox + site.widthM, y: oy },
    { x: ox + site.widthM, y: oy + site.depthM },
    { x: ox, y: oy + site.depthM },
  ];
}

function toast(message: string, kind: 'info' | 'warn' | 'success' = 'info'): void {
  try {
    useToastStore.getState().push(message, kind);
  } catch {
    // Toast store is optional in some test environments.
  }
}

/**
 * Keep an in-flight run as free walls on the active level.
 *
 * Callers own the history transaction: run this INSIDE the draw transaction
 * and then `endDrawTransaction()` so the whole run is one undo frame, the
 * same way a committed room is.
 */
export function keepOpenRunAsWalls(vertices: readonly Polygon[number][], opts: { quiet?: boolean } = {}): KeepRunResult {
  if (vertices.length < 2) return { added: 0, reason: 'too-few-points' };
  const ps = usePropertyStore.getState();
  const plot = sitePolygonOf();
  if (plot && vertices.some((v) => !pointInPolygon(v, plot))) {
    if (!opts.quiet) toast('Those walls were off the plot — enlarge the land or draw inside it.', 'warn');
    return { added: 0, reason: 'off-plot' };
  }
  const walls = runToFreeWalls([...vertices], activeLevelIdOf(ps.property));
  if (walls.length === 0) return { added: 0, reason: 'degenerate' };
  const ids = ps.addFreeWalls(walls);
  if (!opts.quiet) {
    toast(
      `${ids.length} wall${ids.length === 1 ? '' : 's'} kept — close a shape on its first point to make a room`,
      'success',
    );
  }
  return { added: ids.length, reason: 'kept' };
}
