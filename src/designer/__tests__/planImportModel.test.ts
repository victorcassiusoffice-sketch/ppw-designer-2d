import { describe, expect, it } from 'vitest';
import type { Property } from '../../store/propertyStore';
import type { SceneInput } from '../roomView3d';
import { activeLevelIdOf, roomsOnLevel } from '../levels';
import { prepareWalkVisit } from '../../walk/visit';
import { exportParts, glbBytes } from '../../components/three/exportModel';
import {
  reviewPlanImport,
  suggestPlanLayers,
  type PlanImportOptions,
  type PlanImportSource,
} from '../planImport';
import {
  MODEL_IMPORT_LIMITS,
  footprintOutlines,
  parsePlanModel,
  simplifyClosed,
} from '../planImportModel';

interface XY {
  x: number;
  y: number;
}
const P = (x: number, y: number): XY => ({ x, y });
/** A flat rectangle as two triangles on the plan, six numbers each. */
const rectangle = (x0: number, y0: number, x1: number, y1: number) => [
  x0,
  y0,
  x1,
  y0,
  x1,
  y1,
  x0,
  y0,
  x1,
  y1,
  x0,
  y1,
];
const turned = (flat: number[], degrees: number) => {
  const a = (degrees * Math.PI) / 180;
  const out: number[] = [];
  for (let i = 0; i < flat.length; i += 2)
    out.push(
      flat[i] * Math.cos(a) - flat[i + 1] * Math.sin(a),
      flat[i] * Math.sin(a) + flat[i + 1] * Math.cos(a),
    );
  return out;
};
const area = (points: XY[]) =>
  Math.abs(
    points.reduce((sum, p, i) => {
      const q = points[(i + 1) % points.length];
      return sum + p.x * q.y - q.x * p.y;
    }, 0) / 2,
  );
const box = (points: XY[]) => ({
  x0: Math.min(...points.map((p) => p.x)),
  x1: Math.max(...points.map((p) => p.x)),
  y0: Math.min(...points.map((p) => p.y)),
  y1: Math.max(...points.map((p) => p.y)),
});
const text = (value: string) => new TextEncoder().encode(value);
/** A box as an OBJ file: x from 0 to `x`, upward from 0 to `up`, z from 0 to `z`. Faces of four corners. */
const objBox = (x: number, up: number, z: number, dx = 0) => {
  const v = [
    [0, 0, 0],
    [x, 0, 0],
    [x, 0, z],
    [0, 0, z],
    [0, up, 0],
    [x, up, 0],
    [x, up, z],
    [0, up, z],
  ];
  return (
    v.map(([a, b, c]) => `v ${a + dx} ${b} ${c}`).join('\n') +
    '\nf 1 2 3 4\nf 5 8 7 6\nf 1 5 6 2\nf 2 6 7 3\nf 3 7 8 4\nf 4 8 5 1\n'
  );
};
const options = (source: PlanImportSource): PlanImportOptions => ({
  name: 'Model',
  metresPerUnit: 1,
  wallHeightM: 2.7,
  wallThicknessM: 0.1,
  layers: suggestPlanLayers(source),
});

