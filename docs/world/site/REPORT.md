# Site from the map — Stage 2 report

Implementation commit: `f25f4d8fc8c9dc9829b773dfeba256482be5083b`, branch `gpt/olb-site-map-2026-10-27`, based on `origin/main` at `3eefbf7646f2b5c76e5297f7836e6e0336e8f1a2`. Local validation completed 28 October 2026, Mauritius time. This report records implementation and evidence; the final integration timing and CI gates are recorded below. No merge or manual deployment was performed.

> Estimates from public data for planning a conversation, not a survey and not an approval.

## What works

The plan workspace has a lazy **Site** entry. Plain `/demo` hides it; `/demo?site=1` opens a fixed offline practice plot when selected. Both desktop and 390 × 844 phone checks observed zero live provider requests on that sample. The sample's manufactured levels are labelled what-if inputs, and public results remain unavailable.

Outside the demo, the cartographic map uses MapLibre GL JS 6.16.0 and OpenFreeMap Liberty. Place search calls Photon only on explicit submission. Users can pan and zoom, add corners, undo, drag existing corners and close a boundary. The linked credit **OpenFreeMap © OpenMapTiles Data from OpenStreetMap** remains visible below the map at phone and desktop sizes. The panel states **Satellite view: not available yet.** No Google or satellite code path, account, key or environment variable was added.

The second boundary entry accepts each side's length in metres and either decimal-degree or quadrant bearings, including degrees/minutes/seconds. It retains the unadjusted endpoint-to-start closure error and makes any residual closing edge explicit. It does not silently apply Bowditch adjustment. Drawn boundaries and typed survey-plan boundaries carry distinct required uncertainty labels.

Applying the boundary uses WGS84 local tangent-plane metres, with plan x east and plan y south, an explicit first-corner anchor and a north marker. It reuses the existing plot overlay and boundary checks without moving existing rooms. Map pixels and display zoom never determine measured distances. The optional versioned payload travels with the saved design; designs without a site retain the existing serialized shape.

The on-screen and printed report includes a boundary diagram, area, Mauritius-unit conversions, perimeter, shortest/longest side, coordinates and anchor, traverse residual, high/low levels, best-fit slope, downhill aspect, public-terrain resolution, solar yield and tilt, nearby mapped features, planning assumptions, cut/fill and the existing foundation scenario. Every field carries its source tag or an explicit unavailable state. Original provider acquisition times are retained separately from report assembly time, including after cache hits or failed refreshes.

Survey CSV (`x,y,z`) and JSON points/contours require a declared vertical reference. The constrained triangulation honours constant-height contour segments, clips the surface to the boundary and rejects crossing/conflicting contours, duplicate points and incomplete coverage. Typed corner levels are a separate what-if source. Public terrain can never become an earthworks input. For platform level `H`, the calculation is `cut = integral(max(z − H, 0) dA)` and `fill = integral(max(H − z, 0) dA)` over the boundary. Each piecewise-linear triangle is split at the platform and integrated exactly. No bulking, compaction, haulage, retaining wall or soil allowance is implied.

Planning inputs are explicit user assumptions, not a built-in assertion of permission. A uniform setback on a convex boundary uses half-plane clipping; the illustrative footprint is the lesser of that envelope and the entered plot-coverage allowance. Concave setback envelopes are withheld. The foundation adapter clones an existing enabled foundation, applies an explicit uniform datum shift and calls the unchanged estimator. It shows baseline/scenario results; a uniform vertical translation changes no dimensions or quantities. Public terrain supplies no founding depth, bearing capacity or reinforcement design.

## Providers, provenance and failure behaviour

All application data requests use the existing catch-all route and implementation under `api/_lib/site`. The adapters use fixed provider origins, anonymous requests, timeouts, bounded streaming bodies, caching and plain failures. The browser cache is plot/request-specific. Process-local server limits include 128 cached entries, at most eight pending unique jobs, a 10-second fetch deadline and an 8 MB streamed-response ceiling; terrain has an overall 10-second deadline across at most four tiles. These are prototype safeguards, not a distributed global quota guarantee.

