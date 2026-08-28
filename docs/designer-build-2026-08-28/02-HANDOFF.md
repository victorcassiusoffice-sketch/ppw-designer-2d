# Handoff — designer doors / flooring / undo / naming / pages

Branch `feat/designer-doors-flooring-pages-2026-08-28` off `main` @ `b7a735f`.
Findings + evidence: `00-FINDINGS.md`. Plan: `01-BUILD-PLAN.md`.

## Status against Vic's six complaints

| # | Complaint | State |
|---|---|---|
| 1 | "add a door going into the second room" | **DONE** — doors, doorways, windows |
| 2 | "check all functionalities" | **PARTIAL** — audit done, defects logged below |
| 3 | "the flooring doesn't work" | **DONE** — per-room floor finish, renders |
| 4 | "place things on top of the flooring" | **DONE** — layer bands + the dead-click fix |
| 5 | "no need for room 2, 3 — different pages" | **DONE** — real names + Plans tab strip |
| 6 | "undo button doesn't work mid-draw" | **DONE** — one ladder, both controls |

## Commits

| SHA | What |
|---|---|
| `5959389` | findings + build plan |
| `458dade` | P0 — e2e coordinate basis moved off colour onto geometry |
| `ad983cf` | P1 — addressable wall edges |
| `91910d5` | P2 — doors / doorways / windows |
| `9c6b01e` | P3+P4 — flooring, layer bands, dead-click fix |
| `a0086b2` | P5 — undo ladder + three latent history defects |
| `a88d8aa` | P6a — one naming scheme, real room names |
| `10c50b2` | P6b — Pages: separate plans that don't leak |

## Gate outputs

- `npx tsc --noEmit` — clean at every commit.
- `npm run build` — clean (the >500 kB chunk warning is pre-existing). Verified the
  DEV-only geometry bridge does not ship: `__ppwGeom` and `installGeomBridge` appear
  **0 times** in `dist/assets/*.js` (one hit in a `.js.map`, which is just the embedded
  source text).
- `npx vitest run` — **1837 passed / 157 files** (baseline on `main` was 1791/153 after P2;
  1648+ at the original brief).
- `npx eslint <changed files>` — 0 errors throughout (`npm run lint` has ~21 pre-existing
  errors in untouched files, so it is scoped per the rule).
- Playwright, local dev server on `:5187`: **25 passed / 3 skipped** across geom-bridge, door-openings,
  flooring, undo-mid-draw, multiroom-render/attach/placement, wall-aware-placement,
  placement-fsm, clear-button, in-room-render, designer-3bug-fix.

Key measured evidence rather than assertions:

- **geom bridge vs gold scan** — two independent methods (Konva matrix vs pixel counting)
  agree on world (0,0) within 1px: `viaGeom x=510`, `viaScan x=511`.
- **door cuts the shared wall** — wall pixels on the shared-wall column `335 → 253`,
  an 82px gap for an ~84px (0.838 m) door, through *both* rooms' strokes.
- **flooring renders** — the room pixel flips from cool navy to warm red-brown when a
  material is chosen. The old bug wrote the store and drew nothing, so this is the
  assertion that would have caught it.
- **on top of flooring** — a room pre-carpeted with 3 mats accepts a bike at (1.5, 0.5)
  instead of refusing it or teleporting it away.
- **undo mid-draw** — 3 vertices, the BUTTON takes it 3 → 2 → 1, then Ctrl+Z → 0.
- **plans do not leak** — plan A's interior wall does not follow the user onto plan B,
  and edits survive switching away and back.

## Deliberate cuts (not built, and why)

- **Per-tile floor painting.** Every consumer planner uses per-room fill; per-tile is a
  game mechanic that buys nothing when the output is a shopping list.
- **`floorZoneStore` left unwired.** It is dead scaffolding (`addZone` has zero callers).
  Wiring it naively would have priced floors at Rs 0 via the catalog id mismatch. Left in
  place, unreferenced, until a per-tile zone painter is actually wanted.
- **Wall-graph / derived rooms.** Both research tracks say storing walls and *deriving*
  rooms is the ideal model. It would also throw away the attached-room work that just
  shipped, for no benefit Vic asked for. Openings, floor finish and naming were all taken
  from that research without needing derivation.
- **Room move/drag, door drag-along-wall, window sill editing.** v1 remedy for a
  misplaced opening is click-to-remove and re-place.
- **Shared-wall stroke dedupe.** Two coincident strokes read as one thicker load-bearing
  wall; accepted, and unchanged from before.

## Defects found and NOT silently folded in

These are real, pre-existing, and verified identical on `main` by checking out `main` and
re-running — not assumed.

