import * as THREE from 'three';
import { pointInPolygon, type Polygon } from '../../lib/geometry';
import {
  FENCE_MATERIALS, GARDEN_SURFACES, fenceLengthM, gardenElevationAt,
  type Garden, type GardenFence, type GardenSurface,
} from '../../designer/garden';

function box(width: number, height: number, depth: number, material: THREE.Material, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function surfaceMesh(surface: GardenSurface, order: number, occupied: readonly Polygon[]): THREE.Group {
  const group = new THREE.Group();
  group.name = `garden-surface-${surface.id}`;
  group.userData = { gardenId: surface.id, gardenKind: 'surface' };
  const top = surface.elevationM + 0.0003 + order * 0.000001;
  const material = new THREE.MeshStandardMaterial({ color: GARDEN_SURFACES[surface.kind].hex, roughness: 0.98 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(surface.widthM, surface.depthM), material);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(surface.x + surface.widthM / 2, top, surface.y + surface.depthM / 2);
  floor.receiveShadow = true;
  group.add(floor);
  if (surface.elevationM > 0.01) {
    const soil = new THREE.MeshStandardMaterial({ color: '#6b503b', roughness: 1 });
    group.add(box(surface.widthM, surface.elevationM, surface.depthM, soil,
      surface.x + surface.widthM / 2, surface.elevationM / 2 - 0.001, surface.y + surface.depthM / 2));
  }

  const area = surface.widthM * surface.depthM;
  if (surface.kind === 'path') {
    const points: number[] = [];
    const tile = 0.6;
    for (let x = tile; x < surface.widthM; x += tile) {
      points.push(surface.x + x, top + 0.0001, surface.y, surface.x + x, top + 0.0001, surface.y + surface.depthM);
    }
    for (let y = tile; y < surface.depthM; y += tile) {
      points.push(surface.x, top + 0.0001, surface.y + y, surface.x + surface.widthM, top + 0.0001, surface.y + y);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
    group.add(new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color: '#9a927f', transparent: true, opacity: 0.55 })));
    return group;
  }

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
    if (occupied.some((polygon) => pointInPolygon({ x, y }, polygon))) continue;
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
export function gardenMeshes(garden: Garden | undefined, occupiedPolygons: readonly Polygon[] = []): THREE.Group {
  const group = new THREE.Group();
  group.name = 'garden';
  if (!garden) return group;
  garden.surfaces.forEach((surface, index) => group.add(surfaceMesh(surface, index, occupiedPolygons)));
  garden.fences.forEach((fence) => group.add(fenceMesh(fence, garden)));
  return group;
}
