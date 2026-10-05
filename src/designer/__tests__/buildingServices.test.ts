import { describe, expect, it } from 'vitest';
import { estimateServices, normaliseBuildingServices, servicePlanLengthM, serviceRunLengthM, type BuildingServices, type ServiceRun } from '../buildingServices';

const run = (patch: Partial<ServiceRun> = {}): ServiceRun => ({
  id: 'run-1', levelId: 'ground', system: 'hot-water', materialId: 'espace-cpvc-20', diameterMm: 20,
  points: [{ x: 0, y: 0 }, { x: 3, y: 0 }], startElevationM: 0, endElevationM: 4, ...patch,
});
const fixture = { id: 'sink-1', levelId: 'first', kind: 'sink', x: 2, y: 3, widthM: .6, depthM: .48, heightM: .85, rotation: -90 };

describe('building service geometry', () => {
  it('measures the complete polyline rather than the straight endpoint distance', () => {
    const route = run({ points: [{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 3, y: 4 }], endElevationM: 0 });
    expect(servicePlanLengthM(route)).toBe(7);
    expect(serviceRunLengthM(route)).toBe(7);
    expect(serviceRunLengthM({ ...route, endElevationM: 24 })).toBe(25);
  });
  it('handles vertical-only risers and preserves negative underground elevations', () => {
    const riser = run({ points: [{ x: 1, y: 1 }, { x: 1, y: 1 }], startElevationM: -.5, endElevationM: 2.5 });
    expect(servicePlanLengthM(riser)).toBe(0);
    expect(serviceRunLengthM(riser)).toBe(3);
    expect(normaliseBuildingServices({ version: 1, runs: [riser], fixtures: [] })?.runs[0]).toEqual(riser);
  });
  it('rounds known stock per route, preserves signed fall, and never pools disconnected offcuts', () => {
    const services: BuildingServices = { version: 1, runs: [run({ endElevationM: 0 }), run({ id: 'run-2', endElevationM: -4 })], fixtures: [] };
    expect(estimateServices(services)).toMatchObject([
      { lengthM: 3, fallM: 0, stockLengthM: 4, stockLengths: 1 },
      { lengthM: 5, fallM: 4, stockLengthM: 4, stockLengths: 2 },
    ]);
    expect(estimateServices({ version: 1, runs: [run({ points: [{ x: 0, y: 0 }, { x: 4, y: 0 }], endElevationM: 0 })], fixtures: [] })[0].stockLengths).toBe(1);
  });
  it.each([{ materialId: 'unverified' }, { diameterMm: 25 }, { system: 'cold-water' as const }])('does not assign supplier quantities to unmatched material data', patch => {
    const estimate = estimateServices({ version: 1, runs: [run(patch)], fixtures: [] })[0];
    expect(estimate).toMatchObject({ lengthM: 5, verifiedMaterial: false, stockLengthM: null, stockLengths: null });
  });
});

describe('persisted service normalisation', () => {
  it('preserves known floors, normalises rotation and deep-copies editable geometry', () => {
    const input = { version: 1, runs: [run()], fixtures: [fixture] };
    const result = normaliseBuildingServices(input, new Set(['ground', 'first']))!;
    expect(result.runs[0]).toEqual(input.runs[0]);
    expect(result.fixtures[0]).toMatchObject({ levelId: 'first', rotation: 270 });
    result.runs[0].points[0].x = 9;
    result.fixtures[0].x = 8;
    expect(input.runs[0].points[0].x).toBe(0);
    expect(input.fixtures[0].x).toBe(2);
  });
  it('never remaps unknown floors to ground or allows duplicate entity IDs', () => {
    const result = normaliseBuildingServices({ version: 1,
      runs: [run(), run({ id: 'ghost', levelId: 'missing' }), run()],
      fixtures: [{ ...fixture, id: 'run-1', levelId: 'ground' }, fixture],
    }, new Set(['ground', 'first']))!;
    expect(result.runs.map(r => r.id)).toEqual(['run-1']);
    expect(result.fixtures.map(f => f.id)).toEqual(['sink-1']);
  });
  it.each([
    { points: [{ x: 0, y: 0 }] },
    { points: [{ x: NaN, y: 0 }, { x: 1, y: 1 }] },
    { points: [{ x: 0, y: 0 }, { x: 10001, y: 1 }] },
    { points: Array(501).fill({ x: 1, y: 1 }) },
    { points: [{ x: 1, y: 1 }, { x: 1, y: 1 }], endElevationM: 0 },
    { diameterMm: 0 }, { startElevationM: Infinity }, { endElevationM: -21 }, { system: 'gas' },
  ])('removes corrupt persisted routes without changing valid siblings', patch => {
    const result = normaliseBuildingServices({ version: 1, runs: [run(), { ...run({ id: 'bad' }), ...patch }], fixtures: [] });
    expect(result?.runs).toEqual([run()]);
  });
  it('rejects invalid versions and malformed fixture footprints', () => {
    expect(normaliseBuildingServices({ version: 2, runs: [], fixtures: [] })).toBeUndefined();
    expect(normaliseBuildingServices(null)).toBeUndefined();
    expect(normaliseBuildingServices({ version: 1, runs: [], fixtures: [{ ...fixture, widthM: -1 }, { ...fixture, id: 'bad', kind: '__proto__' }] })?.fixtures).toEqual([]);
  });
});
