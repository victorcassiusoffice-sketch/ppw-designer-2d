import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { serviceFixtureMesh } from '../serviceFixtureMeshes';
import type { ServiceFixturePlacement } from '../../../designer/serviceFixtures';

const kinds = ['toilet', 'sink', 'mains-tap', 'electrical-board', 'sewer-connection'] as const;
function dispose(root: THREE.Object3D) {
  root.traverse((node) => {
    if (node instanceof THREE.Mesh) {
      node.geometry.dispose();
      (node.material as THREE.Material).dispose();
    }
  });
}

describe('generic service fixture geometry preserves the installation envelope', () => {
  for (const kind of kinds)
    for (const rotation of [0, 90, 180, 270]) {
      it(`${kind} keeps dimensions and floor elevation at ${rotation} degrees`, () => {
        const fixture: ServiceFixturePlacement = {
          id: 'fixture',
          levelId: 'upper',
          kind,
          x: -2.4,
          y: 5.2,
          widthM: 0.62,
          depthM: 0.83,
          heightM: 0.94,
          rotation,
          elevationM: 3.18,
        };
        const mesh = serviceFixtureMesh(fixture);
        const bounds = new THREE.Box3().setFromObject(mesh);
        const size = bounds.getSize(new THREE.Vector3());
        const centre = bounds.getCenter(new THREE.Vector3());
        const swapped = rotation % 180 === 90;
        expect(size.x).toBeCloseTo(swapped ? fixture.depthM : fixture.widthM, 5);
        expect(size.z).toBeCloseTo(swapped ? fixture.widthM : fixture.depthM, 5);
        expect(size.y).toBeCloseTo(fixture.heightM, 5);
        expect(bounds.min.y).toBeCloseTo(fixture.elevationM, 5);
        expect(centre.x).toBeCloseTo(fixture.x, 5);
        expect(centre.z).toBeCloseTo(fixture.y, 5);
        expect(mesh.userData).toMatchObject({
          serviceFixtureId: 'fixture',
          levelId: 'upper',
          genericServiceFixture: true,
        });
        expect(mesh.userData).not.toHaveProperty('productId');
        dispose(mesh);
      });
    }

  it('keeps every decorative mesh within the rotated planned footprint', () => {
    const angle = 37;
    const fixture: ServiceFixturePlacement = {
      id: 'basin',
      levelId: 'ground',
      kind: 'sink',
      x: 2,
      y: 4,
      widthM: 0.6,
      depthM: 0.45,
      heightM: 0.85,
      rotation: angle,
      elevationM: 0,
    };
    const mesh = serviceFixtureMesh(fixture);
    const inverse = new THREE.Matrix4().copy(mesh.matrixWorld).invert();
    mesh.updateMatrixWorld(true);
    inverse.copy(mesh.matrixWorld).invert();
    const vertex = new THREE.Vector3();
    mesh.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      expect(node.castShadow).toBe(true);
      const positions = node.geometry.getAttribute('position');
      for (let index = 0; index < positions.count; index++) {
        vertex
          .fromBufferAttribute(positions, index)
          .applyMatrix4(node.matrixWorld)
          .applyMatrix4(inverse);
        expect(Math.abs(vertex.x)).toBeLessThanOrEqual(fixture.widthM / 2 + 1e-5);
        expect(Math.abs(vertex.z)).toBeLessThanOrEqual(fixture.depthM / 2 + 1e-5);
        expect(vertex.y).toBeGreaterThanOrEqual(-1e-5);
        expect(vertex.y).toBeLessThanOrEqual(fixture.heightM + 1e-5);
      }
    });
    dispose(mesh);
  });
});
