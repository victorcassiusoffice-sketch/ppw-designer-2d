# Top-down catalog image workflow — locked (2026-08-24)

Why this exists: Vic's two complaints about the 2D canvas art — (1) it
doesn't look like the real product, (2) it looks stretched/squashed.
Root causes + the pipeline that fixes both, end to end.

## The two bugs (both fixed in code, this branch)

1. **Renderer stretch** — `RoomCanvas` drew every product image at
   `width = footprint length px, height = footprint width px`, stretching
   any art whose aspect didn't match the footprint (perspective photos,
   square placeholders, merchant-API images). Fixed by
   [imageFit.ts](../src/designer/imageFit.ts): art is **contain-fitted** —
   true aspect kept, centred, auto-rotated 90° when its long axis
   disagrees with the footprint. Authored-to-match art still fills
   edge-to-edge (2% snap).
2. **Normalizer force-fill** — the old normalize step resized the
   generated silhouette to the exact footprint with `fit:'fill'`, so any
   proportion error in the model's output became a visible squash.
   [scripts/slot-topdown.mjs](../scripts/slot-topdown.mjs) replaces that:
   conform only within 5% aspect error, otherwise pad transparently and
   warn (regenerate instead of distorting).

## The generation workflow (per product)

Provider: **OpenArt (Dispatch's MCP — this repo has no image-API key)**,
model **Nano Banana** (cheap tier, ~10–15 credits ≈ $0.10–0.15/image);
escalate a single product to **Nano Banana Pro** only if the cheap tier
misses likeness. IMAGE-CONDITIONED always: the real product photo
(`public/products/photos/<id>.*`) is attached as the reference — this is
what makes it look like the ACTUAL product (WD-2D finding, 2026-07-24;
text-to-image hallucinates lookalikes).

**Locked prompt template** (extends the provider-neutral
`buildTopDownPrompt` in `src/lib/topdown/runwayTopDown.ts` with facing +
proportions):

```
A true bird's-eye plan view of the product in the attached reference
image — the {NAME} ({CATEGORY}) — photographed from a camera mounted on
the ceiling looking straight down at the floor. Overhead orthographic
floor-plan view, zero perspective: only the top surfaces and the floor
footprint outline are visible; the front face is NOT visible. Same object
as the reference with identical shape, colour, materials and proportions.
The product's long axis runs LEFT-TO-RIGHT and its real footprint is
{LENGTH} cm × {WIDTH} cm (ratio {RATIO}:1) — keep those proportions. The
side a user faces/uses points toward the BOTTOM edge of the frame.
Product centred, filling the frame with a small margin. Flat even studio
lighting, no cast shadow, no reflections, no props, no people, no
packaging. Isolated on a pure solid WHITE seamless background (#FFFFFF),
no floor texture, no scenery. No text, no watermark, no logo overlay.
Avoid: front view, perspective, angle, 3/4 view, side view, tilt, drop
shadow, grey background, floor, ground, surface texture, background
scene, text, watermark.
```

Generation settings: landscape output, ≥1024 px on the long side, aspect
as close to {RATIO}:1 as the model offers (exactness not required — the
slot step trims + conforms).

**Slot-in** (local, $0):

```
node scripts/slot-topdown.mjs --product <id> --file <render.png> --front-edge bottom
```

flood-keys the white background → trims to the silhouette → conforms
(≤5% off) or pads (>5%, with a ⚠ to regenerate) onto the footprint-exact
canvas (length×width cm at 10 px/cm) → writes
`public/products/topdown/<id>.png` + updates `products.json`
(`topdown_image_url`, `front_edge`). `front_edge: bottom` is the contract
with the Sims wall-aware placement: art generated front-toward-bottom
auto-orients correctly against walls.

Acceptance per image: looks like the reference product · true top-down
(no perspective) · aspect error ≤5% (conform mode) · clean transparency ·
renders undistorted on the canvas.

## Cost + batch (⛔ Vic-gated)

- Cheapest reliable path: OpenArt Nano Banana via Dispatch, ~10–15
  credits/image. Full bundled catalog = 22 products ≈ **220–330 credits
  (≈ $2.20–3.30)**. OpenArt balance was 5153 credits (2026-07-24).
- Fal.ai was considered — no key exists in this repo/vault on disk, and
  the 2026-07 rework already rejected the FLUX text-to-image path for
  hallucinating lookalikes. OpenArt image2image stays the recommendation.
- **No batch generation until Vic approves.** One sample first (below).

## Sample (the judge-this-first product)

`k1-bench-adjustable-fid` — Adjustable Flat/Incline/Decline Bench,
135×60 cm (2.25:1), reference `public/products/photos/k1-bench-adjustable-fid.jpg`.
Dispatch prompt pack: vault `06-Roadmap/_handoff/TOPDOWN-SAMPLE-PROMPT-2026-08-24.md`.
When the render lands: run the slot command above, then verify on the
canvas (place the bench, confirm likeness + aspect) before any batch.

## Batch learnings (2026-08-25 — locked into the pipeline)

1. **Never quote cm numbers in the prompt** — the model draws them as
   spec-sheet dimension callouts. Say "much longer than wide" instead.
   (Cost one re-roll wave.)
2. **Flood-key is not enough for AI studio slabs** — near-white gradients
   and enclosed frame-gaps survive any threshold. The pipeline step is
   now: `scripts/matte-topdown.mjs` (imgly ML matte) → slot with
   `--white-threshold 256`.
3. **Uniform textures conform, never pad** — `--force-conform` on
   flooring swatches (stretch is invisible on granule/vinyl texture).
4. Judge every batch with fresh-eyes agents before commit; ~40% of a
   20-image batch failed first pass for the reasons above.
5. Known outstanding: `k1-matrix-versa-adabd` + `k1-vision-smith` kept
   their pre-batch clipart (2 img2img attempts each failed on geometry /
   elevation-view) — candidates for a Nano Banana Pro retry (~40 cr each,
   Vic-gated). Bench still needs a REAL product photo before regen.
