# The design format

A house design is ONE JSON object. The web app and the desktop game read and write the same object. This page is
its reference for both: every key of every part, its unit, what it means, and what the loader of the web app does
with it. It covers version 1 (every design made before a version number existed) and version 2.

- The code is the proof. Under each table a line names the files it was read from. When this page and the code
  disagree, the code is right and this page has a fault: fix the page in the same change.
- The names of the keys are in one table in the code, `src/designer/designFormat.ts`. A test holds this page to
  that table: every name there stands on this page (`src/designer/__tests__/designFormatDoc.test.ts`).
- "The loader" is `normaliseLoadedProperty` in `src/store/propertyStore.ts`. It runs when a design is opened from
  a file, when a page is put on screen, when a design is saved under a name, when a shared build is installed. A
  reload from the browser's storage takes a lighter path: see 3.1.
- In the tables, "dropped" means the entry or the value is not in the loaded design. "Left out" means the key is
  not written. "Carried" means a key the loader does not know is copied as it is (3.2).
- Sections 1 to 4 were first read from the code key by key on 22 November 2026, with nothing run. What was built
  after that reading (the parts of version 2, and three places where unknown keys were still dropped) was run and
  tested, and is written in.

## 0. The rules of the format

These hold for every version. A program that writes designs keeps them; a program that changes the format keeps
them too.

1. **One object, with a number.** A design is the object described here, as JSON. Its version is `formatVersion`.
   A design without the key is version 1. The number 2 is written only into a design that holds a part of
   version 2 (2.22 to 2.25); a design with no such part carries no number and none of the new keys, and is
   byte for byte what it was. A number is never lowered: a design from a newer build keeps its number.
2. **Nothing a newer build wrote is lost by an older one.** A key the loader does not know is carried as it is,
   in every part named in 3.2. A program that reads and writes designs must do the same: keep what it does not
   know, where it found it.
3. **A part with a version of its own is read whole or kept aside whole.** The eight sections (2.14 to 2.21) and
   the plot on the map (`site.world`) each have their own reader. A part its reader does not accept is not
   dropped: it is kept aside under `unread`, as it was stored, shown nowhere and used by nothing, and offered to
   its reader again at every load (3.3). INSIDE such a part a key the reader does not know is NOT carried. So
   whoever adds a key inside one of them raises that part's own `version`; an older build then keeps the whole
   part aside in place of reading it and losing the new key.
4. **No new kind in an old list.** In the lists of version 1 (storeys, rooms, openings, free walls, stairs, garden
   surfaces and so on) an entry the loader cannot read is dropped whole, with all it holds. So a later version
   never adds a new KIND of entry to one of those lists. A new kind of thing gets a list of its own under a new
   key, which every build carries.
5. **The lists that are new with version 2 are kind to what they do not know.** In `products`, `costLines` and
   `members` an entry of a kind this build does not know is KEPT as it is and treated as the least: a role it
   does not know is a viewer; a cost line of a kind it does not know adds to no sum. A later version may add a
   kind to these lists.
6. **A cost line holds no money.** No rate, no amount, no currency. A cost is worked out on the server from a set
   of rates, at the moment it is asked for; the design holds a reference to the set. The loader refuses the keys
   that would put money into a cost line (2.24). One part of version 1 can hold figures a person typed: the unit
   rates of the materials settings (2.13). That part is as it was.
7. **A design names people; it does not prove who they are.** `members` is a list of roles for the people who
   work on a design. Who may change a design is the server's decision, never the file's.
8. **Every thing has an id of its own.** Rooms, placed things, openings, free walls, stairs, storeys, cost lines,
   members: write an id on each, and keep it when you write the design again (3.13).

## 1. Conventions

| Point | Rule | Proof |
|---|---|---|
| The object | One design is one JSON object (the type `Property`). A design file is that object as JSON text with nothing round it. A project hand-over file carries the same object under `snapshot`. | `src/store/propertyStore.ts`; `src/designer/designFile.ts` |
| Lengths | Metres, for every length and every position. | `src/store/propertyStore.ts`; `src/lib/geometry.ts`; `src/designer/materials/types.ts`; `src/designer/city.ts` |
| Lengths that are not metres | `mountHeightCm` is centimetres. A key that ends in `Mm` is millimetres (`thicknessMm`, `diameterMm`, `spacingMm`, `coverMm`, `jointMm`, `stemDiameterMm`, `extraRetainedWaterMm`). Product sizes in the catalogue are centimetres. | `src/store/propertyStore.ts`; `src/designer/materials/types.ts`; `src/designer/city.ts`; `src/data/products.schema.ts` |
| Angles | Degrees: `rotation`, `pitchDeg`, `tiltDeg`. | `src/lib/geometry.ts`; `src/designer/building.ts`; `src/designer/city.ts`; `src/designer/roofSurface.ts`; `src/site/types.ts` |
| Plan axes | x grows to the east, to the right on the page. y grows to the south, down the page. North is minus y. Height grows upward. | `src/designer/roomView3d.ts`; `src/site/geometry.ts`; `src/site/types.ts`; `src/designer/city.ts`; `src/designer/roomSolids.ts` |
| One frame | All storeys share one plan frame. A room on an upper storey has the same x and y as the room under it. Coordinates may be negative. Nothing is recentred. | `src/store/propertyStore.ts`; `src/designer/roomLayout.ts`; `src/designer/link/planGeometry.ts` |
| Origin of the plan | NOT SETTLED BY THE CODE as a point of the real world. What the code shows: there is no fixed origin. A rectangle room made with no anchor starts at (0, 0). `site.originM` is the corner of the plot with the smallest x and y, in the same frame. When `site.world` exists, the plan point `site.world.anchor` is the first map corner `site.world.boundary[0]`. | `src/lib/geometry.ts`; `src/store/propertyStore.ts`; `src/site/geometry.ts` |
| Origin of heights | It differs by part. Openings and placed things: the floor of their storey. A storey: `elevationM` is the level of its finished floor; the first storey is at 0 unless it says otherwise. Service runs, points and fixtures: the finished floor of their storey. Foundation: "the ground finished-floor datum". Shade anchors: "the ground datum". City network `z`: "ground datum". Terrain cuts: "the project datum". Whether these datums are one level: NOT SETTLED BY THE CODE. | `src/designer/building.ts`; `src/designer/buildingServices.ts`; `src/designer/foundation.ts`; `src/designer/shade.ts`; `src/designer/cityContract.ts`; `src/designer/terrainCuts.ts` |
| Winding of an outline after load | The shoelace sum of the stored points, the sum of `x[i] * y[i+1] - x[i+1] * y[i]`, is positive. On the y-down plan that is clockwise. The loader turns round any outline whose sum is negative and keeps its first point. The rectangle the app makes, (0, 0), (L, 0), (L, W), (0, W), has edge 0 at the top, 1 on the right, 2 at the bottom, 3 on the left. | `src/designer/openings.ts`; `src/store/propertyStore.ts`; `src/lib/geometry.ts` |
| Inner side of an edge | For an edge with unit direction (dx, dy), the normal (-dy, dx) points into the room. | `src/designer/openings.ts`; `src/designer/roomView3d.ts` |
| Index of an edge | Edge `i` of an outline runs from point `i` to point `i + 1`. The last edge runs from the last point to point 0. | `src/designer/wallEdges.ts` |
| Zero of a rotation, placed thing | At 0 the product's `length` lies along x and its `width` along y. Its front faces +y (down the page) unless the catalogue gives the product another `front_edge`. A positive angle turns it clockwise as seen on the plan, about the centre of its footprint. | `src/lib/geometry.ts`; `src/designer/wallAwarePlacement.ts`; `src/components/RoomCanvas.tsx`; `src/designer/fitToSize.ts`; `src/data/products.schema.ts` |
| Zero of a rotation, stair | At 0 the stair climbs toward +y. Clockwise degrees on the plan. | `src/designer/building.ts` |
| Sense of every rotation | Every rotation formula that was read turns +x toward +y for a positive angle. | `src/designer/building.ts`; `src/designer/city.ts`; `src/designer/serviceConnections.ts` |
| Handedness | x east, y south and height up form a LEFT-handed set. A right-handed engine with y up takes plan (x, y, height) as its own (x, height, y): the 3D view of this app does so, and turns a thing by minus its `rotation` about its up axis. A left-handed engine with z up takes (x, y, height) as it is: the desktop game does so. Check with one thing that is not symmetric, placed and turned. | `src/components/three/ThreeStage.tsx`; `src/designer/fitToSize.ts` |
| Colours | Strings. A paint tint is `#RRGGBB` in upper case after load. A sail colour is `#rrggbb` in either case. | `src/data/wallPaints.ts`; `src/designer/shade.ts` |
| Absent means default | An absent key is the stored form of the default. No `levels` on a design of one storey. No `levelId` on a ground room. `lightOn` and `powerOn` only when `false`. `wallPaintPrimer` only when `true`. `paintFaces` and `claddingFaces` only when 2. | `src/designer/levels.ts`; `src/store/propertyStore.ts` |
| Rounding | The loader does not round a coordinate. Some drawing tools round a new point to 4 decimals. Whether every drawing path does so: NOT SETTLED BY THE CODE that was read. | `src/store/propertyStore.ts`; `src/designer/drawLength.ts`; `src/designer/freeWalls.ts` |
| Tolerances | Two points are one point when both x and y differ by less than 1e-6 m. An edge of 1 mm or less is no wall. Two edges are one wall within 1 mm. | `src/designer/openings.ts`; `src/designer/wallEdges.ts` |
| Version | `DESIGN_FORMAT_VERSION` is 2: the newest version this build reads. A design says its version in `formatVersion`. A design without one is version 1. See rule 1. | `src/designer/designFormat.ts`; `src/designer/designFile.ts` |

## 2. The parts

### 2.1 The design

| Key | Type | Unit | Meaning | On load |
|---|---|---|---|---|
| `id` | string | none | Identity of the design. | Kept as stored, with no type check. Absent or `null`: a new random id of 8 characters. |
| `name` | string | none | Title of the design. | Kept as stored, with no type check. Absent or `null`: a fixed default title. |
| `activeRoomId` | string | none | The room in focus in the editor. | Kept when it names a room of the loaded design. Otherwise the id of the first room. |
| `rooms` | list of rooms | none | The rooms of all storeys, the outdoor holders and the roof slabs. | Each entry goes through the room loader (2.3). Absent or empty: one blank room is made (random id, name `Main Room`, empty outline). A room whose `levelId` names no storey of the design loses its `levelId`. |
| `levels` | list of storeys | none | The storeys. Absent or empty: one ground storey. | See 2.2. Written only when at least one entry is valid. |
| `activeLevelId` | string | none | The storey in focus in the editor. | Not copied. Worked out again: it is the storey of the active room. Written only when that storey is not `ground`. |
| `walls` | list of free walls | none | Walls that belong to no room. | See 2.8. Written only when at least one wall is kept. A wall whose `levelId` names no storey loses its `levelId`. |
| `site` | object or `null` | none | The plot. Absent or `null`: no plot. | See 2.9. `null` and an unusable value are left out. |
| `wallHeightM` | number | m | Clear wall height of a storey that has no `heightM`. Absent: 2.7. | Kept only when it is a number from 2.0 to 4.0. Otherwise left out. Not clamped. |
| `wallPaintCoats` | integer | count | Paint estimate: coats for every paint. Absent: each paint's own figure. | Rounded to a whole number. Kept when 1, 2 or 3. Otherwise left out. |
| `wallPaintWastePct` | integer | percent | Paint estimate: allowance for touch-ups. Absent: 10, and 15 on a tinted colour. | Rounded to a whole number. Kept when 0 to 25. Otherwise left out. |
| `wallPaintPrimer` | `true` | none | Paint estimate: add a primer line. | Only the value `true` is kept. |
| `stairs` | list of stairs | none | Flights between two storeys. | See 2.10. Written only when at least one stair is kept. |
| `roof` | object | none | Shape and covering of the roof. | See 2.11. Left out when the design has no roof storey. |
| `garden` | object | none | Ground surfaces, pools and fences. | See 2.12. |
| `materials` | object | none | Settings of the materials estimate. | See 2.13. When the key is present, whatever its value, a full settings object is written. |
| `services`, `terrainCuts`, `boundaryComponents`, `foundation`, `shade`, `city`, `eco`, `engineering` | object or list | none | The eight sections. | Each is read by its own reader (2.14 to 2.21). A section its reader does not accept is moved to `unread`. |
| `unread` | object | none | Parts this build could not read, each by its name, as they were stored: the eight sections, and `siteWorld`, the plot on the map (2.9). Nothing in the app reads them. | Built again on every load. Only those nine names are looked at. Any other key in it is dropped. A section kept here is offered to its reader again when the design itself has no section of that name. `siteWorld` is carried by the loader and offered to its reader after the first picture. A part is kept only when it is plain JSON of at most 400000 values, nested at most 12 deep. |
| `formatVersion` | integer | none | The version of the format (rule 1). | Read as 1 when absent or when it is not a whole number of 1 or more. Written as the larger of what the design said and what it needs: 2 when it holds a part of version 2, else nothing. |
| `products` | list | none | Version 2. The products in use (2.23). | Checked entry by entry. Left out when no entry is kept. |
| `costLines` | list | none | Version 2. What a job needs, as products and as labour (2.24). | Checked entry by entry. Left out when no entry is kept. |
| `members` | list | none | Version 2. Who works on the design, and in which role (2.25). | Checked entry by entry. Left out when no entry is kept. |
| any other key | JSON | none | A key this build does not know. | Carried as it is, under the rules of 3.2. |

