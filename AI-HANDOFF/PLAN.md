# The world plan: stages, order and rules (the copy that lives in this repo)

Copied 2026-11-20 by Fable from the owner's plan of 18 Nov 2026 (changed 19 and 20 Nov). The full plan, with the owner's words, is a private file outside this repo; the paste line that starts a builder chat names it. This copy holds what a builder needs inside the repo. This repo is public: no company, person, partner, price, phone or place of ours is written here, and no other game's name.

Two AIs build this in turns, Fable (Claude) and GPT (Codex), each carrying on from the other through the four files in this folder. One world, two fronts: this web app (phones, tablets, laptops) and a desktop game in Unreal Engine 5.8 (its own private repo, with the same `AI-HANDOFF/` folder). Both read and write the same design through the same server. Nothing is built twice.

## The stages

Each ends with something the owner can see.

| Stage | What is built | Front | What the owner sees at the end |
|---|---|---|---|
| 0 Scan | Read-only. Every tool, view, format, route, test and cap of the web app, one line each, with a verdict: keep as is, make friendlier, bring into the game. The design format drawn as one page. A tool-by-mode table: for every tool, how it is used in each of the three play modes (first person with powers; the 3D build view; block-style digging and placing), which mode suits it best, and what is missing so that it works in all three, on the web front and in the game. | web (read) | `AI-HANDOFF/INVENTORY.md`: the tool list to tick |
| 1 Rails | `AI-HANDOFF/` in both repos; the private game repo created and proven (exists, private, `git ls-remote` equals HEAD); CI green; the bug rule in both repos' `PLAN.md`. A test hand-off: a fresh chat with only the paste line continues from `NEXT-PROMPT.md`. | both | A fresh chat picks up with no help |
| 2 World format | The design format v2, read by both fronts: walls as straight or arc segments with exact geometry, plot with a map reference and a height field, products with company and model number, cost lines, members and roles. One schema with a version number replaces the two hand-kept load lists (`src/store/propertyStore.ts`, `normaliseLoadedProperty`), so a new field is never lost. Import adds IFC and glTF/OBJ; export adds glTF (3D), STL (for a 3D printer) and 3D view sheets to the PDF. | web + server | Open a design, export it in 3D, import a DXF and an IFC |
| 3 Accurate 2D | Curved walls as true arcs (centre, radius, angles) that snap to the grid and to each other with exact dimensions; corners where arcs meet straights closed correctly; dimensions shown live; print as today (PDF, SVG). Inside the Konva lock. | web | Draw a curved wall, see its exact length, print it |
| 4 Friendlier 3D build | The 3D build mode made quick: pick, drop, move, turn, snap; roof tools; the catalogue in a side tray with search; the city joined to the house model so a plot sits inside a city; the whole scene no longer rebuilt on every edit (instancing, partial rebuild); a frame-rate figure measured on a laptop and on a phone. | web | Build a small house from nothing in 3D in two minutes, on the phone too |
| 5 Island map | The whole island as the base map (free OpenStreetMap tiles, free elevation data); pick any plot by tapping or drawing, or upload a photo or PDF of a land plan and the AI traces the outline and sizes it from a stated length; the plot becomes the design's site with real slope. | web + server | Pick a plot on the island; the house sits on it with the real slope |
| 6 Companies | Company accounts (merchant pages exist); add products by form, by CSV, by a product feed, or by reading the company's own website with its written yes; every product carries company, model number, size in mm, price (database only); photo-to-3D for a true-scale model (paid calls only on the owner's word). An inventory page per company. | web + server | A company adds five products; they appear in the catalogue at true size |
| 7 Costs | The cart: every placed product times quantity times price; labour lines: trade, number of people, hours, rate (rate sets from Trade Folder, by link or by file, a live link later); VAT on or off; split between people; a dashboard total that updates while building; export as PDF and CSV. Prices never on open pages. | web + server | A live total while building, with the people and the hours |
| 8 Many players | Several people in one design at once with roles (owner, builder, plumber, electrician, painter, viewer), presence, object locks, a change log, invite by link; built on the shared-build store; the live channel chosen after measuring (the store as it is, or a free realtime service; nothing paid). | web + server | Two phones edit one house and see each other |
| 9 Modes | Lite (phone), Standard (tablet, laptop), High (strong PC), chosen by the device and changeable by the user; the same design in every mode; the quality tiers that exist become the switch. | web | The same design on a phone and on a laptop, smooth on both |
| 10 MCP that builds | The MCP server grows from read-only to build: add a room, place a product, set a wall, run the cost, under a per-user key and the same server check as shared builds. | server | An AI builds a room in a design through MCP |
| 11 The Unreal front | The desktop game, seven steps: (1) the feel: walk, run, jump, first and third person, telekinesis; (2) a design loaded at true scale; (3) build mode: grid building, the 2D plan with dimensions, the 3D build camera, undo, save back; (4) trades: pipes and cables that connect, construction stages, dig and fill; (5) looks; (6) merchants; (7) a packaged Windows build. Plus: the jetpack; the tool bar in the air (pick a tank or a panel, place it on the roof); Unreal multiplayer with the same roles; save back to the same design. Plus (20 Nov): every build tool works in first person, following the tool-by-mode table of stage 0; telekinesis moves anything, up to a whole building on its plot; the walk view and the 3D build view switch at the spot where the character stands; a trench dug, a wire laid along it, an electrical box placed; every such edit saved to the design so the other views show it. Runs on a plain laptop at low settings; best looks on a strong PC. | game | Fly onto the roof, place a solar panel, walk inside |
| 12 VR | The Unreal front on a headset (OpenXR). Needs hardware the owner does not have yet. | game | The house in VR |
| 13 Characters | A set of our own characters and a builder (body, face, clothes, trade kit). Free base assets only. | both | Pick or build a character |
| 14 Packages | Feature flags per account: 2D only, 3D only, Build (2D, 3D, walk), World (map, many players), Company dashboard, the Unreal client. Prices are the owner's and never in any file here. A kid mode: simple tools, no strangers, no chat. | web + server | A company sees only what it bought |
| 15 Fun and look | A modern look pass (one system of colour, type and spacing; words and shapes, never colour alone), onboarding, sounds, quests that use the counts the lesson layer already reads, small rewards for finishing a build. | both | A first-time user builds something in five minutes and wants more |

