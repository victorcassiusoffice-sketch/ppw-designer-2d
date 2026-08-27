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
