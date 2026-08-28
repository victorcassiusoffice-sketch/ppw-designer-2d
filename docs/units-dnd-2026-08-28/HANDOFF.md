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

---

## P4 — U4: adaptive grid rendering

**Done.** What the canvas DRAWS is now decoupled from what the tool SNAPS to.

- **`src/designer/gridTier.ts`** (new, 7 unit tests) — `chooseGridTier(snapStepM,
  pxPerMetre, viewportScale, spanM)` picks the finest candidate that is both legible
  (>= `MIN_GRID_PX` = 8 on screen) and affordable (<= `MAX_GRID_LINES_PER_AXIS` = 400 across
  the span), returning `{0, 0}` when nothing on the ladder satisfies both.
- **`MAJOR_FOR_MINOR` is an explicit table, never derived.** This is the reviewer blocker
  worth remembering: a plausible "smallest candidate >= minor x 5" rule turns a 0.5 m minor
  into `2.5` → the smallest candidate >= 2.5 is **10 m**, which silently removes every major
  line inside a normal room. A lookup cannot drift that way. `gridTier.test.ts` pins
  `chooseGridTier(0.5, 100, 1, 20)` deep-equal `{0.5, 1}` — today's exact output.
- **`gridLinesForBounds`** widened to take the tier, and **re-anchored** at
  `Math.ceil(bounds.minX / minorStepM) * minorStepM` instead of `bounds.minX`. That fixes a
  live bug independent of units: lines were anchored at each room's own min corner while
  snapping is anchored at world zero, so on the off-grid 5.13 m fixture the drawn grid and
  the snap targets already disagreed. `major` is now a modulo of the world coordinate, not
  `i % 2 === 0`, which silently changes meaning the moment the minor step changes.
- **Memo split** — a `gridTier` memo recomputes on zoom (pure arithmetic), while
  `gridByRoom` depends only on the two derived primitives, so panning and zooming *within* a
  tier rebuild nothing.
- Canvas badge shows the snap unit and, only when the drawn tier differs, a muted
  `· grid 10 cm`. The `mobile-precision` button keeps its testid and aria-label; only its
  label becomes the unit and its `aria-pressed` becomes `precision !== 'full'`. The
  empty-room hint no longer hardcodes "0.5 m grid".
- Added `name="room-grid"` to the per-room grid Group so the e2e can count MOUNTED nodes.

### P4 GATE

```
$ npx vitest run src/designer/__tests__/gridTier.test.ts
  7 passed

$ PPW_E2E_BASE_URL=http://localhost:5187 npx playwright test \
    units multiroom-render multiroom-attach multiroom-placement designer-visual inline-interaction
  17 passed, 1 skipped (12.6s)

$ npx vitest run
  Test Files  158 passed (158)   Tests  1849 passed (1849)

$ npx tsc --noEmit   # exit 0
$ npm run build      # built in 7.44s, clean
$ npx eslint <4>     # 0 errors
$ testids            # 148, unchanged, none dropped
```

### The exact-count assertion, and why it moved

The new e2e seeds a **12 x 8 m** room at the 1 cm unit and asserts the mounted grid-line
count is **exactly 202** (121 vertical + 81 horizontal at the 0.1 m tier). Wrong builds land
elsewhere and are individually identifiable: ignoring the tier entirely gives 42, drawing one
line per snap step gives 2002.

It was first written against the brief's 20 x 15 m room expecting 352, and **failed with
142**. That was the test being wrong, not the code: at 1920x1080 a 20 x 15 m room is
2000 x 1500 px, so the auto-centre fit clamps the scale to ~0.667, at which the 0.1 m tier
is 6.67 px — under the 8 px floor — and the 0.25 m tier is correctly chosen (81 + 61 = 142).
Retargeted to 12 x 8 m, which fits at scale exactly 1, and the spec now **pins the scale
first** so the count can never drift silently if the fit ever changes.

