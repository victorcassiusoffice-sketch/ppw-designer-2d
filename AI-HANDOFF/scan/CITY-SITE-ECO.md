# SCAN: CITY-SITE-ECO (read 2026-11-20 13:42 to 13:59 +04:00, code at d678c92)

Read-only pass. Nothing was built, run or tested. Proof that the code equals `d678c92`: `git diff --stat d678c92 HEAD -- src api server` printed nothing in this run (branch `world/s00-s01-scan-rails`, HEAD `7e922f3`, which adds only `AI-HANDOFF/` files). No name of a person, company or place and no figure of money is written here on purpose; where the code holds one, the line is cited instead.

## 1. Inventory

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

## 2. Tool by mode

Proof of each "Today" cell: the section 1 row with the same name. A proof for a "Missing" cell is in the cell. "City 2D", "City 3D" and "Site" are separate dialogs; "Plan 2D", "3D" and "Walk" are the house views.

| Tool | Today on the web (works in: Plan 2D, 3D, Walk, City, Site) | FP: first person with powers | 3D build view | BLK: block-style dig and place | Best mode | Missing on the web | Needed in the game |
|---|---|---|---|---|---|---|---|
| Draw road | City 2D only: tap corners on a 0.5 m grid, then Finish route. | Walk the route; press to drop each corner at your feet. | Click corners on the ground; drag a corner to reshape. | Lay road pieces cell by cell; one run becomes one road. | 3D | Drawing in City 3D; dragging points; joined crossings (`city.ts:548`). | Spline road on the terrain, saved as the same points and width. |
| Draw utility | City 2D only: pick a system, tap corners, Finish; depths typed after. | Dig a trench line, then aim along it to lay pipe or cable. | Click the route from above; the ground turns see-through. | Dig trench cells; place pipe pieces in them one by one. | BLK | A tie to dig cells; 3D drawing; connections at crossings (`cityContract.ts:114`). | Trench and pipe pieces that write points with their elevation. |
| Place equipment | City 2D only: pick a kind, tap the site. | Pick from the air tool bar, aim, drop; telekinesis moves and turns. | Drag from a tray to the ground; turn with a handle. | Place as one multi-cell block; turn in quarter steps. | 3D | Drag, turn and place in City 3D (`CityThreeView.tsx:410-429` only selects). | One true-size mesh per kind; ratings on an info card. |
| My buildings: place a saved building | City 2D only: save the current house, choose Place, tap the site. | Telekinesis lifts the whole building and sets it on a plot. | Drag a library building onto a plot; turn before dropping. | Stamp the building as one prefab. | FP | A library in the design; a copy with interiors (`cityLibrary.ts:14,43-47`). | Prefab loaded by design id, interiors kept. |
| Refresh building envelope | City side panel button: bounding box of the current house. | Automatic: the house you stand in is the city item. | Automatic each time the city view opens. | Automatic after each placed or broken block. | 3D | An automatic refresh; the true outline; more than one link (`city.ts:322`). | House and city in one world; no refresh step. |
| Details inspector (move, size, turn) | City 2D or 3D: tap selects; X, Y, size and rotation are typed. | Aim to select; grab with telekinesis; scroll to turn. | Drag to move; a ring handle turns; corner handles resize. | Break it and place it again one cell over. | 3D | Any drag, handle or multi-select (`CityWorkbench.tsx:653-689`). | Gizmo with 0.5 m snap beside a number box. |
| Route coordinates and elevations | City side panel: typed X, Y, and Z for utilities, per point. | Grab a point marker and pull it. | Drag point handles; click a segment to add a point. | Break or add pieces at an end. | 3D | Handles on the map; adding or deleting one point (`CityWorkbench.tsx:787-834`). | Spline point handles with a depth read-out. |
| Remove item | City side panel: Remove item on the selection. | Aim at it, hold the remove power. | Select it, press Delete. | Break it piece by piece. | BLK | A key and a drag-to-clear (`CityWorkbench.tsx:166-175,848` is the only path). | One remove verb with undo. |
| Your site (size) | City side panel: typed width and length. | Walk to a corner post and pull it with telekinesis. | Drag the site rectangle's edges. | Move boundary posts cell by cell. | 3D | Edge handles; an editable origin (`CityWorkbench.tsx:860-871`). | The site comes from the picked plot, not from typing. |
| Data centre tab (scenario) | City Data centre tab: typed inputs, Save scenario. | Open the card at the building's door. | Click the building; edit the card beside it. | Open the same card from the block's menu. | 3D | A tie between the scenario and one placed item (`city.ts:86`). | In-world card running the same formula. |
| Infrastructure tab (link a reference) | City Infrastructure tab: Link selected item. | Aim at the item, pick from a wheel. | Pick in the item's side card. | Pick in the block's menu. | 3D | References as server data (`citySuppliers.ts:6-22` is a source file). | Read the references from the server. |
| Orders tab | City Orders tab: packages, lines, dates, export. | A tablet in hand shows the same list. | Open the side panel; type in the same fields. | Open the side panel; type in the same fields. | 3D | The Packages view outside English (`CityOrdersPanel.tsx:156`); a place in the design. | Read-only list first. |
| Plot tool | Plan 2D bar and phone menu: type width and depth, Lock. | Pull a corner post with telekinesis. | Drag the plot edges; the size shows live. | Move boundary posts one cell at a time. | 3D | Handles; origin edit; keeping the map site on Lock (`TopBar.tsx:487`). | Plot from the picked parcel; posts as handles. |
| Site map (draw the boundary) | Site: tap corners on the map; drag numbered corners. | Walk the land; drop a stake at each corner. | Click corners on the island map from above. | Stake posts on cells. | 3D | Satellite view (`SiteWorkspace.tsx:563`); plots over 500 m; several plots. | Island map pick writing the same lon/lat boundary. |
| Add corner by coordinates; From the surveyor's plan | Site: type lon, lat corners, or length and bearing lines. | Open the same typed panel at the map table. | Panel beside the map; the outline updates as you type. | Open the same typed panel. | 3D | Reading a plan photo or file (`SiteWorkspace.tsx:599-606` has two modes). | Same panel and the same traverse maths. |
| Fit site to the plan | Site: type the first corner's plan X and Y. | Telekinesis slides the house across its plot. | Drag the house or the outline; turn it. | Nudge one cell with the arrow keys. | FP | Dragging; turning the plot against the house (`SiteWorkspace.tsx:284-309`). | Moving the building rewrites the anchor. |
| What-if corner levels; Survey import | Site: type corner levels or import a survey; set a platform level. | Feel the slope underfoot; raise a platform marker. | Drag a platform plane; cut and fill update. | Dig and fill cells until the pad is level. | BLK | Any drawn terrain; levels stay in the report (`SiteReport.tsx:37-51`). | Height-field ground with a platform tool. |
| Planning assumptions | Site: type setback, coverage and a source. | Walk the plot edge; a ground line shows the setback. | Drag the setback line inward. | Walk-on cells inside the setback are marked no-build. | 3D | The envelope on the plan or in 3D; concave plots (`site/geometry.ts:319-322`). | Setback band drawn; a warning when crossed. |
| Foundation comparison | Site: type a datum shift, press Run. | Open the same typed panel on a board. | A slider lifts a ghost foundation. | Open the same typed panel. | 3D | Anything drawn; numbers only (`foundationScenario.ts:26-31`). | Panel only. |
| Add outdoor surface | Plan 2D and 3D: pick a kind, drag an area. Walk: through Build tools. | Aim at the ground and drag a rectangle. | Drag a rectangle on the ground. | Place surface tiles cell by cell. | 3D | A brush; turning a patch; use without parking the walker (`WalkMode.tsx:222-227`). | Ground paint mapped to the same rectangles. |
| Custom outdoor outline | Plan 2D and 3D: tap points or a curve, then Finish. | Drop a marker at each corner while walking. | Click points; pull a segment to bend it. | Fill the cells inside a traced loop. | 3D | Reshaping after Finish; pool outlines (`garden.ts:116`). | Spline area tool. |
| Move or resize a patch | Plan 2D: drag, corner handles. 3D: tap to place, drag a corner. | Grab with telekinesis and slide. | Drag the patch or its corners. | Break and lay again. | 3D | Drag-move in 3D; handles on outlined patches (`RoomView3D.tsx:1109`). | Gizmo on the patch. |
| Raise terrain (typed patch fields) | Garden panel in Plan and 3D: type 0 to 2 m per patch. | Lift the patch with telekinesis; a height read-out follows. | Drag the patch's up arrow. | Stack soil blocks. | BLK | Slopes; more than 2 m; lowering (`garden.ts:109`). | Raise and lower on the height field. |
| Boundary: fence, railing, hedge | Garden panel adds a 4 m run; tap to place; type the ends. | Walk the line placing posts. | Click the start and the end. | Place fence pieces per cell. | FP | Click-two-points drawing; gates; corners (`GardenPanel.tsx:103-113`). | Fence spline with posts. |
| Pool build | Garden panel: drag a rectangle, type depths, pick a build view. | Dig the hole, set the shell, fill it. | Drag a rectangle; step through the three stages. | Dig cells, line them, pour water. | BLK | Other shapes; steps; a link to dig cells (`garden.ts:115-116`). | Staged build using the dig tool. |
| Paving patch with a product; Outdoor floor layers | Garden panel: pick a slab, type thickness and sub-base. | Lay slabs where you aim. | Drop a product on the patch. | Place slabs one by one. | BLK | Piece counts for outlined patches (`gardenPaving.ts:19`); products as data. | Slab pieces at true size. |
| Dig / Fill | Walk only: tap or drag across 1 m cells; type the step. | Aim and hold to dig; scroll sets the step. | Drag a rectangle; type the depth. | Break and place 1 m soil cubes. | BLK | Plan and 3D use; fill above ground; over 512 cells (`terrainCuts.ts:10,53`). | Ground edit saving the same 1 m cells. |
| Remove garden element; Remove a cell | Plan 2D and 3D: tap it, choose remove; one or all of a kind. | Aim at it, hold remove. | Select it, press Delete. | Break it. | BLK | Removing while walking without parking (`WalkMode.tsx:222-227`). | One remove verb with undo. |
| Trees form | Project hub form: type X, Y, height, crown. Drawn in Plan and 3D. | Plant where you stand; telekinesis moves it. | Drag a tree from a tray. | Place a sapling block. | FP | Placing by tap; trees in Walk (`WalkMode.tsx:231`). | Tree scaled to the entered height and crown. |
| Green roof form | Project hub form: pick a roof, type weight and water. | Jetpack up; lay the layer on the roof. | Click the roof; apply the layer. | Place turf blocks on the roof. | FP | Anything drawn for it (`ProjectWorkspace.tsx:1161-1183` is a form). | Roof layer with a load read-out. |
| Water card (study inputs) | Eco sheet on the private page: lists and number boxes. | A board beside the tank shows and edits them. | Side panel; the tank level follows the month. | Open the same side panel. | 3D | Use on open pages; anything in the scene (`ProjectWorkspace.tsx:268`). | Panel fed by the same formula. |
| Pilot material pickers | Eco sheet lists; 3D recolours the walls, patch and roof. | Aim at a wall or roof and apply. | Click a surface; choose the finish. | Place the material block by block. | FP | Picking by tap; more than one room or patch (`ecoContract.ts:50`). | Material brush writing the same ids. |
| Demonstration props | Eco sheet: tick, type X and Y; shown in 3D. | Place where you aim; telekinesis moves it. | Drag the prop. | Place as one block. | FP | Placing by tap; more than one of each (`ecoContract.ts:44-46`). | Placeable props with no output counted. |
| Private programme panel | Eco sheet: load a local file; pins on two maps. | Not offered: the file stays on the web. | Read-only pins on the island map. | Not offered: the file stays on the web. | 3D | Any saved state (`programme.ts:60-68` is tab memory). | Nothing unless the owner asks. |
| Item watts, hours, on/off | Energy panel in Plan and 3D: type watts, pick hours, switch. | Aim at the item; press to switch it. | Click the item; edit its card. | Pull a lever on the block. | FP | A switch on the item in the scene (`EnergyPanel.tsx:332-350` is a list). | Interact prompt writing the same three fields. |
| Add panel, browse solar, add tank | Energy panel button arms the product; tap to place. | Jetpack to the roof; place from the air tool bar. | Drag onto the roof or the ground. | Place as a block. | FP | Litres from this tank in the Eco sheet (`quantities.ts:26`). | Roof snap; watts and litres read from the product. |

