# Smaller catalogue and basket pictures

One Live Build · round 3, item 2 · 27 October 2026. Preview/publication handled by the parent task.

The same source pictures and photo/Drawing labels are retained. Catalogue cards, baskets and drag pictures now use cached 128px/256px WebP variants with `1x`/`2x` `srcset`. Explicit product details use the matching original image. Actual floor-plan/3D rendering assets and all dimensions/calculations are unchanged. SVG drawings remain vectors. Unknown newly onboarded URLs retain their existing behavior until their image is added to the offline cache; no remote resizing service or extra API is introduced.

| Referenced images | Original bytes | 128px bytes | 256px bytes |
|---|---:|---:|---:|
| Courts plan drawings, 33 | 4,184,626 | 45,384 | 88,404 |
| Existing supplier photos, 22 | 523,596 | 48,970 | 125,802 |
| Existing top-down pictures, 30 | 1,263,196 | 69,212 | 212,396 |
| Existing model previews, 21 | 1,524,186 | 70,610 | 163,938 |
| **All referenced raster candidates, 106** | **7,495,604** | **234,176** | **590,540** |

These totals include error-fallback candidates, not a claim that all 106 are fetched on initial load. Courts drawings are 98.9% smaller at 128px and 97.9% smaller at 256px. All 106 images are 96.9%/92.1% smaller respectively. The 212 variant references share **204 unique cached files totalling 809,182 bytes** because identical source bytes reuse one content hash. The source-keyed manifest is 17,647 bytes (3,095 bytes gzip). Original files remain for detailed views and scene rendering. Sizes are file bytes, not a network timing claim.

`node tools/build-catalog-thumbnails.mjs` generates variants offline with the existing Sharp dependency; source bytes, resize settings and codec versions determine content-hashed filenames. No network calls, model/image generation service or supplier-photo fetching. `--check` validates the cache and manifest; `--audit` only inventories source files. Generation took 6.7 seconds locally; a second cache check passed without changing assets.

Focused verification: **29 tests in 5 files passed**, scoped ESLint clean. Tests cover 128/256 files and bounds, smaller payloads, photo/Drawing precedence, API alias compatibility, full-resolution details, drag previews, failed-photo fallback, both baskets and preserved demo restrictions. Existing protected geometry/material/foundation/service tests were not changed.

Compiled browser verification (`node tools/catalog-thumbnails-shot-2026-10-27.mjs http://127.0.0.1:5173`): **desktop 1280×800 at 1x in 2D and phone 390×844 at 2x in 3D passed**. The actual browser `currentSrc` selected 128px WebP on desktop and 256px WebP on phone for the basket, supplier-photo card and Drawing card. Opening details selected the original 512px PNG, with no thumbnail `srcset`. Labels and demo text restrictions stayed correct. Zero console/page errors, zero attempted API writes, no horizontal overflow. Six cropped JPEGs and compact `browser.json` prove these paths; reviewed images show the same furniture/equipment art without clipping. These are image-resolution checks, not first-3D-load timing measurements.

An initial QA run used an incorrectly nested selector for the sibling Details button and timed out after the card assertions passed. The selector was corrected; the final run passed without application changes. That intermediate log is outside Git at `C:/Users/Victor/Documents/Codex/2026-09-23/c/work/olb-round3-scratch/thumb-detail-selector-first-attempt.json`.

Owned source: `CatalogProductExtras.tsx`, `catalogMetadata.ts`, `HouseCostPanel.tsx`, `ProductPalette.tsx`, `DetailsPanel.tsx`, `desktop/SimsDock.tsx`, `mobile/SimsBottomToolbar.tsx`, `mobile/MobileProductPopup.tsx`; new `src/data/catalogImageSources.ts`, `catalogImageThumbnails.json`, `public/products/thumbs/`; existing catalogue control test and new `catalogImageSources.test.ts`. Tools: `build-catalog-thumbnails.mjs` and `catalog-thumbnails-shot-2026-10-27.mjs`. No API, dependencies, environment, geometry, main/index or ThreeStage edits.

Detailed intermediate resizing logs stay outside Git at `C:/Users/Victor/Documents/Codex/2026-09-23/c/work/olb-round3-scratch/catalog-thumbnails.json`. Only this README, compact `sizes.json`, compact browser evidence and a few cropped screenshots belong in this evidence directory.
