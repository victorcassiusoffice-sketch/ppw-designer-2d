# SCAN: SERVICES-TRADES (read 2026-11-20 13:57 MU, code at d678c92)

Read-only scan. Branch `world/s00-s01-scan-rails`, HEAD `7e922f3`. `git diff --stat d678c92 HEAD -- src api` printed nothing; the only changed files since `d678c92` are four files in `AI-HANDOFF/`. Paths are from the repo root. "WS" below means the Services workspace: a full-screen editor with its own 2D plan and its own 3D, apart from the main Plan, the main 3D and Walk.

## 1. Inventory

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

## 2. Tool by mode

Every WS tool works in WS's own 2D and its own 3D only. In the main Plan, the main 3D and Walk a run or fixture can be seen, opened, bent or removed, never drawn or moved. Proofs in this table use the bare file name where section 1 gives the full path.

| Tool | Today on the web (works in: Plan 2D, 3D, Walk) | FP: first person with powers | 3D build view | BLK: block-style dig and place | Best mode | Missing on the web | Needed in the game |
|---|---|---|---|---|---|---|---|
| Draw a service run (8 systems) | WS only: tap points or drag segments, then Finish run. `ServicesWorkspace.tsx:399-469, 552-585` | Grab a pipe or wire end by telekinesis, pull it along the wall or trench, release. | Click the start, click each bend, double-click to end. | Lay one piece per cell along the dug trench; turns make elbows. | BLK | Drawing in the main Plan and 3D; finish by double tap. | A run actor that writes `points` with a height on every node. |
| Place a service fixture (13 kinds) | WS only: pick the kind, tap the spot; default size, turn 0. `ServicesWorkspace.tsx:535-550, 779-795` | Pick the box from the air bar, set it on a wall or floor by telekinesis. | Drag from the tray, drop, turn with a key. | Put the box into a cell or onto a block face. | 3D | Wall snap, mount height on drop, pictures in the picker. | One mesh per kind with sockets at the code's port offsets. |
| Move a fixture | WS only: press Move, tap the new spot; linked run ends follow. `ServicesWorkspace.tsx:522-529` | Grab, carry, drop; linked pipes follow. | Drag it; linked ends follow live. | Pick the block up, place it again. | FP | Drag in place of tap; moving up or down. | Run the link resolve after every move. |
| Turn a fixture | WS only: one button, 90 degrees per press. `ServicesWorkspace.tsx:1488-1492` | Hold the grab and roll to turn. | Select, press a turn key. | Cycle four facings before placing. | 3D | A free angle; turning while placing. | Ports worked out with the same turn maths. `serviceConnections.ts:73-85` |
| Move a run node or change its height | WS only: drag the node (height kept) or type X, Y, height. `ServicesWorkspace.tsx:1007-1023, 1521-1543` | Grab a joint and pull; a key lifts or lowers it. | Drag the joint on its level; a modifier drag changes height. | Break the piece, lay it one cell over or up. | 3D | A height handle; the 3D drag stays on one level plane. | A height on every node; no interpolation left to guess. |
| Add or remove a bend | WS only: buttons Insert bend after, Remove bend. `ServicesWorkspace.tsx:1560-1592` | Aim at mid-pipe and pull sideways. | Click mid-pipe to add; Delete to remove. | Bends come from where the pieces are laid. | 3D | Adding a bend by tapping the pipe. | The 500-point cap per run. |
| Connect a run end to a fixture | WS only: tap a port while drawing, drop the end within 15 cm, or use a list. `ServicesWorkspace.tsx:406-417, 626-641, 1603-1643` | Push the pipe end onto a lit port; it locks. | Drag the end to a port that lights up. | The last piece next to a fixture face joins it. | FP | The refusal reason shown at the port; links across floors. | The same test: same system, same floor, port height known. |
| Join two runs | WS only: tap another run's node while drawing, or drop a node within 15 cm. `ServicesWorkspace.tsx:418-431, 643-661` | Push a pipe end onto another pipe's joint. | Drag an end onto a joint. | Place a tee piece where the lines meet. | BLK | Joining in the middle of a segment; a tee count. | A junction object with its own id; a crossing never joins. |
| Carry on from a run's end | WS only: Continue from end starts a new run joined there. `ServicesWorkspace.tsx:668-680, 1593` | Grab the open end, keep pulling. | Click the open end, keep clicking. | Lay the next piece. | BLK | It makes a second run, never a longer one. | One behaviour chosen and used on both fronts. |
| Choose material and size | WS only: preset list per system; diameter box, 5 to 1000 mm. `ServicesWorkspace.tsx:1650-1696` | Wheel menu on the held pipe. | Dropdown on the selection. | One hotbar slot per size. | 3D | Size chips with pictures; no sizing help. | The same preset ids, so stock counts match. |
| Edit fixture size, base height, port heights | WS only: number boxes in the side panel. `ServicesWorkspace.tsx:1375-1407, 1450-1472` | Open the hand tablet on the held box. | Side panel; drag size handles. | Side panel. | 3D | Handles; common wall heights as buttons. | The drain connection stays unusable until its height is typed. |
| Remove a run or fixture | WS: Remove. Plan and 3D: long press or right click, then Remove; or erase tool, tap. `SurfaceActions.tsx:243-262, 297-320, 636` | Aim and hold the remove power. | Select, press Delete. | Break the pieces one by one. | BLK | Removing part of a run; many at once. | Junctions no run uses are dropped. `ServicesWorkspace.tsx:692-703` |
| Pull a curve into a run | Plan and 3D: menu Pull curve, drag the segment. `SurfaceActions.tsx:160-163, 595`; `surfaceActions.ts:412-432` | Grab mid-pipe, pull to bow it. | Drag the segment's middle handle. | Not used; lay pieces. | 3D | Only a many-point line; no flexible pipe kind. | Sampled points with heights kept. |
| Dig or fill the ground | Walk only: Dig / fill, tap or sweep 1 m cells. Plan and 3D show them. `EarthworkTool.tsx:24-27, 150-189`; `WalkMode.tsx:269` | Aim the dig power, hold and sweep along a line. | Drag a trench line on the ground, set the depth. | Break ground blocks; place blocks to fill. | BLK | Digging in Plan and 3D; cells under 1 m; a trench tied to a run. | A trench object: its cells, its depth and the run inside it. |
| Place a solar panel | Energy panel: one button drops it on a free roof cell; Plan and 3D: tap the roof. `EnergyPanel.tsx:168-184`; `RoomView3D.tsx:1704-1705` | Jetpack up, drop the panel by telekinesis; it snaps to the array. | Drag from the tray onto the roof. | Lay panel tiles on roof blocks. | FP | Placing in Walk; any cable to the inverter. | The roof-only rule and the array grid. |
| Place a water tank | Energy panel button arms it; tap the ground in Plan or 3D. `EnergyPanel.tsx:193-204` | Lift the tank onto the roof or a stand. | Drag from the tray. | Place a multi-cell object. | FP | Roof placing; ports; any link to pipes. | Tank as a fixture kind with inlet, outlet and litres. |
| Place or move a light | Plan and 3D: catalogue product; in 3D press it and drag. `RoomView3D.tsx:1241-1251`; `products.schema.ts:72` | Grab the light, carry it, stick it to a ceiling or wall. | Drag; it snaps by its placement kind. | Place on a block face. | FP | No wire, switch or circuit for a light. | A light point with a power port; lit only when fed. |
| Switch a light | Plan and 3D: select it, press Light on or off. `DetailsPanel.tsx:362-366`; `src/designer/FloatingCluster.tsx:197` | Look at it, press use. | Click it, toggle in the bubble. | Use key on the lamp. | FP | Wall switch objects; switching in Walk. | `lightOn` per item and the glow radius rule. |
| Place a battery, inverter or controller | Plan and 3D: catalogue products on the floor or a wall. `products.json:1110-1234`; `energy.ts:318-321` | Carry it, hang it on a wall. | Drag from the tray. | Place on a wall face. | 3D | No cable between panel, inverter, battery and board. | Power ports and a source-to-load check. |
| Set an appliance's watts, hours, on or off | Energy panel rows: type watts and hours, press the power button. `EnergyPanel.tsx:121-132, 341-351` | Use on the appliance opens a dial. | Side panel boxes. | Side panel boxes. | 3D | Totals per circuit; breaker limits. | The same fields and caps. `propertyStore.ts:1917-1973` |
| Place a paired service product | WS shelf: Place, then tap in Plan. `ServicesProductShelf.tsx:15` | Pick from the air bar, place. | Drag from the tray. | Place the object. | 3D | It is a plain product: no ports, no link to runs. | One object: the product body plus fixture ports. |
| Draw a site utility route with its trench | Site sheet 2D: network tool, tap points, finish; then set trench and node z. `CityWorkbench.tsx:183-192, 226-267` | Walk the route with the trench power; the main follows. | Click the route on the site; see the trench. | Dig the row, lay the main, fill it. | BLK | No join to the house runs; one size per route. | The pipe must sit inside its trench. `city.ts:616-620` |
| Draw a measured component | Main 3D dock and Walk bar: Components, then Add face, Edit vertex or Move. `src/components/three/BoundaryEditor.tsx:289-291`; `src/walk/WalkLauncher.tsx:128`; `WalkMode.tsx:272` | Tap points in the air with a pointer beam. | Click points; snap to wall edges. | Outline along block edges. | 3D | A Plan 2D tool; a trade or kind on a component. | The same caps and the flat-face rule. |
| Pin a trade job on the model | Plan and 3D, private path only: Pin on plan or Pin in 3D, tap a part. `TradeStation.tsx:504-509`; `TradeProgressOverlay.tsx:84-91` | Point at the part, press mark. | Click the part. | Mark a block face. | FP | Pinning in Walk; the ledger lives in one browser. | Pin = reference, floor, x, y, z, in a shared store. |
| Set a job's status | Job editor: list of five; the overlay inks the part in Plan and 3D. `TradeStation.tsx:462-472` | Look at the flag, pick from a wheel. | Click the pin, pick a status. | Same as 3D. | 3D | The overlay in Walk. | The same five states, each with symbol and word. |
| Make trade packages | Dashboard: Make packages; type company, site, phase, currency. `BuildDashboard.tsx:143-192, 476-526` | Site-office tablet, one press. | Side panel button. | Side panel button. | 3D (panel) | Air-conditioning, ventilation and extinguisher items are left out. | A read-only list; making stays on the web. |
| Edit a package's quantities | Package sheet: item, quantity, unit, reference per line; add or remove. `BuildControls.tsx:174-230` | Tablet list. | Side panel list. | Side panel list. | 3D (panel) | A jump from a line to its part on the plan. | Nothing at first. |
| Send a work file, add an answer, decide | Package sheet: Build work file, download, link, QR; add answer; approve; record paid. `PackageInspector.tsx:224-301, 367-402` | Not a world tool; a tablet shows the status. | Panel. | Panel. | 3D (panel) | Files are passed by hand; trade rates are never read. | Status display only; no money steps. |
| Sync measured components, sign a stage | Shared project workbench: sync, patch, set member, review stage. `sharedSpecsContract.ts:69-74` | Tablet checklist. | Panel. | Panel. | 3D (panel) | Not known: the screen was not read (section 7). | The stage list as a checklist. |
| Enter material rates | Materials cost panel: pick the tax basis, type a rate per line. `MaterialsCostPanel.tsx:8-27` | Tablet. | Panel. | Panel. | 3D (panel) | Services and labour are not in it. | A read-only total. |
| Change the cart | Cart: quantity, remove a line; Request quote sends design and totals. `cartStore.ts:176-205`; `TopBar.tsx:1064-1092` | Tablet. | Panel. | Panel. | 3D (panel) | Runs and fixtures never reach the cart. | A read-only running total. |

