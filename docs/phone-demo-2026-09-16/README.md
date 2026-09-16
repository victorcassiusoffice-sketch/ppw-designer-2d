# The designer on a phone, with the merchant demo — 2026-09-16

Vic, testing `designer.ppwellness.co/designer?demo=sofap` on his phone the day
the wall-paint 3D version went live: "When I select the demo from the phone it
doesn't function well … the layout needs to be altered … easy to access all
features, while being able to see the screen."

Audited on production `9ea43e0` at 390 × 844 with touch (Playwright, Chromium),
then fixed on `feat/phone-demo-layout-2026-09-16`. No paint products added.

## What was wrong (before/)

| # | Finding | Evidence |
|---|---|---|
| 1 | **A tap on a product thumbnail never left the popup open.** The scrim closed on `click`; a finger fires a compatibility click ~1 ms after the tap that opened the popup, and by then the popup's own full-screen scrim is under the finger. Timeline: `pointerup` → popup mounts (+2 ms) → `click` on `mobile-product-popup` → unmounts (+1 ms). "+ Add to room" was unreachable by tap; only long-press drag worked. | `before/06-thumb-tap-no-popup.png` |
| 2 | Paint mode stacked three layers under the plan: the 133 px HUD card, the 56 px Products / Clear all / cart band, the 55 px category row — and the "?" launcher (z 35) sat on the HUD's Done corner. | `before/03-paint-hud.png` |
| 3 | The show flat opened with the thumbnail strip expanded (30 vh, 205 px) — the plan got 430 px of a 844 px screen. | `before/01-load.png` |
| 4 | Every colour choice was blind: "Change" opened the full-height sheet (3,459 px of scroll, all 15 paint lines listed, colours a screen and a half down) over the plan; colour tiles 36 px. | `before/02-sheet.png`, `before/05-colours-in-sheet.png` |
| 5 | 3D overlay: rotate / Fit / Plan 32 px, brush swatches 32 px; the "?" launcher floated over the 3D view. | `before/04-3d.png` |

## What changed (after/)

| Change | Where |
|---|---|
| Popup scrim closes on `pointerdown` (a new gesture) and Esc; the opening tap's click is ignored | `src/components/mobile/MobileProductPopup.tsx` |
| Below md, while the Floor / Door / Wall-paint HUD is up: `ClearControls`, `CartStrip` and the launcher step out; the HUD cards drop their 56 px band reservation and sit flush on the folded strip; Done brings the band back | `src/App.tsx`, `src/designer/HelpOverlay.tsx`, `src/components/RoomCanvas.tsx` |
| Colour row inside the paint HUD: base white · 24 brand shades · More, 40 px chips, scrolls sideways | `src/components/mobile/WallPaintHudColourStrip.tsx` |
| Strip auto-folds to its category row when a furnished plan arrives on a phone (demo, saved page, tab switch); a category tap unfolds | `src/components/mobile/SimsBottomToolbar.tsx` |
| 3D overlay controls 40 px on the phone tier; brush swatches 40 px; launcher hidden under the overlay | `src/components/RoomView3D.tsx`, `src/components/TopBar.tsx` |
| Sheet lists the brand's featured paint lines + "More … lines (9)"; colour tiles 40 px | `src/components/TopBar.tsx` |
| One shared `useBelowMd` (was two private copies) | `src/lib/useBelowMd.ts` |

## Measured on the dev server (after/)

| State | Fixed chrome inside the stage | Notes |
|---|---|---|
| Load, show flat | launcher · cart pill · band; strip folded (55 px) | `after-01-load.png` |
| Paint HUD | the HUD only (183 px incl. colour row), strip folded | no band, no launcher — `after-03-paint-hud.png` |
| 3D view | overlay full-screen; nothing above it | `after-05-3d.png` |
| Done | launcher + cart pill + band back | `after-06-done.png` |
| Thumb tap | popup open, "+ Add to room" reachable | `after-07-popup.png` |

Console errors in every state: 0.

## Gates

- Unit: `npx vitest run` — 193 files, 2,464 tests (8 new in `phoneDemo.test.tsx`).
- E2E on the dev server (`PPW_E2E_BASE_URL=http://127.0.0.1:5199`): `phone-demo` (4, new) + `mobile-sims-toolbar` + `wallpaint-3d` + `wallpaint` + `units` + `eco-phone-add` + `wallpen-mobile` — all green (`units` re-run alone after a cold-server timeout).
- `tsc --noEmit`, `eslint` (touched files), `npm run build`: clean.

Still open, not touched: the plan on a portrait phone is width-bound (a 5.5 m-wide flat draws at ~57 px/m whatever the height), so the space the fold frees shows as room around the plan rather than a bigger plan — pinch to zoom; and the phone HUD's live figures still crowd the paint name at 390 px (the brand prefix is now dropped there).
