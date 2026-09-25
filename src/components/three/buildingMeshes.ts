/** Building parts in metres: plan (x, y) maps to three (x, vertical y, z). */
import * as THREE from 'three';
import type { Polygon, Vertex } from '../../lib/geometry';
import type { BuildingStair, RoofConfig } from '../../designer/building';
import { createRoofSurface, roofHeightAt } from '../../designer/roofSurface';

function box(width: number, height: number, depth: number, material: THREE.Material): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function railBetween(a: THREE.Vector3, b: THREE.Vector3, material: THREE.Material): THREE.Mesh {
  const delta = b.clone().sub(a);
  const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, delta.length(), 8), material);
  rail.position.copy(a).add(b).multiplyScalar(0.5);
  rail.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
  rail.castShadow = true;
  return rail;
}

/** Straight flight with physical risers, tread nosings and two handrails. */
export function stairMesh(stair: BuildingStair, baseM: number, riseM: number): THREE.Group {
  const group = new THREE.Group();
  group.name = `stairs-${stair.id}`;
  group.userData = { stairId: stair.id, buildingPart: 'stairs' };
  if (![stair.x, stair.y, stair.rotation, stair.widthM, stair.runM, baseM, riseM].every(Number.isFinite)
    || stair.widthM <= 0 || stair.runM <= 0 || riseM <= 0) return group;
  group.position.set(stair.x, baseM, stair.y);
  group.rotation.y = -stair.rotation * Math.PI / 180;
  const count = Math.min(512, Math.max(1, Math.ceil((riseM - 1e-9) / 0.18)));
  const riser = riseM / count;
  const going = stair.runM / count;
  const core = new THREE.MeshStandardMaterial({ color: '#c4c6c2', roughness: 0.86 });
  const tread = new THREE.MeshStandardMaterial({ color: '#b99970', roughness: 0.6 });
  const metal = new THREE.MeshStandardMaterial({ color: '#475252', roughness: 0.42, metalness: 0.65 });
  for (let i = 0; i < count; i++) {
    const top = (i + 1) * riser;
    const z = -stair.runM / 2 + (i + 0.5) * going;
    const step = box(stair.widthM, Math.max(0.001, top - 0.025), going, core);
    step.name = `riser-${i}`;
    step.position.set(0, (top - 0.025) / 2, z);
    group.add(step);
    const cap = box(stair.widthM, 0.025, going, tread);
    cap.name = `tread-${i}`;
    cap.position.set(0, top - 0.0125, z);
    group.add(cap);
  }
  const startZ = -stair.runM / 2 + going / 2;
  const endZ = stair.runM / 2 - going / 2;
  for (const side of [-1, 1]) {
    const x = side * (stair.widthM / 2 - 0.045);
    const first = new THREE.Vector3(x, riser + 0.9, startZ);
    const last = new THREE.Vector3(x, riseM + 0.9, endZ);
    if (first.distanceTo(last) > 0.001) group.add(railBetween(first, last, metal));
    for (let i = 0; i < count; i += 3) {
      const post = box(0.035, 0.9, 0.035, metal);
      post.position.set(x, (i + 1) * riser + 0.45, -stair.runM / 2 + (i + 0.5) * going);
      group.add(post);
    }
    if ((count - 1) % 3 !== 0) {
      const post = box(0.035, 0.9, 0.035, metal);
      post.position.set(x, riseM + 0.45, endZ);
      group.add(post);
    }
  }
  return group;
}

/** Small deterministic textures require neither DOM/canvas nor remote image requests. */
function roofSurface(material: RoofConfig['material']): THREE.MeshStandardMaterial {
  const size = 128;
  const pixels = new Uint8Array(size * size * 4);
  const bumpPixels = new Uint8Array(size * size * 4);
  const base = new THREE.Color(material === 'felt' ? '#4b5051' : material === 'tile' ? '#a55a40' : '#7e9498');
  // DataTexture's colour-space conversion expects sRGB bytes, not linear values.
  base.convertLinearToSRGB();
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const noise = (((x * 73856093) ^ (y * 19349663)) >>> 0) % 101 / 100;
    let shade = 0.9 + noise * 0.16;
    let relief = 0.4 + noise * 0.3;
    if (material === 'felt') {
      // One-metre rolls with a visible bonded lap seam and fine mineral grit.
      if (x < 2) { shade *= 0.77; relief = 0.8; }
    } else if (material === 'tile') {
      const row = Math.floor(y / 32);
      const tileX = (x + (row % 2) * 16) % 32;
      const seam = y % 32 < 2 || tileX < 2;
      shade *= seam ? 0.55 : 0.9 + 0.15 * Math.sin(tileX / 32 * Math.PI);
      relief = seam ? 0.2 : 0.65 + 0.15 * Math.sin(tileX / 32 * Math.PI);
    } else {
      const rib = x % 64;
      shade *= rib < 3 ? 0.77 : 1;
      relief = rib < 3 ? 0.95 : 0.35;
    }
    const offset = (y * size + x) * 4;
    pixels[offset] = Math.min(255, base.r * 255 * shade);
    pixels[offset + 1] = Math.min(255, base.g * 255 * shade);
    pixels[offset + 2] = Math.min(255, base.b * 255 * shade);
    pixels[offset + 3] = 255;
    bumpPixels[offset] = bumpPixels[offset + 1] = bumpPixels[offset + 2] = relief * 255;
    bumpPixels[offset + 3] = 255;
  }
  const map = new THREE.DataTexture(pixels, size, size, THREE.RGBAFormat);
  const bumpMap = new THREE.DataTexture(bumpPixels, size, size, THREE.RGBAFormat);
  for (const texture of [map, bumpMap]) {
    texture.userData.ppwBuildingOwned = true;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.generateMipmaps = true;
    texture.needsUpdate = true;
  }
  map.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshStandardMaterial({
    map, bumpMap, bumpScale: material === 'felt' ? 0.009 : 0.018,
    roughness: material === 'felt' ? 0.98 : material === 'tile' ? 0.82 : 0.4,
    metalness: material === 'metal' ? 0.65 : 0,
    side: THREE.DoubleSide,
  });
}

