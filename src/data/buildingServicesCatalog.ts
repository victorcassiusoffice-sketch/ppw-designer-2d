/** Published Mauritian supplier references checked on 2026-10-05.
 * These are planning materials, not a live inventory, order offer or supplier partnership.
 * Selection does not certify hydraulic capacity, pressure/temperature suitability or wiring.
 */
export interface ServiceMaterial {
  id: string;
  label: string;
  supplier: string;
  system:
    | 'cold-water'
    | 'hot-water'
    | 'waste'
    | 'electrical'
    | 'ventilation'
    | 'refrigerant'
    | 'fire-water'
    | 'data';
  /** Supplier's size designation. It is not necessarily a measured bore or outside diameter. */
  nominalDiameterMm: number;
  /** Only present when the source explicitly identifies the outside diameter. */
  outerDiameterMm?: number;
  /** One published supply length; omitted when no length has been verified. */
  stockLengthM?: number;
  sourceUrl: string;
  notes: string;
}

export const BUILDING_SERVICES_CHECKED_AT = '2026-10-05';

const HPL_CATALOG = 'https://hplpipes.mu/wp-content/uploads/2025/04/HPL-Catalogue-View-2.pdf';
const ESPACE_HOT =
  'https://www.espacemaison.mu/shop/plumbing-cooling-and-heating/water-supply/hot-water-fittings';

export const BUILDING_SERVICES_SOURCES = [
  {
    supplier: 'HPL Pipes',
    url: HPL_CATALOG,
    checkedAt: BUILDING_SERVICES_CHECKED_AT,
    note: 'Manufacturer technical catalogue. PDF pages 2, 3, 7, 8 and 9 distinguish outside diameters. No current stock or prices imported.',
  },
  {
    supplier: 'Espace Maison',
    url: ESPACE_HOT,
    checkedAt: BUILDING_SERVICES_CHECKED_AT,
    note: 'Retailer hot-water range, pages 1–3. Published CPVC sizes and 4 m pipe length; exact outside diameters and fitting body dimensions are not specified.',
  },
  {
    supplier: 'STR',
    url: 'https://www.str.mu/our-products/hot-water-gas-pipes',
    checkedAt: BUILDING_SERVICES_CHECKED_AT,
    note: 'Local supplier lists PP-R Polychaud, PE-RT and CPVC. No presets inferred from the broad range; individual technical sizes remain to be confirmed.',
  },
  {
    supplier: 'Duraco',
    url: 'https://duraco.mu/our-products/sewage/manhole/',
    checkedAt: BUILDING_SERVICES_CHECKED_AT,
    note: 'Inspection-chamber and manhole reference for a future sewage module. Chamber body diameter is not a pipe diameter. No pipe preset inferred.',
  },
] as const;

function hplPipes(
  family: string,
  label: string,
  system: ServiceMaterial['system'],
  sizes: readonly number[],
  page: number,
  notes: string,
  stockLengthM?: number,
): ServiceMaterial[] {
  return sizes.map((diameter) => ({
    id: `hpl-${family}-${diameter}`,
    label: `${label} · ${diameter} mm OD`,
    supplier: 'HPL Pipes',
    system,
    nominalDiameterMm: diameter,
    outerDiameterMm: diameter,
    ...(stockLengthM === undefined ? {} : { stockLengthM }),
    sourceUrl: `${HPL_CATALOG}#page=${page}`,
    notes,
  }));
}