describe('the outline of triangles seen from above', () => {
  it('a rectangle gives its four corners, within one cell', () => {
    const [outline, ...more] = footprintOutlines(rectangle(0, 0, 6, 4), 0.05);
    expect(more).toHaveLength(0);
    expect(outline).toHaveLength(4);
    expect(area(outline)).toBeCloseTo(24, 6);
    const b = box(outline);
    expect([b.x0, b.x1, b.y0, b.y1].map((n) => Math.round(n * 1e6) / 1e6)).toEqual([0, 6, 0, 4]);
  });

  it('two parts that do not touch give two outlines, the larger first', () => {
    const outlines = footprintOutlines(
      [...rectangle(10, 0, 12, 2), ...rectangle(0, 0, 6, 4)],
      0.05,
    );
    expect(outlines.map((o) => Math.round(area(o)))).toEqual([24, 4]);
  });

  it('an L of two rectangles is one outline of six corners', () => {
    const [outline, ...more] = footprintOutlines(
      [...rectangle(0, 0, 6, 2), ...rectangle(0, 2, 2, 5)],
      0.05,
    );
    expect(more).toHaveLength(0);
    expect(outline).toHaveLength(6);
    expect(area(outline)).toBeCloseTo(12 + 6, 6);
  });

  it('a rectangle that is turned comes out with straight sides, not as steps', () => {
    const [outline] = footprintOutlines(turned(rectangle(0, 0, 6, 4), 30), 0.05);
    expect(outline.length).toBeGreaterThanOrEqual(4);
    expect(outline.length).toBeLessThanOrEqual(8);
    expect(area(outline) / 24).toBeCloseTo(1, 1);
  });

  it('a part under one square metre is left out, unless it is asked for', () => {
    const flat = [...rectangle(0, 0, 6, 4), ...rectangle(10, 0, 10.5, 0.5)];
    expect(footprintOutlines(flat, 0.05)).toHaveLength(1);
    expect(footprintOutlines(flat, 0.05, 0)).toHaveLength(2);
  });

  it('a face seen edge-on, as a wall is from above, covers nothing', () => {
    expect(footprintOutlines([0, 0, 6, 0, 6, 0, 0, 0, 6, 0, 0, 0], 0.05, 0)).toEqual([]);
    expect(footprintOutlines([], 0.05)).toEqual([]);
  });

  it('a hole inside a part does not break its outline', () => {
    // A frame: a square of 6 with a square hole of 2 in its middle, as four rectangles.
    const frame = [
      ...rectangle(0, 0, 6, 2),
      ...rectangle(0, 4, 6, 6),
      ...rectangle(0, 2, 2, 4),
      ...rectangle(4, 2, 6, 4),
    ];
    const [outline, ...more] = footprintOutlines(frame, 0.05);
    expect(more).toHaveLength(0);
    expect(outline).toHaveLength(4);
    expect(area(outline)).toBeCloseTo(36, 6);
  });

  it('points on a straight side are taken out of a closed line', () => {
    const square = [P(0, 0), P(1, 0), P(2, 0), P(2, 1), P(2, 2), P(1, 2), P(0, 2), P(0, 1)];
    expect(simplifyClosed(square, 0.01)).toHaveLength(4);
  });
});