## 3. Service data shapes

All sit inside the one design object `Property` (`src/store/propertyStore.ts:338-384`).

**Run: `ServiceRun`** in `property.services.runs[]`. All 8 systems share this one shape.
- `id`: string, 1 to 128 chars, unique across runs, fixtures and junctions (`src/designer/buildingServices.ts:48, 117, 135-137`)
- `levelId`: string, the floor it belongs to; one floor per run (`:49, 137`)
- `system`: one of the 8 ids (`:50, 144`)
- `materialId`: string; a preset id or any text (`:51, 145`)
- `diameterMm`: number, mm, 5 to 1000; a nominal size, not a bore (`:52, 146`; `src/data/buildingServicesCatalog.ts:18-19`)
- `points`: 2 to 500 points (`:53, 149-151`)
- `startElevationM`, `endElevationM`: number, m, -20 to 20; centre-line height above that floor's finished level; negative is below the floor (`:54-56, 147-148`)
- `startConnection`, `endConnection`: optional `{fixtureId, portId}` (`:57-59, 181-182`)
- refused when: shorter than 0.01 m in 3D (`:188`); an end carries both a fixture link and a junction id (`:183-187`)
- connects when: see "Connection rule" below.

**Point: `ServicePoint`**
- `x`, `y`: number, m, -10000 to 10000; plan axes, x right and y down (`:32-33, 159-160`; `docs/link/PLAN-VIEW-CONTRACT.md:25`)
- `elevationM`: optional number, m, -20 to 20; when absent the height is interpolated from the run's start and end heights by plan distance travelled, or by index on a vertical-only run (`:34-35, 161, 264-281`)
- `junctionId`: optional string (`:36-37, 162`)

