import { describe, expect, it } from 'vitest';
import {
  calculateComponentCarbon,
  convertCarbonQuantity,
  matchMaterialSources,
  rankSurfaceTechnologies,
  screenHygrothermal,
  screenSurfaceTechnology,
  summarizeComponentCarbon,
  windKineticEnergyUpperBoundKwh,
  type ComponentCarbonInput,
  type MaterialSourceCandidate,
  type SurfaceTechnologyInput,
} from '../sustainability';
import { MAURITIUS_MATERIAL_CANDIDATES } from '../sustainabilityEvidence';

describe('tropical moisture screening', () => {
  it('calculates dew point and flags a cooled surface at risk of condensation', () => {
    const result = screenHygrothermal({
      airTemperatureC: 30,
      relativeHumidityPct: 80,
      surfaceTemperatureC: 24,
    });
    expect(result.dewPointC).toBeCloseTo(26.17, 1);
    expect(result.surfaceRhPct).toBe(100);
    expect(result.condensation).toBe('possible');
    expect(result.mouldReview).toBe('needs-evidence');
  });
  it('preserves the measured RH at an equal air and surface temperature', () => {
    const result = screenHygrothermal({
      airTemperatureC: 25,
      relativeHumidityPct: 60,
      surfaceTemperatureC: 25,
    });
    expect(result.surfaceRhPct).toBeCloseTo(60, 8);
    expect(result.dewPointC).toBeCloseTo(16.693, 2);
    expect(result.condensation).toBe('not-at-entered-conditions');
  });
  it('recognises saturation exactly at dew point', () => {
    const result = screenHygrothermal({
      airTemperatureC: 25,
      relativeHumidityPct: 100,
      surfaceTemperatureC: 25,
    });
    expect(result.dewPointC).toBeCloseTo(25);
    expect(result.condensation).toBe('possible');
  });
  it.each([0, -1, 101, NaN, Infinity])('rejects invalid RH %s', (relativeHumidityPct) => {
    expect(
      screenHygrothermal({ airTemperatureC: 25, relativeHumidityPct, surfaceTemperatureC: 24 })
        .status,
    ).toBe('invalid');
  });
  it.each([-10, 61, NaN, Infinity])('does not extrapolate temperatures %s', (airTemperatureC) => {
    expect(
      screenHygrothermal({ airTemperatureC, relativeHumidityPct: 80, surfaceTemperatureC: 24 })
        .status,
    ).toBe('invalid');
  });
  it('withholds surface risk if surface temperature is missing', () => {
    const result = screenHygrothermal({ airTemperatureC: 30, relativeHumidityPct: 80 });
    expect(result.dewPointC).not.toBeNull();
    expect(result.surfaceRhPct).toBeNull();
    expect(result.condensation).toBe('unknown');
    expect(result.status).toBe('needs-data');
  });
  it('does not turn an island name or material name into assumed climate or performance', () => {
    const result = screenHygrothermal({ materialName: 'Mauritius hemp wall' });
    expect(result.dewPointC).toBeNull();
    expect(result.dryingDays).toBeNull();
    expect(result.mouldReview).toBe('needs-evidence');
  });
  it('compares a sourced threshold with its required exposure duration', () => {
    const input = {
      airTemperatureC: 25,
      relativeHumidityPct: 90,
      surfaceTemperatureC: 25,
      mouldThreshold: {
        surfaceRhPct: 85,
        minimumExposureHours: 72,
        source: 'Material test report ABC',
      },
    };
    expect(screenHygrothermal({ ...input, exposureHours: 72 }).mouldReview).toBe(
      'threshold-exceeded',
    );
    expect(screenHygrothermal({ ...input, exposureHours: 48 }).mouldReview).toBe(
      'below-entered-threshold',
    );
    expect(screenHygrothermal(input).mouldReview).toBe('needs-evidence');
    expect(
      screenHygrothermal({
        ...input,
        exposureHours: 72,
        mouldThreshold: { ...input.mouldThreshold, source: '' },
      }).mouldReview,
    ).toBe('needs-evidence');
  });
  it('needs matching conditions and measured drying evidence, then uses percentage points', () => {
    const drying = {
      initialMoisturePct: 25,
      targetMoisturePct: 15,
      percentagePointsPerDay: 2,
      conditionsMatch: true,
      source: 'Site matched sample test 1',
    };
    expect(screenHygrothermal({ drying }).dryingDays).toBe(5);
    expect(
      screenHygrothermal({ drying: { ...drying, conditionsMatch: false } }).dryingDays,
    ).toBeNull();
    expect(screenHygrothermal({ drying: { ...drying, source: '' } }).dryingDays).toBeNull();
    expect(screenHygrothermal({ drying: { ...drying, percentagePointsPerDay: 0 } }).status).toBe(
      'invalid',
    );
  });
  it('does not produce negative drying days when target is already met', () => {
    expect(
      screenHygrothermal({
        drying: {
          initialMoisturePct: 10,
          targetMoisturePct: 15,
          percentagePointsPerDay: 2,
          source: 'Test',
          conditionsMatch: true,
        },
      }).dryingDays,
    ).toBe(0);
  });
  it('does not expose a nonfinite drying schedule', () => {
    const result = screenHygrothermal({
      drying: {
        initialMoisturePct: Number.MAX_VALUE,
        targetMoisturePct: 0,
        percentagePointsPerDay: Number.MIN_VALUE,
        source: 'Test',
        conditionsMatch: true,
      },
    });
    expect(result.dryingDays).toBeNull();
    expect(result.status).toBe('invalid');
  });
});

