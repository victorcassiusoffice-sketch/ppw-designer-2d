import { describe, expect, it } from 'vitest';
import type { Property } from '../../../store/propertyStore';
import type { SceneInput } from '../../../designer/roomView3d';
import type { ItemSolid, SceneSolids, WallSolid } from '../../../designer/roomSolids';
import { FLOOR_SLAB_THICKNESS_M } from '../../../designer/building';
import { activeLevelIdOf, roomsOnLevel } from '../../../designer/levels';
import {
  createRoofSurface,
  roofMaximumHeight,
  roofVerticalThickness,
} from '../../../designer/roofSurface';
import { arcGeometry } from '../../../designer/arcSegment';
import { prepareWalkVisit } from '../../../walk/visit';
import {
  exportParts,
  glbBytes,
  modelNumbers,
  partVolumeM3,
  stlBytes,
  type ExportPart,
} from '../exportModel';

const P = (x: number, y: number) => ({ x, y });
/** A room of 6 by 4 metres, its corners in the order the app keeps: edge 0 along the top of the plan. */
const ROOM = [P(0, 0), P(6, 0), P(6, 4), P(0, 4)];

function wall(
  a: { x: number; y: number },
  b: { x: number; y: number },
  more: Partial<WallSolid> = {},
): WallSolid {
  const length = Math.hypot(b.x - a.x, b.y - a.y);
  return {
    key: 'wall-r1-0',
    hit: { kind: 'room', roomId: 'r1', edgeIndex: 0 } as unknown as WallSolid['hit'],
    a,
    b,
    lengthM: length,
    // The rule of the solids: (-dy, dx) looks into a room whose outline the app keeps.
    inward: { x: -(b.y - a.y) / length, y: (b.x - a.x) / length },
    thicknessM: 0.14,
    heightM: 2.7,
    stubHeightM: 0.32,
    centred: false,
    hex: '#E8E4DC',
    openings: [],
    shared: false,
    free: false,
    ...more,
  };
}
const solidsOf = (more: Partial<SceneSolids>): SceneSolids => ({
  wallHeightM: 2.7,
  floors: [],
  walls: [],
  items: [],
  ...more,
});
const only = (parts: ExportPart[]) => {
  expect(parts).toHaveLength(1);
  return parts[0];
};
const bounds = (part: ExportPart) => modelNumbers([part]);

/** Every edge of a closed solid is walked once each way: no hole, no face turned inside out. */
function openEdges(positions: Float32Array): number {
  const key = (i: number) =>
    `${Math.round(positions[i] * 1e5)},${Math.round(positions[i + 1] * 1e5)},${Math.round(positions[i + 2] * 1e5)}`;
  const count = new Map<string, number>();
  for (let t = 0; t < positions.length; t += 9) {
    const corners = [key(t), key(t + 3), key(t + 6)];
    if (new Set(corners).size < 3) continue;
    for (let e = 0; e < 3; e++) {
      const from = corners[e];
      const to = corners[(e + 1) % 3];
      count.set(`${from}>${to}`, (count.get(`${from}>${to}`) ?? 0) + 1);
    }
  }
  let open = 0;
  for (const [edge, n] of count) {
    const [from, to] = edge.split('>');
    if ((count.get(`${to}>${from}`) ?? 0) !== n) open++;
  }
  return open;
}

describe('the house as solids: floors', () => {
  it('a floor is a slab under its level, as large as the room, closed, with its faces outward', () => {
    const { parts } = exportParts(
      solidsOf({
        floors: [{ key: 'floor-r1', roomId: 'r1', polygon: ROOM, hex: '#C8B79A', elevationM: 3 }],
      }),
    );
    const floor = only(parts);
    expect(floor.kind).toBe('floor');
    expect(floor.colourHex).toBe('#c8b79a');
    expect(floor.extras).toEqual({ roomId: 'r1' });
    expect(partVolumeM3(floor.positions)).toBeCloseTo(6 * 4 * FLOOR_SLAB_THICKNESS_M, 5);
    expect(openEdges(floor.positions)).toBe(0);
    const box = bounds(floor);
    // x east as on the plan; the plan's y from 0 to 4 southward is y from -4 to 0 northward; top at its level.
    expect(box.min.x).toBeCloseTo(0, 5);
    expect(box.max.x).toBeCloseTo(6, 5);
    expect(box.min.y).toBeCloseTo(-4, 5);
    expect(box.max.y).toBeCloseTo(0, 5);
    expect(box.max.z).toBeCloseTo(3, 5);
    expect(box.min.z).toBeCloseTo(3 - FLOOR_SLAB_THICKNESS_M, 5);
  });

  it('the hole of a stair is cut through the slab', () => {
    const hole = [P(1, 1), P(2, 1), P(2, 3), P(1, 3)];
    const { parts } = exportParts(
      solidsOf({
        floors: [{ key: 'floor-r1', roomId: 'r1', polygon: ROOM, hex: '#C8B79A', holes: [hole] }],
      }),
    );
    expect(partVolumeM3(only(parts).positions)).toBeCloseTo((24 - 2) * FLOOR_SLAB_THICKNESS_M, 5);
    expect(openEdges(parts[0].positions)).toBe(0);
  });
});

