# Estimation, foundations and service coordination — 8 October 2026

Status: workflow written before implementation. Branch `gpt/designer-2026-10-08`, based on the October 7 sales-pack branch. Main and production are outside this delivery.

## Dependency order and decisions

1. **Audit and reconcile measurements.** Metres are the shared plan/property unit; centimetres remain the existing product catalogue boundary, millimetres the engineering input boundary. Convert once at those boundaries. 2D and 3D must read the same instance and physical envelope. Camera zoom must never affect quantities.
2. **Paint before cost aggregation.** Use the existing coats input, exposed near paint application. Raw litres = net painted face area × coats ÷ coverage, then allowance, then whole-pack purchasing. Two coats double unrounded paint volume, not necessarily rounded tins or price. Deduct clipped, non-overlapping openings consistently, including sill heights. Keep interior/exterior faces distinct. Reconcile the separate legacy API path without silently changing the legacy contract.
3. **Masonry and concrete.** Preserve shared-wall deduplication, footprint union and actual-versus-nominal block size. Add explicit selectable estimating ratios with editable overrides, sources and assumptions. Separate wet volume, dry loose ingredients and purchased packs. Ready-mix volume and site-mix ingredients are alternatives, never additive costs. Summaries are not additional purchase lines.
4. **Foundation mode.** Add persisted measured concrete elements (slab/raft quantity shape, strip, pad) with position, length, width, thickness and top elevation. Use one geometry for drawing and takeoff, rejecting or explicitly accounting for overlaps instead of silently double-counting. Enter reinforcement from a checked schedule; calculate stock quantities with declared cover, spacing, layers, laps and waste. Existing ground-base estimates must not also count the same new foundation. Foundation type/size/strength/steel choice is not inferred as safe from a floor plan.
5. **Services share the building datum.** Ground and floor elevations define below-ground routes. Mains positions, fixtures and optional connection references remain on the same property. Show connection markers, endpoint snapping, compatible systems and unresolved connections. Quantities include elevation changes. Moving a connected fixture must update its attached route; deletion must not leave a falsely connected route. Water, drainage and electrical conduit remain separate systems. A coordination line is not hydraulic, circuit-sizing or authority approval.
6. **Source real Mauritian products.** Onboard at least five verified products across plumbing/electrical, including a tank, from established suppliers. Store source/date, dimensions and public MUR price basis. Do not invent live stock, rank suppliers as largest without evidence, infer body size from nominal pipe bore, or treat a generic procedural model as exact manufacturer CAD. A placed product must have paired 2D/3D dimensions from one canonical definition; incomplete entries remain reference-only until verified.
7. **Verification before publication.** Test unit conversion, coats and opening unions, selected ratios, no double counting, foundation overlaps/volume/rebar, malformed imports, service connection updates, and paired model bounds. Check phone and desktop drawing/settings/dismissal, saved JSON round-trip and undo. Publish the dated branch and PR; verify preview links and update the one-folder handoff.

## User workflow

Set scale and floor elevations → draw/review rooms → choose Foundation and enter the specified concrete geometry → review quantity/mix/rebar assumptions → locate water/electric mains and drainage connection → place products/fixtures and connect compatible routes → finish walls and choose paint coats → review sourced prices and unpriced items → export the measurable brief for supplier/engineer review.

Changes propagate from the shared model into both views and estimates. No order, customer project, supplier catalogue or production publication is triggered by this workflow.

## Audit findings before coding

- Main paint estimates already persist coats, multiply by coats and purchase whole tins. The separate legacy `/api/calc/paint` uses a different palette/unit/pricing path and needs explicit validation/compatibility handling.
- Paint opening deductions currently ignore a window sill and sum overlapping openings; the masonry adapter already clips and unions openings. This can make estimates disagree.
- Materials already supports editable mortar/plaster/concrete ratios, roof rebar and a single ground slab. There is no foundation drawing mode or materials pricing layer.
- Current materials rows include wet mortar and its ingredients; pricing every row would double-count. New costs need explicit procurement selection and missing-price disclosure.
- Services currently have measured runs, generic fixtures and elevation-aware lengths, but no endpoint relationship. Visually touching a fixture does not imply a maintained connection.
- The catalogue already generates dimensional 2D/3D representations. New supplier entries must extend that contract, not introduce independent measurements.

