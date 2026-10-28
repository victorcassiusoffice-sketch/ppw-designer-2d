# Site strict early-byte gate: FAIL

28 October 2026. Base `3eefbf7`; final measured Site runtime head `2c6743a1a00fea395556358d011fa323b81b0018`. The canonical validator, geometry, map, providers and workspace are deferred, but the required integration adapters still change early files. This does **not** satisfy the Commander's literal gate. No exception or waiver is claimed.

The controlled App + ThreeStage static closure contains 28 chunks. Both builds use identical existing build variables. Counts use Vite's final returned `build.output`, after preload transforms; the earlier `generateBundle`-stage snapshot is superseded. Exact filenames, bytes, hashes and dependencies are in [bundle-audit.json](bundle-audit.json).

| Component | Base raw / gzip bytes | Site raw / gzip bytes | Delta raw / gzip |
|---|---:|---:|---:|
| Full early closure | 2,886,393 / 867,736 | 2,888,963 / 868,689 | **+2,570 / +953** |
| Property store | 88,628 / 29,835 | 88,676 / 29,855 | +48 / +20 |
| App | 1,062,179 / 327,162 | 1,064,701 / 328,100 | +2,522 / +938 |
| Other early chunks combined | — | — | 0 / −5 |

The final App gzip value above is derived from the controlled per-file audit; other unchanged-length chunks compress differently because their import hashes change. These incidental differences are not padding or a claimed performance improvement. The closure total is the gate result.

## Why the remaining adapters cannot simply be deleted

- **Saved-data preservation:** [propertyStore.ts](../../../../src/store/propertyStore.ts), lines 454–473, constructs a new whitelist object in `normaliseSite`. The baseline returns only width, depth and origin. Both `setSite` (line 1879) and `normaliseLoadedProperty` (lines 2138 and 2168) use it. Removing the opaque `world` preservation can discard data before the deferred validator exists. A later rescue from localStorage is unsafe because an earlier normalization/write can already have overwritten that copy. The present store chunk delta is +48 raw / +20 gzip bytes; this is its measured cost, not a proof of a universal minimum. The prior head compressed to +21 gzip; the source preservation logic is unchanged.
- **Entry and deferred loading:** [TopBar.tsx](../../../../src/components/TopBar.tsx), line 2208, mounts the Site entry. [SiteLaunchButton.tsx](../../../../src/site/SiteLaunchButton.tsx), lines 10–50, watches for saved data, waits for the first-picture boundary, imports hydration and disposes its subscription. Removing it removes the required entry or automatic saved-data hydration.
- **Loading-modal ownership:** [SiteLaunchButton.tsx](../../../../src/site/SiteLaunchButton.tsx), line 67, now uses [SiteLoading.tsx](../../../../src/site/SiteLoading.tsx). Its focus hook at line 13 blocks background editing, owns Escape/Cancel and restores focus during the initial suspended entry download as well as the later healthcheck wait. Its positioning is self-contained because the deferred stylesheet may not yet have arrived. This fixes the final review's actionable modal gap; the measured early delta includes it.
- **Validated plan geometry:** [RoomCanvas.tsx](../../../../src/components/RoomCanvas.tsx), lines 558, 585 and 4532, withholds unvalidated geographic geometry and renders the validated outline and label. Deleting this integration leaves the legacy rectangular plot behavior instead of the saved geographic boundary. Entry, loading and plan adapters together account for the measured App delta.

## Existing loading paths examined

[ThreeStage.tsx](../../../../src/components/three/ThreeStage.tsx), lines 851–856, schedules detail preparation after the first picture. That callback and `prepareEnvironment` at line 1050 are already in the early static bundle; the natural renderer is also statically imported at line 75. There is no existing general extension-import hook there. Adding a Site bootstrap to that callback changes an early file.

[main.tsx](../../../../src/main.tsx), lines 109–126, optionally imports Sentry through an idle callback or timer. It is neither universally enabled nor guaranteed to run after the first picture. Making persistence depend on telemetry would be unsafe and would alter early code.

[SharedProjectWorkspace.tsx](../../../../src/components/SharedProjectWorkspace.tsx), lines 12 and 57, has a genuine user-triggered lazy workbench. Moving Site inside it would change the requested Site entry and still would not protect data normalized before that workbench opens.

## Next architecture decision

A safe route to this literal gate requires either (1) an already-established baseline extension hook that runs after first picture plus baseline support for opaque saved extensions, followed by measuring Site against that updated base; or (2) an explicitly changed entry/persistence contract that no longer requires the current integration. Neither is authorized or present in base `3eefbf7`.

This document-only analysis makes no source changes. Size padding, import-hash manipulation, telemetry coupling and silently dropping saved data were rejected. The strict static gate remains **FAIL**, regardless of a passing no-new-request-before-picture trace.

The functional map screenshots and seven-case preview smoke were repeated at final code head `2c6743a`: delayed initial entry focus/Escape, real map/search/draw/visible credits, offline behavior, and the labelled simulated production guard all passed. There were no browser errors or attempted/transmitted network writes. The saved-world hydration trace remains evidence from `017e16d`; its polling wait expired before final inspection, so only the final inspected state proves validation completed. The production guard browser case uses an explicitly mocked production health response; network-failure/abort behavior is unit-tested. The later code change only adds loading-modal focus ownership. Final-head performance evidence is recorded separately in REPORT.md.
