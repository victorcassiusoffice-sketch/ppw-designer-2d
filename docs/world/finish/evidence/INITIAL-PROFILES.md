# Initial merged preview diagnostics

Eight fresh-browser diagnostic samples completed with stable before/after commit checks and no page/console/HTTP errors. Browser processes are closed. These samples include trace/Debugger/profiler overhead and never replace the five-run formal timing campaigns. Every raw trace and CPU profile remains in the experiment directories; no slow sample was excluded.

Trace output: `results/r1-merged-walk-trace-v2/profile-walk.json` plus four `trace-*.json` files. Stable heads: base52 `56d852d1f2f5d7342b9e02194964d6b998c795c7`, Walk `8632686549be6759e9e931cd0e47324c530a56a9`.

| Trace sample | HTML complete | First preparation start | Prepared | First picture |
|---|---:|---:|---:|---:|
| Base desktop | 3473.6 | 8615.0 | 9327.0 | 10153.3 |
| Walk desktop | 1319.4 | 5599.5 | 6308.3 | 6572.5 |
| Base phone | 677.6 | 3778.0 | 3975.5 | 4211.4 |
| Walk phone | 650.9 | 3134.7 | 3343.1 | 3599.2 |

Times are navigation-relative milliseconds, rounded for display. Desktop base's slow HTML and2771.2ms React passive-effect task are retained. Walk desktop's longest corresponding task is1610.4ms. Phone base/Walk longest mount tasks are1476.6/876.4ms. These include native graphics work beneath the React call; they are not pure React overhead. Nested trace-event durations must not be added together as independent time.

CPU output: `results/r1-merged-walk-desktop-cpu-v2/mount-cpu-walk-desktop-{pair,attribution}.json` and `results/r1-merged-site-phone-cpu-v2/mount-cpu-site-phone-{pair,attribution}.json`, plus four raw sample profiles. Site head remained `06245cc5dae463f20341f10aefb34e89d6325fc4`.

| CPU sample | HTML complete | Preparation start / end | First picture | getContext self | setSize self |
|---|---:|---:|---:|---:|---:|
| Base desktop | 690.9 | 3578.1 / 5187.5 | 5430.0 | 240.6 | 1681.7 |
| Walk desktop | 690.4 | 3511.3 / 4336.6 | 5409.7 | 249.0 | 256.8 |
| Base phone | 647.0 | 4458.7 / 5167.0 | 5404.1 | 1285.9 | Not in top self samples |
| Site phone | 1385.4 | 4444.7 / 5136.0 | 5401.9 | 288.4 | Not in top self samples |

Current captured source snippets prove minified `it` is `canvas.getContext(...)`, not a guessed old symbol. `setSize` writes canvas width/height and viewport. Its parent frame is the ThreeStage viewport effect (base deployed column76395), whose source already guards unchanged logical dimensions. The mount renderer effect has an empty dependency array and creates one renderer/context per ThreeStage mount. Repeated samples here do not prove repeated context creation in one visit. The large native occupancy varies by fresh browser and GPU/driver scheduling; the Site phone +23.365% formal ratio did not recur in this diagnostic pair, which had different HTML/native costs. This does not annul the formal failure or prove it was noise.

First draw still spends sampled time in Three's `onFirstUse` through `getUniforms`:111.2+56.0ms base desktop,119.8+83.5ms Walk desktop,101.3+50.1ms base phone,109.0+74.7ms Site phone for the two leading paths. The captured implementation performs shader/program diagnostics and creates uniform/attribute metadata. One stack is the ordinary draw path and one traverses WebGLShadowMap. This supports remaining surface/shadow first-use work after asynchronous compile. It does not justify suppressing graphics diagnostics or lowering rendering quality. The Walk desktop prepared→picture interval is1073.1ms although sampled draw work is much smaller; idle scheduling is also present, so the full interval must not be attributed to shader cost.

Profiler clock alignment is within3.7–5.1ms. Raw `profile.startTime` begins after navigation (around HTML delivery in these records); clipped CPU weights therefore describe the captured portion of navigation→picture and do not claim to measure the earlier network-only interval. Source snippets, stacks, timing bounds, and canvas quality/shadow attributes are retained for audit.

Round2 hypotheses, not implemented:

1. Keep the published HTML discovery experiment as its own measurement. Actual GPU creation cannot start just because ThreeStage is preloaded: current React-owned canvas is created at component mount after App is ready.
2. `WebGLRenderer.setPixelRatio` always calls `setSize`, even for the same ratio. ThreeStage calls it both at renderer initialization and again in the initial quality effect. Guarding an unchanged ratio is a small experiment that preserves DPR, antialiasing, scene content and quality. It removes redundant clears/reallocations, but the expensive initial viewport resize still needs to happen; do not promise the observed1.68s disappears.
3. Moving creation of the actual eventual canvas/context ahead of App could overlap native graphics initialization with continuing network downloads. It requires one owner/handoff of that exact canvas to ThreeStage; a new canvas cannot inherit another canvas's context. Context attributes, failure handling, disposal, StrictMode and 2D/3D route behavior must remain correct. The loading panel must paint before the blocking native call. This is a substantive architecture experiment and must fit the early-byte/request gates; no second throwaway context, cross-visit warming or graphics-quality changes are acceptable.
4. The smaller first-use shader cost is a separate follow-up only if current profiles justify it. Public `compileAsync` does not render ordinary WebGL shadow maps, and first-use metadata still occurs at draw. Warm only matching existing shader state; do not change target/color-space variants or use hidden reduced-quality draws to move the gate.

Further pinned-API review for root's proposed single resize experiment: `setDrawingBufferSize(width,height,DPR)` sets logical width/height, pixel ratio, floored physical canvas dimensions and viewport in one call, leaving CSS unchanged. This matches the final buffer state of `setPixelRatio` followed by `setSize(...,false)`. Unlike `setSize`, it does not guard XR presentation or resize internal WebGLOutput; the current source has no XR, setEffects or outputBufferType use. The viewport effect must include DPR in its dependency/changed-value checks. Quality shadow and anisotropy handling stays in its existing effect. The first scheduled rAF runs after the ordered mount effects when dimensions are valid; the existing width/height<8 guard needs explicit consideration so first-picture quality cannot briefly use default DPR. Regression evidence should compare logical/physical sizes, DPR, viewport and unchanged CSS across initial mount, same-size orbit, DPR-only change and resize. No implementation was made by the profiling agent.
