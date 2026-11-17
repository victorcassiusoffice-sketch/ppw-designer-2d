import { getProductById } from '../data/products';
import { tankCapacityLitres } from '../data/serviceProducts';
import { rotatedFootprint } from '../lib/geometry';
import type { Property } from '../store/propertyStore';
import { buildingLevels } from './building';
import { roomLevelId } from './levels';
import {
  serviceRunLengthM,
  type ServiceRun,
  type TankPortSide,
  type TankRoute,
} from './buildingServices';

export type { TankPortSide, TankRoute } from './buildingServices';
type TankProperty = Pick<Property, 'rooms' | 'levels' | 'wallHeightM'>;
type PlanPoint = { x: number; y: number };
type PipePoint = PlanPoint & { elevationM: number };

export interface PlacedTank {
  instanceId: string;
  productId: string;
  name: string;
  roomId: string;
  levelId: string;
  levelName: string;
  capacityLitres: number;
  heightM: number;
  lengthM: number;
  widthM: number;
  /** Plan centre. Heights are measured from the actual building floor datum. */
  x: number;
  y: number;
  baseElevationM: number;
  rotation: number;
}

export function placedTanks(property: TankProperty): PlacedTank[] {
  const levels = new Map(buildingLevels(property).map((entry) => [entry.level.id, entry]));
  const tanks: PlacedTank[] = [];
  for (const room of property.rooms) {
    const level = levels.get(roomLevelId(room));
    if (!level) continue;
    for (const item of room.placedItems) {
      const capacity = tankCapacityLitres(item.productId);
      if (!capacity) continue;
      const product = getProductById(item.productId);
      if (!product) continue;
      const dims = product.dimensions_cm;
      const lengthM = dims.length / 100,
        widthM = dims.width / 100;
      const footprint = rotatedFootprint({ lengthM, widthM }, item.rotation);
      tanks.push({
        instanceId: item.instanceId,
        productId: item.productId,
        name: product.name,
        roomId: room.id,
        levelId: level.level.id,
        levelName: level.level.name,
        capacityLitres: capacity,
        lengthM,
        widthM,
        heightM: dims.height / 100,
        x: item.x + footprint.w / 2,
        y: item.y + footprint.h / 2,
        baseElevationM: level.elevationM,
        rotation: item.rotation,
      });
    }
  }
  return tanks;
}

function outsideEdge(tank: PlacedTank): number {
  return tank.x + rotatedFootprint(tank, tank.rotation).w / 2;
}

const portAngle: Record<TankPortSide, number> = { east: 0, south: 90, west: 180, north: 270 };
function portPosition(tank: PlacedTank, side: TankPortSide = 'east') {
  const angle = ((tank.rotation + portAngle[side]) * Math.PI) / 180;
  const dx = Math.cos(angle),
    dy = Math.sin(angle);
  const radius = (side === 'north' || side === 'south' ? tank.widthM : tank.lengthM) / 2;
  return { point: { x: tank.x + radius * dx, y: tank.y + radius * dy }, dx, dy };
}

/** Lead clear of this tank's bounding box before turning toward the shaft.
 * A rear-facing port takes the nearer side of the tank to avoid cutting through its body. */
function leadPoints(
  tank: PlacedTank,
  side: TankPortSide | undefined,
  shaft: PlanPoint,
  elevationM: number,
): PipePoint[] {
  const { point: port, dx, dy } = portPosition(tank, side);
  const footprint = rotatedFootprint(tank, tank.rotation);
  const toX = Math.abs(dx) > 1e-8 ? (footprint.w / 2 + 0.15) / Math.abs(dx) : Infinity;
  const toY = Math.abs(dy) > 1e-8 ? (footprint.h / 2 + 0.15) / Math.abs(dy) : Infinity;
  const clear = Math.min(toX, toY);
  const stub = { x: tank.x + clear * dx, y: tank.y + clear * dy };
  const path = [port, stub];
  const crossesBody =
    Math.abs(stub.y - tank.y) < footprint.h / 2 &&
    (stub.x < tank.x ? shaft.x > tank.x - footprint.w / 2 : shaft.x < tank.x + footprint.w / 2);
  if (crossesBody) {
    const edgeY = tank.y + (shaft.y >= tank.y ? 1 : -1) * (footprint.h / 2 + 0.15);
    path.push({ x: stub.x, y: edgeY });
  }
  path.push({ x: shaft.x, y: path[path.length - 1].y }, shaft);
  return path.map((p) => ({ ...p, elevationM }));
}

function simplify(points: PipePoint[]): PipePoint[] {
  const result: PipePoint[] = [];
  const distance = (a: PipePoint, b: PipePoint) =>
    Math.hypot(a.x - b.x, a.y - b.y, a.elevationM - b.elevationM);
  for (const point of points) {
    const last = result[result.length - 1],
      before = result[result.length - 2];
    if (last && distance(last, point) < 1e-8) continue;
    if (
      before &&
      Math.abs(distance(before, last) + distance(last, point) - distance(before, point)) < 1e-8
    )
      result.pop();
    result.push(point);
  }
  return result;
}

