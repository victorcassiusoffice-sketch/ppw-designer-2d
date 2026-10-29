# World Finish — Round 2 evidence

This round is **not all green**. Laptop first-picture, loading-paint, strict input-latency, phone door functionality and inherited Lighthouse gates remain failed or unresolved as shown below. Failed and slow samples are preserved. This package does not authorize a production merge or deployment.

Base52: `56d852d1f2f5d7342b9e02194964d6b998c795c7`. Walk: `d78064f9f57ed6e060d9782036b4a8b7a7e95451`. Site: `b3727b1d20fff6be3ac448dfe8bf11e9261ad500`. Final evidence uses these source heads; diagnostics and older verification retain their own original heads.

## Gate status

| Gate | Result | Evidence / limits |
| --- | --- | --- |
| Exact-head formal health | PASS | All 40 raw loads and before/after health retained. |
| Absolute laptop first picture <3s | FAIL | Walk 4299ms; Site 4838ms median wall observation. |
| Absolute phone first picture <5s | PASS | Walk 4149ms; Site 3710ms median wall observation. |
| Same-host median within 10% baseline | PASS | All four branch/device medians pass. Individual slower pairs are retained; the gate does not require every pair to improve. |
| Visible loading within 1s every run | FAIL | DOM visibility alone is insufficient; nine of twenty candidates have FCP within 1s. |
| Early gzip numerical ceiling <=1024 bytes | PASS | Walk +489, Site +940. Separate semantic attribution still applies. |
| No new pre-picture request names | PASS | Ten pairs per branch; 36 requests in each baseline/candidate window. |
| Walk chooser <1s | PASS | Decoded-frame and DOM observations kept separately. |
| Laptop input <50ms every sample | FAIL | Original outlier and later diagnostic remain, with every input sample. |
| Strict measured Walk FPS windows | PASS | Four full unpaused 40s windows; 1% lows and every interval retained. |
| Walk desktop functional | PASS | Exact captured functional sample. |
| Walk phone functional / door | FAIL | Original phone v1 and native one-pointer v2 remain. A later diagnostic does not erase a failed formal sample. |
| Site G/E coverage | PASS | Seven cases; production guard is a labelled healthcheck simulation. |
| Site A4 banner on every page | PASS | Eight inspected pages, both PDFs, no overlap. |
| Static rules | PASS | Exact-head protected-file/settings/dependency audit. |
| Visible rules | PASS | Eight screens across both heads and viewports. |
| Lighthouse all error assertions | FAIL | Seven inherited errors per branch remain; no new errors; thresholds unchanged. |

## Formal first-picture campaign

Five fresh pairs per branch/device share the same ten baseline and ten custom-host observations, giving forty unique loads total. Raw observations are in `raw40loads.json.gz`; no loads are excluded. Same-host preview comparison governs the relative gate. The custom host is a separately recorded operational reference, not the same-host baseline. Wall observation and browser canvas mark remain distinct. Instrumented diagnostics never replace these values.

| Branch | Device | Base wall median ms | Preview wall median ms | Base canvas median ms | Preview canvas median ms | Wall change | Absolute gate | Relative gate |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| walk | desktop | 5257.0 | 4299.0 | 5136.7 | 4165.9 | -18.22% | FAIL | PASS |
| walk | phone | 4209.0 | 4149.0 | 4142.9 | 4019.2 | -1.43% | PASS | PASS |
| site | desktop | 5257.0 | 4838.0 | 5136.7 | 4718.8 | -7.97% | FAIL | PASS |
| site | phone | 4209.0 | 3710.0 | 4142.9 | 3579.8 | -11.86% | PASS | PASS |

### walk / desktop: every retained pair