describe('a 3D model read as a plan', () => {
  it('an OBJ box becomes one room of its outline; its height is said', () => {
    const source = parsePlanModel('box.obj', text(objBox(6, 2.5, 4)));
    expect(source.format).toBe('model');
    expect(source.name).toBe('box');
    expect(source.shapes).toHaveLength(1);
    const b = box(source.shapes[0].points);
    expect([b.x0, b.x1, b.y0, b.y1].map((n) => Math.round(n * 100) / 100)).toEqual([0, 6, 0, 4]);
    expect(suggestPlanLayers(source)).toEqual([{ name: 'Model outline', role: 'rooms', floor: 0 }]);
    const words = source.warnings.join(' ');
    expect(words).toContain('becomes one room');
    expect(words).toContain('The model is 2.50 m high');
    expect(words).toContain('read in metres with y upward');
    const review = reviewPlanImport(source, options(source));
    expect(review.roomCount).toBe(1);
    expect(review.areaM2).toBeCloseTo(24, 1);
  });

  it('an OBJ file with texture and normal numbers, and with numbers counted from the end, is read the same', () => {
    const plain = parsePlanModel(
      'a.obj',
      text('v 0 0 0\nv 3 0 0\nv 3 0 3\nv 0 0 3\nf 1 2 3\nf 1 3 4\n'),
    );
    const rich = parsePlanModel(
      'b.obj',
      text(
        'v 0 0 0\nv 3 0 0\nv 3 0 3\nv 0 0 3\nvt 0 0\nvn 0 1 0\nf 1/1/1 2/1/1 3/1/1\nf -4//1 -2//1 -1//1\n',
      ),
    );
    expect(rich.shapes[0].points).toEqual(plain.shapes[0].points);
  });

  it('two buildings in one model become two rooms', () => {
    const source = parsePlanModel(
      'two.obj',
      text(
        objBox(6, 3, 4) +
          objBox(3, 3, 3, 20).replace(
            /^f (.*)$/gm,
            (_, f: string) =>
              `f ${f
                .split(' ')
                .map((n) => Number(n) + 8)
                .join(' ')}`,
          ),
      ),
    );
    expect(source.shapes).toHaveLength(2);
    expect(source.warnings.join(' ')).toContain('becomes 2 rooms');
  });

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
        { id: 'a', name: 'Lower', polygon: rect, placedItems: [], openings: [] },
        {
          id: 'b',
          name: 'Upper',
          levelId: 'first',
          polygon: [P(0, 0), P(5, 0), P(5, 6), P(0, 6)],
          placedItems: [],
          openings: [],
        },
      ],
      garden: {
        surfaces: [{ id: 'g1', kind: 'lawn', x: -5, y: 7, widthM: 20, depthM: 5, elevationM: 0 }],
        fences: [],
      },
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

  it('a 3D file this app saved gives its rooms back, storey by storey, and nothing of its garden or its roof', () => {
    const { parts } = exportParts(prepareWalkVisit(house(), scene).solids);
    const source = parsePlanModel('house.glb', glbBytes(parts, 'House'));
    expect(suggestPlanLayers(source)).toEqual([
      { name: 'Ground floor: rooms', role: 'rooms', floor: 0 },
      { name: 'Floor 1: rooms', role: 'rooms', floor: 1 },
    ]);
    const ground = source.shapes.filter((s) => s.layer === 'Ground floor: rooms');
    const upper = source.shapes.filter((s) => s.layer === 'Floor 1: rooms');
    expect(ground).toHaveLength(1);
    expect(upper).toHaveLength(1);
    expect(area(ground[0].points) / 48).toBeCloseTo(1, 1);
    expect(area(upper[0].points) / 30).toBeCloseTo(1, 1);
    const b = box(ground[0].points);
    expect([b.x0, b.x1, b.y0, b.y1].map((n) => Math.round(n * 10) / 10)).toEqual([0, 8, 0, 6]);
    expect(source.warnings.join(' ')).toContain('A 3D file saved by this app');
    const review = reviewPlanImport(source, options(source));
    expect(review.roomCount).toBe(2);
    expect(
      review.property.rooms.filter((r) => r.levelId === 'import-floor-1' && r.polygon.length >= 3),
    ).toHaveLength(1);
  });

  it('what cannot be read is refused in words', () => {
    expect(() =>
      parsePlanModel('a.glb', text('not a model, only words that are long enough')),
    ).toThrow(/not a glTF binary file/);
    expect(() => parsePlanModel('a.fbx', text('x'))).toThrow(/\.glb or an \.obj/);
    expect(() => parsePlanModel('a.obj', text('v 0 0 0\nf 1 2 3\n'))).toThrow(
      /names a point it does not have/,
    );
    expect(() => parsePlanModel('a.obj', text('# nothing here\n'))).toThrow(
      /No face could be read/,
    );
    expect(() => parsePlanModel('a.obj', new Uint8Array(MODEL_IMPORT_LIMITS.bytes + 1))).toThrow(
      /smaller than 25 MB/,
    );
    // A model packed with a method this reader does not have.
    const json = text(
      JSON.stringify({
        asset: { version: '2.0' },
        extensionsRequired: ['KHR_draco_mesh_compression'],
      }),
    );
    const padded = new Uint8Array(Math.ceil(json.length / 4) * 4).fill(0x20);
    padded.set(json);
    const glb = new Uint8Array(20 + padded.length);
    const view = new DataView(glb.buffer);
    view.setUint32(0, 0x46546c67, true);
    view.setUint32(4, 2, true);
    view.setUint32(8, glb.length, true);
    view.setUint32(12, padded.length, true);
    view.setUint32(16, 0x4e4f534a, true);
    glb.set(padded, 20);
    expect(() => parsePlanModel('a.glb', glb)).toThrow(/packed/);
  });
});