**Fixture: `ServiceFixture`** in `property.services.fixtures[]`
- `id`, `levelId`: as for a run (`:62-63`)
- `kind`: one of 13 (`:64, 198`)
- `x`, `y`: number, m; the centre in plan (`:65-66`; `src/designer/serviceFixtures.ts:10-11`)
- `widthM`, `depthM`, `heightM`: number, m, 0.005 to 5 (`:67-69, 201-203`)
- `rotation`: number, degrees clockwise in plan, stored 0 to 360 (`:70, 204, 218`)
- `elevationM`: optional number, m; bottom of the box above the floor; absent means 0 (`:71-72, 205`; `src/designer/serviceConnections.ts:92`)
- `productReferenceId`: optional string; an equipment reference, not a proof of size (`:73-74`)
- `portElevationsM`: optional map from system id to m; typed port heights (`:75-76, 220-227`)
- `connectionLabel`: optional string; a project reference (`:77-78, 228`)
- connects when: a fixture does not connect by itself; its ports do.

**Port (worked out, never saved): `FixtureServicePort`** (`src/designer/serviceConnections.ts:15-23`)
- one port per system per fixture; the port id is the system id (`:18, 82`)
- offset from the centre is a fraction of width (x) and depth (y), then turned by `rotation` (`:73-85`)
- height = the typed `portElevationsM` value, else base elevation + the default below; `null` means "type it first" (`:88-92`)
- by kind:
  - toilet: cold-water at (-0.3, -0.4), 0.72 x height; waste at (0, 0), 0.14 m (`:27-31`)
  - sink: cold-water at (-0.25, -0.4) and hot-water at (0.25, -0.4), 0.68 x height; waste at (0, 0), 0.5 x height (`:32-37`)
  - mains-tap: cold-water at (0, 0), 0.6 x height (`:38-45`)
  - electrical-board: electrical at (0, 0), 0.5 x height (`:46-53`)
  - sewer-connection: waste at (0, 0), no default height (`:54-55`)
  - air-conditioner: electrical, refrigerant, waste; outdoor-ac: electrical, refrigerant; air-grille: ventilation; extractor-fan: ventilation, electrical; sprinkler: fire-water; security-camera: electrical, data; network-switch: electrical, data (`:56-64`); each at x = -0.3 + 0.3 x its index, y = -0.4, 0.5 x height (`:65-72`)
  - fire-extinguisher: no port (absent from `:27-64`)

**Junction: `ServiceJunction`** in `property.services.junctions[]` (optional list)
- `id`, `levelId`, `system`, `x`, `y` (m), `elevationM` (m, -20 to 20) (`src/designer/buildingServices.ts:39-46, 235-255`)

