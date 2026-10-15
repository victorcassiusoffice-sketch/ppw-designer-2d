# Building services spatial editor — 15 October 2026

Local feature work on `gpt/designer-2026-10-15`. This document is not a production publication record. No database migration, supplier order, invoice, email or merchant write was performed by this work.

## Canonical model and calculations

- `src/designer/buildingServices.ts` extends the existing version 1 contract. Each route node may have a floor-relative `elevationM`; measured length is the sum of its actual 3D segments. Repeated XY coordinates are valid vertical risers. Legacy nodes without heights retain the former constant-gradient interpretation, interpolated by accumulated plan distance (by index for vertical-only legacy runs).
- Explicit shared junctions are stored in `services.junctions`; nodes reference their stable IDs. A crossing does not create a connection. Moving a junction moves its member nodes; merging junctions preserves the other connected branches. Fixture endpoints remain explicit same-system, same-floor links. Missing or incompatible references stay visible as unresolved warnings.
- Fixture base elevation and a dated `productReferenceId` are optional. A reference does not change dimensions. The user may explicitly apply verified full body dimensions where the catalogue supplies them. Other envelopes and ports are schematic.
- `buildingServicesContract.ts` is the shared strict API/MCP contract, including finite coordinates, optional heights, unique entity IDs and exclusive fixture/junction endpoint ownership. Optional services in saved API snapshots are validated as a whole. Store edits reject routes that collapse below 0.01 m after resolving their links.
- Project calculation preflight checks junction bounds/floors and resolves links before accepting measurable geometry. The full canonical model is retained when a calculation/render limit is exceeded.

## Editing workflow

1. Open **Building services**, choose a floor and **2D plan** or **3D edit**.
2. Choose a route system: cold/hot water, drainage, electrical conduit, ventilation, refrigerant, fire-water or data/security. Material and nominal diameter remain editable coordination inputs.
3. Drag a new route or tap its corners. Select 90°/45°/free plan angles and optional 5 cm grid snap. The drawing is a draft until **Finish run**. **Back point**, **Cancel** and **Escape** remain available.
4. Change End elevation before adding the next bend, or select a node and edit its X/Y/height. Tap the same XY position at another height for a vertical riser. A selected node can be dragged in either view without changing its height.
5. Attach to a matching fixture port or route node explicitly. **Continue from end** starts a connected branch. Dropping an endpoint within 15 cm of a compatible visible node or port connects it; ordinary crossings remain disconnected.
6. Place equipment, set its body dimensions and base elevation, then optionally select its supplier reference. All persisted geometry is shared by the two views and the ordinary building rendering.

The inspector stays outside the drawing and can be collapsed. Tool changes and node selection do not trigger Fit. The 3D camera is fitted only on entry to a floor or an explicit **Fit**. Inspector resizing compensates the perspective field of view to retain pixels per metre, without moving the camera, target or user zoom; extreme projections are bounded to 5°–120°. Right-drag/two-finger navigation and pinch remain available; a two-pointer gesture cancels a pending single-pointer route drag. Coordinate edits remain precise rather than being forced to the optional placement grid.

Tutorial launch integration: `ppw:open-services` accepts `detail.system` and an existing route/fixture ID in `detail.fixtureId`; `olb:close-workspaces` closes the workbench synchronously and restores its navigation state.

Direct demo entry waits for the initial demo page-ready event before opening the workspace. The wait is consumed once: later project changes still close the workspace and never reopen it automatically. An explicit `view=2d` or `view=3d` controls the initial editor; ordinary tool launches use the originating building view, which is restored on Back. Four focused entry regressions cover demo replacement, later project changes, initial view/return state and cancellation by another workspace.

## Verification and evidence

- Focused final run: **103 tests across 9 files passed**. These cover legacy and multi-height lengths, vertical segments, explicit junctions and merging, fixture offsets, malformed snapshots, API estimates, persistence/history, workspace cancellation, press-drag drafts and camera-independent plan edits. Scoped lint passed for the changed editor/camera code. The local API test environment reports its existing unset-rate-limiter warning; no rate-limiting claim is made by these tests.
- Headless reproducible script: `tools/services-spatial-shot-2026-10-15.mjs`.
- Fresh public-route smoke script: `tools/services-entry-shot-2026-10-15.mjs`, with no seeded project data; its separate `entry-report.json` records the tested build and initial 2D/3D state at both widths.
- Evidence folder: `docs/qa-services-spatial-2026-10-15/`; `report.json` records the actual tested bundle, 1280 px desktop and 390 px phone screenshots, geometry checks, console errors and blocked API-write attempts.
- Final tested bundle `App-CDZDraaG.js`: both viewports passed, 12 interaction screenshots plus 4 fresh public-entry screenshots, no console/page errors, no API writes, no horizontal overflow or clipped primary controls. Tool-selection camera images changed 0%; mouse/touch endpoint dragging retained an entered 2.5 m height and the enabled 5 cm placement grid. Press-drag in plan and 3D created a draft without changing the saved project until **Finish run**.
- The initial public-route defect was reproduced before repair: a fresh `/demo?panel=services&view=3d` loaded `generic-demo-home` but closed the workspace. All four unseeded 2D/3D desktop/phone cases now keep the editor open after startup and select the requested view. The additional four entry unit tests and all 12 workspace interaction unit tests passed after the repair, with scoped lint clean.
- Inspector resize retained centred drawing pixels: 0% change on phone when the canvas grew from 243 to 513 px high, and approximately 0.00032% changed colour channels on desktop when width grew from 976 to 1280 px. Phone two-finger pan/pinch changed the camera without adding a draft or saved route. Three pure camera regressions also verify scale invariance, reversible height changes, bounds and zero/nonfinite dimensions.
- Final desktop/phone screenshots were inspected. The workbench uses a simple measured grid/context with schematic equipment rather than a photoreal house interior; pipe centreline visibility supplements true diameter geometry. The phone inspector scrolls independently and can be hidden to expand the drawing. No obstructing overlay or clipped primary control was observed in these cases.

## Deliberate limits

This is measured coordination geometry and quantity takeoff, not hydraulic/circuit/HVAC sizing, refrigerant compatibility, fire coverage/approval, camera coverage, drainage capacity, structural sleeve design or certification. Generic equipment meshes are not manufacturer CAD models. Fixture body dimensions exclude installation clearances. Fittings, insertion depths, waste and offcut reuse are not automatically inferred.

Routes and explicit links are owned by one floor; cross-floor links are not inferred from matching XY. A separately measured riser and project review remain necessary. Coordinates are bounded to ±10,000 m, node elevations to ±20 m relative to their floor, with 2,000 routes/fixtures/junctions and 500 nodes per route. The interactive 3D services editor refuses a visible floor above 12,000 nodes or 500 fixtures instead of silently trimming it; use discipline filters or 2D for that floor. The original model remains unchanged.