Source: `src/store/propertyStore.ts`; `src/designer/designFormat.ts`; `src/designer/designFile.ts`; `src/data/wallPaints.ts`.

### 2.2 A storey (`levels[]`)

| Key | Type | Unit | Meaning | On load |
|---|---|---|---|---|
| `id` | string | none | Identity of the storey. `ground` is the ground storey. `roof` is the roof storey. | Must be a string that is not empty, else the entry is dropped. A second entry with the same id is dropped. When no entry has the id `ground`, a ground storey is added (name `Ground floor`, index 0). |
| `name` | string | none | Label. | Must be a string, else the entry is dropped. Trimmed. A blank name becomes `Level` and the index. |
| `index` | number | none | Order of the storeys. Ground is 0. Gaps are allowed. | Must be a finite number, else the entry is dropped. It need not be whole. The list is sorted by `index`, the roof storey last among equals, then by `id`. |
| `kind` | `"roof"` | none | Marks the one roof storey. Absent: a normal storey. | Any value other than `"roof"` or absent drops the whole entry. An entry with the id `roof` gets `kind: "roof"`. |
| `heightM` | number | m | Clear wall height of the storey. Absent: `wallHeightM` of the design, else 2.7. | Kept when it is a number from 2 to 8. Otherwise left out; the storey stays. Never kept on the roof storey. |
| `elevationM` | number | m | Level of the finished floor. Absent: stacked on the storey below, from 0 (3.4). | Kept when it is a finite number. Otherwise left out. Never kept on the roof storey. |
| any other key | JSON | none | Unknown key. | Carried (3.2). |

Source: `src/designer/levels.ts`; `src/designer/building.ts`; `src/store/propertyStore.ts`; `src/designer/designFormat.ts`.

### 2.3 A room (`rooms[]`)

| Key | Type | Unit | Meaning | On load |
|---|---|---|---|---|
| `id` | string | none | Identity of the room. A roof slab has the id `roof-` plus the id of the room under it, or `roof-custom-outline`. | Kept as stored. Absent or `null`: a new random id of 8 characters, a new one on every load. Not checked to be unique. |
| `name` | string | none | Label. | Kept as stored. Absent or `null`: `Room`. |
| `polygon` | list of `{x, y}` | m | The outline. Closed; the last point is not a copy of the first. `[]`: a blank room or a holder with no outline. | Fewer than 3 points: `[]`, unless the first-design keys below give an outline. Then cleaned: a point equal to the point before it is removed, and a last point equal to the first. An outline that winds the wrong way is turned round, first point kept. Data that names an edge follows (3.7). The points are not checked to be finite numbers here; the reader of a design file checks that. |
| `placedItems` | list of placed things | none | The things in this room (2.4). | A list is kept as it is, with no check. Anything else: `[]`. |
| `levelId` | string | none | The storey of the room. Absent: the ground storey. | Kept when it is a string that is not empty and not `ground`. `ground` is left out. A value that names no storey of the design is left out. |
| `kind` | `"room"`, `"outdoor"` or `"roof"` | none | `outdoor`: the holder, one per storey, of things placed outside every room; its outline stays `[]`. `roof`: a roof slab. Absent: a normal room. | Any other value is left out. |
| `openings` | list of openings | none | Doors, doorways, windows and holes in the walls of this room (2.5). | Always written. `[]` when none is kept. |
| `floorFinish` | `{materialId}` or `null` | none | One floor finish over the whole room (2.6). | Always written. `null` unless `materialId` is a string. |
| `floorTiles` | list of zones | none | The floor tile by tile (2.6). | Left out when no zone is kept. |
| `wallPaint` | list | none | Paint on edges (2.7). | Left out when no entry is kept. |
| `wallCladding` | list | none | Cladding on edges (2.7). | Left out when no entry is kept. |
| `wallConstruction` | list | none | What each wall is made of and how thick (2.7). | Left out when no entry is kept. |
| `removedWallEdges` | list of integers | none | Edges of the outline that carry no wall (2.7). | Left out when nothing is kept. |
| `wallArcs` | list of `{edgeIndex, bulge}` | none | Version 2. The curved edges of the outline (2.22). An edge with no entry is straight. | Checked entry by entry. Left out when no entry is kept. Follows the outline when it is cleaned (3.7). |
| `vertices` | list of `{x, y}` | m | First designs only: the outline. | Used as the outline when `polygon` has fewer than 3 points and this has 3 or more. Never written. |
| `lengthM`, `widthM` | number | m | First designs only: a rectangle room. | When there is no outline and one of them is a number, the outline is the rectangle from (0, 0) to (`lengthM`, `widthM`). A missing side is 5 (length) or 4 (width). Never written. |
| `roomDimensions` | `{lengthM, widthM}` | m | First designs only: the same rectangle. | Read like `lengthM` and `widthM` when those are absent. Never written. |
| any other key | JSON | none | Unknown key. | Carried (3.2). |

Source: `src/store/propertyStore.ts`; `src/designer/openings.ts`; `src/lib/geometry.ts`; `src/designer/designFormat.ts`; `src/designer/roof.ts`; `src/designer/designFile.ts`.

### 2.4 A placed thing (`rooms[].placedItems[]`)

The loader does not check a placed thing. Every key is copied as stored. The column "On load" also says what the editor writes.

| Key | Type | Unit | Meaning | On load |
|---|---|---|---|---|
| `instanceId` | string | none | Identity of this placed thing. The app looks a thing up by this id across all rooms. | Not checked. The editor writes a random id of 10 characters. |
| `productId` | string | none | The `id` of a product of the catalogue. The size of the thing is not in the design: it comes from the product (3.9). | Not checked. A thing whose product is not known stays in the design and is not drawn. |
| `x` | number | m | The smallest x of the box, with sides along the axes, round the footprint after rotation. Plan frame, not a room frame. | Not checked. |
| `y` | number | m | The smallest y of that box. | Not checked. |
| `rotation` | number | deg | Turn of the thing, clockwise on the plan, about the centre of its footprint. | Not checked. Not brought into 0 to 360. |
| `parentInstanceId` | string | none | For a thing that sits on another thing: the `instanceId` of the thing it sits on. | Not checked. |
| `mountHeightCm` | number | cm | For a thing on a wall: its underside above the floor of its storey. Absent: the product's own mount height, else 120. | Not checked. |
| `lightOn` | `false` | none | A lamp that is switched off. Absent: on. | Not checked. Only `false` darkens the lamp. |
| `powerOn` | `false` | none | An appliance left out of the energy estimate. Absent: on. | Not checked. The editor writes only `false`. |
| `hoursPerDay` | number | hours | Energy estimate: hours in use per day for this thing. Absent: the product's figure. | Not checked. The editor writes at most 24, with one decimal. |
| `powerW` | number | W | Energy estimate: watts for this thing. Absent: the product's figure. | Not checked. The editor writes a whole number, at most 100000. |
| any other key | JSON | none | Unknown key. | Kept, because the list is copied as it is. |

Source: `src/store/propertyStore.ts`; `src/lib/geometry.ts`; `src/components/RoomCanvas.tsx`; `src/designer/roomView3d.ts`; `src/designer/fitToSize.ts`; `src/designer/placedItemElevation.ts`; `src/components/RoomView3D.tsx`.

### 2.5 An opening (`rooms[].openings[]`)

An opening is kept as stored or dropped as a whole. It is not rebuilt, so a key the loader does not know stays on it.

| Key | Type | Unit | Meaning | On load |
|---|---|---|---|---|
| `id` | string | none | Identity of the opening. The app looks an opening up by this id across all rooms. | Not checked. The editor writes a random id of 10 characters. |
| `edgeIndex` | integer | none | The edge of the room's outline that holds the opening. | Must be a whole number that names an edge of the cleaned outline longer than 1 mm. Otherwise the opening is dropped. Renumbered when the outline is cleaned (3.7). |
| `offsetM` | number | m | Distance along the edge from its start point to the centre of the opening. An absolute length, not a share of the edge. | Must be finite. The opening, from `offsetM - widthM / 2` to `offsetM + widthM / 2`, must lie on the edge. Otherwise it is dropped. Measured from the other end when the outline is turned round (3.7). |
| `widthM` | number | m | Clear width. For a circle: the diameter. | Must be finite, from 0.05 to 100. Otherwise the opening is dropped. |
| `kind` | `"door"`, `"doorway"`, `"window"` or `"hole"` | none | What is cut in the wall. | Any other value drops the opening. |
| `flipFacing` | boolean | none | The side the leaf swings to. `false`: toward the inner side of the edge, into this room. | Not checked. Flipped when the outline is turned round. |
| `flipHand` | boolean | none | The end that holds the hinge. `false`: the end nearer the start point of the edge. | Not checked. Flipped when the outline is turned round. |
| `sillM` | number | m | Bottom of the opening above the floor. Used for a window and a hole only. Absent: 0.9 for a window, 0 for a hole. A door and a doorway always start at the floor. | When present it must be finite, from 0 to 100. Otherwise the opening is dropped. |
| `heightM` | number | m | Clear height. Absent: 2.04 for a door and a doorway, 1.2 for a window, 1 for a hole. A circle is as high as it is wide. | When present it must be finite, from 0.05 to 100. On a circle it must equal `widthM`. Otherwise the opening is dropped. |
| `shape` | `"rectangle"`, `"arch"` or `"circle"` | none | Outline of the opening on the face of the wall. Absent: a rectangle. | Any other value drops the opening. A door or a doorway with `circle` is dropped. |

More rules on load:
- Sill plus height may not be above 200 m. The loader passes 200 as the wall height, so the height of the storey is not checked on load. The editor checks it.
- Not checked on load: the 0.1 m of wall the editor leaves at each end of an edge, and the overlap of two openings on one wall. The editor refuses both.

Source: `src/designer/openings.ts`; `src/designer/openingGeometry.ts`; `src/store/propertyStore.ts`; `src/data/wallPaints.ts`.

### 2.6 A room's floor finish and floor tiles

| Key | Type | Unit | Meaning | On load |
|---|---|---|---|---|
| `floorFinish` | object or `null` | none | One finish over the whole room. `null` or absent: a bare floor. Used for goods sold by the roll, and by designs older than the tiles. | Always written. Built again as `{materialId}`; any other key in it is carried (3.2). `null` unless `materialId` is a string. |
| `floorFinish.materialId` | string | none | The id of a floor material in the table of floor materials. | Must be a string. Not checked against the table. |
| `floorTiles` | list of zones | none | The floor as tiles. One zone per material. When it is present it is the floor, not `floorFinish`. | Not a list, or empty: left out. Each zone is checked and built again from the five keys below; any other key in it is carried (3.2). |
| `floorTiles[].materialId` | string | none | The id of the floor material of this zone. | Must be a string, else the zone is dropped. Not checked against the table. |
| `floorTiles[].tileWm` | number | m | Size of one tile along x. | Must be a number above 0, else the zone is dropped. |
| `floorTiles[].tileHm` | number | m | Size of one tile along y. | Must be a number above 0, else the zone is dropped. |
| `floorTiles[].originM` | `{x, y}` | m | Where the grid of tiles starts, in the plan frame. Stored, so that a change of the outline does not move the tiles. | `x` and `y` must be numbers, else the zone is dropped. |
| `floorTiles[].runs` | list of numbers | none | Flat triples: row, first column, count of tiles. Tile (row, col) covers x from `originM.x + col * tileWm` and y from `originM.y + row * tileHm`. Rows and columns may be negative. | The length must be a multiple of 3 and every number finite, else the zone is dropped. The loader does not check that they are whole numbers. A tile that does not touch the cleaned outline is removed. A zone with no tile left is dropped. |

Source: `src/store/propertyStore.ts`; `src/designer/floorTiles.ts`; `src/data/floorMaterials.ts`.

### 2.7 A room's wall paint, wall cladding, wall construction and removed wall edges

Each list names an edge of the outline by `edgeIndex` (3.6). All four follow the outline when it is cleaned (3.7).

