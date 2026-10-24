# Designer UX Test Report — fcefc73 — 2026-10-22

## Verdict

Phase A was saved before implementation. The current public build provides a usable measured house, but does not meet the requested build/buy interaction. The largest gaps are precise rotation, a real 3D placement ghost, explicit placement controls and catalogue discovery. The existing wall/surface placement and camera engine should be extended, not replaced.

Baseline commands: `git log -1` → `fcefc73`; `git status --short` → clean before audit tools; production `/api/healthcheck` → production commit `fcefc73bd75abe995b379e825ff715d439da2ca8`. PR49 remains OPEN and is excluded. `npm run build` passed; vendor-three gzip baseline 191.30 kB. Existing camera/material checks: 8 files, 66 tests passed.

## Parity Scores

Desktop and 390 px touch-emulated Chromium are scored below. Physical iPhone/Android and Safari were not tested; no physical-device percentage is claimed. The source inspection supplements screenshots where a missing control cannot be exercised. Scores: 0 missing; 1 substantial gap; 2 usable but incomplete; 3 matches this criterion with direct evidence. No preceding run has this exact rubric and fixture, so no numerical regression comparison is claimed.

## Top defects (ranked by user impact)

1. [Both][C1 rotation · 1][P0] Selected 3D objects offer quarter-turn buttons. There is no ring; a second touch becomes a camera pinch. The keyboard uses 90 degrees and the 2D handle uses 15 degrees. The requested 45-degree stops/1-degree modifier are absent. Evidence: `shots/before-interaction/desktop-selection-at-centre.png`, `desktop-key-turn.png`; `RoomView3D.tsx`, `useKeyboardShortcuts.ts`, `RoomCanvas.tsx`. Fix: one validated rotation transaction shared by ring, twist and keys.
2. [Both][C1 rotation safety · 1][P0] The 2D handle persists an angle before validation and can mutate a wall-mounted item despite the later wall rejection. Preview changes the bounding box around its top-left. Source evidence: `RoomCanvas.tsx` handle FSM, `placementActions.ts`. Fix: non-persisted preview, centre-preserving commit, cancellation and wall guard.
3. [Both][A2/A5 placement · 1][P0] The 3D view lacks a full in-hand new-product body with green/red validation. Existing move feedback is a footprint. Evidence: `shots/before-actions/phone-moving-table.png`; `RoomView3D.tsx` and placement intent bridge. Fix: expose the same read-only resolver to new placement and preview the body without a saved mutation.
4. [Both][A4 placement choice · 1][P0] Many grid sizes exist, but there is no clear 50/25 cm/free-object placement selector or explicit overlap override. Source: `designerUIStore.ts`, `itemDrop.ts`; `shots/before-interaction/phone-plan.png`. Fix: an object-placement control, separate from measured wall/grid units.
5. [Both][C4 surfaces · 2][P1] Table movement carries the child's saved position correctly and undo restores both, but the child does not visually stay with the moving body during preview. Evidence: `shots/before-actions/*-moving-table.png`, `*-moved-table-child.png`, `*-undo-move.png`; state snapshots in repo `before-actions/report.json`. Fix: move the temporary assembly with the parent.
6. [Both][C4 wall height · 1][P1] Shelf selection has no direct raise/lower control. Evidence: `shots/before-actions/*-wall-item-selection.png`. Fix: a bounded height control for wall products, preserving wall attachment and product dimensions.
7. [Both][G3 catalogue · 1][P1] Mixed-angle product photography and top-down images; no room/function selector, supplier-stock badge or declared variant swatches. Phone details exist; desktop plan details primarily use hover. Evidence: `shots/before-interaction/*-catalogue.png`; current catalogue components. Fix: cached existing-model thumbnails, explicit filters/details and optional supplier metadata.
8. [Both][G4/G5 graphics · 2][P1] Physical lighting, PBR and shadows exist, but there is no quality selector; phone still receives desktop shadow sizes and Natural-mode AO. Evidence: `shots/before-interaction/*-house.png`; `ThreeStage.tsx`, `naturalSceneRenderer.ts`. Fix: device defaults and user-selectable Low/Medium/High with colour-check preserved.
9. [Phone][G1 clarity · 1][P1] The floor selector label is visibly cropped at 390 px on the base build. Evidence: `shots/before-interaction/phone-plan.png`. This is also addressed separately by open PR49; do not import its entire UI into this PR.