const carbonInput = (
  id = 'wall',
  overrides: Partial<ComponentCarbonInput> = {},
): ComponentCarbonInput => ({
  id,
  quantity: 10,
  unit: 'm2',
  declaration: { kgCo2ePerUnit: 2, unit: 'kg', boundary: 'A1-A3', source: 'Product EPD' },
  conversion: { densityKgM3: 500, thicknessM: 0.2, source: 'Declared dimensions' },
  ...overrides,
});
describe('dimensionally explicit component carbon', () => {
  it('supports declarations per litre and exact SI volume conversion without guessing density', () => {
    expect(
      calculateComponentCarbon({
        id: 'paint',
        quantity: 10,
        unit: 'L',
        declaration: {
          kgCo2ePerUnit: 2,
          unit: 'L',
          boundary: 'A1-A3',
          source: 'Paint EPD',
        },
      }).kgCo2e,
    ).toBe(20);
    expect(convertCarbonQuantity(1000, 'L', 'm3')).toBe(1);
    expect(convertCarbonQuantity(2, 'm3', 'L')).toBe(2000);
    expect(convertCarbonQuantity(10, 'L', 'kg')).toBeNull();
    expect(
      convertCarbonQuantity(10, 'L', 'kg', { densityKgM3: 1200, source: 'Product density' }),
    ).toBe(12);
    expect(
      convertCarbonQuantity(12, 'kg', 'L', { densityKgM3: 1200, source: 'Product density' }),
    ).toBe(10);
    expect(convertCarbonQuantity(Number.MAX_VALUE, 'm3', 'L')).toBeNull();
  });
  it('converts area and declared thickness to mass without changing the build geometry', () => {
    const input = carbonInput();
    const result = calculateComponentCarbon(input);
    expect(result.declaredQuantity).toBe(1000);
    expect(result.kgCo2e).toBe(2000);
    expect(input.quantity).toBe(10);
    expect(convertCarbonQuantity(1000, 'kg', 'm2', input.conversion)).toBe(10);
  });
  it('supports exact item attributes and their reverse', () => {
    const c = { massKgPerItem: 20, areaM2PerItem: 0.5, volumeM3PerItem: 0.1, source: 'SKU sheet' };
    expect(convertCarbonQuantity(4, 'item', 'kg', c)).toBe(80);
    expect(convertCarbonQuantity(80, 'kg', 'item', c)).toBe(4);
    expect(convertCarbonQuantity(4, 'item', 'm2', c)).toBe(2);
    expect(convertCarbonQuantity(4, 'item', 'm3', c)).toBe(0.4);
  });
  it('requires evidence for conversion and never treats wall length as area', () => {
    expect(calculateComponentCarbon(carbonInput('a', { conversion: undefined })).kgCo2e).toBeNull();
    expect(
      convertCarbonQuantity(10, 'm2', 'kg', { densityKgM3: 500, thicknessM: 0.2, source: '' }),
    ).toBeNull();
    expect(convertCarbonQuantity(10, 'm', 'm2', { thicknessM: 0.2, source: 'sheet' })).toBeNull();
  });
  it('treats absent declarations as unknown even for zero quantity', () => {
    expect(
      calculateComponentCarbon(carbonInput('a', { quantity: 0, declaration: undefined })).kgCo2e,
    ).toBeNull();
    expect(calculateComponentCarbon(carbonInput('a', { quantity: 0 })).kgCo2e).toBe(0);
  });
  it('rejects invalid quantity, factor and overflow', () => {
    expect(calculateComponentCarbon(carbonInput('a', { quantity: -1 })).status).toBe('invalid');
    expect(
      calculateComponentCarbon(
        carbonInput('a', {
          declaration: { unit: 'm2', source: 'EPD', boundary: 'A1-A3', kgCo2ePerUnit: NaN },
        }),
      ).status,
    ).toBe('invalid');
    expect(
      calculateComponentCarbon(carbonInput('a', { quantity: Number.MAX_VALUE })).kgCo2e,
    ).toBeNull();
  });
  it('preserves declared negative biogenic factors without turning them into permanent offsets', () => {
    const result = calculateComponentCarbon(
      carbonInput('a', {
        unit: 'kg',
        declaration: { unit: 'kg', source: 'EPD', boundary: 'A1-A3', kgCo2ePerUnit: -2 },
      }),
    );
    expect(result.kgCo2e).toBe(-20);
    expect(result.warnings.join(' ')).toContain('does not establish permanent removal');
  });
  it('withholds a complete total for mixed scopes or missing products and reports record coverage', () => {
    const a = calculateComponentCarbon(carbonInput('a'));
    const b = calculateComponentCarbon(carbonInput('b', { declaration: undefined }));
    const missing = summarizeComponentCarbon([a, b]);
    expect(missing.coveragePct).toBe(50);
    expect(missing.totalsByBoundary['A1-A3']).toBe(2000);
    expect(missing.completeComparableTotalKgCo2e).toBeNull();
    const mixed = summarizeComponentCarbon([a, { ...a, id: 'c', boundary: 'A1-C4' }]);
    expect(mixed.coveragePct).toBe(100);
    expect(mixed.completeComparableTotalKgCo2e).toBeNull();
    expect(summarizeComponentCarbon([a, { ...a, id: 'b' }]).completeComparableTotalKgCo2e).toBe(
      4000,
    );
  });
  it('does not claim a complete empty or duplicate total', () => {
    expect(summarizeComponentCarbon([]).completeComparableTotalKgCo2e).toBeNull();
    const a = calculateComponentCarbon(carbonInput());
    expect(summarizeComponentCarbon([a, a]).completeComparableTotalKgCo2e).toBeNull();
    expect(Object.keys(summarizeComponentCarbon([a, a]).totalsByBoundary)).toHaveLength(0);
  });
  it('withholds overflowing subtotals without showing infinity', () => {
    const a = { ...calculateComponentCarbon(carbonInput()), kgCo2e: Number.MAX_VALUE };
    const summary = summarizeComponentCarbon([a, { ...a, id: 'second' }]);
    expect(summary.completeComparableTotalKgCo2e).toBeNull();
    expect(Object.keys(summary.totalsByBoundary)).toHaveLength(0);
  });
  it('handles arbitrary scope text without prototype lookup or pollution', () => {
    const a = calculateComponentCarbon(carbonInput());
    const summary = summarizeComponentCarbon([{ ...a, boundary: '__proto__' }]);
    expect(summary.totalsByBoundary.__proto__).toBe(2000);
    expect(summary.completeComparableTotalKgCo2e).toBe(2000);
  });
});

