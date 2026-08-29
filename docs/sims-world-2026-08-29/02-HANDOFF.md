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
