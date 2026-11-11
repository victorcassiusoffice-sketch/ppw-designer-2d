import { describe, it, expect } from 'vitest';
import {
  appendFace,
  appendWire,
  detectFace,
  distance3,
  faceLoop,
  rayPlane,
  validComponents,
  type BoundaryComponent,
  type Point3,
} from '../boundaryModel';
import { indexGeometry, snapEntity } from '../entitySnapping';
const p = (x: number, y: number, z = 0) => ({ x, y, z });
const blank = (): BoundaryComponent => ({
  id: 'part',
  name: 'Part',
  vertices: [],
  edges: [],
  faces: [],
});
const square = [p(0, 0), p(4, 0), p(4, 4), p(0, 4)];
describe('measured boundary components', () => {
  it('detects vertical and oblique planes and preserves area, centroid and winding', () => {
    const loop = [p(6, 1, 2), p(6, 4, 2), p(6, 4, 6), p(6, 1, 6)];
    const face = detectFace(loop);
    expect(face.plane).toBe('YZ');
    expect(face.area).toBe(12);
    expect(face.centre).toEqual(p(6, 2.5, 4));
    expect(detectFace([...loop].reverse()).winding).not.toBe(face.winding);
    const incline = square.map((v) => ({ ...v, z: v.x / 2 + 3 }));
    expect(detectFace(incline).area).toBeCloseTo(16 * Math.sqrt(1.25));
  });
  it('rejects warped, crossing, degenerate, and overlapping loops before storing them', () => {
    for (const bad of [
      [p(0, 0), p(3, 0), p(3, 3, 0.02), p(0, 3)],
      [p(0, 0), p(4, 4), p(1, 4), p(3, 0)],
      [p(0, 0), p(2, 0), p(3, 0)],
      [p(0, 0), p(3, 0), p(2, 0), p(2, 2)],
    ])
      expect(() => detectFace(bad)).toThrow();
  });
  it('joins two adjacent faces with a single shared edge and rejects dangling topology', () => {
    const base = appendFace(blank(), square);
    const joined = appendFace(base, [square[1], p(7, 0), p(7, 4), square[2]]);
    expect(joined.vertices).toHaveLength(6);
    expect(joined.edges).toHaveLength(7);
    expect(base.vertices).toHaveLength(4);
    expect(joined.faces[1]).toContain(-2);
    expect(validComponents([joined])).toBe(true);
    expect(validComponents([{ ...joined, faces: [[1, 3, 4]] }])).toBe(false);
    expect(() => appendFace(base, [...square].reverse())).toThrow();
    expect(faceLoop(joined, joined.faces[1])[0]).toEqual(square[1]);
  });
  it('keeps unfinished wires and uses them when closing a face later', () => {
    const wire = appendWire(blank(), square.slice(0, 2));
    expect(validComponents([wire])).toBe(true);
    const part = appendFace(wire, square);
    expect(part.edges).toHaveLength(4);
    expect(part.faces).toHaveLength(1);
  });
  it('snaps to endpoints, midpoints, centres, face interiors and true 3D intersections', () => {
    const index = indexGeometry([appendFace(blank(), square)]);
    expect(snapEntity(p(0.01, 0), index, 0.1)?.kind).toBe('endpoint');
    expect(snapEntity(p(2, 0), index, 0.1)?.kind).toBe('midpoint');
    expect(snapEntity(p(2, 2), index, 0.1)?.kind).toBe('center');
    expect(snapEntity(p(1, 2, 0.025), index, 0.1)).toEqual({ kind: 'on-face', point: p(1, 2) });
    const edges = [
      { a: p(0, 1), b: p(5, 1) },
      { a: p(1, 0), b: p(1, 3) },
    ];
    expect(snapEntity(p(1.02, 1), indexGeometry([], edges), 0.1)?.kind).toBe('intersection');
    expect(
      snapEntity(
        p(1, 1),
        indexGeometry([], [edges[0], { a: p(1, 0, 0.05), b: p(1, 3, 0.05) }]),
        0.1,
      ),
    ).toBeNull();
  });
  it('rejects backwards and parallel rays and snaps boundaries without an area jump', () => {
    expect(rayPlane(p(0, 0, 4), p(0, 0, 1), p(0, 0), p(0, 0, 1))).toBeNull();
    expect(rayPlane(p(0, 0, 4), p(1, 0), p(0, 0), p(0, 0, 1))).toBeNull();
    const hit = rayPlane(p(1, 2, 4), p(0, 0, -1), p(0, 0), p(0, 0, 1)) as Point3;
    expect(distance3(hit, p(1, 2))).toBe(0);
  });
});
