# Fix round 2 — desktop Plan rotation handle

## Scope and cause

Item 6 of `GPT-OLB-SIMS-PARITY-FIX-2-2026-10-25.md`. The existing side-flip selected a handle position near an item that had been dragged above the Plan canvas. The resulting handle remained behind the application toolbar. The reviewer reproduction hit Project hub and committed zero of four attempted turns.

`planHandleLayout.ts` now constrains the complete 44px hit target to the visible Plan viewport, with 2px clearance. `RoomCanvas.tsx` supplies the already-measured viewport height. Gesture rotation still pivots around the real measured object centre. No camera, world coordinate, item dimensions, collision rule, estimator or saved model format changed.

## Real-pointer evidence

| Case | Before on production | After on local branch |
| --- | --- | --- |
| Desktop 1280×800, chair dragged to the reviewer destination (5, −2.9) | 0/4 turns; Project hub intercepts handle | 4/4 turns; canvas receives handle; 90→135→180→225→270° |
| Phone 390×844, chair dragged to (5.5, −5) | 4/4 turns | 4/4 turns retained using native Chromium touch events |

After each turn the harness checks the actual Konva handle, the saved angle, unchanged Plan pan/zoom, and unchanged measured object centre. Largest observed centre difference was floating-point roundoff below 0.000000000001px. Final before/after runs have zero console, page, HTTP or failed-request errors; zero blocked write attempts and zero horizontal overflow.

Before reports: `before/t3-plan-handle-prod-desktop.json`, `before/t3-plan-handle-prod-phone.json`.
After reports: `after/t3-plan-handle-local-desktop.json`, `after/t3-plan-handle-local-phone.json`.
Each report lists its selected-state and four successive-turn PNGs. The harness reads existing scene state and the rendered canvas; all movement and rotation use actual mouse/touch input. It does not inject model fixtures for this reproduction.

## Checks

- 28 focused tests passed: planHandleLayout (4), FloatingCluster (9), rotationGesture (4), rotationTransaction (7), RoomView3DRotation (4).
- The two new layout tests cover the negative-Y desktop reproduction and all four viewport boundaries at four zoom levels, retaining the full 44px hit target.
- Source diff whitespace check passed.

## Existing P1 regressions retained

The prior interaction harness was rerun at both sizes after restarting the local Vite process to avoid stale development-module store identities. All six final checks pass with zero console/page errors and zero overflow. This fixture-based regression is separate from the real-demo reviewer reproduction above.

- P1-1: selecting an object preserves the 3D canvas bounding box and immediate dragging still changes the object position. Desktop bounds remain x99/y120/w1167/h596; phone bounds remain x0/y110/w390/h603.
- P1-3: Gessica dining set and office-chair ghost, visible angle label and saved pose agree at 0°, 45° and 90°; placement commits 90°.
- P1-2: the high-Plan fixture completes all four 45° turns on desktop and native Chromium phone touch.

Evidence: `p1-regressions/report.json`, which lists 16 final PNGs for each viewport. Reproduce with `node tools/sims-fix-round-2-p1-regression-2026-10-25.mjs` against a fresh dev server at port 5176. Final browser sessions are closed; no API writes were allowed.

## Visual notes and limits

The selected chair itself remains above the viewport in the desktop reproduction, as the user placed it. Only its rotation affordance moves into view; no automatic recentering or zoom change is introduced. This is Chromium desktop and emulated-phone evidence, not a physical-device claim. The phone floor-selector label remains truncated at 390px in the existing toolbar; it is outside this item-6 scope. This patch does not redesign unrelated inspector or bottom-dock overlap cases.

## Reproduction

```powershell
$env:HANDLE_OUT='docs/qa-sims-fix-round-2-2026-10-25/rotation/after'
node tools/sims-fix-round-2-handle-2026-10-25.mjs local desktop 5,-2.9
node tools/sims-fix-round-2-handle-2026-10-25.mjs local phone 5.5,-5
```

Use `prod` instead of `local` for the unchanged production baseline. Local origin defaults to `http://127.0.0.1:5176`; `HANDLE_BASE` can override it. The harness blocks non-read network methods.
