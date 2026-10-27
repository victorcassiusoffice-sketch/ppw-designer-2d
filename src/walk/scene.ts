/** Lazy walk-only collision geometry. It consumes the renderer's assembled solids. */
import {
  Box3, BoxGeometry, BufferGeometry, Float32BufferAttribute, ExtrudeGeometry,
  Matrix4, Path, Shape, Vector3,
} from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import type { Property } from '../store/propertyStore';
import type { SceneSolids, WallSolid } from '../designer/roomSolids';
import type { Vertex } from '../lib/geometry';
import { FLOOR_SLAB_THICKNESS_M } from '../designer/building';
import { stairPlacementFits } from '../designer/stairPlacement';
import { doorSymbol } from '../designer/openings';
import { roomEdges } from '../designer/wallEdges';
import { visibleOpeningProfile } from '../components/three/openingMeshProfile';
import type { WalkDoor, WalkWorld } from './types';

function shapeOf(polygon: Vertex[]): Shape {
  const shape = new Shape();
  polygon.forEach((p, i) => i === 0 ? shape.moveTo(p.x, p.y) : shape.lineTo(p.x, p.y));
  shape.closePath();
  return shape;
}

function wallMatrix(wall: WallSolid): Matrix4 {
  const x = new Vector3(wall.b.x - wall.a.x, 0, wall.b.y - wall.a.y).normalize();
  const y = new Vector3(0, 1, 0), z = new Vector3().crossVectors(x, y);
  const origin = new Vector3(wall.a.x, wall.elevationM ?? 0, wall.a.y)
    .addScaledVector(z, wall.centred ? -wall.thicknessM / 2 : -wall.thicknessM);
  return new Matrix4().makeBasis(x, y, z).setPosition(origin);
}