## 3. Data shapes

All of these hang off the one design object `Property` (`propertyStore.ts:338-384`). Lengths are metres unless a unit is given. Plan frame: x to the right (east), y down (south).

The city:

```
Property.city              CityModel, optional. Absent on old designs               propertyStore.ts:343
  version                  1 (fixed)                                                city.ts:80
  enabled                  boolean. false = left out of the takeoff and drawings    city.ts:81,552
  site                     the city's own rectangle                                 city.ts:82
    originM                {x, y} m. Top-left corner                                city.ts:82,198
    widthM                 number, m, 1 to 10,000                                   city.ts:199
    lengthM                number, m, 1 to 10,000                                   city.ts:200
  roads[]                  up to 64                                                 city.ts:24-33,91
    id, name               string, 1 to 128 characters; id unique in the city       city.ts:163-164,214-219
    presetId               string. The template the road started from               city.ts:27,233
    points[]               {x, y} m, 2 to 65 points. Centre line                    city.ts:28,238-240
    widthM                 number, m, 0.5 to 100                                    city.ts:234
    surfaceDepthM          number, m, 0.001 to 2                                    city.ts:235
    baseDepthM             number, m, 0 to 5                                        city.ts:236
    supplierRef            string, optional. Id of a reference record               city.ts:32,260
  networks[]               up to 128                                                city.ts:34-45,92
    id, name               as roads
    system                 water, sewer, stormwater, power or fibre                 city.ts:13,268
    points[]               {x, y, z} m. z = height above the ground datum,          city.ts:10-12,278
                           -30 to 100; a negative z is buried                       cityContract.ts:110
    diameterMm             number, mm, 1 to 5,000. Outside size, not a rating       city.ts:39-40,269
    trenchWidthM           number, m, 0.05 to 20                                    city.ts:270
    trenchDepthM           number, m, 0.05 to 30                                    city.ts:271
    supplierRef            string, optional                                         city.ts:43
    stockLengthM           number, m, optional, 0.1 to 10,000. One stock piece      city.ts:44,274,594
  assets[]                 up to 300                                                city.ts:46-65,93
    id, name               as roads
    kind                   one of nine kinds                                        city.ts:14-23
    x, y                   number, m. Centre                                        city.ts:50-52
    widthM, lengthM        number, m, 0.05 to 1,000                                 city.ts:311-312
    heightM                number, m, 0.01 to 500                                   city.ts:313
    rotation               number, degrees clockwise, stored 0 to 360               city.ts:50,314,337
    supplierRef            string, optional                                         city.ts:57
    buildingLink           'current', optional. Only on kind building; one a city   city.ts:58,315,322
    buildingForm[]         optional. Only on kind building                          city.ts:59,340-345
      base, top            number, 0 to 1. Fractions of heightM                     cityBuildingForm.ts:5-6,14-15
      polygon[]            {x, y} in a unit box -0.5 to 0.5, 3 to 128 points        cityBuildingForm.ts:7,16-19
    powerW                 number, W, optional, 0 to 1e9                            city.ts:60,316-318
    solarKWp               number, kWp, optional                                    city.ts:61
    batteryKWh             number, kWh, optional                                    city.ts:62
    tankCapacityL          number, L, optional                                      city.ts:63
    hoursPerDay            number, h, optional, 0 to 24                             city.ts:64,319
  dataCentre               optional. One scenario for the whole city                city.ts:66-78,86
    racks                  whole number, 0 to 100,000                               city.ts:356-357
    kWPerRack              number, kW, 0 to 1,000                                   city.ts:358
    utilisation            number, 0 to 1                                           city.ts:359
    pue                    number, 1 to 5                                           city.ts:360
    annualHours            number, h, 0 to 8,784                                    city.ts:361
    pvKWp                  number, kWp                                              city.ts:362
    yieldKWhPerKWp         number, kWh/kWp/year, 0 to 8,760                         city.ts:363
    batteryKWh             number, kWh                                              city.ts:364
    batteryUsableFraction  number, 0 to 1                                           city.ts:365
    wueLPerKWh             number, L per IT kWh, optional, 0 to 100                 city.ts:76-77,366
Not in the design: the building library (device storage)                            cityLibrary.ts:6-14
Not in the design: the orders plan (device storage, optional merchant copy)         cityProcurementStore.ts:16,52
```