| Run | Base wall ms | Preview wall ms | Custom wall ms | Base canvas ms | Preview canvas ms | Custom canvas ms | Preview loader DOM ms | Preview FCP ms | Failures |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 5257.0 | 5768.0 | 13581.0 | 5136.7 | 5639.3 | 13534.8 | 1376.7 | 1444.0 | none |
| 2 | 6685.0 | 4426.0 | 5497.0 | 6612.9 | 4294.2 | 5443.0 | 943.8 | 1472.0 | none |
| 3 | 4332.0 | 3687.0 | 8925.0 | 4204.2 | 3558.9 | 8893.3 | 667.7 | 732.0 | none |
| 4 | 10042.0 | 3411.0 | 4127.0 | 9528.4 | 3287.2 | 4083.6 | 653.3 | 752.0 | none |
| 5 | 3461.0 | 4299.0 | 8315.0 | 3336.9 | 4165.9 | 8293.9 | 701.8 | 1288.0 | none |

### walk / phone: every retained pair

| Run | Base wall ms | Preview wall ms | Custom wall ms | Base canvas ms | Preview canvas ms | Custom canvas ms | Preview loader DOM ms | Preview FCP ms | Failures |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 3641.0 | 3365.0 | 7197.0 | 3506.5 | 3238.6 | 7156.1 | 676.3 | 744.0 | none |
| 2 | 7786.0 | 5368.0 | 4132.0 | 7694.7 | 5239.3 | 4082.0 | 2213.9 | 2280.0 | none |
| 3 | 4209.0 | 4149.0 | 8973.0 | 4142.9 | 4019.2 | 8949.8 | 675.2 | 740.0 | none |
| 4 | 6122.0 | 7254.0 | 4434.0 | 6054.3 | 7166.3 | 4392.8 | 3740.9 | 3808.0 | none |
| 5 | 3721.0 | 3818.0 | 5199.0 | 3686.0 | 3745.2 | 3781.6 | 647.1 | 712.0 | none |

### site / desktop: every retained pair

| Run | Base wall ms | Preview wall ms | Custom wall ms | Base canvas ms | Preview canvas ms | Custom canvas ms | Preview loader DOM ms | Preview FCP ms | Failures |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 5257.0 | 9015.0 | 13581.0 | 5136.7 | 8895.9 | 13534.8 | 3455.4 | 3528.0 | none |
| 2 | 6685.0 | 3222.0 | 5497.0 | 6612.9 | 3096.8 | 5443.0 | 719.4 | 1232.0 | none |
| 3 | 4332.0 | 5018.0 | 8925.0 | 4204.2 | 4888.4 | 8893.3 | 1424.4 | 1492.0 | none |
| 4 | 10042.0 | 3373.0 | 4127.0 | 9528.4 | 3255.1 | 4083.6 | 667.2 | 732.0 | none |
| 5 | 3461.0 | 4838.0 | 8315.0 | 3336.9 | 4718.8 | 8293.9 | 1475.3 | 1540.0 | none |

### site / phone: every retained pair

| Run | Base wall ms | Preview wall ms | Custom wall ms | Base canvas ms | Preview canvas ms | Custom canvas ms | Preview loader DOM ms | Preview FCP ms | Failures |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 3641.0 | 4409.0 | 7197.0 | 3506.5 | 4352.0 | 7156.1 | 648.4 | 716.0 | none |
| 2 | 7786.0 | 3554.0 | 4132.0 | 7694.7 | 3432.0 | 4082.0 | 666.4 | 732.0 | none |
| 3 | 4209.0 | 4858.0 | 8973.0 | 4142.9 | 4788.3 | 8949.8 | 686.0 | 752.0 | none |
| 4 | 6122.0 | 3566.0 | 4434.0 | 6054.3 | 3447.0 | 4392.8 | 689.2 | 1040.0 | none |
| 5 | 3721.0 | 3710.0 | 5199.0 | 3686.0 | 3579.8 | 3781.6 | 665.6 | 1248.0 | none |

## Loading and network

