# One Live Build — advanced drawing and site tools, 16 October 2026

Worktree: `C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer`.
Continuing feature branch `gpt/designer-2026-10-15`, PR48, preserving the shared-project release. No production/main/database/environment change.

## Workflow and dependencies

1. Repair existing door/window selection and direct catalogue drag/drop first. Selection and view settings remain transient; quantities come from canonical geometry.
2. Add one bounded measured curve/path sampler. Store sampled metre coordinates as normal wall segments and polygons, so plan, house, save/load and measurements consume the same outline. Do not use a visual spline with a different bill of quantities.
3. Add measured rectangular, arched and circular wall cutouts with explicit sill and height. Use the same profile for rendering, selection and paint/masonry deductions, including shared walls.
4. Add glass wall specifications with thickness, supplier reference and net area/volume/mass. Glass is excluded from masonry, mortar, plaster and paint. Material changes clear incompatible coatings. Exact supplier/source matching is required before retaining a supplier association.
5. Add roof outlines, curved polygon authoring and explicit overhang. Use that outline for roof drawing, solar placement and material area; preserve placed items and report any unsupported structural assumptions.
6. Extend existing garden surfaces to polygon/curve paving and pools. Distinguish area, excavation volume, compacted layer volume, solid material and water volume. Avoid counting voids twice. Use published supplier references without fabricated stock or prices.
7. Offer selectable tactile tool skins and separate drawing presentation. Match the sage/ivory, ocean and graphite/copper design references; keep product finishes, dimensions, lighting calculations and camera unchanged.
8. Run geometry/persistence/API/UI tests, full typechecks and production build. Use terminal Playwright at1280 and390 pixels, inspect changed screens and direct manipulation, capture console/network errors. Push feature preview only; verify unique SHA/links.
9. Update BUILD-LINKS/CURRENT-WORK-LINKS and save ONE Obsidian handoff with screenshots and required three-line pitch changes.

## Current checkpoint

- Clean baseline `ca97e76`, fetched origin; no other-driver changes.
- Implemented door selection/editing and direct catalogue placement in both views. A cutaway threshold picking bug, 3D drag coordinates, cancel-without-placement and mobile product-info clipping were corrected.
- Measured straight/quadratic paths now create walls, roof outlines and outdoor outlines. Rectangle/arch/circle openings share their actual sampled profile with rendering, paint and masonry deduction.
- Glass specifications, net area/volume/mass, exact shared-pane rendering and compatible material resets are implemented. Pool construction stages and outdoor layers use the same persisted geometry in both views and shared component quantities.
- Three tactile tool skins and three independent build backdrops are implemented. Camera and actual product finishes remain unchanged.
- Production-build QA found and corrected artificial stripes on curved wall joins, overlapping phone garden controls and misleading opening captions. Final compiled checks and feature publication are the remaining release steps.
- Reference images reviewed directly from `C:\Users\Victor\Documents\Claude\Projects\ppw-room-designer\Design`.
- Parallel ownership: discipline_modes = RoomCanvas/RoomView3D, opening selection and drag; shared_specs_backend = path/opening/roof model and property persistence; sustainability_engine = garden/pool UI, model and suppliers; root = glass quantities/rendering, skins, integration and verification.

## Supplier evidence

- Birmingham Mauritius: https://www.birmingham.mu/products-category/glass-products-services/ — published partition options10mm/12mm tempered and10.38mm/12.38mm laminated;8mm reeded fixed panels. No price/stock assertion. Read16October2026.
- Saint-Gobain glass physical properties: https://www.saint-gobain-sekurit.com/fr/glossaire — soda-lime glass density2500kg/m³. Laminated reference mass excludes interlayer and hardware; envelope volume includes nominal total thickness.
- New suppliers can use the exported GlassMaterialReference contract; each variant needs documented thickness, actual glass thickness for laminates, source/date and use limits. Custom thickness loses an unmatched supplier association.

These are measured planning tools. Thickness selection and quantities do not certify glazing, pool, roof or structural adequacy.

## User paths

- Doors: Select, then click/tap an existing door or its visible cutaway threshold. Edit its width, height, position and hinge; click away, Escape or × closes the inspector.
- Walls: Walls → Curved wall. Choose Straight or Curve; a curve uses start, end and bend points. Done keeps an open wall run; a closed run forms rooms through the existing shared-wall engine.
- Openings: Openings / Door / Window → Size & shape. Choose Wall opening for an unglazed hole, with width/height or circular diameter and a bottom/sill height.
- Roof: choose Roof in the floor selector → Draw roof outline. Author its footprint and edit the overhang in metres. The model's overhang/pitch is applied once in the Materials estimate.
- Glass: Walls → Wall material → Glass. Choose a dated Birmingham reference or enter a custom thickness. A changed thickness clears an unmatched supplier association. Use on walls arms the brush; Apply material to active room changes that room's walls.
- Outdoors: Garden → Tarmac, paving, concrete or Swimming pool. Drag two corners; outdoor outlines also support straight/curved polygons. Select a surface for material/sub-base depth or pool excavation, shell and water quantities.
- Products: drag a catalogue tile into the visible plan or house and release. The existing dimension/fit validation remains; invalid drops do not create an item. Details is a separate information control.
- Skins: EN / Preferences → Colour theme and Build backdrop. These are device preferences, not changes to the model or its finish specifications.

## Scope limits to preserve in pitches

Curves persist as measured short segments, not post-save spline handles. Openings need one straight wall edge and cannot yet span a curved chain. Roofs support a custom single footprint and existing pitch modes, not engineered intersections/valleys. Pools are rectangular planning basins; a supplier reference is not its exact mould. No new supplier stock API or automatic purchase connection is claimed. Existing shared Neon activation still requires its separate migration/review; this task performs no database writes.

## Final preview proof

Pinned application: https://ppw-designer-2d-3pnq6uesz-victor-ppw.vercel.app; commit a07178f260ea7eb767ea4042ef743f323a70c590. Cache-busted /api/healthcheck returned 200, env preview and the exact SHA. Eight terminal Playwright desktop/phone live cases pass with zero console/page/network errors, writes or horizontal overflow; screenshots inspected. All 34 directory URLs return 200. GitHub application/API typechecks, Vitest, secret scan and Vercel pass. Existing Lighthouse performance/PWA assertions remain failing. See docs/qa-advanced-live-2026-10-16/report.json and links.json. Verification used a process-only Vercel edge resolver with the original host and TLS; no machine DNS changes.