## Cross-platform divergences

- Desktop keyboard rotation has no equivalent precise touch gesture; touch currently pans/zooms when a second finger is introduced.
- Phone catalogue has a visible information button; desktop plan catalogue relies more on hover.
- All local action captures used real mouse pointer events at both widths. They prove responsive layouts and pointer actions, not touch rotation; real CDP multi-touch is required in Phase B.
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
| A1 Inline no-new-window | 2 | 2 | Pending | Catalogue/selection captures: editing should stay in the house. |
| A2 Ghost/in-hand preview | 1 | 1 | Pending | Move captures/source: see the real carried object before release. |
| A3 Grid snapping | 2 | 2 | Pending | Move state logs snap to 0.5 m; preserve measured size. |
| A4 Half-step/free precision | 1 | 1 | Pending | Plan chrome/source: choose 50 cm, 25 cm or free without hunting. |
| A5 Valid/invalid feedback | 1 | 1 | Pending | Movement footprint exists; new-product 3D body/colour feedback missing. |
| B1 Repeat-place/stamp | 2 | 1 | Pending | Existing keepArmed/Shift path; touch route needs explicit proof. |
| B2 Duplicate selected | 2 | 2 | Pending | Existing action; new run must verify history and attachment. |
| B3 Eyedropper/copy type | 1 | 1 | Pending | Existing 2D tool; 3D and variant propagation need proof. |
| C1 Rotate | 1 | 1 | Pending | Selected/key captures; ring/twist missing and steps differ. |
| C2 Reposition placed | 2 | 2 | Pending | Real-pointer table drag changed x/y and child offsets. |
| C3 Delete | 2 | 2 | Pending | Existing action; acceptance must cover undo/redo. |
| C4 Move-to-slot | 2 | 2 | Pending | Surface child follows committed parent, preview incomplete. |
| D1 Pan | 2 | 2 | Pending | Existing damped camera; active pointer/performance proof needed. |
| D2 Zoom | 2 | 2 | Pending | Existing pinch regression tests; 4x slowdown remains to measure. |
| D3 Move-vs-pan | 2 | 1 | Pending | Second touch always camera, not selected-item twist. |
| E1 Undo/Redo | 2 | 2 | Pending | Table-move undo restored both items; complete action chain still needed. |
| E2 Cancel placement | 2 | 2 | Pending | Existing Escape/cancel paths; test ring and ghost cancellation. |
| E3 Live cost | N/A | N/A | Untouched | Public demo is price-free; estimates must not change. |
| F1 Finger occlusion | 1 | 1 | Pending | Phone object preview/handle needs reachable offset. |
| F2 touch-action discipline | 2 | 2 | Pending | Existing pointer surface; new gestures must retain cancellation. |
| F3 Tap-target size | 2 | 2 | Pending | Phone controls visible; new ring targets require measurement. |
| F4 On-object controls reachable | 1 | 1 | Pending | Quarter-turn-only controls; no height/twist/continuous handle. |
| F5 Haptics | N/A | Not verified | Pending | Browser emulation cannot prove physical vibration. |
| F6 Safe areas | 2 | 2 | Pending | 390 captures show bottom chrome within viewport. |
| G1 Visual cleanliness | 2 | 1 | Pending | Phone clipped floor label; keep inspectors outside house. |
| G2 Empty state | Not exercised | Not exercised | Pending | Fixed audit fixture is furnished; do not claim a pass. |
| G3 Catalog legibility | 1 | 1 | Pending | Catalogue screenshots; grouping and angle inconsistent. |
| G4 Visual consistency | 2 | 2 | Pending | Existing calibrated finish/lighting paths; no quality tiers. |
| G5 Motion | 2 | 2 | Pending | Damped camera source/tests; actual GPU budget pending. |
| G6 First-run comprehension | 1 | 1 | Pending | New controls need short labels and visible cancel. |

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
