import { Vector3 } from 'three';
import { capsuleClear, createWalker, groundHeight, stairHeightAt } from './collision';
import { authoredSupport, roofFootOffset } from './placement';
import { WALK_RADIUS_M, type WalkWorld } from './types';

const CELL = .45;
const MAX_EXPANSIONS = 1800;

function walkSegment(world: WalkWorld, start: Vector3, x: number, z: number): Vector3 | null {
  const count = Math.max(1, Math.ceil(Math.hypot(x - start.x, z - start.z) / .15));
  const point = start.clone();
  for (let i = 1; i <= count; i++) {
    point.x = start.x + (x - start.x) * i / count;
    point.z = start.z + (z - start.z) * i / count;
    const height = groundHeight(world, point.x, point.z, point.y + .24, .49);
    const plan = { x: point.x, y: point.z };
    if (height === null || !authoredSupport(world, plan, height)) return null;
    const stair = world.stairs.some(s => Math.abs((stairHeightAt(s, point.x, point.z) ?? Infinity) - height) < .03);
    if (!stair && !world.roofActive && Math.abs(height - point.y) > .09) return null;
    point.y = height + .001 + roofFootOffset(world, plan, height, WALK_RADIUS_M);
    if (!capsuleClear(world, createWalker(world, point))) {
      // At a riser the rounded foot can already touch the next tread. The
      // movement controller raises it by at most one authored riser here.
      const length = Math.hypot(x - start.x, z - start.z) || 1;
      const probeX = point.x + (x - start.x) / length * WALK_RADIUS_M;
      const probeZ = point.z + (z - start.z) / length * WALK_RADIUS_M;
      const entering = world.stairs.some(s => {
        const next = stairHeightAt(s, probeX, probeZ);
        return next !== null && next >= height && next - height <= s.riserM + .025;
      });
      if (!stair && !entering) return null;
      const raised = point.clone(); raised.y += .18;
      if (!capsuleClear(world, createWalker(world, raised))) return null;
    }
  }
  return point;
}

/** Straight clear route first. A bounded metre-based A* uses the same capsule, treads and closed leaves as walking. */
export function walkingRoute(world: WalkWorld, start: Vector3, goal: Vector3): Vector3[] | null {
  const direct = walkSegment(world, start, goal.x, goal.z);
  if (direct && Math.abs(direct.y - goal.y) < .25) return [goal.clone()];
  interface Node { x: number; z: number; point: Vector3; distance: number; score: number; parent?: Node }
  const first: Node = { x: 0, z: 0, point: start, distance: 0, score: start.distanceTo(goal) };
  const open = [first];
  const key = (n: Node) => n.x + '/' + n.z + '/' + Math.round(n.point.y / .25);
  const best = new Map([[key(first), 0]]);
  for (let explored = 0; open.length && explored < MAX_EXPANSIONS; explored++) {
    let index = 0;
    for (let i = 1; i < open.length; i++) if (open[i].score < open[index].score) index = i;
    const current = open[index];
    open[index] = open[open.length - 1]; open.pop();
    if (current.distance !== best.get(key(current))) continue;
    if (current.point.distanceTo(goal) < CELL * 1.6) {
      const last = walkSegment(world, current.point, goal.x, goal.z);
      if (last && Math.abs(last.y - goal.y) < .25) {
        const path = [goal.clone()];
        for (let n: Node | undefined = current; n?.parent; n = n.parent) path.push(n.point);
        return path.reverse();
      }
    }
    for (const [dx, dz] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]) {
      const x = current.x + dx, z = current.z + dz;
      const point = walkSegment(world, current.point, start.x + x * CELL, start.z + z * CELL);
      if (!point) continue;
      const distance = current.distance + current.point.distanceTo(point);
      const next = { x, z, point, distance, score: distance + point.distanceTo(goal), parent: current };
      if (distance >= (best.get(key(next)) ?? Infinity) - .001) continue;
      best.set(key(next), distance); open.push(next);
    }
  }
  return null;
}
