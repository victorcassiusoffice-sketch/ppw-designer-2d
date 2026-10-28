# Walk first-picture constraint

28 October 2026. Read-only source and controlled-bundle analysis; no padding, feature expansion, or new exception is proposed.

The literal gate remains **unmet** because executable Walk adapters are present in early modules. Use the final emitted-file totals in [bundle-audit.json](bundle-audit.json) and [REPORT.md](REPORT.md), measured against base `3eefbf7646f2b5c76e5297f7836e6e0336e8f1a2`. The first audit captured `generateBundle` output before Vite's final preload transformations; its closure totals and deltas are not valid final emitted-file measurements. The corrected audit reads the completed `build.output`; the final Walk comparison must also include the shader warm-up fix.

The final emitted audit at `554fb61` confirms the Three vendor export-alias difference is +45 raw / +12 gzip bytes (744,964 / 191,245 base versus 745,009 / 191,257 Walk). That narrowly authorized exception does not cover launcher, lifecycle, keyboard or shader implementation. The full early JS closure grows by 1,968 raw / 744 gzip bytes; 1,923 raw / 732 gzip bytes remain after the allowed alias exception. The observed same-shell file comparison also includes the thumbnail implementation and is reported separately.

The following intermediate module evidence was recorded at pre-AO-fix head `ad7893027f7ea4add871a70698f3db4405398cb6` in `work/world-fix1/builds/{base,walk}/audit.json`. These generated module lengths precede minification and final preload transformation; they identify implementation growth and must not be summed as final file or gzip totals.

| Early module | Rendered growth | Actual added behavior |
| --- | ---: | --- |
| `components/three/ThreeStage.tsx` | 1,220 | Private render ownership and `beginWalk` lifecycle |
| `components/RoomView3D.tsx` | 544 | Deferred launcher import and post-picture mount |
| `components/three/joinery.ts` | 170 | Door-leaf identifiers |
| `hooks/useWorkspaceFocus.ts` | 159 | Foreground Walk keyboard forwarding |
| Six guards across `OpeningSelectionEditor`, `PlanGardenWorkspace`, `ProjectWorkspace`, `RoomCanvas`, `RoomDrawMode` | 420 | Prevent background editors consuming Walk keys |
| `components/threeStageLoader.ts` | 15 | Generated import-reference growth; no source change |

The lifecycle, launcher and keyboard changes are executable implementation, not aliases of already-shipped exports. Moving their bodies to a deferred module can reduce these bytes, but the first-picture caller still needs new executable code to load or mount that module.

The base has no guaranteed deferred extension point after the first 3D picture:

- `ThreeStage.tsx` statically imports the environment, detail and natural-shading implementations. Its first-picture callback and 600 ms detail timer invoke already-loaded code; neither imports a later application module.
- `threeStageLoader.ts` imports the renderer before the first picture. It cannot supply a later extension without changing an early module.
- `usePlanModelImage.ts` imports `modelSnapshot` for plan images independently of the picture; the recorded network trace shows that request before the first picture.
- `main.tsx` conditionally imports Sentry on idle when a DSN exists. It is not guaranteed to run, and idle is not the first-picture boundary.
- `CityWorkspace`, `ServicesWorkspace` and `SharedProjectWorkspace` have deferred imports after unrelated explicit user actions. Requiring those actions to discover Walk would change the intended entry flow.

Consequently, an automatically available Walk launcher cannot be added while keeping every early file and byte size identical to this base. Dynamic import does not eliminate its bootstrap. Renaming implementation as an alias, padding other files, or hiding new loading in unrelated assets would not meet the gate.

A future baseline could supply an explicit post-picture extension loader and scene lifecycle interface. Walk could then place its launcher, private renderer, door identification and keyboard ownership entirely in a deferred extension. Establishing that seam changes the baseline and needs its own review; it is not a zero-byte solution for this round. The current implementation and the final measured delta should remain disclosed as a gate failure.
