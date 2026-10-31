import { describe, expect, it } from 'vitest';
import {
  SHADE_FABRICS, defaultShadeSail, estimateShadeSail, meanValueWeights, normaliseShade, shadeCornerAngleDeg,
  shadeOutlineSimple, shadePlanArea, shadeSailCorners, shadeSailSurface, type ShadeSail,
} from '../shade';

let counter = 0;
const nextId = () => `a${++counter}`;
const square = (patch: Partial<ShadeSail> = {}): ShadeSail => ({
  id: 'sail', name: 'Test sail', fabric: 'hdpe-knit', cornerGapM: 0.3, edgeCurvePct: 7, colour: '#e9e3d4',
  anchors: [
    { id: 'a', x: 0, y: 0, heightM: 3, support: 'post' }, { id: 'b', x: 4, y: 0, heightM: 2.4, support: 'post' },
    { id: 'c', x: 4, y: 4, heightM: 3, support: 'wall' }, { id: 'd', x: 0, y: 4, heightM: 2.4, support: 'post' },
  ],
  ...patch,
});

describe('shade sail geometry', () => {
  it('measures spans in three dimensions and takes the hardware gap off each corner', () => {
    const report = estimateShadeSail(square());
    const edge = report.edges[0];
    expect(edge.spanM).toBeCloseTo(Math.hypot(4, 0.6), 3);
    expect(edge.chordM).toBeCloseTo(Math.hypot(4, 0.6) - 0.6, 3);
    expect(edge.curveDepthM).toBeCloseTo(edge.chordM * 0.07, 3);
    expect(edge.curvedEdgeM).toBeGreaterThan(edge.chordM);
    expect(edge.relaxedChordM).toBeCloseTo(edge.chordM / 1.05, 3);
    expect(edge.stretchHeadroomM).toBeCloseTo(edge.chordM * 0.05, 3);
    expect(report.footprintAreaM2).toBe(16);
    expect(report.finishedAreaM2).toBeLessThan(16);
    expect(report.relaxedCutAreaM2).toBeLessThan(report.finishedAreaM2);
    const corners = shadeSailCorners(square());
    for (const c of corners) { expect(c.x).toBeGreaterThan(-0.01); expect(c.x).toBeLessThan(4.01); expect(c.y).toBeGreaterThan(-0.01); expect(c.y).toBeLessThan(4.01); }
    expect(Math.hypot(corners[0].x, corners[0].y)).toBeCloseTo(0.3, 6);
  });

  it('moves corners inward for either winding order', () => {
    const clockwise = square({ anchors: [...square().anchors].reverse() });
    for (const c of shadeSailCorners(clockwise)) { expect(c.x).toBeGreaterThan(0.1); expect(c.x).toBeLessThan(3.9); expect(c.y).toBeGreaterThan(0.1); expect(c.y).toBeLessThan(3.9); }
  });

  it('knows a hypar from a flat sail and from a sloped triangle', () => {
    expect(estimateShadeSail(square()).form).toBe('flat');
    const hypar = estimateShadeSail(square({ anchors: square().anchors.map((a, i) => ({ ...a, heightM: i % 2 ? 2.2 : 3.3 })) }));
    expect(hypar.form).toBe('hypar');
    expect(hypar.twistM).toBeCloseTo(1.1, 6);
    expect(hypar.warnings.some(w => w.id === 'no-hypar')).toBe(false);
    const flat = estimateShadeSail(square({ anchors: square().anchors.map(a => ({ ...a, heightM: 2.6 })) }));
    expect(flat.form).toBe('flat');
    expect(flat.warnings.find(w => w.id === 'no-hypar')?.level).toBe('check');
    const triangle = estimateShadeSail(square({ anchors: [{ id: 'a', x: 0, y: 0, heightM: 3.2, support: 'post' }, { id: 'b', x: 4, y: 0, heightM: 3.2, support: 'post' }, { id: 'c', x: 2, y: 3.5, heightM: 2.2, support: 'post' }] }));
    expect(triangle.form).toBe('sloped');
    expect(triangle.warnings.some(w => w.id === 'triangle-flat')).toBe(false);
    const flatTriangle = estimateShadeSail(square({ anchors: triangle.corners.map((c, i) => ({ id: c.anchorId, x: [0, 4, 2][i], y: [0, 0, 3.5][i], heightM: 2.8, support: 'post' as const })) }));
    expect(flatTriangle.warnings.some(w => w.id === 'triangle-flat')).toBe(true);
  });

  it('tells a made sail whether it fits, hangs slack or would be over-stretched', () => {
    const base = estimateShadeSail(square());
    const chords = base.edges.map(e => e.chordM);
    expect(estimateShadeSail(square({ made: { edgesM: chords.map(c => c / 1.03) } })).fit).toBe('fits');
    const slack = estimateShadeSail(square({ made: { edgesM: chords.map(c => c + 0.2) } }));
    expect(slack.fit).toBe('slack');
    expect(slack.warnings.some(w => w.id.startsWith('slack-'))).toBe(true);
    const over = estimateShadeSail(square({ made: { edgesM: chords.map(c => c / 1.2) } }));
    expect(over.fit).toBe('over-stretch');
    expect(over.edges[0].requiredStretchPct).toBeCloseTo(20, 0);
    expect(over.warnings.find(w => w.id === 'over-0')?.level).toBe('stop');
    const pvc = estimateShadeSail(square({ fabric: 'pvc-coated', made: { edgesM: chords.map(c => c / 1.03) } }));
    expect(pvc.fit).toBe('over-stretch');
  });

  it('flags pointy corners, unbalanced sides and crossing outlines', () => {
    const pointy = estimateShadeSail(square({ anchors: [{ id: 'a', x: 0, y: 0, heightM: 3, support: 'post' }, { id: 'b', x: 6, y: 0, heightM: 2.4, support: 'post' }, { id: 'c', x: 6, y: 0.8, heightM: 3, support: 'post' }] }));
    expect(pointy.minCornerAngleDeg).toBeLessThan(35);
    expect(pointy.warnings.some(w => w.id === 'pointy')).toBe(true);
    expect(pointy.warnings.some(w => w.id === 'side-ratio')).toBe(true);
    const crossing = square({ anchors: [square().anchors[0], square().anchors[2], square().anchors[1], square().anchors[3]] });
    expect(shadeOutlineSimple(crossing.anchors)).toBe(false);
    expect(estimateShadeSail(crossing).warnings.find(w => w.id === 'crossing')?.level).toBe('stop');
    expect(shadeOutlineSimple(square().anchors)).toBe(true);
    expect(shadeCornerAngleDeg(square().anchors, 0)).toBeCloseTo(90, 6);
    expect(shadePlanArea(square().anchors)).toBe(16);
  });

  it('sizes posts from the supplier guide and asks for an engineer beyond it', () => {
    const report = estimateShadeSail(square());
    const post = report.corners.find(c => c.anchorId === 'a')!.post!;
    expect(post.steel).toBe('CHS 139.7 x 4.5');
    expect(post.leanDeg).toBe(7);
    expect(post.footingDepthM).toBeGreaterThanOrEqual(1);
    expect(post.engineer).toBe(false);
    expect(report.corners.find(c => c.anchorId === 'c')!.post).toBeUndefined();
    const low = estimateShadeSail(square({ anchors: square().anchors.map(a => ({ ...a, heightM: 2.4 })) }));
    expect(low.corners[0].post!.steel).toBe('CHS 89.0 x 3.2');
    expect(low.corners[0].post!.footingDepthM).toBe(0.8);
    const tall = estimateShadeSail(square({ anchors: square().anchors.map(a => ({ ...a, heightM: 4 })) }));
    expect(tall.corners[0].post!.engineer).toBe(true);
    expect(tall.warnings.some(w => w.id === 'post-engineer')).toBe(true);
    const wide = estimateShadeSail(square({ anchors: square().anchors.map(a => ({ ...a, x: a.x * 2.5, y: a.y * 2.5 })) }));
    expect(wide.warnings.some(w => w.id === 'big-span')).toBe(true);
    expect(wide.corners[0].post!.steel).toBe('engineer to size');
  });

  it('derives corner loads from prestress and edge radius, heavier for PVC', () => {
    const knit = estimateShadeSail(square()), pvc = estimateShadeSail(square({ fabric: 'pvc-coated' }));
    expect(knit.edges[0].cableTensionKN).toBeCloseTo(0.25 * knit.edges[0].edgeRadiusM, 1);
    expect(pvc.corners[0].loadKN).toBeGreaterThan(knit.corners[0].loadKN * 5);
    expect(knit.corners.every(c => c.loadKN > 0)).toBe(true);
    expect(pvc.warnings.some(w => w.id === 'corner-load')).toBe(true);
    const straight = estimateShadeSail(square({ edgeCurvePct: 0 }));
    expect(straight.edges[0].cableTensionKN).toBe(0);
    expect(straight.edges[0].edgeRadiusM).toBe(-1);
  });

  it('places the noon shadow south in June and almost under the sail in December, and counts hardware', () => {
    const report = estimateShadeSail(square());
    expect(report.shadow.juneDirection).toBe('south');
    expect(report.shadow.juneNoonOffsetM).toBeGreaterThan(2);
    expect(report.shadow.decemberNoonOffsetM).toBeLessThan(0.2);
    expect(report.hardware).toEqual({ turnbuckles: 2, snapHooks: 2, dRings: 4, posts: 3, wallBrackets: 1, wireEdgeM: expect.any(Number) });
    expect(report.warnings.some(w => w.id === 'cyclone')).toBe(true);
    expect(report.basis).toContain('No price');
    expect(SHADE_FABRICS.map(f => f.id)).toEqual(['hdpe-knit', 'pvc-coated']);
  });
});

