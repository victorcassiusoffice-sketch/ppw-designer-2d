# Phase E · graphics and rendering evidence

Task date: 2026-10-22; continuation: 2026-10-24. Local preview only. No production deployment or paid asset generation was performed by this graphics work.

**Status: implemented and compiled-browser checked; performance acceptance remains partial.** All eight scenes preserve geometry and camera bookmarks. Emulated-phone throughput exceeds 30 FPS, but the strict 60 FPS desktop threshold and complete cold-navigation-under-3-seconds target are not met across all scenes.

## Implemented

- View settings now expose Auto / Low / Medium / High. Auto conservatively chooses Medium, or Low for a reported device with at most two logical cores or 2 GB memory. CPU core count is not treated as a reliable GPU benchmark.
- Ambient occlusion runs only for desktop High in Natural light. Phones use existing contact shadows and the direct renderer; phone sun shadows are 1024 px, desktop Medium/High 2048 px. Low uses 1024 px. Pixel density is bounded at 1 / 1.5 / 2, texture filtering at 2 / 4 / 8 with the GPU maximum respected.
- Natural light uses ACES filmic tone mapping. Colour check retains the existing calibrated no-tone-mapping, exposure-one light rig. Saved albedo, physical quantities, texture metre repeats and product envelopes are unchanged.
- The existing generated RoomEnvironment PMREM remains the reflection source. It is a procedural environment, **not a photographic HDRI**. Existing Mauritius sun-by-hour positioning and product PBR maps remain in use.
- Orbit no longer calls WebGLRenderer.setSize for an unchanged viewport. That method rewrites canvas dimensions; avoiding it prevents needless drawing-buffer reallocation while moving the camera.
- Attached children and their lamp/glow previews follow the parent's temporary transform, including cancellation. The catalogue placement ghost uses an isolated measured body (or existing model when loaded), with transparent valid/invalid feedback; its base colour and emissive both update when validity changes. It is excluded from saved solids, estimates and object selection raycasts. Loaded-body materials are cloned, so ghost tint does not change the supplier model.
- Price-free `/demo` and `?pitch=1` presentations skip unnecessary currency-rate boot requests. The normal priced Designer/shop still use the existing FX service and formulas; this is not an FX-provider repair.

## Evidence

- `before-graphics/report.json`: immutable compiled-main baseline at `fcefc73`, eight scene/device cases, native Intel Iris Xe / D3D11. `software-default-probe.json` separately preserves the initial Chromium default that silently selected SwiftShader; those software figures are not used as hardware results.
- `after-graphics/report.json`: final compiled working-tree run on 24 October, after the other agents' browsers, full suite and build stopped. Eight cases: zero console/page errors, failed HTTP responses, attempted writes and horizontal overflow. Each case makes one existing local `GET /api/products`; this is **not** a zero-total-API-request claim. There were no FX-provider requests or new paid/API integrations.
- `after-graphics/concurrent-load-run.json`: the preceding run is retained because other browser/full-suite processes overlapped it. Its phone kitchen/bathroom dips are not presented as isolated graphics measurements. This run was not silently discarded or substituted into the final table.
- `quality-controls/report.json`: compiled 5175 rerun passed both widths, all four choices, no camera or saved-property change, same WebGL canvas retained, expected AO/shadow sizes, Colour check preserved, no horizontal overflow, zero console/page errors and zero attempted writes. Each context makes the existing catalogue GET.
- `graphics-comparison.html`: interactive device filter and full before/after screenshots, generated from actual captures rather than illustrations.
- `graphics-comparison-desktop.png` and `graphics-comparison-phone.png`: sheets generated from those actual screenshots.
- `graphics-comparison.json`: frame/paint/bundle comparison; **all eight logical and render-camera bookmarks match** and all eight saved geometries remain unchanged.

The captured tree was based on WIP commit `ad39c5fd7e49c588814b2304c8f23eca68f5307f` with further local changes. The after report records `sourceWorkingTreeDirty: true` and compiled `dist/index.html` SHA-256 `f817232268b349b3abf72348189eb4b9a3e96d1d997658f286cf78a08db84328`. This evidence describes that compiled working tree; the root release handoff records its eventual final commit/PR.

## Measurement meaning and current limits

Frames are counted from the existing `data-shading` update immediately after a ThreeStage render call during continuous real pointer orbit. Idle requestAnimationFrame callbacks are not FPS. These are submitted app renders, not a GPU-timer or display-present trace. Phone uses 390 px with 4× CPU throttling, but retains the laptop GPU; a physical iPhone/Android claim would be unsupported.

The four fixtures are furnished room, kitchen/dining, bathroom and outside. They use existing main-branch merchant identities and envelopes, not PR49-only assets. Camera state is recorded for each screenshot and compared with the after run. The screenshot is taken before the measured orbit; the orbit must not change saved geometry.

The harness records **both** navigation-to-first-3D and 3D-button-activation-to-first-frame. The ordinary `/designer` route initially opens Plan; its `view=3d` URL alone does not activate 3D. A fast button activation does not prove a sub-three-second cold direct-demo load.

These figures compare the **default rendering policies**: baseline Natural runs AO on desktop and phone; new Auto chooses Medium with direct rendering on both. The improvement includes that policy change as well as avoiding drawing-buffer resizing. It is not a claim that desktop High/AO achieves these frame rates; High was interaction-tested, not separately benchmarked.

