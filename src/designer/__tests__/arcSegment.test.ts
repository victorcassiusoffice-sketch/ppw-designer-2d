import { describe, expect, it } from 'vitest';
import {
  BULGE_MAX,
  WALL_ARC_LIMIT,
  arcGeometry,
  bulgeFromRadius,
  bulgeThrough,
  chordLengthM,
  cleanBulge,
  cleanWallArcs,
  pointOnSegment,
  segmentLengthM,
  segmentPoints,
  type XY,
} from '../arcSegment';

const P = (x: number, y: number): XY => ({ x, y });
const near = (got: XY, want: XY, digits = 9) => {
  expect(got.x).toBeCloseTo(want.x, digits);
  expect(got.y).toBeCloseTo(want.y, digits);
};
const dist = (a: XY, b: XY) => Math.hypot(a.x - b.x, a.y - b.y);

/** A few segments of every kind: short and long, at odd angles, bowing to both sides, shallow and deep. */
const CASES: { a: XY; b: XY; bulge: number }[] = [
  { a: P(0, 0), b: P(2, 0), bulge: 0.5 },
  { a: P(0, 0), b: P(2, 0), bulge: -0.5 },
  { a: P(1, 0), b: P(-1, 0), bulge: 1 },
  { a: P(3.2, -1.5), b: P(-4.1, 7.75), bulge: 0.08 },
  { a: P(-12.5, 4), b: P(-12.5, 9.3), bulge: -2.4 },
  { a: P(0.01, 0.02), b: P(0.07, -0.03), bulge: 6 },
  { a: P(100, 250), b: P(130, 210), bulge: -0.001 },
];

describe('a straight wall', () => {
  it('is what a bulge that is absent, zero, tiny, out of range or not a number gives', () => {
    for (const value of [
      undefined,
      null,
      0,
      -0,
      1e-9,
      -1e-7,
      BULGE_MAX + 0.001,
      -50,
      NaN,
      Infinity,
      '1',
      {},
    ])
      expect(cleanBulge(value), String(value)).toBeUndefined();
    expect(cleanBulge(0.25)).toBe(0.25);
    expect(cleanBulge(-BULGE_MAX)).toBe(-BULGE_MAX);
  });

  it('has no arc, the length of its chord, and its two ends as points', () => {
    const a = P(1, 2);
    const b = P(4, 6);
    expect(arcGeometry(a, b, undefined)).toBeUndefined();
    expect(arcGeometry(a, b, 0)).toBeUndefined();
    expect(arcGeometry(a, a, 0.5)).toBeUndefined();
    expect(segmentLengthM(a, b)).toBe(5);
    expect(chordLengthM(a, b)).toBe(5);
    expect(segmentPoints(a, b)).toEqual([a, b]);
    near(pointOnSegment(a, b, undefined, 0.5), P(2.5, 4));
  });
});

