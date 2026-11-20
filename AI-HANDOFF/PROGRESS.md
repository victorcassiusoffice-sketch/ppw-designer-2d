# Progress (append-only)

One line per step: date and time MU, who, stage, what was done, commit, tests, next step. Newest at the bottom.

## Lines

- 2026-11-20 13:37 MU, Fable, stage 1 (rails first, so the relay can hand over): branch `world/s00-s01-scan-rails` made from `main` at `d678c92`; `AI-HANDOFF/` created with `PLAN.md`, `PROGRESS.md`, `NEXT-PROMPT.md`, `DRIVER.md`. Docs only, no code touched, no tests run. Stages 0 and 1 share this one branch and one PR on this repo (both only add files in `AI-HANDOFF/`). Next: stage 0, the scan.

- 2026-11-20 13:47 MU, Fable, stage 1: the private game repo exists (`olb-game`, private, `main` at `1669b76`, `git ls-remote` equal to HEAD), with the same `AI-HANDOFF/` folder. Its work branch is `world/s11-unreal-front`.
- 2026-11-20 14:05 MU, Fable, stage 0: scan notes for two of six areas are in `AI-HANDOFF/scan/` (`TOOLS-PLAN.md`: 191 items, 45 tools; `CITY-SITE-ECO.md`: 187 items, 36 tools). Read-only on the code; no tests run. Next: the other four notes, then `INVENTORY.md`.

## Found, not fixed

Found by the stage 0 scan. Each is outside the files of stages 0 and 1, so it is listed here and not changed.

- Another game's name is written in about 146 files under `src/` (two file names, test ids, CSS variables, comments: for example `src/designer/sunPosition.ts:6`, `src/components/RoomView3D.tsx:1123`, `src/components/RoomCanvas.tsx:146`). The plan's frame, point 3, forbids it. A rename touches tests that match text, so it needs its own careful pass (stage 15 at the latest).
- Supplier names with prices sit in source files of this public repo (`src/components/GardenPanel.tsx:20-27`, `src/components/EnergyPanel.tsx:40-43`, `src/data/serviceProducts.ts:47-51`). The rule is prices in the database only. Stage 6 or 7 moves them.
- The Plot tool drops the map site when Lock is pressed (`src/components/TopBar.tsx:487`).
- The Orders "Packages" view disappears in three of the four languages (`src/components/CityOrdersPanel.tsx:156` with `src/i18n/messages.ts:525`).
- The garden and the plot's `world` payload have no server check, and the garden has no count cap (`api/_lib/designSnapshotValidation.ts:37-59`).
- The city and the eco study load as nothing when one value is bad (all-or-nothing checks).
- Rules that disagree, which a second front would have to copy: three default wall thicknesses (0.10, 0.12, 0.15 m); the turn step is 45 degrees on keys and 90 in the details panel; wall height is 2 to 4 m for a house and 2 to 8 m for a storey. Stage 2 picks one of each.

## Rollback deployments (one line per web merge)

(no merge yet)
