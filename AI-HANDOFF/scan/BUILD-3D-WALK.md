# SCAN: BUILD-3D-WALK (read 20 Nov 2026, 13:42 to 13:55 MU, code at d678c92)

Read-only. Nothing was built, run or tested: every number is read from a file or counted on disk in this run.
Proof of the code state: on branch `world/s00-s01-scan-rails`, `git diff --stat d678c92 HEAD -- src public` printed nothing.
Earlier notes of 16 Nov 2026 (kept outside this repo) were read first; their cited lines were re-read where used here. One gap in them: they list roof styles as flat or gable; the code also has shed (`src/designer/building.ts:29`).

Short paths used below:

```
TS  = src/components/three/ThreeStage.tsx      (2,399 lines)
RV  = src/components/RoomView3D.tsx            (2,231 lines)
3/  = src/components/three/
C/  = src/components/
D/  = src/designer/
W/  = src/walk/
```

`TS:397` means line 397 of that file at this commit.

## 1. Inventory

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

## 2. Tool by mode

`2D yes*` = the Plan side exists by reference but was not read in this scan. `Walk B` = only through Build from here, with the walker parked (`W/WalkMode.tsx:176-180`).

| Tool | Today on the web (works in: Plan 2D, 3D, Walk) | FP: first person with powers | 3D build view | BLK: block-style dig and place | Best mode | Missing on the web | Needed in the game |
|---|---|---|---|---|---|---|---|
| Place a product | 2D yes*; 3D arm then tap floor, or drag from catalogue (`RV:1466-1473`); Walk B | Pick from a wheel; ghost floats at the aim point; trigger sets; scroll turns 45° | Click a catalogue card, drag the ghost on the floor, click to drop; Shift keeps placing | One click puts it on the aimed 0.5 m cell | 3D | Placing while walking; rules live in the plan component | Placement rules in C++; catalogue table; ghost with tick or cross |
| Move a product | 2D yes*; 3D drag on the floor, drop uses plan rules (`RV:1395-1421`); Walk B | Telekinesis: hold to lift, carry at a distance, release on the snap spot | Drag across the floor; walls snap it flush; Shift keeps its facing | Break it, then place it on another cell | FP | Lifting over walls; carrying between storeys | Carry state, drop check, snap preview, storey-to-storey carry |
| Turn a product | 2D yes*; 3D ring 45° or 1°, two-finger twist, buttons (`3/ItemRotationRing.tsx:16-61`) | While carrying: scroll turns 45°; hold a modifier for 1° | Drag the ring; arrow keys step | Rotate key before placing, 90° steps | 3D | Turning wall items; tilt and roll do not exist | Yaw only, as in the JSON; same centre-fit check |
| Copy a product | 3D Duplicate and Copy type buttons (`RV:2006`; `C/ObjectPlacementControls.tsx:55`) | Aim at an item, copy key; a twin floats in hand | Alt-drag an item to clone it | Pick key copies the aimed item | 3D | Copying several at once | Clone keeps product id and rotation; new instance id |
| Remove a product | 3D Remove button, hammer tap, Delete key (`RV:2011-2012`) | Aim and hold remove; the item fades out | Select and press Delete, or hammer click | Break it with the dig tool | BLK | A visible Undo button after removal | One undo step per removal |
| Wall-item height | 3D number field, 5 cm steps (`C/ObjectPlacementControls.tsx:58-67`) | Slide the item up or down the wall with telekinesis | Drag a vertical handle on the item | Place on the aimed wall cell | FP | A drag handle; only a number field today | `mountHeightCm` on the instance |
| Draw a room | 2D yes*; 3D drag corner to corner (`RV:1546-1558`); Walk B | Mark two corners on the ground with the pointer beam | Drag a rectangle on the floor grid | Lay wall blocks in a loop; a closed loop becomes a room | 3D | Non-rectangle rooms and room resize in 3D | Polygon room from any closed loop, clockwise winding |
| Draw walls | 2D yes*; 3D drag or tap corners, Enter ends the run (`RV:1504-1528`); Walk B | Shoot corner points along the ground; the wall rises between them | Click corners; close the loop for a room | Build the wall up block by block along a line | BLK | Height per wall; openings in free walls | Free walls as a, b, thickness; auto room on closure |
| Curve a wall | 3D taps: start, end, bend point; or Pull curve in the menu (`C/MeasuredPathOptions.tsx:29-36`) | Grab the middle of the wall and pull | Drag a mid-edge handle | Place short straight pieces | 3D | A direct drag handle | Curves saved as chords, 3 mm tolerance |
| Remove a wall | 3D hammer tap on a wall; the room floor stays (`D/removeBuildTarget.ts:78-86`) | Aim, hold remove; the wall sinks | Hammer click on the wall | Break the wall blocks | BLK | Removing only part of a wall by drag | `removedWallEdges` on the room; free wall deleted |
| Door | 2D yes*; 3D slide along a wall, release; F flips side, H swaps hinge (`RV:1492-1498, 1810-1815`); Walk B | Aim at a wall; the door ghost slides along it; trigger sets | Drag a door from the palette onto a wall | Punch a two-high gap and frame it | 3D | Doors on free walls; saved open state; 3D draws doors closed | Hole in the wall mesh; hinged leaf from the two flips |
| Window | 3D same gesture as the door (`RV:1089-1099`) | Aim, slide the ghost, trigger; scroll changes width | Drag onto a wall; drag its edges to size | Punch a gap above sill height; glass fills it | 3D | Size and sill by drag; number fields today | Sill, height, width, shape from the record |
| Edit an opening | 3D tap an opening: width, distance, height, sill, flips; Delete removes (`C/OpeningSelectionEditor.tsx:56-70`) | Grab the door and slide it along its wall | Select; drag along the wall; handles to size | Break and place again | 3D | Dragging a placed opening along its wall | Clamp 0.1 m from wall ends; no overlap |
| Stairs | 3D tap floor, drag from palette, or Fit in room; menu Move, Rotate 90° (`RV:1650-1665`; `C/SurfaceActions.tsx:534-552`) | Aim at the floor; ghost shows both landings; trigger sets | Drag the stair onto the floor; R rotates | Stack steps by hand, or drop a stair kit | 3D | Turns, landings, spirals: one straight kind only | Mesh from rise, run, width; hole in the upper slab |
| Storeys and wall height | 3D floor picker, Add floor; height 2 to 8 m (`C/HouseWorkspace.tsx:116-127`; `C/BuildingControls.tsx:265-274`) | Jetpack up; add a floor at the wall tops | Floor up and down buttons; drag a wall top | Building past the wall top starts a storey | 3D | Dragging wall tops; split levels | Elevation = heights plus 0.18 m slabs |
| Roof shape | 3D Roof button; shape, finish, thickness, pitch, overhang (`C/BuildingControls.tsx:276-293`) | Stand on the roof and pull the ridge up | Pick a shape tile; drag a pitch handle | Lay roof blocks in stepped rows | 3D | One roof setting for every room; ridge direction is automatic | Roof mesh per roof room from the same formula |
| Roof outline | 3D Draw roof outline: tap points, Close outline (`RV:2203`; `C/MeasuredPathOptions.tsx:36`) | Walk the roof edge dropping corner markers | Click corners on the roof plane | Edge blocks define the outline | 3D | Editing an outline after it is closed | One outline polygon replaces the per-room roofs |
| Solar panel on the roof | 3D arm a panel; roof appears; tap the roof; panel tilts (`RV:655-663, 863-867`) | Jetpack to the roof, carry the panel, set it on the slope | Click the roof; panels snap to an array grid | Place panel pieces on roof cells | FP | Panels lie flat when the roof is hidden | Mount 0.06 m above the roof, tilted to the slope |
| Wall paint | 2D yes*; 3D click a wall, drag a run, Shift room, Ctrl erase (`RV:1198-1208, 1384-1394`); Walk B | Spray: aim, hold trigger, sweep across walls | Roller cursor, click walls; Shift fills the room | Paint the aimed wall face | FP | Painting part of a wall | Colour and finish per edge and per side |
| Wall material and cladding | 3D brush in material mode: four kinds (`D/wallPaintBrush.ts:66-78`) | Spray with a material cartridge | Material palette, then click a wall | Choose the block type before building | BLK | Easy to miss: it sits inside the paint panel | Thickness follows the material; glass is see-through |
| Floor finish | 2D yes*; 3D drag tiles, Alt rectangle, Shift room, Ctrl erase (`RV:1209-1240`); Walk B | Spray the floor ahead as you walk | Drag a rectangle of tiles | Place floor tiles one cell at a time | BLK | 3D shows one material per room, not each tile | Tile runs drawn tile by tile |
| Garden surface | 2D yes*; 3D pick a kind, drag two corners; tap to move; corner handle (`RV:1529-1545, 1108-1117`); Walk B | Paint the ground with a brush while walking | Drag rectangles on the land | Swap the top ground block: grass, soil, gravel, paving | BLK | Free painting; only rectangles or drawn outlines | Surface polygons with a height of 0 to 2 m |
| Pool | 3D garden kind pool with stages: pit, shell, filled (`D/garden.ts:43-57`) | Dig the pit, then set the shell | Drag a rectangle and set the depth | Dig the hole, line it, fill it | BLK | Digging cells does not make a pool | Pit, shell and water from the pool record |
| Fence or hedge | 3D panel adds a 4 m run; tap the ground to move it (`C/GardenPanel.tsx:103-108`; `RV:1629-1632`) | Plant post points along the ground with the beam | Click start and end on the land | Place posts cell by cell | BLK | Drawing a fence by its two ends in 3D | Posts every 2 m, rails, slats from a, b, height |
| Dig and fill | Walk only: tap or drag across 1 m cells; 0.25 m per stroke by default (`W/EarthworkTool.tsx:24-26, 150-189`) | Aim at the ground and hold dig, or hold fill | Brush over cells with a depth slider | Break or place one earth cell | BLK | Digging in Plan and in the 3D view; slopes; cells under 1 m | Voxel layer mapped to cells x, y, topM, depthM |
| Foundation | Own workspace from the rail; drawn in 3D; Below ground view (`C/HouseWorkspace.tsx:156-158`) | X-ray below ground; drag footing ghosts | Draw rectangles under walls | Dig a trench and pour concrete into it | BLK | Editing inside the 3D view; turned footings | Boxes by centre, length, width, depth, top height |
| Pipe or cable run | Services workspace with its own 3D editor; shown in the house view (`C/ServicesThreeEditor.tsx:84-96`; `TS:1534-1544`) | Aim node to node; the run hugs walls and floor | Click points; set height in a side field | Dig a trench, lay pieces along it, cover it | BLK | Laying runs in the main 3D view; no link to dug cells | Polyline with a centre-line height per node |
| Service fixture | Services workspace; tapping a fixture in 3D opens it (`RV:1697-1701`) | Carry the fixture like a product | Drag from a fixtures tray | Place the fixture on a cell | 3D | The move and turn gestures products have | Body fitted to its box at centre, rotation, base height |
| Shade sail | Own workspace (not read); drawn in 3D (`3/shadeMeshes.ts:9-16`) | Plant posts, then stretch the sail between them | Click 3 to 6 anchor points; drag heights | Place posts; the sail spans them | FP | Editing inside the 3D view | Saddle surface between anchors; posts lean 7° |
| Components | 3D and Walk: tap points on a work plane; snaps within 0.18 m (`3/BoundaryEditor.tsx:136-162`) | Draw edges in the air with the beam | Click vertices on a chosen plane | Place single blocks anywhere | 3D | Plain words; it asks for planes and XYZ | Vertex, edge and face lists as a static mesh |
| Trees | Drawn in 3D; edited elsewhere (not read) (`3/ecoTrees.ts:7-43`) | Plant a sapling where you aim | Click to plant; drag the crown to size | Place a tree piece | FP | Planting from the 3D view | Trunk and crowns from height and canopy radius |
| Lamp on or off | Action exists (`src/lib/placementActions.ts:214-227`); its button was not found in the 3D card | Walk up and press use on the lamp | Click the lamp, switch in its card | Use key on the lamp | FP | A switch in the 3D selection card | Point light at the mount height; `lightOn` flag |
| Remove tool (hammer) | 3D hover shows a red copy; tap removes; Esc ends (`RV:1140-1143, 1461-1465`) | Hold remove on the aimed part | Hammer cursor, click a part | Break tool, the native verb | BLK | A cue other than red | One verb for all parts, rules per kind |
| Build menu on a part | 3D right-click or 540 ms long-press (`C/SurfaceActions.tsx:253-262, 314-320`) | Radial menu on the aimed part | Right-click menu | Use key on a block | 3D | Picture buttons; text rows today | Same target kinds: stair, run, fixture, garden, roof, earth |
| Pin a job on the model | 3D overlay in pick mode: tap a wall, room, item or run (`C/build/TradeProgressOverlay.tsx:84-91`) | Aim and tag a part | Click a part to tag it | Tag a block | 3D | Not a design edit; listed for completeness | Pin = storey, part reference, x, y, z |

