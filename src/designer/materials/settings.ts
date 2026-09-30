import { CONSTRUCTION_BLOCK_PRESETS, CONSTRUCTION_SHEET_PRESETS } from '../../data/constructionMaterials';
import type { MaterialsSettings, VolumeMix } from './types';

/** Illustrative estimating allowances; they never encode a structural specification. */
export function defaultMaterialsSettings(): MaterialsSettings {
  const mortar: VolumeMix = { cement: 1, sand: 3, aggregate: 0, dryVolumeFactor: 1.33, cementBulkDensityKgM3: 1440, bagKg: 25, wastePct: 10 };
  return {
    version: 1, scope: 'all',
    wall: { kind: 'block', presetId: 'ubp-150', thicknessM: 0.15, blockLengthM: 0.45, blockHeightM: 0.2,
      dimensionBasis: 'actual', jointMm: 10, beddingFraction: 1, wastePct: 5 },
    mortar,
    plaster: { sides: 0, thicknessMm: 15, mix: { ...mortar, sand: 4 } },
    concrete: { supply: 'ready-mix', cement: 1, sand: 2, aggregate: 3, dryVolumeFactor: 1.54, cementBulkDensityKgM3: 1440, bagKg: 25, wastePct: 5 },
    base: { enabled: false, depthM: 0.15, areaOverrideM2: null },
    pillars: { count: 0, widthM: 0.2, depthM: 0.2, heightM: 2.7 },
    roof: { kind: 'none', depthM: 0.15, areaOverrideM2: null, lengthOverrideM: null, widthOverrideM: null,
      rebar: { enabled: false, diameterMm: 10, spacingMm: 200, layers: 1, coverMm: 25, stockLengthM: 6, lapLengthM: 0, wastePct: 5 },
      sheet: { presetId: 'grewals-ribbed', pitchDeg: 15, slopes: 2, effectiveCoverM: 1, sheetLengthM: 6, endLapM: 0.2,
        overhangM: 0, wastePct: 5, fastenersPerM2: 5, ridgeLengthM: 0, flashingLengthM: 0, gutterLengthM: 0,
        trimStockLengthM: 3, trimLapM: 0.15, purlinSpacingM: 0 } },
  };
}

