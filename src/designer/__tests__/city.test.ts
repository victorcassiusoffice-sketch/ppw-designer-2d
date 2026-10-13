import { describe, expect, it } from 'vitest';
import { CitySchema } from '../cityContract';
import {
  cityAssetPolygon,
  cityBounds,
  cityNetworkLengthM,
  cityPolygonUnionArea,
  cityRoadPolygons,
  cityTrenchUnionVolume,
  emptyCity,
  estimateCity,
  estimateCityDataCentre,
  normaliseCity,
  sampleCity,
  type CityAsset,
  type CityModel,
  type CityNetwork,
  type CityRoad,
} from '../city';
const road = (patch: Partial<CityRoad> = {}): CityRoad => ({
  id: 'road-1',
  name: 'Access',
  presetId: 'custom',
  points: [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
  ],
  widthM: 6,
  surfaceDepthM: 0.05,
  baseDepthM: 0.2,
  ...patch,
});
const network = (patch: Partial<CityNetwork> = {}): CityNetwork => ({
  id: 'water-1',
  name: 'Water main',
  system: 'water',
  points: [
    { x: 0, y: 0, z: -0.5 },
    { x: 10, y: 0, z: -0.5 },
  ],
  diameterMm: 100,
  trenchWidthM: 1,
  trenchDepthM: 1,
  ...patch,
});
const asset = (patch: Partial<CityAsset> = {}): CityAsset => ({
  id: 'building-1',
  name: 'Building envelope',
  kind: 'building',
  x: 0,
  y: 0,
  widthM: 20,
  lengthM: 10,
  heightM: 8,
  rotation: 0,
  ...patch,
});
const city = (patch: Partial<CityModel> = {}): CityModel => ({ ...emptyCity(), ...patch });

