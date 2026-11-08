# The product engine

One command takes a product from its photo to a real 3D body at its exact size, facing the right way, with a lighter copy for phones, a plan picture and a catalogue picture made from that body, and a pass or fail report. Built 8 November 2026 for One Live Build as a game, part 1 (`06-Roadmap/_handoff/OLB-GAME-GRADE-PLAN-2026-11-08.md` in the vault; decision V-OLB-GAME-GRADE-1108). Code: `scripts/product-engine/`. Everything runs through fal.ai on the key PPW already has; no other account, key or subscription.

## How to add a product

1. The product needs a row with measured sizes and a real photo: in `src/data/products.json` (`dimensions_cm`, `front_edge`, `photo_image_url`), in the Courts show-flat file, or in a file of rows in the shape the merchant add-product page and the connect wizard produce (`widthMm` = left to right, `depthMm` = front to back, `heightMm`, `imageUrl`). A drawing, a placeholder or a photo of something else does not count: the engine lists the product for Victor and makes nothing. The sizes are the maker's, not a guess (see **Catalogue truth**). If the listing also shows the product from the side or the front, put those on the row with `views` (see **Extra views**): the body's depth then comes from a photo instead of a guess.
2. See the bill, nothing sent:
   ```
   npm run products:engine -- run --tool tripo --only <id> --dry-run
   ```
3. With Victor's own word for that bill, typed in the chat, run it for real, with a cap in dollars the run may not pass:
   ```
   npm run products:engine -- run --tool tripo --only <id> --yes --cap 2 --adopt
   ```
   `--adopt` writes straight into the catalogue; without it the body lands in `public/models/candidates/<tool>/` for a side-by-side first (`?bodies=<tool>` on any designer URL shows the candidates), and `adopt --run <name> --tool <tool>` promotes the ones that passed.
4. Look at the sheet the run wrote under `docs/product-engine/runs/<run>/sheet-<id>.png`: the photo, the body from the front, three-quarter, at eye level, and the plan picture, with the numbers. A body that looks wrong (melted, missing parts, garbled text or logos) does not pass, whatever the numbers say.

