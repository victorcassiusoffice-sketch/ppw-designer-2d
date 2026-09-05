# Handoff — Sims world (2026-08-29)

Branch `feat/sims-world-2026-08-29` off `main` @ `040a9f6`.
Findings: `00-FINDINGS.md`. Plan: `01-PLAN.md`. Captures: `after/`.
**Not merged, not deployed to `designer.ppwellness.co`** — Vic tests on the Vercel preview URL
and merges when satisfied (see "Deploy" at the bottom).

## Status against Vic's brief

| # | Ask | State |
|---|---|---|
| 1 | Snap to walls broken (horizontal ok, vertical not); no corners; ratio 100 % accurate | **DONE** — inner-face flush (edge + 0.05 m) on every wall, two-wall corner snap, along-wall clamp, slide-to-free-slot keeps the flush face, drag keeps rotation, rotate about the centre; art cropped to its content box and mapped onto the real footprint |
| 2 | Walls stop where they want, don't have to join; joined walls still confirm a room | **DONE** — one wall pen: closed run → room (as before), open run → free-standing walls (Finish walls / Alt+Enter / Enter with 2 points) |
| 3 | Change the unit mid-draw (0.5 → 0.1), "+1" shortcut, mobile-friendly | **DONE** — HUD stepper [−] 0.5 m [+] on desktop and phone, `+`/`−` step the unit while drawing, `[` `]` any time, digits 1–6 unchanged |
| 4 | Place things outside rooms; several buildings + gardens | **DONE** — every level has an Outdoors container; drops outside any room land there, snap to the outside face of building walls, collide with buildings + free walls |
| 5 | Land measurements lock scale + capacity | **DONE** — Land popover locks a W × D plot: rooms, walls and items must stay inside; capacity readout (plot m², built m², %) |
| 6 | Dashboard to match the reference plans | **DONE** — cream paper, charcoal poché walls with cast shadow, quiet grid, centred small-caps room labels, building dimension lines, plot boundary + label, greenery, light pools |
| 7 | Light feature when a light is added | **DONE** — lighting products cast a warm pool; L key / Details button / cluster ☼ switch it off and on; 3 demo lights seeded (floor lamp, pendant on the ceiling band, wall sconce) |
| 8 | Check everything works, to scale, Sims UX, unlimited floors | **DONE** — Floors popover adds/renames/removes storeys (PageUp/PageDown), floor below ghosted, rooms/items/walls per level; full unit suite + Playwright suite re-run (numbers below) |
| 9 | Keep off the public domain; deploy to GitHub/Vercel | **DONE** — branch pushed; Vercel git preview URL, no deployment protection; production untouched |

## Commits

| SHA | What |
|---|---|
| `d493827` | the whole build (placement core, ratio, model, draw tool, TopBar, theme, catalog, docs) |
| `022fdc5` | toasts moved off the wall-pen HUD while drawing; journey probe tool |
| _(see `git log`)_ | e2e repair + new `sims-world.spec.ts` coverage |

## How the model changed (all inside `property`, no API change, 12/12 functions untouched)

```
Property.levels?[{id,name,index}]  activeLevelId?   walls?: FreeWall[]   site?: {widthM, depthM, originM}
Room.levelId? (absent = ground)    Room.kind?: 'room' | 'outdoor'
PlacedItem.lightOn? (absent = on)
```

- Wall thickness is a world constant `WALL_THICKNESS_M = 0.1`; walls are stroked centred on the
  polygon edge and items flush to the **inner face** (`WALL_HALF_M = 0.05`).
- Legacy interior walls (`wallStore`, mm, `ppw_walls_v1`) are migrated onto `property.walls` on
  the first mount and the legacy key is emptied. The old wall tool UI is retired; `+ Walls` and
  `Draw` both open the same pen.
- `normaliseLoadedRoom` / `normaliseLoadedProperty` whitelist every new field (round-trip tests in
  `propertyStore.test.ts`). Persist key stays `ppw_property_v2` / version 2.

## Verified root causes of the snap complaint (17 confirmed by adversarial verifiers)

1. Placement flushed to the polygon EDGE while the 10 px wall band is centred on it → every
   "flush" item overlapped 5 cm of wall.
2. Only ONE wall was ever snapped; the perpendicular axis was grid-snapped → corners only when
   `(wall − extent)` happened to be a grid multiple (never, for a 0.95 m treadmill on 0.5 m).
3. The along-wall snap could push past the room end → `validatePlacement` failed → `findFreeSlot`
   re-snapped BOTH axes and the item left the wall. Which axis broke depended on the room, hence
   "works horizontally but not vertically".
4. Dragging a 90/180/270° item mid-room reset it to 0°.
5. `rotateSelected` pivoted at the AABB top-left → flush items refused to rotate.
6. Rotate-handle pivot mixed scaled and unscaled px → wrong angle at zoom ≠ 100 %.
7. Wall-item drag/duplicate hard-coded 0.5 m.
8. The 5 demo products shipped 1024² art on non-square footprints → contain-fit drew a 40 × 40
   blob on a 120 × 40 table (the "ratio" complaint). Art is now cropped to its content box and
   filled / back-anchored; the demo JPEGs were matted to alpha PNGs.

## Gates

- `npx tsc --noEmit` — clean.
- `npx vitest run` — **2199 passed / 169 files** (+ `keyboardShortcuts.test.tsx` repaired; it had
  been loading Konva via a Konva-importing helper).
- `npm run build` — clean (the >500 kB chunk warning is pre-existing).
- eslint — 0 errors on every changed file (one pre-existing `react-refresh` warning in
  `HelpOverlay.tsx`, untouched rule).