describe('canonical City Build metre geometry', () => {
  it('round-trips the explicit sample without touching or inventing house data', () => {
    expect(CitySchema.parse(sampleCity())).toEqual(sampleCity());
    expect(normaliseCity(sampleCity())).toEqual(sampleCity());
    expect(estimateCity(sampleCity()).quantitiesComplete).toBe(true);
    expect(sampleCity().assets.filter((a) => a.buildingLink === 'current')).toHaveLength(1);
    expect(sampleCity().assets.some((a) => a.supplierRef)).toBe(false);
  });
  it('uses the same corridor footprint for area and both view adapters', () => {
    const r = road();
    expect(cityRoadPolygons(r)).toEqual([
      [
        { x: 0, y: 3 },
        { x: 100, y: 3 },
        { x: 100, y: -3 },
        { x: 0, y: -3 },
      ],
    ]);
    const e = estimateCity(city({ roads: [r] }));
    expect(e.roadAreaM2).toBe(600);
    expect(e.roadSurfaceM3).toBe(30);
    expect(e.roadBaseM3).toBe(120);
  });
  it('counts road crossings once while preserving total drawn centre-line length', () => {
    const e = estimateCity(
      city({
        roads: [
          road(),
          road({
            id: 'cross',
            points: [
              { x: 50, y: -50 },
              { x: 50, y: 50 },
            ],
          }),
        ],
      }),
    );
    expect(e.roadLengthM).toBe(200);
    expect(e.roadAreaM2).toBe(1164);
    expect(e.roadSurfaceM3).toBeCloseTo(58.2);
    expect(e.roadBaseM3).toBeCloseTo(232.8);
  });
  it('deduplicates a reversed duplicate and self-overlapping road corridor', () => {
    const r = road({
      points: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 0, y: 0 },
      ],
    });
    expect(estimateCity(city({ roads: [r] })).roadAreaM2).toBe(600);
    expect(
      estimateCity(
        city({
          roads: [
            road(),
            road({
              id: 'back',
              points: [
                { x: 100, y: 0 },
                { x: 0, y: 0 },
              ],
            }),
          ],
        }),
      ).roadAreaM2,
    ).toBe(600);
  });
  it('withholds conflicting overlapping road layer/specification volumes', () => {
    for (const change of [
      { baseDepthM: 0.3 },
      { surfaceDepthM: 0.1 },
      { supplierRef: 'different-paving' },
    ]) {
      const e = estimateCity(city({ roads: [road(), road({ id: 'other', ...change })] }));
      expect(e.roadAreaM2).toBe(600);
      expect(e.roadSurfaceM3).toBeNull();
      expect(e.roadBaseM3).toBeNull();
      expect(e.quantitiesComplete).toBe(false);
    }
  });
  it('allows adjacent non-overlapping roads with different layer depths', () => {
    const e = estimateCity(
      city({
        roads: [
          road(),
          road({
            id: 'other',
            points: [
              { x: 100, y: 0 },
              { x: 200, y: 0 },
            ],
            surfaceDepthM: 0.1,
          }),
        ],
      }),
    );
    expect(e.roadAreaM2).toBe(1200);
    expect(e.roadSurfaceM3).toBeCloseTo(90);
    expect(e.quantitiesComplete).toBe(true);
  });
  it('uses exact diagonal and rotated footprints rather than bounding-box area', () => {
    const r = road({
      points: [
        { x: 0, y: 0 },
        { x: 3, y: 4 },
      ],
      widthM: 2,
    });
    expect(cityPolygonUnionArea(cityRoadPolygons(r))).toBeCloseTo(10);
    const polygon = cityAssetPolygon(asset({ rotation: 45 }));
    expect(cityPolygonUnionArea([polygon])).toBeCloseTo(200);
    expect(estimateCity(city({ assets: [asset(), asset({ id: 'duplicate' })] })).footprintM2).toBe(
      200,
    );
  });
  it('keeps elevations in each service segment and rounds stock per route', () => {
    const points = [
      { x: 0, y: 0, z: 0 },
      { x: 3, y: 0, z: 4 },
      { x: 6, y: 0, z: 0 },
    ];
    expect(cityNetworkLengthM(points)).toBe(10);
    const e = estimateCity(city({ networks: [network({ points, stockLengthM: 6 })] }));
    expect(e.networks[0].lengthM).toBe(10);
    expect(e.networks[0].planLengthM).toBe(6);
    expect(e.networks[0].stockLengths).toBe(2);
    expect(e.quantityIncompleteReasons.join(' ')).toContain('outside');
  });
  it('unions same and differing-depth trenches without deleting pipe quantities', () => {
    const e = estimateCity(
      city({ networks: [network(), network({ id: 'power', system: 'power', trenchDepthM: 2 })] }),
    );
    expect(e.trenchUniqueVolumeM3).toBe(20);
    expect(e.networkLengthsM.water).toBe(10);
    expect(e.networkLengthsM.power).toBe(10);
    expect(e.networks[0].stockLengths).toBeNull();
    const crossed = estimateCity(
      city({
        networks: [
          network(),
          network({
            id: 'cross',
            points: [
              { x: 5, y: -5, z: -0.5 },
              { x: 5, y: 5, z: -0.5 },
            ],
            trenchDepthM: 2,
          }),
        ],
      }),
    );
    expect(crossed.trenchUniqueVolumeM3).toBe(29);
  });
  it('counts riser length and marks missing shaft excavation explicitly', () => {
    const e = estimateCity(
      city({
        networks: [
          network({
            points: [
              { x: 0, y: 0, z: -0.2 },
              { x: 0, y: 0, z: -0.8 },
            ],
          }),
        ],
      }),
    );
    expect(e.networks[0].lengthM).toBeCloseTo(0.6);
    expect(e.trenchUniqueVolumeM3).toBe(0);
    expect(e.quantitiesComplete).toBe(false);
    expect(e.quantityIncompleteReasons.join(' ')).toContain('Vertical risers');
  });
  it('weighted trench sweep agrees with independent depth-stratum unions for oblique multi-depth corridors', () => {
    const prisms = Array.from({ length: 12 }, (_, i) => ({
      polygon: cityAssetPolygon(
        asset({
          x: (i % 4) * 2,
          y: Math.floor(i / 4) * 2,
          widthM: 11,
          lengthM: 0.6 + i / 10,
          rotation: i * 17,
        }),
      ),
      depthM: 0.8 + (i % 4) * 0.3,
    }));
    const depths = [...new Set(prisms.map((p) => p.depthM))].sort((a, b) => a - b);
    const stratified = depths.reduce(
      (sum, depth, i) =>
        sum +
        (depth - (depths[i - 1] ?? 0)) *
          cityPolygonUnionArea(prisms.filter((p) => p.depthM >= depth).map((p) => p.polygon)),
      0,
    );
    expect(cityTrenchUnionVolume(prisms)).toBeCloseTo(stratified, 8);
    expect(cityTrenchUnionVolume(prisms)).toBeLessThan(
      prisms.reduce((sum, p) => sum + cityPolygonUnionArea([p.polygon]) * p.depthM, 0),
    );
  });
  it('does not silently clip offsite geometry or clip view bounds', () => {
    const m = city({ site: { originM: { x: 0, y: 0 }, widthM: 10, lengthM: 10 }, roads: [road()] });
    expect(estimateCity(m).roadAreaM2).toBe(600);
    expect(estimateCity(m).warnings.join(' ')).toContain('beyond');
    expect(cityBounds(m)).toEqual({ minX: 0, minY: -3, maxX: 100, maxY: 10, maxHeightM: 1 });
  });
  it('disables city takeoff without deleting the project geometry', () => {
    const e = estimateCity({ ...sampleCity(), enabled: false });
    expect(e.roadAreaM2).toBe(0);
    expect(e.assetCount).toBe(0);
    expect(e.trenchUniqueVolumeM3).toBe(0);
    expect(e.dataCentre).toBeNull();
  });
});

