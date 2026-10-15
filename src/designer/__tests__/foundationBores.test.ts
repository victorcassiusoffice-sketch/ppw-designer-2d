import { describe, expect, it } from 'vitest';
import { FoundationSchema } from '../foundationContract';
import {
  foundationBoreVolumeM3,
  foundationBoreTakeoff,
  foundationBounds,
  normaliseFoundation,
  estimateFoundation,
  defaultFoundationRebar,
  type FoundationBore,
  type FoundationModel,
} from '../foundation';
import { defaultMaterialsSettings } from '../materials';

const bore = (patch: Partial<FoundationBore> = {}): FoundationBore => ({
  id: 'bore-1',
  name: 'Measured bore',
  x: 3,
  y: -2,
  diameterM: 1.2,
  depthM: 2.5,
  topElevationM: -0.3,
  ...patch,
});
const model = (...bores: FoundationBore[]): FoundationModel => ({
  version: 1,
  enabled: true,
  elements: [],
  bores,
});
describe('analytical cylindrical excavation coordination', () => {
  it('round trips exact dimensions and uses pi r squared depth without a concrete allocation', () => {
    const m = model(bore({ diameterM: 1.2345, depthM: 3.4567 }));
    expect(normaliseFoundation(JSON.parse(JSON.stringify(m)))).toEqual(m);
    expect(FoundationSchema.parse(m)).toEqual(m);
    const result = estimateFoundation(m, defaultMaterialsSettings().concrete);
    expect(result.totalExcavationVolumeM3).toBeCloseTo(Math.PI * 0.61725 ** 2 * 3.4567, 12);
    expect(result.excavationVolumeM3).toBe(0);
    expect(result.volumeM3).toBe(0);
    expect(result.concreteOrderM3).toBe(0);
    expect(result.rebarMassKg).toBe(0);
  });
  it('uses the same entered bounds and datum including bore-only projects', () => {
    expect(foundationBounds(model(bore()))).toEqual({
      minX: 2.4,
      maxX: 3.6,
      minY: -2.6,
      maxY: -1.4,
      minElevationM: -2.8,
      maxElevationM: -0.3,
    });
    expect(foundationBounds({ ...model(bore()), enabled: false })).toBeNull();
  });
  it('withholds overlapping cylinders and does not mistake tangency for overlap', () => {
    const a = bore({ x: 0, y: 0, diameterM: 2 }),
      b = bore({ id: 'b', x: 1, y: 0, diameterM: 2 });
    const result = estimateFoundation(model(a, b), defaultMaterialsSettings().concrete);
    expect(result.boreExcavation).toMatchObject({
      complete: false,
      volumeM3: null,
      conflictingIds: ['bore-1', 'b'],
    });
    expect(result.totalExcavationVolumeM3).toBeNull();
    expect(result.totalRemainingExcavationM3).toBeNull();
    expect(result.boreExcavation.individual).toHaveLength(2);
    expect(foundationBoreTakeoff(model(a, { ...b, x: 2 })).volumeM3).toBeCloseTo(5 * Math.PI);
    expect(
      foundationBoreTakeoff(model(a, { ...b, topElevationM: a.topElevationM - a.depthM })).complete,
    ).toBe(true);
  });
  it('checks real circle/rectangle intersection rather than bounding-box corner overlap', () => {
    const m = {
      ...model(bore({ x: 0, y: 0, diameterM: 2, topElevationM: 0, depthM: 2 })),
      elements: [
        {
          id: 'pad',
          name: 'Pad',
          kind: 'pad' as const,
          x: 1,
          y: 1,
          lengthM: 0.2,
          widthM: 0.2,
          depthM: 0.2,
          topElevationM: 0,
          rebar: defaultFoundationRebar(),
        },
      ],
    };
    expect(foundationBoreTakeoff(m).complete).toBe(true);
    expect(
      foundationBoreTakeoff({ ...m, elements: [{ ...m.elements[0], x: 0.8, y: 0 }] }).complete,
    ).toBe(false);
    const hole = {
      ...m.elements[0],
      x: 3,
      y: 0,
      excavation: { depthM: 2, topElevationM: 0, marginM: 3, stage: 'excavated' as const },
    };
    expect(foundationBoreTakeoff({ ...m, elements: [hole] }).complete).toBe(false);
  });
  it.each([{ diameterM: 0 }, { depthM: Infinity }, { topElevationM: -31 }, { x: NaN }])(
    'rejects bad physical dimensions without clamping',
    (patch) => {
      expect(normaliseFoundation(model(bore(patch)))).toBeUndefined();
      expect(FoundationSchema.safeParse(model(bore(patch))).success).toBe(false);
    },
  );
  it('rejects duplicate cross-kind IDs and unsupported bore structural fields', () => {
    expect(normaliseFoundation(model(bore(), bore()))).toBeUndefined();
    expect(
      FoundationSchema.safeParse(model({ ...bore(), rebar: true } as FoundationBore)).success,
    ).toBe(false);
    expect(foundationBoreVolumeM3(bore({ diameterM: 2, depthM: 3 }))).toBeCloseTo(3 * Math.PI);
  });
});
