# Round 1 Walk interaction and frame evidence

Deployed head: `c8941925da4640cf02d6c4ecb864d3914993a180`. Every campaign's before/after health matched. All browsers and processes closed before root's formal load campaign began. No source or production-quality changes were made during these experiments.

Exact raw-number summary: `R1-WALK-INPUT-FRAMES-FUNCTIONAL.json` beside this note. That file retains every keyboard/touch value, both functional versions, and separate historical HUD/rAF measurements.

## Gates

| Device/view | Completed frames / 40 seconds | Strict FPS | 1% low FPS | Longest interval ms | Result |
|---|---:|---:|---:|---:|---|
| Desktop third | 2344 | 58.6 | 16.19870410601773 | 387.39999997615814 | FAIL >=60 |
| Desktop first | 2388 | 59.7 | 34.01360543528106 | 214.19999992847443 | FAIL >=60 |
| Phone third | 2341 | 58.525 | 15.916174811646737 | 292.10000002384186 | PASS >=30 |
| Phone first | 2398 | 59.95 | 44.395116584171454 | 61.800000071525574 | PASS >=30 |

All windows lasted exactly 40000 active milliseconds, with zero paused time. No interval or first ten frames were removed. Screenshots were disabled. The 1% low uses the slowest 1% of complete frame-to-frame intervals; partial armed/resumed intervals and unfinished tails remain separately recorded. Independent rAF means were 58.64097109247904, 59.69887955182073, 58.56017057512632, and 59.95317799376427 respectively. No rounding to 60 and no substitution of the historical HUD occurred.

Laptop native keyboard event-to-first-moved-render milliseconds:

- Third: `[110.89999997615814, 101.10000002384186, 5, 82.29999995231628, 11]`; median 82.29999995231628, maximum 110.89999997615814; **FAIL <50**.
- First: `[24.399999976158142, 22.699999928474426, 12.699999928474426, 7.700000047683716, 25.200000047683716]`; all five below 50.

Phone native CDP touch pointer-event-to-render milliseconds:

- Third: `[48.60000002384186, 48.200000047683716, 51, 44.700000047683716, 41.60000002384186]`.
- First: `[48.10000002384186, 40.699999928474426, 45.90000009536743, 47.799999952316284, 41.10000002384186]`.

Phone touch is separate diagnostic evidence; Finish's <50ms hard target specifies laptop. Touch event-to-handler dispatch accounts for 22.200000047683716–41.60000002384186ms; handler-to-render is 7–18.899999976158142ms. Historical phone keyboard samples, including its 293.7999999523163ms third-person stall, remain in the JSON and original report.

Chooser DOM-click-event to a decoded four-image animation-frame opportunity: desktop 116.60000002384186ms and phone 183.60000002384186ms, both below 200. Original Playwright click-call-to-visible wall times remain 189/452ms; click-call-to-decoded times remain 202/465ms. These distinct observations are not relabeled or silently discarded; the phone original wall observation fails 200ms.

## Functional result and retained failed experiment

The initial `functional-v1` phone passes movement, stopped movement after release, real door prompt/open/close in both views, native Exit, exact non-null saved-property hash and editing/rendered-camera restoration. Desktop movement/restoration and five Escape cycles pass, but door navigation times out and captures three PointerLockControls API errors. The harness repeatedly completed a drag (which invokes the real click-to-lock handler) and immediately escaped, then attempted another lock while browser cooldown was active. Its assumed heading was therefore unreliable. This evidence remains intact, not reclassified as a product pass.

The distinct `functional-lock-v2` desktop experiment uses one native pointer-lock session and records delivered `movementX` for every turn. It passes real door prompts, E/open, click/close, both views, no blocked standing position, movement/stop, exact saved-property and both camera restorations, and all five Escape cycles. It records zero page, console, HTTP errors, or attempted writes. No product code was changed between experiments. Saved property is 8821 bytes, SHA256 `19b82b63d26dc508745434d94a4e8618c1d83eaa61a82d3818d423eee3aa5d4c` before and after on both devices.

## Bounded third-person diagnostic

A distinct 15-second desktop CPU/timeline profile reproduces initial delays of 91, 73.69999992847443, and 81.30000007152557ms; later samples settle below 24ms. These profiled samples do not replace formal inputs or FPS. Trace user-timing and NavigationStart clocks agree within 0.033ms. The separate 51.709ms Performance-metrics handshake gap is not used as a clock correction.

| Diagnostic input | Delay ms | Profiler idle during delay ms | Overlapping GPU-main task ms |
|---|---:|---:|---:|
| 0 | 91 | 56.949 | 111.677 |
| 1 | 73.69999992847443 | 62.289 | 113.82 |
| 4 | 81.30000007152557 | 73.80300012207032 | 106.839 |

The relevant Walk tick functions take about 6–9ms. No renderer-main task exceeds 50ms during the armed 15-second window; the 167.766ms task immediately before it is retained in raw trace and attribution. Long GPU-main work and delayed rAF delivery dominate these early input stalls. The available GPU trace does not establish whether each task is driver shader compilation or other GPU work, so shader warm-up is a hypothesis, not a demonstrated cause.

There are also **82 ThreeStage designer requestRender callbacks**, from navigation-relative 13316.962 through 15892.703ms, totaling 822.831ms of main-thread duration. The sampled stack reaches the natural-depth AO composer. Walk's private stage has its own `beginWalk()` ownership; the original designer is still mounted and independently performs its bounded AO probe beneath the overlay. This is a concrete overlapping-work hypothesis for Round 2: acquire the existing original-stage `beginWalk()` handle when the deferred launcher opens and release exactly that handle when its overlay closes/unmounts. No scene, camera, saved property, rendering quality, or first-picture closure implementation needs to change. Confirm causally with a new trace and the unchanged restoration harness.

Lifecycle checks for that experiment: no pause before click; one acquisition covering chooser and visit; no extra acquisition on Start; release once on close/unmount; new acquisition on reopen; null stage handled; cleanup uses the acquired handle if stageRef later changes. If an error screen still covers Design, retain the pause until it closes. Keep every failed formal sample and all original timing definitions.

## Proof files

All paths below are under `work/world-finish/round1/results/`:

- `r1-candidate-walk-input-v2/walk-performance-walk.json`
- `r1-candidate-walk-frames-v2/walk-framerate-walk.json`
- `r1-candidate-walk-functional-v1/walk-functional-walk.json` and its screenshots (retained failure)
- `r1-candidate-walk-functional-lock-v2/walk-functional-walk.json` and both door screenshots
- `r1-candidate-walk-movement-diagnostic-v1/movement-profile-summary.json`
- `r1-candidate-walk-movement-diagnostic-v1/movement-cpu-profile.json`
- `r1-candidate-walk-movement-diagnostic-v1/movement-trace.json`
- `r1-candidate-walk-movement-diagnostic-v1/movement-attribution.json`

Harnesses are in `harness/`: `walk-performance.mjs`, `walk-framerate.mjs`, `walk-functional.mjs`, `walk-functional-lock.mjs`, and `walk-movement-profile.mjs`. The diagnostic document-level key-capture listener remained empty because the existing workspace capture handler stops propagation; runtime event timestamps and trace EventDispatch records supply the input evidence instead. This does not affect formal samples.