| Key | Type | Unit | Meaning | On load |
|---|---|---|---|---|
| `wallPaint[]` | object | none | Paint on one face of one edge. An edge with no entry is bare. | Built again from the five keys below; any other key is carried (3.2). One entry is kept for one edge and one side; the first wins. All are dropped when the outline has fewer than 3 points. |
| `wallPaint[].edgeIndex` | integer | none | The painted edge. | Must be a whole number of 0 or more, else the entry is dropped. An entry on an edge that no longer exists is dropped. |
| `wallPaint[].paintId` | string | none | The id of a paint in the table of paints. | Must be a string that is not empty, else the entry is dropped. Not checked against the table. |
| `wallPaint[].side` | `"interior"` or `"exterior"` | none | The face of the wall. Absent: the inner face. | Only `"exterior"` is kept. Any other value: absent. |
| `wallPaint[].colourHex` | string | none | The chosen tint of that paint. Absent: the paint's own colour. | Must be 3 or 6 hex digits, with or without `#`. Written as `#RRGGBB` in upper case. Dropped when it is not valid, and when the paint is known and is sold in one colour only. |
| `wallPaint[].colourName` | string | none | The name of the tint. | Kept only with a `colourHex`. Trimmed, single spaces, cut at 80 characters. |
| `wallCladding[]` | object | none | Cladding boards on one edge. | Built again from the two keys below; any other key is carried (3.2). One entry per edge; the first wins. |
| `wallCladding[].edgeIndex` | integer | none | The clad edge. | Must be a whole number that names an edge that still exists, else the entry is dropped. |
| `wallCladding[].productId` | string | none | The id of a product in the table of cladding of this build. | Must be an id of that table, else the entry is dropped. |
| `wallConstruction[]` | object | none | What one wall is made of. An edge with no entry is plastered brick, with no stored thickness. | Built again from the four keys below; any other key is carried (3.2). One entry per edge; the first wins. |
| `wallConstruction[].edgeIndex` | integer | none | The edge. | Must name an edge of the stored outline that still exists, else the entry is dropped. |
| `wallConstruction[].kind` | `"plastered-brick"`, `"brick"`, `"concrete"` or `"glass"` | none | The wall material. | Any other value drops the entry. |
| `wallConstruction[].thicknessMm` | number | mm | Thickness of the wall. | Not glass: kept from 25 to 2000, else left out; the entry stays. Glass: kept from 2 to 40, else 10. |
| `wallConstruction[].materialProductId` | string | none | Glass only: a reference to a glass product. | Kept only for glass, and only when the table of glass has that id with the same thickness. |
| `removedWallEdges` | list of integers | none | The edges that carry no wall. The room and its floor stay. Such an edge holds no opening and is no shared wall. | An entry that is not a whole number within the stored outline is dropped. Renumbered when the outline is cleaned. Repeats are removed. Left out when nothing is kept. |

Source: `src/store/propertyStore.ts`; `src/designer/wallConstruction.ts`; `src/designer/claddingCalc.ts`; `src/data/claddingCatalog.ts`; `src/data/mauritiusGlass.ts`; `src/data/wallPaints.ts`; `src/designer/wallEdges.ts`.

### 2.8 A free wall (`walls[]`)

| Key | Type | Unit | Meaning | On load |
|---|---|---|---|---|
| `id` | string | none | Identity of the wall. | Must be a string that is not empty, else the wall is dropped. A second wall with the same id is dropped. |
| `a` | `{x, y}` | m | One end of the centre line. | `x` and `y` must be finite numbers, else the wall is dropped. |
| `b` | `{x, y}` | m | The other end of the centre line. | As `a`. A wall shorter than 0.0001 m is dropped. |
| `bulge` | number | none | Version 2. The wall is a circular arc from `a` to `b` (2.22). Absent: straight. | Kept when it is a finite number whose size is from 0.000001 to 20. Otherwise left out; the wall stays, straight. |
| `thicknessM` | number | m | Thickness of the wall, half on each side of the line from `a` to `b`. | Must be a finite number above 0, else the wall is dropped. For a glass wall it becomes the cleaned glass thickness (from 2 to 40 mm, else 10 mm). |
| `levelId` | string | none | The storey of the wall. Absent: the ground storey. | Must be a string when present, else the wall is dropped. An empty string is left out. A value that names no storey is left out. `ground` is kept as stored. |
| `construction` | `"plastered-brick"`, `"brick"`, `"concrete"` or `"glass"` | none | The wall material. Absent: plastered. | Any other value is left out. |
| `materialProductId` | string | none | Glass only: a reference to a glass product. | Kept only with `construction: "glass"`, and only when the table of glass has that id with the same thickness. |
| `paintId` | string | none | The id of the paint on the first face. Absent: bare. | Kept when it is a string that is not empty. Not checked against the table of paints. |
| `paintColourHex` | string | none | The tint of that paint. | Kept only with a `paintId`. Written as `#RRGGBB` in upper case. Dropped when it is not valid. |
| `paintColourName` | string | none | The name of the tint. | Kept only with a valid `paintColourHex`. Trimmed, single spaces, cut at 80 characters. |
| `paintFaces` | `2` | none | Both faces are painted with `paintId`. Absent: one face. | Only the value 2 is kept, and only with a `paintId`. |
| `exteriorPaint` | object | none | Paint on the second face: `{edgeIndex, paintId, colourHex, colourName, side}`. | Kept when it is an object with a string `paintId`. Built again with `edgeIndex: 0` and `side: "exterior"`. The tint is cleaned as in 2.7. |
| `claddingId` | string | none | The id of a product in the table of cladding of this build. | Must be an id of that table, else left out. |
| `claddingFaces` | `2` | none | Both faces are clad. Absent: one face. | Only the value 2 is kept, and only with a kept `claddingId`. |
| any other key | JSON | none | Unknown key. | Carried (3.2). |

Source: `src/designer/freeWalls.ts`; `src/store/propertyStore.ts`; `src/designer/wallConstruction.ts`; `src/designer/designFormat.ts`; `src/designer/roomSolids.ts`; `src/components/RoomCanvas.tsx`.

### 2.9 The plot (`site`) and the plot on the map (`site.world`)

The plot:

| Key | Type | Unit | Meaning | On load |
|---|---|---|---|---|
| `widthM` | number | m | Size of the plot along x. | Must be a finite number above 0, else the whole `site` is left out. Held to the range 1 to 500. |
| `depthM` | number | m | Size of the plot along y. | As `widthM`. |
| `originM` | `{x, y}` | m | The corner of the plot with the smallest x and the smallest y, in the frame of the rooms. | (0, 0) unless `x` and `y` are both finite numbers. |
| `world` | object | none | The plot on the map, with its heights. It has its own version. | Copied as it is, with no check, whenever it is not absent. The check below is done later by the app (3.12). |
| any other key | JSON | none | Unknown key. | Carried (3.2). |

Source: `src/store/propertyStore.ts`; `src/designer/designFormat.ts`.

The plot on the map (`site.world`). The loader copies it with no check. The column "On load" below gives the check the app does later, `normaliseGeoSite` (3.12). One fault in any key rejects the whole `world`. A rejected `world` is taken out of `site` and kept aside as it was stored, under `unread.siteWorld` (rule 3). An accepted `world` is built again from the keys below: any other key in it is dropped, which is why a later version of this part raises its `version`.

| Key | Type | Unit | Meaning | On load |
|---|---|---|---|---|
| `version` | `1` | none | Version of this part. | Must be 1. |
| `name` | string | none | Label of the plot. | A string of at most 160 characters. |
| `origin` | `[longitude, latitude]` | deg | Where on the globe the local frame is anchored. Longitude first. WGS84. | Must equal `boundary[0]`. |
| `boundary` | list of `[longitude, latitude]` | deg | The corners of the plot on the globe. | 3 to 200 corners. Longitude within 180, latitude within 85. The corners may span at most 0.1 degree of longitude and 0.01 degree of latitude. |
| `polygon` | list of `{x, y}` | m | The same corners in plan metres: x east, y south. | One point per corner. Each must be within 0.001 m of the point worked out from `boundary` and `anchor`. A simple outline, corners at least 0.01 m apart, area at least 0.1 m2, at most 500 m across. |
| `anchor` | `{x, y}` | m | The plan point given to `boundary[0]`. | Finite numbers. |
| `entry` | `"drawn"` or `"traverse"` | none | How the boundary was entered. | One of the two. |
| `traverse` | list of `{lengthM, bearing}` | m, text | The sides as typed from a survey plan. A bearing runs clockwise from north. | At most 200 sides. `lengthM` above 0, at most 10000. `bearing` a string of at most 79 characters. |
| `closureErrorM` | number | m | The gap left when the typed sides did not close. | Finite, 0 or more. |
| `terrain` | object | none | Heights of the ground and a platform level. | See the next five rows. |
| `terrain.source` | `"survey"` or `"typed what-if"` | none | Where the heights come from. | One of the two. |
| `terrain.verticalReference` | string | none | The datum of the heights, in words. | Not blank, at most 300 characters. |
| `terrain.points` | list of `{x, y, z}` | m | Plan position and height. | 3 to 1000 points. For `typed what-if`: one point per corner of `polygon`, at the same x and y. |
| `terrain.contours` | list of lists of integers | none | Lines, as indexes into `points`. | At most 200 lines, 2 to 1000 indexes each, 1000 in all. |
| `terrain.platformM` | number | m | The level of the proposed platform. | Finite, within 10000. |
| `planning` | object | none | A planning rule typed by the user: `setbackM`, `maxCoveragePct`, `source`, `verified`. | `setbackM` 0 to 1000. `maxCoveragePct` above 0, at most 100. `source` not blank, at most 1000 characters. `verified` a boolean. |
| `publicData` | object | none | A stored copy of public data: `fetchedAt`, `errors`, `solar`, `context`, `terrain`. | At most 30000 characters as JSON. `fetchedAt` a date and time as text. Each of `solar`, `context` and `terrain` has a `sourceUrl` that must start with a fixed address written in the check. |
| `publicData.solar` | object | kWh, deg | `annualKwh`, `tiltDeg`, `sourceUrl`, `acquiredAt`, `radiationDatabase`, `periodStartYear`, `periodEndYear`, `version`. | `annualKwh` 0 or more. `tiltDeg` 0 to 90. Years whole, from 1900 to 2200, start not after end. |
| `publicData.context` | object | count | `roads`, `buildings`, `waterways`, `power`, `landuse`, `sourceUrl`, `acquiredAt`. | The four counts whole, 0 or more. `landuse` at most 200 strings. |
| `publicData.terrain` | object | m | `heightsM`, `resolutionM`, `sourceUrl`, `verticalReference`, `sources`, `attribution`, `resolutionNote`, `acquiredAt`. | `heightsM`: one height per corner of `boundary`. `resolutionM` above 0. |
| `foundationShiftM` | number | m | A shift. Its use was not read. | Finite, within 100. |
| `sample` | `true` | none | Marks a practice plot. | Only `true`. |

Source: `src/site/types.ts`; `src/site/geometry.ts`; `src/site/hydration.ts`.

### 2.10 A stair (`stairs[]`)

| Key | Type | Unit | Meaning | On load |
|---|---|---|---|---|
| `id` | string | none | Identity of the stair. | Must be a string that is not empty, else the stair is dropped. A second stair with the same id is dropped. |
| `fromLevelId` | string | none | The lower storey. | Must name a storey of the design that is not the roof storey, else the stair is dropped. |
| `toLevelId` | string | none | The upper storey. | Must name another storey with a higher `index`, else the stair is dropped. The floor of `toLevelId` must be higher than the floor of `fromLevelId`. |
| `x` | number | m | Centre of the footprint. | Must be finite, else the stair is dropped. |
| `y` | number | m | Centre of the footprint. | As `x`. |
| `widthM` | number | m | Width of the flight. | Must be from 0.6 to 5, else the stair is dropped. Not clamped. |
| `runM` | number | m | Length of the flight on the plan. | Must be from 1 to 30, else the stair is dropped. Not clamped. |
| `rotation` | number | deg | Clockwise on the plan. At 0 the stair climbs toward +y. | Must be finite. Brought into 0 to 360. |
| any other key | JSON | none | Unknown key. | Carried (3.2). |

Source: `src/designer/building.ts`; `src/store/propertyStore.ts`; `src/designer/designFormat.ts`.

### 2.11 The roof (`roof`)

| Key | Type | Unit | Meaning | On load |
|---|---|---|---|---|
| `style` | `"flat"`, `"gable"` or `"shed"` | none | The form of the roof. | Any other value drops the whole `roof`. |
| `material` | `"felt"`, `"tile"`, `"metal"`, `"iron-sheet"` or `"concrete"` | none | The covering. | Any other value drops the whole `roof`. |
| `pitchDeg` | number | deg | Slope of a gable and of a shed roof. | A finite number is held to 5 to 60. Anything else: 25. |
| `overhangM` | number | m | How far the roof reaches beyond the outline. | A finite number is held to 0 to 1.5. Anything else: 0.2. |
| `thicknessM` | number | m | Thickness of the covering, at a right angle to the face. Absent: 0.001 for iron sheet, 0.12 for concrete, else 0.08, times the cosine of the pitch on a roof that is not flat. | When present it must be a finite number from 0.0003 to 2. Otherwise the whole `roof` is dropped. |
| `outline` | list of `{x, y}` | m | A roof outline drawn by hand. Absent: one roof slab per room of the storey under the roof. | Kept when it is a simple outline of 3 to 512 points with an area of at least 0.01 m2. Otherwise left out; the roof stays. An outline with a negative shoelace sum is reversed as a whole list. |
| any other key | JSON | none | Unknown key. | Carried (3.2). |