/** Dispose only procedural textures allocated here; catalog/environment/shared maps stay intact. */
export function disposeBuildingTextures(root: THREE.Object3D): void {
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of materials) {
      for (const value of Object.values(material)) {
        if (!(value instanceof THREE.Texture) || value.userData.ppwBuildingOwned !== true
          || value.userData.ppwBuildingDisposed === true) continue;
        value.userData.ppwBuildingDisposed = true;
        value.dispose();
      }
    }
  });
}

/** Clip individual triangulated faces at the gable ridge; works for concave footprints. */
function clippedHalf(polygon: Polygon, axis: 'x' | 'y', ridge: number, direction: 1 | -1): Polygon {
  const output: Polygon = [];
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    const insideA = direction * (a[axis] - ridge) >= -1e-9;
    const insideB = direction * (b[axis] - ridge) >= -1e-9;
    if (insideA) output.push(a);
    if (insideA !== insideB) {
      const t = (ridge - a[axis]) / (b[axis] - a[axis]);
      output.push({ x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) });
    }
  }
  return output;
}

/** Polygon roof with true-pitch slopes, overhanging eaves, fascia and felt/tile/metal finish. */
export function roofMesh(polygon: Polygon, elevationM: number, config: RoofConfig): THREE.Group {
  const group = new THREE.Group();
  group.name = 'building-roof';
  group.userData = { buildingPart: 'roof', material: config.material };
  const surface = createRoofSurface(polygon, elevationM, config);
  if (!surface) return group;
  const { polygon: points, config: clean, axis, ridge } = surface;
  const height = (point: Vertex) => roofHeightAt(surface, point) - elevationM;
  const topPositions: number[] = [];
  const uv: number[] = [];
  const addTop = (a: Vertex, b: Vertex, c: Vertex) => {
    const cross = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
    // Upward normals in the x/elevation/z world frame.
    for (const point of cross > 0 ? [a, c, b] : [a, b, c]) {
      topPositions.push(point.x, height(point), point.y);
      uv.push(point.x, point.y);
    }
  };
  const triangles = THREE.ShapeUtils.triangulateShape(points.map((point) => new THREE.Vector2(point.x, point.y)), []);
  for (const triangle of triangles) {
    const face = triangle.map((index) => points[index]);
    const pieces = clean.style === 'gable' ? [clippedHalf(face, axis, ridge, 1), clippedHalf(face, axis, ridge, -1)] : [face];
    for (const piece of pieces) for (let i = 1; i + 1 < piece.length; i++) addTop(piece[0], piece[i], piece[i + 1]);
  }
  if (topPositions.length === 0) return group;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(topPositions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.computeVertexNormals();
  const top = new THREE.Mesh(geometry, roofSurface(clean.material));
  top.name = 'roof-covering';
  top.castShadow = top.receiveShadow = true;
  group.add(top);

  const sidePositions: number[] = [];
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const cuts = [a];
    if (clean.style === 'gable' && (a[axis] - ridge) * (b[axis] - ridge) < 0) {
      const t = (ridge - a[axis]) / (b[axis] - a[axis]);
      cuts.push({ x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) });
    }
    cuts.push(b);
    for (let j = 0; j + 1 < cuts.length; j++) {
      const start = cuts[j];
      const end = cuts[j + 1];
      sidePositions.push(
        start.x, 0, start.y, end.x, 0, end.y, end.x, height(end), end.y,
        start.x, 0, start.y, end.x, height(end), end.y, start.x, height(start), start.y,
      );
    }
  }
  const sideGeometry = new THREE.BufferGeometry();
  sideGeometry.setAttribute('position', new THREE.Float32BufferAttribute(sidePositions, 3));
  sideGeometry.computeVertexNormals();
  const sides = new THREE.Mesh(sideGeometry, new THREE.MeshStandardMaterial({ color: '#d5d4ce', roughness: 0.88, side: THREE.DoubleSide }));
  sides.name = 'roof-fascia';
  sides.castShadow = sides.receiveShadow = true;
  group.add(sides);
  const underside = new THREE.ShapeGeometry(new THREE.Shape(points.map((point) => new THREE.Vector2(point.x, point.y))));
  underside.rotateX(Math.PI / 2);
  const soffit = new THREE.Mesh(underside, new THREE.MeshStandardMaterial({ color: '#dddcd5', roughness: 0.9, side: THREE.DoubleSide }));
  soffit.name = 'roof-soffit';
  group.add(soffit);
  group.position.y = elevationM;
  return group;
}