## 3. Caps and limits

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

## 4. From JSON to solid: the geometry rules

All numbers are metres unless a unit is written. Angles are degrees unless written as radians.

### A. Frame and units

1. Plan frame: x east, y south (the page is y-down), z up. `D/roomSolids.ts:15-16`; `D/roomView3d.ts:13-14`.
2. Web mapping: plan (x, y, z) goes to three (x, z, y); three +y is up and three +z is plan south. `TS:397`; `TS:24-26`.
3. Rotations are clockwise on the y-down page (east turns toward south). Three applies yaw = -rotation about +y. `D/fitToSize.ts:20-22, 215-217`; `D/building.ts:21`.
4. For Unreal (my derivation, not in the code): the plan frame is left-handed and z-up like the engine, so X = 100 x, Y = 100 y, Z = 100 z in centimetres, no mirror, Yaw = +rotation. Check it with the code's own case: a 200 x 90 cm item at 90° must occupy 0.9 x 2.0 m (`D/fitToSize.ts:22`).
5. Units in the JSON: metres for geometry; centimetres for catalogue `dimensions_cm` and `mountHeightCm`; millimetres for `thicknessMm`, `diameterMm`, `stemDiameterMm`; degrees for `rotation` and `pitchDeg`. `src/lib/geometry.ts:45-47`; `src/store/propertyStore.ts:206-207`; `D/wallConstruction.ts:10`; `D/buildingServices.ts:52`; `3/ecoTrees.ts:23`.
6. Room polygons are stored clockwise on the y-down page (positive shoelace area), with no repeated last vertex. The loader drops duplicate vertices (1e-6) and reverses counter-clockwise rooms, remapping openings: edgeIndex' = n - 1 - edgeIndex, offset' = edge length - offset, both flips toggled. `D/openings.ts:181-202, 252-346`.
7. Edge i runs vertex[i] to vertex[i+1], the last closing to the first. Edges of 0.001 m or less are skipped. `removedWallEdges` lists edge indexes that have no wall. `D/wallEdges.ts:47, 72-96`.
8. Inward normal of edge a to b = (-dy, dx) / length. `D/roomSolids.ts:160-165`.
9. Pipeline: JSON, then one scene input per storey (`RV:305-413`), then solids per storey (`D/roomSolids.ts:175-303`), then the storey stack (`D/buildingScene.ts:12-96`), then meshes (`TS:1331-1470`). The solids hold no camera.

