# Round 3 Walk input, frames and functional evidence

Exact source: `52fa4088e99eafaaaea33e5ad8feb0cbc617fd9e`. Every selected proof has exact preview health before and after; all five required files remain unchanged. Full-precision values below use the same zero-settle input and strict40s frame protocols as Round2. Missing observations remain UNPROVEN; failed samples are never dropped.

| Gate | Result |
| --- | --- |
| chooserUnder1Second | PASS |
| laptopInputUnder50 | PASS |
| strictFps | FAIL |
| originalBackgroundOwnership | PASS |
| desktopFunctional | PASS |
| phoneFunctional | FAIL |

## Preparation experiment and entry cost

Decision: **retain**. Retain provisionally for the completed Round3 source comparison, with attribution unresolved and a matched-delivery current/omit-preparation experiment planned for Round4. The normal total entry increases are retained, but slower resource delivery confounds the desktop comparison and existing observations do not establish the net first-visible-ready cost of compilation. The source-injected diagnostic measures a preparation await, not its additive counterfactual cost: first rendering may otherwise perform some of this work. Finish step5 has no tradeoff exemption; an attributable worsening must be reverted, and this decision does not claim no-regression compliance is proven.

Observed benefit: Current measured laptop input outcomes improve from a Round2 maximum383.4ms failure to all10 samples below50ms (maximum36.39999997615814ms). This is an observed result, not proof that compileAsync caused the improvement. The independent strict59.825fps third-person failure remains failed.

| Device | Round2 raw entry ms | Current raw entry ms | Delta ms |
| --- | --- | --- | --- |
| desktop | 2836.899999976158 | 5990.399999976158 | 3153.5 |
| phone | 2977.100000023842 | 3736.7000000476837 | 759.6000000238419 |

Round2 costs are read directly from the original d78064f input proof, not rounded display text. Start-to-ready includes actual preparation. compileAsync does not prove the cause of earlier GPU stalls, and the measured sample is not a controlled causal isolation of every intervening change.

## Every input sample

| Device | Kind | View | Round2 values ms | Current values ms | Current maximum | Under50 |
| --- | --- | --- | --- | --- | --- | --- |
| desktop | keyboard | third | 13.5, 9.200000047683716, 9.5, 8.399999976158142, 383.39999997615814 | 36.39999997615814, 16, 6.899999976158142, 17.799999952316284, 14.100000023841858 | 36.39999997615814 | 5 |
| desktop | keyboard | first | 25.700000047683716, 11, 6.299999952316284, 8.600000023841858, 11.399999976158142 | 5.5, 10.399999976158142, 11.600000023841858, 13.100000023841858, 15.899999976158142 | 15.899999976158142 | 5 |
| phone | keyboard | third | 18, 7.299999952316284, 7.399999976158142, 11.299999952316284, 10.100000023841858 | 38.799999952316284, 11.099999904632568, 13, 12.100000023841858, 12 | 38.799999952316284 | 5 |
| phone | keyboard | first | 7.299999952316284, 11.199999928474426, 339.1999999284744, 9.600000023841858, 15.700000047683716 | 3.799999952316284, 6.700000047683716, 11.5, 235.69999992847443, 12.100000023841858 | 235.69999992847443 | 4 |
| phone | nativeTouch | third | 54.200000047683716, 44.10000002384186, 44.40000009536743, 46.5, 44.10000002384186 | 59.10000002384186, 385.3000000715256, 39, 311.5, 42.199999928474426 | 385.3000000715256 | 2 |
| phone | nativeTouch | first | 38.5, 43.199999928474426, 44.89999997615814, 39.89999997615814, 117.89999997615814 | 54.60000002384186, 187.10000002384186, 38.700000047683716, 43.300000071525574, 41.60000002384186 | 187.10000002384186 | 3 |

The compact retains event-to-handler and handler-to-render arrays and exact timestamps for every sample. Phone native touch follows keyboard sampling; its50ms comparison is informational. No post-ready or view-switch delay was added. Outliers remain in diagnostic.stalls; no cause is inferred from duration alone.

## Completed-render frame windows

