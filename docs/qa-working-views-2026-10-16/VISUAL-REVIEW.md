# Working-view visual review — 16 October 2026

Verified the local production-mode preview at http://127.0.0.1:5173 using bundle `App-t4bdqfGj.js`. This is local evidence, not confirmation of a deployed release.

## Checks completed

- 26 viewport PNGs: 13 at 1280×900 desktop and 13 at 390×844 phone. All inspected through the two contact sheets, with full-resolution inspection of the plan and Services layer menus, main house walls/services, route-only house, and Services 2D/3D.
- All eight working-view presets exercised in the main plan and house. Pipes only, plumbing/electrical/walls, separate equipment hiding, hide-all and reset exercised in Services.
- Zero console/page errors, attempted API writes, horizontal document overflow or clipped primary chrome/menu bounds in the captured states.
- The complete canonical project stayed unchanged across presets in the main plan/house. Services remained unchanged across the dedicated-editor combinations.
- Main house filter→reset and Services 3D filter→reset screenshots had **0 pixel difference** at both widths. Main plan/Services plan viewport stayed unchanged.
- Services route-only removed fixture ports and room context. Combined walls/services preserved wall outlines with floor fill explicitly `none`. Hiding equipment removed its bodies and selectable ports. Escape closed Layers while keeping Services open.

## Visual result and limits

No blocking overlap, clipped primary action, broken image or unexpected camera movement was observed. The Layers panel is temporary and dismissible. Its full discipline checklist scrolls on a phone; presets and reset controls remain near the top. Long native select choices still abbreviate, with the complete selected material name now wrapped directly underneath. The phone floor-return select also abbreviates its current floor name.

The main house renders actual wall volumes while the dedicated Services 3D workspace uses floor context and wall outlines for coordination. A 20 mm pipe looks thin at whole-house zoom; dimensions have not been inflated for appearance. The grid remains visible in an otherwise hidden services model as a navigation aid.

These captures use a disposable seeded coordination project with water/electrical routes and two fixtures. They are not a real client design, an engineered network, a supplier order or a hydraulic/fire/structural certification.

Runner: `tools/working-views-shot-2026-10-16.mjs`. Measured results: `report.json`. No external write was permitted by the runner.
