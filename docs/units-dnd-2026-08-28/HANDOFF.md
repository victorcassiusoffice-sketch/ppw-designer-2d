# Designer — Selectable Units + Editable Lengths + Sims Drag-Drop

Brief: `PPW-Second-Brain/code runner/DESIGNER-UNITS-AND-SIMS-DND-2026-08-28.md`
Branch: `feat/designer-units-and-dnd-2026-08-28` off `main` = `8a41eab`
Vic decisions: Q1 = Y (lift `PlacedItemGroup` protection for both) · Q2 = refuse-and-keep-in-hand, hand empties, Shift stamps · Q3 = 0.1 m floor.

---

## P0 — Baseline evidence

Measured on this branch at `8a41eab`, before any edit. These are the numbers every later
phase is diffed against — not numbers lifted from an older document.

| Baseline | Value | Command |
|---|---|---|
| Unit tests | **1837 passed / 157 files**, 0 failed | `npx vitest run` |
| Typecheck | clean, exit 0 | `npx tsc --noEmit` |
| Unique testids | **145** | `git grep -ho 'data-testid="[^"]*"' \| sort -u \| wc -l` |
| Prod live commit | `8a41eab2e1a2cea214051cf8a25272c0cb58c248` | cache-busted `/api/healthcheck` |

Note: the prior brief's testid baseline of 133 is **stale** — the doors/flooring/pages work
merged at `c512997` added twelve. 145 is the floor from here.

---

## P1 — U1: unit ladder, A/B toggle, persistence, dead-code removal

**Done.**

- `src/store/designerUIStore.ts` — `SnapPrecision` widened to the six-unit ladder
  `'cm1' | 'cm10' | 'quarter' | 'full' | 'm1' | 'm10'`, keeping the existing `full`/`quarter`
  member names so `designerUIStore.test.ts` needed no rewrite. `PRECISION_STEP_M` widened to
  `{cm1:0.01, cm10:0.1, quarter:0.25, full:0.5, m1:1, m10:10}`. Added `SNAP_UNIT_ORDER`,
  the explicit-never-derived `SNAP_UNIT_LABEL`, and `currentSnapStepMm()` for the mm-space
  wall tools. Default stays `'full'` (0.5 m) — V-GAME-3 holds for anyone who never picks a unit.
- A/B swap (D2): added `lastPrecision` (init `'quarter'`); `togglePrecision` swaps the pair;
  `setPrecision(p)` records the outgoing unit and no-ops when `p` is already current.
- Persistence (D1): store wrapped in `persist` under its OWN key `ppw_designer_ui_v1` v1,
  `partialize` returning **both** unit fields. `ppw_property_v2` is untouched — no version
  bump, no `partialize` edit, so the five e2e sites that hardcode `version: 2` are unaffected.
- Digits 1–6 (D2): added to `useKeyboardShortcuts.ts` **above** the existing `switch (e.key)`,
  guarded `!ctrlKey && !metaKey && !altKey`. `isTypingTarget` already early-returns for
  INPUT/TEXTAREA/SELECT/contenteditable, so digits cannot hijack the length fields P5 adds.
- Dead-code removal (D3): `git rm` on `src/designer/useGridSnap.ts` + its test. Re-verified
  dead before deleting — `grep -rn "useGridSnap\|SNAP_STEP_MM" src tests` excluding the module
  itself returned **zero** hits. It exported a second function literally named `snapToGrid`
  with a different unit and signature from the real one; leaving it invites a future builder
  to edit the orphan and report the feature done with zero behaviour change. Recoverable from
  git history at any time.
- Test hygiene (blocker A7): `lastPrecision: 'quarter'` + a guarded
  `localStorage.removeItem('ppw_designer_ui_v1')` added to the `beforeEach` in all three
  consumer test files. The guard is `typeof localStorage !== 'undefined'` because
  `designerUIStore.test.ts` runs in the **node** environment, not jsdom — an unguarded call
  threw `ReferenceError` and took 12 tests down on the first gate run.

### P1 GATE — all four parts

```
$ npx vitest run designerUIStore keyboardShortcuts geometry wallStore FloatingCluster
  Test Files  5 passed (5)
       Tests  110 passed (110)

$ npx tsc --noEmit
  exit 0

$ grep -rn "useGridSnap\|SNAP_STEP_MM" src tests | wc -l
  0

$ npx eslint <5 changed files>
  exit 0, 0 errors
```

Integer-mm invariant test added and passing: every ladder step is a whole number of
millimetres (10/100/250/500/1000/10000). Load-bearing because
`wallStore.detectClosedRoomVertices` matches endpoints by exact `${x_mm},${y_mm}` string
equality — a fractional-mm step would silently stop closing rooms rather than throwing.

### Full-suite accounting after P1

