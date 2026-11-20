# Next prompt (rewritten at every commit)

Written 2026-11-20 13:37 MU by Fable.

## Where we are

Stage 0 (the scan), step 1 of 3. Branch `world/s00-s01-scan-rails`, made from `main` at `d678c92`. Only `AI-HANDOFF/` has been added. No code has changed.

## Continue

Read `PLAN.md` and `PROGRESS.md` in this folder first.

1. Stage 0, the scan (read-only on the code). Write `AI-HANDOFF/INVENTORY.md` with three parts:
   - every tool, view, format, route, test family and cap of the web app, one line each, with a verdict: keep as is, make friendlier, bring into the game;
   - the design format (`Property` in `src/store/propertyStore.ts`) drawn as one page;
   - the tool-by-mode table: for every tool, how it is used in first person with powers, in the 3D build view, and in block-style digging and placing; which mode suits it best; what is missing so that it works in all three, on the web front and in the game.
   Raw notes go in `AI-HANDOFF/scan/`, one file per area, so a chat that stops mid-scan loses nothing. If that folder already holds notes, read them and scan only the areas that are missing.
2. Stage 1, the rest of the rails: create the private game repo from its folder on the build machine, with the same `AI-HANDOFF/` folder; prove it (exists, private, `git ls-remote` equals HEAD); open this branch's PR against `main` and get CI green; run the test hand-off (a fresh chat with only the paste line continues from this file).
3. Then stage 11 (the Unreal front) in the game repo, as `PLAN.md` orders.

## WAITING ON THE OWNER

(nothing)
