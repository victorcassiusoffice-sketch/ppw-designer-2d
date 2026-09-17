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

## Next

Fix the bench photo → one more $0.30 generation. P3 realism (PBR floor/paint textures, sky, night lights from `mauritiusSolar`) → P4 merchant data (Decathlon · Mauvilac · Courts · Espace Maison, `power_w`) → P5 Soft chrome.
