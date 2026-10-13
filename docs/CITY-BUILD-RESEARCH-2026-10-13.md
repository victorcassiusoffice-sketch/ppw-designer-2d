# City Build — Mauritius evidence and implementation boundaries

Research checked 13 October 2026, Indian/Mauritius. This file records source evidence and recommended behaviour, not a declaration that every recommended feature is implemented. No supplier was contacted, no account was created, and no order or invoice was sent.

## Workflow to preserve consistent calculations

1. Set the site boundary and measurement units. Keep all geometry in metres, with explicit ground elevation and utility depth. Concept defaults must remain editable and visibly separate from an engineer's approved specification.
2. Draw roads and paths, then utilities and development plots. A single canonical geometry must drive plan, 3D, area/length/volume estimates and procurement. Shared lengths and overlapping surfaces must not be silently double-counted.
3. Add buildings using the existing room/floor/foundation/services tools. City objects are measured planning envelopes; attaching a supplier reference does not replace the object's dimensions with a presumed product model.
4. Define data-centre demand, solar generation, storage, water and landscape scenarios. Show assumptions and units beside results. Empty or unknown values remain unknown rather than becoming a free product or zero demand.
5. Attach a verified supplier product or family reference. Obtain current model, drawings, rates, stock, lead time, transport/installation scope and quote validity before treating an item as orderable.
6. Group requirements by supplier and project phase. Record intended order date, requested invoice date, needed-on-site date, selected recipient email and approver. Freeze a version when the purchase order is approved; later design changes create a revision rather than rewriting an issued order.
7. Release only through the merchant's configured ordering/accounting connection with an audit trail, idempotency and delivery acknowledgement. Scheduling a date is not proof that an order or invoice was sent.

These are software workflow recommendations inferred from the engineering and supplier evidence below.

## Catalogue ready for reference selection

The implemented data file is `src/data/citySuppliers.ts`: **28 entries**, across roads, solar, water, electrical, digital and landscape. All entries are **quote-only references**, not connected merchant inventory. Exact published dimensions exist for five entries. Prices, availability and integration claims are deliberately absent. A named product family is not an exact SKU.

