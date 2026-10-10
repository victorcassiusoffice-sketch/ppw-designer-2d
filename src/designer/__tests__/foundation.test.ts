import { describe, expect, it } from 'vitest';
import { defaultMaterialsSettings } from '../materials';
import { FoundationSchema } from '../foundationContract';
import {
  defaultFoundationRebar,
  estimateFoundation,
  foundationBounds,
  foundationVolumeM3,
  normaliseFoundation,
  type FoundationElement,
  type FoundationModel,
} from '../foundation';
const element = (patch: Partial<FoundationElement> = {}): FoundationElement => ({
  id: 'slab',
  name: 'Slab',
  kind: 'slab',
  x: 0,
  y: 0,
  lengthM: 10,
  widthM: 6,
  depthM: 0.2,
  topElevationM: 0,
  rebar: defaultFoundationRebar(),
  ...patch,
});
const model = (...elements: FoundationElement[]): FoundationModel => ({
  version: 1,
  enabled: true,
  elements,
});
describe('foundation geometry and quantity invariants', () => {
  it('uses metres for the plan, depth and datum without depending on active floor', () => {
    const m = model(element());
    expect(foundationVolumeM3(m)).toBeCloseTo(12);
    expect(foundationBounds(m)).toEqual({
      minX: -5,
      maxX: 5,
      minY: -3,
      maxY: 3,
      minElevationM: -0.2,
      maxElevationM: 0,
    });
    expect(foundationVolumeM3({ ...m, enabled: false })).toBe(0);
  });
  it('deduplicates pad / strip / slab overlaps in three dimensions', () => {
    const m = model(
      element({ lengthM: 4, widthM: 4, depthM: 1 }),
      element({
        id: 'strip',
        kind: 'strip',
        lengthM: 6,
        widthM: 1,
        depthM: 1,
        topElevationM: -0.5,
      }),
    );
    expect(foundationVolumeM3(m)).toBeCloseTo(16 + 6 - 2);
    const adjacent = model(
      element({ depthM: 0.2 }),
      element({ id: 'lower', topElevationM: -0.2, depthM: 0.3 }),
    );
    expect(foundationVolumeM3(adjacent)).toBeCloseTo(30);
    expect(foundationVolumeM3(model(element(), element({ id: 'duplicate' })))).toBeCloseTo(12);
  });
  it('keeps ready-mix and ingredient supply mutually exclusive and applies allowance once', () => {
    const concrete = { ...defaultMaterialsSettings().concrete, wastePct: 10 };
    const ready = estimateFoundation(model(element()), concrete);
    expect(ready.concreteOrderM3).toBeCloseTo(13.2);
    expect(ready.mix).toBeNull();
    const site = estimateFoundation(model(element()), { ...concrete, supply: 'site-mix' });
    expect(site.mix?.wetM3).toBeCloseTo(13.2);
    expect(site.mix?.cementKg).toBeCloseTo(((13.2 * 1.54) / 6) * 1440);
  });
  it('withholds ambiguous overlapping steel schedules rather than double counting them', () => {
    const rebar = { ...defaultFoundationRebar(), enabled: true };
    const m = model(element({ rebar }), element({ id: 'duplicate', rebar }));
    const report = estimateFoundation(m, defaultMaterialsSettings().concrete);
    expect(report.volumeM3).toBeCloseTo(12);
    expect(report.rebarComplete).toBe(false);
    expect(report.rebar).toEqual([]);
    expect(report.warnings.join(' ')).toContain('overlap');
  });
  it('rejects dimensions and mesh that cannot physically fit without changing the saved size', () => {
    expect(normaliseFoundation(model(element({ widthM: NaN })))).toBeUndefined();
    expect(
      normaliseFoundation(
        model(element({ rebar: { ...defaultFoundationRebar(), enabled: true, coverMm: 120 } })),
      ),
    ).toBeUndefined();
    expect(
      normaliseFoundation(
        model(element({ rebar: { ...defaultFoundationRebar(), lapLengthM: 6 } })),
      ),
    ).toBeUndefined();
    expect(normaliseFoundation(model(element(), element()))).toBeUndefined();
    expect(normaliseFoundation(model(element({ x: -15.2, topElevationM: -1.1 })))).toEqual(
      model(element({ x: -15.2, topElevationM: -1.1 })),
    );
  });
  it('preserves physical volume when the same box is split and reordered', () => {
    const a = model(element());
    const b = model(element({ id: 'right', lengthM: 5, x: 2.5 }), element({ lengthM: 5, x: -2.5 }));
    expect(foundationVolumeM3(a)).toBeCloseTo(foundationVolumeM3(b));
  });
  it('keeps hole volume, pending fill and design concrete separate through round-trip', () => {
    const m: FoundationModel = {
      ...model(
        element({
          lengthM: 10,
          widthM: 8,
          depthM: 0.3,
          topElevationM: -1.2,
          rebar: { ...defaultFoundationRebar(), enabled: true },
          excavation: { depthM: 1.5, topElevationM: 0, marginM: 0.25, stage: 'excavated' },
        }),
      ),
      concreteProductId: 'premix-classics',
    };
    const hole = estimateFoundation(m, defaultMaterialsSettings().concrete);
    expect(hole.excavationVolumeM3).toBeCloseTo(10.5 * 8.5 * 1.5);
    expect(hole.volumeM3).toBe(0);
    expect(hole.plannedConcreteVolumeM3).toBeCloseTo(24);
    expect(hole.pendingConcreteM3).toBeCloseTo(24);
    expect(hole.concreteComplete).toBe(false);
    expect(hole.rebar).toEqual([]);
    expect(hole.remainingExcavationM3).toBe(hole.excavationVolumeM3);
    expect(normaliseFoundation(JSON.parse(JSON.stringify(m)))).toEqual(m);
    expect(FoundationSchema.parse(m)).toEqual(m);
    const filled = {
      ...m,
      elements: m.elements.map((e) => ({
        ...e,
        excavation: { ...e.excavation!, stage: 'filled' as const },
      })),
    };
    const takeoff = estimateFoundation(filled, defaultMaterialsSettings().concrete);
    expect(takeoff.volumeM3).toBeCloseTo(24);
    expect(takeoff.filledExcavationM3).toBeCloseTo(24);
    expect(takeoff.remainingExcavationM3).toBeCloseTo(hole.excavationVolumeM3 - 24);
    expect(takeoff.concreteComplete).toBe(true);
    expect(takeoff.rebarStockBars).toBeGreaterThan(0);
  });
  it('unions intersecting excavations and excludes legacy concrete outside their volume from void deductions', () => {
    const m = model(
      element({
        lengthM: 4,
        widthM: 4,
        depthM: 0.5,
        topElevationM: -1.5,
        excavation: { depthM: 2, topElevationM: 0, marginM: 0, stage: 'filled' },
      }),
      element({
        id: 'other',
        x: 2,
        lengthM: 4,
        widthM: 4,
        depthM: 0.5,
        topElevationM: -2.5,
        excavation: { depthM: 3, topElevationM: 0, marginM: 0, stage: 'filled' },
      }),
      element({ id: 'legacy-above', lengthM: 4, widthM: 4, depthM: 0.5, topElevationM: 1 }),
    );
    const report = estimateFoundation(m, defaultMaterialsSettings().concrete);
    expect(report.excavationVolumeM3).toBeCloseTo(32 + 48 - 16);
    expect(report.volumeM3).toBeCloseTo(24);
    expect(report.filledExcavationM3).toBeCloseTo(16);
    expect(report.remainingExcavationM3).toBeCloseTo(48);
    expect(foundationBounds(m)?.minElevationM).toBe(-3);
  });
  it('rejects invalid holes and concrete outside the measured excavation without losing legacy compatibility', () => {
    const ex = { depthM: 0.5, topElevationM: 0, marginM: 0, stage: 'filled' as const };
    expect(
      FoundationSchema.safeParse(model(element({ depthM: 0.6, excavation: ex }))).success,
    ).toBe(false);
    expect(
      FoundationSchema.safeParse(model(element({ topElevationM: 0.1, excavation: ex }))).success,
    ).toBe(false);
    expect(
      FoundationSchema.safeParse(model(element({ excavation: { ...ex, marginM: -1 } }))).success,
    ).toBe(false);
    expect(
      FoundationSchema.safeParse(model(element({ excavation: { ...ex, depthM: Infinity } })))
        .success,
    ).toBe(false);
    expect(FoundationSchema.parse(model(element()))).toEqual(model(element()));
  });
});
