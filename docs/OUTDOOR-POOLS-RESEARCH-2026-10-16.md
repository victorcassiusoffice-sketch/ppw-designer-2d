# Outdoor floor layers and swimming pools

Research checked 2026-10-16. This is a planning and quantity workflow, not a structural design, merchant stock feed, live quotation or purchasing integration.

## Primary Mauritius references

- [Nabridas Diamond 10](https://nabridas.mu/all-products/pools-spas/family-pools-7m/diamond-10/) lists a 10.4 × 4.4 m fibreglass pool, gradual depths of 1.10–1.80 m, and 42 m³ declared volume. It describes a bench, filtration package and optional safety equipment. These facts are stored in `src/data/mauritiusPools.ts`. The rectangular custom planning basin is **not** the manufacturer's mould, internal geometry or installation drawing. Its own calculated water volume must never be replaced by 42 m³. Selecting this reference preserves the custom geometry and displays the two bases separately. No price or current stock is asserted.
- [Nabridas product range](https://nabridas.mu/shop/) lists filters, pumps/panels, chlorinators and heating/security categories. Supplier discovery link only; no unsourced pump capacity, power, filtration turnover or model dimensions are assigned. The direct product page loaded, while follow-up accessory pages were rate-limited during research; accessory models were therefore not entered with guessed specifications.
- [Pool Solutions Mauritius](https://poolsolutions.mu/) describes fibreglass pool installation, maintenance, renovation and lining, plus pool accessories and fittings. Supplier discovery reference; not a measured catalogue body or stock integration. The indexed primary page was available; a direct follow-up fetch timed out.
- [Gamma Construction](https://gammaconstruction.mu/) describes road works and asphalt production. Used as a local supplier/service reference for asphalt; no unverified price or density is applied. [Gamma Materials](https://gammamaterials.mu/) lists ready-mix concrete, aggregates and paving. Mix, compacted density and layer design require the supplier/project specification.
- Existing [Espace Maison UBP Slab Ordinary](https://www.espacemaison.mu/products/slab-ordinary-1) and the other dated Espace Maison paving entries remain in `src/data/outdoorPaving.ts`. Existing prices retain their original check date; this work does not relabel those historic prices as current. Sourced slab thickness supplies material volume unless the user explicitly overrides it.

## Geometry and calculations

One canonical `GardenSurface` persists in the property model and drives Plan, 3D, JSON/load, undo and shared project quantities. New `tarmac` and `pool` kinds reuse the existing draw-two-corners workflow. Outdoor polygon and quadratic-curve authoring use the shared measured-path controller; the sampled simple polygon is saved in world metres. Pools currently remain rectangular with a flat bottom.

For outdoor floors:

- Plan area is the polygon's shoelace area, not a curved shape's bounding rectangle. Perimeter sums the saved edge lengths.
- Material volume = area × entered uniform material thickness. Sub-base volume = area × entered sub-base depth. Missing depth stays unknown. No density means no tonnage; no automatic compaction, wastage or mix-yield factors.
- Rectangular sourced paving retains its existing straight-row whole-piece estimate. A curved/concave outline withholds that piece estimate because the rectangular cut-layout model is not valid there. Area and layer volume remain available.
- Overlapping explicit surfaces are separate packages, clearly disclosed in the garden totals. Automatic surrounding grass is presentation geometry and never creates billable material.
- The shared project register emits **one** surface material package (m³ when thickness is known, otherwise m²), plus a separate sub-base package. It does not charge the same surface once by area and again by volume. A unit change triggers the register's existing evidence/quote invalidation rules.

For pools, W and L are entered **inner** dimensions, H is basin floor-to-rim depth, h is water depth, t is wall thickness, b is base thickness and c is excavation clearance:

- Water = W × L × h m³; litres = m³ × 1,000. Freeboard = H − h. Water depth cannot exceed basin depth.
- Rectangular excavation = (W + 2t + 2c) × (L + 2t + 2c) × (H + b). This is an in-situ geometric volume, with vertical sides; no spoil bulking, groundwater, battered/shored sides, access ramp or over-dig is assumed.
- Planning shell volume = (W + 2t) × (L + 2t) × b + ((W + 2t) × (L + 2t) − W × L) × H. This counts each corner once. It is a material volume, not an engineered concrete/rebar prescription or a fibreglass shell manufacturing estimate.
- Interior lining = W × L + 2(W + L) × H m². It reaches the rim; seams, cutting waste, steps, slopes, benches and overflow channels are excluded. Coping perimeter = 2(W + L); a coping purchase quantity needs the chosen section/product.
- Excavation / empty basin / filled views change presentation only. All quantities and shared-spec fingerprints remain identical. Water remains a designed capacity while the water surface is hidden.

## Rendering and usability

Garden & outdoors exposes Tarmac and Swimming pool alongside existing surfaces. The selected pool exposes basin/water depth, shell wall/base dimensions, excavation clearance, supplier reference and a construction-view selector. Plan labels state area and depth. 3D has an actual below-grade basin floor, four side walls, lining, water at its saved level and an excavation cavity/depth line. Pool holes are cut out of automatic grass and earlier explicit surface patches. The presentation ground plane already draws before geometry with `depthWrite:false`; the pool's opaque floor/walls can render over it.

Material thickness is distinguished from the planar Length control, avoiding the previous ambiguity between horizontal “depth” and excavated depth. Invalid edits restore the previous value. Selecting a different supplier reference does not silently resize a user's basin.

## Validation and limits

Focused tests cover polygon area/affine move-resize, layer quantities, exact shell corner accounting, litres, invalid dimensions, stage-invariant quantities, save/load, actual panel interaction, supplier-reference separation, shared package deduplication and removal history, physical mesh elevations and terrain cutout area. Headless screenshot evidence and its run report are in `docs/outdoor-qa-2026-10-16/` when generated.

Pool structural thickness/rebar, ground support, retaining loads, groundwater uplift, waterproofing details, filtration hydraulics, circulation/entrapment protection, barriers, drainage and electrical protection require qualified project design. The editable defaults are examples, not approved construction details. Source listings do not imply the suppliers endorse One Live Build.
