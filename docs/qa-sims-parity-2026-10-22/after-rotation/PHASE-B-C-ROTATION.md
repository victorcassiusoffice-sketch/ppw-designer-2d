# Designer UX Test Report — Sims parity working branch — 2026-10-24

## Verdict
Rotation is ready for integration on desktop Chromium at 1280×900 and touch-emulated Chromium at 390×844. Five desktop and seven phone harness groups pass with real pointer input. The selected object keeps its measured centre; preview never writes geometry; release records one undo frame; Escape/touch cancellation restores the saved pose. This is a scoped rotation report, not approval of every Designer workflow or a physical iPhone/Android certification.

## Parity Scores
C1 rotation: desktop 3/3, touch-emulated phone 3/3 (baseline 1/3 on both). Full-product percentages are not inferred from this scoped run. Native iOS Safari and physical Android remain untested.

## Top defects (ranked by user impact)
1. [Phone][G1 clarity · 1] The existing 2D floating action row covers much of a small product in a fitted 8×6 m plan. It can be mistaken for the product hit target. Evidence: `phone-2d-rotation-release.png`, matching entry in `report.json`. Fix: place the action row clear of the selected body and its rotation handle; keep controls at the screen edge when insufficient space exists. The new 3D ring was moved beside and above the object after this test caught finger interception.
2. [Phone][G3 toolbar legibility · 1] The Ground floor selector remains clipped in the narrow 2D toolbar. Evidence: `phone-2d-rotation-before.png`. Fix: preserve a minimum selector width and simplify adjacent labels. Parent integration owns this existing toolbar defect.
3. [Both][C1 rotation scope · 2] A table/shelf carrying child objects cannot rotate as an assembly; the ring is intentionally hidden. Translation preserves child offsets and now previews the assembly via the shared renderer, but safe assembly rotation is not implemented. Evidence: `beginItemRotation`/`canTurn` guard and existing placement fixture. Fix: rotate child centres around the parent pivot and validate the entire assembly in one transaction before enabling it.

## Cross-platform divergences
- Desktop uses comma/period/R at 45° and Shift/Alt at 1°. Phone uses the same on-object ring with its 45°/1° toggle; a selected-object two-finger twist snaps to 45°.
- Phone tests include actual CDP touch events for 3D twist, cancellation and the 2D rotate handle, not just mouse input at a narrow width.
- Starting two fingers on empty floor retains camera pinch/pan. The selected body must be picked before twisting.
- 2D handle remains a canvas-scaled visual. At far zoom-out it appears small; exact touch targeting passes in this fixture, but physical-device ergonomics need follow-up.

## Aesthetic findings (Section G)
- The 124 px ring sits beside/above the body instead of covering it (`phone-3d-twist-preview.png`). Its open centre does not intercept scene input, and the active angle remains readable.
- Both 3D controls and 2D handle fit the 390 px capture; document horizontal overflow is 0 on both profiles.
- Furniture rendering is unchanged by this phase. The console fixture is a bundled dimensional preview, not a claim of an exact merchant mesh.

## Changes since last run
Fixed: inconsistent 90°/15° input, direct saved writes during 2D rotation, centre drift, missing 3D ring/twist, Escape ordering, and the new ring initially intercepting touch on the selected body. No quantity, dimensions, material estimate or product-cost algorithm was changed.
New: shared strict-centre transaction, 45°/1° input math, read-only 2D preview, 3D ring/twist, and the catalog ghost integration described below.
Regression addressed during QA: first ring placement obscured the selected body on phone; moved clear before final screenshots. Existing 2D action row/floor label defects remain as listed above.

## New test cases proposed (exploration → harness)
Implemented in `tools/sims-rotation-shot-2026-10-22.mjs`:
- B01: all eight 45° ring stops, exact centre, zero preview writes, one history frame per release.
- B02: Alt-drag 17° and Escape cancellation.
- B03: comma/period, Shift/Alt fine steps, Undo/Redo.
- B04: native two-finger twist, fixed camera, native touch cancellation.
- B05: wall-mounted shelf exposes no free-rotation ring.
- B06: 2D handle preview/commit/cancel at both widths.
- B07: native phone touch on the 2D handle, including cancellation.
Still needed: physical Safari/Android gestures, zoom-extreme handle ergonomics and parent/child assembly rotation if later enabled.

## Full rubric scorecard (all criteria, all platforms)
This is a scoped supplement to GAP-AUDIT.md. Criteria outside rotation are not rescored here; parent’s final report combines placement/catalog/graphics evidence.

