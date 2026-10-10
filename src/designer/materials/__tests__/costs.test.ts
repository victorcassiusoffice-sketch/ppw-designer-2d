import { describe, expect, it } from 'vitest';
import { defaultMaterialsSettings, estimateMaterials, normaliseMaterialsSettings, type MaterialsGeometry, type MaterialsSettings } from '..';
import { estimateMaterialCosts, foundationProcurement, materialsProcurement, setMaterialRate, type ProcurementLine } from '../costs';
import { applyMixScenario } from '../mixPresets';
import { defaultFoundationRebar, type FoundationElement, type FoundationModel } from '../../foundation';
import { propertyMaterialsGeometry } from '../../propertyMaterials';

const empty = (): MaterialsGeometry => ({ walls: [], baseAreaM2: 0, roofAreaM2: 0, roofLengthM: 0, roofWidthM: 0, roofRectangular: true });
const settings = (): MaterialsSettings => ({ ...defaultMaterialsSettings(), quotationTaxBasis: 'exclusive' });
function priceAll(geometry: MaterialsGeometry, value: MaterialsSettings, additions: ProcurementLine[] = [], rate = 10) {
  let next = value;
  for (const line of [...materialsProcurement(estimateMaterials(geometry, value)), ...additions]) next = setMaterialRate(next, line, rate);
  return estimateMaterials(geometry, next);
}
const element = (patch: Partial<FoundationElement> = {}): FoundationElement => ({ id: 'slab', name: 'Slab', kind: 'slab', x: 0, y: 0,
  lengthM: 4, widthM: 3, depthM: 0.2, topElevationM: 0, rebar: { ...defaultFoundationRebar(), enabled: true, wastePct: 0 }, ...patch });
const foundation = (...elements: FoundationElement[]): FoundationModel => ({ version: 1, enabled: true, elements });