### B. Storeys

10. `levels` absent or empty = one ground storey, id `ground`, index 0. A room or free wall with no `levelId` is on the ground. The roof level has id `roof` and sorts last. `D/levels.ts:18, 28, 85-98, 111-113`.
11. Storey height = `level.heightM` if it is a number from 2 to 8, else `wallHeightM` if from 2 to 8, else 2.7. `D/building.ts:9-10, 53-56, 66, 70`; `src/data/wallPaints.ts:170`.
12. Finished-floor elevation = `level.elevationM` if finite, else the running value, which starts at 0 and after each storey becomes elevation + height + 0.18. `D/building.ts:67-73`.
13. Roof level elevation = elevation + height + 0.18 of the roof's source storey: the highest storey with a drawn room, else the last storey. Roof level height = 0. `D/building.ts:74-83`; `D/levels.ts:205-218`.
14. Each storey is solved alone, then `elevationM` is added to its floors, walls and items. `D/buildingScene.ts:11, 48-55, 71-73, 80-83`.
15. What is kept: House view keeps all storeys, Floor view the active one. The roof slab is kept when the roof is shown or in Floor view; roof coverings only when the roof is shown; roof-level items only while the roof level is active. `D/buildingScene.ts:23-25, 56, 74, 85`.

### C. Floors and slabs

16. One floor per room whose kind is not `outdoor` and that has 3 or more vertices: the room polygon as it is. `D/roomSolids.ts:181-195`.
17. The slab is the polygon extruded 0.18 DOWN from the finished floor. The drawn top sits at elevation + 0.001; the collision copy at the elevation. `3/dressing.ts:120-123, 141`; `W/scene.ts:67-70`.
18. Stair holes: each stair that passes the placement check and ARRIVES on this storey (`toLevelId`) cuts its footprint rectangle from the floor that contains it with 0.06 clearance. `D/buildingScene.ts:28-29, 66-71`; `D/stairPlacement.ts:10, 34-45`.
19. Roof slab: one 0.18 floor per roof room at the roof level elevation, default colour #a9aba6. `D/buildingScene.ts:56-64`.
20. So the slab over storey n fills elevation + height to elevation + height + 0.18, and the ground slab fills -0.18 to 0 (from rules 12 and 17).
21. Floor colour = the hex of ONE material per room: the tile zone with the most runs, else the whole-room finish, else bare #F1EBDD; drawn at 0.9 of the colour. Kind default `screed`; tile default 0.5. `RV:328-338`; `D/roomView3d.ts:219`; `TS:390, 1332-1333`.

### D. Walls