1. **The e2e suite is substantially red on `main`.**
   - `wall-draw.spec.ts` ×2 — the spec looks for a button named `Wall`; the UI says
     `+ Walls`. The wall tool has had no working e2e coverage for some time.
   - `customer-ui-mobile-2026-05-31.spec.ts` ×2, `inline-interaction-2026-05-31.spec.ts`
     ×3, `design-tweak-1-phase-a0.spec.ts` ×1.
   - `k1-critical-paths.spec.ts` has a `test.use({ defaultBrowserType })` inside a
     `describe`, which **aborts a whole-suite run** before anything executes. That is why
     nobody has seen the other failures.
2. **Wall inner-half dimming.** The inner half of every wall renders blended with the room
   fill (`146,119,71`) rather than pure gold `#E8A33D`. Cosmetic, pre-existing, but it
   defeats the gold pixel-scan on shared walls — which is why the new specs discriminate
   on hue (warm `r > b`) rather than brightness, and why the coordinate basis moved to
   geometry in P0.
3. **Six surfaces still operate on the active room only** while the canvas shows every
   room: TopBar L/W + item count, DetailsPanel, FloatingCluster, ClearControls,
   RoomEstimatePanel, placementActions. `designStore.projectFromProperty` is the cause.
4. **Export/PDF capture the active room only** (`RoomCanvas.tsx:771` admits it).
5. **Schema-version guards are no-ops.** Both `migrate()` guards test `version >= 2`
   rather than the current version, so a future bump to v3 would silently not run.
6. **Not audited at all**: merchant-capture subsystem, MerchantAgentPage, the Marketplace
   cart, admin surfaces. "Check all functionalities" is not fully answered.

## Traps for whoever picks this up

- `normaliseLoadedRoom` **whitelists** fields. Any new field on `Room` survives a reload
  but is deleted on the first save/load round trip. `openings` and `floorFinish` both had
  to be added there in the same commit; there are round-trip tests for both.
- The plan layer must stay `listening={false}`. The Stage commit handlers guard on
  `e.target !== stage`, so anything listening under the cursor kills placement silently.
- Items must stop listening while a product is armed, or an armed click landing on an
  existing item dies with no ghost, no toast and no placement.
- No new API routes: the deploy is at 12/12 Vercel functions. Nothing here needs one —
  the server stores `property` as opaque JSON.

---

## Appendix — DESIGNER-MULTIROOM-ATTACH-2026-08-26 brief: gates re-executed 2026-08-28

The attached-multi-room brief's implementation phases were completed and merged
before this session (`bd230e1`…`4a1b7b6`, deploy record `07e883d`). Its gates were
re-run **verbatim in this session** against `main` @ `b7a735f` to confirm the shipped
state still satisfies them:

| Phase | Gate | Result |
|---|---|---|
| §1 | clean tree · `tsc --noEmit` | clean · exit 0 |
| P0 | testid inventory (brief expects 133) | **133** |
| P0 | before/after captures on disk | present (1 before, 8 after) |
| P1 | `roomLayout.test.ts` | **33/33** |
| P2 | FULL `vitest run` | **1716 passed / 149 files** |
| P3 | `npm run build` | clean |
| P3 | `multiroom-render` | pass · `MULTIROOM_RENDER=true` |
| P4 | `multiroom-placement` + `placement-fsm` + `wall-aware-placement` | pass · `ROOM_ROUTE=true` |
| P5 | `multiroom-attach` | pass · `DRAW_ATTACH=true` |
| P6 | `git ls-remote` vs local for `feat/designer-multiroom-attach-2026-08-26` | both `fa69c72` |
| P7 | merge `4a1b7b6` ancestor of `main` | true |
| P7 | cache-busted healthcheck ×3 | `b7a735f` (main HEAD) all three |
| P7 | Playwright vs PRODUCTION | `rendered=2`; drop into non-active room → `r1=0, r2=1`; focus followed to `r2`; **0 console errors** |

12/12 e2e green. Evidence shot: `after/p7-prod-reverify-2026-08-28.png`.

The brief's gates also still pass on THIS branch (its three multiroom specs are in the
25-test run above), so the doors/flooring/undo/naming/pages work does not regress it.

---

## DEPLOY — merged and live, 2026-08-28 (Vic-approved)

Merge SHA **`c512997389d0514783a3deceef4446b50e428345`**.

Gates on merged `main` before push: `tsc` clean · `vitest` **1837 passed / 157 files** ·
`npm run build` clean · **20/20** e2e.

Live verification on `https://designer.ppwellness.co`:

- Cache-busted healthcheck: `{"commit":"c512997…","env":"production"}` — reached on the
  7th poll (6 stale reads first, as expected).
- Playwright against production, seeded with a two-room plan:

  | Check | Result |
  |---|---|
  | rooms rendered | `[multi-room] rendered=2` |
  | door in the SHARED wall | openings `[1, 0]` |
  | floor finish, per-room | `["rubber-composite", null]` |
  | product placed ON the floored room | items `[1, 0]` |
  | room names | `["Treatment Room", "Sauna"]` — no ordinals |
  | Plans tab strip | visible |
  | console errors | **0** |

