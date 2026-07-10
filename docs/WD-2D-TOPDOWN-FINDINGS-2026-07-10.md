# WD-2D Top-Down Product Image Pipeline — Findings & Fix Plan

**Date:** 2026-07-10
**Scope:** Read-only investigation of the top-down (bird's-eye) product-image pipeline that feeds the Wellness Designer 2D (WD-2D) room designer. No images regenerated, no credits spent.
**Repos inspected:** `ppw-image-batch` (media-dept image tool) and `ppw-designer-2d` (the designer + merchant marketplace).

---

## TL;DR (the four answers)

1. **Bridged / producing?** **No — not as an automated pipeline.** The real generator (`src/lib/generateTopDownImage.ts`, Fal.ai FLUX.1 *schnell*) is **dead code at runtime — it has zero callers in the live app.** Top-down art exists only as **22 pre-baked static PNGs** produced by a **one-time manual backfill** (late May) and served by a **static substitution** (`seedImagery.ts`). The live catalog otherwise reads as `placehold.co` placeholders. The media-dept `ppw-image-batch` tool (PixelDojo / Nano Banana) is a **different, unrelated tool** — it currently holds a "Slot Calendar" app-UI batch and does no product top-downs.
2. **Integrated into merchant signup?** **No — missing / manual.** Neither merchant-product path attaches a generated top-down. The web form saves the merchant's **raw uploaded photo** as-is; the capture/agent path saves the **front photo**. Nothing calls the generator on listing.
3. **Quality root cause?** **Both model and prompt — plus a design flaw.** It uses the cheapest text-to-image FLUX tier and **never passes the real product photo as a reference** — so it hallucinates a generic lookalike from a thin text prompt, on a forced square canvas.
4. **Ratio exact?** **Footprint math is correct and to-scale; the inputs and the image are not.** Placement scales by physical mm on a 0.5 m grid, which is right *if dimensions are right* — but dimensions are optional/free-typed on the web path, and the image is a 1:1 square with arbitrary padding and no guaranteed bounding box, so it visually mismatches the footprint.

---

## 1. Architecture — what actually exists

There are **two separate image systems**; they are easy to conflate but do different jobs.

| System | Repo / file | Model / API | Purpose | State |
|---|---|---|---|---|
| Media-dept batch tool | `ppw-image-batch/ppw_image_gen.py` | **PixelDojo → Nano Banana 2** (`nano-banana-2`), `PIXELDOJO_API_KEY`, aspect `9:16` | Generic "named prompts → PNG files" worker | Live tool, but current `batch.json` is **Slot Calendar app-UI mockups** — **nothing to do with product top-downs** |
| WD-2D top-down generator | `ppw-designer-2d/src/lib/generateTopDownImage.ts` | **Fal.ai FLUX.1 [schnell]** (`https://fal.run/fal-ai/flux/schnell`), free tier, `FAL_KEY` | Turn a product photo into a top-down catalog asset | **Function exists but is never called at runtime** |

**Key point:** the media-dept tool is *not* the WD-2D top-down generator. The WD-2D generator lives in the designer repo and is a distinct FLUX-based utility.

---

## 2. Q1 — Is it bridged and producing?

**Traced end-to-end. It is not an automated pipeline; it is a one-off manual backfill plus a static substitution.**

- **Live client path is a no-op by design.** `generateTopDownImage()` (`src/lib/generateTopDownImage.ts`) refuses to call Fal from the browser: with no API key and no same-origin proxy endpoint it returns the *original image* as a graceful fallback (lines 175–182). There is **no `/api/topdown` proxy lambda** — confirmed absent; the code comments blame the Vercel 12-function cap. So in the running app it never generates anything.
- **The function has no callers.** A grep for `generateTopDownImage` across `src/` (excluding tests) returns only its own definition. The only real callers are the Node **backfill script** and unit tests. **At runtime it is dead code.**
- **What produced the assets that do exist:** the backfill script `scripts/backfill-topdown-images.ts` was run **manually, once** (files dated 27–30 May). It generated **22 PNGs** into `public/products/topdown/` for the **K1 seed SKUs**, wrote `topdown_image_url` paths into `src/data/products.json` (22 entries), and a follow-up local script `scripts/alpha-pass-topdown.mjs` stripped the white backgrounds to transparency (via free local `@imgly/background-removal-node`). `.png.bak` originals sit alongside.
- **How the live app serves them:** `api/products.ts` calls `enrichImagery()` (`api/_lib/products/seedImagery.ts`). This substitutes a bundled static PNG into the API response **only when** the DB row's image is a `placehold.co` placeholder **and** the SKU exactly matches the seed catalog. It is a response-time patch, not a generation step.
- **Production reality (per `docs/DESIGNER-FUNCTIONALITY-AUDIT-2026-06-03.md`):** the live API returns **19/19 `placehold.co`** images with null descriptions — "Top-down image pipeline not applied." Only SKUs that match the 22-item seed get real art; everything else is a placeholder.
- **Credentials:** `FAL_AI_API_KEY` is listed as a *future* env var in the audit — **not configured**. The model string in code is `flux/schnell`.

**Verdict:** the bridge is **stale**. There is a working *manual backfill recipe* (generate → bake to `public/…` → static-serve), but no live wiring, no proxy, no key, and no automation. What's on screen today is 22 hand-baked seed images and placeholders.

---

## 3. Q2 — Is it integrated into merchant signup?

**No. When a merchant lists a product, no top-down image is generated or attached.** There are two product-creation paths and neither touches the generator:

**(a) Simple web form — `src/pages/MerchantAddProductPage.tsx`** (route `/merchant/:slug/products/new`)
- Merchant picks *any* image → uploaded straight to Vercel Blob → `POST /api/merchants/:slug/products` writes `merchant_products.image_url` = **the raw uploaded photo**.
- Width/Depth/Height are **optional free-typed mm fields**.
- The only "top-down" behaviour is a **hint**: *"Top-down product shots … render best in the designer canvas."* It relies entirely on the merchant to upload a good top-down themselves. No generation, no normalization.

**(b) Capture / agent path — `api/_lib/agent/intents/addMerchantProduct.ts` (DT-09)**
- Consumes a `CapturePacket` + minted `scaleLockId` from `/capture/calibrate`. Sets `imageUrl = packet.photoFront.blobUrl` (**the front photo**), plus measured `dimensions_mm`, `photo_alpha_clean`, and a scale-lock.
- Sophisticated for **scale**, but the stored image is the **front photo, not a top-down render**. And per the audit, this onboarding path is **broken in production** — the calibration reference-page PDF returns HTTP 500, so merchants can't even print the marker sheet.

**No code path links merchant listing → `generateTopDownImage` → the catalog entry the designer reads.** Integration is **missing**; any top-down today is either a manually-uploaded merchant photo or the 22 baked seed assets.

---

## 4. Q3 — Image quality root cause

**Both the model and the prompt are wrong, and there's a structural flaw on top.**

**Model (biggest issue).** The call is `fal-ai/flux/schnell` — the 4-step distilled, **free-tier, lowest-fidelity** FLUX variant, chosen explicitly "free tier." Worse, it is invoked as **pure text-to-image**: the request body is only `{ prompt, image_size: 'square_hd', num_images: 1 }` (lines 197–204). **The merchant's real product photo is never passed as a reference/conditioning image.** So the model **invents a generic object from the text** and ignores what the product actually looks like. This is not "convert this photo to top-down" — it's "draw something matching this sentence." That is the core quality failure.

**Prompt (secondary).** `topDownPrompt()` (lines 62–70):

> `Top-down orthographic view of: {name}, {category}. Studio white background, soft shadow. Match scale to {L}×{W}×{H} cm. Show top surface only. Cinematic crispness. No watermark.`

Problems: "Match scale to … cm" is meaningless to a text-to-image model (it can't honour real-world scale); "Cinematic crispness" pulls toward glossy perspective renders, the opposite of a flat orthographic plan asset; "Studio white background" forces an opaque white square that then needed a *separate* alpha-removal pass; there is no negative prompt, no lighting/material lock, no "no perspective / no props / centered / fills frame."

**Output shape.** `image_size: 'square_hd'` = 1:1. Most product footprints are not square, so a rectangular product is rendered into a square and later stretched into a rectangular footprint → distortion (see Q4).

**Fixes (concrete):**
- **Switch to image-conditioned generation.** Feed the merchant's uploaded photo as the reference (FLUX.1 *dev* image-to-image / a top-down control, or Nano Banana 2 in the media-dept tool, which supports reference images). Use a **paid tier deliberately** — catalog art is one-time, high-leverage; *schnell*'s whole point is being the cheapest, and it shows.
  *Note: the task references a "creative-credits reference" for model selection — I could **not find that doc in either repo** (likely in the PPW Second Brain or a skill). Flagging so you can point me to it before I pin exact model/credit costs.*
- **Rewrite the prompt:** flat orthographic top-down, photographed directly from above, product centered and filling the frame, transparent PNG background, even diffuse studio lighting, no perspective, no props, no reflections; add a negative prompt (`perspective, angle, 3/4 view, shadow blob, background, text, watermark`).
- **Render transparent directly** (or keep the local imgly alpha pass — it's free and works).

---

## 5. Q4 — Size / ratio accuracy vs the 0.5 m grid

**The placement math is correct and to-scale. The weak links are the input dimensions and the image frame — not the grid.**

**How scale is derived today:**
- Placement scales by **physical dimensions, not by the image's pixel ratio.** `src/designer/placedItemMath.ts`: footprint px = `widthMm/depthMm × room pxPerMm`. `dimsToPx()` in `products.schema.ts`: `wPx = length/100 × pxPerMetre`. Grid snap = **500 mm (0.5 m)** (`useGridSnap.ts`, `SNAP_STEP_MM = 500`); `RoomCanvas` renders everything at `pxPerMetre`.
- So the **footprint box is exactly to-scale — provided `dimensions_cm/mm` are accurate.**
- **Where accurate scale is supposed to come from:** the capture path derives real scale via an **A4-marker homography** (`src/lib/capture/scaleFromMarker.ts` — `pixelsPerMm` from a known 210×297 mm reference, DLT homography, RMS error) and **locks it** (`capture_scale_lock_id`, migration 0024, with a guard that refuses silent dim edits). That's a genuinely good, exact scale source.

**The two weak links:**
1. **Inputs are unreliable on the path merchants actually use.** The simple web form takes **optional, free-typed** W/D/H mm — can be blank or wrong. The trustworthy marker/scale-lock path is (a) not what the web form uses and (b) currently broken in prod (reference-page 500). So the number that *drives* the ratio is often missing or unverified.
2. **The image is a square with arbitrary internal padding and no guaranteed bounding box.** The top-down PNG is 1:1 (`square_hd`) with the product somewhere inside. The renderer fits/crops that square into the rectangular footprint. The intended fix — `silhouette_bbox_px` + `cropRect()` (`placedItemMath.ts`) — has a **v1 fallback that returns `null` when no bbox is present → renders the full square photo ("known degradation, accepted")**. Result: a square render stretched into a non-square footprint, and the product's apparent size inside the frame doesn't match its true footprint even when the grid box is right.

**How to make the ratio exact (matches your instinct):**
1. **Capture real W×D at listing and make it required** — keep the marker/scale-lock as the trusted source; don't let products in without dimensions.
2. **Normalize onto a fixed cm-per-pixel canvas with a transparent background and a known bounding box.** Pick a constant, e.g. **10 px/cm**: a 60×40 cm bench → a **600×400 px** transparent PNG in which the product **fills the frame edge-to-edge**. Then the designer places it 1:1 by footprint with zero guesswork.
3. **Guarantee the bounding box** (trim to alpha bbox, or full-bleed by construction) so `cropRect()` always has a real bbox — retire the "full square fallback."
4. **Do this as a deterministic post-process, not via the model:** trim to alpha bbox → resize so bbox = `footprint_cm × fixed_px_per_cm` → paste centered on a transparent canvas of the exact footprint size. This makes the ratio exact **regardless of what the generator produced**, and works equally on a merchant's own uploaded photo.

---

## 6. Fix plan (prioritized)

| Pri | Fix | Why / how |
|---|---|---|
| **P0** | **Decide the strategy: generate vs normalize.** | Recommend: treat the **deterministic normalization** (crop/scale the *real* photo to a cm-canvas, §5) as the reliable ratio path; use AI generation only as an **optional beautifier with image conditioning**. Ratio accuracy should not depend on a text-to-image model. |
| **P0** | **Wire it into merchant signup.** | On product create, run a normalization step (serverless or queued job) that outputs a transparent, footprint-exact top-down and writes it to the catalog entry — OR, if staying manual short-term, make **dimensions required** and normalize the uploaded photo client-side on upload. |
| **P1** | **Fix generator quality.** | Image-to-image model with the real photo as reference + rewritten prompt (§4) + transparent output. Re-run as a backfill to replace the `placehold.co` live rows and upgrade the 22 K1 assets. Confirm model choice against the creative-credits reference (please share it). |
| **P1** | **Restore an automated bridge.** | Add the `/api/topdown` proxy (fold into an existing router to dodge the Vercel 12-fn cap) so generation can run server-side with the key hidden — or keep it a backfill job triggered on new listings. Set `FAL_AI_API_KEY` (or the chosen provider's key). |
| **P2** | **Repair capture onboarding.** | The reference-page PDF 500 (`/api/capture/reference-page.pdf`) breaks the trusted marker/scale-lock path in prod. Fixing it makes exact dimensions reliably available. |
| **Note** | **Don't conflate the media-dept tool.** | `ppw-image-batch` (PixelDojo/Nano Banana) is a UI-mockup batcher. If reused for products it needs a product top-down batch **and** reference-image support; otherwise leave it out of the WD-2D pipeline. |

---

## 7. Blockers / open items flagged

- **"Creative-credits reference" not found** in either repo — needed to pin the exact upgraded model and its credit cost. Please point me to it (PPW Second Brain / a skill?).
- **FAL / provider key not configured** (`FAL_AI_API_KEY` marked "future"). Generation can't run automated until it's set — a **Quick-Check / [VIC-SETUP]** item, not something I'll do.
- **Neon DB creds not in this session** — I inspected code, seed catalog, and static assets, not live rows. The 19/19-placeholder figure is from the 2026-06-03 audit.
- **No images regenerated, no credits spent** (per your instruction). All recommendations above are read-only conclusions.

---

## 8. Evidence index (files read)

- `ppw-image-batch/ppw_image_gen.py`, `SKILL.md`, `batch.json` — media-dept PixelDojo/Nano-Banana tool (unrelated to product top-downs).
- `ppw-designer-2d/src/lib/generateTopDownImage.ts` — the FLUX schnell generator (text-to-image, browser no-op, zero live callers).
- `scripts/backfill-topdown-images.ts`, `scripts/alpha-pass-topdown.mjs` — one-time manual backfill + local alpha pass (22 assets).
- `api/_lib/products/seedImagery.ts`, `api/products.ts` — static substitution of the 22 baked PNGs into API responses.
- `src/pages/MerchantAddProductPage.tsx` — simple web form (raw photo, no generation).
- `api/_lib/agent/intents/addMerchantProduct.ts` — capture/scale-lock path (front photo, not top-down).
- `src/designer/placedItemMath.ts`, `src/designer/useGridSnap.ts`, `src/components/RoomCanvas.tsx`, `src/data/products.schema.ts` — footprint/ratio/grid math (scales by mm; 0.5 m grid).
- `src/lib/capture/scaleFromMarker.ts` — A4-marker homography scale derivation.
- `docs/DESIGNER-FUNCTIONALITY-AUDIT-2026-06-03.md` — corroborates 19/19 placeholders + broken capture PDF.
- `public/products/topdown/` — 22 baked PNGs (+ `.bak` originals); `src/data/products.json` — 22 `topdown_image_url` entries.
