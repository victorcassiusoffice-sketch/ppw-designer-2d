# Initial merged previews: retained measurements

Source: `results/r1-merged-walk/load-walk.json` and `results/r1-merged-site/load-site.json`. Derived raw precision data is in `initial-merged-analysis.json`; each run directory contains `summary.json` and `network-audit.json`. Each campaign retained five fresh interleaved base/candidate/custom-domain rows per device, with stable before/after health commits. No browser reruns or row exclusions were used for this analysis.

Base: `56d852d1f2f5d7342b9e02194964d6b998c795c7`; Walk: `8632686549be6759e9e931cd0e47324c530a56a9`; Site: `06245cc5dae463f20341f10aefb34e89d6325fc4`.

All times below are median milliseconds, rounded only for display. Wall is the original navigation-to-observed `loading-3d` disappearance. Canvas is the completed first-render timestamp. Both remain independent gates. A missing absolute/ratio gate cannot be rescued by the other metric.

| Campaign/device | Wall base / candidate / custom | Canvas base / candidate / custom | Candidate/base wall / canvas | Absolute wall / canvas | Paired wall / canvas |
|---|---:|---:|---:|---|---|
| Walk desktop | 6147 / 5541 / 5284 | 5764.3 / 5075.5 / 5219.8 | 90.142% / 88.051% | FAIL / FAIL | PASS / PASS |
| Walk phone | 4810 / 5099 / 5367 | 4765.0 / 4710.3 / 4864.8 | 106.008% / 98.852% | FAIL / PASS | PASS / PASS |
| Site desktop | 5827 / 5841 / 5345 | 5300.1 / 5510.9 / 5292.2 | 100.240% / 103.977% | FAIL / FAIL | PASS / PASS |
| Site phone | 4131 / 4555 / 5332 | 3675.1 / 4533.8 / 5250.1 | 110.264% / 123.365% | PASS / PASS | FAIL / FAIL |

Absolute limits are strictly <3000ms desktop and <5000ms phone; paired limits are <=110%. No campaign passes all timing gates.

Candidate loading-panel observations, runs 1–5:

| Candidate/device | Observed times (ms) | Median / maximum | Every run <=1000ms |
|---|---|---|---|
| Walk desktop | 1244.1, 712.7, 652.4, 642.4, 700.5 | 700.5 / 1244.1 | FAIL |
| Walk phone | 721.0, 701.6, 661.6, 687.9, 686.8 | 687.9 / 721.0 | PASS |
| Site desktop | 2110.6, 653.1, 720.6, 678.8, 4954.8 | 720.6 / 4954.8 | FAIL |
| Site phone | 690.9, 672.7, 670.9, 648.0, 664.6 | 670.9 / 690.9 | PASS |

All three candidate loading failures coincide with late HTML delivery: Walk desktop run1 final response headers at1202.6ms, panel at1244.1ms; Site desktop run1 headers2072.0ms, panel2110.6ms; Site desktop run5 headers4892.8ms, panel4954.8ms. These rows remain failures and remain in all medians. An HTML preload hint cannot recover time before HTML arrives.

Measurement label correction: PR52's HTML `#designer-startup` also has `data-testid="loading-3d"`. Therefore the historical field `reactLoadingSeen` actually records that shared legacy selector and equals the HTML observation in these campaigns. Raw files are unchanged. Subsequent harness version2 retains that field and the legacy wall metric, and adds `actualReactLoadingSeen`/`actualReactLoadingHidden` using `[data-testid="loading-3d"]:not(#designer-startup)`. The overall loading gate remains unchanged. These runs did not collect Paint Timing; subsequent version2 also records FCP.

Pre-picture HTTP proof: all 20 candidate/base pairs have **36 versus36 HTTP requests**, no added or missing normalized path in any pair, zero early World implementation requests, and confirmed OLB branding. Counts include the document and API requests. Hash normalization only pairs content-addressed chunk paths; it does not prove byte equality. Controlled-build byte proof is pending and is explicitly `null` in network output when unavailable. No page, console, or HTTP errors were recorded in either campaign, including custom-domain rows.

The Site phone +23.365% canvas result is not explained by slower downloads in this sample. Median HTML response end is647.2ms base versus631.7ms Site; App request start1272.1 versus1241.1ms; last script/CSS response2239.0 versus2127.3ms. But first preparation starts2962.7 versus3604.4ms, preparation duration409.3 versus710.5ms, and post-preparation render277.1 versus233.4ms. Median time after last script/CSS is1562.9ms base versus2354.8ms Site. These independent medians do not add; raw per-run values are retained in the JSON. The evidence localizes the excess to post-download mount/preparation and varying main-thread work, not a new request path. It does not establish a causal code regression; paired CPU/trace attribution is the next diagnostic. `git diff` between exact base52 and deployed Site head shows no changes in `ThreeStage.tsx` or `firstPictureMaterials.ts`.

Both previews still start App/ThreeStage downloads only after the entry module: typical App start is1.24–1.35s despite HTML arriving around0.63–0.68s. Route-specific HTML hints for these same existing chunks are a concrete experiment; they must retain identical request paths and demonstrate benefit in a fresh formal campaign. Full graphics quality and the original gate definitions remain intact.
