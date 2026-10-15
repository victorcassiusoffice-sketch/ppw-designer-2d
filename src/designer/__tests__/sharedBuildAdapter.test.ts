/** @vitest-environment jsdom */
import { afterEach, describe, expect, it } from 'vitest';
import { measuredBuildSpecs, measuredSyncPayload, specFingerprint } from '../sharedBuildAdapter';
import { mergeMeasuredSpecs, SharedSpecComponentSchema } from '../sharedSpecsContract';
import { defaultFoundationRebar } from '../foundation';
import { useDisciplineVisibilityStore } from '../../store/disciplineVisibilityStore';
import type { Property, Room } from '../../store/propertyStore';
import type { ServiceRun } from '../buildingServices';

const rectangle = (x = 0, y = 0, w = 4, h = 3) => [
  { x, y },
  { x: x + w, y },
  { x: x + w, y: y + h },
  { x, y: y + h },
];
const room = (id: string, x = 0, extra: Partial<Room> = {}): Room => ({
  id,
  name: id,
  polygon: rectangle(x),
  placedItems: [],
  ...extra,
});
const property = (rooms: Room[] = [], extra: Partial<Property> = {}): Property => ({
  id: 'shared-build',
  name: 'Shared build',
  rooms,
  activeRoomId: rooms[0]?.id ?? '',
  wallHeightM: 3,
  ...extra,
});
const run = (extra: Partial<ServiceRun> = {}): ServiceRun => ({
  id: 'riser',
  levelId: 'ground',
  system: 'cold-water',
  materialId: 'hpl-aquasafe-upvc-20',
  diameterMm: 20,
  points: [
    { x: 0, y: 0, elevationM: 0 },
    { x: 0, y: 0, elevationM: 3 },
    { x: 4, y: 0, elevationM: 3 },
  ],
  startElevationM: 0,
  endElevationM: 3,
  ...extra,
});
afterEach(() => {
  useDisciplineVisibilityStore.getState().showAll();
  localStorage.clear();
});

