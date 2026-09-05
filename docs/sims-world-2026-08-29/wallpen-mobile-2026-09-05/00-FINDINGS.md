# Wall pen on a phone — four defects, reproduced and fixed (2026-09-05)

Vic, on the branch preview:

> While still on the draw wall feature on the mobile version I needed to zoom
> out and move over but the wall draw was still active and made me draw random
> walls. When I pressed select tool i could not select the walls to delete.
> Select toolbar should still be available on main screen rather than only
> burger menu. Wall pen toolbar at the bottom has some space underneath, all
> toolbar should minimise space to maximise canvas.

Reproduced first, with real touch events at 390 x 844 (`tools/wallpen-mobile-repro-2026-09-05.mjs`;
multi-touch needs raw CDP because Playwright's `touchscreen` is single-point).
Captures: `before/` and `after/`.

## What was actually wrong

| # | Symptom | Measured before | Root cause |
|---|---|---|---|
| 1 | Pinching to zoom drew a wall | HUD `0 pts` → `1 pts` per pinch | The draw layer commits a vertex on Konva `tap`/`click`. The Floor, Door and Wall-paint tools each drop their in-flight gesture when a second finger lands; the pen had no such guard, so lifting a pinch planted a point. |
| 2 | Moving the view drew a wall, and the view did not move | HUD `1 pts` → `2 pts`; viewport identical before and after the drag | The Stage is `draggable={false}` in draw mode, so a one-finger drag panned nothing — and the release still fired `tap`, so it planted a point instead. There was no way to move the plan with the pen armed. |
| 3 | Select could not pick a wall | 1 wall before the tap, 1 after, no selection UI | Free walls render `listening={demolish}` — they only accept a click while the sledgehammer is armed. Under Select they were not hit-testable at all. |
| 4 | Select was only in the burger menu | no Select on the phone strip | The strip was brand · room · Walls · menu; Select existed only in the md+ bar and the sheet. |
| 5 | Dead space under the pen card | HUD bottom 721 px, toolbar top 789 px = **68 px** | The card reserved a hard-coded 56 px for the Clear / cart row, which `App` hides while drawing. |

## What changed

- **One gesture contract for the pen.** `RoomCanvas` owns the touch handlers,
  and now raises a veto (`drawTapSuppressRef`) the moment a gesture becomes a
  pan or a pinch; `RoomDrawLayer` refuses to commit a vertex while it is up.
  The veto is cleared at the START of the next single-finger gesture, never on
  read: a touch reaches the Stage twice (Konva `tap`, then the browser's
  compatibility `click`), so a consume-on-read would let the second event
  through and plant the very vertex the pan was avoiding.
- **One finger pans while the pen is armed**, past a 10 px slop. Under the
  slop it is still a tap, so drawing is unchanged.
- **Two fingers pan as well as zoom.** The pinch handler used to freeze the
  gesture centre at touch-start, so two fingers could scale the plan but never
  move it. It now tracks the live midpoint.
- **Mouse drags are not vertices either** — a press that travels more than
  12 px is a drag. This test applies to real mice only: a finger's compat
  `mousedown` is ignored, or the next tap would be measured against the
  previous tap's position and refused (caught in test, see below).
- **A free wall is pickable with Select.** Tapping one highlights it and shows
  a compact card with its length, Delete and Done; Del / Backspace deletes,
  Esc or a tap on empty canvas clears. The pick lives in `designerUIStore`
  (`selectedWallId`), is dropped whenever the tool changes, and is never
  persisted.
- **Select is on the phone strip**, next to Walls, icon-only so 390 px still
  fits.
- **The pen card sits on the toolbar.** The 56 px band is gone from the pen
  card (the Clear row is hidden while drawing anyway) and the phone card's own
  padding is tighter.

## Measured after

| Check | Before | After |
|---|---|---|
| Two-finger pinch | zooms, **+1 point** | zooms (0.62 → 0.30), **0 points** |
| One-finger drag | **+1 point**, view frozen | **0 points**, view moves (x 120 → 232) |
| Three plain taps | 3 points | **3 points** (drawing intact) |
| Gap under the pen card | **68 px** | **8 px** |
| Select on the phone strip | absent | present, `aria-pressed` toggles |
| Tap a wall with Select | nothing | card reads **3.50 m**; Delete takes 2 walls to 1 |
| Console errors | 0 | 0 |

## Two things my own fix broke, then fixed

1. **Every tap after the first was swallowed.** The mouse-drag slop compared
   each tap against `mouseDownAt`, which a touch's compatibility `mousedown`
   had filled with the PREVIOUS tap's position — 110 px away, so every tap
   read as a drag. Fixed by ignoring compat mousedowns and skipping the slop
   test on the touch path. Caught by the repro (3 taps → 1 point).
2. **The wall card landed on top of "Products" / "Clear all".** The pen hides
   that row while drawing; the Select tool does not. Fixed by giving the card
   the same 56 px band the Floor / Door / Wall-paint cards use — and, on a
   phone, anchoring it left with a 64 px right gutter so it also clears the
   round help launcher. Caught by looking at the screenshot, not by a test.

## Pinned by

`tests/e2e/wallpen-mobile.spec.ts` (6): pinch plants nothing, one-finger drag
pans and plants nothing, a tap still plants exactly one point per tap, no dead
band under the card, Select-on-strip picks a wall and deletes it, and tapping
empty canvas clears the pick. Plus 4 store tests for `selectedWallId`.
