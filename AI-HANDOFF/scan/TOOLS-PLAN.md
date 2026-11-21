# SCAN: TOOLS-PLAN (read 20 Nov 2026 13:49 MU, code at d678c92)

Read-only scan of every tool of the 2D plan and the toolbar. Nothing in the code was changed.

- Code identity: `git diff --name-only d678c92 HEAD -- src api server` printed 0 files this run (HEAD `7e922f3`, branch `world/s00-s01-scan-rails`; the 4 changed files are all under `AI-HANDOFF/`).
- Every `path:line` below was opened or grepped in this run. Lines not opened are listed in section 6.
- Path short names: TB = `src/components/TopBar.tsx` · RC = `src/components/RoomCanvas.tsx` · RD = `src/components/RoomDrawMode.tsx` · R3 = `src/components/RoomView3D.tsx` · HW = `src/components/HouseWorkspace.tsx` · BC = `src/components/BuildingControls.tsx` · SA = `src/components/SurfaceActions.tsx` · GP = `src/components/GardenPanel.tsx` · KS = `src/lib/useKeyboardShortcuts.ts` · UI = `src/store/designerUIStore.ts` · PS = `src/store/propertyStore.ts` · APP = `src/App.tsx` · WM = `src/walk/WalkMode.tsx` · LD = `src/designer/lessons/lessonData.ts` · `C/` = `src/components/` · `D/` = `src/designer/` · `S/` = `src/store/` · `L/` = `src/lib/`.
- Window events are written as `…:name` (their brand prefix is left out; the full string is at the cited line). Storage keys are cited by line only.
- Two catalogue files are named after a life-sim game. This note calls them "the desktop dock file" (the one file in `src/components/desktop/`) and "the phone toolbar file" (in `src/components/mobile/`).

## 1. Inventory

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

## 2. Tool by mode

45 tools. In the "Today" column: "3D: no" means no handler in R3, HW or BC (read or grepped this run). In 3D the "Project tools" button also opens the plan's menu sheet (HW:151; TB:3393), so the sheet's rows stay reachable there. "Walk: hand-over" means the only route is Build from here (WM:176-180, 222-227), which leaves the walk for the 3D tool named in the list at C/three/HouseStageSlot.tsx:7-11. Walk's own tools are rows 34 and 39. The web walk has no jump, jetpack or carry (grep of `src/walk` this run).

