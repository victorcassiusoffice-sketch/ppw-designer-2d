/**
 * Airplane cabin seat-map MODEL (DESIGNER-EXPANSION P5).
 *
 * Pure, renderer-agnostic geometry for the airplane domain's 2D top-down
 * seat-map. The model is computed from the P3 `FuselageSectionSpace.floorGrid`
 * (`rows × cols` at a fixed seat pitch) and consumed by BOTH the Konva canvas
 * (`AirplaneSeatMapCanvas`) and the no-canvas DOM/SVG fallback, so the layout
 * is identical regardless of renderer (the repo's Konva pattern: pure math
 * here, pixels in the renderer).
 *
 * `pitchCm` is the cm-per-cell; positions snap to the engine-wide 50 cm grid
 * via the shared `snapToGrid` so the airplane reuses the same placement/snap
 * rules as the wellness room (data-flow §8: one pure snap fn, every engine).
 */
import type { FuselageSectionSpace } from './templates';
import { snapToGrid } from '../../designer/useGridSnap';

/** One seat cell positioned in the cabin, in pixels. */
export interface SeatCell {
  row: number;
  col: number;
  /** Stable id `r{row}-c{col}` for keys + placement lookup. */
  id: string;
  /** Top-left x in px. */
  xPx: number;
  /** Top-left y in px. */
  yPx: number;
  /** Cell side in px (square seat footprint). */
  sizePx: number;
}

export interface SeatMap {
  rows: number;
  cols: number;
  cells: SeatCell[];
  /** Overall map width/height in px (for the Stage / SVG viewBox). */
  widthPx: number;
  heightPx: number;
}

export interface SeatMapOptions {
  /** Pixels per metre (defaults to a sensible cabin scale). */
  pxPerMetre?: number;
  /** Gap between seat cells, px. */
  gapPx?: number;
}

const DEFAULT_PX_PER_METRE = 60;
const DEFAULT_GAP_PX = 6;

/**
 * Build the seat-map for a fuselage section. Deterministic + pure: same input
 * → byte-identical output, so it round-trips and unit-tests cleanly.
 */
export function buildSeatMap(
  space: FuselageSectionSpace,
  options: SeatMapOptions = {},
): SeatMap {
  const pxPerMetre = options.pxPerMetre ?? DEFAULT_PX_PER_METRE;
  const gapPx = options.gapPx ?? DEFAULT_GAP_PX;
  const { rows, cols, pitchCm } = space.floorGrid;

  // Seat footprint = pitch (cm → m → px), snapped to the 50 cm engine grid so
  // the airplane shares the wellness placement rules.
  const pitchMm = pitchCm * 10;
  const snappedPitchMm = snapToGrid({ xMm: pitchMm, yMm: pitchMm }).xMm;
  const sizePx = Math.max(8, (snappedPitchMm / 1000) * pxPerMetre);
  const stride = sizePx + gapPx;

  const cells: SeatCell[] = [];
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      cells.push({
        row: r,
        col: c,
        id: `r${r}-c${c}`,
        xPx: c * stride,
        yPx: r * stride,
        sizePx,
      });
    }
  }

  return {
    rows,
    cols,
    cells,
    widthPx: cols > 0 ? cols * stride - gapPx : 0,
    heightPx: rows > 0 ? rows * stride - gapPx : 0,
  };
}
