# Materials intelligence: Mauritius quantity takeoffs

Research checked **30 September 2026**. This is the source and algorithm record for the optional **Materials** workspace. It is a quantity-estimating feature, not structural design, a bill approved for construction, live inventory, a quotation, or an automatic order.

## Permanent implementation and extension points

- `src/data/constructionMaterials.ts`: supplier references, dates, published product dimensions, source IDs and explicit limitations. No scraped prices, availability claims, popularity rankings or invented partnerships.
- `src/designer/materials/types.ts`: version 1 settings, editor-independent geometry input and typed report rows.
- `src/designer/materials/settings.ts`: fresh defaults, saved-JSON normalization, sourced block/sheet preset application. Customer ratios and dimensions are data, not hard-coded UI calculations.
- `src/designer/materials/estimate.ts`: deterministic quantity functions; no network, UI, order or property mutation. `estimateMaterials(geometry, settings)` returns assumptions, warnings, measured/allowed quantities and formula descriptions.
- `src/designer/materials/__tests__/estimate.test.ts`: executable examples, dimensional checks, invalid-input handling and regression protection.

The property adapter must provide each physical wall once on each storey, with unique opening areas. Materials settings belong in the saved property. Any 2D or 3D editor can reuse the same engine. Future product imports should add a cited preset, preserve dimensional basis and units, and add a worked test. Changed formula meaning requires a settings-version migration rather than silently changing old projects.

## Local products and evidence

These are documented Mauritius suppliers and material options, **not a ranking of the most popular or most successful companies**. No reliable current comparative market-share evidence was established.

