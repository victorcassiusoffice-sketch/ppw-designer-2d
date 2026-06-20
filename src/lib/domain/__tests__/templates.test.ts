/**
 * Phase 3 — per-domain build-space template tests.
 *
 * Guards: every domain yields a valid serializable default space; serialize
 * → deserialize round-trips deep-equal (the GATE-1 assertion); and the
 * wellness template stays byte-identical to the store's default room
 * blueprint (the "no behaviour change" firewall).
 */
import { describe, it, expect } from 'vitest';
import {
  getDefaultSpace,
  serializeSpace,
  deserializeSpace,
  type BuildSpace,
} from '../templates';
import type { DomainId } from '../types';
import { CAR_CATEGORIES } from '../../../data/products.schema';
import { rectToPolygon } from '../../geometry';

const DOMAINS: DomainId[] = ['wellness-room', 'airplane', 'car'];

describe('domain build-space templates — Phase 3', () => {
  it('yields a valid default space for every domain', () => {
    for (const d of DOMAINS) {
      const space = getDefaultSpace(d);
      expect(space.kind).toBeTruthy();
    }
  });

  it('maps each domain to its declared space kind', () => {
    expect(getDefaultSpace('wellness-room').kind).toBe('polygon-room');
    expect(getDefaultSpace('airplane').kind).toBe('fuselage-section');
    expect(getDefaultSpace('car').kind).toBe('vehicle-config');
  });

  it('round-trips serialize → deserialize deep-equal for every domain (GATE-1)', () => {
    for (const d of DOMAINS) {
      const space = getDefaultSpace(d);
      expect(deserializeSpace(serializeSpace(space))).toEqual(space);
    }
  });

  it('returns a fresh copy each call (templates are not shared mutable state)', () => {
    const a = getDefaultSpace('car');
    const b = getDefaultSpace('car');
    expect(a).not.toBe(b);
    if (a.kind === 'vehicle-config') {
      a.slots.paint = 'car-paint-midnight-blue';
    }
    // mutating one copy must not leak into the next instantiation
    expect((getDefaultSpace('car') as Extract<BuildSpace, { kind: 'vehicle-config' }>).slots.paint).toBeNull();
  });

  it('wellness template is byte-identical to the store default room blueprint', () => {
    const space = getDefaultSpace('wellness-room');
    expect(space).toEqual({
      kind: 'polygon-room',
      polygon: [], // blank-canvas-on-open: a fresh design draws its own room
      defaultDims: { lengthM: 5, widthM: 4 }, // == propertyStore DEFAULT_ROOM_DIMS
    });
    // the re-seed rectangle must match the geometry helper the store uses
    if (space.kind === 'polygon-room') {
      expect(rectToPolygon(space.defaultDims)).toEqual([
        { x: 0, y: 0 },
        { x: 5, y: 0 },
        { x: 5, y: 4 },
        { x: 0, y: 4 },
      ]);
    }
  });

  it('airplane fuselage section carries a flat seat-grid floor plane', () => {
    const space = getDefaultSpace('airplane');
    expect(space.kind).toBe('fuselage-section');
    if (space.kind === 'fuselage-section') {
      expect(space.lengthCm).toBeGreaterThan(0);
      expect(space.crossSectionWidthCm).toBeGreaterThan(0);
      expect(space.floorGrid.rows).toBeGreaterThan(0);
      expect(space.floorGrid.cols).toBeGreaterThan(0);
      expect(space.floorGrid.pitchCm).toBeGreaterThan(0);
    }
  });

  it('car vehicle config has a base model + an empty slot for every CarCategory', () => {
    const space = getDefaultSpace('car');
    expect(space.kind).toBe('vehicle-config');
    if (space.kind === 'vehicle-config') {
      expect(space.baseVehicleId.length).toBeGreaterThan(0);
      // one slot per CarCategory, all initially unchosen
      expect(Object.keys(space.slots).sort()).toEqual([...CAR_CATEGORIES].sort());
      for (const category of CAR_CATEGORIES) {
        expect(space.slots[category]).toBeNull();
      }
    }
  });

  it('deserialize rejects an unknown build-space kind', () => {
    expect(() => deserializeSpace(JSON.stringify({ kind: 'spaceship' }))).toThrow();
  });
});
