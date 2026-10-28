import { Box3, DoubleSide, Matrix4, Quaternion, Ray, Vector3 } from 'three';
import { Line3 } from 'three/src/math/Line3.js';
import type { ExtendedTriangle, MeshBVH } from 'three-mesh-bvh';
import type { WalkDoor, WalkerState, WalkSpawn, WalkStair, WalkWorld } from './types';
import { WALK_FIXED_STEP_S, WALK_HEIGHT_M, WALK_RADIUS_M } from './types';

const UP = new Vector3(0, 1, 0);
const DOWN = new Vector3(0, -1, 0);
const SKIN = .0005;

function capsuleLine(state: Pick<WalkerState, 'position' | 'radius' | 'height'>): Line3 {
  return new Line3(state.position.clone().addScaledVector(UP, state.radius),
    state.position.clone().addScaledVector(UP, state.height - state.radius));
}

export function doorTransform(door: WalkDoor): { position: Vector3; quaternion: Quaternion } {
  return { position: door.hinge.clone(), quaternion: new Quaternion().setFromAxisAngle(UP, door.closedYaw + door.angle) };
}

function doorMatrix(door: WalkDoor, angle = door.angle): Matrix4 {
  return new Matrix4().makeRotationY(door.closedYaw + angle).setPosition(door.hinge);
}

function segmentDistance(triangle: ExtendedTriangle, line: Line3, onTriangle: Vector3, onLine: Vector3): number {
  // BVH's edge/endpoint distance helper does not include a segment crossing the
  // face interior. Include that case for ceilings and the camera sweep.
  const direction = line.delta(new Vector3());
  const length = direction.length();
  if (length > 1e-9) {
    const ray = new Ray(line.start, direction.divideScalar(length));
    const intersection = ray.intersectTriangle(triangle.a, triangle.b, triangle.c, false, onTriangle);
    if (intersection && intersection.distanceTo(line.start) <= length + 1e-8) {
      onLine.copy(onTriangle); return 0;
    }
  }
  return triangle.closestPointToSegment(line, onTriangle, onLine);
}

/** Shapecast only nearby triangles. Mutation is confined to the supplied capsule line. */
function queryCapsule(bvh: MeshBVH | null, line: Line3, radius: number, resolve: boolean): { hit: boolean; grounded: boolean } {
  if (!bvh) return { hit: false, grounded: false };
  const bounds = new Box3().setFromPoints([line.start, line.end]).expandByScalar(radius);
  const onTriangle = new Vector3(), onCapsule = new Vector3(), normal = new Vector3();
  let hit = false, grounded = false;
  bvh.shapecast({
    intersectsBounds: box => box.intersectsBox(bounds),
    intersectsTriangle: triangle => {
      const distance = segmentDistance(triangle, line, onTriangle, onCapsule);
      if (distance >= radius - SKIN) return false;
      hit = true;
      if (!resolve) return true;
      normal.subVectors(onCapsule, onTriangle);
      if (normal.lengthSq() < 1e-12) {
        triangle.getNormal(normal);
        const middle = line.getCenter(new Vector3()).sub(onTriangle);
        if (normal.dot(middle) < 0) normal.negate();
      } else normal.divideScalar(distance);
      if (normal.y > .55) grounded = true;
      normal.multiplyScalar(radius - distance + SKIN);
      line.start.add(normal); line.end.add(normal);
      return false;
    },
  });
  return { hit, grounded };
}

function doorOverlaps(door: WalkDoor, state: WalkerState, angle: number): boolean {
  const line = capsuleLine(state);
  const inverse = doorMatrix(door, angle).invert();
  line.start.applyMatrix4(inverse); line.end.applyMatrix4(inverse);
  return queryCapsule(door.bvh, line, state.radius + .015, false).hit;
}

