import { describe, expect, it } from 'vitest';
import { toLonLat } from '../geometry';
import { sampleSite } from '../sample';
import { normaliseGeoSite, type PublicSnapshot } from '../types';

function snapshot(): PublicSnapshot {
  return {
    fetchedAt: '2026-10-27T12:00:00.000Z',
    solar: {
      annualKwh: 1400,
      tiltDeg: 22,
      sourceUrl: 'https://re.jrc.ec.europa.eu/api/v5_3/PVcalc?lat=-20&lon=57',
      acquiredAt: '2026-10-01T10:00:00.000Z',
      radiationDatabase: 'PVGIS-SARAH3',
      periodStartYear: 2005,
      periodEndYear: 2023,
      version: 'PVGIS 5.3',
    },
    context: {
      roads: 1,
      buildings: 2,
      waterways: 0,
      power: 0,
      landuse: ['residential'],
      sourceUrl: 'https://www.openstreetmap.org/copyright',
      acquiredAt: '2026-10-26T10:00:00.000Z',
    },
    terrain: {
      heightsM: [10, 11, 11, 10],
      resolutionM: 250,
      sourceUrl: 'https://github.com/tilezen/joerd/blob/master/docs/data-sources.md',
      verticalReference: 'Public composite orthometric heights',
      sources: ['srtm/S21E057.tif, gmted/30S030E_20101117_gmted_mea075.tif'],
      attribution: 'Data courtesy of the U.S. Geological Survey.',
      resolutionNote: 'GMTED2010 fallback is 250 m or coarser.',
      acquiredAt: '2026-10-26T09:00:00.000Z',
    },
  };
}