describe('Mauritius sourcing evidence', () => {
  it('distinguishes local research, import candidates and actual local manufacture', () => {
    const hemp = matchMaterialSources({ materialFamily: 'hemp' }, MAURITIUS_MATERIAL_CANDIDATES);
    expect(hemp.find((c) => c.origin === 'local-research')?.availability).toBe('research-only');
    expect(hemp.find((c) => c.origin === 'import-candidate')?.availability).toBe('catalogue-only');
    expect(hemp.every((c) => c.timing === 'unknown' && c.useMatch === 'needs-review')).toBe(true);
    const blocks = matchMaterialSources(
      { materialFamily: 'concrete-block' },
      MAURITIUS_MATERIAL_CANDIDATES,
    );
    expect(blocks).toHaveLength(2);
    expect(blocks.every((c) => c.origin === 'mauritius-made')).toBe(true);
  });
  it('does not turn a catalogue or research trial into a delivery commitment', () => {
    const base: MaterialSourceCandidate = {
      id: 'a',
      name: 'Test',
      materialFamilies: ['test'],
      origin: 'mauritius-made',
      evidenceUrl: 'https://example.org/product',
      evidenceNote: 'Catalogue',
      confirmedDeliveryDate: '2026-11-20',
    };
    const request = { materialFamily: 'test', neededBy: '2026-12-01' };
    expect(matchMaterialSources(request, [base])[0].timing).toBe('unknown');
    expect(
      matchMaterialSources(request, [
        { ...base, deliveryEvidence: 'Supplier confirmed this order' },
      ])[0].timing,
    ).toBe('on-time');
    expect(
      matchMaterialSources({ ...request, neededBy: '2026-11-10' }, [
        { ...base, deliveryEvidence: 'Order confirmation' },
      ])[0].timing,
    ).toBe('late');
    expect(
      matchMaterialSources(request, [
        { ...base, origin: 'local-research', deliveryEvidence: 'Unverified promise' },
      ])[0].availability,
    ).toBe('research-only');
  });
  it('does not treat invalid rollover dates as a confirmed delivery', () => {
    const source: MaterialSourceCandidate = {
      id: 'a',
      name: 'Test',
      materialFamilies: ['test'],
      origin: 'import-candidate',
      evidenceUrl: 'https://example.org',
      evidenceNote: 'Test',
      confirmedDeliveryDate: '2026-02-30',
      deliveryEvidence: 'Order',
    };
    expect(
      matchMaterialSources({ materialFamily: 'test', neededBy: '2026-12-01' }, [source])[0]
        .availability,
    ).toBe('catalogue-only');
  });
  it('keeps unknown mycelium supply visible without a fake merchant or price', () => {
    const candidates = matchMaterialSources(
      { materialFamily: 'mycelium' },
      MAURITIUS_MATERIAL_CANDIDATES,
    );
    expect(candidates.find((c) => c.origin === 'unknown')?.availability).toBe('unverified');
    expect(candidates.every((c) => !c.confirmedDeliveryDate)).toBe(true);
    expect(matchMaterialSources({ materialFamily: '' }, MAURITIUS_MATERIAL_CANDIDATES)).toEqual([]);
  });
});