The whole `roof` is left out when the design has no roof storey. A design with a roof storey and no `roof` is read as flat, felt, 25, 0.2.

Source: `src/designer/building.ts`; `src/designer/measuredPath.ts`; `src/designer/roofSurface.ts`; `src/designer/roof.ts`; `src/store/propertyStore.ts`; `src/designer/designFormat.ts`.

### 2.12 The garden (`garden`), its surfaces, pools and fences

| Key | Type | Unit | Meaning | On load |
|---|---|---|---|---|
| `surfaces` | list | none | Patches of ground and pools. A later one is drawn on top. | Not a list: `[]`. An entry with a fault is dropped as a whole. |
| `fences` | list | none | Straight runs of fence or hedge. | Not a list: `[]`. An entry with a fault is dropped as a whole. |
| any other key of `garden` | JSON | none | Unknown key. | Carried (3.2). The garden is left out when it has no surface, no fence and no carried key. |

A surface (`garden.surfaces[]`):

| Key | Type | Unit | Meaning | On load |
|---|---|---|---|---|
| `id` | string | none | Identity. One list of ids for surfaces and fences together. | 1 to 100 characters. A second entry with the same id is dropped; surfaces are read first. |
| `kind` | `"lawn"`, `"soil"`, `"gravel"`, `"path"`, `"concrete"`, `"tarmac"` or `"pool"` | none | The kind of surface. | Any other value drops the surface. |
| `x` | number | m | The smallest x of the surface. | Finite, within 10000. |
| `y` | number | m | The smallest y of the surface. | Finite, within 10000. |
| `widthM` | number | m | Size along x. | From 0.2 to 500. |
| `depthM` | number | m | Size along y on the plan. It is not a thickness. | From 0.2 to 500. |
| `elevationM` | number | m | Level of the surface above the ground. | Needed. From 0 to 2. |
| `pavingProductId` | string | none | A reference to a paving product. | Trimmed. Kept when 1 to 100 characters, else left out; the surface stays. |
| `outline` | list of `{x, y}` | m | The shape, in plan metres. Absent: the rectangle of `x`, `y`, `widthM`, `depthM`. | A simple outline whose points lie inside that rectangle. A faulty outline drops the surface. Not allowed on a pool. |
| `thicknessM` | number | m | Thickness of the material. | When present: from 0.001 to 5, else the surface is dropped. |
| `subBaseDepthM` | number | m | Depth of the layer under it. | When present: from 0 to 10, else the surface is dropped. |
| `pool` | object | none | The basin of a pool. | Read only when `kind` is `pool`. On another kind it is dropped. A pool with no `pool` gets the defaults below. A faulty `pool` drops the surface. |
| `pilotPermeable` | boolean | none | Worked out for the screen. | Never stored. Dropped on purpose. |
| any other key | JSON | none | Unknown key. | Carried (3.2). |

A pool (`garden.surfaces[].pool`):

| Key | Type | Unit | Meaning | On load |
|---|---|---|---|---|
| `shellDepthM` | number | m | From the floor of the basin to its rim. Default 1.5. | From 0.2 to 10. |
| `waterDepthM` | number | m | Depth of the water above the floor. Default 1.35. | From 0 to `shellDepthM`. |
| `wallThicknessM` | number | m | Thickness of the wall of the basin. Default 0.2. | From 0.01 to 2. |
| `baseThicknessM` | number | m | Thickness of the base. Default 0.2. | From 0.01 to 2. |
| `excavationMarginM` | number | m | Digging beyond the basin. Default 0.3. | From 0 to 5. |
| `stage` | `"excavation"`, `"shell"` or `"filled"` | none | The stage that is shown. Default `filled`. | One of the three. |
| `productReferenceId` | string | none | A reference only. | Kept when 1 to 100 characters. |
| any other key | JSON | none | Unknown key. | Carried (3.2). |

A fence (`garden.fences[]`):

| Key | Type | Unit | Meaning | On load |
|---|---|---|---|---|
| `id` | string | none | Identity. | 1 to 100 characters, not used by a surface or an earlier fence. |
| `a` | `{x, y}` | m | Start of the run. | Finite, within 10000. |
| `b` | `{x, y}` | m | End of the run. | Finite, within 10000. The run must be 0.2 to 1000 m long. |
| `heightM` | number | m | Height. | From 0.3 to 3. |
| `material` | `"timber"`, `"metal"` or `"hedge"` | none | The kind of fence. | One of the three. |
| any other key | JSON | none | Unknown key. | Carried (3.2). |

Source: `src/designer/garden.ts`; `src/designer/designFormat.ts`; `src/store/propertyStore.ts`.

### 2.13 The materials settings (`materials`)

The reader is `normaliseMaterialsSettings`. It never rejects, and it reads the settings as their version 1 whatever number they say. It builds a full object: a number that is finite is held to its range, anything else becomes the default. A key it does not know is carried at the TOP level of the settings (3.2) and dropped inside one of their groups (`wall`, `mortar`, `plaster`, `concrete`, `base`, `pillars`, `roof`). So a new setting goes at the top level, or under a new key of the design.

| Key | Type | Unit | Meaning | On load |
|---|---|---|---|---|
| `version` | `1` | none | Version of this part. | Always written as 1, whatever was stored. |
| `scope` | `"all"` or `"active"` | none | What the estimate covers. | `"active"` is kept. Anything else: `"all"`. |
| `quotationTaxBasis` | `"inclusive"` or `"exclusive"` | none | The tax basis of the typed rates. | Kept when one of the two, else left out. |
| `unitRates` | object, by id | none | Rates typed by the user: the one place of version 1 that holds figures of money (rule 6). Each entry: the rate (a number, under the three-letter key the code gives it in `src/designer/materials/types.ts`), `unit`, `specification`, `taxBasis`. | When present: at most the first 200 entries. An entry is kept when its id is 1 to 1200 characters of `a-z`, `0-9` and `-`, the rate is from 0 to 1e9, `unit` is one of nine unit names and `specification` is a string of at most 500 characters. |
| `wall.kind` | `"block"` or `"concrete"` | none | How the walls are built. | `"concrete"` is kept. Anything else: `"block"`. |
| `wall.presetId` | string | none | The id of a block preset. | Absent: the default preset. A string that names a preset of the table is kept. Anything else: `"custom"`. |
| `wall.thicknessM` | number | m | Thickness of the wall product. | 0.025 to 2. Default 0.15. |
| `wall.blockLengthM` | number | m | Length of a block. | 0.05 to 2. Default 0.45. |
| `wall.blockHeightM` | number | m | Height of a block. | 0.05 to 2. Default 0.2. |
| `wall.dimensionBasis` | `"actual"` or `"nominal"` | none | What the block sizes mean. | `"nominal"` is kept. Anything else: `"actual"`. |
| `wall.jointMm` | number | mm | Mortar joint. | 0 to 40. Default 10. |
| `wall.beddingFraction` | number | share | 1 is a full bed of mortar. | 0.01 to 1. Default 1. |
| `wall.wastePct` | number | percent | Allowance. | 0 to 100. Default 5. |
| `mortar` | a mix | none | The mortar mix. See the mix table. | `aggregate` is always 0. |
| `plaster.sides` | `0`, `1` or `2` | count | Faces plastered. | 1 and 2 are kept. Anything else: 0. |
| `plaster.thicknessMm` | number | mm | Thickness of the plaster. | 1 to 100. Default 15. |
| `plaster.mix` | a mix | none | The plaster mix. | `aggregate` is always 0. Default `sand` 4. |
| `concrete` | a mix and `supply` | none | The concrete mix. | See the mix table. |
| `concrete.supply` | `"ready-mix"` or `"site-mix"` | none | How the concrete comes. | `"site-mix"` is kept. Anything else: `"ready-mix"`. |
| `base.enabled` | boolean | none | Count a ground base. | Only `true` is true. |
| `base.depthM` | number | m | Depth of the base. | 0.01 to 5. Default 0.15. |
| `base.areaOverrideM2` | number or `null` | m2 | An area typed by hand. `null`: the measured footprint. | A finite number above 0, at most 1e6. Anything else: `null`. |
| `pillars.count` | integer | count | Number of pillars. | 0 to 10000, cut to a whole number. Default 0. |
| `pillars.widthM`, `pillars.depthM` | number | m | Section of a pillar. | 0.05 to 5. Default 0.2. |
| `pillars.heightM` | number | m | Height of a pillar. | 0.05 to 100. Default 2.7. |
| `roof.kind` | `"none"`, `"reinforced-concrete"` or `"sheet"` | none | The roof in the estimate. | The last two are kept. Anything else: `"none"`. |
| `roof.depthM` | number | m | Depth of a concrete roof. | 0.01 to 5. Default 0.15. |
| `roof.areaOverrideM2` | number or `null` | m2 | An area typed by hand. | Above 0, at most 1e6. Anything else: `null`. |
| `roof.lengthOverrideM`, `roof.widthOverrideM` | number or `null` | m | Sizes typed by hand. | Above 0, at most 10000. Anything else: `null`. |
| `roof.rebar.enabled` | boolean | none | Count steel. | Only `true` is true. |
| `roof.rebar.diameterMm` | number | mm | Bar diameter. | 4 to 50. Default 10. |
| `roof.rebar.spacingMm` | number | mm | Bar spacing. | 10 to 2000. Default 200. |
| `roof.rebar.layers` | integer | count | Layers of mesh. | 1 to 10, cut to a whole number. Default 1. |
| `roof.rebar.coverMm` | number | mm | Concrete cover. | 0 to 200. Default 25. |
| `roof.rebar.stockLengthM` | number | m | Length of a stock bar. | 0.5 to 30. Default 6. |
| `roof.rebar.lapLengthM` | number | m | Lap of two bars. | 0 to 10. Default 0. |
| `roof.rebar.wastePct` | number | percent | Allowance. | 0 to 100. Default 5. |
| `roof.sheet.presetId` | string | none | The id of a sheet preset. | Absent: the default preset. A string that names a preset of the table is kept. Anything else: `"custom"`. |
| `roof.sheet.pitchDeg` | number | deg | Slope of the sheets. | 0 to 75. Default 15. |
| `roof.sheet.slopes` | `1` or `2` | count | Number of slopes. | 1 is kept. Anything else: 2. |
| `roof.sheet.effectiveCoverM` | number | m | Width one sheet covers, side lap taken off. | 0.1 to 3. Default 1. |
| `roof.sheet.sheetLengthM` | number | m | Length of a sheet. | 0.1 to 30. Default 6. |
| `roof.sheet.endLapM` | number | m | End lap. | 0 to 2. Default 0.2. |
| `roof.sheet.overhangM` | number | m | Overhang. | 0 to 3. Default 0. |
| `roof.sheet.wastePct` | number | percent | Allowance. | 0 to 100. Default 5. |
| `roof.sheet.fastenersPerM2` | number | per m2 | Fixings. | 0 to 100. Default 5. |
| `roof.sheet.ridgeLengthM`, `roof.sheet.flashingLengthM`, `roof.sheet.gutterLengthM` | number | m | Lengths of trim. | 0 to 10000. Default 0. |
| `roof.sheet.trimStockLengthM` | number | m | Length of a stock trim. | 0.1 to 30. Default 3. |
| `roof.sheet.trimLapM` | number | m | Lap of two trims. | 0 to 2. Default 0.15. |
| `roof.sheet.purlinSpacingM` | number | m | Spacing of purlins. 0: none. | 0 to 10. Default 0. |

A mix (`mortar`, `plaster.mix`, `concrete`):

| Key | Type | Unit | Meaning | On load |
|---|---|---|---|---|
| `cement` | number | parts | Parts of cement, by dry loose volume. | 0.01 to 100. Default 1. |
| `sand` | number | parts | Parts of sand. | 0.01 to 100. Default 3 (mortar), 4 (plaster), 2 (concrete). |
| `aggregate` | number | parts | Parts of stone. | Concrete: 0 to 100, default 3. Mortar and plaster: always written as 0. |
| `dryVolumeFactor` | number | factor | Dry volume for one wet volume. | 1 to 3. Default 1.33 (mortar, plaster), 1.54 (concrete). |
| `cementBulkDensityKgM3` | number | kg per m3 | Bulk density of cement. | 500 to 2000. Default 1440. |
| `bagKg` | number | kg | Weight of one bag. | 1 to 100. Default 25. |
| `wastePct` | number | percent | Allowance. | 0 to 100. Default 10 (mortar, plaster), 5 (concrete). |

Source: `src/designer/materials/types.ts`; `src/designer/materials/settings.ts`; `src/store/propertyStore.ts`.

### 2.14 `services`: pipes, cables, fixtures

Reader: `normaliseBuildingServices`, then `resolveServiceConnections`. The section goes to `unread` only when it is not an object, when `version` is not 1, or when `junctions` is present and is not a list. A run, a fixture or a junction with a fault is dropped alone, without a word. Entries are built again: a key not listed here is dropped. Full check: `src/designer/buildingServices.ts`. Strict contract, used by the server: `src/designer/buildingServicesContract.ts`.

