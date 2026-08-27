# Designer — Attached Multi-Room (Sims build mode) · HANDOFF

**Brief:** `C:\Users\Victor\Documents\PPW-Second-Brain\code runner\DESIGNER-MULTIROOM-ATTACH-2026-08-26.md`
**Branch:** `feat/designer-multiroom-attach-2026-08-26` (off `main` = `c8c385d`)
**Started:** 2026-08-27
**Rule:** every phase gate is run verbatim and its output pasted below. A partial log is not proof.

---

## P0 — Baseline evidence ✅

Branch already existed at `main`'s HEAD with a clean tree (no prior commits on it); no re-create needed.

### Preconditions

```
$ git rev-parse HEAD          → c8c385de83920c10f936ede533cd3ea8af12803d
$ git rev-parse main          → c8c385de83920c10f936ede533cd3ea8af12803d
$ git rev-parse origin/main   → c8c385de83920c10f936ede533cd3ea8af12803d
$ git status --short          → (empty — clean)
$ node -v                     → v24.13.0
$ npm -v                      → 11.6.2
```

```
$ npx tsc --noEmit
TSC_EXIT=0        (clean)
```

```
$ npx vitest run
 Test Files  148 passed (148)
      Tests  1648 passed (1648)
   Duration  76.47s
[exited with code 0]
```

No flakes hit on this run — neither the tinypool worker crash nor the
`src/lib/__tests__/fx.test.ts` network-fallback timeout appeared.

### Baseline inventories (rule §2.2)

```
$ git grep -ho 'data-testid="[^"]*"' | sort -u | wc -l
133
```