describe('material purchasing and exact-cost boundaries', () => {
  it('charges ready-mix once and replaces it with ingredients when site mixing', () => {
    const geometry = { ...empty(), baseAreaM2: 1 }, value = settings();
    value.base.enabled = true; value.base.depthM = 1; value.concrete.wastePct = 0;
    const ready = estimateMaterialCosts(priceAll(geometry, value, [], 1000));
    expect(ready.lines.map(line => line.id)).toEqual(['concrete-total']);
    expect(ready.knownSubtotalMur).toBe(1000); expect(ready.complete).toBe(true);
    value.concrete.supply = 'site-mix';
    const site = estimateMaterialCosts(priceAll(geometry, value));
    expect(site.lines.map(line => line.id)).toEqual(['concrete-bags', 'concrete-sand', 'concrete-aggregate']);
    // 1 m³ × 1.54 at 1:2:3 = 369.6 kg cement → 15 bags,
    // 0.513333… m³ sand + 0.77 m³ aggregate. Round each money line once.
    expect(site.knownSubtotalMur).toBe(162.83);
    expect(site.complete).toBe(true);
  });

  it('costs masonry blocks and mortar ingredients without charging wet mortar or cement summaries again', () => {
    const geometry = { ...empty(), walls: [{ id: 'w', lengthM: 4.6, heightM: 2.1, openingAreaM2: 0 }] }, value = settings();
    value.wall.wastePct = 0; value.mortar.wastePct = 0;
    const cost = estimateMaterialCosts(priceAll(geometry, value, [], 100));
    expect(cost.lines.map(line => line.id)).toEqual(['blocks', 'mortar-bags', 'mortar-sand']);
    expect(cost.lines[0].quantity).toBe(100);
    expect(cost.knownSubtotalMur).toBe(10000 + 200 + 9.88);
  });

  it('keeps missing rates unknown and requires confirmed units, specifications and one tax basis', () => {
    const geometry = { ...empty(), baseAreaM2: 1 }, value = settings(); value.base.enabled = true;
    const unpriced = estimateMaterialCosts(estimateMaterials(geometry, value));
    expect(unpriced.lines[0].totalMur).toBeNull(); expect(unpriced.unpricedLines).toBe(1); expect(unpriced.complete).toBe(false);
    const report = priceAll(geometry, value);
    expect(estimateMaterialCosts(report).complete).toBe(true);
    report.settings.unitRates!['concrete-total'].unit = 'bags';
    expect(estimateMaterialCosts(report)).toMatchObject({ knownSubtotalMur: 0, unpricedLines: 1, complete: false });
    const taxChanged = priceAll(geometry, value); taxChanged.settings.quotationTaxBasis = 'inclusive';
    expect(estimateMaterialCosts(taxChanged).lines[0]).toMatchObject({ totalMur: null, needsReview: true });
    const withoutBasis = priceAll(geometry, value); delete withoutBasis.settings.quotationTaxBasis;
    expect(estimateMaterialCosts(withoutBasis).complete).toBe(false);
    // Zero is a deliberate quote; missing is not silently a free material.
    expect(estimateMaterialCosts(priceAll(geometry, value, [], 0))).toMatchObject({ knownSubtotalMur: 0, complete: true });
  });

  it('retains a rate for quantity changes but invalidates it when the bag size changes', () => {
    const geometry = { ...empty(), baseAreaM2: 1 }, value = settings(); value.base.enabled = true; value.concrete.supply = 'site-mix';
    const priced = priceAll(geometry, value).settings;
    expect(estimateMaterialCosts(estimateMaterials({ ...geometry, baseAreaM2: 2 }, priced)).complete).toBe(true);
    priced.concrete.bagKg = 50;
    const changed = estimateMaterialCosts(estimateMaterials(geometry, priced));
    expect(changed.lines.find(line => line.id === 'concrete-bags')).toMatchObject({ totalMur: null, needsReview: true });
    expect(changed.complete).toBe(false);
  });

  it('withholds duplicate schedule identities and non-finite or excessive line totals', () => {
    const line: ProcurementLine = { id: 'test-bars', label: 'Test bars', quantity: 10, unit: 'bars', specification: '10 mm × 6 m' };
    const value = setMaterialRate(settings(), line, 20), report = estimateMaterials(empty(), value);
    const duplicate = estimateMaterialCosts(report, [line, { ...line, quantity: 30 }]);
    expect(duplicate.knownSubtotalMur).toBe(0); expect(duplicate.complete).toBe(false); expect(duplicate.lines).toHaveLength(1);
    for (const quantity of [NaN, Infinity, -1, Number.MAX_VALUE]) {
      const cost = estimateMaterialCosts(report, [{ ...line, quantity }]);
      expect(cost.lines[0].totalMur).toBeNull(); expect(cost.complete).toBe(false);
    }
  });

  it('rounds decimal half-cents once instead of losing them to binary multiplication', () => {
    const line: ProcurementLine = { id: 'quoted-quantity', label: 'Measured material', quantity: 1.005, unit: 'm³', specification: 'Supplier quote' };
    const value = setMaterialRate(settings(), line, 1);
    expect(estimateMaterialCosts(estimateMaterials(empty(), value), [line]).knownSubtotalMur).toBe(1.01);
  });
});

