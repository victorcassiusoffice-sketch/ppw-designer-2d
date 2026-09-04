# Findings, decisions and what is open

## What the research changed about the plan

1. **Only one of the four shops has prices.** Emcar (the Victron
   distributor) runs a real WooCommerce shop with public MUR prices, stock
   status and a Store API. Suntricity, Solaire and Solar Center are all
   quote-only — no cart, no price list, some with an empty WooCommerce
   install. So the Eco tab ships with **eight priced Emcar products**, and
   the other three are documented as onboarding targets with datasheet-grade
   specs ready to seed (`01-MERCHANTS.md`).
2. **Panel dimensions are the load-bearing datum, and merchants rarely
   publish them.** A panel is placed to scale on a roof, so 1903 × 1134 mm
   matters more than the wattage. Emcar publishes dimensions; Solaire says
   only "450 Watt Mono Panels" with no model. That is why the brand agents
   (LONGi, JA Solar, Huawei, Victron) were run — their datasheets carry the
   exact millimetres for whatever a merchant later names.
3. **PVGIS 5.2 refuses Tamarin as "over the sea"; 5.3 does not.** Recorded
   in `mauritiusSolar.ts` so nobody re-derives it. Also: PVGIS azimuth 0 is
   SOUTH, so a north-facing southern-hemisphere plane is `aspect=180`.
4. **The MU convention beats the optimiser.** A 20° north-facing frame
   yields 1.5 % more here than PVGIS's own "optimal" 16° at 11° east of
   north, because the Tamarin horizon shades the west. The readout assumes
   the convention and says so.

## Decisions taken (and why)

| Decision | Why |
|---|---|
| The roof is **one level**, `id: 'roof'`, always on top; its slabs are real Rooms of `kind: 'roof'` mirroring the storey beneath | Slabs as Rooms means placement, collision, the flooring lattice, the Floor tool, undo, autosave and the API's opaque-JSON property all work on the roof for free. A bespoke roof object would have had to re-implement all of it. |
| Panels snap on the **tile lattice**, not the 0.5 m grid | A panel array is laid edge-to-edge exactly like floor tiles. `usesTileLattice()` now covers flooring AND roof-placed products, so Duplicate lands the next panel flush and "Fill" carpets the slab. |
| The energy readout is a **readout, not a tool** | It has no `BuildTool`, so it can never fight the door/floor/wall-paint tools for a canvas click. Opening it stands down any build tool and vice versa, so the right-hand dock only ever shows one panel. |
| The chip **hides** until something electrical or a panel is on the plan | Vic: "user friendly and not clutter the designer". An empty plan looks exactly as it did before this round. |
| Wattage falls back to a **sourced reference table** when the merchant has none | Vic's ask assumes "information should be on the merchant's product page". Often it is not. A treadmill that counts as 0 W would make the whole feature lie. |
| Migration 0029 is **authored, not applied**, and gated by `ENERGY_DB_COLUMNS` | Same posture as 0027: Neon is a single branch, and a deploy that SELECTs a column the DB lacks empties the catalog. Vic applies it on Neon, then flips the flag. |
| Money stays **off** the readout | `annualBillEffect()` exists and is tested, but CEB tariffs and the SSDG/MSDG export rates change what a quote implies. That is a Vic call, not a default. |

## Open for Vic

1. **Stairs** — asked for, not built this round. They are an item that links
   two levels (a run below, a void above) and touch the level model,
   placement, render and the PDF/share export. Own round.
2. **The three quote-only merchants** — Suntricity, Solaire, Solar Center.
   Worth onboarding (Suntricity carries the modern Huawei + JA/Jinko
   residential kit; Solar Center is the Sigenergy distributor with a
   20-year lease product). The Designer would need a "price on request"
   product state, and Solar Center's lease does not fit a cart line at all.
   Contacts and catalogs are in `01-MERCHANTS.md`.
3. **Apply migration 0029 on Neon** and set `ENERGY_DB_COLUMNS=1`, so
   merchant-entered wattage reaches the canvas. Until then the seeded
   catalog and the reference table carry the feature. (Note 0026/0027 are
   still unapplied in prod too.)
4. **Tariffs on screen** — say the word and the panel gains "saves about
   Rs X/year at the CEB domestic rate", with the export rate for surplus.
5. **VAT wording** — Emcar's prices carry no VAT statement anywhere on the
   site. The seeded notes say so per product rather than guessing.

## Traps for whoever picks this up

- `Level.kind` and `Room.kind: 'roof'` are **whitelist fields**: they are
  carried in `normaliseLevels` and the room normaliser. Miss one and the
  roof loads back as a plain storey with walls.
- `PlacedItem.powerOn` / `hoursPerDay` are likewise whitelisted, and ON is
  the ABSENT field (canonical form) so old saves are byte-identical.
- `nextLevelIndex` ignores the roof, and `addLevel` bumps the roof's index
  up: a storey added later slots BENEATH the roof, never above it.
- `syncRoofRooms` is idempotent and returns the SAME reference when nothing
  changed — `useRoofSync` depends on that to avoid a render loop.
- A roof slab keeps its id (`roof-<sourceRoomId>`), so panels survive a
  resize of the room below. An orphaned slab is only dropped if it is empty.
- The dock thumbnails are `loading="lazy"`; with 41 products the off-screen
  tail reports `img.complete === false` while already decoded. Assert
  `naturalWidth > 0`, never `complete` (this cost one red spec).
- `energySpecs.ts` scores candidates by context: "450 W" is a panel on a
  LONGi page and a heater on a sauna page. Deliberately broad terms were
  dropped from the appliance table (`pool`, `pump`, `ac`, `screen`) because
  they mis-hit furniture — a pool TABLE is not a 2 kW pump.