| Provider | Use and restrictions |
|---|---|
| OpenFreeMap / OpenMapTiles / OpenStreetMap | Map picking only; credit always visible. Map resources have a 12-second timeout and fixed-host protocol wrapper. |
| Photon | Explicit submitted search only; up to five results; process-local minimum interval 1.1 seconds; cached one day. |
| PVGIS 5.3 | 1 kWp crystalline-silicon model, 14% losses, optimal orientation; result includes database, period, version and acquisition time. Process-local one-second interval; cached 30 days. |
| Overpass / OpenStreetMap | Mapped roads, building ways, waterways, power and land use within 100 m of the actual boundary. The broader query box is post-filtered geometrically. Counts are mapped ways, not addresses or a complete census. Process-local 10-second interval; cached one day. |
| AWS Terrain Tiles | Regional context only. Each tile's complete source-header list must consist solely of licensed `srtm/`, `gmted/` or `uk_lidar/` sources. Missing metadata, EUDEM and Copernicus are rejected. Source filenames and attribution survive save/reload. |

GMTED fallback is reported as **250 m or coarser**, even when the sampling grid is about 30 m. Nearby corners may share cells; displayed decimals do not imply survey accuracy. UK data uses the actual AWS archive and Environment Agency 2015 attribution, not the current 2022 catalogue. Full licence texts, source URLs and dates are in [LICENCES.md](../LICENCES.md); selection and operational choices are in [DECISIONS.md](../DECISIONS.md).

## Three georeferenced examples

These are example user-drawn outlines at real locations, **not verified parcels, cadastral records or surveyed properties**. No survey, planning rule or foundation was supplied for them. Their buildable area, earthworks and foundation results therefore remain unavailable. The full original responses, timestamps, query URLs and corner coordinates are in [the provider evidence](../EVIDENCE-SITE-PROVIDERS-2026-10-27.json). The [nine-page printable report](evidence/real-location-reports-a4.pdf) has been visually checked on every page.

| Drawn measurement | Tamarin, Mauritius | Curepipe, Mauritius | York, United Kingdom |
|---|---:|---:|---:|
| First corner latitude | −20.3292161 | −20.3162000 | 53.9654000 |
| First corner longitude | 57.3776792 | 57.5231000 | −1.0827000 |
| Area, m² | 500.808 | 500.807 | 504.407 |
| Perimeter, m | 90.069 | 90.068 | 90.374 |
| Shortest / longest side, m | 20.024 / 25.010 | 20.024 / 25.010 | 20.132 / 25.055 |
| Perches / arpents | 11.8647 / 0.11865 | 11.8646 / 0.11865 | 11.9499 / 0.11950 |

The approximate conversion used is **1 perche = 42.21 m²; 1 arpent = 4,221 m²**. The report asks users to confirm the unit definition on their title. The York row shows the same conversion for comparison; it does not imply those are UK title units.

| Public context | Tamarin | Curepipe | York |
|---|---:|---:|---:|
| Corner heights, m | 10.000, 11.000, 11.000, 10.000 | 557.000 at all four corners | 14.059, 14.305, 14.504, 14.203 |
| Reported terrain resolution | 250 m or coarser | 250 m or coarser | About 30 m sampling |
| Best-fit slope | 3.998% / 2.290° | 0.000% / 0.000° | 1.386% / 0.794° |
| Downhill aspect from north | 270.00° | Unavailable: level fitted plane | 308.03° |
| PVGIS annual yield, kWh/kWp/year | 1,444.10 | 1,324.68 | 974.22 |
| PVGIS optimal tilt | 16° | 16° | 42° |
| Roads / buildings / utilities / land use | Unavailable | Unavailable | Unavailable |

All three solar results use **PVGIS 5.3, PVGIS-SARAH3, period 2005–2023**. No roof-shadow or production guarantee is inferred.

