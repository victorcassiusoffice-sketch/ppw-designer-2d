import * as THREE from 'three';
import { pointInPolygon, polygonArea, type Polygon } from '../../lib/geometry';
import {
  FENCE_MATERIALS, GARDEN_SURFACES, fenceLengthM, gardenElevationAt, gardenSurfacePolygon,
  DEFAULT_GARDEN_POOL, type Garden, type GardenFence, type GardenSurface,
} from '../../designer/garden';
import { findOutdoorPavingProduct } from '../../data/outdoorPaving';
import { gardenSurfaceMap, surroundingLawn } from './gardenGround';
import { subtractConvex, type GardenSite } from './gardenSurround';
import { gardenGroundCutout, outdoorSurfaceTakeoff } from '../../designer/outdoorTakeoff';

function box(width: number, height: number, depth: number, material: THREE.Material, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function surfaceGeometry(surface: GardenSurface, cutouts: readonly Polygon[]): THREE.BufferGeometry {
  const polygon = gardenSurfacePolygon(surface);
  const triangles = THREE.ShapeUtils.triangulateShape(polygon.map(p => new THREE.Vector2(p.x, p.y)), []);
  let pieces = triangles.map(triangle => triangle.map(i => polygon[i]));
  for (const hole of cutouts) pieces = pieces.flatMap(piece => subtractConvex(piece, hole));
  const points: number[] = [], uv: number[] = [];
  for (const piece of pieces) for (let i = 1; i < piece.length - 1; i++) for (const p of [piece[0], piece[i], piece[i + 1]]) {
    points.push(p.x, 0, p.y); uv.push((p.x - surface.x) / surface.widthM, (p.y - surface.y) / surface.depthM);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.computeVertexNormals();
  return geometry;
}

function poolMesh(surface: GardenSurface): THREE.Group {
  const group = new THREE.Group();
  group.name = `garden-surface-${surface.id}`;
  group.userData = { gardenId: surface.id, gardenKind: 'surface', poolStage: surface.pool?.stage ?? 'filled' };
  const p = surface.pool ?? DEFAULT_GARDEN_POOL;
  const w = surface.widthM, l = surface.depthM, t = p.wallThicknessM, top = surface.elevationM;
  const cx = surface.x + w / 2, cz = surface.y + l / 2;
  const addBox = (name: string, width: number, height: number, depth: number, material: THREE.Material, x: number, y: number, z: number) => {
    const part = box(width, height, depth, material, x, y, z); part.name = name; group.add(part);
  };
  if (p.stage === 'excavation') {
    const ew = w + 2 * (t + p.excavationMarginM), el = l + 2 * (t + p.excavationMarginM), h = p.shellDepthM + p.baseThicknessM;
    const soil = new THREE.MeshStandardMaterial({ color: '#795c42', roughness: 1 });
    addBox('pool-excavation-bottom', ew, 0.02, el, soil, cx, top - h - 0.01, cz);
    addBox('pool-excavation-north', ew, h, 0.015, soil, cx, top - h / 2, cz - el / 2);
    addBox('pool-excavation-south', ew, h, 0.015, soil, cx, top - h / 2, cz + el / 2);
    addBox('pool-excavation-west', 0.015, h, el, soil, cx - ew / 2, top - h / 2, cz);
    addBox('pool-excavation-east', 0.015, h, el, soil, cx + ew / 2, top - h / 2, cz);
    const line = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(cx - ew / 2 + .03, top, cz), new THREE.Vector3(cx - ew / 2 + .03, top - h, cz)]);
    const measure = new THREE.Line(line, new THREE.LineBasicMaterial({ color: '#f5d891' })); measure.name = 'pool-excavation-depth'; group.add(measure);
    return group;
  }
  const shell = new THREE.MeshStandardMaterial({ color: '#d9d3c6', roughness: .86 });
  addBox('pool-base', w + 2 * t, p.baseThicknessM, l + 2 * t, shell, cx, top - p.shellDepthM - p.baseThicknessM / 2, cz);
  addBox('pool-wall-north', w + 2 * t, p.shellDepthM, t, shell, cx, top - p.shellDepthM / 2, surface.y - t / 2);
  addBox('pool-wall-south', w + 2 * t, p.shellDepthM, t, shell, cx, top - p.shellDepthM / 2, surface.y + l + t / 2);
  addBox('pool-wall-west', t, p.shellDepthM, l, shell, surface.x - t / 2, top - p.shellDepthM / 2, cz);
  addBox('pool-wall-east', t, p.shellDepthM, l, shell, surface.x + w + t / 2, top - p.shellDepthM / 2, cz);
  const liner = new THREE.MeshStandardMaterial({ color: '#b6d5d7', roughness: .45 });
  addBox('pool-lining-floor', w, .004, l, liner, cx, top - p.shellDepthM + .002, cz);
  for (const edge of [0, l]) addBox('pool-lining-wall', w, p.shellDepthM, .004, liner, cx, top - p.shellDepthM / 2, surface.y + edge);
  for (const edge of [0, w]) addBox('pool-lining-wall', .004, p.shellDepthM, l, liner, surface.x + edge, top - p.shellDepthM / 2, cz);
  if (p.stage === 'filled' && p.waterDepthM > 0) {
    const water = new THREE.Mesh(new THREE.PlaneGeometry(w, l), new THREE.MeshStandardMaterial({ color: '#43a8b6', transparent: true, opacity: .58, roughness: .16, metalness: .1, side: THREE.DoubleSide }));
    water.rotation.x = -Math.PI / 2; water.position.set(cx, top - p.shellDepthM + p.waterDepthM, cz); water.name = 'pool-water'; group.add(water);
  }
  return group;
}

