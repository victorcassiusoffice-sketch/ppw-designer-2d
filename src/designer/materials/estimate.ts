import { CONSTRUCTION_BLOCK_PRESETS, CONSTRUCTION_SHEET_PRESETS } from '../../data/constructionMaterials';
import { normaliseMaterialsSettings } from './settings';
import type { MaterialGroup, MaterialQuantityLine, MaterialsGeometry, MaterialsReport, MaterialUnit, VolumeMix } from './types';

const ceil = (value: number) => Math.ceil(Math.max(0, value) - 1e-9);
const allowance = (value: number, wastePct: number) => value * (1 + wastePct / 100);
const display = (value: number) => Number(value.toFixed(4));

function inputsWereAdjusted(raw: unknown, normalized: unknown): boolean {
  if (!raw || typeof raw !== 'object' || !normalized || typeof normalized !== 'object') return false;
  const given = raw as Record<string, unknown>;
  return Object.entries(normalized).some(([key, value]) => {
    if (given[key] === undefined) return false;
    if (value && typeof value === 'object') return inputsWereAdjusted(given[key], value);
    return given[key] !== value;
  });
}

export interface MixQuantities { wetM3: number; dryM3: number; cementKg: number; cementBags: number; sandM3: number; aggregateM3: number }
/** A transparent loose-volume model, not absolute-volume mix design or strength prediction. */
export function estimateVolumeMix(wetVolumeM3: number, mix: VolumeMix): MixQuantities {
  const values = [wetVolumeM3, mix.cement, mix.sand, mix.aggregate, mix.dryVolumeFactor, mix.cementBulkDensityKgM3, mix.bagKg, mix.wastePct];
  if (values.some((v) => !Number.isFinite(v) || v < 0) || mix.bagKg <= 0 || mix.dryVolumeFactor <= 0 || mix.cementBulkDensityKgM3 <= 0) {
    throw new RangeError('Mix quantities require finite non-negative values, positive bag mass, bulk density and yield factor.');
  }
  const sum = mix.cement + mix.sand + mix.aggregate;
  if (!Number.isFinite(sum) || sum <= 0) throw new RangeError('Mix parts must have a finite positive sum.');
  const wetM3 = allowance(wetVolumeM3, mix.wastePct);
  const dryM3 = wetM3 * mix.dryVolumeFactor;
  const cementKg = dryM3 * mix.cement / sum * mix.cementBulkDensityKgM3;
  const result = { wetM3, dryM3, cementKg, cementBags: ceil(cementKg / mix.bagKg), sandM3: dryM3 * mix.sand / sum, aggregateM3: dryM3 * mix.aggregate / sum };
  if (Object.values(result).some((value) => !Number.isFinite(value))) throw new RangeError('Mix inputs exceed the supported numeric range.');
  return result;
}

