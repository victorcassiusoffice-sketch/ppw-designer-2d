# Designer — Sims-style floor painting

**Date:** 2026-08-28 · **Status:** SHIPPED, live on production
**Branch:** `feat/designer-floor-painting-2026-08-28` (3 commits) → merged `f123537`
**Live:** `designer.ppwellness.co` serving `f12353730fda…`, verified by cache-busted healthcheck

---

## What Vic asked for

> "do deeper research on the the exact code and method the game 'The Sims' uses flooring tool
> build workflow, build then apply and deploy the floor build."

## The honest framing

**EA's source code is not public.** Nothing here is "the exact code" from The Sims, and any
claim otherwise would be fabrication. What the research pass gathered, with every finding
tagged by evidence class:

- **OBSERVED-BEHAVIOUR** — documented interaction from official guides, wikis, patch notes
- **COMMUNITY-REVERSE-ENGINEERED** — file-format work by SimPE / Sims 4 Studio authors
- **INFERRED-ALGORITHM** — the standard algorithms the behaviour implies

81 mechanics were catalogued across four research angles (Sims 4/3 build mode, Sims 1/2 plus
storage formats, the engine-independent algorithms, and how non-game tools like Planner 5D
and RoomSketcher handle it commercially).

## What was adopted from The Sims

| Gesture | Behaviour |
|---|---|
| Click | paints one tile |
| Drag | paints the rectangle between anchor and cursor, committed on release |
| **Shift** | **fills the whole room** — the feature Vic asked for by name |
| Ctrl | erases, with the same gesture set |
| — | live preview of the affected region *before* the click |
| — | **one undo per stroke**, never per tile |

Also adopted: a persistent by-tile / whole-room mode toggle, and repainting under a placed
object being allowed rather than blocked.

**Rejected**, with reasons: quarter-tile triangular quadrants; flood-fill by material
connectivity (it escapes through doorways); painting onto bare terrain outside rooms; and the
sledgehammer that wipes a whole room's floor.

## Where a game and a quoting tool part company

The Sims' floors are free and infinite. PPW's are real K1 product bought by the square metre.
Two decisions followed, both Vic's:

**1. The quote is built on TILES TO ORDER**, with covered m² shown alongside as context. A
customer billed for 23.4 m² who receives 29 tiles cannot reconcile the invoice. The 10%
offcut allowance applies to **cut tiles only**, not the whole floor — a room whose tiles fit
exactly pays no waste.

**2. Rolls stay whole-room.** The EPDM roll is 10 × 1.25 m of sheet laid in continuous runs.
A tile count for it would be a fictional unit on a quote, so non-tileable materials are
excluded from the paint palette and keep the existing area-priced path.

## The coverage rule — the decision that carries the money

**Paint every tile the room INTERSECTS, not every tile whose centre is inside.**

A centre-inside rule leaves a bare margin of up to half a tile against every wall. On the
repo's own 5 × 4 m fixture room in 0.92 m gym tile it paints **20 tiles for a floor that needs
30** — quoting the customer ten tiles short of a floor that fits. Both numbers are pinned in
`floorTiles.test.ts` so it cannot regress.

## Three defects caught by adversarial review before any of it ran

1. **`clipFunc` on a `Shape` is a silent no-op.** It is a Konva *Container* property. The clip
   now lives on a `Group`; without that, boundary tiles render out over the walls and nothing
   fails. Verified: `clipFunc` appears once in `RoomCanvas.tsx`, on a Group.
2. **The Stage would have eaten the drag.** `draggable` was true in exactly the state the
   floor tool runs in, so press-and-drag would pan the canvas. Single clicks would still have
   worked — the failure that looks like "mostly fine" in a quick manual test.
3. **The under-ordering rule above.**

## Proof

| Gate | Result |
|---|---|
| Unit tests | **1900 passed** / 161 files (was 1870) |
| E2E | **44 passed, 0 failed** across floor-paint, flooring, units, drag-place, item-pickup, multiroom, placement, door, undo |
| Typecheck · build · lint | clean · clean · 0 errors |
| Testids | 156 → **161**, none dropped |
| Protected files | `geometry.ts`, `wallAwarePlacement.ts`, `imageFit.ts` — untouched |
| Persist | `ppw_property_v2` still **version 2**, `partialize` unchanged |

### Live verification on production

```
healthcheck → commit f12353730fda… (4 stale reads first, then the merge SHA)

Playwright against designer.ppwellness.co:
  palette renders                     ✓
  Shift-click fills room 1            30 tiles   (6x5 lattice over 5x4 m at 0.92 m)
  neighbouring room untouched          0 tiles
  batched render nodes                 1         (not one per tile)
  clip groups                          1
  console errors                       0
```

The dev geom bridge is absent in production by design, so the live check aims with stage
coordinates rather than world metres.

## Deliberate gaps

- **Roll-run layout** (strip direction, seam placement, offcut optimisation) is not built.
  Rolls are whole-room only, per Vic. If K1 needs roll layout before the Designer is credible
  to them, that is a materially bigger build.
- **The contractual basis still needs K1's confirmation.** The tool now quotes tiles-to-order
  with m² alongside; a merchant who quotes on net m² will produce a different total from the
  same design. Worth settling before a quote goes out.
- Floor lines are shown in the estimate panel but are **not yet pushed into the order/quote
  payload** — that is the next step if these numbers are to reach an invoice.