function surfaceMesh(surface: GardenSurface, order: number, occupied: readonly Polygon[], cutouts: readonly Polygon[]): THREE.Group {
  if (surface.kind === 'pool') return poolMesh(surface);
  const group = new THREE.Group();
  group.name = `garden-surface-${surface.id}`;
  group.userData = { gardenId: surface.id, gardenKind: 'surface' };
  const top = surface.elevationM + 0.0003 + order * 0.000001;
  const paving = surface.kind === 'path' ? findOutdoorPavingProduct(surface.pavingProductId) : undefined;
  const map = gardenSurfaceMap(surface.kind === 'lawn');
  map.repeat.set(surface.widthM / 1.6, surface.depthM / 1.6);
  const material = new THREE.MeshStandardMaterial({ color: surface.kind === 'lawn' ? '#ffffff' : paving?.renderHex ?? GARDEN_SURFACES[surface.kind].hex, map, roughness: 0.98, side: THREE.DoubleSide });
  material.userData.gardenTextures = [map];
  const floor = new THREE.Mesh(surfaceGeometry(surface, cutouts), material);
  floor.position.y = top;
  floor.receiveShadow = true;
  group.add(floor);
  const layerDepth = outdoorSurfaceTakeoff(surface)?.thicknessM ?? 0;
  if (layerDepth > 0) {
    const edgeMaterial = new THREE.MeshStandardMaterial({ color: paving?.renderHex ?? GARDEN_SURFACES[surface.kind].hex, roughness: .96 });
    const polygon = gardenSurfacePolygon(surface);
    polygon.forEach((a, i) => { const b = polygon[(i + 1) % polygon.length];
      const edge = box(Math.hypot(b.x - a.x, b.y - a.y), layerDepth, .002, edgeMaterial, (a.x + b.x) / 2, top - layerDepth / 2, (a.y + b.y) / 2);
      edge.rotation.y = -Math.atan2(b.y - a.y, b.x - a.x); edge.name = 'outdoor-material-edge'; group.add(edge);
    });
  }
  if (surface.elevationM > 0.01) {
    const soil = new THREE.MeshStandardMaterial({ color: '#6b503b', roughness: 1 });
    const polygon = gardenSurfacePolygon(surface);
    polygon.forEach((a, i) => { const b = polygon[(i + 1) % polygon.length];
      const edge = box(Math.hypot(b.x - a.x, b.y - a.y), surface.elevationM, .002, soil, (a.x + b.x) / 2, surface.elevationM / 2 - .001, (a.y + b.y) / 2);
      edge.rotation.y = -Math.atan2(b.y - a.y, b.x - a.x); group.add(edge);
    });
  }

  const area = polygonArea(gardenSurfacePolygon(surface));
  if (surface.kind === 'path' && !surface.outline && !cutouts.length) {
    const points: number[] = [];
    const tileWidth = paving?.tileWidthM ?? 0.6;
    const tileDepth = paving?.tileDepthM ?? 0.6;
    for (let x = tileWidth; x < surface.widthM; x += tileWidth) {
      points.push(surface.x + x, top + 0.0001, surface.y, surface.x + x, top + 0.0001, surface.y + surface.depthM);
    }
    for (let y = tileDepth; y < surface.depthM; y += tileDepth) {
      points.push(surface.x, top + 0.0001, surface.y + y, surface.x + surface.widthM, top + 0.0001, surface.y + y);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
    group.add(new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color: '#747773', transparent: true, opacity: 0.6 })));
    return group;
  }
  if (surface.kind === 'concrete' || surface.kind === 'tarmac' || surface.kind === 'path') return group;

  // Instancing keeps texture detail inexpensive on phones. A deterministic
  // scatter is stable during edits and never plants blades through a room.
  const count = Math.min(1500, Math.max(8, Math.round(area * (surface.kind === 'lawn' ? 24 : 12))));
  const geometry = surface.kind === 'lawn'
    ? new THREE.ConeGeometry(0.012, 0.045, 3)
    : new THREE.IcosahedronGeometry(surface.kind === 'gravel' ? 0.028 : 0.016, 0);
  const detail = new THREE.InstancedMesh(geometry, new THREE.MeshStandardMaterial({
    color: surface.kind === 'lawn' ? '#7a9d53' : surface.kind === 'soil' ? '#8b6850' : '#cbc6b7', roughness: 1,
  }), count);
  const matrix = new THREE.Matrix4();
  let used = 0;
  let seed = [...surface.id].reduce((sum, c) => (sum * 31 + c.charCodeAt(0)) >>> 0, 1);
  const random = () => { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 4294967296; };
  for (let index = 0; index < count; index++) {
    const x = surface.x + random() * surface.widthM;
    const y = surface.y + random() * surface.depthM;
    if (!pointInPolygon({ x, y }, gardenSurfacePolygon(surface)) || [...occupied, ...cutouts].some((polygon) => pointInPolygon({ x, y }, polygon))) continue;
    const size = 0.7 + random() * 0.6;
    matrix.compose(new THREE.Vector3(x, top + (surface.kind === 'lawn' ? 0.02 : 0.01), y),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0, random() * Math.PI, 0)),
      new THREE.Vector3(size, size, size));
    detail.setMatrixAt(used++, matrix);
  }
  detail.count = used;
  detail.receiveShadow = true;
  group.add(detail);
  return group;
}

