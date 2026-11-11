/** @vitest-environment jsdom */
import { beforeEach, describe, it, expect } from 'vitest';
import { usePropertyStore } from '../../store/propertyStore';
import {
  surfaceTargets,
  bendAt,
  commitBend,
  sameSurfaceGroup,
  removeSurface,
} from '../surfaceActions';
import { serviceRunLengthM, type ServiceRun } from '../buildingServices';
import { roomEdges } from '../wallEdges';
const poly = [
  { x: 0, y: 0 },
  { x: 8, y: 0 },
  { x: 8, y: 6 },
  { x: 0, y: 6 },
];
const run: ServiceRun = {
  id: 'pipe',
  system: 'cold-water',
  materialId: 'ppr',
  levelId: 'ground',
  diameterMm: 25,
  points: [
    { x: 1, y: 2 },
    { x: 7, y: 2 },
  ],
  startElevationM: 0.1,
  endElevationM: 0.6,
};
const prop = () => usePropertyStore.getState().property;
beforeEach(() => {
  usePropertyStore.getState().resetToDefault();
  usePropertyStore.setState({
    property: {
      ...prop(),
      site: undefined,
      rooms: [{ id: 'room', name: 'Room', polygon: poly, placedItems: [] }],
      walls: [
        { id: 'wall', a: { x: 1, y: 1 }, b: { x: 7, y: 1 }, paintId: 'paint', thicknessM: 0.18 },
      ],
      services: { version: 1, runs: [run], fixtures: [] },
    },
  });
});
describe('actions on measured build elements', () => {
  it('pulls a wall through the pointer, retaining its thickness, paint and both endpoints', () => {
    const edge = bendAt(
      prop(),
      { kind: 'wall', hit: { kind: 'free', wallId: 'wall' } },
      { x: 4, y: 1 },
    )!;
    expect(commitBend(edge, { x: 4, y: 2 })).toBe(true);
    const walls = prop().walls!;
    expect(walls[0].a).toEqual(edge.a);
    expect(walls[walls.length-1]?.b).toEqual(edge.b);
    expect(walls.some((w) => w.b.x === 4 && w.b.y === 2)).toBe(true);
    expect(walls.every((w) => w.thicknessM === 0.18 && w.paintId === 'paint')).toBe(true);
    expect(walls.reduce((n, w) => n + Math.hypot(w.b.x - w.a.x, w.b.y - w.a.y), 0)).toBeGreaterThan(
      6,
    );
    expect(commitBend(edge, { x: 4, y: 4 })).toBe(false);
  });
  it('preserves the measured endpoints and elevations of a bent pipe', () => {
    const edge = bendAt(prop(), { kind: 'run', id: 'pipe' }, { x: 4, y: 2 })!;
    expect(commitBend(edge, { x: 4, y: 3 })).toBe(true);
    const r = prop().services!.runs[0];
    expect(r.points[0]).toMatchObject({ x: 1, y: 2, elevationM: 0.1 });
    expect(r.points[r.points.length-1]).toMatchObject({ x: 7, y: 2, elevationM: 0.6 });
    expect(serviceRunLengthM(r)).toBeGreaterThan(serviceRunLengthM(run));
  });
  it('exposes stacked targets and removes the selected service while retaining the room', () => {
    const hits = surfaceTargets(prop(), 'ground', { x: 3, y: 2 }, 0.1);
    expect(hits.map((h) => h.kind)).toEqual(['run', 'room']);
    expect(removeSurface(hits[0])).toBe(true);
    expect(prop().services?.runs ?? []).toHaveLength(0);
    expect(prop().rooms[0].polygon).toEqual(poly);
  });
  it('preserves an opening on an adjacent edge when pulling a room wall', () => {
    const p = prop();
    usePropertyStore.setState({
      property: {
        ...p,
        rooms: [
          {
            ...p.rooms[0],
            openings: [
              {
                id: 'door',
                kind: 'door',
                edgeIndex: 1,
                offsetM: 2,
                widthM: 1,
                flipFacing: false,
                flipHand: false,
              },
            ],
          },
        ],
      },
    });
    const edge = bendAt(
      prop(),
      { kind: 'wall', hit: { kind: 'edge', roomId: 'room', edgeIndex: 0 } },
      { x: 4, y: 0 },
    )!;
    expect(commitBend(edge, { x: 4, y: -1 })).toBe(true);
    const room = prop().rooms[0];
    const host = roomEdges(room).find((e) => e.index === room.openings![0].edgeIndex)!;
    expect(host.a).toEqual(poly[1]);
    expect(host.b).toEqual(poly[2]);
    expect(sameSurfaceGroup(edge.target, prop(), 'ground')?.targets.length).toBe(
      room.polygon.length,
    );
  });
});
