import { describe, expect, it } from 'vitest';
import { filterServicePresentation, visibleServiceRuns } from '../serviceScene';
import { ALL_DISCIPLINES, ALL_VISIBILITY_PARTS, visibilityPreset } from '../disciplineVisibility';
import {
  estimateServices,
  serviceRunPoints3D,
  type BuildingServices,
  type ServiceRun,
} from '../buildingServices';
import { servicePorts } from '../serviceConnections';
import type { Property } from '../../store/propertyStore';

const run = (id: string, levelId = 'upper'): ServiceRun => ({
  id,
  levelId,
  system: 'cold-water',
  materialId: 'hpl-aquasafe-upvc-20',
  diameterMm: 20,
  startElevationM: -0.2,
  endElevationM: 0.3,
  points: [
    { x: 1, y: 2, elevationM: -0.2 },
    { x: 1, y: 2, elevationM: 2.4 },
    { x: 3, y: 2, elevationM: 0.3 },
  ],
});
const property = (
  services: BuildingServices,
): Pick<Property, 'levels' | 'wallHeightM' | 'services'> => ({
  levels: [
    { id: 'ground', index: 0, heightM: 3, name: 'Ground' },
    { id: 'upper', index: 1, heightM: 3, name: 'Upper' },
    { id: 'roof', index: 2, kind: 'roof', name: 'Roof' },
  ],
  services,
});
describe('services scene derives visibility after connection resolution', () => {
  it('preserves explicit vertical nodes and adds an upper-floor datum once', () => {
    const p = property({
      version: 1,
      fixtures: [],
      runs: [run('upper'), run('ground', 'ground'), run('roof', 'roof'), run('orphan', 'missing')],
    });
    const upper = visibleServiceRuns(p, 'upper', 'floor', ALL_DISCIPLINES);
    expect(upper.map((item) => item.id)).toEqual(['upper']);
    expect(upper[0].baseElevationM).toBeCloseTo(3.18);
    expect(serviceRunPoints3D(upper[0]).map((point) => point.elevationM)).toEqual([-0.2, 2.4, 0.3]);
    expect(
      visibleServiceRuns(p, 'upper', 'building', ALL_DISCIPLINES).map((item) => item.id),
    ).toEqual(['upper', 'ground']);
  });
  it('resolves fixture-connected endpoints before rendering without moving unlinked bends or saved data', () => {
    const fixture = {
      id: 'sink',
      levelId: 'upper',
      kind: 'sink' as const,
      x: 3,
      y: 4,
      widthM: 0.6,
      depthM: 0.5,
      heightM: 0.9,
      rotation: 90,
      elevationM: 0.2,
    };
    const services: BuildingServices = {
      version: 1,
      fixtures: [fixture],
      runs: [{ ...run('supply'), endConnection: { fixtureId: 'sink', portId: 'cold-water' } }],
    };
    const before = structuredClone(services);
    const p = property(services);
    const port = servicePorts(fixture).find((item) => item.id === 'cold-water')!;
    const result = visibleServiceRuns(p, 'upper', 'floor', ALL_DISCIPLINES)[0];
    expect(result.points[result.points.length - 1]).toMatchObject({
      x: port.x,
      y: port.y,
      elevationM: port.elevationM,
    });
    expect(result.endElevationM).toBe(port.elevationM);
    expect(result.points[1]).toEqual(before.runs[0].points[1]);
    expect(services).toEqual(before);
  });
  it('route-only view resolves hidden fixture endpoints first and never changes canonical dimensions or quantity', () => {
    const sink = { id: 'sink', levelId: 'upper', kind: 'sink' as const, x: 3, y: 4, widthM: .6, depthM: .5, heightM: .9, rotation: 0 };
    const services: BuildingServices = { version: 1, fixtures: [sink], runs: [{ ...run('water'), endConnection: { fixtureId: 'sink', portId: 'cold-water' } }, { ...run('electric'), system: 'electrical' }] };
    const before = structuredClone(services), quantities = estimateServices(services), pipes = visibilityPreset('pipes');
    const display = filterServicePresentation(services, pipes.visible, pipes.parts);
    expect(display.fixtures).toEqual([]); expect(display.runs.map(r => r.id)).toEqual(['water']);
    const port = servicePorts(sink).find(p => p.id === 'cold-water')!;
    expect(display.runs[0].points[display.runs[0].points.length - 1]).toMatchObject({ x: port.x, y: port.y, elevationM: port.elevationM });
    expect(services).toEqual(before); expect(estimateServices(services)).toEqual(quantities);
    expect(visibleServiceRuns(property(services), 'upper', 'building', ALL_DISCIPLINES, { ...ALL_VISIBILITY_PARTS, routes: false })).toEqual([]);
  });
  it('hides discipline geometry without changing canonical quantities or other storeys', () => {
    const services: BuildingServices = {
      version: 1,
      fixtures: [],
      runs: [
        run('water'),
        {
          ...run('air'),
          system: 'ventilation',
          materialId: 'vortice-round-duct-100',
          diameterMm: 100,
        },
      ],
    };
    const p = property(services),
      before = structuredClone(p),
      quantities = estimateServices(services);
    expect(
      visibleServiceRuns(p, 'upper', 'floor', { ...ALL_DISCIPLINES, plumbing: false }).map(
        (item) => item.id,
      ),
    ).toEqual(['air']);
    expect(p).toEqual(before);
    expect(estimateServices(services)).toEqual(quantities);
    expect(visibleServiceRuns({ levels: p.levels }, 'upper', 'building', ALL_DISCIPLINES)).toEqual(
      [],
    );
  });
});