## Research and engineering boundary

Primary supplier and authority evidence is recorded with each implementation/research note. CEB's current customer FAQ describes a site officer/qualified-electrician process and mandatory RCD; the app should show an electrical-board coordination point and review requirements, not auto-approve wiring. Mauritius National Infrastructure's Civil Engineering Section describes soil investigation for safe foundation design. Individual public-project drawings are project specifications, not universal national foundation presets. Do not label an editable nominal concrete ratio as a certified strength class.

Sources checked 8 October 2026:
- https://ceb.mu/customer-corner/frequently-asked-questions
- https://ceb.mu/company-profile/laws-and-regulations
- https://nationalinfrastructure.govmu.org/Pages/National%20Infrastructure%20Division/Sections/Civil-Engineering-Section.aspx
- https://cwa.govmu.org/cwa/?page_id=743

## Work ownership

- Estimation: paint/client/API consistency, masonry mix presets and non-duplicating quantity/cost reporting.
- Foundations: measured foundation model, takeoff and dedicated paired-view workspace, supplier/rebar/authority research.
- Supplier catalogue: verified products and canonical dimensional model contract.
- Integration: services connections, shared persistence/backend exposure, cross-module checks, preview, pitch notes and handoff.

## Continuation log

- Initial audit and workflow recorded before implementation. Existing working tree clean; previous sales-pack PR #43 remains open. This branch retains that work.
- Implementation completed on `gpt/designer-2026-10-08`: canonical property paint API/coats, procurement-only materials costing, editable volume ratios, persisted measured foundations and overlap-aware concrete, entered rebar schedules, same-floor fixture connections, and five sourced paired-view products. Server MCP exposes the same estimators; saved/imported foundations validate strictly.
- Foundation mode replaces the legacy ground-base allowance. Ready-mix and site-mix ingredients are alternative procurement paths. Quotation rates bind to units, specification and tax basis; missing or invalidated rates remain unpriced. Overlapping steel is withheld for review rather than summed into a misleading complete quotation.
- Full verification: 322 test files / 3,575 tests passed. Client/middleware build passed. API typecheck passed. Full-repository lint reports five errors and thirteen warnings in pre-existing unchanged files; changed-file lint is checked separately. Native server import graph guard was strengthened to catch extensionless and multiline imports before deployment.
- Desktop and 390 px release-bundle checks: foundation drawing, numerical edits (10 × 8 × 0.3 m = 24 m³), 3D inspection, panel collapse/back, service-workspace switching, mains-to-sink endpoint selection, and tank placement from service catalogue into the shared plan/3D model. No live orders, merchant writes or paid AI calls were made.
- Pitches and employee content updated; practice exercises expanded from six to eight. Public pitch embeds use price-free presentation mode. Static sales references must be regenerated from the shared exporter after preview verification.
- Limits to carry forward: geometry/takeoff is not structural, hydraulic or electrical design approval; foundation dimensions and rebar come from checked project schedules. Generic service ports are schematic. Cross-floor routes need separately measured risers. Published-envelope product models are illustrative, with dated catalogue observations rather than live stock. No ranking as the largest supplier is asserted. DXF/SVG import does not infer service engineering or native DWG/RVT/SKP/IFC content.
- Next checkpoint: publish this feature branch and PR, verify the actual deployment and read-only API calls, update BUILD-LINKS/CURRENT-WORK-LINKS, and complete the single Obsidian handoff with genuine desktop/phone captures. Never merge or deploy main from this task.