function fenceMesh(fence: GardenFence, garden: Garden): THREE.Group {
  const group = new THREE.Group();
  group.name = `garden-fence-${fence.id}`;
  group.userData = { gardenId: fence.id, gardenKind: 'fence' };
  const length = fenceLengthM(fence);
  const base = Math.max(gardenElevationAt(garden, fence.a), gardenElevationAt(garden, fence.b));
  group.position.set(fence.a.x, base, fence.a.y);
  group.rotation.y = -Math.atan2(fence.b.y - fence.a.y, fence.b.x - fence.a.x);
  const material = new THREE.MeshStandardMaterial({
    color: FENCE_MATERIALS[fence.material].hex,
    roughness: fence.material === 'metal' ? 0.48 : 0.94,
    metalness: fence.material === 'metal' ? 0.5 : 0,
  });
  if (fence.material === 'hedge') {
    group.add(box(length, fence.heightM, 0.5, material, length / 2, fence.heightM / 2));
    return group;
  }
  const postCount = Math.ceil(length / 2) + 1;
  const postWidth = fence.material === 'metal' ? 0.06 : 0.1;
  const posts = new THREE.InstancedMesh(new THREE.BoxGeometry(postWidth, fence.heightM + 0.06, postWidth), material, postCount);
  const matrix = new THREE.Matrix4();
  for (let i = 0; i < postCount; i++) posts.setMatrixAt(i, matrix.makeTranslation(i * length / (postCount - 1), (fence.heightM + 0.06) / 2, 0));
  posts.castShadow = true;
  posts.receiveShadow = true;
  group.add(posts);
  for (const fraction of [0.25, 0.8]) group.add(box(length, 0.07, postWidth * 0.7, material, length / 2, fence.heightM * fraction));
  const slatCount = Math.min(5000, Math.ceil(length / (fence.material === 'metal' ? 0.18 : 0.15)));
  const slats = new THREE.InstancedMesh(new THREE.BoxGeometry(fence.material === 'metal' ? 0.018 : 0.09, fence.heightM - 0.08, 0.035), material, slatCount);
  for (let i = 0; i < slatCount; i++) slats.setMatrixAt(i, matrix.makeTranslation((i + 0.5) * length / slatCount, fence.heightM / 2, 0));
  slats.castShadow = true;
  slats.receiveShadow = true;
  group.add(slats);
  return group;
}

/** Plan (x,y,height) maps to THREE (x,height,y), like all room meshes. */
export function gardenMeshes(garden: Garden | undefined, occupiedPolygons: readonly Polygon[] = [], site?: GardenSite): THREE.Group {
  const group = new THREE.Group();
  group.name = 'garden';
  group.add(surroundingLawn(occupiedPolygons, garden, site));
  if (!garden) return group;
  garden.surfaces.forEach((surface, index) => {
    // Later patches at the same elevation win, just as their surface plane
    // does; earlier grass/gravel must not poke through a newly laid path.
    const covered = garden.surfaces.filter((candidate, i) => candidate.elevationM > surface.elevationM || (candidate.elevationM === surface.elevationM && i > index));
    const cutouts = garden.surfaces.filter(s => s.kind === 'pool').map(gardenGroundCutout).filter(polygon =>
      Math.min(...polygon.map(p => p.x)) < surface.x + surface.widthM && Math.max(...polygon.map(p => p.x)) > surface.x
      && Math.min(...polygon.map(p => p.y)) < surface.y + surface.depthM && Math.max(...polygon.map(p => p.y)) > surface.y);
    group.add(surfaceMesh(surface, index, [...occupiedPolygons, ...covered.map(gardenSurfacePolygon)], cutouts));
  });
  garden.fences.forEach((fence) => group.add(fenceMesh(fence, garden)));
  return group;
}