| Key | Type | Unit | Meaning | On load |
|---|---|---|---|---|
| `version` | `1` | none | Version of this section. | Must be 1. |
| `runs` | list | none | Pipes, conduits and ducts. | Not a list: empty. Only the first 2000 entries are read. A run shorter than 0.01 m is dropped. |
| `fixtures` | list | none | Fixtures and equipment. | Not a list: empty. Only the first 2000 entries are read. |
| `junctions` | list | none | Points where runs are joined. Two runs that only cross are not joined. | Written only when it was stored. Only the first 2000 entries are read. |
| `runs[].id`, `fixtures[].id`, `junctions[].id` | string | none | Identity. One list of ids for the three lists together. | 1 to 128 characters. A repeated id drops the later entry. |
| `runs[].levelId`, `fixtures[].levelId`, `junctions[].levelId` | string | none | The storey. It is always written here, `ground` too. | Must name a storey of the design, else the entry is dropped. |
| `runs[].system`, `junctions[].system` | string | none | One of eight systems: `cold-water`, `hot-water`, `waste`, `electrical`, `ventilation`, `refrigerant`, `fire-water`, `data`. | Any other value drops the entry. |
| `runs[].materialId` | string | none | The id of a material of the services table. | 1 to 128 characters. Not checked against the table. |
| `runs[].diameterMm` | number | mm | Diameter. | From 5 to 1000. |
| `runs[].points` | list of `{x, y, elevationM, junctionId}` | m | The route on the plan. `elevationM` and `junctionId` are optional. | 2 to 500 points. `x`, `y` within 10000. `elevationM` from -20 to 20. One faulty point drops the run. |
| `runs[].startElevationM`, `runs[].endElevationM` | number | m | Centre line at each end, above the finished floor of the storey. Below the floor is negative. | From -20 to 20. Set again from a linked port or junction. |
| `runs[].startConnection`, `runs[].endConnection` | `{fixtureId, portId}` | none | A link from an end of the run to a port of a fixture. | Kept when `fixtureId` is 1 to 128 characters and `portId` is a system name. A run whose end has both a link and a `junctionId` is dropped. |
| `fixtures[].kind` | string | none | One of 13 kinds of fixture. | Any other value drops the fixture. |
| `fixtures[].x`, `fixtures[].y` | number | m | Centre of the fixture; its ports are placed round this point. | Within 10000. |
| `fixtures[].widthM`, `fixtures[].depthM`, `fixtures[].heightM` | number | m | Size of the fixture. | From 0.005 to 5. |
| `fixtures[].rotation` | number | deg | Turn on the plan. | From -36000 to 36000. Brought into 0 to 360. |
| `fixtures[].elevationM` | number | m | Underside of the fixture above the floor of its storey. | When present: from -20 to 20, else the fixture is dropped. |
| `fixtures[].productReferenceId` | string | none | A reference to a catalogue entry. | When present: 1 to 128 characters, else the fixture is dropped. |
| `fixtures[].portElevationsM` | object, by system | m | Heights of ports typed by the user. | Only entries from -20 to 20 under a system name are kept. |
| `fixtures[].connectionLabel` | string | none | A reference in words. | Kept when 1 to 128 characters. Trimmed. |
| `junctions[].x`, `junctions[].y` | number | m | Position. | Within 10000. |
| `junctions[].elevationM` | number | m | Height above the floor of the storey. | Needed. From -20 to 20. |

After reading, a point with the `junctionId` of a junction on the same storey and system takes that junction's `x`, `y` and `elevationM`. A linked end takes the position of its port.

Source: `src/designer/buildingServices.ts`; `src/designer/serviceConnections.ts`; `src/store/propertyStore.ts`.

### 2.15 `terrainCuts`: dug cells

Reader: `validCuts`. All or nothing: one fault sends the whole list to `unread`. An accepted list is kept as it was stored, so an extra key on a cell stays. Full check: `src/designer/terrainCuts.ts`.

| Key | Type | Unit | Meaning | On load |
|---|---|---|---|---|
| the list | list | none | Cells of one metre by one metre. | At most 512 cells. |
| `[].id` | string | none | Identity of the cell. | Must be `x`, a comma and `y`. No two cells with one id. |
| `[].x`, `[].y` | integer | m | The corner of the cell with the smallest x and y. The cell reaches to `x + 1` and `y + 1`. | Whole numbers within 100000. |
| `[].topM` | number | m | Height of the top of the cell above the project datum. | Finite, within 10000. |
| `[].depthM` | number | m | Depth dug below `topM`. | Above 0, at most 20. |

Source: `src/designer/terrainCuts.ts`; `src/store/propertyStore.ts`.

### 2.16 `boundaryComponents`: measured shapes in 3D

Reader: `validComponents`. All or nothing. An accepted list is kept as it was stored. A component with any key other than the five below is refused. Full check: `src/designer/boundaryModel.ts`.

| Key | Type | Unit | Meaning | On load |
|---|---|---|---|---|
| the list | list | none | Components. | At most 128. |
| `[].id` | string | none | Identity. | 1 to 96 characters of letters, digits, `_` and `-`. Unique. |
| `[].name` | string | none | Label. | Not blank, at most 80 characters. |
| `[].vertices` | list of `{x, y, z}` | m | Points. x and y are plan coordinates, z is height. | At most 512. Each number finite, within 100000. |
| `[].edges` | list of `[i, j]` | none | Pairs of indexes into `vertices`. | At least 1, at most 1024, and 8192 in the whole list. The two indexes differ. |
| `[].faces` | list of lists of integers | none | Each face is a loop of edges. An entry is an edge number counted from 1; a negative number takes the edge backwards. | At most 256 faces of at most 128 entries, and 12288 entries in the whole list. Each loop must close, lie in one plane and not cross itself. |

Source: `src/designer/boundaryModel.ts`; `src/store/propertyStore.ts`.

### 2.17 `foundation`

Reader: `normaliseFoundation`. One fault anywhere sends the whole section to `unread`; nothing is clamped. An accepted section is built again: a key not listed here is dropped without a word. Full check: `src/designer/foundation.ts`. Strict contract: `src/designer/foundationContract.ts`.

| Key | Type | Unit | Meaning | On load |
|---|---|---|---|---|
| `version` | `1` | none | Version of this section. | Must be 1. |
| `enabled` | boolean | none | The foundation is in use. | Must be a boolean. |
| `elements` | list | none | Slabs, strips and pads. Each is a rectangle with sides along the axes. | At most 100. |
| `bores` | list | none | Round holes. | At most 100. Written only when it was stored. |
| `concreteProductId` | string | none | A reference to a concrete product. | One of two fixed ids written in the check, else the section is refused. |
| `elements[].id`, `bores[].id` | string | none | Identity. One list of ids for both lists. | Not blank, at most 128 characters. Unique. |
| `elements[].name`, `bores[].name` | string | none | Label. | Not blank, at most 128 characters. Trimmed. |
| `elements[].kind` | `"slab"`, `"strip"` or `"pad"` | none | The kind of element. | One of the three. |
| `elements[].x`, `elements[].y` | number | m | Centre of the rectangle. | Within 10000. |
| `elements[].lengthM` | number | m | Size along x. | From 0.1 to 1000. |
| `elements[].widthM` | number | m | Size along y. | From 0.1 to 1000. |
| `elements[].depthM` | number | m | Thickness, downward from the top. | From 0.01 to 10. |
| `elements[].topElevationM` | number | m | Top, measured from the finished floor of the ground storey. | From -30 to 10. |
| `elements[].rebar` | object | mm, m | Steel: `enabled`, `diameterMm`, `spacingMm`, `layers`, `coverMm`, `stockLengthM`, `lapLengthM`, `wastePct`. | All eight are needed. The lap must be shorter than the stock bar. Enabled steel must fit in the element. |
| `elements[].excavation` | object | m | The hole for the element: `depthM`, `topElevationM`, `marginM`, `stage` (`excavated` or `filled`). | Optional. The concrete must lie between the top and the bottom of the hole. |
| `bores[].x`, `bores[].y` | number | m | Centre of the hole. | Within 10000. |
| `bores[].diameterM` | number | m | Diameter. | From 0.1 to 100. |
| `bores[].depthM` | number | m | Depth. | From 0.01 to 30. |
| `bores[].topElevationM` | number | m | Top of the hole. | From -30 to 10. |

Source: `src/designer/foundation.ts`; `src/designer/foundationContract.ts`; `src/store/propertyStore.ts`.

### 2.18 `shade`: shade sails

Reader: `normaliseShade`. One fault anywhere sends the whole section to `unread`; nothing is clamped. An accepted section is built again: a key not listed here is dropped without a word. Full check: `src/designer/shade.ts`. Strict contract: `src/designer/shadeContract.ts`.

| Key | Type | Unit | Meaning | On load |
|---|---|---|---|---|
| `version` | `1` | none | Version of this section. | Must be 1. |
| `enabled` | boolean | none | The sails are in use. | Must be a boolean. |
| `sails` | list | none | The sails. | At most 20. |
| `sails[].id` | string | none | Identity. | Not blank, at most 128 characters. Unique. |
| `sails[].name` | string | none | Label. | Not blank, at most 128 characters. |
| `sails[].fabric` | string | none | One of two fabric ids of the table in `src/designer/shade.ts`. | Any other value refuses the section. |
| `sails[].anchors` | list of `{id, x, y, heightM, support}` | m | The fixing points, in order round the sail. `x`, `y`: plan metres. `heightM`: above the ground datum. `support`: `post` or `wall`. | 3 to 6 points. `id` unique in the sail. `x`, `y` within 10000. `heightM` from 0.5 to 12. |
| `sails[].cornerGapM` | number | m | Room for the fittings between a fixing point and the corner of the sail. | From 0.05 to 1. |
| `sails[].edgeCurvePct` | number | percent | Depth of the curve of an edge, as a share of its straight length. | From 0 to 15. |
| `sails[].colour` | string | none | Colour for the picture. | `#` and six hex digits. |
| `sails[].made` | `{edgesM}` | m | For a sail that exists: the length of each edge, in the order of the anchors. | Optional. One number per anchor, each from 0.3 to 60. |

Source: `src/designer/shade.ts`; `src/store/propertyStore.ts`.

### 2.19 `city`: roads, networks and equipment round the house

Reader: `normaliseCity`. One fault anywhere sends the whole section to `unread`; nothing is clamped. An accepted section is built again: a key not listed here is dropped without a word. Same frame as the house: x right, y down. Full check: `src/designer/city.ts`. Strict contract: `src/designer/cityContract.ts`.

| Key | Type | Unit | Meaning | On load |
|---|---|---|---|---|
| `version` | `1` | none | Version of this section. | Must be 1. |
| `enabled` | boolean | none | The section is in use. | Must be a boolean. |
| `site` | object | m | The rectangle of the city site. | Needed. |
| `site.originM` | `{x, y}` | m | The corner with the smallest x and y. | Within 10000. |
| `site.widthM`, `site.lengthM` | number | m | Size along x and along y. | From 1 to 10000. The far corner must stay within 10000. |
| `roads` | list | none | Roads. | At most 64 roads and 128 segments in all. |
| `networks` | list | none | Pipes and ducts in trenches. | At most 128 networks and 128 segments in all. |
| `assets` | list | none | Equipment, green space and buildings. | At most 300, of which at most 64 are of kind `building` or `data-centre`. |
| `dataCentre` | object | none | A scenario of ten numbers: `racks`, `kWPerRack`, `utilisation`, `pue`, `annualHours`, `pvKWp`, `yieldKWhPerKWp`, `batteryKWh`, `batteryUsableFraction`, `wueLPerKWh`. | Optional. Ranges in `src/designer/city.ts`. |
| `roads[].id`, `networks[].id`, `assets[].id` | string | none | Identity. One list of ids for the three lists. | Not blank, at most 128 characters. Unique. |
| `roads[].name`, `networks[].name`, `assets[].name` | string | none | Label. | Not blank, at most 128 characters. |
| `roads[].supplierRef`, `networks[].supplierRef`, `assets[].supplierRef` | string | none | A reference in words. | Optional. Not blank, at most 128 characters. |
| `roads[].presetId` | string | none | The id of a road section preset. | Not blank, at most 128 characters. |
| `roads[].points` | list of `{x, y}` | m | The centre line. | 2 to 65 points, at least 0.01 m apart. |
| `roads[].widthM` | number | m | Width. | From 0.5 to 100. |
| `roads[].surfaceDepthM`, `roads[].baseDepthM` | number | m | Depth of the surface layer and of the base layer. | 0.001 to 2, and 0 to 5. |
| `networks[].system` | `"water"`, `"sewer"`, `"stormwater"`, `"power"` or `"fibre"` | none | The system. | One of the five. |
| `networks[].points` | list of `{x, y, z}` | m | The route. `z` is height above the ground datum; under ground is negative. | 2 to 65 points. `z` from -30 to 100. |
| `networks[].diameterMm` | number | mm | Outside diameter. | From 1 to 5000. It must fit in the trench. |
| `networks[].trenchWidthM`, `networks[].trenchDepthM` | number | m | The trench. | 0.05 to 20, and 0.05 to 30. |
| `networks[].stockLengthM` | number | m | Length of one stock piece. | Optional. From 0.1 to 10000. |
| `assets[].kind` | string | none | One of nine kinds, listed in `src/designer/city.ts`. | Any other value refuses the section. |
| `assets[].x`, `assets[].y` | number | m | Centre. | Within 10000. |
| `assets[].widthM`, `assets[].lengthM`, `assets[].heightM` | number | m | Size along x, along y and upward, at rotation 0. | 0.05 to 1000 for the first two, 0.01 to 500 for the height. |
| `assets[].rotation` | number | deg | Clockwise on the plan. | From -36000 to 36000. Brought into 0 to 360. |
| `assets[].buildingLink` | `"current"` | none | This asset stands for the house of this design. | Only on kind `building`. At most one in the section. |
| `assets[].buildingForm` | list of `{base, top, polygon}` | share | The form of a building inside a box of 1 by 1 by 1: `polygon` points from -0.5 to 0.5, `base` and `top` from 0 to 1. | Only on kind `building`. 1 to 64 rooms. |
| `assets[].powerW`, `assets[].solarKWp`, `assets[].batteryKWh`, `assets[].tankCapacityL` | number | W, kWp, kWh, litres | Ratings. | Optional. From 0 to 1e9. |
| `assets[].hoursPerDay` | number | hours | Hours in use per day. | Optional. From 0 to 24. |