```
$ npx vitest run
  Test Files  156 passed (156)
       Tests  1836 passed (1836)
```

1837 − **7** (the deleted `useGridSnap.test.ts`, count confirmed with
`git show HEAD:src/designer/__tests__/useGridSnap.test.ts | grep -c "^\s*it("`) + **6** new
= 1836. Exact, no silent losses.

**Deliberate non-work in P1:** no UI, no call-site threading. The store is widened but the
step still reaches only product placement — wall drawing, room drawing, the visible grid and
the item drag-end are all still on their own hardcoded 0.5 m. That is P2.

---

## P2 — U2: thread the step into every snap call site

**Done.** P1 widened the table; this is the phase that makes picking a unit actually change
what the tool draws.

- `roomLayout.ts` — two new exported pure helpers, `wallSnapTolM(stepM)` = clamp(step/2,
  0.05, 0.25) and `closeThresholdM(stepM)` = clamp(step*0.8, 0.15, 0.4). `SNAP_TOL_M` and
  `CLOSE_THRESHOLD_M` both stay exported and unchanged as the defaults/ceilings. **Both
  helpers return exactly today's constant at a 0.5 m step**, which is what keeps the
  off-grid 5.13 m fixture in `multiroom-attach.spec.ts` behaviourally identical.
- `RoomDrawMode.tsx` — `currentSnapStepM()` is read **inside** each handler (grid branch of
  `getRoomPoint`, `snapHitFor`'s tolerance, both close-threshold sites). Deliberately NOT an
  effect dep: the wiring effect's own comment warns that store deps there tear down and
  re-attach every Stage handler on each room mutation. Wall-snap still runs first and its
  output is still never re-grid-snapped.
- `wallStore.snapToWallEndpointOrGrid` — widened **additively** to `(point, walls, stepMm =
  WALL_SNAP_MM)`, with the endpoint magnet clamped to [50, 250] mm. `WALL_SNAP_MM` and
  `ENDPOINT_TOLERANCE_MM` are untouched and still exported, so `wallStore.test.ts`'s
  `expect(WALL_SNAP_MM).toBe(500)` needed no edit. `WallDrawMode.tsx` passes
  `currentSnapStepMm()`.
- `RoomCanvas.tsx` — `findFreeSlot` now receives `step: Math.max(snapStep, 0.5)` (D15). The
  floor matters: the call passed no step before, so it defaulted to 0.5; `Math.max` keeps the
  cost byte-identical at every unit instead of quadrupling it at fine ones.

### The protected-body breach — exactly as authorised, audited

Vic lifted the `PlacedItemGroup` freeze on 2026-08-28 for an enumerated list. Every changed
line inside `RoomCanvas.tsx` this phase:

| Line | Change |
|---|---|
| `PlacedItemGroupProps` | `+ snapStep: number;` (+ a doc comment) |
| destructure | `+ snapStep,` |
| render site | `+ snapStep={snapStep}` |
| drag resolver | `- snapStep: 0.5,` → `+ snapStep,` |
| `resolveDragTarget` call | `+ snapStep,` |
| `placeAtRoomPoint` (OUTSIDE the protected body) | the `findFreeSlot` step floor |

No algorithm moved. The `placed-hit` Rect and `width={Math.max(wPx - 8, 20)}` were not
touched. **The three protected files — `geometry.ts`, `wallAwarePlacement.ts`,
`imageFit.ts` — have zero diff against `8a41eab`**, confirmed by `git diff --stat`.

### P2 GATE

```
$ npx vitest run wallStore roomLayout RoomDrawMode customer-ui-fixes roomCanvasRenderBind
  Test Files  5 passed (5)      Tests  102 passed (102)      <- all source pins hold

$ npx vitest run                     # full suite
  Test Files  156 passed (156)  Tests  1836 passed (1836)

$ npx tsc --noEmit                   # exit 0
$ npm run build                      # built in 7.38s, clean
$ npx eslint <5 changed files>       # 0 errors (4 baseline WallDrawMode react-refresh warnings)

$ PPW_E2E_BASE_URL=http://localhost:5187 npx playwright test \
    units multiroom-attach wall-draw wall-aware-placement placement-fsm
  12 passed (10.3s)
```

### The new gate is PROVEN falsifiable

`tests/e2e/units.spec.ts` was run against a deliberately sabotaged build (the grid branch of
`getRoomPoint` reverted to the hardcoded `GRID_STEP_M`, i.e. the "widened the store but never
threaded it" build):

```
Expected: 6.47
Received: 6.5
    > 140 |     expect(westX).toBeCloseTo(6.47, 6);
  1 failed
```

The sabotage was reverted with `git checkout` immediately after and the suite re-run green.
This matters because the obvious assertion — "every vertex is a whole number of centimetres" —
**passes on a completely untouched build**, since 0.5 is itself an exact multiple of 0.01
(brief blocker A3). The wall assertion is falsifiable by construction for the same reason:
the segment is 1.37 m, and 1370 is not a multiple of 500, so a build still snapping to
`WALL_SNAP_MM` would land both endpoints on the 500 lattice and their difference could not
be 1370.

Both specs derive px-per-metre from the canvas's live Konva transform via the `__ppwGeom`
dev bridge rather than assuming 100, so the click aim cannot silently drift if a fixture
changes size and the auto-centre fit re-clamps the scale.

### Still outstanding after P2

The units engine is complete and proven, but there is **no UI to select a unit yet** — the
picker, the unit-aware readouts, the adaptive grid, typed lengths and the measure tool are
P3–P7. Today a unit can only be chosen with the digit keys 1–6 or Ctrl+F.

---

## P3 — U3: unit selector UI, unit-aware readouts, typed-dimension unblock

**Done.** Units are now selectable and legible in the product, not just from the keyboard.

- **Desktop picker** — `snap-unit-toggle` reading `Snap {label}` plus a six-row
  `snap-unit-picker` popover (`snap-unit-{id}`, `aria-pressed`, digit hotkey shown on each
  row). Deliberately a popover copying the proven floor-picker pattern, **not** a six-way
  segmented control: `TopBar.tsx` records that this bar already overflowed at 1366 px, which
  is why its title is `hidden xl:block`. A six-segment inline control would reintroduce that.
- **Mobile** — the same six units as ≥44 px rows (`snap-unit-mobile-{id}`) in the overflow
  menu. Not polish: the desktop popover is `md:`-only, so without these rows a phone user
  cannot choose a unit at all.
- **Explicit labels everywhere** — the grid button and mobile row now read
  `Grid {SNAP_UNIT_LABEL[precision]}`. A derived label would render `1 cm` as `0.01 m`; the
  e2e assertion below is what pins that.
- **`src/designer/unitFormat.ts`** (new, 6 unit tests) — one shared `formatLengthForUnit`
  replacing four hardcoded `${m.toFixed(2)} m` sites, plus `chipVisibleAt` replacing the two
  hardcoded `> 0.05` floors (which at the 1 cm unit hid precisely the lengths that unit
  exists to draw). Output is **byte-identical at 0.5 m and 0.25 m**; cm output is capped
  below 1 m so the longest string is `99 cm`, inside the measurement plate's documented
  `"12.34 m"` budget.
- **Typed dimensions unblocked (D11 / Vic Q3)** — both TopBar L/W inputs move to
  `step={snapStepM}` / `min={Math.max(0.1, snapStepM)}`, and `designStore.setRoomDimensions`
  relaxes its clamp from `Math.max(1, ...)` to `Math.max(0.1, ...)`. Both layers had to
  change: the browser spinner stepped in half-metres AND the store re-clamped to a 1 m
  floor, so changing one alone leaves the UI silently snapping back. This is literally the
  ".50cm to 1m" Vic named.
- The measurement chips subscribe to the unit **reactively** (`useDesignerUIStore` selector
  in `RoomDrawLayer`) rather than through the non-React accessor the pointer handlers use —
  a chip is render output and must re-label on a unit change without needing a mouse move.

### P3 GATE

```
$ PPW_E2E_BASE_URL=http://localhost:5187 npx playwright test \
    units inline-interaction-2026-05-31 auto-dig-console-sweep-2026-05-25 \
    multiroom-attach placement-fsm wall-draw
  17 passed (26.4s)

$ npx vitest run
  Test Files  157 passed (157)   Tests  1842 passed (1842)

$ npx tsc --noEmit        # exit 0
$ npm run build           # built in 7.51s, clean
$ npx eslint <6 changed>  # 0 errors
$ git grep -ho 'data-testid="[^"]*"' | sort -u | wc -l
  148        # was 145; three added (snap-unit-toggle/-picker/-{id}), none dropped
```

`inline-interaction-2026-05-31` is the load-bearing one here: it pins the canvas badge
reading `· 0.5 m` and then `· 0.25 m` after Ctrl+F. It stays green because `SNAP_UNIT_LABEL`
reproduces those strings character-for-character — a derived `${step} m` label would too, at
those two units, which is exactly why the new toggle assertion checks `Snap 1 cm` instead.

### A trap worth recording

The reload-persistence assertion failed on first run with `Received: "Snap 0.5 m"`. Not a
product bug: Playwright's `addInitScript` **re-runs on every navigation**, so the reload was
re-seeding `ppw_designer_ui_v1` back to its seeded value and overwriting the very preference
the test was observing. Fixed with a `__ppw_seeded` sentinel that makes the seed
first-load-only. The multiroom brief documents this same trap for its blank-canvas test;
it bites any spec that reloads.
