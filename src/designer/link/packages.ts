import type { Property, Room } from '../../store/propertyStore';
import { polygonArea } from '../../lib/geometry';
import { serviceMaterialById } from '../../data/buildingServicesCatalog';
import { estimateServices, SERVICE_FIXTURES, SERVICE_SYSTEMS } from '../buildingServices';
import type { ServiceFixtureKind, ServiceSystem } from '../buildingServices';
import { resolveFloorMaterial } from '../floorFinish';
import { GROUND_LEVEL_ID, isOutdoorRoom, isRoofRoom, levelsOf, roomLevelId } from '../levels';
import { estimateMaterials, normaliseMaterialsSettings } from '../materials';
import { materialsProcurement, foundationProcurement } from '../materials/costs';
import { propertyMaterialsGeometry } from '../propertyMaterials';
import { roofSourceRooms } from '../roof';
import type { Quantity } from './vendor/tradefolder/lib/jobPack/types';

export type PackageCategory = 'masonry' | 'concrete' | 'roofing' | 'plastering' | 'plumbing' | 'electrical' | 'flooring' | 'tiling';
export type PackageTrade = 'general' | 'plastering' | 'plumbing' | 'electrical' | 'flooring' | 'tiling';
export type PackageQuantity = Quantity & { planRef: string };
export interface PackageDraft {
  /** Deterministic source key for matching an update. Not the public opaque package id. */
  key: string; category: PackageCategory; trade: PackageTrade; title: string; scope: string;
  levelIds: string[]; quantities: PackageQuantity[];
}
export interface PackageOptions {
  /** Optional exclusive assignment; an area never goes to both finish trades. */
  roomTrades?: Readonly<Record<string, 'flooring' | 'tiling'>>;
}

const titles: Record<PackageCategory, string> = {
  masonry: 'Masonry', concrete: 'Concrete and foundations', roofing: 'Roofing',
  plastering: 'Plastering', plumbing: 'Plumbing', electrical: 'Electrical', flooring: 'Flooring', tiling: 'Tiling',
};
const trades: Record<PackageCategory, PackageTrade> = {
  masonry: 'general', concrete: 'general', roofing: 'general', plastering: 'plastering',
  plumbing: 'plumbing', electrical: 'electrical', flooring: 'flooring', tiling: 'tiling',
};
const scope: Record<PackageCategory, string> = {
  masonry: 'Blocks, wall panels and joint-mortar ingredients from the wall schedule.',
  concrete: 'Concrete placement volumes include the specified allowance. Excavation is a single whole-foundation measure. Check the mix, bearing and reinforcement on site.',
  roofing: 'Roof covering, trims, fixings and scheduled steel. Roof slab concrete belongs to the concrete package.',
  plastering: 'Wall faces to finish and the scheduled plaster ingredients.',
  plumbing: 'Measured water, drainage and fire-water routes and fixtures. Coordination only.',
  electrical: 'Measured electrical and data routes, boards and devices. Coordination only.',
  flooring: 'Net indoor room floor area, not a stock or waste allowance. Check the finish and extent on site.',
  tiling: 'Net indoor room area for tiling review, not a tile count. Check partial coverage and cuts on site.',
};
const systems: Partial<Record<ServiceSystem, 'plumbing' | 'electrical'>> = {
  'cold-water': 'plumbing', 'hot-water': 'plumbing', waste: 'plumbing', 'fire-water': 'plumbing',
  electrical: 'electrical', data: 'electrical',
};
const fixtures: Partial<Record<ServiceFixtureKind, 'plumbing' | 'electrical'>> = {
  toilet: 'plumbing', sink: 'plumbing', 'mains-tap': 'plumbing', 'sewer-connection': 'plumbing',
  sprinkler: 'plumbing', 'electrical-board': 'electrical', 'network-switch': 'electrical', 'security-camera': 'electrical',
};
const printableUnit = (unit: string) => unit === 'sheets' || unit === 'bars' ? 'pieces' : unit;
function finishTrade(room: Room): 'tiling' | 'flooring' {
  // Coordinates and the room's name do not tell us what material it is.
  // Only assign a room to tiling from its actual finish selection.
  const ids = room.floorTiles?.length ? room.floorTiles.map(zone => zone.materialId) : room.floorFinish ? [room.floorFinish.materialId] : [];
  return ids.length && ids.every(id => resolveFloorMaterial(id)?.unit === 'tile') ? 'tiling' : 'flooring';
}