| Reference ID | Evidence class and source | Verified information / limits |
|---|---|---|
| premix-pervious | [Premix Pervious](https://premix.mu/produit/nos-produits-beton-beton-decoratif-drainant/) — family | Drainable concrete; pedestrian/cycle/parking applications. Actual infiltration depends on substrate and complete drainage design. |
| paving-mu-heavy-duty | [Paving Mauritius Heavy Duty](https://paving.mu/en/paving-block-heavy-duty.html) — product | 200 × 100 × 100 mm; 4.5 kg; published 35 MPa. No pavement-system approval inferred. |
| paving-mu-evergreen | [Paving Mauritius Evergreen](https://paving.mu/en/evergreen.html) — product | Explicit L400 × W400 × H120 mm; 25 kg; published 30 MPa. No tested permeability stated. |
| paving-mu-kerb | [Paving Mauritius kerb](https://paving.mu/en/kerb.html) — product | 450 × 200 × 125 mm; 22 kg. Axis orientation is not identified, so no automatic measured envelope is supplied. |
| metalite-leadsun | [Metalite](https://www.metalite.mu/) — family | Local supplier lists Leadsun solar street lighting. Model-specific photometry, pole, battery and dimensions remain unverified. |
| reneworld-hybrid-pv | [Reneworld solar power](https://reneworld.mu/solar-power-solutions/) — family | PV/storage packages; smallest published kit 2.5 kW. This is not a city-scale design or an availability guarantee. |
| solarex-atlas-ci | [Solarex battery families](https://www.solarex.mu/solar-batteries) — family | HYXI Atlas C&I: liquid cooling, IP55 listed. Exact capacity and envelope not verified. |
| solarex-atlas-container | [Solarex battery families](https://www.solarex.mu/solar-batteries) — family | Container family advertised up to 5 MWh; this is a range maximum, not a default usable capacity. |
| hpl-aquasafe-hdpe | [HPL catalogue, page 2](https://hplpipes.mu/wp-content/uploads/2025/04/HPL-Catalogue-View-2.pdf) — family | 20–250 mm OD; PN10/PN16. Exact variant must be selected. |
| str-pe-pipe | [STR water/drainage](https://www.str.mu/our-products/water-supply-drainage-sewerage) — family | PE pipe range 20–400 mm. No pressure class inferred from diameter. |
| hpl-aquadrain-sewer | [HPL catalogue, page 9](https://hplpipes.mu/wp-content/uploads/2025/04/HPL-Catalogue-View-2.pdf) — family | 110/160 mm table; SN4/SN8. SN is ring stiffness, not pressure rating. |
| duraco-rainwater-9000 | [Sofo Soler / Duraco rainwater](https://www.sofo-soler.mu/collections/duraco/products/duraco-rain-water-tank) — product | 9000 L integrated-filter variant: L2150 × W2150 × H2830 mm. Retailer specification, not a manufacturer drawing. |
| duraco-underground-4700 | [QBM / Duraco underground](https://quincailleriebonmarche.com/product/duraco-underground-water-tank-4700l/) — product | 4700 L; L2315 × W1725 × H2000 mm. Below-ground installation, groundwater and traffic loading need review. |
| duraco-septic | [Duraco quote catalogue](https://www.duraco.mu/get-a-quote?prod=1139) — family | Manufacturer lists septic systems. No flow, treatment performance or discharge approval inferred. |
| str-ductile-iron | [STR ductile iron](https://www.str.mu/our-products/ductile-iron-pipes-fittings-manhole-covers) — family | Pipe/fitting range. Diameter, pressure, lining and restraints need selection. |
| cmh-distribution | [CMH electrical](https://cmh.mu/electrical/) — family | Distribution boards with named Legrand/Schneider brands. Ratings require a project quote. |
| cmh-earthing | [CMH electrical](https://cmh.mu/electrical/) — family | Cable and earthing categories. No conductor sizing or electrode resistance assumed. |
| cmh-ev-charging | [CMH electrical](https://cmh.mu/electrical/) — family | EV equipment category; charger rating/connector not specified. |
| hpl-aquaduct | [HPL catalogue, page 6](https://hplpipes.mu/wp-content/uploads/2025/04/HPL-Catalogue-View-2.pdf) — family | Rigid duct 20–160 mm; MS IEC 61386/24 reference. Confirm crush class and utility acceptance. |
| str-telecom-duct | [STR cable management](https://www.str.mu/our-products/cable-management) — family | Telecom conduit reference; no fibre capacity or carrier connection implied. |
| legrand-data-racks | [Legrand Mauritius data centres](https://www.legrand.mu/fr/node/4381) — family | Mighty Mo 20 rack range listed. Exact enclosure/clearances unspecified. |
| legrand-data-cooling | [Legrand Mauritius data centres](https://www.legrand.mu/fr/node/4381) — family | Cooling and airflow separation; no calculated heat-removal rating. |
| legrand-data-fibre | [Legrand Mauritius data centres](https://www.legrand.mu/fr/node/4381) — family | OM3/OM4 and MPO/MTP families. Not an external network connection. |
| legrand-data-ups | [Legrand grey spaces](https://www.legrand.mu/en/solutions/data-center-solutions/grey-spaces) — family | UPS offering. Model-specific kW/kVA, losses and runtime required. |
| legrand-data-pdu | [Legrand Mauritius data centres](https://www.legrand.mu/fr/node/4381) — family | Raritan PX intelligent PDU range. Electrical ratings not inferred. |
| duraco-compost-250 | [Sofo Soler / Duraco compost](https://www.sofo-soler.mu/collections/duraco/products/duraco-compost-bin) — product | 250 L; L885 × W590 × H885 mm. No waste-processing throughput given. |
| medine-endemic-plants | [Medine Garden Center](https://medine.com/medines-garden-center-paradise-of-endemic-and-exotic-plants/) — family | Named endemic plants and nursery propagation; present stock and mature envelopes need confirmation. |
| endemika-nursery | [Endemika](https://www.endemika.mu/endemika-nursery/) — family | Endemic nursery range. Site suitability and planting sizes remain project-specific. |

Verification means that a supplier/manufacturer published the cited information when checked; it is not independent certification, merchant onboarding or guaranteed stock. The named retailers are primary sources for their own listings. Manufacturer confirmation is still needed before equipment release. No supplier is called the largest or best.

Some primary pages were retrievable only through indexed source text: Metalite and Legrand's overview. Duraco's former rainwater URL returns 404 after its site change, so it is not used as a product source. The Sofo rainwater page has a conflicting underground table; only its separately labelled 9000 L above-ground variant is used. HPL's catalogue mixes pressure terminology with SN sewer classes; the app does not interpret SN as PN or adopt its ambiguous application text. Do not silently repair a source ambiguity by inventing data.

## Authority and engineering references

| Topic | Primary source | Consequence for the workflow |
|---|---|---|
| Planning and roads | [Mauritius Planning Policy Guidance](https://housing.govmu.org/Pages/Services/PlanningPolicyGuidance.aspx) and [Planning Division](https://housing.govmu.org/Pages/Dept%20and%20Org/Divisions/Planning.aspx) | PPGs provide design/performance guidance used in planning decisions. Record the applicable local scheme and relevant revision; generic road widths are editable planning assumptions, not an approval. |
| Road interfaces | [Road Development Authority](https://rda.govmu.org/rda/?page_id=4237) | Keep classified-road works/interfaces in an authority review stage. This forms page is not a general road-design standard. |
| Environment | [Mauritius EIA guidance](https://environment.govmu.org/Pages/Environment-Impact-Accessment-2.aspx) | The Ministry describes EIA undertakings under the Environment Act 2024 and possible review of other impactful projects. City Build cannot decide licence applicability automatically. |
| Water supply | [CWA applications](https://cwa.govmu.org/cwa/?page_id=743) | Connection/enlargement applications need supporting site information; a pipe placed on a plan is not a granted connection. |
| Wastewater | [WMA sewer connections](https://www.wmamauritius.mu/house-connection/) and [WMA forms](https://www.wmamauritius.mu/forms-downloadables/) | Feasibility depends on surveyed connection depth, gradients and permissions. Project treatment plants have a separate application process. |
| Electricity and solar | [CEB current grid-code index](https://ceb.mu/projects/grid-codes) | Index currently lists SSDG 2026, MSDG 50–500 kW September 2024, MSDG 500 kW–2 MW August 2024, and National Grid Code above 2 MW. Choose by actual capacity and scheme; do not use the old 2019 landing page as the current code. |
| Telecom | [ICTA directives](https://www.icta.mu/consolidated-icta-directives/) and [regulations](https://www.icta.mu/regulations/) | Carrier, equipment and infrastructure requirements must be reviewed with the relevant operator/authority. A duct reference is not an internet service. |
| Data-centre efficiency | [The Green Grid PUE](https://www.thegreengrid.org/node/372) | PUE = total facility energy / ICT equipment energy over the same measurement boundary and period. Solar generation is not subtracted from the numerator. |
| Data-centre design practice | [EU JRC 2025 best practices, JRC141521](https://publications.jrc.ec.europa.eu/repository/handle/JRC141521) and [US DOE design guide](https://www.energy.gov/sites/default/files/2024-07/best-practice-guide-data-center-design.pdf) | Use as design references for energy management, airflow and metering; they do not certify a design or establish Mauritius statutory requirements. |
| Invoice issue | [MRA e-invoicing](https://www.mra.mu/index.php/e-invoicing) and [MRA technical guidance](https://www.mra.mu/download/InvoicingRegulations.pdf) | Covered invoices require the merchant's applicable EBS/fiscalisation process before issue. A requested invoice date or exported procurement draft is not a fiscalised invoice. |

## Calculation requirements and boundaries

- **Roads:** surface area comes from the drawn geometry. Layer quantity is area × selected compacted thickness. Do not equate loose purchase volume and compacted layer volume without a declared conversion. Deduct overlaps once when computing total land coverage; keep separate construction layers and procurement waste factors.
- **Utilities:** compute 3D centreline length from XYZ coordinates, separately from trench volume and pipe material volume. Outside diameter is not bore. Keep water, foul sewer, stormwater, power and data identities separate. Pipe connectivity in the UI is not a hydraulic/pressure-drop test; neither a rendered cable nor a selected power rating proves voltage drop, fault withstand or selectivity.
- **Lighting:** count luminaires and calculate energy using the selected real electrical load and operating profile. Pole spacing alone cannot prove lighting-class compliance. Photometric files, mounting height, uniformity, glare, battery ageing, shading and cyclone loading are separate design inputs.
- **Solar/storage:** DC installed capacity is not constant delivered power. Show generation assumptions and demand separately. Nominal battery energy is not usable autonomy; usable fraction, conversion losses, load profile, charge limits and power rating are needed. Do not claim continuous clean supply from annual generation matching annual consumption.
- **Data centre:** use design IT load, utilisation scenario and an explicitly entered PUE target for an estimate. A target is not measured PUE. Facility energy = IT energy × PUE; do not add separately estimated cooling again if PUE already includes it. Keep cooling capacity in thermal kW distinct from electrical kW. UPS kVA is not kW. Redundancy options are planning intents until the topology, failure modes and maintainability are engineered.
- **Water/ecology:** tank capacity is rated litres, not its rectangular envelope volume. Rainwater yield needs rainfall, catchment and runoff losses. Compost-bin volume is not daily processing capacity. Planted area is not verified carbon removal or biodiversity gain. Avoid counting overlapping green/road/building areas as independent net site coverage.
- **Cost/order:** preserve quantity unit, design revision, supplier identity, quote currency/validity and tax basis. Missing rates stay unquoted. Distinguish order request, supplier acceptance, invoice issue, dispatch, receipt and installation. A scheduled request must not silently become a sent order after design changes.

## Recommended staged release

The useful first release is a city layout, paired 2D/3D measured objects, transparent quantity/energy scenarios, supplier references and a procurement dashboard with draft schedules. Continue to use the existing building tools for detailed interiors, foundations and services. Professional drawings, geotechnical work, traffic/transport assessment, hydraulic modelling, electrical protection studies, structural/cyclone design, data-centre reliability assessment and authority decisions remain specialist inputs. Keep these inputs attachable/versioned rather than implying automatic approval.

Merchant ordering should progress from saved drafts and exports, to sandbox connector tests, to approved production integrations with authorised recipient addresses. Public pitch demos must not send orders or fiscal invoices.
