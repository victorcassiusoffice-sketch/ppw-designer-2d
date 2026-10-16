import { describe, expect, it } from 'vitest';
import { DEFAULT_GARDEN_POOL, gardenSurfacePatch, normaliseGardenSurface, type GardenSurface } from '../garden';
import { gardenGroundCutout, outdoorSurfaceTakeoff, poolTakeoff } from '../outdoorTakeoff';
import { normaliseLoadedProperty, usePropertyStore } from '../../store/propertyStore';
import { estimateGardenPaving } from '../gardenPaving';

const surface: GardenSurface = { id: 'drive', kind: 'tarmac', x: 0, y: 0, widthM: 10, depthM: 4, elevationM: 0, thicknessM: .05, subBaseDepthM: .15 };
const pool: GardenSurface = { ...surface, kind: 'pool', widthM: 8, depthM: 4, pool: { ...DEFAULT_GARDEN_POOL } };
describe('measured outdoor floors and pools', () => {
  it('keeps plan length separate from material depth and calculates volumes in metres', () => {
    expect(outdoorSurfaceTakeoff(surface)).toMatchObject({ areaM2: 40, perimeterM: 28, materialVolumeM3: 2, subBaseVolumeM3: 6 });
    expect(outdoorSurfaceTakeoff({ ...surface, thicknessM: .1 })?.materialVolumeM3).toBe(4);
    expect(outdoorSurfaceTakeoff({ ...surface, thicknessM: undefined, subBaseDepthM: undefined })).toMatchObject({ materialVolumeM3: null, subBaseVolumeM3: null });
  });
  it('uses an actual concave polygon, not its bounding rectangle, and preserves it through move/resize', () => {
    const shaped = { ...surface, widthM: 4, depthM: 4, outline: [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 2 }, { x: 2, y: 2 }, { x: 2, y: 4 }, { x: 0, y: 4 }] };
    expect(outdoorSurfaceTakeoff(shaped)).toMatchObject({ areaM2: 12, perimeterM: 16 });
    const moved = gardenSurfacePatch(shaped, { x: 10, y: 20, widthM: 8 });
    expect(moved.outline?.[3]).toEqual({ x: 14, y: 22 });
    expect(outdoorSurfaceTakeoff(moved)?.areaM2).toBe(24);
  });
  it('uses published slab thickness but withholds rectangular piece layout for a custom outline', () => {
    const paved: GardenSurface = { ...surface, kind: 'path', thicknessM: undefined, pavingProductId: 'em-ubp-vorslacol001' };
    expect(outdoorSurfaceTakeoff(paved)?.materialVolumeM3).toBe(.8);
    expect(estimateGardenPaving({ ...paved, outline: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 4 }] })).toBeNull();
  });
  it('calculates a flat basin shell without double-counting corners and litres without a density', () => {
    const q = poolTakeoff(pool)!;
    expect(q.areaM2).toBe(32);
    expect(q.waterVolumeM3).toBeCloseTo(43.2);
    expect(q.waterLitres).toBeCloseTo(43200);
    expect(q.liningAreaM2).toBe(68);
    expect(q.shellVolumeM3).toBeCloseTo(8.4 * 4.4 * .2 + (8.4 * 4.4 - 32) * 1.5);
    expect(q.excavationVolumeM3).toBeCloseTo(9 * 5 * 1.7);
    expect(q.freeboardM).toBeCloseTo(.15);
  });
  it('does not recalculate quantities when switching construction visibility or adding a supplier reference', () => {
    const filled = poolTakeoff(pool);
    for (const stage of ['excavation', 'shell', 'filled'] as const) expect(poolTakeoff({ ...pool, pool: { ...pool.pool!, stage, productReferenceId: 'nabridas-diamond-10' } })).toEqual(filled);
    expect(gardenGroundCutout({ ...pool, pool: { ...pool.pool!, stage: 'excavation' } })[0]).toEqual({ x: -.5, y: -.5 });
    expect(gardenGroundCutout(pool)[0]).toEqual({ x: -.2, y: -.2 });
  });
  it('rejects invalid layers, non-simple shapes and impossible water depths without inventing quantities', () => {
    expect(outdoorSurfaceTakeoff({ ...surface, thicknessM: -1 })).toBeNull();
    expect(outdoorSurfaceTakeoff({ ...surface, subBaseDepthM: Infinity })).toBeNull();
    expect(poolTakeoff({ ...pool, pool: { ...pool.pool!, waterDepthM: 2 } })).toBeNull();
    expect(poolTakeoff({ ...pool, outline: [{ x: 0, y: 0 }, { x: 8, y: 0 }, { x: 0, y: 4 }] })).toBeNull();
    expect(normaliseGardenSurface({ ...surface, outline: [{ x: 0, y: 0 }, { x: 4, y: 4 }, { x: 0, y: 4 }, { x: 4, y: 0 }] })).toBeNull();
    expect(poolTakeoff({ ...pool, pool: { ...pool.pool!, waterDepthM: 0 } })?.waterLitres).toBe(0);
  });
  it('round trips layer and pool parameters through the real property load path', () => {
    const store = usePropertyStore.getState(); store.resetToDefault();
    const id = store.addGardenSurface({ kind: 'pool', x: 10, y: 0, widthM: 8, depthM: 4, elevationM: 0 })!;
    const saved = usePropertyStore.getState().property;
    expect(saved.garden?.surfaces[0].pool).toEqual(DEFAULT_GARDEN_POOL);
    expect(store.updateGardenSurface(id, { pool: { ...DEFAULT_GARDEN_POOL, shellDepthM: 2 } })).toBe(true);
    const roundtrip = normaliseLoadedProperty(JSON.parse(JSON.stringify(usePropertyStore.getState().property)));
    expect(roundtrip.garden?.surfaces[0].pool?.shellDepthM).toBe(2);
    expect(store.updateGardenSurface(id, { pool: { ...DEFAULT_GARDEN_POOL, waterDepthM: 20 } })).toBe(false);
    expect(usePropertyStore.getState().property.garden?.surfaces[0].pool?.shellDepthM).toBe(2);
  });
});