/** Reads the same whole-project takeoffs as the project hub, regardless of the
 * selected floor. Does not allocate an aggregate by area, repeat it on other
 * floors, calculate a price, mutate the property, or generate external IDs. */
export function packagesFromProperty(property: Property, options: PackageOptions = {}): PackageDraft[] {
  const levels = levelsOf(property);
  const names = new Map(levels.map(level => [level.id, level.name]));
  const indoor = property.rooms.filter(room => !isOutdoorRoom(room) && !isRoofRoom(room));
  const geometry = propertyMaterialsGeometry(property, 'all');
  const wallLevels = [...new Set(geometry.walls.map(w => w.levelId ?? GROUND_LEVEL_ID))];
  const roofLevels = [...new Set(roofSourceRooms(property).map(roomLevelId))];
  const settings = normaliseMaterialsSettings(property.materials);
  const report = estimateMaterials(geometry, { ...settings, scope: 'all' });
  const purchase = new Set(materialsProcurement(report).map(line => line.id));
  const groups = new Map<string, PackageDraft>();
  const warnings: string[] = [];
  function add(category: PackageCategory, levelsTouched: string[], item: string, raw: number, unit: string, planRef: string, perLevel = false) {
    if (raw === 0) return;
    const qty = Number(raw.toFixed(3)); // Only the exchange precision; no estimating math here.
    if (!Number.isFinite(qty) || qty < 0.001 || qty > 1000000)
      throw new RangeError(`${item}: quantity cannot be represented in a work file. Review the measurement before sending.`);
    if (!/^olb:(?:mat|fnd|run|item|room):[A-Za-z0-9_.:-]+$/.test(planRef) || planRef.length > 120)
      throw new RangeError(`${item}: its plan reference cannot be represented in this file.`);
    const key = perLevel ? `${category}:${levelsTouched[0]}` : category;
    let group = groups.get(key);
    if (!group) {
      const suffix = perLevel ? `, ${names.get(levelsTouched[0]) ?? levelsTouched[0]}` : '';
      group = { category, trade: trades[category], key, title: titles[category] + suffix,
        scope: scope[category], levelIds: [], quantities: [] };
      groups.set(key, group);
    }
    for (const id of levelsTouched) if (!group.levelIds.includes(id)) group.levelIds.push(id);
    group.quantities.push({ item, qty, unit: printableUnit(unit), planRef });
  }

  for (const l of report.lines) {
    // A bag count and the mass inside those same bags are alternatives. For
    // ingredients and stock counts follow the existing procurement selector.
    // Concrete is scoped by element volume, not again by "Concrete total".
    let category: PackageCategory | undefined;
    let touched = wallLevels;
    if (l.group === 'walls' && (purchase.has(l.id) || (l.id.startsWith('glass-') && l.role === 'component'))) category = 'masonry';
    if (l.group === 'walls' && l.id === 'walls-concrete') category = 'concrete';
    if (l.group === 'mortar' && (purchase.has(l.id) || l.id === 'mortar-aggregate')) category = 'masonry';
    if (l.group === 'plaster' && (purchase.has(l.id) || l.id === 'plaster-area' || l.id === 'plaster-aggregate')) category = 'plastering';
    if (l.group === 'base' && !property.foundation?.enabled) { category = 'concrete'; touched = [GROUND_LEVEL_ID]; }
    if (l.group === 'pillars') { category = 'concrete'; touched = indoor.map(roomLevelId); }
    if (l.group === 'roof' && l.id === 'roof-concrete') { category = 'concrete'; touched = roofLevels; }
    if ((l.group === 'sheet' || l.group === 'rebar') && purchase.has(l.id)) { category = 'roofing'; touched = roofLevels; }
    if (category) add(category, touched.length ? touched : [GROUND_LEVEL_ID], l.label, l.quantity, l.unit, `olb:mat:${l.id}`);
  }

  if (property.foundation?.enabled) {
    // This helper runs estimateFoundation once, using its drawing-union,
    // withheld-overlap and rebar decisions unchanged.
    const takeoff = foundationProcurement(property.foundation, settings.concrete);
    const measured = takeoff.foundation!;
    const participants = [...property.foundation.elements, ...(property.foundation.bores ?? [])];
    const anchor = participants.map(e => e.id).sort()[0];
    if (anchor) {
      if (measured.totalExcavationVolumeM3 === null)
        warnings.push('Combined excavation is withheld because holes overlap; check in Foundation.');
      else add('concrete', [GROUND_LEVEL_ID], 'Excavation', measured.totalExcavationVolumeM3, 'm³', `olb:fnd:${anchor}`);
      // The Materials base line holds the SAME drawn-foundation volume and
      // allowance. Use it as the concrete reference, never as a second line.
      const base = report.lines.find(l => l.id === 'base-concrete');
      if (base) add('concrete', [GROUND_LEVEL_ID], base.label, measured.concreteOrderM3, 'm³', 'olb:mat:base-concrete');
      for (const [i, line] of takeoff.lines.entries()) add('concrete', [GROUND_LEVEL_ID],
        line.label, line.quantity, line.unit, `olb:fnd:${measured.rebar[i].elementId}`);
    }
    warnings.push(...takeoff.incompleteReasons);
  }

  if (property.services) {
    const runs = new Map(property.services.runs.map(r => [r.id, r]));
    for (const line of estimateServices(property.services)) {
      const run = runs.get(line.id)!;
      const category = systems[run.system];
      if (category) add(category, [run.levelId],
        (line.verifiedMaterial && serviceMaterialById(run.materialId)?.label) || SERVICE_SYSTEMS.find(s => s.id === run.system)!.label,
        line.lengthM, 'm', `olb:run:${run.id}`, true);
    }
    for (const fixture of property.services.fixtures) {
      const category = fixtures[fixture.kind];
      if (category) add(category, [fixture.levelId], SERVICE_FIXTURES[fixture.kind].label, 1, 'each', `olb:item:${fixture.id}`, true);
    }
  }
  for (const room of indoor) {
    add(options.roomTrades?.[room.id] ?? finishTrade(room), [roomLevelId(room)], room.name || 'Room',
      polygonArea(room.polygon), 'm²', `olb:room:${room.id}`, true);
  }

  // When the foundation engine withholds its totals, keep the review issue
  // visible even for an excavation-only project. Never invent a substitute.
  if (warnings.length && !groups.has('concrete')) groups.set('concrete', {
    key: 'concrete', category: 'concrete', trade: 'general', title: titles.concrete,
    scope: scope.concrete, quantities: [], levelIds: [GROUND_LEVEL_ID],
  });
  const result: PackageDraft[] = [];
  for (const group of groups.values()) {
    // Area/routes already grouped by level; a very busy storey can still
    // exceed v1's 50 rows. Never discard the rest or duplicate a total.
    const lines = group.quantities.slice().sort((a,b) =>
      a.planRef < b.planRef ? -1 : a.planRef > b.planRef ? 1 : 0);
    for (let i = 0; i < Math.max(1, lines.length); i += 50) {
      const part = 1 + i / 50;
      result.push({ ...group,
        key: i ? `${group.key}/${part}` : group.key,
        title: group.title + (lines.length > 50 ? ` · part ${part}` : ''),
        scope: group.scope + (warnings.length && group.category === 'concrete' ? ' ' + warnings.join(' ') : ''),
        quantities: lines.slice(i, i + 50) });
    }
  }
  return result;
}
