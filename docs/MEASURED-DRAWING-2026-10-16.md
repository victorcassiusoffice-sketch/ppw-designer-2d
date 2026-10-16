# Measured drawing integration

## Implemented model

`src/designer/measuredPath.ts` is the shared world-metre authoring kernel for walls, roof outlines and outdoor outlines. A path contains line segments or quadratic curves. Adaptive subdivision bounds the curve-to-chord deviation at 3 mm; a maximum of 512 vertices prevents unbounded interactive work. Invalid, non-finite, self-crossing and doubled-back shapes are rejected. The canonical sampled vertices are saved, rendered and measured everywhere. The reported length/area measures this canonical geometry rather than an unrelated decorative curve.

`src/store/measuredPathToolStore.ts` is transient, shared by 2D and 3D pointer adapters. A curved segment uses three taps: start, end and a point through which the curve bends. Straight/curve segments can be mixed in roof/outdoor outlines. Close outline commits one canonical polygon. Cancel/Escape does not change committed work; changing project/floor cancels the draft. The dock-mounted `MeasuredPathOptions` provides Undo point, Close/Done, explicit cancel, measurement feedback and roof overhang.

Wall paths enter the existing connected-wall graph. Closing a shape against existing edges creates rooms without redrawing shared walls. New straight and curved walls inherit the active wall substrate, including glass thickness and supplier reference. Room graph conversion and JSON save/load retain that metadata. Applying glass clears paint/cladding from the affected room faces; stale imported paint on glass is excluded from paint estimates.

## Openings and consistent quantities

Openings now carry optional measured clear height, sill and rectangle/arch/circle profiles; `hole` is an unglazed opening kind. Circles use width as diameter. Doors/doorways cannot be circular. Heights plus sill must fit the host floor's wall height. Vertically separated openings can share the same horizontal position, including on a shared physical wall; actual overlap is rejected.

Rendered curves retain base/floor contact shading, but shallow joined wall segments (under 20 degrees) do not receive a dark vertical corner stripe at every tessellation chord. Real corners, T junctions and free endpoints keep their edge shading. This changes rendering only; authored length, area and construction estimates keep the canonical measured vertices.

`openingGeometry.ts` produces a single sampled wall-face polygon for the 3D opening, window/frame, masonry deduction and paint deduction. Circle/arch curves use adaptive angular sampling with a 3 mm chord-deviation target and a minimum sampling density. Overlapping imported profiles are unioned rather than deducted twice; the existing paint convention retains holes below 1 m² for cutting-in. This is geometric estimating, not structural opening or lintel approval.

## Roof geometry and preservation

`RoofConfig.outline` overrides automatic room-shaped roof slabs with one authored footprint. The same winding-normalized polygon survives save/load and roof synchronization. Editing the underlying rooms does not overwrite an authored outline. Existing roof objects are retained, and outline edits that would strand their whole scaled footprint are refused. Multiple existing roof finishes cannot be silently consolidated; remove those finishes or use Undo. Returning to automatic roof footprints refuses edits that would lose a roof finish or strand an object.

`roofMeasuredAreas` reports footprint, projected area including overhang and pitched covering area for one roof polygon. The property material adapter unions projected roof outlines so overlapping eaves are counted once. A `roofProfile` tells the sheet estimator that eaves are already included and supplies the drawn pitch/slopes. With no manual dimensions, neither overhang nor pitch is applied twice. Explicit manual length/width overrides use the separately editable purchasing-sheet assumptions, and the Materials panel explains this distinction. Irregular/multiple roof faces still use a bounding rectangle as a sheet/rebar purchasing allowance, not a cut list. Old designs without an explicit roof configuration retain their earlier footprint estimate until a roof configuration is set.

Roof product placement remains constrained to the supported slab/outline, rather than the projecting eave. Overhang is included in covering quantities. Structural support for equipment on projecting eaves is not inferred.

## Known limits

- Curves are committed as measured tessellated segments, not as editable spline handles after saving. Undo/re-draw changes the curve.
- Fine faceting/seams can remain between individual curved-wall slabs in WebGL; their synthetic dark corner stripes are suppressed, but a continuous mitred render mesh is not implemented.
- Openings are hosted on one straight canonical wall edge. A wide opening spanning several curved-wall chords is not yet supported.
- Arches use a semicircular crown when tall enough; a shallow arch uses a half ellipse. Neither determines lintels, reinforcement or load paths.
- Roof intersections, valleys, hips, penetrations, compound pitches and engineered drainage remain outside the automatic roof model.
- Pool geometry remains rectangular; outdoor polygon/curve authoring is for the other supported landscape surfaces.
- Exactly matching opposite shared-glass edges render as one centred pane at the specified thickness in WebGL and fallback views, retaining both room addresses and cutouts. Partial-edge overlaps and contradictory imported thicknesses remain independent; split matching wall edges or reconcile the material before treating them as one pane.
- No supplier purchase, live database migration, deployment or structural certification is performed by these changes.

## Validation

Focused tests cover analytical curve area/length tolerance, self-crossing rejection, graph room formation and material persistence, out-of-plot bends, three-tap cancellation, custom roof persistence, overhang/pitch single application, overlapping-eave union, opening profile area and clipping, vertically stacked openings, full save/load, stale glass paint suppression, existing opening placement and estimator regressions. Desktop/phone screenshots and whole-app build verification are recorded by the coordinating agent.
