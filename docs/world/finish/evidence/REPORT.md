# Finish round 1 — completed measurements; release gates remain open

Date: 28 October 2026, Mauritius. Base is PR52 `56d852d1f2f5d7342b9e02194964d6b998c795c7`, [exact preview](https://ppw-designer-2d-git-gpt-olb-fix-round-3-2026-10-27-victor-ppw.vercel.app). Measured Walk `c8941925da4640cf02d6c4ecb864d3914993a180`; Site `7ed40b6bff89067623a4939f251be1ed5cd6e870`. Both include PR52 by merge, not rebase. Health stayed exact before/after every formal campaign.

Round0 is the resolved startup instruction conflict, not a failed engineering attempt. Round1 fixed actual Site Undo, safe inherited Lighthouse issues, added strict frame instrumentation and tested earlier discovery of existing designer files. No production merge, manual deployment, main push or history rewrite occurred.

## First picture and paired timings

Five fresh processes per device/target, interleaved base→Walk→Site→custom, pinned216.198.79.3, no throttling or competing local workloads. All40 candidate-campaign rows and initial60 rows are retained in compressed JSON. Original wall observations and exact canvas render submissions remain distinct. Custom-domain pairs are informational.

| Branch / device | Base wall / canvas ms | Preview wall / canvas ms | Custom wall / canvas ms | Preview/base wall / canvas | Absolute / paired |
|---|---:|---:|---:|---:|---|
| walk / desktop | 6008 / 5875.1 | 5700 / 5183.5 | 5957 / 5895.9 | 94.874% / 88.228% | FAIL / PASS |
| walk / phone | 4243 / 4180.4 | 4594 / 4577.3 | 5595 / 5541.4 | 108.272% / 109.494% | PASS / PASS |
| site / desktop | 6008 / 5875.1 | 5262 / 5184.2 | 5957 / 5895.9 | 87.583% / 88.24% | FAIL / PASS |
| site / phone | 4243 / 4180.4 | 4727 / 4507.2 | 5595 / 5541.4 | 111.407% / 107.817% | PASS / FAIL |

All candidate runs fail the loading-within1second check. The legacy observer measures DOM visibility, not painted pixels. Version2 also recorded FCP; every candidate FCP is above1second, which proves the actual panel could not yet be visible. Both observations are retained. The post-CSS classic preload script blocks body parsing; candidate FCP is often earlier than base, so the DOM delay alone is not a proven physical regression. Round2 will remove render-blocking startup dependencies, not rename the metric.

### Every walk desktop pair (milliseconds)

| Run | Base wall / canvas | Preview wall / canvas | Custom wall / canvas | Preview loading DOM / FCP |
|---|---:|---:|---:|---:|
| 1 | 6360 / 6350 | 5611 / 5080 | 6215 / 6125.9 | 1074.5 / 1256 |
| 2 | 5612 / 5490.8 | 5700 / 5183.5 | 5957 / 5895.9 | 1167.2 / 1744 |
| 3 | 6008 / 5875.1 | 6255 / 6144.6 | 4970 / 4904.4 | 1238 / 1816 |
| 4 | 5208 / 5169.3 | 5092 / 4960.1 | 6501 / 6435 | 1040.6 / 1244 |
| 5 | 6576 / 6040 | 6535 / 5994 | 4871 / 4808.8 | 1346.9 / 1764 |

### Every walk phone pair (milliseconds)

| Run | Base wall / canvas | Preview wall / canvas | Custom wall / canvas | Preview loading DOM / FCP |
|---|---:|---:|---:|---:|
| 1 | 5532 / 5458.3 | 4594 / 4577.3 | 4858 / 4804.1 | 1176 / 1272 |
| 2 | 3895 / 3761.5 | 4810 / 4763.8 | 5477 / 5426.5 | 1248.5 / 1316 |
| 3 | 3680 / 3642.5 | 4295 / 4156.1 | 6529 / 6478.8 | 1208.4 / 1276 |
| 4 | 4719 / 4687.8 | 5229 / 4692 | 5595 / 5541.4 | 1331.3 / 1388 |
| 5 | 4243 / 4180.4 | 3392 / 3260.2 | 8576 / 8487.6 | 1242.4 / 1316 |

### Every site desktop pair (milliseconds)

| Run | Base wall / canvas | Preview wall / canvas | Custom wall / canvas | Preview loading DOM / FCP |
|---|---:|---:|---:|---:|
| 1 | 6360 / 6350 | 5262 / 5184.2 | 6215 / 6125.9 | 1930.7 / 2160 |
| 2 | 5612 / 5490.8 | 4013 / 3880.4 | 5957 / 5895.9 | 1007.6 / 1096 |
| 3 | 6008 / 5875.1 | 5381 / 5334.8 | 4970 / 4904.4 | 1326.6 / 1868 |
| 4 | 5208 / 5169.3 | 5560 / 5523.1 | 6501 / 6435 | 1315.7 / 1408 |
| 5 | 6576 / 6040 | 4935 / 4803 | 4871 / 4808.8 | 1052.5 / 1236 |

### Every site phone pair (milliseconds)

| Run | Base wall / canvas | Preview wall / canvas | Custom wall / canvas | Preview loading DOM / FCP |
|---|---:|---:|---:|---:|
| 1 | 5532 / 5458.3 | 4947 / 4929.6 | 4858 / 4804.1 | 1314.3 / 1392 |
| 2 | 3895 / 3761.5 | 4727 / 4592.6 | 5477 / 5426.5 | 1209 / 1280 |
| 3 | 3680 / 3642.5 | 4535 / 4411.4 | 6529 / 6478.8 | 1029.7 / 1180 |
| 4 | 4719 / 4687.8 | 4144 / 4076.3 | 5595 / 5541.4 | 1344.3 / 1832 |
| 5 | 4243 / 4180.4 | 5043 / 4507.2 | 8576 / 8487.6 | 1205.9 / 1308 |

## Completed emitted bundle and request audit

The same28 App+ThreeStage static JS files total base2,905,199raw/871,303gzip; Walk2,907,161/871,993 (+1,962/+690), Site2,907,686/872,238 (+2,487/+935). Both pass the1,024gzip seam ceiling even before exempting Walk’s45raw/12gzip existing-symbol aliases. Exact per-file raw/gzip/hash/import/module attribution is in measurements.json and network-audit.json.gz. Source review finds only deferred feature adapters early.

HTML cost is separate: base OLB3,623raw/1,560gzip; Walk5,066/2,204 (+1,443/+644); Site5,066/2,208 (+1,443/+648). Do not hide HTML in the28-JS allowance. All20 candidate/base pairs have the identical36 pre-picture HTTP paths, zero new paths, zero World implementation or selected-character requests before the picture. All use the OLB shell. No page/console/HTTP errors or writes in the40-row campaign.

Walk deferred JS totals54,235gzip plus only the selected91.8–92.8KB GLB after Start. Site map299,328gzip, worker151,615; workspace14,696, hydration5,290, map/workspace CSS10,181/2,436. No dependency upgrade was made.

## Walk, Site and rubric gaps

Chooser call-to-decoded-frame202ms desktop/465ms phone; event-to-decoded116.6/183.6ms. Both satisfy the1second target. Native pointer-lock Escape, both-view doors and exact saved-design/camera restoration pass with the corrected desktop approach. The original navigation failure and API errors are retained, with its demonstrated lock-cooldown harness defect.

Desktop third-person input samples110.9,101.1,5,82.3,11ms fail<50; first-person24.4,22.7,12.7,7.7,25.2ms pass. Strict40second FPS: desktop58.6/59.7, phone58.525/59.95 (third/first);1%lows16.199/34.014 and15.916/44.395. No frame was filtered or rounded to60. The diagnostic finds82 background designer AO callbacks during Walk; pausing that covered stage is the next experiment. Exact unrounded values, native phone touch distributions, tails and failures are in walk-checks.json and compressed raw files.

Site search/draw/edit/Undo/surveyor/source tags, live attribution, offline hint and preview-live production guard pass7/7 cases with no errors/writes. All6 A4 pages were rendered/inspected, with no clipping/overlap; disclaimer is missing on both page2s. The two PDFs are byte-identical; site-a4.pdf is that exact output, with both metadata records retained. Site print/banner therefore FAIL, not2/3. Human first-use comprehension and physical one-hand use remain unmeasured and score1.

## CI and inherited Lighthouse

Walk current quality run40733166661 and Site40733182524 pass, as do secrets and Vercel. Local full suites: Walk4,396/414 before the extra disposal case, then20 focused checks and current full CI; Site4,446/417 final. Root/API/middleware types pass. The first Site full run’s unchanged token-tamper fixture failure is retained and deterministically reproduced as a constant-suffix mutation that can leave the original token unchanged; authentication and old tests were not edited.

Both current Lighthouse runs (Walk40733166609, Site40733182187) remove13 of22 inherited errors, add none. Fixed: robots×2, sized image, responsive image, accessible Rooms label, and four PPW manifest/installability assertions×2routes. Remaining9: informative score-null CSP×2 and byte weight×2 (settings cannot be weakened), unused CSS×2 (further isolation under review), intentionally private sourcemaps×1, unnecessary plumbing FX401×1, late hero discovery×1. Complete baseline/current assertion objects and reasons are in lighthouse.json.

## Next round and limits

Rank: actual loading paint/desktop first picture and Site phone paired wall gate; covered designer GPU work/input/strict60fps; repeated print disclaimer; safe remaining plumbing repairs; honest controls/reach improvements. No score is padded, no slow row removed. Round1 counts as one real failed attempt for its remaining release gates. The3-consecutive-round rule has not yet been reached. All raw profiles remain in the chat work/world-finish/round1 directory; earlier Stage2/Fix1 bytes remain in the hashed historical archive and immutable Git history.
