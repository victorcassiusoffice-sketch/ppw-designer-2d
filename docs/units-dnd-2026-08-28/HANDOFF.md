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
