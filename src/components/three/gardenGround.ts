import * as THREE from 'three';
import type { Polygon } from '../../lib/geometry';
import type { Garden } from '../../designer/garden';
import { lawnFootprint, lawnTriangles, type GardenSite } from './gardenSurround';

export const MAX_SURROUND_BLADES = 1800;
const GROUND_TOP_M = -0.0005;

/** Small deterministic maps keep lawn/concrete natural without remote assets. */
export function gardenSurfaceMap(lawn: boolean): THREE.DataTexture {
  const size = 128;
  const data = new Uint8Array(size * size * 4);
  let seed = 8461;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    seed = (1664525 * seed + 1013904223) >>> 0;
    const grain = (seed / 4294967296 - 0.5) * (lawn ? 34 : 13);
    const variation = Math.sin(x / size * Math.PI * 4 + Math.sin(y / size * Math.PI * 2)) * (lawn ? 8 : 3);
    const i = (y * size + x) * 4;
    data[i] = (lawn ? 96 : 241) + grain + variation;
    data[i + 1] = (lawn ? 126 : 241) + grain + variation;
    data[i + 2] = (lawn ? 67 : 239) + grain + variation;
    data[i + 3] = 255;
  }
  const texture = new THREE.DataTexture(data, size, size);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}

/** Two draws maximum, regardless of plot area. Never adds persisted surfaces. */
export function surroundingLawn(occupied: readonly Polygon[], garden?: Garden, site?: GardenSite): THREE.Group {
  const group = new THREE.Group();
  group.name = 'garden-surround';
  group.userData = { automaticLawn: true };
  const footprint = lawnFootprint(occupied, garden, site);
  if (!footprint || footprint.areaM2 < 0.001) return group;
  const triangles = lawnTriangles(footprint);
  const positions: number[] = [];
  const uvs: number[] = [];
  for (const triangle of triangles) for (const point of triangle) {
    positions.push(point.x, GROUND_TOP_M, point.y);
    uvs.push(point.x / 1.6, point.y / 1.6);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.computeVertexNormals();
  // Both sides allow either winding from clipped room polygons; no raised slab.
  const map = gardenSurfaceMap(true);
  const material = new THREE.MeshStandardMaterial({ color: '#ffffff', map, roughness: 1, side: THREE.DoubleSide });
  material.userData.gardenTextures = [map];
  const turf = new THREE.Mesh(geometry, material);
  turf.name = 'surrounding-turf';
  turf.receiveShadow = true;
  group.add(turf);
  group.userData.areaM2 = footprint.areaM2;
  group.userData.boundary = footprint.boundary;

  const cumulative: number[] = [];
  let total = 0;
  for (const [a, b, c] of triangles) {
    total += Math.abs((b.x - a.x) * (c.y - a.y) - (c.x - a.x) * (b.y - a.y)) / 2;
    cumulative.push(total);
  }
  const count = Math.min(MAX_SURROUND_BLADES, Math.max(12, Math.round(total * 16)));
  // A low three-sided blade tuft reads as grass close up and as texture afar.
  const blade = new THREE.ConeGeometry(0.009, 0.032, 3);
  const blades = new THREE.InstancedMesh(blade, new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1 }), count);
  blades.name = 'surrounding-grass-detail';
  let seed = 1789;
  const random = () => { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 4294967296; };
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const rotation = new THREE.Quaternion();
  const size = new THREE.Vector3();
  const euler = new THREE.Euler();
  const colours = ['#607d42', '#718b4c', '#7e945c'].map((hex) => new THREE.Color(hex));
  for (let i = 0; i < count; i++) {
    const area = random() * total;
    let lo = 0;
    let hi = cumulative.length - 1;
    while (lo < hi) { const mid = (lo + hi) >>> 1; if (area < cumulative[mid]) hi = mid; else lo = mid + 1; }
    const [a, b, c] = triangles[lo];
    const r = Math.sqrt(random());
    const s = random();
    const scale = 0.65 + random() * 0.55;
    position.set((1 - r) * a.x + r * (1 - s) * b.x + r * s * c.x, GROUND_TOP_M + 0.016 * scale, (1 - r) * a.y + r * (1 - s) * b.y + r * s * c.y);
    rotation.setFromEuler(euler.set(0, random() * Math.PI * 2, 0));
    size.setScalar(scale);
    blades.setMatrixAt(i, matrix.compose(position, rotation, size));
    blades.setColorAt(i, colours[i % colours.length]);
  }
  blades.receiveShadow = true;
  group.add(blades);
  return group;
}

const disposedInstances = new WeakSet<THREE.InstancedMesh>();

/** Private maps and instance buffers; shared finish textures are not touched. */
export function disposeGardenResources(root: THREE.Object3D): void {
  const seen = new Set<THREE.Texture>();
  root.traverse((object) => {
    // Geometry.dispose() does not release InstancedMesh's separate matrix /
    // colour GPU buffers. Three releases those on the object's dispose event.
    if (object instanceof THREE.InstancedMesh && !disposedInstances.has(object)) {
      object.dispose();
      disposedInstances.add(object);
    }
    const mesh = object as THREE.Mesh;
    if (!mesh.material) return;
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      const maps = material.userData.gardenTextures as THREE.Texture[] | undefined;
      for (const map of maps ?? []) {
        if (!seen.has(map)) map.dispose();
        seen.add(map);
      }
      if (maps) material.userData.gardenTextures = [];
    }
  });
}
