# Designer UI Modernization — HANDOFF (2026-08-25)

Branch `feat/designer-ui-modernize-2026-08-25` off `main` @ `4c21bfa`.
Brief: `C:\Users\Victor\Documents\PPW-Second-Brain\code runner\DESIGNER-UI-MODERNIZE-2026-08-25.md`.
Visual reference: `C:\Users\Victor\Documents\Claude\Projects\ppw-room-designer\Design\Designer.jpeg`.

Written as the work progresses. Every gate output below was pasted from an
actual run — nothing is claimed that was not executed in this session.

---

## §1 Preconditions

```
git status --short        → (empty; clean tree)
git checkout main && git pull  → Already up to date. HEAD 4c21bfa
git checkout -b feat/designer-ui-modernize-2026-08-25 → Switched to a new branch
npx tsc --noEmit          → clean (exit 0, no output)
npx vitest run            → Test Files 1 failed | 145 passed (146)
                             Tests      1 failed | 1617 passed (1618)
```

**The single baseline failure is PRE-EXISTING and not a tinypool crash:**
`src/lib/__tests__/fx.test.ts > fetchFxSnapshot > falls back when fetch is unavailable`
timed out at 5000 ms under full-suite load. Re-run in isolation:

```
npx vitest run src/lib/__tests__/fx.test.ts
 ✓ src/lib/__tests__/fx.test.ts (9 tests) 2294ms
   ✓ fetchFxSnapshot > falls back when fetch is unavailable 2291ms
 Test Files  1 passed (1)      Tests  9 passed (9)
```

It is a load-sensitive timing flake in a network-fallback test, present before
any edit on this branch. Treated as the baseline, not as a regression.

---

## §2 P0 — Baseline captures

Harness added at `tools/shoot-ui-modernize.mjs` (Playwright, seeds
`ppw_designer_coach_v1='1'` in every context per the known trap, resilient
screenshot that nudges `document.fonts.ready` before shooting).

```
node tools/shoot-ui-modernize.mjs before http://localhost:5187
```

GATE — files exist:

```
docs/ui-modernize-2026-08-25/before/
  draw-measure-desktop-1920.png   203560
  draw-measure-mobile-390.png      63969
  fresh-desktop-1920.png          201724
  fresh-mobile-390.png             76154
  placed-desktop-1920.png         246868
  placed-mobile-390.png            62923
```

