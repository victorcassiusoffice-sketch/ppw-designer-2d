# Next prompt (rewritten at every commit)

Written 2026-11-22 04:25 MU by Fable.

## Where we are

Stage 2 (world format) is under way on the branch `world/s02-world-format`, made from `world/s00-s01-scan-rails` (stages 0 and 1, PR #82, open, waits for the owner's merge word). Stage 11 (the game) is seen in all seven steps in the game repo; its PR there waits for the owner's word too.

| Piece | State |
|---|---|
| Stage 2, its seven steps | `PLAN.md`, "Stage 2 in steps" |
| 2.1 Open a design file | BUILT and tested (`src/designer/designFile.ts`, `src/components/PlanImportWorkspace.tsx`; 9 new tests); a real file saved by the game was read whole. SEEN in a browser on a local server: a house the game saved is opened as a new plan |
| 2.2 Save a design file | BUILT and tested (`saveDesign` in `src/components/ProjectWorkspace.tsx`; `designFileText`, `designFileName`; 2 new tests: saved and opened again, the same design). SEEN in a browser on a local server |
| 2.3 One schema, with a version | SEEN (22 Nov): a key this build does not know is kept in every part of a design (`src/designer/unknownKeys.ts`, the names in `src/designer/designFormat.ts`); the format version is read and a newer file says so; a section this build cannot read is kept aside under `unread` by ONE reader that both load lists use (`readSections` in `src/store/propertyStore.ts`). The whole suite passes. MIND: what the loading of a design uses must be declared ABOVE the store in `src/store/propertyStore.ts` or be a `function`; three commits of this branch (`324147d`, `5c21deb`, `773e8a1`) did not load a stored design at page start for that reason, repaired since, and `src/store/__tests__/startUpLoad.test.ts` holds it. The rest is in "Continue", point 2 |
| 2.4 The new fields of version 2 | THE PARTS ARE BUILT AND SEEN IN A BROWSER (22 Nov): curved walls, the products in use, cost lines, members, the number 2. Left: the format's document for both fronts ("Continue", point 2) |
| 2.5 to 2.7 | not started |
| The stage's PR | #83, a draft against `main`, stacked on #82 |
| Stages 0 and 1 | DONE: `INVENTORY.md` (147 tool rows, 845 inventory lines, 240 caps), `scan/` (six notes, `make-inventory.py`, `_inventory-head.md`), the rails in both repos; PR #82 |
| Rules written for both fronts | `RULE-CONNECTED.md` (a pipe or a cable is connected), `RULE-ROLES.md` (the six roles of a shared house) |
| Findings for this repo | `PROGRESS.md`, "Found, not fixed": from the scan, from stage 11 (21 and 22 Nov), from stage 2 |

PR #82 adds files under `AI-HANDOFF/` and one two-line `.npmrc` (without it `npm ci` fails on CI for every PR: a dependency's install script downloads a file that is gone). This branch is stacked on it, so its PR shows those files too until #82 is merged.

## Continue

Read `PLAN.md` (its last chapter: stage 2 in steps) and `PROGRESS.md` in this folder first.

1. Steps 2.1 and 2.2 are seen (tests, and a browser on a local server: `node_modules/.bin/vite --port 5199 --strictPort`, then a script with the repo's own browser test tool; the project workspace opens on the event `olb:open-project`, the plan import on `ppw:open-plan-import`). No screenshot of the designer goes into this repo or its PRs: its screen shows a basket total. Next is step 2.3.
2. Step 2.3 is SEEN (22 Nov). Step 2.4: THE NEW PARTS ARE BUILT AND SEEN IN A BROWSER (22 Nov): curved walls (`src/designer/arcSegment.ts`: `bulge` on a free wall, `wallArcs` on a room), the products in use, cost lines and members (`src/designer/formatV2.ts`), the number 2 (`src/designer/designFormat.ts`), the export at three exits (`src/lib/designExport.ts`). LEFT OF STEP 2.4: the format's document for both fronts, `docs/DESIGN-FORMAT.md`: every key of every part with its unit and meaning (the names are in `src/designer/designFormat.ts`), the conventions (metres, which way y grows, which way an outline winds after loading, what an edge number is), the rules (carried fields; sections kept aside under `unread`; the number; no new kind in an old list, new lists kind to unknown kinds; no money in a design), the arc's exact definition (the head of `arcSegment.ts`), and what each front does NOT do yet. A test should hold the document to the table (every name in `designFormat.ts` stands in the document). Then step 2.5 (3D out: glTF, STL, 3D sheets in the PDF), 2.6 (DXF with arcs: a DXF bulge is this format's bulge with the sign changed when y is turned over; IFC; glTF and OBJ in), 2.7 (the game reads version 2: it must keep `products`, `costLines`, `members`, `formatVersion`, `wallArcs`, `bulge` and `unread` on save, and draw a curved wall from the same sums). What step 2.3 does not cover is one entry in `PROGRESS.md`, "Found, not fixed". MIND, every time a load path is touched: run `src/store/__tests__/startUpLoad.test.ts`, the whole suite, AND load a stored design in a real browser (the suite passed once with every stored design lost at page start). The scripts for the browser are not in the repo (they hold nothing secret, they are the builder's own): put a design into `localStorage` under `ppw_property_v2`, reload, read `usePropertyStore.getState().property` through `import('/src/store/propertyStore.ts')`.
3. When the owner types `merge web 82`: merge PR #82 with a merge commit (never a squash), prove the live site still serves (a cache-busted read), write the rollback deployment in `PROGRESS.md`, and merge `main` forward into this branch.
4. The laws of this repo hold at every step: the Konva lock, 12 server functions, tests green, no price on an open page, no company, person, price or site of ours in these files.

To change the inventory: edit a note in `scan/` or the top in `scan/_inventory-head.md`, then run `python AI-HANDOFF/scan/make-inventory.py` from the repo root.

## WAITING ON THE OWNER

- `merge web 82`: merges PR #82 (stages 0 and 1: files under `AI-HANDOFF/` and a two-line `.npmrc`; no page changes). Asked 2026-11-20 14:57 MU. Not answered yet. It does not block stage 11.
