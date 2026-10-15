# One Live Build — sustainability screening and evidence

Research started 15 October 2026, reviewed across the 16 October Mauritius midnight rollover. This note describes the implemented calculation scope. It is not an environmental endorsement, supplier agreement, planning permission or structural certification.

## Implemented files and API

- `C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/src/designer/sustainability.ts` — pure, SI-unit screening functions, no network calls, geometry changes or purchase side effects.
- `C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/src/designer/sustainabilityEvidence.ts` — primary-source links and eight sourcing leads, with evidence scope and unknown availability stated.
- `C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/src/designer/__tests__/sustainability.test.ts` — numeric, dimensional and missing-evidence regressions.

| API                                                   | Input/output purpose                                                                                                                                                                                                  |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `screenHygrothermal`                                  | Enter adjacent-air temperature/RH, surface temperature, optional material test threshold/exposure and matched drying test; receive dew point, surface RH, condensation flag and qualified threshold/rate projections. |
| `calculateComponentCarbon`                            | Convert a component quantity into its declaration unit using explicit sourced dimensions/mass, then multiply by declared GWP factor.                                                                                  |
| `summarizeComponentCarbon`                            | Report covered records and subtotals by exact life-cycle boundary; withhold a combined complete total if inputs are absent, duplicate, overflowing or scopes differ.                                                  |
| `matchMaterialSources`                                | Match material family to evidence-backed local manufacture, an international import candidate, a research lead or unknown supply. Delivery and functional equivalence require additional evidence.                    |
| `screenSurfaceTechnology` / `rankSurfaceTechnologies` | Separate net electrical output per installed area, declared embodied carbon per area and conditional carbon repayment. No invented combined sustainability score.                                                     |
| `windKineticEnergyUpperBoundKwh`                      | Integrate available wind kinetic energy from measured speed/time bins and swept area. This is an upper bound, not a generator output forecast.                                                                        |

All exposed calculation statuses distinguish `screened`, `needs-data` and `invalid`. “Screened” means the stated arithmetic could be evaluated, not that the source was independently audited or the design is safe. Blank evidence is never treated as zero impact.

## Moisture, tropical climate and material behaviour

