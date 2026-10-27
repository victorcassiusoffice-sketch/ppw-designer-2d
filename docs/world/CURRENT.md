# World current state

Last stay-current check: **2026-10-27**. This file describes the Stage 2 branch candidates, not a production deployment. No merge or deployment is authorized. Base for both builds: `3eefbf7646f2b5c76e5297f7836e6e0336e8f1a2`. Branches: `gpt/olb-walk-mode-2026-10-27` and `gpt/olb-site-map-2026-10-27`. PR numbers, preview verification, final scores and measurements are **pending the integration owner's evidence pass**.

## Components and releases

Versions were read from the installed package manifests/lockfiles; available versions and publication timestamps were read from the primary npm registry on 2026-10-27. “Latest” is that date's registry `latest` tag, not an automatic upgrade instruction.

| Component | Stage 2 candidate | Latest available, publication date (UTC) | Source / choice |
|---|---|---|---|
| Three | 0.186.0, retained on both branches | 0.186.1 — 2026-09-24 14:42:21 | https://registry.npmjs.org/three. Preserve existing renderer baseline; a patch upgrade requires regression/performance evidence. |
| MapLibre GL JS | 6.16.0, Site branch only | 6.16.0 — 2026-10-25 13:17:01 | https://registry.npmjs.org/maplibre-gl. Deferred map UI. |
| three-mesh-bvh | 0.9.16, Walk branch only | 0.9.16 — 2026-10-08 05:46:08 | https://registry.npmjs.org/three-mesh-bvh. Deferred collision module. |
| Draco converter package | draco3dgltf 1.5.7, existing build tooling | 1.5.9 — 2026-10-16 19:27:04 | https://registry.npmjs.org/draco3dgltf. Used for four GLB conversions; not substituted for the served decoder. |
| glTF Transform | 4.5.0, existing build tooling | Not part of this round's release-comparison scope | Existing repository tooling; conversion recipe in `characters/prepare.mjs`. |
| Runtime Draco decoder | Existing Three r186 glTF-targeted binary; no embedded semantic version | Compare to the installed Three distribution, not npm encoder version | Existing `/draco/` files, Apache 2.0. WASM matches Three r186 byte-for-byte. |

Runtime decoder files, unchanged by the character conversion:

| File | Bytes | SHA-256 |
|---|---:|---|
| `draco_decoder.wasm` | 192,420 | `a680d927bed9cb864ddbd63521868891af2bfbe755092761b4837487618df8ac` |
| `draco_wasm_wrapper.js` | 58,572 | `f3ab54e2feabfe8bd37928b5f400bc10230dcc278c7e70bca5e025f63519d960` |
| `draco_decoder.js` (fallback) | 512,498 | `a47cd7c84911c5175bb0511c01ba41ddafb71873fd391f055def514398f5e7c4` |

The normal WASM path uses the wrapper and WASM; the JavaScript fallback is an alternative, not a required extra download. Entry pause and actual network trace still need the integration measurement. No decoder preload is added to the first-picture path.

## Character pack

**Kenney Mini Characters 1.0**, created 17 July 2024, CC0. Author: https://kenney.nl/assets/mini-characters. Archive SHA-256: `9e1d48e6d7b8479ebbe84df71eb5bd8e1b3f0da546dea641890dccc8a02d0999`, 2,403,059 bytes, downloaded and checked 2026-10-27. Exact download URL and full licence are in `LICENCES.md`. Quaternius Ultimate Modular Men/Women remains unselected: the author-linked downloads returned quota errors for their licence files. No usable Quaternius archive was obtained, so archive hashes and converted size/animation claims are unavailable. Recheck availability in a future authorized round.

Four characters only. Original PNG textures are embedded in each delivered GLB. Idle/walk/run map to `idle`/`walk`/`sprint`. +Y up, +Z forward, feet y≈0; runtime fits the model height to the controller target. Stylized proportions are an acknowledged fallback. Chooser thumbnails are author PNG previews, 7,231 bytes total, requested after Walk opens.

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

