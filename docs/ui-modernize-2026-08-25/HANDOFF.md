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
