# World Finish — Round 3 evidence

Base: `56d852d1f2f5d7342b9e02194964d6b998c795c7`. Walk: `52fa4088e99eafaaaea33e5ad8feb0cbc617fd9e`. Site: `7a73b25a2a32556d9d5cf5381d72e7c7bf611447`.

This report lists measured outcomes, including failures, rather than granting merge approval. Diagnostics and older-source attempts keep their original commit/protocol labels. The common closure documents own the final per-item three-round dispositions; this evidence package does not turn OPEN limitations into passing scores.

## Current gates

| Gate | Result | Evidence / limit |
| --- | --- | --- |
| Exact-head formal health | PASS | All forty loads and before/after health retained. |
| Absolute laptop first picture | FAIL | walk: wall 3536 / canvas 3398.399999976158 ms; site: wall 3418 / canvas 3282.7999999523163 ms |
| Absolute phone first picture | PASS | walk: wall 3266 / canvas 3124.899999976158 ms; site: wall 3050 / canvas 2931.899999976158 ms |
| Relative median <=110% of base | PASS | Gate compares medians. Every individually slower pair also remains. |
| Candidate FCP within 1 s prerequisite | FAIL | 17/20; this does not identify the loader. |
| Loading panel paint within 1 s | FAIL | Current-head loader-specific paint proof not supplied; FCP alone cannot make this PASS. |
| Early28-file closure / gzip ceiling <=1024 | PASS | walk: 28files, +428; site: 28files, +1014; semantic lazy-seam attribution is separate. |
| Early semantic lazy-seam restriction | PASS | Current-head source classifications and deferred implementation checks in semantic-gate-final.json. |
| No new pre-picture requests | PASS | Full network rows and feature starts retained. |
| Walk: chooserUnder1Second | PASS | See compact review and all original samples; no failed sample removed. |
| Walk: laptopInputUnder50 | PASS | See compact review and all original samples; no failed sample removed. |
| Walk: strictFps | FAIL | See compact review and all original samples; no failed sample removed. |
| Walk: originalBackgroundOwnership | PASS | See compact review and all original samples; no failed sample removed. |
| Walk: desktopFunctional | PASS | See compact review and all original samples; no failed sample removed. |
| Walk: phoneFunctional | FAIL | See compact review and all original samples; no failed sample removed. |
| Site G/E seven cases automated / visual | PASS / FAIL | Two device sizes; numerical success cannot override failed visual evidence; production-negative guard is a labelled healthcheck simulation. |
| Site G/E seven cases combined | FAIL | Every UI screenshot and generated PDF page is explicitly inspected. |
| Site concave plan / held hydration | PASS / visual FAIL | Four current-head native/pending-plan observations and completed image inspection. |
| Actual A4 automated / visual | PASS / PASS | 8 rendered pages inspected; failed attempts remain. |
| Static rules | PASS | Protected source/tests/settings/dependencies and ancestry. |
| Visible rules | PASS | All eight screen observations retained. |
| Final normal-source automated theme contrast | PASS | Four exact-head tests per branch; no style injection; all raw readings/failures retained. |
| Final theme screenshot review | PASS | Every extracted final PNG/JPG is explicitly covered; claimed byte-identical representatives are SHA-verified. |
| Final theme automated AND visual gate | PASS | A passing automated sample cannot override a failed visual review. |

## Every formal first-picture pair

Five fresh pairs per branch/device; forty unique recorded loads. The relative gate compares medians, not every individual pair. All slow and failed runs remain in [raw forty loads](raw40loads.json.gz). Wall observation and browser canvas mark are separate. The custom-host observations are an operational reference, not the same-host baseline.

| Branch | Device | Base wall median | Preview wall median | Base canvas median | Preview canvas median | Wall ratio | Canvas ratio |
| --- | --- | --- | --- | --- | --- | --- | --- |
| walk | desktop | 3870 | 3536 | 3831.8000000715256 | 3398.399999976158 | 0.9136950904392764 | 0.8868938879672015 |
| walk | phone | 3433 | 3266 | 3295.600000023842 | 3124.899999976158 | 0.9513545004369356 | 0.9482036654792909 |
| site | desktop | 3870 | 3418 | 3831.8000000715256 | 3282.7999999523163 | 0.883204134366925 | 0.8567252987867421 |
| site | phone | 3433 | 3050 | 3295.600000023842 | 2931.899999976158 | 0.8884357704631518 | 0.8896407330850065 |

