# Walls slant · no Select tool · Reset to corner · Clear-all unselectable (Vic 2026-08-31)

Root-caused in code (12f4d2e) with a partial live reproduction on dev; the dedicated repro agent hit
a StructuredOutput cap so I reproduced the Reset/Clear/wall paths myself
(`tools/_scratch/wsr-repro.mjs`). The Sims/editor reference is in the workflow output.

## A · Walls sometimes slanted, not straight

`RoomDrawMode.tsx` `getRoomPoint` (L189-196) grid-snaps EACH vertex independently
(`quantiseVertex`, `drawLength.ts`) with **no axis/orthogonal lock**. A run the user means to be
horizontal or vertical commits slanted whenever the second click lands off-axis by more than half a
grid cell — the grid only rescues small drift (my probe at the 0.5 m unit snapped a 0.15 m drift back
to straight; at 0.1 m the same drift becomes a slant). Editors make orthogonal the DEFAULT: Sims 4
allows only 45/90°; Sweet Home 3D snaps to 15° magnetism unless you hold Alt; Floorplanner has an
ortho bias + a live length **and angle** readout. Ours has only length, no angle, no ortho.
**Fix:** axis-lock within ~15° of horizontal/vertical (Shift frees it for a deliberate diagonal) +
an angle readout.

## B · No grab/select tool to move, reposition or delete

The default and fallback tool IS `tool === 'hand'` (select/move) but the TopBar BUILD group renders
only Walls/Door/Floor/Measure — there is **no visible button to return to select/move** once a build
tool is on; you must re-press the active tool, and Esc only exits Floor. Per-object rotate/duplicate/
delete already exist in `FloatingCluster` once an item is selected — the gap is purely getting back to
select mode. **Fix:** a persistent **Select** tool button (first in the BUILD group, active when
`tool==='hand'` and no build tool is on) + phone sheet row; Esc from any build tool returns to hand.

## C · Reset "moves everything to the corner"

`RoomCanvas.tsx` `resetView` (L1574-1580) sets `INITIAL_VIEWPORT {x:0,y:0,scale:1}` — the room's world
origin at the stage top-left, i.e. the corner — and flips `userMovedViewportRef=false` expecting the
auto-centre `useEffect` (L873-941) to re-fit. **A ref change does not re-run a useEffect** (its dep
array has neither `viewport` nor the ref), so the room stays in the corner. Confirmed live:
`vpAfterReset = {x:0,y:0,scale:1}`. The correct union-fit math already lives inside that effect
(~L926-939). The visible label "Reset" also reads as **start over**, which it never was.
**Fix:** make Reset call the union-fit directly (zoom-to-fit, room centred + fully visible) and
relabel it **Fit** so it is not mistaken for start-over.

## D · "Clear all" unselectable

`ClearControls.tsx` `clear-all-button` has `disabled={nothingToClear}` where
`nothingToClear = !hasProducts && !hasRoom` and `hasRoom` = the **active** room `polygon.length >= 3`.
A freshly-seeded / blank-on-open room is `polygon:[]`, so on a "start again" canvas `nothingToClear`
is true and the button is **disabled** — directly contradicting its own comment ("Clear all stays
enabled so a user can always reset a half-drawn room"). `clearEntireDesign()` is harmless and undoable
(Ctrl+Z), so Clear all must never be disabled. (In Vic's exact state — 2 objects — it is enabled and
does open the confirm modal; the dead state bites on a blank/half-drawn canvas and after Reset drops
the room into the corner near the bottom-left controls.) **Fix:** Clear all is always clickable; keep
"Clear products" disabled only when there are no products.

## Sims / editor reference (researched, sources in the workflow output)

Orthogonal-by-default walls with a modifier to free + live length/angle; a persistent Hand/arrow
Select tool as the home state with Esc returning to it and select-then-Del to delete; and a strict
separation of **reset VIEW** (zoom-to-fit, its own button/shortcut) from **start over** (a separate,
confirmed New/Clear). All four fixes follow that grammar.

## Sequencing

Clean file ownership: P1 `RoomDrawMode.tsx` + `drawLength.ts`; P2 `TopBar.tsx` +
`useKeyboardShortcuts.ts` + `HelpOverlay.tsx`; P3 `RoomCanvas.tsx` (resetView) + `ClearControls.tsx`.
No file overlap, so all three build in parallel.

## SHIPPED (2026-08-31) — commits 63365fe + 1bb41de, verified on the preview

Vic was fully blocked ("I can't delete anything, remove walls, clear, or reset; even a fresh
incognito is stuck"). Root causes + fixes, all live on the branch preview and gated:

- **Delete objects**: works — Select an item, press Delete (or use the Remove tool). Verified 2→1→0.
- **Remove an individual wall**: NEW visible **Remove** tool (`remove-tool-toggle` + phone row). The
  sledgehammer that deletes a free wall / object on click existed but was J-key-only (no button,
  nothing on mobile) — that was "I can't remove walls". Now a button + on-canvas banner. Verified a
  wall click 1→0 and an object click 1→0.
- **Clear all / start again**: was DISABLED whenever the active room had no drawn polygon and no
  products (a blank canvas, or objects in Outdoors) — so a fresh/blank user literally could not click
  it. Now always enabled; wipes rooms, items, openings, walls and floors to blank. Verified on a
  fresh blank preview: clickable → confirm modal.
- **Reset → Fit**: was slamming the room to the corner ({0,0,1} + an effect that never re-ran). Now
  zoom-to-fits and re-centres; relabelled "Fit" so it is not mistaken for start-over.
- **Straight walls**: 15° axis-lock (Shift frees a diagonal) + an angle readout.
- **Select tool**: a persistent arrow button so you can always get back to moving/deleting; Esc from
  any tool returns to it.

Note: the fresh-incognito "stuck with a treadmill and a bike" is persisted localStorage within the
incognito session (a new tab shares it) — the fix that matters is that Clear all now clears it.

## STILL OPEN (separate issue, tracked)

Object top-down rendering (`objects-topdown-2026-08-31/`): the top-down image FILES are mostly
correct top-downs and load (200), but on the canvas several objects render as blank labelled boxes
instead of their art — that inconsistency is what reads as "not top down / doesn't look right".
This is a rendering-path issue (large-image content-box/fit), NOT the removal loop. Fix is the next
pass: classify all 27 objects' on-canvas rendering, fix the render so every object reliably shows a
clean top-down, and replace any genuinely side-on source with a proper top-down or a plan symbol.