| Device | View | Frames | Active ms | Paused ms | FPS | 1% low | Max interval ms | Max tail ms | Gate |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| desktop | third | 2393 | 40000 | 0 | 59.825 | 35.37214443004173 | 131 | 2.600000023841858 | FAIL |
| desktop | first | 2400 | 40000 | 0 | 60 | 46.15384615384615 | 24.199999928474426 | 13.899999976158142 | PASS |
| phone | third | 2400 | 40000 | 0 | 60 | 43.81161006141584 | 25.5 | 1.100000023841858 | PASS |
| phone | first | 2400 | 40000 | 0 | 60 | 48.533872610284504 | 21.899999976158142 | 1.8000000715255737 | PASS |

All original completed intervals and tails remain in the raw frame file. Independent rAF cadence and historical HUD values remain separate; neither replaces completed-render FPS. Initial3s warm-up and first-person1s switch wait are unchanged and do not apply to input measurements.

## Original scene and functional behavior

| Device | Original pause/resume | Exact restoration | Background overall |
| --- | --- | --- | --- |
| desktop | PASS | PASS | PASS |
| phone | PASS | PASS | PASS |

| Device | Check | Result | Failure |
| --- | --- | --- | --- |
| desktop | movement-restore | PASS |  |
| desktop | doors-both-views | PASS |  |
| desktop | five-escape-cycles | PASS |  |
| phone | single-touch-movement-stop-restore | PASS |  |
| phone | single-touch-controls | PASS |  |
| phone | single-touch-doors-both-views | FAIL | Error: Door Open door attempt 1: click-not-observed; all evidence retained |
| phone | native-exit | PASS |  |

Desktop evidence retains both door views, five actual Escape cycles, and saved property/editing/rendered camera restoration. Native phone v6 retains click/hit-target/status evidence, the bounded safety-retreat rule, one-contact/key counters, and the legacy final-only run assertion separately. Current success would not erase earlier no-click failures or establish their cause.

## Sources and limitations

- [input](results/r3-walk-input-v3/walk-performance-walk.json)
- [frames](results/r3-walk-frames-v2/walk-framerate-walk.json)
- [background](results/r3-walk-background-v1/background-ownership.json)
- [desktop](results/r3-walk-functional-desktop-v2/walk-functional-walk.json)
- [phone](results/r3-walk-functional-phone-v6/walk-functional-walk.json)

- Every current failure remains; earlier v3/v4 no-click phone failures and the heavily instrumented v5 pass on unchanged old application code remain separate.
- Native touch latencies are informational; the under50ms hard input target applies to laptop.
- Chooser decoded-frame timing is a render opportunity, not a photon measurement.
- No physical-phone, first-time-human comprehension or one-hand ergonomics study was performed.
- Normal total entry is5990.399999976158ms desktop and3736.7000000476837ms phone versus2836.899999976158 and2977.100000023842 in Round2; none of these increases is discarded.
- Retained resource comparison has last-selected-response to ready-observation gaps200.10000002384186→362.2999999523163ms desktop and176.20000004768372→982ms phone; these combine decode, setup, preparation, rendering and observation.
- Injected diagnosticv2 records preparation await228.80000007152557ms desktop and362.09999990463257ms phone, with source-response interception and no normal-source timing claim. It measures setup/promise waiting/resumption, not pure GPU time or net added ready delay.
- First rendered-status observation followed the diagnostic await by34ms desktop and481.10000002384186ms phone; compilation does not establish that all cold work is prepared.
- There is no measured causal link between the load-only wait and the isolated131ms frame interval32.55seconds into the formal desktop window.
- The current phone formalv6 no-click failure remains failed. A later native-contact diagnostic pass is separate and does not replace it.
- Round4 must retain all matched-delivery comparison cases and reverse preparation if a net worsening is attributable; no hidden settling, quality reduction or threshold change is allowed.

Campaign release: {"atUtc":"2026-10-29T18:49:13.0660400Z","allFiveProcessesExited":true,"allBrowsersClosed":true,"sharedLockAbsent":true,"matchingHarnessOrPlaywrightProcesses":0}. This recorded release does not assert that a later coordinator campaign has also stopped.