| Original acquisition (UTC) | Terrain | Solar |
|---|---|---|
| Tamarin | 2026-10-27 19:57:07.884 | 2026-10-27 19:57:11.185 |
| Curepipe | 2026-10-27 19:57:29.629 | 2026-10-27 19:57:30.689 |
| York | 2026-10-27 19:57:45.218 | 2026-10-27 19:57:43.120 |

Tamarin and Curepipe source headers name `srtm/S21E057.tif` and `gmted/30S030E_20101117_gmted_mea075.tif`. Exact contributing source per pixel is not identified by the composite. York names `uk_lidar/LIDAR-DTM-2M-SE55.tif` and `uk_lidar/LIDAR-DTM-2M-SE65.tif`. The public composite's orthometric reference requires a local benchmark/datum transformation for survey use.

Overpass returned HTTP 502 capacity errors or reached the bounded 10-second timeout during all three report runs. A bounded direct diagnostic stated that all query workers were busy and the queue was full. The errors are preserved; no zero counts or invented nearby features were substituted. Refresh failure retains any previously saved result with its original acquisition timestamp.

## Validation and evidence

| Check | Result |
|---|---|
| `npm run build` | Passed, including client and middleware TypeScript checks |
| Full regression suite | **402 files / 4,378 tests passed** |
| Focused Site/API suite | **80 tests passed**, including 35 hostile-payload normalization cases |
| Site/API ESLint | Passed with zero warnings |
| Separate strict API TypeScript compilation | Passed |
| Exact CI API config after typed-mock correction | `npx tsc --noEmit -p api/tsconfig.json` passed; all eight provider tests passed again |
| `git diff --check` | Passed |
| Existing estimator source and tests | Byte-for-byte unchanged; no diff under `src/designer` |
| Desktop 1440 × 1000 / phone 390 × 844 | No JavaScript errors or horizontal overflow in recorded offline smoke; zero live provider requests |
| Live map | Corrected Tamarin town-centre anchor shows streets/buildings; linked attribution remains visible |
| Phone survey save/reload | Traverse → imported survey → declared datum → platform → planning assumptions → apply → reload retained geometry, source, points and results |
| A4 output | All three offline-report pages and all nine geographic-report pages rendered and visually inspected; no clipping or overlap |
| Final normal-preview phone smoke | Passed at 390 × 844: plain demo Site entry hidden; `?site=1` opens the report with banner, boundary label, unavailable states and visible close control; zero map/provider requests, JavaScript/console/HTTP errors or document/report overflow. [Recorded checks](evidence/preview-smoke.json). |

The mathematical fixtures cover metre conversion and orientation, triangle area and Mauritius conversion, decimal/quadrant bearings, exact closure and a visible 1 m residual, self-touch/date-line/large-boundary rejection, concave triangulation, flat and mixed-sign cut/fill, clipping and incomplete coverage, contour constraints/conflicts, slope/aspect, convex setbacks and unsupported concave envelopes. Persistence checks reject forged redundant coordinates and malformed nested source data. The unchanged foundation estimator is rerun on a detached model and the original model remains byte-identical. Provider tests include bounded bodies, retry guidance and source/admission checks.

The recorded phone roundtrip is a manufactured numerical fixture: a 25 × 20 m outline, four surveyed input points at level 102 m, declared local benchmark, platform 100 m, 2 m assumed setback and 40% assumed coverage. It produces **1,000 m³ cut / 0 m³ fill**, a **336 m² setback envelope** and **200 m² illustrative footprint**. These are test inputs, not site evidence. The source and values survive page reload.

