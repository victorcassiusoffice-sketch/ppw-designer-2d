# Sims build UI and engine research

Checked **2026-09-24**. Scope: public GitHub repositories, Mod The Sims (MTS) technical documentation, and EA's published controls. This was a browser-only review: no game DLLs, packages, decompiled code, assets, or external executables were imported or run.

## Finding

The reviewed sources expose real Sims 3 UI identifiers, mod source, package tools, and documentation for inspecting game assemblies. They do **not** establish a self-contained Sims 3 house-building engine that can be dropped into this React/Three.js designer. A distinct public implementation does exist in **Simitone/FreeSO**, targeting Sims 1/The Sims Online and their game data. That is a useful architectural reference, not the Sims 3 engine or a web component. This conclusion is limited to the sources inspected below.

## What was found

| Source | Exact names verified | What it provides / practical limit |
| --- | --- | --- |
| [MTS: The Sims 3 Programmer's Reference](https://db.modthesims.info/wiki.php?title=TS3PR) | `UI.dll`, `SimIFace.dll`, `ScriptCore.dll`, `Sims3Common.dll`, `Sims3GameplaySystems.dll`, `Sims3GameplayObjects.dll`, `Sims3Metadata.dll` | Game assembly map. `UI.dll` handles menus/windows; `SimIFace.dll` abstracts lower-level calls; `ScriptCore.dll` connects managed code to native engine functions through `Sims3Common.dll`. Gameplay and metadata assemblies cover objects/actions and resources. The name verified here is **UI.dll**, not `Sims3.UI.dll`. The reference warns that signatures vary by game edition. |
| [MTS: core-modding tutorial](https://modthesims.info/t/showthread.php?page=1&t=354419) | S3PE, .NET Reflector, ILDASM, ILASM, `Gameplay.package` | A historical workflow for extracting, inspecting and changing game assemblies. A tutorial and inspection toolchain, not house-building source supplied as an independent library. No extraction or decompilation was performed for this project. |
| [NRaas repository](https://github.com/Chain-Reaction/NRaas) and [Sims3 directory](https://github.com/Chain-Reaction/NRaas/tree/master/Sims3) | `NRaas`, `NRaasBootStrap`, `Sims 3.sln`, `Sims 3 Core.il` | Public source for game mods. Its README says mods reference modified EA DLLs in its Sims3 directory. That game dependency is significant: this is not an EA source release or a replacement house editor. The IL filename was verified in the directory listing; its implementation was not imported or used. |
| [Tiny UI Fix README](https://github.com/just-harry/tiny-ui-fix-for-ts3/blob/latest/README.md) | XML layouts, CSS styles, managed assemblies, native C++ UI; Mono.Cecil | The author's UI-scaling mod documents those four layers and patches the installed game's layouts and managed code. Its browser configurator configures a mod generator; it does not render a Sims house in the browser. This explains why extracting a UI DLL alone is insufficient. |
| [Tiny UI Fix core patch table](https://github.com/just-harry/tiny-ui-fix-for-ts3/blob/latest/TinyUIFixForTS3/Patchsets/VanillaCoreCompatibilityPatch.ps1) | `Sims3.UI.BuildController`, `BuyController`, `BlueprintController`, `BBCatalogPreviewPanelController`; `SetToolState`, `ResizeCatalogGrid`, `GetNumColumnsToDisplay` | Concrete names present in published patch targets. They verify build-mode state/catalog UI components. The file modifies sizing/layout constants; it does not supply the wall-topology or rendering engine. Method names here are observed identifiers, not invented integration APIs. |
| [Sims3Tools project](https://sourceforge.net/projects/sims3tools/), [S3PI/S3PE GitHub archive](https://github.com/marcos4503/sims3-package-interface), [MTS tools index](https://direct.modthesims.info/wiki.php?title=Tutorials%3ATS3_ModdingTools) | s3pi, s3pe, s3oc; `s3pi.Interfaces`, `s3pi.Package` | Package-file libraries/editors and an object cloner. The GitHub archive contains library/editor source and identifies Peter L. Jones as the original author. These read/write resource data; they are not interactive house editors. |
| [Sims 4 UI research wiki](https://github.com/zoetrope69/sims4-mods/wiki/UI-in-Sims-4) | Sims 4 Studio, Game File Cruiser, Scale Form GFX, JPEXS; instance `82C9414E81F7359F` | The author's **2020** notes identify that instance as build/buy UI and describe resource inspection. This is historical Sims 4 UI research, not verified current Sims 3 code, a complete engine, or a portable web UI. |

## Actual public alternative implementation

[Simitone](https://github.com/riperiperi/Simitone) describes itself as a C# frontend/reimplementation for Sims 1 based on FreeSO, requiring a Sims installation and acknowledging incomplete features. [FreeSO](https://github.com/riperiperi/FreeSO/tree/f86bbd34b2112296ed786741f640a0535886d180) is a MonoGame-based engine reimplementation with generated 3D wall/floor geometry and game-resource dependencies. Neither was built or evaluated locally during this review; portability and reuse were not established.

Verified reference locations:

- [Simitone UI panels](https://github.com/riperiperi/Simitone/tree/master/Client/Simitone/Simitone.Client/UI/Panels): `UILotControl.cs`, `UILotControlTouchHelper.cs`, `UICutawayPanel.cs`, `UIModeSwitcher.cs`, `UIObjectHolder.cs`.
- [Architecture touch module](https://github.com/riperiperi/Simitone/tree/master/Client/Simitone/Simitone.Client/UI/Panels/LotControls): `UIArchTouchHelper.cs` exists in the directory listing; its body was not available in this fetch.
- [UILotControl source](https://raw.githubusercontent.com/riperiperi/Simitone/master/Client/Simitone/Simitone.Client/UI/Panels/UILotControl.cs) routes build interaction to a current custom control or object holder. It references `UIWallPlacer`, `UIFloorPainter`, `UIWallPainter`, `UIGrassPaint`, `UIRoofer`, `UITerrainFlatten`, and `UITerrainRaiser`, and implements wall cutaway updates. These are alternative-engine names, **not TS3 API names**. No source was copied.

## Original implementation mapping for this designer

[EA's published Legacy controls](https://help.ea.com/en/articles/the-sims/the-sims-legacy-collection/the-sims-legacy-controls/) verify the interaction vocabulary: drag walls/fences, room-wide actions, floor selection, wall visibility, object rotation, and camera movement. These are behavior references; the following implementations are this repository's own code.

| Behavior | Existing original implementation / next constraint |
| --- | --- |
| Connected walls and enclosed rooms | `src/designer/wallBuildGesture.ts` + `src/lib/wallBuildActions.ts`: metre-based snapping, validation, live preview, closure and undo. Keep room/topology changes in shared property data so Plan and 3D agree. |
| Rectangular room drag | `roomBuildGesture.ts` + `roomBuildActions.ts`: preview first, validate again on release, commit once. |
| Tool UI and camera access | `HouseWorkspace.tsx`, `BuildingControls.tsx`, `RoomViewControls.tsx`: independent tool and camera controls, responsive detail panel and an in-flow wall status strip. Avoid fixed-pixel assumptions that obscure the working canvas. |
| Floors, stairs and roofs | `building.ts`, `buildingScene.ts`, `stairPlacement.ts`, `three/buildingMeshes.ts`: shared elevations, placement validation and generated geometry. |
| Outdoor work | `garden.ts`, `GardenPanel.tsx`, `three/gardenMeshes.ts`: saved garden surfaces/fences; `gardenPaving.ts` measures selected catalog paving. Continuous sculpted terrain is not established by these modules. |
| Smooth navigation and object movement | `cameraMotion.ts`, `useSmoothedCamera.ts`, `RoomView3D.tsx`: immediate gesture input with smoothed rendering; use existing placement validation when committing moves. |
| Real-world quantities and persistence | Preserve this repository's product IDs, quantities, saved-property schema and backend hooks. Sims game prices, package resources and simulation DLLs do not provide supplier or construction APIs. |

The implementation direction is therefore an original metre-based house editor informed by documented interaction patterns. No external game-code dependency was added. Remaining research uncertainty: no complete current TS3 native build-engine source or standalone browser port was verified, and old community identifiers may be version-specific.
