import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { pointInPolygon, type Polygon } from '../../../lib/geometry';
import { gardenSurfacePolygon, type Garden } from '../../../designer/garden';
import { OUTDOOR_PAVING_PRODUCTS } from '../../../data/outdoorPaving';
import { lawnFootprint, lawnTriangles } from '../gardenSurround';
import { disposeGardenResources, MAX_SURROUND_BLADES, surroundingLawn } from '../gardenGround';
import { gardenMeshes } from '../gardenMeshes';

const rect = (x: number, y: number, w: number, h: number): Polygon => [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }];

describe('read-only grass surrounding the building', () => {
  it('adds a three-metre border without inventing a plot or a persisted garden', () => {
    const rooms = [rect(0, 0, 6, 4)];
    const saved = JSON.stringify(rooms);
    const lawn = lawnFootprint(rooms)!;
    expect(lawn.boundary).toEqual(rect(-3, -3, 12, 10));
    expect(lawn.areaM2).toBeCloseTo(96, 8);
    expect(JSON.stringify(rooms)).toBe(saved);
    expect(lawnFootprint([])).toBeNull();
  });

  it('respects the actual plot and subtracts the union of adjacent rooms and overlapping patches', () => {
    const garden: Garden = { surfaces: [
      { id: 'patio', kind: 'concrete', x: 7, y: 0, widthM: 3, depthM: 2, elevationM: 0 },
      { id: 'gravel', kind: 'gravel', x: 8, y: 0, widthM: 2, depthM: 2, elevationM: 0 },
    ], fences: [] };
    const rooms = [rect(0, 0, 4, 4), rect(4, 0, 4, 4)];
    const lawn = lawnFootprint(rooms, garden, { widthM: 12, depthM: 10, originM: { x: 0, y: 0 } })!;
    expect(lawn.boundary).toEqual(rect(0, 0, 12, 10));
    expect(lawn.areaM2).toBeCloseTo(84, 8);
    for (const triangle of lawnTriangles(lawn)) {
      const centre = { x: triangle.reduce((sum, p) => sum + p.x, 0) / 3, y: triangle.reduce((sum, p) => sum + p.y, 0) / 3 };
      expect([...rooms, ...garden.surfaces.map(gardenSurfacePolygon)].some((p) => pointInPolygon(centre, p))).toBe(false);
    }
  });

  it('keeps the open courtyard of a concave footprint grassy in either polygon winding', () => {
    const room = [{ x: 0, y: 0 }, { x: 6, y: 0 }, { x: 6, y: 2 }, { x: 2, y: 2 }, { x: 2, y: 6 }, { x: 0, y: 6 }];
    for (const polygon of [room, [...room].reverse()]) {
      const lawn = lawnFootprint([polygon], undefined, { widthM: 8, depthM: 8, originM: { x: -1, y: -1 } })!;
      expect(lawn.areaM2).toBeCloseTo(44, 8);
      expect(lawn.pieces.some((piece) => pointInPolygon({ x: 3, y: 3 }, piece))).toBe(true);
      expect(lawn.pieces.some((piece) => pointInPolygon({ x: 1, y: 3 }, piece))).toBe(false);
    }
  });

  it('uses at most two draws and bounded grass detail even on a 500m plot', () => {
    const house = rect(0, 0, 6, 4);
    const garden: Garden = { surfaces: [{ id: 'patio', kind: 'path', x: 6, y: 0, widthM: 4, depthM: 4, elevationM: 0 }], fences: [] };
    const before = JSON.stringify(garden);
    const lawn = surroundingLawn([house], garden, { widthM: 500, depthM: 500, originM: { x: -10, y: -10 } });
    const turf = lawn.getObjectByName('surrounding-turf') as THREE.Mesh;
    const blades = lawn.getObjectByName('surrounding-grass-detail') as THREE.InstancedMesh;
    expect(lawn.children).toHaveLength(2);
    expect(blades.count).toBe(MAX_SURROUND_BLADES);
    const matrix = new THREE.Matrix4();
    const point = new THREE.Vector3();
    for (let i = 0; i < blades.count; i++) {
      blades.getMatrixAt(i, matrix);
      point.setFromMatrixPosition(matrix);
      expect(point.x).toBeGreaterThanOrEqual(-10);
      expect(point.x).toBeLessThanOrEqual(490);
      expect(point.z).toBeGreaterThanOrEqual(-10);
      expect(point.z).toBeLessThanOrEqual(490);
      expect(pointInPolygon({ x: point.x, y: point.z }, house)).toBe(false);
      expect(pointInPolygon({ x: point.x, y: point.z }, gardenSurfacePolygon(garden.surfaces[0]))).toBe(false);
    }
    const positions = turf.geometry.getAttribute('position');
    for (let i = 0; i < positions.count; i++) expect(positions.getY(i)).toBeLessThan(0);
    expect(JSON.stringify(garden)).toBe(before);
    disposeGardenResources(lawn);
  });

  it('returns no turf when the entire site already has a user surface', () => {
    const garden: Garden = { surfaces: [{ id: 'all-concrete', kind: 'concrete', x: 0, y: 0, widthM: 10, depthM: 10, elevationM: 0 }], fences: [] };
    const lawn = surroundingLawn([], garden, { widthM: 10, depthM: 10, originM: { x: 0, y: 0 } });
    expect(lawn.children).toHaveLength(0);
  });

  it('lays sourced paving joints at the real piece dimensions and leaves concrete unjointed', () => {
    const product = OUTDOOR_PAVING_PRODUCTS.find((p) => p.tileWidthM !== p.tileDepthM)!;
    const garden: Garden = { surfaces: [
      { id: 'slabs', kind: 'path', x: 0, y: 0, widthM: 1.2, depthM: 1.1, elevationM: 0, pavingProductId: product.id },
      { id: 'concrete', kind: 'concrete', x: 2, y: 0, widthM: 2, depthM: 2, elevationM: 0 },
    ], fences: [] };
    const group = gardenMeshes(garden);
    const slabs = group.getObjectByName('garden-surface-slabs')!;
    const lines = slabs.children.find((object) => object instanceof THREE.LineSegments) as THREE.LineSegments;
    const positions = lines.geometry.getAttribute('position');
    expect(positions.getX(0)).toBeCloseTo(product.tileWidthM);
    const verticalLines = Math.ceil(1.2 / product.tileWidthM) - 1;
    expect(positions.getZ(verticalLines * 2)).toBeCloseTo(product.tileDepthM);
    const concrete = group.getObjectByName('garden-surface-concrete')!;
    expect(concrete.children.some((object) => object instanceof THREE.LineSegments || object instanceof THREE.InstancedMesh)).toBe(false);
    disposeGardenResources(group);
  });

  it('cleans private maps and instance buffers once without disposing any unrelated material map', () => {
    const group = gardenMeshes(undefined, [rect(0, 0, 4, 4)]);
    const turf = group.getObjectByName('surrounding-turf') as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
    const owned = vi.spyOn(turf.material.map!, 'dispose');
    const blades = group.getObjectByName('surrounding-grass-detail') as THREE.InstancedMesh;
    const instanceDisposed = vi.fn();
    blades.addEventListener('dispose', instanceDisposed);
    expect(blades.instanceMatrix).toBeDefined();
    expect(blades.instanceColor).not.toBeNull();
    const unrelatedMap = new THREE.Texture();
    const untouched = vi.spyOn(unrelatedMap, 'dispose');
    group.add(new THREE.Mesh(new THREE.PlaneGeometry(), new THREE.MeshStandardMaterial({ map: unrelatedMap })));
    disposeGardenResources(group);
    disposeGardenResources(group);
    expect(owned).toHaveBeenCalledTimes(1);
    expect(untouched).not.toHaveBeenCalled();
    expect(instanceDisposed).toHaveBeenCalledTimes(1);
  });
});
