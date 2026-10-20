/**
 * Supplier references, not live inventory or approved infrastructure designs.
 * Every entry is quote-only. A reference never changes an asset's measured envelope.
 * Evidence and source limitations: docs/CITY-BUILD-RESEARCH-2026-10-13.md.
 */
export interface CitySupplierReference {
  id: string
  name: string
  supplier: string
  category: 'roads' | 'solar' | 'water' | 'electrical' | 'digital' | 'landscape'
  sourceUrl: string
  checkedAt: '2026-10-13'
  kind: 'product' | 'family'
  description: string
  sustainabilityNote?: string
  verifiedDimensions?: { widthM: number; lengthM: number; heightM: number }
  powerW?: number
  capacityL?: number
}

const checkedAt = '2026-10-13' as const
const hplCatalogue = 'https://hplpipes.mu/wp-content/uploads/2025/04/HPL-Catalogue-View-2.pdf'
const legrandDataCentre = 'https://www.legrand.mu/fr/node/4381'
const cmhElectrical = 'https://cmh.mu/electrical/'

export const CITY_SUPPLIER_REFERENCES: readonly CitySupplierReference[] = [
  {
    id: 'premix-pervious', name: 'Les Esthétiques Pervious concrete', supplier: 'Premix Mauritius', category: 'roads', kind: 'family', checkedAt,
    sourceUrl: 'https://premix.mu/produit/nos-produits-beton-beton-decoratif-drainant/',
    description: 'Pervious concrete for paths, cycleways, pedestrian streets and parking. Thickness, base and loading need a project specification.',
    sustainabilityNote: 'Supplier describes rainwater infiltration and temporary storage; actual performance depends on the whole drainage system.',
  },
  {
    id: 'paving-mu-heavy-duty', name: 'Paving Block Heavy Duty', supplier: 'Paving Mauritius', category: 'roads', kind: 'product', checkedAt,
    sourceUrl: 'https://paving.mu/en/paving-block-heavy-duty.html',
    description: 'Published block: 200 × 100 × 100 mm, 4.5 kg, 35 MPa. Road loading and base design require separate assessment.',
    verifiedDimensions: { lengthM: 0.2, widthM: 0.1, heightM: 0.1 },
  },
  {
    id: 'paving-mu-evergreen', name: 'Evergreen paving block', supplier: 'Paving Mauritius', category: 'roads', kind: 'product', checkedAt,
    sourceUrl: 'https://paving.mu/en/evergreen.html',
    description: 'Published block: 400 × 400 × 120 mm, 25 kg, 30 MPa. No verified system infiltration rate is supplied.',
    verifiedDimensions: { lengthM: 0.4, widthM: 0.4, heightM: 0.12 },
  },
  {
    id: 'paving-mu-kerb', name: 'Concrete kerb', supplier: 'Paving Mauritius', category: 'roads', kind: 'product', checkedAt,
    sourceUrl: 'https://paving.mu/en/kerb.html',
    description: 'Published kerb dimensions: 450 × 200 × 125 mm; 22 kg. Confirm orientation, profile and installation details with the supplier.',
  },
  {
    id: 'metalite-leadsun', name: 'Leadsun solar street lighting', supplier: 'Metalite Mauritius', category: 'solar', kind: 'family', checkedAt,
    sourceUrl: 'https://www.metalite.mu/',
    description: 'All-in-one solar lighting range. Select a model, photometry, pole and battery specification before ordering.',
    sustainabilityNote: 'Solar-powered street-light family; lighting coverage and autonomy have not been calculated from this reference.',
  },
  {
    id: 'reneworld-hybrid-pv', name: 'Hybrid solar PV and storage', supplier: 'Reneworld Mauritius', category: 'solar', kind: 'family', checkedAt,
    sourceUrl: 'https://reneworld.mu/solar-power-solutions/',
    description: 'PV, battery and energy-management packages. Published starting system size: 2.5 kW; city systems require a bespoke design.',
    sustainabilityNote: 'Combines solar generation with storage. No guaranteed yield, autonomy or emissions saving is implied.',
  },
  {
    id: 'solarex-atlas-ci', name: 'HYXI Atlas C&I battery storage', supplier: 'Solarex Mauritius', category: 'solar', kind: 'family', checkedAt,
    sourceUrl: 'https://www.solarex.mu/solar-batteries',
    description: 'Liquid-cooled commercial storage cabinet family; supplier lists IP55. Capacity and protection design require a quote.',
    sustainabilityNote: 'Storage can shift solar energy use; it does not generate electricity.',
  },
  {
    id: 'solarex-atlas-container', name: 'HYXI Atlas container storage', supplier: 'Solarex Mauritius', category: 'solar', kind: 'family', checkedAt,
    sourceUrl: 'https://www.solarex.mu/solar-batteries',
    description: 'Containerised storage family advertised up to 5 MWh. Grid connection and fire strategy need project approval.',
    sustainabilityNote: 'Stores electricity for later use; usable energy and losses depend on the selected configuration.',
  },
  {
    id: 'hpl-aquasafe-hdpe', name: 'AQUASAFE HDPE water pipe', supplier: 'HPL Mauritius', category: 'water', kind: 'family', checkedAt,
    sourceUrl: hplCatalogue,
    description: 'Catalogue: 20–250 mm outside diameters, PN10/PN16, EN12201 reference. Select exact pressure class and joining system.',
  },
  {
    id: 'str-pe-pipe', name: 'Polyethylene water and utility pipe', supplier: 'STR Marketing Mauritius', category: 'water', kind: 'family', checkedAt,
    sourceUrl: 'https://www.str.mu/our-products/water-supply-drainage-sewerage',
    description: 'Published PE range: 20–400 mm for irrigation, sewerage and water supply. Exact wall thickness and pressure class require confirmation.',
  },
  {
    id: 'hpl-aquadrain-sewer', name: 'AQUADRAIN underground sewer pipe', supplier: 'HPL Mauritius', category: 'water', kind: 'family', checkedAt,
    sourceUrl: hplCatalogue,
    description: 'Catalogue table: 110/160 mm, SN4/SN8 ring stiffness, rubber-ring joints. SN is not a pressure rating; confirm duty before use.',
  },
  {
    id: 'duraco-rainwater-9000', name: 'Duraco rainwater tank 9000 L', supplier: 'Sofo Soler Moris / Duraco', category: 'water', kind: 'product', checkedAt,
    sourceUrl: 'https://www.sofo-soler.mu/collections/duraco/products/duraco-rain-water-tank',
    description: 'Integrated-filter variant. Retailer publishes 2150 × 2150 × 2830 mm. Installation and water use require supplier confirmation.',
    sustainabilityNote: 'Designed for rainwater collection; harvested water is not automatically potable.',
    capacityL: 9000, verifiedDimensions: { lengthM: 2.15, widthM: 2.15, heightM: 2.83 },
  },
  {
    id: 'duraco-underground-4700', name: 'Duraco underground tank 4700 L', supplier: 'QBM Mauritius / Duraco', category: 'water', kind: 'product', checkedAt,
    sourceUrl: 'https://quincailleriebonmarche.com/product/duraco-underground-water-tank-4700l/',
    description: 'Retailer publishes 2315 × 1725 × 2000 mm. Below-ground tank; groundwater, traffic loading and installation need professional review.',
    capacityL: 4700, verifiedDimensions: { lengthM: 2.315, widthM: 1.725, heightM: 2 },
  },
  {
    id: 'duraco-septic', name: 'Septic systems', supplier: 'Duraco Mauritius', category: 'water', kind: 'family', checkedAt,
    sourceUrl: 'https://www.duraco.mu/get-a-quote?prod=1139',
    description: 'Manufacturer-listed septic range. Flow, effluent treatment, disposal route and authority acceptance require a project design.',
  },
  {
    id: 'str-ductile-iron', name: 'Ductile iron pipes and fittings', supplier: 'STR Marketing Mauritius', category: 'water', kind: 'family', checkedAt,
    sourceUrl: 'https://www.str.mu/our-products/ductile-iron-pipes-fittings-manhole-covers',
    description: 'Utility pipe and fitting families. Confirm diameter, lining, pressure class, restraints and compatibility.',
  },
  {
    id: 'cmh-distribution', name: 'Electrical distribution boards', supplier: 'CMH Mauritius', category: 'electrical', kind: 'family', checkedAt,
    sourceUrl: cmhElectrical,
    description: 'Distribution-board offering with Legrand and Schneider brands. Fault level, protection and ratings need an electrical design.',
  },
  {
    id: 'cmh-earthing', name: 'Power cables and earthing', supplier: 'CMH Mauritius', category: 'electrical', kind: 'family', checkedAt,
    sourceUrl: cmhElectrical,
    description: 'Published cable and earthing categories. Conductor sizing, soil resistivity and protection coordination are not inferred.',
  },
  {
    id: 'cmh-ev-charging', name: 'EV charging equipment', supplier: 'CMH Mauritius', category: 'electrical', kind: 'family', checkedAt,
    sourceUrl: cmhElectrical,
    description: 'EV charger category; obtain model, power rating, connector and load-management details before procurement.',
  },
  {
    id: 'hpl-aquaduct', name: 'AQUADUCT electrical and telecom ducts', supplier: 'HPL Mauritius', category: 'electrical', kind: 'family', checkedAt,
    sourceUrl: hplCatalogue,
    description: 'Rigid uPVC duct range: 20–160 mm; catalogue references MS IEC 61386/24. Select crush class and utility-approved specification.',
  },
  {
    id: 'str-telecom-duct', name: 'PVC conduit — telecom specification', supplier: 'STR Marketing Mauritius', category: 'digital', kind: 'family', checkedAt,
    sourceUrl: 'https://www.str.mu/our-products/cable-management',
    description: 'Telecom conduit family. Duct ownership, route, chamber spacing and service-provider acceptance must be confirmed.',
  },
  {
    id: 'legrand-data-racks', name: 'Mighty Mo 20 racks and hosting', supplier: 'Legrand Mauritius', category: 'digital', kind: 'family', checkedAt,
    sourceUrl: legrandDataCentre,
    description: 'Rack and hosting families. Rack units, envelope, weight and service clearances require an exact model.',
  },
  {
    id: 'legrand-data-cooling', name: 'Data-centre cooling and airflow', supplier: 'Legrand Mauritius', category: 'digital', kind: 'family', checkedAt,
    sourceUrl: legrandDataCentre,
    description: 'Cooling, air separation and airflow-management solutions; capacity and redundancy need a thermal design.',
    sustainabilityNote: 'Air separation can support efficient cooling; no PUE or water-use improvement is guaranteed.',
  },
  {
    id: 'legrand-data-fibre', name: 'OM3/OM4 and MPO/MTP fibre systems', supplier: 'Legrand Mauritius', category: 'digital', kind: 'family', checkedAt,
    sourceUrl: legrandDataCentre,
    description: 'Structured fibre and patching families. Select fibre type, route, termination, link budget and resilience.',
  },
  {
    id: 'legrand-data-ups', name: 'Data-centre UPS', supplier: 'Legrand Mauritius', category: 'digital', kind: 'family', checkedAt,
    sourceUrl: 'https://www.legrand.mu/en/solutions/data-center-solutions/grey-spaces',
    description: 'UPS family. Quote rated kW/kVA, efficiency curve, runtime and redundancy at the project load.',
    sustainabilityNote: 'Manufacturer describes reduced losses with higher UPS efficiency; exact performance is model and load dependent.',
  },
  {
    id: 'legrand-data-pdu', name: 'Raritan PX intelligent PDUs', supplier: 'Legrand Mauritius', category: 'digital', kind: 'family', checkedAt,
    sourceUrl: legrandDataCentre,
    description: 'Metered distribution family with monitoring options. Select electrical ratings and outlets for the rack design.',
  },
  {
    id: 'duraco-compost-250', name: 'Duraco compost bin 250 L', supplier: 'Sofo Soler Moris / Duraco', category: 'landscape', kind: 'product', checkedAt,
    sourceUrl: 'https://www.sofo-soler.mu/collections/duraco/products/duraco-compost-bin',
    description: 'Retailer publishes 885 × 590 × 885 mm. Small organic-waste composting unit.',
    sustainabilityNote: 'Designed to compost suitable organic waste; no processing throughput or carbon saving is assumed.',
    capacityL: 250, verifiedDimensions: { lengthM: 0.885, widthM: 0.59, heightM: 0.885 },
  },
  {
    id: 'medine-endemic-plants', name: 'Endemic trees, palms and shrubs', supplier: 'Medine Garden Center', category: 'landscape', kind: 'family', checkedAt,
    sourceUrl: 'https://medine.com/medines-garden-center-paradise-of-endemic-and-exotic-plants/',
    description: 'Nursery lists endemic plants including Bois Benjouin and Palmier Bouteille. Confirm species, size, provenance and current stock.',
    sustainabilityNote: 'Nursery describes endemic-plant propagation; the planting plan must suit the site and local ecology.',
  },
  {
    id: 'endemika-nursery', name: 'Endemic nursery planting', supplier: 'Endemika Mauritius', category: 'landscape', kind: 'family', checkedAt,
    sourceUrl: 'https://www.endemika.mu/endemika-nursery/',
    description: 'Endemic-plant nursery range. Species, root spread, maintenance and planting clearances require a landscape specification.',
    sustainabilityNote: 'Nursery focuses on Mauritius biodiversity; no quantified biodiversity gain is inferred.',
  },
]