Of twenty candidate loads, 9 had FCP within one second and 14 had a visible loading DOM within one second. Six responseStart observations were later than one second. responseStart includes connection/TLS and other pre-response work; this is **not pure server latency**. FCP proves a content paint, not which content; separate screencast evidence establishes that the HTML loader can paint before React. `startup-analysis.json` retains every row and these limits.

| Branch | Compared pairs | New request names | Early feature requests | Gate |
| --- | --- | --- | --- | --- |
| walk | 10 | 0 | 0 | PASS |
| site | 10 | 0 | 0 | PASS |

Full request details remain in `network-audit.json.gz`. Formal and final Site campaigns have zero attempted writes. An earlier renderer diagnostic intercepted an automatic `vercel.live/login/validate` POST; it was blocked, not transmitted, and remains recorded. A separate twelve-case hosting probe did not reproduce it. This package does not silently filter that event into a universal zero-write claim.

## Corrected emitted build

| Build | Early files | Raw bytes | Gzip bytes | Raw delta | Gzip delta | Numerical gate |
| --- | --- | --- | --- | --- | --- | --- |
| Base52 | 28 | 2905199 | 871303 | 0 | 0 | baseline |
| walk | 28 | 2906722 | 871792 | 1523 | 489 | PASS |
| site | 28 | 2907675 | 872243 | 2476 | 940 | PASS |

These are final Vite emitted assets, after preload/finalizer transforms, not the earlier generateBundle snapshot. The <=1024-byte numerical gate is distinct from the semantic lazy-seam rule. Walk's original beauty-shader warm-up growth was removed; naturalSceneRenderer matches Base52. Existing camera/frame ownership and Site frozen-polygon, modal and persistence adapters are identified in the module attribution, not represented as a bare import or zero bytes. Canonical Site geometry/validation, MapLibre, worker and providers remain deferred. Rendered module lengths are not gzip contributions.

HTML deltas and finalizer bytes are separately retained in `build-attribution.json`. Isolated plumbing stayed late, and the build proof retains all original non-HTML asset hashes with no public source maps. The raw corrected build audits are included under `builds/`.

Deferred gzip sizes: Walk animation 14,768 + controls 764 + launcher 12,167 + runtime 26,883 = **54,582 JS bytes**, plus 1,755 CSS. Site Entry 14,795, hydration 5,289, map 299,328, worker 151,615 JS; Entry CSS 2,490 and map CSS 10,181. These replace Round1 values.

## Walk input, frames and functional failures

| Device | View | Every keyboard latency ms | Maximum ms | Samples <50ms |
| --- | --- | --- | --- | --- |
| desktop | third | 13.5, 9.2, 9.5, 8.4, 383.4 | 383.4 | 4/5 |
| desktop | first | 25.7, 11.0, 6.3, 8.6, 11.4 | 25.7 | 5/5 |
| phone | third | 18.0, 7.3, 7.4, 11.3, 10.1 | 18.0 | 5/5 |
| phone | first | 7.3, 11.2, 339.2, 9.6, 15.7 | 339.2 | 4/5 |

All native touch event-to-handler and handler-to-render arrays are retained in `walk/compact.json` and the complete raw input JSON. Input ends at the first changed-position render submission, not photon latency. Round2 removed Round1's 1000ms post-ready and 400ms view-switch waits; no warm-up delay was added to hide first-use stalls. The separate CPU diagnostic is explanatory and does not replace the failed original sample.

| Device | View | Frames | Active ms | Paused ms | FPS | 1% low | Max interval ms | FPS gate | Full unpaused window |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| desktop | third | 2400 | 40000.0 | 0.0 | 60.00 | 47.48 | 31.4 | PASS | PASS |
| desktop | first | 2400 | 40000.0 | 0.0 | 60.00 | 48.51 | 34.0 | PASS | PASS |
| phone | third | 2340 | 40000.0 | 0.0 | 58.50 | 16.09 | 349.8 | PASS | PASS |
| phone | first | 2374 | 40000.0 | 0.0 | 59.35 | 26.49 | 215.9 | PASS | PASS |

