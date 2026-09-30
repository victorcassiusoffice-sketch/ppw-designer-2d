import { describe, expect, it } from 'vitest';
import { applyBlockPreset, applySheetPreset, defaultMaterialsSettings, estimateMaterials, estimateRebar, estimateVolumeMix, normaliseMaterialsSettings } from '..';
import type { MaterialsGeometry } from '..';

const empty = (): MaterialsGeometry => ({ walls: [], baseAreaM2: 0, roofAreaM2: 0, roofLengthM: 0, roofWidthM: 0, roofRectangular: true });
const blockWall = (): MaterialsGeometry => ({ ...empty(), walls: [{ id: 'w', lengthM: 4.6, heightM: 2.1, openingAreaM2: 0 }] });
const settings = () => { const value = defaultMaterialsSettings(); value.wall.wastePct = 0; value.mortar.wastePct = 0; return value; };

describe('materials wall quantities', () => {
  it('counts 100 real 450×200 mm blocks in a 460×210 mm joint-inclusive grid', () => {
    const report = estimateMaterials(blockWall(), settings());
    expect(report.totals.wallNetAreaM2).toBeCloseTo(9.66);
    expect(report.totals.blocks).toBe(100);
    expect(report.totals.mortarM3).toBeCloseTo(0.099);
  });

  it('adds a joint once for actual dimensions and never twice for nominal dimensions', () => {
    const value = settings();
    value.wall.blockLengthM = 0.46; value.wall.blockHeightM = 0.21; value.wall.dimensionBasis = 'nominal';
    const report = estimateMaterials(blockWall(), value);
    expect(report.totals.blocks).toBe(100);
    expect(report.totals.mortarM3).toBeCloseTo(0.099);
  });

  it('deducts openings before block, mortar and two-face plaster quantities', () => {
    const geometry = blockWall(); geometry.walls[0].openingAreaM2 = 0.966;
    const value = settings(); value.plaster.sides = 2; value.plaster.thicknessMm = 15; value.plaster.mix.wastePct = 0;
    const report = estimateMaterials(geometry, value);
    expect(report.totals.blocks).toBe(90);
    expect(report.totals.mortarM3).toBeCloseTo(0.0891);
    expect(report.totals.plasterM3).toBeCloseTo(8.694 * 2 * 0.015);
  });

  it('calculates joint bedding, not hollow core volume, with editable bedding fraction', () => {
    const value = settings(); value.wall.beddingFraction = 0.5;
    expect(estimateMaterials(blockWall(), value).totals.mortarM3).toBeCloseTo(0.0495);
    value.wall.jointMm = 0;
    expect(estimateMaterials(blockWall(), value).totals.mortarM3).toBe(0);
  });

  it('rounds purchase blocks after totaling fractional wall counts and waste', () => {
    const value = settings(); value.wall.wastePct = 5;
    const geometry = { ...empty(), walls: [{ id: 'a', lengthM: 2.3, heightM: 2.1, openingAreaM2: 0 }, { id: 'b', lengthM: 2.3, heightM: 2.1, openingAreaM2: 0 }] };
    expect(estimateMaterials(geometry, value).totals.blocks).toBe(105);
  });

  it('deduplicates repeated IDs on a storey but counts equal IDs on separate storeys', () => {
    const geometry = blockWall();
    geometry.walls.push({ ...geometry.walls[0] }, { ...geometry.walls[0], levelId: 'first' });
    const report = estimateMaterials(geometry, settings());
    expect(report.totals.blocks).toBe(200);
    expect(report.warnings).toContain('Duplicate wall w was counted once.');
  });

  it('caps impossible opening deductions and never creates negative quantities', () => {
    const geometry = blockWall(); geometry.walls[0].openingAreaM2 = 100;
    const report = estimateMaterials(geometry, settings());
    expect(report.totals.wallNetAreaM2).toBe(0);
    expect(report.totals.blocks).toBe(0);
    expect(report.warnings.some((warning) => warning.includes('capped'))).toBe(true);
  });

  it('replaces masonry with poured concrete without also counting blocks or mortar', () => {
    const value = settings(); value.wall.kind = 'concrete'; value.concrete.wastePct = 0;
    const report = estimateMaterials(blockWall(), value);
    expect(report.totals.concreteNetM3).toBeCloseTo(9.66 * 0.15);
    expect(report.totals.blocks).toBe(0); expect(report.totals.mortarM3).toBe(0);
  });
});

