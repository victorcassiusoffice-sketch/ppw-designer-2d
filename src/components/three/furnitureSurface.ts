import * as THREE from 'three';

export type FurnitureSurface = 'fabric' | 'wood' | 'weave' | 'stone';
const albedoPixels = new Map<FurnitureSurface, Uint8Array>();

/** Visible structure for original dimensional previews. A neutral map modulates
 * the model's own colour; it is never attached to purchased paint, flooring or
 * manufacturer GLBs. Grain has both broad figure and fine pores, so it remains
 * legible at room scale instead of disappearing with the normal-map mip level. */
export function furnitureAlbedo(kind: FurnitureSurface): THREE.DataTexture {
  const size = 256;
  const pixels = albedoPixels.get(kind) ?? new Uint8Array(size * size * 4);
  if (!albedoPixels.has(kind)) for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size * Math.PI * 2, v = y / size * Math.PI * 2;
    const noise = Math.sin(u * 71 + v * 37) * Math.sin(v * 53 - u * 29);
    const longGrain = Math.sin(v * 8 + Math.sin(u) * 0.55 + Math.sin(u * 2) * 0.24);
    const fineGrain = Math.sin(v * 47 + Math.sin(u * 2) * 2.4 + longGrain * 2);
    // Broad cathedral figure and pores survive at furniture viewing distance;
    // a finer grain alone disappears into mipmaps and looks like flat plastic.
    const figure = Math.sin(v * 2 + Math.sin(u) * 1.8 + Math.sin(u * 2) * 0.35);
    const darkPore = Math.pow(Math.max(0, fineGrain), 12);
    const wood = 229 + longGrain * 11 + figure * 9 + fineGrain * 5 - darkPore * 9 + noise * 3;
    const threads = Math.sin(u * 64) * Math.cos(v * 64);
    const slub = Math.sin(v * 17 + Math.sin(u * 3)) * Math.sin(u * 11);
    const fabric = 243 + threads * 7 + slub * 3 + noise * 2;
    const basket = Math.sin(u * 32) * Math.sin(v * 32);
    const weave = 233 + basket * 15 + threads * 4 + noise * 3;
    const vein = Math.pow(Math.max(0, Math.sin(v * 3 + Math.sin(u * 2) * 0.9 + Math.sin(u * 7) * 0.1)), 12);
    const stone = 245 - vein * 38 + noise * 4;
    const value = Math.round(Math.max(0, Math.min(255, kind === 'wood' ? wood : kind === 'stone' ? stone : kind === 'weave' ? weave : fabric)));
    const offset = (y * size + x) * 4;
    pixels[offset] = pixels[offset + 1] = pixels[offset + 2] = value;
    pixels[offset + 3] = 255;
  }
  albedoPixels.set(kind, pixels);
  // CPU generation is cached; the disposable GPU texture and pixel buffer
  // remain privately owned by each model, including the 2D snapshot queue.
  const map = new THREE.DataTexture(pixels.slice(), size, size);
  map.name = `furniture-${kind}-colour-structure`;
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(kind === 'wood' ? 1 : kind === 'stone' ? 1 : 3, kind === 'wood' ? 2 : kind === 'stone' ? 1 : 3);
  map.magFilter = THREE.LinearFilter;
  map.minFilter = THREE.LinearMipmapLinearFilter;
  map.generateMipmaps = true;
  map.needsUpdate = true;
  return map;
}

/** Map the tangible surface in metres, not one stretched image per box face.
 * Keeps the grain and thread size consistent across a chair leg and a tabletop. */
export function physicalFurnitureUVs(geometry: THREE.BufferGeometry): void {
  const positions = geometry.getAttribute('position');
  const normals = geometry.getAttribute('normal');
  const uv = geometry.getAttribute('uv');
  if (!uv) return;
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i);
    const nx = Math.abs(normals.getX(i)), ny = Math.abs(normals.getY(i)), nz = Math.abs(normals.getZ(i));
    if (ny >= nx && ny >= nz) uv.setXY(i, x, z);
    else if (nz >= nx) uv.setXY(i, x, y);
    else uv.setXY(i, z, y);
  }
  uv.needsUpdate = true;
}