describe('shared register measures the canonical model', () => {
  it('counts shared walls and mirrored openings once in a wall package', () => {
    const door = {
      id: 'door-a',
      edgeIndex: 1,
      offsetM: 1,
      widthM: 0.9,
      kind: 'door' as const,
      flipFacing: false,
      flipHand: false,
    };
    const build = property(
      [
        room('a', 0, { openings: [door] }),
        room('b', 4, { openings: [{ ...door, id: 'door-b', edgeIndex: 3, offsetM: 2 }] }),
      ],
      {
        walls: [{ id: 'duplicate-free', a: { x: 4, y: 0 }, b: { x: 4, y: 3 }, thicknessM: 0.15 }],
      },
    );
    const specs = measuredBuildSpecs(build);
    expect(specs.find((c) => c.id === 'walls:ground')?.quantity).toBeCloseTo(
      25 * 3 - 0.9 * 2.04,
      8,
    );
    expect(specs.find((c) => c.id === 'floor:ground')?.quantity).toBe(24);
    expect(specs.filter((c) => c.category === 'wall')).toHaveLength(1);
  });
  it('counts overlapping floor area once and separates heights of different storeys', () => {
    const specs = measuredBuildSpecs(
      property([room('a'), room('b', 2), room('upper', 0, { levelId: 'first' })], {
        levels: [
          { id: 'ground', name: 'Ground', index: 0, heightM: 3 },
          { id: 'first', name: 'First', index: 1, heightM: 4 },
        ],
      }),
    );
    expect(specs.find((c) => c.id === 'floor:ground')?.quantity).toBe(18);
    expect(specs.find((c) => c.id === 'floor:first')?.quantity).toBe(12);
    expect(specs.find((c) => c.id === 'walls:first')?.quantity).toBe(14 * 4);
  });
  it('excludes garden and roof containers from floor and wall quantities', () => {
    const specs = measuredBuildSpecs(
      property([
        room('house'),
        room('garden', -10, { kind: 'outdoor', polygon: rectangle(-10, -10, 30, 30) }),
        room('roof', 0, { kind: 'roof', levelId: 'roof' }),
      ]),
    );
    expect(specs.find((c) => c.id === 'floor:ground')?.quantity).toBe(12);
    expect(specs.find((c) => c.id === 'walls:ground')?.quantity).toBe(42);
    expect(specs.find((c) => c.id === 'floor:roof')).toBeUndefined();
  });
  it('measures every riser and bend in three dimensions rather than plan projection', () => {
    const build = property([], { services: { version: 1, fixtures: [], runs: [run()] } });
    const before = structuredClone(build);
    const route = measuredBuildSpecs(build).find((c) => c.id === 'route:riser');
    expect(route).toMatchObject({ quantity: 7, unit: 'm', category: 'plumbing' });
    expect(route?.sources.length).toBe(1);
    expect(build).toEqual(before);
  });
  it('resolves a moved shared junction before measuring route length', () => {
    const build = property([], {
      services: {
        version: 1,
        fixtures: [],
        junctions: [
          { id: 'tee', levelId: 'ground', system: 'cold-water', x: 0, y: 0, elevationM: 4 },
        ],
        runs: [
          run({
            points: [
              { x: 0, y: 0, elevationM: 0 },
              { x: 0, y: 0, elevationM: 3, junctionId: 'tee' },
            ],
          }),
        ],
      },
    });
    expect(measuredBuildSpecs(build).find((c) => c.id === 'route:riser')?.quantity).toBe(4);
  });
  it('uses instance IDs for physically placed products and keeps individual service fixtures', () => {
    const build = property(
      [
        room('a', 0, {
          placedItems: [
            { instanceId: 'chair-one', productId: 'unmapped-chair', x: 1, y: 1, rotation: 0 },
            { instanceId: 'chair-two', productId: 'unmapped-chair', x: 2, y: 1, rotation: 90 },
          ],
        }),
      ],
      {
        services: {
          version: 1,
          runs: [],
          fixtures: [
            {
              id: 'camera',
              kind: 'security-camera',
              levelId: 'ground',
              x: 1,
              y: 2,
              widthM: 0.2,
              depthM: 0.2,
              heightM: 0.2,
              rotation: 0,
            },
          ],
        },
      },
    );
    const specs = measuredBuildSpecs(build);
    expect(specs.filter((c) => c.id.startsWith('item:')).map((c) => c.id)).toEqual([
      'item:chair-one',
      'item:chair-two',
    ]);
    expect(specs.find((c) => c.id === 'fixture:camera')).toMatchObject({
      quantity: 1,
      unit: 'each',
      category: 'security',
    });
  });
  it('unions drawn concrete and does not call excavation-only bores concrete', () => {
    const element = {
      id: 'slab',
      name: 'Slab',
      kind: 'slab' as const,
      x: 0,
      y: 0,
      lengthM: 4,
      widthM: 4,
      depthM: 0.3,
      topElevationM: 0,
      rebar: defaultFoundationRebar(),
    };
    const build = property([], {
      foundation: {
        version: 1,
        enabled: true,
        elements: [element, { ...element, id: 'same-volume' }],
        bores: [
          { id: 'hole', name: 'Hole', x: 10, y: 0, diameterM: 2, depthM: 3, topElevationM: 0 },
        ],
      },
    });
    expect(
      measuredBuildSpecs(build).find((c) => c.id === 'foundation:concrete')?.quantity,
    ).toBeCloseTo(4.8);
    build.foundation!.elements = [];
    expect(measuredBuildSpecs(build).find((c) => c.id === 'foundation:concrete')).toBeUndefined();
  });
  it('does not alter quantities or source fingerprints when any view is hidden or isolated', () => {
    const build = property([room('a')], { services: { version: 1, fixtures: [], runs: [run()] } });
    const all = measuredBuildSpecs(build),
      original = specFingerprint(build);
    useDisciplineVisibilityStore.getState().showNone();
    expect(measuredBuildSpecs(build)).toEqual(all);
    useDisciplineVisibilityStore.getState().applyPreset('plumber');
    useDisciplineVisibilityStore.getState().setPartVisible('walls', false);
    expect(measuredBuildSpecs(build)).toEqual(all);
    expect(specFingerprint(build)).toBe(original);
  });
  it('rejects invalid geometry and register overflow rather than silently truncating a build', () => {
    expect(() => measuredBuildSpecs(property([room('a', NaN)]))).toThrow(
      'Spec quantities unavailable',
    );
    const objects = Array.from({ length: 501 }, (_, i) => ({
      instanceId: `item-${i}`,
      productId: 'unknown',
      x: 0,
      y: 0,
      rotation: 0,
    }));
    expect(() => measuredBuildSpecs(property([room('a', 0, { placedItems: objects })]))).toThrow(
      'supports 500 components',
    );
  });
  it('detects a free-wall relocation even when its measured area is unchanged', () => {
    const build = property([], {
      walls: [{ id: 'wall', a: { x: 0, y: 0 }, b: { x: 4, y: 0 }, thicknessM: 0.15 }],
    });
    const first = measuredBuildSpecs(build).find((c) => c.id === 'walls:ground')!;
    const moved = structuredClone(build);
    moved.walls![0].a.y = 2;
    moved.walls![0].b.y = 2;
    const next = measuredBuildSpecs(moved).find((c) => c.id === 'walls:ground')!;
    expect(next.quantity).toBe(first.quantity);
    expect(next.sourceFingerprint).not.toBe(first.sourceFingerprint);
  });
});