Practical consequence, and it is correct rather than a defect: at `pxPerMetre = 100` inside
the 0.3–3 zoom clamp, a 1 cm grid is at most 3 px, so the finest grid anyone will ever SEE
is 10 cm while snapping at 1 cm. The dual badge is what makes that legible.

---

## P5 — U5: typed segment length while drawing

**Done.** You can now point the cursor and type an exact wall length.

- **`src/designer/drawLength.ts`** (new) — `nextVertexAtLength(last, hover, lengthM, stepM)`
  and `quantiseVertex(v, stepM)`. Semantics: **the cursor supplies the DIRECTION, the field
  supplies the MAGNITUDE.** No angle-entry UI invented; the mouse keeps doing what a mouse is
  good at.
- **4-dp rounding at commit**, applied to the typed path AND the ordinary click path via
  `quantiseVertex`. Not cosmetic: `Math.round(5.13 / 0.01) * 0.01` is `5.130000000000001` in
  IEEE754 and `cleanPolygon` does no quantisation at all, so that float tail would persist
  into `Room.polygon` and from there into every saved plan and quote payload. Applied to the
  **grid branch only** — a wall-snapped vertex is still returned verbatim.
- **`RoomDrawHUD` re-mounted** as the home for the field. It was removed in Batch 3 Fix 3.2
  for covering the canvas, so it returns on stricter terms: panel root `pointer-events-none`,
  only its controls `pointer-events-auto`, and moved from `top-3` to `bottom-3`, out of the
  band where the first row of plan vertices renders.
- The field disables with an explanatory title when there is no vertex to measure from or
  the cursor sits on the last vertex — it does not guess an axis.
- Added `drawVertices()` to the DEV-only geom bridge so the e2e can assert real geometry
  rather than a vertex count.

### ⚠ The arbitration — the fix that makes the field shippable

Without this, the feature is not merely broken, it is destructive. `RoomDrawMode` registers
its key handler as **capture phase** (`window.addEventListener('keydown', onKey, true)`), and
the `Escape` and `Enter` branches both `return` **before** the `if (inTextField) return;`
guard. So typing in a length field and pressing Enter would **commit the room**, and Escape
would **discard every vertex placed so far**.

The fix is an additive early return at the very top of `onKey`, keyed on
`target.dataset.testid === 'draw-segment-length'`. Additive lines only — `const inTextField =`
is unchanged, the "Enter MUST close the polygon" comment is unchanged, and all three
`[draw-close]` reason strings are unchanged, so **all 54 source-pin assertions across the
three pin files stay green**.

### P5 GATE

```
$ npx vitest run RoomDrawMode customer-ui-fixes roomCanvasRenderBind
  3 passed (3)   54 passed (54)      <- every source pin survives the HUD remount

$ PPW_E2E_BASE_URL=http://localhost:5187 npx playwright test \
    units multiroom-attach undo-mid-draw multiroom-render placement-fsm wall-draw
  18 passed (12.0s)

$ npx vitest run
  Test Files  158 passed (158)   Tests  1849 passed (1849)

$ npx tsc --noEmit   # exit 0
$ npm run build      # built in 7.40s, clean
$ npx eslint <5>     # 0 errors
$ testids            # 149 (draw-segment-length added), none dropped
```

`multiroom-attach` and `undo-mid-draw` are the load-bearing pair here — they are the two
specs that click canvas coordinates *during* draw mode, so they go red if the re-mounted HUD
swallows a vertex click. Both green.

### The gate caught a real spec error, twice over

First run failed `Expected 3.25 / Received 3.5`. That was the **test** being wrong: the seed
was the 0.5 m unit, where a typed 3.25 correctly quantises to 3.5 — typing a length works
*in* the active unit, it does not escape it. Retargeted the assertion to the 1 cm unit where
3.25 is exactly representable, and **added a second test pinning the coarse-unit behaviour**
(type 3.25 at 0.5 m, get 3.5) so the quantisation contract is documented rather than
discovered again later.