export function capsuleClear(world: WalkWorld, state: WalkerState): boolean {
  const axis = new Vector3(state.position.x, 0, state.position.z);
  for (const box of world.obstacleBounds) {
    axis.y = Math.max(state.position.y + state.radius, Math.min(state.position.y + state.height - state.radius, (box.min.y + box.max.y) / 2));
    if (box.distanceToPoint(axis) < state.radius - .002) return false;
  }
  if (queryCapsule(world.bvh, capsuleLine(state), state.radius - .002, false).hit) return false;
  return world.doors.every(door => !doorOverlaps(door, state, door.angle));
}

function resolveWalker(world: WalkWorld, state: WalkerState): boolean {
  const line = capsuleLine(state);
  let grounded = false;
  for (let pass = 0; pass < 4; pass++) {
    const staticResult = queryCapsule(world.bvh, line, state.radius, true);
    grounded ||= staticResult.grounded;
    let touched = staticResult.hit;
    for (const door of world.doors) {
      const matrix = doorMatrix(door), inverse = matrix.clone().invert();
      const local = new Line3(line.start.clone().applyMatrix4(inverse), line.end.clone().applyMatrix4(inverse));
      const result = queryCapsule(door.bvh, local, state.radius, true);
      if (result.hit) {
        line.start.copy(local.start.applyMatrix4(matrix));
        line.end.copy(local.end.applyMatrix4(matrix));
        touched = true;
      }
      grounded ||= result.grounded;
    }
    if (!touched) break;
  }
  state.position.copy(line.start).addScaledVector(UP, -state.radius);
  return grounded;
}

/** Highest physical surface below the probe, in metres. No invented floor planes. */
export function groundHeight(world: WalkWorld, x: number, z: number, fromY: number, distance: number): number | null {
  const ray = new Ray(new Vector3(x, fromY, z), DOWN);
  const hit = world.bvh?.raycastFirst(ray, DoubleSide, 0, distance);
  return hit && hit.face && Math.abs(hit.face.normal.y) > .5 ? hit.point.y : null;
}

/** Return the authored tread beneath this point, never a generic furniture step. */
function stairHeightAt(stair: WalkStair, x: number, z: number, margin = 0): number | null {
  const angle = stair.stair.rotation * Math.PI / 180;
  const dx = x - stair.stair.x, dz = z - stair.stair.y;
  const across = dx * Math.cos(angle) + dz * Math.sin(angle);
  const along = -dx * Math.sin(angle) + dz * Math.cos(angle);
  if (Math.abs(across) > stair.stair.widthM / 2 + margin || Math.abs(along) > stair.stair.runM / 2 + margin) return null;
  if (along < -stair.stair.runM / 2) return stair.baseM;
  const index = Math.min(stair.count - 1, Math.max(0, Math.floor((along + stair.stair.runM / 2) / stair.goingM)));
  return stair.baseM + (index + 1) * stair.riserM;
}

export function createWalker(_world: WalkWorld, spawn?: WalkSpawn | Vector3): WalkerState {
  const position = (spawn instanceof Vector3 ? spawn : spawn?.position)?.clone() ?? new Vector3();
  return { position, velocityY: 0, grounded: true, radius: WALK_RADIUS_M, height: WALK_HEIGHT_M,
    accumulator: 0, safePosition: position.clone() };
}

