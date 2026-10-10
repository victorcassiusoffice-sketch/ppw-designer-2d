import { describe, expect, it } from 'vitest';
import { closedWallFaces, inferConnectedRooms, snapVertexToFloorWalls, wallRunFormsRoom } from '../connectedWallRooms';
import { polygonArea, type Polygon } from '../../lib/geometry';
import type { Property, Room } from '../../store/propertyStore';
import { runToFreeWalls } from '../freeWalls';
import { roomEdges, sharedEdgeMap } from '../wallEdges';
import { propertyMaterialsGeometry } from '../propertyMaterials';
import { strictPolygonsOverlap, unstackLegacyRooms } from '../roomLayout';

const v = (x: number, y: number) => ({ x, y });
const box = (x = 0, y = 0, w = 4, h = 4): Polygon => [v(x, y), v(x + w, y), v(x + w, y + h), v(x, y + h)];
const room = (polygon = box()): Room => ({ id: 'original', name: 'Room 1', polygon, placedItems: [] });
const property = (rooms: Room[] = [room()]): Property => ({ id: 'p', name: 'House', activeRoomId: rooms[0].id, rooms });
function close(p: Property, vertices: Polygon, levelId = 'ground'): Property {
  let count = 0;
  const walls = runToFreeWalls(vertices, levelId).map(wall => ({ ...wall, id: `new-wall-${count++}` }));
  return inferConnectedRooms({ ...p, walls: [...(p.walls ?? []), ...walls] }, levelId, () => `new-room-${count++}`);
}