| Tool | Today on the web (works in: Plan 2D, 3D, Walk) | FP: first person with powers | 3D build view | BLK: block-style dig and place | Best mode | Missing on the web | Needed in the game |
|---|---|---|---|---|---|---|---|
| 1 Select and move an item | Plan: drag (RC:5841-5896). 3D: drag (R3:1603). Walk: hand-over. | Look at it, hold grab, carry it at a distance, release on a clear outline. | Click and drag across the floor; it snaps flush to walls. | Pick the piece up, step to the cell, put it down. | 3D | Move inside Walk; multi-select (no selection box is wired, section 5). | Port the move law `D/itemDrop.ts`; same refusal words. |
| 2 Rotate an item | Plan: keys, handle (KS:175-208; RC:6114-6154). 3D: ring (R3:2138-2142). | While holding, scroll to turn 45°; hold the fine key for 1°. | Drag the ring round the item; keys step 45°. | Tap rotate before placing; one step per tap. | 3D | One step size: panel turns 90°, keys 45° (C/DetailsPanel.tsx:316-328). | 45° and 1° steps (D/rotationGesture.ts:3-4); re-seat against walls. |
| 3 Duplicate / copy type | Plan: D, Copy type, E (KS:209-216, 239-243; C/ObjectPlacementControls.tsx:55). 3D: Duplicate (R3:2006). | Point at an item, press copy; a twin appears in hand. | Select, press Duplicate, drag the copy away. | Pick-piece: middle-click a piece to load its type. | BLK | The eyedropper has no button (LD:285-289). | Copy type into the hand; 0.5 m offset tries (L/placementActions.ts:364-370). |
| 4 Remove | Plan: Remove tool, Delete key (RC:3665-3680; KS:224-229). 3D: Remove (HW:176). Walk: hand-over. | Aim, hold remove; the outline is hatched; release deletes. | Pick Remove, hover highlights, click deletes, Esc stops. | Hit a piece to break it out. | BLK | It never removes a whole room (D/removeBuildTarget.ts:75). | Targets: item, opening, wall, floor tile (D/removeBuildTarget.ts:11-12). |
| 5 Place a product | Plan: arm, tap; drag from dock (RC:4496-4515, 3055-3110). 3D: tap (R3:1470). Walk: hand-over. | Open the catalogue wheel, pick, aim; ghost on floor; trigger places. | Drag from the tray onto the floor; ghost; release. | Choose from the hot bar; place on the targeted cell. | 3D | The new-item law sits inside the plan component (RC:1448-1783). | Four kinds: floor, wall, surface, ceiling; wall gap 0.45 m. |
| 6 Wall-hung product | Plan and 3D: snaps to a wall within 1.5 m; height field (D/attachmentPlacement.ts:54; C/ObjectPlacementControls.tsx:58-67). | Aim at a wall; the item sticks; scroll sets its height. | Drag to a wall; it slides along; type the height. | Place on a wall face; cycle height in 5 cm steps. | FP | Drag the height on the wall; today a number field. | Mount height in cm, capped by storey height. |
| 7 Surface product | Plan and 3D: drops only onto a surface item (RC:1570-1613). | Aim at a table top; the item rests there. | Drag onto a table; it becomes its child. | Place on the top face of a piece. | FP | A loaded table cannot turn (C/ObjectPlacementControls.tsx:57). | Parent link; 0.1 m sub-grid (D/attachmentPlacement.ts:57). |
| 8 Wall pen | Plan: click or drag corners (RD:324-430). 3D: drag or tap (R3:1904). Walk: hand-over. | Point at the ground, trigger each corner; walls rise behind you. | Click corners or drag a wall; closing the loop makes a room. | Lay wall pieces along a line; a closed ring becomes a room. | 3D | Two pens with separate code (RD; R3:82). | Grid, wall magnet, 15° axis lock, close radius (section 4). |
| 9 Typed wall length | Plan: aim, type, Enter (RD:1242-1278). 3D: no. Walk: no. | While aiming a wall, type a number; the length locks. | Type in the wall strip while dragging. | Type a count; that many pieces lay in a row. | 3D | Typed length in 3D. | Length rounds to the snap step (D/drawLength.ts:108). |
| 10 Room rectangle | Plan: 5 × 4 button, L × W fields (RC:656-683; C/AddRoomChooser.tsx:48-71; TB:2225-2255). 3D: drag (R3:1905). | Mark two opposite corners on the ground; the room rises. | Drag a rectangle; the size label follows; release builds. | Stake two corners; the ring fills with wall pieces. | 3D | Drag a rectangle on the plan. | Min side 0.1 m; no overlap; inside plot (D/roomBuildGesture.ts:96-107). |
| 11 Curved wall | Plan and 3D: tap start, end, bend (S/measuredPathToolStore.ts:69-86; RC:3374; R3:2202). Walk: no. | Trigger start and end, then pull the middle sideways. | Click start and end, drag the bend handle. | Nearest use: lay short straight pieces along the curve ghost. | 3D | Saved as chords, not arcs (D/measuredPath.ts:1-2; PS:2047-2059). | Read chord walls now; true arcs with format v2. |
| 12 Pull curve | Plan and 3D: Build options, Pull curve, drag (SA:595, 160-163). Walk: no. | Grab the wall's middle with telekinesis and pull. | Right-click the wall, Pull curve, drag. | Nearest use: swap straight pieces for curved ones. | FP | Only in a right-click or long-press menu. | Refuse while an opening sits on that edge (SA:191-192). |
| 13 Measure | Plan only: M, tap a room wall, type, Apply (RC:5367-5408, 5554-5613). 3D: no. | Aim at a wall; its length floats; press edit to type. | Click a wall; its dimension label becomes a field. | Read-out only: pieces times size. | 3D | Free walls cannot be retyped; no two-point tape. | End that stays put; shared-wall rule; 0.001 to 100 m (D/edgeResize.ts:23-26). |
| 14 Door, doorway, window, wall opening | Plan: hover wall, tap (RC:3183-3312). 3D: slide, release (R3:1906). Walk: hand-over. | Point at a wall, pull the trigger, drag the door along it, release. | Pick Door, slide along a wall, click. | Break wall pieces for the gap; set the door piece in. | FP | With the tool on, a tap on a door deletes it (RC:3279-3283). | 0.1 m end margin; no overlap; swing toward the player (RC:3252-3253). |
| 15 Edit an opening | Plan and 3D: select; width, offset, height, sill, flips (C/OpeningSelectionEditor.tsx:59-69). | Look at the door, open its card, nudge with the stick. | Click the opening; a side card shows the fields. | Swap the piece for another size. | 3D | Drag handles; today number fields only. | The same four numbers and two flips. |
| 16 Stairs | 3D: tap, drag from palette, Fit in room (R3:1650-1665; BC:183-193). Plan: move, rotate by menu (SA:534-553). | Stand below, aim up; a ghost spans to the next floor; trigger. | Drag Stairs onto clear floor; rotate 90°. | Stack step pieces; auto-complete to the storey above. | FP | Placing stairs on the plan: no button in TB. | Two storeys needed; width 0.6 to 5 m, run 1 to 30 m (D/building.ts:150). |
| 17 Storeys | Plan: add, rename, remove (TB:1428-1506). 3D: pick, add a copy (BC:142-149). Walk: level picker (WM:203-206). | Jetpack to the top; Add floor raises a copy underfoot. | Floor up and down buttons; + Floor copies the storey below. | Building above the wall top starts a new storey. | 3D | Rename and remove in 3D; remove needs an empty storey (TB:471-478). | Height 2 to 8 m, slab 0.18 m (D/building.ts:8-10). |
| 18 Wall height | Plan: 0.1 m stepper (TB:2017-2023). 3D: field (BC:268-269). Walk: no. | Grab the wall top; pull up or down in 0.1 m clicks. | Drag a height handle or type. | Add or remove one course. | BLK | Two ranges: 2 to 4 m house, 2 to 8 m storey (D/wallHeight.ts:23-24). | Per-storey height; default 2.7 m. |
| 19 Wall thickness | Plan and 3D: one field, 25 to 2000 mm, whole building (C/WallDimensionsControl.tsx:18-28). | A dial on the wall tool. | A field in build settings. | Choose the piece size before laying. | BLK | Three defaults disagree: 0.10, 0.12, 0.15 m (section 5). | One thickness source per wall. |
| 20 Roof | Plan: toggle to the roof level (TB:600-616). 3D: shape, finish, pitch, overhang (BC:276-304). | Jetpack up; pick a roof type; it caps the house. | Toggle Roof; choose flat, gable or single slope; drag pitch. | Lay roof pieces across the top course. | 3D | Roof settings on the plan; one roof per design (D/levels.ts:21-22). | 3 shapes, 5 finishes, pitch 5 to 60°, overhang 0 to 1.5 m. |
| 21 Roof outline | Plan and 3D on the roof level: tap points, Close outline (RC:3375; R3:2203). | Fly the edge and drop a marker at each corner. | Click corners from above; close the loop. | Nearest use: place edge pieces round the top. | 3D | Moving points after closing. | Simple polygon; roof items must stay inside (PS:1863). |
| 22 Roof products | Plan: arming one jumps to Roof (RC:848-863, 1508-1513). 3D: tap roof (R3:1912). | Jetpack onto the roof, pick a panel from the air bar, place. | Drag a panel onto the roof; it snaps edge to edge. | Place panel pieces on roof cells. | FP | Roof editing in 3D needs WebGL (R3:1902). | Roof-only products; off the slab is refused (RC:1373). |
| 23 Floor tool | Plan: drag paints, Alt rectangle, Shift room, Ctrl erase (RC:4314-4322, 2641-2643). 3D: same (R3:1910). | Aim at the floor, hold the trigger, sweep; tiles lay under the beam. | Drag across the floor; Room fills it. | Place tiles one by one, or fill a marked area. | BLK | Rolls lay whole-room only (TB:748-755). | Tile lattice per material; 20,000 tiles per stroke. |
| 24 Fill floor with a tile product | Plan only: select a tile, Fill floor (D/FloatingCluster.tsx:180-191). 3D: no. | Hold a tile, press fill; the room floods with it. | A Fill button on the selected tile. | A fill command on the marked room. | 3D | The button in 3D. | Copies on the tile lattice. |
| 25 Wall paint | Plan: tap wall, Shift room, Ctrl erase (RC:4348-4358). 3D: click or drag along walls (R3:1908). | Spray: aim at a wall face and pull; colour wheel in the other hand. | Click walls; Room paints them all. | Paint each wall piece face. | FP | Ceilings (TB:3130). | Per wall and side; tint; coats 1 to 3. |
| 26 Wall material | Plan and 3D: pick a card, tap a wall or apply to the room (C/WallSurfaceOptions.tsx:37-51). | Switch the wall tool to material; shoot walls. | Pick a card; click walls. | Choose the piece type before laying. | BLK | Applying one removes paint and cladding (C/WallSurfaceOptions.tsx:46). | Construction kind per wall edge; glass has its own options. |
| 27 Cladding | Plan: tap wall; Wall or Room; erase (RC:3172-3181; TB:2600-2609). 3D: click wall (TB:2576). | Board tool: aim at a wall face and pull. | Click walls; Room clads all. | Clip boards onto wall pieces. | FP | A sample catalogue only (TB:2561-2565). | Product id per wall; one or two faces on free walls. |
| 28 Plot | Plan: type width, depth, Lock plot (TB:1587-1629). 3D: only in the Project tools sheet (HW:151; TB:3818-3860). | Walk the edge and drop four pegs. | Drag plot corners; type the size. | A fence line marks the plot. | 3D | A rectangle by numbers only; in 3D it hides in a menu. | Sides 1 to 500 m; everything stays inside. |
| 29 Garden surface | Plan and 3D: pick a kind, drag two corners (GP:123-125; C/GardenDrawLayer.tsx:33-71; R3:2193). | Sweep a ground beam to lay lawn or gravel. | Drag a rectangle on the ground. | Lay ground tiles cell by cell. | BLK | Ground level only (C/PlanGardenWorkspace.tsx:28). | 0.1 m snap; 0.2 to 500 m; raise 0 to 2 m (D/garden.ts:86-109). |
| 30 Garden outline | Plan and 3D: Polygon or Curved outline, tap points, close (GP:132-135). | Walk and drop points; close on the first. | Click points on the ground; close. | Nearest use: mark edge cells, then fill. | 3D | Corner handles for outline surfaces in 3D (R3:2147). | A polygon inside its bounding box. |
| 31 Paving patch | Plan and 3D: choose a slab product, + Paving patch (GP:138-147). | A slab tool lays a strip where you sweep. | Drag an area; the piece count shows live. | Lay slab pieces one by one. | BLK | Its estimate stays outside the cart (GP:207). | Piece count as rows times columns. |
| 32 Fence / boundary | Plan and 3D: + Boundary adds a 4 m line; drag or type ends (GP:103-113, 194-203). | Point, pull the trigger, drag the fence along the ground. | Drag the two ends. | Place posts cell by cell. | BLK | Drawing it by two taps. | Timber, metal, hedge; height 0.3 to 3 m. |
| 33 Pool | Plan and 3D: + Swimming pool, drag a rectangle (GP:123-125; D/garden.ts:43-57). | Mark it; watch it dig, line and fill. | Drag a rectangle; set the depth. | Dig the hole cell by cell, line it, fill it. | BLK | A rectangle only (D/garden.ts:115-116). | Three stages: excavation, shell, filled. |
| 34 Dig / fill | Walk only: tap or drag over 1 m cells (src/walk/EarthworkTool.tsx:40-143). Plan: no. 3D: no. | Aim the spade at the ground; hold to dig along a line. | Drag a trench line; set the depth. | Dig cell by cell; each hit goes deeper. | BLK | Not on plan or 3D; 1 m cells; no trench width. | Depth per stroke up to 5 m; never under a room. |
| 35 Pipe / cable run | Services workspace only: pipe tool, eight systems (C/ServicesWorkspace.tsx:176, 192-204). Plan shows and opens (RC:4960-4962). | Pull a pipe from a port and walk it to the next. | Click route points; corners snap to 90°. | Lay pipe in the dug trench, piece by piece. | BLK | Not a tool in plan, 3D or Walk. | Runs carry elevation (default −0.3 m), diameter, end connections. |
| 36 Service fixture | Services workspace only: 13 fixture kinds (D/buildingServices.ts:13-26, 97-114). | Aim at a wall; place the box there. | Drag from the list onto the floor or a wall. | Place the box on a cell. | FP | Not on the plan tool rail. | Envelope sizes and ports per system. |
| 37 Foundation | Own workspace from the Floors panel and 3D rail (TB:1503; HW:156). Internals not read. | Stand in the trench; place footings by pointing. | Click footing lines under walls. | Dig, then pour cell by cell. | BLK | Not read. | Caps 100 elements, 100 bores (D/foundation.ts:54-55). |
| 38 Shade sail | Own workspace (TB:1504); sails drag on the plan with Select (RC:5318-5321). Internals not read. | Point at each fixing; the sail stretches between. | Click three to six fixing points. | Nearest use: place posts, then link them. | FP | Not read. | 3 to 6 anchors, 20 sails (D/shade.ts:106-108). |
| 39 Components (boundary) | 3D dock and Walk: Components; right-click one to edit (C/three/BoundaryTools.tsx:22-70). Editor not read. | Aim and place; right-click to edit. | The same, from above. | Place piece by piece. | FP | Not read. | Cap 128 (D/boundaryModel.ts:17). |
| 40 Light and power switches | Plan: L key, cluster, details panel (KS:218-223; C/DetailsPanel.tsx:357-398). 3D: no. | Look at a lamp, press use. | Click the lamp; toggle on its card. | Hit the switch piece. | FP | The switch in 3D and in Walk. | Light on, power on, hours per day. |
| 41 Rename / delete a room | Plan: rooms list (C/RoomList.tsx:271, 279). 3D: no. Walk: no. | Look at the room label; hold to rename or delete. | Click the room label. | Nearest use: break all its walls. | 3D | The same in 3D. | Room name; delete with its contents. |
| 42 Clear | Plan and 3D: Clear with a confirm; Shift+X, Shift+P (C/ClearControls.tsx:25-33, 65-88; HW:146). | A menu action with a confirm. | The Clear button with a confirm. | A menu action with a confirm. | 3D | Nothing found missing. | One undo frame restores everything. |
| 43 Snap unit and object grid | Plan: picker, keys (TB:1647-1680; KS:113-152). 3D: object grid row (R3:2063); units in the Project tools sheet (TB:3867-3884). | D-pad cycles the unit; it shows at the crosshair. | Unit chips beside the tool. | A piece size selector. | BLK | A snap picker beside the 3D tools. | Six steps; object grid 0.5, 0.25, free. |
| 44 Undo / redo | Plan: buttons, keys (L/undoIntent.ts:37-59). 3D: buttons (HW:147-148). Walk: one frame per dig stroke (src/walk/EarthworkTool.tsx:33-39, 121-125). | Hold undo; the last piece pops back. | Buttons and keys. | Buttons and keys. | 3D | Top-bar Undo needs two taps on touch; the canvas one does not (TB:502-508; RC:4176). | 50 steps of whole-design snapshots. |
| 45 City and site | Own workspaces from the project row (TB:2209-2210). Internals not read. | Nearest use: walk the land to check it. | Roads and plots drawn from above. | Dig service trenches along roads. | 3D | Not read. | Caps 64 roads, 128 networks, 300 assets (D/city.ts:88-96). |