**Connection rule (the whole of it)**
- A run end connects to a port when all hold: the fixture exists; it is on the run's floor; the port id equals the link's `portId` and the run's `system`; the port height is not `null` (`src/designer/serviceConnections.ts:109-115`). The end then takes the port's x, y and height (`:131-143`).
- A run node connects to other nodes when it carries the `junctionId` of a junction with the same floor and system; the node then takes the junction's x, y and height (`:125-130`).
- Making a junction needs: two existing nodes, same system, same floor, not the same node; a fresh id not used by any run, fixture or junction; the junction sits at the target node's 3D point; an end that joins a junction loses its fixture link (`:226-294`).
- A crossing of two lines is never a connection (`src/designer/buildingServices.ts:36, 57`; `src/designer/serviceConnections.ts:1-2`).
- Nothing links two floors: a link to a fixture on another floor is reported as disconnected (`:184-186`).
- Nothing walks the network: no source, no outlet, no flow, pressure, load, circuit or size check exists in `buildingServices.ts`, `serviceConnections.ts`, `serviceRouteEditing.ts` (all read in full).
- What counts as an error. Refused, not saved: bad number or limit, a run under 0.01 m, an end with two attachments, an unknown floor (`src/store/propertyStore.ts:1818-1821`). Refused while drawing: port of another system, port with no height, node of another system, a point after an end link (`src/components/ServicesWorkspace.tsx:410-423, 439-442`). Saved with a warning: fixture removed, fixture on another floor, port mismatch, missing drain height, unresolved junction (`src/designer/serviceConnections.ts:183-190, 205-219`); material not matched, drainage fall of 0 or less, below-ground run inside a tree zone (`src/designer/projectReview.ts:428-447, 575-603`).

**Systems**

| System id | Label in code | Layer | Trade package | Fixture ports that accept it |
|---|---|---|---|---|
| `cold-water` | Cold water | plumbing | plumbing | toilet, sink, mains-tap |
| `hot-water` | Hot water | plumbing | plumbing | sink |
| `waste` | Drainage | plumbing | plumbing | toilet, sink, sewer-connection, air-conditioner |
| `electrical` | Electric conduit | electrical | electrical | electrical-board, air-conditioner, outdoor-ac, extractor-fan, security-camera, network-switch |
| `ventilation` | Ventilation | hvac | none | air-grille, extractor-fan |
| `refrigerant` | Refrigerant | hvac | none | air-conditioner, outdoor-ac |
| `fire-water` | Fire water | fire | plumbing | sprinkler |
| `data` | Data / security | security | electrical | security-camera, network-switch |

Proof: labels `src/designer/buildingServices.ts:87-96`; layers `src/designer/disciplineVisibility.ts:6-12`; packages `src/designer/link/packages.ts:45-48`; ports `src/designer/serviceConnections.ts:27-64`. Fixture packages: toilet, sink, mains-tap, sewer-connection, sprinkler go to plumbing; electrical-board, network-switch, security-camera to electrical; the other five kinds to none (`src/designer/link/packages.ts:49-52`). The `electrical` system is a conduit: there is no cable, socket, switch or light-point entity; `data` has one cable preset (`src/data/buildingServicesCatalog.ts:131-139, 184-194`).

**How it is drawn**
- WS 2D: body line at the outside diameter when the preset matches, else at `diameterMm`; a thin line dashed when the start is below the floor; node dots; port dots; fixture box (`src/components/ServicesWorkspace.tsx:1135-1252`).
- Main plan: line at `diameterMm`, at least 2 px; a ring where a riser stands; a glyph per fixture kind (`src/components/ServiceRoutesPlanLayer.tsx:11-12`; `src/components/ServiceFixturesPlanLayer.tsx:40-325`).
- Main 3D: cylinders of radius (matched outside diameter, else `diameterMm`) / 2000 m at floor elevation + node height; a fixture body scaled to its box (`src/components/three/serviceRouteMeshes.ts:11-29`; `src/components/three/serviceFixtureMeshes.ts:228-242`).
- Walk: no code of its own; see the inventory row "Services in Walk". A search of the non-test files in `src/walk/` for "service", "pipe" and "fixture" found two hits, both a test pose in `src/walk/runtime.ts:209, 601`; no service collision or pick was found there.

**Site main: `CityNetwork`** in `property.city.networks[]` (`src/designer/city.ts:34-45, 79-87`)
- `id`, `name`: strings
- `system`: water, sewer, stormwater, power or fibre (`:13`)
- `points`: 2 to 65 of `{x, y, z}` in m; z is height against a flat ground at 0, -30 to 100 (`:10-12, 275-278`)
- `diameterMm`: number, mm, 1 to 5000; an outside envelope (`:39-40, 269`)
- `trenchWidthM`: m, 0.05 to 20; `trenchDepthM`: m, 0.05 to 30 (`:41-42, 270-271`)
- `supplierRef`, `stockLengthM` (m, 0.1 to 10000): optional (`:43-44, 274`)
- connects when: no connection rule in the code. The only tie is geometric: the pipe must lie inside its own trench (`:616-620`).

**Site equipment: `CityAsset`** in `property.city.assets[]` (`src/designer/city.ts:46-65`)
- `kind` among others: solar-light, pv-array, battery, water-tank, transformer, ev-charger
- `x`, `y` (m, centre), `widthM`, `lengthM`, `heightM` (m), `rotation` (degrees clockwise)
- optional ratings: `powerW` (W), `solarKWp` (kWp), `batteryKWh` (kWh), `tankCapacityL` (L), `hoursPerDay` (h, 0 to 24) (`:60-64, 316-319`)
- connects when: no connection rule in the code.

