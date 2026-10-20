import type { ServiceFixtureKind } from '../designer/buildingServices';

/** Reference attachment never changes the user-owned envelope or certifies a system.
 * Dimensions, when present, are product body envelopes, excluding service clearances.
 * All renderer geometry remains a schematic coordination model, not a manufacturer CAD model. */
export interface ServiceEquipmentReference {
  id: string;
  label: string;
  supplier: string;
  kind: ServiceFixtureKind;
  sourceUrl: string;
  technicalSourceUrl?: string;
  checkedAt: '2026-10-15';
  referenceKind: 'product' | 'family';
  dimensions?: { widthM: number; depthM: number; heightM: number };
  notes: string;
}

const INVENTOR =
  'https://www.ignitech.mu/air-conditioning-mauritius/air-conditioning-products-equipment-mauritius/';
export const BUILDING_EQUIPMENT: readonly ServiceEquipmentReference[] = [
  {
    id: 'ignitech-inventor-indoor',
    label: 'Inventor inverter wall split · indoor unit range',
    supplier: 'Ignitech Mauritius',
    kind: 'air-conditioner',
    sourceUrl: INVENTOR,
    checkedAt: '2026-10-15',
    referenceKind: 'family',
    notes:
      'Local supplier range reference, not an identified model. Body dimensions, cooling duty, electrical input and matched outdoor model require supplier selection. Envelope is schematic. Cooling capacity is not electrical consumption.',
  },
  {
    id: 'ignitech-inventor-outdoor',
    label: 'Inventor split system · matched outdoor unit',
    supplier: 'Ignitech Mauritius',
    kind: 'outdoor-ac',
    sourceUrl: INVENTOR,
    checkedAt: '2026-10-15',
    referenceKind: 'family',
    notes:
      'Companion outdoor-unit planning reference for the supplier split-system range. Exact unit, mounting loads, ventilation clearances and refrigerant line pair are not specified. Do not treat independently selected units as a compatible pair.',
  },
  {
    id: 'espace-vortice-m100',
    label: 'Vortice M 100/4 extractor · 11201',
    supplier: 'Espace Maison',
    kind: 'extractor-fan',
    sourceUrl: 'https://www.espacemaison.mu/products/extractor-fan',
    technicalSourceUrl:
      'https://www.vortice.com/en/residential-ventilation/axial-fans/wall-window/11201',
    checkedAt: '2026-10-15',
    referenceKind: 'product',
    dimensions: { widthM: 0.159, depthM: 0.1, heightM: 0.16 },
    notes:
      'Supplier EAN 8010300112015; manufacturer body A 159 / B 160 / C 100 mm, discharge 99 mm. Manufacturer max input 18 W, not the retailer duplicated 230 W field. No consumption or delivered airflow inferred from the drawing.',
  },
  {
    id: 'espace-greenstream-grille',
    label: 'Greenstream adjustable fixed grille · 100–150 mm',
    supplier: 'Espace Maison',
    kind: 'air-grille',
    sourceUrl: 'https://www.espacemaison.mu/fr/produits/adj-grille-fixe',
    checkedAt: '2026-10-15',
    referenceKind: 'product',
    notes:
      'Supplier reference 6091242175237. Published size 100–150 mm is not a complete body envelope; width is listed as zero and is not imported. Schematic dimensions only. No motor power assigned to this passive grille.',
  },
  {
    id: 'shield-sprinkler-system',
    label: 'Water sprinkler system · engineered selection',
    supplier: 'Shield Fire Protection Mauritius',
    kind: 'sprinkler',
    sourceUrl: 'https://www.shieldfireprotection.info/',
    technicalSourceUrl:
      'https://mfrs.govmu.org/Documents/Downloads/Fire%20Code/Chapters/Chapter%206%20-%20Fire%20Fighting%20systems.pdf',
    checkedAt: '2026-10-15',
    referenceKind: 'family',
    notes:
      'Supplier lists sprinkler systems; no head model, K-factor, spacing or dimensions verified. Water-network terminal symbol only. A competent fire specialist must select heads, hazard classification, supply, calculations and approval. Not an automatic powder extinguisher.',
  },
  {
    id: 'shield-abc-powder',
    label: 'ABC dry powder portable extinguisher · EN3 range',
    supplier: 'Shield Fire Protection Mauritius',
    kind: 'fire-extinguisher',
    sourceUrl:
      'https://www.shieldfireprotection.info/products/bs-en3-dry-powder-fire-extinguisher?from=fire_category',
    checkedAt: '2026-10-15',
    referenceKind: 'family',
    notes:
      'Published portable ABC range; no selected capacity or full body envelope. Standalone equipment with no fire-water port. Agent, location and suitability require fire review; not a universal fire solution or a piped powder sprinkler.',
  },
  {
    id: 'ignitech-eversafe-extinguisher',
    label: 'Eversafe portable extinguishers · supplier range',
    supplier: 'Ignitech Mauritius',
    kind: 'fire-extinguisher',
    sourceUrl: 'https://www.ignitech.mu/fire-protection/products/',
    checkedAt: '2026-10-15',
    referenceKind: 'family',
    notes:
      'Supplier lists ABC dry powder, CO2, foam and water equipment. Drawing does not select an extinguishing agent or certify suitability; exact model, dimensions and installation must be specified separately.',
  },
  {
    id: 'seculogix-dahua-hfw2441',
    label: 'Dahua IPC-HFW2441T-AS · bullet network camera',
    supplier: 'Seculogix Mauritius',
    kind: 'security-camera',
    sourceUrl: 'https://www.seculogixltd.com/products/cctv',
    technicalSourceUrl:
      'https://www.dahuasecurity.com/products/network-products/network-cameras/WizSense-Series/2-Series/IR/IPC-HFW2441T-AS',
    checkedAt: '2026-10-15',
    referenceKind: 'product',
    dimensions: { widthM: 0.0907, depthM: 0.2385, heightM: 0.0907 },
    notes:
      'Local list identifies 3.6 mm version. Manufacturer body 238.5 mm × diameter 90.7 mm; orientation points along plan depth. Generic lens/body detail only. PoE and 12 V are alternative supply arrangements, not evidence that two power routes are required. No surveillance coverage or API integration promised.',
  },
  {
    id: 'tplink-sg1008p-v7',
    label: 'TP-Link TL-SG1008P V7 · desktop PoE switch',
    supplier: 'TP-Link · manufacturer reference',
    kind: 'network-switch',
    sourceUrl: 'https://www.tp-link.com/nordic/business-networking/soho-switch-poe/tl-sg1008p/',
    checkedAt: '2026-10-15',
    referenceKind: 'product',
    dimensions: { widthM: 0.171, depthM: 0.098, heightM: 0.027 },
    notes:
      'Published V7 body 171×98×27 mm; external power adapter/clearances excluded. 8 RJ45 ports, 4 PoE+ ports. Mauritius supplier/stock unverified; manufacturer reference only. The drawing does not allocate ports or calculate PoE loading.',
  },
  {
    id: 'duraco-b445',
    label: 'Duraco B445 inspection chamber · adjustable height',
    supplier: 'Duraco Mauritius',
    kind: 'sewer-connection',
    sourceUrl: 'https://duraco.mu/our-products/sewage/manhole/',
    checkedAt: '2026-10-15',
    referenceKind: 'product',
    notes:
      'Published chamber diameter 475 mm, adjustable height 350–440 mm. No single full envelope selected automatically; connections and cover/base projections are not verified. Chamber diameter is not pipe diameter. Confirm site, WMA requirements, load-rated cover and installation with Duraco.',
  },
];

export function buildingEquipmentById(
  id: string | undefined,
): ServiceEquipmentReference | undefined {
  return BUILDING_EQUIPMENT.find((item) => item.id === id);
}