| Evidence | What it demonstrates |
|---|---|
| [Desktop boundary](evidence/site-desktop-boundary.png) | Boundary workspace and offline controls |
| [Phone boundary](evidence/site-phone-boundary.png) | 390 × 844 layout |
| [Desktop report](evidence/site-desktop-report.png) | Report hierarchy, diagram and source labels |
| [Phone report](evidence/site-phone-report.png) | Narrow-screen report layout |
| [Phone survey after reload](evidence/site-phone-survey-reload.png) | Survey-source persistence and calculated result |
| [Live land map](evidence/site-live-map-land.png) | Actual OpenFreeMap streets/buildings and visible credits |
| [Offline A4 report](evidence/site-report-a4.pdf) | Three visually checked pages; early offline sample snapshot, not live geographic evidence |
| [Three geographic A4 reports](evidence/real-location-reports-a4.pdf) | Nine visually checked pages with actual public values and explicit gaps |
| [Offline browser results](evidence/smoke.json) | Network/error/overflow observations and text snapshots |
| [Live browser results](evidence/live-smoke.json) | Live map/report checks and provider failure states |
| [Roundtrip browser results](evidence/roundtrip.json) | Saved payload and restored report from the numerical fixture |
| [File manifest](evidence/MANIFEST.json) | Exact byte counts and SHA-256 hashes for the selected screenshots, PDFs and browser records: **1,108,507 bytes** before this manifest and integration audit additions |
| [Static bundle audit](evidence/bundle-audit.json) | Independent emitted-asset sizes and static import closure |
| [Lighthouse comparison](evidence/lighthouse-inherited.txt) and [normalized assertions](evidence/lighthouse-inherited.json) | Site PR #54 compared independently with merged PR #51; inherited failures remain visible |

The offline PDF and early smoke snapshots precede the corrected live Tamarin anchor and final acquisition-time wording; their purpose is layout/offline QA. Use the live land-map screenshot, final geographic PDF and provider evidence for the corrected location and source provenance. No stale ocean-map screenshot is included.

## Bundle audit

Values below are from the successful production build; kB are the build tool's reported units. The independent static audit also records exact filesystem bytes and gzip sizes. The map and workspace load after explicit Site activation. The worker and map are never requested by the fixed demo sample.

| Asset | Raw kB | Gzip kB |
|---|---:|---:|
| Site workspace JavaScript | 38.10 | 13.73 |
| Site workspace CSS | 8.90 | 2.44 |
| Site map JavaScript, including MapLibre | 1,090.16 | 299.33 |
| Site map CSS | 71.55 | 10.18 |
| MapLibre worker | 519.81 | 151.62 (independent audit) |
| Existing property store chunk, including new canonical Site validation helpers | 100.96 | 34.19 |

The heavy feature assets are deferred. Saved-input normalization and local geometry helpers enter the existing property-store graph so imported designs are validated before use. The independently measured property-store chunk is **101,012 bytes / 34,185 bytes gzip**, compared with **88,628 / 29,835** at the base: an eager increase of **12,384 bytes raw / 4,350 bytes gzip**. This is the store-chunk comparison, not an assertion of the total early application delta; the small launcher and plot-display adapters also enter existing code. This is implementation code, not only a button. The literal **zero new feature code before first picture gate is unmet**. Synchronous canonical saved-data validation is retained rather than weakened or made asynchronous to hide those bytes. Workspace, map and worker deferral pass the static closure check; timing is assessed separately below. These statements must not be collapsed into a blanket zero-code claim.

## Deliberate limits and skipped work

- Satellite, Google, accounts, keys, OCR, cadastral verification, shared sessions and headset work remain excluded by the authorized scope.
- No automatic local planning entitlement is claimed. Height, use, easements, access and district requirements still need appropriate sourced input and review.
- Public terrain is coarse regional context, can lack an admissible source and may show a flat fitted plane because corners share cells. It never drives cut/fill or foundation depth.
- The foundation scenario is an explicit uniform datum translation, not a terrain-fitted foundation redesign. No new structural or geotechnical calculation was introduced.
- Supported boundaries have 3–200 corners, a maximum 500 m span, latitude within ±85°, no date-line wrap, no self-touch/overlap and no corner spacing under 1 cm. Tiny residual closing edges can therefore be rejected instead of silently corrected.
- Survey surfaces must cover the whole outline. Contours are bounded and must not cross or disagree with spot heights. No extrapolation fills unmeasured gaps.
- Public-service failures and missing regional licences can leave fields unavailable. Process-local throttles do not promise a durable global quota or service availability.
- Headless phone viewport evidence is not physical iPhone/iPad testing. No physical-device or paired performance pass is asserted here.
- The existing dependency audit reported 59 findings across the repository tree; unrelated broad dependency upgrades were not included in this feature change.

