import { describe, expect, it } from 'vitest';
import {
  parsePlanFile,
  reviewPlanImport,
  suggestPlanLayers,
  type PlanImportOptions,
  type PlanImportSource,
} from '../planImport';
import { normaliseLoadedProperty } from '../../store/propertyStore';
import { arcGeometry, type WallArc } from '../arcSegment';

const dxf = (entities: string, unit = 6) =>
  `0\nSECTION\n2\nHEADER\n9\n$INSUNITS\n70\n${unit}\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n${entities}0\nENDSEC\n0\nEOF\n`;
/** A light polyline: each vertex is x, y and, when it has one, the bulge of the segment that leaves it. */
const poly = (vertices: number[][], layer: string, closed = true) =>
  `0\nLWPOLYLINE\n8\n${layer}\n90\n${vertices.length}\n70\n${closed ? 1 : 0}\n${vertices
    .map(([x, y, bulge]) => `10\n${x}\n20\n${y}\n${bulge ? `42\n${bulge}\n` : ''}`)
    .join('')}`;
const oldPoly = (vertices: number[][], layer: string) =>
  `0\nPOLYLINE\n8\n${layer}\n66\n1\n70\n1\n${vertices
    .map(
      ([x, y, bulge]) =>
        `0\nVERTEX\n8\n${layer}\n10\n${x}\n20\n${y}\n${bulge ? `42\n${bulge}\n` : ''}`,
    )
    .join('')}0\nSEQEND\n`;
const arc = (cx: number, cy: number, r: number, from: number, to: number, layer = 'Walls') =>
  `0\nARC\n8\n${layer}\n10\n${cx}\n20\n${cy}\n40\n${r}\n50\n${from}\n51\n${to}\n`;
const circle = (cx: number, cy: number, r: number, layer = 'Rooms') =>
  `0\nCIRCLE\n8\n${layer}\n10\n${cx}\n20\n${cy}\n40\n${r}\n`;
const near = (got: { x: number; y: number }, want: { x: number; y: number }, digits = 9) => {
  expect(got.x).toBeCloseTo(want.x, digits);
  expect(got.y).toBeCloseTo(want.y, digits);
};
const options = (
  source: PlanImportSource,
  more: Partial<PlanImportOptions> = {},
): PlanImportOptions => ({
  name: 'Curved plan',
  metresPerUnit: 1,
  wallHeightM: 2.7,
  wallThicknessM: 0.1,
  layers: suggestPlanLayers(source).map((layer) => ({
    ...layer,
    role: layer.name === 'Rooms' ? 'rooms' : layer.name === 'Walls' ? 'walls' : 'skip',
  })),
  ...more,
});