describe('the house as solids: walls', () => {
  it('a wall of a room stands outside its line, as thick and as high as the 3D view has it', () => {
    const part = only(exportParts(solidsOf({ walls: [wall(ROOM[0], ROOM[1])] })).parts);
    expect(partVolumeM3(part.positions)).toBeCloseTo(6 * 2.7 * 0.14, 5);
    expect(openEdges(part.positions)).toBe(0);
    const box = bounds(part);
    // The room is south of edge 0 (plan y above 0), so the wall is north of the line: y from 0 to 0.14.
    expect(box.min.y).toBeCloseTo(0, 5);
    expect(box.max.y).toBeCloseTo(0.14, 5);
    expect(box.min.z).toBeCloseTo(0, 5);
    expect(box.max.z).toBeCloseTo(2.7, 5);
    expect(box.min.x).toBeCloseTo(0, 5);
    expect(box.max.x).toBeCloseTo(6, 5);
  });

  it('every wall of the room stands outside it: the four slabs leave the 6 by 4 room free', () => {
    const walls = ROOM.map((a, i) => wall(a, ROOM[(i + 1) % 4], { key: `wall-r1-${i}` }));
    const { parts } = exportParts(solidsOf({ walls }));
    expect(parts).toHaveLength(4);
    const all = modelNumbers(parts);
    expect(all.min.x).toBeCloseTo(-0.14, 5);
    expect(all.max.x).toBeCloseTo(6.14, 5);
    expect(all.min.y).toBeCloseTo(-4.14, 5);
    expect(all.max.y).toBeCloseTo(0.14, 5);
    // No corner of any slab lies inside the room.
    for (const part of parts)
      for (let i = 0; i < part.positions.length; i += 3) {
        const inside =
          part.positions[i] > 1e-6 &&
          part.positions[i] < 6 - 1e-6 &&
          part.positions[i + 1] < -1e-6 &&
          part.positions[i + 1] > -4 + 1e-6;
        expect(inside).toBe(false);
      }
  });

  it('a door is cut down to the floor and a window is a hole: the wall is closed and lacks their volume', () => {
    const door = { kind: 'door' as const, t0M: 1, t1M: 1.9, bottomM: 0, topM: 2.04 };
    const window = { kind: 'window' as const, t0M: 3, t1M: 4.2, bottomM: 0.9, topM: 2.1 };
    const part = only(
      exportParts(solidsOf({ walls: [wall(ROOM[0], ROOM[1], { openings: [door, window] })] }))
        .parts,
    );
    const face = 6 * 2.7 - 0.9 * 2.04 - 1.2 * 1.2;
    expect(partVolumeM3(part.positions)).toBeCloseTo(face * 0.14, 4);
    expect(openEdges(part.positions)).toBe(0);
  });

  it('an arched door and a round window keep their shape', () => {
    const arch = {
      kind: 'door' as const,
      t0M: 1,
      t1M: 2,
      bottomM: 0,
      topM: 2.2,
      profile: [
        P(1, 0),
        P(2, 0),
        P(2, 1.7),
        ...Array.from({ length: 25 }, (_, i) =>
          P(1.5 + Math.cos((Math.PI * i) / 24) * 0.5, 1.7 + Math.sin((Math.PI * i) / 24) * 0.5),
        ),
        P(1, 1.7),
      ],
    };
    const round = {
      kind: 'window' as const,
      t0M: 3.5,
      t1M: 4.5,
      bottomM: 1,
      topM: 2,
      profile: Array.from({ length: 96 }, (_, i) =>
        P(4 + Math.cos((Math.PI * 2 * i) / 96) * 0.5, 1.5 + Math.sin((Math.PI * 2 * i) / 96) * 0.5),
      ),
    };
    const part = only(
      exportParts(solidsOf({ walls: [wall(ROOM[0], ROOM[1], { openings: [arch, round] })] })).parts,
    );
    const archArea = 1 * 1.7 + (Math.PI * 0.25) / 2;
    const roundArea = Math.PI * 0.25;
    expect(partVolumeM3(part.positions) / ((6 * 2.7 - archArea - roundArea) * 0.14)).toBeCloseTo(
      1,
      2,
    );
    expect(openEdges(part.positions)).toBe(0);
  });

  it('a free wall stands on its line; the second of two openings that lie over each other is left, and said', () => {
    const free = wall(P(1, 2), P(4, 2), {
      key: 'fw-w1',
      centred: true,
      free: true,
      thicknessM: 0.1,
    });
    const part = only(exportParts(solidsOf({ walls: [free] })).parts);
    expect(bounds(part).min.y).toBeCloseTo(-2.05, 5);
    expect(bounds(part).max.y).toBeCloseTo(-1.95, 5);
    const twice = wall(ROOM[0], ROOM[1], {
      openings: [
        { kind: 'window', t0M: 1, t1M: 2, bottomM: 1, topM: 2 },
        { kind: 'window', t0M: 1.5, t1M: 2.5, bottomM: 1, topM: 2 },
      ],
    });
    const made = exportParts(solidsOf({ walls: [twice] }));
    expect(partVolumeM3(made.parts[0].positions)).toBeCloseTo((6 * 2.7 - 1) * 0.14, 4);
    expect(made.notes).toEqual(['1 opening lies over another or off the wall and is not cut out.']);
  });

  it('the copy of a pane of glass shared by two rooms is made once', () => {
    const walls = [
      wall(ROOM[0], ROOM[1]),
      wall(ROOM[1], ROOM[0], { key: 'wall-r2-2', renderDuplicateOf: 'wall-r1-0' }),
    ];
    expect(exportParts(solidsOf({ walls })).parts).toHaveLength(1);
  });
});

