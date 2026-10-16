import {
  EcoSchema,
  EngineeringInputsSchema,
  type EcoModel,
  type EcoTree,
  type GreenRoof,
  type EngineeringInputs,
} from './ecoContract.js';
import { polygonArea } from '../lib/geometry.js';
import type { Property } from '../store/propertyStore.js';
import { isRoofRoom } from './levels.js';

export type { EcoModel, EcoTree, GreenRoof, EngineeringInputs } from './ecoContract.js';
export const ECO_LIMITS = { trees: 300, greenRoofs: 100 } as const;
export const emptyEco = (): EcoModel => ({ version: 1, trees: [], greenRoofs: [] });
export function normaliseEco(value: unknown): EcoModel | undefined {
  const parsed = EcoSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}
export function normaliseEngineeringInputs(value: unknown): EngineeringInputs | undefined {
  const parsed = EngineeringInputsSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

/** A circular BS5837 single-stem screening envelope, not mapped roots. The
 * normal 15 m cap does not apply to a veteran-tree assessment. Survey required. */
export function treeProtectionRadiusM(tree: EcoTree): number | null {
  if (tree.protectionMethod === 'surveyed') return tree.protectionRadiusM ?? null;
  if (tree.protectionMethod !== 'bs5837-single-stem' || tree.veteran || tree.stemDiameterMm == null)
    return null;
  return Math.min(15, (12 * tree.stemDiameterMm) / 1000);
}

export interface GreenRoofLoad {
  roofRoomId: string;
  areaM2: number | null;
  totalKgM2: number | null;
  totalMassKg: number | null;
  additionalLoadKPa: number | null;
  areaValid: boolean;
  hasRoof: boolean;
}
/** Saturated assembly plus explicitly additional water: 1 mm over 1 m² = 1 L
 * = approximately 1 kg. Standard gravity converts kg/m² to kN/m² (kPa).
 * No allowance or support capacity is invented. Roof area is horizontal plan. */
export function greenRoofLoad(property: Pick<Property, 'rooms'>, roof: GreenRoof): GreenRoofLoad {
  const room = property.rooms.find((r) => r.id === roof.roomId && isRoofRoom(r));
  const measured = room ? polygonArea(room.polygon) : 0;
  const area = roof.areaM2 ?? measured;
  const areaValid = measured > 0 && area > 0 && area <= measured + 1e-7;
  const totalKgM2 =
    roof.saturatedKgM2 == null ? null : roof.saturatedKgM2 + (roof.extraRetainedWaterMm ?? 0);
  return {
    roofRoomId: roof.roomId,
    areaM2: areaValid ? area : null,
    areaValid,
    hasRoof: Boolean(room),
    totalKgM2,
    totalMassKg: areaValid && totalKgM2 != null ? area * totalKgM2 : null,
    additionalLoadKPa: totalKgM2 == null ? null : (totalKgM2 * 9.80665) / 1000,
  };
}
