/** @vitest-environment jsdom */
import { describe, expect, it } from 'vitest';
import {
  parsePlanFile,
  PLAN_UNITS,
  reviewPlanImport,
  suggestPlanLayers,
  type PlanImportOptions,
  type PlanImportSource,
} from '../planImport';
import { normaliseLoadedProperty } from '../../store/propertyStore';
import { polygonArea } from '../../lib/geometry';

const dxf = (entities: string, unit = 4) =>
  `0\nSECTION\n2\nHEADER\n9\n$INSUNITS\n70\n${unit}\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n${entities}0\nENDSEC\n0\nEOF\n`;
const line = (x1: number, y1: number, x2: number, y2: number, layer = 'Walls') =>
  `0\nLINE\n8\n${layer}\n10\n${x1}\n20\n${y1}\n11\n${x2}\n21\n${y2}\n`;
const poly = (vertices: number[][], layer = 'Rooms', extra = '') =>
  `0\nLWPOLYLINE\n8\n${layer}\n90\n${vertices.length}\n70\n1\n${extra}${vertices.map(([x, y]) => `10\n${x}\n20\n${y}\n`).join('')}`;
const svg = (body: string, attrs = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" ${attrs}>${body}</svg>`;
function options(source: PlanImportSource): PlanImportOptions {
  return {
    name: 'Imported measured plan',
    metresPerUnit: source.suggestedUnit ? PLAN_UNITS[source.suggestedUnit].metres : 0.001,
    wallHeightM: 2.7,
    wallThicknessM: 0.15,
    layers: suggestPlanLayers(source),
  };
}

describe('measured CAD plan import', () => {
  it('uses millimetre model units and mirrors CAD Y once into plan coordinates', () => {
    const source = parsePlanFile(
      'villa.dxf',
      dxf(
        poly([
          [10000, 20000],
          [15000, 20000],
          [15000, 24000],
          [10000, 24000],
        ]),
      ),
    );
    expect(source.suggestedUnit).toBe('mm');
    const result = reviewPlanImport(source, options(source));
    expect(result.widthM).toBe(5);
    expect(result.depthM).toBe(4);
    expect(result.areaM2).toBe(20);
    expect(result.property.rooms[0].polygon).toEqual([
      { x: 0, y: 4 },
      { x: 5, y: 4 },
      { x: 5, y: 0 },
      { x: 0, y: 0 },
    ]);
  });
  it.each([
    [1, 'in', 0.0254],
    [2, 'ft', 0.3048],
    [4, 'mm', 0.001],
    [5, 'cm', 0.01],
    [6, 'm', 1],
  ] as const)('understands INSUNITS %s as %s', (code, unit, factor) => {
    const source = parsePlanFile('wall.dxf', dxf(line(0, 0, 100, 0), code));
    expect(source.suggestedUnit).toBe(unit);
    expect(reviewPlanImport(source, options(source)).widthM).toBeCloseTo(100 * factor, 8);
  });
  it('marks unitless exports for manual scale review', () => {
    expect(
      parsePlanFile('unitless.dxf', dxf(line(0, 0, 5000, 0), 0)).suggestedUnit,
    ).toBeUndefined();
  });
  it('joins an unordered, reversed degree-two LINE loop as a room', () => {
    const source = parsePlanFile(
      'lines.dxf',
      dxf(
        line(5000, 0, 5000, 4000, 'Rooms') +
          line(0, 0, 0, 4000, 'Rooms') +
          line(5000, 4000, 0, 4000, 'Rooms') +
          line(5000, 0, 0, 0, 'Rooms'),
      ),
    );
    const review = reviewPlanImport(source, options(source));
    expect(review.roomCount).toBe(1);
    expect(review.areaM2).toBe(20);
    expect(review.wallCount).toBe(0);
  });
  it('does not invent a room from a branched network or a gap', () => {
    const source = parsePlanFile(
      'branch.dxf',
      dxf(
        line(0, 0, 5000, 0, 'Rooms') +
          line(5000, 0, 5000, 4000, 'Rooms') +
          line(5000, 4000, 0, 4000, 'Rooms') +
          line(0, 4000, 0, 0, 'Rooms') +
          line(0, 0, -1000, 0, 'Rooms'),
      ),
    );
    expect(() => reviewPlanImport(source, options(source))).toThrow(/No complete room/);
    const opts = options(source);
    opts.layers[0].role = 'walls';
    const review = reviewPlanImport(source, opts);
    expect(review.wallCount).toBe(5);
    expect(review.roomCount).toBe(0);
  });
  it('reads classic 2D POLYLINE / VERTEX / SEQEND and ignores blocks', () => {
    const points = [
      [0, 0],
      [5000, 0],
      [5000, 4000],
      [0, 4000],
    ];
    const source = parsePlanFile(
      'classic.dxf',
      dxf(
        `0\nPOLYLINE\n8\nRooms\n70\n1\n${points.map(([x, y]) => `0\nVERTEX\n10\n${x}\n20\n${y}\n30\n0\n`).join('')}0\nSEQEND\n0\nINSERT\n8\nFurnishings\n2\nSOFA\n`,
      ),
    );
    expect(reviewPlanImport(source, options(source)).areaM2).toBe(20);
    expect(source.warnings.join(' ')).toContain('INSERT skipped');
  });
  it('reports curved, elevated, non-XY and paper-space geometry instead of distorting it', () => {
    const source = parsePlanFile(
      'unsupported.dxf',
      dxf(
        line(0, 0, 5000, 0) +
          poly(
            [
              [0, 0],
              [1, 0],
              [1, 1],
            ],
            'Rooms',
            '42\n.2\n',
          ) +
          poly(
            [
              [0, 0],
              [1, 0],
              [1, 1],
            ],
            'Rooms',
            '38\n2\n',
          ) +
          poly(
            [
              [0, 0],
              [1, 0],
              [1, 1],
            ],
            'Rooms',
            '230\n-1\n',
          ) +
          line(0, 0, 20, 10) +
          '67\n1\n',
      ),
    );
    expect(source.shapes).toHaveLength(1);
    expect(source.warnings.join(' ')).toContain('paper-space');
    expect(source.warnings.join(' ')).toContain('curved or elevated');
  });
  it('rejects binary, incomplete and non-finite DXF data', () => {
    expect(() => parsePlanFile('bad.dxf', 'AutoCAD Binary DXF\0')).toThrow(/ASCII/);
    expect(() => parsePlanFile('bad.dxf', '0\nSECTION\n')).toThrow(/EOF/);
    expect(() => parsePlanFile('bad.dxf', dxf(line(0, 0, NaN, 1)))).toThrow(/Invalid DXF/);
  });
  it('does not read ENTITIES embedded in BLOCKS as placed geometry', () => {
    const text = dxf(line(0, 0, 5000, 0)).replace(
      '0\nSECTION\n2\nENTITIES',
      '0\nSECTION\n2\nBLOCKS\n' + line(0, 0, 1e7, 1e7) + '0\nENDSEC\n0\nSECTION\n2\nENTITIES',
    );
    expect(parsePlanFile('blocks.dxf', text).shapes).toHaveLength(1);
  });
});

describe('inert SVG plan geometry', () => {
  it('applies nested transforms exactly and imports physical page scale as a suggestion', () => {
    const source = parsePlanFile(
      'scaled.svg',
      svg(
        '<g id="Rooms" transform="translate(10,20)"><g transform="scale(2)"><rect width="500" height="400"/></g></g>',
        'width="100mm" height="80mm" viewBox="0 0 1000 800"',
      ),
    );
    expect(source.metresPerUnit).toBeCloseTo(0.0001);
    expect(source.shapes[0].points[2]).toEqual({ x: 1010, y: 820 });
    expect(reviewPlanImport(source, { ...options(source), metresPerUnit: 0.005 }).areaM2).toBe(20);
  });
  it('accepts straight relative and absolute paths with implicit repeated coordinates', () => {
    const source = parsePlanFile(
      'path.svg',
      svg('<g id="Rooms"><path d="M100 100 5100 100 v4000 h-5000z"/></g>'),
    );
    expect(reviewPlanImport(source, options(source)).areaM2).toBe(20);
  });
  it('splits multiple linear subpaths and preserves two distinct rooms', () => {
    const source = parsePlanFile(
      'paths.svg',
      svg('<path d="M0 0h4000v3000H0z M4000 0h3000v3000h-3000z"/>'),
    );
    const result = reviewPlanImport(source, options(source));
    expect(result.roomCount).toBe(2);
    expect(result.areaM2).toBe(21);
  });
  it('does not flatten bezier curves, arcs, circles or rounded rectangles', () => {
    const source = parsePlanFile(
      'curves.svg',
      svg(
        '<rect width="5000" height="4000"/><path d="M0 0C10 20 30 40 50 60Z"/><circle r="10"/><rect width="20" height="20" rx="5"/>',
      ),
    );
    expect(source.shapes).toHaveLength(1);
    expect(source.warnings.join(' ')).toContain('curved paths');
  });
  it('skips defs, hidden nodes and nested viewports rather than importing invisible symbols', () => {
    const source = parsePlanFile(
      'hidden.svg',
      svg(
        '<defs><rect width="100" height="100"/></defs><g style="display:none"><rect width="200" height="200"/></g><svg x="1"><rect width="300" height="300"/></svg><rect width="5000" height="4000"/>',
      ),
    );
    expect(source.shapes).toHaveLength(1);
    expect(source.warnings.join(' ')).toContain('nested SVG');
  });
  it.each([
    '<script>alert(1)</script>',
    '<foreignObject><div/></foreignObject>',
    '<image href="https://example.com/image.png"/>',
    '<rect width="10" height="10" onload="alert(1)"/>',
    '<use href="#room"/>',
    '<style>rect{transform:scale(2)}</style>',
    '<rect width="10" height="10" style="transform:scale(2)"/>',
    '<rect width="10" height="10" fill="url(https://example.com)"/>',
  ])('rejects active, external or stylesheet-driven content: %s', (body) => {
    expect(() => parsePlanFile('unsafe.svg', svg(body))).toThrow();
  });
  it('rejects entity definitions, malformed XML, percentages and singular transforms', () => {
    expect(() =>
      parsePlanFile('unsafe.svg', '<!DOCTYPE svg [<!ENTITY x "oops">]>' + svg('<rect/>')),
    ).toThrow(/entities/);
    expect(() => parsePlanFile('bad.svg', '<svg><rect></svg>')).toThrow(/valid SVG/);
    expect(() => parsePlanFile('bad.svg', svg('<rect width="50%" height="10"/>'))).toThrow(
      /plain drawing units/,
    );
    expect(() =>
      parsePlanFile('bad.svg', svg('<rect width="10" height="10" transform="scale(0)"/>')),
    ).toThrow(/collapsed/);
  });
});

describe('reviewed property construction', () => {
  const twoFloors = () =>
    parsePlanFile(
      'floors.svg',
      svg(
        '<g id="Ground rooms"><rect width="5000" height="4000"/></g><g id="Upper rooms"><rect x="1000" width="3000" height="4000"/></g>',
      ),
    );
  it('keeps a shared world origin across floors, metres, heights and editable polygons through normalisation', () => {
    const source = twoFloors(),
      opts = options(source);
    opts.layers[1].floor = 1;
    const result = reviewPlanImport(source, opts),
      property = normaliseLoadedProperty(result.property);
    expect(result.roomCount).toBe(2);
    expect(property.levels?.[1]).toMatchObject({ elevationM: 2.7, heightM: 2.7 });
    expect(property.rooms[1].polygon[0]).toEqual({ x: 1, y: 0 });
    expect(polygonArea(property.rooms[1].polygon)).toBe(12);
    expect(property.rooms.flatMap((r) => r.placedItems)).toHaveLength(0);
  });
  it('refuses same-floor overlapping, nested, coincident and self-intersecting outlines', () => {
    const nested = parsePlanFile(
      'nested.svg',
      svg('<rect width="5000" height="4000"/><rect x="1000" y="1000" width="2000" height="2000"/>'),
    );
    expect(() => reviewPlanImport(nested, options(nested))).toThrow(/Overlapping or nested/);
    const overlapping = parsePlanFile(
      'overlap.svg',
      svg('<rect width="5000" height="4000"/><rect x="3000" width="5000" height="4000"/>'),
    );
    expect(() => reviewPlanImport(overlapping, options(overlapping))).toThrow(
      /Overlapping or nested/,
    );
    const coincident = parsePlanFile(
      'same.svg',
      svg('<rect width="5000" height="4000"/><rect width="5000" height="4000"/>'),
    );
    expect(() => reviewPlanImport(coincident, options(coincident))).toThrow(
      /Overlapping or nested/,
    );
    const crossed = parsePlanFile(
      'crossed.svg',
      svg('<polygon points="0,0 5000,4000 0,5000 4000,0"/>'),
    );
    expect(() => reviewPlanImport(crossed, options(crossed))).toThrow(/crosses or touches/);
  });
  it('keeps adjacent rooms sharing boundaries and explicit wall thickness', () => {
    const source = parsePlanFile(
      'adjoining.svg',
      svg(
        '<g id="Rooms"><rect width="4000" height="3000"/><rect x="4000" width="4000" height="3000"/></g><g id="Walls"><line x1="1000" y1="1000" x2="1000" y2="2500"/><line x1="1000" y1="2500" x2="1000" y2="1000"/></g>',
      ),
    );
    const result = reviewPlanImport(source, { ...options(source), wallThicknessM: 0.2 });
    expect(result.roomCount).toBe(2);
    expect(result.wallCount).toBe(1);
    expect(result.property.walls?.[0].thicknessM).toBe(0.2);
  });
  it('skips furniture and annotation layers by default', () => {
    const source = parsePlanFile(
      'annotated.svg',
      svg(
        '<g id="Rooms"><rect width="5000" height="4000"/></g><g id="Furniture"><rect width="900" height="400"/></g><g id="Dimensions"><line x1="0" y1="0" x2="6000" y2="0"/></g>',
      ),
    );
    expect(suggestPlanLayers(source).map((l) => l.role)).toEqual(['rooms', 'skip', 'skip']);
    expect(reviewPlanImport(source, options(source)).roomCount).toBe(1);
  });
  it('does not duplicate room boundary walls when a wall layer covers the same span', () => {
    const source = parsePlanFile(
      'room-and-walls.svg',
      svg(
        '<g id="Rooms"><rect width="5000" height="4000"/></g><g id="Walls"><line x1="0" y1="0" x2="5000" y2="0"/></g>',
      ),
    );
    const result = reviewPlanImport(source, options(source));
    expect(result.roomCount).toBe(1);
    expect(result.wallCount).toBe(0);
    expect(result.warnings.join(' ')).toContain('avoid duplicate walls');
  });
  it('requires selected geometry and valid scale, floor, height and thickness', () => {
    const source = twoFloors(),
      opts = options(source);
    opts.layers[1].role = 'skip';
    for (const metresPerUnit of [0, -1, NaN, Infinity, 1e6])
      expect(() => reviewPlanImport(source, { ...opts, metresPerUnit })).toThrow();
    expect(() => reviewPlanImport(source, { ...opts, wallHeightM: 9 })).toThrow(/Wall height/);
    expect(() => reviewPlanImport(source, { ...opts, wallThicknessM: 0 })).toThrow(
      /Wall thickness/,
    );
    expect(() =>
      reviewPlanImport(source, {
        ...opts,
        layers: opts.layers.map((l) => ({ ...l, role: 'skip' })),
      }),
    ).toThrow(/Choose at least/);
    expect(() =>
      reviewPlanImport(source, { ...opts, layers: [{ ...opts.layers[0], floor: 12 }] }),
    ).toThrow(/Assign a floor/);
  });
  it('fails honestly for unsupported native software formats and oversized exports', () => {
    for (const extension of ['dwg', 'rvt', 'skp', 'ifc', 'pdf', 'png'])
      expect(() => parsePlanFile(`plan.${extension}`, 'x')).toThrow(/Export a 2D plan/);
    expect(() => parsePlanFile('large.svg', 'x'.repeat(2_000_001))).toThrow(/2 MB/);
  });
});