/** Keep continuous pipe/conduit runs separate from discrete fittings below. */
export const SERVICE_MATERIALS: readonly ServiceMaterial[] = [
  ...hplPipes(
    'aquasafe-upvc',
    'Aquasafe uPVC water pipe',
    'cold-water',
    [20, 25, 32, 40],
    8,
    'Published OD; not bore. Solvent-weld pressure pipe. Select pressure class and confirm length with supplier.',
  ),
  ...hplPipes(
    'aquasafe-hdpe',
    'Aquasafe HDPE supply pipe',
    'cold-water',
    [25, 32, 50],
    2,
    'Published OD; not bore. Choose matching pressure class and compression/electrofusion fittings. 50 m is one listed coil option; 100 m also listed.',
    50,
  ),
  ...[20, 25, 32].map(
    (diameter): ServiceMaterial => ({
      id: `espace-cpvc-${diameter}`,
      label: `CPVC hot-water pipe · ${diameter} mm`,
      supplier: 'Espace Maison',
      system: 'hot-water',
      nominalDiameterMm: diameter,
      stockLengthM: 4,
      sourceUrl: `${ESPACE_HOT}?page=3`,
      notes:
        'Retailer size designation, not verified OD or bore. Published 4 m length. Confirm pressure/temperature class and exact dimensions before installation.',
    }),
  ),
  ...hplPipes(
    'aquadrain-drainage',
    'Aquadrain uPVC drainage',
    'waste',
    [40, 50, 75, 110],
    7,
    'Published OD. Above-ground waste/rainwater range; do not assume soil-stack or buried-drain suitability. Joint allowance and falls need project review.',
  ),
  ...hplPipes(
    'aquadrain-sewer',
    'Aquadrain uPVC sewer',
    'waste',
    [110, 160],
    9,
    'Published OD. Rubber-ring joint range; SN4/SN8 options. Confirm application, socket allowance and installed gradient.',
  ),
  ...hplPipes(
    'aquaduct-ldpe',
    'Aquaduct LDPE conduit',
    'electrical',
    [20, 25, 32],
    3,
    'Published OD; not cable clearance. 50 m is one listed coil option; 100 m also listed. Cable fill and electrical protection require separate design.',
    50,
  ),
  ...[100, 125].map(
    (diameter): ServiceMaterial => ({
      id: `vortice-round-duct-${diameter}`,
      label: `Vortice round ventilation duct · ${diameter} mm`,
      supplier: 'Vortice · manufacturer reference',
      system: 'ventilation',
      nominalDiameterMm: diameter,
      stockLengthM: 1,
      sourceUrl: 'https://www.vortice.com/en/accessories%20and%20components',
      notes:
        'Checked 2026-10-15: VKC250 (100 mm) / VKC267 (125 mm), published 1 m lengths. Size designation, not verified OD. Mauritius supply of these duct models is unconfirmed. Espace Maison lists Vortice fans, not evidence of this duct stock. Airflow, noise, fire dampers and insulation require separate design.',
    }),
  ),
  ...[6.35, 9.52, 12.7, 15.88].map(
    (diameter): ServiceMaterial => ({
      id: `daikin-copper-${diameter}`,
      label: `Daikin AirFX refrigerant copper · ${diameter} mm OD`,
      supplier: 'Daikin · manufacturer reference',
      system: 'refrigerant',
      nominalDiameterMm: diameter,
      outerDiameterMm: diameter,
      sourceUrl:
        'https://commercial.daikin.com.au/files/brochures/DAI245_PCIAAU621-Daikin-Accessories-Catalogue-LR.pdf#page=3',
      notes:
        'Checked 2026-10-15: copper OD only, excludes insulation. Source lists paired coils: drawing one line is one physical tube, not a complete liquid/gas pair. Coil package quantity is deliberately omitted. Mauritius availability, refrigerant compatibility, matching pair, insulation, length/lift limits and pressure testing require confirmation.',
    }),
  ),
  ...[
    { nominal: 25.4, od: 33.4, size: '1' },
    { nominal: 50.8, od: 60.3, size: '2' },
  ].map(
    ({ nominal, od, size }): ServiceMaterial => ({
      id: `wheatland-sch10-${size}`,
      label: `Wheatland Schedule 10 fire pipe · NPS ${size} · ${od} mm OD`,
      supplier: 'Wheatland Tube · manufacturer reference',
      system: 'fire-water',
      nominalDiameterMm: nominal,
      outerDiameterMm: od,
      sourceUrl:
        'https://www.wheatland.com/wp-content/uploads/2021/08/Schedule-10-and-Schedule-40-Submittal-Sheet.pdf',
      notes:
        'Checked 2026-10-15: NPS inches converted to mm is a size designation, not bore or OD. Manufacturer Schedule 10 steel sprinkler pipe reference; Mauritius supply unconfirmed. No automatic hydraulic sizing, sprinkler spacing, pump/tank selection, approvals or fire-safety certification.',
    }),
  ),
  {
    id: 'belden-2412-cat6',
    label: 'Belden 2412 Category 6 cable · 5.69 mm nominal OD',
    supplier: 'Belden · manufacturer reference',
    system: 'data',
    nominalDiameterMm: 5.69,
    outerDiameterMm: 5.69,
    sourceUrl: 'https://www.belden.com/products/cable/ethernet-cable/category-6-cable/2412',
    notes:
      'Checked 2026-10-15: published overall nominal cable diameter. A physical data cable, not a conduit or electrical supply. Mauritius availability unconfirmed. PoE budget, segregation, bend radius, terminations, fire rating and permitted route length need project review.',
  },
];

/** Fitting size identifies the connected pipe, never the fitting's physical body width. */
export interface ServiceFitting {
  id: string;
  label: string;
  supplier: string;
  system: ServiceMaterial['system'];
  kind: 'elbow' | 'tee' | 'coupler' | 'valve';
  nominalDiameterMm: number;
  sourceUrl: string;
  notes: string;
}

export const SERVICE_FITTINGS: readonly ServiceFitting[] = [
  ...(['elbow', 'tee', 'coupler'] as const).flatMap((kind) =>
    [20, 25].map(
      (diameter): ServiceFitting => ({
        id: `espace-cpvc-${kind}-${diameter}`,
        label: `CPVC ${kind === 'coupler' ? 'socket' : kind === 'elbow' ? '90° elbow' : 'tee'} · ${diameter} mm`,
        supplier: 'Espace Maison',
        system: 'hot-water',
        kind,
        nominalDiameterMm: diameter,
        sourceUrl: ESPACE_HOT,
        notes:
          'Pipe connection size only. Body dimensions and socket insertion length not published; use a schematic symbol, not a claimed scaled product model.',
      }),
    ),
  ),
  ...[20, 32].map(
    (diameter): ServiceFitting => ({
      id: `espace-cpvc-valve-${diameter}`,
      label: `CPVC ball valve · ${diameter} mm`,
      supplier: 'Espace Maison',
      system: 'hot-water',
      kind: 'valve',
      nominalDiameterMm: diameter,
      sourceUrl: `${ESPACE_HOT}?page=${diameter === 20 ? 2 : 3}`,
      notes:
        'Connection size only. Confirm pressure rating, medium and adapters. This reference does not approve a valve for a CWA mains connection; valve body dimensions are unverified.',
    }),
  ),
];

export function serviceMaterialById(id: string | undefined): ServiceMaterial | undefined {
  return SERVICE_MATERIALS.find((material) => material.id === id);
}
