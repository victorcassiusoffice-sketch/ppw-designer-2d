# Next prompt (rewritten at every commit)

Written 2026-11-20 14:30 MU by Fable.

## Where we are

Stage 0 (the scan) and stage 1 (rails) are done in files and proven; only the four checks of PR #82 are still running. Branch `world/s00-s01-scan-rails`, made from `main` at `d678c92`.

| Piece | State |
|---|---|
| `AI-HANDOFF/INVENTORY.md` (the tool list to tick, the design format, everything else one line each) | done: 147 tool rows, 845 inventory lines, 240 caps |
| `AI-HANDOFF/scan/` (six area notes, the script `make-inventory.py`, the hand-written top `_inventory-head.md`) | done |
| Rails in both repos, the private game repo proven | done (see `PROGRESS.md`) |
| PR #82 against `main`: "World stages 0 and 1: the scan and the hand-off rails" | open; checks running after a CI fix (below) |
| The test hand-off | PASSED 14:28 MU: a fresh chat with only the paste line found its place, wrote its line, pushed (`ffc2423`) and stopped |

The PR adds files under `AI-HANDOFF/` and one two-line `.npmrc`. The `.npmrc` is the fix GPT made on its own branch (commit `7d15481`, brought in with `git cherry-pick -x`): without it `npm ci` fails on CI for every PR, because a dependency's install script downloads a file that is no longer there (404). No other code, test, config or page changed.

## Continue

Read `PLAN.md` and `PROGRESS.md` in this folder first.

1. Check PR #82: `gh pr checks 82`. Needed green: Typecheck, Vitest, Secrets, Vercel. The Lighthouse check is red on every PR of this repo and is not one of the four. When the four are green, write it in `PROGRESS.md` and put the merge word under "WAITING ON THE OWNER". The merge is only on the owner's word `merge web 82`.
2. Stage 11 (the Unreal front) runs in the game repo; its own `AI-HANDOFF/NEXT-PROMPT.md` says where it stands. The web repo has no stage 11 work yet.
3. The next web stage is 2 (world format): start it on a branch stacked on this one, `world/s02-world-format`, and open its PR against `main`.

To change the inventory: edit a note in `scan/` or the top in `scan/_inventory-head.md`, then run `python AI-HANDOFF/scan/make-inventory.py` from the repo root.

## WAITING ON THE OWNER

(nothing yet; the merge word `merge web 82` is asked for when the four checks are green)
