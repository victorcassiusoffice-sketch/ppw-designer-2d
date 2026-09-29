# Room Designer interaction audit — 29 September 2026

Scope: Victor's request for Sims-style doors and gardens, wider Plan zoom, stable 3D zoom during editing, precise movement, roof-only solar visibility and SketchUp research/integration. Branch: `cursor/feat-3d-flooring-hud-bc95`. Production and main are not part of this release.

| Problem | Cause | Change |
|---|---|---|
| Selecting tools/products or changing floors zoomed the house out | Camera fit effect followed canvas aspect, scene bounds, height and level changes | Fit when initializing a 3D viewport, opening a different project or explicitly pressing Fit; tool/geometry changes within the active 3D session preserve the camera target, distance and angle |
| Opening Furnish made the house smaller even with the same camera distance | Perspective pixel size depended on the reduced canvas height | Render-time field-of-view compensation preserves pixels per metre and pan sensitivity across dock/inspector resizing |
| Dragged products jumped when a detailed model finished loading | Asynchronous GLB replacement used the saved pose instead of the temporary drag pose | Transfer movement/rotation to the model's correct pivot without changing its catalog scale; cancellation baseline follows the replacement |
| Camera movement felt slow | 80 ms damping response | 35 ms damping response; named camera angles preserve zoom |
| Fit could crop the house on tall phones | Fit assumed an aspect ratio of at least 0.6 | Use the actual positive viewport aspect; regression checks every building corner at 240×900, 390×844 and 1280×800 |
| 2D could not pull back far enough | Manual zoom minimum was 30% | Shared wheel, pinch, keyboard and toolbar minimum is 4%; existing Fit can still fit unusually large plans below that if required |
| Doors were one-shot taps without a wall preview | Hardcoded opening placement and immediate tool exit | Wall-snapped preview, press/slide/release, shared Plan width/swing/hinge settings, repeat placement until Done/Escape; interrupted gestures do not commit |
| Doors could overlap through the other room's shared wall | Validation only looked at the selected room | Validate all openings on the same physical wall in the property store and Plan placement |
| Garden drawing required a fixed patch before sizing it | Add immediately stored a rectangle before entering a separate resize action | Surface buttons arm a transient drag-to-create gesture in Plan/3D; save on release only; Cancel/Escape/tool changes discard the draft |
| Existing garden areas were difficult to reshape in 3D | No direct surface selection/corner edit affordances | Tap an area to select it and drag one of four corners; live dimensions/area and one-step undo |
| Scene tools seemed to ignore clicks | Docked inspector dismissal cancelled the first scene pointer | Docked details can close without swallowing scene input; true overlays still dismiss safely; corner gestures keep layout fixed |
| Merely opening Garden added an undo step | Re-selecting Ground focused the first room and added legacy level metadata | Switch levels only when necessary; arming/cancelling on Ground leaves the property and history untouched |
| Roof solar panels remained on lower-floor views | Prior user direction explicitly kept roof products visible | Latest direction overrides that: roof products render only on Roof; saved panel data, cart quantities and energy calculations remain |

## Validation

- Full regression run: 274 files / 3,036 tests passed. A subsequent garden no-phantom-undo correction passed the final 13-test garden/workspace run, including two added regressions.
- Final portrait Fit correction passed 31 focused camera/Fit/motion tests, including three new projection regressions, and scoped lint.
- Seven separate Node integration tests passed for the SketchUp GLB importer, including failed/oversized/concurrent imports and preservation of prior assets.
- Final client/API typechecks, scoped lint across all changed source/test files and production build passed. Public source maps: zero.
- Browser checks on the local app at 1280px desktop and 390px phone: zoom then Furnish preserves object scale; 3D wall-slide door adds successfully and tool stays active; Done/Cancel permit tool changes; garden draw creates a 4.1 m² patch and corner resize changes it to 3.5 m²; Plan reaches 4%; stored panel appears on Roof and disappears on Ground without cost change.
- Unique Vercel Preview `6739155621` (https://ppw-designer-2d-55airl1ig-victor-ppw.vercel.app) was verified on desktop and phone; healthcheck returned `1be7bf68002c47bf96e29de2a69d386159edd0c5` and `env=preview`. This includes the main interaction fixes. The later portrait-Fit correction in `23eb787` passed local tests/build but its newer preview hosts timed out; remote verification remains pending. See the workflow for exact deployment IDs. No customer order, payment, email, booking or supplier mutation was submitted. Full shell-driven Playwright E2E was not executed in this pass; browser interaction checks used the in-app browser.

## SketchUp scope and remaining limitations

The tested import command connects supplier-authorized **SketchUp GLB product exports** to the existing dimension-fitted renderer. It validates geometry, optimizes texture/triangle budgets, records source/licence/SKU, preserves prior assets and allows reviewed models to override procedural utilities. Details and primary research links: [SKETCHUP-MODELS.md](SKETCHUP-MODELS.md).

This does not embed SketchUp's editor or parse `.skp` directly. No supplier SketchUp model was supplied; tests use original geometry. The new pipeline is ready for those assets, while current products retain their current models/illustrations.

Doors/windows require enclosed room walls; close free-wall runs into a room first. Editing/removing existing openings remains in Plan. Garden surfaces support rectangular draw/resize; fences retain their current fixed-run placement, and freeform terrain sculpting is not implemented. The changes improve the relevant interactions, not every feature of The Sims.

Camera framing is preserved within the active 3D session. Switching to Plan and back remounts the 3D viewport and fits the building again.