describe('concrete and mix procurement', () => {
  it('calculates independent ground slab, clear pillars and roof slab exactly once', () => {
    const geometry = { ...empty(), baseAreaM2: 100, roofAreaM2: 100, roofLengthM: 10, roofWidthM: 10 };
    const value = settings(); value.base.enabled = true; value.base.depthM = 0.15;
    value.pillars.count = 4; value.roof.kind = 'reinforced-concrete'; value.roof.depthM = 0.12;
    const report = estimateMaterials(geometry, value);
    expect(report.totals.concreteNetM3).toBeCloseTo(27.432);
    expect(report.totals.concreteOrderM3).toBeCloseTo(27.432 * 1.05);
    expect(report.totals.cementKg).toBe(0); // ready mix is not also raw ingredients
    expect(report.lines.find((line) => line.id === 'concrete-total')?.role).toBe('summary');
  });

  it('uses exact irregular roof area for concrete instead of multiplying envelope dimensions', () => {
    const value = settings(); value.roof.kind = 'reinforced-concrete'; value.roof.depthM = 0.12;
    const report = estimateMaterials({ ...empty(), roofAreaM2: 75, roofLengthM: 10, roofWidthM: 10, roofRectangular: false }, value);
    expect(report.totals.concreteNetM3).toBe(9);
    expect(report.warnings.some((warning) => warning.includes('bounding rectangle'))).toBe(true);
  });

  it('honours a verified base area override without adding the drawing footprint again', () => {
    const value = settings(); value.base.enabled = true; value.base.areaOverrideM2 = 40; value.base.depthM = 0.2;
    expect(estimateMaterials({ ...empty(), baseAreaM2: 100 }, value).totals.concreteNetM3).toBe(8);
  });

  it('splits an explicitly entered 1:2:4 loose-volume mix and rounds bags once', () => {
    const mix = { cement: 1, sand: 2, aggregate: 4, dryVolumeFactor: 1.54, cementBulkDensityKgM3: 1440, bagKg: 25, wastePct: 0 };
    const result = estimateVolumeMix(1, mix);
    expect(result.dryM3).toBeCloseTo(1.54);
    expect(result.cementKg).toBeCloseTo(316.8);
    expect(result.cementBags).toBe(13);
    expect(result.sandM3).toBeCloseTo(0.44);
    expect(result.aggregateM3).toBeCloseTo(0.88);
  });

  it('applies concrete waste once before its site-mix ingredients, never twice', () => {
    const value = settings(); value.base.enabled = true; value.base.depthM = 1;
    value.concrete = { ...value.concrete, supply: 'site-mix', cement: 1, sand: 2, aggregate: 4, wastePct: 10 };
    const report = estimateMaterials({ ...empty(), baseAreaM2: 1 }, value);
    expect(report.totals.concreteOrderM3).toBeCloseTo(1.1);
    expect(report.totals.cementKg).toBeCloseTo(316.8 * 1.1);
    expect(report.totals.sandM3).toBeCloseTo(0.484);
  });

  it('keeps non-structural mortar and concrete bags separately rounded', () => {
    const value = settings(); value.base.enabled = true; value.base.depthM = 0.15; value.concrete.supply = 'site-mix';
    const report = estimateMaterials({ ...blockWall(), baseAreaM2: 1 }, value);
    const bags = report.lines.filter((line) => line.id.endsWith('-bags'));
    expect(bags).toHaveLength(2);
    expect(report.totals.cementBags).toBe(bags.reduce((sum, line) => sum + line.quantity, 0));
  });
});

