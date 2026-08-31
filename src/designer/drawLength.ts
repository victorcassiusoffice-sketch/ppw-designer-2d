/**
 * drawLength — typed segment lengths while drawing a room
 * (units brief 2026-08-28, D9).
 *
 * The interaction: **the cursor supplies the DIRECTION, the field supplies the
 * MAGNITUDE.** You point where the next wall should go, type how long it is,
 * and press Enter. That keeps the mouse doing what a mouse is good at and the
 * keyboard doing what a keyboard is good at, and it avoids inventing an
 * angle-entry UI nobody asked for.
 */

import type { Vertex } from '../lib/geometry';
import { snapToGrid } from '../lib/geometry';

/**
 * Quantise a vertex to a whole number of snap steps, then round to 4 dp.
 *
 * The rounding is not cosmetic. `Math.round(5.13 / 0.01) * 0.01` is
 * `5.130000000000001` in IEEE754, and `cleanPolygon` does no quantisation
 * whatsoever, so that float tail would persist straight into `Room.polygon`
 * and then into every saved plan and quote payload. 4 dp is 0.1 mm — finer
 * than the finest unit, so it can never lose real precision.
 *
 * Only ever applied to the GRID branch of the draw path. A wall-snapped
 * vertex must be returned verbatim: re-quantising it would drift it off the
 * wall it was just attached to and reopen the overlap the snap prevents.
 */
export function quantiseVertex(v: Vertex, stepM: number): Vertex {
  return {
    x: Number(snapToGrid(v.x, stepM).toFixed(4)),
    y: Number(snapToGrid(v.y, stepM).toFixed(4)),
  };
}

/**
 * Straight-line assist (walls-straight, 2026-08-31, complaint A).
 *
 * A run the user MEANS to be horizontal or vertical rarely lands exactly on
 * the axis — the second click is a pixel or two off, and the grid alone only
 * absorbs drift smaller than half a cell, so at a fine unit a "straight" wall
 * commits visibly slanted. Editors (Sims 4, Sweet Home 3D's 15° magnetism,
 * Floorplanner's ortho bias) make orthogonal the DEFAULT and offer a modifier
 * to free it. This is that default: within `ANGLE_SNAP_TOL_DEG` of an axis the
 * candidate is pulled ONTO the axis; a deliberate diagonal (a 45° run) is left
 * alone; a caller can pass `freed` (Shift held) to release the lock entirely.
 */
export const ANGLE_SNAP_TOL_DEG = 15;
const ANGLE_SNAP_TAN = Math.tan((ANGLE_SNAP_TOL_DEG * Math.PI) / 180);

export type LockAxis = 'none' | 'horizontal' | 'vertical';

/**
 * Pull `candidate` onto the horizontal or vertical through `prev` when the
 * segment is within `ANGLE_SNAP_TOL_DEG` of that axis. PURE — no store, no
 * rounding beyond the 4 dp the rest of the draw path keeps.
 *
 * Returns the (possibly axis-locked) vertex plus WHICH axis it locked to, so
 * the HUD can show a "straight" affordance. `prev === null` (the first point
 * has no direction) or `opts.freed` (Shift) returns the candidate untouched
 * with `axis: 'none'`.
 */
export function axisLockVertex(
  prev: Vertex | null,
  candidate: Vertex,
  opts?: { freed?: boolean },
): { vertex: Vertex; axis: LockAxis } {
  if (!prev || opts?.freed) return { vertex: candidate, axis: 'none' };
  const dx = candidate.x - prev.x;
  const dy = candidate.y - prev.y;
  const adx = Math.abs(dx);
  const ady = Math.abs(dy);
  // Within 15° of horizontal: the run is mostly along x and its rise is small.
  if (adx >= ady && ady <= adx * ANGLE_SNAP_TAN) {
    return {
      vertex: { x: Number(candidate.x.toFixed(4)), y: Number(prev.y.toFixed(4)) },
      axis: 'horizontal',
    };
  }
  // Within 15° of vertical: mostly along y, small run.
  if (ady >= adx && adx <= ady * ANGLE_SNAP_TAN) {
    return {
      vertex: { x: Number(prev.x.toFixed(4)), y: Number(candidate.y.toFixed(4)) },
      axis: 'vertical',
    };
  }
  // A deliberate diagonal — leave it alone.
  return { vertex: candidate, axis: 'none' };
}

/**
 * The next vertex, `lengthM` away from `last`, in the direction of `hover`.
 *
 * Returns `null` when there is no usable direction — no hover, or the cursor
 * sitting exactly on the last vertex — rather than guessing an axis.
 */
export function nextVertexAtLength(
  last: Vertex,
  hover: Vertex | null,
  lengthM: number,
  stepM: number,
): Vertex | null {
  if (!hover) return null;
  const dx = hover.x - last.x;
  const dy = hover.y - last.y;
  const mag = Math.hypot(dx, dy);
  if (mag < 1e-9) return null;

  const L = Number(snapToGrid(lengthM, stepM).toFixed(4));
  if (!(L > 0)) return null;

  return {
    x: Number((last.x + (dx / mag) * L).toFixed(4)),
    y: Number((last.y + (dy / mag) * L).toFixed(4)),
  };
}