**Dug ground: `TerrainCut`** in `property.terrainCuts[]` (`src/designer/terrainCuts.ts:3-9`)
- `id`: string, always `x,y` (`:11, 28`); `x`, `y`: whole metres, the cell's corner; the cell is 1 m by 1 m (`:2, 12-17, 24-25`)
- `topM`: m, ground height at the cell; `depthM`: m, over 0 up to 20 (`:30-34`)
- connects when: no connection rule in the code. A run and a cut never refer to each other.

**Placed products that act as service equipment** in `property.rooms[].placedItems[]`
- `PlacedItem`: `instanceId`, `productId`, `x`, `y` (m, top-left of the turned footprint), `rotation` (degrees), optional `parentInstanceId`, `mountHeightCm` (cm), `lightOn`, `powerOn`, `hoursPerDay` (h), `powerW` (W) (`src/store/propertyStore.ts:193-229`; anchor shown by `src/designer/link/planGeometry.ts:81-83`)
- product fields read: `dimensions_cm` (cm), `placement` (floor, surface, wall, ceiling, roof), `mount_height_cm`, `emits_light`, `light_radius_m` (m), `outdoor`, `power_w` (W), `duty_hours_per_day` (h), `pv_wp` (Wp), `battery_kwh` (kWh), `inverter_kw` (kW), `energy_role` (`src/data/products.schema.ts:72, 84, 99-106, 212-262`)
- paired product extras: `systems`, `shape`, `dimensionsMm` (mm), `capacityLitres` (L), `weightKg` (kg), `placement` (floor or wall), `outdoor`, `pipe {stockLengthM, publishedWidthMm, boreVerified: false}` (`src/data/serviceProducts.ts:5-33`)
- the tank in the bundled catalogue is a floor, outdoor product (`src/data/products.json:1263-1264`); PV panels are roof products (`:1008, 1042, 1076`)
- connects when: no connection rule in the code. A placed item has no port and no link field; a run's `fixtureId` is looked up in `services.fixtures` only (`src/designer/serviceConnections.ts:110`). A light, a panel, a battery, an inverter and a tank therefore connect to nothing.

**Energy balance (worked out, never saved): `EnergyReport`** (`src/designer/energy.ts:222-262`)
- every placed item in every room counts by being there; no wiring is read (`:300-303`)
- status: none, covered, partial (50 percent or more), short (`:380-385`); `inverterOk` and `batteryAutonomyHours` are the only pass or fail style outputs (`:406-408`)

**Shapes sent to the sister trades app**
- Plan view run: `{id, levelId, system, label, points: [x, y, z][], lengthM}`, 2 to 65 points (`src/designer/link/planView.ts:23`; `src/designer/link/contract/plan-view.schema.json:146-161`)
- Plan view item (placed products and fixtures alike): `{id, levelId, roomId?, label, center: [x, y], sizeM: [w, d], rotationDeg}` (`src/designer/link/planView.ts:24`; `src/designer/link/planGeometry.ts:77-84, 97-103`)
- Quantity: `{item, qty, unit, planRef?}`; a run is `olb:run:` + id in metres, a fixture is `olb:item:` + id, 1 each (`src/designer/link/packages.ts:133-146`)
- Job pin: `{levelId, x, y, z, planRef}` (`src/designer/link/tradeJobs.ts:25-30`)
- Answer line: `{kind: labour, material, callout or other; text; qty; unit; rate; amount}` (`src/designer/link/vendor/tradefolder/lib/jobPack/types.ts:4-11`)
- Format: JSON files; a work package holds one request and its plan view; a short link carries the request only (`src/designer/link/planView.ts:27, 139-154`; `src/components/build/PackageInspector.tsx:365-372`). Sent: project, site, phase, package, quantities, dates, currency, geometry, revision. Read back: quote, status, invoice. The planned budget and notes are never sent (`src/components/build/BuildControls.tsx:147-170`). Trade rates are not read: `parseRateCard` has no caller outside the vendored file (`src/designer/link/vendor/tradefolder/lib/jobPack/protocol.ts:50-57`), and the contract keeps rates private to the trades app (`docs/link/PLAN-VIEW-CONTRACT.md:32`).

**Costing on the client**
- Cart lines come from placed products, floor finishes, wall paint and cladding only (`src/store/cartStore.ts:317-415`); the 3D stage states that services never enter the cart (`src/components/three/ThreeStage.tsx:1532-1533`).
- Labour: none made by this app; labour arrives only as lines of a received quote or invoice (`src/designer/link/vendor/tradefolder/lib/jobPack/types.ts:4-11, 37-50`); both cost panels say labour is left out (`src/components/HouseCostPanel.tsx:42`; `src/designer/materials/costs.ts:91`).
- VAT: the cart does no tax maths and prints a text line (`src/pages/CartPage.tsx:347-350`); material rates need one tax basis for all lines and no tax is added (`src/designer/materials/costs.ts:69, 79-80, 91`); a quote or invoice carries `vat {rate, included}` and its total must equal the gross of its subtotal (`src/designer/link/vendor/tradefolder/lib/jobPack/protocol.ts:14-15, 86-93`).
- `POST /api/cart-quote`: in `{cart: [{productId, sku, name, quantity, unitPriceMinor, currency}]}`; out `{ok, currency, totalMinor, merchantBreakdown: [{merchantId, supplierId, currency, itemCount, subtotalMinor, items[]}]}` or `{error}` (`api/cart-quote.ts:5-8, 36-70`; `api/_lib/cart/split.ts:28-49`). Only the marketplace cart calls it (`src/pages/MarketplaceCartPage.tsx:80`).

