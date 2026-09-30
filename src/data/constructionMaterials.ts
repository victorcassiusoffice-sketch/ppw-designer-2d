/** Verified supplier references, not live stock, price quotes or commercial partnerships. */
export interface ConstructionSource {
  id: string; supplier: string; title: string; url: string; checkedAt: string; note: string;
}
export const CONSTRUCTION_SOURCES: readonly ConstructionSource[] = [
  { id: 'ubp-blocks', supplier: 'UBP', title: 'Classic concrete block 6 inch',
    url: 'https://www.ubp.mu/fr/produits/materiaux-de-construction/classic-blocks/blocs/bloc-6.html', checkedAt: '2026-09-30',
    note: 'Published 450 × 200 × 150 mm. Published dimensions are not an independently measured batch; confirm whether joints are included.' },
  { id: 'ubp-technical', supplier: 'UBP', title: 'Cellular concrete block technical sheet',
    url: 'https://ubp.mu/sites/default/files/fiche_technique_ubp_vf_22_09_16_1.pdf', checkedAt: '2026-09-30',
    note: '2016 technical sheet, indexed supplier document: 100/150/200 mm thickness variants and 450 × 200 mm face. Reconfirm current specification with UBP.' },
  { id: 'gamma-blocks', supplier: 'Gamma Materials', title: '8 inch concrete block',
    url: 'https://gammamaterials.mu/en/blocks/9-block-8.html', checkedAt: '2026-09-30',
    note: 'Supplier publishes 200 × 450 × 200 mm. Its catalogue also supplies aggregates, ready-mix and pavers. No stock or price is imported.' },
  { id: 'gamma-materials', supplier: 'Gamma Materials', title: 'Building materials range',
    url: 'https://gammamaterials.mu/', checkedAt: '2026-09-30',
    note: 'Ready-mix concrete, rocksand, macadam, blocks and precast products. Supplier mix/yield and density data are required for an order.' },
  { id: 'kolos-guide', supplier: 'Kolos Cement', title: 'Bat Sima construction guide',
    url: 'https://www.koloscement.com/media/lpolxoii/bat-sima_-guide-de-la-construction.pdf', checkedAt: '2026-09-30',
    note: '25 kg bags; local rocksand/macadam use; indicative mortar/concrete ratios. The guide requires trial mixes and competent approval; ratios do not certify strength.' },
  { id: 'kolos-products', supplier: 'Kolos Cement', title: 'Cement product range',
    url: 'https://www.koloscement.com/our-products', checkedAt: '2026-09-30',
    note: 'Kolos Finish is for non-structural masonry/plaster. Structural cement families are separate; bag quantity is not a product-suitability decision.' },
  { id: 'joonas-steel', supplier: 'Joonas Steel', title: 'Reinforcing steel and cut-and-bend service',
    url: 'https://www.joonasco.com/steel-mauritius/', checkedAt: '2026-09-30',
    note: 'Published mild steel 6–25 mm and high-tensile rebar 8–32 mm; cut-and-bend and corrugated sheets available. Diameter and detailing require project design.' },
  { id: 'grewals-roof', supplier: 'Grewals', title: 'Roofing and accessories catalogue, printed page 10',
    url: 'https://www.grewals.mu/wp-content/uploads/2023/10/Catalogue-Grewals.pdf', checkedAt: '2026-09-30',
    note: 'Ribbed sheet effective cover 1,000 mm; corrugated 970 mm; Panel Rib 1,200 mm. Average five fixings/m² is an allowance, not a cyclone fastening design.' },
  { id: 'profilage-purlins', supplier: 'Profilage Océan Indien', title: 'Cee metal purlins',
    url: 'https://www.profilage.mu/products/purlins/cee-metal-purlins/', checkedAt: '2026-09-30',
    note: 'Cut-to-length C/Z purlins, profile weights and supplier span tables. Select section and spacing with the roof designer.' },
];

export interface ConstructionBlockPreset {
  id: string; label: string; supplier: string; lengthM: number; heightM: number; thicknessM: number;
  dimensionBasis: 'actual' | 'nominal'; sourceId: string; note: string;
}
const blockNote = 'Published product dimensions treated as actual for this estimate; add the chosen joint. Switch to nominal if the supplier confirms a joint-inclusive module.';
export const CONSTRUCTION_BLOCK_PRESETS: readonly ConstructionBlockPreset[] = [
  { id: 'ubp-100', label: 'UBP concrete block · 100 mm', supplier: 'UBP', lengthM: 0.45, heightM: 0.2, thicknessM: 0.1, dimensionBasis: 'actual', sourceId: 'ubp-technical', note: blockNote },
  { id: 'ubp-150', label: 'UBP concrete block · 150 mm', supplier: 'UBP', lengthM: 0.45, heightM: 0.2, thicknessM: 0.15, dimensionBasis: 'actual', sourceId: 'ubp-blocks', note: blockNote },
  { id: 'ubp-200', label: 'UBP concrete block · 200 mm', supplier: 'UBP', lengthM: 0.45, heightM: 0.2, thicknessM: 0.2, dimensionBasis: 'actual', sourceId: 'ubp-technical', note: blockNote },
  { id: 'gamma-200', label: 'Gamma concrete block · 200 mm', supplier: 'Gamma Materials', lengthM: 0.45, heightM: 0.2, thicknessM: 0.2, dimensionBasis: 'actual', sourceId: 'gamma-blocks', note: blockNote },
];

export interface ConstructionSheetPreset {
  id: string; label: string; supplier: string; effectiveCoverM: number; sourceId: string;
}
export const CONSTRUCTION_SHEET_PRESETS: readonly ConstructionSheetPreset[] = [
  { id: 'grewals-ribbed', label: 'Grewals ribbed · 1,000 mm cover', supplier: 'Grewals', effectiveCoverM: 1, sourceId: 'grewals-roof' },
  { id: 'grewals-corrugated', label: 'Grewals corrugated · 970 mm cover', supplier: 'Grewals', effectiveCoverM: 0.97, sourceId: 'grewals-roof' },
  { id: 'grewals-panel-rib', label: 'Grewals Panel Rib · 1,200 mm cover', supplier: 'Grewals', effectiveCoverM: 1.2, sourceId: 'grewals-roof' },
];

export function constructionSource(id: string | undefined): ConstructionSource | undefined {
  return CONSTRUCTION_SOURCES.find((source) => source.id === id);
}
