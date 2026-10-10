import type { MaterialsReport, MaterialQuantityLine, MaterialsSettings, MaterialUnit } from './types';
import { estimateFoundation, type FoundationModel } from '../foundation.js';

export interface ProcurementLine {
  id: string; label: string; quantity: number; unit: MaterialUnit; specification: string;
}
export interface PricedMaterialLine extends ProcurementLine { unitRateMur: number | null; totalMur: number | null; needsReview: boolean }

/** Round the decimal quantity × decimal quote to cents once. Binary floating
 * multiplication otherwise turns values such as 1.005 into 1.00. */
function lineMinor(quantity: number, rate: number): number | null {
  if (![quantity, rate].every(Number.isFinite) || quantity <= 0 || rate < 0) return null;
  const decimal = (value: number) => {
    const [mantissa, exponent = '0'] = String(value).split('e');
    const [whole, fraction = ''] = mantissa.split('.');
    return { digits: BigInt(whole + fraction), power: Number(exponent) - fraction.length };
  };
  const q = decimal(quantity), r = decimal(rate), digits = q.digits * r.digits, power = q.power + r.power + 2;
  const denominator = power < 0 ? 10n ** BigInt(-power) : 1n;
  const numerator = power < 0 ? digits : digits * 10n ** BigInt(power);
  const rounded = (2n * numerator + denominator) / (2n * denominator);
  return rounded <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(rounded) : null;
}

/** Shared UI/API steel schedule. Reuse the checked takeoff; overlapping steel
 * remains explicitly unresolved instead of disappearing from a complete quote. */
export function foundationProcurement(model: FoundationModel | undefined, concrete: MaterialsSettings['concrete']) {
  const foundation = model?.enabled ? estimateFoundation(model, concrete) : null;
  const lines: ProcurementLine[] = (foundation?.rebar ?? []).map(row => {
    const element = model!.elements.find(e => e.id === row.elementId)!;
    // Code-point encoding is reversible: case, slashes and Unicode never alias
    // another element's rate (unlike lossy slugging or truncated hashes).
    const identity = Array.from(element.id).map(character => character.codePointAt(0)!.toString(16)).join('-');
    return { id: `foundation-${identity}-bars`, label: `${element.name} foundation rebar`, quantity: row.takeoff.bars, unit: 'bars',
      specification: `${element.rebar.diameterMm} mm | ${element.rebar.stockLengthM} m bar` };
  });
  const incompleteReasons: string[] = [];
  if (foundation && !foundation.rebarComplete) incompleteReasons.push('Foundation reinforcement is withheld because reinforced elements overlap; separate the schedules before quoting steel.');
  if (foundation && !foundation.concreteComplete) incompleteReasons.push('Foundation excavation still awaits concrete; complete the fill stages before treating this as a complete foundation quote.');
  return { foundation, lines, incompleteReasons };
}

/** Explicit purchase basis. Wet mortar and its ingredients are never both charged;
 * ready-mix excludes site-mix ingredients. Quantity summaries are not all purchases. */
export function materialsProcurement(report: MaterialsReport): ProcurementLine[] {
  const settings = report.settings;
  const allowed = new Set(['blocks', 'mortar-bags', 'mortar-sand', 'plaster-bags', 'plaster-sand',
    'rebar-bars', 'sheets', 'roof-fasteners', 'ridge-pieces', 'flashing-pieces', 'gutter-pieces', 'purlin-length']);
  if (settings.concrete.supply === 'ready-mix') allowed.add('concrete-total');
  else ['concrete-bags', 'concrete-sand', 'concrete-aggregate'].forEach(id => allowed.add(id));
  const specification = (line: MaterialQuantityLine) => {
    if (line.id === 'blocks') return JSON.stringify([settings.wall.presetId, settings.wall.blockLengthM, settings.wall.blockHeightM, settings.wall.thicknessM, settings.wall.dimensionBasis]);
    if (line.id.endsWith('-bags')) {
      const mix = line.id.startsWith('mortar') ? settings.mortar : line.id.startsWith('plaster') ? settings.plaster.mix : settings.concrete;
      return `${line.label} | ${mix.bagKg} kg per bag`;
    }
    if (line.id === 'rebar-bars') return `${settings.roof.rebar.diameterMm} mm | ${settings.roof.rebar.stockLengthM} m bar`;
    if (line.id === 'sheets') return `${settings.roof.sheet.presetId} | ${settings.roof.sheet.sheetLengthM} m × ${settings.roof.sheet.effectiveCoverM} m effective`;
    if (line.id.endsWith('-pieces')) return `${line.label} | ${settings.roof.sheet.trimStockLengthM} m piece`;
    return `${line.label} | ${line.unit}`;
  };
  return report.lines.filter(line => allowed.has(line.id) && line.quantity > 0)
    .map(line => ({ id: line.id, label: line.label, quantity: line.quantity, unit: line.unit, specification: specification(line) }));
}

