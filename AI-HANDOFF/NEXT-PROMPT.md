# Next prompt (rewritten at every commit)

Written 2026-11-22 03:58 MU by Fable.

## Where we are

Stage 2 (world format) is under way on the branch `world/s02-world-format`, made from `world/s00-s01-scan-rails` (stages 0 and 1, PR #82, open, waits for the owner's merge word). Stage 11 (the game) is seen in all seven steps in the game repo; its PR there waits for the owner's word too.

| Piece | State |
|---|---|
| Stage 2, its seven steps | `PLAN.md`, "Stage 2 in steps" |
| 2.1 Open a design file | BUILT and tested (`src/designer/designFile.ts`, `src/components/PlanImportWorkspace.tsx`; 9 new tests); a real file saved by the game was read whole. SEEN in a browser on a local server: a house the game saved is opened as a new plan |
| 2.2 Save a design file | BUILT and tested (`saveDesign` in `src/components/ProjectWorkspace.tsx`; `designFileText`, `designFileName`; 2 new tests: saved and opened again, the same design). SEEN in a browser on a local server |
| 2.3 One schema, with a version | SEEN (22 Nov): a key this build does not know is kept in every part of a design (`src/designer/unknownKeys.ts`, the names in `src/designer/designFormat.ts`); the format version is read and a newer file says so; a section this build cannot read is kept aside under `unread` by ONE reader that both load lists use (`readSections` in `src/store/propertyStore.ts`). The whole suite passes. MIND: what the loading of a design uses must be declared ABOVE the store in `src/store/propertyStore.ts` or be a `function`; three commits of this branch (`324147d`, `5c21deb`, `773e8a1`) did not load a stored design at page start for that reason, repaired since, and `src/store/__tests__/startUpLoad.test.ts` holds it. The rest is in "Continue", point 2 |
| 2.4 to 2.7 | not started |
| The stage's PR | #83, a draft against `main`, stacked on #82 |
| Stages 0 and 1 | DONE: `INVENTORY.md` (147 tool rows, 845 inventory lines, 240 caps), `scan/` (six notes, `make-inventory.py`, `_inventory-head.md`), the rails in both repos; PR #82 |
| Rules written for both fronts | `RULE-CONNECTED.md` (a pipe or a cable is connected), `RULE-ROLES.md` (the six roles of a shared house) |
| Findings for this repo | `PROGRESS.md`, "Found, not fixed": from the scan, from stage 11 (21 and 22 Nov), from stage 2 |

PR #82 adds files under `AI-HANDOFF/` and one two-line `.npmrc` (without it `npm ci` fails on CI for every PR: a dependency's install script downloads a file that is gone). This branch is stacked on it, so its PR shows those files too until #82 is merged.

## Continue

Read `PLAN.md` (its last chapter: stage 2 in steps) and `PROGRESS.md` in this folder first.

1. Steps 2.1 and 2.2 are seen (tests, and a browser on a local server: `node_modules/.bin/vite --port 5199 --strictPort`, then a script with the repo's own browser test tool; the project workspace opens on the event `olb:open-project`, the plan import on `ppw:open-plan-import`). No screenshot of the designer goes into this repo or its PRs: its screen shows a basket total. Next is step 2.3.
2. Step 2.3 is SEEN (22 Nov): a field this build does not know survives open and save in every part of a design, on both load paths; the names of every part are in ONE table, `src/designer/designFormat.ts`. A new field: add its name to its part's table there and clean it in that part's loader. What the step does not cover is one entry in `PROGRESS.md`, "Found, not fixed" ("Step 2.3, what it does NOT cover"): read it before step 2.4; its points 1 and 2 are rules for the new fields. Then step 2.4, the new fields of version 2, in this order: (a) write the format down for both fronts in ONE document (every key of version 1 from the table, its unit and meaning; the rules: carried fields, sections kept aside, the version number, no new kind in an old list); (b) walls as straight or arc segments (an arc given relative to its two ends, so that a build that moves an end without knowing arcs leaves a sound wall); (c) the plot: its map reference and its heights ARE in version 1 already, as `site.world` (`src/site/types.ts`: `origin`, `boundary`, `terrain`, `publicData.terrain`): write them into the document, add nothing without need; (d) a placed thing says which product it is without the catalogue: company and model number (fields only; no company's name in any file of this public repo); (e) cost lines; (f) members and roles (`RULE-ROLES.md`). Old designs open as before; the number 2 is written only by a design that holds a version 2 part. MIND, every time a load path is touched: run `src/store/__tests__/startUpLoad.test.ts`, the whole suite, AND load a stored design in a real browser (the suite passed once with every stored design lost at page start).
3. When the owner types `merge web 82`: merge PR #82 with a merge commit (never a squash), prove the live site still serves (a cache-busted read), write the rollback deployment in `PROGRESS.md`, and merge `main` forward into this branch.
4. The laws of this repo hold at every step: the Konva lock, 12 server functions, tests green, no price on an open page, no company, person, price or site of ours in these files.

To change the inventory: edit a note in `scan/` or the top in `scan/_inventory-head.md`, then run `python AI-HANDOFF/scan/make-inventory.py` from the repo root.

## WAITING ON THE OWNER

- `merge web 82`: merges PR #82 (stages 0 and 1: files under `AI-HANDOFF/` and a two-line `.npmrc`; no page changes). Asked 2026-11-20 14:57 MU. Not answered yet. It does not block stage 11.
