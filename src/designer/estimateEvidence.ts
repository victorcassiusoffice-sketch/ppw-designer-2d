import type { Property } from '../store/propertyStore';
import type { Product } from '../data/products.schema';

/** An evidence inventory, not another estimator. Existing quantities are never recomputed here. */
export interface EstimateEngineEvidence {
  id: string;
  name: string;
  module: string;
  testFile: string;
  inputs: string;
  output: string;
  sourceBasis: string;
  limit: string;
}

// One entry per distinct implementation module, rather than counting every helper as an engine.
export const ESTIMATE_ENGINE_EVIDENCE: readonly EstimateEngineEvidence[] = [
  { id: 'geometry', name: 'Measured building geometry', module: 'src/designer/propertyMaterials.ts', testFile: 'src/designer/__tests__/propertyMaterials.test.ts', inputs: 'Drawn walls, openings, floors and roof outline.', output: 'Shared-wall deductions and measured base / roof areas.', sourceBasis: 'Project geometry and entered heights.', limit: 'Drawing dimensions need a site survey. A drawn model is not as-built evidence.' },
  { id: 'materials', name: 'Walls, concrete and roof takeoff', module: 'src/designer/materials/estimate.ts', testFile: 'src/designer/materials/__tests__/estimate.test.ts', inputs: 'Block modules, joints, mix ratios, depth, waste and steel schedule.', output: 'Blocks, mortar, plaster, concrete ingredients, straight rebar and roof-sheet quantities.', sourceBasis: 'Saved supplier-size presets and editable estimating assumptions.', limit: 'Mix ratios do not certify strength. Rebar quantities do not design structural capacity.' },
  { id: 'foundation', name: 'Foundation and excavation', module: 'src/designer/foundation.ts', testFile: 'src/designer/__tests__/foundation.test.ts', inputs: 'Slab / strip / pad dimensions, excavation depths, bores and entered reinforcement.', output: 'Measured excavation, concrete-fill and reinforcement schedules.', sourceBasis: 'Project dimensions and optional engineer references.', limit: 'No soil capacity, safe excavation slope, pile capacity or footing design is inferred.' },
  { id: 'paint', name: 'Paint coverage', module: 'src/designer/wallPaintCalc.ts', testFile: 'src/designer/__tests__/wallPaintCalc.test.ts', inputs: 'Painted faces, openings, coverage, coats, primer and waste.', output: 'Net painted area, litres and whole-container combinations.', sourceBasis: 'Saved product coverage and coat information; user overrides.', limit: 'Surface condition and actual site yield need checking. More coats increase required paint.' },
  { id: 'flooring', name: 'Flooring packs', module: 'src/lib/floorCalculator.ts', testFile: 'src/lib/__tests__/floorCalculator.test.ts', inputs: 'Measured area, pack coverage and cutting allowance.', output: 'Effective coverage and rounded purchasing units.', sourceBasis: 'Saved material coverage and entered waste.', limit: 'A pack takeoff does not optimise every cut or account for unseen substrate work.' },
  { id: 'services', name: 'Plumbing and electrical routes', module: 'src/designer/buildingServices.ts', testFile: 'src/designer/__tests__/buildingServices.test.ts', inputs: 'Routes, elevations, diameters, materials and explicit connections.', output: 'Three-dimensional route lengths and material schedules.', sourceBasis: 'Project routes and saved material references.', limit: 'No hydraulic pressure, electrical fault, fire-system compliance or utility approval is certified.' },
  { id: 'solar', name: 'Solar and energy scenarios', module: 'src/designer/solarCalc.ts', testFile: 'src/designer/__tests__/solarCalc.test.ts', inputs: 'Panel rating, irradiation, losses, appliance demand and battery assumptions.', output: 'Indicative generation, demand coverage and battery autonomy.', sourceBasis: 'Saved regional irradiation references and editable scenario inputs.', limit: 'Not an hourly shading simulation, yield guarantee or grid-connection design.' },
  { id: 'city', name: 'City infrastructure quantities', module: 'src/designer/city.ts', testFile: 'src/designer/__tests__/city.test.ts', inputs: 'Road widths / layers, utility routes, trenches and data-centre assumptions.', output: 'Road-layer and trench quantities, route lengths and data-centre scenarios.', sourceBasis: 'Project layouts and entered infrastructure specifications.', limit: 'Junction engineering, ground conditions, network capacity and consent remain separate.' },
  { id: 'ecology', name: 'Trees and green-roof screening', module: 'src/designer/eco.ts', testFile: 'src/designer/__tests__/projectReview.test.ts', inputs: 'Tree survey dimensions, roof area, saturated assembly mass and added water.', output: 'Tree-protection screening envelopes and added roof load.', sourceBasis: 'Entered survey / assembly references and stated screening methods.', limit: 'No root survey or structural capacity is inferred. A saved reference is not approval.' },
  { id: 'sustainability', name: 'Carbon and tropical-climate screening', module: 'src/designer/sustainability.ts', testFile: 'src/designer/__tests__/sustainability.test.ts', inputs: 'Material declarations, matching units, climate observations and measured technology yield.', output: 'Evidence-gated carbon, moisture and surface-technology comparisons.', sourceBasis: 'Recorded research references and project-specific declarations.', limit: 'Missing evidence remains unknown. Not a full life-cycle assessment or transient hygrothermal simulation.' },
  { id: 'procurement', name: 'Quotation reconciliation', module: 'src/designer/materials/costs.ts', testFile: 'src/designer/materials/__tests__/costs.test.ts', inputs: 'Quantity schedules, matching specifications, purchasing units and one tax basis.', output: 'Known-line subtotals and explicit incomplete-quotation flags.', sourceBasis: 'User-entered quotation rates; unmatched or absent rates are withheld.', limit: 'No invoice-validation dataset is connected. Labour, delivery and unmodelled work may be excluded.' },
];

