# Sculpted UI and realism refinement — 4 October 2026

Status: implemented, tested and deployed on the feature preview; pitch captures and continuation links refreshed. This is the second pass after Victor rejected the first October 4 appearance. It improves the presentation but does not claim photographic parity with the references.

Checkout: `C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer`
Branch: `cursor/feat-3d-flooring-hud-bc95`
Starting HEAD: `2002fe7`. Do not publish main or production for this pass.
Last verified preview before this pass: `https://ppw-designer-2d-31cpgr056-victor-ppw.vercel.app`.

## Implemented

- Sculpted ivory/mint control system: raised controls, inset trays/fields, clearer selected states, quieter scene perimeter. Narrow phone header/Clear fit corrected. No floating central toolbars.
- Consolidated 3D wall/room/door/window/stair actions into one tray, with four-column phone layout.
- Furniture grain, textile variation, bedding folds, cushion seams and local occlusion, constrained to original catalogue envelopes.
- 2D uses the same supersampled product models, room-clipped wall shadows from actual heights, exterior-window daylight, framed openings and quieter collision-aware room labels.
- Fresh generic demo uses real Sofap paint colours and 36 real catalogue products. Existing saved plans and merchant demo seeds stay intact. The catalogue currently lacks sourced residential timber/tile floors; no supplier SKU or priced finish was invented.
- Natural light is an explicitly approximate appearance preview, with Colour check retaining the existing neutral lighting. Neither mode changes material quantities or geometry. Lighting preference persists, camera stays in place, and Colour check pauses the sun-hour shading without losing that preference. Mobile action/error feedback remains visible; only the idle navigation hint is hidden.

## Verification so far

297 test files / 3,259 tests passed with Natural light, followed by 22 focused camera/wall tests after the final neutral-light correction. Client/API typechecks and final Vite build passed. Changed-file lint passed. Existing large bundle advisory remains. Local browser QA at 1440×900, 390×844 and 320×740; final 320px Clear clipping fix verified. Natural/Colour check switched in browser without changing framing; neutral mode hides the time-of-day controls and explains the pause. Local dev server is `http://localhost:5173`.

## Publication and continuation

Continue on the feature branch. Future reference-level realism needs sourced residential floor products and exact supplier geometry/PBR textures. Do not invent purchasable SKUs or resize the measured envelopes for styling. Richer materials and measured dimensional previews remain approximations.

Application `ce9d9b6f3ab170ae6a7aa2ec37781fad76364bd3` deployed successfully as Vercel `6835649445` at `https://ppw-designer-2d-aouziw3ca-victor-ppw.vercel.app`. Health confirms this commit. All eight Designer/demo/Studio/pitch routes returned HTTP200. Fresh generic demo visually verified with 61 scene parts / 36 placed products, actual new paint selections and Rs535,402 estimate; Plan and House render, 390px phone has no horizontal body overflow. Guided layout created a 120m² concept preview without applying it. Separate browser navigation checks for legacy TintEX timed out; repeat on the following screenshot publication before marking fully verified. Production health still confirms `71db6af8cfdd6f0128ae8ea663c69fab104b6e5e`.

Actual captures: `C:\Users\Victor\Documents\Codex\2026-09-23\c\outputs\Room-Designer-{Plan,3D,AI,Phone}-Refined-2026-10-04.jpg`. Plan/3D/AI captures replace the corresponding `public/showcase` assets. 28 pitch integration tests pass after replacement.

Screenshot-update deployment `6835774028` for `e3de30ecd15a1030f10b19c6571777e034040c1a` is verified at `https://ppw-designer-2d-9kuay0rgv-victor-ppw.vercel.app`. Its health confirms that SHA; all eight main routes and three screenshot assets return HTTP200. Standard Designer and legacy TintEX render on desktop and 390px phone without body overflow. Plan/House and Site & tools Escape dismissal work. Developer pitch chapter 02 renders the new live embedded home and updated actual 2D capture. Desktop handoff, BUILD-LINKS, CURRENT-WORK-LINKS and saveable output logs contain this verified link. A final pitch wording correction names Natural light versus Colour check rather than promising identical colour under both lighting rigs; 16 pitch tests and scoped lint pass.

Original checkout and recovery stash `649569db5766b86c5880321f6cfea782f356da1f` remain untouched. Production was `71db6af8cfdd6f0128ae8ea663c69fab104b6e5e` at the previous verification.