describe('the house as solids: a curved wall of format version 2', () => {
  it('is made curved: a band along the arc, as long as the arc', () => {
    const free = wall(P(0, 0), P(4, 0), {
      key: 'fw-w1',
      centred: true,
      free: true,
      thicknessM: 0.1,
    });
    const part = only(exportParts(solidsOf({ walls: [free] }), new Map([['fw-w1', 0.5]])).parts);
    const arc = arcGeometry(free.a, free.b, 0.5)!;
    // A band of even width on a circle: its area is the arc's length times the width.
    expect(partVolumeM3(part.positions) / (arc.lengthM * 0.1 * 2.7)).toBeCloseTo(1, 2);
    expect(openEdges(part.positions)).toBe(0);
    // It bows to where the format says: the middle of the arc, turned over in y, lies within the band.
    const box = bounds(part);
    expect(-arc.middle.y).toBeGreaterThan(box.min.y - 1e-6);
    expect(-arc.middle.y).toBeLessThan(box.max.y + 1e-6);
    // Its outer side reaches as far as the arc bows plus half the wall, less at most the 5 mm that the straight
    // pieces may stand off the true arc.
    const reach = Math.max(Math.abs(box.min.y), Math.abs(box.max.y));
    expect(reach).toBeLessThan(arc.sagittaM + 0.05 + 1e-4);
    expect(reach).toBeGreaterThan(arc.sagittaM + 0.05 - 0.0051);
  });

  it("a room's curved edge: the wall stands outside the arc and the floor reaches it", () => {
    const edge = wall(ROOM[0], ROOM[1]);
    const curves = new Map([['wall-r1-0', 0.3]]);
    const made = exportParts(
      solidsOf({
        walls: [edge],
        floors: [{ key: 'floor-r1', roomId: 'r1', polygon: ROOM, hex: '#C8B79A' }],
      }),
      curves,
    );
    const arc = arcGeometry(ROOM[0], ROOM[1], 0.3)!;
    // On edge 0 a positive bulge has its middle at a plan y below 0: outside this room.
    expect(arc.middle.y).toBeLessThan(0);
    const floor = made.parts.find((p) => p.kind === 'floor')!;
    const curved = made.parts.find((p) => p.kind === 'wall')!;
    // The arc bows away from the room here, so the floor gains the piece between the chord and the arc.
    const segment = (arc.radiusM ** 2 * (Math.abs(arc.sweep) - Math.sin(Math.abs(arc.sweep)))) / 2;
    expect(partVolumeM3(floor.positions) / ((24 + segment) * FLOOR_SLAB_THICKNESS_M)).toBeCloseTo(
      1,
      2,
    );
    expect(openEdges(curved.positions)).toBe(0);
    // The wall is outside the floor: no corner of it lies on the room's side of the arc by more than a hair.
    for (let i = 0; i < curved.positions.length; i += 3) {
      const fromCentre = Math.hypot(
        curved.positions[i] - arc.centre.x,
        -curved.positions[i + 1] - arc.centre.y,
      );
      expect(fromCentre).toBeGreaterThan(arc.radiusM - 1e-4);
      expect(fromCentre).toBeLessThan(arc.radiusM + 0.14 + 2e-3);
    }
  });

  it('with a door in it, it is exported straight, and that is said', () => {
    const edge = wall(ROOM[0], ROOM[1], {
      openings: [{ kind: 'door', t0M: 1, t1M: 1.9, bottomM: 0, topM: 2.04 }],
    });
    const made = exportParts(solidsOf({ walls: [edge] }), new Map([['wall-r1-0', 0.3]]));
    expect(made.notes).toEqual(['1 curved wall has a door or a window and is exported straight.']);
    expect(bounds(made.parts[0]).max.y).toBeCloseTo(0.14, 5);
  });
});