describe('closed wall graph rooms', () => {
  it('auto-commits a plan run only when a new bounded room actually forms', () => {
    const p = property();
    expect(wallRunFormsRoom(p, [v(4, 0), v(7, 2)], 'ground')).toBe(false);
    expect(wallRunFormsRoom(p, [v(4, 0), v(7, 2), v(4, 4)], 'ground')).toBe(true);
    expect(wallRunFormsRoom(p, [v(0, 0), v(4, 0)], 'ground')).toBe(false);
    expect(wallRunFormsRoom(p, [v(4, 0), v(7, 2), v(4, 4)], 'upper')).toBe(false);
    expect(p.rooms).toHaveLength(1);
    expect(p.walls).toBeUndefined();
  });

  it('snaps plan joins only to the current storey and also reaches free-wall midpoints', () => {
    const p = property();
    p.walls = [{ id: 'upper-wall', a: v(5.13, 0), b: v(5.13, 4), thicknessM: 0.1, levelId: 'upper' }];
    expect(snapVertexToFloorWalls(p, v(5.1, 2), 'upper', 0.2)).toEqual({ v: v(5.13, 2), kind: 'edge' });
    expect(snapVertexToFloorWalls(p, v(5.1, 0.02), 'upper', 0.2)).toEqual({ v: v(5.13, 0), kind: 'vertex' });
    expect(snapVertexToFloorWalls(p, v(5.1, 2), 'ground', 0.2)).toBeNull();
    expect(snapVertexToFloorWalls(p, v(0.02, 0), 'upper', 0.2)).toBeNull();
    expect(snapVertexToFloorWalls(p, v(NaN, 0), 'upper', 0.2)).toBeNull();
  });
  it('creates an adjacent triangle using the existing fourth-metre wall without redrawing it', () => {
    const original = property();
    const next = close(original, [v(4, 0), v(7, 2), v(4, 4)]);
    expect(next.rooms).toHaveLength(2);
    expect(next.rooms[0]).toBe(original.rooms[0]);
    expect(polygonArea(next.rooms[1].polygon)).toBe(6);
    expect(next.walls).toHaveLength(0);
  });

  it('forms concave adjacent rooms against only a portion of an existing edge', () => {
    const original = property();
    const next = close(original, [v(4, 1), v(7, 1), v(7, 2), v(6, 2), v(6, 3), v(4, 3)]);
    expect(next.rooms).toHaveLength(2);
    expect(next.rooms[0]).toBe(original.rooms[0]);
    expect(polygonArea(next.rooms[1].polygon)).toBe(5);
    expect(next.walls).toHaveLength(0);
    expect(sharedEdgeMap(next.rooms).size).toBeGreaterThan(0);
    const lengths = propertyMaterialsGeometry(next).walls.reduce((sum, wall) => sum + wall.lengthM, 0);
    expect(lengths).toBe(24); // 16 m old perimeter + 8 m new walls, shared 2 m counted once
  });

  it('splits a room into triangular faces when a diagonal links opposite corners', () => {
    const original = property();
    const next = close(original, [v(0, 0), v(4, 4)]);
    expect(next.rooms).toHaveLength(2);
    expect(next.rooms.every(room => room.polygon.length === 3)).toBe(true);
    expect(next.rooms.reduce((area, room) => area + polygonArea(room.polygon), 0)).toBe(16);
    expect(next.rooms[0].id).toBe('original');
    expect(next.walls).toHaveLength(0);
    expect(propertyMaterialsGeometry(next).walls.reduce((sum, wall) => sum + wall.lengthM, 0)).toBeCloseTo(16 + Math.sqrt(32));
  });

  it('forms a U-shaped room using three shared edges even when its vertex-average lies in its neighbour', () => {
    const original = property([room(box(2, 0, 2, 3))]);
    const next = close(original, [v(2, 0), v(0, 0), v(0, 6), v(6, 6), v(6, 0), v(4, 0)]);
    expect(next.rooms).toHaveLength(2);
    expect(next.rooms[0]).toBe(original.rooms[0]);
    expect(polygonArea(next.rooms[1].polygon)).toBe(30);
    expect(next.walls).toHaveLength(0);
    expect(strictPolygonsOverlap(next.rooms[0].polygon, next.rooms[1].polygon)).toBe(false);
    expect(strictPolygonsOverlap(next.rooms[1].polygon, next.rooms[0].polygon)).toBe(false);
    expect(strictPolygonsOverlap(next.rooms[1].polygon, [...next.rooms[1].polygon])).toBe(true);
    expect(strictPolygonsOverlap(next.rooms[1].polygon, [...next.rooms[1].polygon].reverse())).toBe(true);
    expect(unstackLegacyRooms(next)).toBe(next);
  });

  it('partitions along T junctions and preserves world openings, finishes, item parentage and room area', () => {
    const original = room(box(0, 0, 8, 4));
    original.wallPaint = [{ edgeIndex: 0, paintId: 'paint', colourHex: '#123456' }];
    original.wallConstruction = [{ edgeIndex: 0, kind: 'brick' }];
    original.openings = [{ id: 'door', edgeIndex: 0, offsetM: 6, widthM: 0.8, kind: 'door', flipFacing: false, flipHand: false }];
    original.placedItems = [
      { instanceId: 'left', productId: 'a', x: 1, y: 1, rotation: 0 },
      { instanceId: 'right', productId: 'b', x: 6, y: 2, rotation: 0 },
      { instanceId: 'child', productId: 'c', x: 6, y: 2, rotation: 0, parentInstanceId: 'right' },
    ];
    const next = close(property([original]), [v(4, 0), v(4, 4)]);
    expect(next.rooms).toHaveLength(2);
    expect(next.rooms.reduce((sum, room) => sum + polygonArea(room.polygon), 0)).toBe(32);
    expect(next.rooms.flatMap(room => room.placedItems)).toEqual(expect.arrayContaining(original.placedItems));
    const right = next.rooms.find(room => room.placedItems.some(item => item.instanceId === 'right'))!;
    expect(right.placedItems.map(item => item.instanceId)).toEqual(['right', 'child']);
    expect(next.rooms.every(room => room.wallPaint?.[0].colourHex === '#123456')).toBe(true);
    const doorway = right.openings![0], edge = roomEdges(right).find(edge => edge.index === doorway.edgeIndex)!;
    expect({ x: edge.a.x + edge.dx * doorway.offsetM, y: edge.a.y + edge.dy * doorway.offsetM }).toEqual(v(6, 0));
    expect(next.rooms.flatMap(room => room.openings ?? [])).toHaveLength(1);
  });

  it('keeps a bisected doorway and the original room instead of dropping the opening', () => {
    const original = room();
    original.openings = [{ id: 'door', edgeIndex: 0, offsetM: 2, widthM: 0.8, kind: 'door', flipFacing: false, flipHand: false }];
    const next = close(property([original]), [v(2, 0), v(2, 4)]);
    expect(next.rooms).toEqual([original]);
    expect(next.walls).toHaveLength(1);
  });

  it('closes joins within one millimetre while leaving a real gap open', () => {
    expect(close(property(), [v(4.0005, 0), v(6, 2), v(4.0005, 4)]).rooms).toHaveLength(2);
    expect(close(property(), [v(4.005, 0), v(6, 2), v(4.005, 4)]).rooms).toHaveLength(1);
  });

  it('preserves dangling tails and re-running inference cannot duplicate a room', () => {
    const first = close(property([room([])]), [v(0, 0), v(4, 0), v(4, 4), v(0, 4), v(0, 0), v(-2, 0)]);
    expect(first.rooms).toHaveLength(1);
    expect(first.rooms[0].polygon).toEqual(box());
    expect(first.walls).toHaveLength(1);
    const again = inferConnectedRooms(first, 'ground', () => 'unused');
    expect(again).toBe(first);
  });

  it('splits an overhanging free wall into its room edge and remaining physical tail', () => {
    const p = property([room([])]);
    p.walls = [{ id: 'long', a: v(0, 0), b: v(8, 0), thicknessM: 0.12, paintId: 'paint' }];
    const next = close(p, [v(4, 0), v(4, 3), v(0, 3), v(0, 0)]);
    expect(polygonArea(next.rooms[0].polygon)).toBe(12);
    expect(next.walls).toEqual([expect.objectContaining({ id: 'long', a: v(4, 0), b: v(8, 0), paintId: 'paint' })]);
    expect(next.rooms[0].wallPaint).toEqual([expect.objectContaining({ paintId: 'paint' })]);
  });

  it('keeps floor graphs independent and preserves per-floor quantities/heights', () => {
    const p = property();
    p.levels = [{ id: 'ground', name: 'Ground', index: 0, heightM: 2.8 }, { id: 'first', name: 'First', index: 1, heightM: 3.2 }];
    p.rooms.push({ ...room(), id: 'upper', levelId: 'first' });
    const next = close(p, [v(0, 0), v(4, 4)], 'first');
    expect(next.rooms).toHaveLength(3);
    expect(next.rooms.filter(room => room.levelId === 'first')).toHaveLength(2);
    expect(next.rooms[0]).toBe(p.rooms[0]);
    const walls = propertyMaterialsGeometry(next).walls;
    expect(walls.filter(wall => wall.levelId === 'ground').every(wall => wall.heightM === 2.8)).toBe(true);
    expect(walls.filter(wall => wall.levelId === 'first').every(wall => wall.heightM === 3.2)).toBe(true);
  });

  it('finds the four minimal faces at crossing partitions, without keeping the duplicate outer face', () => {
    const p = property();
    p.walls = [
      { id: 'vertical', a: v(2, 0), b: v(2, 4), thicknessM: 0.1 },
      { id: 'horizontal', a: v(0, 2), b: v(4, 2), thicknessM: 0.1 },
    ];
    let id = 0;
    const next = inferConnectedRooms(p, 'ground', () => `room-${id++}`);
    expect(next.rooms).toHaveLength(4);
    expect(next.rooms.map(room => polygonArea(room.polygon))).toEqual([4, 4, 4, 4]);
    expect(new Set(next.rooms.map(room => room.name)).size).toBe(4);
    expect(next.walls).toHaveLength(0);
    expect(propertyMaterialsGeometry(next).walls.reduce((n, wall) => n + wall.lengthM, 0)).toBe(24);
  });

  it('does not double the painted faces when a painted partition becomes a shared room edge', () => {
    const p = property();
    p.walls = [{ id: 'partition', a: v(2, 0), b: v(2, 4), thicknessM: 0.1, paintId: 'paint', paintFaces: 1 }];
    const one = inferConnectedRooms(p, 'ground', () => 'right');
    expect(one.rooms.flatMap(room => room.wallPaint ?? [])).toHaveLength(1);
    p.walls[0].paintFaces = 2;
    const both = inferConnectedRooms(p, 'ground', () => 'right');
    expect(both.rooms.flatMap(room => room.wallPaint ?? [])).toHaveLength(2);
  });

  it('does not overlap an existing room with an isolated inner loop or accept malformed points', () => {
    const next = close(property(), [v(1, 1), v(3, 1), v(3, 3), v(1, 3), v(1, 1)]);
    expect(next.rooms).toHaveLength(1);
    expect(next.walls).toHaveLength(4);
    const surrounding = close(property(), [v(-1, -1), v(5, -1), v(5, 5), v(-1, 5), v(-1, -1)]);
    expect(surrounding.rooms).toHaveLength(1);
    expect(surrounding.walls).toHaveLength(4);
    expect(closedWallFaces([{ a: v(NaN, 0), b: v(3, 0) }, { a: v(0, 0), b: v(0, 0) }])).toEqual([]);
    expect(closedWallFaces([{ a: v(-1e200, -1e200), b: v(1e200, -1e200) }, { a: v(1e200, -1e200), b: v(1e200, 1e200) }, { a: v(1e200, 1e200), b: v(-1e200, -1e200) }])).toEqual([]);
    expect(closedWallFaces([{ a: v(0, 0), b: v(1, 0) }, { a: v(1, 0), b: v(2, 0) }])).toEqual([]);
  });
});
