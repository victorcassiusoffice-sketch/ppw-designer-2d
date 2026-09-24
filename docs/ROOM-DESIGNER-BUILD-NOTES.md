# Room Designer build notes — 24 September 2026

Work stays on `cursor/feat-3d-flooring-hud-bc95`, draft PR #36. Production is unchanged. Current preview URLs are in [BUILD-LINKS.md](BUILD-LINKS.md).

Latest implementation: `8252a7b` adds connected 3D walls, dismissible contextual controls and outdoor paving; `89f7878` softens the lawn texture and removes Vercel's feedback launcher from the design surface. The **current working, browser-verified preview** is `https://ppw-designer-2d-guazc2nhr-victor-ppw.vercel.app` (`8252a7b`). Vercel reports the final `89f7878` deployment successful at `https://ppw-designer-2d-kl8wen9qw-victor-ppw.vercel.app`, but that hostname times out in both the browser and curl while `guazc2nhr` responds HTTP 200. Final-polish browser verification is pending; a documentation-only push will request a fresh deployment of the same application. Do not promote the unreachable hostname as the current preview.

## Using the new controls

- **Walls** works directly in 3D: drag the first segment or tap start/end, then continue from its endpoint. The live full-height outline shows length and angle; grid, endpoint and 45-degree snapping help connect corners. Shift allows a free angle. Close back to the starting corner to make a validated room; invalid intersections or plot/room overlap cannot become a room. Each segment has Undo, and closing the run replaces only its own free walls. **Finish run** ends a chain; **Done** leaves the wall tool. Status and controls reserve space above the scene.
- **Draw room** retains rectangular 3D construction: drag corner to corner, inspect snapped dimensions/area, and release. A red draft explains overlap or plot constraints. Touching a second finger cancels a draft before panning/zooming; Escape cancels. The release commits one undo action. Both wall and rectangular room construction share real property data with 2D Plan.
- **Plan Walls** now uses a compact dock above the drawing viewport. Snap, exact length, Make room, Keep walls, Undo and Discard remain available. On a phone, expand **Snap / length** when needed; the dock grows outside the measured canvas instead of covering the house.
- Selected furniture controls live in the desktop inspector. On a phone, selection shows a compact named strip above the scene; **Edit item** opens the optional details sheet and the clear-selection button removes the strip. **Close** dismisses the sheet without deleting or deselecting the item. Rotation, Duplicate, Details in plan and Remove remain available. Escape clears selection while keeping 3D open.
- Finish and energy tools now have visible **Close** headers. Project tools works on desktop while in 3D; New property's confirmation appears above the workspace and can be cancelled. The foreground dialog receives Escape before the workspace behind it. On a phone, Solar's first Escape closes its details sheet and the next leaves the Solar tool. These controls do not require restarting the designer.
- Architectural presentation adds slate surroundings, warm directional light, cool fill, clearer wall caps and deeper contact shadows. Choosing Paint restores the calibrated studio lighting for judging wall colours.
- **Furnish** opens the existing catalog. Existing Courts furniture gets shaped dimensional previews (cushions, bed/pillows, tables/chairs/storage) when manufacturer models are unavailable; product sizes/prices remain from the catalog. The selected-product note distinguishes approximations from exact appearance. TintEX remains its paint demonstration.
- The compact header preserves Save, undo/redo, Cart and **Project tools** (save/load/quote and existing settings). The inspector estimate is derived from the existing cart, not invented property valuation or smart-home telemetry.