| Supplier | Evidence used | Application in the app |
| --- | --- | --- |
| UBP | [Classic 6-inch block](https://www.ubp.mu/fr/produits/materiaux-de-construction/classic-blocks/blocs/bloc-6.html), published 450 × 200 × 150 mm; [2016 technical sheet](https://ubp.mu/sites/default/files/fiche_technique_ubp_vf_22_09_16_1.pdf), 100/150/200 mm variants | Concrete block presets. Face and thickness remain editable. The older technical sheet needs current supplier confirmation. |
| Gamma Materials | [8-inch block](https://gammamaterials.mu/en/blocks/9-block-8.html), 200 × 450 × 200 mm; [supplier range](https://gammamaterials.mu/) includes rocksand, macadam, ready-mix, blocks and precast products | 200 mm block preset and source reference for aggregates/ready-mix. Amounts are measured in m³; converting to supplier tonnes requires the actual material's loose density/moisture. |
| Kolos Cement | [Bat Sima guide](https://www.koloscement.com/media/lpolxoii/bat-sima_-guide-de-la-construction.pdf), printed pp. 10, 18–21, 31–35, and [current product range](https://www.koloscement.com/our-products) | 25 kg bag starting unit; locally relevant rocksand/macadam terminology. The guide illustrates 1:3 block mortar and 1:2:3 concrete among several ratios, and calls for trial mixes and competent approval. Kolos Finish is non-structural masonry/plaster cement; structural cement must be selected separately. |
| Joonas Steel | [Steel catalogue and services](https://www.joonasco.com/steel-mauritius/) lists mild steel 6–25 mm, high tensile 8–32 mm, and cut-and-bend supply | Reinforcement supplier reference. It does not justify selecting steel grade, bar diameter, spacing, cover or anchorage for a building. |
| Grewals | [2023 catalogue](https://www.grewals.mu/wp-content/uploads/2023/10/Catalogue-Grewals.pdf), printed p. 10, and [2022 profile diagrams](https://www.grewals.mu/wp-content/uploads/2022/03/Catalogue-Grewals.pdf) | Ribbed effective cover 1,000 mm; corrugated 970 mm; Panel Rib 1,200 mm. The catalogue's average five fixings/m² is an editable purchasing allowance, not a wind fastening design. Profiles and current specification need supplier confirmation. |
| Profilage Océan Indien | [Cee purlins](https://www.profilage.mu/products/purlins/cee-metal-purlins/) publishes sections, kg/m, cut-to-length availability and span-table download | Supplier reference for customer-specified purlin lengths. The calculator does not choose section or support spacing. |

The UBP and Gamma pages were available through indexed primary-source results; direct requests encountered verification/403 pages. Their sizes are documented supplier data, not a newly measured batch. The UBP sheet is dated 2016; do not present it as a 2026 certification. Grewals' current website describes newer coatings than the older catalogue, so the estimator uses coverage geometry and does not claim a particular current coating or cyclone rating.

Concrete hollow blocks, cement plaster, poured/reinforced concrete and profiled metal roof sheets are supported by these local catalogues. [UBP BAB](https://www.ubp.mu/fr/produits/materiaux-de-construction/smart-blocks/bab-bloc-bancher.html) also describes permanent-formwork blocks filled with reinforced concrete. That system needs its actual cavity fill/yield and steel design before becoming an estimating preset. [Grewals](https://www.grewals.mu/wp-content/uploads/2023/10/Catalogue-Grewals.pdf) also supplies gypsum partition systems. Those should get separate assemblies rather than being mislabelled as concrete masonry. A **Custom blocks / bricks** configuration permits a verified other supplier size without asserting that imported red clay brick is the default Mauritian construction system.

## Dimensional basis and block quantities

Use metres internally. Convert customer millimetres only at the boundary. For actual block face `L × H` and joint thickness `j`, the module is `(L+j) × (H+j)`. For a nominal joint-inclusive module, use the entered `L × H` directly and derive the actual face as `(L-j) × (H-j)` for joint-volume estimation. The supplier pages do not unambiguously resolve module versus actual batch size: the app explicitly labels the starting assumption and lets the customer change it.

For each physical wall, `net area = max(0, length × height − unique opening area)`. The caller must union overlapping openings and deduplicate shared walls. The engine additionally suppresses a repeated wall ID on the same storey and caps impossible opening deductions. Different storeys remain separate.

`Net blocks = Σ net wall area / module face area`

`Purchase blocks = ceil(net blocks × (1 + block waste / 100))`

Rounding happens after the project quantity has been summed. This is an area estimate, not a brick-by-brick bond or cut layout. Corners, half blocks, lintels and specialist units can change the procurement schedule.

### Joint mortar and plaster

`Wet joint mortar = net blocks × (module face area − actual face area) × selected wall thickness × bedding fraction`

This counts the bed/head joint grid once; it **does not fill the hollow block cores with mortar**. The initial bedding fraction of 1 represents a full-bed joint envelope. A face-shell bedding specification should supply the reduced fraction. Core grout, bond beams, reinforcement, returns and lintels are separate assemblies.

`Wet plaster = net wall area × selected number of faces × plaster thickness`

Thickness and 0/1/2 faces are explicit; no plaster is silently added. Reveals, soffits, parapets and multi-coat build-ups need additional measurement. Plaster and mortar use separate mix inputs and retain separate bag rounding, because their cement products may differ.

## Concrete bases, walls and pillars

- Ground base: exact ground footprint area (or a verified manual override) × entered depth.
- Poured wall: net physical wall area × entered thickness. Selecting this replaces blockwork/mortar; it does not add both systems.
- Pillars: explicit count × width × depth × **clear, additional height**. No automatic structural column placement or sizing.
- Concrete roof: exact horizontal roof area × entered slab depth. The rectangle envelope is never substituted for that area.

Ground slabs and roof slabs are separate physical elements. The ground footprint is not the sum of every floor area. Pillars have no drawn location in this input: their wall/slab overlap cannot be inferred. Users must provide additional net pillar volume/clear heights and adjust wall openings or areas if the columns replace masonry. This limitation is visible in the report.

Base thickness does not specify a foundation. The report excludes excavation, bearing assessment, compacted sub-base, blinding, damp-proof layers, footings and foundation reinforcement. These need separate measured assemblies and engineering inputs.

### Ready-mix versus editable site mix

Ready-mix is the starting concrete supply method and reports wet m³ with the entered allowance. Site-mix ingredient quantities are an alternative and are never also added to a ready-mix order.

For cement:sand:aggregate dry loose volume parts `c:s:a`, wet volume `V`, allowance `w`, dry-volume factor `f`, loose cement bulk density `ρ` and bag mass `b`:

```
Vorder = V × (1 + w / 100)
Vdry = Vorder × f
cement kg = Vdry × c / (c+s+a) × ρ
sand m³ = Vdry × s / (c+s+a)
aggregate m³ = Vdry × a / (c+s+a)
cement bags = ceil(cement kg / b)
```

Mortar sets coarse aggregate to zero. Waste is applied once before ingredient splitting. Totals sum those existing quantities; they do not apply another allowance.

**The starting dry factors 1.33 (mortar) and 1.54 (concrete), and loose cement density 1,440 kg/m³, are uncalibrated estimating assumptions. They are not measured UBP/Gamma/Kolos yields or supplier-certified specifications.** All are editable and visible. The mass generated by this model is not asserted to reproduce a supplier's kg/m³ dosage table. For procurement, replace assumptions with the actual trial-batch yield/density and approved recipe. The calculator does not infer water additions from a volume ratio, certify a strength class, or treat cement's particle density as its loose bulk density.

Worked arithmetic check: at `1:2:4`, `V=1 m³`, `f=1.54`, `ρ=1,440 kg/m³`, `b=25 kg`, zero waste, the result is 316.8 kg cement (13 bags), 0.44 m³ sand and 0.88 m³ coarse aggregate. This is a test vector, **not a recommended structural mix**.

## Roof reinforcement and metal sheets

Only one roof material mode is active: none, concrete, or sheet. No double purchase of a concrete roof slab and metal cover is inferred. Composite roofs need explicit separate assemblies.

### Customer-specified orthogonal roof mesh

Rebar is off until explicitly enabled. It consumes entered diameter, spacing, layers, cover, stock length and lap length. Bar centre-line spread removes surface cover and half a diameter at each edge. Number of bars in each direction is `ceil(centre-line spread / spacing) + 1`, ensuring actual spacing does not exceed the supplied value. Straight cut lengths remove end cover; required stock-length splices add only the entered lap.

Steel mass is `bar length × π/4 × diameter² × 7,850 kg/m³`. The steel density is a conventional nominal-mass assumption to be checked against the supplied bar's kg/m. Each run receives the whole stock bars it requires, including its entered splice overlaps; **offcuts are not reused across runs**. The spare percentage is applied to that stock count and rounded up. Purchased mass includes the full allocated stock lengths, while fitted mesh length is shown separately. This conservative allowance prevents an impossible pooled-length purchase (three 4 m runs cannot be cut from two 6 m bars); it is not an optimized cutting/bending schedule. A zero lap with a run longer than stock triggers a warning. Bars around openings, chairs, ties, beams, anchorage, shear and punching reinforcement are not inferred.

For an irregular roof, concrete uses exact area; a mesh rectangle is explicitly a bounding allowance unless verified rectangle dimensions are supplied. Split a complex roof into professionally measured panels for a real bar schedule. No ratio or mesh quantity certifies a load-bearing roof.

### Mono-pitch/gable sheet coverage

The rectangle length runs along the eave/ridge; width runs across the slope(s). Horizontal overhang is added before pitch conversion. Each slope length is `extended width / slope count / cos(pitch)`. Columns are `ceil(eave length / effective cover)`; rows are `max(1, ceil((slope length − end lap) / (stock sheet length − end lap)))`.

Effective cover already includes the side overlap: never subtract that overlap twice. End laps apply only between successive rows. Whole sheets are rounded first, then the spare-sheet percentage is applied. Reported stock area uses effective-cover equivalent; supplier billing can use the wider physical sheet area.

Fixings use the entered rate per slope m². Ridge, flashing and gutter lengths are entered, with separate stock lengths and laps. Purlin rows appear only after a user enters spacing; their section, span, bracing, uplift and connections remain a design task. Hips, valleys, complex cutouts, underlay, insulation, sealants, downpipes, rafters/trusses and special flashing profiles need their own project schedule. Nothing here supplies a Mauritius cyclone-resistance rating.

## Input validation and regression checks

Persisted settings are normalized to finite bounded values; a report warns when provided inputs were adjusted. Impossible end laps or reinforcement geometry suppress the affected result. Invalid geometry is omitted with a warning rather than emitting NaN/Infinity or negative stock. Primitive mix/rebar functions reject invalid input and numeric overflow.

The focused tests verify actual/nominal dimensions, 100-block mortar volume, openings, bedding, waste, multi-storey identity, separate base/roof volumes, ready-mix alternatives, ingredient sums, irregular roof area, steel layers/laps, sheet slopes/overlaps, purlin/trim inputs, malformed saves and immutable settings. UI/geometry adapter tests should verify selection scope and physical-wall/opening union, since the pure engine intentionally does not know the room editor's topology.

## Before supplier procurement integration

Obtain current technical sheets, batch/module dimensions, accepted bed/head joint method, cement type and bag sizes, actual loose aggregate densities, measured batch yields, minimum ready-mix loads and quote validity. Receive an engineer's project foundation/slab/column/rebar schedule and a roof supplier's cyclone fixing/support design. Add those as signed-off inputs with provenance rather than silently changing the illustrative defaults. Keep quantity calculation separate from approval, ordering, scheduling and payment APIs.