describe("a drawing's arcs come in as true arcs", () => {
  it("a polyline's bulge is kept with its segment; its sign is turned with the drawing's y", () => {
    const source = parsePlanFile(
      'a.dxf',
      dxf(
        poly(
          [
            [0, 0, 0.5],
            [6, 0],
            [6, 4],
            [0, 4],
          ],
          'Rooms',
        ),
      ),
    );
    const [shape] = source.shapes;
    expect(shape.points).toEqual([
      { x: 0, y: -0 },
      { x: 6, y: -0 },
      { x: 6, y: -4 },
      { x: 0, y: -4 },
    ]);
    expect(shape.bulges).toEqual([-0.5, 0, 0, 0]);
    // The same wall in the world: in the drawing the arc on the lower side bows downward, to y = -1.5.
    const middle = arcGeometry(shape.points[0], shape.points[1], shape.bulges![0])!.middle;
    near(middle, { x: 3, y: 1.5 });
  });

  it('a straight polyline has no curves at all, as before', () => {
    const source = parsePlanFile(
      'a.dxf',
      dxf(
        poly(
          [
            [0, 0],
            [6, 0],
            [6, 4],
            [0, 4],
          ],
          'Rooms',
        ),
      ),
    );
    expect('bulges' in source.shapes[0]).toBe(false);
  });

  it('the older kind of polyline, with its vertices as entities, keeps its bulges too', () => {
    const source = parsePlanFile(
      'a.dxf',
      dxf(
        oldPoly(
          [
            [0, 0],
            [6, 0, -0.25],
            [6, 4],
            [0, 4],
          ],
          'Rooms',
        ),
      ),
    );
    expect(source.shapes[0].bulges).toEqual([0, 0.25, 0, 0]);
    expect(source.shapes[0].closed).toBe(true);
  });

  it('an ARC is one curved segment from its start angle to its end angle, on its circle', () => {
    const source = parsePlanFile('a.dxf', dxf(arc(10, 5, 2, 30, 150)));
    const [shape] = source.shapes;
    expect(shape.closed).toBe(false);
    expect(shape.points).toHaveLength(2);
    const made = arcGeometry(shape.points[0], shape.points[1], shape.bulges![0])!;
    // The drawing's own circle, turned over in y.
    near(made.centre, { x: 10, y: -5 });
    expect(made.radiusM).toBeCloseTo(2, 9);
    expect(Math.abs(made.sweep)).toBeCloseTo((120 * Math.PI) / 180, 9);
    // The middle of the arc is at 90 degrees of the drawing: straight above its centre there.
    near(made.middle, { x: 10, y: -7 });
  });

  it('an ARC that runs through the angle 0 turns the short way it was drawn, not the rest of the circle', () => {
    const source = parsePlanFile('a.dxf', dxf(arc(0, 0, 3, 300, 60)));
    const [shape] = source.shapes;
    const made = arcGeometry(shape.points[0], shape.points[1], shape.bulges![0])!;
    expect(Math.abs(made.sweep)).toBeCloseTo((120 * Math.PI) / 180, 9);
    near(made.middle, { x: 3, y: 0 });
  });

  it('a CIRCLE is a closed outline of four quarter arcs on its circle', () => {
    const source = parsePlanFile('a.dxf', dxf(circle(4, 3, 2.5)));
    const [shape] = source.shapes;
    expect(shape.closed).toBe(true);
    expect(shape.points).toHaveLength(4);
    let length = 0;
    for (let i = 0; i < 4; i++) {
      const made = arcGeometry(shape.points[i], shape.points[(i + 1) % 4], shape.bulges![i])!;
      near(made.centre, { x: 4, y: -3 });
      expect(made.radiusM).toBeCloseTo(2.5, 9);
      length += made.lengthM;
    }
    expect(length).toBeCloseTo(2 * Math.PI * 2.5, 9);
  });

  it('what is no arc is skipped and counted: a full turn, a circle off the plan', () => {
    const source = parsePlanFile(
      'a.dxf',
      dxf(
        poly(
          [
            [0, 0],
            [6, 0],
            [6, 4],
            [0, 4],
          ],
          'Rooms',
        ) +
          arc(0, 0, 2, 10, 10) +
          `0\nCIRCLE\n8\nRooms\n10\n0\n20\n0\n30\n3\n40\n2\n`,
      ),
    );
    expect(source.shapes).toHaveLength(1);
    expect(source.warnings.join(' ')).toContain('arcs of a full turn or of no turn');
    expect(source.warnings.join(' ')).toContain('3D circles');
  });
});

