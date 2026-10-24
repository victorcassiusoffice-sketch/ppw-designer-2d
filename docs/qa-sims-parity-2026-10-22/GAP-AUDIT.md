# Designer UX Test Report — fcefc73 — 2026-10-22

## Verdict

Phase A was saved before implementation. The current public build provides a usable measured house, but does not meet the requested build/buy interaction. The largest gaps are precise rotation, a real 3D placement ghost, explicit placement controls and catalogue discovery. The existing wall/surface placement and camera engine should be extended, not replaced.

Baseline commands: `git log -1` → `fcefc73`; `git status --short` → clean before audit tools; production `/api/healthcheck` → production commit `fcefc73bd75abe995b379e825ff715d439da2ca8`. PR49 remains OPEN and is excluded. `npm run build` passed; vendor-three gzip baseline 191.30 kB. Existing camera/material checks: 8 files, 66 tests passed.

## Parity Scores

Desktop and 390 px touch-emulated Chromium are scored below. Physical iPhone/Android and Safari were not tested; no physical-device percentage is claimed. The source inspection supplements screenshots where a missing control cannot be exercised. Scores: 0 missing; 1 substantial gap; 2 usable but incomplete; 3 matches this criterion with direct evidence. No preceding run has this exact rubric and fixture, so no numerical regression comparison is claimed.

## Top defects (ranked by user impact)

1. [Both][C1 rotation · 1 → 3][Resolved for single objects] Baseline quarter-turn controls and inconsistent 90°/15° input are replaced by shared 45° stops, 1° fine input, an on-object 3D ring and selected-object touch twist. Five desktop and seven phone rotation harness groups pass. Evidence: `PHASE-B-C-ROTATION.md`, `shots/after-rotation/desktop-3d-eight-stops.png`, `phone-3d-twist-preview.png` and matching `report.json`. Not done: parent/child assembly rotation is disabled deliberately; physical iOS/Android were not tested.
2. [Both][C1 rotation safety · 1 → 3][Resolved] The 2D handle and 3D ring now preview without saved writes, preserve the measured centre, validate before one-frame commit and cancel without changing the saved pose. Wall-mounted fixtures expose no free-rotation ring. Evidence: `shots/after-rotation/*-2d-rotation-before.png`, `*-2d-rotation-preview.png`, `*-2d-rotation-release.png`, `phone-3d-wall-safe.png`; matching saved-pose/history records in `report.json` and seven rotation transaction tests.
3. [Both][A2/A5 placement · 1][P0] The 3D view lacks a full in-hand new-product body with green/red validation. Existing move feedback is a footprint. Evidence: `shots/before-actions/phone-moving-table.png`; `RoomView3D.tsx` and placement intent bridge. Fix: expose the same read-only resolver to new placement and preview the body without a saved mutation.
4. [Both][A4 placement choice · 1][P0] Many grid sizes exist, but there is no clear 50/25 cm/free-object placement selector or explicit overlap override. Source: `designerUIStore.ts`, `itemDrop.ts`; `shots/before-interaction/phone-plan.png`. Fix: an object-placement control, separate from measured wall/grid units.
5. [Both][C4 surfaces · 2][P1] Table movement carries the child's saved position correctly and undo restores both, but the child does not visually stay with the moving body during preview. Evidence: `shots/before-actions/*-moving-table.png`, `*-moved-table-child.png`, `*-undo-move.png`; state snapshots in repo `before-actions/report.json`. Fix: move the temporary assembly with the parent.
6. [Both][C4 wall height · 1][P1] Shelf selection has no direct raise/lower control. Evidence: `shots/before-actions/*-wall-item-selection.png`. Fix: a bounded height control for wall products, preserving wall attachment and product dimensions.
7. [Both][G3 catalogue · 1][P1] Mixed-angle product photography and top-down images; no room/function selector, supplier-stock badge or declared variant swatches. Phone details exist; desktop plan details primarily use hover. Evidence: `shots/before-interaction/*-catalogue.png`; current catalogue components. Fix: cached existing-model thumbnails, explicit filters/details and optional supplier metadata.
8. [Both][G4/G5 graphics · 2][P1] Physical lighting, PBR and shadows exist, but there is no quality selector; phone still receives desktop shadow sizes and Natural-mode AO. Evidence: `shots/before-interaction/*-house.png`; `ThreeStage.tsx`, `naturalSceneRenderer.ts`. Fix: device defaults and user-selectable Low/Medium/High with colour-check preserved.
9. [Phone][G1 clarity · 1][P1] The floor selector label is visibly cropped at 390 px on the base build. Evidence: `shots/before-interaction/phone-plan.png`. This is also addressed separately by open PR49; do not import its entire UI into this PR.