describe('shade sail surface', () => {
  it('interpolates a saddle through the corner heights and stays inside the corner heights', () => {
    const sail = square({ anchors: square().anchors.map((a, i) => ({ ...a, heightM: i % 2 ? 2.2 : 3.3 })) });
    const surface = shadeSailSurface(sail);
    const heights: number[] = [];
    for (let i = 1; i < surface.positions.length; i += 3) heights.push(surface.positions[i]);
    expect(Math.min(...heights)).toBeGreaterThanOrEqual(2.2 - 1e-9);
    expect(Math.max(...heights)).toBeLessThanOrEqual(3.3 + 1e-9);
    const centre = heights[heights.length - 1];
    expect(centre).toBeCloseTo(2.75, 6);
    expect(surface.indices.length % 3).toBe(0);
    expect(Math.max(...surface.indices)).toBeLessThan(surface.positions.length / 3);
    expect(surface.positions.every(Number.isFinite)).toBe(true);
    expect(surface.outline.length).toBe(4 * 8);
    const bulge = surface.outline[4];
    expect(bulge.y).toBeGreaterThan(0.3);
  });
  it('gives exact corner weights, edge interpolation and a symmetric centre', () => {
    const polygon = [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 2 }, { x: 0, y: 2 }];
    expect(meanValueWeights({ x: 0, y: 0 }, polygon)).toEqual([1, 0, 0, 0]);
    expect(meanValueWeights({ x: 1, y: 0 }, polygon)).toEqual([0.5, 0.5, 0, 0]);
    const centre = meanValueWeights({ x: 1, y: 1 }, polygon);
    for (const w of centre) expect(w).toBeCloseTo(0.25, 9);
  });
});

