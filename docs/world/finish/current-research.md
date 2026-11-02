# World Finish — stay-current review

Checked **28 October 2026, 13:53 Mauritius / 09:53 UTC** for Finish requirement J. This was a read-only review: no dependencies, runtime files, accounts, keys, environment variables or repository files changed. Package versions below come from the current branch lockfiles; latest tags and publication timestamps were fetched from the primary npm registry. Provider pages were opened directly. This date is an access date, not a claimed legal effective date.

## Findings to carry into CURRENT.md

- **three-mesh-bvh has a new patch since the previous check: 0.9.17, published today.** Its official release fixes the exact `ExtendedTriangle.closestPointToSegment` method called at Walk `src/walk/collision.ts:36`. This makes it a meaningful candidate for the authorized upgrade/testing cycle, not an automatic upgrade. Keep 0.9.16 unless the full suites and paired runs satisfy the instruction.
- Other requested latest releases are unchanged from the Fix 1 review. Kenney Mini Characters remains **1.0**, released **17 July 2024**, CC0.
- No new provider requirement was found compared with the prior CURRENT.md. The existing Overpass public-backend limitation remains material: it must not be described as a scalable or guaranteed general-purpose app service.

## Components and releases

| Component | Installed / served now | Latest available | Publication UTC | Primary source |
|---|---|---|---|---|
| Three | 0.186.0, both branches | 0.186.1 | 2026-09-24 14:42:21.301 | [npm registry](https://registry.npmjs.org/three) |
| MapLibre GL JS | 6.16.0, Site | 6.16.0 | 2026-10-25 13:17:01.849 | [npm registry](https://registry.npmjs.org/maplibre-gl) |
| three-mesh-bvh | 0.9.16, Walk | **0.9.17** | 2026-10-28 08:05:16.288 | [npm registry](https://registry.npmjs.org/three-mesh-bvh), [official release](https://github.com/gkjohnson/three-mesh-bvh/releases/tag/v0.9.17) |
| Draco upstream decoder release | Existing local Three r186 glTF-targeted decoder; its binary has no separately asserted semantic version | 1.5.9 | Official GitHub release 2026-10-16 19:08; npm package 19:27:04.932 | [official releases](https://github.com/google/draco/releases), [versioned decoder distribution](https://www.gstatic.com/draco/versioned/decoders/1.5.9/) |
| draco3dgltf converter package | 1.5.7, both branches' existing conversion tooling | 1.5.9 | 2026-10-16 19:27:04.932 | [npm registry](https://registry.npmjs.org/draco3dgltf) |
| glTF Transform core (additional tooling check) | 4.5.0, both branches | 4.5.1 | 2026-09-28 12:51:13.194 | [npm registry](https://registry.npmjs.org/@gltf-transform/core) |
| Kenney Mini Characters | 1.0, selected four characters | 1.0 | Author page lists 17 July 2024 | [author pack page](https://kenney.nl/assets/mini-characters) |

The BVH 0.9.17 release also improves SAH build speed and build memory, corrects leaf-root raycasts, and adds asynchronous BVH compute data updates. The collision correctness fix is relevant to current code; performance gains are not assumed without a measurement. [Official release](https://github.com/gkjohnson/three-mesh-bvh/releases/tag/v0.9.17).

Draco 1.5.9 fixes missing `HEAP*` exports and `wasmBinary` support in JS/WASM builds. The author recommends versioned decoder distribution URLs. That is upstream release information, not evidence that the currently served binary is 1.5.9. The existing self-hosted decoder is retained until compatibility and performance checks justify replacement. [Official release](https://github.com/google/draco/releases/tag/1.5.9).

The Kenney author page still lists 25 assets, CC0, and version 1.0. No new archive was downloaded; the previous verified archive hash and four shipped GLB hashes remain the existing asset evidence. Web extraction of this author page failed, but a direct HTTPS GET succeeded and exposed its version/date/licence metadata. [Kenney Mini Characters](https://kenney.nl/assets/mini-characters).

Runtime decoder hashes were re-read from Walk `public/draco/` and match CURRENT.md:

| File | Bytes | SHA-256 |
|---|---:|---|
| draco_decoder.wasm | 192420 | a680d927bed9cb864ddbd63521868891af2bfbe755092761b4837487618df8ac |
| draco_wasm_wrapper.js | 58572 | f3ab54e2feabfe8bd37928b5f400bc10230dcc278c7e70bca5e025f63519d960 |
| draco_decoder.js fallback | 512498 | a47cd7c84911c5175bb0511c01ba41ddafb71873fd391f055def514398f5e7c4 |

## Provider pages and conditions checked

| Provider | Current source-backed conditions | Implication for this candidate |
|---|---|---|
| OpenFreeMap Liberty | Public map service advertises no map-view/request limits, registration or API keys. The official guide still uses the selected Liberty style and displays linked OpenFreeMap / OpenMapTiles / OSM attribution. No service-level guarantee was found. [Service information](https://openfreemap.org/), [quick-start guide](https://openfreemap.org/quick_start/). | Preserve visible attribution at every map size; no new access requirement. No offline region-download feature is introduced. |
| OpenFreeMap underlying content | OpenMapTiles/default style design remains CC BY 4.0; style/code notices, Noto OFL and Maki CC0 remain in the official licence inventory. [Official licence inventory](https://raw.githubusercontent.com/hyperknot/openfreemap/main/LICENSE.md). | Existing copied licence texts and visible credits remain applicable to the chosen Liberty style. |
| Photon public demo | The official policy permits reasonable project use; heavy use can be throttled/banned, availability is not guaranteed, and changes can occur without notice. No numeric public quota is promised. [Official demo-server policy](https://github.com/komoot/photon#demo-server). | Retain explicit submitted searches, bounded result count, cache, separation and unavailable handling. Process-local limits must not be represented as deployment-wide rate guarantees. |
| AWS Terrain Tiles | AWS still identifies the public `elevation-tiles-prod` bucket with no AWS account required and points to Joerd attribution/licensing. No numeric monthly quota or service availability guarantee is published there. [AWS dataset registry](https://registry.opendata.aws/terrain-tiles/). | Existing unauthenticated access remains documented. Keep the selected fixed endpoint and bounded fetches; do not infer service guarantees. |
| Terrain provenance/licensing | Per-tile `X-Imagery-Sources` still identifies contributing source filenames. Data are mixed-origin; regular terrain updates are not planned. SRTM nominal source resolution is about 30 m; GMTED fallback is much coarser. [Source specification](https://github.com/tilezen/joerd/blob/master/docs/data-sources.md). Selected attribution still identifies USGS SRTM/GMTED and Environment Agency 2015 UK data. [Attribution inventory](https://github.com/tilezen/joerd/blob/master/docs/attribution.md). | Continue accepting only licensed `srtm/`, `gmted/`, `uk_lidar/` sources and rejecting unknown/mixed sources. No new terrain-source allowance is inferred. Public terrain remains regional context, never survey cut/fill input. |
| PVGIS | Official API documentation still lists 5.3, GET requests, no browser AJAX, 30 calls/second/IP, 429 throttling and 529 overload. [API conditions](https://joint-research-centre.ec.europa.eu/photovoltaic-geographical-information-system-pvgis/using-pvgis-5/api-non-interactive-service_en). Its manual says the service is free, without registration or restrictions on the use of results. [Manual](https://joint-research-centre.ec.europa.eu/photovoltaic-geographical-information-system-pvgis/using-pvgis-5/pvgis-5-user-manual_en). | Preserve server calls, version/query attribution, cache and explicit unavailable responses. Existing no-site solar path stays unchanged. |
| Overpass public instance | Official policy lists general-app reliance on public instances among problematic uses. It gives broad safety guidance of roughly 10000 requests/day and below 1 GB/day, with dynamic quotas/load shedding. [Official commons policy](https://dev.overpass-api.de/overpass-doc/en/preface/commons.html). | **Existing material operating limitation.** A bounded pilot is not an entitlement to production scale. Keep context calls user-triggered/cached; a scalable production expansion needs an appropriate provider/operating decision. No account, paid service or server was introduced. |
| OSM data licence | ODbL, contributor credit and licence link remain required; print should include the copyright URL where links are not usable. Service terms remain separate from data licensing. [OSM copyright/licence](https://www.openstreetmap.org/copyright). | Keep existing interactive/report/print attribution. OSM's own tile/API service policy is not a substitute for OpenFreeMap, Photon or Overpass conditions. |
| Selected USGS and UK terrain rights | USGS-authored data are public domain, with proper credit requested; third-party exceptions must still be respected. [USGS policy](https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits). OGL v3 permits commercial/noncommercial reuse with provider attribution and licence link, excludes unsupported third-party rights and supplies no warranty/continued supply guarantee. [OGL v3](https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/). | Existing source admission and copied notices remain necessary. Direct HTTPS GET of OGL succeeded after the web extractor returned 403. No new rights inference is made. |

## Safe integration note

Update the provider access date to **2026-10-28** only for the pages above, keep the release dates distinct, and update the latest BVH row to **0.9.17**. Keep the installed version at **0.9.16** unless the parent task actually upgrades and proves it. Do not claim that this review is a dependency upgrade or that it resolved any performance gate. No new restriction was detected relative to the existing documented policy, but Overpass's already documented operating limitation remains open for any production-scale expansion.