describe('City Build data centre and resource scenarios', () => {
  const inputs = {
    racks: 10,
    kWPerRack: 5,
    utilisation: 0.5,
    pue: 1.4,
    annualHours: 8760,
    pvKWp: 100,
    yieldKWhPerKWp: 1500,
    batteryKWh: 100,
    batteryUsableFraction: 0.8,
  };
  it('keeps IT / facility / solar and storage units separate without claiming carbon savings', () => {
    const e = estimateCityDataCentre(inputs);
    expect(e.installedITKW).toBe(50);
    expect(e.averageITKW).toBe(25);
    expect(e.averageFacilityKW).toBe(35);
    expect(e.annualITKWh).toBe(219000);
    expect(e.annualFacilityKWh).toBe(306600);
    expect(e.annualSolarKWh).toBe(150000);
    expect(e.annualBalanceKWh).toBe(-156600);
    expect(e.batteryAutonomyHours).toBeCloseTo(80 / 35);
    expect(e.annualWaterL).toBeNull();
  });
  it('uses WUE per IT energy and does not equate PUE with renewable fraction', () => {
    const e = estimateCityDataCentre({ ...inputs, pue: 2, wueLPerKWh: 0.4 });
    expect(e.annualWaterL).toBe(87600);
    expect(e.annualFacilityKWh).toBe(438000);
    expect(e.annualSolarKWh).toBe(150000);
  });
  it('keeps a zero-load scenario finite without infinite autonomy', () => {
    const e = estimateCityDataCentre({ ...inputs, utilisation: 0 });
    expect(e.batteryAutonomyHours).toBeNull();
    expect(e.annualSolarEquivalentPct).toBeNull();
    expect(e.annualFacilityKWh).toBe(0);
  });
  it('requires explicit operating hours for known asset loads and preserves unknown stock size', () => {
    const a = asset({ kind: 'solar-light', powerW: 50 });
    expect(estimateCity(city({ assets: [a] })).assetDailyLoadKWh).toBeNull();
    expect(estimateCity(city({ assets: [{ ...a, hoursPerDay: 12 }] })).assetDailyLoadKWh).toBe(0.6);
    expect(
      estimateCity(city({ assets: [asset({ kind: 'water-tank', tankCapacityL: 10000 })] }))
        .tankCapacityL,
    ).toBe(10000);
  });
  it('reports unprovided capacity and power as unknown rather than inventing performance from size', () => {
    const e = estimateCity(
      city({
        assets: [
          asset({ id: 'pv', kind: 'pv-array' }),
          asset({ id: 'lamp', kind: 'solar-light' }),
          asset({ id: 'tank', kind: 'water-tank' }),
          asset({ id: 'battery', kind: 'battery' }),
        ],
      }),
    );
    expect(e.solarKWp).toBe(0);
    expect(e.unknownSolarAssetCount).toBe(2);
    expect(e.unknownBatteryAssetCount).toBe(2);
    expect(e.unknownTankAssetCount).toBe(1);
    expect(e.unknownAssetLoadCount).toBe(1);
    expect(e.knownAssetDailyLoadKWh).toBe(0);
    expect(e.assetDailyLoadKWh).toBeNull();
    expect(e.warnings.join(' ')).toContain('ratings or operating hours are unknown');
  });
});

