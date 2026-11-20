# INVENTORY: what the web app has today, and where each tool goes (stage 0, the scan)

Made 2026-11-20 by Fable from six read-only notes in `AI-HANDOFF/scan/` (code at `d678c92`, the live `main`). Nothing was run or changed. Every line in the notes carries its file and line. This file is built from the notes by `scan/make-inventory.py`: edit the notes, then run the script.

## The short answer

- The web app has 147 tool rows across four areas (some tools show up in two areas, for example Dig and fill), 845 inventory lines (tools, views, panels, routes, tables, test families) and 240 caps.
- Every tool stays. Many get two verdicts at once: make it friendlier on the web, and bring it into the game. Three leftovers cannot be reached by a user today (the old millimetre wall tool: its state, its layer and its bar; and a hidden 3D preview switch). They stay until the owner types `drop <tool>`.
- Each tool was given a home mode, the mode where it is quickest. It still has to work in the other two.

| Home mode | Tool rows |
|---|---|
| 3D build view | 72 |
| Block-style dig and place | 40 |
| First person with powers | 35 |

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

## Part 1. The tools, mode by mode (the list to tick)

One row per tool. "Best mode" is where the tool is at home; the three middle columns say how the same tool is used in each play mode. FP = first person with powers. 3D = the 3D build view. BLK = block-style dig and place.

### The 2D plan and the toolbar

| Tick | Tool | Best mode | First person with powers | 3D build view | Block-style dig and place | Missing on the web | Needed in the game |
|---|---|---|---|---|---|---|---|
| [ ] | Select and move an item | 3D | Look at it, hold grab, carry it at a distance, release on a clear outline. | Click and drag across the floor; it snaps flush to walls. | Pick the piece up, step to the cell, put it down. | Move inside Walk; multi-select (no selection box is wired, section 5). | Port the move law `D/itemDrop.ts`; same refusal words. |
| [ ] | Rotate an item | 3D | While holding, scroll to turn 45°; hold the fine key for 1°. | Drag the ring round the item; keys step 45°. | Tap rotate before placing; one step per tap. | One step size: panel turns 90°, keys 45° (C/DetailsPanel.tsx:316-328). | 45° and 1° steps (D/rotationGesture.ts:3-4); re-seat against walls. |
| [ ] | Duplicate / copy type | BLK | Point at an item, press copy; a twin appears in hand. | Select, press Duplicate, drag the copy away. | Pick-piece: middle-click a piece to load its type. | The eyedropper has no button (LD:285-289). | Copy type into the hand; 0.5 m offset tries (L/placementActions.ts:364-370). |
| [ ] | Remove | BLK | Aim, hold remove; the outline is hatched; release deletes. | Pick Remove, hover highlights, click deletes, Esc stops. | Hit a piece to break it out. | It never removes a whole room (D/removeBuildTarget.ts:75). | Targets: item, opening, wall, floor tile (D/removeBuildTarget.ts:11-12). |
| [ ] | Place a product | 3D | Open the catalogue wheel, pick, aim; ghost on floor; trigger places. | Drag from the tray onto the floor; ghost; release. | Choose from the hot bar; place on the targeted cell. | The new-item law sits inside the plan component (RC:1448-1783). | Four kinds: floor, wall, surface, ceiling; wall gap 0.45 m. |
| [ ] | Wall-hung product | FP | Aim at a wall; the item sticks; scroll sets its height. | Drag to a wall; it slides along; type the height. | Place on a wall face; cycle height in 5 cm steps. | Drag the height on the wall; today a number field. | Mount height in cm, capped by storey height. |
| [ ] | Surface product | FP | Aim at a table top; the item rests there. | Drag onto a table; it becomes its child. | Place on the top face of a piece. | A loaded table cannot turn (C/ObjectPlacementControls.tsx:57). | Parent link; 0.1 m sub-grid (D/attachmentPlacement.ts:57). |
| [ ] | Wall pen | 3D | Point at the ground, trigger each corner; walls rise behind you. | Click corners or drag a wall; closing the loop makes a room. | Lay wall pieces along a line; a closed ring becomes a room. | Two pens with separate code (RD; R3:82). | Grid, wall magnet, 15° axis lock, close radius (section 4). |
| [ ] | Typed wall length | 3D | While aiming a wall, type a number; the length locks. | Type in the wall strip while dragging. | Type a count; that many pieces lay in a row. | Typed length in 3D. | Length rounds to the snap step (D/drawLength.ts:108). |
| [ ] | Room rectangle | 3D | Mark two opposite corners on the ground; the room rises. | Drag a rectangle; the size label follows; release builds. | Stake two corners; the ring fills with wall pieces. | Drag a rectangle on the plan. | Min side 0.1 m; no overlap; inside plot (D/roomBuildGesture.ts:96-107). |
| [ ] | Curved wall | 3D | Trigger start and end, then pull the middle sideways. | Click start and end, drag the bend handle. | Nearest use: lay short straight pieces along the curve ghost. | Saved as chords, not arcs (D/measuredPath.ts:1-2; PS:2047-2059). | Read chord walls now; true arcs with format v2. |
| [ ] | Pull curve | FP | Grab the wall's middle with telekinesis and pull. | Right-click the wall, Pull curve, drag. | Nearest use: swap straight pieces for curved ones. | Only in a right-click or long-press menu. | Refuse while an opening sits on that edge (SA:191-192). |
| [ ] | Measure | 3D | Aim at a wall; its length floats; press edit to type. | Click a wall; its dimension label becomes a field. | Read-out only: pieces times size. | Free walls cannot be retyped; no two-point tape. | End that stays put; shared-wall rule; 0.001 to 100 m (D/edgeResize.ts:23-26). |
| [ ] | Door, doorway, window, wall opening | FP | Point at a wall, pull the trigger, drag the door along it, release. | Pick Door, slide along a wall, click. | Break wall pieces for the gap; set the door piece in. | With the tool on, a tap on a door deletes it (RC:3279-3283). | 0.1 m end margin; no overlap; swing toward the player (RC:3252-3253). |
| [ ] | Edit an opening | 3D | Look at the door, open its card, nudge with the stick. | Click the opening; a side card shows the fields. | Swap the piece for another size. | Drag handles; today number fields only. | The same four numbers and two flips. |
| [ ] | Stairs | FP | Stand below, aim up; a ghost spans to the next floor; trigger. | Drag Stairs onto clear floor; rotate 90°. | Stack step pieces; auto-complete to the storey above. | Placing stairs on the plan: no button in TB. | Two storeys needed; width 0.6 to 5 m, run 1 to 30 m (D/building.ts:150). |
| [ ] | Storeys | 3D | Jetpack to the top; Add floor raises a copy underfoot. | Floor up and down buttons; + Floor copies the storey below. | Building above the wall top starts a new storey. | Rename and remove in 3D; remove needs an empty storey (TB:471-478). | Height 2 to 8 m, slab 0.18 m (D/building.ts:8-10). |
| [ ] | Wall height | BLK | Grab the wall top; pull up or down in 0.1 m clicks. | Drag a height handle or type. | Add or remove one course. | Two ranges: 2 to 4 m house, 2 to 8 m storey (D/wallHeight.ts:23-24). | Per-storey height; default 2.7 m. |
| [ ] | Wall thickness | BLK | A dial on the wall tool. | A field in build settings. | Choose the piece size before laying. | Three defaults disagree: 0.10, 0.12, 0.15 m (section 5). | One thickness source per wall. |
| [ ] | Roof | 3D | Jetpack up; pick a roof type; it caps the house. | Toggle Roof; choose flat, gable or single slope; drag pitch. | Lay roof pieces across the top course. | Roof settings on the plan; one roof per design (D/levels.ts:21-22). | 3 shapes, 5 finishes, pitch 5 to 60°, overhang 0 to 1.5 m. |
| [ ] | Roof outline | 3D | Fly the edge and drop a marker at each corner. | Click corners from above; close the loop. | Nearest use: place edge pieces round the top. | Moving points after closing. | Simple polygon; roof items must stay inside (PS:1863). |
| [ ] | Roof products | FP | Jetpack onto the roof, pick a panel from the air bar, place. | Drag a panel onto the roof; it snaps edge to edge. | Place panel pieces on roof cells. | Roof editing in 3D needs WebGL (R3:1902). | Roof-only products; off the slab is refused (RC:1373). |
| [ ] | Floor tool | BLK | Aim at the floor, hold the trigger, sweep; tiles lay under the beam. | Drag across the floor; Room fills it. | Place tiles one by one, or fill a marked area. | Rolls lay whole-room only (TB:748-755). | Tile lattice per material; 20,000 tiles per stroke. |
| [ ] | Fill floor with a tile product | 3D | Hold a tile, press fill; the room floods with it. | A Fill button on the selected tile. | A fill command on the marked room. | The button in 3D. | Copies on the tile lattice. |
| [ ] | Wall paint | FP | Spray: aim at a wall face and pull; colour wheel in the other hand. | Click walls; Room paints them all. | Paint each wall piece face. | Ceilings (TB:3130). | Per wall and side; tint; coats 1 to 3. |
| [ ] | Wall material | BLK | Switch the wall tool to material; shoot walls. | Pick a card; click walls. | Choose the piece type before laying. | Applying one removes paint and cladding (C/WallSurfaceOptions.tsx:46). | Construction kind per wall edge; glass has its own options. |
| [ ] | Cladding | FP | Board tool: aim at a wall face and pull. | Click walls; Room clads all. | Clip boards onto wall pieces. | A sample catalogue only (TB:2561-2565). | Product id per wall; one or two faces on free walls. |
| [ ] | Plot | 3D | Walk the edge and drop four pegs. | Drag plot corners; type the size. | A fence line marks the plot. | A rectangle by numbers only; in 3D it hides in a menu. | Sides 1 to 500 m; everything stays inside. |
| [ ] | Garden surface | BLK | Sweep a ground beam to lay lawn or gravel. | Drag a rectangle on the ground. | Lay ground tiles cell by cell. | Ground level only (C/PlanGardenWorkspace.tsx:28). | 0.1 m snap; 0.2 to 500 m; raise 0 to 2 m (D/garden.ts:86-109). |
| [ ] | Garden outline | 3D | Walk and drop points; close on the first. | Click points on the ground; close. | Nearest use: mark edge cells, then fill. | Corner handles for outline surfaces in 3D (R3:2147). | A polygon inside its bounding box. |
| [ ] | Paving patch | BLK | A slab tool lays a strip where you sweep. | Drag an area; the piece count shows live. | Lay slab pieces one by one. | Its estimate stays outside the cart (GP:207). | Piece count as rows times columns. |
| [ ] | Fence / boundary | BLK | Point, pull the trigger, drag the fence along the ground. | Drag the two ends. | Place posts cell by cell. | Drawing it by two taps. | Timber, metal, hedge; height 0.3 to 3 m. |
| [ ] | Pool | BLK | Mark it; watch it dig, line and fill. | Drag a rectangle; set the depth. | Dig the hole cell by cell, line it, fill it. | A rectangle only (D/garden.ts:115-116). | Three stages: excavation, shell, filled. |
| [ ] | Dig / fill | BLK | Aim the spade at the ground; hold to dig along a line. | Drag a trench line; set the depth. | Dig cell by cell; each hit goes deeper. | Not on plan or 3D; 1 m cells; no trench width. | Depth per stroke up to 5 m; never under a room. |
| [ ] | Pipe / cable run | BLK | Pull a pipe from a port and walk it to the next. | Click route points; corners snap to 90°. | Lay pipe in the dug trench, piece by piece. | Not a tool in plan, 3D or Walk. | Runs carry elevation (default −0.3 m), diameter, end connections. |
| [ ] | Service fixture | FP | Aim at a wall; place the box there. | Drag from the list onto the floor or a wall. | Place the box on a cell. | Not on the plan tool rail. | Envelope sizes and ports per system. |
| [ ] | Foundation | BLK | Stand in the trench; place footings by pointing. | Click footing lines under walls. | Dig, then pour cell by cell. | Not read. | Caps 100 elements, 100 bores (D/foundation.ts:54-55). |
| [ ] | Shade sail | FP | Point at each fixing; the sail stretches between. | Click three to six fixing points. | Nearest use: place posts, then link them. | Not read. | 3 to 6 anchors, 20 sails (D/shade.ts:106-108). |
| [ ] | Components (boundary) | FP | Aim and place; right-click to edit. | The same, from above. | Place piece by piece. | Not read. | Cap 128 (D/boundaryModel.ts:17). |
| [ ] | Light and power switches | FP | Look at a lamp, press use. | Click the lamp; toggle on its card. | Hit the switch piece. | The switch in 3D and in Walk. | Light on, power on, hours per day. |
| [ ] | Rename / delete a room | 3D | Look at the room label; hold to rename or delete. | Click the room label. | Nearest use: break all its walls. | The same in 3D. | Room name; delete with its contents. |
| [ ] | Clear | 3D | A menu action with a confirm. | The Clear button with a confirm. | A menu action with a confirm. | Nothing found missing. | One undo frame restores everything. |
| [ ] | Snap unit and object grid | BLK | D-pad cycles the unit; it shows at the crosshair. | Unit chips beside the tool. | A piece size selector. | A snap picker beside the 3D tools. | Six steps; object grid 0.5, 0.25, free. |
| [ ] | Undo / redo | 3D | Hold undo; the last piece pops back. | Buttons and keys. | Buttons and keys. | Top-bar Undo needs two taps on touch; the canvas one does not (TB:502-508; RC:4176). | 50 steps of whole-design snapshots. |
| [ ] | City and site | 3D | Nearest use: walk the land to check it. | Roads and plots drawn from above. | Dig service trenches along roads. | Not read. | Caps 64 roads, 128 networks, 300 assets (D/city.ts:88-96). |

Where each tool works on the web today, with file and line: `scan/TOOLS-PLAN.md`, section 2.

### The 3D build view and the walk

| Tick | Tool | Best mode | First person with powers | 3D build view | Block-style dig and place | Missing on the web | Needed in the game |
|---|---|---|---|---|---|---|---|
| [ ] | Place a product | 3D | Pick from a wheel; ghost floats at the aim point; trigger sets; scroll turns 45° | Click a catalogue card, drag the ghost on the floor, click to drop; Shift keeps placing | One click puts it on the aimed 0.5 m cell | Placing while walking; rules live in the plan component | Placement rules in C++; catalogue table; ghost with tick or cross |
| [ ] | Move a product | FP | Telekinesis: hold to lift, carry at a distance, release on the snap spot | Drag across the floor; walls snap it flush; Shift keeps its facing | Break it, then place it on another cell | Lifting over walls; carrying between storeys | Carry state, drop check, snap preview, storey-to-storey carry |
| [ ] | Turn a product | 3D | While carrying: scroll turns 45°; hold a modifier for 1° | Drag the ring; arrow keys step | Rotate key before placing, 90° steps | Turning wall items; tilt and roll do not exist | Yaw only, as in the JSON; same centre-fit check |
| [ ] | Copy a product | 3D | Aim at an item, copy key; a twin floats in hand | Alt-drag an item to clone it | Pick key copies the aimed item | Copying several at once | Clone keeps product id and rotation; new instance id |
| [ ] | Remove a product | BLK | Aim and hold remove; the item fades out | Select and press Delete, or hammer click | Break it with the dig tool | A visible Undo button after removal | One undo step per removal |
| [ ] | Wall-item height | FP | Slide the item up or down the wall with telekinesis | Drag a vertical handle on the item | Place on the aimed wall cell | A drag handle; only a number field today | `mountHeightCm` on the instance |
| [ ] | Draw a room | 3D | Mark two corners on the ground with the pointer beam | Drag a rectangle on the floor grid | Lay wall blocks in a loop; a closed loop becomes a room | Non-rectangle rooms and room resize in 3D | Polygon room from any closed loop, clockwise winding |
| [ ] | Draw walls | BLK | Shoot corner points along the ground; the wall rises between them | Click corners; close the loop for a room | Build the wall up block by block along a line | Height per wall; openings in free walls | Free walls as a, b, thickness; auto room on closure |
| [ ] | Curve a wall | 3D | Grab the middle of the wall and pull | Drag a mid-edge handle | Place short straight pieces | A direct drag handle | Curves saved as chords, 3 mm tolerance |
| [ ] | Remove a wall | BLK | Aim, hold remove; the wall sinks | Hammer click on the wall | Break the wall blocks | Removing only part of a wall by drag | `removedWallEdges` on the room; free wall deleted |
| [ ] | Door | 3D | Aim at a wall; the door ghost slides along it; trigger sets | Drag a door from the palette onto a wall | Punch a two-high gap and frame it | Doors on free walls; saved open state; 3D draws doors closed | Hole in the wall mesh; hinged leaf from the two flips |
| [ ] | Window | 3D | Aim, slide the ghost, trigger; scroll changes width | Drag onto a wall; drag its edges to size | Punch a gap above sill height; glass fills it | Size and sill by drag; number fields today | Sill, height, width, shape from the record |
| [ ] | Edit an opening | 3D | Grab the door and slide it along its wall | Select; drag along the wall; handles to size | Break and place again | Dragging a placed opening along its wall | Clamp 0.1 m from wall ends; no overlap |
| [ ] | Stairs | 3D | Aim at the floor; ghost shows both landings; trigger sets | Drag the stair onto the floor; R rotates | Stack steps by hand, or drop a stair kit | Turns, landings, spirals: one straight kind only | Mesh from rise, run, width; hole in the upper slab |
| [ ] | Storeys and wall height | 3D | Jetpack up; add a floor at the wall tops | Floor up and down buttons; drag a wall top | Building past the wall top starts a storey | Dragging wall tops; split levels | Elevation = heights plus 0.18 m slabs |
| [ ] | Roof shape | 3D | Stand on the roof and pull the ridge up | Pick a shape tile; drag a pitch handle | Lay roof blocks in stepped rows | One roof setting for every room; ridge direction is automatic | Roof mesh per roof room from the same formula |
| [ ] | Roof outline | 3D | Walk the roof edge dropping corner markers | Click corners on the roof plane | Edge blocks define the outline | Editing an outline after it is closed | One outline polygon replaces the per-room roofs |
| [ ] | Solar panel on the roof | FP | Jetpack to the roof, carry the panel, set it on the slope | Click the roof; panels snap to an array grid | Place panel pieces on roof cells | Panels lie flat when the roof is hidden | Mount 0.06 m above the roof, tilted to the slope |
| [ ] | Wall paint | FP | Spray: aim, hold trigger, sweep across walls | Roller cursor, click walls; Shift fills the room | Paint the aimed wall face | Painting part of a wall | Colour and finish per edge and per side |
| [ ] | Wall material and cladding | BLK | Spray with a material cartridge | Material palette, then click a wall | Choose the block type before building | Easy to miss: it sits inside the paint panel | Thickness follows the material; glass is see-through |
| [ ] | Floor finish | BLK | Spray the floor ahead as you walk | Drag a rectangle of tiles | Place floor tiles one cell at a time | 3D shows one material per room, not each tile | Tile runs drawn tile by tile |
| [ ] | Garden surface | BLK | Paint the ground with a brush while walking | Drag rectangles on the land | Swap the top ground block: grass, soil, gravel, paving | Free painting; only rectangles or drawn outlines | Surface polygons with a height of 0 to 2 m |
| [ ] | Pool | BLK | Dig the pit, then set the shell | Drag a rectangle and set the depth | Dig the hole, line it, fill it | Digging cells does not make a pool | Pit, shell and water from the pool record |
| [ ] | Fence or hedge | BLK | Plant post points along the ground with the beam | Click start and end on the land | Place posts cell by cell | Drawing a fence by its two ends in 3D | Posts every 2 m, rails, slats from a, b, height |
| [ ] | Dig and fill | BLK | Aim at the ground and hold dig, or hold fill | Brush over cells with a depth slider | Break or place one earth cell | Digging in Plan and in the 3D view; slopes; cells under 1 m | Voxel layer mapped to cells x, y, topM, depthM |
| [ ] | Foundation | BLK | X-ray below ground; drag footing ghosts | Draw rectangles under walls | Dig a trench and pour concrete into it | Editing inside the 3D view; turned footings | Boxes by centre, length, width, depth, top height |
| [ ] | Pipe or cable run | BLK | Aim node to node; the run hugs walls and floor | Click points; set height in a side field | Dig a trench, lay pieces along it, cover it | Laying runs in the main 3D view; no link to dug cells | Polyline with a centre-line height per node |
| [ ] | Service fixture | 3D | Carry the fixture like a product | Drag from a fixtures tray | Place the fixture on a cell | The move and turn gestures products have | Body fitted to its box at centre, rotation, base height |
| [ ] | Shade sail | FP | Plant posts, then stretch the sail between them | Click 3 to 6 anchor points; drag heights | Place posts; the sail spans them | Editing inside the 3D view | Saddle surface between anchors; posts lean 7° |
| [ ] | Components | 3D | Draw edges in the air with the beam | Click vertices on a chosen plane | Place single blocks anywhere | Plain words; it asks for planes and XYZ | Vertex, edge and face lists as a static mesh |
| [ ] | Trees | FP | Plant a sapling where you aim | Click to plant; drag the crown to size | Place a tree piece | Planting from the 3D view | Trunk and crowns from height and canopy radius |
| [ ] | Lamp on or off | FP | Walk up and press use on the lamp | Click the lamp, switch in its card | Use key on the lamp | A switch in the 3D selection card | Point light at the mount height; `lightOn` flag |
| [ ] | Remove tool (hammer) | BLK | Hold remove on the aimed part | Hammer cursor, click a part | Break tool, the native verb | A cue other than red | One verb for all parts, rules per kind |
| [ ] | Build menu on a part | 3D | Radial menu on the aimed part | Right-click menu | Use key on a block | Picture buttons; text rows today | Same target kinds: stair, run, fixture, garden, roof, earth |
| [ ] | Pin a job on the model | 3D | Aim and tag a part | Click a part to tag it | Tag a block | Not a design edit; listed for completeness | Pin = storey, part reference, x, y, z |

Where each tool works on the web today, with file and line: `scan/BUILD-3D-WALK.md`, section 2.

### Pipes, cables, fixtures and trades

| Tick | Tool | Best mode | First person with powers | 3D build view | Block-style dig and place | Missing on the web | Needed in the game |
|---|---|---|---|---|---|---|---|
| [ ] | Draw a service run (8 systems) | BLK | Grab a pipe or wire end by telekinesis, pull it along the wall or trench, release. | Click the start, click each bend, double-click to end. | Lay one piece per cell along the dug trench; turns make elbows. | Drawing in the main Plan and 3D; finish by double tap. | A run actor that writes `points` with a height on every node. |
| [ ] | Place a service fixture (13 kinds) | 3D | Pick the box from the air bar, set it on a wall or floor by telekinesis. | Drag from the tray, drop, turn with a key. | Put the box into a cell or onto a block face. | Wall snap, mount height on drop, pictures in the picker. | One mesh per kind with sockets at the code's port offsets. |
| [ ] | Move a fixture | FP | Grab, carry, drop; linked pipes follow. | Drag it; linked ends follow live. | Pick the block up, place it again. | Drag in place of tap; moving up or down. | Run the link resolve after every move. |
| [ ] | Turn a fixture | 3D | Hold the grab and roll to turn. | Select, press a turn key. | Cycle four facings before placing. | A free angle; turning while placing. | Ports worked out with the same turn maths. `serviceConnections.ts:73-85` |
| [ ] | Move a run node or change its height | 3D | Grab a joint and pull; a key lifts or lowers it. | Drag the joint on its level; a modifier drag changes height. | Break the piece, lay it one cell over or up. | A height handle; the 3D drag stays on one level plane. | A height on every node; no interpolation left to guess. |
| [ ] | Add or remove a bend | 3D | Aim at mid-pipe and pull sideways. | Click mid-pipe to add; Delete to remove. | Bends come from where the pieces are laid. | Adding a bend by tapping the pipe. | The 500-point cap per run. |
| [ ] | Connect a run end to a fixture | FP | Push the pipe end onto a lit port; it locks. | Drag the end to a port that lights up. | The last piece next to a fixture face joins it. | The refusal reason shown at the port; links across floors. | The same test: same system, same floor, port height known. |
| [ ] | Join two runs | BLK | Push a pipe end onto another pipe's joint. | Drag an end onto a joint. | Place a tee piece where the lines meet. | Joining in the middle of a segment; a tee count. | A junction object with its own id; a crossing never joins. |
| [ ] | Carry on from a run's end | BLK | Grab the open end, keep pulling. | Click the open end, keep clicking. | Lay the next piece. | It makes a second run, never a longer one. | One behaviour chosen and used on both fronts. |
| [ ] | Choose material and size | 3D | Wheel menu on the held pipe. | Dropdown on the selection. | One hotbar slot per size. | Size chips with pictures; no sizing help. | The same preset ids, so stock counts match. |
| [ ] | Edit fixture size, base height, port heights | 3D | Open the hand tablet on the held box. | Side panel; drag size handles. | Side panel. | Handles; common wall heights as buttons. | The drain connection stays unusable until its height is typed. |
| [ ] | Remove a run or fixture | BLK | Aim and hold the remove power. | Select, press Delete. | Break the pieces one by one. | Removing part of a run; many at once. | Junctions no run uses are dropped. `ServicesWorkspace.tsx:692-703` |
| [ ] | Pull a curve into a run | 3D | Grab mid-pipe, pull to bow it. | Drag the segment's middle handle. | Not used; lay pieces. | Only a many-point line; no flexible pipe kind. | Sampled points with heights kept. |
| [ ] | Dig or fill the ground | BLK | Aim the dig power, hold and sweep along a line. | Drag a trench line on the ground, set the depth. | Break ground blocks; place blocks to fill. | Digging in Plan and 3D; cells under 1 m; a trench tied to a run. | A trench object: its cells, its depth and the run inside it. |
| [ ] | Place a solar panel | FP | Jetpack up, drop the panel by telekinesis; it snaps to the array. | Drag from the tray onto the roof. | Lay panel tiles on roof blocks. | Placing in Walk; any cable to the inverter. | The roof-only rule and the array grid. |
| [ ] | Place a water tank | FP | Lift the tank onto the roof or a stand. | Drag from the tray. | Place a multi-cell object. | Roof placing; ports; any link to pipes. | Tank as a fixture kind with inlet, outlet and litres. |
| [ ] | Place or move a light | FP | Grab the light, carry it, stick it to a ceiling or wall. | Drag; it snaps by its placement kind. | Place on a block face. | No wire, switch or circuit for a light. | A light point with a power port; lit only when fed. |
| [ ] | Switch a light | FP | Look at it, press use. | Click it, toggle in the bubble. | Use key on the lamp. | Wall switch objects; switching in Walk. | `lightOn` per item and the glow radius rule. |
| [ ] | Place a battery, inverter or controller | 3D | Carry it, hang it on a wall. | Drag from the tray. | Place on a wall face. | No cable between panel, inverter, battery and board. | Power ports and a source-to-load check. |
| [ ] | Set an appliance's watts, hours, on or off | 3D | Use on the appliance opens a dial. | Side panel boxes. | Side panel boxes. | Totals per circuit; breaker limits. | The same fields and caps. `propertyStore.ts:1917-1973` |
| [ ] | Place a paired service product | 3D | Pick from the air bar, place. | Drag from the tray. | Place the object. | It is a plain product: no ports, no link to runs. | One object: the product body plus fixture ports. |
| [ ] | Draw a site utility route with its trench | BLK | Walk the route with the trench power; the main follows. | Click the route on the site; see the trench. | Dig the row, lay the main, fill it. | No join to the house runs; one size per route. | The pipe must sit inside its trench. `city.ts:616-620` |
| [ ] | Draw a measured component | 3D | Tap points in the air with a pointer beam. | Click points; snap to wall edges. | Outline along block edges. | A Plan 2D tool; a trade or kind on a component. | The same caps and the flat-face rule. |
| [ ] | Pin a trade job on the model | FP | Point at the part, press mark. | Click the part. | Mark a block face. | Pinning in Walk; the ledger lives in one browser. | Pin = reference, floor, x, y, z, in a shared store. |
| [ ] | Set a job's status | 3D | Look at the flag, pick from a wheel. | Click the pin, pick a status. | Same as 3D. | The overlay in Walk. | The same five states, each with symbol and word. |
| [ ] | Make trade packages | 3D (panel) | Site-office tablet, one press. | Side panel button. | Side panel button. | Air-conditioning, ventilation and extinguisher items are left out. | A read-only list; making stays on the web. |
| [ ] | Edit a package's quantities | 3D (panel) | Tablet list. | Side panel list. | Side panel list. | A jump from a line to its part on the plan. | Nothing at first. |
| [ ] | Send a work file, add an answer, decide | 3D (panel) | Not a world tool; a tablet shows the status. | Panel. | Panel. | Files are passed by hand; trade rates are never read. | Status display only; no money steps. |
| [ ] | Sync measured components, sign a stage | 3D (panel) | Tablet checklist. | Panel. | Panel. | Not known: the screen was not read (section 7). | The stage list as a checklist. |
| [ ] | Enter material rates | 3D (panel) | Tablet. | Panel. | Panel. | Services and labour are not in it. | A read-only total. |
| [ ] | Change the cart | 3D (panel) | Tablet. | Panel. | Panel. | Runs and fixtures never reach the cart. | A read-only running total. |

Where each tool works on the web today, with file and line: `scan/SERVICES-TRADES.md`, section 2.

### City, land, garden and eco

| Tick | Tool | Best mode | First person with powers | 3D build view | Block-style dig and place | Missing on the web | Needed in the game |
|---|---|---|---|---|---|---|---|
| [ ] | Draw road | 3D | Walk the route; press to drop each corner at your feet. | Click corners on the ground; drag a corner to reshape. | Lay road pieces cell by cell; one run becomes one road. | Drawing in City 3D; dragging points; joined crossings (`city.ts:548`). | Spline road on the terrain, saved as the same points and width. |
| [ ] | Draw utility | BLK | Dig a trench line, then aim along it to lay pipe or cable. | Click the route from above; the ground turns see-through. | Dig trench cells; place pipe pieces in them one by one. | A tie to dig cells; 3D drawing; connections at crossings (`cityContract.ts:114`). | Trench and pipe pieces that write points with their elevation. |
| [ ] | Place equipment | 3D | Pick from the air tool bar, aim, drop; telekinesis moves and turns. | Drag from a tray to the ground; turn with a handle. | Place as one multi-cell block; turn in quarter steps. | Drag, turn and place in City 3D (`CityThreeView.tsx:410-429` only selects). | One true-size mesh per kind; ratings on an info card. |
| [ ] | My buildings: place a saved building | FP | Telekinesis lifts the whole building and sets it on a plot. | Drag a library building onto a plot; turn before dropping. | Stamp the building as one prefab. | A library in the design; a copy with interiors (`cityLibrary.ts:14,43-47`). | Prefab loaded by design id, interiors kept. |
| [ ] | Refresh building envelope | 3D | Automatic: the house you stand in is the city item. | Automatic each time the city view opens. | Automatic after each placed or broken block. | An automatic refresh; the true outline; more than one link (`city.ts:322`). | House and city in one world; no refresh step. |
| [ ] | Details inspector (move, size, turn) | 3D | Aim to select; grab with telekinesis; scroll to turn. | Drag to move; a ring handle turns; corner handles resize. | Break it and place it again one cell over. | Any drag, handle or multi-select (`CityWorkbench.tsx:653-689`). | Gizmo with 0.5 m snap beside a number box. |
| [ ] | Route coordinates and elevations | 3D | Grab a point marker and pull it. | Drag point handles; click a segment to add a point. | Break or add pieces at an end. | Handles on the map; adding or deleting one point (`CityWorkbench.tsx:787-834`). | Spline point handles with a depth read-out. |
| [ ] | Remove item | BLK | Aim at it, hold the remove power. | Select it, press Delete. | Break it piece by piece. | A key and a drag-to-clear (`CityWorkbench.tsx:166-175,848` is the only path). | One remove verb with undo. |
| [ ] | Your site (size) | 3D | Walk to a corner post and pull it with telekinesis. | Drag the site rectangle's edges. | Move boundary posts cell by cell. | Edge handles; an editable origin (`CityWorkbench.tsx:860-871`). | The site comes from the picked plot, not from typing. |
| [ ] | Data centre tab (scenario) | 3D | Open the card at the building's door. | Click the building; edit the card beside it. | Open the same card from the block's menu. | A tie between the scenario and one placed item (`city.ts:86`). | In-world card running the same formula. |
| [ ] | Infrastructure tab (link a reference) | 3D | Aim at the item, pick from a wheel. | Pick in the item's side card. | Pick in the block's menu. | References as server data (`citySuppliers.ts:6-22` is a source file). | Read the references from the server. |
| [ ] | Orders tab | 3D | A tablet in hand shows the same list. | Open the side panel; type in the same fields. | Open the side panel; type in the same fields. | The Packages view outside English (`CityOrdersPanel.tsx:156`); a place in the design. | Read-only list first. |
| [ ] | Plot tool | 3D | Pull a corner post with telekinesis. | Drag the plot edges; the size shows live. | Move boundary posts one cell at a time. | Handles; origin edit; keeping the map site on Lock (`TopBar.tsx:487`). | Plot from the picked parcel; posts as handles. |
| [ ] | Site map (draw the boundary) | 3D | Walk the land; drop a stake at each corner. | Click corners on the island map from above. | Stake posts on cells. | Satellite view (`SiteWorkspace.tsx:563`); plots over 500 m; several plots. | Island map pick writing the same lon/lat boundary. |
| [ ] | Add corner by coordinates; From the surveyor's plan | 3D | Open the same typed panel at the map table. | Panel beside the map; the outline updates as you type. | Open the same typed panel. | Reading a plan photo or file (`SiteWorkspace.tsx:599-606` has two modes). | Same panel and the same traverse maths. |
| [ ] | Fit site to the plan | FP | Telekinesis slides the house across its plot. | Drag the house or the outline; turn it. | Nudge one cell with the arrow keys. | Dragging; turning the plot against the house (`SiteWorkspace.tsx:284-309`). | Moving the building rewrites the anchor. |
| [ ] | What-if corner levels; Survey import | BLK | Feel the slope underfoot; raise a platform marker. | Drag a platform plane; cut and fill update. | Dig and fill cells until the pad is level. | Any drawn terrain; levels stay in the report (`SiteReport.tsx:37-51`). | Height-field ground with a platform tool. |
| [ ] | Planning assumptions | 3D | Walk the plot edge; a ground line shows the setback. | Drag the setback line inward. | Walk-on cells inside the setback are marked no-build. | The envelope on the plan or in 3D; concave plots (`site/geometry.ts:319-322`). | Setback band drawn; a warning when crossed. |
| [ ] | Foundation comparison | 3D | Open the same typed panel on a board. | A slider lifts a ghost foundation. | Open the same typed panel. | Anything drawn; numbers only (`foundationScenario.ts:26-31`). | Panel only. |
| [ ] | Add outdoor surface | 3D | Aim at the ground and drag a rectangle. | Drag a rectangle on the ground. | Place surface tiles cell by cell. | A brush; turning a patch; use without parking the walker (`WalkMode.tsx:222-227`). | Ground paint mapped to the same rectangles. |
| [ ] | Custom outdoor outline | 3D | Drop a marker at each corner while walking. | Click points; pull a segment to bend it. | Fill the cells inside a traced loop. | Reshaping after Finish; pool outlines (`garden.ts:116`). | Spline area tool. |
| [ ] | Move or resize a patch | 3D | Grab with telekinesis and slide. | Drag the patch or its corners. | Break and lay again. | Drag-move in 3D; handles on outlined patches (`RoomView3D.tsx:1109`). | Gizmo on the patch. |
| [ ] | Raise terrain (typed patch fields) | BLK | Lift the patch with telekinesis; a height read-out follows. | Drag the patch's up arrow. | Stack soil blocks. | Slopes; more than 2 m; lowering (`garden.ts:109`). | Raise and lower on the height field. |
| [ ] | Boundary: fence, railing, hedge | FP | Walk the line placing posts. | Click the start and the end. | Place fence pieces per cell. | Click-two-points drawing; gates; corners (`GardenPanel.tsx:103-113`). | Fence spline with posts. |
| [ ] | Pool build | BLK | Dig the hole, set the shell, fill it. | Drag a rectangle; step through the three stages. | Dig cells, line them, pour water. | Other shapes; steps; a link to dig cells (`garden.ts:115-116`). | Staged build using the dig tool. |
| [ ] | Paving patch with a product; Outdoor floor layers | BLK | Lay slabs where you aim. | Drop a product on the patch. | Place slabs one by one. | Piece counts for outlined patches (`gardenPaving.ts:19`); products as data. | Slab pieces at true size. |
| [ ] | Dig / Fill | BLK | Aim and hold to dig; scroll sets the step. | Drag a rectangle; type the depth. | Break and place 1 m soil cubes. | Plan and 3D use; fill above ground; over 512 cells (`terrainCuts.ts:10,53`). | Ground edit saving the same 1 m cells. |
| [ ] | Remove garden element; Remove a cell | BLK | Aim at it, hold remove. | Select it, press Delete. | Break it. | Removing while walking without parking (`WalkMode.tsx:222-227`). | One remove verb with undo. |
| [ ] | Trees form | FP | Plant where you stand; telekinesis moves it. | Drag a tree from a tray. | Place a sapling block. | Placing by tap; trees in Walk (`WalkMode.tsx:231`). | Tree scaled to the entered height and crown. |
| [ ] | Green roof form | FP | Jetpack up; lay the layer on the roof. | Click the roof; apply the layer. | Place turf blocks on the roof. | Anything drawn for it (`ProjectWorkspace.tsx:1161-1183` is a form). | Roof layer with a load read-out. |
| [ ] | Water card (study inputs) | 3D | A board beside the tank shows and edits them. | Side panel; the tank level follows the month. | Open the same side panel. | Use on open pages; anything in the scene (`ProjectWorkspace.tsx:268`). | Panel fed by the same formula. |
| [ ] | Pilot material pickers | FP | Aim at a wall or roof and apply. | Click a surface; choose the finish. | Place the material block by block. | Picking by tap; more than one room or patch (`ecoContract.ts:50`). | Material brush writing the same ids. |
| [ ] | Demonstration props | FP | Place where you aim; telekinesis moves it. | Drag the prop. | Place as one block. | Placing by tap; more than one of each (`ecoContract.ts:44-46`). | Placeable props with no output counted. |
| [ ] | Private programme panel | 3D | Not offered: the file stays on the web. | Read-only pins on the island map. | Not offered: the file stays on the web. | Any saved state (`programme.ts:60-68` is tab memory). | Nothing unless the owner asks. |
| [ ] | Item watts, hours, on/off | FP | Aim at the item; press to switch it. | Click the item; edit its card. | Pull a lever on the block. | A switch on the item in the scene (`EnergyPanel.tsx:332-350` is a list). | Interact prompt writing the same three fields. |
| [ ] | Add panel, browse solar, add tank | FP | Jetpack to the roof; place from the air tool bar. | Drag onto the roof or the ground. | Place as a block. | Litres from this tank in the Eco sheet (`quantities.ts:26`). | Roof snap; watts and litres read from the product. |

Where each tool works on the web today, with file and line: `scan/CITY-SITE-ECO.md`, section 2.

## Part 2. The design format on one page

### The design format on one page

One design is one `Property` object, plain JSON. The tree below has 468 field lines: 24 at the top level, the rest nested. Columns: `name: type | unit | req or opt | default | meaning | proof`. `Vertex` is `{ x: number, y: number }` in metres (`G:37-40`). A range such as `2..8` is what the loader accepts; outside it the value, the entity or the whole section is dropped as section 3 says.

```text
Property  [PS:338-384]  one JSON object; it has no version field
  id: string | none | req | nanoid(8) on create | design identity; shared edits cannot change it | PS:352, PS:501, src/sharedBuild/contract.ts:176-182
  name: string | none | req | 'Wellness Property' | design title | PS:353, PS:502, PS:2249
  activeRoomId: string | none | req | first room's id | UI focus; must name an existing room | PS:354, PS:2242-2245
  rooms: Room[] | none | req | one blank room | rooms, outdoor buckets and roof slabs of all storeys | PS:355, PS:2238-2241
    id: string | none | req | nanoid(8); nanoid(10) when made from closed walls | room identity (roof slab ids: section 2) | PS:250, PS:412, PS:2082
    name: string | none | req | 'Main Room' on create, 'Room' on load | label | PS:251, PS:410, PS:2486
    polygon: Vertex[] | m | req | [] = blank room or outdoor bucket | closed outline, clockwise, last point not repeated | PS:253, G:42-43, D/openings.ts:183-202
      x: number | m | req | none | plan east | G:37-40
      y: number | m | req | none | plan south, down the page | G:37-40
    placedItems: PlacedItem[] | none | req | [] | products in this room; copied unchecked on load | PS:254, PS:2488
      instanceId: string | none | req | nanoid(10) | unique across the whole design | PS:194, PS:783-785, PS:795-803
      productId: string | none | req | none | catalogue id; the item's size is not in the design | PS:195, src/components/RoomView3D.tsx:341-342
      x: number | m | req | none | min x of the rotated footprint's bounding box | PS:196, D/roomView3d.ts:166-168, D/fitToSize.ts:197-214
      y: number | m | req | none | min y of that box; world frame, not room-relative | PS:197, D/roomView3d.ts:166-168
      rotation: number | deg | req | none | clockwise on the plan about the footprint centre | PS:198, D/fitToSize.ts:215-217, src/components/RoomCanvas.tsx:5930-5939
      parentInstanceId: string | none | opt | absent | instanceId of the table or shelf it sits on | PS:205
      mountHeightCm: number | cm | opt | product mount height, else 120 | wall item: underside above the storey floor | PS:207, D/placedItemElevation.ts:6
      lightOn: false | none | opt | absent = on | lamp switched off | PS:213, PS:494-496
      powerOn: false | none | opt | absent = on; only false is stored | appliance off in the energy estimate | PS:218, PS:1904-1907
      hoursPerDay: number, 1 decimal, max 24 | hours | opt | absent = product default | energy estimate override | PS:220, PS:1921-1924
      powerW: integer, max 100000 | W | opt | absent = product figure | energy estimate override | PS:228, PS:1950-1953
    openings: Opening[] | none | opt | absent = [] | doors, doorways, windows and holes in this room's walls | PS:267, PS:2498, PS:2666-2668
      id: string | none | req | nanoid(10) | unique across the whole design | D/openings.ts:44, PS:1441, PS:651
      edgeIndex: integer | none | req | none | host edge: polygon[i] to polygon[i+1] | D/openings.ts:46, D/wallEdges.ts:51-52
      offsetM: number | m | req | none | from the edge's start vertex to the opening's centre | D/openings.ts:48, D/openings.ts:81-84
      widthM: number 0.05..100 | m | req | none (tool: door 0.838, window 1.2) | clear width; diameter for a circle | D/openings.ts:50, D/openings.ts:68-70, D/openingGeometry.ts:24
      kind: 'door' | 'doorway' | 'window' | 'hole' | none | req | none | what is cut in the wall | D/openings.ts:40, D/openings.ts:51
      flipFacing: boolean | none | req | false = swings into the host room | side of the wall the leaf swings to | D/openings.ts:53, D/openings.ts:168-170
      flipHand: boolean | none | req | false = hinge at the start side | end of the opening that holds the hinge | D/openings.ts:55, D/openings.ts:373-374
      sillM: number 0..100 | m | opt | window 0.9; hole 0; door and doorway always 0 | bottom of the opening above the floor | D/openings.ts:57, D/openingGeometry.ts:11-14
      heightM: number 0.05..100 | m | opt | door, doorway 2.04; window 1.2; hole 1; circle = widthM | clear height | D/openings.ts:59, D/openingGeometry.ts:6-10, WP:175-176
      shape: 'rectangle' | 'arch' | 'circle' | none | opt | absent = rectangle | profile on the wall face; no circle for doors | D/openings.ts:41, D/openings.ts:61, D/openingGeometry.ts:28
    floorFinish: { materialId } or null | none | opt | null or absent = bare floor | one finish over the whole room | PS:281, PS:2501-2504
      materialId: string | none | req | none | id in the bundled floor material table | PS:281, src/data/floorMaterials.ts:13
    floorTiles: FloorZone[] | none | opt | absent = none; when present it wins over floorFinish | per-tile floor, one zone per material | PS:298, PS:278-279, PS:2510
      materialId: string | none | req | none | floor material id | D/floorTiles.ts:33
      tileWm: number > 0 | m | req | none | tile size along x | D/floorTiles.ts:35, PS:2594-2595
      tileHm: number > 0 | m | req | none | tile size along y | D/floorTiles.ts:36, PS:2594-2595
      originM: Vertex | m | req | min corner of the room's bounding box | world origin of the tile lattice | D/floorTiles.ts:41, D/floorTiles.ts:212-215
      runs: number[] | none | req | [] | flat triples: row, first column, tile count | D/floorTiles.ts:43, D/floorTiles.ts:225-234
    wallPaint: PaintedEdge[] | none | opt | absent = bare plaster | paint per edge and side, sparse | PS:305, PS:2517-2543
      edgeIndex: integer | none | req | none | painted polygon edge | PS:181
      paintId: string | none | req | none | id in the bundled paint tables | PS:182, WP:688-690
      side: 'interior' | 'exterior' | none | opt | absent = interior | which face of the wall | PS:180, D/wallConstruction.ts:8, D/wallConstruction.ts:33
      colourHex: string '#RRGGBB' | none | opt | absent = the paint's base colour | chosen tint, upper case | PS:183, WP:847-853
      colourName: string, max 80 | none | opt | absent | tint name for the quote line | PS:184, WP:856-860
    wallConstruction: ConstructedEdge[] | none | opt | absent = plastered brick | substrate and thickness per edge | PS:306, PS:2511, D/wallConstruction.ts:34-45
      edgeIndex: integer | none | req | none | polygon edge | D/wallConstruction.ts:12
      kind: 'plastered-brick' | 'brick' | 'concrete' | 'glass' | none | req | none | wall substrate | D/wallConstruction.ts:9, D/wallConstruction.ts:21-26
      thicknessMm: number | mm | opt | glass 10; other kinds none | kept only within 25..2000, glass 2..40 | D/wallConstruction.ts:10, D/wallConstruction.ts:13-20
      materialProductId: string | none | opt | absent | glass only: catalogue reference of that thickness | D/wallConstruction.ts:10, D/wallConstruction.ts:18-19
    wallCladding: CladEdge[] | none | opt | absent = none | cladding board product per edge | PS:311, PS:2544-2560
      edgeIndex: integer | none | req | none | polygon edge | D/claddingCalc.ts:18
      productId: string | none | req | none | cladding catalogue id; unknown ids are dropped on load | D/claddingCalc.ts:19, PS:2554
    levelId: string | none | opt | absent = 'ground' (the stored form for ground) | storey of the room | PS:318, D/levels.ts:110-113, PS:428-433
    kind: 'room' | 'outdoor' | 'roof' | none | opt | absent = 'room' | outdoor = item bucket; roof = roof slab | PS:327, PS:2482
    removedWallEdges: integer[] | none | opt | absent = none | edge indices that carry no wall | PS:249, D/wallEdges.ts:77, PS:2484
  levels: Level[] | none | opt | absent or empty = one ground storey | storeys plus at most one roof level | PS:357, D/levels.ts:95-98
    id: string | none | req | 'ground'; 'roof'; else nanoid(8) | storey identity | D/levels.ts:32, D/levels.ts:18, D/levels.ts:28, PS:1520
    name: string | none | req | 'Ground floor', 'First floor' to 'Third floor', 'Level N', 'Roof' | label | D/levels.ts:33, D/levels.ts:136-141, D/levels.ts:29
    index: number | none | req | ground 0; a new storey = highest storey + 1 | sort order; gaps allowed; the roof sorts last | D/levels.ts:35, D/levels.ts:148-152, D/levels.ts:85-92
    kind: 'roof' | none | opt | absent = a storey | marks the one roof level | D/levels.ts:40, D/levels.ts:48-50
    heightM: number 2..8 | m | opt | Property.wallHeightM, else 2.7 | clear wall height of the storey; never on the roof | D/levels.ts:42, D/building.ts:9-10, D/building.ts:53-56, D/building.ts:66-70
    elevationM: number | m | opt | previous elevation + height + 0.18 | finished floor level above the ground datum | D/levels.ts:44, D/building.ts:8, D/building.ts:63-73
  activeLevelId: string | none | opt | absent = 'ground' | UI focus storey; follows the active room | PS:359, PS:2270-2277
  walls: FreeWall[] | none | opt | absent = none | free-standing walls; room walls are not stored | PS:361, PS:2278-2279
    id: string | none | req | nanoid(10); nanoid(8) on a copied storey | wall identity | D/freeWalls.ts:26, PS:2069, PS:1549
    a: Vertex | m | req | none | centre-line start | D/freeWalls.ts:28
    b: Vertex | m | req | none | centre-line end; length at least 0.0001 m | D/freeWalls.ts:29, D/freeWalls.ts:54
    thicknessM: number > 0 | m | req | pen 0.12; materials.wall.thicknessM once that is set | slab thickness, centred on the line | D/freeWalls.ts:30, PS:2047, PS:2076, D/roomSolids.ts:286-289
    levelId: string | none | opt | absent = ground; new walls store the active level, 'ground' included | storey of the wall | D/freeWalls.ts:32, PS:2077
    construction: 'plastered-brick' | 'brick' | 'concrete' | 'glass' | none | opt | absent = plastered | substrate | D/freeWalls.ts:23, D/wallConstruction.ts:9
    materialProductId: string | none | opt | absent | glass reference; kept on load for glass only | D/freeWalls.ts:24, PS:2383-2388
    paintId: string | none | opt | absent = bare | paint on the first face | D/freeWalls.ts:34, PS:2371-2373
    paintColourHex: string '#RRGGBB' | none | opt | absent = base colour | tint; kept only with paintId | D/freeWalls.ts:39, PS:2374-2376
    paintColourName: string | none | opt | absent | tint name; kept only with a tint | D/freeWalls.ts:41, PS:2377-2378
    paintFaces: 1 | 2 | none | opt | absent = 1; only 2 is stored | faces painted | D/freeWalls.ts:46, PS:2381
    exteriorPaint: PaintedEdge | none | opt | absent | paint on the second face; edgeIndex 0, side 'exterior' | D/freeWalls.ts:25, PS:2389
    claddingId: string | none | opt | absent | cladding catalogue id | D/freeWalls.ts:48, PS:2390-2392
    claddingFaces: 1 | 2 | none | opt | absent = 1; only 2 is stored | faces clad | D/freeWalls.ts:50, PS:2393
  site: Site or null | none | opt | absent or null = no plot | rectangular plot and optional geographic payload | PS:363, PS:2280-2281
    widthM: number 1..500 | m | req | none; clamped | plot size along x | PS:237, PS:245-246, PS:474-480
    depthM: number 1..500 | m | req | none; clamped | plot size along y | PS:238, PS:474-480
    originM: Vertex | m | req | (0, 0) when missing | plot's min corner in the plan frame | PS:239, PS:481-487
    world: GeoSite | none | opt | absent | geographic plot; kept opaque on load, checked after first paint | PS:241, PS:488-490, src/site/hydration.ts:44-65
      version: 1 | none | req | 1 | any other value rejects the payload | ST:50, ST:180
      name: string, max 160 | none | req | none | plot label | ST:51, ST:191
      origin: [lon, lat] | deg | req | boundary[0] | WGS84 anchor of the local frame | ST:52, ST:5, SG:210
      boundary: [lon, lat][], 3..200 | deg | req | none | plot corners on the globe | ST:53, ST:183-186
      polygon: Vertex[] | m | req | made from boundary and anchor | same corners in plan metres: x east, y south | ST:55, SG:11-22, SG:211-214
      anchor: Vertex | m | req | none | plan position given to boundary[0] | ST:56, SG:212-213
      entry: 'drawn' | 'traverse' | none | req | 'drawn' | how the boundary was entered | ST:57, SG:206
      traverse: { lengthM, bearing }[], max 200 | none | opt | absent | surveyor legs as typed | ST:58, ST:285-295
        lengthM: number > 0, max 10000 | m | req | none | leg length | ST:58, ST:290
        bearing: string, max 79 | deg as text | req | none | clockwise from north, or quadrant form | ST:58, SG:135-166
      closureErrorM: number >= 0 | m | opt | absent | gap left by the traverse | ST:59, ST:277-280
      terrain: TerrainInput | none | opt | absent | spot heights and a platform level | ST:60, ST:8-15
        source: 'typed what-if' | 'survey' | none | req | none | where the heights came from | ST:9, ST:218
        verticalReference: string, max 300 | none | req | none | datum description | ST:10, ST:219-220
        points: { x, y, z }[], 3..1000 | m | req | none | plan x, y and height z | ST:11, ST:7, ST:222-225
        contours: integer[][] | none | opt | absent | lines as indices into points | ST:13, ST:236-246
        platformM: number | m | req | none | proposed platform level | ST:14, ST:221
      planning: { setbackM, maxCoveragePct, source, verified } | none | opt | absent | planning rule typed by the user | ST:61, ST:257-275
        setbackM: number 0..1000 | m | req | none | boundary setback | ST:61, ST:261-262
        maxCoveragePct: number, above 0 to 100 | percent | req | none | allowed plot coverage | ST:61, ST:263-264
        source: string, max 1000 | none | req | none | where the rule came from | ST:61, ST:265-266
        verified: boolean | none | req | none | user says it was checked | ST:61, ST:267
      publicData: PublicSnapshot | none | opt | absent | cached public data, 30,000 characters at most | ST:62, ST:16-48, ST:173
        fetchedAt: string, ISO time | none | req | none | when the snapshot was taken | ST:17, ST:91
        errors: string[], max 20 | none | opt | absent | fetch errors kept for display | ST:47, ST:93-96
        solar: object | none | opt | absent | public solar yield figure | ST:18-27, ST:97-120
          annualKwh: number >= 0 | kWh | req | none | yearly yield figure | ST:19
          tiltDeg: number 0..90 | deg | req | none | panel tilt used | ST:20
          sourceUrl: string | none | req | none | must start with the allowed data host | ST:21, ST:105
          acquiredAt: string, ISO time | none | opt | absent | acquisition time | ST:22
          radiationDatabase: string, max 100 | none | opt | absent | data set name | ST:23
          periodStartYear: integer 1900..2200 | none | opt | absent | first year of the series | ST:24, ST:87
          periodEndYear: integer 1900..2200 | none | opt | absent | last year of the series | ST:25, ST:87
          version: string, max 80 | none | opt | absent | data service version | ST:26
        context: object | none | opt | absent | counts of mapped neighbours | ST:28-36, ST:121-142
          roads: integer >= 0 | none | req | none | mapped roads nearby | ST:29
          buildings: integer >= 0 | none | req | none | mapped buildings nearby | ST:30
          waterways: integer >= 0 | none | req | none | mapped waterways nearby | ST:31
          power: integer >= 0 | none | req | none | mapped power features nearby | ST:32
          landuse: string[], max 200 | none | req | none | land-use tags | ST:33
          sourceUrl: string | none | req | none | must start with the allowed map host | ST:34, ST:129
          acquiredAt: string, ISO time | none | opt | absent | acquisition time | ST:35
        terrain: object | none | opt | absent | public heights at the boundary corners | ST:37-46, ST:143-171
          heightsM: number[] | m | req | none | one height per boundary corner | ST:38, ST:147-149
          resolutionM: number > 0 | m | req | none | grid size of the source | ST:39
          sourceUrl: string | none | req | none | must start with the allowed data host | ST:40, ST:154
          verticalReference: string, max 300 | none | req | none | datum description | ST:41
          sources: string[], max 200 | none | opt | absent | source list | ST:42
          attribution: string, max 2000 | none | opt | absent | credit line | ST:43
          resolutionNote: string, max 1000 | none | opt | absent | note on accuracy | ST:44
          acquiredAt: string, ISO time | none | opt | absent | acquisition time | ST:45
      foundationShiftM: number, abs <= 100 | m | opt | absent | a shift value (its use was not read) | ST:63, ST:281-284
      sample: true | none | opt | absent | marks a practice plot | ST:64, ST:301-304
  wallHeightM: number | m | opt | 2.7; kept on load only within 2.0..4.0 | storey clear height when a level has none | PS:369, PS:2284-2287, WP:170-172
  stairs: BuildingStair[] | none | opt | absent = none | straight flights between two storeys | PS:371, PS:2294-2295
    id: string | none | req | nanoid(8) | stair identity | D/building.ts:13, PS:1614
    fromLevelId: string | none | req | none | lower storey; never the roof | D/building.ts:14, D/building.ts:146-148
    toLevelId: string | none | req | none | upper storey, higher index | D/building.ts:15, D/building.ts:146-148
    x: number | m | req | 0 | footprint centre | D/building.ts:16-17, PS:1613
    y: number | m | req | 0 | footprint centre | D/building.ts:18, PS:1613
    widthM: number 0.6..5 | m | req | 1 | across the flight | D/building.ts:19, D/building.ts:150
    runM: number 1..30 | m | req | max(3, 1.5 x rise) | plan length of the flight | D/building.ts:20, D/building.ts:150, PS:1613
    rotation: number | deg | req | 0; stored 0..360 | clockwise; at 0 the flight climbs toward +y | D/building.ts:16, D/building.ts:21-22, D/building.ts:153
  roof: RoofConfig | none | opt | flat, felt, 25, 0.2 when a roof level exists | roof form and covering | PS:372, PS:2296-2297, D/building.ts:39-41
    style: 'flat' | 'gable' | 'shed' | none | req | 'flat' | roof form | D/building.ts:29, D/building.ts:105
    material: 'felt' | 'tile' | 'metal' | 'iron-sheet' | 'concrete' | none | req | 'felt' | covering | D/building.ts:30, D/building.ts:106
    pitchDeg: number 5..60 | deg | req | 25; clamped | slope of gable and shed roofs | D/building.ts:33, D/building.ts:110-111
    overhangM: number 0..1.5 | m | req | 0.2; clamped | eaves beyond the outline | D/building.ts:34, D/building.ts:112-113
    thicknessM: number 0.0003..2 | m | opt | iron sheet 0.001; concrete 0.12; else 0.08 | covering thickness, normal to the face | D/building.ts:32, D/building.ts:107, D/roofSurface.ts:7-14
    outline: Vertex[] | m | opt | absent = one slab per room of the top storey | authored roof footprint, clockwise | D/building.ts:36, D/building.ts:103-104, D/roof.ts:84-94
  garden: Garden | none | opt | absent = none | ground surfaces, pools and fences | PS:374, PS:2298-2299, D/garden.ts:65-68
    surfaces: GardenSurface[] | none | req | [] | ground patches and pools; later ones draw on top | D/garden.ts:66, D/garden.ts:75
      id: string, max 100 | none | req | nanoid(10) | unique across surfaces and fences | D/garden.ts:25, D/garden.ts:99, D/garden.ts:163-171, PS:1993
      kind: 'lawn' | 'soil' | 'gravel' | 'path' | 'concrete' | 'tarmac' | 'pool' | none | req | none | surface type | D/garden.ts:26, D/garden.ts:5-14
      x: number, abs <= 10000 | m | req | none | min corner | D/garden.ts:27-28, D/garden.ts:107
      y: number, abs <= 10000 | m | req | none | min corner | D/garden.ts:29, D/garden.ts:107
      widthM: number 0.2..500 | m | req | none | size along x | D/garden.ts:30, D/garden.ts:108
      depthM: number 0.2..500 | m | req | none | size along y (plan depth, not thickness) | D/garden.ts:31, D/garden.ts:38, D/garden.ts:108
      elevationM: number 0..2 | m | req | none | raised level above the ground | D/garden.ts:33, D/garden.ts:109
      pavingProductId: string | none | opt | absent | paving reference id | D/garden.ts:35, D/garden.ts:119
      outline: Vertex[] | m | opt | absent = the rectangle | shape inside the x, y, width, depth box; not for pools | D/garden.ts:37, D/garden.ts:110-111, D/garden.ts:116
      thicknessM: number 0.001..5 | m | opt | absent | material thickness | D/garden.ts:39, D/garden.ts:112
      subBaseDepthM: number 0..10 | m | opt | absent | sub-base depth | D/garden.ts:40, D/garden.ts:113
      pool: GardenPool | none | opt | the defaults below when kind is 'pool' | pool basin; kept only for kind 'pool' | D/garden.ts:41, D/garden.ts:114, D/garden.ts:54-57
        shellDepthM: number 0.2..10 | m | req | 1.5 | floor to rim | D/garden.ts:45, D/garden.ts:130
        waterDepthM: number 0..shellDepthM | m | req | 1.35 | water depth from the floor | D/garden.ts:46, D/garden.ts:130
        wallThicknessM: number 0.01..2 | m | req | 0.2 | shell wall | D/garden.ts:47, D/garden.ts:131
        baseThicknessM: number 0.01..2 | m | req | 0.2 | shell base | D/garden.ts:48, D/garden.ts:131
        excavationMarginM: number 0..5 | m | req | 0.3 | dig beyond the shell | D/garden.ts:49, D/garden.ts:132
        stage: 'excavation' | 'shell' | 'filled' | none | req | 'filled' | build stage shown | D/garden.ts:50, D/garden.ts:132
        productReferenceId: string | none | opt | absent | reference only | D/garden.ts:52, D/garden.ts:135
      pilotPermeable: boolean | none | never stored | absent | render-time flag; dropped on load | D/garden.ts:23-24, D/buildingScene.ts:35
    fences: GardenFence[] | none | req | [] | straight fence or hedge runs | D/garden.ts:67
      id: string, max 100 | none | req | nanoid(10) | unique across surfaces and fences | D/garden.ts:59, PS:2013
      a: Vertex | m | req | none | run start | D/garden.ts:60, D/garden.ts:100-101
      b: Vertex | m | req | none | run end; length 0.2..1000 | D/garden.ts:61, D/garden.ts:156
      heightM: number 0.3..3 | m | req | none | fence height | D/garden.ts:62, D/garden.ts:155
      material: 'timber' | 'metal' | 'hedge' | none | req | none | fence type | D/garden.ts:63, D/garden.ts:15-20
  wallPaintCoats: integer 1..3 | none | opt | absent = each paint's own figure | paint estimate: coats override | PS:380, PS:2304-2308
  wallPaintWastePct: integer 0..25 | percent | opt | absent = calculator default (not read) | paint estimate: touch-up allowance | PS:381, PS:2311-2315
  wallPaintPrimer: true | none | opt | absent = false; only true is stored | paint estimate: add a primer line | PS:383, PS:2293
  eco: EcoModel | none | opt | absent | trees, green roofs and the water study | PS:340, PS:2264, D/ecoContract.ts:54-61
    version: 1 | none | req | 1 | any other value drops the whole section | D/ecoContract.ts:56, D/eco.ts:16-19
    trees: EcoTree[], max 300 | none | req | [] | existing and proposed trees | D/ecoContract.ts:58, D/eco.ts:14-15
      id: string 1..128 | none | req | none | unique across trees and green roofs | D/ecoContract.ts:10, D/ecoContract.ts:3, D/ecoContract.ts:63-77
      name: string 1..160 | none | req | none | label | D/ecoContract.ts:11
      x: number, abs <= 10000 | m | req | none | trunk position | D/ecoContract.ts:12
      y: number, abs <= 10000 | m | req | none | trunk position | D/ecoContract.ts:13
      heightM: number 0.1..100 | m | req | none | tree height | D/ecoContract.ts:14
      canopyRadiusM: number 0.1..50 | m | req | none | canopy radius | D/ecoContract.ts:15
      status: 'existing' | 'proposed' | none | req | none | tree status | D/ecoContract.ts:16
      species: string 1..160 | none | opt | absent | species text | D/ecoContract.ts:17
      stemDiameterMm: number 1..5000 | mm | opt | absent | stem diameter | D/ecoContract.ts:18
      protectionMethod: 'unconfirmed' | 'bs5837-single-stem' | 'surveyed' | none | req | none | how the protection radius is set | D/ecoContract.ts:19, D/eco.ts:27-32
      protectionRadiusM: number 0.1..100 | m | opt | absent | surveyed protection radius | D/ecoContract.ts:20
      surveyRef: string 1..500 | none | opt | absent | survey reference text | D/ecoContract.ts:21
      veteran: boolean | none | opt | absent | veteran tree flag | D/ecoContract.ts:22
    greenRoofs: GreenRoof[], max 100 | none | req | [] | planted roof build-ups, one per roof room | D/ecoContract.ts:59, D/ecoContract.ts:78-87
      id: string 1..128 | none | req | none | unique across trees and green roofs | D/ecoContract.ts:29
      name: string 1..160 | none | req | none | label | D/ecoContract.ts:30
      roomId: string 1..128 | none | req | none | id of a room of kind 'roof' | D/ecoContract.ts:31, D/eco.ts:47
      areaM2: number 0.01..1000000 | m2 | opt | absent = the roof room's area | planted area | D/ecoContract.ts:32, D/eco.ts:48-50
      saturatedKgM2: number 0.01..10000 | kg per m2 | opt | absent | saturated build-up weight | D/ecoContract.ts:33
      extraRetainedWaterMm: number 0..1000 | mm | opt | absent | water on top of that weight | D/ecoContract.ts:35
      additionalLoadCapacityKPa: number 0..1000 | kPa | opt | absent | engineer's extra load allowance | D/ecoContract.ts:36
      capacityRef: string 1..500 | none | opt | absent | reference text | D/ecoContract.ts:37
      specificationRef: string 1..500 | none | opt | absent | reference text | D/ecoContract.ts:38
    waterStudy: WaterStudy | none | opt | absent | water balance inputs and render switches | D/ecoContract.ts:57, D/ecoContract.ts:42-51, src/eco/water.ts:17
      region: 'North' | 'South' | 'East' | 'West' | 'Centre' | 'Rodrigues' | none | req | 'Centre' | rainfall region | D/ecoContract.ts:43
      place: string, max 60 | none | opt | absent | place label | D/ecoContract.ts:44
      kinetic: boolean | none | opt | absent | show the kinetic demonstration item | D/ecoContract.ts:44, D/buildingScene.ts:36-41
      wind: boolean | none | opt | absent | show the wind demonstration item | D/ecoContract.ts:44, D/buildingScene.ts:36-41
      windPoint: { x, y } | m | opt | (2, 0) | where the wind item stands | D/ecoContract.ts:45, D/buildingScene.ts:39
      kineticPoint: { x, y } | m | opt | (0, 0) | where the kinetic item stands | D/ecoContract.ts:46, D/buildingScene.ts:39
      people: integer 0..10000 | none | req | 2 | household size | D/ecoContract.ts:47
      runoff: number 0..1 | fraction | req | 0.8 | roof runoff share | D/ecoContract.ts:47, src/eco/water.ts:21
      tankL: number 0..10000000 or null | litres | req | null | tank size | D/ecoContract.ts:47
      homeLDay: number 0..1000 | litres per person per day | req | 45 | household demand | D/ecoContract.ts:48, src/eco/water.ts:21
      greyLDay: number 0..1000 | litres per person per day | req | 15 | grey water made | D/ecoContract.ts:48, src/eco/water.ts:22
      gardenLDay: number 0..100 | litres per m2 per day | req | 2 | garden demand | D/ecoContract.ts:48, src/eco/water.ts:21
      infiltration: number 0..1 | fraction | req | 0.5 | paving infiltration share | D/ecoContract.ts:49, src/eco/water.ts:22
      recycledPct: number 0..100 | percent | req | 0 | recycled share (its use was not read) | D/ecoContract.ts:49
      aggregateTM3: number 0..5 | none | req | 1.5 | aggregate factor (its use was not read) | D/ecoContract.ts:49
      mossRoom: string or null | none | req | null | room id whose walls render green and textured | D/ecoContract.ts:50, src/components/RoomView3D.tsx:316-326
      blockRoom: string or null | none | req | null | room id whose bare walls render as blockwork | D/ecoContract.ts:50, src/components/RoomView3D.tsx:321
      pavingId: string or null | none | req | null | garden surface id rendered as permeable | D/ecoContract.ts:50, D/buildingScene.ts:35
      coolRoof: boolean | none | req | false | roof rendered with a cool coating | D/ecoContract.ts:50, D/buildingScene.ts:87
  engineering: EngineeringInputs | none | opt | absent | text references to project evidence | PS:342, PS:2265, D/ecoContract.ts:91-100
    version: 1 | none | req | 1 | any other value drops the section | D/ecoContract.ts:93, D/eco.ts:20-23
    geotechnicalReportRef: string 1..500 | none | opt | absent | reference text | D/ecoContract.ts:94
    structuralDesignRef: string 1..500 | none | opt | absent | reference text | D/ecoContract.ts:95
    concreteGrade: string 1..500 | none | opt | absent | reference text | D/ecoContract.ts:96
    reinforcementGrade: string 1..500 | none | opt | absent | reference text | D/ecoContract.ts:97
    utilityDesignRef: string 1..500 | none | opt | absent | reference text | D/ecoContract.ts:98
  city: CityModel | none | opt | absent | district plan: roads, networks and assets | PS:343, PS:2263, D/city.ts:79-87
    version: 1 | none | req | 1 | any other value drops the whole city | D/city.ts:80, D/city.ts:196
    enabled: boolean | none | req | true in a new city | city layer on or off | D/city.ts:81, D/city.ts:149-158
    site: { originM, widthM, lengthM } | m | req | origin (-50, -50), 300 by 240 | district rectangle | D/city.ts:82, D/city.ts:153
      originM: Vertex, abs <= 10000 | m | req | (-50, -50) | min corner | D/city.ts:82, D/city.ts:198
      widthM: number 1..10000 | m | req | 300 | size along x | D/city.ts:82, D/city.ts:199
      lengthM: number 1..10000 | m | req | 240 | size along y | D/city.ts:82, D/city.ts:200, D/city.ts:210-211
    roads: CityRoad[], max 64 | none | req | [] | road centre lines; 128 segments in all | D/city.ts:83, D/city.ts:91, D/city.ts:94, D/city.ts:250-251
      id: string 1..128 | none | req | none | unique across roads, networks and assets | D/city.ts:25, D/city.ts:163-164, D/city.ts:214-219
      name: string 1..128 | none | req | none | label | D/city.ts:26, D/city.ts:216
      presetId: string 1..128 | none | req | none | section preset key; four bundled keys, any key accepted | D/city.ts:27, D/city.ts:101-130, D/city.ts:233
      points: { x, y }[], 2..65 | m | req | none | centre line; steps of at least 0.01 m | D/city.ts:28, D/city.ts:237-249
      widthM: number 0.5..100 | m | req | preset value | carriageway width | D/city.ts:29, D/city.ts:234
      surfaceDepthM: number 0.001..2 | m | req | preset value | surface layer depth | D/city.ts:30, D/city.ts:235
      baseDepthM: number 0..5 | m | req | preset value | base layer depth | D/city.ts:31, D/city.ts:236
      supplierRef: string 1..128 | none | opt | absent | supplier reference key | D/city.ts:32, D/city.ts:173, D/city.ts:260
    networks: CityNetwork[], max 128 | none | req | [] | buried utility routes; 128 segments in all | D/city.ts:84, D/city.ts:92, D/city.ts:95, D/city.ts:290-291
      id: string 1..128 | none | req | none | unique across roads, networks and assets | D/city.ts:35
      name: string 1..128 | none | req | none | label | D/city.ts:36
      system: 'water' | 'sewer' | 'stormwater' | 'power' | 'fibre' | none | req | none | utility type | D/city.ts:37, D/city.ts:13
      points: { x, y, z }[], 2..65 | m | req | none | route; z = elevation above ground datum, -30..100 | D/city.ts:38, D/city.ts:10-12, D/city.ts:275-289, D/cityContract.ts:110
      diameterMm: number 1..5000 | mm | req | none | outside diameter; must fit the trench | D/city.ts:40, D/city.ts:269, D/city.ts:272-273
      trenchWidthM: number 0.05..20 | m | req | none | trench width | D/city.ts:41, D/city.ts:270
      trenchDepthM: number 0.05..30 | m | req | none | trench depth | D/city.ts:42, D/city.ts:271
      supplierRef: string 1..128 | none | opt | absent | supplier reference key | D/city.ts:43, D/city.ts:300
      stockLengthM: number 0.1..10000 | m | opt | absent | supply length of one pipe or duct | D/city.ts:44, D/city.ts:274
    assets: CityAsset[], max 300 | none | req | [] | boxes on the plan; 64 buildings and data centres at most | D/city.ts:85, D/city.ts:93, D/city.ts:96, D/city.ts:323-327
      id: string 1..128 | none | req | none | unique across roads, networks and assets | D/city.ts:47
      name: string 1..128 | none | req | none | label | D/city.ts:48
      kind: 'solar-light' | 'pv-array' | 'battery' | 'water-tank' | 'transformer' | 'ev-charger' | 'park' | 'data-centre' | 'building' | none | req | none | asset type | D/city.ts:49, D/city.ts:14-23
      x: number, abs <= 10000 | m | req | none | centre | D/city.ts:50-51, D/city.ts:310
      y: number, abs <= 10000 | m | req | none | centre | D/city.ts:52, D/city.ts:310
      widthM: number 0.05..1000 | m | req | none | size along x at rotation 0 | D/city.ts:53, D/city.ts:311, D/city.ts:414-427
      lengthM: number 0.05..1000 | m | req | none | size along y at rotation 0 | D/city.ts:54, D/city.ts:312, D/city.ts:414-427
      heightM: number 0.01..500 | m | req | none | box height | D/city.ts:55, D/city.ts:313
      rotation: number | deg | req | none; stored 0..360 | clockwise about the centre | D/city.ts:50, D/city.ts:56, D/city.ts:314, D/city.ts:337
      supplierRef: string 1..128 | none | opt | absent | supplier reference key | D/city.ts:57, D/city.ts:339
      buildingLink: 'current' | none | opt | absent | marks the one asset tied to this design's house | D/city.ts:58, D/city.ts:315, D/city.ts:322
      buildingForm: CityRoomForm[], 1..64 | none | opt | absent | stamped building as unit-box prisms; kind 'building' only | D/city.ts:59, D/city.ts:340-345, D/cityBuildingForm.ts:4-8
        base: number 0..1 | fraction of heightM | req | none | prism bottom | D/cityBuildingForm.ts:5, D/cityBuildingForm.ts:14-15
        top: number 0..1, above base | fraction of heightM | req | none | prism top | D/cityBuildingForm.ts:6, D/cityBuildingForm.ts:15
        polygon: { x, y }[], 3..128 | fraction of widthM, lengthM | req | none | outline about the centre, each value -0.5..0.5 | D/cityBuildingForm.ts:7, D/cityBuildingForm.ts:16-19, D/cityBuildingForm.ts:26-28
      powerW: number 0..1e9 | W | opt | absent | electrical load | D/city.ts:60, D/city.ts:316-318
      solarKWp: number 0..1e9 | kWp | opt | absent | solar rating | D/city.ts:61, D/city.ts:316-318
      batteryKWh: number 0..1e9 | kWh | opt | absent | storage size | D/city.ts:62, D/city.ts:316-318
      tankCapacityL: number 0..1e9 | litres | opt | absent | tank size | D/city.ts:63, D/city.ts:316-318
      hoursPerDay: number 0..24 | hours | opt | absent | daily running time | D/city.ts:64, D/city.ts:319
    dataCentre: CityDataCentre | none | opt | absent | scenario inputs of one data centre | D/city.ts:86, D/city.ts:351-381
      racks: integer 0..100000 | none | req | none | rack count | D/city.ts:67, D/city.ts:356-357
      kWPerRack: number 0..1000 | kW | req | none | IT load per rack | D/city.ts:68, D/city.ts:358
      utilisation: number 0..1 | fraction | req | none | average load share | D/city.ts:69, D/city.ts:359
      pue: number 1..5 | ratio | req | none | facility power over IT power | D/city.ts:70, D/city.ts:360
      annualHours: number 0..8784 | hours | req | none | running hours a year | D/city.ts:71, D/city.ts:361
      pvKWp: number 0..1e9 | kWp | req | none | solar rating | D/city.ts:72, D/city.ts:362
      yieldKWhPerKWp: number 0..8760 | kWh per kWp | req | none | yearly solar yield | D/city.ts:73, D/city.ts:363
      batteryKWh: number 0..1e9 | kWh | req | none | storage size | D/city.ts:74, D/city.ts:364
      batteryUsableFraction: number 0..1 | fraction | req | none | usable share of storage | D/city.ts:75, D/city.ts:365
      wueLPerKWh: number 0..100 | litres per kWh | opt | absent | water per IT kWh | D/city.ts:77, D/city.ts:366
  foundation: FoundationModel | none | opt | absent | slabs, strips, pads and bores | PS:344, PS:2261, D/foundation.ts:36-43
    version: 1 | none | req | 1 | any other value drops the section | D/foundation.ts:37, D/foundation.ts:88
    enabled: boolean | none | req | false in the empty model | foundation layer on or off | D/foundation.ts:38, D/foundation.ts:53
    elements: FoundationElement[], max 100 | none | req | [] | axis-aligned concrete boxes | D/foundation.ts:39, D/foundation.ts:54, D/foundation.ts:90-91
      id: string 1..128 | none | req | none | unique across elements and bores | D/foundation.ts:24, D/foundation.ts:80-81, D/foundation.ts:107-108
      name: string 1..128 | none | req | none | label | D/foundation.ts:25, D/foundation.ts:109
      kind: 'slab' | 'strip' | 'pad' | none | req | none | element type | D/foundation.ts:26, D/foundation.ts:13
      x: number, abs <= 10000 | m | req | none | rectangle centre | D/foundation.ts:27, D/foundation.ts:1-3, D/foundation.ts:221-230
      y: number, abs <= 10000 | m | req | none | rectangle centre | D/foundation.ts:28, D/foundation.ts:112
      lengthM: number 0.1..1000 | m | req | none | size along x | D/foundation.ts:29, D/foundation.ts:113, D/foundation.ts:223-224
      widthM: number 0.1..1000 | m | req | none | size along y | D/foundation.ts:30, D/foundation.ts:114, D/foundation.ts:225-226
      depthM: number 0.01..10 | m | req | none | concrete thickness, downward from the top | D/foundation.ts:31, D/foundation.ts:115, D/foundation.ts:227
      topElevationM: number -30..10 | m | req | none | top level relative to the ground floor datum | D/foundation.ts:32, D/foundation.ts:116, D/foundation.ts:2-3
      rebar: FoundationRebar | none | req | the 8 values below | reinforcement inputs; all 8 required | D/foundation.ts:33, D/foundation.ts:14, D/foundation.ts:63-75
        enabled: boolean | none | req | false | count steel or not | MT:35, D/foundation.ts:118
        diameterMm: number 4..50 | mm | req | 10 | bar diameter | MT:35, D/foundation.ts:119
        spacingMm: number 10..2000 | mm | req | 200 | bar spacing | MT:35, D/foundation.ts:120
        layers: integer 1..10 | none | req | 1 | layers of steel | MT:35, D/foundation.ts:121-122
        coverMm: number 0..300 | mm | req | 50 | concrete cover | MT:36, D/foundation.ts:123
        stockLengthM: number 0.5..30 | m | req | 6 | bar stock length | MT:36, D/foundation.ts:124
        lapLengthM: number 0..10, below stockLengthM | m | req | 0 | lap length | MT:36, D/foundation.ts:125-126
        wastePct: number 0..100 | percent | req | 5 | waste allowance | MT:36, D/foundation.ts:127
      excavation: FoundationExcavation | none | opt | absent = shown as filled | the hole around the concrete | D/foundation.ts:34, D/foundation.ts:15-22, D/foundation.ts:245-246
        depthM: number 0.01..30 | m | req | none | hole depth | D/foundation.ts:17, D/foundation.ts:145
        topElevationM: number -30..10 | m | req | none | hole top level; concrete must sit inside | D/foundation.ts:18, D/foundation.ts:146, D/foundation.ts:149-150
        marginM: number 0..20 | m | req | none | hole beyond the concrete on each side | D/foundation.ts:19, D/foundation.ts:147
        stage: 'excavated' | 'filled' | none | req | none | design preview stage | D/foundation.ts:21, D/foundation.ts:148
    bores: FoundationBore[], max 100 | none | opt | absent | cylindrical holes | D/foundation.ts:41, D/foundation.ts:55, D/foundation.ts:182-183
      id: string 1..128 | none | req | none | unique across elements and bores | D/foundation.ts:45, D/foundation.ts:188-189
      name: string 1..128 | none | req | none | label | D/foundation.ts:46, D/foundation.ts:190
      x: number, abs <= 10000 | m | req | none | centre | D/foundation.ts:47, D/foundation.ts:191
      y: number, abs <= 10000 | m | req | none | centre | D/foundation.ts:48, D/foundation.ts:192
      diameterM: number 0.1..100 | m | req | none | bore diameter | D/foundation.ts:49, D/foundation.ts:193
      depthM: number 0.01..30 | m | req | none | bore depth | D/foundation.ts:50, D/foundation.ts:194
      topElevationM: number -30..10 | m | req | none | top level relative to the ground floor datum | D/foundation.ts:51, D/foundation.ts:195
    concreteProductId: string, one of two literals | none | opt | absent | product family reference (literals not copied here) | D/foundation.ts:42, D/foundation.ts:95-100
  boundaryComponents: BoundaryComponent[], max 128 | none | opt | absent | measured 3D wire and face components | PS:345, PS:2260, D/boundaryModel.ts:7-17
    id: string, pattern [a-zA-Z0-9_-]{1,96} | none | req | none | unique in the list | D/boundaryModel.ts:8, D/boundaryModel.ts:213-215
    name: string 1..80 | none | req | none | label | D/boundaryModel.ts:9, D/boundaryModel.ts:216-218
    vertices: { x, y, z }[], max 512 | m | req | none | x, y plan; z elevation up; abs <= 100000 | D/boundaryModel.ts:10, D/boundaryModel.ts:1-6, D/boundaryModel.ts:34-40
    edges: [integer, integer][], max 1024 | none | req | none | pairs of 0-based vertex indices | D/boundaryModel.ts:11, D/boundaryModel.ts:237-245
    faces: integer[][], max 256, each 3..128 | none | req | none | signed 1-based edge references; negative = edge walked backwards | D/boundaryModel.ts:12-13, D/boundaryModel.ts:142-153
  terrainCuts: TerrainCut[], max 512 | none | opt | absent | one-metre excavation cells | PS:346, PS:2259, D/terrainCuts.ts:2-10
    id: string | none | req | x + ',' + y | must equal the cell's x and y joined by a comma | D/terrainCuts.ts:4, D/terrainCuts.ts:11, D/terrainCuts.ts:28
    x: integer, abs <= 100000 | m | req | none | min corner of a 1 m by 1 m cell | D/terrainCuts.ts:5, D/terrainCuts.ts:12-17, D/terrainCuts.ts:24-26
    y: integer, abs <= 100000 | m | req | none | min corner of the cell | D/terrainCuts.ts:6, D/terrainCuts.ts:25-27
    topM: number, abs <= 10000 | m | req | none | ground height above the project datum | D/terrainCuts.ts:7, D/terrainCuts.ts:2, D/terrainCuts.ts:30-31
    depthM: number, above 0 to 20 | m | req | none | cut depth; pit floor = topM - depthM | D/terrainCuts.ts:8, D/terrainCuts.ts:32-34, D/terrainCuts.ts:71
  shade: ShadeModel | none | opt | absent | shade sails between fixing points | PS:348, PS:2262, D/shade.ts:99-103
    version: 1 | none | req | 1 | any other value drops the section | D/shade.ts:100, D/shade.ts:125
    enabled: boolean | none | req | false in the empty model | shade layer on or off | D/shade.ts:101, D/shade.ts:105
    sails: ShadeSail[], max 20 | none | req | [] | sails; one invalid sail drops the section | D/shade.ts:102, D/shade.ts:106, D/shade.ts:122-125
      id: string 1..128 | none | req | none | unique in the list | D/shade.ts:86, D/shade.ts:119, D/shade.ts:130
      name: string 1..128 | none | req | none | label | D/shade.ts:87, D/shade.ts:130
      fabric: 'hdpe-knit' | 'pvc-coated' | none | req | none | fabric type | D/shade.ts:88, D/shade.ts:43
      anchors: ShadeAnchor[], 3..6 | none | req | none | fixing points in outline order | D/shade.ts:89, D/shade.ts:107-108
        id: string 1..128 | none | req | none | unique in the sail | D/shade.ts:73, D/shade.ts:136
        x: number, abs <= 10000 | m | req | none | plan position | D/shade.ts:74-75, D/shade.ts:136
        y: number, abs <= 10000 | m | req | none | plan position | D/shade.ts:76, D/shade.ts:136
        heightM: number 0.5..12 | m | req | none | fixing height above the ground datum | D/shade.ts:77-78, D/shade.ts:136
        support: 'post' | 'wall' | none | req | none | what holds the point | D/shade.ts:79, D/shade.ts:44
      cornerGapM: number 0.05..1 | m | req | 0.3 for a new sail | hardware gap from fixing point to sail corner | D/shade.ts:91, D/shade.ts:109, D/shade.ts:131
      edgeCurvePct: number 0..15 | percent of the chord | req | 7 for a new sail | inward curve of each edge | D/shade.ts:93, D/shade.ts:110, D/shade.ts:131
      colour: string '#rrggbb' | none | req | none | display colour | D/shade.ts:95, D/shade.ts:120
      made: { edgesM } | none | opt | absent | present when the sail already exists | D/shade.ts:97, D/shade.ts:81-84
        edgesM: number[], one per edge, each 0.3..60 | m | req | none | finished edge lengths in anchor order | D/shade.ts:83, D/shade.ts:143
  services: BuildingServices | none | opt | absent | pipe, duct and cable runs with fixtures | PS:349, PS:2255-2258, D/buildingServices.ts:80-85
    version: 1 | none | req | 1 | any other value drops the section | D/buildingServices.ts:81, D/buildingServices.ts:133
    runs: ServiceRun[], first 2000 read | none | req | [] | pipe, duct or cable routes; invalid ones are skipped | D/buildingServices.ts:82, D/buildingServices.ts:139
      id: string 1..128 | none | req | none | unique across runs, fixtures and junctions | D/buildingServices.ts:48, D/buildingServices.ts:117, D/buildingServices.ts:135-137
      levelId: string 1..128 | none | req | none | an existing level id; ground is written 'ground' | D/buildingServices.ts:49, D/buildingServices.ts:137, PS:2230
      system: 'cold-water' | 'hot-water' | 'waste' | 'electrical' | 'ventilation' | 'refrigerant' | 'fire-water' | 'data' | none | req | none | service type | D/buildingServices.ts:50, D/buildingServices.ts:4-12
      materialId: string 1..128 | none | req | none | id in the bundled service material table | D/buildingServices.ts:51, D/buildingServices.ts:145
      diameterMm: number 5..1000 | mm | req | none | nominal diameter | D/buildingServices.ts:52, D/buildingServices.ts:146
      points: ServicePoint[], 2..500 | none | req | none | route nodes; whole length at least 0.01 m | D/buildingServices.ts:53, D/buildingServices.ts:149-151, D/buildingServices.ts:188
        x: number, abs <= 10000 | m | req | none | plan position | D/buildingServices.ts:32, D/buildingServices.ts:159
        y: number, abs <= 10000 | m | req | none | plan position | D/buildingServices.ts:33, D/buildingServices.ts:160
        elevationM: number -20..20 | m | opt | absent = interpolated from start to end | node height above the storey floor | D/buildingServices.ts:34-35, D/buildingServices.ts:264-282
        junctionId: string 1..128 | none | opt | absent | junction this node sits on | D/buildingServices.ts:36-37, D/serviceConnections.ts:125-130
      startElevationM: number -20..20 | m | req | none | centre line above the storey floor; negative = below | D/buildingServices.ts:54-55, D/buildingServices.ts:147
      endElevationM: number -20..20 | m | req | none | same, at the last node | D/buildingServices.ts:56, D/buildingServices.ts:148
      startConnection: { fixtureId, portId } | none | opt | absent | fixture port the first node is tied to | D/buildingServices.ts:57-58, D/buildingServices.ts:181-187
        fixtureId: string 1..128 | none | req | none | id of a fixture | D/buildingServices.ts:28, D/buildingServices.ts:122
        portId: one of the 8 system values | none | req | none | which port of that fixture | D/buildingServices.ts:29, D/buildingServices.ts:122-123
      endConnection: { fixtureId, portId } | none | opt | absent | fixture port the last node is tied to | D/buildingServices.ts:59, D/buildingServices.ts:182
    fixtures: ServiceFixture[], first 2000 read | none | req | [] | sanitary, electrical and air fixtures | D/buildingServices.ts:83, D/buildingServices.ts:193
      id: string 1..128 | none | req | none | unique across runs, fixtures and junctions | D/buildingServices.ts:62
      levelId: string 1..128 | none | req | none | an existing level id | D/buildingServices.ts:63
      kind: 'toilet' | 'sink' | 'mains-tap' | 'electrical-board' | 'sewer-connection' | 'air-conditioner' | 'outdoor-ac' | 'air-grille' | 'extractor-fan' | 'sprinkler' | 'fire-extinguisher' | 'security-camera' | 'network-switch' | none | req | none | fixture type | D/buildingServices.ts:64, D/buildingServices.ts:13-26
      x: number, abs <= 10000 | m | req | none | centre (derived from the port maths) | D/buildingServices.ts:65, D/serviceConnections.ts:73-85
      y: number, abs <= 10000 | m | req | none | centre | D/buildingServices.ts:66, D/serviceConnections.ts:73-85
      widthM: number 0.005..5 | m | req | per kind table | size along x at rotation 0 | D/buildingServices.ts:67, D/buildingServices.ts:97-114, D/buildingServices.ts:201
      depthM: number 0.005..5 | m | req | per kind table | size along y at rotation 0 | D/buildingServices.ts:68, D/buildingServices.ts:202
      heightM: number 0.005..5 | m | req | per kind table | fixture height | D/buildingServices.ts:69, D/buildingServices.ts:203
      rotation: number | deg | req | none; stored 0..360 | clockwise about the centre | D/buildingServices.ts:70, D/buildingServices.ts:204, D/buildingServices.ts:218
      elevationM: number -20..20 | m | opt | 0 | bottom of the fixture above the storey floor | D/buildingServices.ts:71-72, D/serviceConnections.ts:92
      productReferenceId: string 1..128 | none | opt | absent | catalogue reference | D/buildingServices.ts:73-74
      portElevationsM: object keyed by system value | m | opt | absent = schematic defaults | port heights above the storey floor, each -20..20 | D/buildingServices.ts:75-76, D/buildingServices.ts:220-227
      connectionLabel: string 1..128 | none | opt | absent | project reference text | D/buildingServices.ts:77-78, D/buildingServices.ts:228
    junctions: ServiceJunction[] | none | opt | absent | explicit shared nodes | D/buildingServices.ts:84, D/buildingServices.ts:234-256
      id: string 1..128 | none | req | none | unique across runs, fixtures and junctions | D/buildingServices.ts:40
      levelId: string 1..128 | none | req | none | an existing level id | D/buildingServices.ts:41
      system: one of the 8 system values | none | req | none | service type | D/buildingServices.ts:42, D/buildingServices.ts:240
      x: number, abs <= 10000 | m | req | none | plan position | D/buildingServices.ts:43, D/buildingServices.ts:241
      y: number, abs <= 10000 | m | req | none | plan position | D/buildingServices.ts:44, D/buildingServices.ts:242
      elevationM: number -20..20 | m | req | none | height above the storey floor | D/buildingServices.ts:45, D/buildingServices.ts:243
  materials: MaterialsSettings | none | opt | absent; the normaliser fills every default | estimating inputs and user-typed rates | PS:351, PS:2266, MT:2-49, MS:41-85
    version: 1 | none | req | 1 | always written as 1 | MT:3, MS:47
    scope: 'all' | 'active' | none | req | 'all' | estimate every storey or the active one | MT:8, MS:47
    quotationTaxBasis: 'inclusive' | 'exclusive' | none | opt | absent | tax basis of the typed rates | MT:7, MS:48
    unitRates: object keyed by line id, first 200 | none | opt | absent | user-typed rates per estimate line | MT:5, MS:49-55
      mur: number 0..1e9 | money | req | none | the rate as typed | MT:5, MS:51
      unit: 'blocks' | 'm²' | 'm³' | 'kg' | 'bags' | 'm' | 'bars' | 'sheets' | 'pieces' | none | req | none | unit the rate applies to | MT:5, MT:87, MS:52
      specification: string, max 500 | none | req | none | what the rate was quoted for | MT:5, MS:52
      taxBasis: 'inclusive' | 'exclusive' | none | opt | absent | tax basis of this rate | MT:5, MS:54
    wall: object | none | req | the 9 values below | masonry unit and joint | MT:9-21, MS:56-61
      kind: 'block' | 'concrete' | none | req | 'block' | wall build | MT:10, MS:56
      presetId: string | none | req | a bundled block preset id; else 'custom' | block preset key | MT:11, MS:9, MS:57
      thicknessM: number 0.025..2 | m | req | 0.15 | wall thickness; copied to every non-glass wall | MT:13, MS:58, D/masonryDimensions.ts:7-22
      blockLengthM: number 0.05..2 | m | req | 0.45 | block length | MT:14, MS:58
      blockHeightM: number 0.05..2 | m | req | 0.2 | block height | MT:15, MS:59
      dimensionBasis: 'actual' | 'nominal' | none | req | 'actual' | how block sizes are stated | MT:16, MS:59
      jointMm: number 0..40 | mm | req | 10 | mortar joint | MT:17, MS:60
      beddingFraction: number 0.01..1 | fraction | req | 1 | bedded share of the joint | MT:19, MS:60
      wastePct: number 0..100 | percent | req | 5 | waste allowance | MT:20, MS:61
    mortar: VolumeMix | none | req | the 7 values below | mortar mix | MT:22, MT:51-58, MS:6, MS:62
      cement: number 0.01..100 | parts by volume | req | 1 | cement parts | MT:53, MS:33
      sand: number 0.01..100 | parts by volume | req | 3 | sand parts | MT:53, MS:33
      aggregate: number 0..100 | parts by volume | req | 0; forced 0 for mortar and plaster | stone parts | MT:53, MS:34
      dryVolumeFactor: number 1..3 | ratio | req | 1.33 | dry to wet volume | MT:54, MS:35
      cementBulkDensityKgM3: number 500..2000 | kg per m3 | req | 1440 | cement density | MT:55, MS:36
      bagKg: number 1..100 | kg | req | 25 | bag size | MT:56, MS:37
      wastePct: number 0..100 | percent | req | 10 | waste allowance | MT:57, MS:37
    plaster: object | none | req | the 3 values below | plaster coat | MT:23, MS:63-64
      sides: 0 | 1 | 2 | none | req | 0 | plastered faces | MT:23, MS:63
      thicknessMm: number 1..100 | mm | req | 15 | coat thickness | MT:23, MS:64
      mix: VolumeMix | none | req | as mortar, sand 4 | plaster mix; the same 7 fields as mortar | MT:23, MS:12, MS:64
    concrete: VolumeMix plus supply | none | req | 1, 2, 3, 1.54, 1440, 25, 5 | concrete mix; the same 7 fields as mortar | MT:24, MS:13, MS:65
      supply: 'ready-mix' | 'site-mix' | none | req | 'ready-mix' | how concrete is bought | MT:24, MS:65
    base: object | none | req | the 3 values below | legacy ground slab | MT:25, MS:66
      enabled: boolean | none | req | false | count the base or not | MT:25, MS:66
      depthM: number 0.01..5 | m | req | 0.15 | slab depth | MT:25, MS:66
      areaOverrideM2: number or null | m2 | req | null | null = measured footprint | MT:25, MS:28-29, MS:66
    pillars: object | none | req | the 4 values below | columns | MT:26, MS:67-68
      count: integer 0..10000 | none | req | 0 | number of pillars | MT:26, MS:67
      widthM: number 0.05..5 | m | req | 0.2 | pillar width | MT:26, MS:67
      depthM: number 0.05..5 | m | req | 0.2 | pillar depth | MT:26, MS:68
      heightM: number 0.05..100 | m | req | 2.7 | pillar height | MT:26, MS:68
    roof: object | none | req | the 7 values below | roof takeoff inputs (not the drawn roof) | MT:27-48, MS:69-83
      kind: 'none' | 'reinforced-concrete' | 'sheet' | none | req | 'none' | roof build for the estimate | MT:28, MS:69
      depthM: number 0.01..5 | m | req | 0.15 | slab depth | MT:29, MS:70
      areaOverrideM2: number or null | m2 | req | null | null = measured | MT:30, MS:70
      lengthOverrideM: number or null | m | req | null | null = bounding box | MT:32, MS:71
      widthOverrideM: number or null | m | req | null | null = bounding box | MT:33, MS:71
      rebar: object | none | req | off, 10, 200, 1, 25, 6, 0, 5 | the same 8 fields as foundation rebar; coverMm 0..200 | MT:34-37, MS:17, MS:72-75
      sheet: object | none | req | the 15 values below | sheet roofing inputs | MT:38-47, MS:18-20, MS:76-83
        presetId: string | none | req | a bundled sheet preset id; else 'custom' | sheet preset key | MT:39, MS:18, MS:76
        pitchDeg: number 0..75 | deg | req | 15 | pitch used for the takeoff | MT:39, MS:77
        slopes: 1 | 2 | none | req | 2 | number of slopes | MT:39, MS:77
        effectiveCoverM: number 0.1..3 | m | req | 1 | cover width of one sheet | MT:41, MS:78
        sheetLengthM: number 0.1..30 | m | req | 6 | sheet length | MT:41, MS:78
        endLapM: number 0..2 | m | req | 0.2 | end lap | MT:41, MS:79
        overhangM: number 0..3 | m | req | 0 | eaves overhang | MT:42, MS:79
        wastePct: number 0..100 | percent | req | 5 | waste allowance | MT:42, MS:80
        fastenersPerM2: number 0..100 | per m2 | req | 5 | fixings | MT:42, MS:80
        ridgeLengthM: number 0..10000 | m | req | 0 | ridge trim | MT:43, MS:81
        flashingLengthM: number 0..10000 | m | req | 0 | flashing | MT:43, MS:81
        gutterLengthM: number 0..10000 | m | req | 0 | gutter | MT:43, MS:81
        trimStockLengthM: number 0.1..30 | m | req | 3 | trim stock length | MT:44, MS:82
        trimLapM: number 0..2 | m | req | 0.15 | trim lap | MT:44, MS:82
        purlinSpacingM: number 0..10 | m | req | 0 | 0 = purlins left out | MT:46, MS:83
```

What the design does not hold. An item's size, height, placement kind (`'floor' | 'surface' | 'wall' | 'ceiling' | 'roof'`), default mount height, front edge and mesh come from the product record found by `productId` (`src/data/products.schema.ts:72`, `:99-106`, `:204`, `:212`, `:219`, `:187`). Paint colours, floor colours and tile sizes, cladding colours come from bundled tables by id (`WP:866-873`, `src/data/floorMaterials.ts:13-41`, `D/wallConstruction.ts:76-82`). Product lookup order: demo ranges, bundled list, cached merchant products with ids `m-[number]` (`src/data/products.ts:41-47`, `src/data/apiCatalogAdapter.ts:201`).

### Conventions

**Frame**
1. One world frame for every storey, in metres: x to the right (east), y down the page (south), height up. Rooms of all storeys share it; coordinates may be negative; there is no fixed origin (`PS:42-45`, `D/city.ts:1-3`, `D/roomSolids.ts:15-16`, `D/link/planGeometry.ts:23-24`).
2. North is up the page, minus y (`SG:11`, `src/components/three/ThreeStage.tsx:223`). Bearings run clockwise from north: x grows with sin, y falls with cos (`SG:167-178`).
3. Web 3D mapping: plan (x, y, height) goes to three.js (x, height, y); a plan rotation of r degrees becomes a yaw of minus r about the up axis (`src/components/three/ThreeStage.tsx:24-26`, `D/fitToSize.ts:215-217`, `src/components/three/buildingMeshes.ts:31-32`).
4. Derived, to check in the engine with one asymmetric item: the plan frame with height up is left-handed (x east, y south, z up), the same handedness as a z-up engine whose positive yaw turns x toward y. So plan (x, y, z) in metres maps to engine (X, Y, Z) with a factor of 100 for centimetres and no mirror, and a plan rotation in degrees is the yaw in degrees with the same sign. Basis: every rotation formula in the code turns +x toward +y for a positive angle (`D/building.ts:128-136`, `D/city.ts:414-427`, `D/serviceConnections.ts:73-85`).
5. Walk pose sent between players: `{ x, y, z, yaw, moving }` where x, y are plan metres, z is height, yaw is the three.js yaw in radians (`src/walk/runtime.ts:631`, `src/sharedBuild/remotePlayers.ts:54`, `src/sharedBuild/contract.ts:40-48`).

**Units**
6. Metres for every length and position, except: `mountHeightCm` (cm); `diameterMm`, `thicknessMm`, `spacingMm`, `coverMm`, `jointMm`, `stemDiameterMm`, `extraRetainedWaterMm` (mm); product sizes in the catalogue (cm: `src/data/products.schema.ts:99-106`).
7. Angles are degrees everywhere in the design: `rotation`, `pitchDeg`, `tiltDeg`. Radians appear only in derived values (`D/wallEdges.ts:60-61`, `D/roomView3d.ts:58-69`).
8. `...Pct` fields are percent 0..100; `runoff`, `infiltration`, `utilisation`, `batteryUsableFraction`, `beddingFraction` are fractions 0..1 (section 1).
9. Geographic values are `[longitude, latitude]` in WGS84 degrees, longitude first (`ST:5`, `ST:80-81`). The local plot is a tangent plane at `boundary[0]` (`SG:11-22`, `SG:210`).
10. Colours are strings: `#RRGGBB` upper case for paint tints (`WP:847-853`), `#rrggbb` any case for sails (`D/shade.ts:120`).

**Rooms and walls**
11. A room wall is not stored. It is derived: edge i of `polygon` runs from vertex i to vertex i+1, the last edge closes to vertex 0; an edge is a wall unless `removedWallEdges` holds i or the edge is 1 mm or shorter (`D/wallEdges.ts:47`, `D/wallEdges.ts:72-96`).
12. Every stored room polygon winds clockwise on the y-down page (positive shoelace sum). The inward normal of an edge with direction (dx, dy) is (-dy, dx). A rectangle's edges are 0 top, 1 right, 2 bottom, 3 left (`D/openings.ts:183-202`, `PS:915-919`, `D/roomSolids.ts:159-165`, `D/aiDesignContract.ts:135-141`).
13. Wall thickness and side. In 2D a room wall is stroked centred on the edge at 0.1 m (`D/wallAwarePlacement.ts:45-51`). In 3D the slab sits outside the polygon line with its inner face on the line; thickness = that edge's `wallConstruction.thicknessMm` / 1000 when set, else 0.01 for glass, else 0.14 (`D/roomSolids.ts:218`, `D/roomView3d.ts:233`, `src/components/three/ThreeStage.tsx:614-624`). Free walls and a glass edge shared by two rooms are centred on their line (`D/roomSolids.ts:71`, `:221`, `:289`; `D/sharedGlass.ts:14-37`). Once `materials` exists, every non-glass edge and free wall gets `materials.wall.thicknessM` (`D/masonryDimensions.ts:7-22`, `PS:2076`).
14. Wall height = the storey's height (rule 20). Roof slabs have no walls (`D/buildingScene.ts:52-54`).
15. A wall shared by two rooms exists as two edges, one per room, running in opposite directions; matching uses a 1 mm tolerance (`D/wallEdges.ts:175-204`). A door in a shared wall is stored on one room only and is cut into the neighbour's edge at render time by projecting its world span (`src/components/RoomView3D.tsx:272-303`).
16. Opening position: `offsetM` is measured from the edge's start vertex to the opening's centre; the gap is offset minus and plus half the width; 0.1 m of wall must remain at each end; openings on one wall may not overlap unless they are at different heights (`D/openings.ts:78-106`, `D/openings.ts:133-162`). `flipFacing: false` swings toward the inward normal; `flipHand: false` puts the hinge at the start end of the gap (`D/openings.ts:168-170`, `:373-374`).
17. Free walls that close a loop are turned into a room and leave `walls` (`PS:737-743`, `PS:2082`, `D/connectedWallRooms.ts:1-2`, `:55-57`). The same wall can so move from `walls[]` to a room edge between two saves.
18. Three kinds of entry in `rooms`: a normal room; one `kind: 'outdoor'` bucket per storey with `polygon: []` that holds items placed outside every room (`PS:2114-2130`); `kind: 'roof'` slabs on the roof level. A blank room with `polygon: []` is also kept on a storey so the draw tool has a target (`PS:395-418`, `PS:452-463`). A reader skips floors and walls for any polygon with fewer than 3 points and still reads its items.

**Storeys**
19. Ground has id `'ground'` and index 0; the roof has id `'roof'`, `kind: 'roof'`, and sorts last; a new storey gets nanoid(8) and index = highest storey index + 1; imports use `import-floor-N`, guided drafts use `floor-N` (`D/levels.ts:18-29`, `:63-65`, `:85-92`, `:148-152`; `D/planImport.ts:347`; `D/aiDesignContract.ts:346`). No basement tool exists in the code read; a negative `elevationM` is accepted (`D/building.ts:58-60`).
20. Storey height = `level.heightM` when 2..8, else `wallHeightM` when 2..8, else 2.7. Floor elevation = `level.elevationM` when set, else the previous storey's elevation + its height + 0.18 slab. The roof level sits on the highest storey that has a drawn room: that storey's elevation + height + 0.18 (`D/building.ts:8-10`, `:53-85`).
21. "Ground" is written three ways: a room on ground has no `levelId` (`PS:428-433`); a free wall may carry `'ground'` or nothing (`PS:2077`, `D/freeWalls.ts:32`); services always carry `'ground'` (`D/buildingServices.ts:137`). Read all through one rule: absent or empty means `'ground'` (`D/levels.ts:110-113`).
22. Roof slabs are generated, not authored: one room per drawn room of the top storey with id `roof-` + source room id, or one room `roof-custom-outline` when `roof.outline` is set; items and floor on a slab are kept across rebuilds (`D/roof.ts:37-40`, `:80-160`). Roof form: the slope runs along the shorter side of the outline's bounding box, the ridge of a gable is at its middle, a shed rises from the low side (`D/roofSurface.ts:70-93`).

**Items**
23. `x, y` is the min corner of the axis-aligned box around the footprint after rotation. Footprint at rotation 0: product length along x, product width along y. Box size: swapped at 90 and 270; for other angles w = L|cos| + W|sin|, h = L|sin| + W|cos| (`G:49-68`). Centre = (x + w/2, y + h/2); the body turns clockwise by `rotation` about that centre (`D/fitToSize.ts:197-219`, `D/link/planGeometry.ts:81-83`, `src/components/RoomCanvas.tsx:5930-5939`).
24. An item's storey is its room's storey. Height of its base above that floor: floor items 0; wall items `mountHeightCm`, else the product's mount height, else 120 cm; surface items the height of the parent's product; ceiling items storey height minus item height; roof items sit on the roof surface plus 0.06 m (`D/roomSolids.ts:236-254`, `D/placedItemElevation.ts:4-13`, `D/buildingScene.ts:74-84`, `D/roofSurface.ts:8`, `:96-108`).
25. The web skips an item whose product is unknown and keeps it in the data (`src/components/RoomView3D.tsx:341-342`). A product's front at rotation 0 is its bottom edge, toward +y, unless `front_edge` says otherwise (`src/data/products.schema.ts:197-204`).

**Other anchors**
26. Centre anchored: stairs, city assets, foundation elements and bores, service fixtures, trees. Min-corner anchored: items, garden surfaces, the plot, the city site, terrain cells, floor tile lattices (section 1 proofs). Floor tile (row, col) covers x from `originM.x + col * tileWm` and y from `originM.y + row * tileHm` (`D/floorTiles.ts:80-91`).
27. Heights are relative to different datums: openings and items to their storey floor; service runs, nodes and fixtures to their storey floor (`D/buildingServices.ts:54`); foundation tops to the ground floor datum (`D/foundation.ts:1-3`); city network z, shade anchors and boundary component z to the ground datum (`D/cityContract.ts:110`, `D/shade.ts:77`, `D/boundaryModel.ts:1`); terrain `topM` to a project datum (`D/terrainCuts.ts:2`).

**Ids**
28. Ids are strings made with nanoid: 8 characters for a design, room, storey, stair; 10 for an item, opening, free wall, garden surface or fence, and a room made from walls (`PS:412`, `PS:501`, `PS:784`, `PS:1441`, `PS:1520`, `PS:1614`, `PS:1993`, `PS:2013`, `PS:2069`, `PS:2082`). Fixed ids: `'ground'`, `'roof'`, `roof-[room id]`, `roof-custom-outline`, terrain cell `x,y`. Imports and demos use readable ids (`D/planImport.ts:381`, `:403`).
29. Uniqueness scopes: item `instanceId` and opening `id` across the whole design (`PS:795-803`, `PS:651`); services ids across runs, fixtures and junctions; foundation ids across elements and bores; city ids across roads, networks and assets; eco ids across trees and green roofs; garden ids across surfaces and fences (section 1 proofs).
30. For a shared build every key and id must be 1..150 characters and not `__proto__`, `constructor` or `prototype`; numbers must be finite with an absolute value up to 1e12 (`src/sharedBuild/contract.ts:24-39`).

**Absent, null and tolerances**
31. Absent means default and is the stored form: no `levels` on a one-storey design, no `levelId` on ground rooms, `lightOn` and `powerOn` only when false, `wallPaintPrimer` only when true, `paintFaces` and `claddingFaces` only when 2 (`D/levels.ts:4-16`, `PS:1904-1907`, `PS:2293`, `PS:2381`). `site` and `floorFinish` may be null.
32. Tolerances: duplicate vertex 1e-6 m (`D/openings.ts:181`); shared wall and wall join 1 mm (`D/wallEdges.ts:47`, `D/connectedWallRooms.ts:14`). Vertices are said to be rounded to 4 decimals (`D/freeWalls.ts:96`, `D/wallAwarePlacement.ts:54-56`); the rounding code for rooms was not read.

### Loading and saving

**Storage key and shape**
- Key `ppw_property_v2` in `localStorage`. When the page is `/designer?pilotPlan=[key]` and the key matches `^[a-z0-9][a-z0-9-]{0,79}$`, the key is `ppw-pilot-plan-[key]`. It is chosen once, when the module loads (`PS:386-390`, `PS:2171-2172`).
- Shape: `{"state":{"property":Property,"showGrid":boolean,"pxPerMetre":number},"version":2}` (`PS:2171-2178`; written by hand in the same shape at `src/pilots/plans.ts:33-36`). `showGrid` default true, `pxPerMetre` default 100 and limited to 20..400 (`PS:810-811`, `PS:2156`). This `version: 2` is the version of the storage wrapper, not of the design.
- A first-generation key `ppw_design_v1` (one rectangle and its items) is read once when the main key is empty (`PS:391`, `PS:508-537`, `PS:808`).

**List A: the storage merge** (`PS:2200-2216`). It runs on every reload from browser storage. It keeps the stored `Property` object as it is and cleans only these parts:

| Part cleaned | How | Proof |
|---|---|---|
| `rooms[].polygon` winding, and with it `openings`, `removedWallEdges`, `wallConstruction`, `wallPaint`, `wallCladding` of a room whose polygon changed | re-wound clockwise, edge indices remapped | `PS:2202`, `PS:2702-2723` |
| `levels[].heightM`, `levels[].elevationM`, `stairs`, `roof` | invalid values removed | `PS:2202`, `D/building.ts:163-188` |
| `garden` | invalid surfaces and fences removed | `PS:2202`, `D/garden.ts:178-185` |
| `materials` | clamped, defaults filled | `PS:2203` |
| `city`, `eco`, `engineering`, `foundation`, `shade` | whole section replaced by its normaliser's result, which may be nothing | `PS:2204-2206`, `PS:2209-2210` |
| `terrainCuts`, `boundaryComponents` | removed when invalid | `PS:2207-2208` |
| `services` | entities checked against the level ids, links re-resolved | `PS:2211-2214` |

Not touched by list A, so kept as stored and unchecked: `id`, `name`, `activeRoomId`, `activeLevelId`, `walls`, `site`, `wallHeightM`, `wallPaintCoats`, `wallPaintWastePct`, `wallPaintPrimer`; a level's `id`, `name`, `index`, `kind`; a room's `id`, `name`, `placedItems`, `floorFinish`, `floorTiles`, `levelId`, `kind`. An unknown key outside the cleaned sections also survives a reload.

**List B: `normaliseLoadedProperty`** (`PS:2225-2301`). It builds a new object and copies only named fields. It runs on: `loadProperty` (`PS:2158-2162`); applying a page (`src/lib/pages.ts:66-83`), so on every page switch (`src/lib/pages.ts:132-150`), cloud open (`src/lib/cloudDesigns.ts:9-24`), plan import (`src/components/PlanImportWorkspace.tsx:248-249`) and draft apply (`src/components/AiDesignWorkspace.tsx:107-109`); a shared-build install (`src/sharedBuild/client.ts:109-128`); `savePropertyAs` (`src/store/designsStore.ts:145-152`); the storage migrations for wrapper versions below 2 (`PS:2182-2193`, `src/store/designsStore.ts:230-258`).

| Level | Fields copied, with line | Count |
|---|---|---|
| `Property` | `id` 2248, `name` 2249, `activeRoomId` 2250, `rooms` 2251, `services` 2255-2258, `terrainCuts` 2259, `boundaryComponents` 2260, `foundation` 2261, `shade` 2262, `city` 2263, `eco` 2264, `engineering` 2265, `materials` 2266, `levels` 2267, `activeLevelId` 2277, `walls` 2278-2279, `site` 2280-2281, `wallHeightM` 2284-2287, `wallPaintCoats` 2289-2290, `wallPaintWastePct` 2291-2292, `wallPaintPrimer` 2293, `stairs` 2294-2295, `roof` 2296-2297, `garden` 2298-2299 | 24 of 24 |
| Room (`PS:2448-2562`) | `removedWallEdges` 2484, `id` 2485, `name` 2486, `polygon` 2487, `placedItems` 2488, `levelId` 2489, `kind` 2490, `openings` 2498, `floorFinish` 2501-2504, `floorTiles` 2510, `wallConstruction` 2511, `wallPaint` 2517-2543, `wallCladding` 2544-2560 | 13 of 13 |
| Free wall (`PS:2353-2398`) | `id`, `a`, `b`, `thicknessM` 2361-2366; `levelId` 2367; `paintId`, `paintColourHex`, `paintColourName`, `paintFaces` 2371-2382; `construction`, `materialProductId` 2383-2388; `exteriorPaint` 2389; `claddingId`, `claddingFaces` 2390-2394 | 14 of 14 |
| Level (`PS:2323-2345`) | `id`, `name`, `index` 2330; `kind` 2333; `heightM`, `elevationM` 2334-2339 | 6 of 6 |
| Site (`PS:471-491`) | `widthM`, `depthM`, `originM`, `world` | 4 of 4 |
| Stair (`D/building.ts:139-161`) | all 8 at 151-154 | 8 of 8 |
| Roof (`D/building.ts:100-117`) | all 6 at 108-116 | 6 of 6 |
| Garden surface, pool, fence (`D/garden.ts:103-158`) | every stored field; `pilotPermeable` is left out on purpose | 12 of 13, 7 of 7, 5 of 5 |

**A field of `Property` on neither list: none.** All 24 top-level fields are on list B. List A cleans 14 of them (`rooms`, `levels`, `stairs`, `roof`, `garden`, `materials`, `city`, `eco`, `engineering`, `terrainCuts`, `boundaryComponents`, `foundation`, `shade`, `services`) and leaves 10 unchecked (named above). Two helper types lag behind the lists without losing data: `RawProperty` does not name the three paint settings and `RawRoom` does not name `wallCladding`; both are read through casts (`PS:2405-2446`, `PS:2289-2293`, `PS:2544-2546`).

**At risk of being dropped on load**
1. Any key that is not in the type, at the top level and in a room, free wall, level, site, stair, roof, garden entry and every section with a normaliser. Items and openings are the exception: `placedItems` is copied whole (`PS:2488`) and openings are filtered, not rebuilt (`PS:2647-2663`), so an extra key on an item or opening survives and a broken item is not rejected.
2. A whole section. `city`, `foundation`, `shade`: when one entity is invalid or `version` is not 1 (`D/city.ts:189-208`, `D/foundation.ts:83-93`, `D/shade.ts:122-125`). `eco`, `engineering`: also when any unknown key is present, because the schemas are strict (`D/ecoContract.ts:54-61`, `:91-100`; `D/eco.ts:16-23`). `terrainCuts`, `boundaryComponents`: when one entry is invalid (`PS:2259-2260`). `services`: when `version` is not 1; single runs, fixtures and junctions that are invalid or name an unknown level are skipped (`D/buildingServices.ts:127-137`).
3. `wallHeightM` outside 2.0..4.0 (`PS:2285`). `roof` when there is no roof level (`PS:2297`). A stair to a missing level, downward, or from the roof (`D/building.ts:146-148`). A `levelId` that names a missing level: the room or wall falls to ground (`PS:2231-2236`). An `activeLevelId` that disagrees with the active room (`PS:2276`).
4. On a free wall: `materialProductId` unless the wall is glass and a catalogue entry has that thickness; a glass thickness outside 2..40 mm becomes 10 mm (`PS:2383-2388`, `D/wallConstruction.ts:13-20`). A tint without a paint (`PS:2372-2379`).
5. `claddingId` and `wallCladding` entries whose id is not in the bundled cladding table (`PS:2391`, `PS:2554`): a design using a cladding id this build does not know loses it.
6. Openings that no longer fit their edge; paint, cladding and construction on an edge that no longer exists; floor zones with no valid tile left (`PS:2498`, `PS:2511`, `PS:2540`, `PS:2557`, `PS:2586-2614`).
7. Shape changes that are not losses: list B writes `openings` (an array, empty included) and `floorFinish: null` on every room and removes `levelId` from ground rooms (`PS:2489`, `PS:2498`, `PS:2501-2504`). A round trip through list B is not byte-identical.
8. Draft import: `terrainCuts` and `boundaryComponents` are in the draft schema but are never copied into the design (`D/aiDesignContract.ts:108-109`, `D/aiDesignProperty.ts:58-83`).

**History and undo** (`src/store/historyStore.ts`)
- A frame is `{ property, walls, floorZones, wallTreatments, label? }`: the whole design deep-cloned through JSON plus three legacy stores (`:46-55`, `:79-91`).
- 50 frames in memory; the newest 10 in `sessionStorage` under `ppw_history_top10_v1`; changes within 250 ms fold into one frame (`:41-44`, `:118-127`, `:278-299`).
- Undo and redo put a stored frame back with no normaliser (`:137-170`, `:219-239`). History is cleared on page switch, cloud open, import and draft apply (`src/lib/pages.ts:148`, `src/lib/cloudDesigns.ts:22`, `src/components/PlanImportWorkspace.tsx:251`, `src/components/AiDesignWorkspace.tsx:111`).
- A change from another player enters with no undo frame; older frames are rebased or dropped (`:456-474`). Undo is local: it changes the design and the next sync sends the difference (`src/sharedBuild/client.ts:195-201`).

**The design list** (`src/store/designsStore.ts`)
- Key `ppw_properties_v2`, shape `{"state":{"designs":{[id]:SavedDesign},"currentId":string or null},"version":2}` (`:226-229`).
- `SavedDesign`: `id` (nanoid(10) or `'__draft__'`), `name`, `savedAt` (ISO time), `property`, `cloud?: { id: number, email, savedAt }`, `walls?`, `floorZones?`, `wallTreatments?` (legacy stores of the page), `roomDimensions` and `placedItems` (a mirror of room 0) (`:26-51`, `:81-83`, `:105-128`).
- Autosave writes the open design into its page 250 ms after a change; nothing goes to the network (`src/lib/useAutoSave.ts:14-36`, `src/lib/pages.ts:118-122`, `src/lib/cloudDesigns.ts:26`). The list is sorted by `savedAt`, newest first, without the draft (`:218-221`).
- A cloud save is explicit: POST for a new copy, or GET then PUT for an update of a linked page (`src/lib/cloudDesigns.ts:27-53`). Only `property` is sent; the page's legacy walls, zones and treatments stay on the device.

**Version fields**

| Where | Field | What it does |
|---|---|---|
| `Property` | none | `PS:338-384` has no version, revision or timestamp |
| storage wrappers | `version: 2` | storage migration only (`PS:2173`, `PS:2182-2193`; `src/store/designsStore.ts:228-231`) |
| sections | `version: 1` in `city`, `eco`, `engineering`, `foundation`, `services`, `shade`, `materials`, `site.world` | any other value drops the section on load, except `materials`, which is rewritten as 1 (section 1 proofs) |
| server row `designs` | none | columns `id`, `user_id`, `customer_email`, `name`, `property`, `cart`, `status`, `created_at`, `updated_at` (`api/_db/schema.ts:645-662`) |
| live room | `revision` | starts at 1, plus 1 per accepted edit (`api/_lib/sharedBuild/handler.ts:186`, `api/_db/liveBuildStore.ts:139-148`) |
| content hash | `projectFingerprint` | SHA-256 of the design as JSON with sorted keys and without `activeRoomId`, `activeLevelId` (`D/projectHub.ts:162-184`); used by the work package and the handover file, not by any save route |

Server routes that carry a design, formats in and out, sample designs, and what a second front must do: `scan/FORMAT.md`, sections 4 to 8.

## Part 3. Everything else, one line each

Verdicts: KEEP = works, leave it. FRIENDLIER = keep it and make it simpler (the note says how). GAME = bring it into the Unreal game.

### The 2D plan and the toolbar: tools, views, panels and data

191 items. Verdict words: KEEP = as is · FRIENDLIER (how) · GAME = bring into the Unreal game.

| Item | Kind | Where | What it does (one line) | Verdict |
|---|---|---|---|---|
| **A. Tool state, stores, data** | | | | |
| 1 `BuildTool` union | store | UI:47-55, 268 | The one active plan tool: hand, eyedropper, sledgehammer, door, measure, floor, wallpaint, cladding; default hand | KEEP + GAME (same ids) |
| 2 `drawMode` (wall pen on or off) | store | APP:216, 236-272 | The wall pen is React state in the app shell, outside the tool union; opens one undo transaction | FRIENDLIER (make it one tool id) + GAME |
| 3 Old wall-tool state | store | TB:526-528; RC:812-813 | Phase of the old millimetre wall tool; nothing sets it from idle (see item 139) | KEEP (unreachable; ask `drop`) |
| 4 3D build tool state | store | R3:580; BC:17 | select, room, wall, stair, window, door; local state of the 3D view | FRIENDLIER (one tool state for both views) + GAME |
| 5 `DesignerMode` | data | D/useDesignerMode.ts:14-15; D/GamingLayer1Surfaces.tsx:10-15 | move, wall, floor, paint, inspect, buy: type left from a removed mode strip, still mapped to lessons (LD:369-376) | KEEP (leftover type) |
| 6 `HouseMode` | store | HW:31-37 | 3D rail mode: build, furnish, paint, floor, garden, energy, materials | KEEP + GAME |
| 7 `viewMode` | store | UI:125, 295-298 | plan or 3d; per session, never saved | KEEP + GAME |
| 8 Tool drafts | store | UI:76-142, 269-289 | What the next door, floor stroke, paint stroke or cladding stroke will be | KEEP + GAME |
| 9 Saved tool preferences | data | UI:58, 392-413 | Browser storage: snap unit pair, floor material, paint and tint, cladding product | KEEP |
| 10 Snap unit `precision` | store | UI:46, 153-170, 266-267 | Six steps from 1 cm to 10 m; default 0.5 m; remembers the last one for a swap | KEEP + GAME |
| 11 Object placement mode | store | S/objectPlacementStore.ts:4-17 | grid 0.5 m, half 0.25 m, free 0.001 m; free allows objects to overlap | KEEP + GAME |
| 12 Placement intent store | store | S/placementIntentStore.ts:67-95 | Armed product and its angle, place and move requests, preview functions the plan registers | KEEP + GAME |
| 13 Measured path tool store | store | S/measuredPathToolStore.ts:11-31, 51-103 | Curved wall, roof outline, outdoor outline: one tool state for plan and 3D | KEEP + GAME |
| 14 Garden editor store | store | S/gardenEditorStore.ts:5-21 | Garden panel open, selected element, pending placement | KEEP + GAME |
| 15 Opening selection store | store | RC:117, 475; C/OpeningSelectionEditor.tsx:23-24 | The selected door or window | KEEP |
| 16 Draw progress store | store | APP:248-250; RC:803-804; L/undoIntent.ts:39-42 | Wall pen points in flight | KEEP |
| 17 Drag pointer store | store | RC:3055-3110 | A catalogue drag in flight and its drop | KEEP |
| 18 Layer visibility store | store | C/DisciplineVisibilityControls.tsx:24; APP:340-350 | Which disciplines and parts show; any change puts every tool away | KEEP + GAME |
| 19 History store | store | S/historyStore.ts:41-44, 83-91 | Undo and redo as whole-design snapshots | KEEP + GAME |
| 20 Designs store | store | S/designsStore.ts:51, 139, 226 | Saved plans ("pages") plus one draft slot, in browser storage | KEEP |
| 21 Property store | store | PS:390, 810-811, 2173 | The one live design; grid on; 100 px per metre; storage version 2 | KEEP + GAME (the design) |
| 22 Lesson registry | data | LD:15-37, 92-354, 357-386 | 21 lessons; typed maps force one per plan tool, mode and 3D tool | KEEP + GAME (a lesson per tool) |
| 23 First-build quest | data | D/lessons/quest.ts:15, 56-99 | 7 steps read from the design: room, door and window, paint, floor, 3 products, 3D, walk | KEEP + GAME |
| 24 Build counts and sounds | data | D/lessons/buildCounts.ts:6-45 | Counts items, openings, rooms, walls, paint, floor, cladding; picks place, snap, remove or paint sound | KEEP + GAME |
| **B. Plan top bar: main row** | | | | |
| 25 Home link | action | TB:1767-1775 | Leaves the designer for home, shop or demo studio | KEEP |
| 26 Rooms trigger | panel | TB:1780-1804; APP:440-444 | Opens the rooms list; shows design name, room name, room count | KEEP |
| 27 Demo pill and exit | action | TB:1810-1831 | Says a demo range is loaded; × leaves it | KEEP |
| 28 Tool shelves Build / Finish / Arrange | view | TB:1841-1843, 1149-1153 | Chooses which group of tools shows | FRIENDLIER (keep all tools in sight) |
| 29 Active-tool chip | action | TB:1844, 1141 | Names the tool in hand; a tap returns to Select | KEEP + GAME |
| 30 Select | tool | TB:1852-1863, 683-688 | Stands every tool down; move, rotate, delete objects; pick a free wall | KEEP + GAME |
| 31 Walls | tool | TB:1864-1876, 663-678 | Opens the wall pen | FRIENDLIER (one pen for both views) + GAME |
| 32 Openings | tool | TB:1877-1889, 618-625 | Door, doorway, window, wall opening on a wall | FRIENDLIER (drag doors along walls) + GAME |
| 33 Floor | tool | TB:1890-1904, 627-634 | Lays floor by tile, area or room | KEEP + GAME |
| 34 Paint | tool | TB:1905-1918, 636-643 | Paints walls; also sets wall material | KEEP + GAME |
| 35 Cladding | tool | TB:1919-1932, 645-650 | Clads walls with sample boards | KEEP + GAME |
| 36 Measure | tool | TB:1933-1945, 652-661 | Tap a wall, retype its length | FRIENDLIER (work in 3D too) + GAME |
| 37 Remove | tool | TB:1948-1960, 694-698 | Tap a wall, opening, object or floor to delete it | KEEP + GAME |
| 38 Garden | tool | TB:1963-1965 | Fires `…:open-garden`; opens the garden panel | KEEP + GAME |
| 39 Room (box) and Room size panel | tool | TB:1980-1996, 2221-2271 | L and W fields of the active rectangular room | FRIENDLIER (drag the rectangle on the plan) + GAME |
| 40 Room draw toggle (custom shape) | tool | TB:1997-2013 | Opens the same wall pen as item 31 | FRIENDLIER (merge with the Walls button) |
| 41 Wall height stepper | tool | TB:2017-2023; C/WallHeightControl.tsx:9, 36-40 | Raises or lowers the active storey's walls by 0.1 m | KEEP + GAME |
| 42 Phone strip: Select, 3D, Menu | action | TB:2030-2041, 2048-2062, 2065-2076 | The three controls that stay on a phone | KEEP |
| 43 Currency switcher | view | TB:2083 | Display currency; hidden on demo and pitch pages | KEEP |
| 44 Cart link | view | TB:2088-2100 | Goes to the cart; opens an estimate dialog on read-only pages | KEEP |
| 45 Request quote | action | TB:2104-2115, 1064-1100 | Asks for an email the first time, then a note in a browser prompt (TB:1067-1075); sends the design and the cart | FRIENDLIER (one form, no browser prompts) |
| 46 More menu | panel | TB:2118-2192 | Import plan, New, New plan, Save as…, Load, Shop, Help | FRIENDLIER (name it "File") |
| **C. Plan top bar: navigation and project rows** | | | | |
| 47 View switch 2D Plan / 3D House | view | TB:2198-2201 | Changes the front | KEEP + GAME |
| 48 Layers | panel | TB:2202; C/DisciplineVisibilityControls.tsx:9, 16, 22-39 | 10 disciplines, 6 parts, 8 working views; Show all, Hide all, Only | KEEP + GAME |
| 49 Site & tools toggle | panel | TB:2203-2205, 2216-2219 | Shows or hides groups D below | FRIENDLIER (show snap and undo always) |
| 50 Floors select | action | TB:2208; C/WorkspaceFloorNav.tsx:21-44, 59-72 | Switch storey, add floor, roof; jump to city, foundation, plumbing and electric | KEEP + GAME |
| 51 City launch | view | TB:2209 | Opens the city workspace | KEEP |
| 52 Site launch | view | TB:2210 | Opens the site workspace | KEEP |
| 53 Project hub | view | TB:2211 | Fires `…:open-project` | KEEP |
| 54 Language and theme | panel | TB:2212; src/i18n/messages.ts:2; src/i18n/AppPreferences.tsx:25-29 | 4 languages (en, fr, zh-CN, es); 3 themes; saved in the browser | KEEP + GAME (same four languages) |
| 55 Materials | panel | TB:2213, 1541; C/PlanAnalysisWorkspace.tsx:9-29 | Wall, concrete and roof quantities | KEEP |
| 56 Undo (project row) | action | TB:2214 | Same undo as item 67 | KEEP |
| **D. "Site & tools" groups** | | | | |
| 57 Guide | panel | TB:1426 | Fires `…:open-house-tutorial` | KEEP |
| 58 Floors panel | panel | TB:1428-1506, 458-478 | Switch, double-click to rename, remove an empty storey, add a floor above | FRIENDLIER (a visible rename button) + GAME |
| 59 Launchers: plumbing and electric, foundation, shade | view | TB:1502-1504 | Open three specialist workspaces | KEEP + GAME |
| 60 Roof toggle | action | TB:1511-1522, 600-616 | Jumps to the roof level (makes one if missing) and back | FRIENDLIER (roof settings on the plan too) + GAME |
| 61 Solar | panel | TB:1527-1539, 1273-1276 | Sun versus use per day | KEEP |
| 62 3D button | view | TB:1545-1558 | Same switch as item 47 | KEEP |
| 63 Plot panel | tool | TB:1561-1632, 480-496 | Type width and depth, Lock plot; Clear removes it | FRIENDLIER (drag the plot corners) + GAME |
| 64 Snap unit picker | tool | TB:1647-1680 | Six units, also on keys 1 to 6 | KEEP + GAME |
| 65 Grid toggle | view | TB:1682-1692 | Shows or hides the grid | KEEP + GAME |
| 66 3D preview toggle | view | TB:1696-1708; APP:391-396, 425-430 | Rendered only when a prop is passed; the app passes none | KEEP (hidden; ask `drop`) |
| 67 Undo / Redo | action | TB:1712-1743, 502-515 | One shared undo ladder; on touch the first tap arms, the second fires | FRIENDLIER (same undo on every phone button) + GAME |
| **E. Tool option panels** | | | | |
| 68 Door options bar | panel | TB:2276-2330 | Kind (door, doorway, window, hole), width read-out, Flip side, Flip hinge, Done | KEEP |
| 69 Opening size and shape | panel | C/OpeningDimensions.tsx:6-19; RC:3397; HW:194 | Type, profile (rectangle, arch, circle), width, height, sill | KEEP + GAME |
| 70 Floor panel | panel | TB:2339-2535 | Plan or 3D, materials, Tile or Room, Erase, Clear floor, live count, Done | KEEP + GAME |
| 71 Cladding panel | panel | TB:2537-2623 | Sample boards, Wall or Room, Erase, live count, Done | KEEP |
| 72 Wall paint panel | panel | TB:2628-3213 | Side, 3D card, brand, wall height, coats, extra %, primer, paints, scope, erase, clear, colours, chart, working-out | FRIENDLIER (fewer fields on first view) |
| 73 Wall surface options | panel | C/WallSurfaceOptions.tsx:31-61 | Paint colour or Wall material; Inside or Outside; material cards; apply to active room | KEEP + GAME |
| 74 Wall dimensions | panel | C/WallDimensionsControl.tsx:14-31 | Storey wall height; masonry thickness for the whole building | KEEP + GAME |
| 75 Wall materials sheet | panel | TB:3377-3389, 1182-1192 | Opened by `…:open-wall-materials`; materials or height and thickness | KEEP |
| 76 Energy / Materials side workspace | panel | TB:3365-3372; C/PlanAnalysisWorkspace.tsx:9-29 | Docked read-outs; Esc or a tap on the plan closes them | KEEP |
| 77 3D overlay mount | view | TB:3218-3362 | The 3D house is rendered by the top bar and takes its brush callbacks from it | KEEP |
| 78 3D brush strips (phone) | panel | TB:3240-3358 | Cladding, paint or floor brush under the 3D picture | KEEP |
| 79 Phone menu sheet | panel | TB:3390-4010 | Build, Energy, Room and plan, Storeys, 3D, Plot, View, Plan files, Shop, Request quote | FRIENDLIER (shorter, grouped by task) |
| 80 Help popover | panel | TB:4015-4052 | Quick start in 8 steps and a key list | KEEP |
| 81 Load popover | panel | TB:4054-4119 | Saved designs: load, delete with a browser confirm, link to cloud designs | FRIENDLIER (a picture per saved design) |
| 82 New property confirm | panel | TB:4121-4156, 1114-1128 | Warns before a reset | KEEP |
| 83 Demo estimate dialog | panel | TB:4157 | Product estimate on read-only pages | KEEP |
| **F. Plan canvas chrome** | | | | |
| 84 Movable toolbar dock | action | C/CanvasDock.tsx:9-22, 47-68 | Grip moves the tool row to top or bottom; remembered per workspace (plan, house, walk) | KEEP |
| 85 Measured-drawing launchers | tool | RC:3373-3377 | Curved wall and Wall material (pen on), Draw roof outline (roof level), Draw outdoor outline (garden placement) | FRIENDLIER (show on the main tool rail) + GAME |
| 86 Measured path options | panel | C/MeasuredPathOptions.tsx:30-43 | Straight or Curve, Undo point, Done or Close outline, roof overhang | KEEP + GAME |
| 87 Wall pen bar | panel | RD:1181-1410 | Hint, counters, snap stepper, typed length, Make room, Keep walls, Room + next, 5 × 4 m room, Undo, Discard | KEEP + GAME |
| 88 Area chip / tools toggle | view | RC:3406-3417 | Active room area; on a phone folds the canvas tools | KEEP |
| 89 Zoom out, Zoom in, Fit | action | RC:3434-3476, 1959-1978 | Step 1.12 about the centre; Fit shows the whole plan | KEEP |
| 90 Share picture | action | RC:3480-3499, 1987-2013 | PNG of the plan to the share sheet or a download | KEEP |
| 91 Capture screen | action | RC:3500-3520, 2020-2029 | PNG of the whole screen | KEEP |
| 92 Read-out chip | view | RC:3533-3567 | Storey, area, zoom %, snap unit, drawn grid, plot use, items placed | KEEP + GAME |
| 93 Cost chip | view | RC:3574-3581 | Running product total; hidden on pitch pages | KEEP |
| 94 Energy chip | view | RC:3585-3613 | Sun versus use; opens the energy panel | KEEP |
| 95 AI design button | view | RC:3616; C/AiDesignWorkspace.tsx:18 | Opens the design assistant | KEEP |
| 96 Clear | action | RC:3617; C/ClearControls.tsx:46-60, 65-88 | Clear page or clear this room's products, with a confirm; one undo frame | KEEP + GAME |
| 97 Remove banner | panel | RC:3621-3640 | Says what a tap will remove; Done | KEEP |
| 98 Phone tool cards | panel | RC:3694, 3845, 3881, 4010 | Floor, cladding, wall paint and door cards over the plan on a phone | KEEP |
| 99 Picked-wall card | panel | RC:4109-4161 | Length of the picked free wall; Delete; Done | FRIENDLIER (let its length be retyped) + GAME |
| 100 Phone undo, redo, precision strip | action | RC:4167-4219 | Shown while the canvas tools are open | KEEP |
| 101 Object placement row | panel | C/ObjectPlacementControls.tsx:34-69; RC:5646-5648 | 50 cm, 25 cm, Free; turn carried object 45°; Cancel; Copy type; wall item height | KEEP + GAME |
| 102 Floating cluster | panel | D/FloatingCluster.tsx:163-234; RC:5621-5643 | Beside the selected item on phone and tablet: rotate, duplicate, fill floor, light, details, delete, deselect | KEEP + GAME |
| 103 Opening editor | panel | C/OpeningSelectionEditor.tsx:56-70; RC:5550; R3:2144 | Width, distance along wall, height, sill, flip swing, swap hinge, remove | FRIENDLIER (add drag handles) + GAME |
| 104 Wall length popover | panel | RC:5554-5613 | New length, which end stays put, Apply | KEEP + GAME |
| 105 Build options menu | panel | SA:429-673 | Right-click or long-press on plan or 3D: edit, finishes, pull curve, move or rotate stairs, roof surface, remove | FRIENDLIER (add a visible button) + GAME |
| 106 Trade overlay host | view | C/build/TradeOverlayHost.tsx:16-20 | Off unless a trade-flow mode is on | KEEP |
| 107 Details panel | panel | C/DetailsPanel.tsx:310-406; APP:476 | Selected product: rotate 90° either way, duplicate, fill floor, light, power, hours per day, delete | FRIENDLIER (one rotate step, 45°) |
| 108 Rooms list | panel | C/RoomList.tsx:172, 228, 271, 279, 320 | Rename the design; activate, rename, delete a room; add a room | FRIENDLIER (rename and delete from the plan) |
| 109 Add-room chooser | panel | C/AddRoomChooser.tsx:38-76, 97-126 | Rectangle by L × W, or Draw polygon; room-type names | KEEP |
| 110 Plan tabs | panel | C/PageTabs.tsx:82-160; APP:401-410, 435 | Tabs for saved plans, shown from two plans: open, rename, new, delete | KEEP |
| 111 Cart pill | view | C/CartStrip.tsx:328, 360; APP:491 | Floating cart; hidden while the pen or a phone tool card is up | KEEP |
| 112 Catalogue dock (desktop) | panel | desktop dock file:235-278; APP:484-487 | Browse, filter, product strip; arms one product | FRIENDLIER (search and a side tray) + GAME |
| 113 Catalogue toolbar and popup (phone) | panel | phone toolbar file:231-329; C/mobile/MobileProductPopup.tsx:241, 251 | Product strip; popup with "Lay floor" and "+ Add to room" | FRIENDLIER (search and a side tray) + GAME |
| 114 Garden workspace | panel | C/PlanGardenWorkspace.tsx:13-63; GP:115-209 | Add surfaces, outline, paving, boundary; edit, move, resize, remove | KEEP + GAME |
| 115 Help launcher and overlay | panel | D/GamingLayer1Surfaces.tsx:60-70; D/HelpOverlay.tsx:104, 131-134 | "?" with two tabs: Lessons, Keyboard keys | KEEP + GAME |
| 116 House build guide | panel | APP:496, 351-384 | Step guide that opens the matching tool or workspace | KEEP |
| 117 Workspace overlays (8) | view | APP:493-501 | AI design, plan import, services, foundation, shade, city, project, shared project | KEEP + GAME (see the other scans) |
| **G. Plan canvas tools and gestures** | | | | |
| 118 Pan | action | RC:4248-4259 | Drag empty space; off while a pen, armed product, floor tool or garden draw owns the pointer | KEEP |
| 119 Wheel zoom | action | RC:1175-1201; L/zoom.ts:10 | Factor 1.08 about the pointer | KEEP |
| 120 Pinch zoom and two-finger pan | action | RC:1260-1314 | Two fingers always move the view and cancel any stroke | KEEP |
| 121 Tap empty space | action | RC:4261-4271, 4475-4495 | Clears item, wall and opening selection | KEEP |
| 122 Place the armed product | tool | RC:4468-4515 | Click or tap places; Shift-click keeps it armed; right-click cancels | KEEP + GAME |
| 123 Drag from the catalogue | tool | RC:3055-3110 | Ghost follows the drag; a drop off the canvas cancels; Shift keeps it armed | KEEP + GAME |
| 124 Ghost preview | view | RC:2041-2214, 5327 | Outline where the item will land; valid or blocked | KEEP + GAME |
| 125 New-item placement law | data | RC:1448-1783 | Routes to a room, outdoors or roof; wall, surface, floor, ceiling rules; collisions; relocation | KEEP + GAME (needs a pure module first) |
| 126 Move an item | tool | RC:5841-5896; D/itemDrop.ts:1-15 | Drag; same law as a drop; refused moves snap back | KEEP + GAME |
| 127 Rotate handle | tool | RC:6114-6154 | Drag the handle; preview angle; refused when there is no space | KEEP + GAME |
| 128 Pick a free wall | tool | RC:5012-5060, 2788-2817 | With Select: tap a free wall; Delete or Backspace removes it | KEEP + GAME |
| 129 Select an opening | tool | RC:5507-5524 | With Select: tap a door or window to open its editor | KEEP + GAME |
| 130 Door tool | tool | RC:3183-3312, 4287-4346 | Hover snaps to a wall; tap places; tap on an existing opening removes it | FRIENDLIER (the tool should not delete on tap) + GAME |
| 131 Wall paint and cladding tap | tool | RC:3114-3181, 4348-4358 | Tap the nearest wall; Shift whole room; Ctrl erase | KEEP + GAME |
| 132 Floor stroke | tool | RC:4314-4322, 4360-4366, 2632-2703 | Drag paints tiles; Alt-drag a rectangle; Shift fills the room; Ctrl erases | KEEP + GAME |
| 133 Measure pick | tool | RC:5367-5408, 2423-2469 | Tap a room wall; type; the corner moves, shared walls move in both rooms | FRIENDLIER (cover free walls too) + GAME |
| 134 Remove pick | tool | RC:3665-3680; D/removeBuildTarget.ts:26-44, 76-108 | Order of targets: opening, item, free wall, room wall, floor tile | KEEP + GAME |
| 135 Wall pen layer | tool | RD:222-234, 324-430, 465-524 | Click corners or press-and-drag a wall, mouse or one finger | KEEP + GAME |
| 136 Room commit rules | data | RC:2230-2328 | At least 3 points, inside the plot, no overlap on the storey; fills the blank seed room first | KEEP + GAME |
| 137 Open-wall commit | data | RC:2337-2365 | An open run becomes free walls; says when walls enclosed a room | KEEP + GAME |
| 138 Quick rectangle | action | RC:656-683 | Lays a 5 × 4 m room flush right of what is drawn | KEEP |
| 139 Old wall tool layer and bar | tool | RC:3396, 5528-5539; D/WallDrawMode.tsx:191, 222, 272 | Still mounted; never armed from idle | KEEP (unreachable; ask `drop`) |
| 140 Garden draw layer | tool | C/GardenDrawLayer.tsx:31-73 | Drag two corners to draw or resize; tap to move | KEEP + GAME |
| 141 Garden select, move, resize | tool | C/GardenLayer.tsx:33-69, 79-89 | With Select: drag a surface or fence; corner handles on rectangles | KEEP + GAME |
| 142 Lifted wall view | view | RC:2782, 2818-2917 | While a wall tool is on, walls draw as short elevations | KEEP |
| 143 Storey ghost | view | RC:584-593 | Faint outline of the storey below | KEEP + GAME |
| 144 Plan dimensions | view | RC:5150-5190 | Overall width and depth of the building only | FRIENDLIER (show every wall length) + GAME |
| 145 Plan layers | view | RC:4520, 4548-4549, 4937, 4953, 4959-4962, 5199, 5222, 5319 | Plot, garden, trees, rooms, grid, stairs, foundation, services, items, light pools, shade sails | KEEP |
| **H. Shortcuts and gestures** | | | | |
| 146 Undo, redo keys | shortcut | KS:70-81, 108-112 | Ctrl or Cmd+Z; Ctrl+Shift+Z or Ctrl+Y | KEEP + GAME |
| 147 Rotate keys | shortcut | KS:175-208 | R, comma, period, angle keys: 45°; with Shift or Alt 1° | KEEP + GAME |
| 148 Duplicate | shortcut | KS:209-216 | D or Ctrl+D | KEEP + GAME |
| 149 Light | shortcut | KS:218-223 | L switches the selected light | KEEP + GAME |
| 150 Delete | shortcut | KS:224-229; RC:2800-2817; C/OpeningSelectionEditor.tsx:42-44 | Delete or Backspace: selected item, picked wall or selected opening | KEEP + GAME |
| 151 Tool keys | shortcut | KS:127-132, 232-250 | H Select, E eyedropper, J Remove, M Measure | FRIENDLIER (give the eyedropper a button) + GAME |
| 152 Door keys | shortcut | KS:85-104 | With the door tool: F flip side, H swap hinge, Esc out | FRIENDLIER (free H from two jobs) |
| 153 Snap keys | shortcut | KS:113-152 | 1 to 6 pick a unit; square brackets step; plus and minus step while drawing; Ctrl+F swaps | KEEP + GAME |
| 154 Storey keys | shortcut | KS:156-171 | PageUp, PageDown; off while drawing | KEEP + GAME |
| 155 Esc ladder | shortcut | KS:251-273 | A live pen keeps Esc; else tool off; else deselect | KEEP + GAME |
| 156 Armed-product keys | shortcut | RC:870-900 | R, comma, period turn the ghost 45° (1° with Shift or Alt); Esc cancels | KEEP + GAME |
| 157 View keys | shortcut | RC:905-963 | Plus, minus zoom; W A S D and arrows pan 60 px | KEEP |
| 158 Wall pen keys | shortcut | RD:603-717, 570-576, 236-240 | Enter closes; Shift+Enter closes and continues; Alt+Enter keeps open; Esc keeps 2 or more points; Ctrl+Z or right-click takes one back; Shift frees the angle | KEEP + GAME |
| 159 Clear keys | shortcut | C/ClearControls.tsx:25-33 | Shift+P products, Shift+X page | KEEP |
| 160 Floor modifiers | shortcut | RC:2641-2643, 4318-4322 | Shift room, Ctrl erase, Alt rectangle | KEEP + GAME |
| 161 Paint modifiers | shortcut | RC:4355-4357 | Shift room, Ctrl erase | KEEP + GAME |
| 162 Measured path Esc | shortcut | C/MeasuredPathOptions.tsx:19-24 | Finishes what is complete, else cancels | KEEP + GAME |
| 163 Long-press | shortcut | SA:253-262 | 540 ms on touch opens Build options | KEEP + GAME |
| **I. Save, list, print, export, import** | | | | |
| 164 Autosave | action | L/useAutoSave.ts:14; APP:152 | Saves the current plan 250 ms after a change | KEEP |
| 165 Save as | action | TB:1028-1058 | Browser prompt for a name; saves in the browser; cloud copy only when an email is already known | FRIENDLIER (a name field, no browser prompt) |
| 166 Load | action | TB:1102-1112 | Loads a saved design | KEEP |
| 167 New and New plan | action | TB:1114-1128, 1396-1400 | New resets the design; New plan adds a tab and keeps the current one | FRIENDLIER (one "New" with a clear choice) |
| 168 Cloud designs link | view | TB:3946-3952, 4067-4073 | Link to the cloud list page | KEEP |
| 169 Plan PDF | action | L/planPdf.ts:959-971; src/pages/OrderSuccessPage.tsx:20, 109-123 | Built only on the order success page; no print or PDF button in the designer | FRIENDLIER (a Print button in the designer) |
| 170 Plan SVG renderer | data | L/floorPlanSvg.ts:228-244 | Draws the plan as SVG, then PNG; no designer button found | KEEP |
| 171 Materials JSON | action | C/MaterialsPanel.tsx:68-70 | Downloads the materials estimate | KEEP |
| 172 Project handover JSON | action | C/ProjectWorkspace.tsx:224-229 | Downloads a project bundle | KEEP |
| 173 Import plan | action | C/PlanImportWorkspace.tsx:27-51, 313; D/planImport.ts:9-17, 64-85 | Accepts .dxf, .svg, .json; ASCII DXF or SVG outlines and wall centre lines | KEEP |
| 174 Print A4 | action | src/eco/EcoSheet.tsx:169; src/pilots/Workspace.tsx:208; src/site/SiteWorkspace.tsx:933 | Browser print exists on three other sheets only | KEEP |
| **J. 3D house (opened from the toolbar)** | | | | |
| 175 3D mode rail | view | HW:155-162 | Foundation, city, then Build, Furnish, Paint, Surfaces, Garden, Materials, Solar | KEEP + GAME |
| 176 3D build palette | tool | HW:175-186 | Remove, Select, Walls, Draw room, Door, Window, Stairs, Details | KEEP + GAME |
| 177 3D opening options | panel | HW:188-195 | Width list, Flip side, Flip hinge, size and shape | KEEP + GAME |
| 178 3D floor picker | action | HW:167-172, 116-127 | Storeys, Roof, Add floor, Foundation | KEEP + GAME |
| 179 3D header actions | action | HW:141-152 | Project hub, language, AI design, import, clear, undo, redo, cart, save, project tools | KEEP |
| 180 Build settings inspector | panel | BC:202-335 | Floor select, add floor, House or Floor view; wall height; stairs; roof shape, finish, thickness, pitch, overhang | KEEP + GAME |
| 181 3D selection panel | panel | R3:1992-2023 | Rotation read-out, Duplicate, "Details in plan" (leaves 3D), Remove | FRIENDLIER (edit details without leaving 3D) + GAME |
| 182 Rotation ring | tool | R3:2138-2142 | Ring beside the selected item turns it | KEEP + GAME |
| 183 3D view controls | view | C/RoomViewControls.tsx:90, 98, 106, 146, 188, 202, 225, 238, 288 | Rotate, fit, camera view, lighting, wall view, wall height, sun, pan | KEEP + GAME |
| 184 3D wall and room strips | panel | R3:2194-2200 | Live length and angle; Cancel segment, Finish run, Done | KEEP + GAME |
| 185 Walk launcher | view | src/walk/WalkLauncher.tsx:116-141 | Walk button; with it shared build, Components, place person | KEEP + GAME |
| **K. Walk** | | | | |
| 186 Walk chooser and controls | view | WM:41-45, 236-250, 267-285 | Character, level; cutaway, whole build, mouse look, first or third person, walk or run, controls | KEEP + GAME |
| 187 Build from here | action | WM:176-180, 222-227; C/three/HouseStageSlot.tsx:7-11 | Parks the walker and opens a list of 16 build tools in the 3D view | FRIENDLIER (build without leaving the walk) + GAME |
| 188 Dig / fill | tool | src/walk/EarthworkTool.tsx:24-28, 40-143, 214-279; WM:269, 286 | Dig or fill 1 m ground cells by tap or drag, or by typed cell | FRIENDLIER (also on plan and 3D) + GAME |
| 189 Components | tool | C/three/BoundaryTools.tsx:22-70; WM:272-276 | Boundary components editor; right-click a component to edit it | KEEP + GAME |
| 190 Place person | action | src/walk/WalkLauncher.tsx:140 | Puts the walker at a chosen spot | KEEP + GAME |
| 191 Shared build | action | WM:271; src/walk/WalkLauncher.tsx:127 | Opens live shared building | KEEP + GAME |

### The 3D build view and the walk: tools, views, panels and data

| Item | Kind | Where | What it does (one line) | Verdict |
|---|---|---|---|---|
| 3D House workspace (overlay) | view | `RV:2208-2230`; `C/HouseWorkspace.tsx:136-218` | Full-screen 3D build screen: header, tool rail, scene bar, inspector | KEEP + GAME |
| 3D card | view | `RV:2179-2189` | Small 16:10 preview docked in the paint panel | KEEP |
| WebGL stage | view | `TS:674-2397` | Draws the solids with three.js 0.186 and answers every pick | KEEP |
| Painter fallback | view | `RV:871-897`; `D/roomView3d.ts:457-678` | Flat-shaded canvas picture when WebGL cannot start; no build tools | KEEP |
| Orbit | action | `RV:1437-1456` | Drag turns the camera: 0.008 rad/px around, 0.006 rad/px up; 6 px dead zone | KEEP + GAME |
| Right-button orbit | action | `RV:1123-1125` | Right drag always orbits, whatever tool is armed | KEEP + GAME |
| Move view (pan) | action | `RV:1443-1445, 1771-1777`; `D/cameraMotion.ts:25-36` | Toggle, Shift-drag or two fingers slide the view along the ground | KEEP + GAME |
| Zoom | action | `RV:1101-1104, 1712-1722`; `C/RoomViewControls.tsx:295-310` | Wheel, pinch or buttons (x0.82); clamped 0.18 to 3 times the fit distance | KEEP + GAME |
| Fit | action | `RV:1725-1734`; `D/architecturalCamera.ts:7-38` | Frames the building at 46° up, -32° around, 38° field of view | KEEP + GAME |
| Camera presets (9) | view | `D/professionalViews.ts:5-28`; `C/RoomViewControls.tsx:142-161` | Perspective, Above, Front, Axonometric, Top, four elevations (six are orthographic) | KEEP + GAME (top and elevations) |
| Smoothed camera | setting | `C/useSmoothedCamera.ts:6-66`; `D/cameraMotion.ts:53` | Eases the drawn camera with a 35 ms response; off for reduced motion | KEEP |
| House or Floor view | view | `C/BuildingControls.tsx:218-221`; `D/buildingScene.ts:23` | All storeys, or only the active one | KEEP + GAME |
| Floor picker | action | `C/HouseWorkspace.tsx:116-127, 167-171` | Choose storey, Roof, Add floor, Foundation | FRIENDLIER (pictures of the storeys) + GAME |
| Add floor | action | `src/store/propertyStore.ts:1519-1563` | New storey that copies rooms, openings and free walls, not furniture | KEEP + GAME |
| Wall view: Up, Cutaway, Down | look | `C/RoomViewControls.tsx:199-223`; `D/roomSolids.ts:340-359`; `TS:1734-1747` | Full walls, camera-side walls cut to 0.32 m, or all cut | KEEP + GAME |
| Hover lowers a wall | action | `TS:1858-1880`; `3/viewOnlyFeedback.ts:4-7` | Idle pointer over a full wall drops it to the stub | KEEP |
| Roof show or hide | look | `C/BuildingControls.tsx:151-166, 246` | Shows the covering; first use creates the roof | KEEP + GAME |
| Below ground view | view | `C/HouseWorkspace.tsx:158`; `TS:1559-1577` | Hides floors and ground to show foundation and pits | KEEP + GAME |
| Discipline filters and 8 presets | setting | `D/disciplineVisibility.ts:2, 40, 44-68`; `RV:829-837` | Show or hide structure, furniture, plumbing, electrical and so on | FRIENDLIER (pictures, not trade words) |
| Lighting: Natural light or Colour check | look | `C/RoomViewControls.tsx:183-197`; `src/hooks/useRoomLighting.ts:3-22`; `3/renderPresentation.ts:29-72` | Appearance preview, or the calibrated rig where a wall reads its hex | KEEP |
| Studio look | look | `RV:2029`; `3/renderPresentation.ts:29-38` | Fixed measured rig used by the docked card | KEEP |
| Daylight toggle and hour slider | look | `C/RoomViewControls.tsx:234-265`; `TS:1008-1060`; `D/sunPosition.ts:72-102` | Real sun path for one fixed site (`D/sunPosition.ts:40`); 06:00 to 20:00 in half hours | KEEP + GAME (full day and night) |
| Lamps after dark | look | `D/lighting.ts:91-93`; `3/dressing.ts:244-260` | Lamp items light up when the sun is under 8° | GAME |
| Build skins (3) | look | `src/store/buildSkinStore.ts:4-18`; `C/LocaleThemeControls.tsx:113` | Backdrop colours: natural, gallery, blueprint | KEEP |
| 3D quality: Auto, Low, Medium, High | setting | `D/renderQuality.ts:23-40`; `C/RenderQualityControl.tsx:6-20` | Pixel ratio, shadow map, anisotropy, ambient occlusion | KEEP |
| Auto occlusion trial | setting | `3/adaptiveAmbientOcclusion.ts:12-31` | Keeps desktop occlusion only at 45 fps or more | KEEP |
| Wall height control | setting | `C/RoomViewControls.tsx:224-233`; `D/wallHeight.ts:11-26` | One height, or per storey once there are two | KEEP + GAME |
| Caption line | panel | `RV:1901-1920, 2040, 2225` | One line of help or the last result | FRIENDLIER (icons beside the words) |
| Select and move an item | tool | `RV:1242-1253, 1395-1421, 1581-1605`; `TS:2208-2294` | Tap selects; drag slides the body, drop lands by the plan's rules | KEEP + GAME |
| Place a product | tool | `RV:841-869, 1144-1149, 1466-1473, 1702-1705` | Armed product: tap the floor, or drag from the catalogue | KEEP + GAME |
| Placement ghost | look | `TS:1621-1670` | See-through body, teal when valid, red when not | FRIENDLIER (tick or cross, not colour only) + GAME |
| Object grid: 50 cm, 25 cm, Free | setting | `C/ObjectPlacementControls.tsx:35-39`; `src/store/objectPlacementStore.ts:12-17` | Snap step for items; Free allows overlap | KEEP + GAME |
| Turn carried object | action | `C/ObjectPlacementControls.tsx:40`; `src/store/placementIntentStore.ts:112` | 45° steps before placing | KEEP + GAME |
| Rotation ring | tool | `3/ItemRotationRing.tsx:16-61`; `RV:1260-1269, 1330-1334`; `D/rotationGesture.ts:3-22` | Ring, buttons, arrow keys or two-finger twist; 45° snaps or 1° | KEEP + GAME |
| Duplicate | action | `RV:2006`; `src/lib/placementActions.ts:261-300` | Copy of the selected item 0.5 m away | KEEP + GAME |
| Copy type | action | `C/ObjectPlacementControls.tsx:55` | Arms another of the same product | KEEP + GAME |
| Remove (selection card) | action | `RV:2008-2016` | Deletes the selected item | KEEP + GAME |
| Wall item height field | setting | `C/ObjectPlacementControls.tsx:58-67` | Mount height in cm, 5 cm steps | FRIENDLIER (drag up and down) + GAME |
| Selection card and strip | panel | `RV:1992-2023`; `C/HouseWorkspace.tsx:199-204` | Name, angle, Duplicate, Details, Remove | FRIENDLIER (fewer, bigger buttons) |
| Selection highlight | look | `TS:443-468, 1756-1799` | Mint rim (scale 1.028), tint and a floor pad | GAME (add an outline shape) |
| Draw room | tool | `RV:1175-1185, 1352-1362, 1546-1558`; `D/roomBuildGesture.ts:46-109` | Drag a rectangle on the floor plane | KEEP + GAME |
| Draw walls | tool | `RV:1160-1174, 1341-1351, 1504-1528`; `D/wallBuildGesture.ts:136-193` | Run of wall segments; closing the loop makes a room | KEEP + GAME |
| Curved wall | tool | `RV:2202`; `C/MeasuredPathOptions.tsx:11-44`; `D/measuredPath.ts:46-78` | Tap start, end and a bend point; saved as chords | FRIENDLIER (one drag to bend) |
| Pull curve | tool | `C/SurfaceActions.tsx:595` | Bends an existing edge from the build menu | KEEP |
| Door tool | tool | `RV:1150-1158, 1336-1340, 1492-1498`; `D/openingPlacement.ts:39-55` | Slide along a wall, release to place | KEEP + GAME |
| Window tool | tool | `RV:1089-1099, 1150-1158` | Same gesture, window record | KEEP + GAME |
| Opening options | panel | `C/HouseWorkspace.tsx:188-195`; `RV:1810-1815` | Width, flip side (F), flip hinge (H), dimensions | FRIENDLIER (show the swing as a picture) |
| Opening editor | panel | `C/OpeningSelectionEditor.tsx:21-71` | Width, distance, height, sill, flips, remove | KEEP + GAME |
| Stairs tool | tool | `RV:1650-1665`; `C/SurfaceActions.tsx:196-233`; `C/BuildingControls.tsx:183-193` | Tap, drag from the palette, or Fit in room | KEEP + GAME |
| Stair settings | panel | `C/BuildingControls.tsx:306-332` | Width, run, X, Y, rotate 90°, delete | FRIENDLIER (drag handles, not X and Y) |
| Wall paint brush | tool | `RV:1198-1208, 1384-1394, 1674-1681`; `D/wallPaintBrush.ts:62-111` | Click a wall, drag a run, Shift room, Ctrl erase | KEEP + GAME |
| Paint preview on hover | look | `TS:1806-1833` | Hovered wall shows the brush colour and a mint outline | KEEP + GAME |
| Wall material brush | tool | `D/wallPaintBrush.ts:66-78`; `D/wallConstruction.ts:21-26` | Plastered brick, brick, concrete or glass | KEEP + GAME |
| Cladding brush | tool | `src/store/designerUIStore.ts:94-98`; `RV:2094` | Sample cladding on a wall | KEEP |
| Floor brush | tool | `RV:1209-1240, 1363-1383, 1565-1580`; `D/floorPaintBrush.ts:33` | Drag tiles, Alt rectangle, Shift room, Ctrl erase | KEEP + GAME |
| Garden mode | tool | `C/GardenPanel.tsx:60-110`; `RV:1193-1197, 1529-1545, 1621-1647` | Seven ground kinds and three fence kinds | KEEP + GAME |
| Garden corner handle | tool | `RV:1108-1117, 2145-2148` | Drag a corner (within 22 px) to resize a surface | KEEP + GAME |
| Draw outdoor outline | tool | `RV:2204` | Free outline for a ground surface | KEEP |
| Roof settings | panel | `C/BuildingControls.tsx:276-304` | Shape, finish, thickness, pitch, overhang | FRIENDLIER (three picture tiles for shape) + GAME |
| Draw roof outline | tool | `RV:2203`; `C/MeasuredPathOptions.tsx:39-41` | One custom roof footprint | KEEP |
| Solar panels on the roof | tool | `C/BuildingControls.tsx:295-302`; `RV:655-663, 920-931`; `D/roofPlacement.ts:12-46` | Arming a roof product shows the roof; panels tilt to the pitch | KEEP + GAME |
| Remove tool (hammer) | tool | `RV:710-722, 1140-1143, 1461-1465`; `TS:1899-1944`; `D/removeBuildTarget.ts:76-108` | Hover shows a red copy; tap removes item, opening, wall or floor finish | FRIENDLIER (name the target with a picture) + GAME |
| Build menu on a part | panel | `C/SurfaceActions.tsx:137-143, 253-262, 314-320, 429-673` | Right-click or 540 ms long-press: actions for the part under the pointer | FRIENDLIER (picture buttons) |
| Remove same group | action | `C/SurfaceActions.tsx:658-669` | Removes all like parts in one step | KEEP |
| Floor settings | panel | `C/BuildingControls.tsx:265-274` | Wall height of the active storey | KEEP + GAME |
| Materials panel | panel | `RV:2219` | Measured quantities and assumptions (not read) | KEEP |
| Solar and energy panel | panel | `RV:2219` | Energy summary (not read) | KEEP |
| Products and cost panel | panel | `C/HouseWorkspace.tsx:128-135, 214` | Basket for the design (not read) | KEEP |
| Undo and Redo | action | `C/HouseWorkspace.tsx:147-148` | One step per gesture | KEEP + GAME |
| Launchers | action | `C/HouseWorkspace.tsx:142-158, 172` | Project hub, design helper, plan import, city, foundation, services | KEEP |
| Services in the house view | view | `TS:1534-1544`; `RV:1697-1701` | Pipes and fixtures drawn; tapping a fixture opens Services | KEEP + GAME |
| Services 3D editor | tool | `C/ServicesThreeEditor.tsx:84-130` | Separate renderer with its own orbit controls for routes | KEEP + GAME (as trench and pipe) |
| Foundation in 3D | view | `3/foundationMeshes.ts:14-47` | Concrete boxes, pits and bores | GAME |
| Shade sails in 3D | view | `3/shadeMeshes.ts:9-93` | Membrane, cable, posts, brackets | GAME |
| Components | tool | `3/BoundaryTools.tsx:7-73`; `3/BoundaryEditor.tsx:35-163` | Free 3D faces and edges drawn on a work plane | FRIENDLIER (hide planes and XYZ first) |
| Trees | view | `3/ecoTrees.ts:7-43` | Trunk and five crowns per tree | GAME |
| Pilot demo objects | view | `3/pilotDemonstrations.ts:3-42` | A small mast or a floor pad at saved points | KEEP |
| Pilot wall photo | look | `TS:1497-1530` | Maps a private photo on one wall; checks every 6 s | KEEP |
| Trade progress overlay | panel | `C/build/TradeProgressOverlay.tsx:18-137`; `C/build/tradeOverlayGeometry.ts:55-219` | Job pins and coloured ink over the model; pick a job location | KEEP |
| Build dashboard | panel | `C/build/BuildDashboard.tsx:29-75` | Work packages for the trades (head read only) | KEEP |
| Package inspector | panel | `C/build/PackageInspector.tsx:29-60` | One package with a plan picture (head read only) | KEEP |
| Trade station and role picker | panel | `C/build/TradeStation.tsx:31-51` | Jobs per trade role | KEEP |
| Trade flow state | setting | `C/build/tradeFlow.ts:22-66` | Overlay mode: off, pick, map | KEEP |
| Test bridge | data | `RV:194-270, 955-1042` | Dev-only handle on walls, items and pixels | KEEP |
| Scene solids contract | data | `D/roomSolids.ts:38-157` | Floors, walls, items, stairs, roofs with no camera in them | GAME (port this first) |
| Solid builders | data | `D/roomSolids.ts:175-303`; `D/buildingScene.ts:12-96` | JSON to solids, one storey then the stack | GAME |
| Property to scene mapper | data | `RV:305-413` | Resolves catalogue sizes and colours per storey | GAME |
| Fit-to-size | data | `D/fitToSize.ts:135-188` | Scales a model to its catalogue box | GAME |
| Model manifest | data | `src/data/productModels.json`; `src/data/productModels.ts:89-101` | 21 product ids to model files | GAME |
| Stand-in bodies | data | `TS:185-236, 1372-1378`; `3/furniturePreview.ts:1-9`; `3/solarPanelPreview.ts:8-69` | Shapes or a picture box when no model exists | GAME |
| Joinery | data | `3/joinery.ts:22-207` | Skirting, architraves, leaves, frames, sills | GAME |
| Corner shades and contact shadows | look | `3/dressing.ts:25-32, 168-227` | Painted-on occlusion strips | KEEP |
| Floor surfaces (8 kinds) | data | `D/floorKind.ts:6-23`; `3/surfaces.ts:217-353` | Texture per floor kind at tile size | GAME |
| Wall finish looks (6) | data | `src/data/wallPaints.ts:635-674` | Roughness and sheen per finish | GAME |
| Models on disk | data | `public/models/` | 77 GLB, 8,997,808 bytes (counted) | GAME |
| Walk button | action | `W/WalkLauncher.tsx:116-126` | Opens Walk over the same stage | KEEP |
| Person token | tool | `W/WalkerPlacement.tsx:116-136` | Drag or tap to start the walk at a spot; ring shows tick or cross | KEEP + GAME |
| Character chooser (5) | panel | `W/WalkMode.tsx:236-250`; `W/characters.ts:32-76` | Pick a body; saved in the browser | KEEP + GAME |
| Level picker | action | `W/WalkMode.tsx:199-206`; `W/runtime.ts:255-264` | Teleports to a clear spot on a storey or the roof | KEEP |
| Walk and run | action | `W/runtime.ts:31-32, 542-548` | Keys, pad, or a run toggle | GAME |
| Third person camera | view | `W/followSettings.ts:1`; `W/collision.ts:324-368` | Swept follow camera: Close, Wide, Far | GAME |
| First person | view | `W/runtime.ts:484-498` | Eye view, body hidden (V switches) | GAME |
| Whole build | view | `W/runtime.ts:489-494` | High overview of the plan (B) | KEEP + GAME |
| Cutaway in Walk | look | `W/runtime.ts:585-592` | Walls between camera and walker drop to stubs | KEEP |
| Mouse look | action | `W/runtime.ts:452-461` | Pointer lock | GAME |
| Drag look | action | `W/runtime.ts:462-468` | 0.004 rad per pixel | KEEP |
| Tap to walk | action | `W/runtime.ts:324-344`; `W/navigation.ts:40-73` | Route to the tapped spot | KEEP |
| Doors | action | `W/runtime.ts:469-480`; `W/collision.ts:211-245` | E or a button opens the door in reach; visit state only | GAME |
| Move pad and look pad | panel | `W/WalkMode.tsx:191-198, 297-306` | Touch sticks | KEEP |
| One-hand steering | setting | `W/runtime.ts:536-537`; `W/WalkMode.tsx:292` | Left pad also turns | KEEP |
| Dig and fill | tool | `W/EarthworkTool.tsx:40-143`; `D/terrainCuts.ts:41-61` | Edits 1 m land cells from the walk camera | KEEP + GAME (heart of the block mode) |
| Components in Walk | tool | `W/WalkMode.tsx:272-276` | Same editor, walk camera rays | KEEP |
| Build from here | tool | `W/WalkMode.tsx:176-180, 222-227`; `3/HouseStageSlot.tsx:7-11` | Parks the walker; 16 build tools pick through the walk camera | FRIENDLIER (build without parking) + GAME |
| Resume walking bar | action | `W/WalkReturnView.tsx:6-32`; `W/parkedWalker.ts:16-30` | Return to the parked spot or end the visit | KEEP |
| Read-only visit | view | `W/WalkMode.tsx:47-51, 231-233, 269` | Shared plan walk with no edit tools | KEEP |
| Shared players | view | `W/runtime.ts:103-111` | Other people's bodies in a shared build | KEEP |
| Measurement hooks | data | `W/runtime.ts:138-165`; `W/frameMeasurement.ts:21-95` | Opt-in frame and input timing | KEEP |
| Collision world | data | `W/scene.ts:40-188` | One merged triangle mesh with a BVH, plus one per door | GAME (use engine physics) |
| Walk words | data | `W/words.ts:4-27` | 22 strings in three more languages | KEEP |

### Pipes, cables, fixtures and trades: tools, views, panels and data

Order of rows: service model, catalogues, Services workspace, main views, earthworks, energy and light and water, site utilities, trades link, build screens, stages and components, take-off and costs, server.

| Item | Kind | Where | What it does (one line) | Verdict |
|---|---|---|---|---|
| `BuildingServices` v1 | data | `src/designer/buildingServices.ts:80-86`; `src/store/propertyStore.ts:349` | The services block of the design: runs, fixtures, optional junctions | KEEP + GAME |
| `ServiceRun` | data | `src/designer/buildingServices.ts:47-60` | One pipe, conduit, duct or cable line on one floor | KEEP + GAME |
| `ServicePoint` | data | `src/designer/buildingServices.ts:31-38` | Run node: x, y, optional own height, optional junction id | KEEP + GAME |
| `ServiceFixture` | data | `src/designer/buildingServices.ts:61-79` | One equipment box: centre, size, turn, optional port heights | KEEP + GAME |
| `ServiceJunction` | data | `src/designer/buildingServices.ts:39-46` | Shared node that joins runs of one system on one floor | KEEP + GAME |
| `ServiceConnection` | data | `src/designer/buildingServices.ts:27-30` | Link from a run end to one port of one fixture | KEEP + GAME |
| `SERVICE_SYSTEMS` (8) | data | `src/designer/buildingServices.ts:4-12, 87-96` | System ids with label and colour; colour is the only drawn key | KEEP + GAME; FRIENDLIER: add line pattern and letter |
| `SERVICE_FIXTURES` (13 kinds) | data | `src/designer/buildingServices.ts:13-26, 97-114` | Kind ids with default width, depth, height | KEEP + GAME |
| `normaliseBuildingServices` | rule | `src/designer/buildingServices.ts:128-257` | Load check; drops each bad entity on its own | KEEP + GAME |
| `BuildingServicesSchema` | format | `src/designer/buildingServicesContract.ts:19-143` | Strict contract for server and MCP; one fault rejects the block | KEEP + GAME |
| `serviceRunPoints3D` | rule | `src/designer/buildingServices.ts:266-282` | Height of each node; fills in nodes that carry none | GAME |
| `serviceRunLengthM`, `servicePlanLengthM` | rule | `src/designer/buildingServices.ts:259-300` | 3D centre-line length and flat plan length | KEEP + GAME |
| `estimateServices` | rule | `src/designer/buildingServices.ts:301-327` | Per run: length, fall, whole stock lengths, matched-material flag | KEEP + GAME |
| `servicePorts` | rule | `src/designer/serviceConnections.ts:24-96` | Works out each fixture's ports: place, height, system | GAME |
| `servicePortLabel`, `compatibleServicePorts` | rule | `src/designer/serviceConnections.ts:97-108` | Port name; ports of one system on one floor | KEEP |
| `resolveServiceConnections` | rule | `src/designer/serviceConnections.ts:119-151` | Moves linked ends onto ports and junction nodes onto junctions | GAME |
| `connectServiceEndpoint` | action | `src/designer/serviceConnections.ts:152-168` | Links or frees one run end | GAME |
| `connectServiceNodes` | action | `src/designer/serviceConnections.ts:226-294` | Joins two nodes through a junction | GAME |
| `moveServiceNode` | action | `src/designer/serviceConnections.ts:297-333` | Moves a node; a junction moves its nodes; a fixture end lets go | GAME |
| `serviceConnectionWarnings` | rule | `src/designer/serviceConnections.ts:175-222` | Lists broken end links and broken junctions | GAME |
| `snapServicePoint` | rule | `src/designer/serviceRouteEditing.ts:5-32` | 5 cm grid snap; 45 or 90 degree angle snap | GAME |
| `visibleServiceFixtures` | rule | `src/designer/serviceFixtures.ts:15-32` | Fixtures of one floor or the building, with absolute height | KEEP |
| `visibleServiceRuns`, `filterServicePresentation` | rule | `src/designer/serviceScene.ts:10-22` | Runs with the floor height; layer filter after links resolve | KEEP |
| `servicesFovForResize` | rule | `src/designer/servicesCamera.ts:3-21` | Keeps the 3D scale when the panel height changes | KEEP |
| `setServices` | action | `src/store/propertyStore.ts:1816-1824` | The one write path; refuses the whole edit on one bad entity | KEEP |
| Floor removal guard | rule | `src/store/propertyStore.ts:1650-1657, 1676-1679` | A floor that holds runs or fixtures cannot be removed | KEEP |
| Layer model | rule | `src/designer/disciplineVisibility.ts:2-69` | 10 layers, 6 part switches, 8 working views | KEEP + GAME |
| `SERVICE_MATERIALS` (28) | data | `src/data/buildingServicesCatalog.ts:84-195` | Pipe, conduit, duct and cable presets by system and size | KEEP + GAME |
| `SERVICE_FITTINGS` (8) | data | `src/data/buildingServicesCatalog.ts:209-238` | Hot-water elbow, tee, coupler, valve references; links only | KEEP; FRIENDLIER: count fittings from bends |
| `BUILDING_EQUIPMENT` (10) | data | `src/data/buildingEquipmentCatalog.ts:21-142` | Equipment references per fixture kind; 3 carry body sizes | KEEP |
| `SERVICE_PRODUCT_DEFINITIONS` (10) | data | `src/data/serviceProducts.ts:45-139` | Paired 2D and 3D products: 2 tanks, bowl, box, pit, basin, bidet, sofa, 2 pipe lengths | KEEP + GAME |
| `serviceProductSizeM`, `serviceProductPlanSvg` | rule | `src/data/serviceProducts.ts:146-181` | Size in metres from the mm box; plan art at true ratio | KEEP |
| Bundled energy products | data | `src/data/products.json:1008-1265` | 3 roof PV panels, 2 inverters, 2 batteries, 1 controller, 1 tank | KEEP + GAME |
| Product energy and light fields | data | `src/data/products.schema.ts:72, 84, 212-262` | Placement kind, energy role, watts, hours, PV rating, battery, inverter, light | KEEP + GAME |
| `APPLIANCE_LOADS` | data | `src/data/applianceLoads.ts:51-74` | Typical watts and hours matched by product name or category | KEEP |
| Solar resource constants | data | `src/data/mauritiusSolar.ts:33-112` | Sun hours per month and a performance ratio for one fixed location | KEEP + GAME |
| Services workspace (WS) | panel | `src/components/ServicesWorkspace.tsx:84-173, 730-1880` | Full-screen services editor, apart from the main plan and 3D | KEEP; FRIENDLIER: edit in the main views |
| Ways to open WS | action | `src/components/ServicesWorkspace.tsx:61-83, 92-93, 137`; `src/components/TopBar.tsx:1502`; `src/components/WorkspaceFloorNav.tsx:72` | Button, event `ppw:open-services`, query `panel=services`, floor menu | KEEP |
| WS Select tool | tool | `src/components/ServicesWorkspace.tsx:510-515, 758-761` | Tap selects a run, fixture or node | KEEP + GAME |
| WS Route tool | tool | `src/components/ServicesWorkspace.tsx:399-469, 530-533, 552-585, 762-778` | Draws a run of the chosen system by taps or drags | FRIENDLIER: draw in main plan; GAME |
| WS draft buttons | action | `src/components/ServicesWorkspace.tsx:1326-1343` | Back point, Finish run, Cancel | FRIENDLIER: double tap to finish |
| WS Place equipment tool | tool | `src/components/ServicesWorkspace.tsx:535-550, 779-795` | Places one of 13 fixtures at a tap | KEEP + GAME |
| WS Move fixture | tool | `src/components/ServicesWorkspace.tsx:522-529, 1487` | Press Move, then tap the new spot | FRIENDLIER: drag it; GAME |
| WS Rotate 90 | action | `src/components/ServicesWorkspace.tsx:1488-1492` | Turns the fixture 90 degrees per press | KEEP + GAME |
| WS Remove | action | `src/components/ServicesWorkspace.tsx:691-706, 1493, 1773` | Deletes the run or fixture and any junction left unused | KEEP + GAME |
| WS node fields | panel | `src/components/ServicesWorkspace.tsx:1501-1543` | Pick a node; type X, Y and height | KEEP |
| WS Insert bend, Remove bend | action | `src/components/ServicesWorkspace.tsx:1560-1592` | Adds a midpoint node after the chosen one; removes an inner node | FRIENDLIER: tap the pipe; GAME |
| WS Detach node from junction | action | `src/components/ServicesWorkspace.tsx:1544-1558` | Frees one node from its junction | KEEP + GAME |
| WS Continue from end | action | `src/components/ServicesWorkspace.tsx:668-680, 1593` | Starts a new run joined to the chosen run's end | KEEP + GAME |
| WS node drag and drop-to-connect | tool | `src/components/ServicesWorkspace.tsx:618-667, 1007-1023, 1054-1060` | Drag a node; within 15 cm of a port or node it joins | KEEP + GAME |
| WS Start and End connection lists | action | `src/components/ServicesWorkspace.tsx:681-690, 1603-1643` | Choose a port for a run end, or Free endpoint | KEEP |
| WS material, diameter, elevations | panel | `src/components/ServicesWorkspace.tsx:1650-1739` | Preset per system; size in mm; start and end height | KEEP + GAME |
| WS fixture panel | panel | `src/components/ServicesWorkspace.tsx:1360-1485` | Reference text, position, size, base height, equipment reference, port heights | KEEP |
| WS snap options | action | `src/components/ServicesWorkspace.tsx:1792-1808` | 5 cm grid on or off; angle snap 90, 45 or free | KEEP + GAME |
| WS run readout | view | `src/components/ServicesWorkspace.tsx:1747-1772, 1837-1854` | Length, fall, whole stock lengths; totals for the floor | KEEP + GAME |
| WS connection warnings | view | `src/components/ServicesWorkspace.tsx:1810-1830` | List with a button that selects the run | KEEP + GAME |
| WS fitting references | view | `src/components/ServicesWorkspace.tsx:1855-1868` | Links to fittings of the current system | KEEP |
| WS product shelf | panel | `src/components/ServicesProductShelf.tsx:7-19` | Lists the 10 paired products; Place arms one and leaves to Plan | FRIENDLIER: place without leaving |
| WS 2D plan | view | `src/components/ServicesWorkspace.tsx:881-1311` | SVG plan in metres: rooms, walls, runs, fixtures, ports; pan, pinch, wheel | KEEP |
| WS 3D edit | view | `src/components/ServicesThreeEditor.tsx:84-561` | Own three.js scene: pipes, fixtures, ports, grid; orbit | KEEP; FRIENDLIER: merge into main 3D |
| WS view bar | action | `src/components/ServicesWorkspace.tsx:805-852` | 2D or 3D, zoom, Fit, undo, redo, details | KEEP |
| WS product underlay | view | `src/components/ServicesContextProducts.tsx:9-28` | Faint footprints of placed products under the runs | KEEP |
| WS foundation underlay | view | `src/components/ServicesWorkspace.tsx:251-252, 1084-1101` | Dashed foundation footprints on the ground floor | KEEP |
| Layers control | panel | `src/components/DisciplineVisibilityControls.tsx:22-64`; `src/store/disciplineVisibilityStore.ts:15-38` | Hide or isolate a layer; pick a working view | KEEP + GAME |
| Plan routes layer | view | `src/components/ServiceRoutesPlanLayer.tsx:6-15`; `src/components/RoomCanvas.tsx:4960` | Runs as coloured lines at true width; a ring marks a riser | KEEP |
| Plan fixtures layer | view | `src/components/ServiceFixturesPlanLayer.tsx:6-331`; `src/components/RoomCanvas.tsx:4961-4962` | One glyph per fixture kind at true size | KEEP |
| 3D run mesh | view | `src/components/three/serviceRouteMeshes.ts:7-31`; `src/components/three/ThreeStage.tsx:1534-1544` | A cylinder per segment and a ball per node | KEEP + GAME |
| 3D fixture mesh | view | `src/components/three/serviceFixtureMeshes.ts:6-252` | Simple body per kind, scaled to the saved box | KEEP + GAME |
| Tap to open WS | action | `src/components/RoomCanvas.tsx:4960-4962`; `src/components/RoomView3D.tsx:1697-1700`; `src/components/three/ThreeStage.tsx:2120-2130` | A tap on a run or fixture opens WS on it | FRIENDLIER: select and move in place |
| Build options menu | tool | `src/components/SurfaceActions.tsx:128, 254-262, 314-320, 555-574, 595, 636`; `src/designer/surfaceActions.ts:71-90, 183-200` | Long press or right click on a run or fixture: Edit services, Pull curve, Remove | KEEP + GAME |
| Pull curve | tool | `src/designer/surfaceActions.ts:362-432` | Bends one run segment into sampled points | KEEP |
| Services in Walk | view | `src/components/RoomView3D.tsx:2070-2074`; `src/walk/WalkMode.tsx:231` | Drawn only when Walk shares the main 3D stage; the stand-alone walk stage gets none | GAME; FRIENDLIER: show in every walk |
| Walk build tools list | action | `src/components/three/HouseStageSlot.tsx:7-11`; `src/walk/WalkMode.tsx:224`; `src/components/RoomView3D.tsx:2042-2047` | 16 entries; Electrical and Plumbing open WS | FRIENDLIER: act in walk, no jump out |
| No-WebGL caption | view | `src/components/RoomView3D.tsx:1901` | The basic 3D fallback draws no pipes or equipment | KEEP |
| `TerrainCut` | data | `src/designer/terrainCuts.ts:3-9`; `src/store/propertyStore.ts:346` | One dug 1 m ground cell: x, y, top height, depth | KEEP + GAME |
| `validCuts`, `editSoil`, `exposedSoil` | rule | `src/designer/terrainCuts.ts:18-90` | Limits; dig or fill by a step; soil faces | GAME |
| Dig / fill tool | tool | `src/walk/EarthworkTool.tsx:17-279`; `src/walk/WalkMode.tsx:269, 286` | Walk only: tap or sweep cells to dig or fill | KEEP + GAME; FRIENDLIER: also in plan and 3D |
| Cut drawing | view | `src/components/RoomCanvas.tsx:4955`; `src/components/three/ThreeStage.tsx:1277-1288`; `src/components/three/earthworkMeshes.ts:5, 27, 45` | Brown cells in plan; soil and clipped ground in 3D | KEEP |
| Foundation holes | data | `src/designer/foundation.ts:15-22, 44-52` | Rectangular excavation with depth, margin, stage; round bores | GAME (owned by another scan) |
| `PlacedItem` service fields | data | `src/store/propertyStore.ts:193-229` | Mount height, light on, power on, hours, watts on a placed item | KEEP + GAME |
| `energyRoleOf` and item helpers | rule | `src/designer/energy.ts:86-160` | Role from fields, then from the load table; on or off, hours, watts | KEEP + GAME |
| `energyReport` | rule | `src/designer/energy.ts:282-411` | Whole-plan balance: generation, load, peak, battery, inverter | KEEP + GAME |
| Solar maths | rule | `src/designer/solarCalc.ts:37-179` | Daily energy, panels to cover, roof fit, battery hours, inverter test | KEEP + GAME |
| Meter wording | rule | `src/designer/energyMeter.ts:27-140` | Bar fill and plain sentences for the balance | KEEP |
| `useEnergyReport` | rule | `src/designer/useEnergyReport.ts:43-86` | Feeds the balance with the default sun case and roof area | KEEP |
| Energy panel | panel | `src/components/EnergyPanel.tsx:140-214, 302-393` | Status, add panel, browse solar, add tank, per-item rows | KEEP |
| Add solar panel | tool | `src/components/EnergyPanel.tsx:168-184`; `src/designer/roofPlacement.ts:12-46` | Finds a free roof cell and places a panel there | KEEP + GAME |
| Roof-only rule | rule | `src/designer/energy.ts:86-89`; `src/components/RoomCanvas.tsx:1506-1513`; `src/store/propertyStore.ts:331-336` | PV goes on a roof slab with its whole footprint inside | KEEP + GAME |
| Add water tank | tool | `src/components/EnergyPanel.tsx:193-204` | Goes to the ground floor and arms the tank for one tap | KEEP + GAME; FRIENDLIER: allow the roof |
| Tank, panel, product bodies | view | `src/components/three/waterTankPreview.ts:6-38`; `src/components/three/solarPanelPreview.ts:8-69`; `src/components/three/serviceProductPreview.ts:10-141` | 3D bodies scaled to the catalogue box | KEEP + GAME |
| Light rules | rule | `src/designer/lighting.ts:23-104` | What counts as a light, pool radius, 3D range, lamps-on factor | KEEP + GAME |
| Light pools | view | `src/components/RoomCanvas.tsx:5222-5245`; `src/components/three/dressing.ts:244-260` | Warm circle in plan; point light and glow in 3D | KEEP + GAME |
| Light switch | action | `src/store/propertyStore.ts:2134-2153`; `src/components/DetailsPanel.tsx:362-366` | Sets `lightOn` on one placed item | KEEP + GAME |
| Watts, hours, power | action | `src/store/propertyStore.ts:1891-1973`; `src/components/EnergyPanel.tsx:121-132, 341-351` | Per-item energy inputs | KEEP |
| Mount height | rule | `src/designer/placedItemElevation.ts:4-13` | Wall items at their height; surface items on top of the parent | KEEP + GAME |
| Rain tank balance | rule | `src/eco/water.ts:18-35`; `src/eco/quantities.ts:26` | Monthly rain capture against tank litres; sums placed tanks | KEEP (owned by the eco scan) |
| `CityNetwork` | data | `src/designer/city.ts:34-45` | Site main: system, 3D points, diameter, trench width and depth | KEEP + GAME |
| `CityAsset` service kinds | data | `src/designer/city.ts:14-23, 46-65` | Streetlight, PV array, battery, tank, substation, charger, with ratings | KEEP + GAME |
| Network checks | rule | `src/designer/city.ts:263-303, 616-634` | Limits; the pipe must lie inside its trench | GAME |
| Trench take-off | rule | `src/designer/city.ts:584-615` | Length, trench footprint, union excavation volume | KEEP |
| Network tool | tool | `src/components/CityWorkbench.tsx:183-192, 226-267, 760-825` | Tap a route, finish; edit diameter, trench, node z | KEEP + GAME |
| `packagesFromProperty` | rule | `src/designer/link/packages.ts:64-174` | Groups measured quantities into trade packages | KEEP |
| Package categories and trades | data | `src/designer/link/packages.ts:14-52` | 8 categories, 6 trades; which system and fixture goes where | KEEP; FRIENDLIER: map air and fire kit too |
| `PackageDraft` | data | `src/designer/link/exchange.ts:44-67` | Editable package: title, scope, trade, floors, quantities, site, dates, currency | KEEP |
| `LinkPackage`, `RequestExchange` | data | `src/designer/link/exchange.ts:68-90` | A package with its sends, quotes, reports, invoices, history | KEEP |
| `applyLinkEvent` | rule | `src/designer/link/exchange.ts:277-402` | Checked state changes: draft, send, answer, decide, pay | KEEP |
| `packageStatus`, `needsDecision` | rule | `src/designer/link/exchange.ts:403-451` | Ten status words; what waits on a person | KEEP + GAME |
| `moneyTotals`, `packagesCsv` | rule | `src/designer/link/exchange.ts:452-527` | Totals per currency; CSV export | KEEP |
| `PlanView` v1 | format | `src/designer/link/planView.ts:14-26`; `src/designer/link/contract/plan-view.schema.json:25-188` | Read-only plan extract for one package | KEEP + GAME |
| `WorkPackage` v1 | format | `src/designer/link/planView.ts:27`; `src/designer/link/contract/plan-view.schema.json:189-199` | One request plus its plan view in one file | KEEP |
| `buildPlanView`, `buildWorkPackage` | action | `src/designer/link/planView.ts:117-154` | Builds and signs the files to send | KEEP |
| `parsePlanView`, `parseWorkPackage`, `readAnswer` | rule | `src/designer/link/planView.ts:65-113` | Size, schema, hash, date and reference checks | KEEP |
| `projectGeometry` | rule | `src/designer/link/planGeometry.ts:25-105` | Copies levels, rooms, walls, openings, runs, items into the extract | KEEP + GAME |
| Job Pack v1 types | format | `src/designer/link/vendor/tradefolder/lib/jobPack/types.ts:1-72` | Request, quote, status and invoice envelopes | KEEP |
| `RateCard` v1 | format | `src/designer/link/vendor/tradefolder/lib/jobPack/types.ts:73-88`; `src/designer/link/vendor/tradefolder/lib/jobPack/job-pack.schema.json:801-917` | Trade rate set: hourly, day, call-out, markup, VAT, hours per task | KEEP; no caller reads one today |
| Pack protocol | rule | `src/designer/link/vendor/tradefolder/lib/jobPack/protocol.ts:8-144` | Hash, sign, parse, amount checks, link packing | KEEP |
| Carried link and seal | format | `src/designer/link/vendor/tradefolder/lib/links/carry.ts:31-122`; `src/designer/link/vendor/tradefolder/lib/links/signed.ts:63-72` | Deflated payload after the `#`, with an integrity seal | KEEP |
| Vendor pin | data | `src/designer/link/vendor/VENDORED.json:1-50` | Upstream commit and file hashes of the vendored code | KEEP |
| Trade roles, job statuses, pin | data | `src/designer/link/tradeJobs.ts:8-30` | 13 roles, 5 job statuses, the pin shape | KEEP + GAME |
| Job events | rule | `src/designer/link/tradeJobs.ts:81-124` | Add a job, take a package, edit a job | KEEP |
| `workItems`, `projectTimeline` | rule | `src/designer/link/tradeWork.ts:8-23` | Work list and timeline for the dashboard | KEEP |
| `workGeometry`, `pinExists`, `measuredAnchors` | rule | `src/designer/link/workGeometry.ts:12-67` | Index from a reference to a position, for pins and overlays | KEEP + GAME |
| Link ledger store | data | `src/store/linkStore.ts:18-247` | Event log in browser storage; backup and restore | KEEP; FRIENDLIER: store on the server |
| QR | action | `src/designer/link/qr.ts:2` | Renders a link as a QR picture | KEEP |
| Build dashboard | panel | `src/components/build/BuildDashboard.tsx:29-677` | Owner desk: decisions, money, package list | KEEP |
| Make packages | action | `src/components/build/BuildDashboard.tsx:143-192, 476-526` | Creates draft packages from the plan | KEEP |
| Add an answer | action | `src/components/build/BuildDashboard.tsx:193-203, 527-610` | Reads a quote, report or invoice from a file or link | KEEP |
| Files sheet | action | `src/components/build/BuildDashboard.tsx:611-665` | Backup export, CSV, restore | KEEP |
| Needs you, Money | view | `src/components/build/BuildDashboard.tsx:322-374` | Counts to decide; totals per currency, with a hide switch | KEEP |
| Package filters | action | `src/components/build/BuildDashboard.tsx:221-268` | By project, site, phase, trade, status | KEEP |
| Package inspector | panel | `src/components/build/PackageInspector.tsx:143-425` | Review, save, send, share and history for one package | KEEP |
| Plan picture | view | `src/components/build/PackageInspector.tsx:29-142` | SVG of the sent extract, per level | KEEP |
| Draft fields | panel | `src/components/build/BuildControls.tsx:59-233` | Edits title, scope, site, dates, budget, quantity lines | KEEP |
| Sheet, status chip | view | `src/components/build/BuildControls.tsx:4-58` | Modal sheet and status label | KEEP |
| Package decisions | panel | `src/components/build/PackageDecisions.tsx:156-414` | Approve or decline a quote; accept or reject an invoice | KEEP |
| Record paid | action | `src/components/build/PackageDecisions.tsx:52-153` | Notes a payment made elsewhere | KEEP |
| Financial details | view | `src/components/build/PackageDecisions.tsx:14-51` | Lines, subtotal, VAT, total, hours, days | KEEP |
| Role picker | action | `src/components/build/TradeStation.tsx:31-51` | Owner or one of 13 trades | KEEP + GAME |
| Trade station | panel | `src/components/build/TradeStation.tsx:96-355` | One trade's jobs, packages and timeline | KEEP |
| Job editor | panel | `src/components/build/TradeStation.tsx:356-552` | Name, note, status, dates, pin, photo | KEEP + GAME |
| Take package | action | `src/components/build/TradeStation.tsx:291-314` | A named person claims a package | KEEP |
| Progress overlay | view | `src/components/build/TradeProgressOverlay.tsx:18-137` | Inks parts by job status on the plan and in 3D | KEEP + GAME |
| Pin picker | tool | `src/components/build/TradeProgressOverlay.tsx:84-91, 110-112`; `src/components/build/tradeOverlayGeometry.ts:137-219` | Tap a part to pin a job to it | KEEP + GAME |
| Overlay projection | rule | `src/components/build/tradeOverlayGeometry.ts:37-133` | Turns a reference into shapes on screen | KEEP |
| Overlay host and gate | rule | `src/components/build/TradeOverlayHost.tsx:16-19`; `src/components/ProjectWorkspace.tsx:41, 269` | The trade screens load only on the private designer path | KEEP |
| Trade flow store | data | `src/components/build/tradeFlow.ts:7-66` | Role, mode (off, pick, map), unfinished job form | KEEP |
| Job photo | action | `src/components/build/jobPhoto.ts:3-39` | Re-encodes a photo so it fits the file | KEEP |
| Room sketch | action | `src/components/build/transfer.ts:39-75` | Makes a small plan picture for the file | KEEP |
| Transfer helpers | action | `src/components/build/transfer.ts:7-36` | Sister app address, ids, download, file name, item sizes | KEEP |
| Status words and symbols | data | `src/components/build/statusLabels.ts:1-4`; `src/components/build/tradeAppearance.ts:3-9` | Labels for 10 file states; symbol and ink for 5 job states | KEEP + GAME |
| Link to a pilot | action | `src/pilots/BuildJobLink.tsx:6-107`; `src/pilots/projectTradeJob.ts:3-42` | Posts scope, quote state and progress to a pilot | KEEP |
| House tutorial steps | data | `src/designer/houseBuildTutorial.ts:3-21, 25-520` | 19 review steps in build order | KEEP + GAME |
| Tutorial routing | action | `src/App.tsx:351-382` | Each step opens its tool | KEEP |
| Pilot stages | rule | `src/designer/sharedSpecsContract.ts:7, 89-92, 118-138` | 8 review stages, who signs each, what blocks each | KEEP |
| `SharedSpecComponent` | data | `src/designer/sharedSpecsContract.ts:35-45` | Measured component: quantity, unit, material, cost, carbon, delivery, status | KEEP |
| `measuredBuildSpecs` | rule | `src/designer/sharedBuildAdapter.ts:30-352` | Builds the component list from the design | KEEP |
| Shared spec reducer | rule | `src/designer/sharedSpecsContract.ts:84-111, 141-197` | Role rights, merge, four operations | KEEP |
| Coordination helpers | rule | `src/designer/sharedCoordination.ts:23-213` | Stage states, to-do list per role, delivery groups, snapshot | KEEP |
| Local pilot store | data | `src/store/sharedPilotStore.ts:15-139` | Browser rehearsal of the shared register | KEEP |
| Shared project workbench | panel | `src/components/SharedProjectWorkbench.tsx:15, 195, 215, 553, 569` | Screen of the register (seen by search only) | KEEP |
| `BoundaryComponent` | data | `src/designer/boundaryModel.ts:1-14` | Measured vertices, edges and faces in 3D metres | KEEP + GAME |
| Component rules | rule | `src/designer/boundaryModel.ts:75-257` | Flat, non-crossing faces; limits | GAME |
| Component editing | tool | `src/designer/componentEditing.ts:47-97`; `src/components/three/BoundaryTools.tsx:7-72` | Components button: add face, edit vertex, move | KEEP + GAME |
| Display stages | data | `src/designer/foundation.ts:20-21`; `src/designer/garden.ts:50` | Excavation shown dug or filled; pool shown in 3 stages | KEEP + GAME |
| Project metrics and tasks | rule | `src/designer/projectHub.ts:9-34, 74-160` | Company types, departments, key figures, task register | KEEP |
| Service review checks | rule | `src/designer/projectReview.ts:415-474, 575-603` | Disconnected, unmatched size, no drainage fall, tree zone | KEEP + GAME |
| Materials settings | data | `src/designer/materials/types.ts:1-58` | Wall, mortar, plaster, concrete, roof inputs; typed rates | KEEP |
| Report shapes | data | `src/designer/materials/types.ts:86-113` | Quantity lines and totals | KEEP |
| Procurement lines | rule | `src/designer/materials/costs.ts:27-64` | Which lines are bought, with their specification | KEEP |
| Material cost | rule | `src/designer/materials/costs.ts:66-100` | Quantity times typed rate; no tax maths | KEEP |
| Materials cost panel | panel | `src/components/MaterialsCostPanel.tsx:4-29` | Tax basis and one rate box per line | KEEP |
| Calculation budget | rule | `src/designer/projectCalculationBudget.ts:16-28, 49-258` | Refuses a summary past set sizes | KEEP |
| Designer cart | rule | `src/store/cartStore.ts:317-415` | Lines from placed products, floors, paint, cladding | KEEP; FRIENDLIER: add runs and fixtures |
| Cart overrides | data | `src/store/cartStore.ts:158-214` | Quantity overrides and removed products | KEEP |
| House cost panel | panel | `src/components/HouseCostPanel.tsx:13-46` | Read-only cost of products and finishes | KEEP |
| Quote-required rule | rule | `src/lib/quotedProducts.ts:5-18` | A product with no price blocks checkout | KEEP |
| Cart totals | view | `src/pages/CartPage.tsx:337-370` | Subtotal; shipping and tax as text only | KEEP |
| Request quote | action | `src/components/TopBar.tsx:1064-1100` | Sends the design and a cart summary as a lead | KEEP |
| Marketplace cart | data | `src/store/marketplaceCartStore.ts:20-98` | Second cart keyed by database product id | KEEP |
| Marketplace quote call | action | `src/pages/MarketplaceCartPage.tsx:71-105` | Posts the cart to the quote route | KEEP |
| Site procurement plan | data | `src/designer/cityProcurement.ts:10-58` | Supplier packages with lines and dates | KEEP |
| Procurement CSV | action | `src/designer/cityProcurement.ts:61-78` | Export with formula escaping | KEEP |
| `POST /api/cart-quote` | server route | `api/cart-quote.ts:1-140` | Splits a marketplace cart per merchant; creates no order | KEEP |
| `splitCartByMerchant` | rule | `api/_lib/cart/split.ts:63-123` | Sums lines per merchant in minor units | KEEP |
| `repriceCart` | rule | `api/_lib/pricing/repriceCart.ts:142-209` | Server takes prices from the database or the bundled seed | KEEP |
| Snapshot checks | rule | `api/_lib/designSnapshotValidation.ts:37-90` | Validates services, cuts, components, foundation, city on save | KEEP + GAME |
| MCP service tools | server route | `api/_lib/designMcp.ts:52-74, 144-165, 314-357` | Schema, material search, estimate; read-only | KEEP |
| Materials input contract | format | `api/_lib/materialEstimateContract.ts:14-72` | Strict inputs for the materials estimate | KEEP |
| Pilot trade jobs | server route | `api/_lib/pilotBuild.ts:23-74` | Build context and trade-job save for a pilot | KEEP |
| Leads, procurement, shared specs routing | server route | `api/orders.ts:22, 33-34, 1601, 1626` | Folded into the orders function (seen by search only) | KEEP |
| Live build contract | format | `src/sharedBuild/contract.ts:14-22, 58-82, 137-219` | Player trades; changes addressed by id; all-or-nothing apply | KEEP + GAME |

### City, land, garden and eco: tools, views, panels and data

Path key. A bare file name below means this path:
- `src/components/`: `CityWorkbench.tsx`, `CityPlanView.tsx`, `CityThreeView.tsx`, `CityWorkspace.tsx`, `CityOrdersPanel.tsx`, `CityNumber.tsx`, `TopBar.tsx`, `HouseWorkspace.tsx`, `RoomCanvas.tsx`, `RoomView3D.tsx`, `RoomViewControls.tsx`, `GardenPanel.tsx`, `GardenLayer.tsx`, `GardenDrawLayer.tsx`, `PlanGardenWorkspace.tsx`, `OutdoorBuildDetails.tsx`, `ProjectWorkspace.tsx`, `EnergyPanel.tsx`, `EcoTreesLayer.tsx`, `canvasSiteBridge.ts`
- `src/components/three/`: `ThreeStage.tsx`, `HouseStageSlot.tsx`, `gardenMeshes.ts`, `gardenSurround.ts`, `gardenGround.ts`, `earthworkMeshes.ts`, `ecoTrees.ts`, `pilotDemonstrations.ts`, `buildingMeshes.ts`
- `src/designer/`: `city.ts`, `cityContract.ts`, `cityLibrary.ts`, `cityBuildingForm.ts`, `cityAccess.ts`, `cityProcurement.ts`, `garden.ts`, `gardenPaving.ts`, `outdoorTakeoff.ts`, `terrainCuts.ts`, `surfaceActions.ts`, `eco.ts`, `ecoContract.ts`, `solarCalc.ts`, `useEnergyReport.ts`, `energyMeter.ts`, `sunPosition.ts`, `planDaylight.ts`, `lighting.ts`, `buildingScene.ts`, `aiDesignContract.ts`; `designer/energy.ts` is `src/designer/energy.ts`; `lessonData.ts` is `src/designer/lessons/lessonData.ts`
- `src/site/`: `SiteWorkspace.tsx`, `SiteMap.tsx`, `SiteReport.tsx`, `SiteDiagram.tsx`, `SiteEntry.tsx`, `SiteLaunchButton.tsx`, `SiteAnnotation.tsx`, `planAdapter.tsx`, `hydration.ts`, `previewMode.ts`, `sample.ts`, `terrain.ts`, `foundationScenario.ts`; written with the folder: `site/types.ts`, `site/geometry.ts`, `site/providers.ts`
- `src/eco/`: `EcoSheet.tsx`, `EcoVisual.tsx`, `ProgrammePanel.tsx`, `programme.ts`, `water.ts`, `quantities.ts`, `places.ts`; `eco/energy.ts` is `src/eco/energy.ts`
- `src/walk/`: `EarthworkTool.tsx`, `WalkMode.tsx`, `outdoor.ts`, `walk/scene.ts`, `walk/visit.ts`
- `src/store/`: `propertyStore.ts`, `cityProcurementStore.ts`, `measuredPathToolStore.ts`
- `src/data/`: `mauritiusSolar.ts`, `applianceLoads.ts`, `citySuppliers.ts`, `serviceProducts.ts`
- `src/lib/`: `cityProcurementClient.ts`, `gardenDrawActions.ts`; `messages.ts` is `src/i18n/messages.ts`; `sharedBuild/contract.ts` is `src/sharedBuild/contract.ts`
- `api/_lib/`: `designSnapshotValidation.ts`; the Site server files are written in full

| Item | Kind | Where | What it does (one line) | Verdict |
|---|---|---|---|---|
| City Build workbench | view | `CityWorkbench.tsx:72,376-384,399-406` | Full-screen dialog with five tabs: Plan, Infrastructure, Data centre, Orders, Overview | FRIENDLIER (join it to the house world) + GAME |
| City launch button and `?panel=city` entry | action | `CityWorkspace.tsx:14-37,44`; `TopBar.tsx:2209`; `HouseWorkspace.tsx:157` | Opens City Build from the plan bar, the house rail or the address | KEEP |
| City 2D plan | view | `CityPlanView.tsx:93-177` | SVG map: drag to pan, pinch or wheel to zoom, tap to select or place | KEEP |
| City 3D view | view | `CityThreeView.tsx:332-518` | Orbit, pan, zoom, tap to select, arrow and +/- keys; no editing gesture | FRIENDLIER (place, drag and turn in 3D) + GAME |
| 2D / 3D switch | action | `CityWorkbench.tsx:434-448` | Swaps the two city views; 3D resets the tool to Select | KEEP |
| Rule: a drawing tool forces 2D | rule | `CityWorkbench.tsx:176-182` | Picking any tool but Select switches the view to 2D | FRIENDLIER (let the tools work in 3D) |
| Select / pan | tool | `CityWorkbench.tsx:449-455`; `CityPlanView.tsx:148-169` | Tap an item to select it; drag empty ground to pan | KEEP + GAME |
| Draw road | tool | `CityWorkbench.tsx:456-461,183-192,226-246` | Tap corners on the 0.5 m grid, then Finish route; width comes from a template | FRIENDLIER (draw in 3D, drag the points) + GAME |
| Road templates | data | `city.ts:101-130` | Four editable sample sections (width, surface depth, base depth) | KEEP + GAME |
| Draw utility | tool | `CityWorkbench.tsx:462-467,247-261,569-590` | Pick one of five systems, tap corners, Finish; a default trench is proposed | FRIENDLIER (show the trench, draw in 3D) + GAME |
| Utility systems | data | `city.ts:13,131-137` | Five systems, each with a label and a colour | KEEP + GAME |
| Place equipment | tool | `CityWorkbench.tsx:468-473,201-225,598-617` | Pick one of nine kinds, tap the site; a default-size envelope appears | FRIENDLIER (drag from a tray, turn by handle) + GAME |
| Item kinds and default sizes | data | `city.ts:14-23,138-148`; `CityWorkbench.tsx:48-58` | Nine kinds with a colour and a default width, length and height | KEEP + GAME |
| My buildings: save current house | action | `CityWorkbench.tsx:95-105,538-542`; `cityLibrary.ts:30-50` | Captures the house's room outlines per storey into a device library | FRIENDLIER (save with the design, not the device) + GAME |
| My buildings: place a saved building | tool | `CityWorkbench.tsx:193-200,543-547`; `cityLibrary.ts:52-54` | Choose Place, tap the site; each placement is an independent copy | FRIENDLIER (drag and turn before dropping) + GAME |
| My buildings: remove from library | action | `CityWorkbench.tsx:106-113,546` | Deletes a library entry on this device | KEEP |
| Refresh building envelope | action | `CityWorkbench.tsx:336-375,887` | Makes or updates the one item linked to the current house, as a bounding box | FRIENDLIER (make the link automatic) + GAME |
| Fit / Frame selected | action | `CityWorkbench.tsx:475-481,626`; `CityPlanView.tsx:35-43`; `CityThreeView.tsx:312-330` | Frames the whole city or the selected item | KEEP + GAME |
| Undo / Redo | action | `CityWorkbench.tsx:482-500` | Steps the shared design history and clears the selection | KEEP + GAME |
| Details inspector | panel | `CityWorkbench.tsx:618-851` | Name, X, Y, size, rotation and ratings typed for the selected item | FRIENDLIER (drag handles beside the numbers) |
| Route coordinates and elevations | panel | `CityWorkbench.tsx:787-834` | Typed X, Y per route point, plus Z for utilities | FRIENDLIER (drag point handles on the map) |
| District connections | panel | `CityWorkbench.tsx:627-633`; `cityAccess.ts:3-20` | Plan distance from a building centre to the nearest road and four utility lines | KEEP + GAME |
| Remove item | action | `CityWorkbench.tsx:166-175,848` | Deletes the selected road, utility or item | KEEP + GAME |
| Your site (size) | panel | `CityWorkbench.tsx:852-885` | Typed city site width and length, plus a view-controls help line | FRIENDLIER (drag the site edges) |
| Try an eco district | action | `CityWorkbench.tsx:268-283,877-883`; `city.ts:749-859` | Loads a sample district into an empty city | KEEP |
| Include city in estimates | rule | `CityWorkbench.tsx:889-895`; `city.ts:552,559,583,639` | Off: roads, utilities and items leave the takeoff and both drawings | KEEP |
| Reveal utility routes | action | `CityWorkbench.tsx:896-903`; `CityPlanView.tsx:272-274`; `CityThreeView.tsx:234` | Shows or hides utility lines in both views | KEEP + GAME |
| Site elements list | panel | `CityWorkbench.tsx:904-920` | One button per road, utility and item; selects it | KEEP |
| Infrastructure tab | panel | `CityWorkbench.tsx:924-995` | Reference catalogue in six categories; links a reference to the selection | KEEP |
| Supplier references | data | `citySuppliers.ts:6-22` | Hard-coded quote-only reference records (rows not read) | FRIENDLIER (move to server data) |
| Price-free page rule in City | rule | `CityWorkbench.tsx:123,287-304,961-976` | On price-free pages names and source links become neutral labels | KEEP |
| Data centre tab | panel | `CityWorkbench.tsx:996-1169` | Typed scenario inputs and six result tiles | KEEP |
| Data-centre scenario formula | rule | `city.ts:519-541` | IT load, facility load, yearly energy, solar balance, battery hours, water | KEEP + GAME |
| Orders tab | panel | `CityOrdersPanel.tsx:32-207` | Supplier packages with lines, target dates, recipients; a timeline; storage | FRIENDLIER (fix the Packages view outside English) |
| Prepare order / Prepare package | action | `CityWorkbench.tsx:284-328,847,988` | Starts a draft package from the selection or from a reference | KEEP |
| Orders export | format | `CityOrdersPanel.tsx:107-117`; `cityProcurement.ts:61-78` | Downloads the draft schedule as CSV or JSON | KEEP |
| Orders secure save and load | action | `CityOrdersPanel.tsx:118-145`; `cityProcurementClient.ts:4-25` | Saves or loads the draft under a signed-in merchant account, by revision | KEEP |
| Orders unsaved-edit guard | rule | `CityWorkbench.tsx:114-145,412-413` | Blocks leaving Orders while a package has unsaved edits | KEEP |
| Procurement plan store | data | `cityProcurementStore.ts:16-66`; `cityProcurement.ts:10-51` | Local plans per project, kept outside the design | KEEP |
| Overview tab | panel | `CityWorkbench.tsx:1179-1269` | Nine quantity tiles, utility lengths, review warnings | KEEP + GAME |
| City takeoff | rule | `city.ts:543-729` | Road length, area and layer volumes, trench volume, item counts, known ratings | KEEP + GAME |
| Strip footprints and union area | rule | `city.ts:394-517` | One butt-ended strip per segment; exact union area and trench volume by sweep | KEEP + GAME |
| City model | data | `city.ts:24-87` | Site rectangle, roads, utilities, items, one data-centre scenario | KEEP + GAME |
| City limits | rule | `city.ts:88-99` | Counts and extents a city may hold | FRIENDLIER (raise after measuring frames) |
| Whole-city check | rule | `city.ts:189-391`; `cityContract.ts:86-106`; `designSnapshotValidation.ts:25-35` | A city with one bad value is refused whole, on the device and on the server | KEEP |
| City schema description | format | `cityContract.ts:107-121` | Units, limits and limits of use as text for outside proposals | KEEP + GAME |
| Building form | format | `cityBuildingForm.ts:3-30` | Room outlines in a unit box with base and top fractions | KEEP + GAME |
| Building library | data | `cityLibrary.ts:6-28` | Up to 24 captured buildings in device storage | FRIENDLIER (store with the account) |
| City number field | panel | `CityNumber.tsx:3-47` | Commits on blur or Enter; puts back a refused value | KEEP |
| City 3D drawing rules | rule | `CityThreeView.tsx:200-276,350-383` | Flat ground plane, fixed sun, tone mapping, full rebuild on every change | FRIENDLIER (partial rebuild, shared sun) + GAME |
| City 3D item shapes | view | `CityThreeView.tsx:72-175` | Extruded building forms, tank cylinder, array plate, lamp pole, park, boxes | KEEP + GAME |
| City 3D unavailable message | rule | `CityThreeView.tsx:348-354,451,513-516` | Says to switch to 2D when the 3D context fails | KEEP |
| Plot tool | tool | `TopBar.tsx:1560-1625,480-496,3817-3851` | Type the plot width and depth, then Lock or Clear | FRIENDLIER (drag the plot edges) + GAME |
| Plot model and clamp | data | `propertyStore.ts:236-246,471-491` | One rectangle per design, sides clamped 1 to 500 m | KEEP + GAME |
| Plot boundary rule | rule | `RoomCanvas.tsx:1374,2256-2257`; `propertyStore.ts:2052-2053`; `surfaceActions.ts:393-403` | Rooms, walls, items and bends are refused outside the plot | KEEP + GAME |
| Plot in the plan | view | `RoomCanvas.tsx:594-606,4521-4546` | Dashed outline with a size label | KEEP |
| Plot capacity chip | panel | `RoomCanvas.tsx:636-640,3550-3556` | Plot area, built area, percent built | KEEP + GAME |
| Site button | action | `SiteLaunchButton.tsx:8-75`; `TopBar.tsx:2210` | Opens Site from the map; hidden on the demo page without `?site=1` | KEEP |
| Site workspace | view | `SiteWorkspace.tsx:36-46,438-450` | Three steps: Boundary, Levels and rules, Report | FRIENDLIER (fewer fields on the first step) |
| Site map | view | `SiteMap.tsx:62-213` | Vector map: tap adds a corner, numbered corners drag, zoom and scale controls | KEEP + GAME |
| Map resource guard | rule | `SiteMap.tsx:16-44,93-95` | Tiles only from fixed hosts, no credentials, 12 s limit | KEEP |
| Find a place | action | `SiteWorkspace.tsx:355-374,513-551`; `api/_lib/site/providers.ts:134-164` | Text search through the server; a pick recentres the map | KEEP + GAME |
| Jump to a district | action | `SiteWorkspace.tsx:50,506-512` | Private page only: recentres the map and sets the eco place and rain region | KEEP |
| Add corner by coordinates | tool | `SiteWorkspace.tsx:610-679` | Type longitude and latitude; edit or remove any corner | KEEP |
| From the surveyor's plan | tool | `SiteWorkspace.tsx:184-210,681-701`; `site/geometry.ts:135-184` | Type a start point and length, bearing lines; the closure error is shown | KEEP + GAME |
| Undo, clear, add another corner | action | `SiteWorkspace.tsx:126-176,569-585` | Local boundary history of 50 steps | KEEP |
| Close and check boundary | action | `SiteWorkspace.tsx:177-224,731-733`; `site/geometry.ts:69-113,202-218` | Projects the corners to plan metres and checks shape and size | KEEP + GAME |
| Fit site to the plan | tool | `SiteWorkspace.tsx:284-309,703-730` | Type the plan position of the first corner; rooms do not move | FRIENDLIER (drag the outline over the plan) + GAME |
| What-if corner levels | tool | `SiteWorkspace.tsx:225-257,770-779` | Type one level per corner and a vertical reference | FRIENDLIER (tap a corner, type its level) |
| Survey import | format | `SiteWorkspace.tsx:781-816`; `terrain.ts:227-255` | CSV x,y,z or JSON points with contour index lists, up to 250 kB | KEEP + GAME |
| Platform level and cut/fill | rule | `terrain.ts:185-225`; `site/geometry.ts:244-277` | Clips the surface to the plot and sums cut and fill against one level | KEEP + GAME |
| Survey surface | rule | `terrain.ts:27-162` | Triangulated surface that honours contour lines; refuses bad data | KEEP + GAME |
| Planning assumptions | tool | `SiteWorkspace.tsx:258-283,842-879`; `site/geometry.ts:317-346` | Typed setback and coverage give a buildable envelope (convex plots only) | FRIENDLIER (draw the envelope on the plan) + GAME |
| Foundation comparison | tool | `SiteWorkspace.tsx:880-921`; `foundationScenario.ts:7-32` | Re-runs the foundation estimate with a typed datum shift | KEEP |
| Fetch public context | action | `SiteWorkspace.tsx:334-354,927-929`; `site/providers.ts:38-57` | Asks the server for solar, mapped surroundings and terrain heights | KEEP |
| Public solar figure | data | `api/_lib/site/providers.ts:165-200` | Yearly yield per kWp and best tilt at the plot centre | KEEP + GAME |
| Mapped surroundings | data | `api/_lib/site/providers.ts:207-296` | Counts of roads, buildings, waterways and power features within 100 m | FRIENDLIER (draw them, not only count) + GAME |
| Public terrain heights | data | `api/_lib/site/providers.ts:303-376` | One height per boundary corner from public tiles of about 30 m | FRIENDLIER (fetch a grid, not corners) + GAME |
| Provider guard rails | rule | `api/_lib/site/providers.ts:23-106`; `api/_lib/site/handler.ts:10-41` | Fixed hosts, time and size limits, caches, a wait per service | KEEP |
| Site report | view | `SiteReport.tsx:28-344` | Area, sides, levels, slope, cut/fill, sun, surroundings, envelope, sources | KEEP |
| Site diagram | view | `SiteDiagram.tsx:3-70` | Plot outline with numbered corners, side lengths and a north arrow | KEEP |
| Print / save PDF | action | `SiteWorkspace.tsx:930-938`; `SiteReport.tsx:69-73` | Prints the report with the banner in the page footer | KEEP |
| Export Site JSON | format | `SiteWorkspace.tsx:939-953` | Downloads the whole site payload | KEEP + GAME |
| Apply site to plan | action | `SiteWorkspace.tsx:310-333,968-970` | Saves the plot as the outline's bounding rectangle plus the full payload | KEEP + GAME |
| Demo practice sites | data | `sample.ts:4-38`; `previewMode.ts:13-18`; `site/providers.ts:4-8` | The demo page uses invented outlines and makes no live request | KEEP |
| Preview live check | rule | `previewMode.ts:20-55`; `SiteEntry.tsx:16-30` | Live map on the demo page only after the server says it is a preview build | KEEP |
| Deferred site check | rule | `hydration.ts:23-86`; `SiteLaunchButton.tsx:12-50` | The saved payload stays inert until checked after first paint | KEEP |
| Site overlay in the plan | view | `planAdapter.tsx:10-24`; `SiteAnnotation.tsx:4-36`; `canvasSiteBridge.ts:5-38` | Draws the true outline, a provenance label and a north arrow | KEEP |
| Site payload | format | `site/types.ts:49-65,177-306` | Versioned lon/lat boundary, plan polygon, terrain, planning, public snapshot | KEEP + GAME |
| Map to plan projection | rule | `site/geometry.ts:2-44` | Local tangent plane in metres, y to the south | KEEP + GAME |
| Area, sides, local land units | rule | `site/geometry.ts:53-65` | Area, perimeter, sides and two local land measures | KEEP + GAME |
| Slope | rule | `site/geometry.ts:279-315` | Best-fit plane: percent, degrees, downhill bearing, residual | KEEP + GAME |
| Report banner | rule | `site/types.ts:66-67` | One fixed sentence on every Site screen and print | KEEP + GAME |
| Garden panel | panel | `GardenPanel.tsx:60-210`; `PlanGardenWorkspace.tsx:13-64`; `RoomView3D.tsx:2219`; `HouseStageSlot.tsx:9` | One panel for surfaces, pools and boundaries in Plan, 3D and Walk's build tools | FRIENDLIER (pictures for the seven surfaces) + GAME |
| Add outdoor surface | tool | `GardenPanel.tsx:90-101,121-126`; `garden.ts:5-13` | Pick one of seven kinds, drag an area on the ground | KEEP + GAME |
| Draw-area gesture | rule | `GardenDrawLayer.tsx:33-71`; `RoomView3D.tsx:1529-1545`; `gardenDrawActions.ts:7-17` | Press, drag, release makes one rectangle and one undo step | KEEP + GAME |
| Custom outdoor outline | tool | `GardenPanel.tsx:127-137`; `measuredPathToolStore.ts:96-100` | Tap points for a polygon or a curved outline, then Finish | FRIENDLIER (let the outline be reshaped later) + GAME |
| Paving patch with a product | tool | `GardenPanel.tsx:138-147,179-191`; `gardenPaving.ts:17-32` | A path surface tied to a slab product; counts whole pieces in rows | FRIENDLIER (products from server data) + GAME |
| Boundary: fence, railing, hedge | tool | `GardenPanel.tsx:103-113,148-153,194-203`; `garden.ts:15-19,58-64` | Adds a 4 m run, then tap to place; typed ends and height | FRIENDLIER (click the start and the end) + GAME |
| Move or resize a patch | tool | `GardenLayer.tsx:35-53,66-69`; `RoomView3D.tsx:1108-1117,1621-1636`; `GardenPanel.tsx:166-167` | Plan: drag or pull corner handles. 3D: tap to place, drag a corner | FRIENDLIER (drag to move in 3D too) + GAME |
| Typed patch fields and Raise terrain | panel | `GardenPanel.tsx:170-178` | X, Y, width, length, raise 0 to 2 m, surface kind | KEEP + GAME |
| Outdoor floor layers | panel | `OutdoorBuildDetails.tsx:26-35`; `outdoorTakeoff.ts:6-16` | Thickness and sub-base depth give material volumes | KEEP + GAME |
| Pool build | tool | `OutdoorBuildDetails.tsx:36-58`; `garden.ts:43-57`; `outdoorTakeoff.ts:19-36` | Typed basin sizes, three construction views, excavation and water volumes | FRIENDLIER (dig it with the dig tool) + GAME |
| Pool and outdoor references | data | `OutdoorBuildDetails.tsx:4,53-59` | Hard-coded outside references (data files not read) | FRIENDLIER (move to server data) |
| Remove garden element | action | `GardenPanel.tsx:168`; `surfaceActions.ts:102-103,170-172,312-320` | Removes one patch or fence, or all of one kind | KEEP + GAME |
| Garden quantities line | panel | `GardenPanel.tsx:205-208` | Total surface area, boundary length, paving estimate | KEEP |
| Garden model and store actions | data | `garden.ts:22-68`; `propertyStore.ts:1992-2043` | Surfaces and fences saved in the design; five store actions | KEEP + GAME |
| Garden in the plan | view | `GardenLayer.tsx:74-98`; `RoomCanvas.tsx:4548` | Coloured patches with labels; fences as lines with lengths | KEEP |
| Garden in 3D | view | `gardenMeshes.ts:75-207` | Textured patches, raised edges, pool shells, posts and slats, grass detail | KEEP + GAME |
| Automatic lawn | rule | `gardenSurround.ts:66-91`; `gardenGround.ts:36-101` | Turf over the plot rectangle, or 3 m around the house with no plot | KEEP + GAME |
| Outdoor walking surfaces | rule | `outdoor.ts:19-46` | Lawn pieces, patches and dug cells become flat walkable patches | KEEP + GAME |
| Garden lesson | data | `lessonData.ts:291-300` | One lesson card with three steps | KEEP |
| Dig / Fill | tool | `EarthworkTool.tsx:17-143,214-280`; `WalkMode.tsx:269,286` | In Walk: tap or drag across 1 m cells to lower or refill the ground | FRIENDLIER (also in Plan and 3D) + GAME |
| Cell coordinates | panel | `EarthworkTool.tsx:250-276` | Type a cell's X and Y and apply one stroke | KEEP |
| Dig rules | rule | `EarthworkTool.tsx:51-104`; `terrainCuts.ts:41-61` | Inside the plot, not under a ground-floor room, 5 m a stroke, 20 m deep at most | KEEP + GAME |
| Excavation cells | data | `terrainCuts.ts:3-17`; `propertyStore.ts:346,1722-1725` | Saved list of 1 m cells with a top level and a depth | KEEP + GAME |
| Excavation in 3D | view | `earthworkMeshes.ts:5-64`; `ThreeStage.tsx:1276-1288,1447` | Soil floor and side walls; ground and garden clipped around each cell | KEEP + GAME |
| Excavation in the plan | view | `RoomCanvas.tsx:4955` | One brown square per cell, shown with the foundation layer | FRIENDLIER (show the depth as a number) |
| Excavation underfoot | rule | `outdoor.ts:37-40`; `walk/scene.ts:165`; `walk/visit.ts:35-42` | The walker stands on the cell bottom and meets the soil walls | KEEP + GAME |
| Remove a cell / fill all cells | action | `surfaceActions.ts:104-105,166-167,265-269`; `RoomCanvas.tsx:3682`; `RoomView3D.tsx:2108` | The surface menu in Plan and 3D removes one cell or all | KEEP + GAME |
| Excavation checks | rule | `terrainCuts.ts:18-40`; `designSnapshotValidation.ts:51`; `sharedBuild/contract.ts:89`; `aiDesignContract.ts:108,480` | The same check on the device, the server, shared builds and outside proposals | KEEP + GAME |
| Eco sheet | view | `EcoSheet.tsx:19-28,153-180`; `ProjectWorkspace.tsx:37-42,57,268` | Dialog with Water, Energy and Materials cards; private designer page only | FRIENDLIER (show results in the scene) + GAME |
| Water card | panel | `EcoSheet.tsx:183-304` | Four figures, nine inputs, a 12-month table | KEEP + GAME |
| Energy card | panel | `EcoSheet.tsx:305-370` | Five yearly figures and two demonstration switches | KEEP + GAME |
| Materials card | panel | `EcoSheet.tsx:371-438` | Pilot pickers, six quantities, the programme panel | KEEP |
| Print A4 | action | `EcoSheet.tsx:169,440-497` | Prints every result on one page | KEEP |
| Eco visual | panel | `EcoVisual.tsx:23-168` | Cover picture with one figure; rain bars, top three loads, or a room outline | KEEP |
| Water balance | rule | `water.ts:18-35` | Month by month: rain caught, tank, house use, garden use, greywater, spill | KEEP + GAME |
| Rain table | data | `water.ts:7-14` | Monthly mean rain in mm for six regions | KEEP + GAME |
| Water defaults | data | `water.ts:17` | Starting assumptions for people, runoff, demand and infiltration | KEEP + GAME |
| Eco quantities | rule | `quantities.ts:12-31` | Roof, green, paving, wall and tank figures read from the plan | KEEP + GAME |
| Yearly energy by place | rule | `eco/energy.ts:4-21` | Solar made, electricity used and share covered for the chosen reference place | KEEP + GAME |
| Reference places | data | `places.ts:2-93` | Ten points with coordinates, rain region and yearly solar yield | KEEP + GAME |
| Climate place and rain region pickers | action | `EcoSheet.tsx:219-244` | A place sets its rain region with it | KEEP |
| Tank scenario picker | action | `EcoSheet.tsx:247-262` | Placed tanks or one of six fixed sizes | KEEP |
| Pilot material pickers | tool | `EcoSheet.tsx:140-152,378-407` | Choose one room for moss render, one for block, one paving patch, a roof finish | FRIENDLIER (tap the wall or roof instead) + GAME |
| Pilot looks in 3D | view | `RoomView3D.tsx:316-327`; `buildingScene.ts:35,87`; `gardenMeshes.ts:84` | Recolours the chosen walls, the patch and every roof | KEEP + GAME |
| Demonstration props | tool | `EcoSheet.tsx:105-129,339-369`; `buildingScene.ts:36-41`; `pilotDemonstrations.ts:3-42` | A small wind mast and a kinetic tile at typed X, Y; no output counted | FRIENDLIER (place by tapping the ground) + GAME |
| Private programme panel | panel | `ProgrammePanel.tsx:3-99`; `programme.ts:13-80` | Loads a local file of pins; kept in tab memory only | KEEP |
| Programme pins on the Site map | view | `SiteMap.tsx:187-197`; `SiteWorkspace.tsx:51,554` | Numbered markers drawn as page elements, never put in a map request | KEEP |
| Open Site from the Eco sheet | action | `EcoSheet.tsx:18-27,437` | Swaps the sheet for the Site workspace | KEEP |
| Eco model | data | `ecoContract.ts:42-61`; `eco.ts:14-19` | One study, up to 300 trees and 100 green roofs; refused whole if invalid | FRIENDLIER (make the study fields optional) + GAME |
| Trees form | tool | `ProjectWorkspace.tsx:979-1012,1080-1133` | Typed name, X, Y, height, crown, stem, status and protection method | FRIENDLIER (place a tree by tapping) + GAME |
| Tree protection radius | rule | `eco.ts:27-32` | 12 times the stem diameter, capped at 15 m | KEEP + GAME |
| Trees in the plan | view | `EcoTreesLayer.tsx:5-20`; `RoomCanvas.tsx:4549` | Crown circle, protection ring and name | KEEP |
| Trees in 3D | view | `ecoTrees.ts:7-43`; `ThreeStage.tsx:1548-1556`; `RoomView3D.tsx:2076` | A stem and five crown lobes at the entered height and radius | KEEP + GAME |
| Green roof form | tool | `ProjectWorkspace.tsx:1013-1043,1161-1183` | Typed assembly weight and water for one roof room | FRIENDLIER (draw it on the roof) + GAME |
| Green roof load | rule | `eco.ts:46-62` | Saturated mass plus extra water, converted to kPa | KEEP + GAME |
| Engineering references | data | `ecoContract.ts:91-100` | Five optional reference strings | KEEP |
| Daily energy report | rule | `designer/energy.ts:282-411` | Classifies every placed item; sums solar, load, battery, inverter; sets a status | KEEP + GAME |
| Energy roles | rule | `designer/energy.ts:86-106` | Generator, storage, inverter, consumer or none, from product fields | KEEP + GAME |
| Unpowered list | rule | `designer/energy.ts:169-181,348-360` | Lists plug-in items with no watts instead of dropping them | KEEP |
| Solar sizing maths | rule | `solarCalc.ts:37-179` | Daily generation, load, panels to cover, roof fit, cover percent, battery hours | KEEP + GAME |
| Solar resource table | data | `mauritiusSolar.ts:54-112` | Three tilt cases with monthly figures for one reference point | KEEP + GAME |
| Appliance load table | data | `applianceLoads.ts:51-60` | Typical watts and hours by product name and category (rows not read) | KEEP + GAME |
| Energy report hook | rule | `useEnergyReport.ts:43-86` | Runs the report on every room or catalogue change | KEEP |
| Energy meter words | rule | `energyMeter.ts:27-140` | Bar fill and plain sentences for each state | KEEP + GAME |
| Energy panel and chip | panel | `EnergyPanel.tsx:2-19,209-213`; `RoomCanvas.tsx:3591`; `TopBar.tsx:3369,3724`; `RoomView3D.tsx:2219` | A chip on the plan and a readout with item rows, in Plan and 3D | KEEP + GAME |
| Item watts, hours, on/off | tool | `EnergyPanel.tsx:144-146,332-350`; `propertyStore.ts:721-725` | Per placed item: type watts, pick hours, switch on or off | FRIENDLIER (a switch on the item itself) + GAME |
| Add panel, browse solar, add tank | action | `EnergyPanel.tsx:181,201,211-213` | Arms a product for placing | KEEP + GAME |
| Sun position model | rule | `sunPosition.ts:52-116` | Declination, hour angle, elevation, azimuth, sunrise and sunset | KEEP + GAME |
| Sun reference point | data | `sunPosition.ts:40,72` | One fixed latitude, longitude and time zone for every design | FRIENDLIER (use the plot's own position) + GAME |
| Daylight control | action | `RoomViewControls.tsx:241-263` | 3D house: a toggle and a 06:00 to 20:00 slider | KEEP + GAME |
| Sun in the 3D rig | view | `ThreeStage.tsx:1038-1059` | Sun direction, colour and strength; lamps at dusk | KEEP + GAME |
| Plan daylight | view | `planDaylight.ts:7-39` | Plan shadows and window light patches from the same sun | KEEP |
| Lamps-on factor | rule | `lighting.ts:91-99` | Lamps fade in as the sun drops below 8 degrees | KEEP + GAME |
| Eco server check | rule | `designSnapshotValidation.ts:61-78` | The server refuses an invalid eco model or reference set | KEEP |
| Members' area home | view | `src/pilots/Workspace.tsx:212` | List of pilots and one pilot's page | KEEP |
| Member's own page | view | `src/pilots/Dashboard.tsx:29` | A member's tasks, dates and own figures | KEEP |
| Shared plan visit | view | `src/pilots/PilotVisit.tsx:30` | Read-only 3D and walk of a shared site plan | KEEP |
| Island pin map | view | `src/pilots/PilotMap.tsx:10` | Outline map with numbered site pins, zoom and pan | KEEP |
| Record | view | `src/pilots/Record.tsx:25` | Steps, monthly record, team, notes, papers | KEEP |
| Running record | view | `src/pilots/RunningRecord.tsx:12` | Works plan, readings, baselines, history | KEEP |
| Photo wall and camera | view | `src/pilots/Media.tsx:11,167` | Photos per site; live, time-lapse and look-around tabs | KEEP |
| 360 viewer | view | `src/pilots/Panorama.tsx:3` | Drag to look around one panorama | KEEP |
| Stream player | view | `src/pilots/SiteVideo.tsx:3` | Plays a site video stream | KEEP |
| Files | view | `src/pilots/EvidenceFiles.tsx:7,133` | File list and picker | KEEP |
| Money panel | view | `src/pilots/MoneyPanel.tsx:105` | Budget and pay sections | KEEP |
| Ledger editor | view | `src/pilots/LedgerEditor.tsx:254` | Ledger entry form | KEEP |
| Member finance | view | `src/pilots/MemberFinance.tsx:45` | A member's own finance section | KEEP |
| My hours | view | `src/pilots/MyHours.tsx:14` | A member's hours | KEEP |
| Funder panel | view | `src/pilots/FunderPanel.tsx:38` | Funder controls and printable tables | KEEP |
| Reports panel | view | `src/pilots/ReportsPanel.tsx:16` | Indicators and report packs | KEEP |
| Shared controls | view | `src/pilots/SharedControls.tsx:12,118,212` | Shared list, invites, member link | KEEP |
| Site visit links and trade jobs | view | `src/pilots/SiteVisitLinks.tsx:6,51` | Links to the shared plan; a jobs list | KEEP |
| Build job link | view | `src/pilots/BuildJobLink.tsx:6` | Sends a build job to a pilot | KEEP |
| Small parts | view | `src/pilots/ui.tsx:3,11` | Picture and field helpers | KEEP |

### Client routes

One React app, one router (`src/main.tsx:144-295`), every page lazy (`src/main.tsx:16-71`), two HTML shells. 43 route lines plus 10 under `/admin`. Door column: "studio" = the edge door (`middleware.ts:38-52`) asks for the studio code, or on the landing hosts the admin sign-in, before the page is sent; "open" = on the open list (`server/studioPaths.ts:13-34`).

| Route | Shows | Door (open, sign-in, studio) | Where | Verdict |
|---|---|---|---|---|
| `index.html`, `olb.html` (the two shells) | Same body, boot loader and entry `/src/main.tsx`. The head differs: icons, manifest, theme colour, title, social card, `data-brand`. The second shell is served on the brand hosts by a rewrite | n/a | `index.html:5-13,37-44`; `olb.html:2,6-25,49-56`; `middleware.ts:55`; `server/brand.ts:12-16`; `vite.config.ts:152-155` | KEEP |
| `/` | Landing hosts: a server-made landing page; inside the app a redirect to `/home`. Other hosts: the shop (product grid) | landing page open; shop studio | `src/main.tsx:150`; `server/olbSite.ts:215`; `middleware.ts:26-36` | KEEP |
| `/home` | Front page of the software with links to the five pitches (landing hosts; elsewhere a redirect to `/`) | studio | `src/main.tsx:151`; `src/pages/olb/OlbHomePage.tsx:7-13` | KEEP |
| `/designer` | The designer: plan, 3D, walk and every workspace. The address carries no design id | studio | `src/main.tsx:155`; `src/App.tsx:123-125` | KEEP, GAME; FRIENDLIER: design id in the address |
| `/demo`, `/embed/designer` | The same designer on a demo scene (`?scene=`, `?view=2d`, 3D by default). `/demo` is always price-free; the embed only with `?pitch=1`. The embed may sit in another site's frame | open | `src/main.tsx:156-157`; `src/demo/demoRoute.ts:6-13`; `src/demo/pitchEmbed.ts:17-30`; `vercel.json:41-66`; `server/studioPaths.ts:22-23` | KEEP; FRIENDLIER: embed price-free by default |
| `/pitch/developers`, `/pitch/construction`, `/pitch/eco-city`, `/pitch/merchants`, `/pitch/plumbing` | Five pitch pages (construction and eco-city share one component) | open | `src/main.tsx:158-162`; `server/studioPaths.ts:24` | KEEP |
| `/studio`, `/studio/designer`, `/studio/shop`, `/studio/merchants`, `/studio/merchants/connect`, `/studio/sales` | Studio hub; the designer in a studio frame; the shop in a studio frame; merchant intro; the catalogue wizard in preparation-only mode; a sales starter pack. Orders are off in this family | studio | `src/main.tsx:163-168`; `src/pages/studio/StudioPage.tsx:40,142,197,219`; `src/pages/studio/MerchantConnectPage.tsx:43`; `src/lib/showcaseSafety.ts:13` | KEEP |
| `/pilots`, `/pilots/:slug`, `/pilots/:slug/me` | Pilot workspace; one pilot, or a read-only visit of a shared plan with `?visit=<site>`; a member's own page | studio, except the shells `/pilots/shared` and `/pilots/shared-<uuid>[/me]`: open, and they get data only with a pilot member cookie | `src/main.tsx:16-19,152-154`; `server/studioPaths.ts:19-21`; `middleware.ts:49-51` | KEEP |
| `/products`, `/products/:id` | Shop grid with search, filters and sort; one product with photo, sizes, price and add to cart | `/products` studio; `/products/:id` open | `src/main.tsx:183-184`; `server/studioPaths.ts:27`; `src/pages/PublicProductsPage.tsx:1-12`; `src/pages/ProductDetailPage.tsx:1-8,115` | KEEP; FRIENDLIER: no price on the open page |
| `/cart`, `/checkout`, `/orders`, `/order/success`, `/order/cancelled`, `/order/pending` | The designer's cart (worked out from the open design), checkout form, orders kept on the device, payment return pages (success builds the plan PDF) | studio; checkout is also blocked in a tab that came from a demo, studio or pitch page | `src/main.tsx:170-175`; `src/pages/CartPage.tsx:1-12`; `src/pages/CheckoutPage.tsx:1-16`; `src/pages/OrdersPage.tsx:1-7`; `src/pages/OrderSuccessPage.tsx:1-12`; `src/lib/showcaseSafety.ts:13-15,54-70` | KEEP |
| `/marketplace/cart`, `/marketplace/checkout`, `/order/track/:orderRef`, `/order/gumroad-return` | The shop's own cart with a split per merchant; checkout through the active payment rail; order tracking that polls every 30 s; a return page for the interim rail | studio | `src/main.tsx:187-191`; `src/pages/MarketplaceCartPage.tsx:1-7`; `src/pages/MarketplaceCheckoutPage.tsx:1-12`; `src/pages/OrderTrackPage.tsx:1-15`; `src/pages/GumroadReturnPage.tsx:1-10` | KEEP; FRIENDLIER: one cart, not two |
| `/suppliers`, `/merchants`, `/suppliers/signup/complete`, `/merchants/onboard`, `/merchants/onboard/:slug` | Merchant application form; a thank-you page; a static page that explains the referral route | studio (the page comments call them public; they are not on the open list) | `src/main.tsx:178-180,192-193`; `src/pages/SuppliersPage.tsx:1-6`; `src/pages/MerchantOnboardingPage.tsx:1-20`; `server/studioPaths.ts:13-34` | KEEP; FRIENDLIER: decide open or gated |
| `/merchant/:slug`, `/merchant/:slug/products/new`, `/merchant/:slug/connect`, `/merchant/:slug/agent` | Merchant dashboard, add-product form, catalogue import wizard, assistant chat (see section 5) | studio, then a merchant session from an emailed link (30 days, kept on the device) | `src/main.tsx:169,194-217`; `src/components/RequireMerchantView.tsx:66-126,170`; `api/_lib/merchantSession.ts:34` | KEEP |
| `/my-designs` | Cloud saves for a typed email: list, load as a new page, save a copy, update the linked copy | studio (the API also wants the studio session) | `src/main.tsx:220`; `src/pages/MyDesignsPage.tsx:1-12,50-115`; `src/lib/cloudDesigns.ts:9-53` | KEEP, GAME; FRIENDLIER: sign in, not a typed email |
| `/admin`, `/admin/merchants`, `/admin/merchants/legacy`, `/admin/merchants/:slug`, `/admin/orders`, `/admin/payouts`, `/admin/products`, `/admin/suppliers`, `/admin/dashboard`, `/admin/audit-log` | Marketplace admin: merchant queue and detail, orders, payouts, products, suppliers, figures, audit log | studio, then Clerk sign-in and the admin list. On the landing hosts the exact address `/admin` is the server's own sign-in page instead | `src/main.tsx:224-292`; `src/pages/AdminLayout.tsx:21-59`; `src/admin/RequireAdminView.tsx:27-73`; `server/olbSite.ts:218` | KEEP |
| `*` | Redirect to `/` | as `/` | `src/main.tsx:294` | KEEP |
| `/access`, `/decks`, `/decks/<slug>/`, `/admin/sign-out` (made by the server, not React) | The door's code page; static decks and the admin sign-out on the landing hosts | `/access` and the decks open | `server/accessGate.ts:82-104`; `server/olbSite.ts:211-221` | KEEP |
| Address flags | `?view=`, `?scene=`, `?pitch=1`, `?bodies=<tool>`, `?pilotPlan=`, `?visit=`, `?session=` (merchant link), `?next=` (door), `?brand=` (previews) | n/a | `src/demo/demoRoute.ts:10-12`; `src/demo/pitchEmbed.ts:5`; `src/data/productModels.ts:51`; `src/App.tsx:124-125`; `src/main.tsx:17`; `src/components/RequireMerchantView.tsx:82`; `server/accessGate.ts:86`; `server/brand.ts:14` | KEEP |

Sign-in and doors, as the code has them:

- The door exists as edge middleware on every address except `/api/` and `/_vercel/` (`middleware.ts:10`). It guards every page and file that is not on the open list. It hands out a session cookie kept only as a hash, per environment and host (`server/studioSession.ts:1-25`). The API functions never pass through it; three route families read the same session themselves: saved designs (`api/orders.ts:1577`), hosting a live room (`api/_lib/sharedBuild/handler.ts:37`), owning a pilot (`api/_lib/pilots.ts:56-69`), all through `api/_lib/studioAccess.ts:32-52`.
- A tab that first loaded an open page reloads from the server before it shows a gated page (`src/components/StudioPageGuard.tsx:8-15`; `src/lib/studioDocument.ts:7-14`).
- The designer has no user account. A person types an email, kept on the device (`src/lib/customerIdentity.ts:1-17`). Saved designs are reached with the studio session (`src/lib/cloudDesigns.ts:11-12,41-44`).
- Clerk sign-in exists in three places: the admin area (`src/pages/AdminLayout.tsx:38`), shared spec projects (`src/components/SharedProjectConnection.tsx:23`), AI proposals (`src/components/AuthenticatedAiDraft.tsx:7,29`). A signed-in user can list, read, create and change the shared spec projects they belong to (`api/_lib/sharedSpecs.ts:76-114`) and ask for an AI proposal (`api/_lib/designAssistant.ts:226-246`). That sign-in opens no saved design.
- Merchant: an emailed link carries a token in the address, then it is kept on the device (`src/components/RequireMerchantView.tsx:76-108`).
- Pilot member: a one-use invite, then an HttpOnly cookie per pilot (`api/_lib/pilots.ts:191-207`). Live room member: a bearer string returned by host or join (`api/_lib/sharedBuild/handler.ts:203-210,213-231`).

### Server routes

12 function files (`vercel.json:6-19`; `git ls-files api` outside `_lib`, `_db`, `__tests__`): `admin-router`, `agent-chat`, `cart-quote`, `create-checkout-session`, `cron-router`, `healthcheck`, `merchants-router`, `orders`, `paypal-router`, `products`, `stripe-webhook`, `stripe-connect/webhook`. 36 API rewrites and one page fallback fold every address into them (`vercel.json:100-136`): 18 to `orders`, 7 to `merchants-router`, 4 to `paypal-router`, 3 to `products`, 2 to `agent-chat`, 1 each to `admin-router` and `cron-router`. `api/orders.ts` is the catch-all: it splits the address (`api/orders.ts:281-287`) and runs a chain of `if (resource === ...)` (`api/orders.ts:1507-1815`).

| Route family | Methods | Auth | What it does | Where | Verdict |
|---|---|---|---|---|---|
| `/api/designs`, `/api/designs/:id` | GET, POST, PUT | studio session cookie; a write sent from another site is refused | List up to 50 designs by `?email=` or `?userId=`; read one by number; create; replace. No version on the server | `api/orders.ts:1300-1424,1569-1599`; `vercel.json:127,132` | GAME; FRIENDLIER: a per-user token and a version |
| `/api/shared-projects/live/status`, `/host`, `/join`, `/sync`, `/edit`, `/leave` | GET (status), POST | status none; host studio session; join invite code; sync, edit and leave member bearer | Live shared build of one design: the whole plan on host, then edits as single fields checked against their old value, poses, players seen in the last 15 s | `api/_lib/sharedBuild/handler.ts:56-303`; `api/_lib/sharedSpecs.ts:49`; `vercel.json:130-131` | KEEP, GAME |
| `/api/shared-projects`, `/:id`, `/:id/changes`, `/:id/revisions/:n` | GET, POST | Clerk bearer; origin list | Shared spec projects: components with cost and carbon, six roles, stage reviews; saved by one database function with compare-and-set | `api/_lib/sharedSpecs.ts:44-121`; `api/_db/migrations/0032_shared_project_specs.sql:36-169` | KEEP |
| `/api/pilots`, `/api/pilots/<slug>/<action>/<key>` | GET, POST, PUT (file read to line 330 only) | studio owner session or a pilot member cookie; a role table per pilot | Private pilot records: sites, photos, files, ledger, reports, a plan snapshot members may read, trade jobs | `api/_lib/pilots.ts:155-330`; `api/_lib/pilotBuild.ts:75-118`; `vercel.json:128-129` | KEEP |
| `/api/site/search`, `/solar`, `/context`, `/terrain` | GET | none | Place search, and solar, context and terrain data for a boundary, fetched from outside providers | `api/_lib/site/handler.ts:10-41`; `vercel.json:100` | KEEP, GAME |
| `/api/pitch-enquiry` | POST | none; same-origin check; 5 per 10 minutes per address | Stores a pitch request as a lead; returns a receipt number | `api/_lib/pitchEnquiry.ts:23,41-74`; `vercel.json:103` | KEEP |
| `/api/leads` | POST | see the private review note | Stores a quote request with contact details and an optional design snapshot | `api/orders.ts:1441-1501,1601-1615`; `vercel.json:133` | KEEP |
| `/api/orders/:ref`, `/api/orders/:ref/status` | GET | the order reference | Order detail with lines and fulfilment events; a light status poll | `api/orders.ts:403-470,1543-1567`; `vercel.json:116` | KEEP |
| `/api/merchants/:slug/magic-link` | POST | none; always the same neutral answer | Emails a 30-day sign-in link when the email matches the merchant's contact | `api/orders.ts:880-949,1674-1688`; `vercel.json:119` | KEEP |
| `/api/merchants/:slug/agent-session` | GET | see the private review note | Returns the merchant's assistant session and its last 50 messages; creates a session when there is none | `api/orders.ts:671-752,1652-1666`; `vercel.json:118` | KEEP |
| `/api/merchants/:slug/order-update` | POST | signature made with the merchant's shared secret; a repeated event id is dropped for 24 h | Records a fulfilment event for one order line after a state check | `api/orders.ts:485-665,1635-1649`; `vercel.json:117` | KEEP |
| `/api/merchants/:slug/city-procurement/:id` | GET, PUT | merchant session bearer; merchant approved; contact email matches | Reads or saves one procurement plan with a revision and a request id | `api/_lib/cityProcurement.ts:15-63`; `api/orders.ts:1626-1632`; `vercel.json:120` | KEEP |
| `/api/gumroad/create-order`, `/api/gumroad/ping` | POST | none on create; the ping is checked by asking the provider for the sale | Interim payment rail: re-price, pending order, checkout address; then capture | `api/orders.ts:1698-1753`; `api/_lib/gumroad/createOrder.ts:189`; `api/_lib/gumroad/webhook.ts:443-446`; `vercel.json:134` | KEEP |
| `/api/<merchant code>/redirect` | GET | none | Logs a referral click and answers 302 to one merchant's own shop | `api/orders.ts:1066-1124,1756-1770`; `vercel.json:121` | KEEP |
| `/api/commission/reconcile` | GET | Clerk admin bearer | Referral rows as CSV, 10,000 at most | `api/orders.ts:1257-1298,1797-1811`; `vercel.json:122` | KEEP |
| `/api/cowork-os/*` (three feeds) | GET | bearer key from the environment | Owner's private figures: build and catalogue counts, one merchant's counts, a list read from a tracked JSON file | `api/orders.ts:61,102-124,173-279,1773-1794`; `vercel.json:123` | KEEP |
| `/api/products`, `/api/merchants/:slug/products`, `/api/merchants/_catalog/products` | GET | none; cached 60 s | Active products with filters (category, region, search, id, merchant, price range, eco level, stock, rating), sort, paging, optional facet counts. Carries the price. Carries no 3D model address | `api/products.ts:71-92,213-234,265-399,1048-1068`; `vercel.json:124-126` | KEEP, GAME; FRIENDLIER: add model address, gate the price |
| `/api/merchants/:slug/products` (POST); `/api/merchants/:slug/products/:id` or `/api/products?slug=&id=` (PATCH, DELETE) | POST, PATCH, DELETE | merchant session bearer for that slug | Create a product (width and depth in mm required); change eight fields; retire a product (soft delete). Each writes an audit row | `api/products.ts:475-522,554-667,690-713,731-832,850-915,933-1046` | KEEP |
| `/api/merchants/signup` | POST | none; 3 per address per 10 minutes; origin list | Merchant application | `api/merchants-router.ts:119-123`; `api/_lib/merchants/signup.ts:30,101-113`; `api/_lib/rateLimit.ts:91` | KEEP |
| `/api/merchants/:slug/products/upload-image` | POST | merchant session bearer | Mints a 60-second token so the browser sends one PNG or JPEG of up to 5 MiB straight to Blob | `api/merchants-router.ts:151-159`; `api/_lib/merchants/uploadProductImage.ts:37-44,146-153,220` | KEEP |
| `/api/merchants/:slug/capture/sign-upload` | POST | merchant session bearer | The same token pattern for phone capture photos | `api/merchants-router.ts:126-134`; `api/_lib/capture/signUpload.ts:44-50,153-158,226` | KEEP |
| `/api/merchants/:slug/capture/calibrate` | POST | see the private review note | Stores a signed scale record for a capture, and an audit row | `api/merchants-router.ts:137-145`; `api/_lib/capture/calibrateHandler.ts:305-340` | KEEP |
| `/api/capture/reference-page.pdf`, `/api/capture/reference-page-v2.pdf` | GET, HEAD | none | A printable reference page for photo capture | `api/merchants-router.ts:99-117` | KEEP |
| `/api/calc/:type` | POST | none found (grep only) | Paint calculator | `api/merchants-router.ts:165-167`; `api/_lib/calc/paintCalcHandler.ts:62-64,132-134` | KEEP |
| `/api/admin/merchants[/:slug[/approve or /reject]]`, `/orders`, `/payouts`, `/products`, `/products/import-csv`, `/suppliers`, `/stats` or `/dashboard`, `/audit-log` | GET, POST, PATCH, DELETE | Clerk admin bearer, checked in every handler | Admin lists and writes; product import by CSV with a preview mode | `api/admin-router.ts:66-121`; `api/_lib/admin/merchants/list.ts:47`; `api/_lib/admin/products/importCsv.ts:313`; `api/_lib/adminAuth.ts:71-119`; `vercel.json:108` | KEEP |
| `/api/agent-chat` | GET, POST | GET none (a health answer); POST merchant bearer that owns the session | Merchant assistant chat through an outside LLM gateway, two models with a fallback; saves turns and cost | `api/agent-chat.ts:178-201,254-407`; `api/_lib/agent/lockdown.ts:245-283` | KEEP |
| `/api/design-assistant` | GET, POST | GET none (readiness); POST `guided` and `validate` none (30 per minute per address); POST `ai` Clerk bearer plus quotas | A guided house proposal (not an LLM), a check of a supplied proposal, or an AI proposal checked by the same rules | `api/_lib/designAssistant.ts:28,97-113,185-308,311-347`; `api/agent-chat.ts:257`; `vercel.json:101` | KEEP, GAME |
| `/api/mcp` | POST | none; browser origins on a list, a request with no Origin is allowed; 60 per minute per address | MCP server, stateless JSON, ten read-only tools (section 3) | `api/_lib/designMcp.ts:27-28,383-438`; `api/_lib/designAssistant.ts:75-78`; `api/agent-chat.ts:258`; `vercel.json:102` | KEEP; a later stage adds build tools |
| `/api/cart-quote` | POST | none | In: `{cart:[{productId (number), sku, name, quantity, unitPriceMinor, currency}]}`. Out: `{ok, currency, totalMinor, merchantBreakdown:[{merchantId, supplierId, currency, itemCount, subtotalMinor, items[]}]}`. One currency per cart. It adds up the caller's own prices and looks up only which merchant owns each product. It creates nothing | `api/cart-quote.ts:36-70,72-95,97-138`; `api/_lib/cart/split.ts:13-49,63-123` | KEEP; FRIENDLIER: price on the server |
| `/api/create-checkout-session` | POST | none; origin list; idempotency key | A card checkout session after the server re-prices the cart | `api/create-checkout-session.ts:42-46,236,288,325`; `api/_lib/pricing/repriceCart.ts:1-38` | KEEP |
| `/api/createPaypalOrder`, `/api/capturePaypalOrder`, `/api/paypal-webhook`, `/api/paypal/*` | POST | none on create and capture; the webhook checks a signature | Second payment rail: create (re-priced), capture, webhook | `api/paypal-router.ts:32-55`; `api/_lib/paypal/createOrder.ts:262`; `api/_lib/paypal/webhook.ts:322`; `vercel.json:104-107` | KEEP |
| `/api/stripe-webhook`, `/api/stripe-connect/webhook` | POST | provider signature on the raw body | Payment events; merchant payout-account events | `api/stripe-webhook.ts:226`; `api/stripe-connect/webhook.ts:113` | KEEP |
| `/api/cron/escalate-orders`, `/gumroad-reconcile`, `/refresh-supplier-rating`, `/email-send-reconcile`, `/disburse-payouts`, `/generate-topdowns` | GET | cron secret as bearer or `?key=` | The first two run daily on a schedule; payouts is a dry-run scaffold; the last one answers 410 | `api/cron-router.ts:48-65,172-261`; `vercel.json:20-29,135` | KEEP |
| `/api/healthcheck` | GET | none | `{ok, service, env, commit, sentryConfigured, timestamp}`; `?studioAccess=1` adds a storage check | `api/healthcheck.ts:28-68` | KEEP, GAME |

Two behaviours that cut across every family: a preview or demo-only deployment refuses writes with 403 (`api/_lib/showcaseSafety.ts:2-4,15-21`; for example `api/orders.ts:1538-1541`). Rate limits depend on a key-value store (`api/_lib/rateLimit.ts`).

### MCP tools

Reached at `POST /api/mcp` (`vercel.json:102`; `api/agent-chat.ts:258`). JSON-RPC 2.0, one request per call, no batching, no event stream, no session (`api/_lib/designMcp.ts:169-200,398-402`). Methods: `initialize`, `ping`, `tools/list`, `resources/list` (one resource, the design contract), `resources/templates/list` (empty), `resources/read`, `tools/call` (`api/_lib/designMcp.ts:202-246`). Three protocol versions are accepted (`api/_lib/designMcp.ts:27`). Every tool is marked read-only (`api/_lib/designMcp.ts:42-47`). No tool reads or writes a saved design, an order or a customer record (`api/_lib/designMcp.ts:1-3,188`). The request needs `Content-Type: application/json` and an `Accept` header naming both `application/json` and `text/event-stream` (`api/_lib/designMcp.ts:408-419`).

| Tool | Reads or writes | Returns | Where |
|---|---|---|---|
| `get_foundation_schema` | reads nothing stored | The foundation contract with its limits and example, plus default concrete settings | `api/_lib/designMcp.ts:77-80,249-252` |
| `estimate_foundation` | reads the supplied foundation only | The normalised foundation, the concrete settings used, the estimate (volumes, optional mix and rebar), limitations | `api/_lib/designMcp.ts:81-88,253-260` |
| `estimate_materials` | reads the supplied walls, roof, settings and optional foundation | A materials report (walls, mortar, plaster, concrete, roof), the foundation takeoff, costs only for rates the caller supplied, limitations | `api/_lib/designMcp.ts:89-97,261-272` |
| `get_design_schema` | reads nothing stored | The versioned, metre-based house proposal contract with a full example | `api/_lib/designMcp.ts:98-104,273-276` |
| `search_catalog` | reads the bundled reference catalogue | `{source, products, total}`; at most 50 products per call, no offset; each product: `id, name, supplier, category, widthM, depthM, heightM, placement`; no price | `api/_lib/designMcp.ts:105-118,277-297`; `api/_lib/designAssistant.ts:35-50` |
| `generate_guided_design` | reads the supplied brief only | `{mode: 'guided', draft, warnings, next}`: a rule-made house with rooms, doors, windows, stairs, roof and garden. Not an LLM | `api/_lib/designMcp.ts:29-41,119-125,298-308` |
| `validate_design` | reads the supplied draft and the bundled catalogue | The check result: a corrected draft ready to import, or a list of errors (flagged as an error result) | `api/_lib/designMcp.ts:126-142,309-313` |
| `get_services_schema` | reads nothing stored | The service-route contract: units, fields, limits, systems, fixture defaults, example, rules | `api/_lib/designMcp.ts:52-74,143-148,314-317` |
| `search_service_materials` | reads the bundled pipe, conduit and fitting references | `{source, checkedAt, materials, fittings, total}`; no stock, no price | `api/_lib/designMcp.ts:149-158,318-330` |
| `estimate_services` | reads the supplied routes and fixtures, and optional floor ids | Per-route lengths, total length, fixture count, warnings, connection issues, assumptions; or one error and no partial figures | `api/_lib/designMcp.ts:159-167,331-357` |

### Database and storage

Neon Postgres through its HTTP driver (`api/_db/client.ts:1-51`). 26 tables in the Drizzle schema and 26 `CREATE TABLE` lines in the migrations (grep counts; kept in step by `api/__tests__/schema-mirror.test.ts:17-32`). 33 migration files: 23 forward, 8 rollbacks, a rollback template and a README; numbers 0012 to 0023 were never written (`api/_db/migrations/README.md:6-13`). Applied by `scripts/migrate.ts` with a tracking table (`scripts/migrate.ts:1-22`).

| Table or store | Holds | Where |
|---|---|---|
| `merchants` | Every applicant and approved company: slug, names, contact, country, categories, payout account id, webhook secret, status | `api/_db/schema.ts:67-100` |
| `merchant_documents` | Proof uploads per merchant: type and file address | `api/_db/schema.ts:102-116` |
| `admins` | Sign-in user ids allowed into the admin area, with a role | `api/_db/schema.ts:118-131` |
| `payout_queue` | Payouts scheduled per merchant: amount, rail, status | `api/_db/schema.ts:172-194` |
| `audit_log` | One row per admin, merchant or system action | `api/_db/schema.ts:196-212` |
| `orders` | The order ledger across payment rails: reference, buyer contact, total, rail, status, raw payload | `api/_db/schema.ts:239-258` |
| `webhook_events` | Payment events received, to drop repeats | `api/_db/schema.ts:260-276` |
| `suppliers` | Fulfilment contacts under a merchant | `api/_db/schema.ts:317-337` |
| `products` | Merchant catalogue rows: sku, name, category (free text), sizes in mm, weight, price in minor units, currency, image address, status, region, eco level, stock, rating, top-down picture fields, energy fields, one unused 3D flag. No model number column and no model address column | `api/_db/schema.ts:339-415` |
| `product_capture_scale_locks` | One signed scale record per accepted phone capture | `api/_db/schema.ts:436-457` |
| `supplier_products` | Which supplier fulfils which product, with cost and lead time | `api/_db/schema.ts:463-488` |
| `order_items` | The lines of an order per merchant, with payout status | `api/_db/schema.ts:510-539` |
| `order_item_events` | Fulfilment events per line (confirmed to failed), with tracking | `api/_db/schema.ts:557-575` |
| `agent_sessions` | Merchant assistant sessions with running cost and token counts | `api/_db/schema.ts:591-613` |
| `agent_messages` | The chat turns of a session | `api/_db/schema.ts:615-634` |
| `designs` | Saved designs: a running number, a user id or a buyer email, a name, the whole design as JSON, a cart as JSON, a status, two dates. No version column | `api/_db/schema.ts:645-662` |
| `leads` | Quote and pitch requests with contact details and an optional design snapshot | `api/_db/schema.ts:664-685` |
| `city_procurement_plans` | One merchant's procurement plan document with a revision | `api/_db/schema.ts:693-708` |
| `designer_referrals` | One row per click out to a merchant's own shop | `api/_db/schema.ts:715-740` |
| `schema_migrations` | Which migration files were applied | `api/_db/schema.ts:748-752` |
| `studio_access_records` | The door's sessions and counters, keyed by environment and host; pilot try counters share it | `api/_db/schema.ts:756-762`; `api/_db/pilotStore.ts:28-40` |
| `olb_shared_projects` | Shared spec projects (document and revision) and, in the same table, live build rooms and their players, told apart by a `kind` field in the document | `api/_db/schema.ts:766-773`; `api/_db/liveBuildStore.ts:34-35,63-69` |
| `olb_shared_spec_revisions` | One row per accepted change with the whole document; a trigger forbids update and delete. Live room edits write here too | `api/_db/schema.ts:775-788`; `api/_db/migrations/0032_shared_project_specs.sql:27-31`; `api/_db/liveBuildStore.ts:141-148` |
| `pilots` | One row per shared pilot with its owner id and revision | `api/_db/schema.ts:792-797` |
| `pilot_members` | Seats: role, invite hash, cookie hash, expiry | `api/_db/schema.ts:798-803` |
| `pilot_items` | Every pilot record as a kind plus a JSON payload under 16,000 bytes | `api/_db/schema.ts:804-807`; `api/_db/migrations/0033_pilots.sql:15-20` |
| Blob, private: live build rooms | Per room: a head pointer, the player list, one full plan snapshot per accepted edit, receipts, presence files. Used when the Blob token is set, else the Neon tables above | `api/_db/blobLiveBuildStore.ts:77-78,104-112,156-171,219-247,251-261`; `api/_lib/sharedBuild/handler.ts:73-92` |
| Blob, private: pilot photos and files | JPEG photos per pilot and site; files leave only through the function | `api/_lib/pilots.ts:70,76-92` |
| Blob, client-token uploads | Merchant product images and capture photos, under a path per merchant | `api/_lib/merchants/uploadProductImage.ts:146-153`; `api/_lib/capture/signUpload.ts:153-158` |
| Blob, public: generated plan pictures | Written by a module that no function loads any more | `api/_lib/cron/generateTopdowns.ts:178`; `api/cron-router.ts:35-42,247-257` |
| Key-value store (Redis over REST) | Rate-limit windows, LLM daily budget counters, merchant webhook repeats, idempotency keys for 24 h, email repeats and a daily send count | `api/_lib/rateLimit.ts:36-65`; `api/_lib/agent/lockdown.ts:136-165`; `api/orders.ts:602-614`; `api/_lib/idempotency.ts:1-12`; `api/_lib/email/send.ts:27-28,41-42` |
| Files in the repo used as data | The bundled catalogue, the model manifest, the static models (83 files), the product pictures (368 files) | `src/data/products.json`; `src/data/productModels.json`; `git ls-files public/models public/products` |
| Browser storage (not the server) | The email for cloud saves; the merchant session token | `src/lib/customerIdentity.ts:16`; `src/components/RequireMerchantView.tsx:26` |

### Catalogue, models and merchants

| Item | Kind | Where | What it does (one line) | Verdict |
|---|---|---|---|---|
| Bundled catalogue | JSON file, 42 products, 11 suppliers | `src/data/products.json` (counted by script) | 35 field names; 15 on every product: `id, sku, name, category, supplier, dimensions_cm{length,width,height}, weight_kg, price{value,currency}, commission_pct, shopify_ready, image_url, designer_status, delivery_regions, notes, source_url`. Optional: `topdown_image_url` (31), `front_edge` (25), `photo_image_url` (22), `eco_certified` (16), `placement` (14), energy, light and plan-symbol fields. Categories in use: fitness 14, flooring 8, solar 8, decor 5, plant 3, lighting 3, other 1 | KEEP, GAME |
| Three more bundled lists | TypeScript arrays | `src/data/products.ts:11-13,25` | Joined to the JSON to make the bundled catalogue | KEEP |
| `Product` type | Schema | `src/data/products.schema.ts:29-62,72,132-263` | 17 categories, 5 placements, sizes in cm, an optional `mesh_url` that nothing fills from the server | KEEP, GAME |
| Catalogue loader | Client code | `src/data/products.ts:36-47`; `src/data/apiCatalogAdapter.ts:194-235,317-364`; `src/data/mergeCatalog.ts:20-33`; `src/store/catalogStore.ts:17-35` | Lookup order: demo range, bundled, API cache. An API row gets the id `m-<database id>`, mm become cm, categories are mapped by hand, behaviour fields are copied from the bundled twin by SKU; API rows come first and a repeated SKU is dropped | KEEP; FRIENDLIER: one stable product id |
| `GET /api/products` | Route | `api/products.ts:71-92,1048-1068` | Fields on the wire: `id, sku, name, category, description, widthMm, depthMm, heightMm, weightG, priceMinor, currency, imageUrl, topdownImageUrl, region`, plus six energy fields when a flag is on | KEEP, GAME |
| Model manifest | JSON file, 21 entries | `src/data/productModels.json` (script); `src/data/productModels.ts:17-37,39,81-101` | Keyed by bundled product id, with the SKU as a second key. Each entry: `url`, `phoneUrl`, `modelFront`, `lengthAxis`, sometimes `modelUp`, `source`. 21 of the 42 bundled products have a body; the rest draw as a box. It is compiled into the web bundle; no route serves it | GAME; FRIENDLIER: serve it from the API |
| Candidate manifest | JSON file, 3 tools with 3 entries each | `src/data/productModelCandidates.json` (script); `src/data/productModels.ts:41-56` | Test bodies shown with `?bodies=<tool>` | KEEP |
| `public/models/` | 83 static files, 9.0 MB | `git ls-files public/models` (script) | 42 GLB at the root (21 bodies, a laptop and a phone copy each); 18 GLB of candidates in three subfolders; 13 files of one third-party pack (12 GLB and a licence text); 10 character files (5 GLB, 5 PNG). Largest file 452,800 bytes. Served as files, open without the code (`server/studioPaths.ts:26`), no cache header (`vercel.json:86-91` covers `/assets/` only) | GAME; FRIENDLIER: add a cache header |
| Size fit | Client code | `src/designer/fitToSize.ts:1-25`; `src/data/productModels.ts:8-10` | A body is scaled per axis to the product's sizes and faced by the manifest and `front_edge` when it loads. The file itself has no fixed scale | GAME (the same rule in the game) |
| Picture manifests | 3 JSON files | `src/data/catalogImageThumbnails.json` (106), `src/data/catalogModelThumbnails.json` (21), `src/data/catalogPlanDrawings.json` (33) (script) | Thumbnails, catalogue pictures made from bodies, plan drawings | KEEP |
| Product engine | Laptop command, 20 files | `scripts/product-engine/index.mjs:782-789`; `docs/product-engine/README.md:1-25` | From one product row with measured sizes and a real photo: a body from one of three outside image-to-3D tools, squared, levelled, turned, fitted to size, a laptop copy and a phone copy, a plan picture, a catalogue picture, a manifest row and a report. Commands: `audit, gate, run, views, reprocess, adopt, people, resume`. It adds no API code (`docs/product-engine/README.md:97`) | KEEP; GAME uses its output |
| Engine inputs | Rows and flags | `docs/product-engine/README.md:7,19`; `scripts/product-engine/lib/paths.mjs:22-24` | A row in the bundled catalogue, in one demo range file, or in a file of rows shaped like the merchant form (`widthMm, depthMm, heightMm, imageUrl`). Flags: `--only, --tool, --input, --dry-run, --yes, --cap, --adopt, --remake, --parallel` | KEEP |
| Engine outputs | Files | `scripts/product-engine/lib/paths.mjs:9-34`; `docs/product-engine/README.md:99-105` | Raw downloads outside git; bodies under `public/models/` or its `candidates/` folder; plan pictures; catalogue pictures; manifest rows; a run folder with a report and sheets; a spend log | KEEP |
| Engine quality gate | Code check | `scripts/product-engine/lib/gate.mjs:8-16,30-73`; `scripts/product-engine/lib/optimize.mjs:10-17` | A body passes only when all of these pass: photo usable; raw shape within 15 %; fitted box within 1 cm; base within 0.5 cm of the floor; level within 2°; pivot within 1 cm; textures load; laptop copy at most 25,000 triangles and 350 KB; phone copy at most 10,000 triangles and 150 KB, and it loads; plan picture not empty and spanning 98 %; facing. A product that fails keeps its box | KEEP |
| Engine money guard | Code check | `scripts/product-engine/index.mjs:67,261-262,629` | Nothing is sent without `--yes`; a run stops at `--cap` (default 10) | KEEP |
| Merchant sign-up | Page | `src/pages/SuppliersPage.tsx:1-6,117` | A company applies with a form at `/suppliers` or `/merchants` | KEEP |
| Merchant sign-in | Guard | `src/components/RequireMerchantView.tsx:66-126,164-192` | Types the contact email, gets a link by email; the link opens the dashboard for 30 days on that device | KEEP |
| Merchant dashboard | Page `/merchant/:slug` | `src/pages/MerchantDashboardPage.tsx:96-137,145-184,251-288,664-702` | Sees its own products (the first 100), changes a price in place, deletes a product, opens the three pages below. The "recent designs" and "commission" cards are placeholders | KEEP; FRIENDLIER: page past 100 products |
| Add product | Page `/merchant/:slug/products/new` | `src/pages/MerchantAddProductPageView.tsx:2-17`; `src/pages/productForm.ts:2-11,25-26` | One product by form: name, description, one of 8 categories, price, currency, eco level, width, depth and height in mm, four energy figures, one PNG or JPEG up to 5 MiB sent straight to Blob | KEEP |
| Connect catalogue | Page `/merchant/:slug/connect` (and `/studio/merchants/connect`, preparation only) | `src/pages/studio/MerchantConnectPage.tsx:43,50-95,101-104`; `src/lib/merchants/catalogImport.ts:4-24,62-80` | Loads or pastes JSON or CSV under 1 MB with 1 to 50 new products, validates, reviews, publishes one product per request, keeps receipts for the tab, downloads a pack, copies an embed code and the MCP address. An existing product is never overwritten. Availability and lead time stay in the download only | KEEP; FRIENDLIER: add update and a feed |
| Merchant assistant | Page `/merchant/:slug/agent` | `src/pages/MerchantAgentPage.tsx:1-15,130,169-176` | A chat that explains integration; turns and cost are saved per session | KEEP |
| Admin catalogue tools | Pages and routes | `src/main.tsx:224-292`; `api/admin-router.ts:72-110`; `api/_lib/admin/products/importCsv.ts:313` | An admin can list, create, change and delete products and suppliers, import products by CSV, approve or reject a merchant | KEEP |
| What a merchant cannot do today | Gap | `api/_db/schema.ts:339-397`; `src/lib/merchants/catalogImport.ts:4-24`; `docs/product-engine/README.md:97` | No model number, no 3D model field or upload, no change of many products at once, no feed, no stock sync | n/a (later stage) |

### Tests and CI

| Family or guard | Files | Guards | Where | Fragile because |
|---|---|---|---|---|
| The unit suite as a whole | 482 (403 under `src`, 79 under `api`); 133 marked jsdom | Everything in the rows below | `vitest.config.ts:17-37`; `git ls-files`; `git grep` | The fork pool is capped at 4 on purpose (`vitest.config.ts:20-31`) |
| `src/designer/__tests__` (plus `link` 6, `lessons` 5, `materials` 2) | 109 (plus 13) | The rule code beside it: geometry, quantities, contracts (by folder) | `git ls-files src/designer` | not opened |
| `api/__tests__` (plus `api/_lib/site/__tests__` 1) | 78 (plus 1) | Handlers, sign-in gates, payments, webhooks, email, schema, live build, shared specs, the studio session (by file name) | `git ls-files api` | four opened, the rest not |
| `src/components/__tests__` (plus `three` 32, `mobile` 3, `build` 2) | 53 (plus 37) | UI parts, 3D meshes and looks, accessibility | `git ls-files src/components` | 5 files assert source text |
| `src/lib/__tests__` (plus `capture` 8, `topdown` 4, `merchants` 2) | 42 (plus 14) | Helpers: pages, cloud saves, capture, catalogue import (by file name) | `git ls-files src/lib` | not opened |
| `src/store/__tests__` | 29 | Stores: property, history, designs, carts (by file name) | `git ls-files src/store` | not opened |
| `src/data/__tests__` | 17 | Catalogue seed, model manifests, image sources, paints (by file name) | `git ls-files src/data` | 4 read files from disk |
| `src/__tests__` | 16 | The door, the landing site, embed headers, first-picture preload, the merchant guard (by file name) | `git ls-files src/__tests__`; `src/__tests__/studioDoor.test.ts:1-53` | reads `vercel.json` |
| `src/walk`, `src/site`, `src/demo`, `src/pilots`, `src/eco`, `src/i18n`, `src/pages/*`, `src/sharedBuild`, `src/hooks`, `src/brand`, `src/admin` | 15, 15, 10, 5, 3, 2, 19, 1, 1, 1, 1 | Walk runtime and input, site plan and report, demos, pilot access and money maths, pages (by file name) | `git ls-files src` | not opened |
| Browser journeys | 65 specs and 4 helpers in `tests/e2e/`; 301 test lines | Plan drawing, placement, floors, paint, 3D, phone, shop journeys (by file name) | `playwright.config.ts:17-47`; `git ls-files tests` | Not in CI (`.github/workflows/quality-gates.yml:22`); the default target is the live site (`playwright.config.ts:17`); 12 specs name a dev-only plan bridge and 9 a 3D bridge (grep; the 16 Nov note counted more, through helpers) |
| Engine tests | 2 (plus 2 in `scripts/__tests__`) | Row shapes, shape check, gate, bill | `package.json:25` | Run by `node --test`, not in CI |
| Guard: the plan's stable lock (`26c144c`) | 0 tests | Nothing. It is a written rule only | grep of `tests`, `.github`, `tools`, `api`, `server` and every test file: no hit; 11 source files carry the note | A change to the plan engine fails no check |
| Guard: source-text pins on the plan | 3 files | That `handleDrawCommit` in the plan canvas and `setDrawMode` in the app shell contain, or no longer contain, exact calls; that the canvas binds the top-down image resolver | `src/components/__tests__/RoomDrawMode.test.ts:329-428`; `src/components/__tests__/roomCanvasRenderBind.test.ts:26-37`; `src/components/__tests__/customer-ui-fixes-2026-05-31.test.ts` (not opened) | A regex over source text: a rename, a re-order or a changed dependency array fails with a null match |
| Guard: other tests that read files | 30 files in all | Reads of source, config or data files from disk | `git grep -l readFileSync` over the test files | A moved or renamed file breaks them |
| Guard: colour truth | 1 file | No tone mapping and exposure 1 in the studio and architectural looks; fixed light strengths and colours; floor gain 0.9; paint colour, roughness, maps and geometry unchanged by a look | `src/components/three/__tests__/renderPresentation.test.ts:30-83` | Exact numbers and hex strings: any change of light or tone fails |
| Guard: schema mirror | 1 file and 1 script | Every table in the SQL migrations exists in the Drizzle schema, and the reverse | `api/__tests__/schema-mirror.test.ts:17-32`; `scripts/check-schema-mirror.ts` | A new table needs a migration and a schema entry in the same change |
| Guard: import endings | 1 file | Every relative import reachable from an API function ends in `.js` | `api/__tests__/esm-extension-guard.test.ts:1-60` | A shared module pulled in by the server without `.js` fails here, and would stop the whole function at load |
| Guard: door and file folders | 1 file | The open list, the file-only folders and the last rewrite in `vercel.json` agree | `src/__tests__/studioDoor.test.ts:11-53` | A new static folder needs three edits |
| Guard: accessibility | 2 files | Ten axe rules on shared UI parts and three pages; the admin pages with sign-in stubbed | `src/components/__tests__/a11y.test.tsx:40-65`; `src/components/__tests__/a11y-admin.test.tsx` (header only) | A lean rule set; colour contrast is left to Lighthouse |
| Guard: shared contract bytes | 1 file | Five published files and the vendored files match pinned hashes and one upstream commit | `src/designer/link/__tests__/contractHashes.test.ts:6-27` | Any edit to those files fails until the pins are updated |
| Guard: function count | 0 real tests | The test named for it asserts two `typeof`s | `api/__tests__/paintCalcDispatch.test.ts:207-219`; `api/orders.ts:95-96`; manual tool `tools/link/audit-boundaries.mjs:11,30` | A 13th function file passes CI |
| CI: quality gates | 1 workflow | Typecheck on three projects (root, `api/tsconfig.json`, middleware) and `npm test`, on PRs to `main` and pushes to `main`, Node 20 | `.github/workflows/quality-gates.yml:26-57` | The npm `typecheck` script skips the API project (`package.json:16`); a PR not based on `main` gets no run; the job name still says "590+ tests" |
| CI: Lighthouse | 1 workflow | Builds, then audits two local addresses of the build (`/demo?view=2d&pitch=1`, `/pitch/plumbing`), desktop, one run. Accessibility under 0.9 is an error; the other three scores warn | `.github/workflows/lighthouse.yml:6-28`; `.lighthouserc.json:10-23` | PRs only; a broken build and a failed audit look alike; 3D and walk are not audited |
| CI: secrets scan | 1 workflow | gitleaks over the full history with `.gitleaks.toml` | `.github/workflows/secrets-scan.yml:5-28`; `.gitleaks.toml:14-19,31-38` | The allow-list names `api/db/migrations`, a folder that does not exist |
| CI: dependency updates | 1 config | npm weekly, actions monthly, 5 open PRs at most | `.github/dependabot.yml:8-30` | n/a |
| `vitest.config.ts` | 1 | Node environment, globals, forks pool, three include patterns | `vitest.config.ts:17-37` | A test outside the patterns never runs |
| `playwright.config.ts` | 1 | One project: desktop Chromium with software GL flags; on CI 2 retries and 1 worker | `playwright.config.ts:19-47` | See "Browser journeys" |
| `tools/` | 171 files: 109 at the top (86 dated one-off scripts), `world/` 36, `lessons/` 10, `link/` 8, `trades/` 5, `demo-clean/` 2, `brand/` 1 | Measurement, screenshots, build helpers, audits | `git ls-files tools`; `tools/world/README.md:1-33`; `tools/link/audit-boundaries.mjs:1-33` | None runs in CI; two files opened |

### Formats in and out

| Format | In or out | Where | Carries | Loses |
|---|---|---|---|---|
| `Property` JSON in browser storage | both | `PS:2170-2178`; `src/store/designsStore.ts:226-229` | the whole design, grid flag, zoom; a page adds three legacy stores | nothing on a reload (list A); stays on the device |
| `Property` JSON in the server row | both | `src/lib/designsApi.ts:60-114`; `src/lib/cloudDesigns.ts:9-53`; `api/orders.ts:1300-1424` | the whole design as given, plus name, email, cart, status | on open: what list B drops; the page's legacy stores are never sent |
| Live room model | both | `src/sharedBuild/contract.ts:84-117`; `src/sharedBuild/client.ts:106-128` | the design without `activeRoomId`, `activeLevelId`; empty arrays added for `walls`, `stairs`, `terrainCuts`, `boundaryComponents` and each room's `openings` | local focus; on install, what list B drops |
| Project handover JSON | out, and in for tasks only | `src/components/ProjectWorkspace.tsx:210-235`; `D/projectHub.ts:185-214` | `snapshot`: the whole `Property`; the task register; `fingerprint`; engine versions; a review | an import reads tasks only and never replaces a design (`D/projectHub.ts:193`, `:204-214`) |
| Pilot plan snapshot | out by the owner, in for members | `src/pilots/buildRecord.ts:26-53`, `:82-113` | 17 top-level fields; only keys on an allow-list; items need `instanceId`, `productId`, `x`, `y`, `rotation` | `city`, `eco`, `engineering`, `materials`, the three paint settings; any key off the list; strings over 200 characters or shaped like an address become empty |
| Draft JSON (`DesignDraft` version 1) | both | in: `src/components/PlanImportWorkspace.tsx:167-184`, `D/aiDesignContract.ts:60-113`, `D/aiDesignProperty.ts:7-84`; out: `src/components/AiDesignWorkspace.tsx:138`, `/api/design-assistant`, `/api/mcp` | title, plot, up to 3 storeys, up to 40 rectangular rooms (top-left, width, depth), doors, doorways and windows on 4 edges, floor products by centre, stairs by centre, roof, lawn and entrance path, foundation | every other part of a design; non-rectangular rooms; wall, ceiling, surface and roof products; opening height and shape; `terrainCuts` and `boundaryComponents` are accepted and then dropped |
| DXF, ASCII | in | `D/planImportDxf.ts:14-166`; `D/planImport.ts:63-98`, `:307-487` | `LINE`, `LWPOLYLINE`, `POLYLINE` with `VERTEX`, model space, flat; layers become rooms or free walls per storey; `$INSUNITS` as a unit hint; y is negated | arcs, bulges, blocks, text, dimensions, 3D, paper space (skipped with a count); doors, windows, furniture; the drawing is moved so its min corner is (0, 0) |
| SVG | in | `D/planImportSvg.ts:133-299` | `line`, `polyline`, `polygon`, `rect`, `path` with M L H V Z; group transforms; group label or id as the layer; physical size when width, height and viewBox agree | curves, rounded rectangles, text, images, styles, scripts (refused or skipped); needs a browser XML parser (`:136`) |
| Plan view and work package (`ppw-plan-view` and `ppw-work-package`, version 1) | out to the trade app; answers come in | `D/link/planView.ts:14-36`, `:117-154`; `D/link/planGeometry.ts:25-105`; `D/link/contract/plan-view.schema.json` | chosen storeys: levels, room polygons and areas, walls (a, b, thickness, height, shared walls once), openings, service runs as 3D points, items and fixtures as centre, size, rotation; quantities, notes, hash, plan revision and fingerprint | roof, stairs, garden, plot, city, eco, foundation, paint, floors; product ids (labels only); item heights; opening kinds fold to door, window, opening; the opening offset becomes the start of the gap, not its centre (`D/link/planGeometry.ts:67-73`) |
| Order plan PDF | out | `src/lib/planPdf.ts:69-114`, `:959-981`; `src/pages/OrderSuccessPage.tsx:109`, `:271-322` | per room: polygon, item rectangles, product lines and totals, A4 vector pages | built from an order snapshot, not from the design: no openings, storeys, free walls, roof |
| Room SVG to PNG | out, unused | `src/lib/floorPlanSvg.ts:50-255` | one room: polygon, items, edge lengths, grid, scale bar | imported only by its own test (grep of `src` in this run) |
| Canvas PNG | out | `src/components/RoomCanvas.tsx:1990-2025` | a picture of the 2D stage | all data |

Not present, by grep of `src`, `api`, `server`, `tools`, `scripts` for the three.js exporter names, `web-ifc`, `IFCLoader` and `.ifc`: no glTF, OBJ, STL or IFC export or import. No button downloads a bare `Property` file; the handover file is the only download that contains one.

### Caps and limits

#### The 2D plan and the toolbar

| Cap | Value | Where | Enforced by |
|---|---|---|---|
| Plot side | 1 to 500 m | PS:245-246 | `setSite` clamp (PS:466-479); field limits TB:1589-1590 |
| Room size fields | up to 50 m; min is the larger of 0.1 m and the snap step | TB:2230-2231 | Input attributes only |
| Add-room rectangle | 1 to 50 m per side | C/AddRoomChooser.tsx:44-46 | `clampDim` |
| 3D room drag | at least 0.1 m per side | D/roomBuildGesture.ts:9, 96-98 | `previewRectRoomBuild` |
| 3D wall segment | at least 0.1 m; loop area at least 0.01 m² | D/wallBuildGesture.ts:10, 107 | Wall build preview |
| Free wall | at least 0.0001 m | D/freeWalls.ts:54, 90 | `runToFreeWalls` |
| Retyped wall length | 0.001 to 100 m | D/edgeResize.ts:23-26 | `resizeRoomEdge` (body not read) |
| Wall height, house | 2.0 to 4.0 m, default 2.7 | src/data/wallPaints.ts:170-172 | `setWallHeight` (PS:631-632); field TB:2734-2735 |
| Storey height | 2 to 8 m | D/building.ts:9-10 | `normaliseLevelHeight` (D/building.ts:53-56) |
| Masonry wall thickness | 25 to 2000 mm | C/WallDimensionsControl.tsx:19-23 | Field check; settings clamp D/materials/settings.ts:58 |
| Curved-wall thickness | 0.002 to 2 m | PS:2051 | `addWallPath` |
| Opening width and height | 0.05 to 100 m | D/openingGeometry.ts:24-26 | `validOpeningDimensions` |
| Opening top | sill plus height must not pass the wall height | D/openingGeometry.ts:30 | `validOpeningDimensions` |
| Opening on a wall | wall at least width plus 0.2 m; no overlap | D/openings.ts:78, 87-89, 133-162 | `validateOpening` |
| Stair | width 0.6 to 5 m; run 1 to 30 m | D/building.ts:150 | `normaliseBuildingStairs`; fields BC:319-320 |
| Stair clearance | 0.06 m from walls, on both floors | D/stairPlacement.ts:10, 54-73 | `validateStairPlacement` |
| Roof pitch | 5 to 60° | D/building.ts:110-111; BC:291 | `normaliseRoofConfig` |
| Roof overhang | 0 to 1.5 m | D/building.ts:112-113; BC:292 | `normaliseRoofConfig` |
| Roof thickness | 0.3 to 2000 mm | D/building.ts:107; BC:290 | `normaliseRoofConfig` |
| Roofs per design | 1 | D/levels.ts:21-28 | One fixed roof level id |
| Floor stroke | 20,000 tiles | RC:2563, 2683-2688; D/floorPaintBrush.ts:33 | Refused with a message |
| Paint coats | 1 to 3 | src/data/wallPaints.ts:192-193 | Select options TB:2769 |
| Paint extra | 0 to 25 % | src/data/wallPaints.ts:189-191 | Field limits TB:2783-2784 |
| Garden surface | sides 0.2 to 500 m; raise 0 to 2 m | D/garden.ts:93, 108-109 | `gardenRectFromPoints`, `normaliseGardenSurface` |
| Fence height | 0.3 to 3 m | GP:199 | Field limits |
| Dig depth per stroke | above 0, up to 5 m | src/walk/EarthworkTool.tsx:101-105 | Tool check |
| Dig cells with no plot | within 299 cells of the origin | src/walk/EarthworkTool.tsx:65-68 | Tool check |
| Ground cuts | 512 | D/terrainCuts.ts:10 | File not read past the constant |
| Measured path | 512 vertices; 256 segments; segment at least 5 cm | D/measuredPath.ts:17, 29; S/measuredPathToolStore.ts:75 | `sampleMeasuredPath`, `tap` |
| Service runs | 2000 runs; 2 to 500 points each | D/buildingServices.ts:139, 150-151 | `normaliseBuildingServices` |
| Foundation | 100 elements; 100 bores | D/foundation.ts:54-55 | File not read past the constants |
| Shade | 20 sails; 3 to 6 anchors each | D/shade.ts:106-108 | PS:1778, 1790 |
| Boundary components | 128 | D/boundaryModel.ts:17 | File not read past the constant |
| City | 64 roads, 128 networks, 300 assets, 64 building assets, 10 km | D/city.ts:88-96, 199-206 | City validator |
| Plan import | 2 MB, 2500 shapes, 12,000 vertices, 80 layers, 150 rooms, 1500 walls, 12 storeys | D/planImport.ts:9-17, 64-85 | `parsePlanFile` |
| Undo history | 50 steps; 10 kept for the session; changes within 250 ms merge | S/historyStore.ts:41-44 | History store |
| Zoom | 0.04 to 3; a fit may go lower | L/zoom.ts:8-9; RC:1144 | `zoomViewportAt` |
| Drawn grid | cell at least 8 px; at most 400 lines per axis per room | D/gridTier.ts:22-25 | `chooseGridTier` |
| Wall item height | 0 to storey height minus item height; step 5 cm | C/ObjectPlacementControls.tsx:32, 58 | Field clamp |
| Item hours per day | 0 to 24 | C/DetailsPanel.tsx:387-389 | Field limits |
| Outdoor relocation search | 6 m around the drop | RC:1417-1423 | `findFreeSlotNear` |
| Rooms, items, storeys, saved designs | no cap found | PS and D/levels.ts (grep for `MAX_`, `LIMIT` this run) | None found in these two files |

#### The 3D build view and the walk

| Cap | Value | Where | Enforced by |
|---|---|---|---|
| Wall height, single-storey control | 2.0 to 4.0 m, default 2.7 | `src/data/wallPaints.ts:170-172`; `D/wallHeight.ts:23-24` | `wallHeightControlTarget` |
| Storey height | 2 to 8 m | `D/building.ts:9-10, 53-56` | `normaliseLevelHeight` |
| Solid builder minimum wall height | 0.5 m | `D/roomSolids.ts:176` | `buildSolids` |
| Floor slab | 0.18 m, fixed | `D/building.ts:8`; `3/dressing.ts:122` | constant |
| Stair width; run | 0.6 to 5 m; 1 to 30 m | `D/building.ts:150` | `normaliseBuildingStairs` |
| Stair steps | 512 in 3D and Walk; 128 in the plan symbol | `3/buildingMeshes.ts:33`; `W/scene.ts:130`; `D/stairPlan.ts:28` | `stairMesh`, `createWalkWorld` |
| Stair wall clearance | 0.06 m | `D/stairPlacement.ts:10` | `stairFootprintInsideRoom` |
| Roof pitch; overhang; thickness | 5 to 60°; 0 to 1.5 m; 0.0003 to 2 m | `D/building.ts:107-113` | `normaliseRoofConfig` |
| Opening width, height, sill | 0.05 to 100 m; 0.05 to 100 m; 0 to 100 m; sill + height within the wall | `D/openingGeometry.ts:22-31` | `validOpeningDimensions` |
| Wall left at each end of an opening | 0.1 m | `D/openings.ts:78, 96-106` | `validateOpening` |
| Opening snap distance to a wall | 0.6 m | `D/openingPlacement.ts:39` | `previewOpeningPlacement` |
| Room side, 3D tool | at least 0.1 m | `D/roomBuildGesture.ts:9, 96-98` | `previewRectRoomBuild` |
| Wall length, 3D tool; stored | at least 0.1 m; at least 0.0001 m | `D/wallBuildGesture.ts:10`; `D/freeWalls.ts:54` | `previewWallBuild` |
| Wall thickness | masonry 25 to 2000 mm; glass 2 to 40 mm | `D/wallConstruction.ts:13-17` | `sanitizeWallMaterialSpec` |
| Plot side | 1 to 500 m | `src/store/propertyStore.ts:245-246` | `normaliseSite` |
| Garden surface | sides 0.2 to 500 m; height 0 to 2 m; thickness 0.001 to 5 m | `D/garden.ts:106-113` | `normaliseGardenSurface` |
| Pool | shell depth 0.2 to 10; wall and base 0.01 to 2; margin 0 to 5 m | `D/garden.ts:130-132` | `normaliseGardenPool` |
| Fence | height 0.3 to 3 m; length 0.2 to 1000 m | `D/garden.ts:155-156` | `normaliseGardenFence` |
| Terrain cells | 512 cells; depth up to 20 m; one edit up to 5 m; without a plot within ±299 cells | `D/terrainCuts.ts:10, 18-40, 47, 56`; `W/EarthworkTool.tsx:65` | `validCuts`, `editSoil` |
| Foundation | 100 elements, 100 bores; length and width 0.1 to 1000; depth 0.01 to 10; top -30 to 10 m | `D/foundation.ts:54-55, 111-116, 191-195` | `normaliseFoundation` |
| Services | 2000 runs, fixtures, junctions; 2 to 500 points per run; diameter 5 to 1000 mm; heights ±20 m | `D/buildingServices.ts:139, 146-151, 193, 235` | `normaliseBuildingServices` |
| Services 3D editor draw budget | 12,000 points or 500 fixtures per storey | `C/ServicesThreeEditor.tsx:92-96` | `overBudget` |
| Shade sails | 20 sails; 3 to 6 anchors; anchor height 0.5 to 12 m; gap 0.05 to 1 m; curve 0 to 15 % | `D/shade.ts:106-108, 131, 136` | `normaliseShade` |
| Components | 128; each 512 vertices, 1024 edges, 256 faces; 3 to 128 vertices per face | `D/boundaryModel.ts:17, 84, 179, 203-235` | `validComponents`, `detectFace` |
| Trees; green roofs | 300; 100 | `D/eco.ts:14` | `ECO_LIMITS` |
| Curved path | 512 vertices; 256 segments; 3 mm chord tolerance | `D/measuredPath.ts:16-17, 29` | `sampleMeasuredPath` |
| Floor tiles per stroke | 20,000 | `D/floorPaintBrush.ts:33` | `MAX_TILES_PER_STROKE` |
| Rotation steps | 45° or 1° | `D/rotationGesture.ts:3-4` | `rotationDetent` |
| Camera elevation; zoom | 12 to 78°; 0.18 to 3 times the fit distance | `D/roomView3d.ts:805-806`; `RV:1103` | `clampCamera`, `zoomBy` |
| Hour slider | 6 to 20, step 0.5 | `C/RoomViewControls.tsx:253-255` | range input |
| Pixel ratio; shadow map; anisotropy | 1, 1.5 or 2; 1024 or 2048; 2, 4 or 8 | `D/renderQuality.ts:35-38` | `renderQualityProfile` |
| Grass blades; fence slats | 1500 per surface, 1800 for the surround; 5000 | `3/gardenMeshes.ts:128, 181`; `3/gardenGround.ts:6` | mesh builders |
| Rooms, storeys, items | no cap found | search of `src/store/propertyStore.ts` for `MAX_` and `_LIMIT` returned only the plot and shade lines (`:246`, `:1778`) | none |
| Walk route search | 1,800 expansions on 0.45 m cells | `W/navigation.ts:6-7` | `walkingRoute` |
| Walk character load | 20 s | `W/runtime.ts:349` | `load` |

#### Pipes, cables, fixtures and trades

| Cap | Value | Where | Enforced by |
|---|---|---|---|
| Runs, fixtures, junctions per design | 2000 each | `src/designer/buildingServices.ts:139, 193, 235`; `src/designer/buildingServicesContract.ts:51, 93, 107` | load check cuts the list; schema rejects |
| Points per run | 2 to 500 | `src/designer/buildingServices.ts:149-151`; `src/components/ServicesWorkspace.tsx:443-446`; `src/designer/surfaceActions.ts:414` | load check, schema, editor |
| Plan coordinate | -10000 to 10000 m | `src/designer/buildingServices.ts:159-160, 199-200` | load check, schema |
| Height (run ends, node, fixture base, port) | -20 to 20 m | `src/designer/buildingServices.ts:147-148, 161, 205, 222` | load check, schema, input boxes |
| Diameter | 5 to 1000 mm | `src/designer/buildingServices.ts:146`; `src/components/ServicesWorkspace.tsx:1686-1687` | load check, schema, input box |
| Fixture width, depth, height | 0.005 to 5 m | `src/designer/buildingServices.ts:201-203` | load check, schema |
| Fixture turn | typed -36000 to 36000, saved 0 to 360 degrees | `src/designer/buildingServices.ts:204, 218` | load check |
| Shortest run | 0.01 m | `src/designer/buildingServices.ts:188`; `src/designer/buildingServicesContract.ts:125`; `src/store/propertyStore.ts:1821` | load check, schema, store |
| Id length | 1 to 128 chars | `src/designer/buildingServices.ts:117` | load check, schema |
| Shortest draft step | 0.01 m | `src/components/ServicesWorkspace.tsx:447-454` | editor |
| Drop-to-connect reach | 0.15 m in 3D | `src/components/ServicesWorkspace.tsx:629, 647` | editor |
| Grid snap | 0.05 m | `src/designer/serviceRouteEditing.ts:13-14` | editor |
| WS 3D budget | 12000 run nodes or 500 fixtures on a floor | `src/components/ServicesThreeEditor.tsx:92-96, 547-552` | WS 3D draws nothing and says so |
| WS plan zoom | view 0.3 to 200 m wide | `src/components/ServicesWorkspace.tsx:713, 982` | editor |
| Project summary budget | 20000 service points; 2000 runs; 2000 fixtures; 10000 objects; 2,000,000 work units | `src/designer/projectCalculationBudget.ts:16-28` | summary refuses and gives the reason |
| MCP estimate body | 131072 bytes | `api/_lib/designMcp.ts:60` | MCP tool |
| Dug cells | 512 cells; depth over 0 to 20 m; 5 m per edit; x, y whole metres within 100000 | `src/designer/terrainCuts.ts:10, 24-34, 47-48, 56` | `validCuts`, `editSoil` |
| Dig reach with no plot | 299 m from the origin | `src/walk/EarthworkTool.tsx:65` | dig tool |
| Site mains | 128 routes; 128 segments in all; 65 points per route | `src/designer/city.ts:92, 95, 97` | site load check rejects the whole site model |
| Site main sizes | diameter 1 to 5000 mm; trench width 0.05 to 20 m; trench depth 0.05 to 30 m; z -30 to 100 m | `src/designer/city.ts:269-278` | site load check |
| Distinct trench depths | 16 | `src/designer/city.ts:98, 602-606` | estimate withholds the volume |
| Site equipment | 300 | `src/designer/city.ts:93` | site load check |
| Watts typed on an item | 100000 W, whole watts | `src/store/propertyStore.ts:1953` | store |
| Hours per day | 24, to 0.1 h | `src/store/propertyStore.ts:1924`; `src/designer/energy.ts:117, 148` | store, report |
| Light pool radius | 1.2 to 3.5 m | `src/designer/lighting.ts:23-25, 71` | light rule |
| Quantity rows per package | 50; more are split into parts | `src/designer/link/packages.ts:164-171`; `src/designer/link/exchange.ts:54` | package builder, draft schema |
| Quantity value | 0.001 to 1,000,000; 3 decimals | `src/designer/link/packages.ts:78-80`; `src/designer/link/exchange.ts:33`; `src/components/build/PackageInspector.tsx:232-238` | builder, schema, form |
| Plan reference | 120 chars; fixed list of kinds | `src/designer/link/packages.ts:81`; `src/designer/link/exchange.ts:35-40` | builder, schema |
| Plan view file | 300,000 bytes | `src/designer/link/planView.ts:66` | parser |
| Work package file | 400,000 bytes | `src/designer/link/planView.ts:94` | parser |
| Plan view lists | 32 levels; 300 rooms of up to 128 points; 3000 walls; 1000 openings; 300 runs of 2 to 65 points; 600 items; 400 highlights; 50 quantities; 10 notes | `src/designer/link/contract/plan-view.schema.json:82, 97, 104, 113, 130, 148, 156, 165, 181-183` | schema |
| Job pack file | 96,000 bytes | `src/designer/link/vendor/tradefolder/lib/links/carry.ts:33`; `src/designer/link/vendor/tradefolder/lib/jobPack/protocol.ts:10, 66` | parser |
| Link | 1800 chars; token 16,000 chars | `src/designer/link/vendor/tradefolder/lib/jobPack/protocol.ts:9`; `src/designer/link/vendor/tradefolder/lib/links/carry.ts:31` | parser |
| Job pack lists | 50 quantities; 50 lines; 4 photos; 20 dates; 20 assumptions; 20 exclusions; 100 rate overrides | `src/designer/link/vendor/tradefolder/lib/jobPack/job-pack.schema.json:157, 193, 219, 355, 415, 425, 902` | schema |
| Photo | 60,000 bytes; 80,000 chars as text; source up to 12 MB and 60 megapixels | `src/designer/link/tradeJobs.ts:32`; `src/components/build/jobPhoto.ts:4, 18, 33`; `src/designer/link/planView.ts:141` | schema, encoder |
| Request life | 30 days | `src/designer/link/planView.ts:144` | builder |
| Dashboard ledger | 10,000 events; 4,000,000 bytes | `src/store/linkStore.ts:20-21, 79` | store |
| Answer upload | 96,000 bytes | `src/components/build/BuildDashboard.tsx:544` | form |
| Backup upload | 4,000,000 bytes | `src/components/build/BuildDashboard.tsx:646` | form |
| Job pin | x, y within 100,000; z within 10,000 | `src/designer/link/tradeJobs.ts:26-27` | schema |
| Draft text | title 160; scope 2000; trade 60; 32 floors; 20 dates; planned up to 1e12 | `src/designer/link/exchange.ts:22, 51-53, 59, 63` | schema |
| Shared components | 500 | `src/designer/sharedBuildAdapter.ts:347-350`; `src/designer/sharedSpecsContract.ts:58` | adapter throws; schema |
| Shared members, reviews, sources | 100; 8; 12 per component | `src/designer/sharedSpecsContract.ts:42, 58-59` | schema |
| Local pilots | 30 kept; 150 history rows each | `src/store/sharedPilotStore.ts:77, 112` | store |
| Measured components | 128; each 512 vertices, 1024 edges, 256 faces; 8192 edges and 12288 face references in all | `src/designer/boundaryModel.ts:17, 179, 206-207, 231-234` | `validComponents` |
| Foundation | 100 elements; 100 bores | `src/designer/foundation.ts:54-55` | load check |
| Material rates | 200 | `src/designer/materials/settings.ts:49`; `api/_lib/materialEstimateContract.ts:20` | load check, schema |
| Site procurement | 100 packages; 200 lines each; 1000 lines in all | `src/designer/cityProcurement.ts:21, 36, 39` | schema |
| Live build | 512 rooms; 720,000 chars; 60,000 values; depth 32; arrays of 8192; 512 changes per edit | `src/sharedBuild/contract.ts:29-35, 80, 96-97` | contract |
| Task register | 300 tasks | `src/designer/projectHub.ts:153` | schema |
| Cart quote line | product id over 0; whole quantity over 0; whole minor price of 0 or more; 3-letter currency | `api/cart-quote.ts:46-59` | route |

#### City, land, garden and eco

| Cap | Value | Where | Enforced by |
|---|---|---|---|
| City coordinates | within 10,000 m of the origin | `city.ts:89,165-172` | `normaliseCity` on the device; `CitySchema` on the server (`cityContract.ts:6,86-106`) |
| City site side | 1 to 10,000 m; origin plus side at most 10,000 | `city.ts:90,199-200,209-213` | same |
| Roads | 64 | `city.ts:91,202` | same |
| Utility runs | 128 | `city.ts:92,204` | same |
| City items | 300 | `city.ts:93,206` | same |
| Road segments, all roads together | 128 | `city.ts:94,250-251` | same |
| Utility segments, all runs together | 128 | `city.ts:95,290-291` | same |
| Buildings plus data centres | 64 | `city.ts:96,323-327` | same |
| Points per route | 2 to 65 | `city.ts:97,238-239,276-277` | same |
| Buildings linked to the house | 1 | `city.ts:322` | same |
| Building outline points, whole city | 2,048 | `city.ts:342-343` | same |
| Building form | 64 rooms; 128 points a room; 512 points in all | `cityBuildingForm.ts:11,16,18` | `validBuildingForm` |
| Road section | width 0.5 to 100 m; surface 0.001 to 2 m; base 0 to 5 m | `city.ts:234-236` | `normaliseCity` |
| Utility run | diameter 1 to 5,000 mm; trench 0.05 to 20 m wide and 0.05 to 30 m deep; diameter fits the trench; z -30 to 100 m | `city.ts:269-278` | same |
| City item | 0.05 to 1,000 m wide and long; 0.01 to 500 m high; ratings 0 to 1e9; hours 0 to 24 | `city.ts:311-319` | same |
| Shortest route segment | 0.01 m | `city.ts:246,286` | same |
| Distinct trench depths | 16; above that the volume is withheld, not refused | `city.ts:98,602-606` | `estimateCity` |
| Names and ids | 1 to 128 characters; ids unique | `city.ts:163-164,214-219` | `normaliseCity` |
| Data-centre scenario | racks 0 to 100,000; PUE 1 to 5; hours 0 to 8,784; fractions 0 to 1 | `city.ts:356-366` | same |
| Building library | 24 entries; name 80 characters | `cityLibrary.ts:19,26`; `CityWorkbench.tsx:98` | `readLibrary`, `saveBuilding` |
| Captured building | 512 outline points | `cityLibrary.ts:36` | `captureBuilding` |
| City draw snap | 0.5 m; draft points at least 0.1 m apart | `CityPlanView.tsx:165`; `CityWorkbench.tsx:185-189` | the 2D view |
| City 2D zoom | view width 5 to 22,000 m | `CityPlanView.tsx:78,132` | the 2D view |
| City 3D | pixel ratio at most 1.5; shadow map 2,048 | `CityThreeView.tsx:356,381` | the 3D view |
| Orders | 100 packages; 200 lines a package; 1,000 lines a plan | `cityProcurement.ts:21,36,39` | the plan schemas |
| Plot side | 1 to 500 m, clamped not refused | `propertyStore.ts:245-246,474-477` | `normaliseSite` |
| Map boundary | 3 to 200 corners; 500 m across at most; corners 0.01 m apart at least; area 0.1 m2 at least | `site/geometry.ts:70-76,93,108-112` | `boundaryError` |
| Map boundary extent | 0.1 degree of longitude, 0.01 degree of latitude; latitude within 85 | `site/geometry.ts:186-200` | `geographicBoundaryError` |
| Site name | 160 characters | `site/types.ts:191` | `normaliseGeoSite` |
| Terrain points | 3 to 1,000; level within 10,000 m | `site/types.ts:79,223-225`; `terrain.ts:36-37` | `normaliseGeoSite`, `surveyTIN` |
| Contours | 200 lines; 1,000 indices | `site/types.ts:236-246`; `terrain.ts:28-35` | same |
| Survey file | 250 kB | `terrain.ts:228`; `SiteWorkspace.tsx:790-793` | `parseSurvey`, the file input |
| Survey cover | the whole plot, within 0.001% | `terrain.ts:213-218` | `terrainEstimate` |
| Traverse | 3 to 200 legs; 10,000 m a leg | `site/geometry.ts:168,171`; `site/types.ts:285-291` | `traverse`, `normaliseGeoSite` |
| Setback, coverage | 0 to 1,000 m; above 0 to 100% | `site/types.ts:261-264`; `SiteWorkspace.tsx:263-271` | same |
| Public snapshot | 30,000 characters as JSON | `site/types.ts:173` | `normalisePublicSnapshot` |
| Boundary undo | 50 steps | `SiteWorkspace.tsx:129-130` | the workspace |
| Site request on the device | 12 s; 64 cached answers for 1 h | `site/providers.ts:15,26-27` | `siteRequest` |
| Site request on the server | 10 s; 8 MB; 8 waiting jobs; 128 cached answers; address 16,000 characters | `api/_lib/site/providers.ts:26,47,56,84,88`; `api/_lib/site/handler.ts:19` | `fetchBounded`, `cached` |
| Wait between provider calls | search 1.1 s; solar 1 s; surroundings 10 s; terrain 1 s | `api/_lib/site/providers.ts:139,170,228,305` | `rate` |
| Terrain tiles per request | 4, at zoom 12 | `api/_lib/site/providers.ts:307,320-321` | `terrain` |
| Place search | 3 to 160 characters; 5 results | `api/_lib/site/providers.ts:136,140,147` | `searchPlace` |
| Garden surface | 0.2 to 500 m a side; raise 0 to 2 m; thickness 0.001 to 5 m; sub-base 0 to 10 m | `garden.ts:107-113` | `normaliseGardenSurface` |
| Garden surface and fence count | none | `garden.ts:160-176` | nothing |
| Pool | basin 0.2 to 10 m deep; walls and base 0.01 to 2 m; margin 0 to 5 m; rectangle only | `garden.ts:114-116,130-132` | `normaliseGardenPool` |
| Fence | 0.3 to 3 m high; 0.2 to 1,000 m long | `garden.ts:155-156` | `normaliseGardenFence` |
| Garden draw snap | 0.1 m; smallest side 0.2 m | `garden.ts:86-95` | `gardenRectFromPoints` |
| Garden 3D detail | 1,500 tufts a patch; 1,800 lawn tufts; 5,000 fence slats | `gardenMeshes.ts:128,181`; `gardenGround.ts:6,70` | the mesh builders |
| Excavation cells | 512 | `terrainCuts.ts:10,19` | `validCuts` on the device and the server (`designSnapshotValidation.ts:51`) |
| Excavation depth | above 0 to 20 m; 5 m a stroke; 0.001 m steps | `terrainCuts.ts:33-34,47,54,56` | `validCuts`, `editSoil` |
| Excavation cell position | whole metres within 100,000; inside the plot, or within 299 m of the origin with no plot | `terrainCuts.ts:24-27`; `EarthworkTool.tsx:51-68` | `validCuts`, the tool |
| Trees, green roofs | 300; 100; one assembly a roof room | `ecoContract.ts:58-59,78-87` | `EcoSchema` on the device and the server |
| Tree sizes | height 0.1 to 100 m; crown 0.1 to 50 m; stem 1 to 5,000 mm | `ecoContract.ts:14-18` | same |
| Water study | people 0 to 10,000; tank 0 to 10,000,000 L; per-day rates 0 to 1,000 and 0 to 100 | `ecoContract.ts:47-49` | same |
| Programme file | 512,000 characters; 500 rows; 30 lanes a row | `programme.ts:14,22,36` | `parseProgramme` |
| Hours a day | 24 | `designer/energy.ts:117,148` | the item and product readers |
| Cover percent | 999 | `solarCalc.ts:133` | `coveragePct` |
| Daylight slider | 06:00 to 20:00 in half hours | `RoomViewControls.tsx:253-255` | the input |
| Shared build size | 512 rooms; 720,000 characters | `sharedBuild/contract.ts:96-97` | `sharedProperty` |

#### Server, catalogue and tests

| Cap | Value | Where | Enforced by |
|---|---|---|---|
| Function files | 12 of 12 | `vercel.json:6-19`; `api/orders.ts:95-96` | The host's plan; no CI check (see section 6) |
| Function run time | 5 to 60 s per function | `vercel.json:7-18` | The host |
| Scheduled jobs | 2 | `vercel.json:20-29` | The host |
| Designs: list size | 50 newest per email or user id | `api/orders.ts:1341` | Server query |
| Designs: save size | no cap in the code | `api/orders.ts:1349-1373` | Only the host's body limit (not in the repo) |
| Designs: columns | name 200, email 320, user id 80 characters | `api/_db/schema.ts:649-651` | Database |
| Products: page size | 24 by default, 100 at most; offset up to 100,000 | `api/products.ts:231-232` | Server |
| Products: answer cache | 60 s | `api/products.ts:1061` | Response header |
| Products: create | name 200, category 80, description 5,000, sku 2 to 80, image address 500; power up to 100,000 W, panel up to 5,000 Wp | `api/products.ts:477-519` | Server schema |
| Catalogue loader | 100 per page, 1,000 pages, offset up to 100,000 | `src/data/apiCatalogAdapter.ts:319,329,350` | Client |
| Merchant dashboard list | 100 products, no paging | `src/pages/MerchantDashboardPage.tsx:103` | Client |
| Merchant import batch | 1 to 50 products; text under 1,000,000 characters; a size up to 100,000 mm; 20 s per product request | `src/lib/merchants/catalogImport.ts:10-12,63,67`; `src/pages/studio/MerchantConnectPage.tsx:31,52,77` | Client (the server checks each product) |
| Merchant picture upload | PNG or JPEG, 5 MiB, token 60 s | `api/_lib/merchants/uploadProductImage.ts:37,41,44`; `src/pages/productForm.ts:25-26` | Token and client |
| Capture upload and scale | 5 MiB, token 60 s; scale at most 30 px per mm, error at most 8, size drift 15 % | `api/_lib/capture/signUpload.ts:45,50`; `api/_lib/capture/calibrateHandler.ts:37-39` | Server |
| Merchant session | 30 days | `api/_lib/merchantSession.ts:34` | Signed token |
| Merchant sign-up | 3 per address per 10 minutes | `api/_lib/rateLimit.ts:91` | Limiter |
| The door: tries and session length | set in code, not copied here | `server/accessGate.ts`; `server/olbSite.ts` | Edge middleware |
| Admin lists | 100 per page; audit log 200 rows; referral CSV 10,000 rows | `api/_lib/admin/orders/list.ts:61`; `api/_lib/admin/payouts/list.ts:53`; `api/_lib/admin/auditLogList.ts:28`; `api/orders.ts:1218` | Server |
| MCP | 60 per minute per address; body 128 KB; search 50 results, query 160 characters | `api/_lib/designMcp.ts:28,112-113`; `api/_lib/designAssistant.ts:25,89-90` | Limiter and server |
| MCP guided brief | plot 12 to 100 m by 14 to 100 m; 1 to 8 bedrooms; 1 to 3 storeys; wall height 2.4 to 4 m; brief 3,000 characters | `api/_lib/designMcp.ts:32-38` | Tool schema |
| MCP services | 2,000 runs, 2,000 fixtures, 2,000 junctions, 2 to 500 points per run, 2,000 floor ids | `api/_lib/designMcp.ts:60,164` | Tool schema |
| Design assistant | 30 per minute per address; provider input 30,000 bytes; 40 catalogue rows in the prompt; 6,000 tokens; 24 s | `api/_lib/designAssistant.ts:28,135,143,175-178` | Server |
| Merchant chat | 30 messages of 4,000 characters; 20 per minute per address; daily budget 5,000,000 micro-units for all and 2,000,000 per session; last 50 messages returned | `api/agent-chat.ts:42-43`; `api/_lib/agent/lockdown.ts:38,49-50`; `api/orders.ts:737` | Server and key-value store |
| Live room: players | 32 | `api/_db/liveBuildStore.ts:85`; `api/_db/blobLiveBuildStore.ts:189` | Store |
| Live room: request | 780,000 bytes | `api/_lib/sharedBuild/handler.ts:126,136` | Server |
| Live room: plan | 720,000 characters as JSON; 512 rooms | `src/sharedBuild/contract.ts:96-97` | Shared contract (server and client) |
| Live room: JSON shape | 60,000 values; depth 32; arrays of 8,192; strings of 80,000; numbers up to 1e12; keys of 150 | `src/sharedBuild/contract.ts:25,29-35` | Shared contract |
| Live room: one edit | 512 changes; path depth 30; 4 tries on the server | `src/sharedBuild/contract.ts:68,80`; `api/_lib/sharedBuild/handler.ts:256` | Shared contract and server |
| Live room: times | admission 24 h; a player shows if seen in the last 15 s; poll every 550 ms, 3,000 ms in a hidden tab, 2,500 ms after an error, 200 ms while drawing; request timeout 12 s | `api/_db/liveBuildStore.ts:41,48,105`; `api/_db/blobLiveBuildStore.ts:6,135`; `src/sharedBuild/client.ts:100,184,193,244` | Store and client |
| Live room: people | 5 listed characters, 7 trade labels; pose within 100,000 on each axis | `src/sharedBuild/contract.ts:14-23,42-45`; `api/_lib/sharedBuild/handler.ts:49` | Shared contract |
| Shared spec project | request 800,000 bytes; document 1,000,000 bytes; 500 components; 100 members; 8 stage reviews | `api/_lib/sharedSpecs.ts:14-15`; `src/designer/sharedSpecsContract.ts:58-59`; `api/_db/migrations/0032_shared_project_specs.sql:8,55-57` | Server and database |
| Pilot: seats and records | 150 members; 150 sites, 200 photos, 100 steps, 100 reading types, 150 baselines, 200 papers, 150 cameras, 1 schedule, 3,000 of any other kind | `api/_db/pilotStore.ts:340,401` | Database query |
| Pilot: sizes | record 12,500 bytes (database under 16,000); photo under 400,000 bytes and 1,600 px; file 1,000,000 bytes; uploads off (quota 0); plan snapshot 1,400,000 characters in parts of 2,700 | `api/_lib/pilots.ts:96,118,144,739`; `api/_db/migrations/0033_pilots.sql:17`; `src/pilots/evidence.ts:48`; `src/pilots/buildRecord.ts:110`; `api/_lib/pilotBuild.ts:112` | Server and database |
| Pilot: times and tries | invite 7 days; member cookie 30 days; 15 join tries and 40 photo tries per 10 minutes per address | `api/_db/pilotStore.ts:28-40,340`; `api/_lib/pilots.ts:151,205` | Server |
| Site data | 3 to 200 boundary points; search text 3 to 160 characters; address up to 16,000 characters | `api/_lib/site/providers.ts:116-117,136`; `api/_lib/site/handler.ts:19` | Server |
| Pitch request | 5 per 10 minutes per address; body 12,000 bytes; message 10 to 2,400 characters | `api/_lib/pitchEnquiry.ts:14,23,55` | Server |
| Procurement plan | 400,000 bytes | `api/_lib/cityProcurement.ts:10` | Server |
| Email | 100 sends a day; 3 attempts | `api/_lib/email/send.ts:41,43` | Server and key-value store |
| Cron batches | 200 stuck lines; 200 email repairs; 50 pending orders; 1,000 rating rows | `api/cron-router.ts:116`; `api/_lib/cron/reconcileEmailSends.ts:32`; `api/_lib/cron/reconcileGumroadPending.ts:40`; `api/_lib/cron/refreshSupplierRating.ts:25` | Server |
| City inside a design | 64 roads; 128 networks; 300 assets; 64 building assets; 65 points per route; site up to 10,000 m | `src/designer/city.ts:88-99` | Design rules |
| Design calculation budget | 300 rooms; 100 levels; 2,000 vertices; 1,000 free walls; 10,000 objects; 2,000 openings; 2,000 service runs; 2,000 fixtures; 20,000 service points | `src/designer/projectCalculationBudget.ts:16-28` | Design rules |
| Plan import | 2,000,000 bytes; 2,500 shapes; 12,000 vertices; 80 layers; 150 rooms; 1,500 walls; 12 storeys | `src/designer/planImport.ts:9-17` | Design rules |
| Plot and building | plot side 1 to 500 m; storey height up to 8 m; an edge up to 100 m; wall height for paint up to 4.0 m | `src/store/propertyStore.ts:245-246`; `src/designer/building.ts:10`; `src/designer/edgeResize.ts:26`; `src/data/wallPaints.ts:172` | Design rules |
| Other design parts | 100 foundation elements and 100 bores; 300 trees and 100 green roofs; 512 terrain cuts; 128 boundary components; 20 shade sails of 6 anchors; 512 path vertices; 20,000 floor tiles per stroke | `src/designer/foundation.ts:54-55`; `src/designer/eco.ts:14`; `src/designer/terrainCuts.ts:10`; `src/designer/boundaryModel.ts:17`; `src/designer/shade.ts:106,108`; `src/designer/measuredPath.ts:17`; `src/designer/floorPaintBrush.ts:33` | Design rules |
| Items in a design | no cap found on the server save path | `api/orders.ts:767-797` | none |
| Device memory of a design | undo 50 steps in memory and 10 in the session; 24 buildings in the device library; 400 grid lines per axis; zoom up to 3 times | `src/store/historyStore.ts:41-42`; `src/designer/cityLibrary.ts:23-27`; `src/designer/gridTier.ts:25`; `src/lib/zoom.ts:9` | Client |
| Quality tiers | 4 choices: auto, low, medium, high. Pixel ratio capped at 1, 1.5 or 2. Shadow map 1,024 on a phone or on low, else 2,048. Ambient occlusion only on high and never on a phone. Anisotropy 2, 4 or 8 | `src/designer/renderQuality.ts:2,35-38` | Client |
| Quality: what "auto" picks | low when memory is 2 GB or less, or 2 cores or fewer; else medium. On a desktop, auto tries ambient occlusion and keeps it only at 45 frames a second or more | `src/designer/renderQuality.ts:26-31`; `src/components/three/adaptiveAmbientOcclusion.ts:12`; `src/components/three/ThreeStage.tsx:838-840` | Client |
| Quality: the choice is kept | per device | `src/store/renderQualityStore.ts:5-17` | Client storage |
| Device checks | phone = width under 600 px, or a coarse pointer under 1,024 px; phone model copy = width up to 760 px and a coarse pointer; catalogue toolbar at the bottom under 1,024 px; sheets under 768 px | `src/designer/renderQuality.ts:25`; `src/data/productModels.ts:59-66`; `src/components/useCatalogDismissal.ts:12`; `src/components/ToastProvider.tsx:73`; `src/lib/useBelowMd.ts:18` | Client |
| Model budgets | laptop copy 25,000 triangles and 350 KB; phone copy 10,000 triangles and 150 KB; a character 1,500,000 bytes; walk height 1.7 m | `scripts/product-engine/lib/optimize.mjs:13,16`; `scripts/product-engine/lib/people.mjs:24`; `src/walk/types.ts:69` | Engine gate and client |
| Engine run | spend cap 10 by default; 3 requests at once | `scripts/product-engine/index.mjs:67,247` | Command |
| Test runners | 4 forks; on CI 2 retries and 1 worker for browser tests | `vitest.config.ts:28`; `playwright.config.ts:23-24` | Config |
