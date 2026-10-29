# World rubric — fix round 1

Scored 28 October 2026, Mauritius time, against final code candidates Walk `554fb61` and Site `2c6743a`. Scale: 0 missing, 1 works with faults/incomplete evidence, 2 good with recorded evidence, 3 demonstrated best-in-class. No scores of 3. Every line was reviewed; unchanged Stage 2 proof is labelled as retained and its tests rerun in final CI. Phone means browser emulation, not hardware.

| Area | Item | Score | Proof / limit |
|---|---|---:|---|
| Game feel | Input-to-movement delay | 2 | Five samples per view/device; desktop maximum 31.5 ms, phone 43.8 ms. Opt-in event timestamp→changed-position render submission; not photon latency. walk/fix1/walk-performance.json. |
| Game feel | Walk and run speeds | 2 | Unchanged 1.45 / 3.4 m/s; fixed-step movement/no-tunnelling tests pass in final full CI. |
| Game feel | Camera clears walls, floors and doors | 2 | Swept-sphere tests retained; new tight-corner/low-ceiling fallback tests. Actual office camera pair in walk/fix1. |
| Game feel | Stairs climb and descend | 2 | Stage 2 ascent/descent at four rotations and real ground→first→roof aperture tests retained and pass in final CI. |
| Game feel | Doors have clear reach and cannot trap | 2 | New retained-open-door occlusion/reach regressions; actual E/open/prompt/tap-close passed both views on both devices. engine-regression.json. |
| Game feel | Third-person follow and corner recovery | 2 | 2.15 m preferred boom, swept interpolation, compressed-view level aim; same-pose before/after in narrowest furnished office. Low ceiling retains collision; explicit first-person fallback if external camera cannot fit. |
| Game feel | First-person body/head hidden | 2 | Actor hidden in first view; runtime regression and both-view browser evidence. |
| Game feel | Animation follows resolved movement | 2 | Unchanged 180 ms idle/walk/run blend follows resolved metres; collision/runtime tests pass. |
| Usability | First-use controls understood in 10 seconds | 1 | Card and locked HUD now explicitly say “Esc frees the mouse”; first-time human comprehension has not been measured. |
| Usability | Phone works with one hand at 390 × 844 | 1 | Touch controls and door tests pass in 390 × 844 emulation; physical one-hand study remains unperformed. |
| Usability | Exit always visible | 2 | First Esc unlocks/stays; second Esc exits in five native browser cycles including duplicate delayed pointerlockchange events. Fixed Exit remains visible. |
| Usability | Chooser fast and remembered | 2 | Remembered selection and four decoded thumbnails pass. Final whole action→decoded frame 117.0 / 237.0 ms; initial 7,386 / 1,363 ms failures retained. Shader warm-up and async queue regressions pass. walk/fix1/walk-performance.json. |
| Usability | Site search/draw/edit/undo | 2 | Preview2c6743a real map/search/four-corner draw/report passed at both sizes; existing editing/undo behavior and geometry tests retained. Guided automation, not unassisted human study. |
| Usability | Plain-language site report | 2 | Stage 2 sourced/unavailable report evidence retained; Fix 1 practice-outline wording and credits corrected. Final report tests pass. |
| Usability | Report fits A4 and phone | 2 | Stage 2 all 12 PDF pages visually inspected; Fix 1 live/outline/credits fit390 × 844 without overflow. No repeated print-layout claim. |
| Function | Every site field tagged or unavailable | 2 | Required source labels remain; deferred validation prevents untrusted figures; unknown canary removed only after first picture. Invalid extension retains legacy plot with warning. |
| Function | Survey traverse closure shown | 2 | Unchanged decimal/quadrant-bearing and raw closure tests pass; no silent adjustment. |
| Function | Cut/fill and foundation rerun on chosen levels | 2 | Unchanged survey/what-if constrained surface and cloned-estimator fixtures pass; existing estimator files/tests remain byte-identical to base. |
| Function | Every connected level reachable | 2 | Ground→first→roof route regression retained. Invalid/missing stairs inaccessible; covering exclusion remains disclosed. |
| Function | Every door type behaves | 2 | Rectangle/arch/shared door/open doorway/window tests retained; retained-open prompt now also regressed. |
| Function | Walk never writes the design | 2 | Stage 2 tester byte-identical exit/camera proof retained; real-store keyboard isolation tests pass and Fix 1 browser logs have zero writes. |
| Performance | Paired first 3D picture unchanged | 1 | Five interleaved same-host pairs/device/branch retained; see reports for both original/canvas medians. Literal static byte equality still fails after allowed alias exception. |
| Performance | Walk JavaScript under 600 KB gzip plus one character | 2 | Controlled emitted deferred UI/runtime/animation/controls totals in bundle-audit.json; only selected <93 KB GLB after Start. No separate Walk implementation request before first picture; early adapters are counted in the failed byte gate. |
| Performance | Phone 30 / laptop 60 fps and 1% lows | 1 | Stage 2 screenshot-free 59.70 / 59.57 fps, 1% lows 39.80 / 34.70 retained as historical evidence. Strict 60 fps and physical-phone validation remain unproven; no new steady-FPS claim. |
| Performance | Map chunk size reported | 2 | Map 299,328 gzip bytes; worker 151,615; workspace and canonical hydration separately reported/deferred. bundle-audit.json. |
| Performance | Entry pause reported separately | 2 | Start→ready5.682 s desktop /3.001 s phone, excluded from input samples. Visible download/preparation progress, selected GLB only. |
| Honesty | Banner on screen and print | 2 | Required banner preserved; original print proof retained; final Site tests and preview report retain banner. |
| Honesty | Boundary uncertainty label | 2 | Offline “Practice outline; the demo has no map”; live drawn/typed-surveyor uncertainty labels remain. New real-map polygons are arbitrary tests, not verified parcels. |
| Honesty | Licence and attribution visible | 2 | All copied licences retained; all three real-map credit links fully visible at both sizes; offline credit DOM removed. Four inline PNGs are exact licensed CC0 source bytes. |
| Honesty | Current-state file matches shipped candidate | 2 | Current exact code SHAs, measured gate failures, full test counts, newest library versions/date and excluded scope recorded; no merge-ready claim. |

Lowest three by release impact: **first picture/static bytes 1; frame pacing/physical-device evidence 1; first-use comprehension 1**. Physical one-hand use also remains 1. Chooser is now 2 after the deployed whole-action pass. No inherited Lighthouse repair was attempted; exact 22 error IDs match main.

Next three: provide a baseline extension seam that resolves the early byte contract; measure steady frame pacing on physical phones after the shader fix; run first-use and one-hand checks. Commander chooses the next authorized round.

## Finish round1 candidate status

The 30 scores above remain historical Fix1 scores pending the new deployed checks. The amended numeric byte ceiling passes in controlled builds (+690 gzip Walk / +935 Site); initial timing still fails, so the performance score remains1. Site's real Undo gap was corrected with nine focused UI regressions, including traverse replacement. Strict frame windows and final browser/print proof are pending. Human comprehension and physical one-hand evidence remain unperformed; no score is raised from automation alone.
