# Designer build plan — doors, flooring, layering, undo, naming, pages

Branch: `feat/designer-doors-flooring-pages-2026-08-28` off `main` @ `b7a735f`.
Findings + evidence: `00-FINDINGS.md`. Every phase ends green (`tsc` + `vitest`) and commits.

## Decision locked (Vic, 2026-08-28)

**Rooms stay attached areas on ONE canvas** — the multi-room merge stands. Rooms stop being
numbered and get real names from a wellness type picker. **"Pages" = separate plans** (different
client / different premises), surfaced from the `designsStore` that already exists.

```
[ Tamarin Studio ] [ Client B ] [ + ]      <- pages: separate plans (designsStore)

   +-------------+-------------+
   | TREATMENT   |   SAUNA     |           <- rooms: named areas, one canvas
   |   ROOM      |             |
   +------[door]-+-------------+           <- opening on the SHARED edge
```

## Architecture, in one paragraph

Rooms keep their authored polygons (no wall-graph rewrite — that is the research's ideal, but it
would throw away the shipped attach model for no benefit Vic asked for). What we take from the
research is everything that does **not** require derivation: openings hosted parametrically on a
wall edge, per-room floor finish, explicit integer layer bands, semantic naming, and the
Project→Space hierarchy mapped onto the existing saved-designs store. New state nests **inside
`Property`** so undo gets it free.

## Phase order

Sequenced so the two things that are painful to retrofit — the addressable wall edge and the
opening host relationship — land first, and so each cross-cutting risk is disarmed *before* the
change that would trip it.

### P0 — Disarm the test harness (blocks everything visual)

The e2e coordinate basis is a **gold pixel-scan** (`tests/e2e/multiroom-helpers.ts:125`). A warm
floor material or a gold door symbol silently poisons it: specs keep passing while asserting the
wrong coordinates. Replace it with a geometry hook before any render change.

- Add `worldToScreen(x, y)` + `getRoomBounds()` to the test-hooks bridge.
- Rewrite `roomOrigin()` in `multiroom-helpers.ts` and `wall-aware-placement.spec.ts:46` to use it.
- Keep the pixel-scan as a fallback only.
- Add a unit test asserting no catalog hex satisfies `isRoomBorderPixel`.

**Gate:** `wall-aware-placement`, `placement-fsm`, `multiroom-*` all green against the local dev
server with the new origin helper.

### P1 — Make wall edges addressable

Today one closed `Line` carries both fill and gold stroke (`RoomCanvas.tsx:1292-1303`), so there
is no edge to host a door on.

- Split into: a closed `Line` (fill + shadow, no stroke) + **per-edge** gold `Line`s.
- New pure helpers in `src/designer/roomLayout.ts`:
  - `roomEdges(polygon) -> Edge[]` (`{ index, a, b, angle, lengthM }`)
  - `collinearOverlap(e1, e2, eps)` -> overlapping interval or null
  - `sharedEdges(rooms)` -> map of every edge to the other rooms' edges co-located with it
- Gold stays the **topmost** thing in the plan layer so contrast is unchanged.

**Gate:** pixel-identical render (screenshot diff vs P0 baseline), full suite green.

### P2 — Openings (doors) — Vic's #1 ask

Nested on the room so undo and persistence are free:

```ts
interface Opening {
  id: string;
  edgeIndex: number;      // which polygon edge hosts it
  offsetM: number;        // distance along the edge to the opening's CENTRE
  widthM: number;         // preset trade sizes; 0.838 labelled "accessible"
  kind: 'door' | 'doorway' | 'window';
  flipFacing: boolean;    // which side it swings toward
  flipHand: boolean;      // which end the hinge sits on
  sillM?: number;         // >0 turns the same record into a window
}
// Room gains: openings: Opening[]
```

- **Shared-edge cut is mandatory**: an opening on an edge shared with another room cuts **both**
  rooms' strokes, via `sharedEdges()`. Cutting one leaves a gold line across the doorway.
- Render per architectural convention: break the wall stroke over the span, draw jambs, the leaf
  line perpendicular from the hinge, and a quarter-circle swing arc at radius = width.
  `doorway` = gap only. `window` = keep stroke, render as thin double line.
- Validation as hard constraints: must have a host edge; `[offset ± width/2]` inside the edge
  minus a 0.1 m jamb margin; no overlap with another opening on the same edge. Red ghost +
  refuse — no override.
- Placement: Door tool → hover highlights nearest edge within ~0.3 m → ghost → click to place.
  Once placed, dragging is 1-DOF along the edge. Selection shows two flip arrows + width picker.
- **Cascade in ONE undo step**: deleting a room, or resizing it such that an edge shortens below
  the opening, cascades to its openings. Evicted openings go to an "unplaced" tray, never
  silent deletion.
- **`normaliseLoadedRoom` (`propertyStore.ts:498-540`) extended in the SAME commit** — it
  whitelists fields, so `openings` would otherwise survive reload but be deleted by every
  Save/Load round trip. Add a round-trip test.

### P3 — Flooring that actually exists

