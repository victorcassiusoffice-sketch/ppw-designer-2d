# Walk mode — Stage 2 candidate

Base: `3eefbf7646f2b5c76e5297f7836e6e0336e8f1a2`, fetched from origin/main before the branch started. Branch: `gpt/olb-walk-mode-2026-10-27`. [PR #53](https://github.com/victorcassiusoffice-sketch/ppw-designer-2d/pull/53). [Normal branch preview](https://ppw-designer-2d-git-gpt-olb-walk-mode-2026-10-27-victor-ppw.vercel.app/demo?view=3d&pitch=1). Measured runtime commit: `4e8f5c5f3e246416f16464c8bbfd003f2561f687`; later evidence commits do not change application code. No merge or manual deployment.

## What works

Walk opens from a completed WebGL 3D view, including `/demo`. A deferred chooser offers four remembered CC0 characters. A private full-building snapshot and canvas provide first/third person, keyboard and one-thumb phone movement, run, drag/pointer-lock look, manual E/tap doors, safe collision and connected stairs. The original editing canvas and camera remain untouched. Exit restores focus and the previous view. No new API calls are added.

Walls, floors, shaped door apertures, windows, furniture envelopes, stair treads and handrails have runtime collision. Mirrored shared doors use one hinge and moving collider. A door cannot close through the player. First-person hides the avatar; idle/walk/run blend from resolved movement. Browser blur clears input; context failure/exit disposes the visit.

## Limits and deliberate choices

- The furnished demo has no exterior front door. Its fallback now chooses free standing space and faces an unobstructed route, tested against the actual demo data. Designs with a usable ground entrance prefer it.
- Roof coverings are hidden, explicitly stated in the chooser, so connected roof terraces and their slab apertures remain accessible. Missing/invalid stairs do not create a teleport route.
- Characters have Kenney's stylized proportions. The requested Quaternius licence downloads returned quota errors; no unverified archive was shipped. See `../characters/AUDIT.md`.
- Third-person camera must pull close in small furnished rooms. It hides the actor when extremely close; further camera/character polish remains on the rubric.
- Furniture uses coarse solid envelopes; sitting, jumping, swimming, vehicles and sound are outside this round. Doors are visit state only.

## Validation

Latest CI passed **400 files / 4,329 tests**, plus root/API/middleware TypeScript. Production build passed. New Walk tests: 31. Existing tests and estimate calculations remain byte-for-byte unchanged. Typecheck, unit tests, secret scan and normal Vercel preview pass; Lighthouse fails the same 22 assertions already present in merged PR51. The all-green CI gate is **unmet**; [comparison proof](evidence/lighthouse-inherited.txt) and [machine evidence](evidence/lighthouse-inherited.json) retain exact runs, thresholds and values. Neither workflow nor thresholds were weakened.

New tests cover fixed-step wall sliding and tunnelling, four stair rotations, a full ground→first→roof route, furniture containment, actual-demo spawn, rectangular/arched/paired doors, blocked closing, window versus doorway, camera pull-in including shallow angles, focus/keyboard ownership, and a selected-opening Delete/Backspace read-only regression. Asset checks rendered all four characters and exercised idle/walk/run clips.

Local browser smoke recorded movement, first-person body hiding, zero page errors and exact saved-design/editing-camera preservation on exit. The initial poor fallback spawn was found by that smoke and fixed; its earlier evidence is not represented as a passing final state.

## Measured preview results — 28 October 2026 Mauritius time

Copied PR51 t14 loop, fresh Chromium process/profile for each navigation, fresh browser caches (native GPU-driver caches were not controlled), native Intel Iris Xe/D3D11, no CPU or network throttle. Desktop 1280 × 800; phone 390 × 844 touch emulation on the same laptop, not a physical phone. Production and preview starts are separated by less than 60 seconds in every pair; all results are retained. Preview hosts use the original harness DNS pin to 216.198.79.3. Different host/CDN paths can contribute; these measurements do not isolate a code-only cause. Primary times use the original loading-hidden wait; independent in-page canvas marks are also retained.

| Viewport | Pair | Production s | Preview s | Delta ms | Start gap s |
|---|---:|---:|---:|---:|---:|
| desktop | 1 | 6.660 | 9.599 | +2939 | 16.8 |
| desktop | 2 | 4.447 | 6.052 | +1605 | 15.7 |
| desktop | 3 | 5.405 | 5.691 | +286 | 15.9 |
| desktop | 4 | 5.206 | 6.016 | +810 | 9.4 |
| desktop | 5 | 4.589 | 5.827 | +1238 | 16.8 |
| phone | 1 | 4.339 | 5.625 | +1286 | 9.4 |
| phone | 2 | 4.873 | 4.706 | -167 | 8.2 |
| phone | 3 | 4.111 | 4.992 | +881 | 8.2 |
| phone | 4 | 5.919 | 4.909 | -1010 | 9.2 |
| phone | 5 | 5.311 | 5.576 | +265 | 9.1 |

8/10 preview pairs are slower by the primary harness measure; 10/10 are slower by the independent canvas mark. The no-slower-pair gate is **FAILED**. All navigation/JavaScript/HTTP error counts in these paired runs were zero. Raw observations and time origins: [t14 JSON](evidence/t14-load-timed-prod_walk-desktop_phone.json); [summary](evidence/walk-paired-summary.json).

Median first picture: laptop 5.21 s production / 6.02 s preview; phone 4.87 / 4.99 s. The laptop <3 s gate fails; the phone <5 s gate does not pass every run.

| Movement measurement | Laptop 1280 × 800 | Phone viewport 390 × 844 |
|---|---:|---:|
| Screenshot-free final-window mean fps | 59.70 | 59.57 |
| Screenshot-free 1% low fps | 39.80 | 34.70 |
| Earlier sample with screenshot captures, mean fps | 58.71 | 56.04 |
| Earlier sample with screenshot captures, 1% low | 19.31 | 8.45 |
| Cold chooser, original action-to-visible measurement | 8.958 s | 1.426 s |
| Start walk → actor ready, separate entry pause | 3.835 s | 2.805 s |

The clean run alternates forward/back movement for 40 seconds, with Shift during the last 20, without capturing screenshots. The final runtime window uses at most 1,800 recent active frame intervals; 1% low = 1,000 / mean of the slowest 1% intervals in milliseconds. It excludes the initial loading pause. The original screenshot-instrumented results are preserved because captures can affect frame pacing. These are one sample per viewport, not thermal/battery/physical-device certification. See [clean frame data](evidence/walk-framerate-clean.json), [original measurements/network trace](evidence/walk-performance.json) and the exact scripts in evidence/harness. The strict 60 fps laptop target is not asserted passed; the 30 fps emulated-phone average passes, with low-frame stalls still visible.

The chooser result includes Playwright actionability wait plus deferred UI download, so it is not a pure event-handler latency. The under-one-second target is nevertheless unmet in this cold-open run. Deferred chooser JS/CSS downloads took roughly 0.81 s desktop / 0.48 s phone; loading the walk engine before selection and first-scene contention remain follow-up opportunities. No asset prefetch was added before opening Walk to hide this cost.

Four preview screenshots per viewport are retained: chooser, movement, run and first person (eight JPEG files, each visually inspected). Earlier six PNGs plus browser-checks.json verify actual pointer lock/Escape, delayed-load exit, remembered selection, touch move/release/look, keyboard door opening and tap closing. A separate [restoration proof](evidence/restore-proof.json) explicitly asserts non-null saved property (8,821 bytes / five rooms) and records identical SHA-256 hashes plus actual editing/rendered camera JSON before and after keyboard/touch movement, view switching and exit on both viewports. The preview measurements fetched exactly one character GLB after selection; no Walk/animation/control/character resource appeared before opening Walk. No page errors or attempted writes were observed.

## Bundle and loading boundary

Final local production assets: WalkMode **79,783 raw / 27,410 gzip bytes**, animation **50,981 / 14,768**, controls **2,132 / 764**; total exclusively deferred JavaScript **132,896 / 42,942 bytes**, well below 600 KB gzip. CSS **4,939 / 1,562**. Chosen character <93 KB, versus 1.5 MB allowance. Existing Draco WASM/wrapper loads only when needed. Local hashes and static import closure are in [bundle-sizes.json](evidence/bundle-sizes.json); hosted chunk filenames differ with build stamps, while observed network deferral agrees.

The early Three vendor has identical implementation modules to the baseline; five cross-chunk export aliases add **45 raw / 12 gzip bytes**. Button/modal ownership/renderer handoff adapters also change existing early modules. No byte-identical or literal-zero-new-code claim is made. Walk engine, BVH, animation/control implementations and assets remain deferred; [module audit](bundle-audit.json) proves the boundary.

## Licences and unchanged systems

Full source/date/text copies are in `../LICENCES.md`: existing Three MIT and Draco Apache 2.0, three-mesh-bvh MIT, Kenney CC0. Character archive SHA-256: `9e1d48e6d7b8479ebbe84df71eb5bd8e1b3f0da546dea641890dccc8a02d0999`. Chosen GLB is 91,804–92,780 bytes including embedded texture and three clips; only one is fetched per visit. Existing decoder files are retained.

No quantity/estimate calculation, saved schema, API route, key, account, environment variable or production setting is added by Walk. Existing tests remain byte-for-byte. Small editor keyboard guards prevent background mutation while the modal is active. Existing demo-safety and meeting-URL contract tests pass; Walk adds no meeting links, prices or contact details. The runtime browser trace records no attempted writes.