22. Room walls are DERIVED: one slab per kept room edge. Free walls are STORED in `walls` as id, a, b, `thicknessM`, `levelId`, paint and cladding fields. `D/roomSolids.ts:197-233, 276-299`; `D/freeWalls.ts:22-51`.
23. Slab frame: u along a to b (0 to length), v up (0 to height), w from the outer face (0) to the inner face (thickness). World basis: X = (dx, 0, dy), Y = up, Z = X cross Y = plan (-dy, dx). Origin = a at the storey elevation, moved by -thickness along Z (room edge) or -thickness / 2 (centred). `TS:615-628`; `3/joinery.ts:8-12`.
24. So the inner face of a room wall lies ON the polygon edge and the slab grows outward. A free wall straddles its line. `TS:622-624`; `D/roomSolids.ts:62-63, 71-72`.
25. The slab is exactly the edge length. There is no mitre and no corner post: a convex corner leaves an empty thickness x thickness square outside; at a reflex corner the slabs overlap. `TS:562-567, 578`.
26. Height = H = max(0.5, storey height) for every wall of the storey. Cut stub = min(0.32, H). `D/roomSolids.ts:176, 219-220`; `D/roomView3d.ts:231`.
27. Thickness, room edge: `wallConstruction` entry `thicknessMm` / 1000 when valid, else 0.01 for glass (10 mm default), else 0.14. `D/roomSolids.ts:218`; `D/wallConstruction.ts:13-20, 62-66`; `D/roomView3d.ts:233`.
28. Thickness, free wall: stored `thicknessM`, else 0.14. New free walls are made at 0.10. A saved masonry setting writes its thickness (default 0.15) to every non-glass wall. `D/roomSolids.ts:286`; `D/freeWalls.ts:82`; `D/wallAwarePlacement.ts:50`; `D/materials/settings.ts:9`; `D/masonryDimensions.ts:7-22`.
29. Shared wall: an edge is `shared` when another room's edge on the storey is collinear within 0.001 and overlaps by more than 0.001. Each room still gets its own slab on its own outer side, so the pair stands back to back, 2 thicknesses in all. `D/wallEdges.ts:187-204, 227-247`; `D/roomSolids.ts:182, 230`.
30. Shared glass: two glass edges with the same end points reversed (1e-6) and the same thickness are one pane, centred on the line. Only the owner (first key in sort order) is drawn; openings of both are merged. `D/sharedGlass.ts:16-55`; `D/roomSolids.ts:221-222`.
31. Wall views: Up = all full. Down = all stubs. Cutaway: a room wall is full when the camera is on its inward side, else a stub, or hidden if shared; a free wall is a stub when its middle is more than 0.6 nearer the camera than the target; shared glass stays full. `D/roomSolids.ts:340-359`; `TS:1734-1742`.
32. Faces: inner face = paint; outer face = exterior (default #E4E0D6); ends, top and opening reveals = #C9C3B6; a cap strip (length + 0.004) x 0.012 x (thickness + 0.006) centred 0.006 above the top, #B5AFA2. `TS:365-369, 526-547, 581, 587-591`.
33. Skirting on the inner face: 0.10 high, 0.014 proud, broken at doors and doorways; none when the shown wall is under 0.12. `3/joinery.ts:22-23, 57-86`.
34. Where exactly two like walls meet within 20° of straight, only the painted corner shade is dropped; the geometry does not change. `D/roomSolids.ts:307-330`.
35. Glass walls: same slab, opacity 0.25, no shadow, no cap, no joinery. `TS:580-592, 607-610`; `3/wallSurfaces.ts:92-127`.
36. Free walls carry no openings. `D/roomSolids.ts:295`.

### E. Openings

37. Stored on the room: id, `edgeIndex`, `offsetM`, `widthM`, kind, `flipFacing`, `flipHand`, `sillM`, `heightM`, shape. `offsetM` = metres from the edge START vertex to the opening CENTRE, absolute, not a fraction. `D/openings.ts:43-62`.
38. Kinds: door, doorway, window, hole. Shapes: rectangle (default), arch, circle (windows and holes only; width is the diameter). `D/openings.ts:40-41`; `D/openingGeometry.ts:28-29`.
39. Along the wall: t0 = max(0, offset - width / 2); t1 = min(length, offset + width / 2); skipped if t1 is not above t0. `D/roomSolids.ts:203-205`.
40. Sill: window = `sillM`, else 0.9; hole = `sillM`, else 0; door and doorway = 0. `D/openingGeometry.ts:11-14`.
41. Height: circle = width; else `heightM` if above 0; else window 1.2, hole 1.0, door and doorway 2.04. `D/openingGeometry.ts:6-10`; `src/data/wallPaints.ts:175-176`.
42. Vertical span: bottom = min(max(0, H), sill); top = max(bottom, min(H, bottom + height)). `D/openingGeometry.ts:15-19`.
43. Default widths: door 0.838, window 1.2. Door choices 0.686, 0.762, 0.838, 0.914, 1.219. Window choices 0.6, 0.9, 1.2, 1.5, 1.8, 2.4. `D/openings.ts:68-70`; `C/HouseWorkspace.tsx:190`.
44. Placement: 0.1 of wall must remain at each end; two openings on one wall may share length only if their height bands do not meet; sill + height must fit the wall height. `D/openings.ts:78, 133-162`; `D/openingGeometry.ts:22-31`.
45. The cut: the opening profile is a hole in the wall's u-v rectangle and the slab is extruded through the whole thickness. The hole is clipped at the shown wall height. `TS:568-578`; `3/openingMeshProfile.ts:6-21`.
46. Profiles (u along the wall, v height): rectangle = 4 points. Arch: rise = min(height, width / 2), spring = top - rise, a half ellipse in at least 48 chords at 3 mm deviation. Circle: centre (offset, sill + radius), at least 96 points. `D/openingGeometry.ts:50-69`.
47. An opening in a shared wall also cuts the neighbour's slab: its span is projected onto the neighbour's edge. `RV:278-303`.
48. Window dressing: a glass pane at mid thickness (#BFD9EA, opacity 0.28); frame members 0.05 wide, depth min(0.06, thickness / 2); a 0.04 mullion when the width is over 0.9; a sill board (width + 0.08) x 0.03 x (0.4 thickness + 0.04) under the opening, 0.04 proud of the inner face. `TS:594-605`; `3/joinery.ts:151-173`.
49. Door dressing: architrave 0.07 wide, 0.018 proud, on the inner face only; lining 0.012 in the reveal. Kind `door` adds a CLOSED leaf (width - 0.03) x (height - 0.02) x 0.04 at mid thickness, six panels, a lever at min(1.0, 0.55 leaf height). Doorway: no leaf. Hole: nothing. `3/joinery.ts:93-144, 181`.
50. Swing (Plan and Walk only): the hinge is at the start end of the span, or the far end when `flipHand`; the leaf opens 90° toward the edge's left normal (-dy, dx), or the other side when `flipFacing`. `D/openings.ts:168-170, 371-406`; `W/scene.ts:89-104`.

### F. Stairs

51. Stored in `stairs`: id, `fromLevelId`, `toLevelId`, x, y, `widthM`, `runM`, rotation. (x, y) = centre of the footprint. At rotation 0 the flight climbs toward +y (south). One kind: a straight flight. `D/building.ts:12-23`.
52. Valid when `from` is a storey below `to`, width 0.6 to 5, run 1 to 30, rise above 0. `D/building.ts:139-161`.
53. Rise = elevation(to) - elevation(from). `D/building.ts:119-121`.
54. Steps n = min(512, max(1, ceil((rise - 1e-9) / 0.18))); riser = rise / n; going = run / n. `3/buildingMeshes.ts:33-35`.
55. Footprint = width x run rectangle turned about (x, y): corner = (x + px cos r - py sin r, y + px sin r + py cos r). `D/building.ts:128-136`.
56. Step i (from 0), in the stair frame (x across, z along the climb): a solid block width x ((i + 1) riser - 0.025) x going standing on the lower floor, centred at z = -run / 2 + (i + 0.5) going, with a 0.025 tread on top. The flight is solid underneath. `3/buildingMeshes.ts:31-32, 39-50`.
57. Two handrails at x = ±(width / 2 - 0.045): rail radius 0.025 from riser + 0.9 over the first tread to rise + 0.9 over the last; posts 0.035 x 0.9 x 0.035 on every third tread and the last. `3/buildingMeshes.ts:51-68`.
58. New stair default: width 1.0, run = max(3, 1.2 x rise), rotation 0, position rounded to 0.1. It must sit inside a room on both storeys with 0.06 clearance and clear of other stairs. `RV:1657-1661`; `D/stairPlacement.ts:54-74`.

### G. Roof

59. `roof` = style, material, `thicknessM`, `pitchDeg`, `overhangM`, outline. Defaults: flat, felt, 25°, 0.2. Pitch is clamped 5 to 60, overhang 0 to 1.5, thickness 0.0003 to 2. One setting for the whole building. `D/building.ts:28-41, 100-117`.
60. Styles: flat, gable, shed. Materials: felt, tile, metal, iron-sheet, concrete. `D/building.ts:29-30`.
61. Roof rooms: one per drawn room of the source storey (id = `roof-` + source id, same polygon), or a single room `roof-custom-outline` when `roof.outline` is set. One covering per roof room. `D/roof.ts:38-40, 80-94, 128-135`; `D/buildingScene.ts:85-88`.
62. Outline = the room polygon pushed outward by the overhang with mitred corners: move = (na + nb) x overhang / (1 + na . nb), capped at 4 overhangs. `D/roofSurface.ts:47-68`.
63. Slope axis = x when the outline is no wider in x than in y, else y: the slope runs along the SHORT side and a gable ridge runs along the long side through the middle. low and high = outline minimum and maximum on that axis; ridge = their mean; slope = tan(pitch), 0 for flat. `D/roofSurface.ts:70-81`.
64. Thickness square to the face: `thicknessM`; else iron-sheet 0.001; concrete 0.12; else 0.08 for flat or 0.08 cos(pitch). Vertical thickness = that x sqrt(1 + slope squared). `D/roofSurface.ts:7-17`.
65. Top height at p = roof elevation + vertical thickness + rise. Rise: flat 0; shed (p[axis] - low) x slope; gable max(0, (high - low) / 2 - abs(p[axis] - ridge)) x slope. `D/roofSurface.ts:83-88`.
66. Mesh: top = the outline triangulated at those heights (gable: each triangle split at the ridge). Sides run along every outline edge from the lower edge to the top. Lower edge = top - vertical thickness when the thickness is set or the material is iron-sheet or concrete; else the roof elevation, which closes felt, tile and metal roofs down to the slab, gable ends included. Underside: an offset copy, or a flat polygon at the roof elevation. `3/buildingMeshes.ts:164-251`.
67. Colours: felt #4b5051, tile #a55a40, concrete #a9a69f, metal and iron-sheet #7e9498, cool coating #e7e6d6, sides #d5d4ce, underside #dddcd5. `3/buildingMeshes.ts:77, 231, 246`.

### H. Foundation

68. `foundation` = version 1, enabled, elements, bores. Element = a box centred at (x, y): `lengthM` along plan x, `widthM` along plan y, `depthM` down from `topElevationM`, measured from the ground-storey datum. No rotation. `D/foundation.ts:23-52, 221-230`; `3/foundationMeshes.ts:32-47`.
69. Kinds slab, strip and pad draw the same box. Colour #a9afa1. Drawn when the element has no excavation record or its stage is `filled`. `D/foundation.ts:13, 245-246`; `3/foundationMeshes.ts:24-32`.
70. Excavation = the element box grown by `marginM` on each side, from the excavation top down its depth. Soil faces, a 0.35 rim and a depth line are drawn only in the Below ground view. `D/foundation.ts:247-259`; `D/foundationExcavation.ts:88-131`; `3/foundationMeshes.ts:49-132`.
71. Bore = an open cylinder of 64 sides, `diameterM` wide, from `topElevationM` down `depthM`, with a 0.25 rim. `D/foundation.ts:44-52`; `D/foundationExcavation.ts:136-177`.

### I. Site, ground, garden, terrain

72. Site = a rectangle: `widthM`, `depthM`, `originM` (top-left corner); sides 1 to 500. Absent = no plot. `src/store/propertyStore.ts:236-246`.
73. Backdrop ground: a 600 x 600 plane at -0.002. `3/dressing.ts:63-69`.
74. Automatic lawn at -0.0005: the site rectangle, or the bounding box of the ground rooms (else of the garden) plus 3; minus ground rooms, garden surfaces (a pool grown by its shell) and dug cells. `3/gardenSurround.ts:9, 66-91`; `3/gardenGround.ts:7, 46`; `TS:1445-1447`.
75. Garden surface = id, kind, x, y (top-left), `widthM`, `depthM`, `elevationM` 0 to 2, outline, `thicknessM`, pool. Polygon = the outline, else the rectangle. Colours: lawn #70934f, soil #795841, gravel #b5afa0, path #c5bca9, concrete #a7aaa8, tarmac #42484b, pool #5db6c3. `D/garden.ts:5-13, 22-42, 187-195`.
76. Surface top = elevation + 0.0003 (+ 0.000001 per draw order); later surfaces win. Raised surfaces get soil sides from 0 to the elevation. Edge depth = `thicknessM` or the paving product's. Texture repeats every 1.6; paving joints every 0.6 by default. `3/gardenMeshes.ts:75-123`; `D/outdoorTakeoff.ts:12`.
77. Pool (rectangle only): the rectangle is the inner size. Defaults: shell depth 1.5, water depth 1.35, wall 0.2, base 0.2, margin 0.3, stage `filled`. Base slab (w + 2 t) x base x (d + 2 t) under the shell; four walls t thick and shell-depth high outside the inner rectangle; water plane at top - shell depth + water depth. Stage `excavation` draws only the pit: inner size + 2 (t + margin), depth = shell + base. `D/garden.ts:43-57, 114-116`; `3/gardenMeshes.ts:36-73`.
78. Fence = id, a, b, `heightM` 0.3 to 3, material timber, metal or hedge; base at the higher garden height of its two ends. Hedge = a box length x height x 0.5. Else: posts = ceil(length / 2) + 1, evenly spaced, 0.10 square (metal 0.06), height + 0.06; two rails 0.07 high at 25 % and 80 % of the height; slats every 0.15 (metal 0.18), 0.09 wide (metal 0.018) x (height - 0.08) x 0.035. `D/garden.ts:58-64, 151-158`; `3/gardenMeshes.ts:155-188`.
79. Terrain cut = one cell: id "x,y", integers x and y, `topM`, `depthM`. The cell covers x to x + 1 and y to y + 1; bottom = topM - depthM; depth above 0 and up to 20; at most 512 cells. `D/terrainCuts.ts:2-40`.
80. Cell of a point = floor(x), floor(y). An edit adds or subtracts the stroke depth (up to 5), rounds to 0.001, and deletes the cell at 0. `topM` is fixed at the first dig = ground elevation + garden height at the cell centre. `D/terrainCuts.ts:41-61`; `W/EarthworkTool.tsx:106-116`.
81. Drawn: a floor quad at the bottom, and on each of the 4 sides a wall from the bottom up to min(topM, the neighbour cell's bottom); no wall where the neighbour is as deep. Colours #856c52 and #9b7956. The backdrop and the lawn get square holes. `D/terrainCuts.ts:62-90`; `3/earthworkMeshes.ts:27-64`.
82. Tree = x, y, `heightM`, `canopyRadiusM`, `stemDiameterMm`, status. Trunk 0.67 of the height, radius = stem diameter / 2000, else min(0.1 radius, 0.025 height), top at 0.7 of the base radius. Five ellipsoid crowns: the middle one reaches the height exactly, the side ones the canopy radius exactly. At most 300 are drawn. `3/ecoTrees.ts:9-36`; `D/eco.ts:14`.

### J. Services

83. Run = id, `levelId`, system, `materialId`, `diameterMm`, points (x, y, `elevationM`, `junctionId`), `startElevationM`, `endElevationM`. Heights are the pipe CENTRE LINE above that storey's finished floor; negative = below the floor; range -20 to 20. `D/buildingServices.ts:31-60, 146-148`.
84. Node height = its own `elevationM`, else start + t (end - start), with t = plan length travelled / total plan length (index fraction for a purely vertical run). `D/buildingServices.ts:266-282`.
85. Drawn: a 12-sided cylinder per segment and a sphere per node, radius = (catalogue outer diameter, else `diameterMm`) / 2000 m, at storey elevation + node height. `3/serviceRouteMeshes.ts:11-28`; `D/serviceScene.ts:10-16`.
86. System colours: cold-water #286b96, hot-water #aa5545, waste #765845, electrical #89712d, ventilation #558a87, refrigerant #8263a5, fire-water #c64647, data #4e7e67. `D/buildingServices.ts:87-96`.
87. Fixture = id, `levelId`, kind, x, y (centre), `widthM`, `depthM`, `heightM`, rotation (clockwise), `elevationM` (base above the floor, default 0). The drawn body is scaled per axis to fill that box exactly; base at storey elevation + `elevationM`. `D/buildingServices.ts:61-79`; `D/serviceFixtures.ts:15-32`; `3/serviceFixtureMeshes.ts:228-242`.
88. Default fixture boxes, width x depth x height: toilet 0.4 x 0.7 x 0.78; sink 0.6 x 0.48 x 0.85; mains-tap 0.12 x 0.16 x 0.6; electrical-board 0.4 x 0.12 x 0.6; sewer-connection 0.6 x 0.6 x 0.6; air-conditioner 0.8 x 0.22 x 0.3; outdoor-ac 0.8 x 0.35 x 0.6; air-grille 0.3 x 0.1 x 0.3; extractor-fan 0.3 x 0.15 x 0.3; sprinkler 0.08 cube; fire-extinguisher 0.18 x 0.18 x 0.55; security-camera 0.18 x 0.25 x 0.16; network-switch 0.44 x 0.25 x 0.05. `D/buildingServices.ts:97-114`.

### K. Placed items

89. Stored per room in `placedItems`: `instanceId`, `productId`, x, y, rotation, `parentInstanceId`, `mountHeightCm`, `lightOn` and energy flags. NO size is stored: length, width, height (cm), placement, front edge and mount height come from the product catalogue by `productId`. `src/store/propertyStore.ts:193-229`; `RV:340-378`.
90. (x, y) = the TOP-LEFT (least x, least y) of the axis-aligned footprint of the item at its current rotation. `D/roomView3d.ts:166-168`; `D/itemDrop.ts:13-14`.
91. Footprint: at 0 or 180, w = length and h = width; at 90 or 270 they swap; at any other angle w = L abs(cos r) + W abs(sin r), h = L abs(sin r) + W abs(cos r). At rotation 0 the length lies along plan x and the width along plan y. `src/lib/geometry.ts:49-68`; `D/fitToSize.ts:15-16`.
92. Anchor: the body's pivot is the footprint centre (x + w / 2, y + h / 2) at the base height z0; yaw = rotation, clockwise. `D/fitToSize.ts:202-219`; `3/productBody.ts:56-60`.
93. Box height hItem = max(0.05, min(height, H)). Base z0 by placement: floor 0; surface = min(max(0, parent product height), max(0, H - hItem)); ceiling = max(0, H - hItem); wall = min(max(0, mount), max(0, H - hItem)), where mount = the item's `mountHeightCm`, else the product's `mount_height_cm`, else 120 cm. Then the storey elevation is added. `D/roomSolids.ts:241-254`; `D/placedItemElevation.ts:4-12`; `D/buildingScene.ts:80-83`.
94. Placement kinds: floor (also when absent or unknown), surface, wall, ceiling, roof. Roof also applies to any solar product with a panel rating. `D/attachmentPlacement.ts:33-51`; `src/data/products.schema.ts:72`; `D/energy.ts:86-89`.
95. Scale-to-size: the model is scaled per axis so its bounding box EQUALS the catalogue box: sx = (L or W) / extent x, sy = H / extent y, sz = (W or L) / extent z, using the full catalogue height, not the clamped one. The box is measured from the model's real vertices. `D/fitToSize.ts:135-169`; `3/productBody.ts:14-22, 39-41`.
96. Model axes (glTF frame): +y up, front +z. `modelUp` of `+z` or `-z` first pitches the model -90° or +90° about x. Yaw about +y = model-front turn (+z 0, -z 180, +x -90, -x +90) + 90 if the length runs along model z (`lengthAxis` z, or `auto` by nearest aspect) + front-edge turn (bottom 0, top 180, left -90, right +90). When abs(sin(yaw)) is over 0.5 the x and z targets swap. `D/fitToSize.ts:41-66, 99-127, 144-168`.
97. Front edge: `bottom` (the default) means the front faces plan +y (south) at rotation 0; top = north; left = west; right = east. `D/fitToSize.ts:17-19, 99-112`.
98. After scale and yaw the fitted box is moved so its footprint centre is on the pivot and its lowest point on the base plane. `D/fitToSize.ts:171-184`.
99. Product id to model file: the product's `mesh_url` if present; else the manifest entry for the product id; else the entry of the seed id with the same SKU. `phoneUrl` replaces `url` on a touch screen up to 760 px wide. Loaded with the glTF loader and a Draco decoder served from `/draco/`, one fetch per URL. `src/data/productModels.ts:59-71, 81-101`; `TS:103-131`.
100. No model: the first match of a purpose-built shape (service product, solar panel, one water tank, furniture kinds), else a box length x height x width in the category colour, with the product's top-down picture on the lid and its photo on the four sides. A model that arrives later replaces the stand-in. `TS:185-236, 1372-1378, 1398-1441`; `D/roomView3d.ts:236-260`.
101. Solar panel stand-in: frame bars min(0.018, shorter side / 15) wide, 18 x 6 cells. Water tank stand-in: a turned profile scaled to length x height x width. `3/solarPanelPreview.ts:14-16, 39-48`; `3/waterTankPreview.ts:16-22, 33`.
102. Roof items: base height = roof top at the footprint centre + 0.06; tilt = the roof slope there (up vector = normalise(-slopeX, -slopeY, 1) in plan axes). A panel across a gable ridge sits level at the roof's highest point + 0.06. With the roof hidden the item lies flat at the roof level elevation. `D/roofSurface.ts:8, 96-108`; `3/roofItems.ts:9-30`; `D/buildingScene.ts:75-83`.
103. Surface items keep `parentInstanceId`; they sit inside the parent's footprint on a 0.1 sub-grid and move with it. `D/attachmentPlacement.ts:57, 141-163`; `src/store/propertyStore.ts:200-205`.
104. Wall items snap flush to the nearest axis-aligned wall within 1.5, back to the wall. The placement code takes the wall face as 0.05 inside the room edge. `D/attachmentPlacement.ts:54, 73-106`; `D/wallAwarePlacement.ts:46-51`.
105. Lamps: a point light (#ffd9a3, 26 cd, decay 2, range = sqrt(r squared + mount squared), r = 3 x the longest footprint side clamped 1.2 to 3.5) at: ceiling items max(0.5, H - 0.35); wall items base + 0.5 height; others base + max(0.3, 0.85 height). Strength factor = clamp((8 - sun elevation in degrees) / 10, 0, 1). `RV:349`; `D/lighting.ts:23-27, 63-93`; `3/dressing.ts:244-260`.

### L. Materials and paint

106. Wall paint: `wallPaint` entries = `edgeIndex`, `paintId`, `colourHex`, `colourName`, side (absent = interior). Free walls: `paintId`, `paintColourHex`, `paintFaces`, `exteriorPaint`. Colour = the tint if the paint can be tinted, else the paint's base hex, else plaster #D9D3C6 for an unknown id. `src/store/propertyStore.ts:178-185`; `D/freeWalls.ts:33-50`; `src/data/wallPaints.ts:168, 866-873`.
107. The finish comes from the paint and changes reflection only (roughness, sheen): matt 0.95, 0; smooth 0.88, 0.08; textured 0.98, 0; silk 0.62, 0.35; satin 0.42, 0.55; gloss 0.16, 0.92. `src/data/wallPaints.ts:635-674`; `3/wallSurfaces.ts:82-115`.
108. Wall construction: `wallConstruction` entries = `edgeIndex`, kind, `thicknessMm`, `materialProductId`. Base colours: plastered-brick #D9D3C6, brick #A36B50, concrete #A7A49C, glass #9EC8C4. Paint replaces the colour except on glass. Cladding (`wallCladding` = `edgeIndex`, `productId`) replaces the interior colour and sets the finish `textured`. `D/wallConstruction.ts:9-26, 55-84`.
109. Unpainted exterior = #E4E0D6; exterior paint = `wallPaint` entries with side `exterior`. Brick texture repeats every 0.46 x 0.30 (bricks 220 x 65 mm, joints 10 mm). `TS:369-370`; `3/wallSurfaces.ts:28-45, 128-136`.
110. Floor finish: `floorFinish` = `materialId` for the whole room, or `floorTiles` zones = `materialId`, `tileWm`, `tileHm`, `originM`, runs. Runs = flat triples row, first column, count. Tile (row, col) starts at x = origin x + col x tile width, y = origin y + row x tile height. Origin = the least corner of the room's bounding box at the first paint. `src/store/propertyStore.ts:281, 298`; `D/floorTiles.ts:32-44, 80-102, 201-218`.
111. Six floor materials: tiles of 0.92 x 0.92, 1 x 1, 0.5 x 0.5, 1 x 1 and 0.5 x 0.5, and one roll with no tile size. `src/data/floorMaterials.ts:40-113`.
112. The 3D floor texture repeats every max(0.25, tile width). Eight surface kinds are picked from the material's id, SKU and name: screed, rubber-tile (default for a laid floor), eva-mat, vinyl-mat, epdm-roll, interlock, wood, ceramic. `3/surfaces.ts:217-222`; `D/floorKind.ts:6-23`.
113. Roof finish = `roof.material` (rule 67). Garden colour = the kind colour, or the paving product's colour for a path. `3/gardenMeshes.ts:81-84`.

### M. Other drawn things

114. Shade sail: 3 to 6 anchors (x, y, `heightM`, support post or wall), `cornerGapM` (default 0.3), `edgeCurvePct` (default 7), fabric, colour. Corner = the anchor moved inward along the angle bisector by the gap, at the anchor height. Each edge dips inward by chord x curve % x 4 t (1 - t). The surface interpolates the corner heights (mean-value weights), 8 segments per edge, 6 rings. `D/shade.ts:72-110, 187-206, 435-472`.
115. Sail hardware: edge cable radius 0.008; a link of radius 0.014 from fixing point to sail corner; post radius 0.05 (0.07 when another anchor is over 5 away), leaning 7° away from the centre, top 0.06 above the fixing point; wall bracket 0.08 x 0.08 x 0.05. `3/shadeMeshes.ts:19, 42-91`.
116. Component = id, name, vertices (x, y, z), edges (pairs of vertex indexes), faces (signed 1-based edge loops). Each face is a flat loop, triangulated as it is; colour #92b6ac; edges drawn as lines. `D/boundaryModel.ts:7-14`; `3/boundaryMeshes.ts:10-52`.
117. Pilot demo objects at saved points: a 2.8 mast with three 0.66 blades, or a 1.2 x 1.2 x 0.06 pad with four plates. `3/pilotDemonstrations.ts:21-40`; `D/buildingScene.ts:36-41`.

## 5. Walk numbers

| Value | Number and unit | Where |
|---|---|---|
| Walk speed | 1.45 m/s | `W/runtime.ts:31` |
| Run speed | 3.4 m/s | `W/runtime.ts:32` |
| Speed ramp | damped toward the target (rate 12 per second), starting from at least 0.725 m/s | `W/runtime.ts:548` |
| Jump | none: no jump key and no upward impulse | `W/runtime.ts:404-416`; `W/collision.ts:175` |
| Eye height | 1.55 m above the feet | `W/runtime.ts:177, 485` |
| Capsule | radius 0.23 m, height 1.7 m | `W/types.ts:68-69` |
| Physics step | 1/120 s; catch-up at most 0.1 s; frame step at most 0.05 s | `W/types.ts:70`; `W/collision.ts:202`; `W/runtime.ts:533` |
| Movement slice | at most 0.07 m per sub-step | `W/collision.ts:142-144` |
| Step height | only authored stair treads: one riser + 0.025 m (riser is at most 0.18 m); no general step-up | `W/collision.ts:151-169` |
| Gravity | 18 m/s² down; fall speed capped at 12 m/s | `W/collision.ts:175` |
| Ground snap | within 0.035 m (0.23 m on stairs) | `W/collision.ts:179-186` |
| Edge guard | a grounded move with no surface within 0.5 m below is undone | `W/collision.ts:171-174` |
| Walkable surface | contact normal y above 0.55; ground ray needs normal y above 0.5 | `W/collision.ts:59, 118` |
| Standable roof | flat, or 1 / sqrt(1 + slope²) above 0.55 (pitch under about 56.6°, my arithmetic) | `W/placement.ts:14` |
| Fall reset | below min(-5, world bottom - 5) m, back to the last safe spot | `W/collision.ts:193-195` |
| Camera | field of view 65°, or 95° on a portrait screen outside first person; near 0.06 m, far 1000 m | `W/runtime.ts:38, 520-523` |
| Follow boom | 2.8, 4.8 or 6.2 m (default 4.8), clamped 2 to 8; + 0.85 m when sprinting faster than 2 m/s | `W/followSettings.ts:1, 4`; `W/collision.ts:333`; `W/runtime.ts:564` |
| Follow camera | shoulder offset 0.52 m; swept sphere 0.18 m; pitch -0.9 to 0.65 rad | `W/collision.ts:325, 332, 334` |
| First person camera | pulled in with a 0.08 m sphere | `W/runtime.ts:497` |
| Look | drag 0.004 rad/px; pitch ±1.35 rad; look pad 1.9 rad/s around, 1.6 rad/s up | `W/runtime.ts:466, 539-540` |
| Pointer lock look | speed 0.8; polar angle 0.2 to π - 0.2 rad | `W/runtime.ts:182, 185` |
| Move pad | 40 px radius; dead zone 0.12 | `W/WalkMode.tsx:194-196` |
| Door | reach 2 m; swing 2.8 rad/s; leaf 0.045 m thick; opens 90°; swept every 2° | `W/runtime.ts:473`; `W/collision.ts:215, 239`; `W/scene.ts:114` |
| Tap to walk | arrives within 0.08 m; gives up after 0.6 s without progress | `W/runtime.ts:555, 560-561` |
| Route search | 0.45 m cells; 1,800 expansions; sampled every 0.15 m | `W/navigation.ts:6-7, 10` |
| Animation | idle under 0.08 m/s; run over 2.1 m/s; 0.18 s cross-fade | `W/runtime.ts:571-573` |
| Body size | every character scaled to 1.7 m | `W/runtime.ts:374-378` |
| Whole build view | camera at max(5, 1.6 x plan radius) m | `W/runtime.ts:489-493` |
| Cutaway refresh; status | every 120 ms; every 250 ms | `W/runtime.ts:585, 618` |
| Start spot | inside an outer door of the lowest storey at 0.8, 1.1 or 0.5 m; else the clearest probe (grid of at least 0.45 m) | `W/spawn.ts:56-63, 93` |
| Dig and fill | 1 m cells; 0.25 m per stroke by default; 0.001 to 5 m | `W/EarthworkTool.tsx:25, 101-104, 243-245` |
| Item collision | axis-aligned box of the turned footprint, height clamped to the storey | `W/scene.ts:158-162` |
| Windows | solid for the walker; doorways and holes open | `W/scene.ts:78-80` |

What Walk reads from the design: the solids (floors with stair holes, walls with door holes, stairs, item boxes, roof faces) `W/scene.ts:57-177`; room openings for hinge and swing `W/scene.ts:89-92`; terrain cells `W/scene.ts:165`, `W/outdoor.ts:37-39`; garden surfaces, plot and ground rooms for the land `W/outdoor.ts:25-32`.
What Walk never reads: city, services, foundation, shade sails and trees (a word search of the non-test files in `src/walk` for those names found nothing); components are passed to the picture only (`W/WalkMode.tsx:59, 231`); pools are left out of the land (`W/outdoor.ts:31`).
What Walk writes: nothing, except Dig and fill, Components, and the tools opened by Build from here (`W/EarthworkTool.tsx:121-126`; `W/WalkMode.tsx:176-180`).

## 6. Traps

1. Items carry no size. The JSON has product id, top-left of the turned footprint and rotation; sizes, placement kind, front edge and paint or floor colours come from catalogues the game must ship (`src/store/propertyStore.ts:193-229`; `RV:340-378`). `src/data/products.json` has 42 seed products (counted); more arrive from a server catalogue at run time (`RV:479-480`).
2. Walls sit OUTSIDE the room edge with no corner fill, and a shared wall is two slabs back to back; Cutaway hides one of the two (`TS:615-628`; `D/roomSolids.ts:354-356`). A mesh builder that wants clean corners must add them and say so.
3. Three wall thicknesses disagree: 0.14 drawn by default (`D/roomView3d.ts:233`), 0.10 for placement and new free walls, treated as centred on the edge (`D/wallAwarePlacement.ts:46-51`), 0.15 from the masonry setting (`D/materials/settings.ts:9`). Furniture snaps 0.05 inside an edge that the 3D wall does not cover.
4. The 3D floor shows ONE material per room; the saved per-tile zones are not drawn tile by tile (`RV:328-338`).
5. Fit-to-size is defined in the glTF frame (+y up, front +z) and the web yaw is the NEGATIVE of the saved rotation (`D/fitToSize.ts:215-217`). Port the fit before any engine axis conversion.
6. Placing and moving products in 3D runs through the hidden 2D plan component, which registers the resolvers (`src/store/placementIntentStore.ts:1-33, 98-101`); the pure twin covers moves only (`D/itemDrop.ts:1-12`).
7. Roof slab, covering and roof items depend on a view switch: hidden roof means panels lie flat (`D/buildingScene.ts:24-25, 74-89`). Walk always builds with the roof (`W/visit.ts:20`) but hides coverings below roof level (`W/runtime.ts:593`).
8. Doors are drawn closed in the build view; hinge and swing matter only in Plan and Walk (`3/joinery.ts:111-116`; `W/scene.ts:89-104`). Windows block the walker.
9. An item's body is scaled to its full catalogue height, but its box, its collision and its base height use the height clamped to the storey (`D/roomSolids.ts:241-254`; `3/productBody.ts:39-41`).
10. Every structural edit rebuilds the whole scene and, in Walk, the whole collision world (`TS:1296-1314`; `W/runtime.ts:294-310`). `src/designer/openingPlacement.ts` has one byte that is not valid UTF-8 at line 53.

## 7. Not read

- Nothing was run: no build, test, browser or frame measurement. Speeds and sizes are numbers in code.
- `src/components/RoomCanvas.tsx` (the 2D plan, where product placement and its resolvers live). The Plan column in section 2 rests on references only.
- `src/store/propertyStore.ts`: lines 1 to 470 and 1519 to 1563 read, of 2,733. `src/store/designerUIStore.ts`: lines 44 to 173 and 255 to 304. Other stores (history, catalogue, drag pointer, opening selection, measured path, garden editor, visibility, quality): not read.
- `src/designer/`: `wallAwarePlacement.ts` (lines 30 to 69 only), `roomLayout.ts` (lines 54 to 99, 259 to 271, 301 to 313), `surfaceActions.ts` (exports and target kinds only), `shade.ts` (lines 300 to 409 not read), `floorTiles.ts` (lines 320 on), `floorPaintBrush.ts` (lines 81 on), `energy.ts` (lines 86 to 89 only); not read at all: `flooringLattice.ts`, `layerBands.ts`, `connectedWallRooms.ts`, `serviceConnections.ts`, `serviceRouteEditing.ts`, `componentEditing.ts`, `entitySnapping.ts`, `edgeResize.ts`, `foundationScene.ts`, `ecoContract.ts`, `materials/` (one line found by search), `solarCalc.ts`, `city*.ts`.
- `src/components/three/`: `surfaces.ts` (lines 195 to 444 read), `furniturePreview.ts` (lines 1 to 110 of 748), `serviceProductPreview.ts` (lines 1 to 60), `BoundaryEditor.tsx` (lines 1 to 190); not read: `naturalSceneRenderer.ts`, `firstPicture.ts`, `firstPictureMaterials.ts`, `foundationInspection.ts`, `productSurfaceLighting.ts`, `furnitureSurface.ts`, `furnitureOcclusion.ts`, `furnitureBox.ts`, `itemPreviewPose.ts`, `attachedItemPreview.ts`.
- `src/components/`: `MaterialsPanel.tsx`, `GardenPanel.tsx` (lines 111 on), `ServicesThreeEditor.tsx` (lines 131 on), the Services, Foundation, Shade and City workspaces, `WallHeightControl.tsx`, `DisciplineVisibilityControls.tsx`, `OpeningDimensions.tsx`, `OpeningPlacementPreview.tsx`, `CanvasDock.tsx`, energy and cost panels.
- `src/components/build/`: `BuildDashboard.tsx` (lines 76 on), `PackageInspector.tsx` (lines 61 on), `PackageDecisions.tsx`, `TradeStation.tsx` (lines 61 on), `BuildControls.tsx` (lines 121 on), `jobPhoto.ts`, `transfer.ts`, the small label files, CSS and tests. This folder holds the trade-jobs dashboard and overlay; the build bar itself is `HouseWorkspace.tsx` and `BuildingControls.tsx`, both read whole.
- `src/walk/`: `walk.css` and the 15 test files. `src/sharedBuild/` (other players): not read.
- `src/lib/placementActions.ts`: lines 120 to 300 only. `src/lib/geometry.ts`: lines 1 to 110.
- `src/data/`: `products.json` counted by script, not read; `products.schema.ts` and `wallPaints.ts` by search and two ranges; cladding, glass, paving, service and preview data files: not read.
- `public/models/`: counted by folder: 42 GLB in the root (21 full + 21 `-phone` copies, 5,007,852 bytes), 18 trial bodies in three subfolders, a 12-file furniture kit that no file under `src` names, 5 character GLB with 5 PNG; `public/draco/` 3 files. Headers read on 4 product or character files (Draco meshes and WebP textures required) and 1 furniture-kit file (no compression); the rest were not opened. Manifest counted: 21 entries, all with a phone copy, 3 with `modelUp`, front +z 13, -z 7, +x 1; 20,000 to 34,890 triangles per full body (`src/data/productModels.json:10, 332`).