/** Soft drape over an existing mattress: the top falls over both long edges
 * and the foot. Curves and folds are inside the explicitly supplied envelope.
 * No room, item size or extra purchasable object is created by this detail. */
export function drapedClothGeometry(width: number, depth: number, drop: number): THREE.BufferGeometry {
  const segmentsX = 36, segmentsZ = 40;
  const positions: number[] = [], uv: number[] = [], indices: number[] = [];
  const roundDrop = (edge: number) => {
    const t = Math.max(0, Math.min(1, (edge - 0.9) / 0.1));
    return t * t * (3 - 2 * t);
  };
  for (let z = 0; z <= segmentsZ; z++) for (let x = 0; x <= segmentsX; x++) {
    const u = x / segmentsX * 2 - 1, v = z / segmentsZ * 2 - 1;
    const side = roundDrop(Math.abs(u)), foot = roundDrop(v);
    const edge = Math.max(side, foot);
    // Long biased folds, not a regular crumpled-paper noise field. Gentle
    // depressions break up the duvet at room scale; small puckers gather at
    // its unsupported edges. Everything stays under the same top envelope.
    const waves = Math.sin(u * 11 + Math.sin(v * 2) * 1.4) * 0.013 + Math.sin(v * 8 + u * 2) * 0.008;
    const creaseA = Math.exp(-Math.pow((u - v * 0.12 + 0.24) / 0.075, 2)) * 0.022;
    const creaseB = Math.exp(-Math.pow((v + u * 0.3 - 0.36) / 0.055, 2)) * 0.011;
    const creases = Math.sin(u * 29 + v * 7) * Math.sin(v * 9) * 0.004 * edge;
    const height = -drop * edge + waves * (0.6 + edge * 0.4) + creases - (creaseA + creaseB) * (1 - edge);
    positions.push(u * width / 2, Math.max(-drop, Math.min(0.014, height)), v * depth / 2);
    uv.push(u * width / 2, v * depth / 2);
    if (z < segmentsZ && x < segmentsX) {
      const a = z * (segmentsX + 1) + x, b = a + segmentsX + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

/** Deterministic microstructure, independent of scene size or frame rate.
 * Height goes in R, roughness in G: one small texture serves two PBR inputs.
 * It deliberately carries no colour, so product colours remain unchanged. */
export function furnitureSurface(kind: FurnitureSurface): THREE.DataTexture {
  const size = 128;
  const pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size * Math.PI * 2, v = y / size * Math.PI * 2;
    const warp = Math.sin(v * 2 + Math.sin(u) * 0.7);
    const fibre = Math.sin(u * 32) * Math.cos(v * 32);
    const grain = Math.sin(v * 12 + Math.sin(u * 2) * 1.4 + warp * 0.6);
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
  const geometry = new THREE.BoxGeometry(width, height, depth, 12, 4, 12);
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
    const edgeGather = Math.exp(-Math.pow((Math.abs(x) - 0.79) / 0.18, 2)) + Math.exp(-Math.pow((Math.abs(z) - 0.79) / 0.18, 2));
    const cloth = Math.sin(x * 14 + z * 3) * Math.sin(z * 11 - x * 2) * 0.035;
    const pleats = Math.sin(x * 26 + z * 7) * edgeGather * 0.022;
    y *= Math.min(1, 0.74 + 0.26 * centre + cloth * centre + pleats);
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

/** Curved, closed chair shell with a full-width back and shaped shoulders.
 * It remains inside the declared width/height/depth and is fitted with the
 * complete SKU, so curvature cannot enlarge its collision footprint. */
export function curvedBackGeometry(width: number, height: number, depth: number): THREE.BufferGeometry {
  const thickness = Math.min(depth * 0.3, 0.028);
  const geometry = new THREE.BoxGeometry(width, height, thickness, 16, 6, 1);
  const positions = geometry.getAttribute('position');
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i);
    const u = x / (width / 2), v = y / (height / 2);
    const shoulder = 1 - 0.08 * Math.pow(Math.max(0, v), 2);
    const bow = (depth - thickness) * (u * u - 0.5);
    positions.setXYZ(i, x * shoulder, y - height * 0.035 * u * u * Math.max(0, v), z + bow);
  }
  geometry.computeVertexNormals();
  physicalFurnitureUVs(geometry);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}
