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