describe('foundation purchases join one material schedule', () => {
  it.each([false, true])('keeps an entirely priced foundation incomplete while a fill stage is pending (overlap: %s)', overlapping => {
    const model = foundation(element(), element({ id: 'pending', x: overlapping ? 0 : 10,
      excavation: { depthM: 1, topElevationM: 0, marginM: .25, stage: 'excavated' } }));
    const value = settings(); value.concrete.wastePct = 0;
    const purchase = foundationProcurement(model, value.concrete);
    expect(purchase.foundation!.concreteComplete).toBe(false);
    expect(purchase.foundation!.volumeM3).toBeCloseTo(2.4);
    expect(purchase.foundation!.pendingConcreteM3).toBeCloseTo(overlapping ? 0 : 2.4);
    expect(purchase.incompleteReasons).toEqual([expect.stringContaining('awaits concrete')]);
    // A zero extra union volume must not conceal an unfinished design stage.
    // Only the already-added element's steel appears in procurement.
    expect(purchase.lines).toHaveLength(1);
    const report = priceAll({ ...empty(), foundationVolumeM3: purchase.foundation!.volumeM3 }, value, purchase.lines);
    const costs = estimateMaterialCosts(report, purchase.lines, purchase.incompleteReasons);
    expect(costs.unpricedLines).toBe(0); expect(costs.knownSubtotalMur).toBeGreaterThan(0);
    expect(costs.complete).toBe(false);
    expect(costs.incompleteReasons).toEqual([expect.stringContaining('awaits concrete')]);
  });

  it('keeps planned volumes outside the Materials adapter and legacy base until concrete is added', () => {
    const model = foundation(element({ excavation: { depthM: 1, topElevationM: 0, marginM: 0, stage: 'excavated' } }));
    const property = { id: 'pending-foundation', name: 'Pending', rooms: [], activeRoomId: '', foundation: model };
    const value = settings(); value.base.enabled = true; value.base.areaOverrideM2 = 100;
    const pending = foundationProcurement(model, value.concrete);
    const geometry = propertyMaterialsGeometry(property);
    expect(geometry.foundationVolumeM3).toBe(0);
    expect(pending.foundation!.plannedConcreteVolumeM3).toBeCloseTo(2.4);
    const report = estimateMaterials(geometry, value);
    expect(report.totals.concreteNetM3).toBe(0);
    expect(materialsProcurement(report)).toEqual([]);
    expect(pending.lines).toEqual([]);
    expect(estimateMaterialCosts(report, pending.lines, pending.incompleteReasons)).toMatchObject({ complete: false,
      incompleteReasons: expect.arrayContaining([expect.stringContaining('awaits concrete')]) });
    model.elements[0].excavation!.stage = 'filled';
    const filled = foundationProcurement(model, value.concrete);
    expect(propertyMaterialsGeometry(property).foundationVolumeM3).toBeCloseTo(2.4);
    expect(filled.incompleteReasons).toEqual([]);
    expect(filled.lines.length).toBeGreaterThan(0);
  });

  it('costs exact foundation bar stock once with a stable specification and collision-free identity', () => {
    const model = foundation(element({ id: 'A/B' }), element({ id: 'a-b', x: 10 })), value = settings();
    const purchase = foundationProcurement(model, value.concrete);
    expect(new Set(purchase.lines.map(line => line.id)).size).toBe(2);
    expect(purchase.lines.reduce((sum, line) => sum + line.quantity, 0)).toBe(purchase.foundation!.rebarStockBars);
    const geometry = { ...empty(), foundationVolumeM3: purchase.foundation!.volumeM3 };
    const report = priceAll(geometry, value, purchase.lines);
    const cost = estimateMaterialCosts(report, purchase.lines, purchase.incompleteReasons);
    expect(cost.complete).toBe(true);
    expect(cost.lines.filter(line => line.unit === 'bars').reduce((sum, line) => sum + line.quantity, 0)).toBe(purchase.foundation!.rebarStockBars);
    expect(normaliseMaterialsSettings(report.settings).unitRates).toEqual(report.settings.unitRates);
    model.elements[0].rebar.diameterMm = 12;
    const changed = foundationProcurement(model, value.concrete);
    expect(estimateMaterialCosts(report, changed.lines, changed.incompleteReasons).complete).toBe(false);
  });

  it('cannot report complete when overlapping steel quantities are withheld', () => {
    const model = foundation(element(), element({ id: 'overlap' })), value = settings();
    const purchase = foundationProcurement(model, value.concrete);
    expect(purchase.foundation!.volumeM3).toBeCloseTo(2.4); expect(purchase.lines).toHaveLength(0);
    const report = priceAll({ ...empty(), foundationVolumeM3: purchase.foundation!.volumeM3 }, value);
    const cost = estimateMaterialCosts(report, purchase.lines, purchase.incompleteReasons);
    expect(cost.unpricedLines).toBe(0); expect(cost.complete).toBe(false);
    expect(cost.incompleteReasons.join(' ')).toContain('reinforcement');
  });

  it('an enabled but empty foundation replaces the old base instead of charging both', () => {
    const value = settings(); value.base.enabled = true; value.base.areaOverrideM2 = 100; value.base.depthM = 0.15;
    const emptyDrawn = estimateMaterials({ ...empty(), baseAreaM2: 100, foundationVolumeM3: 0 }, value);
    expect(emptyDrawn.totals.concreteNetM3).toBe(0);
    expect(materialsProcurement(emptyDrawn)).toEqual([]);
    const drawn = estimateMaterials({ ...empty(), baseAreaM2: 100, foundationVolumeM3: 2.4 }, value);
    expect(drawn.totals.concreteNetM3).toBeCloseTo(2.4);
    expect(materialsProcurement(drawn)).toHaveLength(1);
  });
});