Every raw interval, unpainted tail and pause window is in the compressed `walk/raw/r2-walk-frames-v2/walk-framerate-walk.json.gz`. Historical HUD/RAF summaries remain separate and are not substituted for the strict full-window figures.

Phone v1 failed its movement assertion; the subsequent native one-pointer run reached the door but its Open tap did not yield the expected Close prompt. Both full samples remain. The updated diagnostic interpretation and any later checks are in `walk/REVIEW.md` and `walk/compact.json`; they do not erase either failure or warrant a blanket phone pass. All full CPU/trace files stay in scratch, with SHA-256 and byte sizes in the source manifest; compact attribution and profile sample summaries are included.

## Site live/offline and A4 proof

Seven final Site cases passed: delayed first-chunk modal focus/inert/Escape at both sizes; live map, explicit Tamarin search (five actual results), drawing, corner editing, keyboard Undo, remove Undo, clear Undo and visible attribution at both sizes; offline three-area source/unavailable reports, survey/traverse and print lifecycle at both sizes; and one labelled production-environment guard simulation. Live provider responses were not substituted. The production simulation substitutes only healthcheck JSON and is not a production-deployment test. User-drawn example plots are not surveyed or verified parcels.

All seven rows have zero JavaScript/console/HTTP errors and zero attempted, blocked or transmitted writes. Desktop is 1280x800; phone is 390x844 touch emulation on a laptop, not a physical phone. Existing Stage2 calculation/provider/license proof is carried explicitly; this round did not re-run every prior provider/math scenario.

Dedicated final same-head print proof is in `site/print/`: two actual PDFs, four A4 pages each, all eight rendered PNGs and `visual-review.json`. Every page has the complete canonical disclaimer in the named-page bottom margin. Minimum body/footer gap is **17.992mm**; there is no overlap/clipping. Screen layout stayed unchanged and the existing end-of-report flow banner is retained. PDF font-bounding-box warnings are recorded; all rendered pages were inspected and no missing visible glyph was found. The initial `print-check.json` says visual review pending; the separate completed visual-review file supplies the final inspection record. The seven-case harness's duplicate PDFs do not replace this accepted detailed proof.

Earlier fixed-bottom and fixed-top attempts failed and remain in scratch with compact failure evidence. The zero-height containing-block theory was not confirmed. An injected CSS experiment established the margin-box approach; the final normal-source published PDF run independently passed.

## Renderer, footer, Lighthouse and rules

Renderer evidence retains all seven attempts, including configuration/DNS failures, the baseline duplicate allocations and oracle corrections. Final normal previews passed both sizes: first drawing-buffer allocation uses final dimensions/DPR; orbit causes no allocation; quality/resize behavior remains correct with no GL errors. These functional checks are separate from formal timings. Original diagnostic head labels remain in `renderer-checks.json`.

Footer correction has exact published-head `footer/*-verified.json` evidence for visible contrast/navigation. The inherited Ocean/Slate contrast failure and initial generated-CSS reproducibility failure remain in the failure inventory. Generated OLB CSS was regenerated and focused existing checks passed.

Lighthouse: 22 baseline errors; each candidate removes fifteen and retains seven, with no new error assertions and unchanged settings. Remaining errors are not called green.

