# Room Designer build notes — 23 September 2026

Work stays on `cursor/feat-3d-flooring-hud-bc95`, draft PR #36. Production is unchanged. Current preview URLs are in [BUILD-LINKS.md](BUILD-LINKS.md).

## Using the new controls

- **Draw room** now works directly in 3D: drag corner to corner, inspect snapped dimensions/area, and release. A red draft explains overlap or plot constraints. Touching a second finger cancels the room draft and pans/zooms; Escape cancels. The release commits one undo action. The free wall pen and arbitrary room outlines remain in 2D Plan.
- Architectural presentation adds slate surroundings, warm directional light, cool fill, clearer wall caps and deeper contact shadows. Choosing Paint restores the calibrated studio lighting for judging wall colours.
- **Furnish** opens the existing catalog. Existing Courts furniture gets shaped dimensional previews (cushions, bed/pillows, tables/chairs/storage) when manufacturer models are unavailable; product sizes/prices remain from the catalog. The selected-product note distinguishes approximations from exact appearance. TintEX remains its paint demonstration.
- The compact header preserves Save, undo/redo, Cart and **Project tools** (save/load/quote and existing settings). The inspector estimate is derived from the existing cart, not invented property valuation or smart-home telemetry.

- The designer now opens in the dark **3D House** workspace; **2D Plan** remains one click away. On desktop the right inspector holds building settings, and on phone **Details** opens a bounded sheet. Pick a floor and use **+ Floor** (the + button on a phone) to copy its room layout, openings, finishes and free walls. Furniture is not duplicated. There is no fixed floor-count cap; rendering capacity depends on the device.
- **House / Floor** switches the scene scope. **Build** opens the right contextual inspector with Floor, Stairs and Roof categories. On a phone, use **Details** or **Build** to reveal the sheet. Roof designs include flat, gable or single slope, with felt, tile or metal. Roof visibility is a view setting; the configuration is saved with the plan.
- Choose **Stairs** and tap clear space on either of two adjacent floors, or use **Build settings → Stairs → Fit stairs in room** for an automatic valid position. The same footprint must fit both rooms. The upper slab gains an opening. Stair settings retain width, run, X/Y, rotation and deletion; stairs also appear on both plan floors.
- Choose **Window** or **Door** and tap a wall on the active floor. The existing opening validation rejects overlaps and insufficient wall space.
- Open **Garden** directly from the building toolbar. Add lawn, soil, gravel, paths, raised rectangular terrain, timber/metal fences or hedges. Use dimensions/position fields or Place in 3D. The garden belongs to ground level and uses the existing plot/building limits.
- Orbit with a drag; pan with two fingers or Shift-drag on empty space; pinch/scroll to zoom. Camera easing respects reduced-motion preferences. Item drags preview the plan's snap/collision rules, including wall orientation, before a single committed drop.
- Wall paint uses distinct matte, satin and gloss surface responses in WebGL and visible finish bands in plan. Paint and cladding quantities follow each floor's height.
- Phone wall drawing supports one-finger strokes; two fingers pan/pinch without committing an accidental wall. The wall pen, area tools and cart use compact controls.
- **Move view** explicitly pans without picking up furniture. The camera menu offers Dollhouse, Above and Front presets; zoom, Fit, wall visibility and Daylight remain immediately available. The existing camera gestures and product movement remain intact.
- **Paint / Floor / Solar** shortcuts open the existing finish and energy tools. Roof selection exposes the roof slab and panels in Floor view so the covering cannot obscure them during editing. House view restores the configured roof covering; pitched-roof accessory mounting remains future work.
- The catalog supports search by name, SKU and supplier, plus name/footprint sorting, visible card names/prices, category keyboard navigation and collapse. Every existing category, including Eco/solar, remains available. Product placement and floor-material actions still use the existing validation path.
- The durable build/continuation record is `docs/DESIGNER-WORKFLOW-LOG.md`, mirrored to Victor's saveable `outputs/Room-Designer-Workflow.md`.

## Existing backend connections

The merchant catalog reads all pages of the existing `/api/products` endpoint and exposes offline/partial loading with Retry. Bundled products remain usable when the endpoint is unavailable.

My designs uses the existing `/api/designs` GET/POST/PUT endpoints. Cloud loads open a separate local page and preserve outgoing edits. Save a new copy and Update cloud copy are explicit actions. Floors, stairs, roof and garden travel in the existing property snapshot. Local autosave does not send network writes. The existing email-based identity model is unchanged.

## Validation and limits

Client/API typechecks, changed-file lint and the production build pass. The workspace refinement passed a full local 228-file / 2,673-test suite, followed by 36 focused integration tests including three added solar roof scenarios. GitHub's root/API typechecks and Vitest passed application commit `b70c9fd`. Backend requests are covered with mocks; the deployed public catalog also responded with 14 products. No live customer records were written during testing. The separate Lighthouse workflow still audits the unchanged production domain and reports existing performance/PWA/SEO failures.

Local phone visual checks confirmed two stacked storeys and a flat felt roof. Further localhost browser actions were blocked by automatic approval review. The deployed feature previews were accessible: standard and TintEX routes returned HTTP 200, desktop and phone layouts rendered, garden placement succeeded, and the final phone stair-fit action created a Ground-to-First connection with editable dimensions. Deployment-specific verification is recorded in BUILD-LINKS.md.

The refined workspace was checked on its Vercel preview at 1280px desktop and 390/360px phone widths. The phone walkthrough searched and placed a solar panel on the visible roof slab, verified the existing energy estimate, added a floor, fitted stairs through the inspector and opened the garden tools. The saved workflow log contains the exact commits and continuation checkpoints.

Terrain is rectangular with flat raised elevations, not a freeform sculpting mesh. Roofs follow individual room footprints; complex joined roofs and pitched-roof accessory mounting need further work. The advanced building parts use WebGL; the existing canvas fallback is a basic room view. Stair layout dimensions are conceptual, not structural design. Existing demonstration catalog entries remain labelled as samples; no new supplier prices or APIs were invented.

## Preserved work

The active clean checkout is `C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer`. Victor's other branch and dirty files remain untouched at `C:\Users\Victor\Documents\PPW-Code\ppw-designer-2d`.