Source: `src/designer/city.ts`; `src/designer/cityBuildingForm.ts`; `src/designer/cityContract.ts`; `src/store/propertyStore.ts`.

### 2.20 `eco`: trees, green roofs, the water study

Reader: `normaliseEco`, a strict schema. One fault, or one key the schema does not know, sends the whole section to `unread`. Strings are trimmed. Full check: `src/designer/ecoContract.ts`.

| Key | Type | Unit | Meaning | On load |
|---|---|---|---|---|
| `version` | `1` | none | Version of this section. | Must be 1. |
| `trees` | list | none | Trees that exist and trees that are planned. | Needed. At most 300. |
| `greenRoofs` | list | none | Planted roofs. | Needed. At most 100. One per roof room. |
| `waterStudy` | object | none | Inputs of the water study and switches for the picture. | Optional. |
| `trees[].id`, `greenRoofs[].id` | string | none | Identity. One list of ids for both lists. | 1 to 128 characters. Unique. |
| `trees[].name`, `greenRoofs[].name` | string | none | Label. | 1 to 160 characters. |
| `trees[].x`, `trees[].y` | number | m | Position on the plan. | Within 10000. |
| `trees[].heightM` | number | m | Height of the tree. | From 0.1 to 100. |
| `trees[].canopyRadiusM` | number | m | Radius of the crown. | From 0.1 to 50. |
| `trees[].status` | `"existing"` or `"proposed"` | none | State of the tree. | One of the two. |
| `trees[].protectionMethod` | string | none | How the protection radius is set. One of three values in the schema. | Needed. |
| `trees[].species`, `trees[].stemDiameterMm`, `trees[].protectionRadiusM`, `trees[].surveyRef`, `trees[].veteran` | string, number, number, string, boolean | none, mm, m, none, none | More about the tree. | Optional. Ranges in `src/designer/ecoContract.ts`. |
| `greenRoofs[].roomId` | string | none | The `id` of a room of kind `roof`. | 1 to 128 characters. Not used twice. |
| `greenRoofs[].areaM2` | number | m2 | Planted area. Absent: the area of the roof room. | Optional. From 0.01 to 1000000. |
| `greenRoofs[].saturatedKgM2`, `greenRoofs[].extraRetainedWaterMm`, `greenRoofs[].additionalLoadCapacityKPa`, `greenRoofs[].capacityRef`, `greenRoofs[].specificationRef` | number, number, number, string, string | kg per m2, mm, kPa, none, none | Weight and references. | Optional. Ranges in `src/designer/ecoContract.ts`. |
| `waterStudy.region`, `waterStudy.people`, `waterStudy.runoff`, `waterStudy.tankL`, `waterStudy.homeLDay`, `waterStudy.greyLDay`, `waterStudy.gardenLDay`, `waterStudy.infiltration`, `waterStudy.recycledPct`, `waterStudy.aggregateTM3`, `waterStudy.mossRoom`, `waterStudy.blockRoom`, `waterStudy.pavingId`, `waterStudy.coolRoof` | mixed | mixed | The needed inputs. `mossRoom` and `blockRoom` are room ids or `null`. `pavingId` is the id of a garden surface or `null`. | All needed when `waterStudy` is present. Ranges in `src/designer/ecoContract.ts`. |
| `waterStudy.place`, `waterStudy.kinetic`, `waterStudy.wind`, `waterStudy.windPoint`, `waterStudy.kineticPoint` | string, boolean, boolean, `{x, y}`, `{x, y}` | none, none, none, m, m | A place label and two things shown in the picture, with their plan points. | Optional. |

Source: `src/designer/ecoContract.ts`; `src/designer/eco.ts`; `src/designer/buildingScene.ts`; `src/store/propertyStore.ts`.

### 2.21 `engineering`: references to project papers

Reader: `normaliseEngineeringInputs`, a strict schema. One fault, or one key the schema does not know, sends the whole section to `unread`. Full check: `src/designer/ecoContract.ts`.

| Key | Type | Unit | Meaning | On load |
|---|---|---|---|---|
| `version` | `1` | none | Version of this section. | Must be 1. |
| `geotechnicalReportRef` | string | none | A reference in words. | Optional. Trimmed, 1 to 500 characters. |
| `structuralDesignRef` | string | none | A reference in words. | Optional. Trimmed, 1 to 500 characters. |
| `concreteGrade` | string | none | A reference in words. | Optional. Trimmed, 1 to 500 characters. |
| `reinforcementGrade` | string | none | A reference in words. | Optional. Trimmed, 1 to 500 characters. |
| `utilityDesignRef` | string | none | A reference in words. | Optional. Trimmed, 1 to 500 characters. |

Source: `src/designer/ecoContract.ts`; `src/designer/eco.ts`; `src/store/propertyStore.ts`.

### 2.22 Curved walls (version 2)

A wall is straight, or a true circular arc. The curve is ONE number, the `bulge`: the tangent of a quarter of the
angle the arc turns through. Absent or 0 is straight; 1 is a half circle; the sign says to which side it bows. It
is the bulge of a DXF polyline.

Where it is stored:

| Where | Key | Meaning |
|---|---|---|
| A free wall (2.8) | `bulge` | The wall is the arc from `a` to `b`. |
| A room (2.3) | `wallArcs[]`: `{edgeIndex, bulge}` | The edge from corner `edgeIndex` to the next corner is the arc between those two corners. The corners stay the ends of the arc. One entry per edge; the first wins. At most 2000 entries. |

The exact definition, in the stored numbers, free of any "which way is up". For a wall from `a` to `b`:

    the middle point of the arc is   m = (a + b) / 2 + (bulge / 2) * (b.y - a.y, -(b.x - a.x))

and the wall is the circular arc from `a` through `m` to `b`.

Worked out from the two ends and the bulge `k` (never stored), with `c` the straight distance from `a` to `b`:

| Value | Rule |
|---|---|
| Angle of the turn | `4 * atan(k)`, with the sign of `k`. Its size is below a full turn. |
| Radius | `c * (1 + k * k) / (4 * abs(k))` |
| Centre | `(a + b) / 2 + ((k * k - 1) / (4 * k)) * (b.y - a.y, -(b.x - a.x))` |
| How far the middle of the arc stands off the chord | `abs(k) * c / 2` |
| Length along the wall | radius times the size of the angle |
| Angle of `a` seen from the centre | `atan2(a.y - centre.y, a.x - centre.x)`; the arc runs from there through the angle of the turn. |

Rules:

- Why a bulge and not a centre with a radius: the bulge is tied to the two ends. A program that moves an end and
  knows nothing of arcs leaves a sound arc: the same turn, on the new ends.
- Turning a wall round (from `b` to `a`) changes the sign. Mirroring the plan changes the sign. Moving, turning
  or scaling the plan as a whole does not change the number.
- In a frame where y grows upward a positive bulge turns counter-clockwise from `a` to `b` (the DXF rule). On this
  plan y grows downward, so here a positive bulge is seen to turn clockwise. A DXF drawing read with its y turned
  over comes in with the sign of every bulge changed.
- A bulge whose size is below 0.000001 is a straight wall and is not stored. The largest kept is 20 (a turn of
  about 348 degrees). A whole circle is two half circles.
- The plan import reads a drawing's arcs (ASCII DXF): the bulges of a polyline, an ARC (one curved segment from
  its start angle to its end angle), a CIRCLE (a closed outline of four quarter arcs). On a room layer a closed
  polyline becomes a room with `wallArcs`; on a wall layer each curved segment becomes a free wall with a
  `bulge`. Open curved lines on a room layer are traced straight, and the import says so.
- A reader that can only draw lines takes the arc as a run of straight pieces between points on the arc; the
  code gives them with a tolerance (5 mm unless asked otherwise, at most 256 pieces).

Source: `src/designer/arcSegment.ts`; `src/designer/openings.ts` (the outline cleaner says `reversed`); `src/store/propertyStore.ts`. Tests: `src/designer/__tests__/arcSegment.test.ts`, `designFormatArcs.test.ts`.

### 2.23 The products in use (`products[]`, version 2)

One entry for each product that stands in the design, so that a design says what is in it without a catalogue at
hand: for a reader with no network, for another program, for a later year. A reader that has the catalogue takes
the catalogue as the truth and this list as the fallback.

| Key | Type | Unit | Meaning | On load |
|---|---|---|---|---|
| `id` | string | none | The id a placed thing carries in its `productId`. | A string of 1 to 64 characters with no space, else the entry is dropped. A second entry with the same id is dropped. |
| `company` | string | none | The company that makes or sells it, as its catalogue names it. | Trimmed. Kept when 1 to 120 characters. |
| `modelNumber` | string | none | The company's own code for it. | Trimmed. Kept when 1 to 120 characters. |
| `name` | string | none | Its name. | Trimmed. Kept when 1 to 200 characters. |
| `category` | string | none | Its kind, as the catalogue names kinds. | Trimmed. Kept when 1 to 60 characters. |
| `sizeMm` | `{x, y, z}` | mm | Its true size: `x` along the thing's own length as it lies on the plan before any turn, `y` across it, `z` its height. | Each must be a number from 1 to 100000, else `sizeMm` is left out. Rounded to whole millimetres. |
| any other key | JSON | none | Unknown key. | Carried (3.2). |

- At most 5000 entries.
- The list is made new each time a design LEAVES the web app: the design file, the hand-over file, a save to the
  server. One entry for each product that stands in a room; what the catalogue knows is written from the
  catalogue; a product the catalogue does not have keeps the entry the design came with; a product no longer
  placed has no entry; an entry that would hold an id alone is not written.
- The copy of a design in the browser's storage does not hold this list until the design has left the app once.
- There is no price in it, and no key for one.

Source: `src/designer/formatV2.ts`; `src/lib/designExport.ts`; `src/lib/designsApi.ts`; `src/components/ProjectWorkspace.tsx`. Tests: `src/designer/__tests__/formatV2.test.ts`, `src/lib/__tests__/designsApi.test.ts`.

### 2.24 Cost lines (`costLines[]`, version 2)

What a job needs, as products and as labour. A cost line holds NO money (rule 6).

| Key | Type | Unit | Meaning | On load |
|---|---|---|---|---|
| `id` | string | none | Identity of the line. | A string of 1 to 64 characters with no space, else the entry is dropped. A second entry with the same id is dropped. |
| `kind` | string | none | `"product"` or `"labour"`. | A string of 1 to 64 characters with no space, else the entry is dropped. A kind this build does not know is kept as it is. |
| `productId` | string | none | For a product line: the product, by the id a placed thing carries. | Kept when it is such a string. |
| `trade` | string | none | For a labour line: the trade that does the work, as the roles name it (2.25). | Kept when it is such a string. |
| `quantity` | number | count | How many: units of the product, or units of the work. | Kept when from 0 to 1e9. |
| `people` | number | count | Labour: how many people. | Kept when from 0 to 100000. |
| `hours` | number | hours | Labour: hours for each person. | Kept when from 0 to 1e6. |
| `rateSetId` | string | none | Which set of rates on the server prices this line. A reference, never a rate. | Kept when it is such a string. |
| `vat` | boolean | none | Whether sales tax is added to this line. | Kept when it is a boolean. |
| `payer` | string | none | Who pays: the `id` of a member. | Kept when it is such a string. |
| `note` | string | none | A note. | Trimmed. Kept when 1 to 500 characters. |
| any other key | JSON | none | Unknown key. | Carried (3.2), except the keys that name money: `rate`, `price`, `priceMinor`, `amount`, `amountMinor`, `total`, `totalMinor`, `unitPrice`, `cost`, `currency`. Those are refused. |

