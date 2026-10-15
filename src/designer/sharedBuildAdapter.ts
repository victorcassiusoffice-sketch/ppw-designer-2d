import type { Property } from '../store/propertyStore';
import { assessProjectCalculationBudget } from './projectCalculationBudget';
import { propertyMaterialsGeometry, footprintUnionArea } from './propertyMaterials';
import { isOutdoorRoom, isRoofRoom, roomLevelId, levelsOf } from './levels';
import { resolveServiceConnections } from './serviceConnections';
import { serviceRunLengthM, SERVICE_FIXTURES } from './buildingServices';
import {
  serviceSystemDiscipline,
  serviceFixtureDiscipline,
  productDiscipline,
} from './disciplineVisibility';
import { SERVICE_MATERIALS } from '../data/buildingServicesCatalog';
import { BUILDING_EQUIPMENT } from '../data/buildingEquipmentCatalog';
import { getProductById } from '../data/products';
import { SharedSpecComponentSchema, type SharedSpecComponent } from './sharedSpecsContract';

/** Change detector only; never an authentication or cryptographic integrity token. */
export function specFingerprint(value: unknown): string {
  const text = JSON.stringify(value);
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
  return (hash >>> 0).toString(16);
}
export function measuredBuildSpecs(property: Property): SharedSpecComponent[] {
  const budget = assessProjectCalculationBudget(property);
  if (!budget.ok) throw new Error(`Spec quantities unavailable: ${budget.reason}`);
  const list: SharedSpecComponent[] = [];
  const add = (
    key: string,
    name: string,
    category: SharedSpecComponent['category'],
    quantity: number,
    unit: SharedSpecComponent['unit'],
    material = '',
    sources: string[] = [],
    geometry: unknown = quantity,
  ) => {
    list.push(
      SharedSpecComponentSchema.parse({
        id: key,
        sourceKey: key,
        sourceFingerprint: specFingerprint(geometry),
        sourceRemoved: false,
        category,
        name,
        quantity,
        unit,
        material,
        sources,
        notes: '',
        origin: 'unknown',
        status: 'draft',
      }),
    );
  };
  const geometry = propertyMaterialsGeometry(property, 'all');
  for (const level of levelsOf(property).filter((l) => l.kind !== 'roof' && l.id !== 'roof')) {
    const walls = geometry.walls.filter((w) => w.levelId === level.id);
    if (walls.length)
      add(
        `walls:${level.id}`,
        `${level.name} · wall package`,
        'wall',
        walls.reduce((sum, w) => sum + Math.max(0, w.lengthM * w.heightM - w.openingAreaM2), 0),
        'm2',
        '',
        [],
        {
          measured: walls,
          rooms: property.rooms
            .filter((r) => roomLevelId(r) === level.id)
            .map((r) => ({ id: r.id, polygon: r.polygon, openings: r.openings })),
          freeWalls: (property.walls ?? []).filter((w) => roomLevelId(w) === level.id),
        },
      );
    const rooms = property.rooms.filter(
      (r) => roomLevelId(r) === level.id && !isOutdoorRoom(r) && !isRoofRoom(r),
    );
    const area = footprintUnionArea(rooms.map((r) => r.polygon));
    if (area > 0)
      add(
        `floor:${level.id}`,
        `${level.name} · floor footprint`,
        'floor',
        area,
        'm2',
        '',
        [],
        rooms.map((r) => r.polygon),
      );
  }
  if (geometry.roofAreaM2 > 0)
    add(
      'roof:footprint',
      'Roof · horizontal footprint',
      'roof',
      geometry.roofAreaM2,
      'm2',
      '',
      [],
      { area: geometry.roofAreaM2, roof: property.materials?.roof },
    );
  if (geometry.foundationVolumeM3 !== undefined && geometry.foundationVolumeM3 > 0)
    add(
      'foundation:concrete',
      'Drawn foundation concrete',
      'foundation',
      geometry.foundationVolumeM3,
      'm3',
      '',
      [],
      property.foundation,
    );
  const services = resolveServiceConnections(
    property.services ?? { version: 1, runs: [], fixtures: [] },
  );
  for (const run of services.runs) {
    const source = SERVICE_MATERIALS.find((m) => m.id === run.materialId);
    add(
      `route:${run.id}`,
      `${run.system} · ${run.diameterMm} mm`,
      serviceSystemDiscipline(run.system) as SharedSpecComponent['category'],
      serviceRunLengthM(run),
      'm',
      source?.label ?? '',
      source ? [source.sourceUrl] : [],
      run,
    );
  }
  for (const fixture of services.fixtures) {
    const source = BUILDING_EQUIPMENT.find((p) => p.id === fixture.productReferenceId);
    add(
      `fixture:${fixture.id}`,
      SERVICE_FIXTURES[fixture.kind].label,
      serviceFixtureDiscipline(fixture.kind) as SharedSpecComponent['category'],
      1,
      'each',
      source?.label ?? '',
      source ? [source.sourceUrl] : [],
      fixture,
    );
  }
  for (const room of property.rooms)
    for (const item of room.placedItems) {
      const product = getProductById(item.productId);
      const discipline = productDiscipline(product);
      add(
        `item:${item.instanceId}`,
        product?.name ?? item.productId,
        discipline === 'structure' ? 'other' : (discipline as SharedSpecComponent['category']),
        1,
        'each',
        product?.name ?? '',
        [],
        { room: room.id, item },
      );
    }
  if (list.length > 500)
    throw new Error(
      'The shared register supports 500 components. Split this build into coordinated project packages; no components were silently omitted.',
    );
  return list;
}
/** Retain deleted source records for accountable review; never silently erase supplier work. */
export function measuredSyncPayload(
  existing: SharedSpecComponent[],
  incoming: SharedSpecComponent[],
): SharedSpecComponent[] {
  const present = new Set(incoming.map((c) => c.id));
  return [
    ...incoming,
    ...existing
      .filter((c) => c.sourceKey && !present.has(c.id))
      .map((c) => ({ ...c, sourceRemoved: true })),
  ];
}
