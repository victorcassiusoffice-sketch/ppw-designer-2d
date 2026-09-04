# Eco / solar onboarding — plan, workflow and live status

Round 10 of the Sims-world workstream, branch `feat/sims-world-2026-08-29`
(preview-only; Vic merges). Started from HEAD `7091ad4`.

Vic's brief, 2026-09-04, verbatim shape:

> Start implementing onboarding for ecological facilities such as solar panels
> and other tech … develop the algorithm … take a solar panel, calculate the
> output and sun in Mauritius … when a person adds something electronic it
> calculates the output of the electric device (where information should be on
> the merchant's product page) … it has an eco category where solar panels are
> … when added a solar panel it can show if the solar panel is sufficiently
> providing enough power for the current electrical products that are on the
> canvas/room or even outside the room … how much energy is surplus or lacking
> according to how many solar panels the person has added … these obviously
> need to be on a roof, as such when selecting solar panels a roof with the
> roof surface measured at room scale can automatically pop up, additionally a
> roof button is there so people can also add any objects or flooring to the
> roof … user friendly and not clutter the designer … select level 1 and 2 or
> rooftop and add as many floors as they want and also a stair feature …
> pull real Mauritius products from Solaire / Emcar (Victron) / Suntricity /
> Solar Center — these are also the companies worth onboarding as merchants.

## The plan (nine parts)

| # | Part | State |
|---|---|---|
| 1 | **Research**: 4 MU solar shops (products, prices, specs, images, merchant contacts) with an adversarial verifier per shop; 4 brands (LONGi / JA Solar / Huawei / Victron) for clean images + datasheet dimensions; 4 science lanes (Mauritius irradiance, CEB tariffs + net-metering, appliance wattage table, PV sizing method + UX precedents) | **DONE** — 16 agents returned; see §Workflow below |
| 2 | **Sun + algorithm**: PVGIS-sourced Mauritius figures, pure calculator | **DONE** — `src/data/mauritiusSolar.ts`, `src/designer/solarCalc.ts` (+12 tests), `src/data/__tests__/mauritiusSolar.test.ts` (4) |
| 3 | **Energy model**: which products generate / store / draw, whole-plan balance across every level and outdoors | **DONE** — `src/designer/energy.ts` (+12 tests), `src/data/applianceLoads.ts` |
| 4 | **Roof level**: one roof on top, slabs mirroring the storey beneath, auto-pop when a panel is armed, Roof button, wall tools refused | **DONE** — `src/designer/levels.ts` (roof level), `src/designer/roof.ts` (+13 tests), `src/designer/useRoofSync.ts`, store actions, TopBar button, canvas slab render |
| 5 | **Roof placement**: panels snap edge-to-edge on the tile lattice, stay on the slab, off-slab refused | **DONE** — `usesTileLattice` in `flooringLattice.ts`, gating in `RoomCanvas` (commit + ghost + drag paths) |
| 6 | **Eco catalog**: `solar` category, Eco tab, 8 priced Emcar products with real MUR prices and WebP art | **DONE** — schema + labels + fills + macro tab + icon; `products.json` 33 → 41 |
| 7 | **Energy readout UI**: one canvas chip, docked panel (md+) / phone sheet section, per-item switches and hours | **DONE** — `src/components/EnergyPanel.tsx`, chip in `RoomCanvas`, `DetailsPanel` power controls |
| 8 | **Merchant power fields**: DB migration 0029 (gated), API pass-through, adapter, merchant form, page scrape | **DONE** — `0029_products_energy.sql` (+rollback, NOT applied), `api/products.ts`, `apiCatalogAdapter.ts`, `MerchantAddProductPage.tsx`, `src/lib/energySpecs.ts` (+14 tests), `scripts/scrape-energy-specs.ts` |
| 9 | **Gate + evidence**: tsc, eslint, vitest, build, Playwright, captures, docs, preview verify | **IN PROGRESS** — see §Current step |

**Deliberately NOT in this round** (flagged for Vic): the **stairs feature** he
asked for. Stairs are an item that links two levels (a void on the storey
above, a run below) and touch the level model, placement, render and the
plan/PDF export. Doing them properly is its own round; doing them badly would
put a decorative box on the plan that means nothing. Everything else in the
brief is in.

## The workflow that was run

One dynamic workflow, `eco-solar-research-and-map`, 23 agents in 4 phases
(run `wf_82d4edf0-76d`, 3,328 s, 4.79 M subagent tokens, 1,327 tool calls):

- **Shops** (8 agents, pipeline): one extractor per shop → an adversarial
  verifier that re-fetched every product URL, price, spec and image the same
  run. All 4 verifiers returned confidence HIGH. Result: only **Emcar**
  publishes prices; the other three are quote-only.
- **Brands** (4 agents, parallel): LONGi, JA Solar, Huawei, Victron — official
  product pages, transparent-PNG renders and datasheet dimensions.
- **Science** (4 agents, parallel): Mauritius irradiance (PVGIS/GSA/NASA),
  CEB tariffs + SSDG/MSDG net-metering, an appliance wattage table, and the
  PV sizing method with UX precedents.
- **Code map** (7 agents): **FAILED** — every one returned "You've reached your
  Fable limit". No loss: the repo mapping had already been done by hand in
  this session (every touch point read directly), which is what the
  implementation was built from.

Full research record: `01-MERCHANTS.md` in this folder. Raw agent output:
`journal.jsonl` in the run's transcript directory.

## Ground truth at start

```
git rev-parse HEAD                → 7091ad4af980e54044554a5d4770a505076d25b0
git ls-remote origin <branch>     → 7091ad4… (remote == local)
GET /api/healthcheck?cb=…         → {"ok":true,"env":"preview","commit":"7091ad4…"}
```

## Current step

Part 9. Done so far: tsc 0 · eslint 0 errors on every touched file · vitest
**2348/2348 (181 files)** · `npm run build` clean · Playwright `eco-solar`
5/5 plus the affected specs green · the capture script drives the feature end
to end on the dev server with **0 console errors**.

The captures exposed one real gap, being fixed now: `APPLIANCE_LOADS` shipped
as an empty scaffold, so a treadmill with no `power_w` on its row counts as
0 W and the energy chip stays hidden on a consumers-only plan. The research
table is being written into it now; then the captures re-run (short → add
panels → covered), docs + vault handoff, commit, push, preview verify.