describe('an arc, worked out from its two ends and its bulge', () => {
  it('a bulge of 1 is a half circle', () => {
    const arc = arcGeometry(P(1, 0), P(-1, 0), 1)!;
    near(arc.centre, P(0, 0));
    expect(arc.radiusM).toBeCloseTo(1, 12);
    expect(arc.sweep).toBeCloseTo(Math.PI, 12);
    expect(arc.lengthM).toBeCloseTo(Math.PI, 12);
    near(arc.middle, P(0, 1));
    expect(arc.sagittaM).toBeCloseTo(1, 12);
  });

  it('a quarter circle of radius 1 is a quarter of its circle long', () => {
    const arc = arcGeometry(P(1, 0), P(0, 1), Math.tan(Math.PI / 8))!;
    near(arc.centre, P(0, 0));
    expect(arc.radiusM).toBeCloseTo(1, 12);
    expect(arc.lengthM).toBeCloseTo(Math.PI / 2, 12);
  });

  it('the other sign bows to the other side', () => {
    near(arcGeometry(P(0, 0), P(2, 0), 0.5)!.middle, P(1, -0.5));
    near(arcGeometry(P(0, 0), P(2, 0), -0.5)!.middle, P(1, 0.5));
  });

  it('keeps the rule of the format: the middle is the chord middle plus (bulge / 2) (dy, -dx)', () => {
    for (const { a, b, bulge } of CASES) {
      const arc = arcGeometry(a, b, bulge)!;
      near(arc.middle, {
        x: (a.x + b.x) / 2 + (bulge / 2) * (b.y - a.y),
        y: (a.y + b.y) / 2 - (bulge / 2) * (b.x - a.x),
      });
    }
  });

  it('both ends and the middle lie on its circle, and it ends at b', () => {
    for (const { a, b, bulge } of CASES) {
      const arc = arcGeometry(a, b, bulge)!;
      const scale = Math.max(1, arc.radiusM);
      for (const point of [a, b, arc.middle])
        expect(dist(point, arc.centre) / scale).toBeCloseTo(arc.radiusM / scale, 9);
      near(pointOnSegment(a, b, bulge, 0), a, 7);
      near(pointOnSegment(a, b, bulge, 1), b, 7);
      near(pointOnSegment(a, b, bulge, 0.5), arc.middle, 7);
      expect(Math.sign(arc.sweep)).toBe(Math.sign(bulge));
      expect(Math.abs(arc.sweep)).toBeLessThan(2 * Math.PI);
      expect(arc.sagittaM).toBeCloseTo((Math.abs(bulge) * chordLengthM(a, b)) / 2, 12);
    }
  });

  it('is as long as the many short lines laid along it', () => {
    for (const { a, b, bulge } of CASES) {
      let walked = 0;
      let previous = a;
      for (let i = 1; i <= 4000; i++) {
        const point = pointOnSegment(a, b, bulge, i / 4000);
        walked += dist(previous, point);
        previous = point;
      }
      const length = segmentLengthM(a, b, bulge);
      expect(walked / length).toBeCloseTo(1, 5);
      expect(length).toBeGreaterThan(chordLengthM(a, b));
    }
  });
});

describe('what may be done to a wall without changing its bulge, and what changes its sign', () => {
  const turned = (p: XY, angle: number, by: XY, scale: number): XY => ({
    x: (p.x * Math.cos(angle) - p.y * Math.sin(angle)) * scale + by.x,
    y: (p.x * Math.sin(angle) + p.y * Math.cos(angle)) * scale + by.y,
  });

  it('moving, turning and scaling the plan leave the number as it is', () => {
    for (const { a, b, bulge } of CASES) {
      const before = arcGeometry(a, b, bulge)!;
      const move = (p: XY) => turned(p, 0.83, P(17, -42), 2.5);
      const after = arcGeometry(move(a), move(b), bulge)!;
      near(after.middle, move(before.middle), 6);
      near(after.centre, move(before.centre), 6);
      expect(after.radiusM / before.radiusM).toBeCloseTo(2.5, 9);
    }
  });

  it('an end that is moved leaves a sound arc: the same turn on the new ends', () => {
    const { a, b, bulge } = CASES[0];
    const moved = P(b.x + 3, b.y - 1.5);
    const before = arcGeometry(a, b, bulge)!;
    const after = arcGeometry(a, moved, bulge)!;
    expect(after.sweep).toBeCloseTo(before.sweep, 12);
    expect(dist(a, after.centre)).toBeCloseTo(after.radiusM, 9);
    expect(dist(moved, after.centre)).toBeCloseTo(after.radiusM, 9);
  });

  it('a wall taken from b to a is the same arc with the other sign', () => {
    for (const { a, b, bulge } of CASES) {
      const one = arcGeometry(a, b, bulge)!;
      const other = arcGeometry(b, a, -bulge)!;
      near(other.middle, one.middle, 7);
      near(other.centre, one.centre, 6);
      expect(other.lengthM).toBeCloseTo(one.lengthM, 9);
    }
  });

  it('a mirrored plan (y the other way, as a drawing with y upward has it) changes the sign', () => {
    const mirror = (p: XY) => P(p.x, -p.y);
    for (const { a, b, bulge } of CASES) {
      const here = arcGeometry(a, b, bulge)!;
      const there = arcGeometry(mirror(a), mirror(b), -bulge)!;
      near(there.middle, mirror(here.middle), 7);
    }
  });
});

