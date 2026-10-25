# Catalogue and estimate evidence — fix round

One Live Build · `gpt/olb-sims-parity-2026-10-22` · 25 October 2026.
Local results only. Publication and the complete fix-round checks belong to the parent task.

## Catalogue results

- P2-9: actual supplier photography now takes precedence over baked model images. The existing model thumbnails remain cached fallbacks. Plan images and symbols are labelled as illustrations; no new pictures or models were generated.
- P2-7: the default Bathroom room view now starts with the toilet, basin and bidet. Pipes follow, then general lighting and surfaces. An explicitly selected name or footprint sort is still respected.
- Products uses a shopping-cart glyph, including the shared icon used by TopBar and House. The analysis footer keeps product-list access and hides its quantity count on the demo; normal Designer counts and estimates are unchanged. The RoomCanvas control was coordinated with its owner.

`node tools/catalogue-fix-shot-2026-10-24.mjs http://127.0.0.1:5176 before` and the matching `after` run each completed at desktop 1280 × 800 and phone 390 × 844, in both Plan and House. The final run recorded four view checks, eight screenshots, zero console/page errors, zero attempted API writes and no horizontal overflow. Demo catalogue text contained no prices, currency or retailer names; price sorting remained absent.

Before: the first fitness image was a baked model PNG; the first Bathroom product was a table lamp. After: the first fitness image was its existing product photograph; the first three Bathroom products were sanitary fixtures. The raw reports record their IDs and image paths. Screenshots are in `catalogue-before/` and `catalogue-after/`, named by device, view and subject.

Missing-photo sanitary products still use explicitly labelled plan illustrations in this branch. These fixes do not claim new realistic meshes, exact product photography where none exists, live stock or merchant-declared variants. PR49 remains separate.

## New estimate evidence panel

`EstimateEvidencePanel` takes the existing `Property` as its only prop. The Materials owner mounted it without changing estimating formulas. The panel starts collapsed and presents:

1. Input fields present versus applicable checks, explicitly labelled presence rather than accuracy.
2. Recorded product-source links and engineering document references, explicitly unverified.
3. An expandable inventory of eleven distinct existing implementation modules, with inputs, outputs, evidence basis and limits.
4. Independent invoice validation as unavailable. Passing software tests cannot establish empirical price accuracy.

The pure `assessEstimateEvidence` function does not recalculate or modify quantities. It deduplicates placed-product IDs, treats unresolved products / missing dimensions / non-web references as needing review, and never converts a saved document name into engineering approval. The panel also updates when the existing merchant catalogue arrives, without starting another network request. No percentage of accuracy is invented. The panel shows no client, retailer, product name or monetary value.

### Actual code inventory

Paths are relative to `C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/`. These are separate implementation modules, not a count of every helper or a claim of eleven independent simulation systems.

| Module | Implemented scope | Limit made explicit |
|---|---|---|
| `src/designer/propertyMaterials.ts` | Building areas, shared-wall and opening deductions | Requires surveyed drawing inputs |
| `src/designer/materials/estimate.ts` | Masonry, mixes, plaster, straight rebar and roof takeoff | No mix-strength or structural-capacity design |
| `src/designer/foundation.ts` | Excavation, fill and entered reinforcement quantities | No geotechnical, safe-slope or pile-capacity design |
| `src/designer/wallPaintCalc.ts` | Painted area, coats, coverage and container quantities | Actual substrate and site yield need confirmation |
| `src/lib/floorCalculator.ts` | Coverage, cutting allowance and pack rounding | No exhaustive cutting / substrate optimisation |
| `src/designer/buildingServices.ts` | Three-dimensional routes and material schedules | No hydraulic, electrical or fire certification |
| `src/designer/solarCalc.ts` | Indicative generation, demand and autonomy | No hourly shading or guaranteed energy yield |
| `src/designer/city.ts` | Road, trench, network and data-centre takeoff | No network-capacity, junction or consent approval |
| `src/designer/eco.ts` | Tree envelopes and added green-roof loads | No root survey or structural capacity inferred |
| `src/designer/sustainability.ts` | Evidence-gated carbon / moisture / technology screening | No full life-cycle or transient moisture simulation |
| `src/designer/materials/costs.ts` | Matching quantity / quotation specifications and incomplete-rate flags | No observed invoice-error validation dataset |

The inventory points to an existing test file for every module. Its new test checks that these source/test paths exist; it does not call that fact numerical test coverage.

## Focused checks

`npx vitest run src/components/__tests__/catalogMetadata.test.ts src/components/__tests__/CatalogProductExtras.test.tsx src/components/__tests__/catalogPresentation.test.ts src/designer/__tests__/estimateEvidence.test.ts src/components/__tests__/EstimateEvidencePanel.test.tsx src/components/__tests__/AnalysisCartSummary.test.tsx --reporter=dot` → six files, 27 tests passed.

Scoped ESLint for these files and their production modules → passed with zero warnings.

Key new checks: actual-photo precedence and labelled fallback after image failure; mismatched mesh fallback rejection; sanitary-first default ordering without changing explicit sorts; distinct real implementation paths; missing input stays unknown; unique-product source counts; saved references never imply approval; no project mutation; no names / money / fabricated percentages in the new panel.

The new panel's final real-pointer result is in `estimate-evidence/report.json`: six check groups, four screenshots, zero console/page errors, zero attempted API writes and no horizontal overflow, at desktop 1280 × 800 and phone 390 × 844. The first attempt hit a route-import error (`roomOpenings` export missing), retained as `report-import-error.json`; the parent task fixed that import before the passing rerun. Visual inspection also caught low contrast from inherited text colours; the final card uses the existing light studio tokens. The demo footer now shows a cart icon and Products without a count.

The evidence panel is new, so there is no matched baseline screenshot for it. Catalogue has genuine before/after captures. The phone panel scrolls within the existing Materials workspace; this task does not claim a wider redesign of that workspace.

## Files and boundaries

Owned app changes: `src/components/catalogMetadata.ts`, `catalogPresentation.ts`, `CatalogProductExtras.tsx`, `catalogChrome.css`, `AnalysisCartSummary.tsx`, `StudioIcon.tsx`; new `src/designer/estimateEvidence.ts`, `src/components/EstimateEvidencePanel.tsx`, `src/components/estimateEvidencePanel.css`; their focused tests and the two new QA tools. The previous catalogue QA harness now expects the supplier photo first, matching the corrected rule.

No formula, protected geometry/material/foundation/service test, API, database, environment variable, dependency, merchant credential or model asset was changed by this task. No paid generation, order, email, login, commit, push, merge or deployment was performed.

Required report copy: `C:/Users/Victor/Documents/PPW-Second-Brain/06-Roadmap/agentix-os/inbox/olb-sims-parity-2026-10-22/CATALOGUE-AND-ESTIMATE-EVIDENCE.md`.
