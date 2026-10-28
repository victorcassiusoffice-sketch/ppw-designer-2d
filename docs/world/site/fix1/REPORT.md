# Site — fix round 1

28 October 2026. PR #54; base remains `3eefbf7`. No rebase was needed. These notes cover A, F7 and F8; common loop files and paired measurements are integrated by the parent task.

## Deferred saved Site hydration (A)

Canonical geographic validation, geometry, provider logic, map, report and workspace are now outside the initial App + ThreeStage static closure. The early store preserves `world` as opaque data. It cannot draw a geographic polygon or feed Site figures until the deferred canonical validator replaces it with a detached, validated, frozen copy. For a requested 3D route, hydration waits for the first-picture marker and two animation frames, including when the initial store view still says plan. A normal plan waits two animation frames. Explicit Site entry validates before displaying figures.

Opaque data survives unrelated writes and normalizers before validation. Malformed world data is removed only after validation, with a warning on Site entry; the legacy plot is retained. Later imports and persistence rehydration are validated by a guarded subscription. Disposal cancels queued work and removes subscriptions. Designs with no world extension retain the existing serialization shape and do not request hydration.

**The literal same-byte static gate is still unmet.** The full 28-chunk App + ThreeStage closure is 2,882,089 raw / 865,943 gzip bytes against base 2,880,122 / 865,212: **+1,967 raw / +731 gzip**. The property-store chunk alone is 88,676 / 29,856 against 88,628 / 29,835: +48 / +21. These remaining bytes are the launcher, deferred-loading/preservation and overlay adapters, not canonical Site implementation. No exception is claimed. `bundle-audit.json` contains every early filename, byte count, hash and static dependency, plus the deferred Site module list. Both controlled builds use identical existing build variables; browser request ordering is a separate check.

## Offline honesty (F7)

The offline hint now says “Practice outline; the demo has no map.” Map credits are rendered by the actual map component only. The offline report no longer inserts unused map credits into hidden DOM. A contextual OSM source remains only when real mapped context is present.

## Preview-only live map (F8)

On a normal branch preview, open `/demo?site=1&live=1`, then choose **Site**. Only after this click does the deferred entry request the existing same-origin `/api/healthcheck`; the live map is enabled only when its JSON response says exactly `env: "preview"`. Production, unknown environment, failed or aborted requests stay in the offline sample. No hostname inference, new environment variable, account or access code is used. Plain `/demo?site=1` stays offline without this healthcheck. Closing the entry clears the authorization flag.

## Validation

- 99 focused tests passed across eight files: canonical normalization, geometry, original persistence regressions, provider tests, deferred hydration and route timing, subsequent imports/rehydration, subscription disposal/loops, preview fail-closed behavior, and offline credit DOM.
- Root, API and middleware TypeScript checks passed; Site/API ESLint passed; controlled production bundle build passed; `git diff --check` passed.
- The original three persistence tests are unchanged. No estimate implementation or estimate test was changed.
- Deployed real map/search/draw/visible-credit smoke at laptop and 390 × 844, saved-world first-picture request ordering, same-host timing pairs and current CI are pending the new branch preview. No pass is inferred from local unit tests or static closure alone.

This round does not repeat the unchanged offline survey calculations, prior three-location reports or A4 PDFs. No satellite, OCR, new pricing, Lighthouse repair or PR #52 work is included.