describe('the bulge from what a person or a drawing gives', () => {
  it('from a point the arc passes through', () => {
    for (const { a, b, bulge } of CASES) {
      for (const t of [0.5, 0.2, 0.9]) {
        const through = pointOnSegment(a, b, bulge, t);
        expect(bulgeThrough(a, through, b)! / bulge).toBeCloseTo(1, 4);
      }
    }
  });

  it('nothing for three points on one line, or two of them in one place', () => {
    expect(bulgeThrough(P(0, 0), P(1, 0), P(2, 0))).toBeUndefined();
    expect(bulgeThrough(P(0, 0), P(5, 0), P(2, 0))).toBeUndefined();
    expect(bulgeThrough(P(0, 0), P(0, 0), P(2, 0))).toBeUndefined();
    expect(bulgeThrough(P(1, 1), P(3, 4), P(1, 1))).toBeUndefined();
  });

  it('from a radius, on either side, the short way round or the long way', () => {
    expect(bulgeFromRadius(2, 1)).toBeCloseTo(1, 12);
    expect(bulgeFromRadius(2, 1.25)).toBeCloseTo(0.5, 12);
    expect(bulgeFromRadius(2, 1.25, -1)).toBeCloseTo(-0.5, 12);
    expect(bulgeFromRadius(2, 1.25, 1, true)).toBeCloseTo(2, 12);
    // And back: the arc made with that bulge has that radius.
    expect(arcGeometry(P(0, 0), P(2, 0), bulgeFromRadius(2, 3.7))!.radiusM).toBeCloseTo(3.7, 12);
    expect(arcGeometry(P(0, 0), P(2, 0), bulgeFromRadius(2, 3.7, 1, true))!.radiusM).toBeCloseTo(
      3.7,
      12,
    );
  });

  it('nothing for a radius shorter than half the chord, or a length that is not a length', () => {
    expect(bulgeFromRadius(2, 0.99)).toBeUndefined();
    expect(bulgeFromRadius(0, 1)).toBeUndefined();
    expect(bulgeFromRadius(2, -1)).toBeUndefined();
    expect(bulgeFromRadius(NaN, 1)).toBeUndefined();
  });
});

describe('an arc as straight pieces, for a reader that draws lines', () => {
  it('starts and ends on the ends, stays on the circle, and stands off the arc by less than asked', () => {
    for (const { a, b, bulge } of CASES) {
      for (const tolerance of [0.05, 0.005, 0.0005]) {
        const arc = arcGeometry(a, b, bulge)!;
        const points = segmentPoints(a, b, bulge, tolerance);
        expect(points[0]).toEqual(a);
        expect(points[points.length - 1]).toEqual(b);
        expect(points.length).toBeGreaterThanOrEqual(3);
        expect(points.length).toBeLessThanOrEqual(257);
        const scale = Math.max(1, arc.radiusM);
        for (const point of points)
          expect(dist(point, arc.centre) / scale).toBeCloseTo(arc.radiusM / scale, 7);
        if (points.length < 257) {
          for (let i = 1; i < points.length; i++) {
            const middle = P(
              (points[i - 1].x + points[i].x) / 2,
              (points[i - 1].y + points[i].y) / 2,
            );
            expect(arc.radiusM - dist(middle, arc.centre)).toBeLessThanOrEqual(
              Math.min(tolerance, arc.radiusM) + 1e-9,
            );
          }
        }
      }
    }
  });

  it('gives new points each time, never the ends themselves', () => {
    const a = P(0, 0);
    const b = P(2, 0);
    const points = segmentPoints(a, b, 0.5);
    expect(points[0]).not.toBe(a);
    expect(points[points.length - 1]).not.toBe(b);
    expect(segmentPoints(a, b)[0]).not.toBe(a);
  });
});

