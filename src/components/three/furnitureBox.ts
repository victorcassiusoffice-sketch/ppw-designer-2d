import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { physicalFurnitureUVs } from './furnitureSurface';

/** Bevel directions depend only on tessellation. Furniture maps use measured
 * planar UVs, so Three's per-vertex angular UV computation is unnecessary. */
const patterns = new Map<1 | 2, RoundedBoxGeometry>();

export function furnitureBox(
  width: number,
  height: number,
  depth: number,
  segments: 1 | 2,
  radius: number,
) {
  let pattern = patterns.get(segments);
  if (!pattern) {
    pattern = new RoundedBoxGeometry(1, 1, 1, segments, 0.125);
    patterns.set(segments, pattern);
  }
  const source = pattern.getAttribute('position'),
    normal = pattern.getAttribute('normal');
  const positions = new Float32Array(source.count * 3);
  const r = Math.min(radius, width / 2, height / 2, depth / 2);
  const hx = width / 2 - r,
    hy = height / 2 - r,
    hz = depth / 2 - r;
  for (let i = 0; i < source.count; i++) {
    positions[3 * i] = Math.sign(source.getX(i)) * hx + normal.getX(i) * r;
    positions[3 * i + 1] = Math.sign(source.getY(i)) * hy + normal.getY(i) * r;
    positions[3 * i + 2] = Math.sign(source.getZ(i)) * hz + normal.getZ(i) * r;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('normal', normal.clone());
  geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(source.count * 2), 2));
  physicalFurnitureUVs(geometry);
  return geometry;
}
