import type { MaterialSourceCandidate } from './sustainability';

export const SUSTAINABILITY_SOURCES = [
  {
    id: 'vaisala-dewpoint',
    title: 'Vaisala AWS810: WMO dew-point calculation',
    url: 'https://docs.vaisala.com/r/M212417EN-N/en-US/GUID-EBE2B115-3C98-4C8C-9F2D-A2FF1EFECFCC',
    note: 'Published Magnus constants 17.62 and 243.12; the app restricts its water-vapour screen to tropical 0–60°C conditions.',
  },
  {
    id: 'ashrae-material-moisture',
    title: 'ASHRAE 160: material sensitivity and time-dependent mould review',
    url: 'https://www.ashrae.org/file%20library/technical%20resources/standards%20and%20guidelines/standards%20addenda/160_2009_e_201601209.pdf',
    note: 'This historical addendum replaces a simple RH condition with a material-sensitive mould-index method. The app does not implement or claim compliance with that method.',
  },
  {
    id: 'mauritius-climate',
    title: 'Mauritius Meteorological Services: station climate data',
    url: 'https://metservice.intnet.mu/climate-services/climate-info-and-data.php',
    note: 'Local temperature, RH, wind, rain, radiation and evaporation data are available by station. No universal island climate is inferred.',
  },
  {
    id: 'epa-epd',
    title: 'US EPA: EPD declared units and life-cycle boundaries',
    url: 'https://www.epa.gov/system/files/documents/2024-08/final-pcr-criteria_8-5-24_508.pdf',
    note: 'A1–A3 manufacturing scope is different from whole-life carbon; equivalent function and consistent declared units are needed for comparison.',
  },
  {
    id: 'moss-operation',
    title: 'Green City Solutions: active moss system operating inputs',
    url: 'https://greencitysolutions.de/en/impact/',
    note: 'Manufacturer describes active ventilation, irrigation, electricity and water use. These are not a general yield or sequestration factor for other moss walls.',
  },
  {
    id: 'footfall-mechanism',
    title: 'Pavegen: electromagnetic footfall mechanism',
    url: 'https://www.pavegen.com/what-can-pavegen-power',
    note: 'Pavegen is electromagnetic, not piezoelectric. No manufacturer marketing output is loaded as a default for piezo tiles.',
  },
  {
    id: 'vehicle-wake-study',
    title: 'Tian, Mao & Li: vehicle-wake turbine simulation (2017)',
    url: 'https://doi.org/10.3390/en10040478',
    note: 'A limited two-dimensional single-car simulation; not a Mauritius highway energy guarantee or a full net-vehicle-energy assessment.',
  },
  {
    id: 'wind-energy',
    title: 'US Department of Energy: power in the wind',
    url: 'https://www.energy.gov/sites/default/files/2014/06/f16/wind_basicpvcwindturbine.pdf',
    note: 'Kinetic power is one-half times density times swept area times velocity cubed. Available wind energy is not electrical generation.',
  },
] as const;

/** Sourcing leads with explicit evidence scope; never stock, purchase or structural approvals. */
export const MAURITIUS_MATERIAL_CANDIDATES: readonly MaterialSourceCandidate[] = [
  {
    id: 'ubp-blocks',
    name: 'UBP — blocks and basalt aggregates',
    materialFamilies: ['concrete-block', 'aggregate', 'rocksand'],
    origin: 'mauritius-made',
    evidenceUrl: 'https://www.ubp.mu/',
    evidenceDate: '2026-10-15',
    evidenceNote:
      'Manufacturer identifies local production and sale of blocks, aggregates, rocksand and precast. Exact product EPD, stock, delivery and engineering suitability need confirmation.',
  },
  {
    id: 'gamma-concrete',
    name: 'Gamma Materials — concrete, blocks and aggregates',
    materialFamilies: ['concrete', 'concrete-block', 'aggregate', 'paving'],
    origin: 'mauritius-made',
    evidenceUrl: 'https://gammamaterials.mu/',
    evidenceDate: '2026-10-15',
    evidenceNote:
      'Manufacturer describes Mauritius production of concrete, aggregates, blocks and precast. Local manufacture alone does not demonstrate low embodied carbon.',
  },
  {
    id: 'premix-concrete',
    name: 'Premix / UBP — ready-mixed concrete',
    materialFamilies: ['concrete'],
    origin: 'mauritius-made',
    evidenceUrl: 'https://premix.mu/a-propos/',
    evidenceDate: '2026-10-15',
    evidenceNote:
      'Mauritius supplier and manufacturing portfolio verified. Engineer-selected exposure class, mix, testing and project-specific declarations remain necessary.',
  },
  {
    id: 'hemp-mauritius-trial',
    name: 'Mauritius industrial hemp — research lead',
    materialFamilies: ['hemp', 'hemp-block', 'bio-insulation'],
    origin: 'local-research',
    evidenceUrl:
      'https://pmo.govmu.org/CabinetDecision/2021/HIGHLIGHTS%20OF%20CABINET%20MEETING%20%E2%80%93%20%20FRIDAY%2006%20AUGUST%202021.pdf',
    evidenceDate: '2026-10-15',
    evidenceNote:
      'A 2021 Cabinet decision authorised proposed research trials. It does not prove present commercial cultivation, building-product availability or permission to grow hemp. Obtain current authority and supplier evidence.',
  },
  {
    id: 'isohemp-import',
    name: 'IsoHemp — international hemp-block candidate',
    materialFamilies: ['hemp', 'hemp-block', 'bio-insulation'],
    origin: 'import-candidate',
    evidenceUrl: 'https://www.isohemp.com/en',
    evidenceDate: '2026-10-15',
    evidenceNote:
      'Belgian manufacturer offers non-load-bearing hemp blocks. Mauritius distribution, import permission, tropical suitability and delivery are unconfirmed; no structural substitution is inferred.',
  },
  {
    id: 'mogu-mycelium-import',
    name: 'Mogu — international mycelium acoustic panels',
    materialFamilies: ['mycelium', 'acoustic-panel'],
    origin: 'import-candidate',
    evidenceUrl: 'https://mogu.bio/acoustic-collection/',
    evidenceDate: '2026-10-15',
    evidenceNote:
      'Manufacturer offers mycelium acoustic panels using textile residues. This is an interior acoustic product lead, not a load-bearing wall or Mauritius stock confirmation.',
  },
  {
    id: 'mycelium-mauritius-unknown',
    name: 'Mauritius mycelium construction supply — unverified',
    materialFamilies: ['mycelium', 'bio-insulation'],
    origin: 'unknown',
    evidenceNote:
      'No commercial Mauritius construction-grade mycelium supplier was verified in this review. Mushroom growth or local biological presence does not establish a tested construction product.',
  },
  {
    id: 'bagasse-feedstock',
    name: 'Mauritius bagasse — feedstock research lead',
    materialFamilies: ['bagasse', 'bio-composite'],
    origin: 'local-research',
    evidenceUrl: 'https://ode.govmu.org/ode-data/sugar-sector',
    evidenceDate: '2026-10-15',
    evidenceNote:
      'Official source confirms sugarcane by-products already contribute to electricity generation. A construction use requires allocated feedstock, competing-use analysis, material tests and an actual product supplier.',
  },
] as const;