describe('Site import normalization', () => {
  it('preserves valid samples and bounded source metadata without refreshing acquisition dates', () => {
    for (let i = 0; i < 3; i++) {
      const input = { ...sampleSite(i), publicData: snapshot() };
      expect(normaliseGeoSite(input)).toEqual(input);
    }
  });

  it.each(['polygon', 'anchor', 'origin'] as const)('rejects a mismatched %s', (field) => {
    const site = sampleSite();
    if (field === 'polygon') site.polygon[1].x += 1e6;
    if (field === 'anchor') site.anchor.x += 1;
    if (field === 'origin') site.origin = [site.origin[0] + 0.001, site.origin[1]];
    expect(normaliseGeoSite(site)).toBeUndefined();
  });

  it('rejects a date-line alias before tangent-plane projection', () => {
    const site = sampleSite();
    site.boundary = [
      [179.999, 0],
      [-179.999, 0],
      [-179.999, 0.0001],
      [179.999, 0.0001],
    ];
    site.origin = site.boundary[0];
    expect(normaliseGeoSite(site)).toBeUndefined();
  });

  it('rejects a repeated nonadjacent corner rather than accepting a touching outline', () => {
    const site = sampleSite();
    const points = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
      { x: 0, y: 0 },
      { x: -10, y: 0 },
      { x: -10, y: -10 },
      { x: 0, y: -10 },
    ];
    site.boundary = points.map((point) => toLonLat(point, site.origin));
    site.polygon = points;
    site.anchor = { x: 0, y: 0 };
    expect(normaliseGeoSite(site)).toBeUndefined();
  });

  it('rejects typed levels that no longer correspond to the current boundary', () => {
    const site = sampleSite();
    site.terrain!.points[0].x += 1;
    expect(normaliseGeoSite(site)).toBeUndefined();
  });

  it('never promotes public terrain into a cut/fill input', () => {
    const site = sampleSite();
    expect(
      normaliseGeoSite({ ...site, terrain: { ...site.terrain, source: 'public data' } }),
    ).toBeUndefined();
  });

  it.each([
    { contours: Array.from({ length: 201 }, () => [0, 1]) },
    { contours: Array.from({ length: 167 }, () => [0, 1, 2, 3, 0, 1]) },
    { contours: [[0, 4]] },
    { contours: [[0, 1.5]] },
  ])('rejects oversized or invalid contour indices', ({ contours }) => {
    const site = sampleSite();
    expect(
      normaliseGeoSite({ ...site, terrain: { ...site.terrain, source: 'survey', contours } }),
    ).toBeUndefined();
  });

  it('accepts the contour budget exactly at 200 lines and 1,000 indices', () => {
    const site = sampleSite();
    const contours = Array.from({ length: 200 }, () => [0, 1, 2, 3, 0]);
    expect(
      normaliseGeoSite({ ...site, terrain: { ...site.terrain, source: 'survey', contours } })
        ?.terrain?.contours,
    ).toEqual(contours);
  });

  it.each([
    ['sources', 'srtm/S21E057.tif'],
    ['sources', [{}]],
    ['attribution', { text: 'unexpected object' }],
    ['resolutionNote', ['unexpected array']],
    ['acquiredAt', 'not a date'],
    ['heightsM', [1, 2, 3]],
    ['resolutionM', 0],
    ['verticalReference', ''],
  ])('rejects malformed terrain metadata: %s', (key, value) => {
    const publicData = snapshot();
    expect(
      normaliseGeoSite({
        ...sampleSite(),
        publicData: { ...publicData, terrain: { ...publicData.terrain, [key as string]: value } },
      }),
    ).toBeUndefined();
  });

  it.each([
    ['annualKwh', -1],
    ['tiltDeg', -1],
    ['radiationDatabase', {}],
    ['version', []],
    ['periodStartYear', 2024],
    ['periodEndYear', 2020.5],
    ['acquiredAt', 'invalid'],
    ['sourceUrl', 'https://re.jrc.ec.europa.eu.evil.invalid/api'],
  ])('rejects malformed solar metadata: %s', (key, value) => {
    const publicData = snapshot();
    expect(
      normaliseGeoSite({
        ...sampleSite(),
        publicData: { ...publicData, solar: { ...publicData.solar, [key as string]: value } },
      }),
    ).toBeUndefined();
  });

  it.each([
    ['roads', 0.5],
    ['landuse', [{}]],
    ['sourceUrl', 'javascript:alert(1)'],
    ['acquiredAt', 123],
  ])('rejects malformed context metadata: %s', (key, value) => {
    const publicData = snapshot();
    expect(
      normaliseGeoSite({
        ...sampleSite(),
        publicData: { ...publicData, context: { ...publicData.context, [key as string]: value } },
      }),
    ).toBeUndefined();
  });

  it('omits unknown fields at every level without retaining aliases or following circular extras', () => {
    const site = sampleSite(),
      publicData = snapshot();
    const unknown: { cycle?: unknown } = {};
    unknown.cycle = unknown;
    const result = normaliseGeoSite({
      ...site,
      unknown,
      anchor: { ...site.anchor, unknown },
      terrain: {
        ...site.terrain,
        unknown,
        points: site.terrain!.points.map((p) => ({ ...p, unknown })),
      },
      publicData: {
        ...publicData,
        unknown,
        terrain: { ...publicData.terrain, unknown },
        context: { ...publicData.context, unknown },
        solar: { ...publicData.solar, unknown },
      },
    });
    expect(result).toEqual({ ...site, publicData });
    result!.terrain!.points[0].z = 999;
    result!.publicData!.terrain!.sources!.push('new');
    expect(site.terrain!.points[0].z).toBe(100);
    expect(publicData.terrain!.sources).toHaveLength(1);
  });

  it('keeps unknown provider results absent and supports older metadata without acquisition timestamps', () => {
    const site = sampleSite();
    const result = normaliseGeoSite(site);
    expect(result?.publicData).toEqual(site.publicData);
    expect(result?.publicData?.solar).toBeUndefined();
    expect(result?.publicData?.terrain).toBeUndefined();
    expect(result?.publicData?.context).toBeUndefined();
    expect(normaliseGeoSite({ ...site, sample: 'true' })).toBeUndefined();
  });
});
