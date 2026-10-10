# Room Designer — measured construction workflow

For employee demonstrations, supplier consultations and project planning. Use the preview linked in CURRENT-WORK-LINKS.md; publication to production is a separate review.

1. Open a design, confirm its units, floor heights and dimensions. The plan and 3D use the same property geometry.
2. Open **Foundation** from the floor menu or Materials → Concrete. Choose Slab / raft, Strip or Pad and tap two corners. Enter the checked length, width, depth and top elevation. These starting shapes are quantity inputs, not a foundation design recommendation.
3. Enable inclusion in Materials. Foundation mode replaces the old single ground-base allowance. Intersecting concrete volumes count once. Use **3D foundation** to inspect below ground, or Back to resume the house. Fit is explicit; editing does not refit the camera.
4. Select ready-mix by volume or site-mix ingredients. Edit the loose-volume ratio, measured yield factor and allowance. An estimating ratio is not a certified strength grade. Enter a reviewed reinforcement schedule if required; omitted or invalid schedules remain incomplete.
5. Open **Plumbing & Electric** for a floor. Place the mains, sink, toilet, electrical board or surveyed drainage connection marker. Draw the appropriate service route, tap compatible ports, or choose Start/End connection on a selected route. Linked endpoints follow fixture movement and rotation. Crossing lines alone do not connect.
6. Set elevations relative to that floor. Below-floor routes use negative values; drainage connections require a surveyed waste level. A riser between floors is a separate measured route. Review penetrations and clashes against the foundation footprints.
7. Expand **Mauritian products · paired 2D / 3D** to place a sourced tank, sanitaryware or electrical enclosure. Published outer dimensions define both views. Simplified model details and generic service markers are not manufacturer connector CAD.
8. For painted faces, choose the paint and number of coats. Coat count changes raw demand; whole tins are purchased in steps. Paint retains openings smaller than one square metre for cutting-in; masonry subtracts openings from physical wall area. These are deliberately different estimating conventions.
9. Review **Materials**: select masonry dimensions, actual-versus-module basis, mortar/plaster assumptions and roof schedules. In the full Designer, choose a consistent tax basis and enter verified material rates in Costs. Missing rates stay unpriced. A changed specification or tax basis requires a rate review. Presentation mode hides rates and quotation downloads.
10. Save the project locally and export the quantities/assumptions from the full Designer for review. Demo routes do not place orders. Engineer, installer and supplier acceptance remains a separate process.

## What remains project-specific

Soil bearing capacity, foundation strength, structural reinforcement design, hydraulic capacity, drainage approval, conductor sizing, circuit protection, service penetrations, labour and delivery are not automatically determined by this planning workflow. The new read-only MCP estimators share the editor's calculations; they do not approve plans or write supplier orders.

## Implementation locations

- `C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\src\designer\foundation.ts` — foundation geometry and takeoff.
- `C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\src\designer\materials` — quantity, mix and procurement-cost engines.
- `C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\src\designer\serviceConnections.ts` — fixture endpoint relationships.
- `C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\src\data\serviceProducts.ts` — canonical product envelopes and dated supplier observations.
- `C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\api\_lib\designMcp.ts` — read-only tool entry points.
- `C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\api\_lib\calc\propertyPaintQuote.ts` — property-mode paint calculation API.
- `C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\src\pages\sales\salesPack.ts` — employee exercises and source content for the portable handbook.