describe('the house as solids: a placed thing, a stair, the roof, the garden', () => {
  const thing = (more: Partial<ItemSolid> = {}): ItemSolid => ({
    key: 'item-i1',
    instanceId: 'i1',
    productId: 'p-1',
    x0: 1,
    y0: 1,
    x1: 3,
    y1: 2,
    z0: 0,
    z1: 0.8,
    rotationDeg: 0,
    hex: '#8A6F4D',
    lengthM: 2,
    widthM: 1,
    heightM: 0.8,
    ...more,
  });

  it('a thing is a box of its true size where the plan has it; a quarter turn swaps its sides', () => {
    const part = only(exportParts(solidsOf({ items: [thing()] })).parts);
    expect(part.extras).toEqual({ instanceId: 'i1', productId: 'p-1' });
    expect(partVolumeM3(part.positions)).toBeCloseTo(2 * 1 * 0.8, 5);
    const box = bounds(part);
    expect(
      [box.min.x, box.max.x, box.min.y, box.max.y].map((n) => Math.round(n * 1e6) / 1e6),
    ).toEqual([1, 3, -2, -1]);
    // Turned a quarter: the box round it on the plan is 1 by 2, as the design stores it.
    const turned = only(
      exportParts(solidsOf({ items: [thing({ rotationDeg: 90, x1: 2, y1: 3 })] })).parts,
    );
    const t = bounds(turned);
    expect([t.min.x, t.max.x, t.min.y, t.max.y].map((n) => Math.round(n * 1e6) / 1e6)).toEqual([
      1, 2, -3, -1,
    ]);
  });

  it('a thing that is not symmetric turns the way the plan turns it: clockwise on the page', () => {
    // A long thing at 30 degrees: its length runs from the plan's north-west down to the south-east.
    const size = {
      w: 2 * Math.cos(Math.PI / 6) + 1 * Math.sin(Math.PI / 6),
      h: 2 * Math.sin(Math.PI / 6) + 1 * Math.cos(Math.PI / 6),
    };
    const part = only(
      exportParts(
        solidsOf({ items: [thing({ rotationDeg: 30, x0: 0, y0: 0, x1: size.w, y1: size.h })] }),
      ).parts,
    );
    // The corner of the box that is furthest east must be in the SOUTH half (plan y above the middle).
    let east = -Infinity;
    let eastY = 0;
    for (let i = 0; i < part.positions.length; i += 3)
      if (part.positions[i] > east) {
        east = part.positions[i];
        eastY = part.positions[i + 1];
      }
    expect(-eastY).toBeGreaterThan(size.h / 2);
    expect(east).toBeCloseTo(size.w, 6);
  });

  it('a stair is its steps, rising toward the plan south at no turn, as high as the storey', () => {
    const stair = {
      id: 's1',
      fromLevelId: 'ground',
      toLevelId: 'first',
      x: 3,
      y: 2,
      widthM: 1,
      runM: 3,
      rotation: 0,
    };
    const part = only(exportParts(solidsOf({ stairs: [{ stair, baseM: 0, riseM: 2.88 }] })).parts);
    const box = bounds(part);
    expect(box.max.z).toBeCloseTo(2.88, 6);
    expect(box.min.x).toBeCloseTo(2.5, 5);
    expect(box.max.x).toBeCloseTo(3.5, 5);
    expect(box.min.y).toBeCloseTo(-3.5, 6);
    expect(box.max.y).toBeCloseTo(-0.5, 6);
    // 16 steps of 0.18: the volume of the steps as they stand, each from the floor up.
    const steps = 16;
    expect(partVolumeM3(part.positions)).toBeCloseTo((1 * (3 / steps) * 2.88 * (steps + 1)) / 2, 4);
    // The highest corner is at the south end (plan y of 3.5).
    let top = { z: -Infinity, y: 0 };
    for (let i = 0; i < part.positions.length; i += 3)
      if (part.positions[i + 2] > top.z)
        top = { z: part.positions[i + 2], y: part.positions[i + 1] };
    expect(-top.y).toBeGreaterThan(3.3);
  });

  it('a flat roof is a slab over its outline with its overhang; a gable and a shed rise as the 3D view has them', () => {
    const config = {
      style: 'flat' as const,
      material: 'concrete' as const,
      pitchDeg: 25,
      overhangM: 0.2,
    };
    const flat = only(
      exportParts(solidsOf({ roofs: [{ polygon: ROOM, elevationM: 2.88, config, roomId: 'r1' }] }))
        .parts,
    );
    const surface = createRoofSurface(ROOM, 2.88, config)!;
    expect(flat.colourHex).toBe('#a9a69f');
    expect(partVolumeM3(flat.positions)).toBeCloseTo(6.4 * 4.4 * roofVerticalThickness(surface), 4);
    expect(openEdges(flat.positions)).toBe(0);
    for (const style of ['gable', 'shed'] as const) {
      const sloped = { ...config, style, material: 'tile' as const };
      const part = only(
        exportParts(solidsOf({ roofs: [{ polygon: ROOM, elevationM: 2.88, config: sloped }] }))
          .parts,
      );
      const s = createRoofSurface(ROOM, 2.88, sloped)!;
      expect(bounds(part).max.z, style).toBeCloseTo(roofMaximumHeight(s), 6);
      expect(bounds(part).min.z, style).toBeCloseTo(2.88, 6);
      // A covering of even thickness over the whole outline, whatever its slope.
      expect(partVolumeM3(part.positions), style).toBeCloseTo(
        6.4 * 4.4 * roofVerticalThickness(s),
        5,
      );
      expect(openEdges(part.positions), style).toBe(0);
    }
  });

  it('the garden: a surface is a thin slab, a fence a thin wall along its line', () => {
    const garden = {
      surfaces: [
        { id: 'g1', kind: 'lawn' as const, x: -4, y: -4, widthM: 3, depthM: 2, elevationM: 0 },
      ],
      fences: [{ id: 'f1', a: P(-5, 5), b: P(5, 5), heightM: 1.2, material: 'timber' as const }],
    };
    const { parts } = exportParts(solidsOf({ garden }));
    expect(parts.map((p) => p.name)).toEqual(['garden lawn g1', 'fence f1']);
    expect(partVolumeM3(parts[0].positions)).toBeCloseTo(3 * 2 * 0.05, 5);
    expect(partVolumeM3(parts[1].positions)).toBeCloseTo(10 * 0.06 * 1.2, 4);
    expect(bounds(parts[1]).max.z).toBeCloseTo(1.2, 5);
    expect(exportParts(solidsOf({ garden, gardenVisible: false })).parts).toHaveLength(0);
  });
});