function simulate(world: WalkWorld, state: WalkerState, velocity: Vector3, dt: number): void {
  advanceDoors(world, state, dt);
  // Even extreme input speed cannot leap through a thin leaf or wall.
  const distance = Math.hypot(velocity.x, velocity.z) * dt;
  const slices = Math.max(1, Math.ceil(distance / .07));
  const slice = dt / slices;
  for (let i = 0; i < slices; i++) {
    const old = state.position.clone();
    const dx = velocity.x * slice, dz = velocity.z * slice;
    const horizontal = Math.hypot(dx, dz);
    let stepHeight: number | null = null;
    let nearStair = false;
    for (const stair of world.stairs) {
      if (old.y < stair.baseM - .25 || old.y > stair.baseM + stair.riseM + .25) continue;
      nearStair ||= stairHeightAt(stair, old.x, old.z, state.radius) !== null;
      if (horizontal > 0 && state.grounded) {
        const probeX = old.x + dx + dx / horizontal * state.radius * .95;
        const probeZ = old.z + dz + dz / horizontal * state.radius * .95;
        const height = stairHeightAt(stair, probeX, probeZ);
        if (height !== null && height > old.y + .002 && height - old.y <= stair.riserM + .025) {
          stepHeight = Math.max(stepHeight ?? -Infinity, height);
        }
      }
    }
    if (stepHeight !== null) {
      const raised = { ...state, position: new Vector3(old.x + dx, stepHeight + SKIN, old.z + dz) };
      if (capsuleClear(world, raised)) {
        state.position.copy(raised.position);
        state.velocityY = 0;
      } else state.position.set(old.x + dx, old.y, old.z + dz);
    } else state.position.set(old.x + dx, old.y, old.z + dz);

    state.velocityY = Math.max(-12, state.velocityY - 18 * slice);
    const beforeVertical = state.position.y;
    state.position.y += state.velocityY * slice;
    const contact = resolveWalker(world, state);
    const support = groundHeight(world, state.position.x, state.position.z,
      state.position.y + .025, nearStair && state.grounded ? .25 : .055);
    if (state.velocityY <= 0 && support !== null && state.position.y - support < (nearStair && state.grounded ? .23 : .035)
      && support <= state.position.y + .025) {
      const landed = { ...state, position: state.position.clone().setY(support + SKIN) };
      if (capsuleClear(world, landed)) state.position.copy(landed.position);
      state.velocityY = 0;
      state.grounded = true;
    } else {
      state.grounded = contact;
      if (contact || state.position.y > beforeVertical + SKIN) state.velocityY = 0;
    }
  }
  if (state.position.y < Math.min(-5, world.bounds.min.y - 5)) {
    state.position.copy(state.safePosition); state.velocityY = 0; state.grounded = true;
  }
}

/** Fixed simulation ticks with a bounded catch-up window after a suspended tab. */
export function stepWalker(world: WalkWorld, state: WalkerState, desiredVelocity: Vector3, dt: number): { movedM: number; grounded: boolean } {
  const before = state.position.clone();
  if (!Number.isFinite(dt) || dt <= 0 || ![desiredVelocity.x, desiredVelocity.z].every(Number.isFinite)) return { movedM: 0, grounded: state.grounded };
  state.accumulator += Math.min(dt, .1);
  while (state.accumulator + 1e-9 >= WALK_FIXED_STEP_S) {
    simulate(world, state, desiredVelocity, WALK_FIXED_STEP_S);
    state.accumulator -= WALK_FIXED_STEP_S;
  }
  return { movedM: Math.hypot(state.position.x - before.x, state.position.z - before.z), grounded: state.grounded };
}

/** Validate the whole swing, not just its endpoint, so a closing leaf never sweeps through a person. */
export function setDoorAngle(world: WalkWorld, id: string, angle: number, state: WalkerState): boolean {
  const door = world.doors.find(d => d.id === id);
  if (!door || !Number.isFinite(angle)) return false;
  const bounded = Math.max(Math.min(0, door.openDelta), Math.min(Math.max(0, door.openDelta), angle));
  const count = Math.max(1, Math.ceil(Math.abs(bounded - door.angle) / (Math.PI / 90)));
  for (let i = 1; i <= count; i++) {
    if (doorOverlaps(door, state, door.angle + (bounded - door.angle) * i / count)) return false;
  }
  door.angle = bounded;
  return true;
}

export function toggleDoor(world: WalkWorld, id: string, state: WalkerState): boolean {
  const door = world.doors.find(d => d.id === id);
  if (!door) return false;
  const target = Math.abs(door.targetAngle) > .01 ? 0 : door.openDelta;
  const previous = door.angle;
  const allowed = setDoorAngle(world, id, target, state);
  door.angle = previous;
  if (!allowed) return false;
  door.targetAngle = target;
  return true;
}

