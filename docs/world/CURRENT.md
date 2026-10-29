# World current state

Finish round 2 completed 29 October 2026 at 11:28 MU. Both PRs remain review candidates with failed gates. Measured application heads: Walk `d78064f9f57ed6e060d9782036b4a8b7a7e95451`, Site `b3727b1d20fff6be3ac448dfe8bf11e9261ad500`. Both include PR #52 `56d852d1f2f5d7342b9e02194964d6b998c795c7` by normal forward merge; main remains `3eefbf7646f2b5c76e5297f7836e6e0336e8f1a2`. Later evidence commits do not change those application trees.

[Current report](finish/evidence/REPORT.md), [all pairs](finish/evidence/timings-and-static.json), [rubric](RUBRIC.md), [round log](ROUNDS.md). The paired and 1 KB seam gates pass: +489/+940 gzip bytes, same 36 early HTTP paths. Desktop absolute startup and all-run loading paint still fail. Walk strict FPS, Site print and contrast are repaired; laptop input and the new phone door-tap follow-up remain unresolved.

The once-per-Finish release/provider review was completed 28 October at 13:53 MU: [primary sources](finish/current-research.md). No library upgrade was made.

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

Five fresh interleaved runs per device: Walk wall/canvas medians 4,299/4,165.9 ms desktop and 4,149/4,019.2 phone; Site 4,838/4,718.8 and 3,710/3,579.8. Base is 5,257/5,136.7 desktop and 4,209/4,142.9 phone. All paired median comparisons pass; both desktop medians miss 3 seconds; phone medians satisfy 5 seconds. Only 9/20 candidate FCPs meet one second. Six candidate HTML response starts already exceed that second, including connection/TLS time; this is not all attributed to server processing.

Chooser 152/157 ms passes. Desktop strict FPS is 60/60, phone 58.5/59.35, with lows and stalls retained. Original designer frames pause while covered and resume after Exit. Laptop zero-settle third-person input has one 383.4 ms sample and a diagnostic reproduces 444.9 ms. Desktop door/Exit/restoration passes; native one-pointer phone movement/run/view/Controls/Exit passes, but its door tap does not produce the expected Close prompt. No human comprehension or physical ergonomics evidence is invented.

Site's fresh seven-case live/offline suite passes search/draw/edit/Undo/survey/source tags/attribution and the preview-live production guard. All eight actual A4 pages pass visual and text/bounds inspection, complete disclaimer included. Both brands/devices/themes pass 96 button contrast checks, minimum 7.9744:1. Quality, secrets and Vercel checks pass both exact heads. Lighthouse fixes 15/22 inherited errors; seven remain with reasons in [the classification](finish/evidence/lighthouse-classification.json), no new IDs and no settings/threshold changes.

Preview-only tester entry remains **/demo?site=1&live=1**, then Site. Existing healthcheck must report env=preview; production/errors/timeouts stay offline. All eight final visible-rule screens pass; protected estimators/data/currency, old tests and thresholds are unchanged. Evidence replaces prior bulk and stays below 5 MB per PR.

Next three: (1) diagnose and fix the reproduced input stall and native phone door interaction; (2) diagnose startup network/native graphics/paint timing without lowering quality or changing the gate; (3) safely trim only the isolated pitch's base CSS and improve device-specific controls copy. Keep human-proof limitations visible.

## Standing improvement cycle

Continue measured rounds under the amended Finish instruction, up to 10. An item failing three consecutive real rounds is recorded OPEN with all three attempts and a next idea, then left for the final handoff. Read ROUNDS/LESSONS and fetch before every round. Never rebase or force-push; no production merge, manual deploy, account, key, environment addition or spending. No final handoff yet.

The diagnostic input trace finds the renderer main thread mostly idle for 438 ms while the private Walk GPU context has a 496 ms command-buffer flush; the following Walk tick takes 6.253 ms. The exact graphics operation is unknown. This supports a bounded deferred scene-preparation experiment, not a claim that shader compilation caused the stall. The phone result also does not distinguish an undelivered tap from a valid short-lived collision-safety rejection; Round3 must capture actual click/status events.