| Scene | Device | Before FPS | After FPS | After p95 frame, ms | 3D activation, s | Cold navigation → 3D, s |
|---|---|---:|---:|---:|---:|---:|
| Furnished room | Desktop 1280 | 34.1 | 56.7 | 18.4 | 1.38 | 10.51 |
| Furnished room | Phone 390, CPU ×4 | 46.5 | 55.2 | 21.0 | 2.80 | 8.46 |
| Kitchen / dining | Desktop 1280 | 34.8 | 59.2 | 18.2 | 1.16 | 4.02 |
| Kitchen / dining | Phone 390, CPU ×4 | 35.6 | 59.3 | 19.6 | 2.41 | 6.82 |
| Bathroom | Desktop 1280 | 36.4 | 58.4 | 18.4 | 0.44 | 2.14 |
| Bathroom | Phone 390, CPU ×4 | 34.1 | 58.7 | 21.4 | 2.69 | 7.43 |
| Outside | Desktop 1280 | 32.3 | 59.9 | 18.2 | 0.46 | 3.01 |
| Outside | Phone 390, CPU ×4 | 31.4 | 56.5 | 21.6 | 1.79 | 7.35 |

- Strict desktop ≥60 FPS: **0/4 met**; 59.9 is not rounded up into a pass. Phone ≥30 FPS in this throttled laptop-GPU test: **4/4 met**. Physical-device validation remains outstanding.
- 3D activation under 3 s: **8/8 met**. Entire cold navigation under 3 s: **1/8 met**. Application boot remains a separate optimisation gap.
- Baseline vendor-three: **191,295 gzip bytes**. Final: **191,291 gzip bytes**, change **−4 bytes**, below the +150 KB ceiling. The production build still warns about existing chunks larger than 500 KB; no new dependency was added.

## Visual review

The paired images show dimensionally stable rooms, cutaway wall caps, doors/windows, furniture, garden context and directional shadows. ACES produces a softer/brighter appearance preview than the baseline; Colour check retains its calibrated rig. Desktop High adds the optional AO depth treatment. Surface detail and softened product forms are visible, but the furnished room and bathroom still contain procedural representations. Existing measured toilets/bidets and sofa are not manufacturer CAD or photographic models. This iteration cannot honestly claim exact Sims/reference-image realism. There is no photographic HDRI or newly generated merchant asset in this phase.

The outside phone bookmark shows the room and lawn but partially crops the water tank/plot at the right edge. It records the current room-centred initial fit; this is a known framing limitation, not a completed whole-site framing fix. Phone View settings use an internal scroll region; some lower controls require scrolling, while the close control stays available.

The baseline's only console error is the external `api.exchangerate.host` 401. Price-free after checks confirm the request is absent rather than suppressing an error message. Priced routes remain dependent on that existing external service and may still report the 401; no priced-route/provider repair is claimed.

## Focused test coverage

- `src/designer/__tests__/renderQuality.test.ts`: conservative Auto, phone AO restriction, pixel/shadow bounds and invalid preference recovery.
- `src/components/three/__tests__/renderPresentation.test.ts`: ACES Natural versus calibrated Colour check, no geometry/albedo changes.
- `src/components/three/__tests__/naturalSceneRenderer.test.ts`: bounded buffers and restoration of visibility/materials after optional AO.
- `src/components/three/__tests__/furnitureRealism.test.ts`: physical PBR textures, filtering without metre-repeat/material/geometry changes.
- `src/components/three/__tests__/attachedItemPreview.test.ts`: nested attachments, corrupt-cycle handling and reversible transforms.
- `src/store/__tests__/currencyBootstrap.test.ts`: no irrelevant FX request on price-free routes, normal shop/Designer refresh preserved.

## Commands and results

Run from `C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer`:

```text
npx vitest run src/store/__tests__/currencyBootstrap.test.ts src/designer/__tests__/renderQuality.test.ts src/components/three/__tests__/renderPresentation.test.ts src/components/three/__tests__/furnitureRealism.test.ts src/components/three/__tests__/naturalSceneRenderer.test.ts src/components/three/__tests__/attachedItemPreview.test.ts
  PASS: 6 files, 35 tests
npx eslint src/components/three/ThreeStage.tsx
  PASS after the final private-ghost colour fix
npm run build
  PASS: application + middleware TypeScript, Vite; build 9.88 s
node tools/sims-parity-graphics-2026-10-22.mjs after http://127.0.0.1:5175
  PASS: all 8 captures completed; acceptance gaps are listed above
node tools/sims-quality-controls-2026-10-22.mjs http://127.0.0.1:5175
  PASS: desktop + phone; 4 quality choices and Colour check each
node tools/sims-graphics-comparison-2026-10-22.mjs
  PASS: comparison JSON, interactive HTML, 2 complete PNG sheets
```

Shared integrated suite in `test-results/sims-parity-final-tests.log`: **384 files / 4,239 tests passed**, 148.70 s, 24 October 15:10 Mauritius time. That suite preceded the final one-line ghost tint correction; subsequent scoped lint, production build and compiled browser checks passed. The root owns the remaining placement/rotation screenshots and release decision.

Build/capture command outputs are preserved in `test-results/sims-parity-graphics-final-build.log`, `test-results/sims-parity-graphics-final-capture.log` and `test-results/sims-parity-quality-controls-final.log`. Screenshot/contact-sheet evidence is price-free. This phase is **not** signed off as meeting every performance/realism target.
