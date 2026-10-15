import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { serviceRouteMesh } from '../serviceRouteMeshes';
import type { ServiceRunPlacement } from '../../../designer/serviceScene';

const route = (overrides: Partial<ServiceRunPlacement> = {}): ServiceRunPlacement => ({
  id: 'route',
  levelId: 'upper',
  baseElevationM: 3.18,
  system: 'cold-water',
  materialId: 'hpl-aquasafe-upvc-20',
  diameterMm: 20,
  startElevationM: 0.4,
  endElevationM: 0.4,
  points: [
    { x: 1, y: 2, elevationM: 0.4 },
    { x: 1, y: 2, elevationM: 2.4 },
    { x: 4, y: 2, elevationM: 2.4 },
  ],
  ...overrides,
});
function instance(mesh: THREE.InstancedMesh, index: number) {
  const matrix = new THREE.Matrix4(),
    position = new THREE.Vector3(),
    quaternion = new THREE.Quaternion(),
    scale = new THREE.Vector3();
  mesh.getMatrixAt(index, matrix);
  matrix.decompose(position, quaternion, scale);
  return { position, quaternion, scale };
}
function dispose(root: THREE.Object3D) {
  const materials = new Set<THREE.Material>();
  root.traverse((node) => {
    if (node instanceof THREE.Mesh) {
      node.geometry.dispose();
      materials.add(node.material as THREE.Material);
    }
  });
  materials.forEach((material) => material.dispose());
}
describe('service route meshes preserve canonical coordination geometry', () => {
  it('places explicit vertical risers at the upper-floor datum and keeps their true length', () => {
    const root = serviceRouteMesh(route()),
      pipes = root.children[0] as THREE.InstancedMesh;
    expect(pipes.count).toBe(2);
    expect(instance(pipes, 0).position.y).toBeCloseTo(4.58, 5);
    expect(instance(pipes, 0).scale.y).toBeCloseTo(2, 5);
    expect(instance(pipes, 0).scale.x).toBeCloseTo(0.01, 6);
    expect(instance(pipes, 1).position.y).toBeCloseTo(5.58, 5);
    expect(instance(pipes, 1).scale.y).toBeCloseTo(3, 5);
    const nodes = root.children[1] as THREE.InstancedMesh;
    expect(instance(nodes, 0).position.y).toBeCloseTo(3.58, 5);
    expect(instance(nodes, 2).position.y).toBeCloseTo(5.58, 5);
    expect(root.userData).toMatchObject({ serviceRunId: 'route', levelId: 'upper' });
    dispose(root);
  });
  it('uses verified OD rather than the nominal inch-size designation for matching fire pipe', () => {
    const root = serviceRouteMesh(
      route({ system: 'fire-water', materialId: 'wheatland-sch10-1', diameterMm: 25.4 }),
    );
    expect(instance(root.children[0] as THREE.InstancedMesh, 0).scale.x * 2).toBeCloseTo(0.0334, 6);
    dispose(root);
  });
  it.each([{ diameterMm: 100 }, { system: 'electrical' as const, diameterMm: 40 }])(
    'does not substitute a stale catalogue OD for an edited route: %j',
    (override) => {
      const root = serviceRouteMesh(route(override));
      expect(instance(root.children[0] as THREE.InstancedMesh, 0).scale.x * 2).toBeCloseTo(
        override.diameterMm / 1000,
        6,
      );
      dispose(root);
    },
  );
  it('skips zero-length duplicate segments without dropping legitimate nodes or changing the input', () => {
    const run = route({
        points: [
          { x: 1, y: 2, elevationM: 0 },
          { x: 1, y: 2, elevationM: 0 },
          { x: 1, y: 2, elevationM: 3 },
        ],
      }),
      before = structuredClone(run);
    const root = serviceRouteMesh(run);
    expect((root.children[0] as THREE.InstancedMesh).count).toBe(1);
    expect((root.children[1] as THREE.InstancedMesh).count).toBe(3);
    expect(run).toEqual(before);
    dispose(root);
  });
});
