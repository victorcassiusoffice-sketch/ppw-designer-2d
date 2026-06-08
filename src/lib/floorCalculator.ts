/**
 * Flooring calculator (P3-2, flooring arm) — sibling of paintCalculator.ts.
 *
 *   area_m2        = floor area to cover (room polygon area, m²)
 *   effective_area = area × (1 + waste%/100)   (cut-offset allowance)
 *   units_needed   = ceil(effective_area / coverage_m2_per_unit)
 *   total_price    = units_needed × price_per_unit_mur
 *
 * Pure math, no DOM, no Konva. Lives outside the API folder so the
 * `/api/calc/floor` catch-all + the React estimate panel call the same code.
 *
 * NOTE: relative imports MUST carry `.js` — this module is reachable from a
 * Vercel serverless function (Node ESM), where extensionless imports 500 at
 * runtime (see api/__tests__/esm-extension-guard.test.ts).
 */
import {
  FLOOR_MATERIALS,
  findFloorMaterialById,
  type FloorMaterial,
  type FloorUnit,
} from '../data/floorMaterials.js';

export const FLOOR_CALC_DEFAULT_WASTE_PCT = 10;

export interface FloorCalcInput {
  /** Floor area to cover, in m². */
  areaM2: number;
  /** Material id (`FloorMaterial.id`). When omitted, returns area + waste only. */
  materialId?: string;
  /** Cut/offset waste allowance as a percentage (default 10%). */
  wastePct?: number;
}

export interface FloorCalcResult {
  area_m2: number;
  /** Area inflated by the waste allowance, m². */
  effective_area_m2: number;
  waste_pct: number;
  /** Coverage per purchasable unit (from the material, or undefined). */
  coverage_m2_per_unit?: number;
  /** Whole units to buy (rounded up). 0 when no material chosen. */
  units_needed: number;
  unit?: FloorUnit;
  material?: FloorMaterial;
  /** units_needed × price_per_unit_mur (when a material resolves). */
  total_price_mur?: number;
}

function ceilUnits(n: number): number {
  if (n <= 0) return 0;
  return Math.ceil(n);
}

/** Clamp waste to a sane 0–50% band. */
function normaliseWaste(wastePct: number | undefined): number {
  if (wastePct === undefined || Number.isNaN(wastePct)) return FLOOR_CALC_DEFAULT_WASTE_PCT;
  return Math.max(0, Math.min(50, wastePct));
}

export function calculateFloor(input: FloorCalcInput): FloorCalcResult {
  const area = Math.max(0, input.areaM2 || 0);
  const waste = normaliseWaste(input.wastePct);
  const effective = area * (1 + waste / 100);
  const material = input.materialId ? findFloorMaterialById(input.materialId) : undefined;

  if (!material) {
    return {
      area_m2: area,
      effective_area_m2: effective,
      waste_pct: waste,
      units_needed: 0,
    };
  }

  const units = ceilUnits(effective / material.coverage_m2_per_unit);
  return {
    area_m2: area,
    effective_area_m2: effective,
    waste_pct: waste,
    coverage_m2_per_unit: material.coverage_m2_per_unit,
    units_needed: units,
    unit: material.unit,
    material,
    total_price_mur: units * material.price_per_unit_mur,
  };
}

/** Re-export so callers don't need a second import for the picker. */
export { FLOOR_MATERIALS };