export function advanceDoors(world: WalkWorld, state: WalkerState, dt: number): void {
  for (const door of world.doors) {
    const difference = door.targetAngle - door.angle;
    if (Math.abs(difference) < 1e-6) continue;
    const next = door.angle + Math.sign(difference) * Math.min(Math.abs(difference), dt * 2.8);
    if (!setDoorAngle(world, door.id, next, state)) {
      // A person entering the sweep after it starts cancels a close and reopens it.
      door.targetAngle = Math.abs(door.targetAngle) < .01 ? door.openDelta : door.angle;
    }
  }
}

export function nearestDoor(world: WalkWorld, eye: Vector3, direction: Vector3, reach = 2): WalkDoor | null {
  const ray = new Ray(eye, direction.clone().normalize());
  let nearest = world.bvh?.raycastFirst(ray, DoubleSide, 0, reach)?.distance ?? reach;
  let result: WalkDoor | null = null;
  for (const door of world.doors) {
    const local = ray.clone().applyMatrix4(doorMatrix(door).invert());
    const hit = door.bvh.raycastFirst(local, DoubleSide, 0, nearest);
    if (hit && hit.distance <= nearest) { nearest = hit.distance; result = door; }
  }
  return result;
}

/** Keep an operated open leaf reachable when its swing takes it out of the aim ray.
 * A nearby visible part of the leaf/hinge must still be in reach; walls and other
 * doors occlude it. This is visit state, never an automatic opening interaction. */
export function interactionDoor(world: WalkWorld, eye: Vector3, direction: Vector3, retainedId: string | null, reach = 2): WalkDoor | null {
  const aimed = nearestDoor(world, eye, direction, reach);
  if (aimed) return aimed;
  const retained = world.doors.find(door => door.id === retainedId);
  if (!retained || (Math.abs(retained.angle) < .01 && Math.abs(retained.targetAngle) < .01)) return null;
  const matrix = doorMatrix(retained);
  const localEye = eye.clone().applyMatrix4(matrix.clone().invert());
  // Avoid the exact wall/hinge seam, where both meshes meet.
  for (const x of [Math.max(.08, Math.min(retained.width - .08, localEye.x)), retained.width * .5, .08, retained.width - .08]) {
    const target = new Vector3(x, Math.max(.15, Math.min(retained.height - .15, localEye.y)), 0).applyMatrix4(matrix);
    const delta = target.sub(eye), length = delta.length();
    if (length > reach || length < 1e-6) continue;
    const ray = new Ray(eye, delta.divideScalar(length));
    if (world.bvh?.raycastFirst(ray, DoubleSide, 0, Math.max(0, length - .025))) continue;
    let occluded = false;
    for (const door of world.doors) {
      if (door === retained) continue;
      const localRay = ray.clone().applyMatrix4(doorMatrix(door).invert());
      if (door.bvh.raycastFirst(localRay, DoubleSide, 0, Math.max(0, length - .025))) { occluded = true; break; }
    }
    if (!occluded) return retained;
  }
  return null;
}

/** Swept sphere protects the camera's near plane as well as its centre ray. */
export function pullInCamera(world: WalkWorld, target: Vector3, desired: Vector3, radius = .18): Vector3 {
  const length = target.distanceTo(desired);
  if (length < 1e-6) return desired.clone();
  let fraction = 1;
  const cast = (bvh: MeshBVH | null, matrix?: Matrix4) => {
    if (!bvh) return;
    const line = new Line3(target.clone(), desired.clone());
    if (matrix) { const inverse = matrix.clone().invert(); line.start.applyMatrix4(inverse); line.end.applyMatrix4(inverse); }
    const bounds = new Box3().setFromPoints([line.start, line.end]).expandByScalar(radius);
    const onTriangle = new Vector3(), onLine = new Vector3();
    bvh.shapecast({ intersectsBounds: box => box.intersectsBox(bounds), intersectsTriangle: triangle => {
      const distance = segmentDistance(triangle, line, onTriangle, onLine);
      if (distance >= radius) return false;
      // Conservative advancement also handles shallow approaches to a wall.
      // Subtracting radius from a centre-ray hit would clip at those angles.
      let along = 0;
      for (let i = 0; i < 40 && along < fraction; i++) {
        line.at(along, onLine);
        triangle.closestPointToPoint(onLine, onTriangle);
        const gap = onLine.distanceTo(onTriangle) - radius;
        if (gap < .0001) break;
        along += gap / length * .98;
      }
      fraction = Math.min(fraction, Math.max(0, along - .01 / length));
      return false;
    } });
  };
  cast(world.bvh);
  for (const door of world.doors) cast(door.bvh, doorMatrix(door));
  return target.clone().lerp(desired, fraction);
}

