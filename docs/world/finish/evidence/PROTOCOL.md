# Finish round1 harness preparation

Prepared without running a build or browser. Formal performance work is serialized by the root agent. These scripts also share a scratch lock at `work/world-finish/performance-active.json`; inspect its recorded PID before clearing a stale lock.

## Baseline and dependencies

- Exact source base: `56d852d1f2f5d7342b9e02194964d6b998c795c7`, extracted by the root to `work/world-finish/base52` with the existing dependency junction. Do not reuse the earlier3eefbf7 extraction.
- Deployed base: `https://ppw-designer-2d-git-gpt-olb-fix-round-3-2026-10-27-victor-ppw.vercel.app`; the load harness requires exact base health before starting and checks every measured branch again after finishing.
- Both previews and base use the OLB shell. Custom-domain measurements remain informational. Each fresh browser uses native D3D11, no CPU/network throttling, pinned HTTPS hosts216.198.79.3, desktop1280×800 or phone390×844 touch emulation.
- Playwright resolves from the installed repository/tool package, falling back to existing `C:/Users/Victor/Documents/PPW-Code/ppw-tutorial-studio/package.json`. Vite resolves from Walk's existing dependencies. No installation or new environment variable is introduced.
- Optional `--config=absolute-config.json` may override `repos` and `targets`; retain that config with evidence. Existing build variables are set identically to preview/base56d852d within the controlled process.

## Commands (run only when root grants the performance slot)

Use a unique label for every experiment. Intermediate data is written after every row. Never rerun a failed campaign using the same label or delete a slow/failing row.

```powershell
node work/world-finish/round1/build-audit.mjs base,walk,site --label=merged-build
node work/world-finish/round1/harness/t14-load.mjs all 5 --label=merged-pairs
node work/world-finish/round1/summarize.mjs --label=merged-pairs --build-label=merged-build
node work/world-finish/round1/network-audit.mjs --label=merged-pairs --build-label=merged-build
node work/world-finish/round1/harness/profile-first-picture.mjs walk --label=merged-walk-trace
node work/world-finish/round1/harness/profile-mount-pair.mjs walk desktop --label=merged-walk-cpu
node work/world-finish/round1/harness/walk-performance.mjs walk --label=merged-walk-input
node work/world-finish/round1/harness/walk-framerate.mjs walk 40000 --label=merged-walk-frames
node work/world-finish/round1/harness/walk-functional.mjs walk --label=merged-walk-functional
```

`t14-load all` runs five cycles of base→Walk→Site→custom for each device,40 fresh browser processes. `walk` or `site` instead of `all` runs30 fresh processes for that branch. Reports retain both navigation→observed legacy `loading-3d` disappearance and the canvas's completed render-submission timestamp. Absolute and paired gates are separately evaluated for both; conservative overall timing pass requires all four plus loading visible within1000ms in every candidate run.

Version2 correction (initial merged raw reports stay unchanged): #52 HTML startup itself has `data-testid="loading-3d"`. Historical `reactLoadingSeen` therefore means the legacy selector, not exclusively React. Keep it unchanged; newly added `actualReactLoadingSeen`/`actualReactLoadingHidden` explicitly exclude `#designer-startup`. HTML loading remains independently observed. This is a field-label correction, not a timing-gate change. Version2 also captures Paint Timing/FCP. Trace/CPU reports now retain the complete canvas diagnostics dataset, including firstPrepareStartMs, firstPreparedMs and firstPictureMs, and before/after health commits.

Network audit counts HTTP(S) request starts, including redirects and unfinished responses. Embedded SVG data URLs remain separate, not API traffic. New paths are shown per pair and across the entire campaign. Static audit reads final Vite output after preload transformations, maps all early files/raw/gzip/hash values, and reports the1024-byte ceiling without automatically treating implementation growth as an alias or seam.

## Frame measurement

The new deferred Walk hook accepts `world-walk-measure-frames` with `{durationMs:40000}` on its canvas and publishes one `world-walk-frame-result` event plus `data-walk-frame-result`. It records all completed active render intervals, first-window partial interval, pause transitions and unfinished active tails. The fixed window does not extend to collect better frames. A1%low uses completed frame-to-frame intervals; first/resumed partial intervals and unrendered tails are listed separately. FPS uses all completed frames over full active wall time, including tails. Disposal/record limits are explicit incomplete results.

The frame harness records both views/devices, alternates native W/S each second and holds Shift for the second half, with no screenshot captures. Independent browser rAF cadence and historical HUD summaries are included separately. The old HUD excludes>=250ms intervals and first10frames, so it is not used as the authoritative new gate. Strict60fps remains strict; nominal60Hz/59.94Hz display pacing is not silently rounded into a pass.

## Initial-picture hypotheses beyond52

1. Critical asset discovery still waits for main→route/App and ThreeStage import execution. Route-gated HTML preload hints using final emitted App/ThreeStage names can move existing downloads earlier without new feature paths or visual changes. Report HTML cost separately; verify requests, scheduling and CSS waterfall rather than assuming benefit.
2. Earlier profiles identify variable synchronous WebGL context creation inside the React mount effect. #52 eliminates the hidden Plan renderer, so reprofile before considering another context change. Do not alter antialiasing, pixel ratio or power settings merely to pass.
3. #52 warms first-picture material shaders asynchronously. Inspect remaining first-draw shader work for inherited lines/sprites/shadow variants or state mismatches; warm only matching existing variants. Keep the fully shadowed same scene, camera and renderer settings.
4. App data/geometry construction may compete with renderer initialization. Current traces must identify repeated or dispensable work before changing it. Avoid inferring source cost from a slow remote delivery sample or summing nested trace durations.

Raw profiles remain scratch; use compact current-stack attribution. The prior helper's hard-coded minified function positions were replaced so it cannot misattribute a new build to old offsets.

## Walk functional preview follow-up

Input harness version2 retains five keyboard samples per view/device and additionally takes five native CDP touch-pad starts per view on phone. Pointer event timestamp and runtime handler timestamp are retained independently; touch event→first moved render is never mislabeled as keyboard latency. Before/after health checks detect mid-campaign deployments.

`walk-functional.mjs` uses a real preview, native controls and existing saved design only. It asserts a non-null persisted property with rooms and non-null editing/rendered camera JSON before comparing exact hash/JSON after exits. Movement/release, protected editing keys, actual door open/retained close prompt/close in both views, five desktop native pointer-lock Escape cycles, and phone tap exit are separate checks. Fix1's door regression used a DEV pose hook, which is absent from production; this new harness instead approaches the same documented safe entrance using observed movement heading and native input. Navigation failures stay explicit and must not be mistaken for proven door-code failures. All evidence stays scratch until root chooses the compact delivery set.
