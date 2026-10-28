# First 3D picture — fix round 3

One Live Build · 27 October 2026 · base `3eefbf7` (merged PR51).

## Changes and diagnostic profile

- Fresh House entry previously mounted a hidden Plan canvas. Its product snapshot hooks created a second WebGL renderer, environment-map work and shader draws. The live CPU trace attributed about 1.50s to `modelSnapshot` during initial readiness; a compiled local trace attributed about 2.41s across the captured initial phase. House now keeps the shared placement component/camera state alive but mounts the Konva drawing subtree only when Plan is visible. Fresh desktop/phone checks show zero snapshot requests until Plan is opened.
- The first real Three.js picture synchronously linked shader programs: the baseline local first draw occupied about 1.07s. The actual lightweight first-picture variants now use `compileAsync` before rendering, with immediate restoration of original materials and renderer/build guards. The integrated local draw occupied about 0.19s. All geometry, shadows and the later full Natural presentation remain. The loader is removed only after an actual scene render, never after preparation alone.
- Repeated deterministic furniture microstructure pixel generation is cached. Each product still owns its GPU texture and private pixel buffer; no surface formula, dimension or quantity changes.
- HTML now provides Loading 3D before JavaScript downloads for public 3D demo routes. React's equivalent panel takes over during route loading. This removes the blank bootstrap period.
- A locally subsetted Inter UI face keeps the same font and OpenType features. Decorative empty `i` elements no longer request italic. Native select options containing hidden Chinese/full-width characters no longer fetch Inter, which has no glyphs for them. Other supported scripts and actual italic text retain the originals. Final local phone trace fetched only the 216,680-byte UI font, instead of both original files (352,240 + 387,976 bytes). Offline generator: `tools/subset-ui-font.py`; original OFL retained.
- Catalogue and basket images now use 128/256px WebP variants. Details retain original images. [Thumbnail sizes and verification](thumbnails/README.md).

CPU profiles are diagnostic captures, not acceptance timing runs; inclusive costs can overlap and extend past the first-frame mark. Heavy traces/intermediate logs remain outside Git at `C:/Users/Victor/Documents/Codex/2026-09-23/c/work/olb-round3-scratch/`. Reproduce with `node tools/sims-round3-profile.mjs <base> <label> <desktop|phone>`.

## Local verification

- `npm test -- --reporter=dot`: **400 files / 4,310 tests passed**.
- `npm run build`: passed (includes app and middleware typechecks); existing large-chunk warning retained.
- `npx tsc --noEmit -p api/tsconfig.json`: passed.
- Scoped ESLint on every changed/new TypeScript file: passed.
- Desktop1280×800 and phone390×844: [10 Plan/House interaction checks](plan-stage/regression.json) passed. Physical 3D placement, exact saved Plan scale/camera, measured wall drawing and Undo verified. Zero console/page errors or attempted writes.
- [Desktop1x/phone2x image checks](thumbnails/browser.json): 128/256px images selected; original512px detail image; labels preserved; zero errors or writes.
- Of 461 baseline test files, only catalogue controls and first-picture GPU-material tests changed. All other459, including construction quantities/geometry/foundations/services, remain byte-for-byte. No API, schema, migration, dependency or environment edits. Checkout/access gate untouched. No generation spend or supplier-photo copying.

## Preview acceptance

Pending automatic Vercel deployment and at least five paired production/preview runs per device. Local diagnostic first-picture marks (desktop1.70s; phone1.30s) are **not** a deployed pass claim. `tools/sims-round3-pairs.mjs` alternates pair order, uses a fresh Chromium process/profile each time, no throttling, and records both readiness wait and actual first-frame marks, loading-panel times, completed transfer bytes, errors and same-minute pair validity. Final paired results will be committed here and added to the PR.

## Scope and remaining limits

No merge; production remains PR51. PR49, new features and prompt3/task-cost work are excluded by the brief. The Plan gate does not cancel snapshots already queued before switching from Plan to House. Existing phone floor-label truncation and global Plan keyboard shortcuts responding in House are outside this loading-only fix. Phone checks are viewport/touch emulation, not a physical-device claim. No rewrite of the stable 2D pointer engine. New evidence stays below5MB; the previous round's evidence is untouched.
