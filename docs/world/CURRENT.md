# World current state

Finish round1 completed 28 October 2026. Neither PR is merge-ready. Authoritative measured heads: Walk`c8941925da4640cf02d6c4ecb864d3914993a180`, Site`7ed40b6bff89067623a4939f251be1ed5cd6e870`; later documentation commits do not change those application trees. Both include open PR52`56d852d1f2f5d7342b9e02194964d6b998c795c7` by forward merge. Main remains`3eefbf7646f2b5c76e5297f7836e6e0336e8f1a2`. No history rewrite.

[Round report](finish/evidence/REPORT.md), [all exact pairs/files](finish/evidence/measurements.json), [rubric](RUBRIC.md), [resume log](ROUNDS.md). Early JS passes the amended1KB seam gate (+690gzip Walk/+935Site); zero new pre-picture request paths. Desktop first-picture/loading-paint, Site phone paired wall, desktop input/FPS and repeated print banner still fail. Human comprehension and physical one-hand use remain unmeasured.

The once-per-Finish release/provider review was completed28October13:53MU: [primary-source evidence](finish/current-research.md). Installed versions below remain unchanged.

## Components and releases

Versions were read from the installed package manifests/lockfiles; available versions and publication timestamps were read from the primary npm registry on 2026-10-28. “Latest” is that date's registry `latest` tag, not an automatic upgrade instruction.

| Component | Stage 2 candidate | Latest available, publication date (UTC) | Source / choice |
|---|---|---|---|
| Three | 0.186.0, retained on both branches | 0.186.1 — 2026-09-24 14:42:21 | https://registry.npmjs.org/three. Preserve existing renderer baseline; a patch upgrade requires regression/performance evidence. |
| MapLibre GL JS | 6.16.0, Site branch only | 6.16.0 — 2026-10-25 13:17:01 | https://registry.npmjs.org/maplibre-gl. Deferred map UI. |
| three-mesh-bvh | 0.9.16, Walk branch only | 0.9.17 — 2026-10-28 08:05:16 | https://registry.npmjs.org/three-mesh-bvh. Deferred collision module. |
| Draco converter package | draco3dgltf 1.5.7, existing build tooling | 1.5.9 — 2026-10-16 19:27:04 | https://registry.npmjs.org/draco3dgltf. Used for four GLB conversions; not substituted for the served decoder. |
| glTF Transform | 4.5.0, existing build tooling | 4.5.1 — 2026-09-28 12:48:27 (primary npm registry checked 2026-10-28) | Existing repository tooling; conversion recipe in `characters/prepare.mjs`. |
| Runtime Draco decoder | Existing Three r186 glTF-targeted binary; no embedded semantic version | Compare to the installed Three distribution, not npm encoder version | Existing `/draco/` files, Apache 2.0. WASM matches Three r186 byte-for-byte. |

Runtime decoder files, unchanged by the character conversion:

| File | Bytes | SHA-256 |
|---|---:|---|
| `draco_decoder.wasm` | 192,420 | `a680d927bed9cb864ddbd63521868891af2bfbe755092761b4837487618df8ac` |
| `draco_wasm_wrapper.js` | 58,572 | `f3ab54e2feabfe8bd37928b5f400bc10230dcc278c7e70bca5e025f63519d960` |
| `draco_decoder.js` (fallback) | 512,498 | `a47cd7c84911c5175bb0511c01ba41ddafb71873fd391f055def514398f5e7c4` |

The normal WASM path uses the wrapper and WASM; the JavaScript fallback is an alternative, not a required extra download. Fix 1 measured entry pause is 5.682 s laptop /3.001 s phone viewport; network trace confirms only the selected character loads after selection. No decoder preload is added to the first-picture path.

## Character pack

**Kenney Mini Characters 1.0**, created 17 July 2024, CC0. Author: https://kenney.nl/assets/mini-characters. Archive SHA-256: `9e1d48e6d7b8479ebbe84df71eb5bd8e1b3f0da546dea641890dccc8a02d0999`, 2,403,059 bytes, downloaded and checked 2026-10-27. Exact download URL and full licence are in `LICENCES.md`. Quaternius Ultimate Modular Men/Women remains unselected: the author-linked downloads returned quota errors for their licence files. No usable Quaternius archive was obtained, so archive hashes and converted size/animation claims are unavailable. Recheck availability in a future authorized round.

Four characters only. Original PNG textures are embedded in each delivered GLB. Idle/walk/run map to `idle`/`walk`/`sprint`. +Y up, +Z forward, feet y≈0; runtime fits the model height to the controller target. Stylized proportions are an acknowledged fallback. Chooser thumbnails are the four exact author PNG previews,7,231 bytes total (1,765/1,820/1,775/1,871), embedded in the deferred launcher loaded after first picture. All four decode at 64 × 64 before chooser visibility; no separate thumbnail network race.

