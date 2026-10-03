# Studio redesign — 4 October 2026

Status: implementation, local verification and feature push complete. Vercel reports success; unique-host browser verification is pending because the host times out. Production is unchanged.

Active checkout: `C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer`, branch `cursor/feat-3d-flooring-hud-bc95`. Starting HEAD `2e71786`. Original checkout and recovery stash remain untouched. Production remains the previous October 2 release.

## User direction

Drastic interface refresh using Victor's references in `C:\Users\Victor\Documents\Claude\Projects\ppw-room-designer\Design`: warm ivory/sage tactile UI, minimal task hierarchy, richer measured 2D/3D representations. Preserve dimensions, geometry, estimates and product quantities. Shared pitch demos must inherit changes; static pitch screenshots must be refreshed from the actual app.

## Implementation

- `src/styles/designerStudio.css`: scoped Studio tokens, raised/inset controls, visible tool labels, desktop perimeter rail, phone bottom tools, shared light theme for Plan, House, catalog, AI and Materials. Layout reserves space around the scene instead of floating tool cards across the house.
- `TopBar.tsx`: explicit Plan/House switch; secondary site/precision controls use an expandable in-flow row with Escape/outside dismissal. Existing calculations and tool actions retained.
- 3D rendering: product reflection environment, deterministic micro-surfaces, softly shaped upholstery and warm unpriced scene backdrop. Preserve catalogue envelopes and calibrated priced-wall/floor lighting.
- 2D rendering: canonical 3D model top-down snapshots for supported products, material grain and contact depth, quieter grid and labels. Preserve stored footprints and hit targets.
- Pitches: shared tactile shell and chapter navigation, unchanged functional embeds, forms and meeting links. Studio follows the same presentation.

## Verification / remaining

Local Vite runs on `http://127.0.0.1:5173`. Client/API typechecks and production build pass. Regression suite: **295 files / 3,239 tests pass**, followed by focused final navigation/surface tests (21) and refreshed screenshot-asset tests (5). Changed-file lint passes. Existing large-chunk advisory remains.

CUA browser checks: desktop 1440×900; phone 390×844 and 320×740. Verified Plan/House switches, Site & tools expand/Escape, reachable narrow-phone header, Materials dock with 149.312m² net wall / 1,623 blocks, View settings/close, measured draft generation, product selection/details, and pitch/Studio desktop/phone layouts. A reviewer found three cascade defects (site active states, sidebar selected states, 88px legacy phone view-switch width); all fixed before release. HMR reset the demo during editing; final screenshots use fresh page loads. No commercial orders, merchant writes, enquiries or paid inference were submitted.

`public/showcase/designer-plan.webp`, `designer-3d.webp`, and `designer-ai.png` were replaced with actual CUA app screenshots. Originals are under `C:\Users\Victor\Documents\Codex\2026-09-23\c\outputs\Room-Designer-{Plan,3D,AI,Phone}-2026-10-04.jpg`.

Application commit `51c2b64336a923dad15668ef08b3a4ed1aa58900` is pushed on the feature branch. Preview deployment `6834504765` succeeded at `https://ppw-designer-2d-pyrd1d3ge-victor-ppw.vercel.app`, but browser and HTTP requests timed out. A documentation checkpoint push requests a fresh preview. Next: verify that unique host and update these pointers. No production push is part of this redesign release without applicable authorization.

## Extension / honest limits

Canonical top-down imagery lives in `src/lib/topdown/modelSnapshot.ts`; it uses the same furniture/solar/tank meshes as 3D, normalized to catalogue dimensions. Supplier top-down artwork takes priority. Cached raster previews are capped at64 entries; GPU resources release after5 idle seconds, with fallback artwork on failure. New preview geometry must retain its catalogue envelope and join the existing envelope tests. No dimension, quantity, energy or price algorithms were replaced for appearance.

These remain dimensional product previews. Full photographic parity requires verified supplier geometry/textures and further rendering work; do not describe these generated bodies as exact manufacturer CAD or certified lighting simulations. All pitch links/embeds share the same application; static captures need refreshing after later visual changes.
