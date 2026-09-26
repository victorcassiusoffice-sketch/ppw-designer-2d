# 3D Mode — P0 Foundation (2026-09-17)

Vic: "amplify the 3D that was built into the wall so the whole designer has a 3D Mode … a 3D mode switch … a super realistic 3D version of the 2D." Programme plan (decisions D1–D7, phases P0–P6): vault `06-Roadmap/_handoff/DESIGNER-3D-MODE-PLAN-2026-09-17.md`.

## What P0 ships

| Piece | Where |
|---|---|
| **Solid model** — the plan as wall slabs (thickness, doors and windows cut through), floor slabs and item bodies, derived from the SAME `SceneInput` the canvas painter takes; camera-independent, cutaway decided per camera (`cutawayState`) so orbiting never rebuilds geometry | `src/designer/roomSolids.ts` (+15 unit tests pinning parity with `buildScene` wall for wall across five camera positions, shared-wall doorway, free-wall rule, item mount heights) |
| **GL stage** — three.js WebGL renderer: extruded wall slabs with material groups (paint on the faces, a reveal tone on tops/ends/opening reveals), window panes, floor shapes, item boxes, sun + hemisphere light, PCF-soft shadows, ACES tone mapping; hover tint; raycast hit-test; the e2e bridge (`screenPoint`, `faces`, `debug`) | `src/components/three/ThreeStage.tsx` — **lazy**, its own `vendor-three` chunk |
| **`RoomView3D` on the new backend** — same props and test ids; the canvas painter stays as the fallback when WebGL cannot start (`data-backend="painter"`) | `src/components/RoomView3D.tsx` |
| **3D Mode = a mode of the whole designer** — `designerUIStore.viewMode` (`'plan' \| '3d'`, replaces the paint tool's `view3d`); switch on the bar (`view-mode-3d`), in the phone sheet (`view-mode-3d-mobile`), the paint panel's Plan \| 3D control and the phone HUD's 3D chip all drive it; the workspace sits UNDER the top bar (`--ppw-topbar-h`) so tools switch while the room shows; putting a tool away no longer closes the room | `src/store/designerUIStore.ts`, `src/components/TopBar.tsx`, `src/components/RoomCanvas.tsx`, `src/designer/HelpOverlay.tsx` |
| **Playwright gets WebGL** — software GL flags for headless Chromium; without them every 3D spec silently ran on the painter | `playwright.config.ts` |

## Gates (this build, dev server `127.0.0.1:5199`)

- `npx vitest run` — 194 files, 2,479 tests.
- E2E: `view-mode-3d` (3, new: switch on the GL stage + three fetched only then + bar stays; paint works inside the mode; phone sheet row) · `wallpaint-3d` (8, test 3 re-pinned: the room outlives the tool) · `wallpaint` · `phone-demo` · `mobile-sims-toolbar` · `wallpen-mobile` · `units` · `eco-phone-add` · `sims-flooring` — **45 / 45**.
- `tsc --noEmit`, `eslint` (touched), `npm run build` clean. Chunks: `vendor-three` 540 KB raw / 140 KB gz (lazy), `ThreeStage` 7 KB, app index +5 KB.
- Render proof: `debug()` on the bridge — desktop 22 draw calls / 200 triangles, phone (Sofap flat) 68 calls / 684 triangles; overlay screenshot std-dev 42/32/33 (real content).

## Bugs found on the way (worth remembering)

1. **`forceContextLoss()` in an effect cleanup** leaves the canvas's WebGL context lost for the next mount — under React StrictMode's dev remount three then reads a null precision format and refuses to start. Dispose only.
2. **A cancelled `requestAnimationFrame` handle left in a ref** made every later `requestRender()` believe a frame was pending → zero renders, transparent canvas. Clear the ref in cleanup.
3. **Raycasts and projections read the camera's world matrices**, which the renderer refreshes only at render time — a click between an orbit and that frame aimed with the previous camera. `camera.updateMatrixWorld(true)` in the camera effect.
4. Vite's first discovery of a new dependency (`three`) re-optimises and force-reloads the page — an e2e run started in that window fails for reasons unrelated to the code. Warm the server first.
5. Headless Chromium needs `--use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist` for WebGL; the painter fallback hides the absence unless the bridge's `backend()` is asserted.

## [VIC-VERIFY] on the phone

FPS on a real GPU is not measurable here (software GL). Open `designer.ppwellness.co/designer?demo=sofap` → ≡ → **3D Mode**: orbit with one finger, pinch to zoom, walls cut away toward you, Plan returns. Arm Wall paint → tap a wall in 3D.

## Frames (`p0/`)

`desktop-1440-3d-mode.png` · `desktop-1440-3d-mode-rotated.png` (cutaway flips with the camera) · `desktop-1440-paint-inside-3d-mode.png` · `phone-390-3d-mode-sofap.png`.

---

# P1 Fit-to-size bodies + P2 Sims build mode (2026-09-17, same day)

Vic: "make the 3D designer more like The Sims — it should reflect what's done on the 2D and vice versa; the objects need to be 3D … fitting realistically to scale, hard-coding the algorithms to measure and display with 100 % accuracy."

## What P1 + P2 ship

| Piece | Where |
|---|---|
| **The fit law** — a product body is scaled PER AXIS so its bounding box equals `dimensions_cm` exactly (100 % by construction, not by eye): normalise the model's bbox → scale L×W×H → yaw from the catalog `front_edge` and the model's own `modelFront` (aspect swap when the model's long axis is the other way) → base on the floor / wall-mount height / on its table. `itemPose` maps plan (x, y, rotation) to the stage; plan → three is `(x, y, z) → (x, z, y)`, plan rotation r = −r about +y | `src/designer/fitToSize.ts` (+19 unit tests: every axis, every facing, the swap, `-0` folding) |
| **Bodies on the stage** — glTF bodies (GLTFLoader + DRACOLoader, decoder in `public/draco/`) loaded once per URL and cloned per placed item with their own materials; the box stands in until the body arrives, then swaps (a stale-build guard drops late arrivals). Manifest `productModelFor(p)`: a product's `mesh_url` first, else the manifest. Ten CC0 Kenney Furniture Kit 2.0 bodies cover the demo range (console table, shelf, mirror, diffuser, plant, floor lamp, pendant, sconce, bench, tree); everything else stays a box until its model exists | `src/components/three/ThreeStage.tsx`, `src/data/productModels.ts` + `.json`, `public/models/kenney/` (+ `LICENSE.txt`) |
| **AI image-to-3D pipeline** — `scripts/gen-3d-models.mjs`: Fal queue API, product photo → GLB → `public/models/<id>.glb` + manifest entry. `--dry-run` lists the products and the bill; **refuses to run without `--yes`** (Vic's written Y = the spend gate); key read at runtime from the junk-files path, never printed. Default model Hunyuan3D 2.1 ($0.30 / model, live price 2026-09-17); `--model` for Trellis ($0.02) / Rodin ($0.40) | `scripts/gen-3d-models.mjs` |
| **2D ↔ 3D, one plan** — the drop rules the Konva plan applies on a drag (wall snap + auto-orient, Shift keeps facing, tile lattice, ceiling grid, layer-scoped collision, room routing incl. cross-room and outdoors, the same refusal words) as a PURE function fed by an explicit context, so a drop on the 3D floor resolves exactly as a drop on the plan | `src/designer/itemDrop.ts` (+12 unit tests on real seeded products) |
| **Intents both ways** — the intent store carries `placeAtPoint(roomX, roomY)` (a plan point from the stage's floor ray), the armed product (`App.pendingProductId` mirrored), and `moveTo(instanceId, x, y, shiftKey)`; RoomCanvas consumes them through its own `placeAtRoomPoint` and `resolveItemDrop`; a screen-based intent (strip drop, "+ Add to room") raised while the room shows is resolved on the floor plane first | `src/store/placementIntentStore.ts`, `src/components/RoomCanvas.tsx`, `src/App.tsx` |
| **Sims build mode in 3D** — with Select live: **tap a body** → the plan selects it (mint floor pad + tint; a card names it with Turn ↻ / Remove, the same `rotateSelected` / `deleteSelected` the plan's keys run); **drag a body across the floor** → live preview, release → `moveTo` → the plan's resolver → the plan changes (or refuses with its own toast and the body snaps back); **arm a product** from the dock / strip under the room, **tap the floor** → placed there, tile disarms; tap empty floor → deselect; a second finger cancels a carry and pinches. The stage exposes `hitItem`, `floorPoint`, `projectPoint`, `moveItemPreview`, `resetItemPreview`; the DEV bridge adds `itemScreenPoint`, `floorScreenPoint`, `floorAt` so a spec aims in metres | `src/components/RoomView3D.tsx`, `src/components/three/ThreeStage.tsx` |
| Overlay rule — in the workspace the room stops ABOVE the catalog (dock / strip) so products can be picked; with a wall tool live the brush owns the bottom band and the room runs edge to edge (phone pass rule kept — `phone-demo` pins it) | `src/components/RoomView3D.tsx` |

## Gates (this build, dev server `127.0.0.1:5199`)

- `npx vitest run` — **196 files, 2,510 tests** (19 fitToSize + 12 itemDrop new).
- E2E **46 / 46**: `view-mode-3d` (4 — new: *Sims build mode: tap selects, R turns, a drag moves through the plan rules, a dock tile + floor tap places* — the drag lands at exactly +1.0 m through the resolver) · `wallpaint-3d` (8) · `wallpaint` · `phone-demo` · `mobile-sims-toolbar` · `wallpen-mobile` · `units` · `eco-phone-add` · `sims-flooring`.
- `tsc --noEmit`, `eslint` (touched), `npm run build` clean. `vendor-three` now 657 KB raw / **168 KB gz** (GLTFLoader + DRACOLoader ride in the lazy chunk; +28 KB gz over P0); models 133 KB total, decoder 756 KB fetched only for a Draco body.
- Render proof (`p1-p2/evidence.json`): Sofap flat desktop 88 draw calls / 2,496 triangles with the bodies in; selection card text "Wellness Console Table · Turn ↻ · Remove"; 0 console errors desktop + phone.

## Bugs found on the way

6. **A body's shared material** — cloning a glTF scene shares materials between clones, so tinting one placed item tinted every copy of that product. Clone materials per body.
7. **`backend` reads `gl` before the lazy stage exists** — a spec that asserts parts right after the mode opens races the chunk; wait for `faceCount() > 0`, then assert the backend.
8. **The overlay's bottom** — stopping above the catalog is right for the workspace but wrong with the paint brush strip inside the overlay on a phone (the folded catalog strip is dead space there); `phone-demo` caught it against production.
9. A Node-side helper is not visible inside `page.evaluate` — aim helpers must be written as page functions.

## [VIC-VERIFY] on the phone

`designer.ppwellness.co/designer?demo=sofap` → ≡ → **3D Mode** → tap the console table (mint pad + card) → drag it along the floor → **Plan**: it moved there too. Then `?demo=sofap` fresh → 3D Mode → tap a strip thumbnail → tap the floor: placed. The frame rate with ten bodies is the thing to feel.

## Frames (`p1-p2/`)

`desktop-1440-3d-bodies-sofap.png` (bodies fitted) · `desktop-1440-3d-selected.png` (pad + card) · `desktop-1440-3d-carry.png` (mid-drag) · `desktop-1440-3d-dropped.png` (landed) · `phone-390-3d-bodies-sofap.png`.

---

# Hero bodies — Fal Hunyuan3D 2.1 for the catalog (2026-09-17, Vic Y "use the credits")

Vic: "Y — use the credits, inform me if you need to top-up, note the average spend and fluctuations both API and Hunyuan3D." (Not OpenArt: OpenArt has no image-to-3D.)

## Spend (the whole run, `fal-spend-log.json`)

| | |
|---|---|
| Generations | **23** (22 products + 1 duplicate of the bench — a planning miss, see below), 0 failures, 0 balance refusals |
| Spent | **$6.90** = 23 × $0.30 (flat per generation, the price rendered on the model page 17 Sep; Fal exposes no balance API — the billed line is on the Fal dashboard) |
| Average per model | **$0.30** — no per-model variance in price; the variance is in TIME and SIZE |
| Wall time per model | min **57 s** · avg **278 s** · max **924 s** — the first request sat 14 min in Fal's queue; with 7 in flight the queue emptied and later models came back in ~1 min |
| Hunyuan3D inference (Fal's own `inference_time`) | min **48 s** · avg **67 s** · max **87 s** — the model's true cost; the rest is queue |
| Raw output | 1.2–7.7 MB (avg 5.1 MB), 40–70 k triangles, 2048² PNG textures (base colour labelled PNG but actually JPEG) |
| Served | **94–323 KB (avg 164 KB)**, ~20 k triangles, 1024² WebP colour + 512² WebP metal/rough, Draco — `scripts/optimize-models.mjs` (gltf-transform; sniffs the real image format first) |
| Bodies live | **21** — 13 K1 machines + 8 Emcar solar products. `k1-bench-adjustable-fid` is NOT served: its catalog photo is a Rogue bench *accessory kit* (bracket + plate + bolts), so the generator faithfully built a bracket. It stays a box until the photo is fixed (the raw body is kept in `models-raw/`, git-ignored, outside `public/`). |

## The orientation law (what "aesthetically identical" needed)

An image-to-3D body faces whichever way its photo was taken, so:

1. `scripts/orient-check.mjs` measures each raw body's **head** (console / screen / handlebars / weight tower = the top 25 % of its height) in its own frame — e.g. the 2450 treadmill's head sits at model +x, the Schwinn's at −x, the Tour de France's at −z.
2. The plan's **top-down art** is the truth for rotation 0 (length along +x): most consoles sit at the right edge, but the RW900 rower, the Schwinn, the T600E-02, the Versa adductor and the MG glute trainer have their heads at the left, the Bowflex and the Smith machine at the top. `scripts/orient-apply.mjs` holds that table and picks the `modelFront` (of +z / −z / +x / −x) whose fit yaw lands the measured head on the art's side — written into the manifest with the evidence (`source.orient`).
3. Flat products (the three solar panels) come out of the generator as **upright photo slabs** (Jinko raw box `x ±0.56, y ±1.0, z ±0.11`). New fit hint **`modelUp: '-z'`** (`fitToSize.upPitchRad` / `pitchedBox`, 5 tests): the photo face (−z for Hunyuan3D) is pitched up before the fit, so the panel lies flat, 3 cm tall, its cell grid facing the sky.
4. The stage's 3D tap now falls back to the **exact catalog box** when the body's surface is air at the tap point (a treadmill's centre is above its deck; a lamp is a pole).

Close-ups after the law (`hero-qa/close-sheet.png`): the 2450's console at the right, the T600E-02's at the left, the rower's screen at the left, the adductor's tower at the left, the Bowflex tower at the back, the Jinko panel flat and face-up. Grid of all 21: `hero-qa/grid-default.png`. Source photos audited: `hero-qa/photo-audit.png`; top-down art: `hero-qa/topdown-art.png`.

## Gates

vitest **197 files / 2,515 tests** (5 new for `modelUp`); e2e `view-mode-3d` 4 · `wallpaint-3d` 8 · `phone-demo` 4 = 16/16 on the dev server with the bodies in; `tsc` / `eslint` / `npm run build` clean; the 21 bodies ship in `dist/models/` (3.7 MB with the ten Kenney bodies, each fetched only when its product is on screen in 3D).

---

# The Sims paint tool + the production box bug (2026-09-19)

Vic (desktop, production): "the 2d models when going into the 3d mode just come up as a box … The Paint tool cannot paint the wall properly like in the game, it needs to function the same as the 2D back end etc but the front end like 'the sims 1' but with more realistic identical images."

Both reproduced on production first (`repro-vic-2026-09-17/`, 30 frames + `repro-log.txt`), then fixed.

## 1 · The box bug — root cause and fix

Production delivers the K1 range from `/api/products` as `m-<id>` and hides the bundled twin by SKU; the 3D body manifest is keyed by the bundled id (`k1-…`), so every merchant-placed product missed the lookup and stayed a box (0 requests to `/models/` after 10 s; the same room seeded with `k1-…` ids fetched both bodies — the pipeline was fine, the key was wrong). Fix: `productModelFor` resolves by **SKU** as well (`src/data/productModels.ts`, seed-id ↔ SKU join; 6 unit tests incl. an adapter round-trip pinning facing by identity). Follow-up in the same change: `catalogStore` — the API's arrival bumps a version that RoomCanvas and RoomView3D subscribe to, so a saved design's merchant items appear the moment the catalog is known instead of on the next edit. E2E `paint-sims-3d` test 6 mocks `/api/products` with one K1 row, places `m-6` from the dock, opens 3D and waits for the GLB request + a body-sized triangle count.

## 2 · The paint tool — what was wrong (measured on production)

| Defect | Proof |
|---|---|
| The default white brush on near-white plaster changed a wall by **4–9/255** — the first click looked like nothing happened | frames 07 → 09; pixel rgb(151,146,135) → (155,152,144) |
| The hover was a **yellow glow** applied before AND after the click; the painted wall stayed yellow under the pointer | code: emissive `#FFD98A` @ 0.42 on hover |
| The renderer used **ACES tone mapping** + a rig that left two of four walls unlit: a wall never rendered its chip colour | audit + `light-probe` |
| The brush painted **through furniture** (the ray hit walls only) | 24 of 40 hover probes over the treadmill reported "Wall 1" |
| A drag **orbited** instead of painting; no Shift-room / Ctrl-erase; no feedback line; near walls were 0.32 m stubs you had to orbit to reach | repro PART 2 |

## 3 · What shipped — the Sims front end on the same 2D back end

Every paint still lands through `applyWallPaintBrush` → `propertyStore.paintWallEdge / paintRoomWalls / paintFreeWall` — the plan, the quote and the cart are untouched.

| Piece | Where |
|---|---|
| **Colour truth** — `NoToneMapping`, a hemisphere + camera-following fill + sun rig stated in multiples of π, and walls as `MeshPhysicalMaterial` with the dielectric specular OFF for matt (`specularIntensity` 0). Measured with the new DEV `samplePixel` / `tune` bridge on a `#808080` room: **119–127 on every wall in every camera**; `#4C493F` renders 72,69,58; black renders 0. Two traps found on the way: three's default 4 % specular lobe added ~0.04 of light to every face (dark paints were never dark), and `scene.environment` **ignores `material.envMapIntensity`** (r186 uses `scene.environmentIntensity`) — a matt wall drank the whole room environment and read ×3 its hex. The environment now goes on the material, only where there is a sheen | `src/components/three/ThreeStage.tsx` |
| **Bare plaster is a texture, a paint is a finish** — procedural trowel-mark albedo + normal for plaster (`BARE_PLASTER_HEX` `#D9D3C6`, greyer than any white paint so the first click is a visible step, shared with the 2D lift), roller-stipple normal for paint, `FINISH_PBR` per finish (matt 0.95 / silk 0.76 / satin 0.6 / gloss 0.3 roughness; sheen from the gloss-unit bands) reaching the material through `WallSolid.finish`. Sheet `paint-sims/finish-sheet.png`: one colour, four looks — matt ×0.95 · silk ×1.01 · satin ×1.05 · gloss ×1.12 of the chip | `src/data/wallPaints.ts`, `src/designer/roomSolids.ts`, `ThreeStage.tsx` |
| **Hover = the brush ON the wall** (Sims wallpaper preview) + a mint face outline; Erase previews plaster; leaving restores the wall | `ThreeStage.tsx` hover effect, `RoomView3D.tsx` `brushHex` |
| **Paint in place** — a paint changes hex/finish only; the stage compares a structure signature and recolours the material instead of re-extruding the room. One GL stage at a time (the panel card yields to the workspace) | `ThreeStage.tsx` `structureSignature`, `TopBar.tsx` |
| **What is under the cursor is what gets hit** — the brush ray is blocked by any item's exact catalog box or the floor | `ThreeStage.tsx` `hitTest` |
| **Sims gestures** — mouse press on a wall paints it and a drag paints every wall it runs along (touch keeps tap-to-paint + orbit); **Shift** = whole room, **Ctrl/⌘** = erase, this click only, in 3D and on the plan; a miss says "Tap a wall to paint it"; every stroke flashes what it did ("Wall 2 · Permoglaze Matt Emulsion · Bronze") and haptics | `RoomView3D.tsx`, `src/designer/wallPaintBrush.ts` (+5 tests), `RoomCanvas.tsx` |
| **Walls Up / Cutaway / Down** — the Sims wall modes as three buttons in the workspace (`designerUIStore.wallView`); Walls Up stands the near walls so they paint like any other | `RoomView3D.tsx`, `designerUIStore.ts` |

## 4 · Gates

- `npx vitest run` — **199 files / 2,527 tests** (productModels 6, wallPaintBrush 5, roomSolids +1, plaster assertions moved to the shared constant).
- E2E on the dev server: `paint-sims-3d` **4 / 4** (hover preview + pixel truth + plaster step · drag-run + Shift + Ctrl · body blocks the brush + Walls Up/Down · API-id product wears its body) · `wallpaint-3d` 8 · `view-mode-3d` 4 · `wallpaint` 7 · `phone-demo` 4 · plus the strip / pen / units / eco / flooring / placement / drag specs — see the commit.
- `tsc --noEmit`, `eslint` (touched), `npm run build` clean.

## 5 · Not in this change (named, not hidden)

Two faces per wall (inside/outside — needs `PaintedEdge.side` in the 2D model, the quote and the cart: a Vic decision), per-segment painting (same), the 2D plan's lifted side-wall faces being slivers (paint on the side walls is invisible on the plan), turntable thumbnails rendered from the bodies.

---

# TintEX — a second paint company, five lines, the finish on the stage (2026-09-19)

Vic: *"continue full build, also add 5 different paint products from tintex in mauritius, make sure the texture etc is super accurate."*

## 1 · Ground truth first (a 3-sweep research workflow + an independent verifier, same day)

TintEX = **Tintex Company Ltd**, reg. C10093089, est. 14 Sep 2017, Corner Adam Street / Royal Road, Eau-Coulée, Curepipe; +230 675 1825; tintexpaint.com. What the sources give, and what they don't:

| Fact | Source | Status |
|---|---|---|
| Finish, use, yield, coats, drying / recoat, pack sizes | the five product pages on tintexpaint.com (WooCommerce, store API for attributes), the 2022 catalogue (Calaméo, 18 pp), the 2023 company profile (13 pp) | **quoted verbatim** in `coverage_source` / `coats_source` |
| Prices | **none published today** — tintex-shop.com / tintexshop.com are dead domains, the Shopify backend answers 402. Every MUR figure is TintEX's OWN shop as captured by the Wayback Machine on **2021-09-19** (Mastertop, Matt Emulsion, Trade Pro) and **2021-11-27** (VIP Satin, Cashmere), variant JSON parsed: currency MUR, `taxable:false`, four tint bands White · Pastel Shades · Mid-basic · Dark, 250 ml sample pot Rs 90 | loaded with `priced_at` + `price_note`; the panel prints "VAT status not confirmed (TintEX, 2021-11-27) · TintEX online-shop price (Wayback Machine capture); the shop is closed — confirm today's list with TintEX" |
| Colour card | **none** — every tin says "Tint Match"; the shop matches from the RAL K7 / NCS / Pantone / Colour Concert fan decks ("up to 160,000 colours") | the card is 24 RAL Classic shades a wellness room reaches for, the chart is the whole **RAL Classic deck (216)**, hex marked `representative` (RAL is defined physically; the sRGB values are the conventional ones) with the disclaimer on the panel |
| Datasheets | none — every page ends "Contact us for MSDS" | — |
| Cashmere yield | **not published anywhere** | 10 m²/L category norm, `coverage_estimated: true` → "(est.)" in the row, the breakdown and the assumptions line |
| Trade Pro yield | only "PRIMER COAT on new concrete 6-8 m²" (per litre implied) | 7 (6–8), flagged estimated; white-only (no Colour Match attribute, no tint bands in the shop) |
| Mastertop 1 L | White Rs 362.60 captured ABOVE Pastel Rs 345 | kept as captured, said in `price_note`; the catalogue test carries the one exception |

## 2 · The five lines (`src/data/tintexPaints.ts`)

| Line | Finish → `FINISH_PBR` | Yield | Coats | 1 L · 2.5 L · 5 L · 20 L (White, MUR, 2021) |
|---|---|---|---|---|
| VIP Satin | **satin** (roughness 0.6, sheen 0.38) — "a rich satin finish", site attribute eggshell | 10–12 → 11 | 1 primer + 2 | 242 · 662 · 1,076 · 4,227 |
| Mastertop | **silk** (0.76 / 0.22) — "pearl finish", 100 % acrylic, anti-fungal, int + ext | 11–13 → 12 | 2 (not stated) | 362.60 · 897 · 1,449 · 5,687 |
| Cashmere Interior Latex | **silk** — "silky rich look" (shop said "velvety matt … not too shiny") | est. 10 | 2 (not stated) | 253 · 696 · 1,076 · 4,221 |
| True White Matt Emulsion | **matt** (0.95 / 0) | 8–9 → 8.5 | 1–2 → 2 | 161 · 362.25 · 660.10 · 2,553 |
| Trade Pro | **matt**, white only | est. 7 | 2–3 → 2 | 5 L 374 · 20 L 1,380 |

Tinted tins price on the band the colour's depth needs (Pastel ≥ 72 L*, Mid-basic ≥ 45, Dark) — TintEX names no band per colour, so the breakdown says "estimated from the colour depth".

## 3 · What changed in the product

| Piece | Where |
|---|---|
| `PAINT_BRANDS` = Sofap + TintEX; `WallPaint.coverage_estimated / coverage_source / price_note`; `PaintBrand.chartName` ("Colour Match" / "RAL Classic") | `wallPaints.ts` |
| RAL Classic deck (`ralClassic.json`, 216 rows from Wikipedia's table) → card + on-demand chart for TintEX | `tintexColours.ts`, `loadPaintColourChart` |
| Panel: chart label is brand-aware ("All RAL Classic shades"), "(est.)" on estimated yields in the row + breakdown, the price note and the estimate in the assumptions line, TintEX disclaimer under the shades | `TopBar.tsx` |
| A one-brand pitch never lands on another brand's chip: the chip clamps to the brands shown, and `ensureDemoPaintBrush` puts the demo brand's first line on the brush at load | `TopBar.tsx`, `useDemoMode.ts` |
| `/designer?demo=tintex` — the same three-room show flat as Sofap's (builder now takes `{id, name, prefix, paints}`), VIP Satin in the living room, Cashmere in the bedroom, Mastertop in the kitchen | `src/demo/tintex/index.ts`, `src/demo/sofap/index.ts` |

## 4 · Evidence (`tintex/`, dev server, 2026-09-19)

- `desktop-02-3d-panel-tintex.png` — the show flat in 3D with the TintEX panel; rows read `satin · 11 m²/L · from Rs 242`, `silk · 12 m²/L · from Rs 363`, `silk · 10 m²/L (est.) · from Rs 253`, `matt · 8.5 m²/L · from Rs 161`, `matt · 7 m²/L (est.) · from Rs 374` (`evidence.json`).
- Stage materials straight from the demo: living **satin** 0.6 / 0.38, bedroom **silk** 0.76 / 0.22, kitchen **silk** 0.76 / 0.22 (`wallMaterial`).
- `desktop-03-hover-ral6019.png` → `desktop-05-painted.png` — VIP Satin in RAL 6019 Pastel green on a bedroom wall: material `#B7D9B1` satin, rendered pixel **192,226,182** (the hex, lit — no remap).
- `desktop-06-breakdown.png` — "TintEX Cashmere Interior Latex: 25.47 m² × 2 coats ÷ 10 m²/L (est.) = 5.1 L + 10% = 5.7 L → 1× 5 L + 1× 1 L = Rs 1,329" and "TintEX VIP Satin · Pastel green: … = Rs 516 · Pastel Shades (estimated from the colour depth)".
- `desktop-07-ral-chart.png` — 216 RAL swatches. `phone-01-sheet.png` / `phone-02-hud-ral.png` — the five lines on the phone sheet, RAL chips on the HUD.

## 5 · Gates

- `npx vitest run` — **200 files / 2,534 tests** (`tintexPaints.test.ts` 7 new; catalogue test now asserts both brands).
- E2E on the dev server: `tintex-paint` **4 / 4** (show flat + caveats + 216-shade chart · satin vs matt on the stage through the 2D store · both-brand chips with no demo · phone sheet + RAL HUD chips) and the paint regressions `wallpaint` 7 · `paint-sims-3d` 4 · `wallpaint-3d` 8 · `phone-demo` 4 — **25 / 25**.
- `tsc --noEmit`, `npm run build` clean.
- **SwiftShader patience:** the show flat's first 3D frame compiles a shader variant per finish and blocks the page 20–30 s on the runner's software GPU (a trace showed the second `faceCount()` evaluate returning after the 30 s default) — the spec carries 180 s / 90 s timeouts for that reason only.

## 6 · Open for Vic

1. **Prices are five years old.** TintEX must re-quote (+230 675 1825) before a customer sees a TintEX figure; the panel says so on every line.
2. **Cashmere** — no yield, no coat count, and it is missing from the live store API: confirm it is still made.
3. Whether the four tint bands still exist, and VAT treatment of the list.

---

# P3 realism + the electrics (2026-09-19 → 20)

Vic: *"go through the whole app and make sure everything is functioning and people can, just like the Sims game, paint a wall and calculate costs … physically see the wall painted good, not just a graphical color … the electrics are not being calculated … the solar panels are being calculated, but the actual input of the treadmills, of the bicycles … is not working. First, make sure the 3D version is super high level. Just like the game The Sims, identify any flaws, any visual aesthetics, any user interface ability and methods, and upgrade them to the highest level, similar to higher level gaming."*

## 1 · Audit first (`audit-2026-09-19/`)

Three auditors measured before anything was built (the paint-UX and whole-app auditors were cut short by a session limit; their partial evidence is in `paint-3d-ux/` and `whole-app/`):

| Auditor | Verdict, with the numbers |
|---|---|
| **3D visuals** (`3d-visual/`, 15 findings) | the engineering sound, the picture not Sims-grade: both show flats read as **unpainted white boxes** (every wall its line's white base hex, on a floor clipping to 255,255,243); **floors rendered ×1.14–1.15 of their swatch**; the room was **6–16 % of the view** in a flat beige void; doors were holes, windows a 32 % pane; no skirting, caps or ceiling; the interior paint bled onto the **outside** of every wall (ExtrudeGeometry gives both caps material 0); selection turned a product into a mint ghost; a 1 px hairline for the wall target; a right-drag orbit carried a product |
| **Electrics** (`electrics/`, 8 findings, reproduced on production) | the arithmetic is right (treadmill 350 W, bikes 60 W, Jinko 1.9 kWh/day); **Vic's symptom has one root cause** — every merchant product on prod is an `m-<id>` resolved through an async cache, and the energy memo was keyed on `rooms` only, so a reloaded plan of treadmills read **0 Wh** beside a panel that later said 440 Wh (`prod-timing-results.json`); plus the RW900 rower scored 0 W (bare `rower` row first), no way to see or set an item's watts, the stashed "simple meter" WIP never merged (its bar component was never stashed), a 450 Wp hint for a panel not in the catalog, no Energy button |
| **TintEX pack** | `06-Roadmap/marketing-dept/outreach/TINTEX-MEETING-PACK-2026-09-23/` (proposal, 5-minute demo script, questions, A4 one-pager + PDF, 11 production frames) |

## 2 · What shipped

**3D (b954c14)** — all procedural, nothing fetched, colour truth re-measured:

| Piece | Where |
|---|---|
| Floors as real surfaces: rubber tile / interlock / EVA mat / vinyl / EPDM / wood / ceramic / bare screed, joints at the laid tile size, albedo normalised to the hex; sky gradient; ground vignette | `three/surfaces.ts`, `designer/floorKind.ts` |
| Joinery: skirting (stops at doors), architraves + linings, panelled door leaves with lever handles, window frames + mullion + sill | `three/joinery.ts` |
| Set dressing: sky dome (day → night), corner shading strips (the phone-safe stand-in for AO), contact shadows under standing bodies, warm night lights at every lamp | `three/dressing.ts` |
| The sun by the hour: NOAA solar position for Tamarin (Dec noon 3° south of zenith, Jun noon ~46° north, rises east, sets west — pinned) | `designer/sunPosition.ts` |
| Stage: exterior render on the OUTSIDE cap of room walls (faces re-grouped by z), cap strips, 28 mm face outlines, selection = 0.12 emissive + inverted-hull rim, a cut wall stands up as a ghost under the brush, `compileAsync` before the first frame, anisotropy on bodies, PCFSoft shadows, rig re-balanced (hemi 0.72 π / sun 0.25 π / fill 0.25 π) + measured `FLOOR_GAIN` | `three/ThreeStage.tsx` |
| Overlay: the ☀ control (off = studio rig, on = 06:00–20:00), phone labels on the wall-view buttons, right-drag always orbits, zoom to 0.18×, **the Sims price on hover** ("Bedroom · Wall 2 → VIP Satin · Light grey ≈ 9.5 m² · 2.0 L · Rs 516 — click to paint", by the quote's own arithmetic) | `RoomView3D.tsx`, `TopBar.tsx` |
| Framing: the room fills the frame (half-diagonal + 0.3 H at the limiting FOV + 0.4 H), elevation 30° | `roomView3d.fitCamera` |
| Demos: the TintEX and Sofap show flats carry shades from their own cards (RAL 6019 / 1013 / 7035; Bermuda Beach / Elmwood) | `demo/tintex`, `demo/sofap` |

**Electrics (afd063c, merged e8d63fc)** — `useEnergyReport` re-derives when the catalog lands (E-01); the RW900 and touchscreen bikes draw (E-02); a watts field per item, greyed "self-powered · set watts" rows for inferred 0 W gear (E-03); the stashed meter reading adopted + `EnergyMeterBar` written (E-04); name-table false hits fixed with a table-driven test over all 41 seed products (E-05); the hint names the catalog's real 475 Wp panel (E-06); an Energy button in the bar (E-07). Production DB energy columns (E-08) stay a Vic gate.

## 3 · Measured (`p3-realism/`, dev server, SwiftShader)

| Reading | Before (audit) | After |
|---|---|---|
| `#808080` wall, far face, Walls Up | 122,121,119 | **118,117,115** (law 0.78–1.04 of the hex) |
| Gym-interlock floor `#3A3A3A` (58) | 66 (×1.14) | **56** |
| EVA mat `#1F2A44` (31,42,68) | 37,49,76 | **30,40,64** |
| Bare floor `#F1EBDD` (241,235,221) | 255,255,243 (clipped) | **232,225,210** |
| Outside of a room wall | the room's paint | the exterior render (211,205,193) |
| Show flat, dressed | 0 | 16 joinery pieces · 38 corner shades · 4 lamps · 2 contact shadows |
| First 3D frame, TintEX flat | 5.0–9.1 s | 2.8 s (`compileAsync`) |

Frames: `C-tintex-studio-cutaway.png` (day), `C-tintex-sun-1730.png` (dusk, sun from the west), `C-tintex-night-1930.png` (lamps on), `C-tintex-hover-stub-ghost.png`, `D-gym-cutaway.png` / `D-gym-selected.png` / `D-gym-zoomed.png` (bodies, door, window, hull).

## 4 · Gates

- `npx vitest run` — **207 files / 2,582 tests** (joinery 5, dressing 3, sunPosition 4, electrics +36).
- E2E on the dev server: `realism-3d` **3/3** (wall + floor + exterior pixels, dressing counts, sun on/night/off, the price on hover) · `paint-sims-3d` 4 · `tintex-paint` 4 · `wallpaint-3d` 8 · `view-mode-3d` 4 · `phone-demo` 4 · `wallpaint` 6 · `eco-solar` + `eco-phone-add` 6 (electrics branch). The whole-suite sweep is recorded in the handoff.
- `tsc --noEmit`, `npm run build` clean.

## Next

The bench photo → one more $0.30 body; P4 merchant data; P5 Soft chrome; the panel polish the paint-UX audit started (help launcher vs the docked panel, the scope block below a 900 px viewport).

---

# Studio + pitch pass — 2026-09-26 (`studio-2026-09-26/`)

Vic, 26 Sep: "Do the colour fix … continue the builds and push to main and update the pitch deck pages accordingly and provide the links with all the information of the datamapping." The second agent's Studio/pitch branch (`cursor/feat-3d-flooring-hud-bc95`, PR #36, 41 commits over `61e2c5d`) plus its 50 uncommitted files were taken over, finished and merged to `main`. Production = `8214ff4`.

## 1 · The colour fault (found on the branch, fixed first)

The branch's "architectural" presentation (the default whenever the Paint tool is closed) set ACES filmic tone mapping, exposure 1.05, hemisphere 0.34 π with a tinted sky and bounce, sun 1.05 π from a different direction, a rim light, floor gain 1 and day-lit lamps. Every one of those moves a painted pixel, so a shade picked in the Paint tool changed the moment the tool closed. Now `ARCHITECTURAL = { ...STUDIO, reveal, cap }`: the same measured rig in both looks; the look keeps only the sky dome, the navy ground, a far fog that follows the camera (`near = |camera − centre| + radius + 2`) and the unpriced wall edges; floors never cast in either mode. `debug()` on the DEV bridge now reports `presentation`, `toneMapping`, `exposure`, `fog`, `cameraDistance`.

Measured (dev server, SwiftShader, `realism-3d.spec.ts`): the same `#808080` wall with Paint open (studio) and closed (architectural) reads within ±3 on every channel and inside the 0.78–1.04 band at fit and after 7× Zoom out; `toneMapping === 0`, `exposure === 1`, `fog.near > cameraDistance + 6`.

## 2 · What else shipped

| Item | Where |
|---|---|
| Solar panels stay in the House view with the roof covering off (only slab + covering follow the Roof toggle); the energy button names the catalogue product and price | `designer/buildingScene.ts`, `RoomView3D.tsx`, `BuildingControls.tsx`, `EnergyPanel.tsx`, `data/solarPreview.ts` |
| Duraco 1,000 L tank: D 1,140 × H 1,305 mm, Rs 11,500 list (Ah-Ling World + QBM, 26 Sep 2026), own plan + side illustration, 3D body, Outdoor tab | `data/products.json`, `three/waterTankPreview.ts`, `public/products/illustrations/` |
| Seven art-less Courts rows wear dimensional silhouettes (treadmill, exercise bike, multi-gym, foot spa, rug, roller blind); `dressing().bareBoxes`; unit tests pin every placed Courts / Cap Tamarin item | `data/dimensionalPreview.ts`, `three/furniturePreview.ts`, `demo/__tests__/courtsDemo.test.ts` |
| Capsule Plan chrome: one token set, darker active inner pill, vertical rail with Box \| Custom, icon+tooltip header pills (labels visually hidden, in the DOM), capsule zoom cluster / Clear / undo strip / Furnish launcher; HUDs right of the rail | `planToolbar.css`, `catalogChrome.css`, `RoomCanvas.tsx`, `TopBar.tsx` |
| Garden editing in 2D (select / drag / resize / draw), garden workspace + store | `GardenLayer.tsx`, `GardenDrawLayer.tsx`, `PlanGardenWorkspace.tsx`, `store/gardenEditorStore.ts` |
| Read-only only on /demo, /embed, /studio*, /pitch*; legacy `/designer?demo=` transactional; `?demo=off` clean; flag clears on other routes | `lib/showcaseSafety.ts` (27 tests), `docs/PITCH-STUDIO.md` |
| Pitch pages: real app captures (WebP, guarded by a test), WebP heroes, built-today copy, `?client=cap-tamarin` and `?client=spa-concept` overlays, no PPW prices; the 0×0-canvas embed crash parked in CSS | `pages/pitch/*`, `tools/shoot-pitch-captures.mjs`, `tools/shoot-pitch-pages-2026-09-26.mjs` |
| View defaults: blank `/designer` → Plan; every demo → 3D unless `?view=2d` (`demoViewFor`) | `store/designerUIStore.ts`, `demo/useDemoMode.ts` |
| E2E migrated to the shell: `catalog-helpers.ts` (`openCatalog`), House-Studio helpers, `&view=2d` for plan-only specs | `tests/e2e/*` |

## 3 · Evidence (`studio-2026-09-26/`)

`grey-boxes-after-1440.png` (the gym room, no bare blocks) · `toolbar/` (blank + TintEX plan at 1366 and 390) · `pitch/` (25 frames, `evidence.json`: 0 overflow, 0 console errors, captures show the app) · `prod/` (production probe after the merge: healthcheck, framing headers, no public map, 16 routes desktop + phone, console errors).

## 4 · Gates

``npx tsc --noEmit` client + api clean · `npx vitest run` **266 files / 2,985 tests** · `eslint --max-warnings=0` on the 108 changed source files + every touched spec · `npm run build` clean, **0 `.map` in `dist/`** (the public-source-map guard) · Playwright on the dev server, whole suite, two workers: **185 passed / 41 skipped / 2 failed**, the two being the cladding spec's 5 s first-frame poll under load (2/2 alone in 12 s; budget widened to the 3D-spec standard in `8214ff4`) · the earlier sweep before the fixers: 152 / 35 / 41 · colour truth measured Paint-open vs Paint-closed ±3 (`realism-3d` 6/6 incl. `/demo` bareBoxes === 0) · `paint-sims-3d` 4/4 · `tintex-paint` 4/4 · `wallpaint-3d` 8/8 · `view-mode-3d` 5/5 · `phone-demo` 4/4 · preview `5013erpyc` probe: healthcheck `312de8b`, 14/16 routes 200 with 0 console errors and 0 horizontal overflow (2 network drops from this box), framing headers as designed, the `.map` URL answers the SPA shell (`text/html`), not a map`

## 5 · Open for Vic

- The embed CSP is `frame-ancestors 'self' https:` — narrow to partner hostnames before a merchant launch.
- Two rate cards disagree (public page: Rs 30,000 + Rs 275/185/95 per product + care; TintEX pack: MUR 50,000 + ~400/SKU + retainer); the interactive pitches carry no price by design.
- Courts silhouettes are labelled dimensional previews, not manufacturer models; photo licences are not recorded.
- Seen only on software GL: a stepped lawn edge at 390 px and a lost lawn plane after a ~180° orbit — worth one look on a real phone.
