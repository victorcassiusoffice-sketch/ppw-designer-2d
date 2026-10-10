# Foundation excavation and fill — 9 October 2026

## Workflow refinement

Read `ESTIMATION-FOUNDATION-WORKFLOW-2026-10-08.md` before implementation. The design now follows: draw the hole footprint → enter excavation top/depth and measured margin → set the planned concrete thickness → add concrete to the design → enter the checked reinforcement schedule → review quantities and supplier specification. “Excavated” and “filled” are design preview stages, never claims about completed site work.

Concrete rectangles retain their original centre, dimensions and datum. An optional excavation envelope extends the footprint by an entered margin on each side. New drawings start with an editable 1 m hole and 0.2 m concrete thickness; these are visible placeholders, not design recommendations. Concrete must fit inside the hole vertically. Changing depth keeps the planned concrete at its bottom. Legacy elements without excavation remain concrete, with unchanged quantities.

Exact axis-aligned unions calculate excavated volume, planned concrete, concrete added to the design, and their intersection. Overlapping concrete and holes are counted once. Remaining void is excavation minus concrete actually intersecting it; concrete elsewhere is not deducted. Remaining void is not a backfill purchase quantity. Soil bulking, disposal, compaction, batter slopes, shoring, groundwater, membranes and blinding remain separate schedules. Pending fill is explicitly incomplete for quotation purposes.

The 2D footprint, 3D concrete body, soil cutaway and non-WebGL fallback use this same geometry. Internal soil faces are removed where holes meet. Soil rims and depth labels are visual annotations excluded from quantities. Camera edits do not trigger Fit. The floor selector returns to another level and the original 2D/3D view.

## Supplier evidence checked 9 October 2026

The Mauritian company intended by “UPB” is UBP, The United Basalt Products; Premix identifies itself as part of UBP. This is separate from the Latvian company UPB.

- [Premix — Who we are](https://premix.mu/en/who-we-are/): confirms UBP relationship and describes laboratory testing and product standards. This supplier statement does not certify a generated design.
- [Premix — The Classics](https://premix.mu/en/product-category/the-classics/): lists traditional ready-mix grades and applications. The app stores the family reference only; it does not auto-select a structural grade.
- [Premix — The Pro Series](https://premix.mu/en/product-category/the-pro-series/): lists specialty concretes. The app links this range for project-specific supplier review without applying published specialty performance to an arbitrary foundation.
- [Premix — Ready-mix explanation](https://premix.mu/en/blog/everything-you-need-to-know-about-ready-mix-concrete/): describes batching-plant production versus on-site ingredient mixing. Ready-mix and site-mix procurement remain alternatives.
- [Espace Maison — Rocksand and macadams](https://www.espacemaison.mu/shop/building-materials/structural-work-and-masonry/rocksand-and-macadams): retailer reference for UBP granular products. Grading is not a concrete ratio. No bulk-density assumption, live stock claim or price is copied into the foundation estimator.

No source was used to declare a universal safe foundation size, excavation depth, soil support method, grade or reinforcement schedule. Entered rebar remains a straight-bar estimating schedule requiring project review.

## Verification

Focused tests cover staged quantity separation, overlap/intersection volumes, negative coordinates, exact decimal dimensions, malformed holes, schema round-trip, legacy compatibility, paired rendering envelopes, internal soil-face removal, and UI camera preservation through hole/depth/fill edits. The MCP foundation regression suite remains compatible with legacy clients. Browser/preview acceptance is recorded by the integration owner.
