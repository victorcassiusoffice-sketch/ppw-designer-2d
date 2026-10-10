import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { foundationMeshes } from '../foundationMeshes';
import { defaultFoundationRebar, type FoundationModel } from '../../../designer/foundation';
import { foundationSoilFaces } from '../../../designer/foundationExcavation';
import { foundationSceneFaces } from '../../../designer/foundationScene';
describe('foundation shared render dimensions', () => {
  it('preserves exact footprint, thickness and datum in actual three.js geometry', () => {
    const model = {
      version: 1 as const,
      enabled: true,
      elements: [
        {
          id: 'pad',
          kind: 'pad' as const,
          name: 'Pad',
          x: 3.2,
          y: -1.4,
          lengthM: 2.5,
          widthM: 1.2,
          depthM: 0.4,
          topElevationM: -0.6,
          rebar: defaultFoundationRebar(),
        },
      ],
    };
    const mesh = foundationMeshes(model, 1.7),
      b = new THREE.Box3().setFromObject(mesh);
    expect(b.min.x).toBeCloseTo(1.95);
    expect(b.max.x).toBeCloseTo(4.45);
    expect(b.min.z).toBeCloseTo(-2);
    expect(b.max.z).toBeCloseTo(-0.8);
    expect(b.min.y).toBeCloseTo(0.7);
    expect(b.max.y).toBeCloseTo(1.1);
    mesh.traverse((node) => {
      if (node instanceof THREE.Mesh) {
        node.geometry.dispose();
        (node.material as THREE.Material).dispose();
      }
    });
    expect(foundationMeshes({ ...model, enabled: false }).children).toHaveLength(0);
  });
  it('renders an open measured hole before fill and the same concrete after fill', () => {
    const model: FoundationModel = {
      version: 1,
      enabled: true,
      elements: [
        {
          id: 'hole',
          name: 'Hole',
          kind: 'pad',
          x: 2,
          y: 3,
          lengthM: 4,
          widthM: 2,
          depthM: 0.3,
          topElevationM: -1.2,
          rebar: defaultFoundationRebar(),
          excavation: { depthM: 1.5, topElevationM: 0, marginM: 0.2, stage: 'excavated' },
        },
      ],
    };
    const hole = foundationMeshes(model, 2, false, true);
    expect(hole.getObjectByName('foundation-hole')).toBeUndefined();
    const base = hole.getObjectByName('excavation-hole-z-0-0')!;
    const b = new THREE.Box3().setFromObject(base);
    expect(b.min.x).toBeCloseTo(-0.2);
    expect(b.max.x).toBeCloseTo(4.2);
    expect(b.min.z).toBeCloseTo(1.8);
    expect(b.max.z).toBeCloseTo(4.2);
    expect(b.min.y).toBeCloseTo(0.5);
    expect(b.max.y).toBeCloseTo(0.5);
    expect(hole.getObjectByName('excavation-depth-hole')?.userData.depthM).toBe(1.5);
    const faces = foundationSceneFaces(model, 2, true);
    expect(faces.some((face) => face.key.startsWith('foundation-hole'))).toBe(false);
    expect(
      faces.find((face) => face.key === 'excavation-hole-z-0-0')?.pts.every((p) => p.z === 0.5),
    ).toBe(true);
    const filled = {
      ...model,
      elements: model.elements.map((e) => ({
        ...e,
        excavation: { ...e.excavation!, stage: 'filled' as const },
      })),
    };
    const concrete = foundationMeshes(filled, 2, false, true).getObjectByName('foundation-hole')!;
    const c = new THREE.Box3().setFromObject(concrete);
    expect(c.min.y).toBeCloseTo(0.5);
    expect(c.max.y).toBeCloseTo(0.8);
    expect(foundationMeshes(model).children).toHaveLength(0);
  });
  it('removes internal soil faces between adjoining and overlapping holes', () => {
    const element = (id: string, x: number) => ({
      id,
      name: id,
      kind: 'strip' as const,
      x,
      y: 0,
      lengthM: 2,
      widthM: 2,
      depthM: 0.2,
      topElevationM: -0.8,
      rebar: defaultFoundationRebar(),
      excavation: { depthM: 1, topElevationM: 0, marginM: 0, stage: 'excavated' as const },
    });
    const faces = foundationSoilFaces({
      version: 1,
      enabled: true,
      elements: [element('left', -1), element('right', 1)],
    });
    expect(faces.some((f) => f.kind === 'soil' && f.points.every((p) => p.x === 0))).toBe(false);
    const overlapping = foundationSoilFaces({
      version: 1,
      enabled: true,
      elements: [element('left', -0.5), element('right', 0.5)],
    });
    const area = overlapping
      .filter((f) => f.kind === 'base')
      .reduce(
        (sum, f) =>
          sum +
          (Math.max(...f.points.map((p) => p.x)) - Math.min(...f.points.map((p) => p.x))) *
            (Math.max(...f.points.map((p) => p.y)) - Math.min(...f.points.map((p) => p.y))),
        0,
      );
    expect(area).toBe(6);
  });
});