## 3. Caps and limits

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

## 4. Rules a second front must copy

Snapping

- Snap steps 0.01, 0.1, 0.25, 0.5, 1, 10 m; default 0.5 m (UI:153-160, 266). All are whole millimetres on purpose (UI:144-152).
- A grid point is rounded to the step, then to 4 decimals (D/drawLength.ts:28-33; L/geometry.ts:70-72).
- The wall magnet runs first and is never re-snapped to the grid. Radius: half the step, held between 0.05 and 0.25 m (D/roomLayout.ts:54-56; RD:222-234).
- A room closes on a click within 0.8 × step of the first point, held between 0.15 and 0.4 m, with 3 or more points (D/roomLayout.ts:67-69; RD:405-416).
- Axis lock: within 15° of horizontal or vertical the point is pulled onto the axis; Shift frees it (D/drawLength.ts:47, 62-88; RD:236-240).
- A typed length is rounded to the snap step and runs toward the pointer (D/drawLength.ts:96-115).
- Tap versus drag: wall pen 12 px (RD:142); door and paint 10 px (RC:333); remove 8 px (RC:3675); measured path 10 px (RC:4330).
- Objects have their own grid, 0.5 / 0.25 / 0.001 m, apart from the wall snap (S/objectPlacementStore.ts:12-15; RC:1472). Flooring products use the wall snap step and a tile lattice (RC:1472, 1637-1658).
- A floor item dropped within 0.45 m of a wall sits flush to the inner face (0.05 m inside the wall line) and turns to face the room (D/wallAwarePlacement.ts:43-51; RC:1659-1669).
- A wall item engages within 1.5 m of a wall; a surface item uses a 0.1 m sub-grid (D/attachmentPlacement.ts:54, 57).
- A blocked tap moves to the nearest free slot; a blocked drag drop is refused (RC:1454-1466, 1701-1707).
- Rotation: 45° steps; 1° with Shift or Alt (D/rotationGesture.ts:3-12; KS:185-189; RC:893).
- Duplicate tries +0.5 m right, down, both, then left, then up (L/placementActions.ts:364-370).
- A door snaps to the nearest wall within 0.6 m (RC:315). Its centre stays 0.1 m plus half its width from each end (D/openings.ts:78, 96-106). It swings toward the side the pointer is on (RC:3243-3253).
- Paint and cladding hit the nearest wall within 0.6 m (RC:317, 3133-3151).
- Garden draw and move snap to 0.1 m (D/garden.ts:86-88; C/GardenLayer.tsx:40, 85).
- Stairs placed in 3D are rounded to 0.1 m (R3:1659).
- Dig cells are whole metres (src/walk/EarthworkTool.tsx:45-47).
- Service routes: snap on and 90° corners by default (C/ServicesWorkspace.tsx:203-204).

