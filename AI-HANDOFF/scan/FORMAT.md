# SCAN: FORMAT (read 20 Nov 2026, 13:42 to 14:12 MU, code at d678c92)

Read-only scan of the design format. Branch `world/s00-s01-scan-rails`, HEAD `7e922f3`. Proof that the code equals `d678c92`: `git diff --stat d678c92 HEAD -- src api server vercel.json middleware.ts package.json` printed nothing in this run; `git status --porcelain` printed 0 lines before this file was written.

Method: Read and Grep only. No npm, no test, no build, no browser, no route called. Every line below was read in this run unless it says otherwise. "Derived" marks what this scan worked out from the cited lines. "Not run" marks code that was read and not executed. An earlier private read of 16 Nov 2026 was used as a map; its data model, stores and server-check claims were checked at the lines it cites and hold at this commit.

Left out on purpose (public repo): names of merchants, people and places that appear in demo files, default allowed origins, product and paint ids that carry a brand, the two literals of `foundation.concreteProductId`, the five avatar ids. The path and line are given so they can be read in place.

Short path forms used below:

| Short | Full path |
|---|---|
| `PS` | `src/store/propertyStore.ts` |
| `D/` | `src/designer/` |
| `G` | `src/lib/geometry.ts` |
| `WP` | `src/data/wallPaints.ts` |
| `ST` | `src/site/types.ts` |
| `SG` | `src/site/geometry.ts` |
| `MT` | `src/designer/materials/types.ts` |
| `MS` | `src/designer/materials/settings.ts` |

## 1. The design format on one page

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

## 2. Conventions

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

## 3. Loading and saving

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

## 4. Server: routes that carry a design

`handler.ts` below is `api/_lib/sharedBuild/handler.ts`. The design, lead, live-room and pilot routes are folded into `api/orders.ts` by rewrites (`vercel.json:127-133`; `api/orders.ts:281-287`, `:1507-1615`). The assistant and MCP routes go to `api/agent-chat.ts` (`vercel.json:101-102`; `api/agent-chat.ts:257-258`).

| Route | Method | Sign-in | Request | Response | Where |
|---|---|---|---|---|---|
| `/api/designs` | POST | studio session cookie or admin sign-in; refused when an `Origin` header names another host; refused on preview and demo deployments | `{ property: object, name?: string, customerEmail?: string, userId?: string, cart?: any, status?: string }`; `property` and one of `customerEmail`, `userId` are required | 201 `{ design }`; also calls the "design saved" email helper, which sends when `customerEmail` is set | `api/orders.ts:758-797`, `:1356-1392`, `:1538-1541`, `:1569-1585`; `api/__tests__/lib/email/dispatch.test.ts:46-71` |
| `/api/designs?email=` or `?userId=` | GET | studio session or admin sign-in | none | 200 `{ designs: row[] }`, newest first, 50 at most | `api/orders.ts:1326-1344` |
| `/api/designs/[id]` | GET | same | none | 200 `{ design }`; 404 | `api/orders.ts:1306-1324` |
| `/api/designs/[id]` | PUT | as POST | same body as POST | 200 `{ design }`; replaces `name`, `property`, `cart`, `status`, `updatedAt`; no version check; 404 | `api/orders.ts:1394-1420` |
| `/api/leads` | POST | none in the handler; refused on preview and demo deployments | `{ customerEmail, property?: any, designId?, cartQuote?, customerName?, customerPhone?, message?, source? }`; `property` is stored unchecked | 201 `{ lead }` | `api/orders.ts:1430-1501`, `:1538-1541`, `:1601-1615` |
| `/api/shared-projects/live/status` | GET | none | none | `{ available, writable }` | `handler.ts:93-104`, `api/_lib/sharedSpecs.ts:49` |
| `/api/shared-projects/live/host` | POST | studio session | `{ trade, avatar, model: Property }` | 201 `{ roomId, actorId, session, invite, revision, model, players }` | `handler.ts:46-47`, `:115-134`, `:163-211` |
| `/api/shared-projects/live/join` | POST | the invite code alone | `{ trade, avatar, code }` | 201 `{ roomId, actorId, session, revision, model, players }`; 404; 409 when 32 are in | `handler.ts:46`, `:147-211` |
| `/api/shared-projects/live/sync` | POST | header `Authorization: Bearer` + the `session` string | `{ revision: integer from 0, pose: Pose or null }` | 200 `{ revision, players, model? }`; `model` only when the room's revision differs from the one sent | `handler.ts:48`, `:213-253`; `api/_db/liveBuildStore.ts:101-116` |
| `/api/shared-projects/live/edit` | POST | Bearer session | `{ requestId: uuid, revision: integer from 1, changes: Change[1..512] }` | 200 `{ revision, model, players }`; 409 on a clash; 400 on a refused design | `handler.ts:254-296`; `src/sharedBuild/contract.ts:58-82` |
| `/api/shared-projects/live/leave` | POST | Bearer session | `{}` | `{ left: true }` | `handler.ts:232-237` |
| pilot `site-plan` action with a site id, under `/api/pilots/` | GET | pilot owner or member | none | `{ site: { id, name }, property }`, a filtered snapshot | `api/_lib/pilotBuild.ts:75-94` |
| same | POST | pilot owner | `{ revision, property }` or `{ revision, hide: true }` | `{ saved: true }` or `{ hidden: true }`; 409 | `api/_lib/pilotBuild.ts:95-118` |
| `/api/design-assistant` | GET | none | none | a readiness object | `api/_lib/designAssistant.ts:97-113`, `:325-328` |
| `/api/design-assistant` | POST | none for `guided` and `validate`; a Bearer sign-in token for `ai` | `{ mode: 'guided', brief }`, `{ mode: 'ai', brief }` or `{ mode: 'validate', draft }` | 200 `{ mode, draft, warnings }`: a draft, not a `Property`; 422 with `details` | `api/_lib/designAssistant.ts:185-308`, `:311-347` |
| `/api/mcp` | POST | none; rate limited; needs `Content-Type: application/json` and an `Accept` naming JSON and event stream | JSON-RPC 2.0, one request per call; tools include `get_design_schema`, `generate_guided_design`, `validate_design` | a JSON-RPC result holding a draft or a check; it never reads or writes a stored design | `api/_lib/designMcp.ts:188-246`, `:298-313`, `:383-437` |

