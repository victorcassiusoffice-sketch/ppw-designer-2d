# Catalogue Phase D — acceptance report

One Live Build · branch `gpt/olb-sims-parity-2026-10-22` · verified 24 October 2026.
Status: BUILT-NOT-LIVE. This report covers catalogue work only.

## What changed

- Categories, By function and By room share the same measured catalogue in Plan and House.
- Search includes names, SKU, supplier and descriptions. Name and footprint sorts remain. Price sorting is available only where existing prices are allowed; /demo remains price-free. Different currencies are grouped rather than silently converted.
- Existing GLBs have static transparent thumbnails photographed from one fixed angle and lighting rig. The phone downloads PNGs; it does not start a catalogue WebGL renderer.
- Information buttons open details in reserved catalogue space on both screen sizes. Details include source photo, dimensions, supplier and the supplier's availability report. Floor details do not start laying the floor.
- Declared variant swatches select an existing SKU and its real dimensions. They do not invent tinted versions.
- Optional supplier fields are validated by JSON/CSV import and retained in downloaded packs. The current server publishes its existing quantity field only. The UI states this limitation before publishing.

## Acceptance and evidence

| ID | Result | Named evidence |
|---|---|---|
| D01 same-angle cached thumbnails | Passed for all 21 existing GLBs: 13 fitness, 8 solar. | `baked model catalogue images > covers all existing models with cached transparent PNGs at one resolution`; `catalogue controls > loads a cached baked image lazily, then falls back to its actual source photo and symbol`. `catalog-bake.json`: 21 cache hits, no failures. |
| D02 room/function/search/sort | Passed desktop 1280 × 900 and phone 390 × 844 with real pointer clicks. | `catalogue-parity-shot-2026-10-22.mjs`: Fitness function, NordicTrack search, name sort, Bathroom room, normal Designer price-sort control. `catalogPresentation.test.ts` also verifies order and no product mutation. |
| D03 details and swatches | Details passed in Plan and House, including floor details. Variant control passed with an explicitly declared test SKU. | `catalogue controls > changes to the declared SKU and dimensions, without inventing a material variant or starting placement`; `honest catalogue metadata > offers only explicitly declared variants that resolve to actual SKUs`. No current merchant catalogue rows declare variants, so live merchant swatches are not claimed. |
| D04 availability | Unknown report shown honestly in real catalogue. Dated/on-order/made-to-order states and importer round-trip passed in unit tests. | `honest catalogue metadata > unknown stock and historical database zero do not imply availability`; `shows the explicit supplier report and date, without claiming live stock`; import and API adapter tests. No real stock feed was connected or invented. |
| D05 demo prices | Passed in real desktop and phone demo routes; sorting cannot reveal hidden prices. | `catalog browsing > sorts actual prices within their own currency and never ranks prices in the public demo`; no price options in both pointer runs. |

Before pictures: `before-interaction/desktop-catalogue.png`, `before-interaction/phone-catalogue.png`.
After pictures: `catalogue-after/{desktop,phone}-2d-fitness.png`, `-2d-details.png`, `-2d-bathroom.png`, `-2d-floor-details.png`, `-3d-fitness.png`, `-3d-details.png`.
The normal Designer price-sort pictures stay in the repo only. They are not copied into the vault.

## Commands and results

`npx vitest run src/components/__tests__/catalogMetadata.test.ts src/components/__tests__/CatalogProductExtras.test.tsx src/components/__tests__/catalogPresentation.test.ts src/lib/merchants/__tests__/catalogImport.test.ts src/data/__tests__/apiCatalogAdapter.test.ts src/components/__tests__/catalogWorkspace.test.tsx` → 6 files, 53 tests passed.

Scoped ESLint on changed catalogue/import/adapter files → passed with zero warnings.

`node tools/bake-catalog-thumbnails-2026-10-22.mjs http://127.0.0.1:5176` → initial run rendered 21; repeated run used 21 cached files, no renders, no failures.

`node tools/catalogue-parity-shot-2026-10-22.mjs http://127.0.0.1:5176` → both device cases passed all five functional checks. Fourteen PNGs. Zero demo console errors, zero page exceptions, zero attempted writes.

The separate normal priced Designer route recorded one external exchange-rate HTTP 401 per device. Raw reports preserve these under `normalDesignerFxErrors` and `httpFailures`. This is not a claim of a clean whole-app console run. The local Vite catalogue endpoint also falls back to bundled products and displays its existing offline notice.

## Visual review

The first phone pass showed cards below the visible House catalogue because of the old height cap and duplicated header row. That was fixed. Current captures show product cards, search, grouping and Close together. Details stay outside the design and can return to products. No horizontal page overflow was detected.

Known limits: room/function classifications are presentation heuristics, not supplier-certified taxonomy. Products without an existing GLB keep their actual source photo or category fallback. Existing mesh quality is unchanged. No new model generation was performed. Real merchant swatches and supplier availability remain unverified because those data are not supplied. Desktop/phone G3 catalogue legibility improves from 1 to 2; it is not full Sims visual/content parity.

## Backend proposal and boundaries

`AVAILABILITY-MIGRATION-PROPOSAL.md` is in the required inbox folder. It proposes nullable reported fields and preserves unknown versus zero. It was not applied. No API endpoint, database schema, environment variable, order, login, dependency, estimate or physical dimension was changed by Phase D. No credit-based generation ran.

Code: C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer
Required report folder: C:/Users/Victor/Documents/PPW-Second-Brain/06-Roadmap/agentix-os/inbox/olb-sims-parity-2026-10-22/
