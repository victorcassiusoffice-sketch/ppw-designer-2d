/** Supplier-published specifications, checked 16 October 2026. These are
 * reference options, not a live stock feed, quotation or approved glazing design. */
export interface GlassMaterialReference {
  id: string;
  supplier: string;
  label: string;
  thicknessMm: number;
  glassThicknessMm: number;
  type: 'toughened' | 'laminated' | 'reeded';
  sourceUrl: string;
  checkedOn: string;
  use: string;
}
const sourceUrl = 'https://www.birmingham.mu/products-category/glass-products-services/';
export const MAURITIUS_GLASS: readonly GlassMaterialReference[] = [
  { id: 'birmingham-tempered-10', supplier: 'Birmingham Mauritius', label: 'Tempered glass · 10 mm', thicknessMm: 10, glassThicknessMm: 10, type: 'toughened', sourceUrl, checkedOn: '2026-10-16', use: 'Published partition option. Panel sizes, supports and exposure need supplier confirmation.' },
  { id: 'birmingham-tempered-12', supplier: 'Birmingham Mauritius', label: 'Tempered glass · 12 mm', thicknessMm: 12, glassThicknessMm: 12, type: 'toughened', sourceUrl, checkedOn: '2026-10-16', use: 'Published partition option. Thickness alone does not establish structural suitability.' },
  { id: 'birmingham-laminated-10-38', supplier: 'Birmingham Mauritius', label: 'Laminated glass · 10.38 mm', thicknessMm: 10.38, glassThicknessMm: 10, type: 'laminated', sourceUrl, checkedOn: '2026-10-16', use: 'Published partition option. Mass estimate excludes the interlayer and fittings.' },
  { id: 'birmingham-laminated-12-38', supplier: 'Birmingham Mauritius', label: 'Laminated glass · 12.38 mm', thicknessMm: 12.38, glassThicknessMm: 12, type: 'laminated', sourceUrl, checkedOn: '2026-10-16', use: 'Published partition option. Mass estimate excludes the interlayer and fittings.' },
  { id: 'birmingham-reeded-8', supplier: 'Birmingham Mauritius', label: 'Reeded glass · 8 mm', thicknessMm: 8, glassThicknessMm: 8, type: 'reeded', sourceUrl, checkedOn: '2026-10-16', use: 'Published fixed-panel option; not a structural or exterior glazing approval.' },
];
export const GLASS_DENSITY_KG_M3 = 2500;
export const GLASS_DENSITY_SOURCE = 'https://www.saint-gobain-sekurit.com/fr/glossaire';
export const findGlassMaterial = (id?: string) => MAURITIUS_GLASS.find((entry) => entry.id === id);

/** Net panel glass only. Frame, sealant, fittings, cut losses and interlayer
 * mass require the supplier's separately measured schedule. */
export function glassTakeoff(areaM2: number, thicknessMm: number, productId?: string) {
  if (!Number.isFinite(areaM2) || areaM2 < 0 || !Number.isFinite(thicknessMm) || thicknessMm < 2 || thicknessMm > 40) return null;
  const reference = findGlassMaterial(productId);
  const matched = reference && Math.abs(reference.thicknessMm - thicknessMm) < 1e-6 ? reference : undefined;
  const solidGlassMm = matched?.glassThicknessMm ?? thicknessMm;
  return { areaM2, volumeM3: areaM2 * thicknessMm / 1000,
    glassMassKg: areaM2 * solidGlassMm / 1000 * GLASS_DENSITY_KG_M3,
    excludesInterlayerMass: matched?.type === 'laminated', reference: matched };
}
