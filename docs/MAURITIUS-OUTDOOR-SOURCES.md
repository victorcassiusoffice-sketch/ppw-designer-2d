# Mauritian outdoor catalogue — source ledger

Reviewed 30 September 2026. This is a curated catalogue snapshot, not a live stock feed, a supplier agreement, or a reservation. Published dimensions support spatial planning; verify delivery, price and final specifications with each retailer before purchase.

| Product ID | Supplier | Supplier reference | Overall L × W × H in cm | Price handling | Primary source |
|---|---|---|---|---|---|
| `mrbricolage-mistral-70` | Mr. Bricolage Mauritius | EAN 5414882248224; manufacturer 224822 | 70 × 70 × 71 | Rs 5,900 snapshot from Grand Baie category; 7 kg on product page | [Product](https://www.mr-bricolage.mu/Grandbaie/table-pliable-mistral-metal-gris-anthracite-70-x-70-x-h71-cm.html), [Grand Baie catalogue](https://www.mr-bricolage.mu/Grandbaie/jardin/profiter-du-jardin/mobilier-de-jardin/tables-de-jardin.html) |
| `mrbricolage-aurore-135` | Mr. Bricolage Mauritius | EAN 4713410646022; manufacturer 348218 | 135 × 90 × 75, **closed** | Price on request; published weight 22 kg | [Product](https://www.mr-bricolage.mu/table-de-jardin-aurore-135-270-x-90-x-75-cm-alu-gris.html) |
| `jkalachand-1798-e` | JKalachand | 1798-E | 56 × 50 × 77 | Rs 2,990 snapshot | [Product](https://jkalachand.com/grey-plastic-chairs-jkalachand-1798-e.html) |
| `jkalachand-1799-w` | JKalachand | 1799-W | 42 × 52 × 83 | Rs 2,960 snapshot; supplier asks customers to enquire about availability | [Product](https://jkalachand.com/white-plastic-chair-1799-w.html) |
| `jkalachand-gs1004-swing` | JKalachand | GS-1004-SST-3S | 215 × 128 × 165 | Rs 12,900 snapshot | [Product](https://jkalachand.com/furniture/outdoor/3-seater-outdoor-swing-gs-1004-sst-3s.html) |

JKalachand measurements are published in millimetres and converted to centimetres without rounding. Source content was retrieved through indexed official product pages; direct retrieval returned 403/cache-miss for some JKalachand pages. Do not interpret an indexed “in stock” label as live inventory. Mr. Bricolage prices depend on selected store and may change. Aurore is rendered at its closed 135 cm length: the published 270 cm extension is documented but not simulated. Its quote flag prevents the numeric zero placeholder from appearing as a free product in catalogue, product details and cart.

Unknown weights retain the existing schema’s zero sentinel and are disclosed in the notes; product details show “Confirm with supplier.” Commission is zero and `shopify_ready` is false because commercial terms and inventory integration have not been established. Garden swing motion/clearance is not mechanically simulated.

## Rendering and reuse

`src/data/mauritiusOutdoor.ts` holds the supplier snapshot, dated notes and explicit preview-kind map. `src/data/products.ts` merges these products into every bundled catalogue lookup rather than only the demo. `outdoor: true` puts them in the existing Outdoor category and enables plot placement.

`public/products/outdoor/` contains original SVG dimensional illustrations and plan symbols. They are deliberately marked **DIMENSIONAL ILLUSTRATION**, are not supplier photographs and do not purport to reproduce exact styling. The procedural 3D bodies are planning approximations bounded by the published dimensions, not manufacturer CAD. New authorised GLB models can replace them through the existing model import pipeline after review. No retailer photo, logo or game code was copied.

The importer/update path is ordinary version-controlled data with source provenance and regression tests. Add another measured product by adding a row, its source/check date, a supported shape or reviewed GLB, and original/licensed imagery. Do not assign an invented overall size to a multi-piece set. Do not mark prices as current without refreshing the source.

## Construction presentation

`/pitch/construction` is an independent PPW presentation using UBP as a construction-supplier example. It embeds the working designer at `/embed/designer?scene=home&view=3d&panel=materials`. The 2D/3D buttons use the existing same-origin message bridge, preserving the editing session. Material facts come from `src/data/constructionMaterials.ts`; the separate delivery-date study is labelled as an illustration and sends nothing.

The UBP Classic 6-inch source above in the construction registry publishes 450 × 200 × 150 mm. The [UBP Smart Blocks technical document](https://ubp.mu/sites/default/files/dta_vf_6.pdf) describes U Blocks for horizontal ties/lintels and Corner Blocks for vertical ties/jambs. Its important distinction between ties and a designed reinforced structural frame remains visible in the presentation. No structural approval is inferred from a block size or a cement ratio.

The construction presentation retains the existing Victor meeting link. Order release, contractor booking, supplier acceptance, account permissions and finance/signature integrations are presented as future connected workflows. The public demonstration has no submission form and places no orders. Existing developer and merchant pitches now describe optional Materials and sourced outdoor furniture, and link to the construction presentation.
