/**
 * roomSolids — the 3D MODE solid model agrees with the painter (2026-09-17).
 *
 * Pins: (1) a room yields a floor and one slab per edge with the painter's
 * keys; (2) doors and windows become openings with the painter's heights;
 * (3) the cutaway for a camera equals the painter's full/stub split, wall
 * for wall; (4) a shared wall's near-side stub is hidden, never doubled;
 * (5) free walls drop when nearer than the target; (6) items keep the
 * painter's footprint and mount heights.
 */
import { describe, it, expect } from 'vitest';
import { buildSolids, cutawayState, inwardNormal, cameraSide, wallAnchor } from '../roomSolids';
import { buildScene, cameraPosition, fitCamera, boundsOf, PLASTER_HEX, type SceneInput, type Vec3 } from '../roomView3d';

const ROOM = [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 4 }, { x: 0, y: 4 }];
const ROOM2 = [{ x: 5, y: 0 }, { x: 9, y: 0 }, { x: 9, y: 4 }, { x: 5, y: 4 }];

function input(extra: Partial<SceneInput> = {}, cam: Vec3 = { x: 2.5, y: 12, z: 6 }): SceneInput {
  return {
    rooms: [
      {
        id: 'r1',
        name: 'Room 1',
        polygon: ROOM,
        openings: [
          { edgeIndex: 0, offsetM: 1, widthM: 0.838, kind: 'door' },
          { edgeIndex: 1, offsetM: 2, widthM: 1.2, kind: 'window', sillM: 0.9 },
        ],
        wallColourByEdge: new Map([[0, '#EDEBDF']]),
        items: [{ instanceId: 'i1', x: 1, y: 1, rotation: 90, lengthCm: 200, widthCm: 90, heightCm: 150 }],
      },
    ],
    wallHeightM: 2.7,
    cameraPos: cam,
    cameraTarget: { x: 2.5, y: 2, z: 0 },
    ...extra,
  };
}

describe('buildSolids — one slab per edge, the painter’s keys', () => {
  it('a rectangle gives a floor and four walls', () => {
    const s = buildSolids(input());
    expect(s.floors.map((f) => f.key)).toEqual(['floor-r1']);
    expect(s.walls.map((w) => w.key)).toEqual(['wall-r1-0', 'wall-r1-1', 'wall-r1-2', 'wall-r1-3']);
    expect(s.walls.every((w) => w.heightM === 2.7 && w.thicknessM > 0 && !w.centred)).toBe(true);
    expect(s.walls[0].hex).toBe('#EDEBDF');
    expect(s.walls[2].hex).toBe(PLASTER_HEX); // unpainted plaster
  });

  it('a painted edge carries its finish; bare plaster carries none (3D Mode materials)', () => {
    const s = buildSolids(input({ rooms: [{ ...input().rooms[0], wallFinishByEdge: new Map([[0, 'silk']]) }] }));
    expect(s.walls[0].finish).toBe('silk');
    expect(s.walls[1].finish).toBeUndefined();
    const free = buildSolids(input({ walls: [{ id: 'w1', a: { x: 1, y: 1 }, b: { x: 3, y: 1 }, colourHex: '#4C493F', finish: 'gloss' }] }));
    expect(free.walls.find((w) => w.key === 'fw-w1')?.finish).toBe('gloss');
  });

  it('a door is an opening from the floor to door height; a window from its sill', () => {
    const s = buildSolids(input());
    const north = s.walls.find((w) => w.key === 'wall-r1-0')!;
    expect(north.openings).toHaveLength(1);
    expect(north.openings[0]).toMatchObject({ kind: 'door', bottomM: 0, topM: 2.04 });
    expect(north.openings[0].t0M).toBeCloseTo(1 - 0.419, 5);
    expect(north.openings[0].t1M).toBeCloseTo(1 + 0.419, 5);
    const east = s.walls.find((w) => w.key === 'wall-r1-1')!;
    expect(east.openings[0]).toMatchObject({ kind: 'window', bottomM: 0.9, topM: 2.1 });
  });

  it('an outdoor room has no floor slab and no walls, but keeps its items', () => {
    const s = buildSolids(input({ rooms: [{ id: 'g', name: 'Garden', polygon: ROOM, kind: 'outdoor', items: [{ instanceId: 'tree', x: 0, y: 0, rotation: 0, lengthCm: 100, widthCm: 100, heightCm: 250 }] }] }));
    expect(s.floors).toHaveLength(0);
    expect(s.walls).toHaveLength(0);
    expect(s.items).toHaveLength(1);
  });

  it('the inward normal of a clockwise y-down edge is (-dy, dx)', () => {
    // North wall runs west→east: inward points south (+y on paper).
    expect(inwardNormal({ x: 0, y: 0 }, { x: 5, y: 0 })).toEqual({ x: -0, y: 1 });
    expect(cameraSide({ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 0, y: 1 }, { x: 2.5, y: 2, z: 1 })).toBeGreaterThan(0);
  });
});