## 4. Caps and limits

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

## 5. Rules a second front must copy

Units and axes
- Lengths in metres; x to the right and y down in plan; height up (`docs/link/PLAN-VIEW-CONTRACT.md:25`; `src/designer/city.ts:2-3`).
- Run and fixture heights are measured from their own floor's finished level; the views add the floor's elevation (`src/designer/serviceScene.ts:9, 15`; `src/designer/serviceFixtures.ts:30`).
- The web 3D maps plan (x, y, height) to (x, height, y) (`src/components/three/serviceRouteMeshes.ts:16`; `src/components/three/serviceFixtureMeshes.ts:241`).
- Fixture turn is degrees clockwise in plan; the web 3D applies minus the angle about the up axis (`src/designer/serviceFixtures.ts:11`; `src/components/three/serviceFixtureMeshes.ts:242`).
- Three unit sets live side by side: services in m with mm diameters (`src/designer/buildingServices.ts:52`), catalogue products in cm (`src/data/products.schema.ts:99-106`), paired products in mm (`src/data/serviceProducts.ts:13-14`).

Pipe and cable sizes (presets; "OD" = outside diameter)
- cold-water pressure pipe: 20, 25, 32, 40 mm OD; no stock length (`src/data/buildingServicesCatalog.ts:85-92`)
- cold-water supply coil: 25, 32, 50 mm OD; stock 50 m (`:93-101`)
- hot-water pipe: 20, 25, 32 mm nominal; stock 4 m (`:102-114`)
- above-ground drainage: 40, 50, 75, 110 mm OD (`:115-122`); sewer: 110, 160 mm OD (`:123-130`)
- electrical conduit: 20, 25, 32 mm OD; stock 50 m (`:131-139`)
- ventilation duct: 100, 125 mm nominal; stock 1 m (`:140-152`)
- refrigerant copper: 6.35, 9.52, 12.7, 15.88 mm OD (`:153-166`)
- fire pipe: nominal 25.4 mm with 33.4 mm OD; nominal 50.8 mm with 60.3 mm OD (`:167-183`)
- data cable: 5.69 mm OD (`:184-194`)
- hot-water fittings: elbow, tee, coupler in 20 and 25 mm; valve in 20 and 32 mm (`:209-238`)
- stock items sold as placed products: pipe 110 mm by 6 m; conduit 20 mm by 6 m (`src/data/serviceProducts.ts:122-126, 132-136`)
- a system with no preset starts at 20 mm with a material id of `unverified-` + the system id (`src/components/ServicesWorkspace.tsx:378-379`)
- drawn thickness uses the preset's OD only when material id, system and nominal size all match; else the nominal number (`src/components/three/serviceRouteMeshes.ts:11-13`)
- default fixture boxes, m, width x depth x height: toilet 0.4 x 0.7 x 0.78; sink 0.6 x 0.48 x 0.85; mains-tap 0.12 x 0.16 x 0.6; electrical-board 0.4 x 0.12 x 0.6; sewer-connection 0.6 x 0.6 x 0.6; air-conditioner 0.8 x 0.22 x 0.3; outdoor-ac 0.8 x 0.35 x 0.6; air-grille 0.3 x 0.1 x 0.3; extractor-fan 0.3 x 0.15 x 0.3; sprinkler 0.08 x 0.08 x 0.08; fire-extinguisher 0.18 x 0.18 x 0.55; security-camera 0.18 x 0.25 x 0.16; network-switch 0.44 x 0.25 x 0.05 (`src/designer/buildingServices.ts:101-113`)

Heights and depths
- a new run starts with both ends at -0.30 m (`src/components/ServicesWorkspace.tsx:196-197`)
- port heights and offsets: the list under "Port" in section 3 (`src/designer/serviceConnections.ts:27-72`)
- a wall product with no mount height sits at 120 cm (`src/designer/placedItemElevation.ts:6`)
- a new site main: every node at z -1 m, 100 mm, trench 0.6 m wide and 1.2 m deep (`src/components/CityWorkbench.tsx:255-258`)
- trench rule: pipe top (z + diameter / 2) at or below 0; pipe bottom at or above minus the trench depth; diameter no wider than the trench width or depth (`src/designer/city.ts:272-273, 616-620`)
- dig: 1 m cells; default step 0.25 m; a step of up to 5 m; depth up to 20 m (`src/designer/terrainCuts.ts:2, 47-48, 56`; `src/walk/EarthworkTool.tsx:25`)
- dig refused: a cell outside the plot (`src/walk/EarthworkTool.tsx:52-64`); a cell that touches a ground-floor room (`:79-99`)
- dig top height = ground floor elevation + garden height at the cell centre (`src/walk/EarthworkTool.tsx:106-109`)
- foundation excavation must contain its footing top and bottom (`src/designer/foundation.ts:149-150`)

Slopes
- fall of a run = first node height minus last node height (`src/designer/buildingServices.ts:316-318`)
- a drainage run with a fall of 0 or less gets a warning; the code sets no minimum gradient (`src/designer/projectReview.ts:441-447`)