describe('roof mesh and sheet geometry', () => {
  it('counts both mesh directions, steel volume and entered layers', () => {
    const value = settings().roof.rebar;
    const result = estimateRebar(4, 3, { ...value, coverMm: 0, spacingMm: 1000, layers: 2, wastePct: 0 });
    expect(result.countLength).toBe(4); expect(result.countWidth).toBe(5);
    expect(result.lengthM).toBe(62);
    expect(result.massKg).toBeCloseTo(62 * Math.PI / 4 * 0.01 ** 2 * 7850);
  });

  it('accounts for each necessary stock-length splice using only the entered lap', () => {
    const value = settings().roof.rebar;
    const result = estimateRebar(12, 1, { ...value, coverMm: 0, spacingMm: 1000, lapLengthM: 0.4, wastePct: 0 });
    expect(result.countLength).toBe(2); expect(result.countWidth).toBe(13);
    expect(result.lengthM).toBeCloseTo(38.6);
    expect(() => estimateRebar(12, 1, { ...value, lapLengthM: 6 })).toThrow();
  });

  it('allocates whole stock per run instead of promising impossible cuts from pooled total length', () => {
    const value = settings().roof.rebar;
    const result = estimateRebar(4, 1.9, { ...value, coverMm: 0, spacingMm: 1000, wastePct: 0 });
    expect(result.countLength).toBe(3); expect(result.countWidth).toBe(5);
    // Three 4 m runs alone need three 6 m bars, not two. We additionally
    // reserve one per transverse run, explicitly declining offcut reuse.
    expect(result.stockBarsNet).toBe(8); expect(result.bars).toBe(8);
    expect(result.orderedLengthM).toBe(48);
    expect(result.orderedMassKg).toBeCloseTo(48 * Math.PI / 4 * 0.01 ** 2 * 7850);
    const withSpare = estimateRebar(4, 1.9, { ...value, coverMm: 0, spacingMm: 1000, wastePct: 5 });
    expect(withSpare.bars).toBe(9);
  });

  it('does not count optional reinforcement until enabled, and never designs it', () => {
    const value = settings(); value.roof.kind = 'reinforced-concrete';
    const geometry = { ...empty(), roofAreaM2: 12, roofLengthM: 4, roofWidthM: 3 };
    expect(estimateMaterials(geometry, value).totals.rebarKg).toBe(0);
    value.roof.rebar.enabled = true;
    expect(estimateMaterials(geometry, value).totals.rebarKg).toBeGreaterThan(0);
  });

  it('counts sheet columns and end-lapped rows with effective side-cover once', () => {
    const value = settings(); value.roof.kind = 'sheet';
    value.roof.sheet = { ...value.roof.sheet, pitchDeg: 0, slopes: 1, effectiveCoverM: 1, sheetLengthM: 3, endLapM: 0.2, wastePct: 0 };
    const report = estimateMaterials({ ...empty(), roofAreaM2: 58, roofLengthM: 10, roofWidthM: 5.8 }, value);
    expect(report.totals.sheets).toBe(20);
    expect(report.totals.concreteNetM3).toBe(0);
    expect(report.lines.find((line) => line.id === 'roof-fasteners')?.quantity).toBe(290);
  });

  it('covers pitched gable faces instead of using only horizontal roof area', () => {
    const value = settings(); value.roof.kind = 'sheet';
    value.roof.sheet = { ...value.roof.sheet, pitchDeg: 60, slopes: 2, sheetLengthM: 6, effectiveCoverM: 1, wastePct: 0 };
    const report = estimateMaterials({ ...empty(), roofAreaM2: 60, roofLengthM: 10, roofWidthM: 6 }, value);
    expect(report.totals.sheets).toBe(20);
    expect(report.lines.find((line) => line.id === 'sheet-area')?.quantity).toBeCloseTo(120);
  });

  it('rejects impossible end laps without NaN or an infinite sheet count', () => {
    const value = settings(); value.roof.kind = 'sheet'; value.roof.sheet.sheetLengthM = 1; value.roof.sheet.endLapM = 1;
    const report = estimateMaterials({ ...empty(), roofAreaM2: 10, roofLengthM: 5, roofWidthM: 2 }, value);
    expect(report.totals.sheets).toBe(0);
    expect(report.warnings.some((warning) => warning.includes('end lap'))).toBe(true);
  });

  it('counts trim overlaps and only counts purlins when the user enters spacing', () => {
    const value = settings(); value.roof.kind = 'sheet'; value.roof.sheet.pitchDeg = 0;
    value.roof.sheet.ridgeLengthM = 5.7; value.roof.sheet.trimStockLengthM = 3; value.roof.sheet.trimLapM = 0.3; value.roof.sheet.wastePct = 0;
    const geometry = { ...empty(), roofAreaM2: 60, roofLengthM: 10, roofWidthM: 6 };
    expect(estimateMaterials(geometry, value).lines.some((line) => line.id === 'purlin-length')).toBe(false);
    value.roof.sheet.purlinSpacingM = 1;
    const report = estimateMaterials(geometry, value);
    expect(report.lines.find((line) => line.id === 'ridge-pieces')?.quantity).toBe(2);
    expect(report.lines.find((line) => line.id === 'purlin-length')?.quantity).toBe(80);
  });
});