type Rec = Record<string, unknown>;
const record = (value: unknown): Rec => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Rec : {};
const n = (value: unknown, fallback: number, min: number, max: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
const optional = (value: unknown, max: number): number | null =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.min(value, max) : null;

function mixSettings(raw: unknown, fallback: VolumeMix, coarse: boolean): VolumeMix {
  const v = record(raw);
  return { cement: n(v.cement, fallback.cement, 0.01, 100), sand: n(v.sand, fallback.sand, 0.01, 100),
    aggregate: coarse ? n(v.aggregate, fallback.aggregate, 0, 100) : 0,
    dryVolumeFactor: n(v.dryVolumeFactor, fallback.dryVolumeFactor, 1, 3),
    cementBulkDensityKgM3: n(v.cementBulkDensityKgM3, fallback.cementBulkDensityKgM3, 500, 2000),
    bagKg: n(v.bagKg, fallback.bagKg, 1, 100), wastePct: n(v.wastePct, fallback.wastePct, 0, 100) };
}

/** Safe for imported/older property JSON; no NaN, prototype data or unbounded counts survive. */
export function normaliseMaterialsSettings(value?: unknown): MaterialsSettings {
  const d = defaultMaterialsSettings();
  const v = record(value), wall = record(v.wall), concrete = record(v.concrete), plaster = record(v.plaster);
  const base = record(v.base), pillars = record(v.pillars), roof = record(v.roof);
  const rebar = record(roof.rebar), sheet = record(roof.sheet);
  return {
    version: 1, scope: v.scope === 'active' ? 'active' : 'all',
    wall: { kind: wall.kind === 'concrete' ? 'concrete' : 'block',
      presetId: wall.presetId === undefined ? d.wall.presetId : typeof wall.presetId === 'string' && CONSTRUCTION_BLOCK_PRESETS.some((p) => p.id === wall.presetId) ? wall.presetId : 'custom',
      thicknessM: n(wall.thicknessM, d.wall.thicknessM, 0.025, 2), blockLengthM: n(wall.blockLengthM, d.wall.blockLengthM, 0.05, 2),
      blockHeightM: n(wall.blockHeightM, d.wall.blockHeightM, 0.05, 2), dimensionBasis: wall.dimensionBasis === 'nominal' ? 'nominal' : 'actual',
      jointMm: n(wall.jointMm, d.wall.jointMm, 0, 40), beddingFraction: n(wall.beddingFraction, d.wall.beddingFraction, 0.01, 1),
      wastePct: n(wall.wastePct, d.wall.wastePct, 0, 100) },
    mortar: mixSettings(v.mortar, d.mortar, false),
    plaster: { sides: plaster.sides === 1 || plaster.sides === 2 ? plaster.sides : 0,
      thicknessMm: n(plaster.thicknessMm, d.plaster.thicknessMm, 1, 100), mix: mixSettings(plaster.mix, d.plaster.mix, false) },
    concrete: { ...mixSettings(v.concrete, d.concrete, true), supply: concrete.supply === 'site-mix' ? 'site-mix' : 'ready-mix' },
    base: { enabled: base.enabled === true, depthM: n(base.depthM, d.base.depthM, 0.01, 5), areaOverrideM2: optional(base.areaOverrideM2, 1e6) },
    pillars: { count: Math.floor(n(pillars.count, d.pillars.count, 0, 10000)), widthM: n(pillars.widthM, d.pillars.widthM, 0.05, 5),
      depthM: n(pillars.depthM, d.pillars.depthM, 0.05, 5), heightM: n(pillars.heightM, d.pillars.heightM, 0.05, 100) },
    roof: { kind: roof.kind === 'reinforced-concrete' || roof.kind === 'sheet' ? roof.kind : 'none',
      depthM: n(roof.depthM, d.roof.depthM, 0.01, 5), areaOverrideM2: optional(roof.areaOverrideM2, 1e6),
      lengthOverrideM: optional(roof.lengthOverrideM, 10000), widthOverrideM: optional(roof.widthOverrideM, 10000),
      rebar: { enabled: rebar.enabled === true, diameterMm: n(rebar.diameterMm, d.roof.rebar.diameterMm, 4, 50),
        spacingMm: n(rebar.spacingMm, d.roof.rebar.spacingMm, 10, 2000), layers: Math.floor(n(rebar.layers, d.roof.rebar.layers, 1, 10)),
        coverMm: n(rebar.coverMm, d.roof.rebar.coverMm, 0, 200), stockLengthM: n(rebar.stockLengthM, d.roof.rebar.stockLengthM, 0.5, 30),
        lapLengthM: n(rebar.lapLengthM, d.roof.rebar.lapLengthM, 0, 10), wastePct: n(rebar.wastePct, d.roof.rebar.wastePct, 0, 100) },
      sheet: { presetId: sheet.presetId === undefined ? d.roof.sheet.presetId : typeof sheet.presetId === 'string' && CONSTRUCTION_SHEET_PRESETS.some((p) => p.id === sheet.presetId) ? sheet.presetId : 'custom',
        pitchDeg: n(sheet.pitchDeg, d.roof.sheet.pitchDeg, 0, 75), slopes: sheet.slopes === 1 ? 1 : 2,
        effectiveCoverM: n(sheet.effectiveCoverM, d.roof.sheet.effectiveCoverM, 0.1, 3), sheetLengthM: n(sheet.sheetLengthM, d.roof.sheet.sheetLengthM, 0.1, 30),
        endLapM: n(sheet.endLapM, d.roof.sheet.endLapM, 0, 2), overhangM: n(sheet.overhangM, d.roof.sheet.overhangM, 0, 3),
        wastePct: n(sheet.wastePct, d.roof.sheet.wastePct, 0, 100), fastenersPerM2: n(sheet.fastenersPerM2, d.roof.sheet.fastenersPerM2, 0, 100),
        ridgeLengthM: n(sheet.ridgeLengthM, 0, 0, 10000), flashingLengthM: n(sheet.flashingLengthM, 0, 0, 10000), gutterLengthM: n(sheet.gutterLengthM, 0, 0, 10000),
        trimStockLengthM: n(sheet.trimStockLengthM, d.roof.sheet.trimStockLengthM, 0.1, 30), trimLapM: n(sheet.trimLapM, d.roof.sheet.trimLapM, 0, 2),
        purlinSpacingM: n(sheet.purlinSpacingM, 0, 0, 10) } },
  };
}

export function applyBlockPreset(settings: MaterialsSettings, id: string): MaterialsSettings {
  const preset = CONSTRUCTION_BLOCK_PRESETS.find((candidate) => candidate.id === id);
  if (!preset) return { ...settings, wall: { ...settings.wall, presetId: 'custom' } };
  return { ...settings, wall: { ...settings.wall, kind: 'block', presetId: preset.id, blockLengthM: preset.lengthM,
    blockHeightM: preset.heightM, thicknessM: preset.thicknessM, dimensionBasis: preset.dimensionBasis } };
}

export function applySheetPreset(settings: MaterialsSettings, id: string): MaterialsSettings {
  const preset = CONSTRUCTION_SHEET_PRESETS.find((candidate) => candidate.id === id);
  return { ...settings, roof: { ...settings.roof, sheet: { ...settings.roof.sheet, presetId: preset?.id ?? 'custom',
    effectiveCoverM: preset?.effectiveCoverM ?? settings.roof.sheet.effectiveCoverM } } };
}