describe('requested quantities cannot disappear from a complete quotation', () => {
  const roofGeometry = (): MaterialsGeometry => ({ ...empty(), baseAreaM2: 1, roofAreaM2: 80, roofLengthM: 10, roofWidthM: 8 });

  it('keeps fully priced roof concrete incomplete when enabled steel has no verified rectangle', () => {
    const value = settings(); value.roof.kind = 'reinforced-concrete'; value.roof.rebar.enabled = true;
    const report = priceAll({ ...roofGeometry(), roofLengthM: 0, roofWidthM: 0 }, value);
    expect(report.totals.concreteNetM3).toBeGreaterThan(0);
    expect(report.lines.some(line => line.id === 'rebar-bars')).toBe(false);
    expect(estimateMaterialCosts(report)).toMatchObject({ complete: false, unpricedLines: 0,
      incompleteReasons: expect.arrayContaining([expect.stringContaining('verified roof length and width')]) });
  });

  it.each([
    { depthM: .01, coverMm: 200, diameterMm: 50, layers: 10 },
    { depthM: .069, coverMm: 25, diameterMm: 10, layers: 1 },
    { depthM: .089, coverMm: 25, diameterMm: 10, layers: 2 },
  ])('withholds physically impossible roof steel before pricing: %j', dimensions => {
    const value = settings(); value.roof.kind = 'reinforced-concrete'; value.roof.depthM = dimensions.depthM;
    value.roof.rebar = { ...value.roof.rebar, enabled: true, coverMm: dimensions.coverMm, diameterMm: dimensions.diameterMm, layers: dimensions.layers };
    const report = priceAll(roofGeometry(), value);
    expect(report.totals.rebarKg).toBe(0);
    expect(report.lines.some(line => line.id === 'rebar-bars')).toBe(false);
    expect(estimateMaterialCosts(report)).toMatchObject({ complete: false, unpricedLines: 0,
      incompleteReasons: expect.arrayContaining([expect.stringContaining('cannot fit within the slab depth')]) });
  });

  it.each([1, 2])('accepts the necessary depth-fit boundary for %i crossing mesh layer(s), without claiming approval', layers => {
    const value = settings(); value.roof.kind = 'reinforced-concrete'; value.roof.depthM = (50 + 20 * layers) / 1000;
    value.roof.rebar = { ...value.roof.rebar, enabled: true, coverMm: 25, diameterMm: 10, layers, lapLengthM: .4 };
    const report = priceAll(roofGeometry(), value);
    expect(report.totals.rebarKg).toBeGreaterThan(0);
    expect(estimateMaterialCosts(report).complete).toBe(true);
    expect(report.warnings.join(' ')).toContain('No structural adequacy is calculated');
  });

  it.each(['rectangle', 'end lap', 'ridge', 'flashing', 'gutter'] as const)('marks omitted sheet-roof %s quantities incomplete even with all existing rows priced', missing => {
    const value = settings(), geometry = roofGeometry(); value.base.enabled = true; value.roof.kind = 'sheet';
    if (missing === 'rectangle') geometry.roofWidthM = 0;
    else if (missing === 'end lap') { value.roof.sheet.sheetLengthM = 1; value.roof.sheet.endLapM = 1; }
    else { value.roof.sheet[`${missing}LengthM`] = 5; value.roof.sheet.trimStockLengthM = 1; value.roof.sheet.trimLapM = 1; }
    const cost = estimateMaterialCosts(priceAll(geometry, value));
    expect(cost.knownSubtotalMur).toBeGreaterThan(0);
    expect(cost.unpricedLines).toBe(0); expect(cost.complete).toBe(false);
    expect(cost.incompleteReasons.length).toBeGreaterThan(0);
  });

  it.each(['base', 'roof', 'invalid wall', 'conflicting wall'] as const)('cannot hide an omitted %s behind other priced work', missing => {
    const value = settings(), geometry = roofGeometry(); value.pillars.count = 1;
    if (missing === 'base') { value.base.enabled = true; geometry.baseAreaM2 = 0; }
    else if (missing === 'roof') { value.roof.kind = 'reinforced-concrete'; geometry.roofAreaM2 = 0; }
    else {
      geometry.walls = [{ id: 'wall', lengthM: 4, heightM: 3, openingAreaM2: 0 }];
      geometry.walls.push({ ...geometry.walls[0], id: missing === 'invalid wall' ? 'bad' : 'wall', lengthM: missing === 'invalid wall' ? Infinity : 6 });
    }
    expect(estimateMaterialCosts(priceAll(geometry, value))).toMatchObject({ complete: false, unpricedLines: 0 });
  });

  it('blocks an invalid rebar schedule and unconfirmed zero splice laps', () => {
    const value = settings(); value.roof.kind = 'reinforced-concrete'; value.roof.rebar.enabled = true;
    value.roof.rebar.lapLengthM = value.roof.rebar.stockLengthM;
    const invalid = estimateMaterialCosts(priceAll(roofGeometry(), value));
    expect(invalid).toMatchObject({ complete: false, unpricedLines: 0 });
    value.roof.rebar.lapLengthM = 0;
    expect(estimateMaterialCosts(priceAll(roofGeometry(), value))).toMatchObject({ complete: false, unpricedLines: 0,
      incompleteReasons: expect.arrayContaining([expect.stringContaining('lap allowance is zero')]) });
  });

  it('does not turn benign warnings, exact duplicates or explicitly disabled schedules into missing quantities', () => {
    const value = settings(); value.roof.kind = 'reinforced-concrete'; value.roof.rebar.enabled = false;
    const geometry = roofGeometry(); geometry.roofRectangular = false;
    geometry.walls = [{ id: 'wall', lengthM: 4, heightM: 3, openingAreaM2: 0 }];
    geometry.walls.push({ ...geometry.walls[0] });
    const report = priceAll(geometry, value);
    expect(report.warnings.length).toBeGreaterThan(0);
    expect(report.quantityIncompleteReasons).toEqual([]);
    expect(estimateMaterialCosts(report).complete).toBe(true);
    value.roof.kind = 'sheet'; value.roof.sheet.trimStockLengthM = 1; value.roof.sheet.trimLapM = 1;
    // No trim lengths or purlin spacing requested: these are explicitly outside
    // this quantity schedule, not silently failed calculations.
    expect(estimateMaterialCosts(priceAll(geometry, value)).complete).toBe(true);
  });
});