- The designer now opens in the dark **3D House** workspace; **2D Plan** remains one click away. On desktop the right inspector holds building settings, and on phone **Details** opens a bounded sheet. Pick a floor and use **+ Floor** (the + button on a phone) to copy its room layout, openings, finishes and free walls. Furniture is not duplicated. There is no fixed floor-count cap; rendering capacity depends on the device.
- **House / Floor** switches the scene scope. **Build** opens the right contextual inspector with Floor, Stairs and Roof categories. On a phone, use **Details** or **Build** to reveal the sheet. Roof designs include flat, gable or single slope, with felt, tile or metal. Roof visibility is a view setting; the configuration is saved with the plan.
- Choose **Stairs** and tap clear space on either of two adjacent floors, or use **Build settings → Stairs → Fit stairs in room** for an automatic valid position. The same footprint must fit both rooms. The upper slab gains an opening. Stair settings retain width, run, X/Y, rotation and deletion; stairs also appear on both plan floors.
- Choose **Window** or **Door** and tap a wall on the active floor. The existing opening validation rejects overlaps and insufficient wall space.
- Grass now surrounds the ground-floor house automatically, bounded by the actual plot or a 3 m border. It excludes room footprints and placed garden surfaces. This is a visual surround, not an extra purchased or saved lawn object; upper-floor-only views do not show it.
- Open **Garden** directly from the building toolbar. Add lawn, soil, gravel, generic **Concrete**, paths, raised rectangular terrain, timber/metal fences or hedges. Use dimensions/position fields or Place in 3D. The garden belongs to ground level and uses the existing plot/building limits. Paving can use the real Espace Maison products listed below; concrete stays unpriced.
- Orbit with a drag; pan with two fingers or Shift-drag on empty space; pinch/scroll to zoom. Camera easing respects reduced-motion preferences. Item drags preview the plan's snap/collision rules, including wall orientation, before a single committed drop.
- Wall paint uses distinct matte, satin and gloss surface responses in WebGL and visible finish bands in plan. Paint and cladding quantities follow each floor's height.
- Phone wall drawing supports one-finger strokes; two fingers pan/pinch without committing an accidental wall. The wall pen, area tools and cart use compact controls.
- **Move view** explicitly pans without picking up furniture. The camera menu offers Dollhouse, Above and Front presets; zoom, Fit, wall visibility and Daylight remain immediately available. The existing camera gestures and product movement remain intact.
- **Paint / Surfaces / Solar** rail controls open the existing finish and energy tools; on phone Solar has a focused, bounded details sheet. Roof selection exposes the roof slab and panels in Floor view so the covering cannot obscure them during editing. House view restores the configured roof covering; pitched-roof accessory mounting remains future work.
- The catalog supports search by name, SKU and supplier, plus name/footprint sorting, visible card names/prices, category keyboard navigation and collapse. Every existing category, including Eco/solar, remains available. Product placement and floor-material actions still use the existing validation path.
- The durable build/continuation record is `docs/DESIGNER-WORKFLOW-LOG.md`, mirrored to Victor's saveable `outputs/Room-Designer-Workflow.md`.

## Sourced outdoor paving

The Garden picker includes these UBP products from Espace Maison Mauritius. Published per-piece prices were checked on **23 September 2026**, including VAT. Each product carries its source link and dimensions; colour previews are illustrative. The material estimate uses a straight grid and rounds up to whole pieces along both edges: cut pieces still consume a whole slab and offcuts are not reused. It is separate from the existing shopping cart and excludes labour, base preparation and delivery. It does not claim current stock or place an order.

