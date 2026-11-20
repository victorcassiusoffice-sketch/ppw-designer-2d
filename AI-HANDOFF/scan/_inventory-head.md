# INVENTORY: what the web app has today, and where each tool goes (stage 0, the scan)

Made 2026-11-20 by Fable from six read-only notes in `AI-HANDOFF/scan/` (code at `d678c92`, the live `main`). Nothing was run or changed. Every line in the notes carries its file and line. This file is built from the notes by `scan/make-inventory.py`: edit the notes, then run the script.

## The short answer

- The web app has {{TOOL_TOTAL}} tool rows across four areas (some tools show up in two areas, for example Dig and fill), {{INVENTORY_TOTAL}} inventory lines (tools, views, panels, routes, tables, test families) and {{CAPS_TOTAL}} caps.
- Every tool stays. Many get two verdicts at once: make it friendlier on the web, and bring it into the game. Three leftovers cannot be reached by a user today (the old millimetre wall tool: its state, its layer and its bar; and a hidden 3D preview switch). They stay until the owner types `drop <tool>`.
- Each tool was given a home mode, the mode where it is quickest. It still has to work in the other two.

| Home mode | Tool rows |
|---|---|
{{BEST_TABLE}}

## The three play modes, and what goes where

| Mode | What it is | The tools that live there |
|---|---|---|
| First person with powers | Walk, run, jetpack. Aim at a thing, lift it, carry it, turn it, set it down. | Anything you do standing in the place: move furniture, hang a wall product, put a thing on a table, place a tank or a panel on the roof, set a door or a window in the wall you look at, paint a wall, switch a light, plug a pipe end into a fixture, plant a tree, stretch a shade sail. |
| 3D build view | The camera above the house. Click and drag. Opens at the spot where the character stands. | Layout work: draw rooms and walls, type a wall length, storeys, stairs, roof shape and outline, the plot, garden outlines, fixtures with typed sizes, the city sheet, every panel with numbers. |
| Block-style dig and place | Piece by piece, cell by cell. | Ground and piece work: dig and fill, trenches, a pipe or a cable laid along a trench, an electrical box set in, foundations, building a wall up, floor tiles and paving one by one, fences, the pool, breaking a piece out. |

The 2D plan stays what it is: the exact drawing with dimensions, for print.

## The tool families (the short list to tick)

Tick a line if the home mode and the three ways to use it are right. The full table, tool by tool, is Part 1.