- Evidence shot: `after/prod-live-c512997.png`.

---

## E2E SUITE REPAIR — merged and live, 2026-08-28 (Vic-approved)

Merge SHA **`4f2ef75`**, live on production (6th poll, stale reads first).
Branch `fix/e2e-suite-red-2026-08-28`.

### The blocker

`k1-critical-paths.spec.ts` had `test.use({ ...devices['iPhone 12'] })` inside a
`describe`. The spread carries `defaultBrowserType: 'webkit'`, and Playwright refuses a
browser-type change inside a describe — which **aborted the entire run before a single
test executed**. That is why nobody saw the suite had gone red: it never reported
failures, it reported a parse-time error. One line; it revealed ~35 failing tests.

### Triage — 10 read-only diagnosticians, one per spec

| Verdict | Count |
|---|---|
| STALE_TEST | 22 |
| RETIRE | 2 |
| ENVIRONMENT_ONLY | 2 |
| PASSES_NOW | 1 |
| **REAL_APP_BUG** | **1** |

Two root causes explain most of it, neither an app defect:

1. **Blank canvas on open** (2026-06-09, hardened by `80fe1c5`) — a fresh designer holds
   one room with an EMPTY polygon, so `findRoomAt()` correctly refuses every drop. Older
   specs assumed a 5×4 m room was already there and were placing into nothing.
2. **Route moved** (`2026-07-26`, Vic directive 5) — `/` is the SHOP; the designer is at
   `/designer`. Five k1 PCFs and four auto-dig journeys asserted designer surfaces
   against the shop page.

Plus: the CoachMark modal intercepts TopBar clicks unless its flag is seeded; the wall
toggle is `+ Walls` (`wall-tool-toggle`), not `Wall`; the catalog moved from
ProductPalette to SimsDock (`role=tab`, not `button`); and the precision figure moved out
of the cost badge into the area/zoom/snap chip.

### No assertion was weakened. Three were strengthened.

- **A.C.2** now pins the dock **and** that it lists product tiles — the old search-input
  probe never checked the "shows products" its own title claimed.
- **A.API.3** pins `401 missing_session` exactly. The old `[400,404,405,500]` tolerated
  statuses that would mean an unauthenticated caller had reached the Blob token-minting
  branch, and was loose enough to pass against a vite `404` — proving nothing.
- **PCF-1** pins the `m-` API namespace instead of a SKU name the BUNDLED seeds also
  satisfy, so it would have gone green with the API completely dead.

### Retired, with reasons

- **V4 banner** — `V4Banner.tsx` was deleted in `ef5817c`; nothing to recover, so deleted.
- **Babylon acceptance** — `test.skip`, NOT deleted: the 3D toggle still exists in
  `TopBar.tsx` (~:632) and is merely unwired in `App.tsx`. Dormant, not removed.

### Environment gating that never masks a real failure

- Specs needing Vercel functions skip **only** on localhost (`vite dev` serves no `/api/*`).
- Specs needing the dev geometry bridge (`window.__ppwGeom`, absent from production by
  design) skip **only** where it is absent.
- `customer-ui-mobile` needs `VITE_TEST_HOOKS=1`; **verified 2/2 green** against a
  hooks-enabled server before the guard was added, so it is not dead coverage.

Every skip names the exact command that runs it.

### One genuine app fix

`testHooks.hitReselect` left a Konva drag ARMED in `_dragElements` after its synthetic
mousedown. The next real pointer move dragged the item and swallowed the click. Disarmed.

### Result — 0 failures, both environments

| Target | Passed | Skipped | Failed |
|---|---|---|---|
| production `4f2ef75` | **97** | 30 | **0** |
| dev server | 96 | 31 | **0** |

`tsc` clean · `vitest` 1837/157 · `build` clean · eslint 0 errors on changed files.

### ⚠ FLAGGED FOR VIC — a real regression, deliberately NOT fixed here

The **eco-only filter chip** shipped in `d38075a` (2026-05-23, "default OFF per Vic
#WDA-1") and lived in `ProductPalette.tsx` until the 2026-08-25 Sims rebuild unmounted
that component. `SimsDock` and `SimsBottomToolbar` have no eco filter, and a live probe
finds zero eco chips on `/designer` **or** `/products`. No rebuild commit mentions
dropping it, so it reads as collateral loss rather than a decision.

Test `A.C.9` was hiding it behind a false `"not in prod build yet (pre-PR #20)"` skip.
Restore-or-retire is a product call — it was a Vic decision and it matters for the
Sustainability Dept eco-bar.

### ⚠ Scope note: the auto-dig specs are GITIGNORED

`.gitignore:77` ignores `tests/e2e/auto-dig-*.spec.ts`. Those 5 fixes (4 route moves +
1 timeout) are **on this machine only** and are not in the repo, so a fresh clone or CI
will not have those specs at all. That matches their design as local diagnostic audits,
but it means "0 failures" for the committed suite excludes them.
