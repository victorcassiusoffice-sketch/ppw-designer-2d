import { DoubleSide, Vector3, type Ray } from 'three';
import { pointInPolygon, type Vertex } from '../lib/geometry';
import { GROUND_LEVEL_ID } from '../designer/levels';
import { roofHeightAt } from '../designer/roofSurface';
import { capsuleClear, createWalker, groundHeight, stairHeightAt } from './collision';
import type { WalkSpawn, WalkWorld } from './types';

export interface PlacementHint { point: Vertex; levelId: string }

/** Actual finished heights at this plan point, restricted to the requested storey. */
function surfaceHeights(world: WalkWorld, point: Vertex, levelId: string): number[] {
  const roofs = (world.roofSurfaces ?? []).filter(r => r.levelId === levelId && pointInPolygon(point, r.surface.polygon));
  if (roofs.length) {
    return roofs.filter(r => r.surface.config.style === 'flat' || 1 / Math.hypot(1, r.surface.slope) > .55)
      .map(r => roofHeightAt(r.surface, point));
  }
  const ground = world.groundLevelId ?? GROUND_LEVEL_ID;
  const heights: number[] = [];
  for (const floor of world.floors) {
    if ((floor.levelId ?? ground) === levelId && pointInPolygon(point, floor.polygon) &&
        !floor.holes?.some(hole => pointInPolygon(point, hole))) heights.push(floor.elevationM ?? 0);
  }
  for (const patch of world.outdoor ?? []) {
    if (levelId === patch.levelId && pointInPolygon(point, patch.polygon)) heights.push(patch.elevationM);
  }
  for (const entry of world.stairs) {
    if (entry.stair.fromLevelId !== levelId && entry.stair.toLevelId !== levelId) continue;
    const y = stairHeightAt(entry, point.x, point.y);
    if (y !== null) heights.push(y);
  }
  return heights.sort((a, b) => b - a);
}

/** Feet on a sloped face need clearance for the rounded capsule base. */
export function roofFootOffset(world: WalkWorld, point: Vertex, height: number, radius: number): number {
  if (!world.roofActive) return 0;
  const roof = world.roofSurfaces?.find(r => pointInPolygon(point, r.surface.polygon) &&
    Math.abs(roofHeightAt(r.surface, point) - height) < .035);
  return roof && roof.surface.config.style !== 'flat' ? radius * (Math.hypot(1, roof.surface.slope) - 1) : 0;
}

export function authoredSupport(world: WalkWorld, point: Vertex, height: number): boolean {
  if (world.roofActive && world.roofSurfaces?.some(r => pointInPolygon(point, r.surface.polygon) &&
      Math.abs(roofHeightAt(r.surface, point) - height) < .035)) return true;
  if (world.floors.some(f => Math.abs((f.elevationM ?? 0) - height) < .035 &&
      pointInPolygon(point, f.polygon) && !f.holes?.some(h => pointInPolygon(point, h)))) return true;
  if (world.outdoor?.some(f => Math.abs(f.elevationM - height) < .035 && pointInPolygon(point, f.polygon))) return true;
  return world.stairs.some(s => Math.abs((stairHeightAt(s, point.x, point.y) ?? Infinity) - height) < .035);
}

export function standingAt(world: WalkWorld, point: Vertex, levelId: string, nearHeight?: number): WalkSpawn | null {
  const roof = (world.roofSurfaces ?? []).find(r => r.levelId === levelId && pointInPolygon(point, r.surface.polygon));
  const collision = !!roof === !!world.roofActive ? world : { ...world, roofActive: !!roof };
  for (const y of surfaceHeights(world, point, levelId)) {
    if (nearHeight !== undefined && Math.abs(y - nearHeight) > .25) continue;
    const support = groundHeight(collision, point.x, point.y, y + .025, .06);
    if (support === null || Math.abs(y - support) > .015) continue;
    const position = new Vector3(point.x, support + .001, point.y);
    const state = createWalker(collision, position);
    position.y += roofFootOffset(collision, point, support, state.radius);
    state.position.copy(position);
    if (capsuleClear(collision, state)) return { position, yaw: 0 };
  }
  return null;
}