- At most 5000 lines.

Source: `src/designer/formatV2.ts`. Tests: `src/designer/__tests__/formatV2.test.ts`.

### 2.25 Members (`members[]`, version 2)

Who works on the design, and in which role (rule 7).

| Key | Type | Unit | Meaning | On load |
|---|---|---|---|---|
| `id` | string | none | The member in this design: an opaque id. Never an email address. | A string of 1 to 64 characters with no space and no `@`, else the entry is dropped. A second entry with the same id is dropped. |
| `role` | string | none | `"owner"`, `"builder"`, `"plumber"`, `"electrician"`, `"painter"` or `"viewer"`. | A string of 1 to 64 characters with no space, else the entry is dropped. A role this build does not know is kept as it is, and is a viewer here. |
| `name` | string | none | The name to show. | Trimmed. Kept when 1 to 80 characters. |
| any other key | JSON | none | Unknown key. | Carried (3.2). |

- At most 200 members.
- What each role may change is one rule for both fronts: `AI-HANDOFF/RULE-ROLES.md`.

Source: `src/designer/formatV2.ts`. Tests: `src/designer/__tests__/formatV2.test.ts`.

## 3. Things a second reader must know

### 3.1 A design is loaded in two ways

1. Opened: the loader builds a new object and copies the keys it knows, one by one, each cleaned. This is the path of section 2. Proof: `src/store/propertyStore.ts`.
2. Reloaded from the browser's storage: the stored object is kept and only some parts are cleaned. The outlines are wound again and the data on their edges follows. `heightM` and `elevationM` of the storeys, `stairs`, `roof`, `garden`, `materials` and the eight sections are cleaned. Everything else is kept as stored, with no check: `id`, `name`, `activeRoomId`, `activeLevelId`, `walls`, `site`, the paint settings, and a room's `placedItems`, `floorFinish`, `floorTiles`, `levelId` and `kind`. Proof: `src/store/propertyStore.ts`; `src/designer/building.ts`; `src/designer/garden.ts`.

A second program should write what path 1 accepts.

### 3.2 A key the loader does not know

- It is carried as it is at these places: the design; a storey; a room; an entry of a room's `wallPaint`,
  `wallCladding`, `wallConstruction` and `floorTiles`, and its `floorFinish`; a free wall; the plot; a stair; the
  roof; the garden, a garden surface, a pool, a fence; the top level of the materials settings; an entry of
  `products`, `costLines` and `members`.
- It is kept inside a placed thing and inside an opening too, because those are not built again.
- The name must start with a letter and hold only letters, digits and `_`, 64 characters at most. The names
  `constructor`, `prototype` and `selectedItemId` are never carried.
- The value must be plain JSON: at most 20000 values in all, nested at most 12 deep. It is copied.
- A key the loader does know always wins: a carried key never takes its place, and a known key with a bad value
  stays dropped.
- A key that is in the table of names and that the loader does not copy is dropped on purpose (a value worked out
  for the screen, or a key of the first designs that is read and never written).
- It is NOT carried, and is dropped without a word, INSIDE a part that has a version of its own and is read key
  by key: `services`, `foundation`, `shade`, `city`, a `site.world` that passes its check, and the groups of the
  materials settings. Rule 3 says what to do there: raise that part's version.
- In `eco` and `engineering`, and on a component of `boundaryComponents`, one unknown key makes the reader refuse
  the whole section. The section then goes to `unread`, whole.
- In a cost line, a key that names money is refused, whoever wrote it (2.24).

Proof: `src/designer/unknownKeys.ts`; `src/designer/designFormat.ts`; `src/store/propertyStore.ts`; `src/designer/building.ts`; `src/designer/garden.ts`; `src/designer/wallConstruction.ts`; `src/designer/materials/settings.ts`; `src/designer/formatV2.ts`; `src/designer/boundaryModel.ts`; `src/site/hydration.ts`. Tests: `src/designer/__tests__/designFormat.test.ts`, `designFormatInner.test.ts`, `unknownKeys.test.ts`.

### 3.3 The eight sections and `unread`

- A section is taken from the design. Only when the design has none is the copy in `unread` taken.
- A section its reader accepts is the section. One it does not accept goes to `unread` under its own name, as it was stored.
- `services` is the one section whose reader drops single entries and keeps the rest.
- The plot on the map is the ninth part kept aside, under `unread.siteWorld`. The loader does not read it: it carries it. Its reader runs after the first picture; one it has refused is not asked again until the design is loaded anew.
- Nothing takes a part out of `unread` but its own reader. A part no build can read stays in the design.
- The design itself decides: a readable section written since lets the one that was kept aside go; an unreadable one takes its place.
- The server has its own check of a design it is given. It refuses the design when one of these has a fault: `services`, `foundation`, `city`, `eco`, `engineering` (by the strict contracts, so one unknown key is a fault), `terrainCuts`, `boundaryComponents`, `removedWallEdges` and `roof.thicknessM`. Which routes call it was not read. Proof: `api/_lib/designSnapshotValidation.ts`.

Proof: `src/store/propertyStore.ts`; `src/designer/designFormat.ts`.

### 3.4 Storeys

- A room with no `levelId` is on the ground storey, whose id is `ground`. The same holds for a free wall. Proof: `src/designer/levels.ts`.
- "Ground" is written in three ways. A room on the ground has no `levelId`; the loader removes `ground`. A free wall may have no `levelId` or `ground`; the loader keeps what is stored. An entry of `services` always has `levelId`, `ground` too. Proof: `src/store/propertyStore.ts`; `src/designer/buildingServices.ts`.
- The roof is a storey with the id `roof` and `kind: "roof"`. A design has no roof storey until one is added. Proof: `src/designer/levels.ts`.
- A storey with a `kind` that is present and is not `"roof"` is dropped as a whole. Its rooms then fall to the ground storey. Proof: `src/designer/levels.ts`; `src/store/propertyStore.ts`.
- Height of a storey above the ground, in the order of `index`, the roof storey left aside:
  1. The default height is `wallHeightM` of the design when it is from 2 to 8, else 2.7.
  2. `next` starts at 0.
  3. The floor of a storey is its `elevationM` when that is a finite number, else `next`.
  4. The height of a storey is its `heightM` when that is from 2 to 8, else the default height.
  5. `next` becomes floor plus height plus 0.18. The 0.18 m is the floor slab.
- The roof storey stands on the highest storey that has a drawn room which is neither an outdoor holder nor a roof slab. Its floor is that storey's floor plus its height plus 0.18. When no storey has a drawn room, the last storey is taken. Its own height is 0.
- The loader keeps `wallHeightM` only from 2.0 to 4.0. A storey's own `heightM` may go to 8.

Proof: `src/designer/building.ts`; `src/designer/levels.ts`; `src/store/propertyStore.ts`.

### 3.5 Three kinds of entry in `rooms`

- A normal room: an outline of 3 or more points. A blank room has `polygon: []`; the app keeps one on a storey so that the draw tool has a target. Proof: `src/store/propertyStore.ts`.
- An outdoor holder: `kind: "outdoor"`, `polygon: []`, at most one per storey, name `Outdoors`. It holds the things placed outside every room. Proof: `src/store/propertyStore.ts`; `src/designer/levels.ts`.
- A roof slab: `kind: "roof"`, `levelId: "roof"`. One per drawn room of the storey under the roof, with the id `roof-` plus that room's id and the same outline. Or one slab with the id `roof-custom-outline` when `roof.outline` is set. Proof: `src/designer/roof.ts`.
- Roof slabs are made by the app, not drawn. The loader does not make them. The app makes them again when the rooms change and when the roof storey gets the focus. Things and floor on a slab are kept. An outline a second program writes on a slab is replaced. Proof: `src/designer/useRoofSync.ts`; `src/store/propertyStore.ts`.
- A reader skips walls and floor for an outline of fewer than 3 points and still reads the things of that room. Proof: `src/designer/wallEdges.ts`; `src/designer/roomSolids.ts`.
- Write the roof storey in `levels` whenever a room has `levelId: "roof"`. Otherwise the loader removes that `levelId` and the slab falls to the ground storey. Proof: `src/store/propertyStore.ts`.

### 3.6 Walls of a room

- A wall of a room is not stored. It is worked out: every edge of the outline is a wall, unless `removedWallEdges` holds its index or the edge is 1 mm or shorter. Proof: `src/designer/wallEdges.ts`.
- Index of an edge: edge `i` runs from point `i` to point `i + 1`; the last edge closes to point 0. The index is the index of the start point in `polygon`. An edge that is skipped still has its number. Proof: `src/designer/wallEdges.ts`; `src/store/propertyStore.ts`.
- A wall between two rooms exists twice: one edge in each room, running in opposite directions. Two edges are one wall when they lie on one line within 1 mm and share more than 1 mm of length. Proof: `src/designer/wallEdges.ts`.
- Thickness and side differ between the views:

| View | Where the wall stands | Thickness |
|---|---|---|
| 2D plan | A band with the outline in its middle. | `thicknessMm / 1000` of the edge's `wallConstruction` entry when it has one, else 0.1 m. |
| 2D placing of things | The inner face is taken 0.05 m inside the outline, whatever thickness is stored. | fixed |
| 3D views | The inner face is on the outline. The wall grows outward from it. | The cleaned `thicknessMm / 1000` of the edge when it has one, else 0.01 m for glass, else 0.14 m. |
| 3D, a glass edge shared by two rooms | The pane has the outline in its middle. It is drawn once. | as above |
| Free wall, both views | The line from `a` to `b` is in the middle. | `thicknessM` |
| Materials estimate | not a position | `materials.wall.thicknessM`, default 0.15 m |

- A design with no `wallConstruction` holds no wall thickness at all. When the materials settings are set with a new wall thickness, the app writes a `wallConstruction` entry with that thickness on every edge of every room that is not an outdoor holder or a roof slab, and sets `thicknessM` of every free wall. Glass keeps its own thickness.

Proof: `src/components/RoomCanvas.tsx`; `src/designer/wallAwarePlacement.ts`; `src/designer/itemDrop.ts`; `src/designer/roomSolids.ts`; `src/components/three/ThreeStage.tsx`; `src/designer/roomView3d.ts`; `src/designer/sharedGlass.ts`; `src/designer/wallConstruction.ts`; `src/designer/masonryDimensions.ts`; `src/store/propertyStore.ts`.

### 3.7 When an outline is cleaned

The loader cleans the outline in two steps and carries everything that names an edge.

1. Points that repeat are removed: a point equal to the one before it, and a last point equal to the first. An edge between two such points is gone. Data on it is dropped. The other edges are renumbered.
2. An outline with a negative shoelace sum is turned round. The first point stays: `[p0, p1, ..., p(n-1)]` becomes `[p0, p(n-1), ..., p1]`. With `m` points left, old edge `i` becomes edge `m - 1 - i`.

What follows:

- An opening: `edgeIndex` becomes `m - 1 - edgeIndex`; `offsetM` becomes the length of the edge minus `offsetM`; `flipFacing` and `flipHand` are both flipped. The door stays where it was and swings the same way.
- `wallPaint`, `wallCladding`, `wallConstruction` and `removedWallEdges`: the edge number is mapped the same way. An entry on an edge that is gone is dropped. Two entries that land on one edge: the first is kept (for paint: one per edge and side).
- `wallArcs` (version 2): the edge number is mapped the same way, and the sign of each `bulge` changes when the outline is turned round, because the edge then runs the other way. The arc stays on its wall and bows to the same side.
- Floor tiles do not name an edge. Tiles that no longer touch the outline are removed.
- An outline left with fewer than 3 points loses all its openings.

The same is done when the editor changes an outline.

Proof: `src/designer/openings.ts`; `src/store/propertyStore.ts`; `src/designer/wallConstruction.ts`.

### 3.8 Openings

- An opening belongs to an edge of one room: `edgeIndex`, and `offsetM` from the start point of that edge to the centre of the opening. It is not a thing placed in space.
- `flipFacing: false`: the leaf swings toward the normal (-dy, dx) of the edge, into the room. `flipHand: false`: the hinge is at the end of the opening nearer the start point of the edge.
- A window and a door are one record. `kind` says which. `sillM` is used for a window and a hole only.
- Heights of an opening are measured from the floor of its storey.
- A door in a wall between two rooms is stored on one room only. The views also cut it into the edge of the other room, by the position of its two ends.
- An opening on an edge listed in `removedWallEdges` passes the loader and is not drawn.

Proof: `src/designer/openings.ts`; `src/designer/openingGeometry.ts`; `src/components/RoomView3D.tsx`; `src/designer/openingPlacement.ts`; `src/store/propertyStore.ts`; `src/components/RoomCanvas.tsx`.

### 3.9 Placed things