- Journey probe (`tools/sims-world-probe-2026-08-29.mjs`, real Chromium on the dev server):
  corner drop → (0.05, 0.05); right wall → x = 4.40 at rot 90; outdoor drop → Outdoors container;
  outside-face snap → x = 5.05 rot 270; L toggles `lightOn`; two free walls at exact metres; `+`
  steps 0.5 → 0.25 m mid-draw; new floor + room on it + PageDown; off-plot drop refused; 0
  console errors.
- Playwright (local dev server, `PPW_E2E_BASE_URL=http://127.0.0.1:5188`, `--grep-invert auto-dig`):
  **125 tests → 87 passed / 0 failed / 38 skipped**, run twice back-to-back with identical
  outcomes. Every skip is env-gated and carries the command that runs it (`NO_API_SKIP` → prod
  URL, `GEOM_BRIDGE_SKIP` → dev server, `VITE_TEST_HOOKS=1`, `PPW_E2E_*` knobs); 4 are the
  pre-existing unconditional `test.skip` in `design-tweak-1-phase-a0`. Seven passes that were
  vacuous on localhost (k1-critical-paths hitting production instead of the branch; two
  wellness A.API probes accepting vite's 404/SPA fallback) now skip honestly.
  - Repaired for the paper theme + inner face: `wall-aware-placement` (inner-face values, corner
    case, left wall, band invariant), `geom-bridge` (charcoal literal; scan agrees with the
    bridge within 1 px), `surface-wall-items`, `drag-place` (teal/terracotta ghost; off-room drop
    now lands outdoors, refusal re-pinned on a second blocked drop), `multiroom-placement`,
    `door-openings` (dark-pixel predicate: 341 wall rows → 259 after the door),
    `flooring` (paper floor light, rubber floor dark-red), `multiroom-render` (span 898 px),
    `multiroom-attach`, `customer-journey`, `wall-draw` (rewritten for the wall pen: open run →
    2 free walls persisted; Esc → nothing; closed run → room), `units` (open run at 1 cm),
    `phase-0-acceptance` f + `phase-5-journey` step 3 (legacy `ppw_walls_v1` → `property.walls`
    migration), `clear-button` (Clear all empties `property.walls`), `design-tweak-1` +
    `mobile-sims-toolbar` (10 catalog tabs).
  - NEW `tests/e2e/sims-world.spec.ts` (7/7): corner + inner-face flush, rotation kept on drag,
    outdoors + locked plot refusal, free walls + undo, unit stepper + keys, levels, light toggle +
    pool node.
  - Evidence screenshots the specs write: `test-results/sims-world-*.png`,
    `wall-aware-placement.png`, `surface-wall-items.png` (wiped by every Playwright run — copy
    out if needed).

## Traps for whoever picks this up

- `Room.levelId` is ABSENT for ground-floor rooms (old saves stay byte-identical). Always read it
  through `roomLevelId()`; never compare to `'ground'` directly. Free walls DO store `'ground'`.
- The Outdoors room has `polygon: []`. Everything that filters `isDrawnPolygon` skips it
  automatically; anything that lists rooms for the user must filter `isOutdoorRoom`.
- `ROOM_BORDER_SCAN` is now `{ max: 50, minAlpha: 200, inset: 5 }` (charcoal). Every colour that
  reaches the canvas must keep one channel ≥ 50 (`roomBorderScanGuard.test.ts`). Two
  `ECO_FLOORING_CATALOG` hexes (`#1A1A1A`, `#2E2E2E`) are quarantined by that test — lighten them
  when that palette is next touched.
- The toast stack moves to the top while a draw is in flight; anything else that wants the
  bottom-centre band during a draw will collide with the HUD.
- `contentBoxForImage` needs a real 2D canvas — no jsdom coverage; the Playwright pass is its test.
- Items saved edge-flush by the old build (y = 0) are not migrated; they overlap the wall band by
  5 cm until re-dragged.

## Deploy — PREVIEW ONLY (Vic's instruction: the public keeps the current site)

- Pushed `feat/sims-world-2026-08-29` → `origin` (`git ls-remote` = local `022fdc5`).
- Vercel's git integration built it as a **preview** deployment (`target: null`,
  `dpl_mz3oHkp74tsMmE7SX6XNsaV4e83n`). Production stayed on `040a9f6` (`main`).
- Branch URL (stable across pushes to this branch):
  `https://ppw-designer-2d-git-feat-sims-world-2026-08-29-victor-ppw.vercel.app/designer`
- Verified live: cache-busted `GET /api/healthcheck` →
  `{"ok":true,"env":"preview","commit":"022fdc5a…"}` (4th poll, first 3 were the build page).
- Playwright against the PREVIEW (`tools/sims-world-shot-2026-08-29.mjs`, `preview/` captures):
  1920 / 1366 / 390, plan + wall pen + first floor — 12 items, 2 free walls, 2 levels, the plot
  capacity readout, `+` stepping the unit to 0.25 m — **0 console errors** at every viewport.
- Deployment protection is OFF on the project, so the URL opens on any phone without a Vercel login.
- Nothing here was merged or promoted. When Vic is satisfied: merge the branch to `main` (or open
  the PR GitHub offered on push) and production deploys as usual; the branch preview keeps
  updating on every further push meanwhile.

## Deliberate cuts

- Doors on FREE walls (openings are still room-edge only).
- Deriving rooms from a wall graph when a run closes against an EXISTING room's wall (a run must
  close on its own first point to become a room). Documented as the next step if Vic wants it.
