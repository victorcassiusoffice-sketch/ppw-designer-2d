/**
 * floorFinish — resolving a room's floor material.
 *
 * ONE canonical catalog: `FLOOR_MATERIALS`. There were two overlapping ones
 * with ZERO id overlap — `FLOOR_MATERIALS` (per-unit price + coverage, which
 * the estimator already used) and `ECO_FLOORING_CATALOG` (per-m²). Wiring a
 * picker to the wrong one silently priced every floor at Rs 0, because the
 * lookup simply missed and the cost loop skipped it.
 *
 * FLOOR_MATERIALS wins because it carries `coverage_m2_per_unit`, and a
 * customer buys tiles and rolls, not square metres. The legacy eco ids are
 * mapped across so anything already persisted still resolves.
 */
import { FLOOR_MATERIALS, type FloorMaterial } from '../data/floorMaterials';

/** Legacy `ECO_FLOORING_CATALOG` id -> canonical `FLOOR_MATERIALS` id. */
const LEGACY_ID_MAP: Record<string, string> = {
  'k1-eva-combat-mat': 'eva-combat',
  'k1-rubber-interlock': 'rubber-composite',
  'k1-outdoor-rubber-tile': 'outdoor-1m',
  'k1-epdm-roll-6mm': 'epdm-roll',
};

export function resolveFloorMaterial(materialId: string | null | undefined): FloorMaterial | null {
  if (!materialId) return null;
  const id = LEGACY_ID_MAP[materialId] ?? materialId;
  return FLOOR_MATERIALS.find((m) => m.id === id) ?? null;
}

/** The material covering a room, or null for a bare floor. */
export function roomFloorMaterial(
  room: { floorFinish?: { materialId: string } | null },
): FloorMaterial | null {
  return resolveFloorMaterial(room.floorFinish?.materialId);
}

/**
 * What to order for an area: packs are whole units, and a waste factor covers
 * offcuts. Quoting net area short-orders the job, which is the classic
 * flooring-estimate mistake.
 */
export function floorOrder(areaM2: number, mat: FloorMaterial, wasteFactor = 0.1) {
  const orderedM2 = areaM2 * (1 + wasteFactor);
  const units = Math.ceil(orderedM2 / mat.coverage_m2_per_unit);
  return {
    netM2: areaM2,
    orderedM2,
    units,
    unit: mat.unit,
    totalMur: units * mat.price_per_unit_mur,
  };
}