Measured BEFORE numbers (the P2 gate's baseline):

| state | viewport | stage px | width ratio | height ratio | topbar | visible controls | console errors |
|---|---|---|---|---|---|---|---|
| fresh | 1920×1080 | 1088 × 1024 | **0.5667** | 0.9481 | 56 | — | 0 |
| draw | 1920×1080 | 1088 × 1024 | **0.5667** | 0.9481 | 56 | — | 0 |
| placed (3) | 1920×1080 | 1088 × 815 | **0.5667** | **0.7546** | 56 | — | 0 |
| fresh | 390×844 | 390 × 788 | 1.0 | 0.9336 | 56 | — | 0 |
| placed (3) | 390×844 | 390 × 788 | 1.0 | 0.9336 | 56 | 39 | 0 |

Complaint 2 quantified: on desktop the drawing surface is **56.7 % of the
viewport width**, and drops to **75.5 % of height** the moment the CartStrip
appears. Targets are ≥ 0.80 and ≥ 0.85.

---

## §3 P1 — Blank start

Complaint 1: *"A default room appears already drawn — confusing."*

Five separate code paths could put a 5 × 4 m rectangle on a canvas the user
never drew. All five now open BLANK:

| # | path | before | after |
|---|---|---|---|
| 1 | `designStore.projectFromProperty()` — no active room | `rectToPolygon({5,4})` | `EMPTY_POLYGON` |
| 2 | `designStore` mirror subscription — `active?.polygon ??` | `rectToPolygon({5,4})` | `EMPTY_POLYGON` |
| 3 | `propertyStore.removeRoom` — last-room re-seed | `makeDefaultRoom()` | `makeBlankRoom()` |
| 4 | `normaliseLoadedProperty` — zero-rooms repair | `makeDefaultRoom()` | `makeBlankRoom()` |
| 5 | `normaliseLoadedRoom` — no polygon on a loaded room | always `rectToPolygon` | rect **only** for a genuine legacy payload (`lengthM`/`widthM`/`roomDimensions` present); otherwise blank |

`makeDefaultRoom` is deleted — `makeBlankRoom` is now the only room factory.
`addRoom()` called with no polygon also defaults to `[]` (in practice it is
only ever called with an explicit polygon from the draw commit).

Path 5 was the subtle one: a persisted blank room round-tripping through
Load/`normaliseLoadedRoom` silently acquired a rectangle.

Preserved exactly as the brief requires: the "Start by drawing your room"
prompt, the `data-testid="start-quick-rectangle"` **Quick 5 × 4 m room**
button (the only no-draw route to a rectangle), and the TopBar L/W inputs
staying disabled until a room exists (`isActiveRoomRectangle()` is false for
a 0-vertex polygon, so TopBar renders its "Draw a room →" hint).

**GATE**

```
npx tsc --noEmit   → clean (exit 0)
npx vitest run     → Test Files 147 passed (147)
                     Tests     1626 passed (1626)
```

1618 → 1626 tests (+8): the two re-seed assertions were changed from
"a room exists" to "the room is blank", and a new
`src/store/__tests__/designStore.test.ts` (6 tests) proves the façade
exposes an EMPTY polygon with no user-drawn room — including the
unresolvable-active-room branch the old 5×4 fallback used to serve.

Note: the `fx.test.ts` flake from the baseline passed on this run — the full
suite is 1626/1626 green.

```
npx eslint src/store/designStore.ts src/store/propertyStore.ts \
           src/store/__tests__/designStore.test.ts \
           src/store/__tests__/propertyStore.test.ts   → clean (no output)
```

---

## §4 P2 — Layout maximisation + Sims dock + details overlay + cart pill

Complaint 2: *"Side features eat too much space — the drawing grid must
dominate the screen."*

Four permanent chrome blocks were costing the canvas 832 px of width and
209 px of height. All four moved; none were deleted:

| was | cost | now |
|---|---|---|
| `RoomList` left rail | 224 px wide | dropdown hung off the TopBar Rooms trigger (`data-testid="rooms-dropdown"`), same store calls, same rows, same live draw counters |
| `ProductPalette` column | 288 px wide | **`SimsDock`** — one-row build toolbar, `src/components/desktop/SimsDock.tsx` |
| `DetailsPanel` right rail | 320 px wide | right-side overlay (`data-testid="details-overlay"`), mounts only while an item is selected, closes on deselect or its × |
| `CartStrip` bottom strip | 209 px tall | floating pill bottom-right (`data-testid="cart-pill"`), expands to the identical cart body as a sheet |

**SimsDock** adapts the mobile `SimsBottomToolbar` Vic already approved.
The one adaptation: a phone has to stack categories ABOVE a double-row
strip, a 1920 px desktop does not — so the same parts lie down in a single
row (`[category icons | product strip | collapse chevron]`) and cost 82 px
instead of ~190 px. Placement is **not forked**: a tile click toggles
`pendingProductId` exactly as the ProductPalette card did, carrying the
same `data-product-id` / `data-macro` / `data-armed` attributes the e2e
suite asserts on, and `RoomCanvas`'s pointer-FSM commits it. The P0-ζ hover
DetailCard moved to the dock with its `product-hover-card` testid intact.

`SimsDock` publishes its live height as `--sims-dock-h`, so the details
overlay, the cart pill and the build stamp all park above it and resolve to
0 px on mobile where the dock is `display:none`.

### Two defects found and fixed by looking at the render

1. **The room was not centred.** `RoomCanvas`'s auto-centring effect was
   guarded on the viewport being "pristine" (`x===0 && y===0 && scale===1`).
   It always fired once on mount against the 800×600 *default* `stageSize`
   — before the ResizeObserver reports the real size, and against an EMPTY
   polygon — which locked `viewport.x` at `800/2 = 400` and made the guard
   false forever. Any room drawn afterwards sat 310 px left of centre. This
   was pre-existing and barely visible in a 1088 px canvas; it is glaring in
   a 1920 px one. Replaced with an explicit `userMovedViewportRef` set by
   wheel / stage-drag / pinch, which keeps the original intent (never undo a
   user's zoom) while letting the room re-centre when the stage resizes or
   the room appears. Bonus: **Reset now re-centres** instead of slamming the
   room's origin into the stage's top-left corner.
2. **The build stamp rendered on top of the dock** (`position: fixed;
   bottom: 6px; z-index: 40`). Now offset by `--sims-dock-h`.

### Decisions taken under brief rule §2.6

* **`MiniCartPill` un-mounted from `App.tsx`** (file and its unit test left
  untouched on disk). It sat at `right-3 top-3` and *overlapped* RoomCanvas's
  own Reset/Share/Capture row — visible in `before/placed-desktop-1920.png` —
  and with `CartStrip` now being a pill it was a second cart readout on the
  same screen. Checked before removing: `wellness-designer-app-phase-a.spec.ts`
  is the only e2e that references `mini-cart-pill`; A.C.4 asserts
  `toHaveCount(0)` on an empty cart (still true), and its other use is one
  selector in an OR-list that also contains `.konvajs-content` (still
  resolves). Nothing breaks.
* **The dock's product strip is visible by default**, filtered by the active
  category, rather than hidden until a category is clicked. This is exactly
  how the approved mobile toolbar behaves, matches Sims build mode (the tray
  is open), and keeps `[data-product-id]` clickable for the e2e suite.
* **The details overlay opens on SELECTION only**, per the brief. The
  consequence: the armed-product preview that used to fill the idle right
  rail no longer has a home there. Product info before placement is still
  reachable — the dock's hover DetailCard shows photo, price, dimensions and
  a "Place on floor" action.

**GATE** — `node tools/probe-layout-gate.mjs http://localhost:5187`

```
PASS  testid visible (blank state): share-render
PASS  testid visible (blank state): start-quick-rectangle
stage 1920 x 942   topbar 56px   dock 82px
PASS  stageBox.width / 1920 >= 0.8  = 1
PASS  stageBox.height / 1080 >= 0.85  = 0.8722
PASS  testid visible (room state): items-placed
PASS  items-placed starts at 0
PASS  dock exposes the product card
PASS  arming sets data-armed on canvas + card  count = 2
PASS  room origin found by canvas pixel-scan
PASS  click card -> click floor -> items-placed = 1  got "1"
PASS  zero console errors

GATE: stageBox.width/1920 >= 0.8 && stageBox.height/1080 >= 0.85  ->  true

ALL CHECKS PASSED
```

Width **0.5667 → 1.0**. Height **0.7546 → 0.8722**.

```
npx vitest run  → Test Files 147 passed (147) · Tests 1626 passed (1626)
npx eslint <8 changed files> → clean (exit 0)
```

---

## §5 P3 — Measurement chips

Complaint 3: *"While drawing walls, the live measurement numbers are too
small to read."*

Root cause: a Konva `fontSize` lives in STAGE space, so the Stage's scale
transform shrinks it along with the room. `RoomDrawMode` used
`fontSize={11}` and `WallDrawMode` used `fontSize={13}` — at the app's 0.3
minimum zoom those render at **3.3 px** and **3.9 px** on screen.

New `src/designer/MeasurementChip.tsx` authors the chip in SCREEN px and
divides every dimension (font, plate width/height, corner radius, stroke)
by the live viewport scale, so it renders at a constant
`MEASURE_MIN_SCREEN_PX = 16` at every zoom. Gold numerals on a near-black
plate at 0.85 opacity — the dimension-callout style from `Designer.jpeg`.

Applied to both tools:

* `RoomDrawMode` — a chip at every committed segment's midpoint, plus the
  running length parked 26 px above the cursor for the segment in progress.
* `WallDrawMode` — the imperative live label (updated per pointer-move, not
  per React render, so it tracks at 60 fps) now sizes and positions its
  text AND a new backing plate from `measureChipMetrics(scale)`.

**GATE — unit test**

```
npx vitest run src/designer/__tests__/blueprintTheme.test.ts
 ✓ src/designer/__tests__/blueprintTheme.test.ts (22 tests)
```

The screen-space property is pinned directly: for every scale in
`[0.3, 0.5, 0.75, 1, 1.5, 2, 2.5, 3]`, `measureFontSize(scale) * scale ===
MEASURE_MIN_SCREEN_PX`, and all eight rendered sizes are asserted to be the
same value. Degenerate scales (0, −1, NaN, Infinity — a Konva Stage can
report 0 for one frame during a ResizeObserver race) fall back to the
target instead of dividing by zero. There is also a test that the new chip
beats the old `fontSize={11}` at every zoom below 100 %.

**GATE — screenshot**

```
node tools/shoot-draw-measure.mjs http://localhost:5187
saved draw-measure.png (100%) and draw-measure-zoomed-out.png (63%)
```

`docs/ui-modernize-2026-08-25/after/draw-measure.png` — draw mode with 2
committed vertices and a live third segment. A second shot at 63 % zoom is
included deliberately: the room is visibly smaller, the chips are visibly
the SAME size. That side-by-side is the proof the fix works.

### Two more defects found by looking at the render

3. The draw-mode help strip sat on top of the sticky Clear products /
   Clear all row (both are bottom-left). Raised 46 px to stack above it.
4. The live segment printed its length TWICE — once at its midpoint, once
   at the cursor. The midpoint chip is now skipped for the preview segment.

```
npx vitest run  → Test Files 148 passed (148) · Tests 1648 passed (1648)
npx eslint <5 changed files> → 0 errors
```

The 4 `react-refresh/only-export-components` **warnings** on
`WallDrawMode.tsx` are PRE-EXISTING — verified by `git stash` + lint on the
baseline, which reports the identical 4 warnings at line 37 (they moved to
line 47 only because this branch adds import lines above them).
