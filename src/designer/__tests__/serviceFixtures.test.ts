import { describe, expect, it } from 'vitest';
import type { Property } from '../../store/propertyStore';
import { visibleServiceFixtures } from '../serviceFixtures';
import type { ServiceFixture } from '../buildingServices';

const fixture = (id: string, levelId: string): ServiceFixture => ({
  id,
  levelId,
  kind: 'toilet',
  x: 2,
  y: 3,
  widthM: 0.4,
  depthM: 0.7,
  heightM: 0.78,
  rotation: 90,
});
const property: Pick<Property, 'levels' | 'wallHeightM' | 'services'> = {
  levels: [
    { id: 'ground', index: 0, name: 'Ground', heightM: 3 },
    { id: 'first', index: 1, name: 'First', heightM: 3.2 },
    { id: 'roof', index: 2, kind: 'roof', name: 'Roof' },
  ],
  services: {
    version: 1,
    runs: [],
    fixtures: [
      fixture('lower', 'ground'),
      fixture('upper', 'first'),
      fixture('unknown', 'gone'),
      fixture('on-roof', 'roof'),
    ],
  },
};
describe('service fixture plan and building level parity', () => {
  it('adds mounted and below-floor fixture offsets to the floor exactly once without altering the saved offset', () => {
    const mounted = { ...fixture('fan', 'first'), kind: 'extractor-fan' as const, elevationM: 2.1 };
    const buried = {
      ...fixture('chamber', 'ground'),
      kind: 'sewer-connection' as const,
      elevationM: -0.6,
    };
    const p = {
      ...property,
      services: { version: 1 as const, runs: [], fixtures: [mounted, buried] },
    };
    const placements = visibleServiceFixtures(p, 'first', 'building');
    expect(placements[0].elevationM).toBeCloseTo(5.28);
    expect(placements[1].elevationM).toBeCloseTo(-0.6);
    expect(mounted.elevationM).toBe(2.1);
  });
  it('shows only the selected storey in plan or isolated 3D', () => {
    expect(visibleServiceFixtures(property, 'ground')).toEqual([
      { ...fixture('lower', 'ground'), elevationM: 0 },
    ]);
    const upper = visibleServiceFixtures(property, 'first');
    expect(upper).toHaveLength(1);
    expect(upper[0]).toMatchObject({ id: 'upper', levelId: 'first' });
    expect(upper[0].elevationM).toBeCloseTo(3.18);
  });
  it('assembles every actual storey and excludes orphan/roof records without mutating saves', () => {
    const before = structuredClone(property);
    const fixtures = visibleServiceFixtures(property, 'first', 'building');
    expect(fixtures.map((f) => f.id)).toEqual(['lower', 'upper']);
    expect(property).toEqual(before);
    expect(visibleServiceFixtures(property, 'roof')).toEqual([]);
  });
  it('keeps old projects without services empty', () => {
    expect(visibleServiceFixtures({ levels: property.levels }, 'ground')).toEqual([]);
  });
});