/** Prefer an overhead shoulder view; in a low ceiling try bounded alternative
 * shoulders. If no external camera sphere fits, use the clear first-person eye.
 * Every interpolated location is swept against the world and checked against
 * the actor capsule. Zooming back out is deliberately slower than pulling in. */
export function followCamera(world: WalkWorld, feet: Vector3, direction: Vector3, previous: Vector3 | null, dt: number, height = WALK_HEIGHT_M): { position: Vector3; target: Vector3; firstPerson: boolean } {
  const radius = .18;
  const eye = feet.clone().addScaledVector(UP, Math.min(1.55, height - .1));
  const overhead = feet.clone().addScaledVector(UP, height + radius + .08);
  const pivot = pullInCamera(world, eye, overhead, radius);
  const forward = new Vector3(direction.x, 0, direction.z).normalize();
  if (forward.lengthSq() < .5) forward.set(0, 0, -1);
  const shoulder = new Vector3(-forward.z, 0, forward.x).multiplyScalar(.6);
  const desired = pivot.clone().addScaledVector(forward, -2.15).add(shoulder);
  desired.y += .2 + Math.max(0, -direction.y) * .4;
  const safe = pullInCamera(world, pivot, desired, radius);
  const oldDistance = previous?.distanceTo(pivot) ?? safe.distanceTo(pivot);
  const rate = safe.distanceTo(pivot) < oldDistance ? 24 : 6;
  const interpolated = previous ? previous.clone().lerp(safe, 1 - Math.exp(-rate * Math.max(0, dt))) : safe;
  // Moving up stairs must never interpolate the camera down through the head.
  interpolated.y = Math.max(interpolated.y, pivot.y);
  let position = pullInCamera(world, pivot, interpolated, radius);
  const target = eye.clone().addScaledVector(direction, 1.4);
  target.y -= .25;
  const body = new Line3(feet.clone().addScaledVector(UP, WALK_RADIUS_M), feet.clone().addScaledVector(UP, height - WALK_RADIUS_M));
  const outsideActor = (point: Vector3) => body.closestPointToPoint(point, true, new Vector3()).distanceTo(point) >= WALK_RADIUS_M + radius + .025;
  if (!outsideActor(position)) {
    // A ceiling can compress the overhead pivot. Search at most twelve local
    // shoulders; no candidate may pass through architecture to avoid the body.
    let alternative: Vector3 | null = null, best = Infinity;
    for (let i = 0; i < 12; i++) {
      const angle = Math.atan2(-forward.z, -forward.x) + i * Math.PI / 6;
      const candidate = pullInCamera(world, eye, eye.clone().add(new Vector3(Math.cos(angle) * .7, 0, Math.sin(angle) * .7)), radius);
      const distance = candidate.distanceToSquared(safe);
      if (outsideActor(candidate) && distance < best) { alternative = candidate; best = distance; }
    }
    if (!alternative) return { position: eye, target: eye.clone().add(direction), firstPerson: true };
    position = alternative;
  }
  // When a wall shortens the boom, preserve the navigation horizon instead of
  // tilting down into a close-up of the head. Full boom retains body framing.
  const horizontalDistance = Math.hypot(position.x - feet.x, position.z - feet.z);
  const compression = Math.max(0, Math.min(1, (2.15 - horizontalDistance) / .65));
  target.lerp(position.clone().addScaledVector(direction, 3), compression);
  return { position, target, firstPerson: false };
}