function makeRun(
  source: PlacedTank | undefined,
  destination: PlacedTank | undefined,
  id: string,
  route: TankRoute,
  materialId: string,
  diameterMm: number,
): ServiceRun | null {
  if (!source || !destination || source.instanceId === destination.instanceId) return null;
  const outlet = route.outletHeightM ?? source.heightM * 0.15;
  const inlet = route.inletHeightM ?? destination.heightM * 0.85;
  if (!(outlet >= 0 && outlet <= source.heightM && inlet >= 0 && inlet <= destination.heightM))
    return null;
  const startElevationM = outlet,
    endElevationM = destination.baseElevationM - source.baseElevationM + inlet;
  const shaft = route.riser ?? {
    x: Math.max(outsideEdge(source), outsideEdge(destination)) + 0.35,
    y: portPosition(source, route.outletSide).point.y,
  };
  const points = simplify([
    ...leadPoints(source, route.outletSide, shaft, startElevationM),
    ...leadPoints(destination, route.inletSide, shaft, endElevationM).reverse(),
  ]);
  if (
    !points.every(
      (p) =>
        Number.isFinite(p.x) &&
        Math.abs(p.x) <= 10000 &&
        Number.isFinite(p.y) &&
        Math.abs(p.y) <= 10000 &&
        Number.isFinite(p.elevationM) &&
        Math.abs(p.elevationM) <= 10000,
    )
  )
    return null;
  const run: ServiceRun = {
    id,
    levelId: source.levelId,
    system: 'cold-water',
    materialId,
    diameterMm,
    points,
    startElevationM,
    endElevationM,
    tankRoute: route,
  };
  return points.length >= 2 && serviceRunLengthM(run) >= 0.01 ? run : null;
}

/** Drawing-only tank connection. The shank extends inside the opaque tank shell
 * so any tapered shoulder meets the exposed terminal. The purchased pipe starts
 * at the terminal; the tank-side hardware never enters measured pipe quantities. */
export interface TankPortNozzle {
  levelId: string;
  from: PlanPoint;
  terminal: PlanPoint;
  elevationM: number;
}
export function tankPortNozzles(tanks: PlacedTank[], run: ServiceRun): TankPortNozzle[] {
  const route = run.tankRoute;
  if (!route) return [];
  const source = tanks.find((t) => t.instanceId === route.from);
  const destination = tanks.find((t) => t.instanceId === route.to);
  if (!source || !destination) return [];
  function nozzle(
    tank: PlacedTank,
    side: TankPortSide | undefined,
    heightM: number,
  ): TankPortNozzle {
    return {
      levelId: tank.levelId,
      from: { x: tank.x, y: tank.y },
      terminal: portPosition(tank, side).point,
      elevationM: tank.baseElevationM + heightM,
    };
  }
  return [
    nozzle(source, route.outletSide, route.outletHeightM ?? source.heightM * 0.15),
    nozzle(destination, route.inletSide, route.inletHeightM ?? destination.heightM * 0.85),
  ];
}

export function createTankRun(
  property: TankProperty,
  id: string,
  route: TankRoute,
  materialId = 'hpl-aquasafe-upvc-32',
  diameterMm = 32,
): ServiceRun | null {
  if (!id || !materialId || !Number.isFinite(diameterMm) || diameterMm < 5 || diameterMm > 1000)
    return null;
  const tanks = placedTanks(property);
  return makeRun(
    tanks.find((t) => t.instanceId === route.from),
    tanks.find((t) => t.instanceId === route.to),
    id,
    route,
    materialId,
    diameterMm,
  );
}

/** Persist measured pipe geometry atomically with the tank edit, so ordinary
 * takeoffs, history, shared builds and old readers all consume the same pipe. */
export function synchroniseTankRuns(property: Property): Property {
  const services = property.services;
  if (!services?.runs.some((r) => r.tankRoute)) return property;
  const tanks = new Map(placedTanks(property).map((t) => [t.instanceId, t]));
  let changed = false;
  const runs = services.runs.flatMap((run) => {
    if (!run.tankRoute) return [run];
    const { from, to } = run.tankRoute;
    const next = makeRun(
      tanks.get(from),
      tanks.get(to),
      run.id,
      run.tankRoute,
      run.materialId,
      run.diameterMm,
    );
    if (
      next &&
      run.levelId === next.levelId &&
      run.system === next.system &&
      run.startElevationM === next.startElevationM &&
      run.endElevationM === next.endElevationM &&
      run.points.length === next.points.length &&
      run.points.every(
        (p, i) =>
          p.x === next.points[i].x &&
          p.y === next.points[i].y &&
          p.elevationM === next.points[i].elevationM,
      )
    )
      return [run];
    changed = true;
    return next ? [next] : [];
  });
  return changed ? { ...property, services: { ...services, runs } } : property;
}