| Product | Dimensions | Checked price per piece | Source |
| --- | --- | --- | --- |
| Slab Ordinary (`VORSLACOL001`) | 330 × 330 × 20 mm | Rs120 | [Espace Maison](https://www.espacemaison.mu/products/slab-ordinary-1) |
| Grey rustic pavement (`RUSCLAORD001`) | 500 × 250 × 45 mm | Rs186 | [Espace Maison](https://www.espacemaison.mu/products/grey-rustic-pavement-50-25-cm-1) |
| Rustic Pavement Ordinary (`RUSPAVORD006`) | 600 × 600 × 45 mm | Rs536 | [Espace Maison](https://www.espacemaison.mu/products/rustic-pavement-ordinary-10) |

Select a product, choose **Add paving patch**, then place and size it with the existing Garden tools. Its optional product ID is saved with the property, and its slab size, thickness and joints appear in 3D. Verified example: a 1.2 × 4 m Grey Rustic patch covers 4.8 m² and needs 3 columns × 16 rows = 48 whole pieces, costing Rs8,928 at the checked price.

## Sims code research

[SIMS-BUILD-RESEARCH.md](SIMS-BUILD-RESEARCH.md) records the actual source links and names found: MTS's `UI.dll`/engine assembly map; public mod references to `Sims3.UI.BuildController`, `BuyController` and `BlueprintController`; and Simitone/FreeSO's alternative Sims 1/TSO implementation and wall/floor/terrain tools. No complete current Sims 3 native house engine or standalone browser port was verified. These sources inform interaction patterns; no game DLLs, code, assets or external executables were imported. The connected-wall implementation is original repository code with metre-based dimensions, validation and undo.

## Existing backend connections

The merchant catalog reads all pages of the existing `/api/products` endpoint and exposes offline/partial loading with Retry. Bundled products remain usable when the endpoint is unavailable.

My designs uses the existing `/api/designs` GET/POST/PUT endpoints. Cloud loads open a separate local page and preserve outgoing edits. Save a new copy and Update cloud copy are explicit actions. Floors, stairs, roof and garden travel in the existing property snapshot. Local autosave does not send network writes. The existing email-based identity model is unchanged.

## Validation and limits

The 24 September full local suite passed **243 files / 2,762 tests**. Subsequent focused dismissal/gesture checks passed 3 files / 22 tests, including one new test; final grass checks passed 9 tests. Client/API typechecks, changed-file lint and production build passed. Final `89f7878` GitHub CI then passed the full **243 files / 2,763 tests**, client/API typechecks, secret scan and Vercel. The separate Lighthouse workflow still audits unchanged production and reports the previously recorded failure; its target was verified in the workflow.

The main preview was checked on standard `/designer`, TintEX and Courts at 1280 px desktop and 390/360 px phone widths. Actual interaction checks included a closed 40 m² connected-wall room, Undo/Redo, phone 3D drawing, the Plan dock outside its canvas, desktop selection in the inspector, phone Edit/Close/clear selection, Project tools/New-property Cancel, Paint/Floor dismissal and phone Solar Escape. A sourced paving patch was placed and its whole-piece estimate verified. No live customer cloud records, quote requests or purchases were submitted. Final `89f7878` browser verification is blocked by its hostname timeout, not a test failure. The verified `guazc2nhr` preview remains current while a replacement deployment is obtained; deployment-specific status belongs in BUILD-LINKS and the workflow log.

Earlier 23 September validation: the workspace refinement passed a full local 228-file / 2,673-test suite, followed by 36 focused integration tests including three added solar roof scenarios. The architectural pass subsequently passed 235 files / 2,711 tests plus 21 focused workspace/phone tests. Backend requests are covered with mocks; the earlier deployed public catalog responded with 14 products.

Local phone visual checks confirmed two stacked storeys and a flat felt roof. Further localhost browser actions were blocked by automatic approval review. The deployed feature previews were accessible: standard and TintEX routes returned HTTP 200, desktop and phone layouts rendered, garden placement succeeded, and the final phone stair-fit action created a Ground-to-First connection with editable dimensions. Deployment-specific verification is recorded in BUILD-LINKS.md.

The refined workspace was checked on its Vercel preview at 1280px desktop and 390/360px phone widths. The phone walkthrough searched and placed a solar panel on the visible roof slab, verified the existing energy estimate, added a floor, fitted stairs through the inspector and opened the garden tools. The saved workflow log contains the exact commits and continuation checkpoints.

Terrain is rectangular with flat raised elevations, not a freeform sculpting mesh. Roofs follow individual room footprints; complex joined roofs and pitched-roof accessory mounting need further work. Existing wall/room-edge editing in 3D and atomic whole-building translation remain future work: **Move view** pans the camera. The advanced building parts use WebGL; the existing canvas fallback is a basic room view. Stair layout dimensions are conceptual, not structural design. Furniture without manufacturer models remains a labelled dimensional approximation. Existing demonstration catalog entries remain labelled as samples; the new outdoor prices are sourced snapshots, and no new supplier or purchase API was invented.

## Preserved work

The active clean checkout is `C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer`. Victor's other branch and dirty files remain untouched at `C:\Users\Victor\Documents\PPW-Code\ppw-designer-2d`.