export interface RebarTakeoff {
  /** Fitted steel, including entered splice overlaps. */
  lengthM: number; massKg: number;
  /** Whole-stock allocation: each run gets its own bars; unused offcuts are not assumed reusable. */
  orderedLengthM: number; orderedMassKg: number; stockBarsNet: number; bars: number; countLength: number; countWidth: number;
}
/** Straight orthogonal mesh only: no hidden beam, anchorage, punching-shear or load design. */
export function estimateRebar(lengthM: number, widthM: number, config: MaterialsReport['settings']['roof']['rebar']): RebarTakeoff {
  const numbers = [lengthM, widthM, config.diameterMm, config.spacingMm, config.layers, config.coverMm, config.stockLengthM, config.lapLengthM, config.wastePct];
  if (numbers.some((v) => !Number.isFinite(v) || v < 0) || config.diameterMm <= 0 || config.spacingMm <= 0 || config.stockLengthM <= 0 || config.layers < 1 || !Number.isInteger(config.layers) || config.lapLengthM >= config.stockLengthM) {
    throw new RangeError('Rebar needs finite dimensions, positive spacing/stock, and lap shorter than stock.');
  }
  // Cover is to the steel surface. Add half a diameter at each edge to obtain centre-line spread.
  const barDiameterM = config.diameterMm / 1000, coverM = config.coverMm / 1000;
  const cutL = lengthM - 2 * coverM, cutW = widthM - 2 * coverM;
  const spreadL = cutL - barDiameterM, spreadW = cutW - barDiameterM;
  if (spreadL <= 0 || spreadW <= 0) throw new RangeError('Roof rectangle is too small for the entered rebar cover and diameter.');
  const countLength = ceil(spreadW / (config.spacingMm / 1000)) + 1;
  const countWidth = ceil(spreadL / (config.spacingMm / 1000)) + 1;
  const splices = (cut: number) => Math.max(0, ceil((cut - config.stockLengthM) / (config.stockLengthM - config.lapLengthM)));
  const lengthMTotal = (countLength * (cutL + splices(cutL) * config.lapLengthM) + countWidth * (cutW + splices(cutW) * config.lapLengthM)) * config.layers;
  // Steel density 7,850 kg/m³ is an estimating convention; confirm the supplier's nominal kg/m.
  const kgPerM = Math.PI / 4 * barDiameterM ** 2 * 7850;
  // A sum-of-lengths/stock quotient under-orders real cuts: three 4 m cuts
  // cannot come out of two 6 m bars. Allocate each run separately, without
  // claiming cross-run offcut optimization or an engineer's bending schedule.
  const stockBarsNet = (countLength * (splices(cutL) + 1) + countWidth * (splices(cutW) + 1)) * config.layers;
  const bars = ceil(allowance(stockBarsNet, config.wastePct));
  const orderedLengthM = bars * config.stockLengthM;
  const result = { lengthM: lengthMTotal, massKg: lengthMTotal * kgPerM, orderedLengthM,
    orderedMassKg: orderedLengthM * kgPerM, stockBarsNet, bars, countLength, countWidth };
  if (Object.values(result).some((value) => !Number.isFinite(value))) throw new RangeError('Rebar inputs exceed the supported numeric range.');
  return result;
}