`Room.floorFinish: { materialId, rotationDeg, scale } | null` — per-room, nested in `Property`.

- Render a **clipped floor fill** between the room fill and the grid (grid must sit *above* the
  finish or dark materials swallow it). `listening={false}` — the plan layer must stay
  non-listening or placement clicks die (`RoomCanvas.tsx:1258`).
- **Unify the two catalogs.** `FLOOR_MATERIALS` (per-unit) and `ECO_FLOORING_CATALOG` (per-m²)
  have zero ID overlap; wiring naively prices every floor at Rs 0. One catalog, one ID space,
  with a mapping shim for anything already persisted.
- UI: select a room → floor material picker → fills the polygon instantly. Texture rotation +
  scale only.
- Area/cost aggregates across **all** rooms, with a per-room breakdown, and reports net vs
  ordered area (`18.4 m² · order 21 m² at 10% waste = 10 packs`) — quoting net area short-orders.
- `floorZoneStore` is dead scaffolding (`addZone` has zero callers). Leave it in place,
  unreferenced, until the per-tile zone painter is actually wanted; do **not** wire it.

### P4 — Things go on top of the flooring

- Add `layerBand` to placed items — explicit integers, never insertion order:
  `floor covering 200 · freestanding 300 · wall-mounted 500`.
- Make `collidesWithAny` (`geometry.ts:238`) **band-aware**: a band-200 floor covering does not
  block a band-300 object. Same-band overlap still rejects.
- Stop the silent teleport: `findFreeSlot` relocating a blocked item with no message is its own
  bug — surface a toast naming the blocker.
- **First**: run the manual repro to settle whether Vic's symptom is a *rejected placement* or a
  *dead click* (Stage guard at `:1258` swallowing it). Different fixes; do not guess.

### P5 — Undo, in strict order

Order matters: re-routing the button first makes the visible symptom disappear while history
keeps eating real frames.

1. `applySnapshotInternal` — save/restore the prior `suppressRecording` value instead of
   clearing it unconditionally (`historyStore.ts:223-225`).
2. Capture a transaction id at `beginDrawTransaction`; make `abortDrawTransaction` pop **only
   that frame** instead of blind-popping `past[-1]` (`:396-405`).
3. Refuse `undo`/`redo` **inside the store** while a draw transaction is open — one guard, both
   entry paths, instead of a guard on the keyboard path only.
4. Only then re-route the TopBar button: mid-draw with vertices, it pops the **last vertex**
   (same as Ctrl+Z); otherwise global undo. Same for wall-draw.
5. Add the missing test — `undo()` called inside an open draw transaction
   (`historyStore.test.ts:219-306` does not cover it).

### P6 — Naming, then Pages

**Naming** (kills complaint 5's real cause):
- Delete `setDrawName('Room 1')` (`RoomCanvas.tsx:320`) and the three other competing schemes.
- One `nextRoomName(rooms)` in `propertyStore`.
- Room **type** picker on creation — Treatment Room, Massage Studio, Sauna, Steam Room, Recovery
  Lounge, Gym Floor, Yoga/Movement Studio, Consultation Room, Changing Room, Reception, WC —
  plus free text. Number hidden, surfaced only to disambiguate ("Treatment Room 2").
- Canvas label stamp reads name over area.
- Suppress the blank seed room from the list and the "N rooms" count.

**Pages** (only after the above):
- **Page-scope `wallStore` / `floorZoneStore` / `wallTreatmentStore` FIRST.** They are global
  singletons; without this, switching page carries the previous plan's walls and flooring
  straight onto the new one. This is the hard blocker.
- Reuse `designsStore` as the page list: `currentId` = current page, autosave retargeted from
  `__draft__` to `currentId`, page switch = flush current → `loadProperty(next)` → swap the
  page-scoped stores. Needs a dirty guard — today Load is destructive with no check.
- Surface as an always-visible page tab strip.
- **Keep `rooms[]` as the wire and billing unit.** "Room" is spoken to the customer and merchant
  in the cart, Stripe metadata, the confirmation email and the PDF. Rename the label only.
- If a schema bump is needed, fix the `version >= 2` guards first (`propertyStore.ts:456`,
  `designsStore.ts:182`) or the migration is a silent no-op.

### P7 — Multi-room correctness sweep (complaint 2)

- `designStore` facade + the six active-room-only surfaces aggregate across rooms.
- PDF/SVG/share capture **all** rooms, not just the active one (`RoomCanvas.tsx:771`).
- Sweep the subsystems this audit never opened: merchant-capture, MerchantAgentPage, the
  Marketplace cart, admin.

## Standing constraints

- Branch only until Vic approves a merge. No API routes (12/12 Vercel function cap). $0.
- Every phase: `npx tsc --noEmit` clean, `npx vitest run` green, `npx eslint <changed files>` 0
  errors (baseline `npm run lint` has ~21 pre-existing errors in untouched files).
- No `data-testid` dropped.
- Persisted-schema changes always touch `normaliseLoadedRoom` in the same commit.
