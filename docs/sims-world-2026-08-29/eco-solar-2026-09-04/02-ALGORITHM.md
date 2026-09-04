# The energy algorithm — what the numbers mean

Everything the readout shows comes from four pure modules with no store or
DOM access, so each is unit-testable with round numbers:

| Module | Job | Tests |
|---|---|---|
| `src/data/mauritiusSolar.ts` | the sun, sourced from PVGIS | `mauritiusSolar.test.ts` (4) |
| `src/designer/solarCalc.ts` | the arithmetic | `solarCalc.test.ts` (12) |
| `src/data/applianceLoads.ts` | what an appliance draws when the merchant did not say | `applianceLoads.test.ts` (9) |
| `src/designer/energy.ts` | the whole-plan balance | `energy.test.ts` (12) |

## 1. Generation

```
daily generation Wh = installed Wp × PSH × PR
```

- **PSH** — peak sun hours, the plane-of-array irradiation in kWh/m²/day,
  which is numerically the hours of 1 kW/m² sun the array sees.
- **PR** — performance ratio, everything lost between the module nameplate
  and the socket: cell temperature, soiling, wiring, mismatch, inverter.

Mauritius figures, fetched from **PVGIS 5.3** (European Commission JRC) on
2026-09-04 for Tamarin (20.33°S 57.37°E), database **PVGIS-SARAH3**
(satellite, 2005–2023), meteo ERA5, DEM-calculated horizon, crystalline
silicon, 14 % system loss:

| Case | Tilt / facing | PSH annual | kWh/kWp/yr | PR |
|---|---|---|---|---|
| **default** | 20° north | **5.17** | 1462.2 | **0.775** |
| PVGIS optimal | 16°, north-north-east | 5.10 | 1440.3 | 0.774 |
| flat on the slab | 0° | 4.96 | 1401.4 | 0.773 |

The readout uses 20° north — the Mauritian convention for a tilt frame on a
flat concrete slab (tilt near the latitude, facing the equator). It beats
PVGIS's own "optimal" here by 1.5 %, because the Tamarin mountains shade the
west and the optimiser leans the array east to compensate; a customer with a
plain north-facing frame gets the better number. All three cases are in the
file so the panel can say which it assumed.

PR is derived, not guessed: it is PVGIS's own delivered energy over its own
plane-of-array irradiation (1462.16 / 1885.83 = 0.775), so every loss PVGIS
models sits inside one ratio. Feeding 1 kWp back through `solarCalc`
reproduces PVGIS's annual figure to within 1 % — asserted in the test.

Two gotchas recorded for whoever refreshes these numbers:

- PVGIS **5.2 refuses the point** as "Location over the sea" (the coast is
  300 m away); 5.3's SARAH3 grid covers it. Use `api/v5_3/`.
- PVGIS azimuth **0 is SOUTH**. A north-facing plane in the southern
  hemisphere is `aspect=180`, or use `optimalangles=1`.

## 2. Load

```
daily load Wh = Σ (appliance W × hours per day)
```

Per placed item, the watts come from, in order:

1. `Product.power_w` — what the merchant published (the scrape reads it off
   the product page, see `src/lib/energySpecs.ts`);
2. the appliance reference table by product name, then category;
3. nothing → the product is not a consumer.

Hours per day: the item's own override → the product's `duty_hours_per_day`
→ the reference row's default → 2 h. Every item can be switched out of the
estimate entirely (`PlacedItem.powerOn`), and a light already obeys its own
light switch.

The reference table is 36 rows sourced on 2026-09-04 from manufacturer
nameplates and energy datasets — Harvia sauna heaters, Titan chillers,
Peloton's own compare page, Concept2's PM5 support page, Apple's Mac mini
power table, ENERGY STAR fridge and TV datasets, PNNL on pool pumps. The
honest parts are marked: self-powered gear (Concept2 rowers, Keiser bikes,
every plate-loaded machine) is **0 W by definition**, and figures derived
rather than measured say "est." in their `source`.

## 3. The balance

```
net = generation − load        (+ surplus, − shortfall)
coverage % = generation / load, capped at 999
panels to cover = ceil(shortfall / one panel's daily generation)
```

Status drives the traffic light: **covered** (net ≥ 0 with a load, or panels
and no load), **partial** (≥ 50 % covered), **short**, or **none** (nothing
electrical on the plan yet — the chip stays hidden).

Also reported: peak load (everything on at once, which is what an inverter
must carry), battery autonomy at the average load (usable kWh ÷ average W,
90 % depth of discharge), and whether the inverter covers the peak.

Worked example, the capture scene: a NordicTrack 2450 (350 W × 1 h), a Tour
de France bike (60 W × 0.75 h), an Arc floor lamp (10 W × 4 h) = **435 Wh/day**,
peak 420 W. One Jinko 475 Wp panel makes 475 × 5.17 × 0.775 = **1903 Wh/day**,
so one panel covers it four times over — which is why the hint reads "Add
1 × 450 Wp panel". Six panels on the slab: **11.4 kWh/day**, +11.0 surplus.

## 4. What is NOT modelled (deliberate, and why)

- **Batteries do not shift load in time.** The report gives capacity and
  hours of autonomy, not an hour-by-hour simulation. A customer laying out a
  gym wants "will my panels cover this", not a dispatch model.
- **No shading, no roof pitch, no string design.** The panel says which sun
  case it assumed; a real installer's quote will differ, and the copy never
  claims otherwise.
- **Money is not on the readout.** `annualBillEffect()` exists in
  `solarCalc.ts` (self-consumption at the import tariff, export at the
  export rate) but nothing calls it yet: the CEB tariff and the SSDG /
  MSDG net-metering rates are a Vic decision before they go on a customer's
  screen, since they change what a quote implies. The research is in the
  record when he wants it.
- **Panels are counted wherever they are.** A panel dropped on a storey
  instead of the roof still generates, but the panel flags it ("2 panels not
  on the roof") rather than silently ignoring it.