## Final preview and CI gates

[PR #54](https://github.com/victorcassiusoffice-sketch/ppw-designer-2d/pull/54). [Normal branch preview](https://ppw-designer-2d-git-gpt-olb-site-map-2026-10-27-victor-ppw.vercel.app/demo?site=1&view=2d&pitch=1). Runtime code is `f25f4d8fc8c9dc9829b773dfeba256482be5083b`; `7916fa0f39fd38df69e4ee5bb25d39dc840589f8` changes a test type and evidence only. The test mock is now typed with `vi.fn<typeof fetch>`; exact API-config TypeScript and all eight provider tests pass. Initial failed CI is retained in history.

The inherited Lighthouse failures are the same 22 assertions as merged PR51, with no new error-level assertion; [Site-specific comparison](evidence/lighthouse-inherited.txt). The latest run adds a plumbing LCP timing warning (0.89 versus the 0.9 warning threshold; 1,202 ms) and drops the prior bootup-time warning. Typecheck/test fixes do not change the Lighthouse routes. The all-green CI gate is **unmet**. No gate was weakened. Final workflow states are also recorded in the handoff.

Copied PR51 t14 loop, fresh Chromium process/profile for each navigation, fresh browser caches (native GPU-driver caches were not controlled), native Intel Iris Xe/D3D11, no CPU or network throttle. Desktop 1280 × 800; phone 390 × 844 touch emulation on the same laptop, not a physical phone. Production and preview starts are separated by less than 60 seconds in every pair; all results are retained. Preview hosts use the original harness DNS pin to 216.198.79.3. Different host/CDN paths can contribute; these measurements do not isolate a code-only cause. Primary times use the original loading-hidden wait; independent in-page canvas marks are also retained.

| Viewport | Pair | Production s | Preview s | Delta ms | Start gap s |
|---|---:|---:|---:|---:|---:|
| desktop | 1 | 4.203 | 6.346 | +2143 | 15.5 |
| desktop | 2 | 4.577 | 4.939 | +362 | 16.4 |
| desktop | 3 | 4.298 | 5.569 | +1271 | 8.0 |
| desktop | 4 | 4.215 | 4.979 | +764 | 17.6 |
| desktop | 5 | 4.381 | 7.353 | +2972 | 12.8 |
| phone | 1 | 4.352 | 5.100 | +748 | 9.4 |
| phone | 2 | 4.579 | 5.149 | +570 | 9.0 |
| phone | 3 | 3.710 | 4.923 | +1213 | 7.5 |
| phone | 4 | 4.721 | 5.313 | +592 | 8.8 |
| phone | 5 | 4.907 | 4.843 | -64 | 8.5 |

9/10 preview pairs are slower by the primary harness measure; 10/10 are slower by the independent canvas mark. The no-slower-pair gate is **FAILED**. All navigation/JavaScript/HTTP error counts in these paired runs were zero. Raw observations and time origins: [t14 JSON](evidence/t14-load-timed-prod_site-desktop_phone.json); [summary](evidence/site-paired-summary.json).

Median first picture: laptop 4.30 s production / 5.57 s preview; phone 4.58 / 5.10 s. Laptop <3 s and every-phone-run <5 s budgets are not met. Literal zero-new-code before first picture also remains unmet for the explicitly quantified persistence adapters above.

Opening the real map has provider/network variability; no physical-device or guaranteed sub-second map-entry claim is made. The offline sample, provider evidence and fully inspected report files remain available without representing the sampled outlines as verified cadastral plots.
