# Designer — verified findings, 2026-08-29 ("Sims world" brief)

Baseline: `main` @ `040a9f6`. Branch `feat/sims-world-2026-08-29`.
Method: 7 code-mapping agents + 3 root-cause hunters + adversarial verifiers over the real repo,
every claim re-read by hand. File:line anchors are against `main` @ `040a9f6`.

## Vic's brief, decomposed

| # | Ask | Root cause / current state |
|---|---|---|
| 1 | Objects don't snap flush to walls; "works horizontally but not vertically"; can't put things in corners; "ratio algorithm 100% accurate" | see §1–§4 below |
| 2 | Walls can stop where they want, don't have to join; when they do join the room confirmation still stands | Two disjoint wall systems: room polygons (`RoomDrawMode`) must close or the run is DISCARDED; `wallStore` (mm, global, localStorage-only, never saved to the server, invisible to placement) draws open runs but never becomes a room |
| 3 | Change wall unit mid-draw (0.5 m → 0.1 m), shortcut "plus one", mobile-friendly | Six units exist (`designerUIStore.precision`, digits 1–6, Ctrl+F). `+`/`-` are canvas ZOOM. No stepper on the draw HUD; the mobile `mobile-precision` button is an A/B toggle only |
| 4 | Place things outside rooms; multiple buildings + gardens like The Sims | `findRoomAt` returns null outside every polygon → `RoomCanvas.tsx:809` refuses the drop. Items can only live in `Room.placedItems` |
| 5 | Land measurements lock the scale + maximum capacity | No site/plot/land concept anywhere (`unionBounds` is computed, never stored) |
| 6 | Design Dashboard to match the 3 reference plans | Canvas is dark navy + gold (`blueprintTheme.ts`); references are cream paper, charcoal poché walls with soft shadows, quiet grid, light pools, greenery outside |
| 7 | Light feature when a light is added | No lighting product, no glow concept; `ProductCategory` has no `lighting`; adapter collapses API `lighting` → `other` |
| 8 | Additional floors, as many as the user wants | No storey concept. "Pages/Plans" are separate saved designs, not levels |
| 9 | Don't deploy to the public domain; deploy to GitHub/Vercel; Vic deploys when satisfied | Vercel project `ppw-designer-2d` is git-connected (`ppw-designer-2d-git-main-victor-ppw.vercel.app` exists) with deployment protection OFF → pushing the branch yields a preview URL that never touches `designer.ppwellness.co` |

## 1. Wall snap — the real defects (all verified in code)

1. **Wall thickness is ignored by placement.** The wall is stroked 10 layer-px (0.1 m at 100 px/m) CENTRED on the polygon edge (`RoomCanvas.tsx:2244-2278`, `blueprintTheme.ts:57`), but `resolveWallAwarePlacement` flushes the item to the polygon edge itself (`wallAwarePlacement.ts:183,187`). Every "flush" item overlaps the inner 5 cm of the wall band — it reads as "not sitting against the wall properly".
2. **Only ONE wall is ever snapped** (`wallAwarePlacement.ts:83` single `best`). The perpendicular axis goes through `snapToGrid`, so an item touches two walls only when `(wallCoord − extent)` happens to be a grid multiple. With 0.5 m snap and a 0.95 m-deep treadmill that never happens → **corners are impossible by construction**.
3. **Along-wall grid snap can overshoot the room end** (no clamp), then `validatePlacement` fails and `findFreeSlot` re-snaps BOTH axes (`geometry.ts:326-327`) — the flush position is lost and the item lands off the wall. This is the "sometimes works horizontally but not vertically" symptom: it depends on which axis the grid happens to align with in that room.
4. **Dragging a rotated item mid-room resets it to 0°** — `RoomCanvas.tsx:3200` passes `userRotationDeg: null` for cardinal rotations and the resolver's mid-room branch returns `plain(userRot ?? 0)` (`wallAwarePlacement.ts:176`); the drag handler then commits `wallAware.rotationDeg`.
5. **Wall-item drag/duplicate hard-code `snapStep: 0.5`** and the owning polygon (`RoomCanvas.tsx:3134-3135`, `placementActions.ts:181`).
6. **Axis-alignment tolerance 1e-9** (`wallAwarePlacement.ts:96`) vs 4-dp vertex rounding elsewhere → an edge that is axis-aligned to 1e-4 is "slanted" and never snaps.
7. **Interior walls (`wallStore`) and free walls are invisible to placement** — items can be placed through them.

## 2. "Ratio algorithm" — the art, not the maths

Every K1 top-down PNG is footprint-exact (2050×950 px for 205×95 cm → 0 % mismatch). The five **demo** products ship **1024×1024** art on non-square footprints: console table 120×40 (67 % mismatch), wall shelf 80×20 (75 %), wall mirror 120×5 (96 %), diffuser/plant square-ish. `fitImageToFootprint` contain-fits (`imageFit.ts:61-67`), so a 120×5 mirror draws as a 5×5 cm blob centred in a 120×5 strip, and the console table draws 40×40 with 40 cm of bare floor either side — visibly "not touching the wall" even when the footprint is flush. The demo JPEGs also have ~35 % white margin around the object (verified by eye).

## 3. Placement holes the map surfaced (fixed in this pass where cheap)

- `findFreeSlot` step is floored at 0.5 m (`RoomCanvas.tsx:957`) so fine units are ignored on relocation.
- Rotate-handle pivot mixes stage-scaled and layer px (`RoomCanvas.tsx:3427-3432`) — wrong at zoom ≠ 1.
- `rotateSelected` pivots at the AABB top-left (`placementActions.ts:135`) while the art rotates about the centre → a flush item on the right/bottom wall refuses to rotate.

## 4. E2E colour coupling that a reskin flips

`wall-aware-placement.spec` (gold scan only), `multiroom-helpers.goldSpanPx` (no geom fallback), `geom-bridge.spec` (literal gold RGB), `door-openings.spec` (`r > b + 30` warm-wall predicate), `flooring.spec` (bare floor must be `b > r`), `drag-place.spec` (ghost RGB literals), `surface-wall-items.spec` (pre-reskin dark scan). Two vitest suites pin `ROOM_BORDER_SCAN`.

## 5. Deploy reality (verified via Vercel API this run)

- Project `prj_NDw29vwldFyaA2GVsfnQHqdR8hre`, team `team_bptfse7K2LapV0JdqPKKuRiM`, framework vite, node 22.
- Domains include `ppw-designer-2d-git-main-victor-ppw.vercel.app` → git integration is on; a pushed branch gets `ppw-designer-2d-git-<branch>-victor-ppw.vercel.app`.
- Password / SSO / trusted-IP protection all `enabled: false` → the preview URL opens on any phone without a Vercel login.
- Production stays at the current `main` deployment until Vic merges.