describe('geometry-to-spec synchronisation keeps accountable supplier work', () => {
  it('updates measured quantity while retaining supplier material, cost, carbon and responsibility', () => {
    const incoming = measuredBuildSpecs(property([room('a')]));
    const old = incoming.map((c) =>
      c.id !== 'walls:ground'
        ? c
        : SharedSpecComponentSchema.parse({
            ...c,
            material: 'Supplier approved product',
            responsibleParty: 'Assigned supplier',
            assigneeUserId: 'user_supplier1',
            deliveryDate: '2026-12-01',
            notes: 'Keep this note',
            cost: { amount: 10, currency: 'MUR', basis: 'per-unit' },
            carbon: {
              factor: 2,
              unit: 'kgCO2e/unit',
              boundary: 'A1-A3',
              evidenceUrl: 'https://example.org/epd',
            },
            sources: ['https://example.org/sku'],
          }),
    );
    const changed = incoming.map((c) =>
      c.id === 'walls:ground' ? { ...c, quantity: 50, sourceFingerprint: 'new' } : c,
    );
    const result = mergeMeasuredSpecs(old, measuredSyncPayload(old, changed));
    expect(result.find((c) => c.id === 'walls:ground')).toMatchObject({
      ...old.find((c) => c.id === 'walls:ground'),
      quantity: 50,
      sourceFingerprint: 'new',
    });
  });
  it('retains removed geometry as flagged records and leaves independently added specs intact', () => {
    const existing = measuredBuildSpecs(property([room('a')]));
    const manual = SharedSpecComponentSchema.parse({
      id: 'manual',
      category: 'other',
      name: 'Client requirement',
      material: 'Specified separately',
      quantity: 1,
      unit: 'each',
    });
    existing.push(manual);
    const payload = measuredSyncPayload(existing, []);
    const merged = mergeMeasuredSpecs(existing, payload);
    expect(merged.filter((c) => c.sourceKey).every((c) => c.sourceRemoved)).toBe(true);
    expect(merged.find((c) => c.id === 'manual')).toEqual(manual);
    expect(existing.filter((c) => c.sourceKey).every((c) => !c.sourceRemoved)).toBe(true);
  });
  it('invalidates old per-unit factors after a measured unit changes', () => {
    const original = SharedSpecComponentSchema.parse({
      id: 'route:test',
      sourceKey: 'route:test',
      category: 'plumbing',
      name: 'Route',
      material: 'Pipe',
      quantity: 10,
      unit: 'm',
      cost: { amount: 3, currency: 'MUR', basis: 'per-unit' },
      carbon: { factor: 2, unit: 'kgCO2e/unit', boundary: 'A1-A3' },
    });
    const next = { ...original, quantity: 3, unit: 'each' as const };
    const merged = mergeMeasuredSpecs([original], measuredSyncPayload([original], [next]))[0];
    expect(merged.carbon).toBeUndefined();
    expect(merged.cost).toBeUndefined();
    expect(
      mergeMeasuredSpecs(
        [{ ...original, cost: { amount: 30, currency: 'MUR', basis: 'total' } }],
        [next],
      )[0].cost?.amount,
    ).toBe(30);
  });
});