/** A local nudge is allowed around furniture, but an off-site drop stays invalid. */
export function spawnAt(world: WalkWorld, point: Vertex, levelId: string): WalkSpawn | null {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y) || !surfaceHeights(world, point, levelId).length) return null;
  const exact = standingAt(world, point, levelId);
  if (exact) return exact;
  for (let radius = .25; radius <= 1; radius += .25) {
    for (let i = 0; i < 16; i++) {
      const angle = i * Math.PI / 8;
      const result = standingAt(world, { x: point.x + radius * Math.cos(angle), y: point.y + radius * Math.sin(angle) }, levelId);
      if (result) return result;
    }
  }
  return null;
}

export function spawnOnLevel(world: WalkWorld, levelId: string, preferred?: Vertex): WalkSpawn | null {
  if (preferred) {
    const nearby = spawnAt(world, preferred, levelId);
    if (nearby) return nearby;
  }
  const polygons = [
    ...world.floors.filter(f => (f.levelId ?? world.groundLevelId ?? GROUND_LEVEL_ID) === levelId).map(f => f.polygon),
    ...(world.roofSurfaces ?? []).filter(r => r.levelId === levelId).map(r => r.surface.polygon),
    ...(world.outdoor ?? []).filter(p => p.levelId === levelId).map(p => p.polygon),
  ];
  for (const polygon of polygons) {
    if (polygon.length < 3) continue;
    const xs = polygon.map(p => p.x), ys = polygon.map(p => p.y);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const middle = spawnAt(world, { x: (x0 + x1) / 2, y: (y0 + y1) / 2 }, levelId);
    if (middle) return middle;
    const stride = Math.max(.45, (x1 - x0) / 28, (y1 - y0) / 28);
    for (let y = y0 + .24; y < y1; y += stride) for (let x = x0 + .24; x < x1; x += stride) {
      const found = standingAt(world, { x, y }, levelId);
      if (found) return found;
    }
  }
  return null;
}

export function pickSpawn(world: WalkWorld, ray: Ray, levelId: string): WalkSpawn | null {
  if (Math.abs(ray.direction.y) < .00001) return null;
  const candidates: { distance: number; point: Vertex }[] = [];
  // A ray hits the chosen storey even when a higher slab hides it in the house view.
  const heights = new Set(world.floors.filter(f => (f.levelId ?? world.groundLevelId) === levelId).map(f => f.elevationM ?? 0));
  for (const patch of world.outdoor ?? []) if (patch.levelId === levelId) heights.add(patch.elevationM);
  for (const stair of world.stairs) if (stair.stair.fromLevelId === levelId || stair.stair.toLevelId === levelId) {
    for (let i = 1; i <= stair.count; i++) heights.add(stair.baseM + i * stair.riserM);
  }
  for (const elevation of heights) {
    const distance = (elevation - ray.origin.y) / ray.direction.y;
    if (distance < 0) continue;
    const hit = ray.at(distance, new Vector3());
    const point = { x: hit.x, y: hit.z };
    if (surfaceHeights(world, point, levelId).some(y => Math.abs(y - elevation) < .015)) candidates.push({ distance, point });
  }
  if (world.roofSurfaces?.some(r => r.levelId === levelId)) {
    for (const hit of world.roofBVH?.raycast(ray, DoubleSide) ?? []) {
      const point = { x: hit.point.x, y: hit.point.z };
      if (surfaceHeights(world, point, levelId).some(y => Math.abs(y - hit.point.y) < .02)) candidates.push({ distance: hit.distance, point });
    }
  }
  const first = candidates.sort((a, b) => a.distance - b.distance)[0];
  return first ? spawnAt(world, first.point, levelId) : null;
}
