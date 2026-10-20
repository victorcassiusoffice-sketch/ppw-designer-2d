# Foundation dimensions and house guide — 15 October 2026

Status: local implementation; publication and integrated browser proof belong to the main release workflow. No orders, invoices, database changes or engineering approvals were produced.

## User workflow

Foundation opens with a visible **Hole dimensions** card. Set depth before drawing, choose **Dig rectangular hole** (two opposite corners) or **Circular hole** (one centre point), then edit exact dimensions. Rectangles retain the existing Slab / raft, Strip footing and Pad footing options. Concrete remains a separate design stage with its own thickness, supply assumptions and entered reinforcement schedule.

For a circular hole, diameter, depth, top elevation and centre are explicit fields. The displayed individual quantity is `π × (diameter / 2)² × depth` in cubic metres. It is excavation coordination geometry, not a drilled pile, concrete specification, safe unsupported hole or reinforcement design. Ground/temporary works review remains required. No cylinder concrete or steel is inferred.

The **House build guide** follows 19 review steps: brief; measured plan; excavation; foundation concrete/steel; walls; openings; floors/stairs; plumbing; electrical/data; HVAC; fire; security; roof/solar; finishes; furnishing; landscape; quantities; professional review; supplier schedule/handover. English, French, Spanish and Simplified Chinese copy is included. Opening a tool collapses the guide; Close, Minimise, Escape and outside interaction dismiss it without a blocking backdrop. Checkboxes record the user's review, never site completion or professional approval.

## Persistent model and quantities

- `FoundationModel.version` stays 1. Existing rectangular `elements` and MCP proposals remain compatible. Optional `bores` contains at most 100 `{id,name,x,y,diameterM,depthM,topElevationM}` records; coordinates and dimensions use metres. IDs are unique across bores and elements.
- Strict external schema, store normalisation, saved-page reload, snapshot API validation and AI draft conversion preserve bore precision. AI proposals reject circular excavations extending outside the plot.
- `foundationBoreVolumeM3` is analytical. `foundationBoreTakeoff` detects real circle/circle and circle/rectangle intersection across overlapping elevation intervals. Disjoint or merely tangent bodies can be summed. If any bore intersects another hole or concrete, the combined bore/overall excavation totals are `null`; gross individual volumes remain labelled and must not be added.
- Existing `excavationVolumeM3` and `remainingExcavationM3` still refer to rectangular elements. New `totalExcavationVolumeM3` and `totalRemainingExcavationM3` include disjoint bores or withhold with `null`. This distinction is published by `get_foundation_schema`.
- Concrete union, mix ratio, allowance and straight-bar calculations are unchanged. An enabled drawn-foundation model replaces the legacy ground-base allowance, including an excavation-only model; the editor/report explicitly explain that excavation-only has zero concrete.
- The 2D circle and 3D open soil cylinder use those same dimensions. Three.js batches all bore soil, bases and decorative rims into three meshes. Mesh faceting and the decorative rim do not calculate quantities. Overlapping cylinder graphics are coordination envelopes, not a boolean union.
- Project review includes bore-only missing ground/design references, temporary works warnings, exact circle-to-tree-protection screening, and an unresolved-union finding. Calculation budgets include bore overlap comparisons.

## Integration contract

Mount `HouseBuildTutorial` once. Dispatch `olb:open-house-tutorial` to show it. The guide emits `olb:tutorial-action` with `{action}`; the root dispatcher owns existing tool/workspace navigation. Actions are typed in `src/designer/houseBuildTutorial.ts`, including separate plumbing/HVAC/fire/security routes. Checklist progress is stored locally per project under `olb.house-tutorial.v1:<projectId>`; it is not an engineering record or synchronized cloud state. Storage failures are shown and preserve the current in-memory session.

`hasFoundationGeometry` includes bores for empty-state, bounds and below-ground inspection. Foundation listens for `olb:close-workspaces` and finishes its original-view navigation before tutorial handover. `propertyHasContent` counts bore-only designs, so their work is eligible for saved-page persistence.

Cold foundation demo links wait for the initial demo-page ready event before opening; later project changes close the workspace without reopening it. Phone layout reserves a 240 px drawing surface, grows to include its quantity rows and lets the dimension inspector scroll in the remaining space. Final browser proof checks that totals remain within the drawing panel.

## Focused verification

Analytical cylinder volume, exact measured bounds, overlap withholding, tangency and disjoint-depth cases; existing rectangle union and MCP compatibility; 2D editing without camera reset; actual three.js soil bounds; saved page/storage roundtrip; Clear Undo; AI plot validation; project review; tutorial launch/dismissal, project isolation, language copy and blocked-storage behavior. Final integrated browser screenshots and suite totals are recorded separately in the release QA reports.