describe('the two files', () => {
  const made = exportParts(
    solidsOf({
      floors: [{ key: 'floor-r1', roomId: 'r1', polygon: ROOM, hex: '#C8B79A' }],
      walls: [
        wall(ROOM[0], ROOM[1]),
        wall(ROOM[1], ROOM[2], { key: 'wall-r1-1', levelId: 'ground' }),
      ],
    }),
  ).parts;

  it('a glTF binary: its head, its two chunks, one node for each part, metres with y up', () => {
    const file = glbBytes(made, 'Test house');
    const view = new DataView(file.buffer);
    expect(view.getUint32(0, true)).toBe(0x46546c67);
    expect(view.getUint32(4, true)).toBe(2);
    expect(view.getUint32(8, true)).toBe(file.length);
    expect(file.length % 4).toBe(0);
    const jsonLength = view.getUint32(12, true);
    expect(view.getUint32(16, true)).toBe(0x4e4f534a);
    const json = JSON.parse(new TextDecoder().decode(file.subarray(20, 20 + jsonLength)));
    expect(json.asset.version).toBe('2.0');
    expect(json.scenes[0].name).toBe('Test house');
    expect(json.nodes.map((n: { name: string }) => n.name)).toEqual([
      'floor r1',
      'wall-r1-0',
      'wall-r1-1',
    ]);
    expect(json.nodes[2].extras).toEqual({ kind: 'wall', levelId: 'ground' });
    expect(json.nodes[0].extras).toEqual({ kind: 'floor', roomId: 'r1' });
    // Two colours, each once.
    expect(json.materials).toHaveLength(2);
    const binAt = 20 + jsonLength;
    expect(view.getUint32(binAt + 4, true)).toBe(0x004e4942);
    expect(json.buffers[0].byteLength).toBeLessThanOrEqual(view.getUint32(binAt, true));
    const triangles = made.reduce((n, p) => n + p.positions.length / 9, 0);
    expect(json.buffers[0].byteLength).toBe(triangles * 9 * 4 * 2);
    // The first wall: 2.7 m high along the file's y, 6 m along x, and its 0.14 m to the north is minus z.
    const position = json.accessors[json.meshes[1].primitives[0].attributes.POSITION];
    expect(position.min.map((n: number) => Math.round(n * 1e6) / 1e6)).toEqual([0, 0, -0.14]);
    expect(position.max.map((n: number) => Math.round(n * 1e6) / 1e6)).toEqual([6, 2.7, 0]);
    // Every normal has the length 1.
    const normal = json.accessors[json.meshes[1].primitives[0].attributes.NORMAL];
    const at = binAt + 8 + json.bufferViews[normal.bufferView].byteOffset;
    for (let i = 0; i < normal.count; i++) {
      const n = [0, 1, 2].map((k) => view.getFloat32(at + (i * 3 + k) * 4, true));
      expect(Math.hypot(n[0], n[1], n[2])).toBeCloseTo(1, 5);
    }
  });

  it('a glTF with nothing in it is still a file: a scene with no node', () => {
    const file = glbBytes([], 'Empty');
    const view = new DataView(file.buffer);
    expect(view.getUint32(8, true)).toBe(file.length);
    const json = JSON.parse(
      new TextDecoder().decode(file.subarray(20, 20 + view.getUint32(12, true))),
    );
    expect(json.scenes).toEqual([{ name: 'Empty', nodes: [] }]);
    expect('buffers' in json).toBe(false);
  });

  it('an STL for a 3D printer: binary, in millimetres, z up, every face with its outward side', () => {
    const file = stlBytes(made, 'Test house');
    const view = new DataView(file.buffer);
    const triangles = made.reduce((n, p) => n + p.positions.length / 9, 0);
    expect(view.getUint32(80, true)).toBe(triangles);
    expect(file.length).toBe(84 + triangles * 50);
    expect(new TextDecoder().decode(file.subarray(0, 5))).not.toBe('solid');
    let max = { x: -Infinity, y: -Infinity, z: -Infinity };
    let volume = 0;
    for (let t = 0; t < triangles; t++) {
      const at = 84 + t * 50;
      const f = (i: number) => view.getFloat32(at + i * 4, true);
      const n = [f(0), f(1), f(2)];
      expect(Math.hypot(n[0], n[1], n[2])).toBeCloseTo(1, 5);
      const [ax, ay, az, bx, by, bz, cx, cy, cz] = [3, 4, 5, 6, 7, 8, 9, 10, 11].map(f);
      volume +=
        (ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx)) / 6;
      max = {
        x: Math.max(max.x, ax, bx, cx),
        y: Math.max(max.y, ay, by, cy),
        z: Math.max(max.z, az, bz, cz),
      };
    }
    expect(max.z).toBeCloseTo(2700, 2);
    expect(max.x).toBeCloseTo(6140, 2);
    // Cubic millimetres: the same solids as in metres.
    const metres = made.reduce((sum, p) => sum + partVolumeM3(p.positions), 0);
    expect(volume / 1e9 / metres).toBeCloseTo(1, 5);
    // A model at 1 to 100.
    const small = new DataView(stlBytes(made, 'Test house', 0.01).buffer);
    expect(small.getFloat32(84 + 12, true)).toBeCloseTo(view.getFloat32(84 + 12, true) / 100, 4);
  });
});