- Regenerating the wall-mirror art as a true top-down strip — wall items now draw as plan bars.
- Re-indexing level names after a mid-stack delete (names can skip a number; ids stay stable).

## Follow-ups (same day, after Vic tested the preview)

Three more asks, all on the same branch, commits `3e6c612` + `4eb403b` (pushed; `git ls-remote`
= local HEAD `4eb403b`).

### 1. "The draw wall is forcing a full circuit"

- Any run of 2+ points is now KEPT as free walls on every exit: Esc, the toolbar toggle, the
  HUD's **Done**. **Discard** is the only exit that throws points away. Closing on the first
  point still makes a room (**Make room** / **Room + next**).
- `src/lib/wallPen.ts` → `keepOpenRunAsWalls(vertices)` (plot check, active level, toast);
  wired in `App.setDrawMode` (transaction ends instead of aborting) and `RoomDrawMode` Escape.
- Found on the way: the HUD's Discard button had no `pointer-events-auto` inside the
  `pointer-events-none` HUD, so a mouse could never click it. Fixed.
- e2e: `wall-draw.spec.ts` "two points then Esc KEEPS the wall" (Esc · toggle · Discard).

### 2. "The Sims lets you drag and duplicate flooring so it fits tight"

- `src/designer/flooringLattice.ts`: a flooring product (category `flooring`) snaps to its OWN
  lattice — pitch = the tile footprint, origin = the first tile of that product in the room,
  else the inner wall corner (`WALL_HALF_M`). Used on drop, ghost and drag-end in `RoomCanvas`
  (flooring skips the wall-aware resolver and the 0.5 m grid).
- Duplicate (D / cluster ⧉) lands exactly one tile away: right, below, left, above
  (`adjacentTileSlots`). New **Fill floor** (`details-fill-floor`, `cluster-fill-floor`) lays
  every free whole cell in one undo frame (`fillFloorWithSelected`, `fillLatticeInside`).
- Paint floor reaches the phone: hamburger menu row (toggle · 5 materials · brush scope) and an
  on-canvas **Paint floor on · Done** chip (`floor-paint-hud`) that switches back to the hand.
- Proof: 12 EVA tiles at x 0.05/1.05/2.05/3.05 × y 0.05/1.05/2.05 in a 5×4 room (captures
  `after-followups/tiles-*.png`); unit tests `flooringLattice.test.ts` (6);
  e2e `sims-flooring.spec.ts` test 3.

### 3. "Adding the floor / full room floor cover does not calculate the cost"

Two real causes, both fixed:
- The room **Floor** finish picker wrote `room.floorFinish` but `roomFloorOrders` only priced
  PAINTED zones. `floorTiles.ts` → `wholeRoomFinishOrder(room)`: tileables by polygon coverage
  (whole + cut + 10 % cut surplus), rolls by area + waste. Painted zones still win when present.
  Unit tests `floorFinishOrder.test.ts` (7).
- `CartStrip` returned `null` while `totalItemCount === 0` — product count only — so a
  floor-only design showed no cart at all. Now gated on products OR floor lines, lists floor
  lines (units to order, "+n for cuts", unit, line), pill count = items + floor units. The
  on-canvas cost badge now reads `useCart().subtotal` (products + floors), not products only.
- Proof: painted 5×4 room = 20 tiles → cart `0 unique - 0 placed - 20 floor units`, £526.67,
  badge `527 GBP` (`after-followups/painted-floor-cart-desktop-1366.png`);
  e2e `sims-flooring.spec.ts` tests 1 + 2 (paint path and finish-picker path, incl. clearing).

### Gate (this run, dev server 127.0.0.1:5188)

tsc 0 · eslint 0 on every touched file · vitest **2218/2218** · `npm run build` clean ·
Playwright **124 passed / 0 failed / 38 env-gated skips** (full suite) · captures
`tools/sims-flooring-shot-2026-08-29.mjs` → `after-followups/` with **0 console errors**.
Historical PNGs the spec runs overwrite (`docs/designer-build-2026-08-28`,
`docs/multiroom-2026-08-26`) were restored with `git checkout --` before committing.

### Preview

Same branch URL; still preview-only, nothing merged or promoted.
- Verified live: cache-busted `GET /api/healthcheck?cb=…` on
  `ppw-designer-2d-git-feat-sims-world-2026-08-29-victor-ppw.vercel.app` →
  `{"ok":true,"env":"preview","commit":"4eb403bf23781ff49c7cc22dfc802873f0113860"}` (6th poll,
  2026-08-29T13:06Z; polls 1–5 still served `3e6c612`). Production (`designer.ppwellness.co`)
  untouched.

## Corner snap (Vic, evening 2): "doesn't align horizontally flush to the wall, only vertical" — commit `7eaeea2`

