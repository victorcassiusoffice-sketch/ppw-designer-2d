# Fix round 2 — graphics and first picture

25 October 2026. Source based on production `fc0b111`; branch `gpt/olb-fix-round-2-2026-10-25`. No vault writes, deployment, database changes, generated products, new dependencies or estimation changes by this subtask.

## Result

**Paleness fixed. First-picture targets NOT MET.** Auto follows the existing measured 45 fps rule; this laptop falls back to direct rendering. Phones keep AO off. This report does not call the result Sims or photorealistic parity.

### Exact-camera colour comparison

The earlier natural rig used Neutral tone mapping. PR50 changed it to ACES, remapping the entire image; extra corner shading could not repair that global colour shift. Natural now uses Neutral again. Calibrated Studio/Architectural rigs, source paint colours, exposure, dimensions and take-offs are unchanged.

Five current captures use the real Fit control, a 1168 × 592 canvas and 1280 × 800 browser viewport. Logical camera, **actual render camera** and canvas dimensions match exactly. No camera, scene or store values were injected. The supplied reviewer image is included separately; it is not claimed to use this fitted camera.

| Image | Whole-canvas difference from old | House-region difference from old |
|---|---:|---:|
| Production Auto | +13.58% | +14.38% |
| Production High | +13.75% | +14.78% |
| Branch Auto | −0.12% | +0.18% |
| Branch High | −0.09% | +0.29% |

Readout uses the same pixels and mean Rec.709-weighted encoded sRGB values, **not physical luminance**. Minor pre-existing product-detail differences between old and production mean this is not a pixel-identical scene claim. Visible verdict: the former muted backdrop, saturated grass and stronger material colours are restored; the High image retains smoother edges. Objects, wall openings and the full building remain visible. No new empty/blue canvas or framing defect was observed.

Evidence: [matched camera assertions](matched-camera/report.json), [brightness readout](matched-camera/brightness.json), [old capture](matched-camera/old-auto-canvas.png), [production High](matched-camera/production-high-canvas.png), [branch Auto](matched-camera/branch-auto-canvas.png), [branch High](matched-camera/branch-high-canvas.png), [reviewer's supplied original](matched-camera/reviewer-t1-old-desktop-3d.png).

### Fresh-browser timing and orbit

Native Intel Iris Xe / ANGLE D3D11, fresh Chromium **process and profile for each run**, no network or CPU throttling. First-picture acceptance uses the reviewer's wait for the GL canvas and hidden Loading 3D, measured from navigation. Actual render and loading DOM-removal times are diagnostic only and do not replace acceptance. Orbit counts completed renders during real mouse movement for 10 seconds after a 4-second warm-up, not idle RAF callbacks.

| Route/device | Run 1 | Run 2 | Run 3 | Target result |
|---|---:|---:|---:|---|
| Production desktop, before | 29.530s | 15.198s | 15.287s | Fail <3s |
| Local compiled desktop, after | 6.433s | 6.578s | 5.397s | **Fail <3s** |
| Production phone, before | 10.840s | 9.556s | 15.077s | Fail <5s |
| Local compiled phone, after | 6.257s | 5.508s | 5.578s | **Fail <5s** |

The first production run includes an external-font/network outlier and is not discarded. Production-before versus localhost-after has a network confound: the table demonstrates local behavior, not a verified deployed speed-up. The same six-run harness must be run against the immutable preview after push.

| Diagnostic after | Desktop runs | Phone runs |
|---|---|---|
| First actual real-scene render | 3.998 / 3.393 / 2.563s | 2.550 / 2.621 / 2.991s |
| Actual Loading 3D DOM removal | 4.037 / 3.408 / 2.589s | 2.559 / 2.632 / 3.006s |
| First original-PBR full picture | 7.131 / 6.772 / 5.601s | 6.511 / 5.635 / 6.973s |

| Completed-frame orbit, 1280px | Production before | Local after |
|---|---:|---:|
| Auto | 59.88 fps, AO off | 60.00 fps, AO off |
| High | 33.61 fps | 37.17 fps |

Auto's cold trial stayed below 45fps and correctly declined AO. The separate warmed matched-camera context measured 42.3fps and also declined it. No threshold was lowered or successful AO activation claimed. All six after runs: zero console/page/HTTP errors, zero attempted writes, zero document horizontal overflow. The old reference deployment alone retains an existing exchange-rate HTTP401; it was recorded, not hidden.

Evidence: [production baseline](before/report.json), [compiled after](after/report.json). Intermediate `diagnostic` and `diagnostic-progressive` folders are investigation records, not final acceptance results.

## Implementation

- `renderPresentation.ts`: restore Neutral only for Natural. Update the corresponding presentation assertion; protected geometry/material/foundation/service estimator test files were not edited.
- `main.tsx`, `threeStageLoader.ts`, one lazy-loader import in `RoomView3D.tsx`: explicit `view=3d` starts the same lazy chunk promise alongside the app download. 2D/shop visits do not preload Three.
- `index.html`, `olb.html`, `index.css`, `public/fonts`: replace render-blocking third-party Inter CSS with the same self-hosted Inter4.1 family and `font-display:swap`; licence and official-source provenance included. No new font generation or runtime dependency.
- `ThreeStage.tsx`, `firstPictureMaterials.ts`: first Natural picture uses the actual complete scene geometry, original diffuse maps/colours/alpha, and the same camera with lighter Lambert material clones. Originals restore synchronously in `finally`; clones are disposed. Reflections and original physical shaders refine afterward. The camera and saved build are never reset. Calibrated views keep their existing startup rig.
- `firstPicture.ts`, `naturalSceneRenderer.ts`: optional AO waits until after a full original-PBR picture and bounded asset settling. Its shaders compile asynchronously; the normal pass uses actual temporary normal materials because pinned Three's compiler ignores `scene.overrideMaterial`. Renderer identity checks prevent late completions applying after unmount or quality replacement. Timers and temporary resources are cleaned up.
- A bounded 600ms gap postpones only asset-driven startup redraws so the first picture can present. Orbit/zoom redraw requests bypass that gap.

## Tests and unresolved limits

Scoped rendering tests: **24 passed in 5 files**. App/middleware typecheck and production build passed; final renderer build Vite duration **13.24s**. Root records the full integrated suite/API checks separately.

Remaining: both loading budgets fail the prescribed method. Original PBR detail is not ready at the early diffuse picture. Cold driver/shader work can still produce long frames; the optional composer's linear-output beauty shader variant is a **suspected**, not proven, remaining stall. Do not advertise instant loading or uninterrupted cold-start interaction. No further broad optimization was added in this bounded fix round.

Reproduce:

```text
node tools/sims-round2-load-graphics.mjs before https://onelivebuild.com
node tools/sims-round2-load-graphics.mjs after http://127.0.0.1:5173
node tools/sims-round2-load-graphics.mjs preview <IMMUTABLE_VERCEL_URL>
node tools/sims-round2-matched-camera.mjs http://127.0.0.1:5173
python tools/sims-round2-visual-metrics.py
```

Run load/orbit measurements without other browser, build or test workloads. `meetsLoadTarget` records the budget separately from error-free harness completion. Remote preview verification is pending at the time of this report.
