import { describe, it, expect } from 'vitest';
import {
  area,
  bearingDegrees,
  boundaryError,
  integrateCutFill,
  makeSite,
  metrics,
  setbackEnvelope,
  slope,
  toLocal,
  toLonLat,
  traverse,
  triangulate,
} from '../geometry';
import { parseSurvey, surveyTIN, terrainEstimate } from '../terrain';
import { sampleLocations, sampleSite } from '../sample';
import { normaliseGeoSite, type TerrainInput } from '../types';
import { foundationScenario } from '../foundationScenario';
import { defaultFoundationRebar, type FoundationModel } from '../../designer/foundation';
import { defaultMaterialsSettings } from '../../designer/materials';
const square = [
  { x: 0, y: 0 },
  { x: 20, y: 0 },
  { x: 20, y: 20 },
  { x: 0, y: 20 },
];
describe('WGS84 frame and polygon measurements', () => {
  it('rejects a date-line wrap and antipodal alias before local projection', () => {
    expect(() =>
      makeSite(
        [
          [179.999, 0],
          [-179.999, 0],
          [-179.999, 0.0001],
          [179.999, 0.0001],
        ],
        'Wrap',
        { x: 0, y: 0 },
      ),
    ).toThrow('Date-line');
    expect(() =>
      makeSite(
        [
          [0, 0],
          [180, 0],
          [0, 0.0001],
        ],
        'Alias',
        { x: 0, y: 0 },
      ),
    ).toThrow('large');
  });
  it('rejects a repeated non-adjacent corner and collinear overlapping edges', () => {
    expect(
      boundaryError([
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 },
        { x: 0, y: 0 },
        { x: -10, y: 0 },
        { x: -10, y: -10 },
        { x: 0, y: -10 },
      ]),
    ).toBeTruthy();
    expect(
      boundaryError([
        { x: 0, y: 0 },
        { x: 20, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 },
      ]),
    ).toContain('overlap');
  });
  it.each(sampleLocations)('keeps true metre area and inverse at $name', ({ origin }) => {
    const p = square.map((v) => toLocal(toLonLat(v, origin), origin));
    expect(area(p)).toBeCloseTo(400, 6);
    p.forEach((v, i) => {
      expect(v.x).toBeCloseTo(square[i].x, 7);
      expect(v.y).toBeCloseTo(square[i].y, 7);
    });
  });
  it('uses north-up plan coordinates', () => {
    expect(toLocal([57, -19.9999], [57, -20]).y).toBeLessThan(0);
    expect(toLocal([57.0001, -20], [57, -20]).x).toBeGreaterThan(0);
  });
  it('measures a 3-4-5 triangle and Mauritius units', () => {
    const m = metrics([
      { x: 0, y: 0 },
      { x: 3, y: 0 },
      { x: 0, y: 4 },
    ]);
    expect(m.areaM2).toBe(6);
    expect(m.perimeterM).toBe(12);
    expect(m.minSideM).toBe(3);
    expect(m.maxSideM).toBe(5);
    expect(m.perches).toBe(6 / 42.21);
  });
  it('rejects bowtie, duplicate adjacent and overlarge boundaries', () => {
    expect(
      boundaryError([
        { x: 0, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 },
        { x: 10, y: 0 },
      ]),
    ).toBeTruthy();
    expect(boundaryError([...square, square[0]])).toBeTruthy();
    expect(boundaryError(square.map((p) => ({ x: p.x * 30, y: p.y })))).toContain('500');
  });
  it('retains real scale, north and explicit anchor', () => {
    const site = makeSite(
      square.map((v) => toLonLat(v, [57, -20])),
      'Plot',
      { x: 10, y: 50 },
    );
    expect(site.polygon[0]).toEqual({ x: 10, y: 50 });
    expect(area(site.polygon)).toBeCloseTo(400, 6);
  });
  it('triangulates concave areas without filling their notch', () => {
    const l = [
      { x: 0, y: 0 },
      { x: 3, y: 0 },
      { x: 3, y: 1 },
      { x: 1, y: 1 },
      { x: 1, y: 3 },
      { x: 0, y: 3 },
    ];
    expect(triangulate(l).reduce((s, t) => s + area(t.map((i) => l[i])), 0)).toBe(5);
  });
});
describe('surveyor plan transcription', () => {
  it.each([
    ['N 35 20 E', 35 + 20 / 60],
    ['S 30 E', 150],
    ['S 30 W', 210],
    ['N 30 W', 330],
    ['360', 0],
    ['N 90 E', 90],
  ])('parses %s', (input, output) => expect(bearingDegrees(input)).toBeCloseTo(Number(output), 10));
  it('rejects malformed quadrant/minutes', () => {
    expect(() => bearingDegrees('N 95 E')).toThrow();
    expect(() => bearingDegrees('N 30 60 E')).toThrow();
    expect(() => bearingDegrees('')).toThrow();
  });
  it('closes an exact rectangle', () => {
    const result = traverse([
      { lengthM: 20, bearing: '90' },
      { lengthM: 10, bearing: '180' },
      { lengthM: 20, bearing: '270' },
      { lengthM: 10, bearing: '0' },
    ]);
    expect(result.closureErrorM).toBeLessThan(1e-10);
    expect(result.points).toHaveLength(4);
    expect(area(result.points)).toBeCloseTo(200);
  });
  it('exposes a 1 metre residual without adjusting measured sides', () => {
    const result = traverse([
      { lengthM: 20, bearing: '90' },
      { lengthM: 10, bearing: '180' },
      { lengthM: 20, bearing: '270' },
      { lengthM: 9, bearing: '0' },
    ]);
    expect(result.closureErrorM).toBeCloseTo(1);
    expect(result.points).toHaveLength(5);
    expect(result.points[1].x).toBe(20);
  });
});
describe('survey and what-if earthworks', () => {
  it('rejects a conflicting spot height on a contour and excessive constraints', () => {
    expect(() =>
      surveyTIN(
        [
          { x: 0, y: 0, z: 1 },
          { x: 20, y: 0, z: 1 },
          { x: 20, y: 20, z: 1 },
          { x: 0, y: 20, z: 1 },
          { x: 10, y: 0, z: 2 },
        ],
        [[0, 1]],
      ),
    ).toThrow('conflicts');
    expect(() =>
      surveyTIN(
        square.map((p) => ({ ...p, z: 0 })),
        Array.from({ length: 201 }, () => [0, 1]),
      ),
    ).toThrow('exceed');
  });
  it('integrates mixed positive/negative terrain separately', () => {
    const input: TerrainInput = {
      source: 'typed what-if',
      verticalReference: 'Local benchmark',
      platformM: 0,
      points: square.map((p) => ({ ...p, z: p.x / 10 - 1 })),
    };
    const result = terrainEstimate(square, input);
    expect(result.cutM3).toBeCloseTo(100);
    expect(result.fillM3).toBeCloseTo(100);
    expect(result.areaM2).toBe(400);
  });
  it('integrates a flat plate exactly', () => {
    const result = integrateCutFill(
      [
        [
          { x: 0, y: 0, z: 2 },
          { x: 10, y: 0, z: 2 },
          { x: 0, y: 10, z: 2 },
        ],
      ],
      0,
    );
    expect(result.cutM3).toBe(100);
    expect(result.fillM3).toBe(0);
  });
  it('does not accept public data as a cut/fill input', () =>
    expect(() =>
      terrainEstimate(square, {
        source: 'public data',
        points: square.map((p) => ({ ...p, z: 2 })),
        platformM: 0,
        verticalReference: 'unknown',
      } as unknown as TerrainInput),
    ).toThrow('Public terrain'));
  it('clips a larger surveyed plane to the boundary', () => {
    const points = [
      { x: -5, y: -5, z: 1 },
      { x: 25, y: -5, z: 1 },
      { x: 25, y: 25, z: 1 },
      { x: -5, y: 25, z: 1 },
      { x: 10, y: 10, z: 1 },
    ];
    const result = terrainEstimate(square, {
      source: 'survey',
      points,
      verticalReference: 'BM1',
      platformM: 0,
    });
    expect(result.cutM3).toBeCloseTo(400, 7);
    expect(result.areaM2).toBeCloseTo(400, 7);
  });
  it('withholds volume for incomplete survey coverage', () =>
    expect(() =>
      terrainEstimate(square, {
        source: 'survey',
        points: [
          { x: 0, y: 0, z: 1 },
          { x: 10, y: 0, z: 1 },
          { x: 0, y: 10, z: 1 },
        ],
        verticalReference: 'BM1',
        platformM: 0,
      }),
    ).toThrow('covers'));
  it('enforces a contour edge and rejects crossing contours', () => {
    const points = [
      { x: 0, y: 0, z: 1 },
      { x: 20, y: 0, z: 1 },
      { x: 20, y: 20, z: 1 },
      { x: 0, y: 20, z: 1 },
    ];
    const tins = surveyTIN(points, [[0, 2]]);
    expect(tins.filter((t) => t.includes(0) && t.includes(2))).toHaveLength(2);
    expect(() =>
      surveyTIN(points, [
        [0, 2],
        [1, 3],
      ]),
    ).toThrow('cross');
  });
  it('rejects duplicate survey points and inconsistent contour levels', () => {
    expect(() =>
      surveyTIN([
        { x: 0, y: 0, z: 0 },
        { x: 0, y: 0, z: 1 },
        { x: 1, y: 1, z: 1 },
      ]),
    ).toThrow('duplicate');
    expect(() =>
      surveyTIN(
        [
          { x: 0, y: 0, z: 0 },
          { x: 10, y: 0, z: 1 },
          { x: 0, y: 10, z: 1 },
        ],
        [[0, 1]],
      ),
    ).toThrow('constant');
  });
  it('fits an east-rising plane to west downhill aspect', () => {
    const result = slope(square.map((p) => ({ ...p, z: p.x * 0.1 })))!;
    expect(result.percent).toBeCloseTo(10);
    expect(result.aspect).toBeCloseTo(270);
    expect(result.residualM).toBeCloseTo(0);
  });
  it('reads CSV and contour JSON and rejects blank numbers', () => {
    expect(parseSurvey('x,y,z\n0,0,1\n20,0,2\n0,20,1').points).toHaveLength(3);
    expect(parseSurvey('{"points":[{"x":0,"y":0,"z":1}],"contours":[[0,1]]}').contours).toEqual([
      [0, 1],
    ]);
    expect(() => parseSurvey('0,,1')).toThrow();
  });
});
describe('planning, persistence and foundation isolation', () => {
  it('clips a 2m uniform setback exactly', () =>
    expect(area(setbackEnvelope(square, 2))).toBeCloseTo(256));
  it('withholds unsupported concave setback envelope', () =>
    expect(() =>
      setbackEnvelope(
        [
          { x: 0, y: 0 },
          { x: 3, y: 0 },
          { x: 1, y: 1 },
          { x: 0, y: 3 },
        ],
        1,
      ),
    ).toThrow('concave'));
  it('roundtrips the local demo without inventing public results', () => {
    const sample = sampleSite();
    expect(normaliseGeoSite(JSON.parse(JSON.stringify(sample)))).toEqual(sample);
    expect(sample.publicData?.solar).toBeUndefined();
  });
  it('rejects public terrain substituted for survey and malformed cached heights', () => {
    const sample = sampleSite();
    expect(
      normaliseGeoSite({ ...sample, terrain: { ...sample.terrain, source: 'public data' } }),
    ).toBeUndefined();
    expect(
      normaliseGeoSite({
        ...sample,
        publicData: { fetchedAt: '2026-10-27', terrain: { heightsM: 'wrong' } },
      }),
    ).toBeUndefined();
  });
  it('reruns unchanged foundation estimator and leaves the model byte-identical', () => {
    const model: FoundationModel = {
      version: 1,
      enabled: true,
      elements: [
        {
          id: 'slab',
          name: 'Measured slab',
          kind: 'slab',
          x: 0,
          y: 0,
          lengthM: 10,
          widthM: 5,
          depthM: 0.2,
          topElevationM: 0,
          rebar: defaultFoundationRebar(),
        },
      ],
    };
    const before = JSON.stringify(model),
      result = foundationScenario(model, defaultMaterialsSettings().concrete, 1);
    expect(result.baseline.volumeM3).toBeCloseTo(10, 10);
    expect(result.scenario.volumeM3).toBeCloseTo(10, 10);
    expect(JSON.stringify(model)).toBe(before);
  });
});