## Cross-platform divergences

- Rotation after Phase B: desktop comma/period/R use 45° and Shift/Alt use 1°; phone has a 45°/1° ring toggle and selected-object two-finger twist. The twist preserves the camera. Empty-floor two-finger input remains camera navigation.
- Phone catalogue has a visible information button; desktop plan catalogue relies more on hover.
- Baseline action captures used mouse input at both widths. Final Phase B additionally uses native CDP multi-touch for 3D twist/cancellation and the 2D handle/cancellation. This is touch-emulated Chromium evidence, not a physical-device certification.
- `/designer` is passcode-protected on production. Both gate pages were recorded, but no code/login was entered. Public `/demo` and local `/designer?pitch=1` were inspected. Baseline reports record a 401 console resource error; its source must be identified rather than called a clean run.

## Aesthetic findings (Section G)

- The live house includes furniture bodies and cutaway walls; it is not flat boxes everywhere. Several furniture bodies remain approximate and the request prohibits buying/generating replacements.
- Consistent catalogue angle can be baked for the 21 existing GLBs. Missing merchant meshes must retain honest photo/procedural fallback, never fabricated stock or a claimed exact model.
- An appearance preview can use ACES, but calibrated paint-colour mode must keep its established rig and albedo unchanged. Existing PMREM RoomEnvironment is procedural; no photographic HDRI file exists in the repository.
- Eight fixed-scene baseline graphics captures are being recorded by the separate graphics harness before any renderer changes. Their actual FPS/first-paint results belong in the before/after sheet, not an inferred claim here.

## Changes since last run

This is a new baseline from production main, not the PR49 preview. No application code changed during Phase A. Any regression against this baseline will be recorded in the after column below.

## New test cases proposed (exploration → harness)

- B01: eight 45-degree ring stops; B02: modifier 1-degree free turn; B03: comma/period; B04: touch twist; B05: cancel/lost capture; B06: wall attachment and pivot stability.
- C01: green/red ghost; C02: 50/25 cm/free; C03: slide/auto-face; C04: wall height; C05: surface child follow; C06: existing-item move in both views; C07: place/move/rotate/delete undo/redo; C08: clone variant; C09: 20 objects with no overlap; C10: door/window obstruction.
- D01: cached angle thumbnails; D02: room/function/search/sort; D03: declared swatches/details; D04: unknown/dated supplier stock; D05: demo remains price-free.
- E01: quality tiers; E02: colour-check unchanged; E03: shadows/AO/AA/PBR; E04: orbit/pan/zoom and cutaway; E05: cold first scene and active-render FPS; E06: vendor-three gzip delta.

## Full rubric scorecard (all criteria, all platforms)

