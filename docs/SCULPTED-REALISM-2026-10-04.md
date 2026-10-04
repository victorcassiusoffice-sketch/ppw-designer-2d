# Sculpted UI and realism refinement — 4 October 2026

Status: implementation and local verification complete; feature deployment and pitch screenshot refresh pending. This is the second pass after Victor rejected the first October 4 appearance.

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

## Resume / remaining

Commit and push feature branch only; visually check desktop/phone and fresh generic seed on a unique deployment. Refresh actual app screenshots in `public/showcase` for pitches. Verify `/designer`, legacy TintEX, demo 2D/3D and pitch routes on the unique host, update BUILD-LINKS/CURRENT-WORK-LINKS and Desktop handoff. Include real screenshots in the final response. Do not claim photographic parity or exact manufacturer CAD: richer materials and measured dimensional previews remain approximations.

Original checkout and recovery stash `649569db5766b86c5880321f6cfea782f356da1f` remain untouched. Production was `71db6af8cfdd6f0128ae8ea663c69fab104b6e5e` at the previous verification.