### walk / desktop

| Run | Base wall ms | Preview wall ms | Custom wall ms | Base canvas ms | Preview canvas ms | Custom canvas ms | Loader DOM ms | Preview FCP ms | Failures |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 8033 | 6126 | 8350 | 8002.399999976158 | 5600.399999976158 | 8271.600000023842 | 932.7000000476837 | 1132 | none |
| 2 | 3870 | 3318 | 4033 | 3831.8000000715256 | 3178.6999999284744 | 3995.399999976158 | 680.3999999761581 | 748 | none |
| 3 | 4143 | 4895 | 4844 | 4019.600000023842 | 4756.799999952316 | 3831.6999999284744 | 691.1999999284744 | 772 | none |
| 4 | 3801 | 3536 | 4088 | 3668.6999999284744 | 3398.399999976158 | 4014.399999976158 | 637.3999999761581 | 704 | none |
| 5 | 3550 | 3448 | 3962 | 3410.600000023842 | 3310.1999999284744 | 3934.3000000715256 | 647.3999999761581 | 708 | none |

### walk / phone

| Run | Base wall ms | Preview wall ms | Custom wall ms | Base canvas ms | Preview canvas ms | Custom canvas ms | Loader DOM ms | Preview FCP ms | Failures |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 5833 | 3380 | 5351 | 5698 | 3245.6999999284744 | 5294.800000071526 | 1053.6999999284744 | 1116 | none |
| 2 | 3433 | 3266 | 4172 | 3295.600000023842 | 3124.899999976158 | 4099.899999976158 | 683.5 | 752 | none |
| 3 | 3343 | 3665 | 4135 | 3210.399999976158 | 3643.399999976158 | 4083 | 685.2999999523163 | 748 | none |
| 4 | 3463 | 3153 | 4848 | 3332.5 | 3010.2000000476837 | 3948.2999999523163 | 766.6000000238419 | 844 | none |
| 5 | 3403 | 2879 | 4399 | 3268.2999999523163 | 2756 | 4342 | 641.6999999284744 | 712 | none |

### site / desktop

| Run | Base wall ms | Preview wall ms | Custom wall ms | Base canvas ms | Preview canvas ms | Custom canvas ms | Loader DOM ms | Preview FCP ms | Failures |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 8033 | 8122 | 8350 | 8002.399999976158 | 7595.700000047684 | 8271.600000023842 | 1828.2000000476837 | 1928 | none |
| 2 | 3870 | 3149 | 4033 | 3831.8000000715256 | 3020.100000023842 | 3995.399999976158 | 672.1000000238419 | 732 | none |
| 3 | 4143 | 3418 | 4844 | 4019.600000023842 | 3282.7999999523163 | 3831.6999999284744 | 834.5 | 908 | none |
| 4 | 3801 | 3956 | 4088 | 3668.6999999284744 | 3826.399999976158 | 4014.399999976158 | 670.7999999523163 | 756 | none |
| 5 | 3550 | 2904 | 3962 | 3410.600000023842 | 2771.2000000476837 | 3934.3000000715256 | 647.6000000238419 | 716 | none |

### site / phone

| Run | Base wall ms | Preview wall ms | Custom wall ms | Base canvas ms | Preview canvas ms | Custom canvas ms | Loader DOM ms | Preview FCP ms | Failures |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 5833 | 2856 | 5351 | 5698 | 2738.5 | 5294.800000071526 | 671.2999999523163 | 732 | none |
| 2 | 3433 | 3996 | 4172 | 3295.600000023842 | 3465 | 4099.899999976158 | 917.6000000238419 | 976 | none |
| 3 | 3343 | 3050 | 4135 | 3210.399999976158 | 2931.899999976158 | 4083 | 705.1999999284744 | 764 | none |
| 4 | 3463 | 2973 | 4848 | 3332.5 | 2847.600000023842 | 3948.2999999523163 | 630.4000000953674 | 696 | none |
| 5 | 3403 | 3387 | 4399 | 3268.2999999523163 | 3263.600000023842 | 4342 | 626.6000000238419 | 692 | none |

## Loading, requests and writes

17/20 candidate FCPs meet one second. DOM visibility alone is not paint. FCP establishes content paint but does not identify the loader; preserve the actual-pixel diagnostic separately. responseStart includes connection/TLS and must not be called pure server latency. [Startup analysis](startup-analysis.json) contains the current rows; no R2 numerical result is promoted here.