/** Call with physical, opening-deducted geometry from any editor. This module never modifies drawings. */
export function estimateMaterials(geometry: MaterialsGeometry, rawSettings?: unknown): MaterialsReport {
  const settings = normaliseMaterialsSettings(rawSettings);
  const warnings: string[] = [];
  if (inputsWereAdjusted(rawSettings, settings)) warnings.push('Some material inputs were invalid or outside the supported range and were adjusted. Review the displayed settings before using this estimate.');
  const lines: MaterialQuantityLine[] = [];
  const assumptions = [
    'Quantities are estimates, not a structural specification. Confirm dimensions, mixes, reinforcement and roof fixings with the supplier and project engineer.',
    'Shared walls must be provided once per storey. Openings are deducted from blockwork, concrete wall volume and plaster; lintels, reveals and beams need separate quantities.',
    'Ratios use loose dry volume. Yield factors and loose cement bulk density are editable estimating assumptions; moisture, compaction, aggregate grading and trial mixes affect actual yield.',
    'Starting dry-volume factors (1.33 mortar, 1.54 concrete) and loose cement density (1,440 kg/m³) are uncalibrated allowances, not supplier-certified yields. Replace them with measured batch data.',
    'Ready-mix volume and site-mix ingredients are alternative supply methods. Summary rows repeat their component quantities and must not be added a second time.',
  ];
  const totals: MaterialsReport['totals'] = { wallGrossAreaM2: 0, wallOpeningAreaM2: 0, wallNetAreaM2: 0, blocks: 0, mortarM3: 0, plasterM3: 0,
    concreteNetM3: 0, concreteOrderM3: 0, cementKg: 0, cementBags: 0, sandM3: 0, aggregateM3: 0, rebarKg: 0, sheets: 0 };
  const line = (id: string, group: MaterialGroup, label: string, unit: MaterialUnit, net: number, quantity: number, wastePct: number, formula: string,
    sourceId?: string, role: MaterialQuantityLine['role'] = 'component') => {
    if (![net, quantity].every((v) => Number.isFinite(v) && v >= 0)) { warnings.push(`${label}: invalid quantity omitted.`); return; }
    lines.push({ id, group, label, unit, net, quantity, wastePct, formula, sourceId, role });
  };
  const safe = (value: unknown, name: string, max = 1e6): number => {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > max) { warnings.push(`${name}: invalid measurement omitted.`); return 0; }
    return value;
  };
  const seen = new Set<string>();
  for (const wall of Array.isArray(geometry?.walls) ? geometry.walls : []) {
    if (!wall || typeof wall.id !== 'string') { warnings.push('An invalid wall was omitted.'); continue; }
    const wallKey = `${wall.levelId ?? ''}:${wall.id}`;
    if (seen.has(wallKey)) { warnings.push(`Duplicate wall ${wall.id} was counted once.`); continue; }
    seen.add(wallKey);
    const length = safe(wall.lengthM, `Wall ${wall.id} length`, 10000), height = safe(wall.heightM, `Wall ${wall.id} height`, 1000);
    const gross = length * height, opening = safe(wall.openingAreaM2, `Wall ${wall.id} openings`);
    if (opening > gross) warnings.push(`Wall ${wall.id}: opening area exceeded wall area and was capped.`);
    totals.wallGrossAreaM2 += gross;
    totals.wallOpeningAreaM2 += Math.min(opening, gross);
    totals.wallNetAreaM2 += Math.max(0, gross - opening);
  }
  const area = totals.wallNetAreaM2, wall = settings.wall;
  const blockPreset = CONSTRUCTION_BLOCK_PRESETS.find((candidate) => candidate.id === wall.presetId);
  line('wall-area', 'walls', 'Wall area after openings', 'm²', area, area, 0, 'Σ(length × height − unique openings), per physical wall', undefined, 'summary');
  let mortarNetM3 = 0;
  if (wall.kind === 'block' && area > 0) {
    const joint = wall.jointMm / 1000;
    const moduleL = wall.blockLengthM + (wall.dimensionBasis === 'actual' ? joint : 0);
    const moduleH = wall.blockHeightM + (wall.dimensionBasis === 'actual' ? joint : 0);
    const actualL = wall.blockLengthM - (wall.dimensionBasis === 'nominal' ? joint : 0);
    const actualH = wall.blockHeightM - (wall.dimensionBasis === 'nominal' ? joint : 0);
    const blocksNet = area / (moduleL * moduleH);
    totals.blocks = ceil(allowance(blocksNet, wall.wastePct));
    line('blocks', 'walls', blockPreset?.label ?? 'Custom blocks / bricks', 'blocks', blocksNet, totals.blocks, wall.wastePct,
      `ceil(${display(area)} m² ÷ (${display(moduleL)} × ${display(moduleH)}) × allowance)`, blockPreset?.sourceId);
    mortarNetM3 = blocksNet * Math.max(0, moduleL * moduleH - actualL * actualH) * wall.thicknessM * wall.beddingFraction;
    assumptions.push(`Block face dimensions are treated as ${wall.dimensionBasis}; ${wall.jointMm} mm joints ${wall.dimensionBasis === 'actual' ? 'are added once' : 'are already included in the module'}. Confirm this with the supplier.`);
    assumptions.push(`Mortar is the horizontal/vertical joint grid × ${wall.thicknessM} m wall thickness × ${wall.beddingFraction} bedding fraction. Hollow block cavities are not mortar. Core filling/grout and reinforced bond beams are excluded.`);
  }
  const addMix = (group: 'mortar' | 'plaster' | 'totals', label: string, netM3: number, mix: VolumeMix) => {
    if (netM3 <= 0) return;
    const result = estimateVolumeMix(netM3, mix), net = estimateVolumeMix(netM3, { ...mix, wastePct: 0 });
    totals.cementKg += result.cementKg; totals.cementBags += result.cementBags;
    totals.sandM3 += result.sandM3; totals.aggregateM3 += result.aggregateM3;
    const id = group === 'totals' ? 'concrete' : group;
    const partSum = mix.cement + mix.sand + mix.aggregate;
    line(`${id}-cement`, group, `${label} cement`, 'kg', net.cementKg, result.cementKg, mix.wastePct,
      `Wet m³ × allowance × ${mix.dryVolumeFactor} × ${mix.cement}/${partSum} cement volume share × ${mix.cementBulkDensityKgM3} kg/m³`, 'kolos-guide');
    line(`${id}-bags`, group, `${label} cement · ${mix.bagKg} kg bags`, 'bags', net.cementKg / mix.bagKg, result.cementBags, mix.wastePct,
      `ceil(cement kg ÷ ${mix.bagKg} kg/bag); keep cement types separate`, 'kolos-guide', 'summary');
    line(`${id}-sand`, group, `${label} rocksand`, 'm³', net.sandM3, result.sandM3, mix.wastePct, `Wet m³ × allowance × ${mix.dryVolumeFactor} × ${mix.sand}/${partSum} sand volume share`, 'gamma-materials');
    if (mix.aggregate > 0) line(`${id}-aggregate`, group, `${label} macadam / coarse aggregate`, 'm³', net.aggregateM3, result.aggregateM3, mix.wastePct,
      `Wet m³ × allowance × ${mix.dryVolumeFactor} × ${mix.aggregate}/${partSum} aggregate volume share`, 'gamma-materials');
  };
  if (mortarNetM3 > 0) {
    totals.mortarM3 = allowance(mortarNetM3, settings.mortar.wastePct);
    line('mortar-volume', 'mortar', 'Joint mortar', 'm³', mortarNetM3, totals.mortarM3, settings.mortar.wastePct, 'Joint-grid volume × bedding fraction × allowance');
    addMix('mortar', 'Mortar', mortarNetM3, settings.mortar);
  }
  const plasterNetM3 = area * settings.plaster.sides * settings.plaster.thicknessMm / 1000;
  if (plasterNetM3 > 0) {
    totals.plasterM3 = allowance(plasterNetM3, settings.plaster.mix.wastePct);
    line('plaster-area', 'plaster', 'Plastered wall faces', 'm²', area * settings.plaster.sides, area * settings.plaster.sides, 0, `Net wall area × ${settings.plaster.sides} face(s)`, undefined, 'summary');
    line('plaster-volume', 'plaster', 'Plaster mortar', 'm³', plasterNetM3, totals.plasterM3, settings.plaster.mix.wastePct, `Net face area × ${settings.plaster.thicknessMm} mm ÷ 1,000 × allowance`);
    addMix('plaster', 'Plaster', plasterNetM3, settings.plaster.mix);
  }
  const addConcrete = (group: 'walls' | 'base' | 'pillars' | 'roof', label: string, volumeM3: number, formula: string) => {
    if (volumeM3 <= 0) return;
    const order = allowance(volumeM3, settings.concrete.wastePct);
    totals.concreteNetM3 += volumeM3; totals.concreteOrderM3 += order;
    line(`${group}-concrete`, group, label, 'm³', volumeM3, order, settings.concrete.wastePct, formula, 'gamma-materials');
  };
  if (wall.kind === 'concrete') {
    addConcrete('walls', 'Poured wall concrete', area * wall.thicknessM, 'Net physical wall area × entered concrete thickness × allowance');
    if (area > 0) warnings.push('Poured wall formwork, reinforcement, joints, foundations and temporary support are not designed or fully scheduled.');
  }
  if (settings.base.enabled) {
    const baseArea = settings.base.areaOverrideM2 ?? safe(geometry?.baseAreaM2, 'Ground footprint area');
    addConcrete('base', 'Ground slab / base concrete', baseArea * settings.base.depthM, `${display(baseArea)} m² × ${settings.base.depthM} m depth × allowance`);
    if (baseArea <= 0) warnings.push('No ground footprint measured. Enter a verified base area.');
    warnings.push('Base depth is an estimating input, not a foundation design. Excavation, sub-base, blinding, membranes and reinforcement are excluded unless scheduled separately.');
  }
  const pillar = settings.pillars;
  if (pillar.count > 0) {
    addConcrete('pillars', 'Additional pillar concrete', pillar.count * pillar.widthM * pillar.depthM * pillar.heightM,
      `${pillar.count} × ${pillar.widthM} × ${pillar.depthM} × ${pillar.heightM} m × allowance`);
    warnings.push('Pillars are additional net volumes: use clear heights and do not include portions already in slabs/walls. Locations, wall displacement, reinforcement and footings are not inferred.');
  }
  const roof = settings.roof;
  const roofArea = roof.areaOverrideM2 ?? safe(geometry?.roofAreaM2, 'Roof area');
  const roofLength = roof.lengthOverrideM ?? safe(geometry?.roofLengthM, 'Roof length', 10000);
  const roofWidth = roof.widthOverrideM ?? safe(geometry?.roofWidthM, 'Roof width', 10000);
  const manualRectangle = roof.lengthOverrideM !== null && roof.widthOverrideM !== null;
  if (roof.kind !== 'none' && !geometry?.roofRectangular && !manualRectangle) {
    warnings.push('Irregular roof: concrete uses the measured net area; rebar and sheets use the bounding rectangle as an allowance, not an exact cutting list. Enter checked rectangle dimensions or calculate each roof face separately.');
  }
  if (roof.kind === 'reinforced-concrete') {
    addConcrete('roof', 'Roof slab concrete', roofArea * roof.depthM, `${display(roofArea)} m² net plan area × ${roof.depthM} m depth × allowance`);
    if (roofArea <= 0) warnings.push('No roof slab area measured. Enter a verified roof area.');
    warnings.push('Concrete roof depth, cover, steel and supporting structure require project engineering. Waterproofing, screed falls, drainage, beams, chairs, ties and formwork are not included.');
    if (roof.rebar.enabled && roofLength > 0 && roofWidth > 0) {
      try {
        const steel = estimateRebar(roofLength, roofWidth, roof.rebar);
        totals.rebarKg = steel.orderedMassKg;
        line('rebar-length', 'rebar', 'Straight roof mesh · fitted steel length', 'm', steel.lengthM, steel.lengthM, 0,
          `${steel.countLength} + ${steel.countWidth} runs × clear lengths, ${roof.rebar.layers} layer(s), including entered laps`, 'joonas-steel', 'summary');
        line('rebar-bars', 'rebar', `${roof.rebar.stockLengthM} m stock bars · no offcut reuse`, 'bars', steel.stockBarsNet, steel.bars, roof.rebar.wastePct,
          'ceil(sum of whole stock bars required for each individual run × layers × allowance); no cross-run offcut reuse', 'joonas-steel');
        line('rebar-mass', 'rebar', `Purchased steel allowance · Ø${roof.rebar.diameterMm} mm`, 'kg',
          steel.stockBarsNet * roof.rebar.stockLengthM * Math.PI / 4 * (roof.rebar.diameterMm / 1000) ** 2 * 7850,
          steel.orderedMassKg, roof.rebar.wastePct, 'Whole stock bars × stock length × π/4 × diameter² × 7,850 kg/m³', 'joonas-steel', 'summary');
        warnings.push('Rebar quantities cover only an orthogonal rectangular mesh. Each run is allocated whole stock bars without reusing offcuts: a conservative purchase allowance, not an optimized bending schedule. Confirm cut/bend, laps, anchorage, openings, supports and grade. No structural adequacy is calculated.');
        if (roof.rebar.lapLengthM === 0 && Math.max(roofLength, roofWidth) - 2 * roof.rebar.coverMm / 1000 > roof.rebar.stockLengthM) {
          warnings.push('Steel runs exceed stock length but lap allowance is zero. Enter the engineer-specified lap or cut-to-length supply before ordering.');
        }
      } catch (error) { warnings.push(error instanceof Error ? error.message : 'Rebar calculation omitted: invalid inputs.'); }
    } else if (roof.rebar.enabled) warnings.push('Rebar needs a positive, verified roof length and width.');
    else warnings.push('Roof reinforcement is not counted until the optional steel schedule is enabled with project dimensions.');
  }
  if (roof.kind === 'sheet') {
    const sheet = roof.sheet, source = CONSTRUCTION_SHEET_PRESETS.find((p) => p.id === sheet.presetId)?.sourceId;
    if (roofLength <= 0 || roofWidth <= 0) warnings.push('Sheet roof needs positive length and width.');
    else if (sheet.endLapM >= sheet.sheetLengthM) warnings.push('Sheet end lap must be shorter than sheet length. No sheet quantity calculated.');
    else {
      const eaveLength = roofLength + 2 * sheet.overhangM;
      const slopingRun = (roofWidth + 2 * sheet.overhangM) / sheet.slopes / Math.cos(sheet.pitchDeg * Math.PI / 180);
      const columns = ceil(eaveLength / sheet.effectiveCoverM);
      const rows = Math.max(1, ceil((slopingRun - sheet.endLapM) / (sheet.sheetLengthM - sheet.endLapM)));
      const netSheets = columns * rows * sheet.slopes;
      totals.sheets = ceil(allowance(netSheets, sheet.wastePct));
      const slopedArea = eaveLength * slopingRun * sheet.slopes;
      line('sheet-area', 'sheet', 'Roof rectangle slope area', 'm²', slopedArea, slopedArea, 0, '(Width + eaves) × (length + verges) ÷ cos(pitch)', undefined, 'summary');
      line('sheets', 'sheet', 'Roof sheets', 'sheets', netSheets, totals.sheets, sheet.wastePct,
        `${columns} columns × ${rows} rows × ${sheet.slopes} slope(s); side lap already in effective cover`, source);
      line('sheet-effective-stock-area', 'sheet', 'Sheet stock · effective-cover equivalent', 'm²', netSheets * sheet.sheetLengthM * sheet.effectiveCoverM,
        totals.sheets * sheet.sheetLengthM * sheet.effectiveCoverM, sheet.wastePct,
        'Sheets × stock length × effective cover; supplier billing may use the wider physical sheet', source, 'summary');
      line('roof-fasteners', 'sheet', 'Roof fixings allowance', 'pieces', slopedArea * sheet.fastenersPerM2, ceil(allowance(slopedArea * sheet.fastenersPerM2, sheet.wastePct)), sheet.wastePct,
        `Slope area × ${sheet.fastenersPerM2} fixings/m² × allowance`, source);
      for (const [id, label, length] of [['ridge', 'Ridge caps', sheet.ridgeLengthM], ['flashing', 'Edge / wall flashings', sheet.flashingLengthM], ['gutter', 'Gutters', sheet.gutterLengthM]] as const) {
        if (length <= 0) continue;
        line(`${id}-length`, 'sheet', label, 'm', length, allowance(length, sheet.wastePct), sheet.wastePct, 'Measured length × allowance', source);
        if (sheet.trimLapM >= sheet.trimStockLengthM) warnings.push(`${label}: trim lap must be shorter than stock length; piece count omitted.`);
        else line(`${id}-pieces`, 'sheet', `${label} · stock pieces`, 'pieces', Math.max(1, ceil((length - sheet.trimLapM) / (sheet.trimStockLengthM - sheet.trimLapM))),
          Math.max(1, ceil((allowance(length, sheet.wastePct) - sheet.trimLapM) / (sheet.trimStockLengthM - sheet.trimLapM))), sheet.wastePct,
          'ceil((required length − one lap) ÷ (stock length − lap))', source, 'summary');
      }
      if (sheet.purlinSpacingM > 0) {
        const purlins = (ceil(slopingRun / sheet.purlinSpacingM) + 1) * sheet.slopes;
        line('purlin-length', 'sheet', 'Purlin rows · length allowance', 'm', purlins * eaveLength, allowance(purlins * eaveLength, sheet.wastePct), sheet.wastePct,
          `${purlins} support rows × ${display(eaveLength)} m + allowance; no section/span design`, 'profilage-purlins');
      }
      assumptions.push('Roof sheets are laid along each mono/gable slope. Hips, valleys, cutouts and offcut reuse need a supplier cutting plan; the rectangle allowance retains them rather than silently deducting openings.');
      warnings.push('Sheet profile, pitch, support spacing, uplift fixings, corrosion protection and connections require a Mauritius wind/cyclone design. Average fixings/m² is a purchasing allowance only.');
      warnings.push('Roof trusses/rafters, purlin section sizing, bracing, insulation, underlay, sealants, gutters/downpipes, fascia and special flashings need a project schedule. Enter measured ridge/flashing/gutter lengths where required.');
    }
  }
  if (totals.concreteNetM3 > 0) {
    line('concrete-total', 'totals', settings.concrete.supply === 'ready-mix' ? 'Ready-mix concrete · total' : 'Site-mixed concrete · total', 'm³', totals.concreteNetM3, totals.concreteOrderM3,
      settings.concrete.wastePct, 'Wall + ground base + additional pillars + concrete roof; each physical element once', 'gamma-materials', 'summary');
    if (settings.concrete.supply === 'site-mix') addMix('totals', 'Concrete', totals.concreteNetM3, settings.concrete);
  }
  if (totals.cementKg > 0) {
    line('cement-total', 'totals', 'Cement · all mixes', 'kg', totals.cementKg, totals.cementKg, 0, 'Sum of mix cement quantities already including allowances; keep cement types separate', undefined, 'summary');
    line('sand-total', 'totals', 'Rocksand · all mixes', 'm³', totals.sandM3, totals.sandM3, 0, 'Sum of mortar + plaster + site-mix sand; no extra waste applied', 'gamma-materials', 'summary');
  }
  return { version: 1, settings, lines, warnings: [...new Set(warnings)], assumptions, totals };
}