Grid

- World unit is the metre; 100 px per metre at zoom 1 (PS:811). Grid lines are anchored at world zero, not at the room corner (RC:6441-6449, 6467).
- Drawn grid steps 0.01, 0.1, 0.25, 0.5, 1, 10 m; major lines every 0.05, 0.5, 1, 1, 5, 50 m (D/gridTier.ts:28, 39-46).

Default sizes

- Room: 5 × 4 m (PS:393; RC:668-670; C/AddRoomChooser.tsx:38-39).
- Wall height 2.7 m (src/data/wallPaints.ts:170). Floor slab 0.18 m (D/building.ts:8).
- Wall thickness: 0.10 m for free walls and the placement inset (D/wallAwarePlacement.ts:50; D/freeWalls.ts:82); 0.12 m for curved-wall paths (PS:2047; S/measuredPathToolStore.ts:52); 0.15 m in the masonry settings (D/materials/settings.ts:9).
- Door: width 0.838 m from the list 0.686, 0.762, 0.838, 0.914, 1.219 (D/openings.ts:68-69); height 2.04 m (src/data/wallPaints.ts:175).
- Window: width 1.2 m (D/openings.ts:70); height 1.2 m; sill 0.9 m (src/data/wallPaints.ts:176; D/openingGeometry.ts:9, 13); 3D width list 0.6 to 2.4 m (HW:190).
- Wall opening: height 1 m, sill 0 (D/openingGeometry.ts:9, 13).
- Stair: width 1 m; run is the larger of 3 m and 1.2 × rise; rotation 0 (R3:1657-1660; SA:221-229; BC:186-189). Steps = rise divided by 0.18 m, rounded up (D/building.ts:123-125).
- Roof: flat, felt, pitch 25°, overhang 0.2 m (D/building.ts:39-41).
- Garden: surface 4 × 4 m, path 1.2 m wide, planting bed 2 m deep (GP:95-96); fence 4 m long and 1.2 m high (GP:104-107); pool shell 1.5 m deep (D/garden.ts:54-57).
- Plot fields start at 20 × 15 m (TB:455-456).
- Dig depth per stroke 0.25 m (src/walk/EarthworkTool.tsx:25). Service run elevation −0.3 m (C/ServicesWorkspace.tsx:196-197).
- A wall item with no height of its own previews at 120 cm (RC:2111).
- Walk 1.45 m/s; run 3.4 m/s (src/walk/runtime.ts:31-32).