The site (the plot):

```
Property.site              Site or null, optional. Absent = unlimited land          propertyStore.ts:232-242,363
  widthM                   number, m, clamped 1 to 500                              propertyStore.ts:237,245-246,474-478
  depthM                   number, m, clamped 1 to 500                              propertyStore.ts:238,479
  originM                  {x, y} m. Top-left of the plot; default (0, 0)           propertyStore.ts:239,481-487
  world                    optional, opaque until checked. Holds the map site       propertyStore.ts:240-241,488-490
                                                                                    hydration.ts:23-37
    version                1                                                        site/types.ts:50
    name                   string, up to 160 characters                             site/types.ts:51,191
    origin                 [lon, lat] degrees. Equals the first corner              site/types.ts:52; site/geometry.ts:210
    boundary[]             [lon, lat], 3 to 200 corners                             site/types.ts:53,183-186
    polygon[]              {x, y} plan m, same count as boundary                    site/types.ts:54-55,187-189
    anchor                 {x, y} plan m. Where the first corner sits               site/types.ts:56; site/geometry.ts:211-214
    entry                  'drawn' or 'traverse'                                    site/types.ts:57
    traverse[]             optional. {lengthM m, bearing text}, up to 200           site/types.ts:58,285-295
    closureErrorM          number, m, optional                                      site/types.ts:59,277-280
    terrain                optional                                                 site/types.ts:8-15,60
      source               'typed what-if' or 'survey'                              site/types.ts:9
      verticalReference    string, up to 300 characters, required                   site/types.ts:10,219-220
      points[]             {x, y, z} m, 3 to 1,000                                  site/types.ts:11,222-225
      contours[]           optional. Lists of point indices                         site/types.ts:12-13,236-246
      platformM            number, m. The level the plot is cut and filled to       site/types.ts:14,221
    planning               optional                                                 site/types.ts:61,257-276
      setbackM             number, m, 0 to 1,000
      maxCoveragePct       number, %, above 0 to 100
      source               string, up to 1,000 characters
      verified             boolean. The workspace always writes false               SiteWorkspace.tsx:280
    publicData             optional snapshot                                        site/types.ts:16-48,62
      fetchedAt            time text
      solar                optional. annualKwh (kWh/kWp/year), tiltDeg, sourceUrl   site/types.ts:18-27
      context              optional. roads, buildings, waterways, power (counts),   site/types.ts:28-36
                           landuse[], sourceUrl
      terrain              optional. heightsM[] one per corner (m), resolutionM,    site/types.ts:37-46,148
                           sourceUrl, verticalReference, notes
      errors[]             optional text lines                                      site/types.ts:47
    foundationShiftM       number, m, optional, within 100                          site/types.ts:63,281-284
    sample                 true, optional. Marks a practice site                    site/types.ts:64,301-304
```