const surface = (overrides: Partial<SurfaceTechnologyInput> = {}): SurfaceTechnologyInput => ({
  id: 'tile',
  name: 'Test tile',
  kind: 'piezo',
  areaM2: 10,
  annualActivations: 3_600_000,
  trafficSource: 'Annual count',
  joulesPerActivation: 2,
  yieldSource: 'Delivered-joule test',
  annualAuxiliaryKwh: 0.2,
  auxiliarySource: 'Auxiliary-meter test',
  embodiedCarbonKgCo2e: 4,
  carbonBoundary: 'A1-C4',
  carbonSource: 'Whole assembly assessment',
  gridKgCo2ePerKwh: 0.5,
  gridSource: 'Project baseline',
  annualOtherOperatingKgCo2e: 0.1,
  operatingCarbonSource: 'Maintenance inventory',
  serviceLifeYears: 10,
  lifetimeSource: 'Warranty and durability study',
  ...overrides,
});
describe('surface technology metrics rather than fabricated eco scores', () => {
  it('converts joules to kWh and deducts measured auxiliaries before area intensity', () => {
    const result = screenSurfaceTechnology(surface());
    expect(result.annualGrossKwh).toBe(2);
    expect(result.annualNetElectricalKwh).toBe(1.8);
    expect(result.energyKwhPerM2Year).toBe(0.18);
    expect(result.embodiedKgCo2ePerM2).toBe(0.4);
    expect(result.annualNetAvoidedKgCo2e).toBe(0.8);
    expect(result.carbonPaybackYears).toBe(5);
  });
  it('withholds generated energy if only footfall or motorway traffic is known', () => {
    expect(screenSurfaceTechnology(surface({ yieldSource: undefined })).annualGrossKwh).toBeNull();
    expect(
      screenSurfaceTechnology(surface({ joulesPerActivation: undefined })).annualGrossKwh,
    ).toBeNull();
    expect(
      screenSurfaceTechnology(surface({ trafficSource: undefined })).annualGrossKwh,
    ).toBeNull();
  });
  it('requires evidence even for zero auxiliary consumption', () => {
    expect(
      screenSurfaceTechnology(surface({ annualAuxiliaryKwh: 0, auxiliarySource: '' }))
        .annualNetElectricalKwh,
    ).toBeNull();
    expect(screenSurfaceTechnology(surface({ annualAuxiliaryKwh: 0 })).annualNetElectricalKwh).toBe(
      2,
    );
  });
  it('keeps negative electrical return and avoids misleading positive payback', () => {
    const result = screenSurfaceTechnology(surface({ annualAuxiliaryKwh: 5 }));
    expect(result.annualNetElectricalKwh).toBe(-3);
    expect(result.annualNetAvoidedKgCo2e).toBe(-1.6);
    expect(result.carbonPaybackYears).toBeNull();
  });
  it('requires a vehicle emissions assessment before claiming traffic turbine carbon benefit', () => {
    const input = surface({ kind: 'traffic-turbine' });
    const unknown = screenSurfaceTechnology(input);
    expect(unknown.annualGrossKwh).toBe(2);
    expect(unknown.annualNetAvoidedKgCo2e).toBeNull();
    expect(unknown.carbonPaybackYears).toBeNull();
    const penalty = screenSurfaceTechnology({
      ...input,
      annualVehiclePenaltyKgCo2e: 1,
      vehiclePenaltySource: 'Controlled baseline trial',
    });
    expect(penalty.annualNetAvoidedKgCo2e).toBeCloseTo(-0.2);
  });
  it('moss does not generate power or unverified carbon credits and has exposure-specific review', () => {
    const windward = screenSurfaceTechnology(surface({ kind: 'moss', exposure: 'windward' }));
    expect(windward.annualGrossKwh).toBe(0);
    expect(windward.annualNetElectricalKwh).toBe(-0.2);
    expect(windward.carbonPaybackYears).toBeNull();
    expect(windward.warnings.join(' ')).toContain('driving rain');
    expect(
      screenSurfaceTechnology(surface({ kind: 'moss', exposure: 'leeward' })).warnings.join(' '),
    ).toContain('irrigation');
  });
  it('withholds payback without life evidence, for beyond-life repayment or negative embodied factors', () => {
    expect(
      screenSurfaceTechnology(surface({ lifetimeSource: undefined })).carbonPaybackYears,
    ).toBeNull();
    expect(screenSurfaceTechnology(surface({ serviceLifeYears: 1 })).carbonPaybackYears).toBeNull();
    expect(
      screenSurfaceTechnology(surface({ embodiedCarbonKgCo2e: -2 })).carbonPaybackYears,
    ).toBeNull();
  });
  it.each([0, -1, NaN, Infinity])('rejects invalid area %s', (areaM2) => {
    expect(screenSurfaceTechnology(surface({ areaM2 })).status).toBe('invalid');
  });
  it('rejects negative and overflowing physical quantities', () => {
    expect(screenSurfaceTechnology(surface({ joulesPerActivation: -2 })).status).toBe('invalid');
    expect(
      screenSurfaceTechnology(
        surface({ annualActivations: Number.MAX_VALUE, joulesPerActivation: Number.MAX_VALUE }),
      ).status,
    ).toBe('invalid');
  });
  it('ranks known net-electric intensity only and leaves missing evidence unranked', () => {
    const results = rankSurfaceTechnologies([
      surface({ id: 'low' }),
      surface({ id: 'high', areaM2: 5 }),
      surface({ id: 'unknown', yieldSource: undefined }),
      surface({ id: 'moss', kind: 'moss' }),
      surface({ id: 'equal', areaM2: 5 }),
    ]);
    expect(results.map((r) => r.energyRank)).toEqual([3, 1, null, null, 1]);
  });
});