Server-process caches and throttles do not persist across restarts and do not coordinate multiple server instances. Browser cache also has bounded entries/expiry. The final report must not claim a durable global quota limiter. Requests are fixed-origin and bounded; provider failure retains the boundary and reports unavailable. API resilience, Retry-After behavior and multi-instance operating limits remain part of the integration review.

Verified source samples: Mauritius `srtm/S21E057.tif` plus `gmted/30S030E_20101117_gmted_mea075.tif` (AWS tile last modified 2017-11-18); London `uk_lidar/LIDAR-DTM-2M-TQ28.tif` plus `TQ38.tif` (2017-11-15); Paris `eudem/eudem_dem_5deg_n45e000.tif` (2017-11-15, rejected). These old archive dates are shown as source currency evidence, not current ground conditions. UK credit uses the provider's **Environment Agency 2015** notice, not the current catalogue's 2022 release.

## Function boundaries and exclusions

Walk is a read-only session; E/tap deliberately toggles doors in both views, walking into a door does not open it, and an occupied closing path keeps the door open. Four avatars and a first-use controls card are the initial scope. Session door/camera/character state must not change the saved design. Walk adds no backend/provider calls.

Site is map-first and prints “Satellite view: not available yet.” It supports a drawn boundary or manually typed surveyor-plan traverse; neither is presented as cadastre-verified. Traverse closure residual is retained; no silent Bowditch adjustment. Survey/typed what-if levels are distinct from public regional terrain. Unknown planning permissions remain unavailable. Uniform setbacks are supported on convex polygons; concave inset envelopes are withheld with a clear explanation. Constrained survey triangulation rejects unsupported gaps instead of extrapolating. Foundation scenarios call the unchanged estimator on a clone with an explicit datum shift; no soil/depth is inferred from DEM data.

No Google code path/key/environment variable; no anonymous Esri or NASA plot-scale satellite layer; no Copernicus/OpenTopography/Open-Elevation; no Mixamo, new login, paid asset, AI character or unlicensed model. Satellite, OCR, building sun-shadow simulation, shared walk and headset view remain backlog items requiring Victor's own instruction. `/demo` remains price-free and has no client name, phone, WhatsApp or cart count; the authorized meeting URL remains `https://calendly.com/victorcassius-office/ppw-online-face-to-face-meeting-1-hour`.

## Evidence status and next work

Final bundle sizes, first-picture timing pairs, walk entry pause, average/1% low FPS, chooser latency, CI status, preview URLs and rubric scores: **pending integration measurement; no passing result implied**. The asset-only checks above are complete. Physical-phone performance cannot be established by a 390 × 844 desktop viewport alone.

The lowest three rubric scores are **pending the first scored run**. The integration owner must replace this line with actual scores and evidence before the Stage 2 hand-back; do not manufacture a ranking from unrun checks.

Provisional next three improvements, to be reordered after the scored run:

1. Address the lowest measured Walk collision/camera/input or phone-performance score, preserving read-only design state.
2. Address the lowest measured Site report/print/input score; extend unsupported concave planning or survey cases only with validated geometry and clear provenance.
3. Recheck Quaternius source availability and Three/Draco patch releases; replace/upgrade only after licence, animation and paired first-picture gates pass. Reassess public-provider operating limits before broader use.

## Standing improvement cycle

After each authorized merge, the Claude tester scores production and saves evidence under `06-Roadmap/_handoff/test-evidence-<date>/world/`. The Commander combines the lowest scores and the next-three list into one fix-round prompt. Codex implements that round as one PR, re-scores, updates this file and `DECISIONS.md`, and hands back. Production merges remain Victor's explicit “merge <n>” instruction to the Commander.

Run weekly while any rubric item is below 2; run a stay-current review every four weeks regardless. Each review checks releases of Three/MapLibre/BVH/decoders, CC0 character/prop packs, provider terms/rates, and current-demo phone performance. No scheduled automation, deployment, new account or external notification was created by writing this operating cadence. The Commander-owned cycle does not grant an agent permission to merge or spend.