| Branch | Compared pairs | New names | Early feature requests | No-new-request gate |
| --- | --- | --- | --- | --- |
| walk | 10 | 0 | 0 | PASS |
| site | 10 | 0 | 0 | PASS |

Current campaign write/error counters, without filtering hosting requests: `{"formal":0,"site":{"attemptedCount":0,"blockedCount":0,"transmittedCount":0},"pdf":[{"device":"laptop","blockedWrites":[],"pageErrors":[],"consoleErrors":[],"httpErrors":[]},{"device":"phone","blockedWrites":[],"pageErrors":[],"consoleErrors":[],"httpErrors":[]}]}`. Raw attempted and blocked writes remain in their source records. A blocked request is not transmitted, but is still an attempted write and must not be reported as zero. Earlier diagnostics are in the source/failure manifests rather than silently included in a universal clean claim.

## Final emitted build and HTML

| Build | Early files | Raw | Gzip | Raw delta | Gzip delta |
| --- | --- | --- | --- | --- | --- |
| base | 28 | 2905199 | 871303 | 0 | 0 |
| walk | 28 | 2906274 | 871731 | 1075 | 428 |
| site | 28 | 2907723 | 872317 | 2524 | 1014 |

Final Vite output after preload transforms is authoritative. The numerical 1,024-gzip ceiling is distinct from the semantic allowed-seam rule; module attribution names all adapters and is not claimed to be gzip attribution. [Build attribution](build-attribution.json) retains module changes, finalization and HTML evidence; complete emitted audits are under builds/. No literal zero-byte claim is made.

[Current semantic gate](semantic-gate-final.json) classifies every changed early module. General startup changes and repairs to existing accessibility are reported separately from the lazy bootstrap; a numeric byte pass cannot grant semantic permission.

| Branch | HTML | Before raw | After raw | Raw delta | Before gzip | After gzip | Gzip delta |
| --- | --- | --- | --- | --- | --- | --- | --- |
| walk | index.html | 2642 | 6049 | 3407 | 1273 | 2518 | 1245 |
| walk | olb.html | 3623 | 6966 | 3343 | 1560 | 2777 | 1217 |
| site | index.html | 2642 | 6049 | 3407 | 1273 | 2519 | 1246 |
| site | olb.html | 3623 | 6966 | 3343 | 1560 | 2778 | 1218 |

Recognized deferred World chunks are listed below; [all late assets](late-assets.json) preserves every non-early JS/CSS asset, including unrelated existing late assets. Filename grouping is descriptive, not proof of when a request starts; the network audit supplies that proof.

| Branch | Deferred asset | Raw bytes | Gzip bytes |
| --- | --- | --- | --- |
| walk | assets/walk-animation-CVCR6P-e.js | 50981 | 14768 |
| walk | assets/walk-controls-ClkkmM6i.js | 2132 | 764 |
| walk | assets/WalkLauncher-Dipv_vt7.js | 22326 | 12247 |
| walk | assets/runtime-C0xgD9TB.js | 81459 | 27384 |
| walk | assets/WalkLauncher-DuQnpEzB.css | 5574 | 1755 |
| site | assets/SiteEntry-DgGJ3nRb.js | 41065 | 14795 |
| site | assets/hydration-CM7v7aiB.js | 13832 | 5511 |
| site | assets/SiteMap-BDoEfmOF.js | 1090441 | 299328 |
| site | assets/SiteEntry-BLTDhKmB.css | 9098 | 2490 |
| site | assets/SiteMap-Y3Rwdjno.css | 71547 | 10181 |
| site | assets/maplibre-gl-worker-GrpJo12C.js | 520092 | 151615 |

## Walk: input, frames and all functional attempts

| Device | View | Every keyboard latency ms | Maximum ms | Samples under 50 ms |
| --- | --- | --- | --- | --- |
| desktop | third | 36.39999997615814, 16, 6.899999976158142, 17.799999952316284, 14.100000023841858 | 36.39999997615814 | 5/5 |
| desktop | first | 5.5, 10.399999976158142, 11.600000023841858, 13.100000023841858, 15.899999976158142 | 15.899999976158142 | 5/5 |
| phone | third | 38.799999952316284, 11.099999904632568, 13, 12.100000023841858, 12 | 38.799999952316284 | 5/5 |
| phone | first | 3.799999952316284, 6.700000047683716, 11.5, 235.69999992847443, 12.100000023841858 | 235.69999992847443 | 4/5 |