| Tick | Family | Home mode | First person | 3D build view | Block-style |
|---|---|---|---|---|---|
| [ ] | Move, turn, copy and remove a thing | 3D | Lift it, carry it, scroll to turn, set it down on the outline | Drag across the floor, drag the ring to turn | Pick the piece up, step, put it down; hit to break out |
| [ ] | Place a product on the floor | 3D | Pick from the wheel, the ghost floats at the aim, click sets it | Click a card, drag the ghost, click to drop | One click on the aimed cell |
| [ ] | Wall-hung and on-a-surface products | First person | Aim at the wall or the table top, it snaps flat, click | Drag onto the wall face or the parent | Place on the aimed face |
| [ ] | Rooms and walls: pen, rectangle, typed length, curve, remove | 3D | Walk the line and drop corners at your feet; pull a wall into a curve | Click corners, type a length, drag a curve handle | Lay wall pieces cell by cell; break a piece out |
| [ ] | Wall height, thickness and material | Block-style | Aim at a wall, pull its top up or down | Type the number in the panel | Add or take off a course |
| [ ] | Doors, doorways, windows, wall holes | First person | Aim at a wall, slide the opening along it, click | Drag from the tray onto a wall, drag to move, type sizes | Cut the opening out of the wall pieces |
| [ ] | Stairs and storeys | 3D | Aim where the stair starts, pull it to length | Place the stair, drag its ends; add a storey in the bar | Build the flight step by step |
| [ ] | Roof: shape, outline, things on the roof | 3D, things on it in first person | Jetpack up; lift a panel or a tank and set it on the roof | Pick the shape, drag the outline, type the pitch | Lay roof sheets piece by piece |
| [ ] | Floors: finish, tiles, fill with a tile product | Block-style | Aim at the floor and paint the zone | Pick a room, pick a finish | Lay tiles one by one |
| [ ] | Paint and cladding | First person | Aim at a wall and spray; pick the colour from the wheel | Click a wall, pick a paint | Paint one face at a time |
| [ ] | Plot and site map | 3D | Walk the boundary and drop corners | Draw the boundary on the map, type corners | Stake the corners cell by cell |
| [ ] | Garden: surfaces, outlines, paving, fences, pool, trees | Block-style, trees in first person | Aim and lay a patch; plant a tree where you stand | Drag a patch, drag its outline | Lay slabs, fence posts and pool walls piece by piece |
| [ ] | Dig and fill | Block-style | Aim at the ground and dig a cell at a distance | Paint cells from above | Dig the cell in front of you, fill it back |
| [ ] | Foundation | Block-style | Aim at the trench and pour | Place the element, type its size | Dig the trench, set the element |
| [ ] | Pipes and cables: runs, bends, joins, sizes | Block-style | Grab a pipe or a wire end, pull it along the wall or the trench, release | Click the start, click each bend, double-click to end | One piece per cell along the trench; a turn makes an elbow |
| [ ] | Fixtures and boxes: place, move, connect | 3D, connect in first person | Carry the box to its place; pull a run end onto its port | Place from the tray, type base height | Set the box into the dug cell |
| [ ] | Solar panels, water tanks, batteries, inverters | First person | Lift it, fly it up, set it on the roof or the stand | Drag from the tray onto the roof | Place it on the aimed cell |
| [ ] | Lights and switches | First person | Grab a light and move it; aim and switch it | Click the lamp, toggle | Place the lamp on the aimed face |
| [ ] | Shade sail | First person | Fly to each anchor point and pin it | Click the anchors from above | Set the posts one by one |
| [ ] | Components (measured parts) | 3D | Aim and trace the part | Draw points and faces | Build the part from pieces |
| [ ] | City sheet: roads, utilities, equipment, buildings | 3D | Walk a road and drop its corners; lift a whole building and move it on its plot | Click corners on the ground, drag assets | Lay road and trench pieces cell by cell |
| [ ] | Eco and energy inputs | 3D (panel) | Aim at an appliance and set its hours | The study panel beside the model | Not a piece tool: opens the same panel |
| [ ] | Trades: jobs, packages, rates, cart | 3D (panel) | Pin a job on the thing you look at | Panels beside the model | Not a piece tool: opens the same panel |
| [ ] | Measure, snap, grid, undo and redo | 3D | Aim at two points to measure; undo on a key | Click two points; undo in the bar | Count cells; undo on a key |

## What is missing so that every tool works in all three modes

On the web front:

1. One shared tool list. Today the tool state lives in three places and the walk has none: a tool picked in the plan is unknown to the 3D view and to the walk.
2. The rule for placing a new item lives inside the 2D plan component. It has to move into a plain module that every view, and the game, can call.
3. Pipes, cables and fixtures are drawn in a separate workspace only. They need to be drawn in the plan, the 3D view and the walk.
4. Dig and fill exists in the walk only, in 1 m cells that only go down, and the land has no heights. A height field comes with the map stage.
5. Nothing checks that a pipe or a cable network works. Runs connect to ports and junctions; no code follows the network. The game adds that check (stage 11, step 4) and the web uses the same rule.
6. Lights, panels, tanks, batteries and boxes are plain placed items: they connect to nothing.
7. A saved design has no version, and no sign-in a desktop program can hold. The product list and the table from product to 3D model are inside the web bundle, not served. Stage 2 adds these; until then the game loads a design from a file, or through a shared room (which has a revision check).

In the game: every tool, in the order of the stage 11 chapter (`PLAN.md` in the game repo). The rules it must copy exactly are in `scan/BUILD-3D-WALK.md`, section 4 (117 numbered geometry rules) and `scan/FORMAT.md`.

## Rules that disagree today (a second front cannot copy both)

| Rule | The values found | Where it is decided |
|---|---|---|
| Wall thickness | 0.14 m drawn in 3D; 0.10 m for placing and for new free walls; 0.15 m from the masonry setting | stage 2 |
| Where a wall sits | outside the room line in 3D; centred on it in 2D | stage 2 |
| Turn step | 45 degrees on keys; 90 in the details panel | stage 4 |
| Wall height limits | 2 to 4 m on load; 2 to 8 m for a storey; 2 to 6 m on import | stage 2 |
| Curved walls | saved as straight chords, not arcs | stage 3 |
| Product id | a bundled id and a database id for the same product, joined by SKU | stage 6 |

