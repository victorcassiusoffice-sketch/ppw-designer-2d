// @vitest-environment jsdom
import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import { normaliseLoadedProperty, normaliseLoadedRoom, usePropertyStore, type Room } from '../../store/propertyStore';
import { installHistorySubscriptions, useHistoryStore, __test } from '../../store/historyStore';
import { deriveWallPaintOrders, exteriorPaintAreaM2, wallPaintBreakdown } from '../wallPaintCalc';
import { resolvedWallSurfaces } from '../wallConstruction';
import { buildSolids } from '../roomSolids';

const paintId = 'permoglaze-matt-emulsion';
const room: Room = { id: 'r', name: 'Room', polygon: [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 3 }, { x: 0, y: 3 }], placedItems: [] };
let teardown: (() => void) | undefined;
beforeEach(() => {
  __test.resetSubscriptions();
  usePropertyStore.getState().resetToDefault();
  usePropertyStore.setState((state) => ({ property: { ...state.property, rooms: [structuredClone(room)], activeRoomId: 'r', walls: [], wallHeightM: 2.7 } }));
  useHistoryStore.getState().reset();
});
afterEach(() => { teardown?.(); teardown = undefined; });

describe('independent wall faces and construction', () => {
  it('keeps inside colour when painting and erasing outside, including save/load', () => {
    const store = usePropertyStore.getState();
    store.paintWallEdge('r', 0, paintId, { hex: '#FFAA99' });
    store.paintWallEdge('r', 0, paintId, { hex: '#557755' }, 'exterior');
    store.setWallConstruction('r', 0, 'brick');
    const saved = normaliseLoadedProperty(JSON.parse(JSON.stringify(usePropertyStore.getState().property)));
    const maps = resolvedWallSurfaces(saved.rooms[0]);
    expect(saved.rooms[0].wallPaint).toHaveLength(2);
    expect(maps.wallColourByEdge.get(0)).toBe('#FFAA99');
    expect(maps.exteriorColourByEdge.get(0)).toBe('#557755');
    expect(maps.wallConstructionByEdge.get(0)).toBe('brick');
    store.paintWallEdge('r', 0, null, null, 'exterior');
    expect(usePropertyStore.getState().property.rooms[0].wallPaint).toEqual([{ edgeIndex: 0, paintId, colourHex: '#FFAA99' }]);
  });

  it('undoes material and exterior paint separately without changing the interior', () => {
    usePropertyStore.getState().paintWallEdge('r', 0, paintId, { hex: '#FFAA99' });
    teardown = installHistorySubscriptions({ coalesceMs: 0 });
    usePropertyStore.getState().setWallConstruction('r', 0, 'concrete');
    usePropertyStore.getState().paintWallEdge('r', 0, paintId, { hex: '#557755' }, 'exterior');
    useHistoryStore.getState().undo();
    expect(usePropertyStore.getState().property.rooms[0].wallPaint).toHaveLength(1);
    expect(usePropertyStore.getState().property.rooms[0].wallConstruction?.[0].kind).toBe('concrete');
    useHistoryStore.getState().undo();
    expect(usePropertyStore.getState().property.rooms[0].wallConstruction).toBeUndefined();
    useHistoryStore.getState().redo();
    useHistoryStore.getState().redo();
    expect(usePropertyStore.getState().property.rooms[0].wallPaint).toHaveLength(2);
  });

  it('carries both colours and construction through winding reversal on the same wall', () => {
    const loaded = normaliseLoadedRoom({ ...room, polygon: [...room.polygon].reverse(), wallPaint: [{ edgeIndex: 0, paintId }, { edgeIndex: 0, paintId, side: 'exterior', colourHex: '#123456' }], wallConstruction: [{ edgeIndex: 0, kind: 'brick' }] });
    expect(loaded.wallPaint).toHaveLength(2);
    expect(loaded.wallPaint?.[0].edgeIndex).toBe(loaded.wallPaint?.[1].edgeIndex);
    expect(loaded.wallConstruction?.[0].edgeIndex).toBe(loaded.wallPaint?.[0].edgeIndex);
  });

  it('keeps both free-wall faces in saved files and replaces legacy two-face quantity only once', () => {
    usePropertyStore.setState((state) => ({ property: { ...state.property, walls: [{ id: 'w', a: { x: 0, y: 0 }, b: { x: 4, y: 0 }, thicknessM: .15, paintId, paintFaces: 2 }] } }));
    usePropertyStore.getState().paintFreeWall('w', paintId, { hex: '#557755' }, 'exterior');
    usePropertyStore.getState().setFreeWallConstruction('w', 'concrete');
    const saved = normaliseLoadedProperty(JSON.parse(JSON.stringify(usePropertyStore.getState().property)));
    expect(saved.walls?.[0].exteriorPaint?.colourHex).toBe('#557755');
    expect(saved.walls?.[0].construction).toBe('concrete');
    expect(deriveWallPaintOrders(saved).reduce((sum, order) => sum + order.areaM2, 0)).toBeCloseTo(4 * 2.7 * 2);
  });

  it('paints only exposed walls when filling outside of adjoining rooms', () => {
    const neighbour: Room = { ...room, id: 'next', polygon: room.polygon.map((vertex) => ({ ...vertex, x: vertex.x + 4 })) };
    usePropertyStore.setState((state) => ({ property: { ...state.property, rooms: [room, neighbour] } }));
    usePropertyStore.getState().paintRoomWalls('r', paintId, null, 'exterior');
    expect(usePropertyStore.getState().property.rooms[0].wallPaint?.map((edge) => edge.edgeIndex)).toEqual([0, 2, 3]);
    expect(deriveWallPaintOrders(usePropertyStore.getState().property)[0].areaM2).toBeCloseTo(11 * 2.7);
  });

  it('measures partial exposed wall spans and preserves the opening deduction arithmetic', () => {
    const neighbour: Room = { ...room, id: 'next', polygon: [{ x: 4, y: 1 }, { x: 6, y: 1 }, { x: 6, y: 3 }, { x: 4, y: 3 }] };
    const painted: Room = { ...room, wallPaint: [{ edgeIndex: 1, paintId, side: 'exterior' }] };
    expect(exteriorPaintAreaM2(painted, 1, 2.7, [painted, neighbour])).toBeCloseTo(2.7);
    const breakdown = wallPaintBreakdown({ rooms: [painted, neighbour], wallHeightM: 2.7 });
    expect(breakdown[0].grossM2 - breakdown[0].openingsM2).toBeCloseTo(breakdown[0].areaM2);
    expect(breakdown[0].wallLabel).toBe('Outside wall 2');
  });

  it('does not confuse another storey with a shared ground-floor exterior wall', () => {
    const above = { ...room, id: 'above', levelId: 'first' };
    expect(exteriorPaintAreaM2(room, 0, 2.7, [room, above])).toBeCloseTo(10.8);
  });

  it('passes inside/outside finishes and construction to the solids renderer', () => {
    const surfaces = resolvedWallSurfaces({ ...room, wallConstruction: [{ edgeIndex: 0, kind: 'brick' }], wallPaint: [{ edgeIndex: 0, side: 'exterior', paintId, colourHex: '#557755' }] });
    const solid = buildSolids({ rooms: [{ ...room, ...surfaces }], walls: [], wallHeightM: 2.7, cameraPos: { x: 1, y: 6, z: 4 }, cameraTarget: { x: 2, y: 1, z: 0 } }).walls[0];
    expect(solid.construction).toBe('brick');
    expect(solid.exteriorHex).toBe('#557755');
    expect(solid.finish).toBeUndefined();
    expect(solid.exteriorFinish).toBe('matt');
  });

  it('drops malformed construction values from imported designs', () => {
    const loaded = normaliseLoadedRoom({ ...room, wallConstruction: [null, { edgeIndex: 0, kind: 'lava' }, { edgeIndex: 70, kind: 'brick' }] as never });
    expect(loaded.wallConstruction).toBeUndefined();
  });
});