- `productId` is the `id` of a product of the catalogue. The app looks it up in this order: the catalogue of a running demo, the catalogue that comes with the build, the products read from the server. A product read from the server has the id `m-` plus its number on the server. Proof: `src/data/products.ts`; `src/data/apiCatalogAdapter.ts`; `src/data/products.schema.ts`.
- The design does not hold the size of a thing. The size is the product's `dimensions_cm`: `length` along x, `width` along y, `height` upward, in centimetres. Proof: `src/data/products.schema.ts`.
- A thing whose product is not known stays in the design and is not drawn. Proof: `src/components/RoomCanvas.tsx`; `src/components/RoomView3D.tsx`; `src/designer/designFile.ts`.
- `x` and `y` are a corner, not the centre: the corner with the smallest x and y of the box, with sides along the axes, round the footprint after rotation. The frame is the plan frame shared by all rooms, not a frame of the room.
- Size of that box: at 0 and 180 it is `length` by `width`. At 90 and 270 it is `width` by `length`. At any other angle `w = length * |cos| + width * |sin|` and `h = length * |sin| + width * |cos|`.
- The centre of the thing is `(x + w / 2, y + h / 2)`. The thing is turned clockwise by `rotation` about that centre. So a turn of a thing that is not square changes its `x` and `y`.
- The storey of a thing is the storey of its room.
- Height of its underside above the floor of its storey. It is worked out, not stored, apart from `mountHeightCm`:
  - on the floor: 0;
  - on a wall: `mountHeightCm`, else the product's own mount height, else 120 cm;
  - on another thing: the height of that thing's product;
  - on the ceiling: the height of the storey minus the height of the thing;
  - on the roof: the roof surface under its centre, plus 0.06 m.
- A thing on a wall is an ordinary entry of `placedItems`. No key names the wall. Its `x`, `y` and `rotation` put its back on the inner face of the wall, which the 2D plan takes 0.05 m inside the outline. What makes it a wall thing is the product (`placement: "wall"`).
- A thing on another thing has `parentInstanceId`. Its `x` and `y` are plan coordinates, not offsets from its parent. The app moves it with its parent and removes it with its parent.
- A thing on the roof is in a roof slab, a room of `kind: "roof"` on the storey `roof`. No height is stored.
- A thing outside every room is in the outdoor holder of its storey.

Proof: `src/store/propertyStore.ts`; `src/lib/geometry.ts`; `src/components/RoomCanvas.tsx`; `src/designer/fitToSize.ts`; `src/designer/roomSolids.ts`; `src/designer/placedItemElevation.ts`; `src/designer/attachmentPlacement.ts`; `src/designer/roofSurface.ts`; `src/designer/buildingScene.ts`.

### 3.10 Floors

- A room has one floor: `floorTiles` when present, else `floorFinish`. The editor clears one when it writes the other. Proof: `src/store/propertyStore.ts`.
- A tile is counted when it touches the room, not when its centre is in it. Proof: `src/designer/floorTiles.ts`.

### 3.11 Free walls

- A free wall is a line from `a` to `b` with a thickness. It has no direction that matters to the loader.
- The app turns free walls that close a loop into a room. Those walls then leave `walls`. The same wall can so be a free wall in one save and an edge of a room in the next. Proof: `src/store/propertyStore.ts`; `src/designer/connectedWallRooms.ts`.
- A new free wall takes `materials.wall.thicknessM` when the design has `materials`, glass apart. Proof: `src/store/propertyStore.ts`.

### 3.12 The plot

- `site` is a rectangle: `originM` is its corner with the smallest x and y, `widthM` runs along x, `depthM` along y. Proof: `src/store/propertyStore.ts`.
- `site.world` is not checked by the loader. The app checks it later, after the first picture. When the check fails, `world` is taken out of `site`, the rectangle stays, and the `world` that failed is kept aside under `unread.siteWorld` as it was stored (rule 3). A build whose check it passes puts it back. Proof: `src/store/propertyStore.ts`; `src/site/hydration.ts`.
- In `site.world`, positions on the globe are `[longitude, latitude]`, longitude first. The local frame is a flat plane touching the globe at `boundary[0]`, moved by `anchor`. Proof: `src/site/types.ts`; `src/site/geometry.ts`.

### 3.13 Ids

- The loader does not check that the ids of rooms, of placed things or of openings are unique. The app finds a thing and an opening by id across all rooms, so they must be unique in the whole design. Proof: `src/store/propertyStore.ts`.
- A room with no `id` gets a new random id on every load. Write an id on every room. Proof: `src/store/propertyStore.ts`.
- Ids that are checked to be unique: storeys; free walls; stairs; garden surfaces and fences together; and inside the sections, each by its own rule.
- Ids with a fixed meaning: `ground`, `roof`, `roof-` plus a room id, `roof-custom-outline`, and a terrain cell's `x,y`.
- Ids that must be in a table of this build, or the entry is dropped: `wallCladding[].productId`, `claddingId` of a free wall, and `materialProductId` of glass.
- Ids that are not checked against a table on load: `productId` of a placed thing, `paintId`, `materialId` of a floor, `materialId` of a service run.

### 3.14 What a load changes without losing anything

- Every room gets `openings` (a list, `[]` when empty) and `floorFinish` (`null` when there is none).
- `levelId: "ground"` is removed from a room.
- `activeLevelId` is worked out again and is absent on the ground storey.
- `materials`, when present, comes back full.
- A tint comes back as `#RRGGBB` in upper case. A rotation of a stair comes back from 0 to 360.

Proof: `src/store/propertyStore.ts`; `src/designer/building.ts`; `src/data/wallPaints.ts`.

### 3.15 A design file

- The file is the object as JSON text. The app writes it with two spaces of indent and a new line at the end. Proof: `src/designer/designFile.ts`.
- To be taken as a design, the object needs `rooms`: a list that is not empty, each room with a string `id` that is not empty and a `polygon` that is a list of points with finite numbers (it may be empty). `placedItems` is absent or a list. Proof: `src/designer/designFile.ts`.
- A file is not opened when it has more than 400 rooms, a room with more than 2000 points, or a room with more than 5000 things. Proof: `src/designer/designFile.ts`.
- A design opened from a file is added as a new page. The page on screen is not replaced. Proof: `src/designer/designFile.ts`.

### 3.16 The house as 3D files

The web app saves the house of a design as two files (the project workspace, the hand-over card). They are made
from the same solids the 3D view draws from, so a wall stands where the 3D view shows it.

| File | Units and axes | What it holds |
|---|---|---|
| glTF binary (`.glb`) | Metres. x east, y up, z south: right-handed, as the format asks. | One node for each part, named, with a plain colour. Each node has `extras`: `kind` (`floor`, `wall`, `roof`, `stair`, `thing`, `garden`), `levelId` when the part belongs to a storey, `roomId` on a floor, `instanceId` and `productId` on a placed thing. Flat faces, no texture. |
| STL binary (`.stl`) | Millimetres. x east, y north, z up: right-handed. The true size of the house; a printing program scales it. | One list of triangles: every part a closed solid with its faces outward. No colour, no names. |

- A floor is a slab of 0.18 m under its level, with the hole of a stair cut out. A wall has its doors and
  windows cut out in their own shape. The roof is its covering, of even thickness. A stair is its steps. A placed
  thing is a box of its true size. A garden surface is a thin slab, a fence a thin wall.
- A curved wall (2.22) is made curved, from short straight pieces that stand off the true arc by at most 5 mm.
  The floor of its room and the roof over it follow the same curve. A curved wall with a door or a window in it
  is exported straight, and the app says so.
- NOT in the files: the model of a product (a thing is its box), textures, lamps, pipes and cables, the
  foundation, shade sails, the city.

- The same solids are drawn as 3D view sheets in a PDF (a third button): the whole house from the south-west and from the north-east, then each storey by itself from above, without what is over it. A sheet is a parallel view, at one scale over the whole sheet, drawn by sums with no graphics card (`src/lib/view3dSheet.ts`). The PDF maker takes such sheets (`viewSheets`); the PDF that is made after an order does not carry them yet.

Source: `src/components/three/exportModel.ts`; `src/lib/exportHouse3d.ts`; `src/lib/view3dSheet.ts`; `src/lib/planPdf.ts`. Tests: `src/components/three/__tests__/exportModel.test.ts`; `src/lib/__tests__/view3dSheet.test.ts`.

### 3.17 What comes in from other programs

The plan import of the web app takes, besides a design file (3.15):

| File | What is read | What is not |
|---|---|---|
| ASCII DXF (a drawing) | Lines, polylines with their bulges, arcs and circles, in the plan of the drawing. The person says which layer is rooms and which is walls, and on which floor. | Blocks, splines, text, hatches, 3D and elevated entities: skipped and counted. |
| SVG (a drawing) | Straight paths and shapes. | Curved paths: skipped and counted. |
| IFC (a building) | The length unit; the storeys in the order of their levels; a space as a room when its shape is an upright extrusion of a rectangle or of a closed line of straight pieces; a wall by its axis line, or by the middle line of its rectangular body. | Doors, windows, slabs, roofs, stairs, furniture (counted and named); curved, tilted or cut shapes (skipped and counted); the heights of the storeys: one wall height applies to every floor. |

| glTF binary (`.glb`), OBJ (`.obj`) (a 3D model) | The outline of the model seen from above: each separate part of it becomes one room. From a 3D file this app saved itself (3.16), the floors only, storey by storey: the rooms come back as they were drawn. | Inner walls, doors, windows, the roof, placed things; a model packed with Draco or meshopt, or kept in more than one file, is refused in words. An OBJ file is read in metres with y upward. |

- An IFC file's frame is x east, y north, z up, in its own unit. On the way in everything becomes metres and the
  y is turned over, as for a drawing.
- A storey of an IFC file that has spaces brings its rooms; its wall lines are offered and left off, because a
  room already brings a wall on each of its edges. A storey with no space brings its wall lines as free walls.
- What comes in is opened as a NEW plan, after a review that says what was skipped. The plan on screen is kept.

- A model's outline is found on a grid of square cells (5 cm, or a 600th of the model's size when that is more): a side along the cells is kept to the point; a slanted side is made straight within a cell and a half; a part under 1 m2 is left out, and counted.

Source: `src/designer/planImport.ts`; `src/designer/planImportDxf.ts`; `src/designer/planImportSvg.ts`; `src/designer/planImportIfc.ts`; `src/designer/planImportModel.ts`. Tests: `src/designer/__tests__/planImport.test.ts`, `planImportArcs.test.ts`, `planImportIfc.test.ts`, `planImportModel.test.ts`.

## 4. Not sure

1. What point of the real world the plan origin is, when the design has no `site.world`. The code has no fixed origin.
2. (Settled since, see "Handedness" in 1: the plan's three axes are a left-handed set; the web's 3D view and the desktop game each map them their own way.)
3. Which face of a free wall carries `paintId` and which carries `exteriorPaint`. `src/designer/roomSolids.ts` gives a free wall the normal (dy, -dx); `src/components/three/ThreeStage.tsx` places it with (-dy, dx). The code that puts the colours on the two faces was not read.
4. Whether every drawing tool rounds new points to 4 decimals. The rounding is in some of them (`src/designer/drawLength.ts`, `src/designer/freeWalls.ts`). The loader does not round.
5. What `site.world.foundationShiftM` is used for. Only its check was read.
6. How "the project datum" of `terrainCuts[].topM` relates to the ground datum of the storeys.
7. What the ids in `materials.unitRates` name, and where they are used. Only the check was read.
8. What the loader does with a `rooms` value that is not a list, or with a room entry that is `null`. The loader in `src/store/propertyStore.ts` has no guard for it. Not run.
9. The routes of the server that take and give a design. Only `api/_lib/designSnapshotValidation.ts` was read on the server.
10. The walls in millimetres, the floor zones and the wall treatments that a saved page keeps beside the design (`src/lib/pages.ts`). They are not in the design object. Not read.
11. Whether `kind: "room"` is ever written by the app. The loader accepts it; no writer was found.
12. (Settled since: version 2 is described in 2.22 to 2.25.)

## 5. What each front does not do yet

Written on 22 November 2026. Change this chapter when one of its lines stops being true.

| Part | The web app | The desktop game |
|---|---|---|
| Curved walls | Kept, checked, and kept on their wall when an outline is cleaned. NOT drawn in 2D or 3D, and NOT measured as arcs: lengths, areas and paint quantities take the chord. The plan import says so when a design holds one. | Not read yet. Kept as stored when the game saves a design. |
| The products in use | Written when a design leaves the app. Not used to draw a product the catalogue does not have. | Not read yet. Kept as stored. |
| Cost lines | Kept and checked. No page shows them; nothing works out a cost. | Not read. Kept as stored. |
| Members | Kept and checked. Nothing on the web acts on a role. | The game has the six roles for the people in one house at a time; it does not read or write `members` yet. |
| `unread` | Never named on screen. | Kept as stored. |
| A design in a newer format | The plan import says so in words. A design from the server or from the browser's storage opens with no word about it. | Says nothing. |

The desktop game keeps the whole object it read and changes only the parts it edits, so every key it does not
know goes back into the file as it was.