Minimum sizes

- Room: 3 points (RC:2237-2245). Wall: 2 points (RC:2342-2345; RD:680-698).
- 3D rectangle room: 0.1 m per side (D/roomBuildGesture.ts:9). Measured segment: 5 cm (S/measuredPathToolStore.ts:75).

Refusals

- Rooms on one storey cannot overlap; shared walls are allowed (RC:2253-2273).
- Rooms, walls and items stay inside the plot (RC:2256-2262, 2347-2352, 1374).
- Nothing off the roof slab; roof products only on the roof (RC:1373, 1508-1513).
- The roof level takes no walls, doors or paint (TB:594-598; APP:238-244).
- Leaving the pen keeps 2 or more points as open walls; only Discard throws them away (APP:253-269; RD:618-636).
- A stair must fit inside a room on both floors (D/stairPlacement.ts:54-67).

## 5. Traps

1. Tool state lives in three places: the plan union (UI:47-55), `drawMode` in the app shell (APP:216) and the 3D view's own state (R3:580). Walk has none. One registry must come before "every tool in every mode".
2. The law for placing a NEW item lives inside the plan component (RC:1448-1783; ghost RC:2041-2214). 3D borrows it through functions the hidden plan registers (S/placementIntentStore.ts:86-94; APP:451). Only moves have a pure twin (D/itemDrop.ts:1-15).
3. Three default wall thicknesses: 0.10, 0.12 and 0.15 m (section 4, default sizes).
4. The rotate step changes by control: keys and handles 45° (D/rotationGesture.ts:3); the details panel turns 90° and names the R key (C/DetailsPanel.tsx:316-328).
5. One key, two jobs: H is Select, and hinge flip in the door tool (KS:93-97, 232-236); plus and minus zoom, and step the snap unit while drawing (KS:146-147; RC:913-929); D duplicates, and pans when nothing is selected (RC:948-955); E is the eyedropper on the plan and the door key in Walk (KS:239-243; src/walk/runtime.ts:415).
6. With the door tool on, a tap on an existing opening deletes it (RC:3279-3283); with Select the same tap opens its editor (RC:5513-5517).
7. Curved walls are saved as straight chords within 3 mm, not as arcs (D/measuredPath.ts:1-2, 16; PS:2047-2059).
8. The old wall tool is still mounted but nothing arms it (RC:3396, 5533-5539; D/WallDrawMode.tsx:191, 222, 272; L/undoIntent.ts:49). No selection box or copy-paste is wired either: `D/useMultiSelect.ts` is imported nowhere in `src` (grep this run).
9. The designer has no print or PDF button: the plan PDF is built only after an order (L/planPdf.ts:959; src/pages/OrderSuccessPage.tsx:109-123). The plan offers a PNG only (RC:1987-2029).
10. A life-sim game's name appears about 467 times in 146 files under `src/` (grep this run), in two component file names, test ids, CSS variables and comments. `AI-HANDOFF/PLAN.md` frame rule 3 forbids it in code.

