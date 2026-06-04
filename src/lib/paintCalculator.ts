/**
 * Tweak 03 (Phase C) — paint calculator.
 *
 * Per `06-Roadmap/sims-parity/master/CODE-RUNNER-DESIGN-TWEAK-1/03-walls-paint-panels.md`:
 *
 *   "Paint calculator output appears in details panel: wall surface
 *    area in m² → litres needed (assume 1 L per 10 m² per coat, 2 coats
 *    default) → product SKU + price from MU supplier feed."
 *
 *   "m²-to-litre math is unit-tested (Playwright assertion + a Vitest
 *    unit test)."
 *
 * Pure math, no DOM, no Konva. Lives outside the API folder so the
 * /api/calc/[type] catch-all + the React DetailsPanel both call the
 * same code.
 */

import {
  ECO_PAINT_PALETTE,
  findPaintById,
  type EcoPaintColour,
} from '../data/paintPalette.js';
import type { WallSegment } from '../store/wallStore';

export interface PaintCalcInput {
  /** Walls to paint — endpoints in mm, height in mm. */
  walls: WallSegment[];
  /** Palette id (`EcoPaintColour.id`). When omitted the calculator
   *  returns the area + per-coat litres only, with no SKU / price. */
  paintId?: string;
  /** Override the default 2 coats (used by primer-only or single-coat
   *  scenarios). Falls back to the palette's `default_coats`. */
  coats?: number;
}

export interface PaintCalcResult {
  /** Total wall area in m² across the input walls. */
  total_area_m2: number;
  /** Litres required for one coat at the chosen paint's coverage. */
  litres_per_coat: number;
  /** Effective coats (input override OR palette default OR 2). */
  coats: number;
  /** Total litres rounded up to the nearest whole litre. */
  litres_total: number;
  /** Paint product chosen (when `paintId` resolves). */
  paint?: EcoPaintColour;
  /** Total price in MUR (litres_total × price_per_litre). */
  total_price_mur?: number;
}

/**
 * Compute the surface area of a single wall segment in square metres.
 * Endpoints are stored in millimetres (wallStore), as is the height.
 */
export function wallAreaM2(wall: WallSegment): number {
  const dx_mm = wall.end.x_mm - wall.start.x_mm;
  const dy_mm = wall.end.y_mm - wall.start.y_mm;
  const lengthMm = Math.hypot(dx_mm, dy_mm);
  return (lengthMm * wall.height_mm) / 1_000_000;
}

/**
 * Sum of wall areas across a wall set. Used by the catch-all endpoint
 * + the details-panel preview when several walls share a treatment.
 */
export function totalWallAreaM2(walls: WallSegment[]): number {
  return walls.reduce((acc, w) => acc + wallAreaM2(w), 0);
}

/**
 * Round-up-to-litre helper. Manufacturers round to whole tin sizes —
 * 1 L / 2.5 L / 5 L — but for the calculator we floor at 1 L
 * increments. The DetailsPanel can choose to suggest the next-larger
 * standard tin size on top.
 */
function ceilLitres(litres: number): number {
  if (litres <= 0) return 0;
  return Math.ceil(litres);
}

export const PAINT_CALC_DEFAULT_COATS = 2;
export const PAINT_CALC_DEFAULT_COVERAGE_M2_PER_LITRE = 10;

/**
 * Core calculator. Pure function — no `this`, no module-state.
 *
 *   total_area  = Σ wallAreaM2
 *   litres/coat = ceil(total_area / coverage)
 *   litres_total = ceil(total_area * coats / coverage)
 *
 * When a `paintId` is supplied the per-litre coverage and per-litre
 * price come from the palette entry; otherwise the brief's default
 * "1 L per 10 m² per coat, 2 coats default" kicks in and price is
 * left undefined.
 */
export function calculatePaint(input: PaintCalcInput): PaintCalcResult {
  const area = totalWallAreaM2(input.walls);
  const paint = input.paintId ? findPaintById(input.paintId) : undefined;
  const coverage = paint?.coverage_m2_per_litre ?? PAINT_CALC_DEFAULT_COVERAGE_M2_PER_LITRE;
  const coats = input.coats ?? paint?.default_coats ?? PAINT_CALC_DEFAULT_COATS;

  // litres needed for ONE coat across the whole surface.
  const litres_per_coat = coverage > 0 ? area / coverage : 0;
  // Round up the TOTAL — we can't buy a 0.7 L tin.
  const litres_total = ceilLitres(area * coats / coverage);

  const result: PaintCalcResult = {
    total_area_m2: area,
    litres_per_coat,
    coats,
    litres_total,
  };

  if (paint) {
    result.paint = paint;
    result.total_price_mur = litres_total * paint.price_per_litre_mur;
  }

  return result;
}

/**
 * For the eco filter UI — re-export the palette so callers don't have
 * to import from two places. The filter `eco_certified === true` is
 * automatic since every palette entry is hard-coded to true.
 */
export function listEcoPaints(): EcoPaintColour[] {
  return ECO_PAINT_PALETTE;
}
