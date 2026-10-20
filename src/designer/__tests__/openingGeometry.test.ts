// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { openingProfile, openingProfileAreaM2, openingProfileUnionAreaM2, validOpeningDimensions } from '../openingGeometry';
import type { Opening } from '../openings';
import { usePropertyStore, normaliseLoadedProperty } from '../../store/propertyStore';
import { paintableEdgeAreaM2, deriveWallPaintOrders, wallPaintBreakdown } from '../wallPaintCalc';
import { WALL_PAINTS } from '../../data/wallPaints';
import { previewOpeningPlacement } from '../openingPlacement';
const opening = (patch: Partial<Opening> = {}): Opening => ({ id: 'opening', edgeIndex: 0, offsetM: 2, widthM: 2, kind: 'window', flipFacing: false, flipHand: false, heightM: 2, sillM: .2, ...patch });
const polygon = [{ x: 0, y: 0 }, { x: 6, y: 0 }, { x: 6, y: 4 }, { x: 0, y: 4 }];

describe('custom measured wall openings', () => {
  it('uses clear height, sill and actual circle/arch profile areas instead of bounding boxes', () => {
    expect(openingProfileAreaM2(opening(), 3)).toBeCloseTo(4);
    const circle = opening({ shape: 'circle' });
    expect(openingProfile(circle, 3)).toHaveLength(96);
    expect(openingProfileAreaM2(circle, 3)).toBeCloseTo(Math.PI, 2);
    expect(openingProfileAreaM2(opening({ shape: 'arch' }), 3)).toBeCloseTo(2 + Math.PI / 2, 2);
    expect(openingProfileAreaM2(opening({ kind: 'hole', heightM: .5, sillM: 1.5 }), 3)).toBe(1);
  });
  it('clips at wall height, unions overlapping profiles and respects paint small-hole convention', () => {
    const circle = opening({ shape: 'circle' });
    expect(openingProfileUnionAreaM2([circle, { ...circle, id: 'duplicate' }], 3, [{ t0: 0, t1: 6 }])).toBeCloseTo(openingProfileAreaM2(circle, 3), 8);
    expect(openingProfileAreaM2(opening({ kind: 'hole', heightM: 2, sillM: 2 }), 3)).toBe(2);
    expect(paintableEdgeAreaM2({ polygon, openings: [circle] }, 0, 3)).toBeCloseTo(18 - openingProfileAreaM2(circle, 3), 8);
    expect(paintableEdgeAreaM2({ polygon, openings: [opening({ kind: 'hole', widthM: .2, heightM: .2 })] }, 0, 3)).toBe(18);
  });
  it('rejects impossible circles/heights and preserves valid custom openings across load', () => {
    usePropertyStore.getState().resetToDefault();
    const roomId = usePropertyStore.getState().addRoom({ name: 'Measured room', polygon });
    expect(validOpeningDimensions(opening({ heightM: 3 }), 2.7)).toBe(false);
    expect(validOpeningDimensions(opening({ shape: 'circle', heightM: 1 }), 2.7)).toBe(false);
    const store = usePropertyStore.getState();
    expect(store.addOpening(roomId, opening({ heightM: 3 }))).toBeNull();
    expect(store.addOpening(roomId, opening({ kind: 'hole', shape: 'arch', heightM: 1.5, sillM: .7 }))).toBe('opening');
    const loaded = normaliseLoadedProperty(JSON.parse(JSON.stringify(usePropertyStore.getState().property)));
    expect(loaded.rooms.find(room => room.id === roomId)?.openings?.[0]).toMatchObject({ kind: 'hole', shape: 'arch', heightM: 1.5, sillM: .7 });
    const preview = previewOpeningPlacement(loaded, 'ground', { x: 4.5, y: 0 }, { ...opening({ widthM: 1, heightM: .6, sillM: 1.7 }), shape: 'rectangle' });
    expect(preview?.opening.sillM).toBe(1.7);
    expect(preview?.ok).toBe(true);
  });
  it('never quotes paint for glass despite stale imported paint metadata', () => {
    const property = { wallHeightM: 2.7, rooms: [{ id: 'r', name: 'Glass', polygon, wallConstruction: [{ edgeIndex: 0, kind: 'glass' as const }], wallPaint: [{ edgeIndex: 0, paintId: WALL_PAINTS[0].id }] }],
      walls: [{ id: 'w', a: { x: 0, y: 0 }, b: { x: 3, y: 0 }, construction: 'glass' as const, paintId: WALL_PAINTS[0].id }] };
    expect(deriveWallPaintOrders(property)).toEqual([]);
    expect(wallPaintBreakdown(property)).toEqual([]);
  });
  it('allows vertically separated holes and rejects vertical overlap on the same shared wall', () => {
    usePropertyStore.getState().resetToDefault();
    const roomId = usePropertyStore.getState().addRoom({ name: 'Tall wall', polygon });
    const store = usePropertyStore.getState();
    expect(store.addOpening(roomId, opening({ id: 'low', kind: 'hole', heightM: .5, sillM: .2 }))).toBe('low');
    expect(store.addOpening(roomId, opening({ id: 'high', kind: 'hole', heightM: .5, sillM: 1.2 }))).toBe('high');
    expect(store.addOpening(roomId, opening({ id: 'overlap', kind: 'hole', heightM: .5, sillM: 1.4 }))).toBeNull();
    expect(store.updateOpening('high', { sillM: .5 })).toBe(false);
  });
});
