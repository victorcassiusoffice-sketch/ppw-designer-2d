import { describe, expect, it } from 'vitest';
import type { Property } from '../../store/propertyStore';
import { wallCurvesOf } from '../exportHouse3d';

describe('the curved walls of a design, by the key the 3D solids give a wall', () => {
  it("names a room's curved edge by its room and its edge, and a free wall by its id", () => {
    const design = {
      id: 'd',
      name: 'House',
      activeRoomId: 'r1',
      rooms: [
        {
          id: 'r1',
          name: 'Room',
          polygon: [],
          placedItems: [],
          wallArcs: [
            { edgeIndex: 0, bulge: 0.3 },
            { edgeIndex: 2, bulge: -0.5 },
            { edgeIndex: 3, bulge: 0 },
          ],
        },
        { id: 'r2', name: 'Other', polygon: [], placedItems: [] },
      ],
      walls: [
        { id: 'w1', a: { x: 0, y: 0 }, b: { x: 1, y: 0 }, thicknessM: 0.1, bulge: 0.4 },
        { id: 'w2', a: { x: 0, y: 1 }, b: { x: 1, y: 1 }, thicknessM: 0.1 },
        { id: 'w3', a: { x: 0, y: 2 }, b: { x: 1, y: 2 }, thicknessM: 0.1, bulge: 999 },
      ],
    } as unknown as Property;
    expect([...wallCurvesOf(design)]).toEqual([
      ['wall-r1-0', 0.3],
      ['wall-r1-2', -0.5],
      ['fw-w1', 0.4],
    ]);
  });

  it('is empty for a design with straight walls only', () => {
    const design = {
      id: 'd',
      name: 'House',
      activeRoomId: 'r1',
      rooms: [{ id: 'r1', name: 'Room', polygon: [], placedItems: [] }],
    } as unknown as Property;
    expect(wallCurvesOf(design).size).toBe(0);
  });
});