## 6. Not read

- TB: lines 2948-3099 (paint colour list and colour chart) and 3590-3711 (phone paint rows): known from the test-id grep only.
- RC: lines 2980-3039, 3698-4095 (bodies of the phone tool cards), 4535-5011, 5068-5149, 5413-5483, 5712-5835, 5913-6099, 6177-6439. Handlers in them were found by grep, not read line by line.
- RD: lines 750-1099 (drawing of the pen layer and the typed-length logic).
- R3: lines 143-1640 except the lines cited; the 3D pointer handlers were found by grep only.
- `src/components/RoomViewControls.tsx`: test ids by grep only.
- `src/components/DetailsPanel.tsx` (outside 300-409), `RoomList.tsx`, `PageTabs.tsx`, `CartStrip.tsx`, `AiDesignWorkspace.tsx`, `MaterialsPanel.tsx`, `EnergyPanel.tsx`, `LocaleThemeControls.tsx`, `HouseBuildTutorial.tsx`, the desktop dock file and the phone toolbar file: grep only.
- Workspaces opened from the toolbar, internals not read: services (beyond lines 150-339), foundation, shade, city, site, project, shared project, plan import (beyond lines 1-80), AI design.
- `src/components/three/BoundaryEditor.tsx`, `src/walk/runtime.ts` (beyond the key and speed lines), `src/walk/WalkerPlacement.tsx`.
- Lessons screens: `LessonsLayer.tsx`, `LessonCard.tsx`, `LessonsList.tsx`, `QuestHost.tsx`, `ToolTips.tsx`, `LoadingTips.tsx`, `SoundToggle.tsx`, `BuildFeedback.tsx`, `lessonsStore.ts`, `src/i18n/lessonMessages.ts`, `src/i18n/messages.ts` (beyond the language list).
- Stores read by reference only: `openingSelectionStore`, `drawProgressStore`, `dragPointerStore`, `disciplineVisibilityStore`, `designsStore`, `wallStore`; `src/lib/pages.ts`, `useAutoSave.ts`, `cloudDesigns.ts`, `designsApi.ts` (function list by grep).
- `src/designer/edgeResize.ts`, `wallBuildGesture.ts` (after line 110), `terrainCuts.ts`, `foundation.ts`, `shade.ts`, `boundaryModel.ts`, `floorPaintBrush.ts`, `wallPaintBrush.ts`, `claddingBrush.ts`: constants only.
- Everything under `api/`, `server/` and `tests/`: outside this scan.
- The earlier read of 16 Nov 2026 was used as a map. Of its claims, only those re-cited above with a line were checked this run.
