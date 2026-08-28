# Designer — verified findings, 2026-08-28

Baseline: `main` @ `b7a735f` (includes the attached-multi-room merge `4a1b7b6`).
`npx tsc --noEmit` clean · `npx vitest run` green (exit 0) · 84 unit spec files · 29 e2e specs.

Method: 6 code-mapping agents over the real repo, 3 external research agents (The Sims build
mode, floor-plan software conventions, Konva technique), 5 adversarial verifiers on the
load-bearing claims, 1 completeness critic. Every claim below carries a file:line anchor and
was re-checked by hand before being written here.

---

## The six complaints, and what actually causes each

### 1. "What if I wanted to add a door going into the second room"

**There is no door, window, or opening concept anywhere in the codebase.** VERIFIED — an
adversarial verifier tried to refute this and could not. Every `door` match in `src/` is
`outdoor` (a floor SKU) or the word in a prose comment. No type, no store, no render path.

The deeper reason it cannot simply be bolted on: a room is drawn as **one closed Konva `Line`
carrying both the floor fill and the gold wall stroke** (`RoomCanvas.tsx:1292-1303`). There is
no addressable wall *edge* to host an opening on, and cutting a gap in that stroke is
impossible without splitting fill from stroke first.

There are also **two disjoint wall systems that never talk to each other**:
- **System A** — the room polygon outline. This is the gold wall the user sees, and the only
  thing that exists between two attached rooms.
- **System B** — `wallStore` interior wall segments (mm, own draw FSM, `CommittedWallsLayer`
  at `RoomCanvas.tsx:1473`).

A door "into the second room" sits on a **shared edge** — one geometric wall that appears in
*both* room polygons. Cutting only one room's stroke leaves the other room's gold line still
crossing the doorway.

### 2. "Check all functionalities"

The merge changed exactly one data model — `Property.rooms[]` — and made the canvas render
every room from it. **Everything else in the app still assumes one room.** Specifically:

- `designStore` still projects only the active room (`designStore.ts:69-105`), so six surfaces
  silently operate on one room while the user looks at all of them: TopBar L/W + item count,
  DetailsPanel, FloatingCluster, ClearControls, RoomEstimatePanel, placementActions.
- Export/share and the PDF capture only the active room (`RoomCanvas.tsx:771` admits it).
- `wallStore`, `floorZoneStore`, `wallTreatmentStore` are **global singletons with no
  `roomId`** — VERIFIED. They are not part of `Property` at all.

### 3. "The flooring doesn't work"

Correct, and more completely than described: **there is no flooring feature at all.**

- `floorZoneStore.addZone` has **zero production callers** — only tests. No component, hook,
  handler, tool button or gesture creates a floor zone. `git log` shows one commit,
  "Phase C scaffolding", never finished.
- `RoomCanvas.tsx` contains **not one reference** to the floor-zone subsystem. Even a zone that
  already existed in localStorage would never be painted. VERIFIED by an adversarial verifier.
- What looks like "flooring" is the flat navy polygon fill `ROOM_FILL = '#1D3140'`
  (`blueprintTheme.ts:27`) — no material concept.
- Two competing catalogs with **zero ID overlap**: `FLOOR_MATERIALS` (`floorMaterials.ts`,
  priced per unit) vs `ECO_FLOORING_CATALOG` (`paintPalette.ts`, priced per m²). The only
  picker in the UI reads catalog A; the zone store's foreign key points at catalog B. Wiring
  the obvious one-line fix would price every floor at Rs 0, silently.

### 4. "People need to place things on top of the flooring"

The only shipped way to get flooring onto the canvas is the catalog's **Flooring tab** — 8
`category: 'flooring'` SKUs placed as *ordinary furniture items*. And `collidesWithAny`
(`geometry.ts:238-247`) is **category-blind**: it rejects any rectangle overlap.

So: lay a rubber tile, try to put a treadmill on it → refused, and `findFreeSlot`
(`geometry.ts:322-345`) then **silently teleports the treadmill somewhere else** with no
message. Tile a whole room and every subsequent product gets "Item won't fit — the room is
full."

Flooring-as-an-item is fundamentally incompatible with the collision model.

> Caveat the critic raised and I have **not** yet resolved: on desktop, an armed placement
> click landing on an existing item may never reach `validatePlacement` at all — the Stage
> guard at `RoomCanvas.tsx:1258` returns first and the click dies silently. A dead click and a
> rejected placement look identical to a user but have different fixes. **Needs a 60-second
> manual repro on the live build.**

### 5. "No need for room 2, 3 etc — they should be different pages"

The naming is worse than described. **Four competing auto-naming schemes**, two of them dead:

| Path | Name produced | Anchor |
|---|---|---|
| Draw a room | **always literally "Room 1"** | `RoomCanvas.tsx:320` `setDrawName('Room 1')` |
| Quick rectangle | `Room ${rooms.length + 1}` → "Room 2", "Room 3" | `RoomCanvas.tsx:235` |
| Add-room modal | "New Room" | `AddRoomChooser.tsx:31,45` |
| `propertyStore.addRoom` / `addRectangleRoom` fallbacks | `Room ${n+1}` | dead code, unreachable |