describe('City Build external contract and migration boundaries', () => {
  it.each([NaN, Infinity, -Infinity])('rejects non-finite measurements (%s)', (value) => {
    expect(normaliseCity(city({ roads: [road({ widthM: value })] }))).toBeUndefined();
    expect(CitySchema.safeParse(city({ roads: [road({ widthM: value })] })).success).toBe(false);
  });
  it('rejects duplicates across entity groups and unknown external fields', () => {
    expect(
      normaliseCity(city({ roads: [road()], assets: [asset({ id: 'road-1' })] })),
    ).toBeUndefined();
    expect(CitySchema.safeParse({ ...emptyCity(), certified: true }).success).toBe(false);
    expect(
      CitySchema.safeParse(city({ roads: [{ ...road(), approved: true } as CityRoad] })).success,
    ).toBe(false);
  });
  it('rejects a pipe too large for its trench, zero segments and duplicate current-building links', () => {
    expect(normaliseCity(city({ networks: [network({ diameterMm: 1200 })] }))).toBeUndefined();
    expect(
      normaliseCity(
        city({
          roads: [
            road({
              points: [
                { x: 1, y: 1 },
                { x: 1, y: 1 },
              ],
            }),
          ],
        }),
      ),
    ).toBeUndefined();
    expect(
      normaliseCity(
        city({
          assets: [
            asset({ buildingLink: 'current' }),
            asset({ id: 'other', buildingLink: 'current' }),
          ],
        }),
      ),
    ).toBeUndefined();
    expect(
      normaliseCity(city({ assets: [asset({ kind: 'park', buildingLink: 'current' })] })),
    ).toBeUndefined();
  });
  it('caps aggregate route complexity independently of route count', () => {
    const points = Array.from({ length: 65 }, (_, i) => ({ x: i, y: 0 }));
    expect(
      normaliseCity(city({ roads: [road({ points }), road({ id: 'second', points })] })),
    ).toBeDefined();
    expect(
      normaliseCity(
        city({ roads: [road({ points }), road({ id: 'second', points }), road({ id: 'third' })] }),
      ),
    ).toBeUndefined();
  });
  it('withholds excessive depth-bucket trench union without losing route lengths', () => {
    const networks = Array.from({ length: 17 }, (_, i) =>
      network({ id: `n-${i}`, trenchDepthM: 1 + i * 0.1 }),
    );
    const e = estimateCity(city({ networks }));
    expect(e.trenchUniqueVolumeM3).toBeNull();
    expect(e.networkLengthsM.water).toBe(170);
    expect(e.quantityIncompleteReasons.join(' ')).toContain('16 distinct');
  });
  it('rejects invalid site extents rather than expanding house scale automatically', () => {
    expect(
      normaliseCity(city({ site: { originM: { x: 9900, y: 0 }, widthM: 500, lengthM: 200 } })),
    ).toBeUndefined();
    expect(
      normaliseCity(city({ site: { originM: { x: 0, y: 0 }, widthM: 10000, lengthM: 10000 } })),
    ).toBeDefined();
  });
  it('rejects invalid PUE, hours, fractional racks and impossible fractions', () => {
    for (const patch of [
      { pue: 0.8 },
      { annualHours: 9000 },
      { racks: 1.5 },
      { utilisation: 1.1 },
      { batteryUsableFraction: -0.1 },
    ]) {
      const dataCentre = { ...sampleCity().dataCentre!, ...patch };
      expect(normaliseCity(city({ dataCentre }))).toBeUndefined();
      expect(CitySchema.safeParse(city({ dataCentre })).success).toBe(false);
    }
  });
  it('never silently estimates a partly invalid project', () => {
    expect(() => estimateCity(city({ roads: [road({ widthM: -1 })] }))).toThrow(
      'quantities withheld',
    );
  });
});
