# Next prompt (rewritten at every commit)

Written 2026-11-22 03:08 MU by Fable.

## Where we are

Stage 2 (world format) is under way on the branch `world/s02-world-format`, made from `world/s00-s01-scan-rails` (stages 0 and 1, PR #82, open, waits for the owner's merge word). Stage 11 (the game) is seen in all seven steps in the game repo; its PR there waits for the owner's word too.

| Piece | State |
|---|---|
| Stage 2, its seven steps | `PLAN.md`, "Stage 2 in steps" |
| 2.1 Open a design file | BUILT and tested (`src/designer/designFile.ts`, `src/components/PlanImportWorkspace.tsx`; 9 new tests); a real file saved by the game was read whole. Not yet seen in a browser |
| 2.2 to 2.7 | not started |
| Stages 0 and 1 | DONE: `INVENTORY.md` (147 tool rows, 845 inventory lines, 240 caps), `scan/` (six notes, `make-inventory.py`, `_inventory-head.md`), the rails in both repos; PR #82 |
| Rules written for both fronts | `RULE-CONNECTED.md` (a pipe or a cable is connected), `RULE-ROLES.md` (the six roles of a shared house) |
| Findings for this repo | `PROGRESS.md`, "Found, not fixed": from the scan, from stage 11 (21 and 22 Nov), from stage 2 |

PR #82 adds files under `AI-HANDOFF/` and one two-line `.npmrc` (without it `npm ci` fails on CI for every PR: a dependency's install script downloads a file that is gone). This branch is stacked on it, so its PR shows those files too until #82 is merged.

## Continue

Read `PLAN.md` (its last chapter: stage 2 in steps) and `PROGRESS.md` in this folder first.

1. Step 2.1, what is left: see it in a browser (the dialog "Plan import", a design file chosen, the review, "Add as a new plan"); a screenshot for the PR. Then step 2.2: a button that saves the design as a file by itself (the hand-over file's download is in `src/components/ProjectWorkspace.tsx:210-235`; the design object is `usePropertyStore.getState().property`), and a test that a design saved and opened again is the same after `normaliseLoadedProperty`.
2. Step 2.3 is the heart of the stage: one schema with a version in place of the two hand-kept lists. Read `INVENTORY.md`, "Loading and saving" (lists A and B, field by field, and the eight ways a field is dropped today) before touching `src/store/propertyStore.ts`. Keep every existing test green at every commit; a key the schema does not know must survive.
3. When the owner types `merge web 82`: merge PR #82 with a merge commit (never a squash), prove the live site still serves (a cache-busted read), write the rollback deployment in `PROGRESS.md`, and merge `main` forward into this branch.
4. The laws of this repo hold at every step: the Konva lock, 12 server functions, tests green, no price on an open page, no company, person, price or site of ours in these files.

To change the inventory: edit a note in `scan/` or the top in `scan/_inventory-head.md`, then run `python AI-HANDOFF/scan/make-inventory.py` from the repo root.

## WAITING ON THE OWNER

- `merge web 82`: merges PR #82 (stages 0 and 1: files under `AI-HANDOFF/` and a two-line `.npmrc`; no page changes). Asked 2026-11-20 14:57 MU. Not answered yet. It does not block stage 11.