Draw three rooms and the sidebar shows **three rows all reading "Room 1"** and the canvas
paints "ROOM 1" over all three. The `setDrawName('Room 1')` line is stale — its comment still
describes the pre-merge behaviour where entering draw mode wiped every other room.

Blocking ambiguity on the "pages" half — see `01-OPEN-DECISION.md`.

### 6. "Mid drawing a line, the undo button doesn't work properly"

VERIFIED divergence between the two undo paths:

- **Keyboard**: `RoomDrawMode.tsx:309-316` intercepts Ctrl+Z *only when vertices exist* and pops
  the last vertex — correct, Sims-like. `useKeyboardShortcuts.ts:57` additionally no-ops
  undo/redo while `isDrawTransactionActive()`.
- **Button**: `TopBar.tsx:92,107` calls `useHistoryStore.undo()` **with no draw-transaction
  guard at all**. Mid-draw it reaches the global history, which is suppressed by the open
  transaction.

Same intent, two behaviours. Three further latent history defects sit behind it (see
`02-BUILD-PLAN.md` — they must be fixed in a strict order or the visible symptom disappears
while history keeps eating real user frames).

---

## What the research says the target model is

The Sims research and the floor-plan-software research converged independently on the same
architecture:

1. **Store the wall graph; derive the rooms.** In The Sims a room is *not* a drawn object —
   the engine detects enclosure and derives it. Bucket-fill flooring, shared walls, merges and
   L-shapes all fall out of derivation for free and are near-impossible to retrofit onto stored
   rectangles.
2. **Openings are wall-hosted children**, parametric along their host: `(wallId, offset_mm,
   width_mm)`. Rendering, hit-testing and validation all reduce to 1-D interval maths.
   Two flip booleans (`flipFacing`, `flipHand`) give all four real door hands.
   One record serves doors *and* windows, discriminated by `sill_mm`.
3. **Per-room floor finish, not per-tile painting** — for a commerce tool, click a room, pick a
   material, it fills the polygon. Expose only texture rotation + scale.
4. **Explicit integer layer bands**, never insertion order: floor finish → room fill → grid →
   walls + openings → items → annotation → selection.
5. **Never ship "Room 1" as a final label.** Professional tools use a room *type* picker
   (Treatment Room, Sauna, Recovery Lounge, Gym Floor…). The type is the commercial keystone —
   it filters the catalog and seeds defaults.
6. **Hierarchy** — Project → Space (the "page", the quotable unit) → Variant (alternative
   layouts of the same space).

Deliberate divergences from The Sims, both flagged as known player annoyances rather than
design wins: store an opening's vertical position as a **semantic anchor** (sill/head/centre +
offset) so a wall-height change re-solves it; and use **explicit layer bands** rather than
implicit placement order.

---

## Cross-cutting risks the critic surfaced (all must be handled before the relevant fix)

1. **The e2e gold pixel-scan is the coordinate basis for every multi-room spec.**
   `roomOrigin()` (`tests/e2e/multiroom-helpers.ts:125`) grabs the first Konva canvas and finds
   the leftmost pixel matching `r>200, 120<=g<=190, b<90`. **A warm floor material or a gold
   door symbol poisons it silently** — the specs keep passing while testing the wrong
   coordinates. Fix the harness before writing any door or floor render code.
2. **Adding a field to `Room` is a silent data-loss bug** unless `normaliseLoadedRoom`
   (`propertyStore.ts:498-540`) is extended in the same commit — it whitelists fields, so
   anything new survives reload but is deleted by every Save/Load round trip.
3. **A schema bump to v3 is a no-op** — both `migrate()` guards test `version >= 2` rather than
   the current version (`propertyStore.ts:456`, `designsStore.ts:182`).
4. **New state outside `property` is invisible to undo** (`snapshotsEqual`). Prefer nesting new
   state inside `Property` — it is free for history because `property` is stringified whole.
5. **A listening floor kills placement.** The plan layer is `listening={false}` precisely
   because the Stage commit handlers guard on `e.target !== stage` (`RoomCanvas.tsx:1258`).
6. **No fix may add an API route** — the deploy is at exactly 12/12 Vercel functions. Confirmed
   harmless: the server stores `property` as opaque JSONB (`api/orders.ts:766`).
7. **"Room" is the billing unit** in the cart, Stripe metadata, the confirmation email and the
   PDF. Renaming the UI label is cheap; renaming the wire payload is a Neon-compat problem.

## What was NOT covered

The audit read the designer canvas thoroughly but never opened the merchant-capture subsystem,
MerchantAgentPage, the second cart (Marketplace*), or the admin surfaces. "Check all
functionalities" is not fully answered yet — that sweep is queued as a separate pass.