Flags: `--only a,b` · `--remake` (products that already have a body) · `--tool tripo|meshy|hunyuan|all` · `--input rows.json` · `--dry-run` · `--yes` · `--cap <usd>` · `--run <name>` · `--parallel <n>` (3) · `--adopt` · `--gpu d3d11` (the laptop's GPU instead of software GL for the pictures).

## What one run does, per product

photo check → body from the chosen tool (one photo; or, when the row carries `photo_views`, the listing's front and side shots through the tool's multiview endpoint, see **Extra views**) → **squared footprint** (a generator that aligns the body to a three-quarter photo hands it back turned; the smallest box around the footprint finds the turn, to a twentieth of a degree, and it is baked in, so the per-axis fit does not distort a diagonal body; the photo side stays known) → **level base** (the plane through the lowest vertices; a tilt past 1° is baked out) → **raw shape check** (before any fitting, the body's footprint aspect and height ratio within 15 % of `dimensions_cm`; flat products judge the footprint only; a near miss, within 20 %, gets one re-roll; further off, the product is listed for Victor, a side photo being the fix) → which way is up (a flat product comes out of every generator as an upright slab; the photo face turns up, `modelUp`) → facing (`front_edge`; for the 13 K1 machines with plan art the September orientation law picks `modelFront` so the head lands where the art had it) → exact size (`src/designer/fitToSize.ts`, by the app's own code) → floor at 0, centred pivot → a laptop copy (about 20,000 triangles, WebP 1024/512 textures, Draco) and a phone copy (about 5,000 triangles, WebP 512/256; the simplifier's error bound loosens in steps until the count is near the target; from the second step it may collapse across texture seams and drop specks, because a generator's UV atlas splits most vertices and the bounded first pass stalls on them; so a 500,000-triangle body lands near the target too) → the plan picture, photographed straight down from the fitted body in the plan's own light rig → a catalogue picture (studio light, transparent, three-quarter, 512 px) → the gate → a `productModels.json` row with its record (tool, price, seconds, request id, gate result).

The measurements and the pictures are made in a headless browser on a local Vite dev server, importing the same `bodyObject` + `fitToSize` modules the app runs (`scripts/product-engine/page/engine-page.js`). What the gate measures is what a customer gets.

## The gate (code-checked; `scripts/product-engine/lib/gate.mjs`)

| Check | Passes when |
|---|---|
| photo usable | a real photo, not a drawing, placeholder or hand-flagged wrong photo (`photo-flags.json`) |
| raw shape within 15 % | footprint aspect (and height ratio, unless the product is flat) within 15 % of the catalogue before fitting |
| envelope within 1 cm | the fitted body's box equals `dimensions_cm` on every axis within 1 cm |
| stands on the floor | base within 0.5 cm of y = 0 |
| stands level | the plane through the lowest 3 % of the vertices within 2° of the floor (pitch and roll); a tilt past 1° is levelled before the fit |
| centred pivot | footprint centre within 1 cm of the item's centre |
| textures load | every texture decodes, at least one colour map |
| laptop copy | ≤ 25,000 triangles and ≤ 350 KB |
| phone copy | loads; ≤ 10,000 triangles and ≤ 150 KB (target 5,000; a dense many-shell body has a floor near 8,500 that no simplifier bound passes) |
| plan picture | not empty (≥ 3 % of the frame is product) and spans ≥ 98 % of the L × W frame on both axes |
| facing | the art law where plan art exists (the head lands on the art's side); a flat product lies down; otherwise the front is the photo side and the sheet is the check |

A product that fails gets no body and stays a measured box in its own photo ("no random table").

## What it costs (fal.ai pages read 2026-11-08; `scripts/product-engine/lib/prices.mjs`; licence badges in `docs/world/LICENCES.md`)

| Tool | Endpoint | Per body |
|---|---|---|
| Tripo H3.1, standard textures + PBR | `tripo3d/h3.1/image-to-3d` | $0.30 |
| Meshy 7.1, textured + PBR maps | `meshy/v7.1/image-to-3d` | $1.20 |
| Hunyuan3D v3, Normal + PBR | `fal-ai/hunyuan3d-v3/image-to-3d` | $0.525 |
| A person: FLUX.1 [dev] picture + Meshy 7.1 body, rig, walk, run, Idle | `fal-ai/flux/dev` + `meshy/v7.1/image-to-3d` | $0.025 + $1.52 |

Nothing spends without `--yes`; a run never passes `--cap`; every call lands in `docs/product-engine/fal-spend-log.json` (the September log is `docs/designer-3d-mode-2026-09-17/fal-spend-log.json`). Fal has no balance API: a balance refusal stops the run and Victor tops up on his Fal login. Every submission is journaled in `models-raw/fal-journal.jsonl` before it is polled; `resume --request <id>` picks up an interrupted one.

## The $0 commands

- `npm run products:engine -- audit` — a contact sheet of every catalogue photo, each marked usable, wrong, missing or vector (`runs/<date>-audit/photo-audit.png`).
- `npm run products:engine -- gate [--make-phone|--remake-phone]` — the gate on the bodies that exist, with their phone copies made from the served bodies (`runs/<date>-gate/gate-sheet.png`, `SUMMARY.md`).
- `node scripts/product-engine/walk-shots.mjs --only <id> [--bodies <tool>]` — the product seen in Walk mode, first and third person, laptop and phone, on the dev server.
- `npm run products:engine -- reprocess --run <run> [--tool tripo] [--only <id>] [--attempt n]` — the raw downloads of a run go through everything after the Fal call again (squaring, levelling, up, shape check, copies, measurement, gate, pictures, sheets): after any engine improvement, no body is paid for twice.
- `npm run products:engine -- views --only <id> --front <url|file> --left <url|file> [--back …] [--right …] [--page <listing url>]` — a listing's extra shots of the product (its spec drawings: a true side view, a true front view), cleaned and put on the row (see **Extra views**). `--no-clean` keeps a shot as it is. A before/after sheet lands in the run folder (`views-<id>.png`).
- `node scripts/product-engine/walk-sheet.mjs --run <run> --only <ids>` — one side-by-side per product for Victor: today's body / Tripo / Meshy / Hunyuan in Walk mode first person (laptop 1280 and phone 390, from `walk-shots`), the plan picture and the catalogue picture, with price, size, triangles and the gate under each (`walk-sheet-<id>.png`).
- `node scripts/product-engine/walk-shots.mjs --only <id> --character <person> --moving --label person-<id>` — a new person seen in Walk mode, standing, walking and running (third person), then first person.
- `node scripts/product-engine/walk-sheet.mjs --run <run> --person <id>` — one sheet for that person: the drawn picture, the body and its clips, and the Walk captures above on the laptop and the phone (`walk-sheet-person-<id>.png`).
- `npm run products:engine:test` — the engine's own tests (row shapes, the shape check, up detection, footprint squaring, the orientation law, the gate, the bill).

## Extra views (accuracy; added 8 November after the test run)

From one three-quarter photo every generator guesses the depth, and guesses short: the test run's treadmill came back 15–22 % too stubby from all three tools, and Tripo's two seeds gave 19.5 % and 22 %, so the shortfall is the photo's, not the seed's. A true side view tells the generator the length. Most listings have one: the K1 page for the treadmill carries NordicTrack's own spec drawings (a side view and a front view with dimension arrows), 2000 px wide.

- The row names them: `photo_views: { front, left, back, right }` (URLs or `/products/photos/views/...` paths), with `photo_views_source` (the listing page, the shot URLs, when, whether cleaned). `views` writes both.
- Cleaning (`lib/views.mjs`): the largest connected patch of non-background pixels is the product; every other patch (dimension arrows, callouts, stray text) is painted white; the picture is cropped to the product with a 5 % margin, squared and saved at 1024 px (WebP). The before/after sheet is the eye's check that only arrows and text went.
- A Tripo run of a row with views uses `tripo3d/h3.1/multiview-to-3d` (the same price and options; fal's page carries the same pricing sentence as the one-photo endpoint, read 8 Nov 2026). The list is positional, `[front, left, back, right]`, the front required, at least two images: so only a prefix of that order is sent (a right view alone cannot go in the second slot, it would be read as the left). The main photo stands in for a missing front. "Left" is the product's own left, as a person standing where the front photo was taken would call it.
- The record says so: `source.endpoint`, `source.views` and `source.view_photos` in `productModels.json`; `views` in the spend log and in `run.json`.

Two more guards came out of the same test, both $0 and both run by `reprocess` on bodies already paid for:

- **Level base.** A plane through the lowest 3 % of the vertices gives the body's pitch and roll; past 1° it is baked out together with the footprint yaw, and the gate shows `stands level` (within 2°). Every test body stood level already (0.0–0.3°); the guard is for the body that does not.
- **Finer squaring.** The footprint yaw is searched at 0.5° and then at 0.05° around the best step: on a 2 m product half a degree adds 1.7 cm to the width the fit must undo.
- **One re-roll for a near miss only.** A new seed moves a body's proportions by a few points, not twenty, so a wrong shape beyond 20 % is not re-rolled (the product is listed for Victor with the fix that works, a side photo). The test run spent $2.33 of its $9.95 on re-rolls that did not help.

## Catalogue truth

The engine makes a body exactly the row's size, so the row has to be the maker's size. The test run found two of three rows wrong: the treadmill (205 × 95 × 165 in the row; NordicTrack's own drawing on the K1 listing says 77.3 × 37 × 63.4 in = 196.3 × 94 × 161 cm; corrected 8 Nov, `dimensions_source` on the row) and the Bowflex (205 × 130 × 210 in the row; Bowflex gives 135 × 125 × 211 folded and about 193 × 198 × 211 in use; Victor picks the footprint the planner shows). A row corrected after a body was made needs no new call: `reprocess` re-judges the raw download against the new size.

## People for Walk mode

`npm run products:engine -- people --only nadia --dry-run` then `--yes --cap 2`; `--from-raw` finishes a person whose paid files are already in `models-raw/people/` at $0 (after a fix downstream of Fal); the run's `people.json` keeps the paid call's ids and spend and adds up across invocations. Each person is a made-up adult drawn from words (FLUX.1 [dev], A-pose, plain background, everyday clothes, no logos), never from a photo of anyone; Meshy rigs the body (walking and running come with the rig) and one animation call adds Idle; the three clips are merged into one GLB named idle / walk / run, textures to WebP, Draco, under the 1.5 MB character cap; the entry goes into `src/walk/characters.generated.json`, which `src/walk/characters.ts` spreads after the Kenney four (the fallback until the new ones pass). The cast and their real heights: `scripts/product-engine/lib/people.mjs`. Walk mode scales every body to 1.70 m (`WALK_HEIGHT_M`).

## Swapping in a maker's own model file

A supplier's SketchUp GLB export goes through `npm run models:import-sketchup -- --in <file.glb> --product <id> --source "…" --licence "…"` (`docs/SKETCHUP-MODELS.md`); it is fitted the same way and takes precedence over a generated body. Run `gate --only <id>` afterwards to prove it.

## Later, not now

Merchants making their own 3D model from inside the app: money per click (Tripo $0.30 and up per body) and Tripo's terms section 3.2 (outputs for lawful commercial use, not made available to third parties in a manner inconsistent with the agreement; letting third parties run the service through us is a different use) both need Victor's word first. The engine stays a laptop tool that commits files; it adds no API code (the 12-function cap).

## Records

- `runs/<run>/run.json`, `SUMMARY.md`, `sheet-<id>.png`, `evidence/<id>/*.webp` — one folder per run.
- `src/data/productModels.json` — the bodies the app serves (`url`, `phoneUrl`, `modelFront`, `modelUp`, `source`).
- `src/data/productModelCandidates.json` — test candidates by tool, empty in normal times.
- `src/data/catalogModelThumbnails.json` + `public/products/catalog-models/` — the catalogue pictures (hash-named, as the October bake did).
- `public/products/topdown/<id>.webp` + `topdown_image_url` — the plan pictures.