| Branch | Route | Assertion | Actual | Expected | Classification |
| --- | --- | --- | --- | --- | --- |
| walk | /demo?view=2d&pitch=1 | csp-xss | 0 | 0.9 | Informational audit has score:null; inherited minScore>=0.9 converts it to actual0. Changing application headers cannot turn this audit into a scored pass, and LHCI uses its static server rather than Vercel response headers. Threshold/settings unchanged. |
| walk | /demo?view=2d&pitch=1 | total-byte-weight | 0 | 0.9 | Informational audit has score:null; inherited minScore>=0.9 converts it to actual0. Transfer reductions do not change that assertion. Threshold/settings unchanged. |
| walk | /demo?view=2d&pitch=1 | unused-css-rules | 2 | 0 | Designer still flags its shared main/App CSS. The isolated plumbing entry still imports index.css and flags one route stylesheet; form styles remain lazy. A safe next candidate is a plumbing-only base retaining preflight, fonts, body utilities, all preference/tactile/sales/brand and form styles. Designer-wide pruning from one initial viewport is unsafe. Full route/theme/browser validation is still required before the isolated CSS change. |
| walk | /demo?view=2d&pitch=1 | valid-source-maps | 0 | 0.9 | Public source maps are intentionally forbidden by the existing build guard/private Sentry upload policy. Do not disclose maps to make the inherited audit pass. |
| walk | /pitch/plumbing | csp-xss | 0 | 0.9 | Informational audit has score:null; inherited minScore>=0.9 converts it to actual0. Changing application headers cannot turn this audit into a scored pass, and LHCI uses its static server rather than Vercel response headers. Threshold/settings unchanged. |
| walk | /pitch/plumbing | total-byte-weight | 0 | 0.9 | Informational audit has score:null; inherited minScore>=0.9 converts it to actual0. Transfer reductions do not change that assertion. Threshold/settings unchanged. |
| walk | /pitch/plumbing | unused-css-rules | 1 | 0 | Designer still flags its shared main/App CSS. The isolated plumbing entry still imports index.css and flags one route stylesheet; form styles remain lazy. A safe next candidate is a plumbing-only base retaining preflight, fonts, body utilities, all preference/tactile/sales/brand and form styles. Designer-wide pruning from one initial viewport is unsafe. Full route/theme/browser validation is still required before the isolated CSS change. |
| site | /demo?view=2d&pitch=1 | csp-xss | 0 | 0.9 | Informational audit has score:null; inherited minScore>=0.9 converts it to actual0. Changing application headers cannot turn this audit into a scored pass, and LHCI uses its static server rather than Vercel response headers. Threshold/settings unchanged. |
| site | /demo?view=2d&pitch=1 | total-byte-weight | 0 | 0.9 | Informational audit has score:null; inherited minScore>=0.9 converts it to actual0. Transfer reductions do not change that assertion. Threshold/settings unchanged. |
| site | /demo?view=2d&pitch=1 | unused-css-rules | 2 | 0 | Designer still flags its shared main/App CSS. The isolated plumbing entry still imports index.css and flags one route stylesheet; form styles remain lazy. A safe next candidate is a plumbing-only base retaining preflight, fonts, body utilities, all preference/tactile/sales/brand and form styles. Designer-wide pruning from one initial viewport is unsafe. Full route/theme/browser validation is still required before the isolated CSS change. |
| site | /demo?view=2d&pitch=1 | valid-source-maps | 0 | 0.9 | Public source maps are intentionally forbidden by the existing build guard/private Sentry upload policy. Do not disclose maps to make the inherited audit pass. |
| site | /pitch/plumbing | csp-xss | 0 | 0.9 | Informational audit has score:null; inherited minScore>=0.9 converts it to actual0. Changing application headers cannot turn this audit into a scored pass, and LHCI uses its static server rather than Vercel response headers. Threshold/settings unchanged. |
| site | /pitch/plumbing | total-byte-weight | 0 | 0.9 | Informational audit has score:null; inherited minScore>=0.9 converts it to actual0. Transfer reductions do not change that assertion. Threshold/settings unchanged. |
| site | /pitch/plumbing | unused-css-rules | 1 | 0 | Designer still flags its shared main/App CSS. The isolated plumbing entry still imports index.css and flags one route stylesheet; form styles remain lazy. A safe next candidate is a plumbing-only base retaining preflight, fonts, body utilities, all preference/tactile/sales/brand and form styles. Designer-wide pruning from one initial viewport is unsafe. Full route/theme/browser validation is still required before the isolated CSS change. |

