# Migration Notes — Wellness Room Designer

**Last updated:** 2026-05-11 (Week 2.5 ship)

This file documents the local-storage schema bumps and the
rectangle-to-polygon migration that landed in Week 2.5.

If you're debugging a stuck save / load 6 months from now, start here.

---

## localStorage keys

| Key                       | Era       | Shape                                                              | Status                                    |
| ------------------------- | --------- | ------------------------------------------------------------------ | ----------------------------------------- |
| `ppw_design_v1`           | W1/W2     | `{ roomDimensions: {lengthM,widthM}, placedItems[], showGrid, pxPerMetre }` | Read-only legacy — hydrated to v2 on boot |
| `ppw_designs_v1`          | W2        | `{ designs: { [id]: SavedDesign }, currentId }` (single-room rows) | Auto-migrated to v2 via `persist.migrate` |
| `ppw_property_v2`         | W2.5+     | `{ property: Property, showGrid, pxPerMetre }`                     | Current live store (`propertyStore`)      |
| `ppw_properties_v2`       | W2.5+     | `{ designs: { [id]: SavedDesign }, currentId }` (Property rows)    | Current live designs picker               |

---

## Rectangle → Polygon migration

### Why

Week 2.5 generalised the room from a rectangle (`lengthM × widthM`) to
an arbitrary closed polygon (`Vertex[]`). Existing saves from W1/W2
contain only the rectangle; we convert them on load.

### How (`rectToPolygon` in `src/lib/geometry.ts`)

```
rectToPolygon({ lengthM: L, widthM: W }) =
  [ {x:0, y:0}, {x:L, y:0}, {x:L, y:W}, {x:0, y:W} ]
```

`lengthM` maps to the **+x** extent (room width on screen), `widthM`
maps to the **+y** extent (room height on screen). This is consistent
with the existing `RoomCanvas` rendering convention where `roomWpx =
lengthM * pxPerMetre`.

### Where it runs

1. **`propertyStore` boot** — when the v2 key is empty and a legacy v1
   key exists, `tryHydrateFromLegacy()` reads `ppw_design_v1`, builds a
   single-room Property, and writes it back.
2. **`normaliseLoadedRoom()` / `normaliseLoadedProperty()`** — defensive
   migrators applied whenever a Property is loaded (via `loadProperty`
   or via the designsStore Load picker). Any room missing a `polygon`
   field but with `lengthM`/`widthM` gets the same rectangle conversion.
3. **`designsStore` v1 → v2 migrate hook** — Zustand `persist.migrate`
   callback rewrites each row into the new shape (`SavedDesign.property`
   = single-room Property derived from the legacy snapshot). The v1
   mirror fields (`roomDimensions`, `placedItems`) are also populated
   for any caller still poking at them directly.

### Invariants after migration

- `property.rooms.length >= 1` always.
- Each `room.polygon` has ≥ 3 vertices, no repeated end vertex.
- `property.activeRoomId` is always present in `property.rooms[].id`.

---

## Polygon storage shape

```ts
interface Vertex { x: number; y: number; }       // metres
type Polygon = Vertex[];                          // no closing duplicate
interface Room {
  id: string;
  name: string;
  polygon: Polygon;
  placedItems: PlacedItem[];
}
interface Property {
  id: string;
  name: string;
  activeRoomId: string;
  rooms: Room[];
}
```

- Vertices are in metres relative to the room's local origin (which is
  typically (0,0) but does not have to be — `polygonBounds()` gives
  the AABB).
- Winding direction is unconstrained; the shoelace formula in
  `polygonArea()` uses `abs()`. Both CW and CCW polygons render
  identically because Konva `<Line points={[...]} closed fill=…>`
  doesn't care about direction.
- `cleanPolygon()` strips a trailing duplicate-of-first vertex if any
  encoder emits one. The store NEVER stores a closed-with-repeat shape.

---

## Cart aggregation (Week 2.5)

The cart is **derived** from `property.rooms[].placedItems` via
`deriveCart()` in `src/store/cartStore.ts`. Not persisted — recomputed
on every render.

FX is static: `MUR_PER_USD = 45` (mid of the 44–46 band in late 2025).
TODO Week 3: replace with a live exchange-rate fetch.

---

## Debugging a broken load

1. Open DevTools → Application → Local Storage → your origin.
2. Look at `ppw_property_v2`. If empty but a `ppw_design_v1` row sits
   beside it, `tryHydrateFromLegacy()` should fire on next page load.
   If it doesn't, paste the v1 payload into a console:
   ```js
   JSON.parse(localStorage.getItem('ppw_design_v1'))
   ```
   and verify it has `state.roomDimensions` and `state.placedItems`.
3. Look at `ppw_properties_v2`. Each row should have a `property` field
   with `rooms[].polygon`. If you see legacy `roomDimensions` and no
   `property`, the `persist.migrate` callback didn't run (usually
   because the `version` field was bumped after deploy without a soft
   migration window — clear the row or paste it through
   `normaliseLoadedProperty()` manually).
4. To force a clean reset:
   ```js
   localStorage.removeItem('ppw_design_v1');
   localStorage.removeItem('ppw_designs_v1');
   localStorage.removeItem('ppw_property_v2');
   localStorage.removeItem('ppw_properties_v2');
   location.reload();
   ```

---

## Backwards-incompatible changes

Week 2.5 is **forwards-only**: saves written by W2.5+ cannot be read
by a W1/W2 client (it doesn't know about polygons). That's fine — this
is a local-first MVP, no concurrent clients.

If you ever roll back, do it by clearing the W2.5 keys and letting the
W1/W2 client re-hydrate from `ppw_design_v1` (which the W2.5 boot path
does NOT wipe — see `tryHydrateFromLegacy`).