describe('cutawayState — the painter’s full/stub split, wall for wall', () => {
  const cams: Vec3[] = [
    { x: 2.5, y: 12, z: 6 }, // south
    { x: 14, y: 2, z: 6 }, // east
    { x: 2.5, y: -10, z: 6 }, // north
    { x: -9, y: 2, z: 6 }, // west
    { x: 12, y: 12, z: 4 }, // south-east
  ];
  for (const cam of cams) {
    it(`camera at (${cam.x}, ${cam.y}) — same walls up as buildScene`, () => {
      const inp = input({}, cam);
      const painter = buildScene(inp);
      const fullKeys = painter.filter((f) => f.kind === 'wall' && f.key.startsWith('wall-')).map((f) => f.key).sort();
      const stubKeys = painter.filter((f) => f.key.startsWith('stub-r1')).map((f) => f.key.replace('stub-', 'wall-')).sort();
      const state = cutawayState(buildSolids(inp), inp.cameraPos, inp.cameraTarget);
      const mineFull = [...state].filter(([, v]) => v === 'full').map(([k]) => k).sort();
      const mineStub = [...state].filter(([, v]) => v === 'stub').map(([k]) => k).sort();
      expect(mineFull).toEqual(fullKeys);
      expect(mineStub).toEqual(stubKeys);
    });
  }

  it('a shared wall: the near room’s stub is hidden, the far room’s wall stands with the projected doorway', () => {
    const inp = input(
      {
        rooms: [
          { id: 'r1', name: 'Room 1', polygon: ROOM, openings: [{ edgeIndex: 1, offsetM: 2, widthM: 0.9, kind: 'door' }] },
          { id: 'r2', name: 'Room 2', polygon: ROOM2, openings: [{ edgeIndex: 3, offsetM: 2, widthM: 0.9, kind: 'door' }] },
        ],
      },
      { x: 14, y: 2, z: 5 }, // east of both rooms
    );
    const solids = buildSolids(inp);
    const r1East = solids.walls.find((w) => w.key === 'wall-r1-1')!;
    const r2West = solids.walls.find((w) => w.key === 'wall-r2-3')!;
    expect(r1East.shared).toBe(true);
    expect(r2West.shared).toBe(true);
    const state = cutawayState(solids, inp.cameraPos, inp.cameraTarget);
    // Camera east: r2's west wall is r2's far wall → full, carrying the doorway.
    expect(state.get('wall-r2-3')).toBe('full');
    expect(r2West.openings).toHaveLength(1);
    // r1's east wall would be a stub in front of it → hidden, not doubled.
    expect(state.get('wall-r1-1')).toBe('hidden');
  });

  it('a free wall drops to a stub when it is nearer the camera than the target', () => {
    const inp = input({ walls: [{ id: 'w1', a: { x: 0, y: 6 }, b: { x: 5, y: 6 } }, { id: 'w2', a: { x: 0, y: -3 }, b: { x: 5, y: -3 } }] });
    const state = cutawayState(buildSolids(inp), inp.cameraPos, inp.cameraTarget);
    expect(state.get('fw-w1')).toBe('stub'); // between the camera (south) and the target
    expect(state.get('fw-w2')).toBe('full'); // beyond the target
  });

  it('wallAnchor sits at the middle of the wall at half the shown height', () => {
    const s = buildSolids(input());
    const w = s.walls[0];
    expect(wallAnchor(w, 'full')).toEqual({ x: 2.5, y: 0, z: 1.35 });
    expect(wallAnchor(w, 'stub')).toEqual({ x: 2.5, y: 0, z: 0.16 });
  });
});

describe('items — the painter’s footprint and heights', () => {
  it('a 200×90 item rotated 90° occupies 0.9 × 2.0 m from its top-left, floor to 1.5 m', () => {
    const s = buildSolids(input());
    expect(s.items).toHaveLength(1);
    const it1 = s.items[0];
    expect(it1.x1 - it1.x0).toBeCloseTo(0.9, 6);
    expect(it1.y1 - it1.y0).toBeCloseTo(2.0, 6);
    expect(it1.z0).toBe(0);
    expect(it1.z1).toBeCloseTo(1.5, 6);
  });

  it('wall-mounted and ceiling items take their mount heights, capped by the wall', () => {
    const s = buildSolids(
      input({
        rooms: [
          {
            id: 'r1',
            name: 'R',
            polygon: ROOM,
            items: [
              { instanceId: 'tv', x: 1, y: 0, rotation: 0, lengthCm: 120, widthCm: 10, heightCm: 70, placement: 'wall', mountHeightCm: 110 },
              { instanceId: 'lamp', x: 2, y: 2, rotation: 0, lengthCm: 40, widthCm: 40, heightCm: 30, placement: 'ceiling' },
            ],
          },
        ],
      }),
    );
    const tv = s.items.find((i) => i.instanceId === 'tv')!;
    expect(tv.z0).toBeCloseTo(1.1, 6);
    expect(tv.z1).toBeCloseTo(1.8, 6);
    const lamp = s.items.find((i) => i.instanceId === 'lamp')!;
    expect(lamp.z1).toBeCloseTo(2.7, 6);
    expect(lamp.z0).toBeCloseTo(2.4, 6);
  });

  it('fits the same bounds the painter’s camera frames', () => {
    const b = boundsOf([{ polygon: ROOM }]);
    expect(b).not.toBeNull();
    const cam = fitCamera(b!, 2.7, 1.4);
    const pos = cameraPosition(cam);
    expect(pos.z).toBeGreaterThan(0);
  });
});