Row shape of `design`: `{ id: number, userId: string or null, customerEmail: string or null, name: string, property: object, cart: any or null, status: string, createdAt, updatedAt }` (`api/_db/schema.ts:645-657`, `src/lib/designsApi.ts:16-26`).

Sign-in detail. "Studio session" is the cookie `__Host-ppw-studio` that the code door sets for 12 hours, looked up in the session store, or the admin sign-in session (`api/_lib/studioAccess.ts:32-52`, `server/studioSession.ts:5`, `server/accessGate.ts:8`, `:129`). Any open session may list any email's designs and read any id; the owner check is in the browser only (`api/orders.ts:1306-1344`, `src/lib/cloudDesigns.ts:11-12`). There is no token or key for a program on these routes. The live room is the one path with its own credential: the `session` string returned by `host` or `join`, valid 24 hours (`handler.ts:207`, `:213-231`; `api/_db/liveBuildStore.ts:41`, `:48`). Every live POST refuses a request whose `Origin` header names another host or is off the allow-list; a request with no `Origin` header passes that test (`handler.ts:115-124`; `api/_lib/studioAccess.ts:55-64`). `trade` is one of 7 words and `avatar` one of 5 ids (`src/sharedBuild/contract.ts:14-23`, `:57`).

Not a design route, checked: `/api/shared-projects` without `live` holds specification projects (components, members, reviews) that point at a design only by `sourceBuildId` (`api/_lib/sharedSpecs.ts:44-121`, `D/sharedSpecsContract.ts:56-59`).

**The server's check of a design** (`validateSnapshotMeasurements`, `api/_lib/designSnapshotValidation.ts:37-59`). Used by `/api/designs` POST and PUT (`api/orders.ts:775`) and by live `host` and `edit` (`handler.ts:50-55`, `:184`, `:276`).

| Part | Rule | Line |
|---|---|---|
| `rooms[].removedWallEdges` | array of distinct integers inside the polygon's edge count | `:38-46` |
| `roof.thicknessM` | finite, 0.0003..2 | `:47-50` |
| `terrainCuts` | `validCuts` | `:51` |
| `boundaryComponents` | `validComponents` | `:52` |
| `services` | strict schema: an unknown key fails | `:80-90`, `D/buildingServicesContract.ts:19-143` |
| `foundation` | strict schema | `:10-21`, `D/foundationContract.ts:24-81` |
| `city` | strict schema | `:25-35`, `D/cityContract.ts:86-106` |
| `eco`, `engineering` | strict schemas | `:61-78` |