The garden:

```
Property.garden            Garden, optional                                         propertyStore.ts:373-374
  surfaces[]               no count cap                                             garden.ts:22-42,160-176
    id                     string, 1 to 100 characters                              garden.ts:25,99
    kind                   lawn, soil, gravel, path, concrete, tarmac or pool       garden.ts:5-14
    x, y                   number, m. Top-left corner                               garden.ts:27-29,107
    widthM, depthM         number, m, 0.2 to 500. depthM is a plan length           garden.ts:30-31,108
    elevationM             number, m, 0 to 2. Raised level above the ground         garden.ts:32-33,109
    pavingProductId        string, optional                                         garden.ts:34-35,119
    outline[]              {x, y} m, optional. Closed outline inside the box;       garden.ts:36-37,110-111,116
                           never on a pool
    thicknessM             number, m, optional, 0.001 to 5                          garden.ts:38-39,112
    subBaseDepthM          number, m, optional, 0 to 10                             garden.ts:40,113
    pool                   only on kind pool                                        garden.ts:41,43-53,114
      shellDepthM          number, m, 0.2 to 10. Floor to rim                       garden.ts:45,130
      waterDepthM          number, m, 0 to shellDepthM                              garden.ts:46,130
      wallThicknessM       number, m, 0.01 to 2                                     garden.ts:47,131
      baseThicknessM       number, m, 0.01 to 2                                     garden.ts:48,131
      excavationMarginM    number, m, 0 to 5                                        garden.ts:49,132
      stage                excavation, shell or filled                              garden.ts:50,132
      productReferenceId   string, optional                                         garden.ts:52,135
    pilotPermeable         boolean, never saved. Set only while drawing             garden.ts:23-24; buildingScene.ts:35
  fences[]                 no count cap                                             garden.ts:58-64
    id                     string
    a, b                   {x, y} m. The two ends; length 0.2 to 1,000 m            garden.ts:60-61,156
    heightM                number, m, 0.3 to 3                                      garden.ts:62,155
    material               timber, metal or hedge                                   garden.ts:15-20,63
```

The terrain cuts:

```
Property.terrainCuts[]     optional, up to 512                                      propertyStore.ts:346; terrainCuts.ts:10
  id                       string, exactly "x,y"                                    terrainCuts.ts:4,11,28
  x, y                     whole numbers, m. The cell's low corner; the cell is     terrainCuts.ts:5-6,12-17,24-27
                           1 m by 1 m
  topM                     number, m. Ground level when the cell was first dug      terrainCuts.ts:7,30-31,55
  depthM                   number, m, above 0 to 20, in 0.001 steps                 terrainCuts.ts:8,32-34,54
```

The eco model:

```
Property.eco               EcoModel, optional                                       propertyStore.ts:339-340; ecoContract.ts:54-61
  version                  1
  waterStudy               optional. Holds the whole study, not only water          ecoContract.ts:42-52
    region                 one of six region names                                  ecoContract.ts:43
    place                  string, optional, up to 60. Name of a reference place    ecoContract.ts:44
    kinetic, wind          boolean, optional. Show the two demonstration props      ecoContract.ts:44
    windPoint              {x, y} m, optional                                       ecoContract.ts:45
    kineticPoint           {x, y} m, optional                                       ecoContract.ts:46
    people                 whole number, 0 to 10,000                                ecoContract.ts:47
    runoff                 number, 0 to 1                                           ecoContract.ts:47
    tankL                  number, L, or null. null = use the placed tanks          ecoContract.ts:47; EcoSheet.tsx:53
    homeLDay               number, L/person/day, 0 to 1,000                         ecoContract.ts:48
    greyLDay               number, L/person/day, 0 to 1,000                         ecoContract.ts:48
    gardenLDay             number, L/m2/day, 0 to 100                               ecoContract.ts:48
    infiltration           number, 0 to 1                                           ecoContract.ts:49
    recycledPct            number, %, 0 to 100                                      ecoContract.ts:49
    aggregateTM3           number, t/m3, 0 to 5                                     ecoContract.ts:49
    mossRoom               room id or null                                          ecoContract.ts:50
    blockRoom              room id or null                                          ecoContract.ts:50
    pavingId               garden surface id or null                                ecoContract.ts:50
    coolRoof               boolean                                                  ecoContract.ts:50
  trees[]                  up to 300                                                ecoContract.ts:8-24,58
    id, name               string
    x, y                   number, m
    heightM                number, m, 0.1 to 100
    canopyRadiusM          number, m, 0.1 to 50
    status                 existing or proposed
    species                string, optional
    stemDiameterMm         number, mm, optional, 1 to 5,000
    protectionMethod       unconfirmed, bs5837-single-stem or surveyed
    protectionRadiusM      number, m, optional
    surveyRef              string, optional
    veteran                boolean, optional
  greenRoofs[]             up to 100, one per roof room                             ecoContract.ts:27-40,59,78-87
    id, name               string
    roomId                 id of a roof room
    areaM2                 number, m2, optional. Default: the roof room's area      eco.ts:48-49
    saturatedKgM2          number, kg/m2, optional
    extraRetainedWaterMm   number, mm, optional
    additionalLoadCapacityKPa  number, kPa, optional
    capacityRef, specificationRef  string, optional
Property.engineering       optional. version 1 and five optional reference strings  ecoContract.ts:91-100; propertyStore.ts:341-342
Energy inputs sit on placed items and products, not in eco:
  item.powerOn             boolean, optional. false = off for the estimate          designer/energy.ts:53-54
  item.hoursPerDay         number, h, optional                                      designer/energy.ts:55-56
  item.powerW              number, W, optional. The user's own figure               designer/energy.ts:57-62
  item.lightOn             boolean, optional                                        designer/energy.ts:51-52
  product fields           power_w, duty_hours_per_day, pv_wp, battery_kwh,         designer/energy.ts:31-45
                           inverter_kw, energy_role, placement, emits_light
Not in the design: programme pins {id, name, kind, lanes[], lat, lon, place,        programme.ts:2-12,60-68
                           state, note}, held in tab memory
```

Load behaviour: `city` and `eco` are checked whole and become nothing when one value fails (`propertyStore.ts:2204-2205,2263-2264`; `city.ts:189`; `eco.ts:16-19`). The garden drops only its bad entries (`garden.ts:160-176`). Bad cuts drop the whole list (`propertyStore.ts:2207,2259`). The plot is clamped and keeps `world` untouched (`propertyStore.ts:471-491,2280-2281`).

## 4. Caps and limits

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

## 5. Rules a second front must copy

Frame and units
- Metres everywhere. x right (east), y down (south), z up. A plan point (x, y, height) becomes a 3D point (x, height, y). `city.ts:2`; `CityThreeView.tsx:42`; `gardenMeshes.ts:190`; `sunPosition.ts:10-13`; `site/geometry.ts:11`.
- A city item turns clockwise in degrees about its centre, stored 0 to 360. `city.ts:50,337,414-427`. The 3D view uses the negative angle. `CityThreeView.tsx:76`.

Plot
- Plot = `originM` plus `widthM` by `depthM`, each side 1 to 500 m. `propertyStore.ts:236-246,471-491`.
- Nothing is built outside it: rooms, walls, items, bends. `RoomCanvas.tsx:1374,2256-2257`; `propertyStore.ts:2052-2053`; `surfaceActions.ts:393-403`.
- Map boundary: 3 to 200 corners, 500 m across at most. Projection: a local tangent plane at the first corner with a = 6,378,137 m and e2 = 0.0066943799901413165, then shifted by the anchor. `site/geometry.ts:3-22,108-112,202-218`.
- The saved plot of a map site is the bounding rectangle of its outline. `SiteWorkspace.tsx:319-326`.
- Local land units: 1 perch = 42.21 m2; 1 arpent = 4,221 m2. `site/geometry.ts:58-59`.
- With no plot the land is a 600 m square centred on the origin. `outdoor.ts:34-35`; `earthworkMeshes.ts:47-52`.
- Lawn: over the plot rectangle, or over the house bounds plus 3 m. `gardenSurround.ts:9,70-76`. Lawn top at -0.0005 m. `gardenGround.ts:7`.