| Character | Source | GLB bytes | SHA-256 |
|---|---|---:|---|
| Maya | female-a | 92,780 | `f7cb20396703778fe8f5c2b3d2b46c9c1c89d11f103e92b7522b74102b05c9b3` |
| Lea | female-b | 92,116 | `3c1e619550ca2417021b03df1d09ff3d55c33151c676ed1b3efb6368578bf757` |
| Alex | male-a | 92,204 | `9d3e439ecfb571f6235feac4a0d3e85c7e98244c04b0445fc48210e787f50a8d` |
| Sam | male-b | 91,804 | `a15a654b41c0e3b0334fae432b1056819f458cb1303fc466780d0b4350285936` |

The isolated asset renderer passed texture loading and 24 finite bone-animation sample checks with no page errors; see `docs/world/characters/AUDIT.md` and `render-validation.json` on the Walk branch, where the conversion/evidence files live. This is separate from in-app blending, doors, stairs, chooser latency and physical-phone validation.

## Data providers and limits

Terms/source pages below were **rechecked 2026-10-28**; exact pages and access evidence are in [the Finish review](finish/current-research.md). This is the access date, not a claimed legal effective date. A numeric cap that is not published is marked that way; no “free” service is described as an availability guarantee. No provider requires a new account, key, card, login, environment variable or added paid infrastructure.

