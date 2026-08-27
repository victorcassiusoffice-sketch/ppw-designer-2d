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