/** Missing rates stay unknown, not zero. Minor-unit line rounding is performed once. */
export function estimateMaterialCosts(report: MaterialsReport, additions: ProcurementLine[] = [], incompleteReasons: string[] = []) {
  const issues = [...(report.quantityIncompleteReasons ?? []), ...incompleteReasons];
  if (!report.settings.quotationTaxBasis) issues.push('Select one tax basis for every quotation rate.');
  const unique = new Map<string, ProcurementLine>(), duplicated = new Set<string>();
  for (const line of [...materialsProcurement(report), ...additions]) {
    if (unique.has(line.id)) duplicated.add(line.id);
    else unique.set(line.id, line);
  }
  if (duplicated.size) issues.push('Duplicate purchasing identities were withheld; each material schedule must be represented once.');
  const lines: PricedMaterialLine[] = [...unique.values()].map(line => {
    const rate = report.settings.unitRates?.[line.id];
    const minor = rate ? lineMinor(line.quantity, rate.mur) : null;
    const valid = !duplicated.has(line.id) && Number.isFinite(line.quantity) && line.quantity > 0 && rate && Number.isFinite(rate.mur) && rate.mur >= 0 && rate.mur <= 1e9
      && rate.unit === line.unit && rate.specification === line.specification && !!report.settings.quotationTaxBasis && rate.taxBasis === report.settings.quotationTaxBasis
      && minor !== null;
    return { ...line, unitRateMur: valid ? rate.mur : null,
      totalMur: valid ? minor! / 100 : null, needsReview: Boolean((rate || duplicated.has(line.id)) && !valid) };
  });
  const missing = lines.filter(line => line.totalMur === null).length;
  const subtotalMinor = lines.reduce((sum, line) => sum + Math.round((line.totalMur ?? 0) * 100), 0);
  if (!Number.isSafeInteger(subtotalMinor)) issues.push('The subtotal exceeds the supported monetary range; quote smaller schedules.');
  return { currency: 'MUR' as const, lines, knownSubtotalMur: Number.isSafeInteger(subtotalMinor) ? subtotalMinor / 100 : null,
    unpricedLines: missing, complete: lines.length > 0 && missing === 0 && issues.length === 0, incompleteReasons: [...new Set(issues)],
    taxBasis: report.settings.quotationTaxBasis ?? 'unspecified',
    basis: `User-entered quotation rates${report.settings.quotationTaxBasis ? `, tax ${report.settings.quotationTaxBasis}` : ', tax basis unconfirmed'}. No tax is calculated here. Labour, delivery, fittings and unmodelled work excluded. This is not a checkout total.` };
}

export function setMaterialRate(settings: MaterialsSettings, line: ProcurementLine, mur: number | null): MaterialsSettings {
  const unitRates = { ...settings.unitRates };
  if (mur === null) delete unitRates[line.id];
  else if (Number.isFinite(mur) && mur >= 0 && mur <= 1e9) unitRates[line.id] = { mur, unit: line.unit, specification: line.specification,
    ...(settings.quotationTaxBasis ? { taxBasis: settings.quotationTaxBasis } : {}) };
  return { ...settings, unitRates };
}