describe('shade model normalisation', () => {
  it('accepts a valid model byte for byte and rejects bad shapes instead of clamping', () => {
    const model = { version: 1 as const, enabled: true, sails: [square()] };
    expect(normaliseShade(model)).toEqual(model);
    expect(normaliseShade(JSON.parse(JSON.stringify(model)))).toEqual(model);
    expect(normaliseShade({ ...model, sails: [square({ anchors: square().anchors.slice(0, 2) })] })).toBeUndefined();
    expect(normaliseShade({ ...model, sails: [square({ anchors: [...square().anchors, ...square().anchors.map(a => ({ ...a, id: a.id + '2' }))] })] })).toBeUndefined();
    expect(normaliseShade({ ...model, sails: [square({ cornerGapM: 2 })] })).toBeUndefined();
    expect(normaliseShade({ ...model, sails: [square({ colour: 'sand' })] })).toBeUndefined();
    expect(normaliseShade({ ...model, sails: [square({ anchors: square().anchors.map(a => ({ ...a, heightM: 0.2 })) })] })).toBeUndefined();
    expect(normaliseShade({ ...model, sails: [square({ made: { edgesM: [3, 3, 3] } })] })).toBeUndefined();
    expect(normaliseShade({ ...model, sails: [square({ made: { edgesM: [3, 3, 3, 3] } })] })).toEqual({ ...model, sails: [square({ made: { edgesM: [3, 3, 3, 3] } })] });
    expect(normaliseShade({ version: 2, enabled: true, sails: [] })).toBeUndefined();
    expect(normaliseShade(null)).toBeUndefined();
  });
  it('builds a default four-point hypar around a plan point', () => {
    const sail = defaultShadeSail('s1', { x: 10, y: 5 }, nextId);
    expect(sail.anchors).toHaveLength(4);
    expect(estimateShadeSail(sail).form).toBe('hypar');
    expect(normaliseShade({ version: 1, enabled: true, sails: [sail] })).toBeDefined();
  });
});
