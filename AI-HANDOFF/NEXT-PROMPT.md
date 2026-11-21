# Next prompt (rewritten at every commit)

Written 2026-11-22 03:00 MU by Fable.

## Where we are

Stage 0 (the scan) and stage 1 (rails) are DONE: PR #82 is open and its four checks are green. It waits for the owner's merge word. Branch `world/s00-s01-scan-rails`, made from `main` at `d678c92`.

| Piece | State |
|---|---|
| `AI-HANDOFF/INVENTORY.md` (the tool list to tick, the design format, everything else one line each) | done: 147 tool rows, 845 inventory lines, 240 caps |
| `AI-HANDOFF/scan/` (six area notes, the script `make-inventory.py`, the hand-written top `_inventory-head.md`) | done |
| Rails in both repos, the private game repo proven | done (see `PROGRESS.md`) |
| PR #82 against `main`: "World stages 0 and 1: the scan and the hand-off rails" | open; Typecheck, Vitest, Secrets and Vercel green at 14:57 MU on `1876609` (a later docs commit runs them again) |
| `AI-HANDOFF/RULE-CONNECTED.md`: when a pipe or a cable is connected, one rule for both fronts | new on 21 Nov, from the game (stage 11, step 4); the web is to copy it |
| `AI-HANDOFF/RULE-ROLES.md`: the six roles of a shared house, one rule for both fronts | new on 22 Nov, from the game (stage 11, step 7); stage 8 is to copy it, or change it there first |
| Findings from stage 11 for this repo | nine of 21 Nov and nine of 22 Nov, at the end of "Found, not fixed" in `PROGRESS.md` (two of 22 Nov are NEEDS: a model a second front can read, and a model for a merchant's own product); five points more in the inventory's "What is missing" (8 to 12) |
| The test hand-off | PASSED 14:28 MU: a fresh chat with only the paste line found its place, wrote its line, pushed (`ffc2423`) and stopped |

The PR adds files under `AI-HANDOFF/` and one two-line `.npmrc`. The `.npmrc` is the fix GPT made on its own branch (commit `7d15481`, brought in with `git cherry-pick -x`): without it `npm ci` fails on CI for every PR, because a dependency's install script downloads a file that is no longer there (404). No other code, test, config or page changed.

## Continue

Read `PLAN.md` and `PROGRESS.md` in this folder first.

1. Stage 11 (the Unreal front) is SEEN in all seven steps in the game repo (22 Nov); its PR there waits for the owner's word. The building goes on HERE, with point 3.
2. When the owner types `merge web 82`: merge PR #82 with a merge commit (never a squash), prove the live site still serves (a cache-busted read), write the rollback deployment in `PROGRESS.md`, and merge `main` forward into any open branch.
3. The next web stage is 2 (world format): start it on a branch stacked on this one, `world/s02-world-format`, and open its PR against `main`. Read first what stage 11 found for this repo (`PROGRESS.md`, the nine findings of 21 Nov and the nine of 22 Nov; `INVENTORY.md`, "What is missing", points 8 to 12; `RULE-CONNECTED.md`): several of them are stage 2's to settle, and the two needs about models are stage 6's. A check that fails with `npm ci` and a 404 means the branch lacks the two-line `.npmrc` of this PR.

To change the inventory: edit a note in `scan/` or the top in `scan/_inventory-head.md`, then run `python AI-HANDOFF/scan/make-inventory.py` from the repo root.

## WAITING ON THE OWNER

- `merge web 82`: merges PR #82 (stages 0 and 1: files under `AI-HANDOFF/` and a two-line `.npmrc`; no page changes). Asked 2026-11-20 14:57 MU. Not answered yet. It does not block stage 11.
