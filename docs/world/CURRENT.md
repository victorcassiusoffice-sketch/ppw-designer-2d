# World current state

Last stay-current check: **2026-10-28**. This file describes the Stage 2 branch candidates, not a production deployment. No merge or deployment is authorized. Base for both builds: `3eefbf7646f2b5c76e5297f7836e6e0336e8f1a2`. Branches: `gpt/olb-walk-mode-2026-10-27` and `gpt/olb-site-map-2026-10-27`. Open candidates: [#53 Walk mode](https://github.com/victorcassiusoffice-sketch/ppw-designer-2d/pull/53) and [#54 Site from the map](https://github.com/victorcassiusoffice-sketch/ppw-designer-2d/pull/54). Integration evidence updated 28 October 2026 Mauritius time; Fix round 1 release check refreshed 28 October 2026.

## Components and releases

Versions were read from the installed package manifests/lockfiles; available versions and publication timestamps were read from the primary npm registry on 2026-10-28. “Latest” is that date's registry `latest` tag, not an automatic upgrade instruction.

| Component | Stage 2 candidate | Latest available, publication date (UTC) | Source / choice |
|---|---|---|---|
| Three | 0.186.0, retained on both branches | 0.186.1 — 2026-09-24 14:42:21 | https://registry.npmjs.org/three. Preserve existing renderer baseline; a patch upgrade requires regression/performance evidence. |
| MapLibre GL JS | 6.16.0, Site branch only | 6.16.0 — 2026-10-25 13:17:01 | https://registry.npmjs.org/maplibre-gl. Deferred map UI. |
| three-mesh-bvh | 0.9.16, Walk branch only | 0.9.16 — 2026-10-08 05:46:08 | https://registry.npmjs.org/three-mesh-bvh. Deferred collision module. |
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

Terms/source pages below were **checked 2026-10-27**. This is the access date, not a claimed legal effective date. A numeric cap that is not published is marked that way; no “free” service is described as an availability guarantee. No provider requires a new account, key, card, login, environment variable or added paid infrastructure.

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

Fix round 1 measured code: Walk **554fb61eb161a020d3ba5087a14066307aabdc2b**, Site **2c6743a1a00fea395556358d011fa323b81b0018**. Final documentation heads are listed in the handoff; application trees match these measured code commits. Regular CI passes **4,351 tests / 404 files** and **4,402 tests / 408 files**, root/API/middleware typechecks and secrets scans. Lighthouse still fails on exactly the same 22 error-level assertions as main 3eefbf7; settings/thresholds unchanged and repair explicitly outside this round.

Canonical Site validation/geometry now hydrate after first picture (2D: after plan paint), before any geographic figures. Saved no-world payloads do not import them; all original persistence tests remain. Retained saved-world preview trace at 017e16d (later change only loading focus): picture 4,794.5 ms, hydration request 6,656.9 ms, canonical world retained and unknown canary removed. Its 8 s polling wait expired before the successful final inspection; this is not a claim of instant hydration. Bad extensions retain the legacy plot with a warning.

Preview-only tester entry: **/demo?site=1&live=1**, then Site. The existing /api/healthcheck must answer **env=preview**; production, errors and timeout stay offline. No new environment variable, code/account/login/key or production switch. Both sizes passed actual map/visible credits/explicit search/draw/report. Plain /demo?site=1 stays offline with the practice-outline hint and no map-credit DOM.

The literal static gate is **NOT PASSED**. Controlled App+ThreeStage closure: Walk +1968 raw/+744 gzip; Site +2570 raw/+953 gzip. Walk's 45 raw / 12 gzip Three aliases count zero by the Commander's ruling; the remaining integration adapters do not have an exception. Site's previous 4,350 gzip validator growth is removed, but its opaque preservation, launch/focus and plot adapters remain. No separate Walk/Site implementation chunk was requested early. Bootstrap code is still inside App and counts in the failed byte gate. The existing OLB shell preloads two fonts that the required base PPW shell does not request; unchanged middleware explains this difference. Against the custom OLB domain there are no new request paths. Whole observed-file comparisons, including route/HTML/CSS/public files, are in each fix1 report. Do not infer byte equality from equal request counts.

walk: desktop original medians preview/base 5.379/4.999 s (7.6%,PASS); canvas 5.291/4.462 s (18.6%); phone original medians preview/base 5.432/4.231 s (28.4%,FAIL); canvas 5.370/4.192 s (28.1%)

site: desktop original medians preview/base 5.882/5.027 s (17.0%,FAIL); canvas 5.488/4.784 s (14.7%); phone original medians preview/base 6.541/4.616 s (41.7%,FAIL); canvas 5.789/4.550 s (27.2%)

Final deployed non-forced action→frame with all four decoded thumbnails: **117.0 ms desktop / 237.0 ms phone**: **PASS** against one second on both devices. The original harness's click-call→visible check is **113.0 / 233.0 ms**. DOM-event→decoded-frame timing is **74.3 / 65.4 ms**, recorded separately. Initial code ad78930 failed at 7,386 / 1,363 ms; those results and native-click repeats are retained in walk-performance-initial.json and chooser-diagnostic.json. CPU profiling identified synchronous shader first-use in the AO beauty pass and hidden plan thumbnails. The repair asynchronously warms the matching shader variants before their existing draws, with scene/target restoration and queue-lifetime regressions. Image resolution, lighting, camera, geometry and first-picture scheduling are unchanged. Entry pause remains separate.

Input render submission: desktop max 31.5 ms, phone max 43.8 ms over five samples/view/device. No movement tuning was needed. Door retained-close and first Esc-unlock/second Esc-exit pass actual browser checks. Narrow office same-pose camera pairs show the compressed camera looking above the head; an impossible external camera space switches explicitly to first person while preserving world collision.

Lowest three priority scores: **first picture/static bytes 1**, **frame pacing/physical validation 1**, **first-use comprehension 1**. Physical one-hand use also remains 1. Chooser is now 2 after the deployed whole-action pass. No scores of 3.

Next three improvements:

1. Provide a baseline extension seam and persistence support to resolve the early integration byte contract; preserve failed pairs and never count adapters under the alias exception.
2. Measure steady frame pacing on physical phones after the shader fix, keeping entry and cold chooser results separate from ongoing movement.
3. Test first-use controls and one-hand navigation on physical phones. Continue the four-week primary-source/version review before upgrades.

Absolute 3 s / 5 s work belongs to PR #52; inherited Lighthouse repair has its own row/round. Neither was attempted. Satellite/OCR/shadows/shared walk/headset remain excluded. No merge, force-push, main push, manual deployment, migration, new environment/account/key or message was performed.

## Standing improvement cycle

After each authorized merge, the Claude tester scores production and saves evidence under `06-Roadmap/_handoff/test-evidence-<date>/world/`. The Commander combines the lowest scores and the next-three list into one fix-round prompt. Codex implements that round as one PR, re-scores, updates this file and `DECISIONS.md`, and hands back. Production merges remain Victor's explicit “merge <n>” instruction to the Commander.

Run weekly while any rubric item is below 2; run a stay-current review every four weeks regardless. Each review checks releases of Three/MapLibre/BVH/decoders, CC0 character/prop packs, provider terms/rates, and current-demo phone performance. No scheduled automation, deployment, new account or external notification was created by writing this operating cadence. The Commander-owned cycle does not grant an agent permission to merge or spend.
