# Next prompt (rewritten at every commit)

Written 2026-11-20 14:26 MU by Fable.

## HAND-OFF TEST (stage 1) IS RUNNING: read this block first

If you are a fresh chat that received only the paste line and nothing else, you are the test chat. This is your one job; it replaces the "Continue" list below.

1. Prove you found your place. Append ONE line at the end of the "Lines" list in `AI-HANDOFF/PROGRESS.md` (above "## Found, not fixed"), in the same shape as the other lines: the date and time (measure it), `hand-off test`, the branch you are on, the short commit you started from (`git rev-parse --short HEAD`), the number of the PR you find for this branch (`gh pr list --head world/s00-s01-scan-rails`), and, in your own words, the next step you would take in each of the two repos (from the two `NEXT-PROMPT.md` files).
2. Commit that one line on this branch with the message `Hand-off test: a fresh chat found its place`, push, and prove that `git ls-remote origin refs/heads/world/s00-s01-scan-rails` equals `git rev-parse HEAD`.
3. Stop and report what you did. Build nothing, change nothing else, and do not touch the game repo: the driving chat removes this block and carries on.

If you are the driving chat, or a chat taking over on the owner's paste while this block is still here (the test chat died): delete this block, write one line in `PROGRESS.md` that the test did not finish, and go to "Continue".

## Where we are

Stage 0 (the scan) is written. Stage 1 (rails) is nearly done. Branch `world/s00-s01-scan-rails`, made from `main` at `d678c92`.

| Piece | State |
|---|---|
| `AI-HANDOFF/INVENTORY.md` (the tool list to tick, the design format, everything else one line each) | done: 147 tool rows, 845 inventory lines, 240 caps |
| `AI-HANDOFF/scan/` (six area notes, the script `make-inventory.py`, the hand-written top `_inventory-head.md`) | done |
| Rails in both repos, the private game repo proven | done (see `PROGRESS.md`) |
| PR #82 against `main`: "World stages 0 and 1: the scan and the hand-off rails" | open; checks running after a CI fix (below) |
| The test hand-off | running (the block above) |

The PR adds files under `AI-HANDOFF/` and one two-line `.npmrc`. The `.npmrc` is the fix GPT made on its own branch (commit `7d15481`, brought in with `git cherry-pick -x`): without it `npm ci` fails on CI for every PR, because a dependency's install script downloads a file that is no longer there (404). No other code, test, config or page changed.

## Continue

Read `PLAN.md` and `PROGRESS.md` in this folder first.

1. Check PR #82: `gh pr checks 82`. Needed green: Typecheck, Vitest, Secrets, Vercel. The Lighthouse check is red on every PR of this repo and is not one of the four. When the four are green, write it in `PROGRESS.md` and put the merge word under "WAITING ON THE OWNER". The merge is only on the owner's word `merge web 82`.
2. Stage 11 (the Unreal front) runs in the game repo; its own `AI-HANDOFF/NEXT-PROMPT.md` says where it stands. The web repo has no stage 11 work yet.
3. The next web stage is 2 (world format): start it on a branch stacked on this one, `world/s02-world-format`, and open its PR against `main`.

To change the inventory: edit a note in `scan/` or the top in `scan/_inventory-head.md`, then run `python AI-HANDOFF/scan/make-inventory.py` from the repo root.

## WAITING ON THE OWNER

(nothing yet; the merge word `merge web 82` is asked for when the four checks are green)
