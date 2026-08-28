/**
 * gridTier — decide what grid to DRAW, independently of what the tool SNAPS to
 * (units brief 2026-08-28, D6).
 *
 * The two are deliberately decoupled. Before this, the visible grid was a
 * hardcoded `0.5 * pxPerMetre` and the major cadence was `i % 2 === 0`. Once
 * the snap step became user-selectable, drawing one line per snap step would
 * be ruinous at the fine end: a 20 x 15 m room is 72 Konva nodes at 0.5 m and
 * **3,502** at 1 cm, and the L/W clamp permits 50 m, so 50 x 50 m at 1 cm is
 * 10,002 nodes for ONE room — rebuilt whenever the room list identity changes.
 *
 * Worse, it would buy nothing: at `pxPerMetre = 100` inside the 0.3–3 zoom
 * clamp, a 1 cm cell is at most 3 screen pixels. Sub-legible.
 *
 * So the drawn grid steps up to the finest candidate that is still legible
 * (>= MIN_GRID_PX on screen) and still affordable (<= MAX_GRID_LINES_PER_AXIS
 * across the span). The user keeps snapping at 1 cm while seeing a 10 cm grid,
 * and the canvas badge shows both so that is legible rather than confusing.
 */

/** Below this many screen pixels a grid line is visual noise, not guidance. */
export const MIN_GRID_PX = 8;

/** Hard ceiling on Konva Line nodes per axis, per room. */
export const MAX_GRID_LINES_PER_AXIS = 400;

/** The steps the DRAWN grid may use, coarse-ward from the finest unit. */
export const CANDIDATES = [0.01, 0.1, 0.25, 0.5, 1, 10];

/**
 * Major-line cadence per minor step. EXPLICIT, never derived.
 *
 * This table exists because deriving it bit the original design: a
 * "smallest candidate >= minor x 5" rule turns a 0.5 m minor into
 * `minor * 5 = 2.5`, whose smallest candidate >= 2.5 is **10** — silently
 * changing the default from a major line every 1 m to every 10 m, i.e. no
 * major lines at all inside a normal room. A lookup cannot drift like that.
 */
export const MAJOR_FOR_MINOR: Record<number, number> = {
  0.01: 0.05,
  0.1: 0.5,
  0.25: 1,
  0.5: 1,
  1: 5,
  10: 50,
};

export interface GridTier {
  /** Metres between minor lines. 0 means "draw no grid at all". */
  minorStepM: number;
  /** Metres between major (brighter) lines. 0 when minorStepM is 0. */
  majorStepM: number;
}

/**
 * Choose the drawn grid tier.
 *
 * @param snapStepM     the unit the user picked — the drawn grid is never finer
 * @param pxPerMetre    canvas scale factor
 * @param viewportScale live zoom (0.3–3)
 * @param spanM         the larger room dimension, so the line cap is computable
 *
 * Returns `{minorStepM: 0, majorStepM: 0}` when even the coarsest candidate is
 * sub-legible or over the cap — the caller then emits zero lines rather than
 * something illegible.
 */
export function chooseGridTier(
  snapStepM: number,
  pxPerMetre: number,
  viewportScale: number,
  spanM: number,
): GridTier {
  const onScreenPx = (s: number): number => s * pxPerMetre * viewportScale;

  // 1 — finest candidate that is at least as coarse as the snap step AND
  //     legible on screen.
  let idx = CANDIDATES.findIndex(
    (s) => s >= snapStepM - 1e-9 && onScreenPx(s) >= MIN_GRID_PX,
  );
  if (idx < 0) return { minorStepM: 0, majorStepM: 0 };

  // 2 — step coarser until the line count fits the per-axis cap.
  while (idx < CANDIDATES.length && spanM / CANDIDATES[idx] + 1 > MAX_GRID_LINES_PER_AXIS) {
    idx++;
  }

  // 3 — nothing on the ladder satisfies both constraints.
  if (idx >= CANDIDATES.length) return { minorStepM: 0, majorStepM: 0 };

  const minorStepM = CANDIDATES[idx];
  return { minorStepM, majorStepM: MAJOR_FOR_MINOR[minorStepM] ?? minorStepM * 2 };
}