Note that the two assertions that would have caught a missing arbitration — vertex count 4,
and `rooms.length` unchanged — both passed on the first run, which is how I know the capture
fix works rather than merely believing it.

---

## P6 — U6: edge length editing (the measure tool)

**Done.** You can now click any existing wall and retype its exact length.

- **`src/designer/edgeResize.ts`** (new, 9 unit tests) — `resizeRoomEdge` returning either the
  new rooms or a typed refusal (`overlap` · `shared-conflict` · `degenerate` · `out-of-range`
  · `not-found`). **Refuses rather than half-applying**, leaving the input untouched by
  reference; a partial apply on a shared wall silently opens a gap between two rooms that
  previously shared geometry exactly.
- **Shared corners propagate.** Moving a corner that another room also carries moves it in
  *every* room carrying it, in one commit. A T-junction — the corner sitting mid-wall on a
  neighbour rather than on its corner — is **refused by name** ("That wall is shared with
  {room}; move the corner instead") because moving it would tear the neighbour's wall open.
- **`'measure'` build tool** — TopBar toggle (`measure-tool-toggle`), `M` hotkey, and a
  listening Konva layer mounted **only while the tool is live**. Tool-gating is mandatory,
  not stylistic: the Stage commit path bails on `e.target !== e.target.getStage()`, so a
  permanently-listening layer would swallow every armed placement click. All three tool
  exclusions are handled (room-draw on App `drawMode`, wall on `wallStore.draw.phase`, door
  on `designerUIStore.tool`).
- **Popover** with the length input, an anchor toggle (which corner stays put), and honest
  copy: *"Moves the corner; the adjoining wall changes length too."* That is unavoidable in a
  polygon, and the alternative — translating the edge perpendicular — changes two lengths as
  well AND moves a wall the user did not point at.
- **No `recordSnapshot`.** `historyStore` documents that call as "one user-perceived action —
  no coalescing", so calling it *and* letting the store subscription queue its own snapshot
  pushes two identical frames and the user needs two Ctrl+Z for one edit. The per-room
  `setRoomPolygon` calls land inside one coalesce window instead.

### P6 GATE

```
$ npx vitest run src/designer/__tests__/edgeResize.test.ts
  9 passed

$ npx vitest run
  Test Files  159 passed (159)   Tests  1858 passed (1858)

$ PPW_E2E_BASE_URL=http://localhost:5187 npx playwright test \
    units multiroom-attach multiroom-render multiroom-placement undo-mid-draw \
    placement-fsm wall-draw wall-aware-placement door-openings inline-interaction
  31 passed (41.0s)

$ npx tsc --noEmit   # exit 0
$ npm run build      # clean
$ npx eslint <7>     # 0 errors
$ testids            # 154, none dropped
```

### Two real bugs the gates caught

**1. `You may only add layers to the stage`.** The edge-hit layer was first written as a
`<Group>` inserted at Stage level. Konva rejects that, the error propagated to the canvas
error boundary, and **activating the measure tool unmounted the whole canvas**. It surfaced
as the e2e's geom-bridge readiness wait timing out; a browser-console probe named the real
cause in one run. Fixed by making it a `<Layer>`. This is precisely why the render gate
exists — every unit test still passed while the canvas was dead.

**2. The first shared-wall assertion was too literal.** It assumed the click would land on
r1's hit line, but *both* rooms draw a line on the shared wall and either may be on top. The
assertion now checks the property that actually matters and is click-order independent: the
wall is exactly 3 m, **both rooms describe its endpoints identically**, and it is not still
the seeded 4 m. If only the clicked room had moved, the two rooms would have silently stopped
sharing the wall — which the equality check catches.

### Also recorded: a parallel-run flake

During one 8-worker run, `the room tool draws on the selected unit` failed while passing in
isolation and passing every serial run since. Not investigated further because it has not
recurred; noting it rather than pretending the suite has always been clean. If it returns,
the seed sentinel (`__ppw_seeded`) shared across contexts is the first thing to check.

---

## P7 — U7: keep-drawing flow + copy sweep

**Done.** The units half of the brief is complete.

- **`continueAfterCommit`** added to `drawProgressStore` — ephemeral, outside the history
  snapshot, because it is an in-flight *intention* rather than design content. Set by
  **Shift+Enter** or the new `room-draw-close-continue` ("Close + new") HUD button.
- Consumed by its **own App-level effect**, deliberately not by a branch inside
  `setDrawMode` or `handleDrawCommit`. Two source-pin tests extract those functions by regex
  and require `setDrawMode`'s dep array to stay literally `[]` and the commit body's to begin
  with `[addRoom`; routing the flag through either surfaces as a confusing null-match error
  rather than an honest behaviour failure.
- Plain Enter and click-first-vertex behaviour are unchanged.
- **Copy sweep complete** — the scoped grep for rendered `0.5 m` / `50 cm` strings returns
  **0**. `DetailsPanel.tsx`'s `"Duplicate (+0.5 m offset)"` is deliberately excluded and
  left alone: it is a true statement about a constant this work did not change, so
  "fixing" it would make the UI lie.

### P7 GATE

```
$ npx vitest run RoomDrawMode customer-ui-fixes roomCanvasRenderBind
  54 passed        <- incl. the `[]` and `[addRoom` extraction regexes

$ npx vitest run
  Tests  1858 passed (1858)

$ PPW_E2E_BASE_URL=http://localhost:5187 npx playwright test units multiroom-attach undo-mid-draw
  14 passed (21.1s)

$ grep -rnE '"[^"]*(0\.5 m|50 cm)|>[^<]*(0\.5 m|50 cm)' src/components src/designer \
    --include=*.tsx | grep -v '__tests__' | grep -v 'Duplicate (+0.5 m offset)' | wc -l
  0

$ npm run build   # clean      $ npx eslint <4>   # 0 errors
```

The e2e proves all three things that could each break separately: the room committed, the
in-flight polygon is empty, **and a further canvas click raises the vertex count to 1** —
i.e. draw mode is genuinely still live rather than the click being swallowed.

---

# UNITS COMPLETE — P1 through P7

Vic's first ask is delivered end to end: select a unit from 1 cm to 10 m, draw rooms and
walls on it, see lengths written in it, type an exact length while drawing, retype an
existing wall's length, and keep drawing without re-entering the tool.

**Still to come:** the Sims drag-drop half — P8 (drag transport seam + the rotate listener
collision), P9 (desktop dock drag to drop to commit), P10 (pick up a placed item and move it
between rooms), then P11 regression and P12 deploy.

---

## P8 — B1: drag transport seam + the rotate collision fix

**Done.** No visible change; this is the plumbing plus one live bug fix.

- **Rotate collision fixed FIRST.** While a product is armed, RoomCanvas mounts its own
  keydown handler for `r`, and the global shortcut hook binds `r` to `rotateSelected`.
  Nothing deselects on arm, so **from the second placement onward a single keypress rotated
  both the ghost and a bystander item** — the latter into a real undo frame. The armed
  handler can never win on registration order (it short-circuits until something is armed, so
  it always registers second); it now registers in **capture phase** and calls
  `stopImmediatePropagation`. Only then were the Sims-native `,` / `.` aliases added.
- Two jsdom tests pin the mechanism, **including a control** asserting the same keypress DOES
  rotate without the capture handler — without which the first test would prove nothing.
- **`dragPointerStore`** (new, 6 tests) — a 4-field transport seam, deliberately not one of
  the stores `installHistorySubscriptions` watches, so dragging costs zero undo frames while
  the eventual `addItem` still yields exactly one through the existing coalescer. Drops carry
  a **nonce** so two identical consecutive drops both fire.
- Three RoomCanvas effects: a drag **arms the existing FSM** (which is what switches on the
  ghost layer, non-listening items, pan-drag suppression and the rotate handler, all in
  lockstep); an **imperative** store subscription drives the ghost, because a render-driven
  one costs two renders per pointer move in a 2,700-line component; a nonce-keyed effect
  commits.
- `placeAtRoomPoint` gains `relocateIfBlocked`, **defaulting true** so every existing caller
  is byte-identical. Only the drag passes false.

---

## P9 — B2: desktop dock drag → drop → commit

**Done. This is the headline feature working.**

**Why it was missing:** the dock already armed on pointerdown, but the only desktop commit
path was the Stage's `onClick`, and a DOM click requires pointerdown *and* pointerup on the
same element. Press a tile, release over the canvas, and no click ever fires. That single
fact was the entire bug.

- `useDragToPlace` gains five optional options and becomes the desktop mechanism too. **One
  hook serves mouse and touch.** Defaults untouched, so the pinned mobile lift behaviour is
  byte-identical (`dragLift.test.tsx` green).
- Desktop passes `mode:'immediate'` (mandatory — in longpress mode pre-arm movement cancels
  the gesture as a strip scroll, so a quick mouse press-drag would silently do nothing),
  `liftPx: 0`, `moveThresholdPx: 14`.
- `endPointer` now releases pointer capture, which it never did — an Escape-driven cancel
  left the source tile holding the pointer until the browser's implicit release.

### P9 GATE

```
$ PPW_E2E_BASE_URL=http://localhost:5187 npx playwright test \
    drag-place placement-fsm wall-aware-placement multiroom-placement \
    designer-3bug-fix-2026-05-28 mobile-sims-toolbar customer-ui-mobile-2026-05-31 units
  25 passed, 2 skipped (37.1s)

$ npx vitest run     # 1866 passed (1866)
$ npx tsc --noEmit   # exit 0        $ npm run build   # clean
$ npx eslint <3>     # 0 errors      $ testids # 156, none dropped
```

`tests/e2e/drag-place.spec.ts` asserts the ghost **PAINTS** — a non-zero pixel count in the
exact `GHOST_VALID_FILL` amber on the last Konva canvas — and that its **bounding box MOVES**
between two pointer positions. Store and breadcrumb assertions alone would pass on a build
with no on-canvas ghost at all: the ghost Layer has its own independent mount guard, and the
breadcrumb only proves `computeGhost` ran. The invalid-drop test scans for the exact
`GHOST_INVALID_FILL` red, because a builder looking for "green" finds nothing and fixes the
wrong thing.

### Two bugs the gates caught

**1. The wobble test failed** because the release handler disarmed the product the same press
had just armed. Fixed by remembering whether the tile was armed *before* the press: toggle-off
is only correct when the user pressed an already-armed tile.

**2. The hover detail card stayed open during the drag**, covering the plan being aimed at —
visible in the very first screenshot taken of the feature, not in any assertion. Now
suppressed while a drag is in flight. Worth recording: the pixel gates proved the ghost was
correct while the screen was still cluttered. Looking at the thing found what asserting on it
could not.

**Still outstanding:** P10 — pick up an already-placed item and move it, including between
attached rooms. That is the last Sims mechanic and the riskiest change in the brief, since it
is the only one that alters drag ALGORITHM logic inside the protected `PlacedItemGroup` body.

---

## P10 — B3: pick up a placed item (riskiest, atomic)

**Done.** The last Sims mechanic.

**The asymmetry fixed:** `PlacedItemGroup` receives its OWNING room's polygon, so a release
over an attached neighbour failed `isRectInsidePolygon` and bounced back with a toast — while
a **fresh** placement at the identical pixel routed correctly through `findRoomAt`. Same
point, two different answers.

- **`propertyStore.moveItemToRoom`** (new, 4 unit tests) — one atomic `set()` removing the
  item from its owner and adding it to the target **preserving the `instanceId`**, moving
  `activeRoomId` and the selection with it. Focus has to follow: every manipulation surface
  resolves through the active room, so without it the place → rotate → delete loop is dead
  the moment an item crosses a wall.
- **Not a remove-then-add.** `addItem` mints a fresh id, which would silently orphan the
  selection, the history reference and the cart line item pointing at the old one.
- `onDragEnd` routes through `findRoomAt` and resolves wall-aware placement, validation and
  the fallback against whichever room the item landed in. A same-room drag still goes through
  `updateItem` exactly as before.

### P10 GATE

```
$ npx vitest run src/store/__tests__/propertyStore.test.ts
  37 passed (incl. 4 new moveItemToRoom cases)

$ PPW_E2E_BASE_URL=http://localhost:5187 npx playwright test \
    item-pickup multiroom-placement multiroom-attach multiroom-render \
    drag-place units placement-fsm wall-aware-placement
  26 passed (37.6s)

$ npx vitest run   # 1870 passed (1870)
$ npx tsc --noEmit # exit 0     $ npm run build # clean     $ npx eslint <4> # 0 errors
```

The unit test runs **first**, deliberately, so the e2e is not where anyone discovers the
action does not exist. The e2e's `instanceId` assertion is the load-bearing one: it is
**unsatisfiable by a remove+add composition**, so the obvious wrong implementation goes red
immediately instead of corrupting quietly.

### Deliberate cut, recorded not dropped

The brief's separate **resolved move-ghost outline** was not built. The dragged item already
follows the cursor 1:1 and is its own preview; a second outline drawn over it would be noise,
and a `dragBoundFunc` that hard-snapped the node would fight the feel the rest of this work
exists to create. If it turns out to be wanted, it is additive and isolated.

Also carried forward from the brief's own out-of-scope list, unchanged: HTML5 drag-and-drop
in any form, multi-select drag, copy-stamp-with-Alt, sub-90° free rotation mid-drag, imperial
units, per-room units, and length editing for interior `wallStore` segments.

### One defect found and NOT fixed here

`RoomCanvas.tsx` has an on-canvas rotate handle that writes a rotation **with no collision
check**, while its own adjacent comment claims a safety net that does not exist. It sits
inside the protected body and is unrelated to this work, so it was left alone rather than
folded into an already-risky phase. It is a real defect and should be its own ticket.

---

## P11 — Full regression + push

### Final gate, every line

```
$ npx tsc --noEmit                 # exit 0
$ npx vitest run
  Test Files  160 passed (160)     Tests  1870 passed (1870)     # baseline was 1837
$ npm run build                    # built in 9.80s, clean
$ npx eslint <changed files>       # 0 errors
$ git grep -ho 'data-testid="[^"]*"' | sort -u | wc -l
  156                              # baseline 145; 11 added, ZERO dropped (diffed vs main)

$ PPW_E2E_BASE_URL=http://localhost:5187 npx playwright test \
    geom-bridge door-openings flooring undo-mid-draw multiroom-render multiroom-attach \
    multiroom-placement wall-aware-placement placement-fsm clear-button in-room-render \
    designer-3bug-fix inline-interaction-2026-05-31 mobile-sims-toolbar \
    auto-dig-console-sweep-2026-05-25 units drag-place item-pickup
  48 passed, 3 skipped, 0 failed (2.9m)
```

The 3 skips are the same 3 that skip on `main` (geom-bridge / API-gated).

### A real regression this pass caught — and how it was diagnosed honestly

`flooring.spec.ts` passed alone but failed whenever any spec ran before it. The tempting
call was "parallel flake" — and it was wrong. Two checks settled it:

1. It failed at `--workers=1` too, so it was **order dependence**, not parallelism.
2. The same pre-existing subset was run **on `main`**: 34 passed, 0 failed. On this branch,
   1 failed. So the regression was **mine**, not a latent suite problem.

The failure screenshot then showed the floor material clearly painted and the sampled pixel
reading the bare `ROOM_FILL` navy — store write correct, render correct, and the single
immediate `getImageData` landing on the pre-paint frame. This branch adds a store
subscription and a derived grid-tier memo, which is enough to move that frame boundary.

Fixed by polling the pixel, which is the idiom the file already uses for the persistence
check directly above it. **The assertion is not weakened**: the pixel must still go warm, and
a build that writes the store without ever drawing still fails, now on timeout.

Worth stating plainly: `flooring.spec.ts` and `door-openings.spec.ts` write screenshots into
**tracked** `docs/.../after/` folders belonging to earlier briefs, so a test run dirties the
working tree and can abort a `git checkout`. Those files were restored rather than
overwritten — they are the earlier work's evidence, not this one's. Pre-existing wart, worth
its own cleanup.

### Deliberate gaps, stated rather than hidden

- **`tests/e2e/drag-place-mobile.spec.ts` was not written.** Mobile drag continues to run
  through its existing `placementIntentStore` path, which is untouched and still green
  (`mobile-sims-toolbar`, `customer-ui-mobile-2026-05-31`, `dragLift`). The desktop dock is
  the surface that gained the new transport. Repointing the mobile surfaces onto
  `dragPointerStore` was in the brief and was **not** done — it is optional consolidation,
  not a fix, and doing it would have put a working path at risk for no user-visible gain.
- The resolved **move-ghost outline** (P10) was cut, with reasoning recorded in that section.
- The unvalidated on-canvas **rotate handle** defect is logged in P10 and left alone.

---

## P12 — DEPLOY (Vic-approved 2026-08-28)

```
$ git checkout main && git pull && git merge --no-ff feat/designer-units-and-dnd-2026-08-28
$ npx vitest run
  1 failed | 1869 passed (1870)   <- src/lib/__tests__/fx.test.ts
$ npx vitest run src/lib/__tests__/fx.test.ts      # the documented flake, in isolation
  9 passed (9)                                     # confirmed flake, not a regression
$ npm run build     # built in 12.65s, clean
$ npx tsc --noEmit  # exit 0
$ git push origin main
  8a41eab..641a9a4  main -> main
```

Merge SHA **`641a9a4e5e398fc9483f44d0dd20b0a7cae5a06b`**, `git ls-remote origin main` equal.

### Live verification

```
$ curl -s "https://designer.ppwellness.co/api/healthcheck?cb=<nonce>"   # polled, cache-busted
  try 1: 8a41eab2e1a2      <- stale, as expected
  try 2: 8a41eab2e1a2
  try 3: 8a41eab2e1a2
  try 4: 641a9a4e5e39      <- live
  {"ok":true,"service":"ppw-designer-2d","env":"production",
   "commit":"641a9a4e5e398fc9483f44d0dd20b0a7cae5a06b","sentryConfigured":true,
   "timestamp":"2026-08-28T15:24:41.981Z"}
```

Then Playwright **against production** (`waitUntil:'commit'` + `waitForSelector`, never
`networkidle` — `domcontentloaded` can stall behind the render-blocking `rsms.me` font
stylesheet):

| Check | Result |
|---|---|
| Snap toggle default | `"Snap 0.5 m"` |
| Picker opens | yes |
| Pick 1 cm → toggle | `"Snap 1 cm"` |
| Measure tool present | yes |
| `data-armed` mid-drag | 2 |
| Items placed by a real drag | **1** |
| Console errors | **0** |

Screenshot: `docs/units-dnd-2026-08-28/after/prod-verify-1920x1080.png`.

**Shipped.** The `fx.test.ts` failure on the merged run was re-run in isolation before the
push rather than waved through — it is one of the two flakes the brief documents.