**BASELINE TESTID COUNT = 133** (matches the brief's expected value).
**BASELINE TEST COUNT = 1648 across 148 files.**

### Dev server

`npm run dev -- --port 5187 --strictPort` → up in 2 s, `GET /designer` → 200.

> Note: `mcp__Claude_Browser__preview_start` could not be used — it resolves
> `.claude/launch.json` relative to the SESSION cwd (`C:\Users\Victor\memc`),
> not the repo. The repo's own `.claude/launch.json` `designer-dev` entry is
> correct and unchanged; the server was started directly via the same command.

### Before screenshot

`docs/multiroom-2026-08-26/before/two-room-fixture-1920.png` (1920×1080)

Captured with `tools/multiroom-shot-2026-08-26.mjs`, seeding `TWO_ROOM_FIXTURE`
(two rooms sharing the x = 5 m wall) through the zustand persist envelope.

**This shot IS the bug.** The TopBar reads `E2E Property · 2 rooms` and the rooms
trigger reads `Room 1 · 2` — the property genuinely holds both rooms — yet the
canvas renders exactly ONE 5 × 4 m room. Room 2 is invisible because
`designStore.projectFromProperty()` projects only the active room.
Console breadcrumbs: `(none)` — the `[multi-room]` breadcrumb does not exist yet.
Page errors: `(none)`.

**GATE P0: PASS.**

---

## P1 — `src/designer/roomLayout.ts` + truth-table tests ✅

New PURE module (D2). `src/lib/geometry.ts` untouched — every new helper
lives here and imports from it. Exports: `SNAP_TOL_M` (0.25) ·
`STRICT_EPS_M` (1e-4) · `isDrawnPolygon` · `translatePolygon` ·
`unionBounds` · `findRoomAt` · `strictPolygonsOverlap` ·
`snapVertexToRooms` · `nextRectanglePosition` · `unstackLegacyRooms`.

`isDrawnPolygon` is an addition beyond the brief's list — the
`polygon.length >= 3` predicate was going to be repeated in nine places
across five files, and one inconsistent copy is how a blank seed room
starts rendering. Logged here per rule §2.7.

### Gate

```
$ npx vitest run src/designer/__tests__/roomLayout.test.ts
 ✓ src/designer/__tests__/roomLayout.test.ts (33 tests) 10ms
 Test Files  1 passed (1)
      Tests  33 passed (33)
```

```
$ npx tsc --noEmit
TSC_EXIT=0        (clean)

$ npx eslint src/designer/roomLayout.ts src/designer/__tests__/roomLayout.test.ts tests/e2e/multiroom-helpers.ts
(no output — 0 errors, 0 warnings)
```

All the minimum cases the brief required are covered, plus the 0.13 m
overlap-strip case that the P5 e2e turns red on:

| Case | Expected | Result |
|---|---|---|
| Shared-edge rectangles | pass | pass |
| Shared single vertex | pass | pass |
| Interior overlap | REJECT | REJECT |
| **Identical stacked rectangles** | REJECT | REJECT (centroid probe) |
| **Snap-traced sub-rectangle** (all verts on host boundary) | REJECT | REJECT (centroid + midpoint) |
| Fully contained room | REJECT | REJECT |
| Edge crossing, no contained vertex (plus shape) | REJECT | REJECT |
| 0.13 m overlap strip (grid-snap-without-wall-snap) | REJECT | REJECT |
| `findRoomAt` shared-wall point, active first | active wins | ✓ both directions |
| `findRoomAt` falls back in array order | r1 | ✓ |
| `snapVertexToRooms` vertex over edge | vertex | ✓ |
| `snapVertexToRooms` output not re-grid-snapped | 5.13 ≠ 5.0 | ✓ |
| `nextRectanglePosition` flush-right | (5,0) / (9,0) | ✓ |
| `unstackLegacyRooms` items travel with rooms | +delta | ✓ |
| `unstackLegacyRooms` idempotent | same ref | ✓ |

**GATE P1: PASS.**

---

## P2 — Store routing + migration + guards ✅

### Changed

**`src/store/propertyStore.ts`**
- `addItem(item, roomId?)` — optional room target. Omitted → active room, so
  every pre-existing call site compiles AND behaves unchanged. Unknown id → no-op.
- `removeItem` / `updateItem` — now locate the owning room by scanning ALL
  rooms for the `instanceId` (new `findRoomByInstanceId` helper; ids are
  `nanoid(10)`, globally unique) instead of `getActiveRoom` only. Without this
  an item in a non-active room is visible but un-editable and un-deletable.
- `selectItemAcrossRooms(id | null)` — NEW. `null` → plain deselect with
  `activeRoomId` deliberately untouched (the Stage deselect paths pass null on
  every empty-space click). An id in another room → ONE atomic `set` carrying
  both the new `activeRoomId` and the selection, because a split
  `setActiveRoom` + `selectItem` loses the race against setActiveRoom's own
  selection-nulling.
- `addRectangleRoom(name, dims, anchor?)` — anchor translates the rectangle in
  the shared world frame; omitted → (0,0), i.e. today's behaviour exactly.
- `unstackIfLegacy()` — NEW action (D8), returns whether it changed anything.
- `selectItem` left ALONE (already a plain flat set, per the brief).

**`src/store/designStore.ts`**
- `setRoomDimensions` (D7a) rebuilds at the room's CURRENT `minX`/`minY`
  instead of `rectToPolygon`'s origin pin — the old behaviour teleported an
  attached room across the plan and through its neighbours on every L/W edit.
- `setRoomDimensions` (D7b) refuses outright, with a warn toast and no state
  change, when the resized polygon would overlap another room.
- `loadSnapshot` (D7c) refuses + `console.warn` when >1 drawn room exists.

**`src/App.tsx`**
- D8 one-shot mount effect. Uses the pure helper's reference-identity return
  as the cheap "is there anything to do?" check; when walls or floor-zones
  exist it only `console.warn`s and changes nothing (those are keyed in the
  same world frame but are NOT per-room, so moving rooms would strand them).

### Gate

```
$ npx tsc --noEmit
TSC_EXIT=0        (clean)

$ npx vitest run
 Test Files  149 passed (149)
      Tests  1701 passed (1701)
   Duration  32.91s
```

Baseline was 148 files / 1648 tests → **+1 file, +53 tests, 0 regressions.**
(33 roomLayout + 15 propertyStore + 5 designStore.)

```
$ npx eslint src/store/propertyStore.ts src/store/designStore.ts src/App.tsx \
    src/designer/roomLayout.ts src/store/__tests__/propertyStore.test.ts \
    src/store/__tests__/designStore.test.ts
ESLINT_EXIT=0     (0 errors, 0 warnings)
```

New store coverage: addItem back-compat / explicit-roomId / unknown-id no-op ·
removeItem + updateItem reaching a non-active room · selectItemAcrossRooms
atomicity, null-deselect keeping focus, same-room no-op · addRectangleRoom with
and without an anchor · unstackIfLegacy re-lay + items-travel + idempotence +
single-room no-op · setRoomDimensions corner-preservation, overlap rejection
(polygon unchanged + warn toast + neighbour untouched), shrink still allowed ·
loadSnapshot multi-room refusal and single-room pass-through.

**GATE P2: PASS.**

---

## P3 — Render all rooms (D3) ✅

All three source-pin test files were re-read before touching `RoomCanvas.tsx`.
Every pinned string survives verbatim — `setViewport((v) =>`,
`computeZoomScale(oldScale, e.evt.deltaY`, `width={Math.max(wPx - 8, 20)}`,
`useImageCache(productTopDownUrl(product))`, `addRoom({ name, polygon: newPolygon })`,
the `[draw-close]` reasons, and the `handleDrawCommit` negative pins (that
function is untouched until P5).

### Changed

**`src/designer/blueprintTheme.ts`** (additive only) — `ROOM_FILL_ACTIVE`
`#234156`, `ROOM_LABEL_ACTIVE_OPACITY` 0.9, `ROOM_LABEL_INACTIVE_OPACITY` 0.5.

**`src/components/RoomCanvas.tsx`**
- Subscribes `property.rooms` + `property.activeRoomId` directly; every
  existing `useDesignStore` subscription is kept for the active-room chrome.
- Room polygons: one `<Group name="room-poly" listening={false}>` per drawn
  room, same two `Line` nodes as before. `name="room-poly"` is load-bearing —
  the breadcrumb counts mounted nodes through it. Floors stay non-listening
  because the Stage commit handlers guard `e.target !== stage`, so a
  listening floor would swallow armed placement clicks.
- Grid: extracted `gridLinesForBounds(bounds, pxPerMetre)` and generate a
  line set PER ROOM inside that room's own clip. The old shared memo spanned
  only the active room's bounds, so reusing it inside another room's clip
  renders a blank grid.
- Labels: one per room, active/inactive opacity from the new tokens.
- Items: `<Group listening={!drawMode}>` wrapping `rooms.map → room.placedItems.map`,
  passing THAT room's polygon and items through the existing props.
  `PlacedItemGroup`'s body is untouched.
- `hasRoom` → property-wide (`drawnRooms.length > 0`); `items-placed` and
  `cost-readout` aggregate over all rooms; area readout stays the active
  room's (it pairs with the TopBar L/W inputs).
- Auto-centre: centres AND fits `unionBounds(rooms)` with
  `clamp(min((stageW-80)/unionW, (stageH-80)/unionH), 0.3, 1)`. It used to
  hardcode scale 1 with a 40 px min clamp, which pinned a wide union
  off-screen. `userMovedViewportRef` semantics unchanged.
- Repaint effect deps `[placedItems, drawMode]` → `[rooms, drawMode]`.
- `[multi-room] rendered=N` breadcrumb counting MOUNTED `.room-poly` nodes.
- Quick-rectangle: anchors flush-right; fills the active room when it is
  blank, else adds a new room. On a fresh canvas the anchor is (0,0), so
  this is byte-identical to today.

### Gate

```
$ npx tsc --noEmit          → TSC_EXIT=0 (clean)
$ npm run build             → ✓ built in 10.11s (clean)
$ npx vitest run            → Test Files 149 passed (149) · Tests 1701 passed (1701)
$ npx eslint src/components/RoomCanvas.tsx src/designer/blueprintTheme.ts \
      tests/e2e/multiroom-render.spec.ts tests/e2e/multiroom-helpers.ts
                            → ESLINT_EXIT=0
$ git grep -ho 'data-testid="[^"]*"' | sort -u | wc -l  → 133 (baseline held, none dropped)
```

```
$ PPW_E2E_BASE_URL=http://localhost:5187 npx playwright test multiroom-render
Running 2 tests using 2 workers
  ok 2 [chromium-desktop] › multiroom-render.spec.ts:70:3 › start prompt stays hidden when a BLANK room is active beside drawn rooms (5.8s)
MULTIROOM_RENDER=true
  ok 1 [chromium-desktop] › multiroom-render.spec.ts:32:3 › draws every room on one canvas (6.1s)
  2 passed (7.0s)
```

Machine assertions, all four:
1. `[multi-room] rendered=2` — MOUNTED Konva node count (listener registered before goto).
2. Gold pixel span = 900 px ± 12 across the two-room union. A single-room
   render spans ~500 px, so this cannot pass on the old behaviour.
3. `items-placed` = `2` with one item seeded in each room.
4. Third fixture variant (two drawn rooms + blank `r3` ACTIVE):
   `start-room-prompt` count 0. This variant is what makes the assertion
   falsifiable — the old active-room-only `hasRoom` shows the prompt over a
   two-room plan on exactly this payload.
5. Screenshot: `docs/multiroom-2026-08-26/after/render-two-rooms.png`.

### Visual evidence (not a gate — read from the shot)

Both rooms render on one plan, sharing the gold wall at x = 5 m. ROOM 1
(active) carries the lifted floor and the brighter label; ROOM 2 is the base
fill at 0.5 label opacity. Each room has its own grid. Badge `2`, cost
aggregated to 58,000 MUR, zoom readout 100 % (the union fit clamps to
scale 1 at 1920×1080, as the helper's screen-mapping assumes).

⚠ **One visual note for Vic (NOT changed — `ROOM_FILL_ACTIVE` is a spec'd
decision under §4/D3, so it is implemented as written).** `GRID_LINE`
`#2B4254` sits very close to `ROOM_FILL_ACTIVE` `#234156`, so the 0.5 m grid
is markedly fainter inside the ACTIVE room than inside the inactive ones —
visible in the after-shot. Since the active room is where placement actually
happens, that is the one room whose snap grid most needs to read. One-line
remedy if Vic wants it: lift `GRID_MAJOR_OPACITY` / `GRID_MINOR_OPACITY` for
the active room only, or darken `ROOM_FILL_ACTIVE` a step. Flagged, not
actioned.

**GATE P3: PASS.**

---

## P4 — Point-routed placement + cross-room selection (D4 + D5) ✅

### Changed — `src/components/RoomCanvas.tsx`

- `placeAtRoomPoint` routes through `findRoomAt(point, rooms, activeRoomId)`.
  Rooms + activeRoomId are read via `usePropertyStore.getState()` INSIDE the
  callback — the memoised callback does not re-create on a store change, so a
  captured `rooms` would be stale the instant a room is added. `rooms` is
  correspondingly NOT in the deps array, which also keeps the callback
  identity stable for the wiring effects that depend on it.
  `target === null` → haptic + warn toast + return false.
  `resolveWallAwarePlacement` / `validatePlacement` / `findFreeSlot` all
  receive the TARGET room's polygon and items.
- Commit goes through `usePropertyStore.getState().addItem(item, target.id)`.
  The `designStore` facade signature is untouched; RoomCanvas simply stops
  subscribing to the facade's `addItem` (noted inline where it was).
- `computeGhost` makes the IDENTICAL `findRoomAt` call, so ghost validity can
  never disagree with the commit. Outside every room it renders an invalid
  ghost at the cursor rather than previewing a drop that would be rejected.
- `placementIntent === 'center'` routes BY INTENT to the ACTIVE room's own
  bounds centre — never through `findRoomAt`. The mobile "+ Add to room"
  contract is "into the room I'm looking at".
- Selection bound to `usePropertyStore.selectItemAcrossRooms` — both as the
  `selectItem` prop passed into `PlacedItemGroup` (the bound VALUE changes,
  the facade does not widen) and after a placement commit.

### Gate

```
$ npx tsc --noEmit             → TSC_EXIT=0 (clean)
$ npx eslint src/components/RoomCanvas.tsx  → ESLINT_EXIT=0
$ npx vitest run               → Test Files 149 passed (149) · Tests 1701 passed (1701)
```

```
$ PPW_E2E_BASE_URL=http://localhost:5187 npx playwright test multiroom-placement
Running 2 tests using 2 workers
  ok 1 › a drop inside the ACTIVE room still lands there (single-room path unchanged) (5.3s)
ROOM_ROUTE=true
  ok 2 › a drop inside a NON-active room lands in that room and moves focus (6.1s)
  2 passed (7.0s)
```

With r1 ACTIVE, an armed click at world (7, 2) — inside r2 — asserted
immediately from localStorage: `r2.placedItems` +1, `r1.placedItems`
untouched, `activeRoomId` flipped to `r2` (D5 moved focus), and the item's x
inside r2's walls. Then `Escape`, then a drop at world (−1, −1): total
unchanged at 1, and the "outside the plan" toast visible.

**Single-room regression — the existing suite, unchanged:**

```
$ PPW_E2E_BASE_URL=http://localhost:5187 npx playwright test placement-fsm wall-aware-placement
Running 4 tests using 4 workers
  ok 2 › placement-fsm › click catalog card to arm, click floor to commit → items-placed = 1 (4.1s)
  ok 3 › placement-fsm › Escape during armed phase cancels without committing (5.3s)
  ok 4 › wall-aware-placement › drops near each wall auto-orient into the room and sit flush (6.0s)
  ok 1 › wall-aware-placement › manual R rotation during armed phase overrides auto-orientation (6.9s)
  4 passed (7.9s)
```

**GATE P4: PASS.**

---

## P5 — Draw-attach (D6, atomic) ✅

Everything below is ONE commit. The two wipe stages live in different files
and removing only one still destroys rooms (entry-clear alone → the commit
loop massacres; loop alone → entry wipes items).

### Changed

**`src/store/historyStore.ts`** — NEW `abortDrawTransaction()`. Lifts
suppression, POPS the entry frame `beginDrawTransaction` pushed WITHOUT
applying it, rebaselines, and calls `writeSessionFrames(newPast)` so the
`sessionStorage 'ppw_history_top10_v1'` mirror tracks the pop. That last call
is required, not decorative — the P5 gate reads that mirror, so without it a
CORRECT implementation false-fails. Safe no-op when no transaction is active.

**`src/App.tsx`** — `setDrawMode(true)` keeps `beginDrawTransaction` and
DELETES all four clears (`clearActiveRoomItems` / `clearWalls` / `clearZones`
/ `clearTreatments`), adding `usePropertyStore.getState().selectItem(null)` in
their place. `setDrawMode(false)` calls `abortDrawTransaction()` instead of
`endDrawTransaction()`. The `useWallTreatmentStore` import went with the
clears.

**`src/components/RoomCanvas.tsx`**
- `handleDrawCommit`: `removeRoom` loop and the redundant `setActiveRoom`
  DELETED. Overlap check runs FIRST (`strictPolygonsOverlap` vs every drawn
  room) → toast + `[draw-close] rejected-overlap` + reset vertices + STAY in
  draw mode, before anything is mutated. On pass: blank ACTIVE room → fill it
  (`setRoomPolygon` + `renameRoom`); else the existing
  `addRoom({ name, polygon: newPolygon })` call, verbatim. Then
  `endDrawTransaction()` explicitly, THEN `onDrawComplete()`.
- `handleDrawCancel`: body is now just `onDrawComplete()`. The old global
  `undo()` would, with the wipe gone, revert the user's last REAL action.

**`src/lib/useKeyboardShortcuts.ts`** — while `isDrawTransactionActive()`,
undo/redo (Ctrl+Z, Ctrl+Shift+Z, Ctrl+Y) AND every selection-mutation key
(R, `<`, `>`, D, Delete, Backspace) no-op. `RoomDrawMode`'s own Ctrl+Z
interceptor is UNTOUCHED — it already yields when vertices are empty, which
is exactly why the post-commit single Ctrl+Z still reaches the global handler.

**`src/components/RoomDrawMode.tsx`** — `getRoomPoint` now snaps to existing
room geometry FIRST and returns a CLEAN `{x, y}` (any extra key would
JSON-persist into `Room.polygon`); grid-snap only when nothing is in range,
and a snapped point is never re-grid-snapped. The snap KIND is computed
separately in `handleMove` and attached only to the hover value (new exported
`HoverVertex` type). Rooms read via `getState()` INSIDE the handler so the
`:211` wiring effect gains no deps. A gold ring (`8 / viewport.scale`,
`WALL_GOLD_BRIGHT`) renders at a snapped hover. `RoomDrawHUD` untouched.

**`src/components/AddRoomChooser.tsx`** — rectangle path gets the SAME branch
as quick-rect: active room blank → `setRoomPolygon` in place at the
`nextRectanglePosition` anchor + `renameRoom`; else
`addRectangleRoom(name, dims, anchor)`. Copy updated.

**`src/components/TopBar.tsx`** — Custom-shape title →
"Draw a room — attaches to existing rooms, walls snap together".

### Sanctioned source-pin rewrite (rule §2.5)

`RoomDrawMode.test.ts` :309–330 pinned the OLD always-add-new-room contract
that this phase deliberately replaces. Rewritten as documented:
- KEPT the positive `addRoom({ name, polygon: newPolygon })` pin (it survives
  in the else branch) and the `[draw-close]` diagnostics pins.
- DELETED `not.toMatch(/setRoomPolygon\(/)` and
  `not.toMatch(/placedItems\.length\s*===\s*0/)` — `setRoomPolygon` inside the
  commit body is now REQUIRED (blank-fill), so those pins asserted the
  opposite of the new contract.
- ADDED positive pins for the overlap reject
  (`strictPolygonsOverlap(newPolygon, r.polygon)` + `reason: 'rejected-overlap'`),
  the blank-fill branch, a negative pin that `removeRoom(` never returns, and
  `endDrawTransaction()`.
- `addRoom` KEPT in the useCallback deps — the test's body-extraction regex
  requires `[addRoom`.

  ⚠ **One deviation from the brief's wording, logged per §2.7.** The brief
  said to pin the blank-fill branch on `polygon.length < 3`. The implementation
  uses the shared `isDrawnPolygon()` helper (which IS `polygon.length >= 3`)
  rather than an inline copy, so the pin is
  `/!isDrawnPolygon\(active\.polygon\)/` — the same contract, pinned on the
  code that actually exists.

Also ADDED a new `App source - draw mode no longer destroys the canvas`
describe: the four entry clears are gone, `beginDrawTransaction` +
`selectItem(null)` remain, and the exit branch aborts rather than ends. The
entry-clear deletion had no source-level guard at all before this.

The other two source-pin files (`roomCanvasRenderBind.test.ts`,
`customer-ui-fixes-2026-05-31.test.ts`) are UNTOUCHED and green.

### Gate

```
$ npx tsc --noEmit          → TSC=0 (clean)
$ npm run build             → ✓ built in 8.57s (clean)
$ npx vitest run            → Test Files 149 passed (149) · Tests 1716 passed (1716)
$ npx eslint <11 changed files>  → ESLINT=0
$ git grep -ho 'data-testid="[^"]*"' | sort -u | wc -l  → 133 (baseline held)
```

```
$ PPW_E2E_BASE_URL=http://localhost:5187 npx playwright test multiroom-attach
Running 4 tests using 4 workers
  ok 2 › the FIRST draw on a fresh blank canvas fills the seed room (4.3s)
  ok 1 › phantom-frame check, behavioural: a visit to draw mode does not eat a Ctrl+Z (4.7s)
  ok 4 › an OVERLAPPING draw is rejected and the plan is untouched (4.7s)
DRAW_ATTACH=true
  ok 3 › a drawn room attaches on an exact shared wall and destroys nothing (5.7s)
  4 passed (6.8s)
```

All seven required assertions:
1. Seed = ONE drawn room OFF-GRID (east wall x = 5.13) + 1 item; wall store
   empty (`ppw_walls_v1` — note it is a hand-rolled BARE ARRAY, not a zustand
   persist envelope).
2. Entering draw mode leaves item count AND room count unchanged — the wipe
   is gone.
3. Four vertices drawn with the left edge within SNAP_TOL_M of x = 5.13 →
   persisted `rooms.length === 2`, room 2's west edge x **=== 5.13 exactly**,
   room 1's polygon AND items deep-equal unchanged.
4. ONE Ctrl+Z → `rooms.length === 1`, item still there.
5. Phantom-frame, BOTH ways: (a) session-mirror count before draw-entry ===
   after Esc; (b) behavioural — place an extra item (badge 2), Escape, visit
   draw mode, Esc, then ONE Ctrl+Z drops the badge back to 1.
6. An overlapping draw is rejected: room count unchanged, polygon untouched,
   "can't overlap" toast visible.
7. Fresh-blank-canvas as a SEPARATE `test()` with only the coach-flag init
   (no fixture seed — `addInitScript` re-runs on every navigation, so
   clear-and-reload inside a seeded test just re-seeds) → first draw yields
   `rooms.length === 1`, blank seed FILLED not orphaned.

### Adversarial verification of the snap assertion

A passing test proves nothing unless it can fail. Wall-snap was temporarily
disabled (`getRoomPoint` forced down the grid-snap path) and the spec re-run:

```
  x  1 › a drawn room attaches on an exact shared wall and destroys nothing (3.4s)
    Expected length: 2
    Received length: 1
    Received array:  [{"id": "r1", ... "polygon": [{"x":0,"y":0},{"x":5.13,"y":0},{"x":5.13,"y":4},{"x":0,"y":4}]}]
```

Exactly the predicted chain: the vertex grid-snapped to 5.0, that opened a
0.13 m overlap strip, `strictPolygonsOverlap` rejected the commit, and
`rooms.length` stayed 1. Both the snap AND the overlap predicate are proven
load-bearing, not passing by accident. The probe was then fully removed
(`grep -c FALSIFY_SNAP_PROBE` → 0) and the spec re-run green.

**GATE P5: PASS.**

---

## P6 — Full regression + push ✅

### The one real problem this phase found, and what it turned out to be

The first full-suite run came back **11 passed / 1 failed**:
`wall-aware-placement › manual R rotation during armed phase overrides
auto-orientation`. It had been 4/4 at P4, so this was investigated properly
rather than re-run until green.

**It was not a flake.** It failed deterministically in the 5-spec run, at
`--workers=1` as well as in parallel, and passed deterministically when the
file ran alone. Pairwise bisection showed it failed alongside ANY second
spec — including `placement-fsm`, which this change never touches.

The failure snapshot showed my own P4 toast: *"Drop it inside a room — that
spot is outside the plan."* So `findRoomAt` returned null: the click landed
outside the room.

Three hypotheses were tested and **falsified** before the real one was found:
CPU throttling to 8× did not move the origin; arming a product does not
resize the stage (1920×942 before and after); and it was not concurrency
(it fails serially too).

Reproduced with a harness that opens N warm-up contexts in the same browser
first. At **PRELOADS=2** the spec's `roomOrigin()` returns `{x:5, y:61}`
instead of `{x:711, y:327}` — the room's **un-centred** position. The spec
reads the origin once, immediately after `start-quick-rectangle`, and under
load that scan beats the auto-centre effect's paint.

**Then the decisive test: the same harness against `main`.**

```
--- MAIN PRELOADS=2 ---
origin : {"x":5,"y":61}          <-- identical bogus origin
store  : items:[{... x:0, y:0, rotation:180 ...}]   <-- but it PLACES
```

So:
1. **The race is pre-existing** — `main` produces the identical bogus origin.
   Nothing in this change caused it.
2. **The old code masked it.** Every click used the ACTIVE room's polygon
   regardless of where it landed, so `findFreeSlot` rescued the out-of-room
   point and dumped the item at the room's **top-left corner** — `x:0, y:0`.
   The test's `y ≈ 0` assertion passed *because of the corner dump*, not
   because the wall snap worked.
3. Attached multi-room routes a drop to the room actually under the pointer
   and rejects a drop outside every room (D4, and P4's own gate asserts the
   rejection). That is specified behaviour, so the stale origin stopped
   being papered over.

**Fix: the spec's SETUP, not any assertion, and not the app.** The origin
read moved to after arming — the same "re-read before every click sequence"
rule the sibling `placeAt` helper in that very file already follows and
documents. Verified at PRELOADS 2/3/4: origin `{711, 327}` every time, and
the item now lands at **`x:1.5, y:0`** — a genuine wall snap positioned by
the click, where `main` gave `x:0, y:0`. The assertion is *strengthened*, not
weakened: `y ≈ 0` now actually verifies the wall snap.

Changing the app to keep rescuing out-of-room clicks was considered and
rejected: it contradicts D4 outright and would fail P4's gate.

Stability after the fix — **12/12 on three consecutive runs**, parallel and
serial:

```
=== parallel run 1 ===  12 passed (14.1s)
=== parallel run 2 ===  12 passed (14.8s)
=== serial (workers=1) === 12 passed (33.8s)
```

### Gate

```
$ npx tsc --noEmit                                   → TSC=0 (clean)
$ npx vitest run   → Test Files 149 passed (149) · Tests 1716 passed (1716)
$ npm run build                                      → ✓ built in 9.11s (clean)
$ npx eslint <20 changed .ts/.tsx files>             → ESLINT=0
```

```
$ PPW_E2E_BASE_URL=http://localhost:5187 npx playwright test \
    wall-aware-placement placement-fsm multiroom-render multiroom-placement multiroom-attach
ROOM_ROUTE=true
DRAW_ATTACH=true
MULTIROOM_RENDER=true
  12 passed (14.1s)
```

Testid inventory, diffed against `main` (not just counted):

```
$ git grep -ho 'data-testid="[^"]*"' main | sort -u   → 133
$ git grep -ho 'data-testid="[^"]*"'      | sort -u   → 133
DROPPED: (none)
ADDED:   (none)
```

### After-shots

Six captures, all with `pageerrors: (none)`, via
`tools/multiroom-shot-2026-08-26.mjs` (now self-calibrating: it derives the
viewport scale from the on-screen span of a known world width, because below
1024 px the whole-plan fit clamps scale under 1 and a fixed
`origin + world × 100` mapping puts the clicks in the wrong place).

| Shot | Result |
|---|---|
| `fixture-1920x1080.png` | both rooms, shared gold wall, `rendered=2` |
| `fixture-390x844.png` | both rooms, fit to 34 %, `rendered=2` |
| `placement-1920x1080.png` | item routed into r2 (the NON-active room) |
| `placement-390x844.png` | item added to r1 — the ACTIVE room, correctly |
| `attach-1920x1080.png` | second room committed at `minX = 5.13` |
| `attach-390x844.png` | draw mode with room + item INTACT, snap ring visible |
| `render-two-rooms.png` | the P3 spec's own artifact |

### Two honest mobile findings (both reported, neither faked)

**1. Cross-room POINTER routing is a desktop flow by design.** Below 1024 px
there is no pointer ghost at all: tapping a catalog tile opens
`mobile-product-popup` → `popup-add-to-room`, which publishes a placement
INTENT. Per D4 an intent routes to the ACTIVE room's centre by design
("into the room I'm looking at"). Verified by probe: after a mobile tap
`[data-armed="true"]` count is **0**. So `placement-390x844.png` correctly
shows the item landing in r1, and the mobile shot is NOT a cross-room
routing demo — because that is not a mobile flow in v1.

**2. Drawing an attached room on a phone is very constrained in v1.** The
viewport auto-fits the EXISTING plan, so a new room drawn beside it extends
off-screen: at 390 px, world x = 9 maps to page x = 574 on a 390 px-wide
canvas, and those clicks are simply not on the canvas (measured). Drawing
BELOW instead is also tight — the mobile catalog is
`lg:hidden fixed bottom-0` with **top = 636 px**, so it covers the lower
canvas and leaves roughly a **70 px band** under the room. Reaching anything
further needs pan/zoom INSIDE draw mode, which **D9 lists as out of scope for
v1**. The mobile attach shot therefore captures draw mode entered with the
plan intact and the snap ring on the shared wall, and stops short of a
commit rather than pretending one happened. Not a defect in this change —
but if Vic wants draw-attach to be usable on a phone, draw-mode pan/zoom is
the thing to unpark.

### Visual note (evidence, not a gate)

At 390 px the `empty-room-hint` card ("Your room is empty") is large relative
to the fitted plan and covers most of both rooms — visible in
`fixture-390x844.png`. It is `pointer-events-none` so it never blocks a tap,
and it disappears on first placement. Pre-existing card, newly noticeable now
that the whole plan is fitted smaller. Flagged, not actioned.

**GATE P6: PASS.**

---