**Reproduced with 320 real drag rows** (desktop mouse, phone mouse, phone CDP touch; both products;
rot 0/90; 0.5 m + 0.1 m units — table in `audit-2026-08-29b/snap-repro-table.json`). With the drop
CENTRE 0.2 m off a wall (the spec's definition) every wall and corner flushed, 192/192. With the
REALISTIC gesture — bring the item's current EDGE to ~0.2 m of the wall — 24/64 desktop rows failed,
always on the two walls perpendicular to the item's current long axis: a landscape treadmill (rot 0)
failed on LEFT + RIGHT, a portrait one (rot 90) on TOP + BOTTOM. That is exactly "horizontal no,
vertical yes" and why corners were unreachable (the first flush never happened).

**Root cause** (`wallAwarePlacement.ts` engage test; 3/3 adversarial verifiers, 6/6 refuted the two
rotate hypotheses as the *cause*): each wall was scored with the object's depth AFTER auto-orient
(its short side) while the user drags it at its CURRENT facing. Treadmill 2.05 × 0.95 against the left
wall: centre 1.225 m in, backGap = 1.225 − 0.475 = 0.75 > `WALL_SNAP_GAP_M` 0.45 → free-standing grid
snap → x = 0 (5 cm INSIDE the wall band), no rotation; the same push on the top wall engaged at touch.

**Fix** — `resolveWallAwarePlacement` engages on min(oriented gap, current-extent gap) (ordering by the
oriented gap is unchanged, so every prior spec still holds); an EXISTING item pushed into a corner keeps
the wall it already faces as primary (the corner never spins it); free-standing drops are clamped inside
the inner faces (no x = 0, no "Out of room bounds." bounce near the far wall); `insideInnerFaces()`
guards rotate; **R / the rotate handle re-seat through the resolver pivoting on the wall faces the item
touches** (a corner item turns IN the corner — before, R popped it 0.55 m off the second wall and 5 cm
into the first, and the handle committed an angle with no position check at all); axis tolerance `<=`
(an edge exactly 1e-4 off-axis was "slanted" and refused drops); the dock hover card hides while a
product is armed (it swallowed the bottom-right corner placement click).

Proof: `wallAwarePlacement.test.ts` 54/54 (8 new) · `snap-edge-drag.spec.ts` 4/4 (new: left, right,
corner + R in the corner, far-wall clamp) + wall-aware-placement / sims-world / placement-fsm /
multiroom-attach = 19/19 on the dev server.

## Toolbar redesign (Vic, evening 2): "make the toolbars more user-friendly and aesthetic" — commit `bc958dd`

**Audit** (`audit-2026-08-29b/`, 27 before-PNGs + `audit-data.json`, vault design skills applied): 62
visible controls on a 1920 screen at rest, 26 of them in one 56 px bar; 53 at 1366; 38 on the phone,
57 with the menu open. Three P0s found by probing, not by eye: the wall-pen HUD's Undo/Done/Make
room/Discard row sat UNDER the fixed phone toolbar (elementFromPoint returned the toolbar); the phone
hamburger menu was 1305 px tall in an 844 px viewport with no max-height — Save as, Load, Request
quote, Help, Grid, Currency, New unreachable; at 1366 the Rectangle|Draw segment was flex-shrunk to
9 px so Draw was invisible and unclickable. Beyond those: five accent hues, three visual registers on
one phone screen, 12 control heights / 6 radii, four "floor" words (Floors · Floor · Paint floor ·
FLOORING), the same pen exposed twice, eight labels wrapping at 1920, 9 px text, several pairs under
4.5:1, a dead `bg-ppw-clay` class that made the Erase label vanish.

**Contract** (`blueprintTheme.ts` `CHROME_*` + `tailwind.config.js` `ppw.{paper,chrome,rail,rim,
charcoal,inkDeep,gold,navy,clay}`): paper ground · hairline rim · charcoal ink; pressed / tool-on =
ink fill + paper text everywhere; ONE call-to-action colour (gold, Request quote only); terracotta only
as a destructive rim/icon; mint = the armed-product ring in the docks only (Vic's shop-match decision,
kept). 40 px desktop / 44 px phone / 48 px sheet rows; bar 52 / 56; radius 8 (12 popovers/sheets);
Inter, nothing under 11 px; every text pair ≥ 4.5:1 (1508 pairs measured, 0 failures).

**What changed** (17 files; every `data-testid` and `aria-label` kept, +4 new; handlers untouched;
RoomCanvas diff is DOM-only — Konva core untouched):
- Desktop bar: one 52 px row in five groups — Identity (brand · `<property> · <room>` trigger) · Build
  (Walls · Door · Paint · Measure, segmented) · Room & plan (Box | Custom radiogroup · Finish · Storeys
  · Plot) · View (Snap · Grid · 3D · Undo · Redo) · Commerce (Currency · Cart · n · Request quote ·
  More: New · New plan · Save as… · Load · Shop · Help). 18 controls instead of 26. Door options move to
  a sub-bar only while the door tool is on; the L × W inputs live in a Box popover at every width (were
  2xl-only); every dropdown is a portaled popover with Esc + outside-click and proper roles.
  Tiers measured at 768/820/1024/1280/1366/1536/1920: nothing clipped, all tools hit by
  `elementFromPoint`; at 1366 Box/Custom/Finish/Storeys/Plot/Snap keep their labels.
- Phone: 56 px strip [brand · room · Walls · menu]; full-height portaled sheet (Build · Room & plan ·
  View with the six snap units as one segmented row · Plan files · Shop, sticky gold Request quote) —
  every row reachable, Esc closes, focus managed, toolbar under the scrim; catalog toolbar on the dock
  skin (navy/gold gone); wall-pen HUD compact (137 px), clears the toolbar (which auto-minimises while
  drawing), publishes `--draw-hud-h` so the room re-fits ABOVE it; touch taps no longer drop two
  vertices (tap + compatibility click deduped, 4 taps → 4 vertices proven); toasts above the Clear row
  and below sheets; Clear buttons read "Products" / "Clear all".
- Canvas overlays (Reset · Share · Capture one row; one readout chip; cost badge hidden while the cart
  pill shows the same total; `formatCurrency` everywhere), details panel (clears dock + pill, ink buy
  CTA), cart pill/sheet (phone table fits, subtotal footer always visible), currency (charcoal FX dot),
  selection cluster, product popup, toasts, plans strip, help launcher — all on the same recipe.
- Vocabulary: Floors→Storeys, Floor→Finish, Paint floor→Paint, Land→Plot, Rectangle|Draw→Box|Custom,
  "+ Walls"→Walls; help panel + coach copy updated. Wall-pen instruction shown once (HUD), not three times.

**Gate** (this run): tsc 0 · eslint 0 · vitest 2226/2226 · `npm run build` clean · Playwright full suite
**128 passed / 0 failed / 38 env-gated skips** (3 workers; a 6-worker run shows 4 `page.goto` timeouts
that pass in isolation — dev-server load, not app) · probes above · 0 console errors. Captures:
`toolbar-2026-08-29/` (gate-*, gate2-*, polish-*, finish-*).

**Deliberate / open**: mint accent on the docks kept (Vic's call to change); Finish/Storeys/Plot are
icon-only at 1280–1365 (labels from 1366); the selection cluster can overlap the details panel at
820 px tablet width; product popup + details show native MUR beside the bar currency (pre-existing);
the dev-only build stamp stays on the dev server. Vic gates unchanged: nothing merged or promoted.
- Verified live: cache-busted `GET /api/healthcheck?cb=…` on the branch preview →
  `{"ok":true,"env":"preview","commit":"bc958dd97ad8c587785fb4a26104d1a22e3414db"}` (7th poll,
  2026-08-29T16:58Z). Production (`designer.ppwellness.co`) untouched.

## The Floor tool (Vic 2026-08-31): "floor should not be called paint … applying the floor doesn't function"

Reproduced first (40 journeys, preview + dev, `floor-2026-08-29/`): the paint MECHANISM worked, but the
palette popover covered 17 % of the auto-centred room — the natural first click hit the palette's
Erase button (silently arming Erase, which then made every later click erase an empty floor) with zero
feedback; on the phone the stroke was bound to mouse events only (a tap worked via browser compat
events; a touch drag laid nothing) and there was no Erase and no Finish at all; and three disconnected
floor concepts (Paint brush · Finish picker · catalog Flooring items — the same six K1 SKUs twice).

**Now there is ONE tool, named "Floor"** (words Paint/Painted/Finish/Brush retired from the surface):
- Desktop: the Floor button (labelled from 1366) opens a **docked right panel** — never over the room
  (rect-intersection asserted 0 at 1280/1366/1536/1920; the canvas re-fits via `--floor-panel-w` and
  the Reset/Share/Capture row slides with it). Panel: active room name · all six materials with photo
  swatch, size and converted price · scope **Tile | Room** (Room fills the active room immediately) ·
  Erase · Clear floor · a live "n tiles · £x" line · hints · Done. Shift = fill, Ctrl = erase remain.
- Phone: menu sheet row + materials; the tool then shows a bottom HUD card (photo swatch · name ·
  live count/cost · Change · Tile · Fill room · Erase · Done); the stroke is on POINTER events so
  tap = tile and one-finger **touch drag = area**; the catalog toolbar auto-minimises; the room
  re-fits above the card; toasts stack above it.
- The Finish picker is merged: `setRoomFloor` is authoritative (one floor per room), `fillRoomFloor`
  lays a tileable material as a full-cover zone (rolls become the area-priced finish),
  `clearRoomFloor` empties both. A Tile stroke on a roll floor is refused with a hint.
- Catalog: the six floor SKUs are **Floor cards** — tapping arms the Floor tool with that material
  (badge "Floor", never placed as items); the two loose mats stay placeable with the lattice.
- Presses over placed items lay floor under them; room lookup is storey-filtered; the empty-room card
  no longer covers a floored room; dark floors flip the room label to paper.

**Per-material lay check** (Vic: "some products doesn't lay properly") — all six PASS: origin anchored
to the room's inner corner, zero gap/overlap pixels across tile borders, committed counts equal the
pitch expectation (0.92 / 1.0 / 0.5), previews match commits, one material per tile on overlap, roll →
whole-room finish. Table in the gate output; captures `floor-2026-08-29/gate-*.png`, `polish7-*.png`.

**Gate**: tsc 0 · eslint 0 · vitest 2232/2232 · build clean · full Playwright **129 / 0 / 38** ·
0 console errors · contrast 0 failures · all referenced testids present (retired Finish ids removed
from specs in the same pass).

## Doors — analysed, fixes queued (see `doors-2026-08-31/00-FINDINGS.md`)

Desktop mouse placement is exact (≤5 mm; no zoom/pan error). Confirmed defects queued as the next
round (same files as the Floor build, so sequenced after it): touch commits 4× (place+remove nets
zero — touch can never place a door) · no door tool on the phone · a stale-transform race right after
enabling the tool can put the door on the WRONG WALL · CCW-drawn rooms swing every door outward (no
winding normalisation) · no hover preview via the door tool · storeys ignored · shared-wall facing
defaults to the first room · window keeps door width. The Sims reference model + adopt/adapt table is
in the findings file.

## Door fixes shipped (2026-08-31, same day as the analysis)

All nine findings from `doors-2026-08-31/00-FINDINGS.md` are fixed and gated:
- **Touch**: the commit lives on ONE pointer path (Stage `onPointerUp`, per-gesture guard, 10 px tap
  slop) — a tap places exactly one door; the remove scan ignores an opening placed < 300 ms ago so
  place-then-remove can no longer net to zero; a deliberate second tap still removes.
- **Phone**: Door row in the menu sheet + a bottom HUD card (Door · Doorway · Window kind chips with
  their trade widths, a width readout, Flip side · Flip hinge · Done, 44 px targets).
- **Race**: the click maps through the stage transform read AT EVENT TIME and the canvas re-fit runs
  synchronously when the tool arms — a click 100 ms after arming lands on the clicked wall.
- **Winding**: `canonicaliseRoomGeometry` normalises every polygon to CW at draw-commit, load and a
  new persist-merge hook, remapping openings EXACTLY (edgeIndex' = n−1−i, offset' = length−offset,
  both flips toggled; world-space gap + swing proven equal to 1e-9 in 21 new unit tests) — a
  hand-drawn counter-clockwise room now swings its doors into the room.
- **Hover preview** shows with the bare door tool (branch hoisted above the armed-product guard).
- **Storeys**: the hover/remove scan is level-filtered; also fixed the level-blind load-time
  un-stacker that shredded stacked storeys into an attached layout.
- **Facing**: `flipFacing` defaults per placement to the cursor's side of the host wall (shared wall:
  click from room B → swings into room B); the toggles override. A click exactly ON the wall line
  keeps the inward default (strict `< 0` — the check caught `<= 0` flipping it outside).
- **Window** arms 1.2 m; each kind chip arms its trade width. Positional `edgeIndex` lookups replaced
  with `.find(e => e.index === …)` in store + canvas.
- Repeat toasts coalesce ("Door added ×3"); the empty-room card hides while the door tool is on.

Gate: tsc 0 · eslint 0 · vitest **2259/2259** (21 new winding + un-stacker tests) · build clean ·
full Playwright **136 / 0 / 38** incl. the extended `door-openings.spec.ts` (hover preview, storey
filter, shared-wall facing, window width, CCW room) and the new `door-touch.spec.ts` · probes: on-line
click → `flipFacing:false` inward, width chip 0.84 m → 1.2 m, toasts "Door added ×3" · 0 console
errors. Captures `doors-2026-08-31/fix-*.png`, `gate-fix-*.png`. Preview verification line below.
- Verified live on the branch preview: cache-busted healthcheck →
  `{"ok":true,"env":"preview","commit":"898a1fa987783dceba0a666e42515e41679f165f"}` (5th poll,
  2026-08-31T10:28Z). Deployed smoke on that build: on-the-line top-wall click → edge 0, offset 2.5,
  `flipFacing:false` (inward); a click from Room 2's side of the shared wall → hosted on Room 1
  edge 1 with `flipFacing:true` (swings into Room 2); a phone touch tap places exactly ONE door that
  persists and a second tap removes it; width chip 0.84 m; 0 console errors. Production untouched.

---

## Round 8 (2026-09-02) — Sofap wall-paint tool + 2.5D wall lift — commit `652bbef`

Vic: "add walls and wall paint calculating cubic to size, pull something from
Sofap in Mauritius … 5 different paint products … it automatically goes a bit
more 3d … only when they select walls, any other feature goes back to the 2d."

**Shipped (all preview-verified at `652bbef`):**

- `src/data/wallPaints.ts` — 5 REAL Sofap (Permoglaze) products, researched
  2026-09-02 from live MU listings (sofaponlinestore.mu WooCommerce Store API,
  EcoMauritius, IME Distributors; source URLs in the file): Matt Emulsion,
  Soft Feel, Xtreme White, Aquashield (1/20 L only — no live 5 L price),
  Anti-Fungus. Datasheet spread-rate midpoints, 1/5/20 L tins, MUR prices.
  Default wall height 2.7 m (MU slab ceilings ~2.6–2.9 m), customer-set
  2.0–4.0 m.
- `src/designer/wallPaintCalc.ts` (+9 unit tests) — length × height − door
  (w×2.04 m) / window (w×1.2 m) openings → litres (× coats ÷ coverage, up to
  0.1 L) → cheapest whole-tin fill by exact enumeration.
- Stores: `Room.wallPaint[]`, `FreeWall.paintId`, `Property.wallHeightM` with
  all three load-normaliser whitelists carried; actions paintWallEdge /
  paintRoomWalls / paintFreeWall / setWallHeight; UI store `wallpaint` tool +
  persisted `wallPaintDraft.paintId` (units.spec envelope updated).
- Canvas: click paints a wall (0.6 m snap, slop-guarded one-pointer path),
  Room scope paints the room, Erase strips, hover highlight; **2.5D lift**
  (`.wall-faces` Konva group) — extruded faces with plaster/paint colour,
  door/window gaps, top caps, cutaway stubs — ONLY while wall pen / wall
  paint armed; Select or any other tool drops back to flat 2D, objects stay
  top-down. Phone HUD card (`wallpaint-hud`) with live m²·L·cost.
- TopBar: roller BUILD button, docked 272px panel (5 paints, wall-height
  input, Wall/Room scope, Erase/Clear, live line, Done), phone sheet rows,
  `ppw:open-menu {section:'wallpaint'}`.
- Money: `WallPaintLine`s in cartStore (subtotal split), CartStrip rows +
  tin count, CartDrawer group, CartPage section + subtotal, Checkout display
  + OrderLine rows carrying the tin breakdown; wall-paint-only ≠ empty cart.

**Gate:** tsc 0 · eslint touched 0/0 · vitest 2276/2276 (176 files) · build
clean · Playwright **157 passed / 0 failed / 38 env-gated skips** incl. new
`wallpaint.spec.ts` (6/6). Captures: `wallpaint-2026-09-02/`. Deployed proof:
healthcheck poll = `652bbef`; 10/10 live interaction smoke (desktop+phone,
2.5D on/off, live line "48.6 m² · 10.8 L · £30.22"); 2 seeded money tests
green against the preview /cart + /checkout.

**Still open (unchanged):** object top-down rendering backlog
(`objects-topdown-2026-08-31/`, FINDINGS "STILL OPEN").

---

## Round 9 (2026-09-03) — objects-topdown CLOSED (34 MB → 1.6 MB) — commit `e2b0b66`

The STILL OPEN item ("objects render as blank labelled boxes") is closed.
Root cause was ASSET WEIGHT, not the Konva render path: 41 committed product
images totalled 34.0 MB (EPDM roll top-down 4.6 MB, NordicTrack 1.7 MB), so
a cold preview load sat in fallback/skeleton for many seconds with an empty
catalog dock — dev reads from disk and always looked fine.

Fix: every referenced topdown/photo → max-640px WebP (total 1.58 MB;
NordicTrack 1704 KB → 14 KB), products.json repointed, originals kept on
disk (URL revert = rollback). seedImagery API enrichment follows the seed
automatically. Confirmed by-design: wall items (shelf/mirror/sconce) draw
plan BARS; the 6 imageless lamp/garden items draw plan symbols.

Pinned by `tests/e2e/objects-topdown.spec.ts` (3): 7 `.item-art` nodes +
2 wall bars in the nine-product evidence scene, symbols for imageless,
all dock thumbnails loaded from .webp. Gate: tsc 0 · vitest 2276/2276 ·
build clean · Playwright 160/0/38. Deployed proof: healthcheck = `e2b0b66`,
CDN serves image/webp, all 3 tests green AGAINST THE PREVIEW (full art in
<3 s on a cold context). Evidence: `objects-topdown-2026-08-31/
after-fix-desktop-1366.png` vs the original blank-box captures.

---

## Round 10 (2026-09-04) — eco / solar onboarding: roof, panels, energy readout

Vic: "start implementing onboarding for ecological facilities such as solar
panels … calculate the output and sun in Mauritius … when a person adds
something electronic it calculates the output of the electric device … show if
the solar panel is sufficiently providing enough power for the current
electrical products on the canvas or even outside the room … how much energy
is surplus or lacking … these obviously need to be on a roof, as such when
selecting solar panels a roof with the roof surface measured at room scale can
automatically pop up, additionally a roof button … user friendly and not
clutter the designer … pull real Mauritius products from Solaire / Emcar /
Suntricity / Solar Center — these are also the companies worth onboarding."

**Research first** (one 23-agent workflow, 4 shops each with an adversarial
verifier, 4 brands, 4 science lanes; every price, spec, image and URL
re-fetched the same day). Headline: **only Emcar publishes prices** — the
other three are quote-only. Full record + merchant contacts:
`eco-solar-2026-09-04/01-MERCHANTS.md`.

**Shipped:**

- **The sun** — `src/data/mauritiusSolar.ts`: PVGIS 5.3 / SARAH3 (2005–2023)
  for Tamarin, three tilt cases with monthly PSH. Default = 20° north,
  5.17 kWh/m²/day, PR 0.775, 1462 kWh/kWp/yr. (PVGIS 5.2 rejects the point as
  "over the sea"; azimuth 0 is SOUTH — both recorded in the file.)
- **The algorithm** — `src/designer/solarCalc.ts` (12 tests): generation
  Wp × PSH × PR, load W × h, net, coverage %, panels-to-cover, battery
  autonomy, inverter peak check, annual bill effect. Reproduces PVGIS's own
  annual yield to within 1 %.
- **The model** — `src/designer/energy.ts` (12 tests) classifies every
  product as generator / storage / inverter / consumer / none and sums the
  whole plan across every level AND outdoors;
  `src/data/applianceLoads.ts` (9 tests) is a 36-row sourced fallback table
  (Harvia, Titan, Peloton, Concept2, Apple, ENERGY STAR, PNNL) so a treadmill
  with no published watts still counts — self-powered gear is 0 W explicitly.
- **The roof** — a single `roof` level always on top (`levels.ts`), slabs that
  mirror the storey beneath as Rooms of `kind: 'roof'` (`roof.ts`, 13 tests,
  idempotent + stable slab ids), rebuilt on every room change
  (`useRoofSync.ts`). Arming a panel POPS THE ROOF; a **Roof button** toggles
  roof ↔ top storey; the wall pen, door, paint and measure tools refuse the
  roof with a toast; PageUp/PageDown walk onto it.
- **Roof placement** — panels snap on the tile lattice (`usesTileLattice`
  now covers flooring AND roof products), so Duplicate lands flush and Fill
  carpets the slab; off-slab drops are refused ("Nothing floats off the roof").
- **The Eco tab** — new `solar` category + Eco macro tab + icon; **8 priced
  Emcar products** seeded with real MUR prices, datasheet dimensions and
  640 px WebP art (products.json 33 → 41).
- **The readout** — ONE canvas chip (`energy-readout`, hidden until something
  electrical or a panel exists) opening a docked 272 px Energy panel on md+
  (same dock and `--floor-panel-w` inset as Floor / Wall paint, never both
  open) or the phone sheet's Energy section. Shows sun vs use per day, the
  surplus/shortfall, "add N panels" to close a gap, panels-not-on-the-roof,
  battery autonomy, inverter check, every consumer with a per-item on/off and
  hours, and one honest line naming the PVGIS assumption. Per-item controls
  also in the Details panel.
- **Merchant side** — migration `0029_products_energy.sql` (+ rollback,
  **authored not applied**, gated by `ENERGY_DB_COLUMNS` exactly like 0027),
  drizzle columns, API select + create schema, adapter mapping (W/Wh on the
  wire → kWh/kW on the Product), four new fields on the merchant add-product
  form, and `src/lib/energySpecs.ts` (14 tests) + `scripts/scrape-energy-specs.ts`
  which read "1.5 kW" / "450 Wp" / "5 kWh" off a merchant page with context
  scoring and keep the page snippet as evidence.

**NOT in this round:** the **stairs** feature Vic asked for. Stairs link two
levels (run below, void above) and touch the level model, placement, render
and the export — own round, flagged rather than faked.

**Gate:** tsc 0 · eslint 0 errors on every touched file (the 5 warnings are
pre-existing at HEAD, verified) · vitest **2357/2357 (182 files)** ·
`npm run build` clean · full Playwright **165 passed / 0 failed / 38
env-gated skips** incl. the new `eco-solar.spec.ts` (5/5) · captures
`tools/eco-solar-shot-2026-09-04.mjs` → `eco-solar-2026-09-04/` with **0
console errors** at 1366 and 390. Measured live: 4 panels on the slab at the
lattice pitch (0.05/1.953 × 0.05/1.184), chip "☀ 7.6 kWh · ⚡ 0 Wh"; a
treadmill + bike + lamp = 435 Wh/day, peak 420 W, status **short** with "Add
1 × 450 Wp panel"; six panels → **covered**, +11.0 kWh/day.

**Trap that cost a red spec:** the dock thumbnails are `loading="lazy"`, so
with 41 products the off-screen tail reports `img.complete === false` while
already decoded. `objects-topdown.spec.ts` now asserts `naturalWidth > 0`
(which is what "no blank tiles" means) instead of `complete`.

Detail: `eco-solar-2026-09-04/` — `00-PLAN-AND-STATUS.md`, `01-MERCHANTS.md`,
`02-ALGORITHM.md`, `03-FINDINGS.md` (decisions + what is open for Vic).

---

## Round 11 (2026-09-05) — the wall pen on a phone: four defects

Vic, testing the pen on his phone: "I needed to zoom out and move over but the
wall draw was still active and made me draw random walls · when I pressed
select tool i could not select the walls to delete · Select toolbar should
still be available on main screen rather than only burger menu · wall pen
toolbar at the bottom has some space underneath, all toolbar should minimise
space to maximise canvas."

**Reproduced first** with real touch at 390 x 844 (raw CDP multi-touch —
Playwright's `touchscreen` is single-point):

| Symptom | Measured before |
|---|---|
| Pinch to zoom | HUD `0 pts` → `1 pts` — the pinch planted a wall point |
| One-finger drag to move | `1 pts` → `2 pts` AND the viewport never moved |
| Select a drawn wall | 1 wall before, 1 after, no selection UI |
| Select on the phone strip | absent (menu only) |
| Space under the pen card | 68 px of dead band |

**Root causes:** the pen commits on Konva `tap`/`click` with no gesture guard
(Floor / Door / Wall-paint each drop their gesture when a second finger lands;
the pen never did); the Stage is not draggable in draw mode, so one finger
panned nothing and the release planted a point instead; free walls render
`listening={demolish}`, so they are only hit-testable with the sledgehammer;
and the pen card reserved 56 px for a Clear row that `App` hides while drawing.

**Fixed:** a single gesture contract for the pen (a pan or pinch raises a veto
that `RoomDrawLayer` honours, cleared at the start of the next gesture — never
on read, because a touch reaches the Stage twice); one finger pans past a
10 px slop, two fingers now pan as well as zoom (the pinch centre used to be
frozen at touch-start); mouse drags over 12 px are not vertices either; free
walls are pickable with Select and show a card with their length, Delete and
Done (Del/Esc/empty-tap all behave); Select added to the phone strip; the pen
card sits on the toolbar with tighter padding.

**Measured after:** pinch 0 points (still zooms 0.62 → 0.30), one-finger drag
0 points and the view moves, three taps still give three points, gap under the
card **68 px → 8 px**, Select picks a wall reading **3.50 m** and Delete takes
2 walls to 1, 0 console errors.

**Two regressions my own fix introduced, both caught and fixed before commit:**
every tap after the first was swallowed (the mouse-slop test was comparing a
tap against the compat `mousedown` of the PREVIOUS tap — caught by the repro,
3 taps → 1 point), and the new wall card landed on top of "Products / Clear
all" and the help launcher (caught by looking at the screenshot).

**Gate:** tsc 0 · eslint 0 on touched files · vitest **2361/2361** · build
clean · Playwright **171 passed / 0 failed / 38 env-gated skips** incl. the new
`wallpen-mobile.spec.ts` (6/6). Detail + before/after captures:
`wallpen-mobile-2026-09-05/`.

**Deployed proof** — preview healthcheck `bfa3fad` (4th poll), then the same
touch repro run AGAINST the preview (the dev geom bridge does not ship, so the
wall midpoint is mapped through the live Konva transform): pinch 0 points,
one-finger drag 0 points with the view moving (x 120 → 232), three taps → 3
points, gap under the card 8 px, Select on the phone strip, the card reads
3.50 m and is clear of the help launcher, Delete takes 2 walls to 1, **0
console errors**. Captures: `wallpen-mobile-2026-09-05/preview/`.
