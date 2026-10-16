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
import { GARDEN_SURFACES } from './garden';
import { outdoorSurfaceTakeoff, poolTakeoff } from './outdoorTakeoff';
import { findOutdoorPavingProduct } from '../data/outdoorPaving';
import { findPoolReference } from '../data/mauritiusPools';

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
  for (const surface of property.garden?.surfaces ?? []) {
    const pool = poolTakeoff(surface), layers = outdoorSurfaceTakeoff(surface);
    if (!pool && !layers) throw new Error(`Outdoor quantities unavailable for ${surface.id}: repair the saved dimensions first.`);
    // Display-only construction stage does not invalidate approvals/quantities.
    const measured = { ...surface, ...(surface.pool ? { pool: { ...surface.pool, stage: undefined } } : {}) };
    if (pool) {
      const reference = findPoolReference(surface.pool?.productReferenceId);
      const sources = reference ? [reference.sourceUrl] : [];
      add(`outdoor:${surface.id}:excavation`, 'Pool · rectangular excavation', 'landscape', pool.excavationVolumeM3, 'm3', '', sources, measured);
      add(`outdoor:${surface.id}:shell`, 'Pool · planning shell material volume', 'landscape', pool.shellVolumeM3, 'm3', '', sources, measured);
      add(`outdoor:${surface.id}:lining`, 'Pool · inside lining area', 'landscape', pool.liningAreaM2, 'm2', '', sources, measured);
      add(`outdoor:${surface.id}:water`, 'Pool · designed water volume', 'plumbing', pool.waterVolumeM3, 'm3', '', [], measured);
    } else if (layers) {
      const paving = surface.kind === 'path' ? findOutdoorPavingProduct(surface.pavingProductId) : undefined;
      const sources = paving ? [paving.sourceUrl] : [], label = GARDEN_SURFACES[surface.kind].label;
      // One physical material package: emitting area AND volume as separate
      // purchasable components would double count its cost/embodied carbon.
      add(`outdoor:${surface.id}:surface`, `${label} · ${layers.materialVolumeM3 === null ? 'surface area' : 'finished material volume'}`, 'landscape', layers.materialVolumeM3 ?? layers.areaM2, layers.materialVolumeM3 === null ? 'm2' : 'm3', paving?.name ?? '', sources, measured);
      if (layers.subBaseVolumeM3 !== null) add(`outdoor:${surface.id}:sub-base`, `${label} · sub-base volume`, 'landscape', layers.subBaseVolumeM3, 'm3', '', [], measured);
    }
  }
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