| Provider / selected endpoint | Terms and data conditions | Rate/quota and current safeguards |
|---|---|---|
| OpenFreeMap Liberty, `https://tiles.openfreemap.org/styles/liberty` | OSM data ODbL; OpenMapTiles/default design CC BY 4.0; Noto Sans Regular/Italic/Bold OFL 1.1; Maki CC0. Full copies and source links in `LICENCES.md`. [Official guide](https://openfreemap.org/quick_start/) / [service information](https://openfreemap.org/). Visible links: OpenFreeMap © OpenMapTiles Data from OpenStreetMap. | No map-view/request cap advertised; no numeric online rate or SLA published. No offline region download feature. Defer map/style/font/sprite requests until the Site map is opened; demo uses local sample. |
| Photon public demo, `https://photon.komoot.io/api/` | OSM ODbL responses, © OpenStreetMap contributors. [Official public-demo policy](https://github.com/komoot/photon#demo-server): reasonable use only; excessive use can be throttled/banned; no availability guarantee. | No numeric quota promised. Submitted searches only; five results; 24 h server-process cache and 1.1 s process-local separation. Not an aggregate deployment-wide guarantee. |
| AWS Terrain Tiles Terrarium, `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png` | [Exact source header specification](https://github.com/tilezen/joerd/blob/master/docs/data-sources.md). Admit only copied/licensed source prefixes `srtm/`, `gmted/`, `uk_lidar/`; fail closed for missing/mixed unrecognized sources, including EUDEM. USGS public domain / UK OGL v3, with exact source filenames and attribution. | No published monthly quota/numeric rate. At most four z12 tiles per requested plot, bounded fetch and process cache. SRTM about 30 m; GMTED fallback 250 m or coarser; no survey accuracy. Public heights never enter cut/fill or foundations. |
| PVGIS 5.3, `https://re.jrc.ec.europa.eu/api/v5_3/PVcalc` | [JRC API conditions](https://joint-research-centre.ec.europa.eu/photovoltaic-geographical-information-system-pvgis/using-pvgis-5/api-non-interactive-service_en) and [manual](https://joint-research-centre.ec.europa.eu/photovoltaic-geographical-information-system-pvgis/using-pvgis-5/pvgis-5-user-manual_en). Results may be reused; attribution records JRC/PVGIS version and query. Server calls only because browser AJAX is prohibited. | 30 calls/s/IP, HTTP 429 above the limit, 529 under compute overload; no monthly quota published. Candidate uses 1 kWp, 14% losses, optimal angles, 30-day process cache, 1 s process-local separation. Existing no-site solar estimates remain on their original path. |
| OSM Overpass public instance, `https://overpass-api.de/api/interpreter` | ODbL and © OpenStreetMap contributors. [Official commons policy](https://dev.overpass-api.de/overpass-doc/en/preface/commons.html) explicitly discourages relying on public instances as a general-purpose app backend. This is a bounded pilot integration, not a scalable service commitment. | Broad guidance: about 10,000 requests/day and under 1 GB/day; dynamic slots/cooldowns, 429/504 possible. One confirmed-plot context query, 24 h process cache, 10 s process-local separation. No request on every pan. A public production expansion needs a suitable provider/operating decision. |

Server-process caches and throttles do not persist across restarts and do not coordinate multiple server instances. Browser cache also has bounded entries/expiry. No durable global quota limiter is claimed. Requests are fixed-origin and bounded; provider failure retains the boundary and reports unavailable. Bounded-response, Retry-After and admission tests pass; multi-instance quotas remain an operating limitation.

Verified source samples: Mauritius `srtm/S21E057.tif` plus `gmted/30S030E_20101117_gmted_mea075.tif` (AWS tile last modified 2017-11-18); London `uk_lidar/LIDAR-DTM-2M-TQ28.tif` plus `TQ38.tif` (2017-11-15); Paris `eudem/eudem_dem_5deg_n45e000.tif` (2017-11-15, rejected). These old archive dates are shown as source currency evidence, not current ground conditions. UK credit uses the provider's **Environment Agency 2015** notice, not the current catalogue's 2022 release.

## Function boundaries and exclusions

Walk is a read-only session; E/tap deliberately toggles doors in both views, walking into a door does not open it, and an occupied closing path keeps the door open. Four avatars and a first-use controls card are the initial scope. Session door/camera/character state must not change the saved design. Walk adds no backend/provider calls.

Site is map-first and prints “Satellite view: not available yet.” It supports a drawn boundary or manually typed surveyor-plan traverse; neither is presented as cadastre-verified. Traverse closure residual is retained; no silent Bowditch adjustment. Survey/typed what-if levels are distinct from public regional terrain. Unknown planning permissions remain unavailable. Uniform setbacks are supported on convex polygons; concave inset envelopes are withheld with a clear explanation. Constrained survey triangulation rejects unsupported gaps instead of extrapolating. Foundation scenarios call the unchanged estimator on a clone with an explicit datum shift; no soil/depth is inferred from DEM data.

No Google code path/key/environment variable; no anonymous Esri or NASA plot-scale satellite layer; no Copernicus/OpenTopography/Open-Elevation; no Mixamo, new login, paid asset, AI character or unlicensed model. Satellite, OCR, building sun-shadow simulation, shared walk and headset view remain backlog items requiring Victor's own instruction. `/demo` remains price-free and has no client name, phone, WhatsApp or cart count; the authorized meeting URL remains `https://calendly.com/victorcassius-office/ppw-online-face-to-face-meeting-1-hour`.

## Evidence status and next work

Current exact figures are in [Round1 evidence](finish/evidence/REPORT.md). Walk wall/canvas medians5,700/5,183.5ms desktop and4,594/4,577.3phone; Site5,262/5,184.2 and4,727/4,507.2. Both desktop3second and all-run1second loading-paint targets fail; phone absolute5seconds pass. Site phone original paired wall+11.407% fails; both timing definitions remain reported.

Chooser202/465ms call→decoded frame passes1second. Desktop third input median82.3ms and strict desktop58.6/59.7fps fail; phone58.525/59.95fps passes30. Current real door/Exit/pointer-lock/restoration checks pass. Site live search/edit/Undo/surveyor/source tags/attribution pass; disclaimer missing on page2 of both A4 outputs prevents print/banner pass.

Both quality/secrets/Vercel CI pass. Lighthouse now fixes13 of22 inherited errors, with no new failures;9 remain with reasons in [the exact classification](finish/evidence/lighthouse.json). Further safe plumbing isolation is under review; thresholds/settings unchanged.

Preview-only tester entry remains **/demo?site=1&live=1**, then Site. Existing healthcheck must answerenv=preview; production/errors/timeouts stay offline. No access code/account/newenvironment is needed. Deferred canonical validation remains behind first picture and before any Site figure; no-site designs keep their original path.

Next three: (1) actual loading paint and redundant drawing-buffer allocation; (2) pause the covered designer during Walk, preserving restoration and strict measurements; (3) repeated A4 disclaimer plus safe remaining plumbing repairs. First-use instructions and one-hand reach remain improvement/proof gaps, never invented human studies.

## Standing improvement cycle

During this Finish request, run autonomous measured rounds under the amended Finish instruction, up to10, with each item marked OPEN after3 consecutive failed real rounds and a next idea. Read ROUNDS/LESSONS and fetch before every round. Only return the final handoff when all gates or the explicit limit/hard-stop rule is reached. Production merges remain Victor’s explicit action. The earlier Commander-owned weekly/four-week review cadence resumes after authorized merges; no automation/account/spending permission is created by documenting it.
