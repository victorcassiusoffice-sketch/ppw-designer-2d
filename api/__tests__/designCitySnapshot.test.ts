import { describe, expect, it } from 'vitest';
import {
  validateSnapshotCity,
  validateSnapshotFoundation,
  validateSnapshotMeasurements,
} from '../_lib/designSnapshotValidation';
import { emptyCity, sampleCity } from '../../src/designer/city';
import { defaultFoundationRebar } from '../../src/designer/foundation';

describe('saved City Build snapshot boundary', () => {
  it('preserves legacy saves, optional foundations and unknown outer property fields', () => {
    const legacy = { rooms: [], name: 'Legacy property', futurePropertyFeature: { value: 1 } };
    expect(validateSnapshotCity(legacy)).toBeNull();
    expect(validateSnapshotMeasurements(legacy)).toBeNull();
    expect(
      validateSnapshotMeasurements({
        ...legacy,
        foundation: { version: 1, enabled: false, elements: [] },
      }),
    ).toBeNull();
    expect(validateSnapshotMeasurements({ ...legacy, city: emptyCity() })).toBeNull();
  });
  it('accepts the complete city without altering measured dimensions or house content', () => {
    const snapshot = {
      rooms: [
        {
          id: 'room',
          polygon: [
            { x: 0, y: 0 },
            { x: 5, y: 0 },
            { x: 5, y: 4 },
            { x: 0, y: 4 },
          ],
          placedItems: [{ instanceId: 'chair', productId: 'chair', x: 1, y: 2, rotation: 90 }],
        },
      ],
      city: sampleCity(),
    };
    const before = JSON.stringify(snapshot);
    expect(validateSnapshotMeasurements(snapshot)).toBeNull();
    expect(JSON.stringify(snapshot)).toBe(before);
  });
  it.each([
    null,
    { ...emptyCity(), version: 2 },
    { ...emptyCity(), roads: [{ ...sampleCity().roads[0], widthM: -1 }] },
    {
      ...emptyCity(),
      networks: [
        {
          ...sampleCity().networks[0],
          points: [
            { x: 0, y: 0, z: NaN },
            { x: 1, y: 1, z: 0 },
          ],
        },
      ],
    },
    { ...emptyCity(), roads: [sampleCity().roads[0], sampleCity().roads[0]] },
    { ...emptyCity(), certifiedRoads: true },
    { ...emptyCity(), assets: [{ ...sampleCity().assets[0], unitPrice: 1 }] },
    { ...emptyCity(), dataCentre: { ...sampleCity().dataCentre, pue: 0.5 } },
  ])('rejects malformed city instead of accepting a partial takeoff', (city) => {
    expect(validateSnapshotCity({ city })).toContain('Invalid city');
    expect(validateSnapshotMeasurements({ rooms: [], city })).toContain('Invalid city');
  });
  it('still rejects malformed foundations when a valid city is present', () => {
    const foundation = {
      version: 1,
      enabled: true,
      elements: [
        {
          id: 'pad',
          name: 'Pad',
          kind: 'pad',
          x: 0,
          y: 0,
          lengthM: 2,
          widthM: 2,
          depthM: -1,
          topElevationM: 0,
          rebar: defaultFoundationRebar(),
        },
      ],
    };
    expect(validateSnapshotMeasurements({ foundation, city: sampleCity() })).toContain(
      'Invalid foundation',
    );
    expect(validateSnapshotFoundation({ city: null })).toBeNull();
  });
});