| Criterion | Desktop Chromium | Phone touch Chromium | Physical iPhone/Android | Evidence / limit |
|---|---:|---:|---|---|
| C1 Rotate | 3 | 3 | Unverified | Eight stops, free/keys, native twist |
| E1 Undo/Redo | 3 | 3 | Unverified | Per-commit history and exact pose restoration |
| E2 Cancel rotation | 3 | 3 | Unverified | Escape, touchCancel, no preview persistence |
| F1 Finger occlusion | 3 | 2 | Unverified | 3D body clear; existing 2D row overlaps |
| F3 Touch target size | N/A | 2 | Unverified | 3D ring accessible; 2D far-zoom target requires physical check |
| F4 Object controls reachable | 3 | 2 | Unverified | Desktop/phone captures and existing 2D row limitation |
| G1 Visual cleanliness | 3 | 1 | Unverified | Existing narrow 2D selector/action row |
| Other rubric rows | Not scored | Not scored | Unverified | Parent acceptance report owns these workflows |

## Scripted harness matrix result (18 rows)
This supplement does not claim the global 18-row matrix. Its five desktop and seven phone groups all pass; detailed per-group status is in `report.json`. Both profiles recorded 0 console errors, 0 uncaught page errors, 0 failed HTTP responses and 0 horizontal overflow. Initial failed exploration runs found and led to the Escape/ring-placement fixes; current report and referenced captures are the final passing run.

Automated checks:
- `rotationGesture.test.ts`: 4 tests; detents/normalisation/seam.
- `rotationTransaction.test.ts`: 7 tests; preview, exact centre, one-frame undo, cancel/stale edit, wall bounds, free overlap and outdoor plot/building bounds.
- `RoomView3DRotation.test.tsx`: 4 tests; ring/twist/cancel/camera.
- `keyboardShortcuts.test.tsx`: 7 tests; coarse/fine/control-modifier isolation plus existing shortcuts.
- `placementActions.test.ts`: 8 tests; public actions.
- `roofProductActions.test.ts`: 5 tests; roof PV remains on its slab and estimates/roundtrip preserved.
- `RoomView3DCamera.test.tsx`: 22 tests; existing camera/pinch/layout checks.
- `FloatingCluster.test.tsx`: 9 tests; expected coarse turn updated from 90° to 45°.
- Last scoped TypeScript check and ESLint passed. Repository-wide final suite/build results are recorded separately by integration.

Catalog preview integration (placement evidence is recorded separately in PHASE-C-PLACEMENT.md): RoomView3D calls the registered shared `previewPlacement` resolver and passes the exact measured pose into `ThreeStage.catalogPreview`. The private ghost is outside saved solids/cart/raycast targets. It uses the existing product body, cyan/red validity, active storey height, wall/surface mounting height and roof seating. Armed pointer release and catalog drop submit the same world point. Read-only `data-catalog-preview` and `data-catalog-preview-valid` on the viewport expose the live resolved pose for acceptance diagnostics. A ghost does not change the camera or design history.

## Evidence index
Repository evidence is in `docs/qa-sims-parity-2026-10-22/after-rotation/`. Handoff copies are in `shots/after-rotation/`. Each screenshot has its matching saved item, history count and camera in the adjacent `report.json`.

- `desktop-3d-rotation-before.png`, `desktop-3d-rotation-preview.png`, `desktop-3d-rotation-release.png` — pointer transaction frames.
- `desktop-3d-eight-stops.png`, `desktop-3d-free-17-degrees.png` — detents and precision.
- `phone-3d-twist-start.png`, `phone-3d-twist-preview.png`, `phone-3d-twist-release.png` — native two-finger transaction frames, fixed camera.
- `phone-3d-wall-safe.png` — wall fixture free-rotation guard.
- `desktop-2d-rotation-before.png`, `desktop-2d-rotation-preview.png`, `desktop-2d-rotation-release.png` — 2D desktop handle.
- `phone-2d-rotation-before.png`, `phone-2d-rotation-preview.png`, `phone-2d-rotation-release.png` — narrow layout and existing action-row limitation.
- `phone-2d-touch-preview.png`, `phone-2d-touch-release.png`, `phone-2d-touch-cancel-preview.png` — native 2D touch gesture and cancellation.
- `report.json` — machine-readable states, checks and errors. Earlier `FAILED-*` exploration images are retained as debugging evidence and are not final-result screenshots.
