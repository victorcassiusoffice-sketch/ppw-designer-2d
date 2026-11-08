# Lessons inventory: every tool and mode, where it is picked, what teaches it today

Read 8 Nov 2026 on `main` `db1096f`, in a local dev build of this branch before any lessons code (`node tools/lessons/inventory-shot-2026-11-08.mjs http://127.0.0.1:5181 docs/lessons/inventory`). Screenshots: `docs/lessons/inventory/<device>-<id>.jpg` at 1280 x 800 (desktop) and 390 x 844 (phone). Every non-GET request was blocked. Report: `inventory-report.json` (30 picks, 30 ok after one re-run of the phone 3D pick, whose first script used a hidden test id).

## Where the tools live in code

| List in code | Values | File |
|---|---|---|
| `BuildTool` (plan tools, also used in 3D) | hand, eyedropper, sledgehammer, door, measure, floor, wallpaint, cladding | `src/store/designerUIStore.ts` |
| `DesignerMode` (the old mode strip; the strip was removed on 1 Jun 2026, the words stay) | move, wall, floor, paint, inspect, buy | `src/designer/useDesignerMode.ts` |
| 3D House tools (`BuildingControlsProps['tool']`) | select, wall, room, stair, window, door | `src/components/BuildingControls.tsx`, shown by `HouseWorkspace.tsx` |
| Views | plan, 3d (`designerUIStore.viewMode`); Walk (`src/walk/`, lane A) | |

The wall pen is not a `BuildTool`: it is `useDrawProgressStore.enabled`. A blank plan opens with the pen already in hand (Victor, 8 Sep 2026: "straight to draw").

## The 17 lessons (one per tool or mode)

| Lesson id | From the code | Picked on desktop (1280) | Picked on the phone (390) | Teaches it today | Screens |
|---|---|---|---|---|---|
| `select` | `BuildTool` hand · mode move · 3D select | Build, Finish or Arrange shelf → **Select**; key H; Esc returns to it | the active-tool chip in the strip, the shelf, or Menu → Select | button `title` (desktop hover only); `?` key list | desktop-select, phone-select |
| `walls` | mode wall (pen) · 3D wall | Build → **Walls**, or **Custom** | Build shelf → Walls; Menu → Walls | the pen bar: "Drag a wall or click corners", Make room / Done / Undo; `?` key list | desktop-walls, phone-walls |
| `room` | 3D room · plan Room box | Build → **Room** (box size), or the "5 x 4 m room" button on the pen bar; 3D: Draw room | Build shelf → Room; the pen bar's "5 x 4 m room" | `title` "Box — a rectangular room; set its size"; toast after a box room | desktop-room-box, phone-room-box |
| `door` | `BuildTool` door · 3D door and window | Build → **Openings** (Door, Doorway, Window, Hole; F flips, H swaps the hinge) | Menu → Door; Build shelf → Openings | the door bar; `title`; `?` key list | desktop-door, phone-door |
| `stairs` | 3D stair | 3D House → Build → Stairs (needs a second floor) | the 3D build tool picker | 3D tool line (`BuildingControls` toolHelp) | desktop-view3d |
| `floor` | `BuildTool` floor · mode floor | Finish → **Floor**; a floor card in Furnish | Menu → Floor; Finish shelf → Floor | the docked Floor panel; phone card "Tap a tile · drag an area"; `?` key list | desktop-floor, phone-floor |
| `wallpaint` | `BuildTool` wallpaint · mode paint | Finish → **Paint** | Menu → Wall paint; Finish shelf → Paint | the docked Paint panel; `title` | desktop-wallpaint, phone-wallpaint |
| `cladding` | `BuildTool` cladding | Finish → **Cladding** (sample boards) | Menu → Cladding; Finish shelf | `title` | desktop-cladding, phone-cladding |
| `measure` | `BuildTool` measure | Arrange → **Measure**; key M | Arrange shelf → Measure | `title`; `?` key list | desktop-measure, phone-measure |
| `remove` | `BuildTool` sledgehammer · 3D Remove | Arrange → **Remove**; key J | Menu → Remove; Arrange shelf | the remove card on the canvas; `title` | desktop-remove, phone-remove |
| `eyedropper` | `BuildTool` eyedropper | key **E** only (no button) | none (keyboard only) | one line in the `?` key list | desktop-eyedropper, phone-eyedropper |
| `item` | mode inspect | Select, then click an object | Select, then tap an object | the selection buttons; `?` key list | (needs an object; shown in the quest proof) |
| `furnish` | mode buy | **Furnish** capsule at the bottom; 3D: Furnish | **Furnish** capsule at the bottom | "Drag into your design"; the empty-room card "Your room is empty" | desktop-furnish, phone-furnish |
| `view3d` | `viewMode` 3d | **3D House** in the header | **3D** in the strip | `title`; the 3D help line "Drag to orbit · two fingers or Shift-drag to pan" | desktop-view3d, phone-view3d |
| `walk` | Walk mode (lane A) | 3D House → **Walk** | 3D → **Walk** | the Walk chooser's own "How to walk" card | desktop-walk, phone-walk |
| `garden` | garden panel | **Garden** on every shelf; 3D: Garden | Garden on the shelf | `title` | desktop-garden, phone-garden |
| `help` (the list itself) | `?` launcher | **?** bottom right | **?** bottom right (hidden while a tool card or the pen owns the bottom) | the key list | desktop-help, phone-help |

## What teaches the Designer today (before this part)

| Surface | Where | State on `main` |
|---|---|---|
| `CoachMark` (3 steps) | `src/components/uxKit.tsx`, used in `App.tsx` | switched off (`{false && ...}`) since 8 Sep 2026: a modal in front of the first click |
| House build guide (19 review steps) | `src/components/HouseBuildTutorial.tsx` | opens only on the `olb:open-house-tutorial` event; collapses when a tool starts |
| `?` key list | `src/designer/HelpOverlay.tsx` | a modal list of keys; no lessons, nothing ticked |
| Button `title` text | `src/components/TopBar.tsx` | long sentences, desktop hover only, slow, nothing on a phone |
| Tool bars and phone cards | pen bar, door bar, Floor / Paint / Cladding / Door / Remove cards | one short line each; no picture, no "first time" moment |
| Empty-room card | the canvas | "Your room is empty ... Drag a product onto the floor" |
| 3D tool line | `BuildingControls.tsx` (3D) | one status line while a 3D tool is on |
| Walk "How to walk" | `src/walk/WalkMode.tsx` (lane A) | its own card; not touched here |

## Game feel today

| Feedback | Today |
|---|---|
| Placement ghost green or red | yes: `GHOST_VALID_*` / `GHOST_INVALID*` in `src/designer/blueprintTheme.ts` (mint and terracotta) |
| Selection outline | yes: `SELECT_STROKE` on walls, a ring on openings |
| Snapping | yes, measured (0.5 m by default); no pulse when a point lands |
| Drop-in when an object lands | no |
| Sounds | none |
| Loading screens | "Loading 3D · Preparing your measured design" (`Loading3D.tsx`), Walk's spinner, City's "Building your city in 3D…"; no tips |
