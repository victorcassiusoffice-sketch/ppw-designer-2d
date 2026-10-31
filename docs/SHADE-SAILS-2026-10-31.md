# Shade sails in the Designer (31 October 2026)

A shade sail is a tensioned fabric held at three to six fixing points. The Designer now lets a customer place one on a build, drag its fixing points on the plan, set each point's height and support (post or wall), and read what a maker and an installer would want to know before quoting: finished sizes, stretch headroom and fit, the twist that keeps the sail quiet, corner loads, post and footing advice, and where the shade falls. The 3D view shows the sail as a saddle surface with its cables, turnbuckles and posts.

No price is shown or computed anywhere. The engine gives sizes and loads from published installation guides and fabric datasheets; a maker confirms the sizes from the real fixing points, and an engineer certifies posts, footings and cyclone wind.

## Where it lives

| Piece | File | What it does |
| --- | --- | --- |
| Engine | `src/designer/shade.ts` | Types, limits, normalisation (reject, never clamp), the estimate (`estimateShadeSail`), the saddle surface (`shadeSailSurface`) and the default sail. Sources S1 to S11 are listed at the top of the file. |
| Contract | `src/designer/shadeContract.ts` | Zod schema for the saved `shade` field and its description. |
| Store | `src/store/propertyStore.ts` | `property.shade` (optional; a design saved before this round-trips byte for byte), `setShade`, `addShadeSail`, `updateShadeSail`, `removeShadeSail`, `updateShadeAnchor`, `addShadeAnchor`, `removeShadeAnchor`; loaded designs pass through `normaliseShade`. |
| Plan layer | `src/components/ShadePlanLayer.tsx` | Konva outline, chords and draggable fixing points on the ground level; drag moves a point in plan metres. |
| 3D | `src/components/three/shadeMeshes.ts` | Membrane (double-sided), edge cables, turnbuckles, leaning posts (7 degrees) and wall brackets, named `shade-sail-<id>`, `shade-post-<anchor>` and so on; added to the stage with the landscape layer. |
| Workspace | `src/components/ShadeWorkspace.tsx`, `shadeWorkspace.css` | The side panel: sails list, fabric, colour, hardware gap, edge curve, the fixing-point table (x, y, height, support), optional made sizes, and the report. Opens on the `Shade sails` button (Site & tools on a laptop, Menu on a phone), on `ppw:open-shade`, or `?panel=shade`. |
| Evidence | `src/designer/estimateEvidence.ts` | The shade engine is the twelfth row of the estimate-evidence inventory, with its inputs, outputs, basis and limits. |

Tests: `src/designer/__tests__/shade.test.ts` (engine), `src/components/three/__tests__/shadeMeshes.test.ts` (3D), `src/components/__tests__/ShadeWorkspace.test.tsx` (workspace), `src/store/__tests__/shadePersistence.test.ts` (save and load).

## What the engine computes

For each sail, from its fixing points (plan x, y in metres, height in metres, post or wall), fabric, hardware gap and edge curve:

- **Finished chords.** Each edge's span between fixing points, less the hardware gap at both ends (default 0.3 m: the turnbuckle, shackle and corner ring, S1), gives the chord the maker cuts to. Edges are curved (catenary) by a percentage of the chord (default 7 %, S2), so the fabric edge is shorter than the straight line; the curved edge length and the sag depth are reported.
- **Stretch headroom and fit.** Knitted HDPE stretches about 5 % in service and is cut 2.5 to 5 % under the chord so the tension comes from the stretch (S3, S4); PVC-coated fabric stretches under 1.2 % and is cut closer to size (S5). The report shows, per edge, how much the relaxed chord can grow before the fabric runs out of stretch, and a fit of `fits`, `tight` or `slack`. If the customer enters a sail that was already made (its edge lengths), the engine checks that sail against the drawn points instead of a new cut.
- **Twist (hypar).** With four or more points, alternate high and low corners by at least a fifth of the mean span and never under 0.9 m (S6, S7); the report names the form (`hypar`, `sloped`, `flat`) and the twist still needed. A triangle cannot twist, so one corner must drop by a fifth of the span for rain to run off.
- **Cable tension and corner loads.** Edge cable tension is the fabric prestress times the edge radius (T = w R, S8); corner loads add the two edge tensions by their angle. A corner above 7 kN or a side ratio over 2.5 is flagged.
- **Posts and footings.** For a post point the report suggests a circular hollow section from a typical table (89 x 3.2 up to 139.7 x 4.5 mm by height and load, S9), a footing of at least 0.8 m and a third of the post height (S10), and a lean of 5 to 10 degrees away from the sail. Every post line says an engineer certifies it.
- **Wind.** Mauritius sees cyclone gusts above 120 km/h (record 280 km/h, S11). The report says to take the sail down when a cyclone warning is issued; it does not compute wind load.
- **Shade.** The shade sits off the sail's plan outline: south in June (sun zenith about 43.7 degrees at noon), north in December. The report gives the offset so the customer can see whether the terrace is shaded at the hours that matter.
- **Hardware count.** Turnbuckles, shackles, corner rings, posts and wall brackets, counted from the fixing points.
- **Warnings.** Crossing edges, flat triangle, missing twist, a corner under 30 degrees, side ratio, a span over 8 m, corner load, over-stretched or slack edges, short chords, posts to certify, cyclone, shade movement.

Limits: three to six points per sail, twenty sails per design; any saved value outside its range is rejected on load and the design opens without that sail rather than with a clamped one.

## How to use it

1. Open a design in 2D. Laptop: `Site & tools`, then `Shade sails`. Phone: `Menu`, then `Shade sails`. Or open `?panel=shade`.
2. `+ Add a sail` places a 3.6 m four-point hypar (3.2 and 2.2 m corners) at the active room's centre. Drag the numbered points on the plan; type heights and choose post or wall in the table.
3. Read the report: finished chords, fit, twist, corner loads, posts, hardware, shade. Change the fabric, gap or curve and watch the numbers move.
4. Switch to 3D House to see the saddle, cables and posts on the build.
5. If a maker has already supplied the sail, enter its edge lengths under `Made sail` and the report checks that sail against the drawn points.

## What it does not do

No price, no supplier names, no wind-load calculation, no structural certification. The membrane shape is a mean-value-coordinate saddle for the picture, not a form-finding result; the engine's numbers do not depend on it.