describe("a room's curved edges, cleaned", () => {
  it('keeps whole edge numbers of the outline with a bulge in range, one for each edge', () => {
    expect(
      cleanWallArcs(
        [
          { edgeIndex: 1, bulge: 0.5 },
          { edgeIndex: 1, bulge: 0.9 }, // the edge has one already
          { edgeIndex: 4, bulge: 0.5 }, // no such edge
          { edgeIndex: 2.5, bulge: 0.5 },
          { edgeIndex: -1, bulge: 0.5 },
          { edgeIndex: 0, bulge: 0 }, // a straight wall
          { edgeIndex: 3, bulge: 'x' },
          { edgeIndex: 2, bulge: -0.25, madeUp: true },
          null,
          'text',
        ],
        4,
      ),
    ).toEqual([
      { edgeIndex: 1, bulge: 0.5 },
      { edgeIndex: 2, bulge: -0.25 },
    ]);
  });

  it('is nothing when nothing is left, or when it is not a list, or the outline is no outline', () => {
    expect(cleanWallArcs([], 4)).toBeUndefined();
    expect(cleanWallArcs([{ edgeIndex: 0, bulge: 0 }], 4)).toBeUndefined();
    expect(cleanWallArcs('x', 4)).toBeUndefined();
    expect(cleanWallArcs({ edgeIndex: 0, bulge: 1 }, 4)).toBeUndefined();
    expect(cleanWallArcs([{ edgeIndex: 0, bulge: 1 }], 2)).toBeUndefined();
  });

  it('follows the edges across a clean-up of the outline', () => {
    // Five corners, one a double: edge 2 is gone, the edges after it move down by one.
    const edgeMap = [0, 1, -1, 2, 3];
    expect(
      cleanWallArcs(
        [
          { edgeIndex: 0, bulge: 0.5 },
          { edgeIndex: 2, bulge: 0.7 },
          { edgeIndex: 4, bulge: -0.3 },
          { edgeIndex: 5, bulge: 0.2 }, // the old outline had no edge 5
        ],
        4,
        edgeMap,
      ),
    ).toEqual([
      { edgeIndex: 0, bulge: 0.5 },
      { edgeIndex: 3, bulge: -0.3 },
    ]);
  });

  it('an outline turned round keeps each arc on its wall, bowing to the same side', () => {
    // A square drawn the other way round: its corners in the new order, and where each old edge went.
    const drawn = [P(0, 0), P(0, 4), P(6, 4), P(6, 0)];
    const cleaned = [drawn[0], drawn[3], drawn[2], drawn[1]];
    const edgeMap = [3, 2, 1, 0];
    const arcs = cleanWallArcs([{ edgeIndex: 1, bulge: 0.4 }], 4, edgeMap, true)!;
    expect(arcs).toEqual([{ edgeIndex: 2, bulge: -0.4 }]);
    // The same wall in the world: the middle of the arc has not moved.
    const before = arcGeometry(drawn[1], drawn[2], 0.4)!;
    const edge = arcs[0].edgeIndex;
    const after = arcGeometry(cleaned[edge], cleaned[(edge + 1) % 4], arcs[0].bulge)!;
    near(after.middle, before.middle);
    near(after.centre, before.centre);
  });

  it('keeps no more than its limit', () => {
    const many = Array.from({ length: WALL_ARC_LIMIT + 50 }, (_, i) => ({
      edgeIndex: i,
      bulge: 0.1,
    }));
    expect(cleanWallArcs(many, WALL_ARC_LIMIT + 50)).toHaveLength(WALL_ARC_LIMIT);
  });
});