| Criterion | Desktop before | Phone before | After | Evidence / user expectation |
|---|---:|---:|---|---|
| A1 Inline no-new-window | 2 | 2 | 2 desktop / 2 phone | Catalogue details and rotation stay in the canvas workspace; before-interaction/*-catalogue.png versus catalogue-after/*-3d-details.png. No full-app navigation audit claimed. |
| A2 Ghost/in-hand preview | 1 | 1 | 2 desktop / 2 phone | Phase C: measured 3D carried proxy and 45-degree preview verified; refreshed half-step/free frames show valid teal-green on both sizes. PHASE-C-PLACEMENT.md. |
| A3 Grid snapping | 2 | 2 | 2 desktop / 2 phone | Phase C: 19 real pointer placements plus one seeded lamp produce 20 non-overlapping 40 cm footprints. Grid step verified by itemDrop tests; placement-after/*-twenty-no-overlap.png. |
| A4 Half-step/free precision | 1 | 1 | 2 desktop / 2 phone | Phase C: 50 cm, 25 cm and Free controls exercised; half/free position and solid-wall bounds covered by unit tests. Carried-half-step/free pictures; phone is pointer-emulated. |
| A5 Valid/invalid feedback | 1 | 1 | 2 desktop / 2 phone | Phase C: valid ghost record and invalid plot-edge picture; invalid Free drop leaves the complete property unchanged. Refreshed half-step/free frames visually confirm valid teal-green on both sizes. |
| B1 Repeat-place/stamp | 2 | 1 | 2 desktop / 2 phone | Phase C: Shift-held pointer stamping places 19 objects in both viewport sizes. Touch-only repeat placement remains unverified; twenty-no-overlap pictures. |
| B2 Duplicate selected | 2 | 2 | Not done | Existing action retained; no dedicated new pointer/history/attachment acceptance run. Copy type has separate evidence under B3. |
| B3 Eyedropper/copy type | 1 | 1 | 2 desktop / 2 phone | Phase C: Copy type arms the selected exact console-table SKU in House, including carried rotation. Merchant variant cloning remains unverified; carried-half-step pictures. |
| C1 Rotate | 1 | 1 | 3 desktop / 3 phone | Phase B: eight 45° stops, 1° fine input, 2D/3D preview/commit/cancel and native touch twist; PHASE-B-C-ROTATION.md and shots/after-rotation/report.json. Parent/child assembly rotation is intentionally disabled; physical phones untested. |
| C2 Reposition placed | 2 | 2 | 2 desktop / 2 phone | Phase C: actual 3D pointer drag changes table position and retains child offsets; moving-table/moved-table-child before and after. Cross-room assembly move not exercised. |
| C3 Delete | 2 | 2 | 2 desktop / 2 phone | Phase C: Delete reduces 20 objects to 19; Undo restores 20. Delete redo not exercised; placement-after/*-delete.png and *-undo-delete.png. |
| C4 Move-to-slot | 2 | 2 | 2 desktop / 2 phone | Phase C: attached child follows parent preview and committed movement; wall shelf height stored at 170 cm. Slot reparenting and wall slide have unit coverage but no dedicated pointer pictures. |
| D1 Pan | 2 | 2 | 2 desktop / 2 phone | Phase E: continuous pointer orbit renders 56.7–59.9 desktop / 55.2–59.3 phone FPS (390 px, CPU ×4); geometry unchanged. This measures orbit, not a dedicated pan trace. Strict desktop 60 FPS remains unmet; PHASE-E-GRAPHICS.md and after-graphics/report.json. |
| D2 Zoom | 2 | 2 | 2 desktop / 2 phone | Phase E: all four quality choices retain the same camera/property/canvas; all eight before/after logical and render-camera bookmarks match. Existing pinch regression tests remain; no dedicated physical-phone pinch/zoom benchmark was added. quality-controls/report.json and graphics-comparison.json. |
| D3 Move-vs-pan | 2 | 1 | 2 desktop / 2 phone | Phase B: selected-body twist changes the item while recorded camera stays fixed; phone-3d-twist-start/preview/release.png. Empty-floor camera path is retained. All gesture origins at extreme zoom and physical devices were not exercised. |
| E1 Undo/Redo | 2 | 2 | 2 desktop / 2 phone | Phase C: move Undo/Redo and delete Undo verified. Full place/move/rotate/delete chain remains unverified; undo-move and undo-delete pictures. |
| E2 Cancel placement | 2 | 2 | 2 desktop / 2 phone | Phase C: Cancel after half/free ghost rotation adds no item. No post-cancel picture; ring cancellation belongs to Phase B. |
| E3 Live cost | N/A | N/A | Untouched | Public demo is price-free; estimates must not change. |
| F1 Finger occlusion | 1 | 1 | 3 desktop / 2 phone | Phase B: 3D ring moved beside/above the selected body; phone-3d-twist-preview.png. Existing 2D action row still covers small products in a fitted plan; phone-2d-rotation-release.png. |
| F2 touch-action discipline | 2 | 2 | 3 desktop / 3 phone (rotation) | Phase B: Escape and native touchCancel preserve saved pose/history; 2D/3D phone cancellation checks pass, camera is unchanged by twist. Scope is rotation in Chromium; physical Safari/Android are not verified. |
| F3 Tap-target size | 2 | 2 | 2 desktop / 2 phone | Phase B: screen-sized 124 px 3D ring is reachable in 390 px captures. The 2D handle remains canvas-scaled and can be small far out; native touch passes the fixture, but zoom-extreme physical ergonomics are not verified. |
| F4 On-object controls reachable | 1 | 1 | 3 desktop / 2 phone | Phase B: 3D ring and 2D handle reached with actual pointer/touch input, including free turn and cancel. Existing narrow 2D action-row overlap remains; see PHASE-B-C-ROTATION.md and phone-2d-touch-preview.png. |
| F5 Haptics | N/A | Not verified | Not done | No physical phone available in this run; Chromium emulation cannot verify vibration. |
| F6 Safe areas | 2 | 2 | 2 desktop / 2 phone | Final rotation/catalogue captures stay within viewport with zero horizontal overflow. Physical device notches and browser bars remain unverified. |
| G1 Visual cleanliness | 2 | 1 | 2 desktop / 1 phone | Not fully done: phone Plan floor label and small-object action-row overlap remain. Evidence after-rotation/phone-2d-rotation-before.png and -release.png. PR49 UI excluded as instructed. |
| G2 Empty state | Not exercised | Not exercised | Not done | Furnished acceptance fixtures do not verify a first-time empty build. No baseline pair or new-user test available. |
| G3 Catalog legibility | 1 | 1 | 2 desktop / 2 phone | Phase D: fixed-angle existing-model PNGs, room/function tabs, explicit details and honest unknown stock. Real variants/stock absent; missing meshes keep source photos. See PHASE-D-CATALOGUE.md and catalogue-after/report.json. |
| G4 Visual consistency | 2 | 2 | 2 desktop / 2 phone | Phase E: compiled Auto/Low/Medium/High controls pass at both widths; ACES Natural, preserved Colour check, 1024 phone / 2048 desktop shadows, AO desktop High only. Four paired scene sheets retain geometry/scales. Procedural products and generated PMREM remain; exact reference realism / photographic HDRI not achieved. PHASE-E-GRAPHICS.md. |
| G5 Motion | 2 | 2 | 2 desktop / 2 phone | Phase E: native Iris Xe/D3D11 render submissions, eight matched scenes; desktop 56.7–59.9 FPS (strict 60: 0/4 pass), CPU-throttled phone 55.2–59.3 (30: 4/4 pass). 3D activation <3 s: 8/8; full cold navigation <3 s: 1/8. Auto/Medium now disables AO; High and physical phones not benchmarked. Bundle −4 gzip bytes; graphics-comparison.json. |
| G6 First-run comprehension | 1 | 1 | 2 desktop / 2 phone | Explicit Copy type, 50 cm, 25 cm, Free and Cancel labels shown in placement-after/*-carried-half-step.png. Novice-user comprehension study not done; score covers labelled controls only. |

## Scripted harness matrix result (18 rows)

The historical 18-row harness is not claimed as executed. Current baseline: public route audit 12 captures (6 per size); controlled local actions 16 captures (8 per size). Initial errors are retained in the raw reports, not hidden. The eight-scene graphics harness is a separate run. New acceptance tests will name their results individually.

## Evidence index

- Repo: `docs/qa-sims-parity-2026-10-22/before-interaction/report.json` — public URL, visible controls, state, screenshots and errors.
- Repo: `docs/qa-sims-parity-2026-10-22/before-actions/report.json` — pointer actions and before/after table/child x/y/rotation snapshots.
- Report-folder `shots/before-interaction/` and `shots/before-actions/` — copies of the actual baseline PNGs, labelled by device and action.
- Baseline build: `test-results/sims-parity-baseline-build.log`.
- Read-only source audits: existing ThreeStage, RoomView3D, RoomCanvas pointer FSM, attachmentPlacement, placementActions, catalogue, merchant importer. No quantity/estimate edits.

## Implementation order and ownership

1. Rotation agent: transaction helper, 3D ring/twist, selected keyboard rotation and RoomView3D. No ThreeStage renderer changes.
2. Root: additive existing 2D pointer FSM, shared placement preview/modes, attachment UI and placement tests. Coordinate RoomView3D integration through its owner.
3. Catalogue agent: current catalogue components, truthful optional metadata, baked existing GLB thumbnails and tests. No new paid assets or DB persistence claim.
4. Graphics agent: quality tiers, renderer-only lighting/AO/material settings and fixed-scene proof. No geometry or estimating changes.
5. Integrate; verify unchanged estimate tests, demo, passcode/checkout and API function count; full build/tests; push only feature branch and open PR. No manual deployment or merge.