The static rule audit preserves protected-file, original-test, routing, API-path, dependency/lockfile and ancestor checks. Visible rules pass all eight screens with their actual fields/links retained, including the allowed Calendly URL. No production merge, manual deployment, login, key or new environment was performed for these checks.

## Verification provenance and evidence budget

Raw local verification logs are compressed under `verification/`, labelled by their tested heads. The Site full suite at 0e55d0d passed 420 files / 4472 tests and all three type configurations, plus six PDF-oracle checks. Its full lint failed with six errors / thirteen warnings: five tracked legacy errors and one preserved untracked QA scratch error. Later print changes have focused regressions; final CI status belongs to the exact run IDs in the parent handoff and is not inferred from an older local suite. No blanket lint-pass claim is made.

`SOURCE-MANIFEST.json` records source paths, sizes and SHA-256, including failed raw artifacts and full traces retained outside the package. `FAILURES.json` records diagnostic outcomes. No source or repository docs are mutated by this packager; all earlier scratch is retained. This package prefers under3MB and enforces under5MB, with a final file/size manifest. The parent must check the combined retained repository-doc budget before replacing current evidence.

## Evidence links

| Evidence | File |
| --- | --- |
| Every formal timing pair and static closure | [timings-and-static.json](timings-and-static.json) |
| Exact forty raw loads | [raw40loads.json.gz](raw40loads.json.gz) |
| Every network pair and full request rows | [network-audit.json.gz](network-audit.json.gz) |
| Corrected emitted build attribution | [build-attribution.json](build-attribution.json) |
| Exact-head Lighthouse classification | [lighthouse-classification.json](lighthouse-classification.json) |
| Renderer attempts and final interpretation | [renderer-checks.json](renderer-checks.json) |
| Static and visible rules | [static](rules-static.json), [visible](rules-visible.json) |
| Walk final findings | [compact.json](walk/compact.json), [review](walk/REVIEW.md) |
| Every strict frame interval | [raw frame windows](walk/raw/r2-walk-frames-v2/walk-framerate-walk.json.gz) |
| Every formal input sample | [raw input samples](walk/raw/r2-walk-input-v3/walk-performance-walk.json.gz) |
| Both failed phone samples | [original v1](walk/raw/r2-walk-functional-phone-v1/walk-functional-walk.json.gz), [native-touch v2](walk/raw/r2-walk-functional-phone-touch-v2/walk-functional-walk.json.gz) |
| Input-stall attribution | [profile attribution](walk/raw/r2-walk-input-stall-profile-v2/input-stall-attribution.json.gz) |
| Final Site seven cases | [preview-smoke.json](site/preview-smoke.json) |
| Inspected A4 PDFs | [laptop](site/print/report-laptop-a4.pdf), [phone](site/print/report-phone-a4.pdf) |
| Completed all-page print review | [visual-review.json](site/print/visual-review.json), [visual notes](site/print/VISUAL-REVIEW.md) |
| Inspected laptop page 1 | [page 1](site/print/page-laptop-1.png) |
| Inspected laptop page 2 | [page 2](site/print/page-laptop-2.png) |
| Inspected laptop page 3 | [page 3](site/print/page-laptop-3.png) |
| Inspected laptop page 4 | [page 4](site/print/page-laptop-4.png) |
| Inspected phone page 1 | [page 1](site/print/page-phone-1.png) |
| Inspected phone page 2 | [page 2](site/print/page-phone-2.png) |
| Inspected phone page 3 | [page 3](site/print/page-phone-3.png) |
| Inspected phone page 4 | [page 4](site/print/page-phone-4.png) |
| Failure inventory and retained raw hashes | [FAILURES.json](FAILURES.json), [SOURCE-MANIFEST.json](SOURCE-MANIFEST.json) |
| Exact package files and sizes | [PACKAGE-MANIFEST.json](PACKAGE-MANIFEST.json) |
