# Graphics and view feedback — PR50 fix round

Prepared 25 October 2026. This report covers adaptive desktop corner shading, reversible cursor wall cutaway, and renderer-side Remove highlighting. It does not change geometry, dimensions, saved materials, quantities, pricing or structural calculations.

## Change

- Desktop Auto runs a short trial of actual AO-rendered frames after at least eight frames and 1.5 seconds of shader/asset warm-up. It retains corner shading only at a measured 45 FPS or faster, monitors subsequent active rendering, and falls back to direct rendering after a sustained slow window. Idle pauses are excluded. Auto uses CSS-resolution beauty rendering and a 40%-resolution AO buffer; manual High retains its previous higher-resolution buffers. Phones keep AO off.
- Hovering a visible wall in idle 3D selection temporarily lowers that wall to its cutaway stub. Leaving, moving the view, or entering a drawing/paint/placement tool restores it. The full wall remains the stable hover boundary, preventing flicker; source wall dimensions and material state are untouched.
- Remove previews use private highlighted geometry. Object, opening, drawn-wall and floor targets remain semantic IDs handled by the existing undo transaction. A selected floor tile is highlighted within its own rectangle, clipped against the original floor triangles so concave room boundaries and holes remain respected. No renderer operation deletes the underlying build.

## Measured before

Actual completed ThreeStage renders during a ten-second real-pointer orbit at 1280 × 800, DPR 1, native Chromium D3D11 on Intel Iris Xe. Browser contexts had network cache disabled. Browser/test/build workloads were serialized for performance measurement.

| Baseline | Orbit FPS | Frame interval p95 | Navigation → first 3D frame | Shading |
| --- | ---: | ---: | ---: | --- |
| Live Auto | 37.15 | 123.0 ms | 12.97 s | AO |
| PR50 before Auto | 60.03 | 18.8 ms | 5.95 s | Direct |
| PR50 before High | 41.93 | 109.8 ms | 5.00 s | AO |

All three initial logical and rendered cameras matched. The before/live images visibly show less contact depth in direct Auto. The live baseline recorded one existing external exchange-rate HTTP 401. Both local baseline cases recorded zero errors, failed responses, writes or horizontal overflow, and unchanged saved property data.

## Compiled after verification

| Final compiled preview | Orbit FPS | Frame interval p95 | Navigation → first 3D frame | Outcome |
| --- | ---: | ---: | ---: | --- |
| Auto | 60.04 | 18.5 ms | 8.10 s | AO trial 15.9 FPS; direct fallback |
| High | 40.16 | 118.0 ms | 2.41 s | AO remains enabled by explicit choice |

The automatic threshold is enforced, but **default visual parity is not achieved on this tested GPU**: Auto retains the lighter direct-rendered appearance. Manual High provides AO but also remains visibly lighter than live and runs below 45 FPS. No additional renderer change was made after this measured limit was established. Cold first-load time is deliberately not optimized. These first-frame measurements use network-cache-disabled contexts; they are not guaranteed cold OS/GPU shader caches.

An initial diagnostic found a 16.5 FPS cold AO trial. A warmed manual Auto re-selection reached 43.9 FPS and correctly fell back; this is recorded in `graphics-warm-trial/report.json`. The final bounded warm-up and smaller AO buffer did not cause default Auto to clear the threshold. Diagnostic images/data remain separately labelled; the table above is the final compiled run.

Both final cases recorded zero console/page errors, failed responses, attempted writes and horizontal overflow. Saved property data remained unchanged. The logical boot camera matched the before baseline, but its rendered FOV differed by 0.00032 rad after the toolbar layout changed. The raw reports retain `sameRenderCamera: false`.

For the actual visual comparison, a separate read-only capture standardised only the canvas box to 1168 × 592 within a 1280 × 800 browser and pressed each app's ordinary Fit button. Live, preview Auto and preview High then had **identical logical cameras, rendered cameras and canvas dimensions**. No source scene or camera values were injected. These are the images in `graphics-comparison.html` and `.png`; their exact equality is recorded in `matched-camera/report.json`.

Desktop wall-hover checks passed: visible wall lowers without flicker, pointer leave restores it, saved geometry/camera are unchanged, and both wall drawing and paint mode suppress hover cutaway. At 390 px, Auto remains `phone-off` / `natural-basic`, real touch does not trigger mouse hover cutaway, and the layout has zero horizontal overflow. Both cases have zero errors or writes. Actual paint application and Remove/Undo acceptance are covered by the parent/interaction agent's separate reports.

## Tests and reproducible commands

```
npx vitest run src/components/three/__tests__/viewOnlyFeedback.test.ts src/components/three/__tests__/adaptiveAmbientOcclusion.test.ts src/designer/__tests__/renderQuality.test.ts src/components/three/__tests__/naturalSceneRenderer.test.ts
node tools/sims-fix-graphics-2026-10-24.mjs before http://127.0.0.1:5175
node tools/sims-fix-graphics-2026-10-24.mjs after http://127.0.0.1:5173
node tools/sims-fix-hover-2026-10-24.mjs http://127.0.0.1:5173
node tools/sims-fix-matched-camera-2026-10-24.mjs http://127.0.0.1:5173
node tools/sims-fix-graphics-comparison-2026-10-24.mjs
```

Focused tests: **4 files / 19 tests passed**, including actual-frame threshold policy, bounded warm-up, slow-scene fallback, idle-pause handling, unchanged manual High sizing, reversible wall visibility, private highlight ownership and selected-tile clipping. Scoped ESLint passed for all owned application/test files. Existing renderer tests remain unchanged. The measured build passed TypeScript and Vite in 9.57 seconds (`test-results/sims-fix-graphics-final-build.log`). The parent agent subsequently verified the final complete suite: **4,279 tests passed**, application and API types passed, and the final build passed in 9.39 seconds.

## Evidence and limits

- Raw baseline: [graphics-before/report.json](graphics-before/report.json).
- Final raw measurements: [graphics-after/report.json](graphics-after/report.json).
- Exact camera/projection comparison: [matched-camera/report.json](matched-camera/report.json).
- Fixed camera comparison: [graphics-comparison.html](graphics-comparison.html), [PNG](graphics-comparison.png).
- Browser wall-hover and phone checks: [wall-hover/report.json](wall-hover/report.json).
- Removing a room-boundary wall remains explicitly unavailable; the action preserves the closed room and its measurements. Independent drawn walls are removable. Floor removal clears the selected tile/finish, never the room.
- Adaptive quality is a device measurement, not a universal performance guarantee. The 390 px phone browser uses the laptop GPU; this is not a physical-phone benchmark. Manual High may remain below 45 FPS.
- This does not claim photographic product fidelity or manufacturer CAD accuracy. No new supplier assets, paid generation, API integration, database migration or deployment is part of this work.