describe('a curved drawing becomes a design', () => {
  type Loose = Record<string, unknown>;

  it("a room's curved edge is its `wallArcs`, and stays on its wall when the app tidies the outline", () => {
    const source = parsePlanFile(
      'a.dxf',
      dxf(
        poly(
          [
            [0, 0, 0.5],
            [6, 0],
            [6, 4],
            [0, 4],
          ],
          'Rooms',
        ),
      ),
    );
    const review = reviewPlanImport(source, options(source));
    const room = review.property.rooms.find((r) => r.polygon.length >= 3)!;
    expect(room.wallArcs).toHaveLength(1);
    const where = (r: { polygon: { x: number; y: number }[]; wallArcs?: WallArc[] }) => {
      const a = r.wallArcs![0];
      return arcGeometry(
        r.polygon[a.edgeIndex],
        r.polygon[(a.edgeIndex + 1) % r.polygon.length],
        a.bulge,
      )!;
    };
    const before = where(room);
    // The drawing's lower side is the plan's upper side after the turn; the arc bows outward there by 1.5 m.
    expect(before.sagittaM).toBeCloseTo(1.5, 9);
    const opened = normaliseLoadedProperty(review.property);
    const after = where(opened.rooms.find((r) => r.id === room.id)!);
    near(after.middle, before.middle);
    near(after.centre, before.centre);
    expect(review.warnings.join(' ')).toContain('1 curved segment is kept as a true arc');
  });

  it('millimetres or metres: the curve is the same number', () => {
    const inMetres = parsePlanFile(
      'a.dxf',
      dxf(
        poly(
          [
            [0, 0, 0.5],
            [6, 0],
            [6, 4],
            [0, 4],
          ],
          'Rooms',
        ),
      ),
    );
    const inMillimetres = parsePlanFile(
      'a.dxf',
      dxf(
        poly(
          [
            [0, 0, 0.5],
            [6000, 0],
            [6000, 4000],
            [0, 4000],
          ],
          'Rooms',
        ),
        4,
      ),
    );
    const a = reviewPlanImport(inMetres, options(inMetres)).property.rooms[0];
    const b = reviewPlanImport(inMillimetres, options(inMillimetres, { metresPerUnit: 0.001 }))
      .property.rooms[0];
    expect(b.wallArcs).toEqual(a.wallArcs);
    expect(b.polygon.map((p) => [Math.round(p.x * 1e6), Math.round(p.y * 1e6)])).toEqual(
      a.polygon.map((p) => [Math.round(p.x * 1e6), Math.round(p.y * 1e6)]),
    );
  });

  it('a point in the middle of a straight side is taken out; a point where a curve begins or ends stays', () => {
    const source = parsePlanFile(
      'a.dxf',
      dxf(
        poly(
          [
            [0, 0],
            [3, 0],
            [6, 0, 0.3],
            [6, 2],
            [6, 4],
            [0, 4],
          ],
          'Rooms',
        ),
      ),
    );
    const room = reviewPlanImport(source, options(source)).property.rooms[0];
    // (3, 0) lies on a straight side and goes. (6, 2) is where the curved side ends: it stays.
    expect(room.polygon).toHaveLength(5);
    expect(room.wallArcs).toHaveLength(1);
    const arcOf = room.wallArcs![0];
    const a = room.polygon[arcOf.edgeIndex];
    const b = room.polygon[(arcOf.edgeIndex + 1) % room.polygon.length];
    expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeCloseTo(2, 9);
  });

  it('an ARC on a wall layer is a curved free wall; a circle on a room layer is a round room', () => {
    const source = parsePlanFile('a.dxf', dxf(circle(4, 3, 2.5) + arc(12, 3, 2, 270, 90)));
    const review = reviewPlanImport(source, options(source));
    const [wall] = review.property.walls!;
    expect(wall.bulge).toBeDefined();
    const made = arcGeometry(wall.a, wall.b, wall.bulge)!;
    expect(made.radiusM).toBeCloseTo(2, 9);
    expect(made.lengthM).toBeCloseTo(Math.PI * 2, 9);
    const room = review.property.rooms.find((r) => r.polygon.length >= 3)!;
    expect(room.wallArcs).toHaveLength(4);
    expect(review.warnings.join(' ')).toContain('5 curved segments are kept as true arcs');
    // The design then opens as a version 2 design, with its curves checked.
    const opened = normaliseLoadedProperty(review.property) as unknown as Loose;
    expect(opened.formatVersion).toBe(2);
  });

  it('open curved lines on a room layer are traced straight, and that is said', () => {
    const source = parsePlanFile(
      'a.dxf',
      dxf(
        poly(
          [
            [0, 0, 0.4],
            [6, 0],
          ],
          'Rooms',
          false,
        ) +
          poly(
            [
              [6, 0],
              [6, 4],
            ],
            'Rooms',
            false,
          ) +
          poly(
            [
              [6, 4],
              [0, 4],
            ],
            'Rooms',
            false,
          ) +
          poly(
            [
              [0, 4],
              [0, 0],
            ],
            'Rooms',
            false,
          ),
      ),
    );
    const review = reviewPlanImport(source, options(source));
    expect(review.property.rooms.find((r) => r.polygon.length >= 3)!.wallArcs).toBeUndefined();
    expect(review.warnings.join(' ')).toContain(
      '1 curved segments of open lines were traced as straight lines',
    );
  });
});