describe('scenario changes and save compatibility', () => {
  it('changes ingredient quantities while preserving physical volume, allowances and custom yield', () => {
    const value = settings(), geometry = { ...empty(), baseAreaM2: 1 };
    value.base.enabled = true; value.base.depthM = 1; value.concrete.supply = 'site-mix'; value.concrete.wastePct = 0;
    value.concrete = { ...value.concrete, ...applyMixScenario(value.concrete, '1:2:4', 'concrete'), dryVolumeFactor: 1.54 };
    const first = estimateMaterials(geometry, value);
    expect(first.totals.cementKg).toBeCloseTo(316.8); expect(first.totals.aggregateM3).toBeCloseTo(0.88);
    value.concrete = { ...applyMixScenario(value.concrete, '1:3:6', 'concrete'), supply: 'site-mix' };
    const second = estimateMaterials(geometry, value);
    expect(second.totals.concreteNetM3).toBe(1); expect(second.totals.cementKg).toBeCloseTo(221.76);
    expect(second.settings.concrete.dryVolumeFactor).toBe(1.54);
    expect(applyMixScenario(value.mortar, 'invented', 'mortar')).toEqual(value.mortar);
  });
  it('does not add rate fields to older settings and rejects malformed imported prices', () => {
    expect(normaliseMaterialsSettings()).toEqual(defaultMaterialsSettings());
    expect(normaliseMaterialsSettings(defaultMaterialsSettings()).unitRates).toBeUndefined();
    const value = normaliseMaterialsSettings({ unitRates: { negative: { mur: -1, unit: 'bags', specification: 'x' }, nan: { mur: NaN, unit: 'bags', specification: 'x' } } });
    expect(value.unitRates).toEqual({});
  });
});