Clearances and reach
- no clearance rule for services in `buildingServices.ts`, `serviceConnections.ts`, `serviceRouteEditing.ts` (read in full)
- snap: 0.05 m grid; angle 90 (default), 45 or free (`src/designer/serviceRouteEditing.ts:13-20`; `src/components/ServicesWorkspace.tsx:204`)
- join on drop: 0.15 m in 3D (`src/components/ServicesWorkspace.tsx:629, 647`)
- picks: WS 3D line 0.06 m (`src/components/ServicesThreeEditor.tsx:152`); build menu 0.16 m (`src/components/SurfaceActions.tsx:128`); job pin on plan the smaller of 0.35 m and 12 px (`src/components/build/tradeOverlayGeometry.ts:177`); job pin on a 3D run 8 px (`:206`)
- tree zone: a run with any node at or below ground is screened by plan distance minus half its diameter (`src/designer/projectReview.ts:575-582`)
- roof share usable for panels: 0.85 (`src/designer/solarCalc.ts:96`)

Quantities
- whole stock lengths per run = length / stock length, rounded up; no offcut shared between runs (`src/designer/buildingServices.ts:320-323`)
- length is the sum of 3D segments, risers included (`src/designer/buildingServices.ts:283-300`)
- fittings and fixtures add nothing to a pipe length (`api/_lib/designMcp.ts:354`)

Energy and light
- generation Wh per day = total Wp x sun hours x ratio; load Wh per day = watts x hours (`src/designer/solarCalc.ts:37-47`)
- defaults: 5.17 sun hours, ratio 0.775 (`src/data/mauritiusSolar.ts:59, 63`); 2 hours per day when nothing says more (`src/designer/energy.ts:74`); battery depth of discharge 0.9 (`src/designer/energy.ts:76`)
- inverter passes when its kW x 1000 is at least the peak watts, or there is no load (`src/designer/solarCalc.ts:174-179`)
- battery hours = kWh x 1000 x 0.9 / (daily load / 24) (`src/designer/solarCalc.ts:141-150`)
- a panel off the roof still counts and is flagged (`src/designer/energy.ts:311`)
- light pool radius = 3 x the longer side, held to 1.2 to 3.5 m (`src/designer/lighting.ts:23-27, 63-72`)
- 3D light: range = hypotenuse of radius and mount height; 26 cd; decay 2 (`src/designer/lighting.ts:78-88`)
- lamps fade in as the sun drops from 8 degrees to -2 degrees of elevation (`src/designer/lighting.ts:91-93`)

Stage order
- house review steps, in order: brief, survey, excavation, concrete, walls, openings, storeys, water, power, comfort, life-safety, security, roof, finishes, furniture, landscape, takeoff, review, procurement (`src/designer/houseBuildTutorial.ts:27-496`); the file calls it a review sequence, not a site method (`:24`)
- pilot stages, in order: brief, geometry, materials, engineering, supplier, logistics, client, release (`src/designer/sharedSpecsContract.ts:7`); release needs every other stage accepted at the current revision (`:189`)
- job states: planned, started, waiting, done, snagged (`src/designer/link/tradeJobs.ts:18`)
- file states: draft, sent, quote, booked, working, done, invoiced, paid, lost, changed (`src/designer/link/exchange.ts:403-413`)
- exchange order: a report or invoice needs its quote (`src/designer/link/exchange.ts:135-141`); an invoice needs an approved quote (`:171-172`); one approved quote per request (`:232-233`); one accepted invoice per request (`:173-176`); a payment once, after acceptance (`:259-260`)
- money check on every quote and invoice: qty x rate = amount; sum = subtotal; gross(subtotal, VAT) = total (`src/designer/link/vendor/tradefolder/lib/jobPack/protocol.ts:86-93`)
- display stages: excavation shown excavated or filled (`src/designer/foundation.ts:21`); pool shown as excavation, shell or filled (`src/designer/garden.ts:50`)

## 6. Traps

1. Load and save disagree: the load check drops each bad run or fixture without a word and cuts a list at 2000, while the store and the server refuse the whole block (`src/designer/buildingServices.ts:127, 139-153`; `src/store/propertyStore.ts:1818-1819, 2255-2257`; `api/_lib/designSnapshotValidation.ts:80-90`). A second front that writes one bad run can lose it on the next web load.
2. Node heights are optional. A node without one is interpolated by plan distance, or by index on a vertical run (`src/designer/buildingServices.ts:264-281`). Copy the rule or always write the height.
3. Two anchors: a fixture's x, y is its centre; a placed item's x, y is the top-left of its turned footprint (`src/designer/link/planGeometry.ts:83, 101`). Sizes are in m, cm or mm by family (section 5).
4. The owner's examples span three unrelated shapes: pipes and 13 fixtures in `property.services`; lights, panels, batteries, inverters, tanks and boxes as plain placed items with no port (`src/store/propertyStore.ts:193-229`); trenches only on site mains or as 1 m cut cells (`src/designer/city.ts:41-42`; `src/designer/terrainCuts.ts:3-9`). There is no cable, socket, switch, pump, valve or tank fixture.
5. The export is smaller than the design: 300 runs of 65 points against 2000 runs of 500 points (`src/designer/link/contract/plan-view.schema.json:148, 156`; `src/designer/buildingServices.ts:139, 151`). A long run fails the schema and reads as "newer version" (`src/designer/link/planView.ts:67`).
6. Ventilation and refrigerant runs and five fixture kinds map to no trade, so they never reach a package (`src/designer/link/packages.ts:45-52, 137-145`).
7. Jobs, pins, statuses and packages live in one browser's storage, on the private path only; they are not in the design and not on the server (`src/store/linkStore.ts:18, 185-200`; `src/components/ProjectWorkspace.tsx:41, 269`). The game cannot see them through the design.
8. Trade rates: the rate card type and parser exist, nothing calls the parser, and a test checks that no export carries it (`src/designer/link/vendor/tradefolder/lib/jobPack/protocol.ts:50-57`; `src/designer/link/__tests__/planView.test.ts:91`).
9. The live build diff matches list items by an `id` field. Placed items use `instanceId` and run points have no id, so a whole list is swapped and two players moving two things in one room collide (`src/sharedBuild/contract.ts:129-136, 146-166, 203-204`; `src/store/propertyStore.ts:194`).
10. Paired service products join the catalogue on the client only; the server repricer reads the bundled seed and answers "Unknown catalog item" for any other id (`src/data/products.ts:25`; `api/_lib/pricing/repriceCart.ts:44, 205-207`). Also: the colour of a line is the only key to its system (`src/designer/buildingServices.ts:87-96`), and a stray SVG `circle` sits inside a `div` (`src/components/ServicesWorkspace.tsx:1314-1324`).

