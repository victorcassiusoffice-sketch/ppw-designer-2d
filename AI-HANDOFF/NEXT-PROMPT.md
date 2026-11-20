# Next prompt (rewritten at every commit)

Written 2026-11-20 14:05 MU by Fable.

## Where we are

Stage 0 (the scan), step 1 of 3: the raw notes. Branch `world/s00-s01-scan-rails`, made from `main` at `d678c92`. Only `AI-HANDOFF/` has been added. No code has changed.

Scan notes in `AI-HANDOFF/scan/`, one file per area:

| File | State |
|---|---|
| `TOOLS-PLAN.md` (the 2D plan and the toolbar) | done, committed |
| `CITY-SITE-ECO.md` (city sheet, site and land, eco) | done, committed |
| `FORMAT.md` (the design format) | not committed yet |
| `BUILD-3D-WALK.md` (3D build view, walk, geometry rules) | not committed yet |
| `SERVICES-TRADES.md` (pipes, cables, trades, costing) | not committed yet |
| `ROUTES-SERVER-TESTS.md` (routes, server, catalogue, tests, caps) | not committed yet |

Stage 1 so far: the rails are in both repos; the private game repo exists and is proven (see `PROGRESS.md`).

## Continue

Read `PLAN.md` and `PROGRESS.md` in this folder first.

1. Stage 0: for each note above that is missing from the folder, scan that area and write it (same headings as the notes that exist: inventory with a verdict, tool by mode, caps, rules a second front must copy, traps, not read). Then write `AI-HANDOFF/INVENTORY.md` from the six notes, in three parts:
   - every tool, view, format, route, test family and cap of the web app, one line each, with a verdict: keep as is, make friendlier, bring into the game;
   - the design format (`Property` in `src/store/propertyStore.ts`) drawn as one page;
   - the tool-by-mode table: for every tool, how it is used in first person with powers, in the 3D build view, and in block-style digging and placing; which mode suits it best; what is missing so that it works in all three, on the web front and in the game.
2. Stage 1, the rest: open this branch's PR against `main` and get CI green; run the test hand-off (a fresh chat with only the paste line continues from this file).
3. Stage 11 (the Unreal front) runs in the game repo; its own `AI-HANDOFF/NEXT-PROMPT.md` says where it stands.

## WAITING ON THE OWNER

(nothing)
