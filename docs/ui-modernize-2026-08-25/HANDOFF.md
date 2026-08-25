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