Everything else (rooms, items, openings, levels, walls, site, stairs, garden, shade, materials) is stored as given. For `/api/designs` the only other test is that `property` is an object (`api/orders.ts:772-774`). The live room adds `sharedProperty`: `id` is a string, `rooms` is an array of at most 512, each room has a string `id`, a `polygon` of `{ x: number, y: number }`, a `placedItems` array and an `openings` array, added when absent (`src/sharedBuild/contract.ts:84-117`).

**Caps**

| Cap | Value | Where |
|---|---|---|
| `/api/designs` body | no size test in the code | `api/orders.ts:867-878`, `:1349-1357` |
| `designs.name` | 200 characters (column) | `api/_db/schema.ts:651` |
| live request body | 780,000 bytes | `handler.ts:125-139` |
| live design as JSON | 720,000 characters | `src/sharedBuild/contract.ts:97` |
| rooms in a live design | 512 | `src/sharedBuild/contract.ts:96` |
| JSON shape | 60,000 values, depth 32, arrays of 8,192, strings of 80,000 characters | `src/sharedBuild/contract.ts:28-39` |
| changes per edit | 512, path depth 30 | `src/sharedBuild/contract.ts:60-68`, `:80` |
| players per room | 32 | `api/_db/liveBuildStore.ts:85`, `api/_db/blobLiveBuildStore.ts:189` |
| room document in the database store | 1,000,000 bytes | `api/_db/migrations/0032_shared_project_specs.sql:8` |
| pilot snapshot | 1,400,000 characters, stored in 2,700-character parts | `src/pilots/buildRecord.ts:110`, `api/_lib/pilotBuild.ts:111-117` |
| assistant and MCP body | 128 KB | `api/_lib/designAssistant.ts:25`, `:89-90` |
| plan import file | 2 MB, 2,500 shapes, 12,000 vertices, 80 layers, 150 rooms, 1,500 walls, 12 storeys | `D/planImport.ts:9-17` |

**Conflict rule**
- `/api/designs`: none. PUT replaces the row. `updatedAt` is set and never compared (`api/orders.ts:1401-1411`). The browser reads the row before a PUT only to compare the email (`src/lib/cloudDesigns.ts:40-47`).
- Live room, in order (`handler.ts:254-283`):
  1. A `requestId` already used by the same player with the same body returns the current state again; used with another body or player: 409 (`:257-266`).
  2. `edit.revision` greater than the room's revision: 409 (`:272-275`). An older revision is not refused by itself.
  3. Each change is `{ path, before, after, had, has }`. The server walks `path` in the stored design and compares the value found with `before`. Equal: the change is applied. Already equal to `after`: skipped. Otherwise 409, and none of the edit is applied (`src/sharedBuild/contract.ts:173-219`).
  4. The result is checked again by `sharedProperty` and the server's check; a failure is 400 (`handler.ts:50-55`, `:276`, `:289-296`).
  5. The write is a compare-and-set on the revision, tried 4 times, then 409 (`:256`, `:277-283`; `api/_db/liveBuildStore.ts:139-148`; `api/_db/blobLiveBuildStore.ts:219-247`).
- A path step is a key, or `{ id }` to pick an array element by its `id`. An array is compared element by element only when every element has a unique string `id` and the shared ids keep their order; otherwise the whole array is one change (`src/sharedBuild/contract.ts:129-170`). Arrays with no `id` on their elements: `placedItems` (items use `instanceId`), `polygon`, `wallPaint`, `wallConstruction`, `wallCladding`, `floorTiles`, `runs`, `points`.
- An edit may not touch `id`, `activeRoomId`, `activeLevelId`, `selectedItemId` (`src/sharedBuild/contract.ts:83`, `:176-182`).
- Browser side on 409: full `sync`, then its own changes are applied on top of the server's design; a clash on one field stops the loop and asks the user (`src/sharedBuild/client.ts:134-164`, `:203-220`, `:348-380`). Polling every 550 ms, 3,000 ms when hidden, 2,500 ms after an error (`src/sharedBuild/client.ts:193`, `:244`).

## 5. Formats in and out

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

## 6. Sample designs

No file in the repo holds a complete `Property` as JSON. Designs are built by code:

| Builder | What it makes | Sections it fills |
|---|---|---|
| `buildHomeInterior()` at `src/demo/homeInterior.ts:24-46`, which wraps the five-room builder imported at `:3`, `:25` | one storey, 5 rooms, 12 openings, 36 items (5 of them on a parent item, rotations 0 and 90), paint with tints on every room, one whole-room floor finish | `id`, `name`, `activeRoomId`, `rooms` (polygon, openings, placedItems, wallPaint, floorFinish), `walls: []` |
| the seven-room builder in one of the slug folders listed at `src/demo/index.ts:13-16` | one storey, 7 rooms, 14 openings, 27 items, paint on 5 rooms | as above plus `wallHeightM` |
| the three-room builder in another slug folder, used twice with different paints | 3 rooms, 8 openings, tinted paint, no items | as above |
| `createGuidedDesign(brief)` then `designDraftToProperty(draft)` at `D/aiDesignContract.ts:338-463`, `D/aiDesignProperty.ts:7-84` | 1 to 3 storeys of rectangular rooms round a hall, a door and a window per room, stairs, flat roof, plot, lawn and path; roof slabs added by `syncRoofRooms` | `levels`, `activeLevelId`, `rooms`, `stairs`, `roof`, `site`, `garden`, `wallHeightM`; no items, no paint |
| `reviewPlanImport` on the example SVG at `src/components/PlanImportWorkspace.tsx:92-93` | 2 storeys, 3 rooms | `levels` with `heightM` and `elevationM`, `site`; needs a browser XML parser |
| `ensurePlan` at `src/pilots/plans.ts:5-37` | one long room with `removedWallEdges` and `eco.waterStudy` | writes to `localStorage`; browser only |
| `sampleSite()` at `src/site/sample.ts:9-38` | a `GeoSite` with typed terrain | `site.world` only |
| empty section values | `emptyCity` (`D/city.ts:149-158`), `emptyEco` (`D/eco.ts:15`), `EMPTY_FOUNDATION` (`D/foundation.ts:53`), `EMPTY_SHADE` (`D/shade.ts:105`), `EMPTY_SERVICES` (`D/buildingServices.ts:86`), `defaultMaterialsSettings` (`MS:5-22`) | one empty section each |

Also in the repo: `docs/link/fixture-plan-view.json` (a plan view, not a `Property`; not opened) and many small designs inside tests (54 files matched a grep for code returning a `Property`).

**The most complete house** is `buildHomeInterior()`: it is the one that exercises what a first load must draw (rooms, shared walls, doors and windows, items with parents and rotation, paint, a floor). It has no storeys, stairs, roof, plot or garden; the guided design covers those and has no items. No sample fills `services`, `foundation`, `city`, `eco`, `shade`, `terrainCuts` and `boundaryComponents` together.

**Dump from Node, no browser.** Not run in this scan. The repo already runs TypeScript files with `vite-node --script` (`package.json:11`; the binary is in `node_modules/.bin`). The stores load without a browser: tests run in the `node` environment and import them with no `localStorage` (`vitest.config.ts:19`, `src/store/__tests__/designsStore.test.ts:24-27`), and `PS` guards `location` and `localStorage` (`PS:386-388`, `PS:514`).

```ts
// tools/world/dump-sample.ts  (to be written by the stage that needs it)
import { writeFileSync } from 'node:fs';
import { buildHomeInterior } from '../../src/demo/homeInterior';
import { createGuidedDesign } from '../../src/designer/aiDesignContract';
import { designDraftToProperty } from '../../src/designer/aiDesignProperty';
import { normaliseLoadedProperty } from '../../src/store/propertyStore';

const save = (file: string, value: unknown) => writeFileSync(file, JSON.stringify(value, null, 2));
save('sample-home.json', normaliseLoadedProperty(buildHomeInterior()));
save('sample-two-storey.json',
  normaliseLoadedProperty(designDraftToProperty(createGuidedDesign({ bedrooms: 3, storeys: 2 }))));
```

Run with `npx vite-node --script tools/world/dump-sample.ts`. Passing the result through `normaliseLoadedProperty` gives the form the web holds after a load from the server. The home sample also needs a product table for its item ids: call `registerAllDemos()` (`src/demo/index.ts:22-25`) and `getProductById` (`src/data/products.ts:41-47`) and write only `id`, `dimensions_cm`, `placement`, `mount_height_cm`, `front_edge`, `is_surface`. The product records also hold names and prices, and the sample's product ids start with a merchant slug: keep such a dump out of this public repo.

## 7. What a second front must do to load and save this format