The unchanged zero-settle protocol and Start-to-ready cost are retained in [Walk compact](walk/compact.json) and [review](walk/REVIEW.md). Native touch arrays and every original sample remain in raw files. Render submission is not photon latency. Deferred shader preparation is not automatically proof that a prior GPU stall was shader compilation; only the measured current samples support performance conclusions.

| Device | Round2 Start-to-ready ms | Current Start-to-ready ms | Delta ms |
| --- | --- | --- | --- |
| desktop | 2836.899999976158 | 5990.399999976158 | 3153.5 |
| phone | 2977.100000023842 | 3736.7000000476837 | 759.6000000238419 |

Preparation decision: **retain**. Retain provisionally for the completed Round3 source comparison, with attribution unresolved and a matched-delivery current/omit-preparation experiment planned for Round4. The normal total entry increases are retained, but slower resource delivery confounds the desktop comparison and existing observations do not establish the net first-visible-ready cost of compilation. The source-injected diagnostic measures a preparation await, not its additive counterfactual cost: first rendering may otherwise perform some of this work. Finish step5 has no tradeoff exemption; an attributable worsening must be reverted, and this decision does not claim no-regression compliance is proven.

| Device | View | Frames | Active ms | Paused ms | FPS | 1% low | Max interval ms | FPS gate | Full window |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| desktop | third | 2393 | 40000 | 0 | 59.825 | 35.37214443004173 | 131 | FAIL | PASS |
| desktop | first | 2400 | 40000 | 0 | 60 | 46.15384615384615 | 24.199999928474426 | PASS | PASS |
| phone | third | 2400 | 40000 | 0 | 60 | 43.81161006141584 | 25.5 | PASS | PASS |
| phone | first | 2400 | 40000 | 0 | 60 | 48.533872610284504 | 21.899999976158142 | PASS | PASS |

| Original Round3 sample | Complete compressed copy |
| --- | --- |
| work/world-finish/round3/results/r3-walk-background-v1/background-ownership.json | [raw](raw/results/r3-walk-background-v1/background-ownership.json.gz) |
| work/world-finish/round3/results/r3-walk-frames-v2/walk-framerate-walk.json | [raw](raw/results/r3-walk-frames-v2/walk-framerate-walk.json.gz) |
| work/world-finish/round3/results/r3-walk-functional-desktop-v2/walk-functional-walk.json | [raw](raw/results/r3-walk-functional-desktop-v2/walk-functional-walk.json.gz) |
| work/world-finish/round3/results/r3-walk-functional-phone-v6/walk-functional-walk.json | [raw](raw/results/r3-walk-functional-phone-v6/walk-functional-walk.json.gz) |
| work/world-finish/round3/results/r3-walk-input-v3/walk-performance-walk.json | [raw](raw/results/r3-walk-input-v3/walk-performance-walk.json.gz) |
| work/world-finish/round3/results/r3-walk-phone-door-delivery-v5/walk-functional-walk.json | [raw](raw/results/r3-walk-phone-door-delivery-v5/walk-functional-walk.json.gz) |
| work/world-finish/round3/results/r3-walk-phone-door-probe-locator-v1/walk-functional-walk.json | [raw](raw/results/r3-walk-phone-door-probe-locator-v1/walk-functional-walk.json.gz) |
| work/world-finish/round3/results/r3-walk-phone-door-probe-v1/walk-functional-walk.json | [raw](raw/results/r3-walk-phone-door-probe-v1/walk-functional-walk.json.gz) |

Old-source phone delivery probes include two no-click failures and an instrumented pass on unchanged application code. They remain diagnostics with their own identity. The pass does not establish a cause or a product fix and does not erase failures. Current-head native functional status is taken only from the current compact and raw samples. Physical one-hand comfort and ten-second first-user comprehension remain separate human-evidence criteria, not claims supplied by browser emulation or controls copy.

## Site: current live/offline cases and actual A4 output

