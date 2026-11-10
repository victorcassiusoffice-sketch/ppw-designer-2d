import type { Property } from '../../store/propertyStore';
import { cmToM, pointInPolygon, polygonArea, rotatedFootprint, type Vertex } from '../../lib/geometry';
import { getCatalog } from '../../data/products';
import { buildingLevels } from '../building';
import { isOutdoorRoom, isRoofLevel, isRoofRoom, levelsOf, roomLevelId, roofSourceLevelId } from '../levels';
import { CAP_THICKNESS_M } from '../roomView3d';
import { roomEdges } from '../wallEdges';
import { resolvedWallSurfaces } from '../wallConstruction';
import { openingVerticalBounds } from '../openingGeometry';
import { openingSpan } from '../openings';
import { SERVICE_FIXTURES, SERVICE_SYSTEMS, serviceRunLengthM, serviceRunPoints3D } from '../buildingServices';
import type { PlanView, WorkPackageInput } from './planView';

type Geometry = Pick<PlanView, 'levels' | 'rooms' | 'walls' | 'openings' | 'runs' | 'items' | 'notes'>;
const xy = (p: Vertex): [number,number] => [p.x,p.y];
const angle = (rotation: number) => ((rotation % 360) + 360) % 360;
const bundledItem: NonNullable<WorkPackageInput['resolveItem']> = id => {
  // The immutable bundled catalogue, not the active demo or API cache.
  const product = getCatalog().products.find(p => p.id === id);
  return product && {label:product.name,widthM:cmToM(product.dimensions_cm.length),depthM:cmToM(product.dimensions_cm.width)};
};

/** The Plan stage draws world x and y with positive pixel scale. Copy both
 * coordinates (including negatives): no recentering, reflection or unit guess. */
export function projectGeometry(
  property: Property, levelIds: string[], lookup: WorkPackageInput['resolveItem'] = bundledItem,
): Geometry {
  const allLevels = levelsOf(property);
  const host = roofSourceLevelId(allLevels, property.rooms);
  const requested = new Set(levelIds.map(id => allLevels.some(l => l.id === id && isRoofLevel(l)) && host ? host : id));
  const storeys = buildingLevels(property).filter(({level}) => !isRoofLevel(level) && requested.has(level.id));
  if (!storeys.length || [...requested].some(id => !storeys.some(({level}) => id === level.id)))
    throw new Error('Choose a storey in this plan for the work file.');
  const data: Geometry = {
    levels:storeys.map(({level,elevationM,heightM}) => ({ id:level.id,label:level.name,elevationM,heightM })),
    rooms:[], walls:[], openings:[], runs:[], items:[],
    notes:['Estimates from the plan. Check on site.', 'Coordination only.'],
  };
  if (levelIds.some(id => allLevels.some(l => l.id === id && isRoofLevel(l))))
    data.notes.push('Roof work is shown on its supporting storey. This plan view does not contain a roof profile.');
  const heights = new Map(data.levels.map(l => [l.id,l.heightM]));
  const physicalEdges = new Map<string, PlanView['walls'][number]>();
  let unknownProducts = 0;
  for (const room of property.rooms) {
    const levelId = roomLevelId(room);
    const heightM = heights.get(levelId);
    if (heightM === undefined || isRoofRoom(room)) continue;
    const interior = !isOutdoorRoom(room) && room.polygon.length >= 3;
    if (interior) {
      data.rooms.push({id:room.id,levelId,label:room.name,polygon:room.polygon.map(xy),areaM2:polygonArea(room.polygon)});
      const surface = resolvedWallSurfaces(room);
      for (const edge of roomEdges(room)) {
        const glass = surface.wallConstructionByEdge.get(edge.index) === 'glass';
        const a=xy(edge.a), b=xy(edge.b);
        const thicknessM=surface.wallThicknessByEdge.get(edge.index) ?? (glass ? .01 : CAP_THICKNESS_M);
        // Two rooms can share the same complete wall in opposite directions.
        // Do not draw a second solid segment across an opening in the first.
        const key=JSON.stringify([levelId,thicknessM,[a.join(','),b.join(',')].sort()]);
        let wall=physicalEdges.get(key);
        if (!wall) {
          wall={id:'wall-' + room.id + '-' + edge.index,levelId,a,b,heightM,thicknessM};
          data.walls.push(wall);physicalEdges.set(key,wall);
        }
        const sameDirection=wall.a[0]===a[0] && wall.a[1]===a[1];
        for (const opening of room.openings ?? []) if (opening.edgeIndex === edge.index) {
          const bounds = openingVerticalBounds(opening,heightM);
          // OLB anchors the opening at its centre, TF's wallSegments reads
          // offsetM as the START of a gap. Clip exactly as the OLB mesh does.
          const span=openingSpan(opening), start=Math.max(0,span.t0), end=Math.min(edge.lengthM,span.t1);
          if (bounds.heightM <= 0 || end <= start) continue;
          data.openings.push({id:opening.id,wallId:wall.id,
            kind:opening.kind === 'door' || opening.kind === 'window' ? opening.kind : 'opening',
            offsetM:sameDirection ? start : edge.lengthM-end,widthM:end-start,heightM:bounds.heightM,sillM:bounds.bottomM});
        }
      }
    }
    for (const item of room.placedItems) {
      const product = lookup(item.productId);
      if (!product) { unknownProducts++; continue; }
      const {widthM,depthM,label} = product;
      const bounds = rotatedFootprint({lengthM:widthM,widthM:depthM},item.rotation);
      data.items.push({id:item.instanceId,levelId,...(interior ? {roomId:room.id} : {}), label,
        center:[item.x + bounds.w/2,item.y + bounds.h/2],sizeM:[widthM,depthM],rotationDeg:angle(item.rotation)});
    }
  }
  if (unknownProducts) data.notes.push('Some placed products have no available dimensions and are omitted from this design view.');
  for (const wall of property.walls ?? []) {
    const levelId = roomLevelId(wall), heightM = heights.get(levelId);
    if (heightM !== undefined)
      data.walls.push({id:wall.id,levelId,a:xy(wall.a),b:xy(wall.b),thicknessM:wall.thicknessM,heightM});
  }
  for (const run of property.services?.runs ?? []) if (heights.has(run.levelId)) {
    data.runs.push({id:run.id,levelId:run.levelId,system:run.system,
      label:SERVICE_SYSTEMS.find(s => s.id === run.system)?.label ?? run.system,
      points:serviceRunPoints3D(run).map(p => [p.x,p.y,p.elevationM]),lengthM:serviceRunLengthM(run)});
  }
  for (const fixture of property.services?.fixtures ?? []) if (heights.has(fixture.levelId)) {
    const room = property.rooms.find(r => roomLevelId(r) === fixture.levelId && !isOutdoorRoom(r)
      && !isRoofRoom(r) && pointInPolygon(fixture,r.polygon));
    data.items.push({id:fixture.id,levelId:fixture.levelId,...(room ? {roomId:room.id} : {}),
      label:SERVICE_FIXTURES[fixture.kind].label,center:[fixture.x,fixture.y],
      sizeM:[fixture.widthM,fixture.depthM],rotationDeg:angle(fixture.rotation)});
  }
  return data;
}
