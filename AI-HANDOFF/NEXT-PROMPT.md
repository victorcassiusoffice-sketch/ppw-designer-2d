# Next prompt (rewritten at every commit)

Written 2026-11-20 14:18 MU by Fable.

## Where we are

Stage 0 (the scan) is written. Stage 1 (rails) is nearly done. Branch `world/s00-s01-scan-rails`, made from `main` at `d678c92`. Only `AI-HANDOFF/` has been added. No code has changed.

| Piece | State |
|---|---|
| `AI-HANDOFF/INVENTORY.md` (the tool list to tick, the design format, everything else one line each) | done: 147 tool rows, 845 inventory lines, 240 caps |
| `AI-HANDOFF/scan/` (six area notes, the script `make-inventory.py`, the hand-written top `_inventory-head.md`) | done |
| Rails in both repos, the private game repo proven | done (see `PROGRESS.md`) |
| The PR of this branch against `main`, CI green | next |
| The test hand-off (a fresh chat with only the paste line continues from this file) | next |

## Continue

Read `PLAN.md` and `PROGRESS.md` in this folder first.

1. If no PR exists for this branch: open one against `main` (title "World stages 0 and 1: the scan and the hand-off rails"). It adds only files under `AI-HANDOFF/`. Wait for the four checks (Typecheck, Vitest, Secrets, Vercel). Write the PR number here and in `PROGRESS.md`. The merge waits for the owner's word `merge web <PR>`.
2. Run the test hand-off and write its result in `PROGRESS.md`.
3. Stage 11 (the Unreal front) runs in the game repo; its own `AI-HANDOFF/NEXT-PROMPT.md` says where it stands. The web repo has no stage 11 work yet. The next web stage is 2 (world format); start it on a branch stacked on this one: `world/s02-world-format`.

To change the inventory: edit a note in `scan/` or the top in `scan/_inventory-head.md`, then run `python AI-HANDOFF/scan/make-inventory.py` from the repo root.

## WAITING ON THE OWNER

(nothing yet; the merge word comes when the PR is green)