describe('safe saved inputs and future extensions', () => {
  it('round-trips a normalised versioned configuration and preserves explicit zeros', () => {
    const value = defaultMaterialsSettings();
    expect(normaliseMaterialsSettings(value)).toEqual(value);
    expect(normaliseMaterialsSettings()).toEqual(value);
    value.wall.jointMm = 0; value.concrete.wastePct = 0;
    expect(normaliseMaterialsSettings(JSON.parse(JSON.stringify(value)))).toEqual(value);
  });

  it('recovers finite settings from malformed saves and omits invalid measured geometry', () => {
    const report = estimateMaterials({ ...empty(), walls: [{ id: 'bad', lengthM: Infinity, heightM: 3, openingAreaM2: NaN }] },
      { wall: { blockLengthM: 0, blockHeightM: NaN }, mortar: { bagKg: 0, cement: NaN, sand: Infinity }, roof: { rebar: { spacingMm: -1 } } });
    expect(Object.values(report.totals).every(Number.isFinite)).toBe(true);
    expect(report.lines.every((line) => Number.isFinite(line.quantity))).toBe(true);
    expect(report.totals.blocks).toBe(0);
  });

  it('rejects invalid primitive mix calls and arithmetic overflow', () => {
    const mix = settings().concrete;
    expect(() => estimateVolumeMix(Infinity, mix)).toThrow();
    expect(() => estimateVolumeMix(1, { ...mix, bagKg: 0 })).toThrow();
    expect(() => estimateVolumeMix(Number.MAX_VALUE, mix)).toThrow();
    expect(() => estimateVolumeMix(1, { ...mix, cement: Number.MAX_VALUE, sand: Number.MAX_VALUE })).toThrow();
  });

  it('applies sourced presets without changing unrelated project settings or geometry', () => {
    const value = settings(); value.base.enabled = true;
    const saved = JSON.stringify(value), geometry = blockWall(), original = JSON.stringify(geometry);
    const selected = applyBlockPreset(value, 'gamma-200');
    expect(selected.wall.thicknessM).toBe(0.2); expect(selected.base.enabled).toBe(true);
    expect(applySheetPreset(selected, 'grewals-corrugated').roof.sheet.effectiveCoverM).toBe(0.97);
    estimateMaterials(geometry, selected);
    expect(JSON.stringify(value)).toBe(saved); expect(JSON.stringify(geometry)).toBe(original);
  });
});
