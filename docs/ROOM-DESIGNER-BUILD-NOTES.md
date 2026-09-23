# Room Designer build notes — 23 September 2026

Work stays on `cursor/feat-3d-flooring-hud-bc95`, draft PR #36. Production is unchanged. Current preview URLs are in [BUILD-LINKS.md](BUILD-LINKS.md).

## Using the new controls

- Enter 3D from the top strip. Pick a floor and use **+ Floor** to copy its room layout, openings, finishes and free walls. Furniture is not duplicated. There is no fixed floor-count cap; rendering capacity depends on the device.
- **Build +** switches between Whole building and This floor, edits floor heights, and adds a roof. Choose flat, gable or single slope, with felt, tile or metal. Roof visibility is a view setting; the roof configuration is saved with the plan.
- Choose **Stairs** and tap clear space on either of two adjacent floors, or use **Build + → Fit stairs in room** for an automatic valid position. The same footprint must fit both rooms. The upper slab gains an opening. Build details offer width, run, X/Y, rotation and deletion; stairs also appear on both plan floors.
- Choose **Window** or **Door** and tap a wall on the active floor. The existing opening validation rejects overlaps and insufficient wall space.
- Open **Garden** in Build details. Add lawn, soil, gravel, paths, raised rectangular terrain, timber/metal fences or hedges. Use dimensions/position fields or Place in 3D. The garden belongs to ground level and uses the existing plot/building limits.
- Orbit with a drag; pan with two fingers or Shift-drag on empty space; pinch/scroll to zoom. Camera easing respects reduced-motion preferences. Item drags preview the plan's snap/collision rules, including wall orientation, before a single committed drop.
- Wall paint uses distinct matte, satin and gloss surface responses in WebGL and visible finish bands in plan. Paint and cladding quantities follow each floor's height.
- Phone wall drawing supports one-finger strokes; two fingers pan/pinch without committing an accidental wall. The wall pen, area tools and cart use compact controls.

## Existing backend connections

The merchant catalog reads all pages of the existing `/api/products` endpoint and exposes offline/partial loading with Retry. Bundled products remain usable when the endpoint is unavailable.

My designs uses the existing `/api/designs` GET/POST/PUT endpoints. Cloud loads open a separate local page and preserve outgoing edits. Save a new copy and Update cloud copy are explicit actions. Floors, stairs, roof and garden travel in the existing property snapshot. Local autosave does not send network writes. The existing email-based identity model is unchanged.

## Validation and limits

Client/API typechecks, changed-file lint and the production build pass. Final application commit `f35731c` passes GitHub's complete 226-file / 2,666-test suite and root/API typechecks. Backend requests are covered with mocks; the deployed public catalog also responded with 14 products. No live customer records were written during testing. The separate Lighthouse workflow still audits the unchanged production domain and reports existing performance/PWA/SEO failures.

Local phone visual checks confirmed two stacked storeys and a flat felt roof. Further localhost browser actions were blocked by automatic approval review. The deployed feature previews were accessible: standard and TintEX routes returned HTTP 200, desktop and phone layouts rendered, garden placement succeeded, and the final phone stair-fit action created a Ground-to-First connection with editable dimensions. Deployment-specific verification is recorded in BUILD-LINKS.md.

Terrain is rectangular with flat raised elevations, not a freeform sculpting mesh. Roofs follow individual room footprints; complex joined roofs and pitched-roof accessory mounting need further work. The advanced building parts use WebGL; the existing canvas fallback is a basic room view. Stair layout dimensions are conceptual, not structural design. Existing demonstration catalog entries remain labelled as samples; no new supplier prices or APIs were invented.

## Preserved work

The active clean checkout is `C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer`. Victor's other branch and dirty files remain untouched at `C:\Users\Victor\Documents\PPW-Code\ppw-designer-2d`.