Dig cells
- A cell is 1 m by 1 m with corners on whole metres; its id is "x,y". `terrainCuts.ts:11-17`.
- Depth above 0 to 20 m in 0.001 m steps; 5 m a stroke at most; the default stroke is 0.25 m. `terrainCuts.ts:34,47,54`; `EarthworkTool.tsx:25`.
- Bottom = `topM` minus `depthM`. `topM` = ground-floor level plus the garden raise at the cell centre, fixed at the first dig. `terrainCuts.ts:55,71`; `EarthworkTool.tsx:107-109`.
- A side wall rises from the bottom to the neighbour's bottom, or to the top when there is no neighbour. `terrainCuts.ts:81-87`.
- No digging under a ground-floor room. Fill only refills a dug cell. `EarthworkTool.tsx:79-99`; `terrainCuts.ts:53`.
- 512 cells at most. `terrainCuts.ts:10`.

Garden
- Draw snap 0.1 m; smallest side 0.2 m; raise 0 to 2 m. `garden.ts:86-95,109`.
- At equal height the later patch wins; a higher patch covers a lower one. `gardenMeshes.ts:197-199`; `garden.ts:75-83`.
- Pool, with W and L the inner sizes, t the wall, m the margin: excavation = (W + 2t + 2m)(L + 2t + 2m)(basin + base); water litres = W x L x water depth x 1,000; lining = W x L + 2(W + L) x basin depth. `outdoorTakeoff.ts:19-36`. Defaults 1.5, 1.35, 0.2, 0.2 and 0.3 m. `garden.ts:54-57`.
- Fence: posts 2 m apart at most; a hedge is 0.5 m thick. `gardenMeshes.ts:169,172`.
- Paving rows: columns = ceil(width / tile width), rows = ceil(depth / tile depth), whole pieces. `gardenPaving.ts:24-26`.

Roads and utilities
- Road templates as width / surface / base in metres: 6 / 0.05 / 0.2; 4 / 0.08 / 0.2; 3 / 0.05 / 0.15; 8 / 0.08 / 0.3. `city.ts:101-130`.
- A road or trench footprint is one butt-ended strip per segment; a crossing counts once. `city.ts:394-410`; `cityContract.ts:113-116`.
- A new utility starts at z = -1 m, 100 mm diameter, trench 0.6 m wide and 1.2 m deep. `CityWorkbench.tsx:255-258`. The pipe must fit its trench and stay inside it. `city.ts:272-273,616-624`.
- Colours per utility system and per item kind. `city.ts:131-148`.
- City grid snap 0.5 m. `CityPlanView.tsx:165`.
- Default item sizes as width, length, height. `CityWorkbench.tsx:48-58`.
- Building form: an outline in a unit box from -0.5 to 0.5, scaled by width and length; base and top are fractions of the height. `cityBuildingForm.ts:23-30`; `CityThreeView.tsx:81-92`.
- Takeoff formulas. `city.ts:543-729`. Data-centre formulas: IT kW = racks x kW per rack x utilisation; facility kW = IT kW x PUE. `city.ts:519-541`.
- Nearest-line distance for a building. `cityAccess.ts:3-13`.

Sun
- Reference point for every design: latitude -20.33 degrees, longitude 57.37 degrees, UTC+4. `sunPosition.ts:40,72`.
- Declination and equation of time from the day of the year. `sunPosition.ts:52-66`. Hour angle = true solar minutes / 4 - 180. `sunPosition.ts:74-78`. Elevation and azimuth. `sunPosition.ts:82-94`.
- Direction to the sun in the plan frame = (cos el x sin az, -cos el x cos az, sin el). `sunPosition.ts:98`.
- Daylight = clamp((elevation + 6) / 16, 0, 1). `sunPosition.ts:100`. Sunrise and sunset at -0.833 degrees. `sunPosition.ts:104-116`.
- Sun colour runs from warm to neutral between 0 and 35 degrees. `sunPosition.ts:124-132`.
- Lamps = clamp((8 - elevation) / 10, 0, 1). `lighting.ts:91-93`.
- Slider 06:00 to 20:00; switching daylight on starts at 15:30; the day is today's date. `RoomViewControls.tsx:244,253-255`; `ThreeStage.tsx:1038`.

Energy
- Daily solar Wh = Wp x 5.17 h x 0.775. `solarCalc.ts:37-42`; `mauritiusSolar.ts:59,63`; `useEnergyReport.ts:68-69`.
- Daily load Wh = watts x hours, hours 24 at most, 2 by default. `solarCalc.ts:45-47`; `designer/energy.ts:74,115-120`.
- Watts: the typed value, else the product's, else the reference table. `designer/energy.ts:109-113,153-160`.
- Status: none; covered when net is 0 or more; partial from 50%; else short. `designer/energy.ts:380-385`.
- Panels to cover = ceil(gap / (Wp x 5.17 x 0.775)). Roof fit = floor(roof m2 x 0.85 / panel m2). `solarCalc.ts:76-87,96,112-122`.
- Battery hours = kWh x 1,000 x 0.9 / (daily Wh / 24). `solarCalc.ts:141-150`; `designer/energy.ts:76`.
- Yearly: made = kWp x yield; used = daily kWh x 365; cover = min(100, made / used). Default yield 1,462.16 kWh/kWp/year; the ten places run from 1,324.6 to 1,629.4. `eco/energy.ts:8-16`; `mauritiusSolar.ts:61`; `places.ts:53,89`.
- Meter words by cover percent. `energyMeter.ts:37-47`.

