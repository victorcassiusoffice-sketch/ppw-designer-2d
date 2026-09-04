# REBIRTH BOOT — Sims-world Designer builder

> For a fresh Claude Code session in this repo. Read this whole file, then the
> read-first list, then verify ground truth before touching anything.

## What you are

The builder for the Sims-style room designer on branch
`feat/sims-world-2026-08-29` in `C:\Users\Victor\Documents\PPW-Code\ppw-designer-2d`.
Vic tests on the branch preview and merges himself when satisfied.

**LAW: preview-only.** Never merge, never push `main`, never promote to
production. Feature-branch commits + pushes are autonomous. Konva stable-lock
holds (additive Konva shapes fine, no engine swap). Vercel Hobby 12-fn cap —
no new API routes. Money-path files (PayPal/Stripe/cart/orders) get extra care.

Test link:
`https://ppw-designer-2d-git-feat-sims-world-2026-08-29-victor-ppw.vercel.app/designer`

## Read first (absolute paths)

1. `C:\Users\Victor\Documents\PPW-Code\ppw-designer-2d\docs\sims-world-2026-08-29\02-HANDOFF.md`
   — Rounds 1–9, every shipped fix with commits + proof. THE state document.
2. Project auto-memory loads with the session (traps + patterns index).
3. If a task touches doors/floors/walls history:
   `docs\sims-world-2026-08-29\doors-2026-08-31\00-FINDINGS.md` and
   `walls-select-reset-2026-08-31\00-FINDINGS.md`.

## State at rebirth (2026-09-04)

- HEAD = `e2b0b66`, remote == local, preview healthcheck serves it.
- Defect backlog EMPTY. Shipped this workstream: corner-snap engage fix,
  toolbar redesign, ONE Floor tool, door fixes, walls-straight/Select/Fit/
  Clear-all, Remove tool, cart-page floor lines, **Sofap wall-paint tool**
  (5 real Permoglaze products, tin-fill algorithm, 2.5D wall lift only while
  wall tools armed), **objects-topdown closure** (34 MB PNGs → 1.6 MB WebP;
  wall items draw plan bars and lamp/garden items draw symbols BY DESIGN).
- Suites at last gate: vitest 2276/2276 (176 files) · Playwright
  **160 passed / 0 failed / 38 env-gated skips** · tsc 0 · build clean.

## Boot verification (do these, cite output)

```
git -C C:\Users\Victor\Documents\PPW-Code\ppw-designer-2d rev-parse HEAD
git -C C:\Users\Victor\Documents\PPW-Code\ppw-designer-2d ls-remote origin feat/sims-world-2026-08-29
curl -s "https://ppw-designer-2d-git-feat-sims-world-2026-08-29-victor-ppw.vercel.app/api/healthcheck?cb=<random>"
```

All three must agree before any work. The healthcheck is edge-cached — ALWAYS
cache-bust.

## The gate ritual (every round)

tsc 0 → eslint TOUCHED FILES ONLY (base has ~21 pre-existing errors in
untouched files — not yours) → vitest full → `npm run build` → full Playwright
`--workers=3` vs the dev server → captures → restore historical PNGs
(`git checkout -- docs/designer-build-2026-08-28 docs/multiroom-2026-08-26`;
never stage `docs/ui-modernize-2026-08-25` dirty PNGs) → commit → push → poll
preview healthcheck for the SHA → deployed smoke → append `02-HANDOFF.md` +
vault handoff `C:\Users\Victor\Documents\PPW-Second-Brain\06-Roadmap\_handoff\DESIGNER-SIMS-WORLD-2026-08-29.md`
+ project memory. Commit trailer:
`Co-Authored-By: Claude <model name> <noreply@anthropic.com>`.

Dev server (must be running for e2e):

```
npx vite --port 5188 --strictPort --host 127.0.0.1
```

## Traps that have bitten before

- **Whitelist normalisers** in `propertyStore.ts` (`normaliseLoadedRoom`,
  `normaliseFreeWalls`, property-level): any new persisted field NOT carried
  there silently vanishes on the first save/load round trip.
- Persist envelopes: `ppw_property_v2` `{state:{property,showGrid,pxPerMetre},version:2}`;
  UI store partialize (precision, lastPrecision, floorDraft.materialId,
  wallPaintDraft.paintId) — `tests/e2e/units.spec.ts` asserts the EXACT shape.
- One-pointer gesture contract on tap tools (door/floor/wallpaint): Stage
  pointerdown records, pointerup consumes with 10 px slop — never add a
  parallel click path (multi-fire).
- Winding: polygons canonicalise CW (y-down) at draw-commit + load; edge
  indices in `wallPaint` are post-canonicalisation.
- HUD cards publish `--draw-hud-h`; docked panels publish `--floor-panel-w`
  (shared by Floor + Wall paint via `sidePanelOpen`); canvas fit insets on both.
- e2e canvas clicks: DEV geom bridge `window.__ppwGeom.worldToScreen`
  (helpers in `tests/e2e/multiroom-helpers.ts`); on the deployed preview use
  `window.Konva.stages[0]` transforms instead.
- Playwright `page.goto('/cart')` can hang on a REUSED designer page in
  scratch scripts — use fresh contexts for cart/checkout probes.
- Product images are 640px WebP now — never commit multi-MB PNGs; new art
  goes through the same Pillow → WebP pass.
- Chaining build + full Playwright in ONE Bash call hits the 10-min timeout —
  separate calls.

## Style (Vic)

Terse. No preamble/postamble. Numbered steps for action chains. Code blocks
for paths/commands. Every done/live claim carries this-run proof. When lost:
read the handoff, don't guess.
