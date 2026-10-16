import { z } from 'zod';
import type { Property } from '../store/propertyStore';
import { footprintUnionArea, propertyMaterialsGeometry } from './propertyMaterials';
import { estimateMaterials, normaliseMaterialsSettings } from './materials';
import { isOutdoorRoom, isRoofRoom, roomLevelId, storeyLevels, levelsOf } from './levels';
import { serviceRunLengthM } from './buildingServices';
import { assessProjectCalculationBudget } from './projectCalculationBudget';

export const COMPANY_TYPES = [
  'developers',
  'merchants',
  'construction',
  'plumbing',
  'landscape',
  'city',
] as const;
export type CompanyType = (typeof COMPANY_TYPES)[number];
export const DEPARTMENTS = [
  'design',
  'engineering',
  'procurement',
  'delivery',
  'sales',
  'client',
] as const;
export type Department = (typeof DEPARTMENTS)[number];
export const COMPANY_DEPARTMENTS: Record<CompanyType, readonly Department[]> = {
  developers: ['design', 'engineering', 'procurement', 'delivery', 'client'],
  merchants: ['sales', 'design', 'procurement', 'delivery'],
  construction: ['engineering', 'design', 'procurement', 'delivery'],
  plumbing: ['design', 'engineering', 'procurement', 'delivery'],
  landscape: ['design', 'engineering', 'procurement', 'client'],
  city: ['design', 'engineering', 'procurement', 'delivery', 'client'],
};
export const ENGINE_REGISTRY = [
  {
    id: 'geometry',
    version: 1,
    unit: 'm / m²',
    source: 'propertyMaterials.ts',
    purpose: 'per-storey polygon unions and deduplicated physical walls',
  },
  {
    id: 'materials',
    version: 1,
    unit: 'm³ / kg / packs',
    source: 'materials/estimate.ts',
    purpose: 'net geometry, explicit allowances, mix parts and whole stock',
  },
  {
    id: 'services',
    version: 1,
    unit: 'm',
    source: 'buildingServices.ts',
    purpose: 'centre-line lengths including declared elevation change',
  },
  {
    id: 'eco-review',
    version: 1,
    unit: 'm / kg / kPa',
    source: 'projectReview.ts',
    purpose: 'evidence-based review findings, never structural certification',
  },
  {
    id: 'presentation',
    version: 1,
    unit: 'm',
    source: 'professionalViews.ts',
    purpose: 'paired plan and 3D projections of canonical dimensions',
  },
] as const;

/** Department summaries reuse the estimating engine; presentation never re-derives dimensions. */
export function projectMetrics(property: Property) {
  const budget = assessProjectCalculationBudget(property);
  if (!budget.ok)
    return {
      available: false as const,
      unavailableReason: budget.reason,
      floorAreaM2: null,
      footprintM2: null,
      floors: null,
      rooms: null,
      objects: null,
      serviceLengthM: null,
      wallNetAreaM2: null,
      concreteNetM3: null,
      materials: null,
    };
  const indoor = property.rooms.filter((r) => !isOutdoorRoom(r) && !isRoofRoom(r));
  const floors = [...new Set(indoor.map(roomLevelId))];
  const floorAreaM2 = floors.reduce(
    (sum, level) =>
      sum +
      footprintUnionArea(indoor.filter((r) => roomLevelId(r) === level).map((r) => r.polygon)),
    0,
  );
  const geometry = propertyMaterialsGeometry(property, 'all');
  const materials = estimateMaterials(geometry, {
    ...normaliseMaterialsSettings(property.materials),
    scope: 'all',
  });
  return {
    available: true as const,
    unavailableReason: null,
    floorAreaM2,
    footprintM2: geometry.baseAreaM2,
    floors: storeyLevels(levelsOf(property)).length,
    rooms: indoor.filter((r) => r.polygon.length >= 3).length,
    objects: property.rooms.reduce((sum, room) => sum + room.placedItems.length, 0),
    serviceLengthM: (property.services?.runs ?? []).reduce(
      (sum, run) => sum + serviceRunLengthM(run),
      0,
    ),
    wallNetAreaM2: materials.totals.wallNetAreaM2,
    concreteNetM3: materials.totals.concreteNetM3,
    materials,
  };
}

const key = z
  .string()
  .min(1)
  .max(128)
  .refine((v) => !['__proto__', 'constructor', 'prototype'].includes(v));
const civilDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => {
    const d = new Date(`${v}T12:00:00Z`);
    return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === v;
  });
export const DepartmentTaskSchema = z
  .object({
    id: key,
    department: z.enum(DEPARTMENTS),
    title: z.string().trim().min(1).max(240),
    note: z.string().max(2000).default(''),
    status: z.enum(['open', 'review', 'done']),
    due: civilDate.optional(),
  })
  .strict();
export type DepartmentTask = z.infer<typeof DepartmentTaskSchema>;
export const ProjectRegisterSchema = z
  .object({
    version: z.literal(1),
    projectId: key,
    revision: z
      .number()
      .int()
      .min(0)
      .max(Number.MAX_SAFE_INTEGER - 1),
    tasks: z.array(DepartmentTaskSchema).max(300),
  })
  .strict()
  .superRefine((register, context) => {
    if (new Set(register.tasks.map((t) => t.id)).size !== register.tasks.length)
      context.addIssue({ code: 'custom', path: ['tasks'], message: 'Duplicate task identifiers.' });
  });
export type ProjectRegister = z.infer<typeof ProjectRegisterSchema>;

/** Stable canonical JSON: changing a selected room/floor is not a design revision. */
export function projectRevisionSource(property: Property): string {
  const design: Record<string, unknown> = { ...property };
  delete design.activeRoomId;
  delete design.activeLevelId;
  const stable = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(stable);
    if (value && typeof value === 'object')
      return Object.fromEntries(
        Object.entries(value)
          .filter(([, v]) => v !== undefined)
          .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
          .map(([k, v]) => [k, stable(v)]),
      );
    return value;
  };
  return JSON.stringify(stable(design));
}
export async function projectFingerprint(property: Property): Promise<string> {
  const data = new TextEncoder().encode(projectRevisionSource(property));
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', data));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}
export const HandoverSchema = z
  .object({
    format: z.literal('one-live-build/project-handover'),
    version: z.literal(1),
    units: z.literal('metres'),
    projectId: key,
    fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    register: ProjectRegisterSchema,
    // Snapshot is informational only. Import never replaces a design from untrusted JSON.
    snapshot: z.unknown(),
    engineVersions: z.unknown(),
    review: z.unknown(),
  })
  .strict()
  .refine((v) => v.register.projectId === v.projectId, 'Register belongs to a different project.');
export function parseProjectHandover(text: string) {
  if (new TextEncoder().encode(text).length > 5_000_000) throw new Error('handoverTooLarge');
  return HandoverSchema.parse(JSON.parse(text));
}
export function importHandoverTasks(
  register: ProjectRegister,
  incoming: z.infer<typeof HandoverSchema>,
  fingerprint: string,
): ProjectRegister {
  if (incoming.projectId !== register.projectId || incoming.fingerprint !== fingerprint)
    throw new Error('differentBuild');
  const seen = new Set(register.tasks.map((t) => t.id));
  const tasks = [...register.tasks, ...incoming.register.tasks.filter((t) => !seen.has(t.id))];
  return ProjectRegisterSchema.parse({ ...register, revision: register.revision + 1, tasks });
}