Water
- Per month: caught L = rain mm x roof m2 x runoff; house L = days x people x rate; garden L = days x green m2 x rate; greywater used = min(garden, days x people x rate); infiltration = paving m2 x rain mm x fraction. `water.ts:21-22`.
- Day loop: fill, spill above the tank size, the house draws first, the garden second; the tank starts empty. `water.ts:19,25-30`.
- Defaults: 2 people, runoff 0.8, 45 and 15 L/person/day, 2 L/m2/day, infiltration 0.5, density 1.5 t/m3. `water.ts:17`.
- Rain: 6 regions by 12 months in mm. `water.ts:7-14`.

Materials and plants
- Wall finish area = sum of (edge length x storey height - openings), skipping removed and glass edges. `quantities.ts:15-23`.
- Cool roof m2 = roof plan m2 / cos(pitch). Stone displaced t = aggregate m3 x density x recycled % / 100. `quantities.ts:28-30`.
- Tree protection radius = min(15 m, 12 x stem diameter). `eco.ts:27-32`.
- Green roof load kPa = (kg/m2 + extra mm) x 9.80665 / 1,000. `eco.ts:51-60`.
- Pilot colours: moss wall #648153; block wall #ab9777; permeable patch #91a28c; cool roof #e7e6d6. `RoomView3D.tsx:321-323`; `gardenMeshes.ts:84`; `buildingMeshes.ts:77`.

Site maths and wording
- Cut and fill by clipping each triangle at the platform level. `site/geometry.ts:244-277`. Slope by a best-fit plane. `site/geometry.ts:279-315`.
- A setback envelope only for a convex plot. `site/geometry.ts:317-322`.
- Public terrain is never used for cut and fill. `terrain.ts:186-187`.
- The fixed banner sentence goes on every estimate screen. `site/types.ts:66-67`.

## 6. What the later map and city stages will meet

1. A map without keys already runs: vector tiles, corner drawing and place search through the server (`SiteMap.tsx:87-96,131-134`; `api/_lib/site/providers.ts:1,134-164`). It is made per Site dialog at zoom 17, with no island-wide view, no parcel layer and no satellite (`SiteMap.tsx:91`; `SiteWorkspace.tsx:563`).
2. Projection both ways exists (`site/geometry.ts:12-44`), and the payload already stores the lon/lat boundary beside the plan polygon (`site/types.ts:49-65`).
3. An island outline as two coastline polygons with a small projection sits in the members' area (`src/pilots/mauritius.ts:1-2`; `src/pilots/projection.ts:7-21`; `src/pilots/PilotMap.tsx:5-8`).
4. Ten reference points carry a rain region and a solar yield (`places.ts:2-93`), but a plot gets them by a picked name, not by its position (`EcoSheet.tsx:234-236`).
5. Elevation: the server already decodes public terrain tiles at zoom 12, about 30 m, but only at the boundary corners and 4 tiles a request (`api/_lib/site/providers.ts:303-365`). A height field needs a grid sampler and a new saved field.
6. The terrain call allows three source families only and refuses when the source header is missing (`api/_lib/site/providers.ts:298-302,327-334`). Check the island's cover before promising real slope.
7. Slope and cut/fill maths exist for a triangulated surface (`site/geometry.ts:244-315`; `terrain.ts:185-225`).
8. Blocks: one plot a design, a rectangle of 1 to 500 m (`propertyStore.ts:244-246,363`); a map boundary is refused above 500 m or 0.1 by 0.01 degree (`site/geometry.ts:108-112,196-200`).
9. Blocks: the ground is flat in every 3D view: one lawn level (`gardenGround.ts:7,46`), one city plane (`CityThreeView.tsx:203-207`), dig cells with one flat top and bottom each (`terrainCuts.ts:7,71`; `outdoor.ts:39`), trench volumes on a flat datum (`city.ts:435`).
10. Blocks: 3D, Walk and the dig tool use the plot's bounding rectangle, not its true outline (`gardenSurround.ts:70-71`; `buildingScene.ts:42`; `EarthworkTool.tsx:51-64`).
11. City join: the city shares the house's metre frame (`city.ts:2`) and may hold 64 buildings inside 10 km (`city.ts:89-96`). It has its own renderer (`CityThreeView.tsx:350`), its own rectangle with no lon/lat (`city.ts:82`), and its buildings are copied outlines with one optional link named `current` (`city.ts:58,322`; `cityLibrary.ts:52-54`).
12. The city has no design id per building, no zone and no junction; a crossing never connects (`city.ts:79-87,548-549`; `cityContract.ts:114`).
13. Server: the Site calls ride inside one shared function file (`api/orders.ts:1516-1517`), and the function count is capped (`AI-HANDOFF/PLAN.md:72`).
14. The demo page has no live map (`site/providers.ts:4-8`; `previewMode.ts:13-18`).

## 7. Traps

