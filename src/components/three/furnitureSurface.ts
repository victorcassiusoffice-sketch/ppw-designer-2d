import * as THREE from 'three';

export type FurnitureSurface = 'fabric' | 'wood' | 'weave' | 'stone';

/** Deterministic microstructure, independent of scene size or frame rate.
 * Height goes in R, roughness in G: one small texture serves two PBR inputs.
 * It deliberately carries no colour, so product colours remain unchanged. */
export function furnitureSurface(kind: FurnitureSurface): THREE.DataTexture {
  const size = 128;
  const pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size * Math.PI * 2, v = y / size * Math.PI * 2;
    const warp = Math.sin(u * 2 + Math.sin(v) * 0.7);
    const fibre = Math.sin(u * 32) * Math.cos(v * 32);
    const grain = Math.sin(u * 12 + Math.sin(v * 2) * 1.4 + warp * 0.6);
    const pores = Math.sin(u * 29 + v * 3) * Math.cos(v * 19 - u * 2);
    const mineral = Math.sin(u * 3 + Math.sin(v * 2) * 2) * Math.cos(v * 4 + Math.sin(u));
    const noise = Math.sin(u * 43 + v * 31) * Math.sin(v * 47 - u * 37);
    const detail = kind === 'wood' ? grain * 0.65 + pores * 0.16 + noise * 0.06
      : kind === 'stone' ? mineral * 0.5 + pores * 0.18 + noise * 0.13
      : kind === 'weave' ? Math.sin(u * 16 + v * 4) * Math.cos(v * 16) * 0.7 + fibre * 0.2
      : fibre * 0.6 + noise * 0.1 + Math.sin(u * 2 + v * 3) * 0.1;
    const i = (y * size + x) * 4;
    pixels[i] = Math.round(128 + detail * 64);
    // Small finish variation creates pores and woven highlights, without
    // making fabric reflect like stone or changing base roughness globally.
    pixels[i + 1] = Math.round((kind === 'stone' ? 220 : kind === 'wood' ? 234 : 245) + detail * 10);
    pixels[i + 2] = pixels[i];
    pixels[i + 3] = 255;
  }
  const map = new THREE.DataTexture(pixels, size, size);
  map.name = `furniture-${kind}-microstructure`;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(kind === 'fabric' ? 5 : kind === 'weave' ? 5 : 2, kind === 'fabric' ? 5 : kind === 'weave' ? 4 : 1);
  map.magFilter = THREE.LinearFilter;
  map.minFilter = THREE.LinearMipmapLinearFilter;
  map.generateMipmaps = true;
  map.needsUpdate = true;
  return map;
}

/** Pressed edges, full centre and shallow cloth folds make cushions read as
 * upholstery rather than bevelled blocks. Coordinates stay inside the given
 * envelope; the catalogue fit remains the final authority. */
export function cushionGeometry(width: number, height: number, depth: number): THREE.BufferGeometry {
  const geometry = new THREE.BoxGeometry(width, height, depth, 8, 4, 8);
  const positions = geometry.getAttribute('position');
  for (let i = 0; i < positions.count; i++) {
    let x = positions.getX(i) / (width / 2);
    let y = positions.getY(i) / (height / 2);
    let z = positions.getZ(i) / (depth / 2);
    // A fourth-order superellipsoid keeps softly squared corners. Top and
    // bottom share the same seam, with no disconnected decorative geometry.
    const rounded = Math.pow(Math.pow(Math.abs(x), 4) + Math.pow(Math.abs(y), 4) + Math.pow(Math.abs(z), 4), -0.25);
    x *= rounded; y *= rounded; z *= rounded;
    const centre = (1 - x * x) * (1 - z * z);
    const cloth = Math.sin(x * 16 + z * 4) * Math.sin(z * 13 - x * 3) * 0.017;
    y *= 0.78 + 0.22 * centre + cloth * centre;
    positions.setXYZ(i, x * width / 2, y * height / 2, z * depth / 2);
  }
  geometry.computeVertexNormals();
  // Box faces have separate UV vertices. Average their coincident normals
  // without welding UVs, otherwise the fabric develops six visible creases.
  const normals = geometry.getAttribute('normal');
  const seams = new Map<string, { normal: THREE.Vector3; indices: number[] }>();
  for (let i = 0; i < positions.count; i++) {
    const key = `${positions.getX(i).toFixed(7)},${positions.getY(i).toFixed(7)},${positions.getZ(i).toFixed(7)}`;
    const seam = seams.get(key) ?? { normal: new THREE.Vector3(), indices: [] };
    seam.normal.add(new THREE.Vector3().fromBufferAttribute(normals, i));
    seam.indices.push(i);
    seams.set(key, seam);
  }
  for (const seam of seams.values()) {
    seam.normal.normalize();
    for (const i of seam.indices) normals.setXYZ(i, seam.normal.x, seam.normal.y, seam.normal.z);
  }
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}
