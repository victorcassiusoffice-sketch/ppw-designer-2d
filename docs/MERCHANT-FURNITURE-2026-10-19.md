# Merchant furniture: measured representations

This update adds a source-linked Courts Mammouth sofa and improves the existing Espace Maison sofa. The catalogue dimensions remain the single measurement authority. These are original parametric planning representations, not a manufacturer model, photograph or exact product finish.

## Source records checked 19 October 2026

| Placeable product ID | Merchant and reference | Published envelope | Source |
| --- | --- | --- | --- |
| `courts-comfy-3-seater-dove` | Courts Mammouth, Comfy 3 Seater in Dove Fabric, 40072265 | Width 230 × depth 94 × height 94 cm | https://www.courtsmammouth.mu/product/comfy-3-seater-in-dove-fabric.html |
| `espace-seville-garden-sofa` | Espace Maison, Seville sofa component, set SKU 3700103115997 | Width 114 × depth 67 × height 87 cm | https://www.espacemaison.mu/products/seville-acacia-wood-garden-sofa-set-4-pieces |

Courts publishes fabric upholstery, grey colouring and a hardwood frame. The indexed merchant page was readable; direct automated requests were refused. No current stock or price was adopted. The Espace description specifies individual component dimensions; its contradictory set-level specification table is deliberately not used. Whole-set weight and cost are never assigned to the one sofa component. Both items require a supplier quotation. Neither reference establishes a partnership or endorsement.

## Rendering changes

- Courts Comfy has shaped seats, compressed back cushions, sewn edges, a separate upholstered frame, eased arms and hardwood feet. Fine material maps use metre-based UVs.
- Seville uses an open acacia frame, individual slats, soft polyester cushions and stitched edges. It now uses the same material-aware body in both the ordinary and service 3D renderer.
- The 2D plan photographs the same measured body from above. The Seville SVG remains the fallback when WebGL is unavailable.
- Generic sofas retain their original catalogue dimensions and now have structured arms/back frames; back-cushion compression is applied to the front face instead of the top face.
- Each new body merges to four material draw calls. Model maps are deterministic, small and disposed per instance. No external image/3D-generation service is invoked.

## Verification

Geometry tests measure the actual rendered vertices, not only source metadata: exact width/depth/height, floor origin, identical 2D/3D envelope, per-instance ownership, deterministic geometry and bounded draw/triangle counts. Existing furniture cardinal and arbitrary rotation checks pass. The public pitch references import `MERCHANT_FURNITURE_REFERENCES` from `src/data/merchantFurniture.ts`, avoiding a second dimension table.

Compiled actual-app captures: `node tools/merchant-furniture-shot-2026-10-19.mjs http://127.0.0.1:5173`; PNGs and the zero-error/no-write report are in `docs/qa-merchant-furniture-2026-10-19/`. The fixture is isolated browser storage and does not modify the shipped demo.

Final focused validation: 8 suites / 136 tests passed; `npx tsc --noEmit` and scoped ESLint passed. All six actual-app captures (1280 px desktop / 390 px phone; plan, house and closer furniture views) reported no page/console errors, no API writes and no horizontal overflow. The narrow phone floor label abbreviates; no new furniture-specific obstruction was observed.

## Next improvement

For exact visual product replicas, obtain merchant-approved photographs and licensed CAD/glTF models (with the specific SKU, measured axis convention and materials), then review the existing model import pipeline. Do not present generated seam positions, colour or internal joinery as manufacturer-verified. Weight, product availability, delivery and actual finish require supplier confirmation.

No authentic merchant photograph was substituted into this release: direct Courts product access refused automated retrieval, while the available Espace image link resolved to a generic placeholder. No corresponding product photograph existed in the repository. Unrelated image-search matches were not reused. The pitch uses actual application screenshots and links to the two merchant product pages.