## The order (fixed, so no word is needed)

0, 1, 11, 2, 3, 5, 7, 6, 4, 9, 8, 10, 13, 14, 15, 12.

The owner can change it with one line in the driving chat: `do <n> next`. Stage 11 loads today's design format; stage 2 upgrades both fronts after it.

A stage is done when its "sees" line is true and proven (a clip, three screenshots or the preview link, written in `PROGRESS.md`) and its PR is open and green. The chat then writes one line to the owner: the preview link and `merge <PR>`. It does not wait: it starts the next stage on a branch stacked on the open one. After a merge, `main` is merged forward into the open branches (never a rebase of a pushed branch). A PR is always opened against `main`: CI only runs on PRs based on `main`.

## The frame

1. The design file is the truth: one `Property` JSON (`src/store/propertyStore.ts`) holds the house, the plot, the city and the eco study. The server holds designs, products, companies, prices, members and sessions. The game loads a design from the server and saves back to it.
2. Keep every technical tool; make it friendlier (fewer taps, plain words, the result on screen, a short lesson card). Nothing is removed without the owner's word `drop <tool>`.
3. Original. Mechanics of the genres (life-sim build mode, open-world movement, block building, city maps); never another game's name, art, characters, sounds, UI text or look, in code, assets, commit lines or words on screen.
4. Free first: free map data, free engine content, free tiers only. Anything paid waits for the owner's word `spend <what> <figure>`.
5. Sync rule: one design object in memory on the web (plan, 3D and walk read it); between people through the session store; between the web and the game through the server, by design id and version. A save with an old version number is refused and reloaded, never merged blind.

## The hand-off files (read first, write last, every session)

| File | Holds | Written |
|---|---|---|
| `PLAN.md` | this file | stage 1; then only when the owner changes the plan or the order |
| `PROGRESS.md` | append-only lines: date and time MU, who (Fable or GPT), stage, what was done, commit, tests result, the next step; a "Found, not fixed" list; the rollback deployment of every web merge | at every commit and at the end |
| `NEXT-PROMPT.md` | the exact state for the next chat, any AI | rewritten at EVERY commit, so a chat that dies on a limit loses nothing |
| `DRIVER.md` | one line: who drives this repo now, since when (MU), on which paste | by the chat that takes the wheel |
| `INVENTORY.md` | the stage 0 scan: the tool list, the design format, the tool-by-mode table | stage 0; updated when a stage adds or changes a tool |

Rules:

