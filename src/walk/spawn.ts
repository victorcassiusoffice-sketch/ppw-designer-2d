import { Vector3 } from 'three';
import type { Property } from '../store/propertyStore';
import type { Vertex } from '../lib/geometry';
import { capsuleClear, createWalker, groundHeight } from './collision';
import type { WalkSpawn, WalkWorld } from './types';

function inside(point: { x: number; y: number }, polygon: Vertex[]): boolean {
  let result = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i], b = polygon[j];
    if ((a.y > point.y) !== (b.y > point.y) && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) result = !result;
  }
  return result;
}

/** Stable ground entry first, then a measured free patch of an actual ground slab. */
export function findWalkSpawn(world: WalkWorld, property: Property): WalkSpawn | null {
  const floors = world.floors.filter(f => !f.levelId || f.levelId === 'ground');
  if (!floors.length) return null;
  const lowest = Math.min(...floors.map(f => f.elevationM ?? 0));
  const ground = floors.filter(f => Math.abs((f.elevationM ?? 0) - lowest) < .01);
  const safe = (position: Vector3): boolean => {
    const plan = { x: position.x, y: position.z };
    if (!ground.some(f => inside(plan, f.polygon) && !(f.holes ?? []).some(h => inside(plan, h)))) return false;
    const state = createWalker(world, position);
    const support = groundHeight(world, position.x, position.z, position.y + state.height + .02, state.height + .05);
    // A tall furniture box can contain a capsule without intersecting its surface.
    // Probing from head height also excludes that containment and low ceilings.
    if (support === null || support < lowest - .015 || support > lowest + .08) return false;
    position.y = support + .001;
    state.position.copy(position);
    return capsuleClear(world, state);
  };
  const facing = (position: Vector3, preferredYaw: number): number => {
    let bestYaw = preferredYaw, bestDistance = -1;
    // Face a useful clear route. A valid capsule in a corner must not begin
    // looking straight into the nearest wall/window.
    for (let i = 0; i < 16; i++) {
      const yaw = preferredYaw + i * Math.PI / 8;
      const direction = new Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
      let distance = 0;
      for (let d = .2; d <= 3.01; d += .2) {
        if (!safe(position.clone().addScaledVector(direction, d))) break;
        distance = d;
      }
      if (distance > bestDistance + .001) { bestDistance = distance; bestYaw = yaw; }
    }
    return Math.atan2(Math.sin(bestYaw), Math.cos(bestYaw));
  };
  const entries = world.doors.filter(d => d.exterior && Math.abs(d.baseM - lowest) < .03);
  for (const door of entries) {
    const across = new Vector3(Math.cos(door.closedYaw), 0, -Math.sin(door.closedYaw));
    for (const clearance of [.8, 1.1, .5]) {
      const position = door.hinge.clone().addScaledVector(across, door.width / 2).addScaledVector(door.inward, clearance).setY(lowest + .001);
      if (safe(position)) return { position, yaw: facing(position, Math.atan2(-door.inward.x, -door.inward.z)) };
    }
  }
  let best: { position: Vector3; score: number; centre: Vector3 } | null = null;
  for (const floor of ground) {
    const xs = floor.polygon.map(p => p.x), zs = floor.polygon.map(p => p.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minZ = Math.min(...zs), maxZ = Math.max(...zs);
    const centre = new Vector3((minX + maxX) / 2, lowest + .001, (minZ + maxZ) / 2);
    const consider = (position: Vector3) => {
      const point = { x: position.x, y: position.z };
      if (!inside(point, floor.polygon) || (floor.holes ?? []).some(hole => inside(point, hole))) return;
      if (!safe(position)) return;
      let clearance = Infinity;
      for (const polygon of [floor.polygon, ...(floor.holes ?? [])]) {
        for (let i = 0; i < polygon.length; i++) {
          const a = polygon[i], b = polygon[(i + 1) % polygon.length];
          const dx = b.x - a.x, dz = b.y - a.y;
          const t = Math.max(0, Math.min(1, ((position.x - a.x) * dx + (position.z - a.y) * dz) / (dx * dx + dz * dz || 1)));
          clearance = Math.min(clearance, Math.hypot(position.x - a.x - t * dx, position.z - a.y - t * dz));
        }
      }
      for (const box of world.obstacleBounds) {
        if (box.max.y < lowest + .08 || box.min.y > position.y + 1.7 || box.max.y < position.y) continue;
        const dx = Math.max(box.min.x - position.x, 0, position.x - box.max.x);
        const dz = Math.max(box.min.z - position.z, 0, position.z - box.max.z);
        clearance = Math.min(clearance, Math.hypot(dx, dz));
      }
      const score = clearance + (floor.roomId === property.activeRoomId ? .25 : 0);
      if (!best || score > best.score) best = { position, score, centre };
    };
    consider(centre.clone());
    // At most 4,096 probes; deterministic even in a large imported plan.
    const spacing = Math.max(.45, (maxX - minX) / 64, (maxZ - minZ) / 64);
    for (let z = minZ + .3; z < maxZ; z += spacing) {
      for (let x = minX + .3; x < maxX; x += spacing) {
        const position = new Vector3(x, lowest + .001, z);
        consider(position);
      }
    }
  }
  if (best) {
    // The closure above chooses the candidate; this annotation keeps control
    // flow explicit for TypeScript's otherwise synchronous local narrowing.
    const selected = best as { position: Vector3; centre: Vector3 };
    const direction = selected.centre.clone().sub(selected.position);
    const preferred = direction.lengthSq() > .01 ? Math.atan2(-direction.x, -direction.z) : Math.PI;
    return { position: selected.position, yaw: facing(selected.position, preferred) };
  }
  return null;
}