1. **Fetch.** Two ways exist. (a) `GET /api/designs/[id]` returns `{ design: { id, name, property, updatedAt } }` and needs the studio cookie of a browser session. (b) `POST /api/shared-projects/live/join` with an invite returns `{ session, revision, model }` and then works with a Bearer session for 24 hours. (a) has no version and no credential for a program; (b) has a revision and a per-change check, and needs a browser to host the room first. A route that gives a program its own credential and a version on the stored row does not exist yet (section 4).
2. **Parse and keep.** Read the design as a JSON tree and keep the tree. Edit the tree in place and write it back. Do not rebuild the JSON from engine structs: sections the game does not understand (`city`, `eco`, `engineering`, `materials`, `shade`, `site.world`, and keys added later) must go back unchanged.
3. **Read defensively.** Every optional field may be absent; `site` and `floorFinish` may be null; arrays may be empty; `rooms` may hold entries with an empty polygon; a level id may be absent, empty or `'ground'` (section 2, rules 18, 21, 31).
4. **Storey table.** No `levels` means one storey `'ground'`. Sort by `index`, roof last. Height and elevation by rule 20.
5. **Frame.** Plan metres to engine units by rule 4 (derived; check it once). Keep the plan values as the truth and convert on the way in and out, so a save writes metres with the same digits for anything that was not moved.
6. **Floors and walls.** For each entry of `rooms` that is not `'outdoor'` and has 3 or more points: a floor at the storey's elevation. For a `'roof'` entry: a slab only. For the others: one wall per edge by rules 11 to 14. For `walls[]`: a slab centred on a to b.
7. **Openings.** Cut each opening by rule 16 with the heights of section 1 (sill and height defaults by kind, clipped to the wall height; shape rectangle, arch or circle: `D/openingGeometry.ts:15-19`, `:50-69`). Cut the same world span in any neighbour edge that lies on the same line within 1 mm on the same storey (rule 15).
8. **Items.** Load the product table first. For each item: size from the product, box and centre by rule 23, yaw by rule 4, base height by rule 24. Unknown product: draw nothing, keep the item.
9. **The rest, as stages need it.** Stairs (centre, width, run, rotation; steps of at most 0.18 m: `D/building.ts:123-125`), roof (rule 22), garden, terrain cells, foundation, services, shade, city, trees, boundary components. None is needed to stand inside the house.
10. **Write back** only what changed, and keep what the web relies on: room polygons clockwise; an opening fits its edge with 0.1 m at each end; `instanceId` unique in the whole design; `activeRoomId` names an existing room; at least one room; ground rooms without `levelId`; flags stored only in their non-default value (rule 31); roof slabs left to the web (rule 22); new ids are strings of 1..150 safe characters, and for the sections with a pattern or a length limit they must fit it (section 1).
11. **Check before sending.** The caps of section 4 (720,000 characters, 512 rooms, 60,000 values) and the strict sections: a wrong value or an unknown key inside `city`, `foundation`, `services`, `eco`, `engineering`, a bad `terrainCuts`, `boundaryComponents`, `removedWallEdges` or `roof.thicknessM` is answered with 400.
12. **Save with a version.** Through the live room: one `edit` per change set with a new `requestId` (the same id when the call is repeated), the revision held, and changes built as old value and new value per path; on 409, `sync` with revision 0, take the returned `model`, and apply the local changes again. Through `/api/designs` there is nothing to send as a version: a PUT replaces the row.
13. **New fields.** A field the game adds survives a reload on the web and vanishes on the next load from the server unless it is added to `normaliseLoadedProperty` and, where it applies, to the room, free-wall or level copy code, and to the strict schema of its section (section 3). Do that in the same change as the field.

## 8. Traps