export interface EstimateInputCheck {
  id: string;
  label: string;
  status: 'present' | 'review' | 'not-used';
  detail: string;
}
const positive = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0;
const httpReference = (value: unknown): boolean => {
  if (typeof value !== 'string') return false;
  try { return ['http:', 'https:'].includes(new URL(value).protocol); } catch { return false; }
};
const textReference = (value: unknown): boolean => typeof value === 'string' && value.trim().length > 0;

/** Presence checks only. No inferred survey approval, live stock, supplier audit or accuracy score. */
export function assessEstimateEvidence(property: Property, resolveProduct: (id: string) => Product | undefined = () => undefined) {
  const rooms = property.rooms ?? [];
  const drawn = rooms.filter(room => room.polygon.length > 0);
  const outlinesPresent = drawn.length > 0 && drawn.every(room => room.polygon.length >= 3 && room.polygon.every(point => Number.isFinite(point.x) && Number.isFinite(point.y)));
  const ids = [...new Set(rooms.flatMap(room => room.placedItems.map(item => item.productId)))];
  const products = ids.map(resolveProduct);
  const dimensionCount = products.filter(product => product && positive(product.dimensions_cm.length) && positive(product.dimensions_cm.width) && positive(product.dimensions_cm.height)).length;
  const sourceCount = products.filter(product => product && httpReference(product.source_url)).length;
  const heightPresent = positive(property.wallHeightM) || Boolean(property.levels?.length && property.levels.every(level => positive(level.heightM)));
  const engineeringReferences = [property.engineering?.geotechnicalReportRef, property.engineering?.structuralDesignRef, property.engineering?.utilityDesignRef].filter(textReference).length;
  const checks: EstimateInputCheck[] = [
    { id: 'outlines', label: 'Building outlines', status: outlinesPresent ? 'present' : 'review', detail: outlinesPresent ? 'Finite drawing coordinates are present. Survey and topology validation remain separate.' : 'Draw closed room outlines or review missing / invalid coordinates.' },
    { id: 'heights', label: 'Entered building heights', status: heightPresent ? 'present' : 'review', detail: heightPresent ? 'A positive height is stored. This does not establish that it was surveyed.' : 'The estimator may use defaults. Record and check actual floor / wall heights.' },
    { id: 'materials', label: 'Saved material assumptions', status: property.materials?.version === 1 ? 'present' : 'review', detail: property.materials?.version === 1 ? 'A material-settings version is saved. Review its ratios, allowances and specifications.' : 'Default assumptions are not a supplier-approved specification. Review and save the settings.' },
    { id: 'dimensions', label: 'Placed-product dimensions', status: !ids.length ? 'not-used' : dimensionCount === ids.length ? 'present' : 'review', detail: ids.length ? `${dimensionCount} of ${ids.length} unique placed products have positive length, width and height. Values may still be catalogue approximations.` : 'No placed products to check.' },
    { id: 'sources', label: 'Placed-product source links', status: !ids.length ? 'not-used' : sourceCount === ids.length ? 'present' : 'review', detail: ids.length ? `${sourceCount} of ${ids.length} unique placed products have a recorded web source. Links have not been independently reverified here.` : 'No placed-product references to check.' },
  ];
  if (rooms.some(room => room.wallPaint?.length)) checks.push({ id: 'coats', label: 'Paint coat override', status: Number.isInteger(property.wallPaintCoats) && property.wallPaintCoats! >= 1 && property.wallPaintCoats! <= 3 ? 'present' : 'review', detail: 'Without an override, product-recommended coats are used. Confirm coverage and substrate condition.' });
  if (property.foundation?.enabled) checks.push({ id: 'foundation-reference', label: 'Foundation design references', status: textReference(property.engineering?.geotechnicalReportRef) && textReference(property.engineering?.structuralDesignRef) ? 'present' : 'review', detail: 'Geotechnical and structural reference fields identify documents; their contents and approval are not verified here.' });
  if (property.services?.runs.length) checks.push({ id: 'services-reference', label: 'Utility design reference', status: textReference(property.engineering?.utilityDesignRef) ? 'present' : 'review', detail: 'A reference field is not a pressure, capacity, protection or compliance calculation.' });
  const applicable = checks.filter(check => check.status !== 'not-used');
  return {
    engines: ESTIMATE_ENGINE_EVIDENCE,
    checks,
    inputCoverage: { present: applicable.filter(check => check.status === 'present').length, total: applicable.length },
    sources: { recorded: sourceCount, total: ids.length, engineeringReferences, verification: 'not-verified' as const },
    empiricalAccuracy: { status: 'unavailable' as const, reason: 'No matched estimates and final supplier invoices have been supplied for validation. Price accuracy cannot be established from passing software checks.' },
  };
}
