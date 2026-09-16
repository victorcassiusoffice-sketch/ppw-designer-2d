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

## Next

P1 fit-to-size bodies (CC0 proxies scaled to `dimensions_cm`) → P2 interaction in 3D → P3 realism (PBR/sky/textures/night) → P4 merchant data (Decathlon · Mauvilac · Courts · Espace Maison, `power_w`) → P5 Soft chrome → P6 hero models (Fal, Vic-gated).
