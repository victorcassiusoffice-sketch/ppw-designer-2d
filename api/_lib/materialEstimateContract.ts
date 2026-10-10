/** External inputs reject invalid values before the editor's legacy normalizer runs. */
import { z } from 'zod';
import { normaliseMaterialsSettings } from '../../src/designer/materials/settings.js';

const n = (min: number, max: number) => z.number().finite().min(min).max(max);
const key = z.string().trim().min(1).max(128);
const ratio = {
  cement: n(.01, 100), sand: n(.01, 100), aggregate: n(0, 100),
  dryVolumeFactor: n(1, 3), cementBulkDensityKgM3: n(500, 2000), bagKg: n(1, 100), wastePct: n(0, 100),
};
export const ConcreteInputSchema = z.object({ ...ratio, supply: z.enum(['ready-mix', 'site-mix']) }).partial().strict();
const mortar = z.object({ ...ratio, aggregate: z.literal(0) }).partial().strict();
const positiveOverride = (max: number) => n(Number.MIN_VALUE, max).nullable().optional();
export const MaterialsInputSchema = z.object({
  version: z.literal(1).optional(), scope: z.enum(['all', 'active']).optional(),
  quotationTaxBasis: z.enum(['inclusive', 'exclusive']).optional(),
  unitRates: z.record(z.string().regex(/^[a-z0-9-]{1,1200}$/), z.object({
    mur: n(0, 1e9), unit: z.enum(['blocks', 'm²', 'm³', 'kg', 'bags', 'm', 'bars', 'sheets', 'pieces']),
    specification: z.string().max(500), taxBasis: z.enum(['inclusive', 'exclusive']).optional(),
  }).strict()).refine(rates => Object.keys(rates).length <= 200, 'At most 200 rates are accepted.').optional(),
  wall: z.object({
    kind: z.enum(['block', 'concrete']), presetId: key, thicknessM: n(.025, 2),
    blockLengthM: n(.05, 2), blockHeightM: n(.05, 2), dimensionBasis: z.enum(['actual', 'nominal']),
    jointMm: n(0, 40), beddingFraction: n(.01, 1), wastePct: n(0, 100),
  }).partial().strict().optional(),
  mortar: mortar.optional(),
  plaster: z.object({ sides: z.union([z.literal(0), z.literal(1), z.literal(2)]), thicknessMm: n(1, 100), mix: mortar }).partial().strict().optional(),
  concrete: ConcreteInputSchema.optional(),
  base: z.object({ enabled: z.boolean(), depthM: n(.01, 5), areaOverrideM2: positiveOverride(1e6) }).partial().strict().optional(),
  pillars: z.object({ count: n(0, 10000).int(), widthM: n(.05, 5), depthM: n(.05, 5), heightM: n(.05, 100) }).partial().strict().optional(),
  roof: z.object({
    kind: z.enum(['none', 'reinforced-concrete', 'sheet']), depthM: n(.01, 5),
    areaOverrideM2: positiveOverride(1e6), lengthOverrideM: positiveOverride(10000), widthOverrideM: positiveOverride(10000),
    rebar: z.object({ enabled: z.boolean(), diameterMm: n(4, 50), spacingMm: n(10, 2000), layers: n(1, 10).int(), coverMm: n(0, 200), stockLengthM: n(.5, 30), lapLengthM: n(0, 10), wastePct: n(0, 100) }).partial().strict().optional(),
    sheet: z.object({
      presetId: key, pitchDeg: n(0, 75), slopes: z.union([z.literal(1), z.literal(2)]),
      effectiveCoverM: n(.1, 3), sheetLengthM: n(.1, 30), endLapM: n(0, 2), overhangM: n(0, 3),
      wastePct: n(0, 100), fastenersPerM2: n(0, 100), ridgeLengthM: n(0, 10000), flashingLengthM: n(0, 10000),
      gutterLengthM: n(0, 10000), trimStockLengthM: n(.1, 30), trimLapM: n(0, 2), purlinSpacingM: n(0, 10),
    }).partial().strict().optional(),
  }).partial().strict().optional(),
}).strict().superRefine((input, ctx) => {
  const settings = normaliseMaterialsSettings(input);
  if (settings.roof.rebar.lapLengthM >= settings.roof.rebar.stockLengthM)
    ctx.addIssue({ code: 'custom', path: ['roof', 'rebar', 'lapLengthM'], message: 'Lap must be shorter than stock length.' });
  if (settings.roof.sheet.endLapM >= settings.roof.sheet.sheetLengthM)
    ctx.addIssue({ code: 'custom', path: ['roof', 'sheet', 'endLapM'], message: 'End lap must be shorter than sheet length.' });
  if (settings.roof.sheet.trimLapM >= settings.roof.sheet.trimStockLengthM)
    ctx.addIssue({ code: 'custom', path: ['roof', 'sheet', 'trimLapM'], message: 'Trim lap must be shorter than stock length.' });
});

export const MaterialsGeometrySchema = z.object({
  walls: z.array(z.object({
    id: key, levelId: key.optional(), lengthM: n(.001, 10000), heightM: n(.001, 100),
    thicknessM: n(.025, 2).optional(), openingAreaM2: n(0, 1e6),
    grossAreaM2: n(0, 1e6).optional(), netAreaM2: n(0, 1e6).optional(),
  }).strict()).max(2000),
  baseAreaM2: n(0, 1e6), roofAreaM2: n(0, 1e6), roofLengthM: n(0, 10000), roofWidthM: n(0, 10000), roofRectangular: z.boolean(),
}).strict().superRefine((geometry, ctx) => {
  const ids = new Set<string>();
  geometry.walls.forEach((wall, index) => {
    if (ids.has(wall.id)) ctx.addIssue({ code: 'custom', path: ['walls', index, 'id'], message: 'Each physical wall must appear once with a unique ID.' });
    ids.add(wall.id);
    if (wall.openingAreaM2 > wall.lengthM * wall.heightM + 1e-8)
      ctx.addIssue({ code: 'custom', path: ['walls', index, 'openingAreaM2'], message: 'Opening area exceeds gross wall area.' });
  });
});
