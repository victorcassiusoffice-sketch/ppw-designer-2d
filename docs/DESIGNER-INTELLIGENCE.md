# Permanent design and estimating contracts

Implemented 30 September 2026. These are ordinary, tested application modules shared by the designer, Studio and every embedded demo. No chat memory, generated prompt or external AI service is needed to use them.

## Measurement → assumptions → quantities → presentation

- `src/designer/propertyMaterials.ts` translates the shared Property into physical walls and building footprints. Room/free-wall segments on a storey are split into collinear intervals; shared walls count once. Overlapping/mirrored opening rectangles are unioned, clipped to the wall and deducted once. A vertical sweep unions arbitrary simple room polygons, preserving courtyards and avoiding overlap double-counts. Wall scope may be one floor; the ground base and top-storey roof always remain building-wide.
- `src/designer/materials/types.ts` is the version 1 persisted contract; `settings.ts` validates values and applies supplier presets. `estimate.ts` is pure and returns components, separate purchasing conversions, formulas, assumptions and warnings. Extend this layer before adding new controls. Do not sum summary lines with the components they summarize.
- `Property.materials` is optional, travels through existing autosave, saved pages, history and cloud property payloads, and is normalized on file load and local rehydration. Older designs acquire no material assumptions until an input is changed. A future incompatible schema needs an explicit migration before changing the version.
- `src/data/constructionMaterials.ts` holds supplier references and product dimension presets. Sources are dated; no supplier availability, price or commercial relationship is inferred. Details and formulas live in `MATERIALS-RESEARCH-MAURITIUS.md`.
- `MaterialsPanel.tsx` only edits saved assumptions and presents the report. JSON export includes the design identifier, measured geometry, full settings, formulas and source ledger. It does not submit an order. Walls, Concrete, Roof and Report are progressive sections within an optional workspace.

## Scope and accuracy

Concrete block presets are published product dimensions, not independently measured batches. Confirm actual versus nominal joint-inclusive dimensions. Rocksand and aggregate are estimated as loose dry volumes with editable conversion factors. Ratios do not certify concrete strength. Pillars use a separately entered clear-volume schedule; locations, foundations, beams, lintels, water/cement design and structural loads are not inferred.

Ground base volume uses ground footprint × entered depth. Concrete roof volume uses exact top-storey union area × entered depth, with an optional verified area override for penetrations/overhangs. The entered orthogonal rebar grid reserves whole stock bars per run and explicit splices; cross-run offcuts are not assumed reusable. This is conservative stock allocation, not a cut-and-bend or structural design. Irregular roof steel and sheet layouts are identified as rectangle allowances. Sheet profiles use effective cover once, sloped run, end laps and purchased lengths; fixing density and support spacing remain supplied design inputs.

## Product and lighting intelligence

- `fitToSize.ts` applies final model heading before dimension fitting and measures transformed GLB vertices. `components/three/productBody.ts` keeps fallback envelopes faithful to catalog length, width, height and rotation. Product bodies must preserve those dimensions when selected, moved or placed on upper floors.
- `data/mauritiusOutdoor.ts` supplies dated, measured outdoor products and provenance. `dimensionalPreview.ts` maps supported shapes into original `furniturePreview.ts` bodies. New merchants can use these shapes without creating a duplicate renderer. Supplier GLB imports are covered by `SKETCHUP-MODELS.md`.
- `designer/lighting.ts` is the shared Plan/3D source for lamp radius, colour and day/night factor. 3D also considers mount height; switched-off products emit no light. Brightness is a visual calibration, not certified lux, lumens or an electrical design. Catalog electrical estimates remain independent of these visual parameters.
- See `RENDERING-ACCURACY.md` and `MAURITIUS-OUTDOOR-SOURCES.md` for tested dimensional and source limits. Procedural previews are identified as such, never as exact manufacturer CAD.

## Interaction contract

Plan camera/readout controls occupy a normal-flow row outside the measured drawing viewport. Desktop paint/floor/energy panels reserve canvas width. Materials occupies a side dock or phone bottom dock; Solar has a phone bottom dock too. Done, Escape and canvas clicks close analysis. The input area scrolls independently, with the product estimate in a reserved footer. Selecting a 3D item shows the selection strip; Product details opens the full cost panel deliberately. Drawing, camera navigation, solar calculations and existing saved designs continue to use the same stores.

The paint tool's visual construction picker is **Wall type**. **Materials** is the separate detailed quantity workspace. Keep this distinction as features grow; avoid adding another floating panel over the house.

## Routes and verification

One source build serves `/designer`, `/designer?demo=tintex`, `/demo`, `/embed/designer`, `/studio`, `/studio/designer`, `/studio/shop` and all pitch pages. `/demo?view=3d&panel=materials` and `/embed/designer?scene=home&view=3d&panel=materials` open the optional workspace. `/pitch/construction` is an independent UBP supplier example, with actual interactive designer and clearly illustrative scheduling, alongside `/pitch/developers` and `/pitch/merchants`. Demo checkout remains blocked.

Before changing these contracts, run client/API typechecks, relevant pure calculation and persistence tests, UI tests for panel exits, build, and desktop/390px phone browser checks. Recheck imported-body bounds after facing changes; exact shared-wall deductions after geometry changes; and saved settings after schema changes. Keep BUILD-LINKS and the workflow log tied to verified deployment commits.
