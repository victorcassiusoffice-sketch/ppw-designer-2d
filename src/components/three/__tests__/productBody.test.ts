// @vitest-environment node
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { bodyObject, bodyTemplate, productEnvelope } from '../productBody';
import type { ItemSolid } from '../../../designer/roomSolids';
import { rotatedFootprint } from '../../../lib/geometry';

function item(rotationDeg = 0): ItemSolid {
  const footprint = rotatedFootprint({ lengthM: 2, widthM: 0.9 }, rotationDeg);
  return { key: 'test', instanceId: 'one', x0: 3, x1: 3 + footprint.w, y0: 4, y1: 4 + footprint.h,
    z0: 2.88, z1: 4.38, lengthM: 2, widthM: 0.9, heightM: 1.5, hex: '#808080', rotationDeg };
}

function sourceModel() {
  const scene = new THREE.Group();
  scene.position.set(200, 300, -800);
  scene.scale.set(1000, 1000, 1000); // mm authoring plus off-centre parent.
  const nested = new THREE.Group();
  nested.position.set(2, 1, -3);
  nested.rotation.set(0.18, 0.61, -0.1);
  // An octahedron exposes the loose-box bug: rotated local AABB corners
  // include empty space; actual vertex bounds are materially smaller.
  const mesh = new THREE.Mesh(new THREE.OctahedronGeometry(1), new THREE.MeshStandardMaterial({ color: '#808080' }));
  mesh.scale.set(1.6, 0.7, 0.5);
  nested.add(mesh);
  scene.add(nested);
  return { scene, mesh };
}

describe('dimension-accurate imported product bodies', () => {
  it('measures vertices of transformed nested GLB nodes rather than a padded local box', () => {
    const { scene } = sourceModel();
    const template = bodyTemplate(scene);
    const loose = new THREE.Box3().setFromObject(scene).getSize(new THREE.Vector3());
    const precise = template.bbox.getSize(new THREE.Vector3());
    expect(precise.x).toBeLessThan(loose.x);
    expect(precise.z).toBeLessThan(loose.z);
  });

  it('fits every model/front/up/length-axis combination to real L×W×H and raised floor', () => {
    const { scene } = sourceModel();
    const template = bodyTemplate(scene);
    for (const frontEdge of ['top', 'bottom', 'left', 'right'] as const)
      for (const modelFront of ['+x', '-x', '+z', '-z'] as const)
        for (const modelUp of ['+y', '+z', '-z'] as const)
          for (const lengthAxis of ['auto', 'x', 'z'] as const) {
            const placed = item();
            const fitted = bodyObject({ ...placed, frontEdge, modelFront, modelUp, lengthAxis }, template);
            const bounds = new THREE.Box3().setFromObject(fitted, true);
            expect(bounds.min.x).toBeCloseTo(placed.x0, 7);
            expect(bounds.max.x).toBeCloseTo(placed.x1, 7);
            expect(bounds.min.z).toBeCloseTo(placed.y0, 7);
            expect(bounds.max.z).toBeCloseTo(placed.y1, 7);
            expect(bounds.min.y).toBeCloseTo(placed.z0, 7);
            expect(bounds.max.y).toBeCloseTo(placed.z1, 7);
          }
  });

  it('retains object scale and floor pivot across plan rotation while leaving the cached source alone', () => {
    const { scene, mesh } = sourceModel();
    const template = bodyTemplate(scene);
    const saved = scene.toJSON();
    for (const rotation of [0, 23, 90, 127, 270]) {
      const placed = item(rotation);
      const body = bodyObject({ ...placed, frontEdge: 'left' }, template);
      expect(body.rotation.y).toBeCloseTo(-rotation * Math.PI / 180);
      const bounds = new THREE.Box3().setFromObject(body, true);
      expect(bounds.min.y).toBeCloseTo(placed.z0, 7);
      expect(bounds.max.y).toBeCloseTo(placed.z1, 7);
      expect(bounds.min.x).toBeGreaterThanOrEqual(placed.x0 - 1e-7);
      expect(bounds.max.x).toBeLessThanOrEqual(placed.x1 + 1e-7);
      expect(bounds.min.z).toBeGreaterThanOrEqual(placed.y0 - 1e-7);
      expect(bounds.max.z).toBeLessThanOrEqual(placed.y1 + 1e-7);
      body.traverse(object => {
        if (object instanceof THREE.Mesh) {
          expect(object.geometry).toBe(mesh.geometry);
          expect(object.material).not.toBe(mesh.material);
          (object.material as THREE.MeshStandardMaterial).emissive.set('#ff0000');
        }
      });
    }
    expect(scene.toJSON()).toEqual(saved);
  });

  it('rejects empty/flat/nonfinite geometry instead of introducing enormous scales', () => {
    expect(() => bodyTemplate(new THREE.Group())).toThrow(/three-dimensional/);
    const flat = new THREE.Group();
    flat.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2)));
    expect(() => bodyTemplate(flat)).toThrow(/three-dimensional/);
    const invalid = new THREE.Group();
    invalid.add(new THREE.Mesh(new THREE.BoxGeometry()));
    invalid.scale.x = Number.NaN;
    expect(() => bodyTemplate(invalid)).toThrow(/three-dimensional/);
    expect(() => productEnvelope({ ...item(), lengthM: -1 })).toThrow(/positive finite/);
  });
});

describe('art fallback uses the actual product envelope', () => {
  it('rotates a 2×0.9m box rather than inflating it to the diagonal collision AABB', () => {
    for (const rotation of [0, 30, 45, 90, 137]) {
      const placed = item(rotation);
      const envelope = productEnvelope(placed);
      expect(envelope.size).toEqual({ x: 2, y: 1.5, z: 0.9 });
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(envelope.size.x, envelope.size.y, envelope.size.z));
      mesh.position.copy(envelope.position);
      mesh.rotation.y = envelope.yawRad;
      const bounds = new THREE.Box3().setFromObject(mesh, true);
      expect(bounds.min.x).toBeCloseTo(placed.x0, 6);
      expect(bounds.max.x).toBeCloseTo(placed.x1, 6);
      expect(bounds.min.z).toBeCloseTo(placed.y0, 6);
      expect(bounds.max.z).toBeCloseTo(placed.y1, 6);
      expect(bounds.min.y).toBeCloseTo(placed.z0, 6);
      expect(bounds.max.y).toBeCloseTo(placed.z1, 6);
    }
  });
});