| Case | Device | Result | JS errors | Console errors | HTTP errors | Provider requests | Write counters | Error |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| delayed-initial-entry-focus | laptop | PASS | 0 | 0 | 0 | 0 | {"attemptedCount":0,"blockedCount":0,"transmittedCount":0,"attempted":[]} |  |
| delayed-initial-entry-focus | phone | PASS | 0 | 0 | 0 | 0 | {"attemptedCount":0,"blockedCount":0,"transmittedCount":0,"attempted":[]} |  |
| live-map | laptop | PASS | 0 | 0 | 0 | 13 | {"attemptedCount":0,"blockedCount":0,"transmittedCount":0,"attempted":[]} |  |
| live-map | phone | PASS | 0 | 0 | 0 | 9 | {"attemptedCount":0,"blockedCount":0,"transmittedCount":0,"attempted":[]} |  |
| offline | laptop | PASS | 0 | 0 | 0 | 0 | {"attemptedCount":0,"blockedCount":0,"transmittedCount":0,"attempted":[]} |  |
| offline | phone | PASS | 0 | 0 | 0 | 0 | {"attemptedCount":0,"blockedCount":0,"transmittedCount":0,"attempted":[]} |  |
| production-env-negative-simulation | phone | PASS | 0 | 0 | 0 | 0 | {"attemptedCount":0,"blockedCount":0,"transmittedCount":0,"attempted":[]} |  |

The seven-case harness exercises delayed loading-dialog ownership, explicit search, drawing, keyboard edit/Undo, remove/clear Undo, map attribution, offline source labels/three areas, survey traverse and print lifecycle at both sizes. Actual provider responses are not substituted. The production-negative guard is a labelled healthcheck simulation, not a production-deployment test. User-drawn plots are not verified parcels. See [all case details](site/preview-smoke.json); coverage names do not imply a failing row passed.

The separate [actual Site UI visual review](site/visual-review.json) is **FAIL**; numerical success alone cannot make the combined gate pass. All seven raw cases pass; every recorded console/HTTP/page-error array is empty, both live searches succeed, and all attempted/blocked/transmitted write counts are zero. The laptop map screenshot shows all three credit links clearly. The phone map screenshot shows a blank credit strip even though the earlier recorded DOM geometry reports three visible anchors. This initial visual failure is retained pending a separate bounded paint diagnostic. Loading dialogs, report controls, diagrams and banners fit both viewports. The offline report has no map or credit DOM and no provider calls. All eight generated PDF pages repeat the full disclaimer without body/footer overlap or clipped report text. Type3 glyph bounding-box warnings occurred during Poppler rendering; no visible glyph corruption was observed. Follow-up diagnostics retain their own scope and do not erase the initial images.

The deferred plan adapter has separate [concave placement and held-hydration observations](site/plan-projection.json) plus [completed visual review](site/plan-visual-review.json). Native plan resultPASS, visual resultFAIL, visible north arrowlaptop: PASS, phone: FAIL, pending quantity withheldPASS. All raw attempts and errors remain separate from the seven-case campaign.

Dedicated same-head PDFs: automated PASS, visual PASS. 8 rendered pages were individually inspected; minimum reported body/footer gap 17.991665917013755 mm. Complete disclaimer every page: PASS; overlap/clipping observed: false; screen unchanged: PASS. [Completed visual review](site/print/visual-review.json) and [notes](site/print/VISUAL-REVIEW.md) resolve the raw export's initial pending-review label. Render warnings and earlier failures remain, with no edited or substituted PDF pixels.

| Inspected page | Image |
| --- | --- |
| page-laptop-1.png | [view](site/print/page-laptop-1.png) |
| page-laptop-2.png | [view](site/print/page-laptop-2.png) |
| page-laptop-3.png | [view](site/print/page-laptop-3.png) |
| page-laptop-4.png | [view](site/print/page-laptop-4.png) |
| page-phone-1.png | [view](site/print/page-phone-1.png) |
| page-phone-2.png | [view](site/print/page-phone-2.png) |
| page-phone-3.png | [view](site/print/page-phone-3.png) |
| page-phone-4.png | [view](site/print/page-phone-4.png) |

[Laptop PDF](site/print/report-laptop-a4.pdf), [phone PDF](site/print/report-phone-a4.pdf). Phone means a 390×844 touch viewport on a laptop; no physical-phone/human study is claimed. Existing Stage2 calculation/provider/licence coverage is historical supporting evidence, not a newly rerun R3 scenario.

## CI, Lighthouse and immutable rules