The water-vapour Magnus relation is taken from the [Vaisala AWS810 documentation of WMO formulae](https://docs.vaisala.com/r/M212417EN-N/en-US/GUID-EBE2B115-3C98-4C8C-9F2D-A2FF1EFECFCC). With air temperature `T` in °C and RH in percent, `gamma = ln(RH/100) + 17.62 T/(243.12+T)` and `Td = 243.12 gamma/(17.62-gamma)`. The app restricts air and surface temperature input to 0–60°C. RH must be positive and no greater than 100%. The dew point is a water-vapour approximation; this is not an ice/frost model.

At unchanged adjacent-air vapour pressure, `RHsurface = RHair × exp(17.62 Tair/(243.12+Tair) − 17.62 Tsurface/(243.12+Tsurface))`. The reported RH is capped at 100%; a surface at or below dew point raises the condensation flag. The app does not infer surface temperature from room geometry, insulation thickness or an HVAC setpoint.

An 80% surface-RH review notice is deliberately not a “safe/unsafe” material verdict. [ASHRAE's moisture handbook](https://handbook.ashrae.org/Handbooks/A15/IP/A15_CH62/a15_ch62_ip.aspx) discusses surface moisture and mould sensitivity. The [historical ASHRAE 160 addendum introducing a material-sensitive mould-index method](https://www.ashrae.org/file%20library/technical%20resources/standards%20and%20guidelines/standards%20addenda/160_2009_e_201601209.pdf) shows why a fixed RH value is not a complete compliance calculation. The app does not implement that index or claim ASHRAE compliance. Material threshold comparisons need a cited test limit, duration and exposure entered by the assessor; even “below entered threshold” is not proof of no mould.

There are no invented hemp, mycelium, concrete or plaster drying coefficients. The optional schedule projection is `(initial moisture − target moisture) / measured percentage-point loss per day`, floored at zero. A source and an explicit matching-conditions confirmation are required. The assessor must confirm identical material, thickness, moisture measurement basis, ventilation, temperature and humidity. Constant drying rate is only a planning approximation: changing diffusion, equilibrium moisture, coatings, curing chemistry and rainfall can invalidate it. No automated “ready to close the wall” approval is produced.

[Mauritius Meteorological Services](https://metservice.intnet.mu/climate-services/climate-info-and-data.php) provides station-based rainfall, temperature, humidity, wind, radiation and evaporation records. Site-specific hourly data, driving rain, orientation and exposure are necessary for a full transient assessment. No island-wide fixed temperature, RH or climate file is assumed. Windward/leeward classification alone cannot predict facade drying.

## Carbon accounting and component records

[US EPA's EPD/PCR criteria](https://www.epa.gov/system/files/documents/2024-08/final-pcr-criteria_8-5-24_508.pdf) distinguish declared units, functional equivalence and life-cycle stages. A1–A3 covers production; it is not the same boundary as whole-life accounting. The engine retains the exact entered boundary and does not add module D credits into production totals. Product comparisons still require compatible PCR/method, reference service life, use, geography, transport, replacements and end-of-life treatment.

Implemented units: kg, linear metre, m², m³, litre and item. Same-unit quantities need no conversion. Litres convert exactly to m³ at 1,000 L/m³ without a material assumption. Explicit declared density can convert m³↔kg or L↔kg; thickness converts m²↔m³; both convert m²↔kg. Sourced item mass, area or volume supports direct per-item conversions. Linear wall length never automatically becomes area, volume or mass. Conversion data are metadata for this assessment and never rescale the actual design.

`kgCO2e = quantity in declared unit × declared kgCO2e per unit`. No generic cement, mycelium or hemp factor is installed. Negative EPD factors remain visible with a biogenic-storage limitation; they are not permanent-removal credits. Summary coverage counts component records, not mass or impact. A small screw with an EPD and an unquantified concrete slab must not read as “half the building's carbon assessed.” “Complete comparable total” means complete same-boundary inputs only, not automatic verification that every EPD method is equivalent. Duplicate IDs or numeric overflow withhold subtotals as well as the complete total.

The engine supports an auditable evidence pack for environmental stakeholders. It does not claim to pre-approve objections from Eco-Sud or any public body. Site biodiversity, land use, water demand, toxicity and lifecycle effects remain separate from a carbon number.

## Local manufacture, imports and research leads

The matching engine filters exact material-family tags. It orders confirmed delivery evidence, catalogue leads, research leads and unverified leads; it does not award “local equals green” points. An actual delivery confirmation is distinct from finding a web catalogue. The exact intended use is documented only when the candidate carries specific sourced use evidence; otherwise review remains required. No product is automatically substituted into the structural model.

| Candidate                                                                                                                                                                          | Verified evidence and permitted interpretation                                                                                                                                                                                                                    |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [UBP](https://www.ubp.mu/)                                                                                                                                                         | Local manufacture/sale of blocks, basalt aggregates, rocksand and precast is described by the manufacturer. No SKU EPD, feedstock carbon, stock or project delivery is inferred.                                                                                  |
| [Gamma Materials](https://gammamaterials.mu/)                                                                                                                                      | Manufacturer identifies Mauritius production of aggregates, concrete, blocks and precast. Lower carbon must be established by actual declarations and equivalent specifications.                                                                                  |
| [Premix / UBP](https://premix.mu/a-propos/)                                                                                                                                        | Mauritius concrete supply portfolio is documented. The engineer still specifies exposure, mix, testing and project suitability.                                                                                                                                   |
| [Mauritius hemp research decision, 6 August 2021](https://pmo.govmu.org/CabinetDecision/2021/HIGHLIGHTS%20OF%20CABINET%20MEETING%20%E2%80%93%20%20FRIDAY%2006%20AUGUST%202021.pdf) | Government authorised proposed pilot research. This historical decision does not establish current commercial production, permission for a project to cultivate hemp, or a purchasable building product. Current regulatory and supplier confirmation are needed. |
| [IsoHemp](https://www.isohemp.com/en)                                                                                                                                              | International hemp-block manufacturing candidate. The published product is non-load-bearing. Mauritius distribution, imports, cyclone details and tropical suitability remain unconfirmed.                                                                        |
| [Mogu Acoustic](https://mogu.bio/acoustic-collection/)                                                                                                                             | International mycelium acoustic panel candidate using textile residues. This does not establish structural wall capacity or Mauritius stock. A local construction-grade mycelium supplier was not verified in this review.                                        |
| [Mauritius sugar-sector data](https://ode.govmu.org/ode-data/sugar-sector)                                                                                                         | Bagasse already serves energy production. Potential construction feedstock needs competing-use analysis, allocated supply, material testing and an actual manufacturer; local biomass is not automatically uncommitted.                                           |

Research-only and unverified records remain visible so teams can collect evidence; they cannot become supplier-confirmed construction availability merely by adding a target date.

## Surface technology assessment

The user can compare explicitly measured scenarios. Every claimed zero (auxiliary electricity, maintenance emissions or vehicle penalty) needs a source just as a positive value does. Area is the installed/treated footprint declared by the assessor; comparable alternatives must use the same denominator definition. Moss does not enter the electricity-generation ranking.

- Electrical event energy: `annual activations × delivered joules per activation / 3,600,000 = annual kWh`. The count must be actual activated tile steps or vehicle passes, not all nearby pedestrians or motorway traffic assumed to interact with the device. Measured delivered joules already include the device conversion losses. Extrapolation still needs local uptime, seasonality and independent validation.
- Net electrical intensity: `(annual electrical output − auxiliary electricity) / installed m²`. Negative values are retained. This metric excludes embodied energy and is not an energy-return-on-investment claim.
- Embodied intensity: `declared assembly kgCO2e / installed m²`, with its boundary. Do not compare an A1–A3 product to an A1–C4 assembly as though they were equivalent.
- Annual avoided emissions: `net electricity × sourced grid displacement factor − other operating emissions − attributable vehicle penalty`. The vehicle term is mandatory for traffic turbines. Net electrical output alone is not proof of net societal energy/carbon benefit.
- Carbon repayment is reported only with positive annual avoided emissions, nonnegative evidenced embodied impact, evidenced service life and a repayment within that life. Replacements/maintenance must be included in the input assessment. No monetary payback or budget is fabricated.

### Moss walls

[Green City Solutions](https://greencitysolutions.de/en/impact/) describes active irrigation, ventilation and electricity/water consumption for its own systems. This supports including operation, not transferring its marketing performance to every moss facade. The engine assigns zero electricity generation, never an unverified negative carbon factor. Windward exposure triggers review of driving rain, salt, cyclone anchorage and saturation; sheltered/leeward exposure triggers irrigation, shade, heat and airflow review. Neither receives a numerical ecology score or growth multiplier. Species selection, biodiversity, irrigation water and long-term storage need site evidence.

### Piezo/kinetic flooring

[Pavegen's own mechanism page](https://www.pavegen.com/what-can-pavegen-power) describes an electromagnetic generator. It must not be represented as a piezoelectric product. Its stated joules per step are not installed as a default. A selected piezoelectric or other kinetic system needs its own documented delivered-energy test. This distinction avoids conflating mechanisms and exaggerating output from footfall.

### Traffic-wake turbines

[Tian, Mao and Li (2017)](https://doi.org/10.3390/en10040478) investigate a simplified two-dimensional single-car setup; their result is not a Mauritius highway production specification. The app does not multiply a paper's maximum event output across a city's traffic. Road safety, setbacks, turbulent flow, device survival and any change in vehicle drag require professional evaluation and baseline trials. Energy in a car wake partly originates in propulsion; it must not automatically be labelled new renewable energy.

For a separate theoretical bound, [DOE's wind-energy explanation](https://www.energy.gov/sites/default/files/2014/06/f16/wind_basicpvcwindturbine.pdf) supplies `P = 0.5 ρ A v³`. The helper sums each measured speed bin's kinetic power × hours ÷1000. It never cubes a simple mean speed, substitutes car speed for wake speed, or calls available kinetic energy delivered electrical output. Turbine power curves, conversion losses, cut-in/cut-out, turbulence, installation geometry and duty cycle would be required for a yield model.

## Workflow for the shared project

1. Architect links a component to the model's stable ID and measured unit/quantity. Changing the design refreshes quantity, without creating a second independent geometry.
2. Engineer records intended function, assembly test data and acceptance requirements. Material substitutions stay pending until equivalence is reviewed.
3. Supplier adds the exact material declaration, sourced conversion metadata, manufacturing origin, available capacity and confirmed delivery date.
4. Contractor collects actual site moisture readings, exposure and trial-rate evidence for the engineer to enter, and records construction schedule information. No drying estimate automatically authorises enclosure.
5. Client and project coordinator review evidence coverage, unresolved assumptions, delivery gaps and revision history. An incomplete subtotal must remain labelled incomplete.
6. Before procurement or performance claims, obtain project-specific approvals and supplier confirmations through the project's normal workflow. This engine sends no orders, invoices or emails and does not certify designs.

## Tests and remaining boundaries

The focused suite exercises dew point, exact saturation, invalid RH/temperature, missing surface data, matched drying evidence, material exposure duration, dimensional carbon conversions, zero-vs-unknown, negative biogenic factors, mixed scopes, duplicate IDs, source-origin distinctions, invalid delivery dates, energy units, auxiliary loads, car-emissions penalties, negative returns, service-life limits, ties and speed-bin integration.

Not implemented: a transient multi-layer hygrothermal solver; automatic material mould coefficients; vendor stock APIs; an accredited LCA/EPD verifier; automatic planning/environmental approval; verified motorway turbine yield; automatic functional substitution of hemp/mycelium for structural concrete; paid commercial datasets; automatic carbon credits. These are explicit extensions for qualified evidence and future integrations, not hidden promises in the pitch.