1. An item's `x, y` is the min corner of its rotated bounding box, and its size is not in the design: without the product table an item cannot be placed (`D/fitToSize.ts:197-214`, `src/components/RoomView3D.tsx:341-342`).
2. The design has no version and the stored row has none; a PUT overwrites, and a POST with `customerEmail` calls the email helper (`PS:338-384`, `api/orders.ts:1375-1388`, `:1401-1411`).
3. A section with `version` other than 1, or with one unknown key in a strict section, is dropped whole on load and refused by the server (`D/city.ts:196`, `D/eco.ts:16-19`, `api/_lib/designSnapshotValidation.ts:37-59`).
4. Two load paths: a reload keeps the JSON and cleans parts of it; a load from the server, a page switch, an import and a shared edit copy only named fields (`PS:2200-2216`, `PS:2225-2301`). A new field passes the first and is lost in the second.
5. Ground is written as absent, empty or `'ground'`, and `rooms` holds blank and outdoor entries with an empty polygon (`PS:428-433`, `PS:2077`, `PS:2114-2130`).
6. A shared door is stored once; a shared wall is two opposite edges; 2D draws a wall centred at 0.1 m and 3D draws it outside the line at 0.14 m or the construction thickness; closed free walls turn into rooms (`src/components/RoomView3D.tsx:272-303`, `D/wallAwarePlacement.ts:45-51`, `src/components/three/ThreeStage.tsx:622-624`, `PS:2082`).
7. Height limits disagree: `wallHeightM` is kept on load only within 2.0..4.0, a level's `heightM` within 2..8, an import accepts 2..6 (`PS:2285`, `D/building.ts:9-10`, `D/planImport.ts:314`).
8. In a live room `placedItems` has no `id` key, so moving one item replaces the room's whole item array; two players moving items in one room clash (`src/sharedBuild/contract.ts:129-136`, `PS:193-198`).
9. A design can hold typed money (`materials.unitRates[*].mur`) and product ids that start with a merchant slug; a design dump is not safe for a public place by default (`MT:5`, `src/demo/demoCatalog.ts:32`).
10. Preview and demo deployments refuse every design write, the storage key is fixed at page load, and other code writes the storage shape by hand (`api/orders.ts:1538-1541`, `api/_lib/showcaseSafety.ts:2-4`, `PS:386-390`, `src/pilots/plans.ts:33-36`).

## 9. Not read

- `src/store/propertyStore.ts` lines 1048-1425 and 1456-1507 (item, floor, paint, cladding and opening update actions). All type, load and save code was read.
- Estimate and report code: `D/city.ts` 546-859, `D/foundation.ts` 261-469, `D/shade.ts` 261-482, `D/floorTiles.ts` 318-445, `D/roomView3d.ts` 231-910 (two constants by grep), `D/serviceConnections.ts` 141-333, `D/connectedWallRooms.ts` 71-267, `D/materials/estimate.ts`, `costs.ts`, `mixPresets.ts`, `D/projectHub.ts` outside 150-214.
- Render code beyond the cited lines: `src/components/RoomView3D.tsx` outside 250-419, `src/components/three/ThreeStage.tsx` outside 14-33 and 606-644, `src/components/RoomCanvas.tsx` outside 5722-5751 and 5922-5945, `src/components/three/buildingMeshes.ts` after line 60, `furniturePreview.ts` (grep only).
- Link package: `D/link/exchange.ts` after line 200, `packages.ts`, `tradeJobs.ts` (grep only), `tradeWork.ts`, `workGeometry.ts`, `qr.ts`, `contract/build-tokens.css`, everything under `D/link/vendor/`.
- Export code: `src/lib/planPdf.ts` 170-958, `src/lib/shareImage.ts`, `src/lib/orderSnapshot.ts` (grep only).
- Server: `api/_lib/pilots.ts` and `api/_db/pilotStore.ts` (so the exact pilot URL and its sign-in were taken from `pilotBuild.ts` alone), `api/_db/sharedSpecsStore.ts`, `api/_db/blobLiveBuildStore.ts` 61-119, `api/agent-chat.ts` (two dispatch lines by grep), `api/_lib/designMcp.ts` 1-169, `api/_lib/designAssistant.ts` 120-185, `api/_lib/cityProcurement.ts`, `api/_lib/email/` (the email helper and its de-duplication; only its test lines 46-71 by grep), `api/products.ts` after line 70, `api/cart-quote.ts`, the `/api/calc` and `/api/site` handlers, `server/` (grep only), `middleware.ts`.
- Data tables: paints, floors, cladding, glass, service materials, presets, the product lists and their JSON files; only the cited lines were opened.
- `src/walk/` (one line by grep), `src/sharedBuild/remotePlayers.ts` (grep), `SharedBuildPanel.tsx`, `SharedBuildButton.tsx`, `src/site/` beyond `types.ts`, `geometry.ts`, `hydration.ts`, `sample.ts`, `planAdapter.tsx`, `src/pilots/` beyond `plans.ts` and `buildRecord.ts`.
- `src/types/` holds one file, a type stub for a third-party library; it was listed and not opened.
- `docs/`, `tests/e2e/`, `tools/` (grep only), `node_modules/` (so "every `set` writes storage" is taken from the earlier read, not checked here).
- Nothing was run: no route was called, no sample was dumped, no storage was inspected, and which room store production uses was not checked. The engine mapping in section 2 rule 4 is derived, not tested.