/** Each BVH is local to this walk session; disposing never touches renderer geometry. */
export function createWalkWorld(solids: SceneSolids, property: Property): WalkWorld {
  const positions: number[] = [];
  const append = (geometry: BufferGeometry, matrix?: Matrix4) => {
    const flat = geometry.index ? geometry.toNonIndexed() : geometry;
    if (matrix) flat.applyMatrix4(matrix);
    const attr = flat.getAttribute('position');
    for (let i = 0; i < attr.count; i++) positions.push(attr.getX(i), attr.getY(i), attr.getZ(i));
    if (flat !== geometry) flat.dispose();
    geometry.dispose();
  };
  const box = (width: number, height: number, depth: number, x: number, y: number, z: number, parent?: Matrix4) => {
    if (![width, height, depth, x, y, z].every(Number.isFinite) || Math.min(width, height, depth) <= 0) return;
    const matrix = new Matrix4().makeTranslation(x, y, z);
    if (parent) matrix.premultiply(parent);
    append(new BoxGeometry(width, height, depth), matrix);
  };

  for (const floor of solids.floors) {
    if (floor.polygon.length < 3) continue;
    const shape = shapeOf(floor.polygon);
    for (const hole of floor.holes ?? []) {
      if (hole.length < 3) continue;
      const path = new Path();
      hole.forEach((p, i) => i ? path.lineTo(p.x, p.y) : path.moveTo(p.x, p.y));
      path.closePath();
      shape.holes.push(path);
    }
    // Shape XY maps to world XZ; extrusion grows DOWN from finished floor height.
    const matrix = new Matrix4().makeBasis(new Vector3(1, 0, 0), new Vector3(0, 0, 1), new Vector3(0, -1, 0))
      .setPosition(0, floor.elevationM ?? 0, 0);
    append(new ExtrudeGeometry(shape, { depth: FLOOR_SLAB_THICKNESS_M, bevelEnabled: false, curveSegments: 1 }), matrix);
  }

  const doors: WalkDoor[] = [];
  for (const wall of solids.walls) {
    if (wall.renderDuplicateOf || wall.lengthM <= 0 || wall.heightM <= 0) continue;
    const matrix = wallMatrix(wall);
    const shape = shapeOf([{ x: 0, y: 0 }, { x: wall.lengthM, y: 0 }, { x: wall.lengthM, y: wall.heightM }, { x: 0, y: wall.heightM }]);
    for (const opening of wall.openings) {
      // Windows remain solid for a pedestrian, including panes whose sill is very low.
      if (opening.kind === 'window') continue;
      const profile = visibleOpeningProfile(opening, wall.heightM);
      if (profile.length < 3) continue;
      const path = new Path();
      profile.forEach((p, i) => i ? path.lineTo(p.x, p.y) : path.moveTo(p.x, p.y));
      path.closePath();
      shape.holes.push(path);
      if (opening.kind !== 'door') continue;

      const room = property.rooms.find(r => (r.openings ?? []).some(o => o.id === opening.id));
      const saved = room?.openings?.find(o => o.id === opening.id);
      const edge = room && saved ? roomEdges(room).find(e => e.index === saved.edgeIndex) : undefined;
      const symbol = edge && saved ? doorSymbol(edge, saved) : null;
      const dx = (wall.b.x - wall.a.x) / wall.lengthM, dz = (wall.b.y - wall.a.y) / wall.lengthM;
      const hinge = symbol ? new Vector3(symbol.hinge.x, wall.elevationM ?? 0, symbol.hinge.y)
        : new Vector3(wall.a.x + dx * opening.t0M, wall.elevationM ?? 0, wall.a.y + dz * opening.t0M);
      hinge.y += opening.bottomM;
      const far = symbol ? new Vector3(symbol.farJamb.x, hinge.y, symbol.farJamb.y)
        : new Vector3(wall.a.x + dx * opening.t1M, hinge.y, wall.a.y + dz * opening.t1M);
      const closed = far.clone().sub(hinge).normalize();
      const open = symbol ? new Vector3(symbol.leafEnd.x, hinge.y, symbol.leafEnd.y).sub(hinge).normalize()
        : new Vector3(wall.inward.x, 0, wall.inward.y);
      const closedYaw = -Math.atan2(closed.z, closed.x);
      let openDelta = -Math.atan2(open.z, open.x) - closedYaw;
      openDelta = Math.atan2(Math.sin(openDelta), Math.cos(openDelta));
      const width = opening.t1M - opening.t0M;
      const duplicate = doors.find(d => Math.abs(d.hinge.y - hinge.y) < .02 && Math.abs(d.width - width) < .02
        && d.hinge.clone().add(new Vector3(Math.cos(d.closedYaw), 0, -Math.sin(d.closedYaw)).multiplyScalar(d.width / 2))
          .distanceTo(hinge.clone().addScaledVector(closed, width / 2)) < .03);
      if (duplicate) {
        if (opening.id && !duplicate.openingIds.includes(opening.id)) duplicate.openingIds.push(opening.id);
        duplicate.wallKeys.push(wall.key);
        continue;
      }
      const height = opening.topM - opening.bottomM, thickness = .045;
      const sameDirection = closed.x * dx + closed.z * dz > 0;
      const leafProfile = profile.map(p => ({ x: sameDirection ? p.x - opening.t0M : opening.t1M - p.x, y: p.y - opening.bottomM }));
      const geometry = opening.shape && opening.shape !== 'rectangle'
        ? new ExtrudeGeometry(shapeOf(leafProfile), { depth: thickness, bevelEnabled: false, curveSegments: 1 }).translate(0, 0, -thickness / 2)
        : new BoxGeometry(width, height, thickness).translate(width / 2, height / 2, 0);
      const id = opening.id ?? `${wall.key}:${opening.t0M}`;
      doors.push({ id, openingIds: opening.id ? [opening.id] : [], wallKeys: [wall.key], hinge,
        width, height, thickness, baseM: hinge.y, closedYaw, openDelta, angle: 0, targetAngle: 0,
        inward: new Vector3(wall.inward.x, 0, wall.inward.y), exterior: !wall.shared && !wall.free,
        geometry, bvh: new MeshBVH(geometry) });
    }
    append(new ExtrudeGeometry(shape, { depth: wall.thicknessM, bevelEnabled: false, curveSegments: 1 }), matrix);
  }

  const stairs = (solids.stairs ?? []).filter(entry => stairPlacementFits(property, entry.stair)).map(entry => {
    const count = Math.min(512, Math.max(1, Math.ceil((entry.riseM - 1e-9) / .18)));
    return { ...entry, stair: { ...entry.stair }, count, riserM: entry.riseM / count, goingM: entry.stair.runM / count };
  });
  for (const entry of stairs) {
    const { stair, baseM, count, riserM, goingM } = entry;
    const matrix = new Matrix4().makeRotationY(-stair.rotation * Math.PI / 180).setPosition(stair.x, baseM, stair.y);
    for (let i = 0; i < count; i++) {
      const height = (i + 1) * riserM;
      box(stair.widthM, height, goingM, 0, height / 2, -stair.runM / 2 + (i + .5) * goingM, matrix);
    }
    // The visible stairs have two handrails. Coarse rail/post boxes keep the
    // capsule and follow camera on the flight without detail-mesh collision.
    const startZ = -stair.runM / 2 + goingM / 2, endZ = stair.runM / 2 - goingM / 2;
    for (const side of [-1, 1]) {
      const x = side * (stair.widthM / 2 - .045);
      const dy = entry.riseM - riserM, dz = endZ - startZ;
      if (Math.hypot(dy, dz) > .001) {
        const rail = new Matrix4().makeRotationX(-Math.atan2(dy, dz))
          .setPosition(x, (riserM + entry.riseM) / 2 + .9, (startZ + endZ) / 2).premultiply(matrix);
        append(new BoxGeometry(.05, .05, Math.hypot(dy, dz)), rail);
      }
      for (let i = 0; i < count; i++) {
        if (i % 3 !== 0 && i !== count - 1) continue;
        box(.035, .9, .035, x, (i + 1) * riserM + .45, -stair.runM / 2 + (i + .5) * goingM, matrix);
      }
    }
  }
  const obstacleBounds: Box3[] = [];
  for (const item of solids.items) {
    box(item.x1 - item.x0, item.z1 - item.z0, item.y1 - item.y0,
      (item.x0 + item.x1) / 2, (item.z0 + item.z1) / 2, (item.y0 + item.y1) / 2);
    obstacleBounds.push(new Box3(new Vector3(item.x0, item.z0, item.y0), new Vector3(item.x1, item.z1, item.y1)));
  }
  const staticGeometry = new BufferGeometry();
  staticGeometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  staticGeometry.computeBoundingBox();
  const bounds = staticGeometry.boundingBox?.clone() ?? new Box3();
  const bvh = positions.length ? new MeshBVH(staticGeometry) : null;
  return {
    staticGeometry, bvh, doors, stairs, obstacleBounds, floors: solids.floors.map(f => ({ ...f, polygon: f.polygon.map(p => ({ ...p })), holes: f.holes?.map(h => h.map(p => ({ ...p }))) })), bounds,
    dispose() { staticGeometry.dispose(); for (const door of doors) door.geometry.dispose(); },
  };
}