describe('a whole house, from a design', () => {
  const rect = [P(0, 0), P(8, 0), P(8, 6), P(0, 6)];
  const house = (): Property =>
    ({
      id: 'house',
      name: 'House',
      wallHeightM: 3,
      activeRoomId: 'a',
      levels: [
        { id: 'ground', name: 'Ground', index: 0 },
        { id: 'first', name: 'First', index: 1 },
      ],
      rooms: [
        {
          id: 'a',
          name: 'Lower',
          polygon: rect,
          placedItems: [],
          openings: [
            {
              id: 'o1',
              edgeIndex: 0,
              offsetM: 2,
              widthM: 0.9,
              kind: 'door',
              flipFacing: false,
              flipHand: false,
            },
          ],
        },
        { id: 'b', name: 'Upper', levelId: 'first', polygon: rect, placedItems: [], openings: [] },
      ],
      stairs: [
        {
          id: 's1',
          fromLevelId: 'ground',
          toLevelId: 'first',
          x: 6,
          y: 3,
          widthM: 1,
          runM: 3,
          rotation: 0,
        },
      ],
    }) as unknown as Property;
  const scene = (p: Property): SceneInput =>
    ({
      wallHeightM: p.wallHeightM ?? 3,
      cameraPos: { x: 10, y: 10, z: 8 },
      cameraTarget: { x: 3, y: 3, z: 1 },
      rooms: roomsOnLevel(p.rooms, activeLevelIdOf(p)).map((r) => ({
        id: r.id,
        name: r.name,
        polygon: r.polygon,
        openings: r.openings,
        items: [],
      })),
    }) as unknown as SceneInput;

  it('two storeys with a stair and a roof: every part is there, at its height, and both files are made', () => {
    const visit = prepareWalkVisit(house(), scene);
    const { parts, notes } = exportParts(visit.solids);
    expect(notes).toEqual([]);
    const kinds = (kind: string) => parts.filter((p) => p.kind === kind);
    expect(kinds('wall')).toHaveLength(8);
    expect(kinds('stair')).toHaveLength(1);
    expect(kinds('floor').length).toBeGreaterThanOrEqual(2);
    expect(kinds('roof').length).toBeGreaterThanOrEqual(1);
    const numbers = modelNumbers(parts);
    // Two storeys of 3 m with a slab of 0.18 between and above them: the roof starts at 6.36.
    expect(numbers.max.z).toBeGreaterThan(6.36);
    expect(numbers.min.z).toBeCloseTo(-FLOOR_SLAB_THICKNESS_M, 6);
    expect(numbers.sizeM.x).toBeGreaterThanOrEqual(8.28 - 1e-6);
    // No face of any part is turned inside out, and the house is something: about 20 cubic metres of solid.
    for (const part of parts) expect(partVolumeM3(part.positions), part.name).toBeGreaterThan(0);
    const upper = parts.find((p) => p.kind === 'floor' && p.levelId === 'first')!;
    // The stair's hole is cut out of the upper floor.
    expect(partVolumeM3(upper.positions)).toBeCloseTo((48 - 3) * FLOOR_SLAB_THICKNESS_M, 4);
    expect(glbBytes(parts, 'House').length).toBeGreaterThan(1000);
    expect(stlBytes(parts, 'House').length).toBe(84 + numbers.triangles * 50);
  });
});
