import * as THREE from 'three';
import { subtractConvex } from './gardenSurround';
import { cutPolygon, exposedSoil, type TerrainCut } from '../../designer/terrainCuts';
import type { Polygon } from '../../lib/geometry';
export function cutPieces(polygon: Polygon, cuts: readonly TerrainCut[]): Polygon[] {
  if (!cuts.length) return [polygon];
  const xs = polygon.map((p) => p.x),
    ys = polygon.map((p) => p.y);
  const minX = Math.min(...xs),
    maxX = Math.max(...xs),
    minY = Math.min(...ys),
    maxY = Math.max(...ys);
  let pieces = [polygon];
  for (const c of cuts) {
    if (c.x >= maxX || c.x + 1 <= minX || c.y >= maxY || c.y + 1 <= minY) continue;
    pieces = pieces.flatMap((p) => subtractConvex(p, cutPolygon(c)));
  }
  return pieces;
}
export function soilGeometry(values: number[]) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(values, 3));
  g.computeVertexNormals();
  return g;
}
export function soilMeshes(cuts: TerrainCut[]) {
  const group = new THREE.Group(),
    shape = exposedSoil(cuts);
  for (const [name, values, color] of [
    ['floor', shape.floor, 0x856c52],
    ['wall', shape.walls, 0x9b7956],
  ] as const) {
    if (!values.length) continue;
    const mesh = new THREE.Mesh(
      soilGeometry(values),
      new THREE.MeshStandardMaterial({ color, roughness: 1, side: THREE.DoubleSide }),
    );
    mesh.name = 'excavation-' + name;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  return group;
}
export function cutBackdrop(ground: THREE.Mesh, cuts: TerrainCut[]) {
  const { x, z } = ground.position;
  const square = [
    { x: x - 300, y: z - 300 },
    { x: x + 300, y: z - 300 },
    { x: x + 300, y: z + 300 },
    { x: x - 300, y: z + 300 },
  ];
  const points: number[] = [],
    uv: number[] = [];
  for (const piece of cutPieces(square, cuts))
    for (let i = 1; i + 1 < piece.length; i++)
      for (const p of [piece[0], piece[i + 1], piece[i]]) {
        points.push(p.x - x, z - p.y, 0);
        uv.push((p.x - x + 300) / 600, (z - p.y + 300) / 600);
      }
  const g = soilGeometry(points);
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return g;
}