1. A session that ends without `PROGRESS.md` and `NEXT-PROMPT.md` up to date is a broken session. The next chat says so to the owner in one line and rebuilds the two files from `git log` before building anything.
2. Every commit is pushed and proven (`git ls-remote` equals HEAD). An unpushed commit is not a hand-off. Commit small and often.
3. Work on branches; one PR per stage to `main`; a merge only on the owner's `merge <PR>` typed in the driving chat. The hand-off files travel on the working branch and reach `main` with every merge. Never a force-push.
4. This repo is public: these files never carry a company, a person, a partner, a price, a phone, a place of ours, a recipe or a mix. Prices and companies are data in the database, never text in a file.
5. The paste into a chat makes that chat the driver. On the paste: `git fetch`, read `DRIVER.md`. If it names you, continue from `NEXT-PROMPT.md`. If it names the other AI, take over: write `DRIVER.md` with your name, the time and "taken over on the owner's paste", commit, push.
6. On a takeover the working folder may hold the other AI's unfinished work. Never discard it: commit it on its branch as `wip: taken over from <name> <time>`, push, then read it and finish it or note it under "Found, not fixed". If `PROGRESS.md` and `NEXT-PROMPT.md` are older than the last commit, rebuild them from `git log` and the diff first.
7. At every commit, `git fetch` and re-read `DRIVER.md` from `origin`. If it names the other AI with a later time, you were replaced: push your branch, append one line to `PROGRESS.md`, tell the owner "replaced by <name> at <time>; stopped", and do nothing more.
8. Before every heavy step (an Unreal build, a big install, a long test run) measure free RAM and disk. Under 4 GB RAM or under 15 GB on C:, stop with the line "Close <program or chat>, then type `continue`".
9. Anything that waits on the owner (a merge, a yes, a close, a buy, a click) goes in `NEXT-PROMPT.md` under "WAITING ON THE OWNER" with the exact word. A waiting merge never blocks the next stage.

## Laws of this repo

1. No public post. No spend. No permanent deletion. No key, PIN or code value in any file, commit or chat line. Nothing sent, spent, merged, deployed or made public without the owner's word typed in the chat that does it.
2. One driver per repo at any moment, by `DRIVER.md`.
3. The 2D plan's Konva lock (commit `26c144c`) stays. The server stays at 12 functions: new server work folds into a router plus one rewrite line in `vercel.json`. Tests green on every PR. No prices on open pages. Every web merge is proven live (a cache-busted read of the live site showing the new build) and its rollback deployment is written in `PROGRESS.md`.
4. Company websites are read only with that company's written yes, and only their own site.
5. Big third-party files (engine store content, scans, samples) never go into git: a manifest lists them so they download again. The game repo is never made public.
6. The bug rule: a bug found on the way is fixed in the same branch when it is in the stage's files, with a test. A bug outside the stage's files is written in `PROGRESS.md` under "Found, not fixed" with its path and line, never silently skipped. Tests green before every PR. Never a skipped or deleted test to make a run green.

## The owner's words

| Word | What it does |
|---|---|
| the paste line | starts or resumes the relay in that chat; takes the wheel from the other AI |
| `merge <PR>` | merges that stage's PR to `main`; on this repo the live site changes; the chat proves it live and writes the rollback |
| `continue` | after the owner closed what the chat asked to close, or answered a waiting line |
| `stop` | finish the step, write the hand-off files, push, do nothing more |
| `do <n> next` | changes the order: that stage comes next |
| `drop <tool>` | removes a tool the scan marked for removal |
| `spend <what> <figure>` | the one paid step named |

The chat stops with one line and the exact word for: a merge to `main`; spending money; dropping a tool; making any repo or page public that is not public now; deleting anything for good; changing a sign-in door, a payment path or a price; reading a website that is not a consenting company's own; a stage that needs hardware the owner does not have (stage 12).

## Stage 2 in steps (written by the builder on 2026-11-22; the stage's line in the table above is the owner's)

Stage 2 is too big for one sitting, so it is built in steps, each proven before the next, all on the branch `world/s02-world-format` and in ONE PR. A step is "seen" when its line in the last column is true and proven; the stage is done when all of them are.

| Step | What | Seen when |
|---|---|---|
| 2.1 Open a design file | The plan import opens a whole design: this app's own design object as JSON, the design inside a project hand-over file, and what the desktop game saves (the same object). It is cleaned as every opened design is, reviewed, and added as a NEW plan; the plan on screen is kept. | A house saved by the game is opened in the web app |
| 2.2 Save a design file | A button that downloads the design as a file by itself (today a design leaves the app only inside the hand-over file). | A design is saved to a file and opened again, the same |
| 2.3 One schema, with a version | One schema of the whole design with a version number takes the place of the two hand-kept load lists (`propertyStore.ts`: the storage merge and `normaliseLoadedProperty`). A key the schema does not know is KEPT, not dropped. The findings of stages 0 and 11 that are about the format are settled here (`PROGRESS.md`). | A field this build does not know survives open and save |
| 2.4 The new fields of version 2 | Walls as straight or arc segments with exact geometry (the drawing of arcs is stage 3); the plot with a map reference and a height field; products with company and model number; cost lines; members and roles (`RULE-ROLES.md`). Old designs open as before. | A version 1 design opens; a version 2 design keeps its new parts |
| 2.5 3D out | Export glTF (3D) and STL (for a 3D printer) from the 3D view; 3D view sheets in the PDF. | A house is exported in 3D and opens in another program |
| 2.6 Drawings and models in | DXF with arcs; IFC; glTF and OBJ. A new package is free and has a licence that allows it, or it waits for the owner's word. | A DXF and an IFC are imported |
| 2.7 The game reads version 2 | The game repo: its reader and writer follow the one schema. | The game opens and saves a version 2 design |
