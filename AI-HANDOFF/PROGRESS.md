# Progress (append-only)

One line per step: date and time MU, who, stage, what was done, commit, tests, next step. Newest at the bottom.

## Lines

- 2026-11-20 13:37 MU, Fable, stage 1 (rails first, so the relay can hand over): branch `world/s00-s01-scan-rails` made from `main` at `d678c92`; `AI-HANDOFF/` created with `PLAN.md`, `PROGRESS.md`, `NEXT-PROMPT.md`, `DRIVER.md`. Docs only, no code touched, no tests run. Stages 0 and 1 share this one branch and one PR on this repo (both only add files in `AI-HANDOFF/`). Next: stage 0, the scan.

- 2026-11-20 13:47 MU, Fable, stage 1: the private game repo exists (`olb-game`, private, `main` at `1669b76`, `git ls-remote` equal to HEAD), with the same `AI-HANDOFF/` folder. Its work branch is `world/s11-unreal-front`.
- 2026-11-20 14:05 MU, Fable, stage 0: scan notes for two of six areas are in `AI-HANDOFF/scan/` (`TOOLS-PLAN.md`: 191 items, 45 tools; `CITY-SITE-ECO.md`: 187 items, 36 tools). Read-only on the code; no tests run. Next: the other four notes, then `INVENTORY.md`.
- 2026-11-20 14:13 MU, Fable, stage 0: three more scan notes committed (`BUILD-3D-WALK.md`: 119 items, 35 tools, 117 geometry rules; `SERVICES-TRADES.md`: 191 items, 31 tools; `ROUTES-SERVER-TESTS.md`: routes, server, catalogue, tests, caps). A few lines about who may call which route are kept in a private review note outside this public repo. Next: the design format note, then `INVENTORY.md`.
- 2026-11-20 14:18 MU, Fable, stage 0 done in files: the sixth note (`scan/FORMAT.md`: 468 field lines of the design format) and `INVENTORY.md` (147 tool rows with a home mode each: 72 in the 3D build view, 40 block-style, 35 in first person; 845 inventory lines; 240 caps; a short list of 24 tool families to tick at the top). Built by `scan/make-inventory.py` from the six notes. Read-only on the code; no tests run. Next: the PR and its checks, then the test hand-off.
- 2026-11-20 14:26 MU, Fable, stage 1: PR #82 opened against `main`. Its first run failed on Typecheck and Vitest for a reason outside this branch: `npm ci` fails on CI because a dependency's install script downloads a file that is gone (404). Fixed by bringing in GPT's two-line `.npmrc` from its own branch (commit `7d15481`, `git cherry-pick -x`, now `646de49`). Checks are running again. The game repo's PR is #1 there (stage 11, stays open). The test hand-off is set up in `NEXT-PROMPT.md`. Next: the test hand-off, then the four checks.
- 2026-11-20 14:28 MU, Fable (a fresh chat that received only the paste line), stage 1, hand-off test: found its place from the hand-off files alone. Branch `world/s00-s01-scan-rails`; started from commit `1d7b527`, equal to the remote branch; the PR for this branch is #82 (open, against `main`). `DRIVER.md` names the driving chat, so the wheel was not taken. The next step I would take in this repo: `gh pr checks 82`; when Typecheck, Vitest, Secrets and Vercel are green, write it here and put the word `merge web 82` under "WAITING ON THE OWNER"; then start stage 2 (world format) on `world/s02-world-format`, stacked on this branch, with its own PR against `main`. The next step I would take in the game repo (branch `world/s11-unreal-front`; its PR #1 is already open, so there is none to open): step 11.2, the house, beginning with the design model that parses the design JSON, keeps the whole tree and writes back only what changed, with tests, then the storey table. Docs only: this one line, no code touched, no tests run, the game repo not touched. Next: the driving chat removes the test block from `NEXT-PROMPT.md` and carries on.

## Found, not fixed

Found by the stage 0 scan. Each is outside the files of stages 0 and 1, so it is listed here and not changed.

- Another game's name is written in about 146 files under `src/` (two file names, test ids, CSS variables, comments: for example `src/designer/sunPosition.ts:6`, `src/components/RoomView3D.tsx:1123`, `src/components/RoomCanvas.tsx:146`). The plan's frame, point 3, forbids it. A rename touches tests that match text, so it needs its own careful pass (stage 15 at the latest).
- Supplier names with prices sit in source files of this public repo (`src/components/GardenPanel.tsx:20-27`, `src/components/EnergyPanel.tsx:40-43`, `src/data/serviceProducts.ts:47-51`). The rule is prices in the database only. Stage 6 or 7 moves them.
- The Plot tool drops the map site when Lock is pressed (`src/components/TopBar.tsx:487`).
- The Orders "Packages" view disappears in three of the four languages (`src/components/CityOrdersPanel.tsx:156` with `src/i18n/messages.ts:525`).
- The garden and the plot's `world` payload have no server check, and the garden has no count cap (`api/_lib/designSnapshotValidation.ts:37-59`).
- The city and the eco study load as nothing when one value is bad (all-or-nothing checks).
- Rules that disagree, which a second front would have to copy: three default wall thicknesses (0.10, 0.12, 0.15 m); the turn step is 45 degrees on keys and 90 in the details panel; wall height is 2 to 4 m for a house and 2 to 8 m for a storey. Stage 2 picks one of each.
- Read from code, not run: the admin approve and reject buttons post to a path the router does not route (`src/pages/admin/MerchantDetailPage.tsx:122,150` against `api/admin-router.ts:72-86`).
- Three product category lists that do not match: 17 in the type (`src/data/products.schema.ts:29-62`), 10 in the import wizard (`src/lib/merchants/catalogImport.ts:7`), 8 in the add form (`src/pages/productForm.ts:2-11`).
- The merchant dashboard shows 100 products at most (`src/pages/MerchantDashboardPage.tsx:103`).
- The secrets-scan allow-list names a folder that does not exist (`.gitleaks.toml:19`).
- The 12-function cap has no check in CI (`api/__tests__/paintCalcDispatch.test.ts:207-219`).
- `src/designer/openingPlacement.ts` has one byte that is not valid UTF-8 at line 53.
- Services: nothing checks that a network works. A run end joins a fixture port or a junction, and the only fault signals are warnings (`src/designer/serviceConnections.ts:109-115, 226-294`; `src/designer/projectReview.ts:441`). Trade rates are parsed by code that has no caller (`parseRateCard`). Stage 7 and stage 11, step 4, build on this.
- The design has no version and the stored row has none; a load from the server copies only named fields, so a new field is lost unless it is added to `normaliseLoadedProperty` (`src/store/propertyStore.ts:2225-2301`). Stage 2 replaces the two hand-kept lists with one schema.
- In a shared room, moving one item replaces the room's whole item array, so two people moving items in one room clash (`src/sharedBuild/contract.ts:129-136`). Stage 8.
- A draft import accepts `terrainCuts` and `boundaryComponents` and never copies them into the design (`src/designer/aiDesignProperty.ts:58-83`).
- Three leftovers cannot be reached by a user: the old millimetre wall tool (state, layer, bar) and a hidden 3D preview switch (`scan/TOOLS-PLAN.md`, items 3, 66 and 139). They stay until the owner types `drop <tool>`.
- Security review items found by the scan are listed in a private note outside this public repo, not here.

## Rollback deployments (one line per web merge)

(no merge yet)
