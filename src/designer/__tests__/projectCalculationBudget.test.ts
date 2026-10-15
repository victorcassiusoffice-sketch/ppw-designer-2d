import { describe, expect, it } from 'vitest';
import {
  assessProjectCalculationBudget,
  PROJECT_CALCULATION_LIMITS,
} from '../projectCalculationBudget';
import { reviewProject } from '../projectReview';
import type { Property, Room } from '../../store/propertyStore';
const room = (id = 'room', x = 0): Room => ({
  id,
  name: id,
  polygon: [
    { x, y: 0 },
    { x: x + 4, y: 0 },
    { x: x + 4, y: 3 },
    { x, y: 3 },
  ],
  placedItems: [],
});
const property = (rooms: Room[] = [room()]): Property => ({
  id: 'project',
  name: 'Project',
  activeRoomId: rooms[0]?.id ?? '',
  rooms,
});

describe('bounded whole-project calculation preflight', () => {
  it('rejects unknown service junction floors and resolved zero-length links before quantities', () => {
    const p = property();
    p.services = { version: 1, fixtures: [], runs: [{ id: 'r', levelId: 'ground', system: 'cold-water', materialId: 'custom', diameterMm: 20,
      points: [{ x: 0, y: 0, elevationM: 0, junctionId: 'j' }, { x: 1, y: 0, elevationM: 0, junctionId: 'j' }], startElevationM: 0, endElevationM: 0 }],
      junctions: [{ id: 'j', levelId: 'ground', system: 'cold-water', x: 0, y: 0, elevationM: 0 }] };
    expect(assessProjectCalculationBudget(p).reason).toContain('collapses');
    p.services.junctions![0].levelId = 'missing';
    expect(assessProjectCalculationBudget(p).ok).toBe(false);
  });
  it('preserves normal measured rooms and overlapping shared walls without changing the model', () => {
    const p = property([room(), room('adjacent', 4), { ...room('upper'), levelId: 'first' }]);
    p.levels = [
      { id: 'ground', name: 'Ground', index: 0 },
      { id: 'first', name: 'First', index: 1 },
    ];
    const before = JSON.stringify(p),
      result = assessProjectCalculationBudget(p);
    expect(result.ok).toBe(true);
    expect(result.counts.vertices).toBe(12);
    expect(result.counts.estimatedWorkUnits).toBeGreaterThan(0);
    expect(JSON.stringify(p)).toBe(before);
  });
  it('does not enter union work for excessive legacy coordinates or cardinality', () => {
    const p = property();
    p.rooms[0].polygon = Array.from({ length: PROJECT_CALCULATION_LIMITS.vertices + 1 }, () => ({
      x: 0,
      y: 0,
    }));
    expect(assessProjectCalculationBudget(p)).toMatchObject({
      ok: false,
      counts: { estimatedWorkUnits: 0 },
    });
    for (const x of [Infinity, NaN, 10001]) {
      const invalid = property();
      invalid.rooms[0].polygon[0].x = x;
      expect(assessProjectCalculationBudget(invalid).ok).toBe(false);
    }
  });
  it('rejects a self-crossing polygon before generating material quantities', () => {
    const p = property();
    p.rooms[0].polygon = [
      { x: 0, y: 0 },
      { x: 4, y: 4 },
      { x: 0, y: 4 },
      { x: 4, y: 0 },
    ];
    expect(assessProjectCalculationBudget(p).reason).toMatch(/crosses itself/);
    const review = reviewProject(p);
    expect(review).toMatchObject({ status: 'unverified', screeningComplete: false });
    expect(review.findings.map((f) => f.ruleId)).toEqual(['review-scope', 'calculation-budget']);
  });
  it('bounds dense cross-room intersections even below the vertex-count limit', () => {
    const rooms = Array.from({ length: 40 }, (_, i) => {
      const angle = (i / 40) * Math.PI,
        c = Math.cos(angle),
        s = Math.sin(angle);
      return {
        ...room(`r${i}`),
        polygon: [
          [-20, -0.2],
          [20, -0.2],
          [20, 0.2],
          [-20, 0.2],
        ].map(([x, y]) => ({ x: x * c - y * s, y: x * s + y * c })),
      };
    });
    const result = assessProjectCalculationBudget(property(rooms));
    expect(result.counts.vertices).toBeLessThan(PROJECT_CALCULATION_LIMITS.vertices);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/sweep budget/);
  });
  it('rejects malformed foundation models without allowing the review to dereference missing steel inputs', () => {
    const p = property();
    p.foundation = {
      version: 1,
      enabled: true,
      elements: [{ id: 'bad' }],
    } as unknown as NonNullable<Property['foundation']>;
    expect(assessProjectCalculationBudget(p).reason).toMatch(/Foundation/);
    expect(() => reviewProject(p)).not.toThrow();
    expect(reviewProject(p).screeningComplete).toBe(false);
  });
  it('limits aggregate service points rather than accepting many individually legal routes', () => {
    const p = property();
    p.services = {
      version: 1,
      fixtures: [],
      runs: Array.from({ length: 41 }, (_, i) => ({
        id: `run${i}`,
        levelId: 'ground',
        system: 'cold-water',
        materialId: 'unknown',
        diameterMm: 20,
        startElevationM: 0,
        endElevationM: 0,
        points: Array.from({ length: 500 }, (_, j) => ({ x: j, y: i })),
      })),
    };
    expect(assessProjectCalculationBudget(p)).toMatchObject({
      ok: false,
      counts: { servicePoints: 20500 },
    });
  });
});