1. Three things are called site: the plot rectangle (`propertyStore.ts:236-242`), its map payload `world` (`site/types.ts:49-65`) and the city's own rectangle (`city.ts:82`). Nothing links them.
2. The Plot tool writes the plot without `world`, so locking a new size drops the map boundary, the levels and the public data (`TopBar.tsx:487`; `propertyStore.ts:490`).
3. The plan checks the true outline; the 3D lawn, wall paths and digging check the bounding rectangle (`RoomCanvas.tsx:597,1374` against `gardenSurround.ts:70-71`, `propertyStore.ts:2052-2053`, `EarthworkTool.tsx:51-64`).
4. City and eco are all-or-nothing: one bad value and the whole model loads as nothing (`propertyStore.ts:2204-2205,2263-2264`; `eco.ts:16-19`). A new field must be optional and land in the type, the normaliser, the schema and the server check together (`cityContract.ts:86-106`; `designSnapshotValidation.ts:25-35,61-78`).
5. The garden and the plot's `world` have no server check, and the garden has no count cap (`designSnapshotValidation.ts:37-59`; `garden.ts:160-176`; a search of `api/` for garden and site checks found none). The game must check them itself.
6. Orders: the Packages view is compared with a translated word, so it disappears in three of the four languages (`CityOrdersPanel.tsx:156`; `messages.ts:525,1873`).
7. Dig cells: `topM` is frozen at the first dig, Fill only refills, the tool exists only in Walk, and a pool's hole is separate from the cells (`terrainCuts.ts:53-55`; `WalkMode.tsx:269`; `gardenMeshes.ts:46-56`).
8. Sun and solar: one fixed reference point for every design (`sunPosition.ts:40,72`; `ThreeStage.tsx:1038`); two tilts, 20 and 15 degrees (`mauritiusSolar.ts:54-64`; `places.ts:10`); 365 and 365.25 days (`eco/energy.ts:11`; `solarCalc.ts:68,197`); the plot's own fetched yield never reaches the Eco sheet (`eco/energy.ts:8-9`). The city 3D view has its own fixed sun and tone mapping (`CityThreeView.tsx:267,358-359`).
9. Not loadable from the design: the building library and the orders are in device storage (`cityLibrary.ts:14`; `cityProcurementStore.ts:52`), programme pins are in tab memory (`programme.ts:60-68`), and the Energy panel's tank counts 0 L in the Eco sheet (`EnergyPanel.tsx:41,201`; `quantities.ts:26`; `serviceProducts.ts:141-143`).
10. Against this repo's own rules (`AI-HANDOFF/PLAN.md:42,61`): comments name a commercial life-sim game (`sunPosition.ts:6`; `RoomView3D.tsx:1123`; `RoomCanvas.tsx:146`), and supplier names with prices sit in source files (`GardenPanel.tsx:20-27`; `EnergyPanel.tsx:40-43`; `serviceProducts.ts:47-51`). Copy neither into the game.

## 8. Not read

- Style sheets: `src/eco/ecoSheet.css`, `src/eco/ecoVisual.css`, `src/site/site.css`, `src/components/cityWorkspace.css`, `cityOrders.css`, `CityThreeView.css`, `GardenPanel.css`.
- Tests: only the three in `src/eco/` were read. The city, site, garden, terrain, energy and sun tests were listed by name and not opened; none was run.
- Files read only at the cited lines: `RoomCanvas.tsx`, `RoomView3D.tsx` (line 2219 too long to show; two component names found in it by search), `ThreeStage.tsx`, `TopBar.tsx`, `HouseWorkspace.tsx`, `ProjectWorkspace.tsx` (36-61, 944-1183), `WalkMode.tsx` (205-294), `walk/scene.ts` (150-174), `EnergyPanel.tsx` (1-70 and searched lines), `RoomViewControls.tsx` (236-267), `measuredPathToolStore.ts` (80-104), `sharedBuild/contract.ts` (70-109), `propertyStore.ts` (the cited ranges).
- Found by search only: `SurfaceActions.tsx` (lines 62, 128, 582), `aiDesignContract.ts`, `lessonData.ts`, `messages.ts`, `src/i18n/AppPreferences.tsx`, `src/demo/pitchEmbed.ts`, `buildingMeshes.ts`, `api/orders.ts` (lines 775, 1516-1517), `api/_lib/sharedBuild/handler.ts`.
- Data rows: `citySuppliers.ts` after line 22, `applianceLoads.ts` after line 60, `serviceProducts.ts` outside 44-65 and 138-145, `src/data/outdoorPaving.ts`, `src/data/mauritiusPools.ts`, `src/data/products.json`, `src/pilots/mauritius.ts` after its first two lines.
- Not opened: `src/designer/sustainability.ts`, `projectReview.ts`, `estimateEvidence.ts`, `propertyMaterials.ts`, `materials/estimate.ts`, `roof.ts`, `roofSurface.ts`, `foundation.ts`, `boundaryModel.ts`, `measuredPath.ts`, `shade*.ts`, `link/planView.ts`, `link/exchange.ts`; `src/components/three/BoundaryEditor.tsx`, `EnergyMeterBar.tsx`, `ShadeWorkspace.tsx`; `src/lib/placementActions.ts`, `wallPen.ts`; the other walk files (runtime, collision, navigation, placement).
- Server: `api/_lib/cityProcurement.ts`, `api/_db/cityProcurementStore.ts`, `api/_db/schema.ts`, `api/_lib/site/__tests__/providers.test.ts`.
- `src/pilots/`: only the export lines and first screens of the view files; none of its data, money, ledger, funder, report or store modules.
- The private and public build split (build tooling, edge gate) and `docs/`: not opened. The private-page claim rests on `ProjectWorkspace.tsx:37-42,57,268` and `SiteWorkspace.tsx:50` alone.
- The two notes of 16 Nov 2026 were read first. Their claims about `docs/`, the build split, test counts and the live site were not re-checked.
