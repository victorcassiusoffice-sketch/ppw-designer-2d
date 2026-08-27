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
