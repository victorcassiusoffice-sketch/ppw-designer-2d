import { describe, expect, it } from 'vitest';
import { deriveCladdingOrders } from '../claddingCalc';
import { deriveWallPaintOrders, wallPaintBreakdown } from '../wallPaintCalc';
import { WALL_PAINTS } from '../../data/wallPaints';
import { CLADDING_PRODUCTS } from '../../data/claddingCatalog';
import type { Property } from '../../store/propertyStore';

const paint = WALL_PAINTS[0];
const cladding = CLADDING_PRODUCTS[0];
const polygon = [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 4 }, { x: 0, y: 4 }];
const property = (heightM: number): Property => ({
  id: 'p', name: 'Building', activeRoomId: 'downstairs', wallHeightM: 2.7,
  levels: [{ id: 'ground', name: 'Ground', index: 0 }, { id: 'first', name: 'First', index: 1, heightM }],
  rooms: [
    { id: 'downstairs', name: 'Downstairs', polygon, placedItems: [], wallPaint: [{ edgeIndex: 0, paintId: paint.id }], wallCladding: [{ edgeIndex: 0, productId: cladding.id }] },
    { id: 'upstairs', name: 'Upstairs', levelId: 'first', polygon, placedItems: [], wallPaint: [{ edgeIndex: 0, paintId: paint.id }], wallCladding: [{ edgeIndex: 0, productId: cladding.id }] },
  ],
  walls: [
    { id: 'low-wall', a: { x: 6, y: 0 }, b: { x: 8, y: 0 }, thicknessM: 0.1, paintId: paint.id, claddingId: cladding.id },
    { id: 'high-wall', levelId: 'first', a: { x: 6, y: 0 }, b: { x: 8, y: 0 }, thicknessM: 0.1, paintId: paint.id, paintFaces: 2, claddingId: cladding.id, claddingFaces: 2 },
  ],
});

describe('per-level wall finish quantities', () => {
  it('updates only upper-floor painted faces even when the UI passes its global height', () => {
    const before = wallPaintBreakdown(property(3), 2.7);
    const after = wallPaintBreakdown(property(4), 2.7);
    expect(after.find((row) => row.roomId === 'downstairs')).toEqual(before.find((row) => row.roomId === 'downstairs'));
    expect(after.find((row) => row.wallId === 'low-wall')).toEqual(before.find((row) => row.wallId === 'low-wall'));
    expect(after.find((row) => row.roomId === 'upstairs')).toMatchObject({ heightM: 4, areaM2: 20 });
    expect(after.find((row) => row.wallId === 'high-wall')).toMatchObject({ heightM: 4, areaM2: 16 });
    const beforeOrders = deriveWallPaintOrders(property(3), 2.7);
    const afterOrders = deriveWallPaintOrders(property(4), 2.7);
    expect(afterOrders[0].areaM2 - beforeOrders[0].areaM2).toBeCloseTo(5 + 2 * 2);
    expect(afterOrders[0].areaM2).toBeCloseTo(after.reduce((sum, row) => sum + row.areaM2, 0));
    expect(afterOrders[0].litres).toBeGreaterThan(beforeOrders[0].litres);
    expect(afterOrders[0].paint).toBe(paint);
  });

  it('updates upper-floor cladding boards and keeps inherited ground-floor quantities fixed', () => {
    const before = deriveCladdingOrders(property(3), 2.7)[0];
    const after = deriveCladdingOrders(property(4), 2.7)[0];
    expect(after.perRoom.find((row) => row.roomId === 'downstairs')).toEqual(before.perRoom.find((row) => row.roomId === 'downstairs'));
    expect(after.perRoom.find((row) => row.roomId === 'wall:low-wall')).toEqual(before.perRoom.find((row) => row.roomId === 'wall:low-wall'));
    expect(after.perRoom.find((row) => row.roomId === 'upstairs')?.areaM2).toBe(20);
    expect(after.perRoom.find((row) => row.roomId === 'wall:high-wall')?.areaM2).toBe(16);
    expect(after.boards).toBeGreaterThan(before.boards);
    expect(after.totalMur).toBe(after.packs * cladding.samplePackPriceMur);
  });

  it('inherits the property height unchanged without level overrides', () => {
    const original = property(3);
    const inherited = { ...original, levels: original.levels?.map(({ heightM: _height, ...level }) => level) };
    expect(wallPaintBreakdown(inherited, 2.7).every((row) => row.heightM === 2.7)).toBe(true);
    expect(deriveCladdingOrders(inherited)[0].areaM2).toBeCloseTo(16 * 2.7);
    expect(deriveWallPaintOrders(inherited)[0].areaM2).toBeCloseTo(16 * 2.7);
  });
});
