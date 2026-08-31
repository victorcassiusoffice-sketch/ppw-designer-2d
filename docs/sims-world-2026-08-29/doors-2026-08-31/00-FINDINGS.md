# Doors — "the door opens in the wrong place" (Vic 2026-08-31)

Reproduced on the deployed preview (`bc958dd`, door code == `1cd39a1`) with real mouse + touch
journeys (15 runs, 0 console errors), a full code read, and 3 adversarial verifiers per top
hypothesis. Evidence: `tools/_scratch/doors-results-*.json` + the PNGs in this folder.

## What is NOT wrong

Desktop mouse placement is correct: stored `offsetM` matches the clicked world point within 5 mm at
100 % zoom, 3.6 mm at 63 % zoom, exactly after a pan — no screen→world scaling bug; the rendered
gap/leaf/arc match the store on all four walls; flips behave; window keeps the wall line; doorway is
a clean gap; a shared wall cuts both rooms' strokes.

## Confirmed defects (ranked)

1. **P0 · touch places nothing.** A real tap fires `commitDoorAt` 4× (Konva `onTap`
   RoomCanvas:2651 AND `onClick` :2672, each doubled by the browser's synthetic mouse events).
   Commits 2/4 hit the remove branch (:2142, radius `max(w/2, 0.35)`) on the opening just placed —
   every tap toasts "Door added" then "Opening removed" and the store stays EMPTY. Doors cannot be
   placed by touch at all. Fix: single pointer-event path + a tap/click dedupe (same pattern as the
   wall-pen fix), and don't let a fresh placement satisfy the remove scan within the same gesture.
2. **P0 · no door tool on the phone.** At 390 px the toggle lives in the `md:`-only rail, the
   sub-bar is `hidden md:flex`, and the menu sheet has no door row. Fix: a Door row in the sheet's
   BUILD section + kind/flip controls on an on-canvas HUD card (same pattern as the Floor card).
3. **P1 · stale-transform race = the literal "wrong place".** Clicking < 1 s after enabling the
   tool races the door sub-bar mount → canvas re-fit (viewport y 116.5→90.5): the click maps through
   the stale transform and can land on the WRONG WALL (reproduced: top-wall click stored edge 3 at
   3.481 m). Fix: read the transform at pointer time from the live stage (not a cached ref), or
   re-fit synchronously before enabling the pointer handler / debounce clicks during a fit.
4. **P1 · winding: CCW-drawn rooms swing every door outward** (3/3 verifiers confirmed, incl. an
   end-to-end draw→door repro). `edgeNormal` (openings.ts:155-157) is the fixed left normal;
   nothing normalises polygon winding; box rooms are CW so they behave, hand-drawn CCW rooms
   reverse every default and "Flip side" reads backwards. Fix: canonicalise winding at draw-commit
   AND on load (shoelace sign → reverse; remap existing openings' edgeIndex/offsetM when reversing).
5. **P1 · no hover preview via the door TOOL.** `onPointerMove` returns at `!pendingProductId`
   before the `doorTool` branch — the ghost/valid-red preview never shows while hovering with the
   tool, so the jamb clamp (up to 0.52 m of slide near a corner) and the 0.6 m nearest-wall snap
   feel like "wrong place". Fix: hoist the doorTool branch above that early return; the preview code
   already exists and works.
6. **P1 · storeys ignored.** `computeDoorHover` scans every room on every level — a click on an
   upper floor can host (and hide) the door on the ground-floor room below. Fix: filter by
   `roomsOnLevel(...roomsOnActiveLevel)` like the renderer.
7. **P2 · shared-wall facing.** A door in a shared wall always hosts on and swings into the
   first-created room regardless of which side you click from. Fix (Sims-adapted): default
   `flipFacing` per placement from the cursor's side of the wall (`perpDistanceToEdgeLine` sign);
   keep the toggles as overrides.
8. **P2 · window width.** The Window chip keeps the door width (0.838) instead of
   `DEFAULT_WINDOW_WIDTH` (1.2).
9. **Latent · edgeIndex vs roomEdges array index** mismatch if a degenerate polygon vertex ever
   survives; make lookups `find(e => e.index === o.edgeIndex)` and/or strengthen `cleanPolygon`.

## The Sims reference (researched; sources in the workflow output)

- Doors: ghost snaps per wall cell, green/red tint, no swing preview, no reasons, swing set by
  ROTATING the held door; Sims 4 lets you grab and reposition a placed door.
- Floors: 1 tile = 1 build cell; material is a texture (no per-material size); click = tile,
  drag = rectangle, Shift+click fills the room skipping placed tiles; Ctrl+click erases; no live
  count/cost on the floor tool.

**Adopt/adapt decisions:** keep our reasoned red states and swing preview (beyond the Sims bar);
ADAPT cursor-side default facing (item 7); ADOPT drag-to-move an existing opening (M); KEEP our
real-pitch tile lattice — a Sims texture grid would break unit counts and pricing (intentional
divergence, documented); ADD a live "n tiles · £x" chip during a floor stroke (commerce-grade,
better than Sims); ADOPT Ctrl-held momentary erase + Shift+click room fill as desktop accelerators.

## Sequencing

Door fixes touch RoomCanvas/TopBar/openings.ts — the same files as the in-flight Floor-tool build,
so they land as the NEXT round after that build's gate goes green. Order: 1→6 (correctness), then
7–8, then the Sims adoptions (move-door, live cost chip) as polish.
