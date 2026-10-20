# Exact merchant product pipeline — 20 October 2026

## Identified service

The realistic fitness models already in this repository were created through **Fal.ai Hunyuan3D 2.1**, using `scripts/gen-3d-models.mjs` and the provenance in `src/data/productModels.json`. The historical endpoint was `fal-ai/hunyuan3d-v21`. It is now deprecated. The 2D raster pipeline was separate: OpenArt photo-conditioned top-down images. OpenArt is connected but reported zero credits during this audit.

The existing Fal credential authenticated the pricing request. Account/billing identity could not be verified because the billing request returned HTTP 403. No account email, balance or ownership is inferred. Credentials are not copied into this repository or this report.

The supported replacement used for the **one approved basin generation** is `fal-ai/hunyuan-3d/v3.1/pro/image-to-3d`. Its input is the exact product photograph, `generate_type: "Normal"` and `enable_pbr: true`; no custom face count or multi-view surcharge is requested. See the [official API](https://fal.ai/models/fal-ai/hunyuan-3d/v3.1/pro/image-to-3d/api).

## Delivered exact product

- Existing product ID: `espace-durastyle-washbasin-800`.
- Existing SKU: `ESPACE-4021534850721`; manufacturer reference: Duravit `2320800000`.
- [Espace Maison product](https://www.espacemaison.mu/products/washbasin-for-cabinet).
- [Manufacturer exact-product record](https://la.pro.duravit.com/pro/content/homepage/productos/categorias/resumen/productos~402880943a1b6e1b013a1bd2494e0047.la-es.html?product=781167&nser=2105&ncat=washbasins).
- [Exact isolated photograph](https://wgassets.duravit.cloud/dimg/992657837_web2_prod_normal_2.jpg). One ceramic basin; no tap, cabinet or trap.
- Dimensions remain **800 × 480 × 170 mm**. Runtime geometry is fitted to this canonical envelope. No generated shape changes quantity, price, installation clearances or engineering inputs.
- Model: `public/models/espace-durastyle-washbasin-800-cb879ab4a23409c3.glb` — 132,928 bytes, approximately 20,000 triangles.
- Plan: `public/products/topdown/espace-durastyle-washbasin-800-cb879ab4a23409c3.png` — a true orthographic projection of that GLB using the application's renderer; **not an OpenArt output**.
- Catalog photo: `public/products/photos/espace-durastyle-washbasin-800.jpg`.
- Source metadata: `src/data/merchantProductAssets.json`. The existing merchant API response enrichment now reuses this metadata by exact SKU; no database, inventory, partner or order records were created.

The model is an AI reconstruction from a product photograph. The unseen underside and fine detail are inferred; it is not manufacturer CAD. The top/front/back/side contact sheet and actual Designer desktop/phone evidence are in `docs/qa-merchant-basin-2026-10-19/`. Upright, front edge, fitted bounds and 90-degree rotation were checked. All 21 pre-existing model entries remain.

The generated material's linear base colour was calibrated from `[1, 1, 1, 1]` to `[0.8, 0.8, 0.8, 1]` after comparing both under the application's unchanged architectural lighting and product environment. This preserves white ceramic while making the recessed bowl visible. Only the GLB JSON material factor changed; the binary geometry and textures were verified byte-for-byte unchanged. The asset was rehashed and its overhead image rebaked without another generation request. `model-reference-albedo-comparison.png` records the comparison.

## Repeatable workflow

1. Confirm one merchant SKU, manufacturer reference, dimensions and an isolated source photograph. A set photograph cannot stand in for one sofa. Verify accessories before generating.
2. Add reviewed reference metadata to `src/data/merchantProductAssets.json`, preserving the product's existing ID/SKU.
3. Export and inspect the job:

   ```powershell
   npx tsx scripts/prepare-merchant-model.ts --product espace-durastyle-washbasin-800 --out docs/product-source-audit-2026-10-19/basin-job.json
   node scripts/generate-merchant-model.mjs --job docs/product-source-audit-2026-10-19/basin-job.json --dry-run
   ```

4. Paid submission requires a separately approved bounded budget. The generator defaults to dry run, creates a submit-intent journal before posting, and refuses a second submission for the same job. Use `--resume` only to retrieve the existing receipt; never retry a paid POST automatically.
5. The existing optimizer reduces geometry and textures. It writes a candidate in ignored `models-raw/merchant-jobs/`, not directly into the live manifest.
6. Inspect the candidate against the source photograph, check orientation and dimensions, then register its immutable filename and exact `source.sku`. The same SKU resolves through API IDs such as `m-98765`.
7. Bake the measured plan projection and reuse it through the source metadata. Real overhead artwork is authoritative; symbolic SVG remains a fallback.
8. Run the source/API/model tests and local desktop/phone capture tools:

   ```powershell
   node --test scripts/__tests__/generate-merchant-model.test.mjs
   npx vitest run src/data/__tests__/merchantProductAssets.test.ts src/data/__tests__/productModels.test.ts
   node tools/merchant-model-review-2026-10-19.mjs
   node tools/merchant-basin-shot-2026-10-19.mjs
   ```

The capture tools use the local development server on port 5174 and prohibit external writes.

## Next source batch — not generated or approved

| Product | Known reference and dimensions | Reviewed source | Remaining requirement |
| --- | --- | --- | --- |
| Duravit D-Code floorstanding bidet | Existing ID `espace-duravit-dcode-bidet-224110`; SKU `DURAVIT-22411000002`; 560 × 360 × 385 mm | [Manufacturer product 245285](https://la.pro.duravit.com/pro/content/homepage/productos/categorias/resumen/productos~402880943a1b6e1b013a1bd2494e0047.la-es.html?ncat=bidets&nser=7120&product=245285), [photo 991054549](https://wgassets.duravit.cloud/dimg/991054549_web2_prod_normal_2.jpg), [photo 993956811](https://wgassets.duravit.cloud/dimg/993956811_web2_prod_normal_2.jpg) | Both available photographs include a tap. Obtain an exact isolated ceramic-body photo or review an explicitly edited reference before generating. Manufacturer download links returned no usable model in this session; no access check was bypassed. |
| Seville acacia garden sofa component | Existing SKU `ESPACE-3700103115997-SOFA-COMPONENT`; current Espace envelope remains 1140 × 670 × 870 mm | [Espace Maison set](https://www.espacemaison.mu/products/seville-acacia-wood-garden-sofa-set-4-pieces), [Proloisirs FSCA17-25](https://www.proloisirs.fr/ensemble-detente-seville-set-complet), [reference photo](https://proloisirs-media.riashop.app/images/1600x1168/181330.jpg) | Available photographs show the whole set or occluded legs. Obtain an isolated sofa photo and reconcile ambiguous manufacturer height/depth labels before any new dimension assignment. Existing dimensions were not silently swapped. |

Rejected/context photographs are kept beside this note as audit evidence, not registered as product plan/model assets. No paid request was made for these products. No live merchant stock feed or partnership is claimed.