## 7. Not read

- Tests: every file under `src/designer/__tests__/`, `src/designer/link/__tests__/`, `src/components/build/__tests__/`, `src/components/three/__tests__/`, `api/__tests__/` (one search hit used: `planView.test.ts:91`).
- Style sheets: `src/components/servicesWorkspace.css`, `src/components/build/*.css`, `src/designer/link/contract/build-tokens.css`.
- `src/designer/link/vendor/tradefolder/lib/jobPack/job-pack.schema.json`: only lines 86-195 and 795-919, plus a search for list caps. `docs/link/JOB-PACK-CONTRACT.md`, `docs/link/README.md` and the two fixtures: not read. `docs/link/PLAN-VIEW-CONTRACT.md`: read.
- Materials take-off maths: `src/designer/materials/estimate.ts`, `mixPresets.ts`, `index.ts`, `src/designer/propertyMaterials.ts`, `src/designer/outdoorTakeoff.ts`, `src/designer/estimateEvidence.ts`, `src/components/MaterialsPanel.tsx`, `src/components/EstimateEvidencePanel.tsx`.
- Foundation: `src/designer/foundation.ts` read to line 209 only; `foundationExcavation.ts`, `foundationContract.ts`, `foundationScene.ts`, `src/components/FoundationWorkspace.tsx` not read.
- Site sheet: `src/designer/city.ts` read at lines 1-200, 260-394, 555-734; `src/components/CityWorkbench.tsx` at lines 180-269 plus a search; `cityContract.ts`, `cityAccess.ts`, `src/components/CityThreeView.tsx`, `src/components/CityOrdersPanel.tsx`, `src/store/cityProcurementStore.ts`, `api/_lib/cityProcurement.ts` not read.
- Shared register screens: `src/components/SharedProjectWorkbench.tsx` (search only), `SharedCoordinationPanel.tsx`, `SharedComponentEditor.tsx`, `SharedSustainabilityPanel.tsx`; server side `api/_lib/sharedSpecs.ts` (search only), `api/_lib/sharedBuild/handler.ts`, `api/_db/*`.
- Large files read only at the cited lines: `src/components/RoomCanvas.tsx`, `src/components/RoomView3D.tsx`, `src/components/three/ThreeStage.tsx`, `src/components/TopBar.tsx`, `src/App.tsx`, `src/components/ProjectWorkspace.tsx`, `src/components/EnergyPanel.tsx`, `src/components/SurfaceActions.tsx` (lines 96-354, 390-638), `src/store/propertyStore.ts`, `src/designer/projectReview.ts`, `src/designer/surfaceActions.ts` (lines 1-203, 325-439), `src/designer/houseBuildTutorial.ts`, `api/orders.ts` (search only), `api/_lib/designMcp.ts` (lines 44-74, 310-359), `api/_lib/pilotBuild.ts` (lines 1-80).
- Walk: `src/walk/EarthworkTool.tsx` and `WalkLauncher.tsx` read in full; `WalkMode.tsx` at lines 56-115 and 215-294; `runtime.ts`, `collision.ts`, `scene.ts`, `visit.ts`, `outdoor.ts` not read.
- 3D helpers: `src/components/three/earthworkMeshes.ts` and `BoundaryEditor.tsx` by search only; `dressing.ts` at lines 236-260.
- Data: `src/data/products.json` at lines 1250-1268 plus searches; `applianceLoads.ts` to line 80; `products.ts`, `solarPreview.ts`, `citySuppliers.ts`, `constructionMaterials.ts` not read.
- Eco: `src/eco/water.ts` read; `src/eco/quantities.ts` and `EcoSheet.tsx` by search only.
- Cart and checkout pages beyond the cited lines; `src/store/cartUIStore.ts`, `checkoutStore.ts`, `ordersStore.ts`, `projectHubStore.ts`, `designerUIStore.ts`, `placementIntentStore.ts`, `historyStore.ts`.
- Roof and levels: `src/designer/roof.ts`, `roofSurface.ts`, `levels.ts`, `building.ts` (only `roofPlacement.ts` read).
- `src/designer/measuredPath.ts`, `src/store/measuredPathToolStore.ts`, `src/lib/placementActions.ts`, `src/components/DetailsPanel.tsx`, `src/designer/FloatingCluster.tsx` (search hits only).
- `src/pilots/` apart from `BuildJobLink.tsx` and `projectTradeJob.ts`; `src/sharedBuild/` apart from `contract.ts`.
- Sales pages: `src/pages/sales/PlumbingPitchPage.tsx`, `salesPack.ts`.
- The earlier overview of 16 Nov 2026 was searched for orientation only.
