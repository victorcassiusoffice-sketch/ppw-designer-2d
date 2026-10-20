# Real product models — identified pipeline and continuation

## What made the fitness equipment

The existing fitness bodies were made with **Fal.ai, Hunyuan3D 2.1**, using product photos. Evidence is in `scripts/gen-3d-models.mjs`, `src/data/productModels.json` and `docs/designer-3d-mode-2026-09-17/README.md`. OpenArt was the separate photo-conditioned 2D artwork workflow. OpenArt did not generate those GLB meshes.

The existing Fal credential is configured locally. Read-only pricing access succeeds, but account billing access returns 403: the account owner's email and credit balance cannot be verified from this credential. No credential is copied into source or this document. The connected OpenArt account reported no available credits on 19 October; no new OpenArt generation or credit purchase was made.

Fal now marks the [original 2.1 endpoint](https://fal.ai/models/fal-ai/hunyuan3d-v21/api) deprecated. This release uses the supported [Hunyuan3D 3.1 Pro image-to-3D endpoint](https://fal.ai/models/fal-ai/hunyuan-3d/v3.1/pro/image-to-3d/api) with one isolated product image and PBR textures.

## What this release actually adds

- An exact Espace Maison / Duravit DuraStyle basin, merchant EAN 4021534850721 and manufacturer reference 2320800000. The canonical catalogue dimensions are 800 × 480 × 170 mm.
- One approved, single paid generation. The reviewed manufacturer photo has no tap or cabinet, so those separate products are not invented.
- A compressed textured GLB and a transparent overhead PNG photographed from that same fitted model. The PNG is **not OpenArt artwork**.
- The same model and catalogue dimensions are used in 2D and 3D. The model is tested at zero and 90-degree rotations and on SKU-matching API rows.
- A shared GLB loader/cache, exact-SKU source photo and description enrichment, and preservation of all existing models.

The appearance is AI-generated from a photograph, not manufacturer CAD. Fitting its bounding envelope does not validate hidden surfaces, plumbing connections, tolerances or structural suitability. Unseen details can be approximate. Tap, cabinet and trap remain separate products.

## Reusable workflow

1. Match the exact merchant SKU to a manufacturer reference. Keep length, depth and height explicit in centimetres; do not guess axes from a photo or import a whole set as one component.
2. Add reviewed photo/source metadata to `src/data/merchantProductAssets.json`. Use an isolated real product photo; reject placeholders, accessory bundles and uncertain variants. Existing product identity and quantities are retained.
3. Export a reviewed job from the canonical catalogue:

   ```powershell
   npx tsx scripts/prepare-merchant-model.ts --product espace-durastyle-washbasin-800 --out docs/product-source-audit-2026-10-19/basin-job.json
   node scripts/generate-merchant-model.mjs --job docs/product-source-audit-2026-10-19/basin-job.json --dry-run
   ```

4. Check current provider pricing and obtain approval for the specific credit-consuming batch under the team's build rules. The job records the quote date/configuration; it is not a permanent provider price guarantee. Do not reuse stale estimates or broaden an approval.
5. Submit once using `--yes` and the approved `--max-usd`. The script journals submission intent before calling Fal. On an ambiguous failure, inspect the provider's existing request; never blindly repeat the paid POST. Use `--resume` only for the recorded request.
6. Raw output and request receipts stay under ignored `models-raw/merchant-jobs/`. The existing optimizer targets 20,000 triangles, WebP textures and Draco compression. Output is staged, never automatically published.
7. Review the source photo, front/up axes, transparent overhead, 3D silhouette and measured bounds. Publish the immutable content-hashed GLB under `public/models/`, add provenance in `src/data/productModels.json`, and bake the overhead to `public/products/topdown/`.
8. Check a real catalogue placement, selection/dismissal, rotation and both views at desktop and phone widths. Preserve fallback rendering if WebGL or a model fetch fails. Run app/API types, regression tests and a compiled build before feature-preview publication.

## Source/backend behaviour

The current source is a checked product reference, not a continuous stock feed. The existing products API enriches matching rows in its **response**, without altering Neon records. Existing merchant descriptions, product prices and non-placeholder photos remain authoritative. Frontend fallback dimensions use the exact catalogue SKU when live measurements are absent; millimetre precision is preserved instead of rounding to whole centimetres.

The shared database is not migrated or seeded by this release. No orders, messages, invoices or supplier accounts are created.

## Main files

- `scripts/generate-merchant-model.mjs` — bounded single generation, journal and resume.
- `scripts/prepare-merchant-model.ts` — canonical dimensions and reviewed source job.
- `scripts/optimize-models.mjs` — compression reused from fitness generation.
- `src/data/merchantProductAssets.json` — exact-SKU source imagery and descriptions.
- `src/data/productModels.json` — served model mapping and provenance.
- `src/components/three/productBodyLoader.ts` — shared model cache.
- `src/components/three/productBody.ts` and `src/designer/fitToSize.ts` — measured fit.
- `src/designer/planModel.ts` and `src/lib/topdown/modelSnapshot.ts` — matching overhead rendering.
- `src/data/apiCatalogAdapter.ts` and `api/products.ts` — existing API enrichment.

## Still pending

Additional sofas, garden furniture and sanitaryware need individual verified photos and bounded generation approval. The Seville four-piece set has ambiguous axis information between merchant and manufacturer descriptions; no guessed correction or whole-set generation was made. Existing procedural furniture remains explicitly illustrative until replaced with reviewed product-specific assets. OpenArt-specific overhead generation remains unavailable while its connected account has no credits.