Normal-source automated theme result: WalkPASS, SitePASS. Visual screenshot result: WalkPASS, SitePASS. The final theme gate requires both kinds of evidence to pass. Automated reports retain four distinct tests, exact before/after heads, non-injected styles, every minimum ratio and check count. [Walk contrast](contrast/walk-verified.json), [Site contrast](contrast/site-verified.json), [Walk visual review](contrast/walk-visual-review.json) and [Site visual review](contrast/site-visual-review.json) retain current-source scope/findings. Every final extracted image is explicitly covered; any representative/member equivalence is checked against actual SHA256s. Earlier numerical passes with visual failures remain failures of the combined gate, with their original labels. All contrast/footer/theme/Lighthouse directories are represented in the source manifest. Current final Playwright test records retain statuses, timing, errors, stdout and attachment metadata; only embedded binary bodies are replaced with external references in clearly named sanitized derivatives. Current final text/JSON attachments and extracted contrast/health records remain fully packaged. Earlier/intermediate contrast and Lighthouse bulk records remain externally retained with exact original hashes and complete failure observations in the packaged failure table. Original results and surplus screenshots/artifacts remain outside the package with hashes.

| Branch | Check | Status | Conclusion | Run |
| --- | --- | --- | --- | --- |
| walk | Secrets scan | completed | success | [run](https://github.com/victorcassiusoffice-sketch/ppw-designer-2d/actions/runs/40858112340) |
| walk | Quality gates | completed | success | [run](https://github.com/victorcassiusoffice-sketch/ppw-designer-2d/actions/runs/40858112336) |
| walk | Vercel | completed | success | [run](https://vercel.com/victor-ppw/ppw-designer-2d/3y5eZoq6PqZoatZCg1dpXJYaNfCe) |
| site | Secrets scan | completed | success | [run](https://github.com/victorcassiusoffice-sketch/ppw-designer-2d/actions/runs/40858117662) |
| site | Quality gates | completed | success | [run](https://github.com/victorcassiusoffice-sketch/ppw-designer-2d/actions/runs/40858117650) |
| site | Vercel | completed | success | [run](https://vercel.com/victor-ppw/ppw-designer-2d/BR9FWm9Gb38t47ro6838g8kMp7Pi) |

| Branch | Baseline errors | Removed | Remaining | New error IDs | Warnings |
| --- | --- | --- | --- | --- | --- |
| walk | 22 | 16 | 6 | [] | 15 |
| site | 22 | 16 | 6 | [] | 14 |

Current exact-head full Lighthouse audit records remain packaged in clearly named screenshots-externalized derivatives when embedded images are present. Only the verified filmstrip, final-screenshot and root full-page screenshot data URLs change into external references; scores, every audit, warnings/errors, timings, category/configuration metadata, dimensions and the full-page nodes map remain unchanged. Exact originals are externally hashed, and full-record reconstruction is checked before writing. Unknown screenshot schema variants remain untouched.

H permits specifically documented inherited assertions that cannot be safely repaired under unchanged rules; it does not demand a fabricated all-green Lighthouse result. It also requires every safe fix, so inherited status alone is not a waiver. Each remaining cause and actual value follows, without altering thresholds:

| Branch | Route | Assertion | Actual | Expected | Reason |
| --- | --- | --- | --- | --- | --- |
| walk | /demo?view=2d&pitch=1 | csp-xss | 0 | 0.9 | Informational audit has score:null; inherited minScore>=0.9 converts it to actual0. Changing application headers cannot turn this audit into a scored pass, and LHCI uses its static server rather than Vercel response headers. Threshold/settings unchanged. |
| walk | /demo?view=2d&pitch=1 | total-byte-weight | 0 | 0.9 | Informational audit has score:null; inherited minScore>=0.9 converts it to actual0. Transfer reductions do not change that assertion. Threshold/settings unchanged. |
| walk | /demo?view=2d&pitch=1 | unused-css-rules | 2 | 0 | Designer retains initial shared main/App styles needed by deferred tools, conditional states and other routes; pruning from one viewport is unsafe. The isolated plumbing base now omits Designer utility CSS while retaining complete preflight/fonts/body/preferences/brand/sales and lazy form styles. Actual audit items below determine whether that clears the unchanged maxLength0 assertion; no threshold/settings changes. |
| walk | /demo?view=2d&pitch=1 | valid-source-maps | 0 | 0.9 | Public source maps are intentionally forbidden by the existing build guard/private Sentry upload policy. Do not disclose maps to make the inherited audit pass. |
| walk | /pitch/plumbing | csp-xss | 0 | 0.9 | Informational audit has score:null; inherited minScore>=0.9 converts it to actual0. Changing application headers cannot turn this audit into a scored pass, and LHCI uses its static server rather than Vercel response headers. Threshold/settings unchanged. |
| walk | /pitch/plumbing | total-byte-weight | 0 | 0.9 | Informational audit has score:null; inherited minScore>=0.9 converts it to actual0. Transfer reductions do not change that assertion. Threshold/settings unchanged. |
| site | /demo?view=2d&pitch=1 | csp-xss | 0 | 0.9 | Informational audit has score:null; inherited minScore>=0.9 converts it to actual0. Changing application headers cannot turn this audit into a scored pass, and LHCI uses its static server rather than Vercel response headers. Threshold/settings unchanged. |
| site | /demo?view=2d&pitch=1 | total-byte-weight | 0 | 0.9 | Informational audit has score:null; inherited minScore>=0.9 converts it to actual0. Transfer reductions do not change that assertion. Threshold/settings unchanged. |
| site | /demo?view=2d&pitch=1 | unused-css-rules | 2 | 0 | Designer retains initial shared main/App styles needed by deferred tools, conditional states and other routes; pruning from one viewport is unsafe. The isolated plumbing base now omits Designer utility CSS while retaining complete preflight/fonts/body/preferences/brand/sales and lazy form styles. Actual audit items below determine whether that clears the unchanged maxLength0 assertion; no threshold/settings changes. |
| site | /demo?view=2d&pitch=1 | valid-source-maps | 0 | 0.9 | Public source maps are intentionally forbidden by the existing build guard/private Sentry upload policy. Do not disclose maps to make the inherited audit pass. |
| site | /pitch/plumbing | csp-xss | 0 | 0.9 | Informational audit has score:null; inherited minScore>=0.9 converts it to actual0. Changing application headers cannot turn this audit into a scored pass, and LHCI uses its static server rather than Vercel response headers. Threshold/settings unchanged. |
| site | /pitch/plumbing | total-byte-weight | 0 | 0.9 | Informational audit has score:null; inherited minScore>=0.9 converts it to actual0. Transfer reductions do not change that assertion. Threshold/settings unchanged. |

[Static rules](rules-static.json), [eight visible screens](rules-visible.json), and [publication/ancestry](source-publication.json) retain exact source identities. No new environment, account, key, migration, production merge or manual deploy is authorized by this evidence. Local verification logs retain their original tested heads; do not replace exact-head CI with a historical local pass or describe inherited lint failures as clean.

## Preservation and budget

Large JSON proofs and generated tables use small readable JSON indexes. Each index identifies a sibling lossless gzip file, its compressed and uncompressed byte counts and SHA256 values. Decompress that file to read the complete evidence/table; indexes are explicitly not substitutes for its contents. Every compression is verified byte-for-byte before packaging. No observation, sample or failure is removed by compression.

[FAILURES.json](FAILURES.json) lists observed failed flags/errors/write attempts with original paths; every source remains immutable. All forty formal loads, complete network pairs, all five original final Walk proofs and the other retained Walk samples are lossless gzip copies with original hashes. Earlier/intermediate contrast and Lighthouse bulk records remain outside the PR, unchanged and fully hashed; their failure observations remain in the packaged table. [Binary attachment derivations](BINARY-ATTACHMENT-DERIVATIONS.json) identify every replaced base64 body/data URL by its JSON pointer in the preserved original result, original file hash/size, exact encoding/MIME prefix where applicable and decoded binary hash/size; all other test/audit information remains in the derivative. Large traces/profiles, complete originals of those Playwright/Lighthouse results and surplus diagnostic images remain outside this compact package with their absolute/original paths, bytes and SHA-256 in [SOURCE-MANIFEST.json](SOURCE-MANIFEST.json). No slow run or failed attempt is deleted to obtain a passing result.

[PACKAGE-MANIFEST.json](PACKAGE-MANIFEST.json) gives every packaged file and byte count. Strong target: under3 MB; soft budget:3.8 MB. Package plus configured retained docs must be under5,000,000bytes in each PR. Retained-doc inputs are Walk864789bytes and Site428793bytes; the coordinator must recheck the combined directory before installation. All final PDF pages/PDFs and complete raw loads/Walk samples are retained; surplus pitch/screenshots stay in scratch with hashes. This packager writes only this fresh chat output directory, never either repository or Round2 evidence.