describe('wind kinetic upper bound', () => {
  it('integrates individual speed bins with cube law rather than cubing a mean', () => {
    const result = windKineticEnergyUpperBoundKwh({
      airDensityKgM3: 1.2,
      sweptAreaM2: 2,
      bins: [
        { speedMps: 5, hours: 100 },
        { speedMps: 10, hours: 100 },
      ],
      source: 'Rotor-height anemometer',
    });
    expect(result).toBe(135);
    expect(result).not.toBe((0.5 * 1.2 * 2 * 7.5 ** 3 * 200) / 1000);
  });
  it('rejects unknown evidence, negative bins and time exceeding a leap year', () => {
    const input = {
      airDensityKgM3: 1.2,
      sweptAreaM2: 2,
      bins: [{ speedMps: 5, hours: 100 }],
      source: 'Measured',
    };
    expect(windKineticEnergyUpperBoundKwh({ ...input, source: '' })).toBeNull();
    expect(
      windKineticEnergyUpperBoundKwh({ ...input, bins: [{ speedMps: -1, hours: 100 }] }),
    ).toBeNull();
    expect(
      windKineticEnergyUpperBoundKwh({ ...input, bins: [{ speedMps: 5, hours: 8785 }] }),
    ).toBeNull();
    expect(windKineticEnergyUpperBoundKwh({ ...input, bins: [] })).toBeNull();
  });
});
